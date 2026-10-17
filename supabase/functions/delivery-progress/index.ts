import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const NETWORKS = ["mtn", "mtn_express", "telecel", "airteltigo"];

function normalizeNetwork(value: unknown) {
  const normalized = String(value || "mtn").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["mtnexpress", "express_mtn"].includes(normalized)) return "mtn_express";
  if (normalized === "vodafone") return "telecel";
  if (["airtel", "airtel_tigo", "tigo"].includes(normalized)) return "airteltigo";
  return NETWORKS.includes(normalized) ? normalized : "mtn";
}

function maskNumber(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 6 ? `${digits.slice(0, 3)}****${digits.slice(-3)}` : null;
}

function durationMinutes(start: unknown, end: unknown) {
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(String(end)).getTime() - new Date(String(start)).getTime()) / 60000));
}

function fakeNumber(prefixValue: unknown, slot: number) {
  const prefixes = String(prefixValue || "024").split(",").map((value) => value.replace(/\D/g, "").slice(0, 3)).filter((value) => value.length === 3);
  const prefix = prefixes[slot % Math.max(1, prefixes.length)] || "024";
  const seed = `${slot}:${prefix}`.split("").reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);
  return `${prefix}${String((seed * 2654435761) % 1000000).padStart(6, "0")}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const apiKey = String(req.headers.get("x-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || new URL(req.url).searchParams.get("api_key") || "").trim();
  if (apiKey.length < 12) return json({ error: "Provide an API key using x-api-key or Authorization: Bearer" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: apiUser } = await supabase.from("api_users").select("id,is_active").eq("api_key", apiKey).maybeSingle();
  if (!apiUser || apiUser.is_active === false) return json({ error: "Invalid or inactive API key" }, 401);

  const network = normalizeNetwork(new URL(req.url).searchParams.get("network"));
  const { data: setting, error: settingError } = await supabase.from("delivery_progress_settings").select("network,enabled,source,min_minutes,max_minutes,rotation_minutes,fake_enabled,fake_prefix,fake_count,status_color,message,updated_at").eq("network", network).maybeSingle();
  if (settingError) return json({ error: "Unable to load delivery settings" }, 500);

  const networks = network === "mtn_express" ? ["mtn_express", "mtn"] : [network];
  const { data: orders, error: orderError } = await supabase.from("orders").select("id,customer_number,network,status,fulfillment_status,order_status,created_at,updated_at").in("network", networks).or("order_status.ilike.delivered,fulfillment_status.ilike.delivered,status.ilike.delivered").order("updated_at", { ascending: false }).limit(1);
  if (orderError) return json({ error: "Unable to load delivery history" }, 500);

  const latest = orders?.[0] || null;
  const minMinutes = Math.max(2, Number(setting?.min_minutes || 30));
  const maxMinutes = Math.max(minMinutes, Number(setting?.max_minutes || 240));
  const fakeMode = setting?.fake_enabled === true || setting?.source === "fake";
  const rotation = Math.max(1, Number(setting?.rotation_minutes || 30));
  const count = Math.max(1, Number(setting?.fake_count || 10));
  const slot = Math.floor(Date.now() / (rotation * 60000)) % count;
  const fakeCustomer = fakeNumber(setting?.fake_prefix, slot);
  const fakeTook = minMinutes + (Math.abs(slot * 7919) % Math.max(1, maxMinutes - minMinutes + 1));
  const fakeDeliveredAt = new Date();
  const fakePlacedAt = new Date(fakeDeliveredAt.getTime() - fakeTook * 60000);
  const shown = fakeMode ? { orderId: `fake-${slot}`, customerNumber: maskNumber(fakeCustomer), placedAt: fakePlacedAt.toISOString(), deliveredAt: fakeDeliveredAt.toISOString(), durationMinutes: fakeTook, isFake: true } : latest ? { orderId: latest.id, customerNumber: maskNumber(latest.customer_number), placedAt: latest.created_at, deliveredAt: latest.updated_at, durationMinutes: durationMinutes(latest.created_at, latest.updated_at), isFake: false } : null;
  const realDurations = orders?.filter((order) => order.created_at && order.updated_at).map((order) => durationMinutes(order.created_at, order.updated_at) || 0) || [];
  const extra = setting?.source === "orders" ? Math.min(240, Math.floor(0 / 100) * 15) : 0;
  const estimateMin = setting?.source === "orders" && realDurations.length ? Math.min(...realDurations) : minMinutes + extra;
  const estimateMax = setting?.source === "orders" && realDurations.length ? Math.max(...realDurations) : maxMinutes + extra;
  const label = network === "mtn_express" ? "MTN Express" : network === "airteltigo" ? "AirtelTigo" : network.charAt(0).toUpperCase() + network.slice(1);
  return json({ success: true, data: { network, label, enabled: setting?.enabled ?? true, statusColor: setting?.status_color || "green", source: setting?.source || "orders", fakeMode, message: setting?.message?.trim() || `${label} orders are being processed. Please allow the estimated delivery window.`, estimatedDelivery: { minMinutes: estimateMin, maxMinutes: estimateMax }, lastDelivered: shown, infoMessage: "This is an estimated delivery window, not a guarantee. Track your own order for its actual status.", updatedAt: setting?.updated_at || null }, meta: { version: "2", generatedAt: new Date().toISOString() } });
});
