/**
 * partner-services
 *
 * API-wallet purchases of data, airtime, ECG, GOtv, DSTV, StarTimes and Ghana Water.
 * The purchase amount is debited from the caller's API wallet; the commission for the
 * service is credited back to the same wallet once the provider accepts the request.
 *
 * Auth: `x-api-key: <key>` or `Authorization: Bearer <key>`
 *
 *   GET  /partner-services                       catalogue, commission rates and wallet balance
 *   POST /partner-services { action: "lookup" }  verify an ECG meter, TV decoder or water account
 *   POST /partner-services { action: "purchase" } buy a service (requires an idempotency-key header)
 *
 * Commission rates (kept in the database by public.purchase_commission_rate):
 *   data, airtime 1.3% | gotv, dstv 0.23% | startimes 0.15% | ecg 0.5% | water 0.24%
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, apikey, content-type, idempotency-key, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const COMMISSION_RATES: Record<string, number> = {
  data: 0.013,
  airtime: 0.013,
  gotv: 0.0023,
  dstv: 0.0023,
  startimes: 0.0015,
  ecg: 0.005,
  water: 0.0024,
};

const SERVICE_ALIASES: Record<string, string> = {
  electricity: "ecg",
  ghana_water: "water",
  ghanawater: "water",
  gwcl: "water",
  startime: "startimes",
};

const UTILITY_SERVICES = new Set(["ecg", "gotv", "dstv", "startimes", "water"]);
const NETWORKS = new Set(["mtn", "telecel", "airteltigo"]);
const PHONE_PATTERN = /^0[235]\d{8}$/;
const MAX_AMOUNT = 5000;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function compact(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "");
}

function normalizeService(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const service = SERVICE_ALIASES[raw] || raw;
  if (!(service in COMMISSION_RATES)) throw new RequestError("service_type must be one of data, airtime, ecg, gotv, dstv, startimes or water");
  return service;
}

function normalizeNetwork(value: unknown) {
  const network = String(value ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const mapped = network === "vodafone" ? "telecel" : network === "air" || network === "airtel" ? "airteltigo" : network;
  if (!NETWORKS.has(mapped)) throw new RequestError("network must be mtn, telecel or airteltigo");
  return mapped;
}

function localPhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const local = digits.startsWith("233") ? `0${digits.slice(3)}` : digits;
  return PHONE_PATTERN.test(local) ? local : "";
}

async function authenticate(request: Request) {
  const key = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!key) return null;
  const { data, error } = await supabase.from("api_users").select("id, active, api_wallet").eq("api_key", key.trim()).maybeSingle();
  if (error || !data || data.active === false) return null;
  return data as { id: string; active: boolean | null; api_wallet: number | null };
}

async function gateway(body: JsonObject) {
  const { data, error } = await supabase.functions.invoke("korba-gateway", { body });
  if (error) {
    let detail = error.message;
    try {
      const context = (error as { context?: Response }).context;
      const parsed = context ? await context.json() : null;
      detail = String(parsed?.error || parsed?.provider_message || detail);
    } catch { /* keep the generic message */ }
    throw new Error(detail);
  }
  if (data?.success === false) throw new Error(String(data.error || data.user_message || "Provider request failed"));
  return (data || {}) as JsonObject;
}

async function catalogue(user: { api_wallet: number | null }) {
  const { data, error } = await supabase
    .from("network_bundle_catalog")
    .select("network, category, name, short_name, product_id, amount")
    .eq("active", true)
    .order("network")
    .order("amount");
  if (error) throw new RequestError("Unable to load catalogue", 500);

  const services = Object.entries(COMMISSION_RATES).map(([service, rate]) => ({
    service_type: service,
    commission_rate: rate,
    commission_percent: Number((rate * 100).toFixed(2)),
    requires: service === "data"
      ? ["network", "product_id", "recipient"]
      : service === "airtime"
        ? ["network", "amount", "recipient"]
        : service === "ecg"
          ? ["recipient (meter number)", "phone_number (registered mobile)", "amount"]
          : ["recipient (decoder, smart card or account number)", "amount"],
  }));
  return { wallet_balance: Number(user.api_wallet ?? 0), services, data_bundles: data };
}

async function lookup(body: JsonObject) {
  const service = normalizeService(body.service_type ?? body.product_type);
  if (!UTILITY_SERVICES.has(service)) throw new RequestError("Lookup is only available for ecg, gotv, dstv, startimes and water");
  const recipient = compact(body.recipient ?? body.customer_number ?? body.meter_number ?? body.account_number);
  if (!recipient) throw new RequestError("recipient is required");

  const result = await gateway({
    operation: "utility_lookup",
    product_type: service,
    customer_number: recipient,
    meter_number: service === "ecg" ? recipient : undefined,
    phone_number: body.phone_number ? compact(body.phone_number) : undefined,
  });
  return {
    service_type: service,
    recipient,
    customer_name: result.customer_name ?? null,
    detail: result.detail ?? null,
    meter_category: result.meter_category ?? null,
  };
}

