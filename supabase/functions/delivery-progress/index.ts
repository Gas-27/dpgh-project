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
  const { data: setting, error: settingError } = await supabase.from("delivery_progress_settings").select("network,enabled,source,min_minutes,max_minutes,status_color,message,updated_at").eq("network", network).maybeSingle();
  if (settingError) return json({ error: "Unable to load delivery settings" }, 500);

  const networks = network === "mtn_express" ? ["mtn_express", "mtn"] : [network];
  const { data: orders, error: orderError } = await supabase.from("orders").select("id,customer_number,network,status,fulfillment_status,order_status,created_at,updated_at").in("network", networks).in("fulfillment_status", ["completed", "delivered"]).order("updated_at", { ascending: false }).limit(1);
  if (orderError) return json({ error: "Unable to load delivery history" }, 500);

  const latest = orders?.[0] || null;
  return json({ success: true, data: { network, enabled: setting?.enabled ?? true, statusColor: setting?.status_color || "green", source: setting?.source || "orders", message: setting?.message || `${network} orders are being processed.`, estimatedDelivery: { minMinutes: Number(setting?.min_minutes || 30), maxMinutes: Number(setting?.max_minutes || 240) }, lastDelivered: latest ? { orderId: latest.id, customerNumber: maskNumber(latest.customer_number), placedAt: latest.created_at, deliveredAt: latest.updated_at, durationMinutes: durationMinutes(latest.created_at, latest.updated_at) } : null, updatedAt: setting?.updated_at || null }, meta: { version: "1", generatedAt: new Date().toISOString() } });
});
