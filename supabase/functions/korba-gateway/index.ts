import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callbackUrl, korbaRequest, providerError, userMessage } from "../_shared/korba.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "86400", "Content-Type": "application/json" };
const utilityTypes = new Set(["ecg", "electricity", "water", "gotv", "dstv", "startimes"]);
const allowedProducts = new Set(["airtime", "data", ...utilityTypes, "bill"]);

type JsonObject = Record<string, unknown>;
type Debit = { ownerType: string; ownerId: string; amount: number; balance: number };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: corsHeaders }); }
function transactionId() { return `DP-${crypto.randomUUID()}`; }
function normalizeNetworkCode(value: string) { const code = value.trim().toUpperCase().replace(/[^A-Z]/g, ""); if (["VOD", "VODAFONE", "TELECEL"].includes(code)) return "TELECEL"; if (["AIR", "AIRTEL", "AIRTELTIGO"].includes(code)) return "AIRTELTIGO"; return code; }
function dataEndpoint(network: string) { if (network === "MTN") return "/mtn_data_topup/"; if (network === "TELECEL") return "/vodafone_data_topup/"; if (network === "AIRTELTIGO") return "/airteltigo_data_topup/"; if (network === "GLO") return "/new_glo_data_purchase/"; throw new Error(`Unsupported data network: ${network}`); }
function lookupEndpoint(network: string) { if (network === "MTN") return "/get_mtndata_product_id/"; if (network === "TELECEL") return "/get_vodafonedata_product_id/"; if (network === "AIRTELTIGO") return "/get_airteltigodata_product_id/"; if (network === "GLO") return "/new_glo_data_get_bundle_types/"; throw new Error(`Unsupported data network: ${network}`); }
function airtimeNetworkCode(network: string) { const code = network.trim().toUpperCase(); if (code === "TELECEL" || code === "VODAFONE") return "VOD"; if (code === "AIRTELTIGO") return "AIR"; return code; }
function utilityBillType(type: string) { return ({ ecg: "ECG", electricity: "ECG", water: "GWCL", gotv: "GOTV", dstv: "DSTV", startimes: "STARTIMES" } as Record<string, string>)[type] || type.toUpperCase(); }
function nestedValue(value: unknown, key: string): unknown { if (!value || typeof value !== "object") return undefined; return (value as JsonObject)[key]; }
function findNested(value: unknown, keys: string[], depth = 0): unknown {
  if (!value || typeof value !== "object" || depth > 4) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findNested(item, keys, depth + 1); if (found !== undefined && found !== null && found !== "") return found; }
    return undefined;
  }
  const object = value as JsonObject;
  for (const key of keys) if (object[key] !== undefined && object[key] !== null && object[key] !== "") return object[key];
  for (const child of Object.values(object)) { const found = findNested(child, keys, depth + 1); if (found !== undefined && found !== null && found !== "") return found; }
  return undefined;
}
function normalizeBundles(result: unknown) {
  const root = result as JsonObject;
  const candidate = root.bundles ?? root.results ?? root.data ?? result;
  const output: JsonObject[] = [];
  const visit = (value: unknown, group = "") => {
    if (Array.isArray(value)) return value.forEach((item) => visit(item, group));
    if (!value || typeof value !== "object") return;
    const item = value as JsonObject;
    const name = String(item.name ?? item.bundle_name ?? item.product_name ?? item.description ?? "").trim();
    const id = item.product_id ?? item.bundle_id ?? item.id ?? item.code;
    const amount = item.amount ?? item.price ?? item.cost ?? item.value;
    const hasBundle = id !== undefined && id !== null && (name || amount !== undefined);
    if (hasBundle) output.push({ name: name || `${group || "Data"} bundle`, amount: Number(amount), price: Number(amount), product_id: item.product_id ?? undefined, bundle_id: item.bundle_id ?? undefined, id, label: name || `${amount} GHS` });
    const children = item.bundles ?? item.products ?? item.data ?? item.results;
    if (children) visit(children, name || group);
  };
  visit(candidate);
  return output.filter((item, index, all) => all.findIndex((other) => String(other.id) === String(item.id)) === index);
}
function walletClient() { const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!url || !key) throw new Error("Supabase wallet service is not configured"); return createClient(url, key, { auth: { persistSession: false } }); }
async function debitWallet(body: JsonObject, amount: number): Promise<Debit | null> { if (body.wallet_only !== true) return null; const ownerType = String(body.wallet_balance_owner_type || "").toLowerCase(); const ownerId = String(body.wallet_balance_owner_id || ""); if (!ownerType || !ownerId) throw new Error("Wallet owner is required for wallet purchases"); const { data, error } = await walletClient().rpc("debit_purchase_wallet", { p_owner_type: ownerType, p_owner_id: ownerId, p_amount: amount }); if (error) throw new Error(`Wallet debit failed: ${error.message}`); const result = Array.isArray(data) ? data[0] : data; if (!result?.success) throw new Error(result?.message || "Insufficient wallet balance"); return { ownerType, ownerId, amount, balance: Number(result.balance ?? 0) }; }
async function refundWallet(debit: Debit | null) { if (!debit) return; const { error } = await walletClient().rpc("credit_purchase_wallet", { p_owner_type: debit.ownerType, p_owner_id: debit.ownerId, p_amount: debit.amount }); if (error) console.error("[korba-gateway] wallet refund failed", error); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: JsonObject = {}; let debit: Debit | null = null;
  try {
    body = await request.json();
    const operation = String(body.operation || "");
    if (operation === "balance") return json(await korbaRequest("/get_ova_balance/", {}));
    if (operation === "status") { if (!body.transaction_id) return json({ error: "transaction_id is required" }, 400); return json(await korbaRequest("/transaction_status/", { transaction_id: String(body.transaction_id) })); }
    if (operation === "transactions") return json(await korbaRequest("/client_transactions/", {}));
    if (operation === "add_meter") {
      const meterNumber = String(body.meter_number || "").trim(), phoneNumber = String(body.phone_number || "").replace(/\s+/g, ""), alias = String(body.alias || body.meter_name || "").trim(), meterCategory = String(body.meter_category || "").trim().toUpperCase();
      if (!meterNumber || !phoneNumber || !alias || !["PREPAID", "POSTPAID"].includes(meterCategory)) return json({ success: false, error: "meter_number, phone_number, alias, and meter_category (PREPAID or POSTPAID) are required" }, 400);
      const meterPayload = { alias, meter_number: meterNumber, phone_number: phoneNumber, meter_category: meterCategory, account_number: body.account_number ? String(body.account_number) : undefined };
      console.log("[korba-gateway] meter registration request", JSON.stringify({ operation, path: "/ecg_direct_add_meter/", payload: meterPayload }));
      const meterResponse = await korbaRequest<JsonObject>("/ecg_direct_add_meter/", meterPayload);
      console.log("[korba-gateway] meter registration exact response", JSON.stringify(meterResponse));
      return json({ ...meterResponse, meter_id: findNested(meterResponse, ["meter_id", "meterId", "id"]), success: meterResponse.success !== false });
    }
    if (operation === "lookup") {
      const network = normalizeNetworkCode(String(body.network_code || ""));
      const result = await korbaRequest<JsonObject>(lookupEndpoint(network), {});
      const bundles = normalizeBundles(result);
      return json({ success: result.success !== false, network_code: network, bundles, raw: result });
    }
    if (operation === "utility_lookup") {
      const productType = String(body.product_type || "").trim().toLowerCase(); const meterNumber = String(body.meter_number || "").replace(/\s+/g, ""); const rawPhoneNumber = String(body.phone_number || "").replace(/\s+/g, ""); const phoneNumber = rawPhoneNumber.startsWith("0") ? `233${rawPhoneNumber.slice(1)}` : rawPhoneNumber.startsWith("+233") ? rawPhoneNumber.slice(1) : rawPhoneNumber; const customerNumber = String(body.customer_number || meterNumber || phoneNumber || body.account_number || body.decoder_number || "").replace(/\s+/g, "");
      if (!utilityTypes.has(productType) || !customerNumber) return json({ success: false, error: "A supported utility type and customer number are required" }, 400);
      const transaction_id = transactionId();
  const requestPayload = productType === "ecg"
    ? { phone_number: phoneNumber || undefined, account_number: String(body.account_number || "").replace(/\s+/g, "") || undefined }
    : { customer_number: customerNumber, meter_number: meterNumber || undefined, phone_number: phoneNumber || undefined, bill_type: utilityBillType(productType), transaction_id };
  const lookupPath = productType === "ecg" ? "/ecg_direct_meter_detail/" : "/utilities_validate_user/";
  console.log("[korba-gateway] utility lookup request", JSON.stringify({ operation, product_type: productType, path: lookupPath, payload: requestPayload }));
  const result = await korbaRequest<JsonObject>(lookupPath, requestPayload);
      const normalized = {
        ...result,
        success: result.success !== false,
        customer_number: customerNumber,
        customer_name: findNested(result, ["customer_name", "customerName", "account_name", "accountName", "registered_name", "name"]),
  meter_id: findNested(result, ["meter_id", "meterId", "id", "customer_id", "customerId", "account_id", "accountId"]),
  meter_number: findNested(result, ["meter_number", "meterNumber"]),
  meter_category: findNested(result, ["meter_category", "meterCategory"]),
  account_number: findNested(result, ["account_number", "accountNumber"]),
  session_id: findNested(result, ["session_id", "sessionId", "token", "reference"]),
      };
      console.log("[korba-gateway] utility lookup exact response", JSON.stringify({ product_type: productType, customer_number: customerNumber, response: result, normalized }));
      return json(normalized);
    }
    if (operation !== "collect" && operation !== "data") return json({ success: false, error: "Unsupported Korba operation" }, 400);
    const productType = String(body.product_type || (operation === "data" ? "data" : "airtime")).trim().toLowerCase(); const network = normalizeNetworkCode(String(body.network_code || "")); const amount = Number(body.amount); const customerNumber = String(body.customer_number || body.phone_number || "").replace(/\s+/g, ""); const transaction_id = String(body.transaction_id || transactionId());
    if (!allowedProducts.has(productType)) return json({ success: false, error: "Unsupported Korba service type" }, 400);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) return json({ success: false, error: "Enter an amount between GHC 0.01 and GHC 5,000" }, 400);
    if (!utilityTypes.has(productType) && !/^0[235]\d{8}$/.test(customerNumber)) return json({ success: false, error: "Enter a valid Ghana phone number" }, 400);
    if (operation === "data" && !network) return json({ success: false, error: "Network code is required" }, 400);
    if (productType === "ecg" && (!body.meter_id || !body.meter_number)) return json({ success: false, error: "Verify or register the ECG meter before paying" }, 400);
    debit = await debitWallet(body, amount);
    const payload: JsonObject = { amount: amount.toFixed(2), customer_number: customerNumber || undefined, transaction_id, callback_url: callbackUrl(), description: String(body.description || `DataPlug ${productType} purchase`), payer_name: body.payer_name ? String(body.payer_name) : undefined };
    let endpoint: string;
    if (operation === "data") { endpoint = dataEndpoint(network); if (["MTN", "AIRTELTIGO"].includes(network)) payload.product_id = String(body.product_id || body.package_code || ""); else payload.bundle_id = String(body.bundle_id || body.package_code || ""); if (!payload.product_id && !payload.bundle_id) return json({ success: false, error: "A bundle identifier is required" }, 400); }
    else if (productType === "airtime") { endpoint = "/topup/"; payload.network_code = airtimeNetworkCode(network); }
    else if (productType === "ecg" || productType === "electricity") { endpoint = "/ecg_direct_pay_bill/"; payload.meter_id = String(body.meter_id); payload.meter_number = String(body.meter_number); payload.phone_number = body.phone_number ? String(body.phone_number).replace(/\s+/g, "") : undefined; payload.account_number = body.account_number ? String(body.account_number).replace(/\s+/g, "") : undefined; payload.meter_category = body.meter_category ? String(body.meter_category).toUpperCase() : undefined; console.log("[korba-gateway] ECG payment request", JSON.stringify({ endpoint, transaction_id, payload: { ...payload, callback_url: undefined } })); }
    else { endpoint = "/utilities_pay_bill/"; payload.bill_type = utilityBillType(productType); payload.sender_name = String(body.sender_name || "DataPlug Customer"); payload.address = String(body.address || "Ghana"); payload.customer_phone_number = body.phone_number ? String(body.phone_number) : undefined; }
    const result = await korbaRequest<JsonObject>(endpoint, payload);
    if (result.success === false) { await refundWallet(debit); return json({ ...result, user_message: userMessage(Number(result.error_code)), wallet_refunded: Boolean(debit) }); }
    return json({ ...result, success: result.success !== false, transaction_id, wallet: debit ? { balance: debit.balance } : undefined });
  } catch (error) { await refundWallet(debit); const details = error instanceof Error && "details" in error ? (error as Error & { details?: unknown }).details : undefined; return json({ success: false, error: error instanceof Error ? error.message : "Korba request failed", provider_message: providerError((details as JsonObject | undefined)?.parsed_body), wallet_refunded: Boolean(debit) }, 502); }
});