async function purchase(body: JsonObject, userId: string, idempotencyKey: string) {
  const service = normalizeService(body.service_type ?? body.product_type);
  const isUtility = UTILITY_SERVICES.has(service);

  let network = "";
  let recipient = "";
  let amount = Number(body.amount);
  let productId: string | null = null;
  let productName: string | null = null;
  let registeredPhone = "";

  if (isUtility) {
    recipient = compact(body.recipient ?? body.customer_number ?? body.meter_number ?? body.account_number ?? body.decoder_number);
    if (recipient.length < 4 || recipient.length > 40) throw new RequestError("A valid recipient (meter, decoder or account number) is required");
    if (service === "ecg") {
      registeredPhone = localPhone(body.phone_number);
      if (!registeredPhone) throw new RequestError("phone_number must be the registered Ghana mobile number for this meter");
    }
  } else {
    network = normalizeNetwork(body.network);
    recipient = localPhone(body.recipient ?? body.phone_number ?? body.customer_number);
    if (!recipient) throw new RequestError("A valid Ghana recipient phone number is required");
  }

  if (service === "data") {
    productId = body.product_id ? String(body.product_id) : null;
    if (!productId) throw new RequestError("product_id is required for data purchases");
    const { data: bundle, error } = await supabase
      .from("network_bundle_catalog")
      .select("product_id, name, amount")
      .eq("network", network)
      .eq("product_id", productId)
      .eq("active", true)
      .maybeSingle();
    if (error || !bundle) throw new RequestError("Unknown or inactive bundle product_id");
    amount = Number(bundle.amount);
    productName = bundle.name;
  } else {
    amount = Math.round(amount * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) throw new RequestError(`amount must be greater than 0 and no more than ${MAX_AMOUNT}`);
    productName = service;
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new RequestError("Invalid purchase amount");

  // ECG payments need Korba's meter id, so resolve it before taking any money.
  let meterId = "";
  if (service === "ecg") {
    const meter = await gateway({ operation: "utility_lookup", product_type: "ecg", meter_number: recipient, customer_number: recipient, phone_number: registeredPhone });
    meterId = String(meter.meter_id ?? "");
    if (!meterId) throw new RequestError("ECG meter could not be verified");
  }

  const { data: reserved, error: reserveError } = await supabase.rpc("reserve_partner_api_purchase", {
    p_api_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_service_type: service,
    p_network: network || null,
    p_product_id: productId,
    p_product_name: productName,
    p_recipient: recipient,
    p_amount: amount,
  });
  if (reserveError) {
    if (reserveError.message.includes("Insufficient API wallet")) throw new RequestError("Insufficient API wallet balance", 402);
    throw new RequestError("Unable to reserve API wallet balance", 500);
  }
  const reservedPurchase = Array.isArray(reserved) ? reserved[0] : reserved;
  if (!reservedPurchase) throw new RequestError("Unable to create purchase", 500);
  if (reservedPurchase.status !== "processing") return reservedPurchase;

  const operation = service === "data" ? "data" : "collect";
  const payload: JsonObject = {
    operation,
    product_type: service,
    amount,
    customer_number: recipient,
    transaction_id: reservedPurchase.id,
    description: `DataPlug API ${service} purchase`,
  };
  if (!isUtility) payload.network_code = network === "telecel" ? "TELECEL" : network === "airteltigo" ? "AIRTELTIGO" : "MTN";
  if (service === "data") payload.package_code = productId;
  if (service === "ecg") Object.assign(payload, { meter_id: meterId, meter_number: recipient, phone_number: registeredPhone });
  else if (isUtility && body.phone_number) payload.phone_number = compact(body.phone_number);

  let providerResult: JsonObject;
  try {
    providerResult = await gateway(payload);
  } catch (error) {
    await supabase.rpc("refund_partner_api_purchase", {
      p_purchase_id: reservedPurchase.id,
      p_error: error instanceof Error ? error.message : "Provider purchase failed",
    });
    throw new RequestError(`Provider purchase failed; API wallet was refunded. ${error instanceof Error ? error.message : ""}`.trim(), 502);
  }

  const providerReference = String(providerResult.transaction_id ?? providerResult.reference ?? reservedPurchase.id);
  const { data: completed, error: completeError } = await supabase.rpc("complete_partner_api_purchase_with_commission", {
    p_purchase_id: reservedPurchase.id,
    p_provider_reference: providerReference,
    p_provider_response: providerResult,
  });
  if (completeError) throw new RequestError("Purchase submitted but status confirmation failed; contact support with your idempotency key", 500);
  return Array.isArray(completed) ? completed[0] : completed;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const user = await authenticate(request);
    if (!user) return respond({ error: "Invalid or inactive API key" }, 401);

    if (request.method === "GET") return respond({ success: true, ...(await catalogue(user)) });
    if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);

    const body = (await request.json()) as JsonObject;
    const action = String(body.action ?? "purchase").toLowerCase();

    if (action === "lookup") return respond({ success: true, ...(await lookup(body)) });
    if (action !== "purchase") return respond({ error: "action must be lookup or purchase" }, 400);

    const idempotencyKey = request.headers.get("idempotency-key") || String(body.idempotency_key ?? "").trim();
    if (!idempotencyKey || idempotencyKey.length > 128) return respond({ error: "A unique idempotency-key (max 128 characters) is required" }, 400);

    const result = await purchase(body, user.id, idempotencyKey);
    const { data: wallet } = await supabase.from("api_users").select("api_wallet").eq("id", user.id).maybeSingle();
    return respond({
      success: true,
      purchase: {
        id: result.id,
        service_type: result.service_type,
        network: result.network,
        recipient: result.recipient,
        amount: Number(result.amount),
        status: result.status,
        provider_reference: result.provider_reference,
        commission_rate: Number(result.commission_rate ?? 0),
        commission_amount: Number(result.commission_amount ?? 0),
        created_at: result.created_at,
      },
      wallet_balance: Number(wallet?.api_wallet ?? 0),
    });
  } catch (error) {
    if (error instanceof RequestError) return respond({ success: false, error: error.message }, error.status);
    console.error("[partner-services] unexpected error", error instanceof Error ? error.message : error);
    return respond({ success: false, error: "Purchase failed" }, 500);
  }
});
