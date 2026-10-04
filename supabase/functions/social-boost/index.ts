import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXOBOOST_API_URL = "https://exosupplier.com/api/v2";
const ACTIONS = new Set(["services", "add", "status", "refill", "refill_status", "cancel", "balance"]);
const REQUIRED_FIELDS: Record<string, string[]> = {
  services: [],
  balance: [],
  add: ["service", "link", "quantity"],
  status: ["order"],
  refill: ["order"],
  refill_status: ["refill"],
  cancel: ["orders"],
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asFormValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST for Social Boost requests." }, 405);

  const apiKey = Deno.env.get("EXOBOOST_API_KEY");
  if (!apiKey) return json({ error: "Social Boost is not configured." }, 500);

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const action = typeof input.action === "string" ? input.action : "";
  if (!ACTIONS.has(action)) {
    return json({ error: "Unsupported action.", allowedActions: [...ACTIONS] }, 400);
  }

  const missing = REQUIRED_FIELDS[action].filter((field) => asFormValue(input[field]) === null);
  if (missing.length > 0) return json({ error: "Missing required fields.", missing }, 400);

  const body = new URLSearchParams({ key: apiKey, action });
  for (const [field, value] of Object.entries(input)) {
    if (field === "action" || field === "key") continue;
    const formValue = asFormValue(value);
    if (formValue !== null) body.set(field, formValue);
  }

  let upstream: Response;
  try {
    upstream = await fetch(EXOBOOST_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
  } catch {
    return json({ error: "Social Boost provider could not be reached." }, 502);
  }

  const text = await upstream.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Preserve non-JSON provider responses without exposing the API key.
  }

  if (!upstream.ok) {
    return json({ error: "Social Boost provider request failed.", status: upstream.status, details: payload }, upstream.status);
  }

  return json(payload, upstream.status);
});
