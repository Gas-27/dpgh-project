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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

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

    const providerPayload = {
      amount: amount.toFixed(2), customer_number: customerNumber, network_code: networkCode,
      product_type: productType, product_id: body.product_id ? String(body.product_id) : undefined,
      meter_number: body.meter_number ? String(body.meter_number) : undefined,
      account_number: body.account_number ? String(body.account_number) : undefined,
      package_code: body.package_code ? String(body.package_code) : undefined,
      description: String(body.description || `DataPlug ${productType} purchase`), transaction_id, callback_url: callbackUrl(),
    };
    const result = await korbaRequest("/collect/", providerPayload) as { success?: boolean; error_code?: number; error_message?: string; [key: string]: unknown };

    if (result.success === false) return json({ ...result, user_message: userMessage(result.error_code) });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    if (body.order_id) {
      await supabase.from("orders").update({ status: "processing", fulfillment_status: "pending", api_response: JSON.stringify(result), purchase_provider: "korba", purchase_provider_source: transaction_id }).eq("id", body.order_id);
    }
    return json({ ...result, transaction_id });
  } catch (error) {
    console.error("[korba-gateway]", error);
    return json({ error: error instanceof Error ? error.message : "Korba request failed" }, 502);
  }
});
