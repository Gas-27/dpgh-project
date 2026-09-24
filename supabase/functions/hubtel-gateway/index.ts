import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key",
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
  dstv: "297a96656b5846ad8b00d5d41b256ea7",
  gotv: "e6ceac7f3880435cb30b048e9617eb41",
  telecel_postpaid: "a3ab78c84c6b4976b78a6f393e247a72",
  ghana_water: "6c1e8a82d2e84feeb8bfd6be2790d71d",
  startimes: "6598652d34ea4112949c93c079c501ce",
};

const fallbackBundles: Record<
  string,
  Array<{ Display: string; Value: string; Amount: number }>
> = {
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

const json = (body: unknown, status = 200, requestId?: string) =>
  new Response(JSON.stringify({ ...(body as Record<string, unknown>), requestId }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-Hubtel-Request-Id": requestId || "unknown",
    },
  });
const redact = (value: unknown): unknown => {
  if (typeof value === "string") {
    if (/^233\d{9}$/.test(value)) return `${value.slice(0, 6)}***${value.slice(-2)}`;
    if (value.length > 120) return `${value.slice(0, 117)}...`;
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        /authorization|api.?key|secret|password|token/i.test(key) ? [key, "[redacted]"] : [key, redact(item)],
      ]),
    );
  }
  return value;
};
const logEvent = (requestId: string, event: string, details: Record<string, unknown> = {}) => {
  console.log(JSON.stringify({
    source: "hubtel-gateway",
    requestId,
    event,
    timestamp: new Date().toISOString(),
    ...(redact(details) as Record<string, unknown>),
  }));
};
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const phone = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0"))
    return `233${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("233")) return digits;
  throw new Error("Enter a valid Ghana phone number");
};
const amount = (value: unknown) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0)
    throw new Error("Amount must be greater than zero");
  return Math.round(result * 100) / 100;
};
const providerAccepted = (data: unknown) => {
  const responseCode = String(
    (data as { ResponseCode?: string; responseCode?: string })?.ResponseCode ??
      (data as { responseCode?: string })?.responseCode ??
      "",
  );
  if (responseCode && !["0000", "0001"].includes(responseCode)) {
    const message = String(
      (data as { Message?: string; message?: string })?.Message ||
        (data as { message?: string })?.message ||
        "Hubtel rejected the transaction",
    );
    throw new Error(
      `Hubtel rejected the transaction (${responseCode}): ${message}`,
    );
  }
  return data;
};

const clientReference = (value: unknown, prefix = "HUBTEL") => {
  const supplied = String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 36);
  if (supplied.length >= 3) return supplied;

  // Hubtel accepts references up to 36 characters. Keep generated references short.
  return `${prefix.slice(0, 8)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
};
const walletClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    throw new Error("Supabase wallet service is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
};
async function debitWallet(body: Record<string, unknown>, value: number) {
  if (body.walletOnly !== true) return null;
  const ownerType = String(body.walletOwnerType || "").toLowerCase();
  const ownerId = String(body.walletOwnerId || "");
  if (!ownerType || !ownerId) throw new Error("Wallet owner is required");
  const { data, error } = await walletClient().rpc("debit_purchase_wallet", {
    p_owner_type: ownerType,
    p_owner_id: ownerId,
    p_amount: value,
  });
  if (error) throw new Error(`Wallet debit failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.success)
    throw new Error(row?.message || "Insufficient wallet balance");
  return { ownerType, ownerId, amount: value };
}
async function refundWallet(
  item: { ownerType: string; ownerId: string; amount: number } | null,
) {
  if (!item) return;
  await walletClient().rpc("credit_purchase_wallet", {
    p_owner_type: item.ownerType,
    p_owner_id: item.ownerId,
    p_amount: item.amount,
  });
}

const requestHubtel = async (
  path: string,
  init: RequestInit = {},
  accountName: "disbursement" | "collection" = "disbursement",
  requestId = "unknown",
) => {
  const account =
    accountName === "collection"
      ? Deno.env.get("HUBTEL_COLLECTION_ACCOUNT_NUMBER") || "2040631"
      : env("HUBTEL_DISBURSEMENT_ACCOUNT_NUMBER");
  const baseUrl = Deno.env.get("HUBTEL_BASE_URL") || "https://cs.hubtel.com";
  const apiId =
    Deno.env.get("HUBTEL_API_ID") || Deno.env.get("HUBTEL_CLIENT_ID");
  const apiKey =
    Deno.env.get("HUBTEL_API_KEY") || Deno.env.get("HUBTEL_CLIENT_SECRET");
  if (!apiId) throw new Error("Missing HUBTEL_API_ID");
  if (!apiKey) throw new Error("Missing HUBTEL_API_KEY");
  const auth = btoa(`${apiId}:${apiKey}`);
  const url = `${baseUrl.replace(/\/$/, "")}${path.replace("{account}", account)}`;
  logEvent(requestId, "hubtel_request", {
    method: init.method || "GET",
    url,
    accountName,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  });
  const startedAt = Date.now();
  const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    },
  );
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  logEvent(requestId, "hubtel_response", {
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - startedAt,
    response: data,
  });
  if (!response.ok) {
    const detail =
      typeof data === "object" && data !== null
        ? JSON.stringify(data)
        : String(data || "");
    throw new Error(
      `Hubtel request failed (${response.status})${detail ? `: ${detail.slice(0, 500)}` : ""}`,
    );
  }
  return data;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST" && request.method !== "GET")
    return json({ error: "Only GET and POST are supported" }, 405);
  const requestId = crypto.randomUUID();
  let walletDebit: {
    ownerType: string;
    ownerId: string;
    amount: number;
  } | null = null;
  try {
    const body =
      request.method === "GET"
        ? Object.fromEntries(new URL(request.url).searchParams)
        : await request.json();
    const operation = String(body.operation || "").toLowerCase();
    const service = String(
      body.service || body.serviceCode || "",
    ).toLowerCase();
    const serviceId =
      serviceIds[service] || (service.match(/^[a-f0-9]{32}$/) ? service : "");
    logEvent(requestId, "request_received", {
      method: request.method,
      operation,
      service,
      serviceId,
      body,
    });

    if (operation === "verify_msisdn") {
      const destination = phone(
        body.destination || body.phoneNumber || body.customerMsisdn,
      );
      const verificationService = "3e0841e70afc42fb97d13d19abd36384";
      const data = providerAccepted(
        await requestHubtel(
          `/commissionservices/{account}/${verificationService}?destination=${encodeURIComponent(destination)}`,
          {},
          "collection",
        ),
      );
      const items = Array.isArray((data as { Data?: unknown }).Data)
        ? (data as { Data: Array<{ Display?: string; Value?: string }> }).Data
        : [];
      const nameItem = items.find((item) =>
        /name|customer|subscriber/i.test(String(item.Display || "")),
      );
      const name = String(nameItem?.Value || "").trim() || null;
      const providerMessage =
        String((data as { Message?: string }).Message || "").trim() || null;

      return json({
        success: true,
        operation,
        destination,
        verified: Boolean(name),
        name,
        providerMessage,
        data,
      });
    }

    if (operation === "data_catalog") {
      const destination = phone(
        body.destination || body.phoneNumber || body.customerMsisdn,
      );
      if (!serviceId || !service.endsWith("_data"))
        throw new Error("Use mtn_data, telecel_data, or airteltigo_data");
      const live = providerAccepted(
        await requestHubtel(
          `/commissionservices/{account}/${serviceId}?destination=${encodeURIComponent(destination)}`,
        ),
      );
      return json({
        success: true,
        operation,
        service,
        data: live,
        source: "hubtel",
      });
    }

    if (operation === "bill_catalog") {
      const lookupServices = [
        "ecg",
        "ghana_water",
        "dstv",
        "gotv",
        "startimes",
        "telecel_broadband",
        "telecel_postpaid",
      ];
      if (!serviceId || !lookupServices.includes(service))
        throw new Error("This service does not support account lookup");
      const raw = String(
        body.accountNumber || body.destination || body.phoneNumber || "",
      ).trim();
      if (!raw) throw new Error("accountNumber is required");
      // ECG accepts either the registered mobile number or the linked meter
      // number. Keep the entered identifier intact so Hubtel can resolve it.
      const lookupTarget = raw;
      let query = `destination=${encodeURIComponent(lookupTarget)}`;
      if (service === "ghana_water") {
        const mobile = String(body.mobile || body.phoneNumber || "").trim();
        if (mobile) query += `&mobile=${encodeURIComponent(phone(mobile))}`;
      }
      const data = await requestHubtel(
        `/commissionservices/{account}/${serviceId}?${query}`,
      );
      const items = Array.isArray((data as { Data?: unknown }).Data)
        ? (data as {
            Data: Array<{ Display?: string; Value?: string; Amount?: number }>;
          }).Data
        : [];
      const findByKey = (re: RegExp) =>
        items.find((item) => re.test(String(item.Display || "")));
      const name = String(findByKey(/name/i)?.Value || "").trim() || null;
      const amountDue =
        String(findByKey(/amount\s*due|amountdue/i)?.Value || "").trim() ||
        null;
      const sessionId =
        String(findByKey(/session/i)?.Value || "").trim() || null;
      const bouquet =
        String(findByKey(/bouquet/i)?.Value || "").trim() || null;
      // ECG returns one row per linked meter with the owner name embedded in the
      // Display text and the meter number in Value.
      const accounts =
        service === "ecg"
          ? items
              .map((item) => ({
                label: String(item.Display || "").trim(),
                value: String(item.Value || "").trim(),
                amountDue:
                  typeof item.Amount === "number" ? item.Amount : null,
              }))
              .filter((account) => account.value)
          : [];
      return json({
        success: true,
        operation,
        service,
        name,
        amountDue,
        sessionId,
        bouquet,
        accounts,
        data,
      });
    }

    if (operation === "callback") {
      const callback = body;
      console.log(
        "[hubtel-gateway] callback received",
        JSON.stringify(callback),
      );
      return json({ success: true, operation, received: true });
    }

    if (
      operation === "airtime" ||
      operation === "data" ||
      operation === "bill"
    ) {
      if (!serviceId) throw new Error("A valid Hubtel service is required");
      if (operation === "data" && !service.endsWith("_data"))
        throw new Error(
          "Data purchases require an MTN, Telecel, or AirtelTigo data service",
        );
      if (operation === "airtime" && !service.endsWith("_airtime"))
        throw new Error("Airtime purchases require an airtime service");
      const destination =
        operation === "bill"
          ? String(body.accountNumber || "").trim()
          : phone(body.destination || body.phoneNumber || body.customerMsisdn);
      if (!destination) throw new Error("accountNumber is required");
      const reference = clientReference(
        body.clientReference,
        operation.toUpperCase(),
      );
      const callbackUrl = String(
        body.callbackUrl || Deno.env.get("HUBTEL_CALLBACK_URL") || "",
      );
      if (!callbackUrl)
        throw new Error("callbackUrl or HUBTEL_CALLBACK_URL is required");
      const purchaseAmount = amount(body.amount);
      const payload: Record<string, unknown> = {
        Destination: destination,
        Amount: purchaseAmount,
        CallbackUrl: callbackUrl,
        ClientReference: reference,
      };
      if (operation === "data") {
        const requestedValue = String(
          body.bundle || body.packageCode || "",
        ).trim();
        const requestedName = String(body.bundleName || "").trim();
        if (!requestedValue && !requestedName)
          throw new Error("bundle is required; query data_catalog first");
        const catalog = (await requestHubtel(
          `/commissionservices/{account}/${serviceId}?destination=${encodeURIComponent(destination)}`,
        )) as {
          Data?: Array<{ Display?: string; Value?: string; Amount?: number }>;
        };
        const items = catalog.Data || [];
        const norm = (value: unknown) =>
          String(value || "")
            .trim()
            .toLowerCase();
        // Bundles like MTN "flexi_data_bundle" repeat the same Value at several
        // price points, so the amount is what disambiguates them. Match on the
        // exact display + price first, then value + price, before falling back
        // to a name/value-only match.
        const amountMatches = (value: unknown) =>
          typeof value === "number" && Math.abs(value - purchaseAmount) <= 0.01;
        const match =
          (requestedName &&
            items.find(
              (item) =>
                norm(item.Display) === norm(requestedName) &&
                amountMatches(item.Amount),
            )) ||
          (requestedValue &&
            items.find(
              (item) =>
                norm(item.Value) === norm(requestedValue) &&
                amountMatches(item.Amount),
            )) ||
          (requestedName &&
            items.find((item) => norm(item.Display) === norm(requestedName))) ||
          (requestedValue &&
            items.find((item) => norm(item.Value) === norm(requestedValue))) ||
          null;
        if (!match || !match.Value)
          throw new Error(
            "This data bundle is no longer available. Please refresh the bundle list and try again.",
          );
        payload.Amount =
          typeof match.Amount === "number" ? match.Amount : purchaseAmount;
        payload.Extradata = { bundle: match.Value };
      }
      if (operation === "bill") {
        const accountNumber = String(
          body.accountNumber || body.meterNumber || "",
        ).trim();
        if (!accountNumber) throw new Error("accountNumber is required");
        if (service === "ecg") {
          // ECG top-up debits a registered mobile number and applies the value
          // to the linked meter passed in Extradata.bundle.
          payload.Destination = phone(
            body.phoneNumber || body.mobile || body.destination,
          );
          payload.Extradata = { bundle: accountNumber };
        } else if (service === "ghana_water") {
          const sessionId = String(body.sessionId || "").trim();
          if (!sessionId)
            throw new Error(
              "Query the Ghana Water meter first to obtain a session id",
            );
          payload.Destination = accountNumber;
          payload.Extradata = {
            bundle: accountNumber,
            Email: String(body.email || "").trim() || "support@dataplug.store",
            SessionId: sessionId,
          };
        } else if (service === "telecel_broadband") {
          payload.Destination = accountNumber;
          payload.Extradata = { bundle: accountNumber };
        } else {
          // DSTV, GOtv, StarTimes and Telecel postpaid are paid directly to the
          // account/decoder number with no Extradata.
          payload.Destination = accountNumber;
        }
      }
      walletDebit = await debitWallet(body, Number(payload.Amount));
      const providerResponse = providerAccepted(
        await requestHubtel(
          `/commissionservices/{account}/${serviceId}`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          "disbursement",
          requestId,
        ),
      );

      const responseCode = String(
        (providerResponse as { ResponseCode?: string; responseCode?: string })
          ?.ResponseCode ||
          (providerResponse as { responseCode?: string })?.responseCode ||
          "",
      );
      const pending = responseCode === "0001";
      return json({
        success: true,
        pending,
        fulfilled: responseCode === "0000",
        operation,
        service,
        clientReference: reference,
        data: providerResponse,
      });
    }

    if (operation === "transaction_status") {
      const reference = String(body.clientReference || "").trim();
      const hubtelTransactionId = String(
        body.transactionId || body.hubtelTransactionId || "",
      ).trim();
      if (!reference && !hubtelTransactionId)
        throw new Error("clientReference or transactionId is required");
      // The Status Check API lives on a separate host and uses the Collection
      // Account Number, not the disbursement account or the commission host.
      const collectionAccount =
        Deno.env.get("HUBTEL_COLLECTION_ACCOUNT_NUMBER") ||
        env("HUBTEL_DISBURSEMENT_ACCOUNT_NUMBER");
      const apiId =
        Deno.env.get("HUBTEL_API_ID") || Deno.env.get("HUBTEL_CLIENT_ID");
      const apiKey =
        Deno.env.get("HUBTEL_API_KEY") || Deno.env.get("HUBTEL_CLIENT_SECRET");
      const params = reference
        ? `clientReference=${encodeURIComponent(reference)}`
        : `hubtelTransactionId=${encodeURIComponent(hubtelTransactionId)}`;
      const statusResponse = await fetch(
        `https://api-txnstatus.hubtel.com/transactions/${collectionAccount}/status?${params}`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${apiId}:${apiKey}`)}`,
            Accept: "application/json",
          },
        },
      );
      const statusText = await statusResponse.text();
      let statusData: unknown;
      try {
        statusData = statusText ? JSON.parse(statusText) : null;
      } catch {
        statusData = { raw: statusText };
      }
      return json({ success: true, operation, data: statusData });
    }
    throw new Error(
      "Unsupported operation: data_catalog, bill_catalog, airtime, data, bill, callback, transaction_status",
    );
  } catch (error) {
    await refundWallet(walletDebit);
    const message = error instanceof Error ? error.message : "Hubtel request failed";
    logEvent(requestId, "request_failed", {
      error: message,
      walletRefunded: Boolean(walletDebit),
    });
    return json(
      {
        success: false,
        error: message,
        wallet_refunded: Boolean(walletDebit),
      },
      200,
      requestId,
    );
  }
});
