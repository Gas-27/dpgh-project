import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SPACESHIP_API_BASE = "https://spaceship.dev/api";
const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST for Spaceship API requests." }, 405);

  const apiKey = Deno.env.get("SPACESHIP_API_KEY");
  const apiSecret = Deno.env.get("SPACESHIP_API_SECRET");
  if (!apiKey || !apiSecret) {
    return json({ error: "Spaceship API credentials are not configured." }, 500);
  }

  let input: { method?: string; path?: string; query?: Record<string, string>; body?: unknown };
  try {
    input = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const method = (input.method ?? "GET").toUpperCase();
  const path = input.path ?? "";
  if (!ALLOWED_METHODS.has(method)) return json({ error: "Unsupported HTTP method." }, 400);
  if (!/^\/v1\/[A-Za-z0-9_./{}-]+$/.test(path) || path.includes("..")) {
    return json({ error: "Only valid Spaceship /v1 API paths are allowed." }, 400);
  }

  const url = new URL(`${SPACESHIP_API_BASE}${path}`);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (typeof value === "string") url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    "X-API-Secret": apiSecret,
    Accept: "application/json",
  };
  if (method !== "GET" && method !== "DELETE") headers["Content-Type"] = "application/json";

  const upstream = await fetch(url, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(input.body ?? {}),
  });
  const text = await upstream.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Preserve non-JSON upstream responses without exposing credentials.
  }
  return json(payload, upstream.status);
});
