/**
 * korba-gateway
 *
 * Single entry point for every Korba operation used by the app.
 * Request body: { operation, ...params }
 *
 * Operations
 *   balance        Korba OVA balance
 *   status         Status of one transaction
 *   transactions   Recent client transactions
 *   add_meter      Register an ECG meter
 *   lookup         Data bundle catalogue for a network
 *   utility_lookup Verify an ECG meter, TV decoder or water account
 *   collect        Pay airtime / ECG / TV / water
 *   data           Buy a data bundle
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callbackUrl, korbaRequest, providerError, userMessage } from "../_shared/korba.ts";

// ---------------------------------------------------------------------------
// Types and constants
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>;
type Debit = { ownerType: string; ownerId: string; amount: number; balance: number };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const UTILITY_TYPES = new Set(["ecg", "electricity", "water", "gotv", "dstv", "startimes"]);
const ALLOWED_PRODUCTS = new Set(["airtime", "data", "bill", ...UTILITY_TYPES]);
const MAX_AMOUNT = 5000;

/** Names the front end may send, mapped to the names this gateway uses. */
const PRODUCT_ALIASES: Record<string, string> = { ghana_water: "water", gwcl: "water", electricity: "ecg" };

const BILL_TYPES: Record<string, string> = {
  ecg: "ECG",
  water: "GWCL",
  gotv: "GOTV",
  dstv: "DSTV",
  startimes: "STARTIMES",
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function newTransactionId() {
  return `DP-${crypto.randomUUID()}`;
}

function compact(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "");
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function normalizeProduct(value: unknown, fallback: string) {
  const product = String(value || fallback).trim().toLowerCase();
  return PRODUCT_ALIASES[product] || product;
}

function normalizeNetworkCode(value: string) {
  const code = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (["VOD", "VODAFONE", "TELECEL"].includes(code)) return "TELECEL";
  if (["AIR", "AIRTEL", "AIRTELTIGO"].includes(code)) return "AIRTELTIGO";
  return code;
}

function airtimeNetworkCode(network: string) {
  if (network === "TELECEL") return "VOD";
  if (network === "AIRTELTIGO") return "AIR";
  return network;
}

function billType(product: string) {
  return BILL_TYPES[product] || product.toUpperCase();
}

// ---------------------------------------------------------------------------
// Data bundle endpoints and catalogue normalisation
// ---------------------------------------------------------------------------

const DATA_ENDPOINTS: Record<string, { purchase: string; lookup: string }> = {
  MTN: { purchase: "/mtn_data_topup/", lookup: "/get_mtndata_product_id/" },
  TELECEL: { purchase: "/vodafone_data_topup/", lookup: "/get_vodafonedata_product_id/" },
  AIRTELTIGO: { purchase: "/airteltigo_data_topup/", lookup: "/get_airteltigodata_product_id/" },
  GLO: { purchase: "/new_glo_data_purchase/", lookup: "/new_glo_data_get_bundle_types/" },
};

function dataEndpoints(network: string) {
  const endpoints = DATA_ENDPOINTS[network];
  if (!endpoints) throw new Error(`Unsupported data network: ${network}`);
  return endpoints;
}

function normalizeBundles(result: unknown) {
  const root = asObject(result);
  const candidate = root.bundles ?? root.results ?? root.data ?? result;
  const bundles: JsonObject[] = [];

  const visit = (value: unknown, group = "") => {
    if (Array.isArray(value)) return value.forEach((item) => visit(item, group));
    if (!value || typeof value !== "object") return;
    const item = value as JsonObject;
    const name = String(item.name ?? item.bundle_name ?? item.product_name ?? item.description ?? "").trim();
    const id = item.product_id ?? item.bundle_id ?? item.id ?? item.code;
    const amount = item.amount ?? item.price ?? item.cost ?? item.value;

    if (id !== undefined && id !== null && (name || amount !== undefined)) {
      bundles.push({
        name: name || `${group || "Data"} bundle`,
        label: name || `${amount} GHS`,
        amount: Number(amount),
        price: Number(amount),
        product_id: item.product_id ?? undefined,
        bundle_id: item.bundle_id ?? undefined,
        id,
      });
    }
    const children = item.bundles ?? item.products ?? item.data ?? item.results;
    if (children) visit(children, name || group);
  };

  visit(candidate);
  return bundles.filter((bundle, index, all) => all.findIndex((other) => String(other.id) === String(bundle.id)) === index);
}

// ---------------------------------------------------------------------------
// Wallet debit / refund
// ---------------------------------------------------------------------------

function walletClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase wallet service is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function debitWallet(body: JsonObject, amount: number): Promise<Debit | null> {
  if (body.wallet_only !== true) return null;
  const ownerType = String(body.wallet_balance_owner_type || "").toLowerCase();
  const ownerId = String(body.wallet_balance_owner_id || "");
  if (!ownerType || !ownerId) throw new Error("Wallet owner is required for wallet purchases");

  const { data, error } = await walletClient().rpc("debit_purchase_wallet", { p_owner_type: ownerType, p_owner_id: ownerId, p_amount: amount });
  if (error) throw new Error(`Wallet debit failed: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.success) throw new Error(result?.message || "Insufficient wallet balance");
  return { ownerType, ownerId, amount, balance: Number(result.balance ?? 0) };
}

async function refundWallet(debit: Debit | null) {
  if (!debit) return;
  const { error } = await walletClient().rpc("credit_purchase_wallet", { p_owner_type: debit.ownerType, p_owner_id: debit.ownerId, p_amount: debit.amount });
  if (error) console.error("[korba-gateway] wallet refund failed", error);
}

// ---------------------------------------------------------------------------
// Operations: reads
// ---------------------------------------------------------------------------

async function addMeter(body: JsonObject) {
  const meterNumber = String(body.meter_number || "").trim();
  const phoneNumber = compact(body.phone_number);
  const alias = String(body.alias || body.meter_name || "").trim();
  const meterCategory = String(body.meter_category || "").trim().toUpperCase();

  if (!meterNumber || !phoneNumber || !alias || !["PREPAID", "POSTPAID"].includes(meterCategory)) {
    return json({ success: false, error: "meter_number, phone_number, alias, and meter_category (PREPAID or POSTPAID) are required" }, 400);
  }
  return json(await korbaRequest("/ecg_direct_add_meter/", {
    alias,
    meter_number: meterNumber,
    phone_number: phoneNumber,
    meter_category: meterCategory,
    account_number: body.account_number ? String(body.account_number) : undefined,
  }));
}

async function bundleLookup(body: JsonObject) {
  const network = normalizeNetworkCode(String(body.network_code || ""));
  const result = await korbaRequest<JsonObject>(dataEndpoints(network).lookup, {});
  return json({ success: result.success !== false, network_code: network, bundles: normalizeBundles(result), raw: result });
}

/**
 * Pulls the fields the UI needs out of Korba's different lookup shapes:
 *   ECG   -> results.data[0] = { customerName, id, meterNumber, ... }
 *   TV    -> results.data.customer = { name, package, amount_due }
 *   Water -> same shape as TV
 */
function summarizeLookup(product: string, result: JsonObject) {
  const results = asObject(result.results);
  const data = results.data ?? result.data;

  if (product === "ecg") {
    const meter = asObject(Array.isArray(data) ? data[0] : data);
    return {
      customer_name: meter.customerName ?? meter.nameOnMeter,
      detail: [meter.meterCategory, meter.address].filter(Boolean).join(" - ") || undefined,
      meter_id: meter.id,
      meter_number: meter.meterNumber,
      meter_category: meter.meterCategory,
      account_number: meter.accountNumber,
    };
  }

  const customer = asObject(asObject(data).customer);
  const detail = [customer.package, customer.amount_due ? `Amount due GHS ${customer.amount_due}` : ""].filter(Boolean).join(" - ");
  return {
    customer_name: customer.name,
    detail: detail || undefined,
    session_id: asObject(data).transaction_id,
  };
}

async function utilityLookup(body: JsonObject) {
  const product = normalizeProduct(body.product_type, "");
  const meterNumber = compact(body.meter_number);
  const phoneNumber = compact(body.phone_number);
  const customerNumber = compact(body.customer_number || meterNumber || body.account_number || body.decoder_number || phoneNumber);

  if (!UTILITY_TYPES.has(product) || !customerNumber) {
    return json({ success: false, error: "A supported utility type and customer number are required" }, 400);
  }

  const isEcg = product === "ecg";
  const accountNumber = compact(body.account_number) || customerNumber;
  const payload = isEcg
    ? { phone_number: phoneNumber || undefined, account_number: compact(body.account_number || meterNumber) || undefined }
    : {
        customer_number: customerNumber,
        account_number: accountNumber,
        decoder_number: compact(body.decoder_number) || customerNumber,
        bill_type: billType(product),
        transaction_id: newTransactionId(),
      };

  const result = await korbaRequest<JsonObject>(isEcg ? "/ecg_direct_meter_detail/" : "/utilities_validate_user/", payload);
  return json({ ...result, ...summarizeLookup(product, result), success: result.success !== false, customer_number: customerNumber });
}

// ---------------------------------------------------------------------------
// Operations: payments (collect / data)
// ---------------------------------------------------------------------------

type PaymentContext = { body: JsonObject; operation: string; product: string; network: string; amount: number; customerNumber: string; transactionId: string };

function buildPayment(ctx: PaymentContext): { endpoint: string; payload: JsonObject } | { error: string } {
  const { body, operation, product, network, amount, customerNumber, transactionId } = ctx;
  const phone = compact(body.phone_number) || undefined;

  const payload: JsonObject = {
    amount: amount.toFixed(2),
    customer_number: customerNumber || undefined,
    transaction_id: transactionId,
    callback_url: callbackUrl(),
    description: String(body.description || `DataPlug ${product} purchase`),
    payer_name: body.payer_name ? String(body.payer_name) : undefined,
  };

  if (operation === "data") {
    const usesProductId = ["MTN", "AIRTELTIGO"].includes(network);
    const id = String(body.product_id || body.bundle_id || body.package_code || "");
    if (!id) return { error: "A bundle identifier is required" };
    payload[usesProductId ? "product_id" : "bundle_id"] = id;
    return { endpoint: dataEndpoints(network).purchase, payload };
  }

  if (product === "airtime") {
    payload.network_code = airtimeNetworkCode(network);
    return { endpoint: "/topup/", payload };
  }

  if (product === "ecg") {
    const meterNumber = String(body.meter_number);
    const customer = customerNumber || meterNumber;
    Object.assign(payload, {
      customer_number: customer,
      recipient_number: customer,
      customer_phone_number: phone,
      phone_number: phone,
      product_type: product,
      bill_type: "ECG",
      meter_id: String(body.meter_id),
      meter_number: meterNumber,
      account_number: String(body.account_number || meterNumber),
      meter_category: String(body.meter_category || "PREPAID").toUpperCase(),
      sender_name: String(body.sender_name || "DataPlug Customer"),
      address: String(body.address || "Ghana"),
    });
    return { endpoint: "/ecg_direct_pay_bill/", payload };
  }

  // TV subscriptions and water bills
  Object.assign(payload, {
    bill_type: billType(product),
    sender_name: String(body.sender_name || "DataPlug Customer"),
    address: String(body.address || "Ghana"),
    customer_phone_number: phone,
  });
  return { endpoint: "/utilities_pay_bill/", payload };
}

async function pay(body: JsonObject, operation: string, state: { debit: Debit | null }) {
  const product = normalizeProduct(body.product_type, operation === "data" ? "data" : "airtime");
  const network = normalizeNetworkCode(String(body.network_code || ""));
  const amount = Number(body.amount);
  const customerNumber = compact(body.customer_number || body.phone_number);
  const transactionId = String(body.transaction_id || newTransactionId());
  const isUtility = UTILITY_TYPES.has(product);

  if (!ALLOWED_PRODUCTS.has(product)) return json({ success: false, error: "Unsupported Korba service type" }, 400);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return json({ success: false, error: "Enter an amount between GHC 0.01 and GHC 5,000" }, 400);
  if (!isUtility && !/^0[235]\d{8}$/.test(customerNumber)) return json({ success: false, error: "Enter a valid Ghana phone number" }, 400);
  if (operation === "data" && !network) return json({ success: false, error: "Network code is required" }, 400);
  if (product === "ecg" && (!body.meter_id || !body.meter_number)) return json({ success: false, error: "Verify or register the ECG meter before paying" }, 400);

  const payment = buildPayment({ body, operation, product, network, amount, customerNumber, transactionId });
  if ("error" in payment) return json({ success: false, error: payment.error }, 400);

  state.debit = await debitWallet(body, amount);
  const result = await korbaRequest<JsonObject>(payment.endpoint, payment.payload);

  if (result.success === false) {
    await refundWallet(state.debit);
    return json({ ...result, error: providerError(result) || userMessage(Number(result.error_code)), user_message: userMessage(Number(result.error_code)), wallet_refunded: Boolean(state.debit) });
  }
  return json({ ...result, success: true, transaction_id: transactionId, wallet: state.debit ? { balance: state.debit.balance } : undefined });
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const state: { debit: Debit | null } = { debit: null };

  try {
    const body = (await request.json()) as JsonObject;
    const operation = String(body.operation || "");

    switch (operation) {
      case "balance":
        return json(await korbaRequest("/get_ova_balance/", {}));
      case "status":
        if (!body.transaction_id) return json({ error: "transaction_id is required" }, 400);
        return json(await korbaRequest("/transaction_status/", { transaction_id: String(body.transaction_id) }));
      case "transactions":
        return json(await korbaRequest("/client_transactions/", {}));
      case "add_meter":
        return await addMeter(body);
      case "lookup":
        return await bundleLookup(body);
      case "utility_lookup":
        return await utilityLookup(body);
      case "collect":
      case "data":
        return await pay(body, operation, state);
      default:
        return json({ success: false, error: "Unsupported Korba operation" }, 400);
    }
  } catch (error) {
    await refundWallet(state.debit);
    const details = error instanceof Error && "details" in error ? (error as Error & { details?: JsonObject }).details : undefined;
    console.error("[korba-gateway] request failed", error instanceof Error ? error.message : error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Korba request failed",
      provider_message: providerError(details?.parsed_body),
      request_id: details?.request_id,
      wallet_refunded: Boolean(state.debit),
    }, 502);
  }
});
