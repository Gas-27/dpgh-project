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
  if (!serviceKey) return json({ error: "Refund service is not configured" }, 500);

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
  const amount = Number(order.amount ?? order.selling_price ?? order.base_price ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return json({ error: "This order has no valid refundable amount." }, 400);

  const { data, error } = await admin.rpc("admin_allocate_order_refund", { p_order_id: orderId, p_actor: auth.user.id });
  if (error) return json({ error: error.message }, 400);
  return json({ success: true, status: data?.status ?? "allocated", amount: data?.amount, owner_type: data?.owner_type, owner_id: data?.owner_id, already_allocated: data?.already_allocated ?? false, message: data?.already_allocated ? "This order has already been refunded and the wallet credit was not repeated." : "Refund completed. The correct wallet was credited with the recorded admin base price." });
});
