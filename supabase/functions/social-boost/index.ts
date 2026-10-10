import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const providerApiKey = Deno.env.get("EXOBOOST_API_KEY");
  if (!providerApiKey) return json({ error: "Social Boost is not configured." }, 500);

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!apiKey) return json({ error: "Missing API key. Use Authorization: Bearer YOUR_API_KEY." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: apiUser } = await supabase
    .from("api_users")
    .select("id,identity_id,api_wallet,wallet,active,order_count")
    .eq("api_key", apiKey)
    .maybeSingle();
  if (!apiUser?.active) return json({ error: "Invalid or inactive API key." }, 401);

  const action = typeof input.action === "string" ? input.action : "";
  if (!ACTIONS.has(action)) {
    return json({ error: "Unsupported action.", allowedActions: [...ACTIONS] }, 400);
  }

  const missing = REQUIRED_FIELDS[action].filter((field) => asFormValue(input[field]) === null);
  if (missing.length > 0) return json({ error: "Missing required fields.", missing }, 400);

  if (action === "add") {
    const amount = Number(input.amount);
    const pricePer1000 = Number(input.price_per_1000);
    const quantity = Number(input.quantity);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(pricePer1000) || pricePer1000 <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      return json({ error: "add requires positive amount, price_per_1000, and integer quantity." }, 400);
    }
    const walletBalance = Number(apiUser.api_wallet ?? apiUser.wallet ?? 0);
    if (walletBalance < amount) return json({ error: "Insufficient API wallet balance.", balance: walletBalance, required: amount }, 402);

    const { data: order, error: orderError } = await supabase.from("social_boost_orders").insert({
      user_id: apiUser.identity_id,
      owner_type: "api",
      owner_store_id: null,
      platform: String(input.platform ?? "social"),
      service: String(input.service),
      target_link: String(input.link),
      quantity,
      price_per_1000: pricePer1000,
      amount,
      payment_method: "api_wallet",
      status: "processing",
    }).select("id,order_number").single();
    if (orderError || !order) return json({ error: "Could not create Social Boost order." }, 500);

    const { error: debitError } = await supabase
      .from("api_users")
      .update({ api_wallet: walletBalance - amount, api_wallet_updated_at: new Date().toISOString(), order_count: Number(apiUser.order_count ?? 0) + 1 })
      .eq("id", apiUser.id)
      .eq("api_wallet", walletBalance);
    if (debitError) {
      await supabase.from("social_boost_orders").delete().eq("id", order.id);
      return json({ error: "Could not debit API wallet." }, 409);
    }
    input.order = order.order_number;
  }

  const body = new URLSearchParams({ key: providerApiKey, action });
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
