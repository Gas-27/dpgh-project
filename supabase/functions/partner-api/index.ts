import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizeNetwork(value: unknown) {
  const network = String(value ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (network === "vodafone") return "telecel";
  if (network === "air" || network === "airtel") return "airteltigo";
  return network;
}

function cleanRecipient(value: unknown) {
  return String(value ?? "").replace(/[^0-9+]/g, "").trim();
}

async function apiUser(request: Request) {
  const key = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!key) return null;
  const { data, error } = await supabase
    .from("api_users")
    .select("id, is_active, api_wallet")
    .eq("api_key", key)
    .maybeSingle();
  if (error || !data || data.is_active === false) return null;
  return data;
}

async function catalogPurchase(body: Record<string, unknown>, userId: string, idempotencyKey: string) {
  const serviceType = String(body.service_type ?? body.product_type ?? "data").toLowerCase();
  if (!["data", "airtime"].includes(serviceType)) throw new Error("service_type must be data or airtime");
  const network = normalizeNetwork(body.network);
  if (!["mtn", "telecel", "airteltigo"].includes(network)) throw new Error("Unsupported network");
  const recipient = cleanRecipient(body.recipient ?? body.phone_number ?? body.customer_number);
  if (recipient.length < 10) throw new Error("A valid recipient phone number is required");

  let amount = Number(body.amount);
  let productId = body.product_id ? String(body.product_id) : null;
  let productName = body.product_name ? String(body.product_name) : null;

  if (serviceType === "data") {
    if (!productId) throw new Error("product_id is required for data purchases");
    const { data: bundle, error } = await supabase
      .from("network_bundle_catalog")
      .select("product_id, name, amount, active")
      .eq("network", network)
      .eq("product_id", productId)
      .eq("active", true)
      .maybeSingle();
    if (error || !bundle) throw new Error("Unknown or inactive bundle product_id");
    amount = Number(bundle.amount);
    productName = bundle.name;
  } else {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) throw new Error("Airtime amount must be greater than 0 and no more than 5000");
  }

  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid purchase amount");
  const { data: reserved, error: reserveError } = await supabase.rpc("reserve_partner_api_purchase", {
    p_api_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_service_type: serviceType,
    p_network: network,
    p_product_id: productId,
    p_product_name: productName,
    p_recipient: recipient,
    p_amount: amount,
  });
  if (reserveError) {
    if (reserveError.message.includes("Insufficient API wallet")) throw new Error("Insufficient API wallet balance");
    throw new Error("Unable to reserve API wallet");
  }
  const purchase = Array.isArray(reserved) ? reserved[0] : reserved;
  if (!purchase) throw new Error("Unable to create purchase");
  if (purchase.status === "completed" || purchase.status === "refunded") return purchase;

  const gatewayPayload = {
    operation: serviceType === "data" ? "data" : "collect",
    product_type: serviceType,
    amount,
    customer_number: recipient,
    network_code: network === "telecel" ? "TELECEL" : network === "airteltigo" ? "AIRTELTIGO" : "MTN",
    package_code: productId,
    transaction_id: purchase.id,
  };
  const { data: providerResult, error: providerError } = await supabase.functions.invoke("korba-gateway", { body: gatewayPayload });
  if (providerError || providerResult?.success === false) {
    await supabase.rpc("refund_partner_api_purchase", { p_purchase_id: purchase.id, p_error: providerError?.message || "Provider purchase failed" });
    throw new Error("Provider purchase failed; API wallet was refunded");
  }
  const providerReference = String(providerResult?.transaction_id ?? providerResult?.reference ?? purchase.id);
  const { data: completed, error: completeError } = await supabase.rpc("complete_partner_api_purchase", {
    p_purchase_id: purchase.id,
    p_provider_reference: providerReference,
    p_provider_response: providerResult,
  });
  if (completeError) throw new Error("Purchase submitted but status confirmation failed");
  return Array.isArray(completed) ? completed[0] : completed;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const user = await apiUser(request);
  if (!user) return response({ error: "Invalid or inactive API key" }, 401);

  try {
    if (request.method === "GET") {
      const { data, error } = await supabase.from("network_bundle_catalog").select("network,category,name,short_name,product_id,amount").eq("active", true).order("network").order("amount");
      if (error) return response({ error: "Unable to load catalog" }, 500);
      return response({ success: true, data });
    }
    if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
    const body = await request.json();
    const idempotencyKey = request.headers.get("idempotency-key") || String(body.idempotency_key || "").trim();
    if (!idempotencyKey || idempotencyKey.length > 128) return response({ error: "A unique idempotency-key is required" }, 400);
    const purchase = await catalogPurchase(body, user.id, idempotencyKey);
    return response({ success: true, purchase }, 200);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Purchase failed" }, 400);
  }
});
// Deploy with: supabase functions deploy partner-api
// GET /partner-api with x-api-key returns the active catalog.
// POST /partner-api with x-api-key and idempotency-key purchases data or airtime.
