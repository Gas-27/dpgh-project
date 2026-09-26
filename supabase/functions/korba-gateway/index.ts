import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callbackUrl, korbaRequest, userMessage } from "../_shared/korba.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function transactionId() {
  return `DP-${crypto.randomUUID()}`;
}

function dataEndpoint(networkCode: string) {
  if (networkCode === "MTN") return "/mtn_data_topup/";
  if (networkCode === "TELECEL") return "/vodafone_data_topup/";
  if (networkCode === "AIRTELTIGO") return "/airteltigo_data_topup/";
  return "/collect/";
}

function walletClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase wallet service is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function debitWallet(body: Record<string, unknown>, amount: number) {
  if (body.wallet_only !== true) return null;
  const ownerType = String(body.wallet_balance_owner_type || "").toLowerCase();
  const ownerId = String(body.wallet_balance_owner_id || "");
  if (!ownerType || !ownerId) throw new Error("Wallet owner is required for wallet purchases");
  const { data, error } = await walletClient().rpc("debit_purchase_wallet", {
    p_owner_type: ownerType,
    p_owner_id: ownerId,
    p_amount: amount,
  });
  if (error) throw new Error(`Wallet debit failed: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.success) throw new Error(result?.message || "Insufficient wallet balance");
  return { ownerType, ownerId, amount, balance: Number(result.balance ?? 0) };
}

async function refundWallet(debit: { ownerType: string; ownerId: string; amount: number } | null) {
  if (!debit) return;
  const { error } = await walletClient().rpc("credit_purchase_wallet", {
    p_owner_type: debit.ownerType,
    p_owner_id: debit.ownerId,
    p_amount: debit.amount,
  });
  if (error) console.error("[korba-gateway] wallet refund failed", error);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let debit: { ownerType: string; ownerId: string; amount: number; balance: number } | null = null;
  try {
    const body = await request.json();
    const operation = body.operation;
    const transaction_id = body.transaction_id || transactionId();

    if (operation === "balance") {
      return json(await korbaRequest("/get_ova_balance/", {}));
    }
    if (operation === "status") {
      if (!body.transaction_id) return json({ error: "transaction_id is required" }, 400);
      return json(await korbaRequest("/transaction_status/", { transaction_id: body.transaction_id }));
    }
    if (operation === "transactions") {
      return json(await korbaRequest("/client_transactions/", {}));
    }
    if (operation !== "collect" && operation !== "data") return json({ error: "Unsupported Korba operation" }, 400);

    const amount = Number(body.amount);
    const customerNumber = String(body.customer_number || "").replace(/\s+/g, "");
    const networkCode = String(body.network_code || "").trim().toUpperCase();
    const productType = String(body.product_type || (body.mode === "services" ? "bill" : "data")).trim().toLowerCase();
    const allowedProductTypes = new Set(["airtime", "data", "electricity", "ecg", "water", "gotv", "dstv", "bill"]);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) return json({ error: "Enter an amount between GHC 0.01 and GHC 5,000" }, 400);
    if (!/^0[235]\d{8}$/.test(customerNumber)) return json({ error: "Enter a valid Ghana phone number" }, 400);
    if (!allowedProductTypes.has(productType)) return json({ error: "Unsupported Korba service type" }, 400);
    if (!networkCode) return json({ error: "Network or service code is required" }, 400);

    debit = await debitWallet(body, amount);
    const providerPayload = {
      amount: amount.toFixed(2), customer_number: customerNumber, network_code: networkCode,
      product_type: productType, product_id: body.product_id ? String(body.product_id) : undefined,
      meter_number: body.meter_number ? String(body.meter_number) : undefined,
      account_number: body.account_number ? String(body.account_number) : undefined,
      package_code: body.package_code ? String(body.package_code) : undefined,
      description: String(body.description || `DataPlug ${productType} purchase`), transaction_id, callback_url: callbackUrl(),
    };
    const endpoint = operation === "data" ? dataEndpoint(networkCode) : "/collect/";
    const result = await korbaRequest(endpoint, providerPayload) as { success?: boolean; error_code?: number; error_message?: string; [key: string]: unknown };

    if (result.success === false) {
      await refundWallet(debit);
      return json({ ...result, user_message: userMessage(result.error_code), wallet_refunded: Boolean(debit) });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    if (body.order_id) {
      await supabase.from("orders").update({ status: "processing", fulfillment_status: "pending", api_response: JSON.stringify(result), purchase_provider: "korba", purchase_provider_source: transaction_id }).eq("id", body.order_id);
    }
    return json({ ...result, transaction_id });
  } catch (error) {
    await refundWallet(debit);
    console.error("[korba-gateway]", error);
    return json({ error: error instanceof Error ? error.message : "Korba request failed", wallet_refunded: Boolean(debit) }, 502);
  }
});
