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

  let chargedAmount = 0;
  if (action === "services") {
    const { data: catalog, error: catalogError } = await supabase.from("social_boost_service_pricing").select("service_id,service_name,category,admin_price_per_1000,min_quantity,max_quantity,average_completion_time,notes").order("category").order("service_id");
    if (catalogError) return json({ error: "Could not load Social Boost service catalog." }, 500);
    return json({ services: (catalog ?? []).map((service) => ({ id: service.service_id, name: service.service_name, category: service.category, base_price_per_1000: service.admin_price_per_1000, min_quantity: service.min_quantity, max_quantity: service.max_quantity, average_completion_time: service.average_completion_time, notes: service.notes })) });
  }

  if (action === "add") {
    const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) return json({ error: "quantity must be a positive integer." }, 400);
    const serviceLookup = String(input.service);
    const { data: configuredService } = await supabase.from("social_boost_service_pricing").select("service_id,service_name,admin_price_per_1000,default_price_per_1000,min_quantity,max_quantity").or(`service_id.eq.${serviceLookup},service_name.ilike.${serviceLookup}`).maybeSingle();
    const pricePer1000 = Number(configuredService?.admin_price_per_1000 ?? 0);
    const minimum = Number(configuredService?.min_quantity ?? 1);
    const maximum = Number(configuredService?.max_quantity ?? 1000000);
    if (!configuredService || !Number.isFinite(pricePer1000) || pricePer1000 <= 0) return json({ error: "Service is not available for API ordering." }, 400);
    if (quantity < minimum || quantity > maximum) return json({ error: `quantity must be between ${minimum} and ${maximum}.` }, 400);
    const amount = Math.round((quantity / 1000) * pricePer1000 * 100) / 100;
    chargedAmount = amount;
    const walletBalance = Number(apiUser.api_wallet ?? apiUser.wallet ?? 0);
    if (walletBalance < amount) return json({ error: "Insufficient API wallet balance.", balance: walletBalance, required: amount }, 402);

    const { data: order, error: orderError } = await supabase.from("social_boost_orders").insert({
      user_id: apiUser.identity_id,
      owner_type: "api",
      owner_store_id: null,
      platform: String(input.platform ?? "social"),
      service: String(configuredService.service_id),
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

  if (!upstream.ok || (payload && typeof payload === "object" && "error" in payload)) {
    if (action === "add" && input.order) {
      const { data: current } = await supabase.from("api_users").select("api_wallet").eq("id", apiUser.id).maybeSingle();
      await supabase.from("api_users").update({ api_wallet: Number(current?.api_wallet ?? 0) + chargedAmount }).eq("id", apiUser.id);
      await supabase.from("social_boost_orders").update({ status: "failed", error_message: String((payload as { error?: unknown })?.error ?? "Provider request failed") }).eq("order_number", input.order);
    }
    return json({ error: "Social Boost provider request failed.", status: upstream.status, details: payload }, upstream.ok ? 502 : upstream.status);
  }

  if (action === "add" && input.order) {
    await supabase.from("social_boost_orders").update({ provider_order_id: String((payload as { order?: unknown })?.order ?? ""), status: "processing" }).eq("order_number", input.order);
  }
  return json(payload, upstream.status);
});
