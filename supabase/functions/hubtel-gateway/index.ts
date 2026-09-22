const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const serviceIds: Record<string, string> = {
  // Hubtel Commission Services IDs from the supplied service documentation.
  mtn_airtime: "fdd76c884e614b1c8f669a3207b09a98",
  telecel_airtime: "f4be83ad74c742e185224fdae1304800",
  airteltigo_airtime: "dae2142eb5a14c298eace60240c09e4b",
  ecg: "e6d6bac062b5499cb1ece1ac3d742a84",
  telecel_broadband: "b9a1aa246ba748f9ba01ca4cdbb3d1d3",
  mtn_data: "b230733cd56b4a0fad820e39f66bc27c",
  telecel_data: "fa27127ba039455da04a2ac8a1613e00",
  airteltigo_data: "06abd92da459428496967612463575ca",
  dstv: "297a96656b5846ad8b00d5d41b256ea",
  gotv: "e6ceac7f3880435cb30b048e9617eb41",
  telecel_postpaid: "a3ab78c84c6b4976b78a6f393e247a72",
  ghana_water: "6c1e8a82d2e84feeb8bfd6be2790d71d",
  startimes: "6598652d34ea4112949c93c079c501ce",
};

const fallbackBundles: Record<string, Array<{ Display: string; Value: string; Amount: number }>> = {
  mtn_data: [
    { Display: "80MB Bundle (GHS 1)", Value: "DATA1", Amount: 1 },
    { Display: "200MB Bundle (GHS 2)", Value: "DATA2", Amount: 2 },
    { Display: "650MB Bundle (GHS 5)", Value: "DATA5", Amount: 5 },
    { Display: "2GB Bundle (GHS 10)", Value: "DATA10", Amount: 10 },
    { Display: "5GB Bundle (GHS 20)", Value: "DATA20", Amount: 20 },
    { Display: "11GB Bundle (GHS 50)", Value: "DATA50", Amount: 50 },
  ],
  telecel_data: [
    { Display: "Starter Daily 25MB", Value: "25 MB", Amount: 0.5 },
    { Display: "Browser Daily 61MB", Value: "61 MB", Amount: 1 },
    { Display: "Streamer Weekly 460MB", Value: "460 MB", Amount: 5 },
    { Display: "Starter Monthly 560MB", Value: "560 MB", Amount: 10 },
    { Display: "Chat Monthly 2GB", Value: "2 GB", Amount: 20 },
    { Display: "Dual Recharge 5.7GB", Value: "5.7 GB", Amount: 50 },
  ],
  airteltigo_data: [
    { Display: "80MB Bundle (GHS 1)", Value: "DATA1", Amount: 1 },
    { Display: "200MB Bundle (GHS 2)", Value: "DATA2", Amount: 2 },
    { Display: "650MB Bundle (GHS 5)", Value: "DATA5", Amount: 5 },
    { Display: "2GB Bundle (GHS 10)", Value: "DATA10", Amount: 10 },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const env = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value; };
const phone = (value: unknown) => { const digits = String(value ?? "").replace(/\D/g, ""); if (digits.length === 10 && digits.startsWith("0")) return `233${digits.slice(1)}`; if (digits.length === 12 && digits.startsWith("233")) return digits; throw new Error("Enter a valid Ghana phone number"); };
const amount = (value: unknown) => { const result = Number(value); if (!Number.isFinite(result) || result <= 0) throw new Error("Amount must be greater than zero"); return Math.round(result * 100) / 100; };
const clientReference = (value: unknown, prefix = "HUBTEL") => { const result = String(value || `${prefix}-${crypto.randomUUID()}`).replace(/[^a-zA-Z0-9_-]/g, ""); if (result.length < 3 || result.length > 36) throw new Error("clientReference must be 3-36 characters"); return result; };

const requestHubtel = async (path: string, init: RequestInit = {}) => {
  const account = env("HUBTEL_DISBURSEMENT_ACCOUNT_NUMBER");
  const baseUrl = Deno.env.get("HUBTEL_BASE_URL") || "https://cs.hubtel.com";
  const apiId = Deno.env.get("HUBTEL_API_ID") || Deno.env.get("HUBTEL_CLIENT_ID");
  const apiKey = Deno.env.get("HUBTEL_API_KEY") || Deno.env.get("HUBTEL_CLIENT_SECRET");
  if (!apiId) throw new Error("Missing HUBTEL_API_ID");
  if (!apiKey) throw new Error("Missing HUBTEL_API_KEY");
  const auth = btoa(`${apiId}:${apiKey}`);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path.replace("{account}", account)}`, { ...init, headers: { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json", ...(init.headers || {}) } });
  const text = await response.text();
  let data: unknown; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`Hubtel request failed (${response.status})`);
  return data;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST" && request.method !== "GET") return json({ error: "Only GET and POST are supported" }, 405);
  try {
    const body = request.method === "GET" ? Object.fromEntries(new URL(request.url).searchParams) : await request.json();
    const operation = String(body.operation || "").toLowerCase();
    const service = String(body.service || body.serviceCode || "").toLowerCase();
    const serviceId = serviceIds[service] || (service.match(/^[a-f0-9]{32}$/) ? service : "");

    if (operation === "data_catalog") {
      const destination = phone(body.destination || body.phoneNumber || body.customerMsisdn);
      if (!serviceId || !service.endsWith("_data")) throw new Error("Use mtn_data, telecel_data, or airteltigo_data");
      try {
        const live = await requestHubtel(`/commissionservices/{account}/${serviceId}?destination=${encodeURIComponent(destination)}`);
        return json({ success: true, operation, service, data: live, source: "hubtel" });
      } catch (error) {
        console.warn("[hubtel-gateway] catalog fallback", error);
        return json({ success: true, operation, service, data: { ResponseCode: "0000", Message: "Fallback catalog", Data: fallbackBundles[service] || [] }, source: "fallback" });
      }
    }

    if (operation === "bill_catalog") {
      if (!serviceId || !["ecg", "ghana_water", "telecel_broadband", "telecel_postpaid"].includes(service)) throw new Error("This service does not support account lookup");
      const destination = String(body.accountNumber || body.destination || "").trim();
      if (!destination) throw new Error("accountNumber is required");
      return json({ success: true, operation, service, data: await requestHubtel(`/commissionservices/{account}/${serviceId}?destination=${encodeURIComponent(destination)}`) });
    }

    if (operation === "callback") {
      const callback = body;
      console.log("[hubtel-gateway] callback received", JSON.stringify(callback));
      return json({ success: true, operation, received: true });
    }

    if (operation === "airtime" || operation === "data" || operation === "bill") {
      if (!serviceId) throw new Error("A valid Hubtel service is required");
      if (operation === "data" && !service.endsWith("_data")) throw new Error("Data purchases require an MTN, Telecel, or AirtelTigo data service");
      if (operation === "airtime" && !service.endsWith("_airtime")) throw new Error("Airtime purchases require an airtime service");
      const destination = operation === "bill"
        ? String(body.accountNumber || "").trim()
        : phone(body.destination || body.phoneNumber || body.customerMsisdn);
      if (!destination) throw new Error("accountNumber is required");
      const reference = clientReference(body.clientReference, operation.toUpperCase());
      const callbackUrl = String(body.callbackUrl || Deno.env.get("HUBTEL_CALLBACK_URL") || "");
      if (!callbackUrl) throw new Error("callbackUrl or HUBTEL_CALLBACK_URL is required");
      const payload: Record<string, unknown> = { Destination: destination, Amount: amount(body.amount), CallbackUrl: callbackUrl, ClientReference: reference };
      if (operation === "data") { const bundle = String(body.bundle || body.packageCode || "").trim(); if (!bundle) throw new Error("bundle is required; query data_catalog first"); payload.Extradata = { bundle }; }
      if (operation === "bill") { const accountNumber = String(body.accountNumber || "").trim(); if (!accountNumber) throw new Error("accountNumber is required"); payload.Destination = accountNumber; if (body.packageCode) payload.Extradata = { package: String(body.packageCode) }; }
      return json({ success: true, operation, service, clientReference: reference, data: await requestHubtel(`/commissionservices/{account}/${serviceId}`, { method: "POST", body: JSON.stringify(payload) }) });
    }

    if (operation === "transaction_status") {
      const reference = String(body.clientReference || body.transactionId || "").trim(); if (!reference) throw new Error("clientReference or transactionId is required");
      return json({ success: true, operation, data: await requestHubtel(`/commissionservices/{account}/status/${encodeURIComponent(reference)}`) });
    }
    throw new Error("Unsupported operation: data_catalog, bill_catalog, airtime, data, bill, callback, transaction_status");
  } catch (error) { console.error("[hubtel-gateway]", error); return json({ success: false, error: error instanceof Error ? error.message : "Hubtel request failed" }, 400); }
});
