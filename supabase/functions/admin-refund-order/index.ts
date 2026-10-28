import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const secret = Deno.env.get("PAYSTACK_API_KEY") ?? Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!serviceKey || !secret) return json({ error: "Refund service is not configured" }, 500);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return json({ error: "You must be signed in as an admin." }, 401);
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "Only admins can refund Paystack orders from this dashboard." }, 403);

  const body = await req.json().catch(() => null);
  const orderId = String(body?.order_id ?? "").trim();
  if (!orderId) return json({ error: "Order id is required" }, 400);
  const { data: order, error: orderError } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (orderError) return json({ error: orderError.message }, 500);
  if (!order) return json({ error: "Order not found" }, 404);
  const reference = String(order.paystack_reference ?? "").trim();
  const amount = Number(order.amount ?? order.total_amount ?? 0);
  if (!reference || !Number.isFinite(amount) || amount <= 0) return json({ error: "This order has no valid Paystack reference or refundable amount." }, 400);

  const { data: existing } = await admin.from("paystack_refunds").select("id,status").eq("order_id", orderId).in("status", ["pending", "processing", "processed", "completed"]).maybeSingle();
  if (existing) return json({ success: true, status: "already_refunded", refund_id: existing.id, amount, message: "This order has already been refunded or has a refund in progress." });

  const { data: record, error: recordError } = await admin.from("paystack_refunds").insert({ order_id: orderId, amount, paystack_reference: reference, status: "processing", reason: "Admin Paystack refund" }).select("id").single();
  if (recordError) return json({ error: recordError.message }, 409);
  const response = await fetch("https://api.paystack.co/refund", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ transaction: reference, amount: Math.round(amount * 100), currency: "GHS" }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status === false) {
    await admin.from("paystack_refunds").update({ status: "failed", reason: payload?.message ?? "Paystack refund failed", provider_payload: payload, updated_at: new Date().toISOString() }).eq("id", record.id);
    return json({ error: payload?.message ?? "Paystack refund failed" }, 502);
  }
  const status = ["processed", "completed"].includes(String(payload?.data?.status).toLowerCase()) ? "processed" : "pending";
  await admin.from("paystack_refunds").update({ status, paystack_refund_id: String(payload?.data?.id ?? ""), provider_payload: payload, processed_at: status === "processed" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", record.id);
  await admin.from("orders").update({ status: "refunded", fulfillment_status: "refunded", refunded_amount: amount, refunded_at: new Date().toISOString() }).eq("id", orderId);
  return json({ success: true, status, refund_id: record.id, amount, message: "Paystack refund submitted successfully." });
});
