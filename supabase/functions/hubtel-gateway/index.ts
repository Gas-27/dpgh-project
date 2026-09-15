const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const normalizePhone = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.startsWith("233") && digits.length === 12) return digits;
  throw new Error("Enter a valid Ghana phone number");
};

const money = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero");
  return Math.round(amount * 100) / 100;
};

const reference = (value: unknown, prefix: string) => {
  const candidate = String(value || `${prefix}-${crypto.randomUUID()}`).replace(/[^a-zA-Z0-9_-]/g, "");
  if (candidate.length < 3 || candidate.length > 36) throw new Error("Invalid client reference");
  return candidate;
};

const hubtelRequest = async (path: string, init: RequestInit = {}) => {
  const clientId = requiredEnv("HUBTEL_CLIENT_ID");
  const clientSecret = requiredEnv("HUBTEL_CLIENT_SECRET");
  const baseUrl = Deno.env.get("HUBTEL_BASE_URL") || "https://payproxyapi.hubtel.com";
  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`Hubtel request failed (${response.status})`);
  return data;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Only POST is supported" }, 405);

  try {
    const body = await request.json();
    const operation = String(body.operation || "").toLowerCase();
    const clientReference = reference(body.clientReference, operation === "pay_bill" ? "BILL" : "AIR");

    if (operation === "airtime" || operation === "data") {
      const network = String(body.network || "").trim().toUpperCase();
      if (!network) throw new Error("network is required");
      const data = await hubtelRequest("/v1/airtime/send", {
        method: "POST",
        body: JSON.stringify({
          network,
          phoneNumber: normalizePhone(body.phoneNumber),
          amount: money(body.amount),
          clientReference,
        }),
      });
      return json({ success: true, operation, clientReference, provider: "hubtel", data });
    }

    if (operation === "pay_bill") {
      const service = String(body.service || "").trim();
      const accountNumber = String(body.accountNumber || "").trim();
      if (!service || !accountNumber) throw new Error("service and accountNumber are required");
      const data = await hubtelRequest("/v1/bills/pay", {
        method: "POST",
        body: JSON.stringify({ service, accountNumber, amount: money(body.amount), clientReference, ...(body.packageCode ? { packageCode: String(body.packageCode) } : {}) }),
      });
      return json({ success: true, operation, clientReference, provider: "hubtel", data });
    }

    if (operation === "transaction_status") {
      const transactionId = String(body.transactionId || "").trim();
      if (!transactionId) throw new Error("transactionId is required");
      const data = await hubtelRequest(`/transactions/${encodeURIComponent(transactionId)}`);
      return json({ success: true, operation, provider: "hubtel", data });
    }

    return json({ error: "Unsupported operation. Use airtime, data, pay_bill, or transaction_status." }, 400);
  } catch (error) {
    console.error("[hubtel-gateway]", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Hubtel request failed" }, 400);
  }
});
