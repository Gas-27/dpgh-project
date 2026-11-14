const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeGhanaPhone = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return `233${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("233")) return digits;
  throw new Error("Enter a valid Ghana phone number");
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const requestId = crypto.randomUUID();
  try {
    const body = await request.json();
    const destination = normalizeGhanaPhone(body.destination || body.phoneNumber);
    const apiId = Deno.env.get("HUBTEL_API_ID") || Deno.env.get("HUBTEL_CLIENT_ID");
    const apiKey = Deno.env.get("HUBTEL_API_KEY") || Deno.env.get("HUBTEL_CLIENT_SECRET");
    const account = Deno.env.get("HUBTEL_COLLECTION_ACCOUNT_NUMBER") || "2040631";
    if (!apiId || !apiKey) throw new Error("Hubtel credentials are missing");

    const url = `https://cs.hubtel.com/commissionservices/${account}/3e0841e70afc42fb97d13d19abd36384?destination=${encodeURIComponent(destination)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${btoa(`${apiId}:${apiKey}`)}`,
        Accept: "application/json",
      },
    });
    const data = await response.json();
    console.log(JSON.stringify({ source: "hubtel-msisdn-lookup", requestId, status: response.status }));
    if (!response.ok) return json({ success: false, error: "Hubtel lookup failed", requestId }, 502);

    const item = (data?.Data || []).find((entry: { Display?: string }) =>
      /name|customer|subscriber/i.test(entry.Display || ""),
    );
    return json({ success: true, name: item?.Value || null, destination, data, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registered-number lookup failed";
    return json({ success: false, error: message, requestId }, 400);
  }
});
