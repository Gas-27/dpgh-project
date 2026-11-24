import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("PAYSTACK_API_KEY") ?? Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret || !serviceKey) return json({ error: "Refund service is not configured" }, 500);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return json({ error: "You must be signed in as an admin." }, 401);
  const actorId = auth.user.id;
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", actorId).eq("role", "admin").maybeSingle();
  if (!role) return json({ error: "Only admins can refund Paystack orders from this dashboard." }, 403);

  const body = await req.json().catch(() => null);
  const orderId = String(body?.order_id ?? "").trim();
  if (!orderId) return json({ error: "Order id is required" }, 400);

  const { data: existingRefund } = await admin.from("paystack_refunds").select("id, status").eq("order_id", orderId).in("status", ["pending", "processing", "processed", "completed"]).maybeSingle();
  if (existingRefund) return json({ success: true, already_refunded: true, status: existingRefund.status, message: "This order was already refunded through Paystack." });

  const { data: reserved, error: reserveError } = await admin.rpc("admin_direct_storefront_refund", { p_order_id: orderId, p_actor: actorId });
  if (reserveError) return json({ error: reserveError.message }, 400);
  if (reserved?.already_refunded) return json({ success: true, already_refunded: true, status: "refunded", amount: reserved.amount, message: "This order was already refunded." });
  if (!reserved?.direct) return json({ error: "This is not a storefront Paystack order. Use the wallet refund instead." }, 400);

  const amount = Number(reserved.amount);
  const reference = String(reserved.paystack_reference);
  const revert = async () => {
    await admin.rpc("admin_direct_storefront_refund_revert", {
      p_order_id: orderId,
      p_actor: actorId,
      p_prev_status: reserved.prev_status ?? null,
      p_prev_order_status: reserved.prev_order_status ?? null,
      p_prev_fulfillment_status: reserved.prev_fulfillment_status ?? null,
    });
  };

  const { data: record, error: recordError } = await admin.from("paystack_refunds").insert({
    order_id: orderId,
    amount,
    paystack_reference: reference,
    status: "processing",
    reason: "Admin-initiated Paystack refund",
    wallet_deduction_status: "deducted",
  }).select("id").single();
  if (recordError) {
    await revert();
    return json({ error: recordError.message }, 409);
  }
  const refundId = record.id as string;

  const paystack = await fetch("https://api.paystack.co/refund", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: reference, amount: Math.round(amount * 100), currency: "GHS", customer_note: "Refund from your original purchase" }),
  });
  const paystackBody = await paystack.json().catch(() => ({}));

  if (!paystack.ok || paystackBody?.status === false) {
    await revert();
    await admin.from("paystack_refunds").update({ status: "failed", reason: paystackBody?.message ?? "Paystack refund failed", provider_payload: paystackBody, updated_at: new Date().toISOString() }).eq("id", refundId);
    return json({ error: paystackBody?.message ?? "Paystack could not start the refund" }, 502);
  }

  const paystackStatus = String(paystackBody?.data?.status ?? "pending").toLowerCase();
  const status = paystackStatus === "processed" || paystackStatus === "completed" ? "processed" : paystackStatus === "failed" ? "failed" : "pending";
  if (status === "failed") await revert();
  await admin.from("paystack_refunds").update({
    paystack_refund_id: String(paystackBody?.data?.id ?? ""),
    status,
    provider_payload: paystackBody,
    processed_at: status === "processed" ? new Date().toISOString() : null,
    wallet_deduction_status: status === "failed" ? "reversed" : "deducted",
    updated_at: new Date().toISOString(),
  }).eq("id", refundId);

  if (status === "failed") return json({ error: "Paystack rejected the refund." }, 502);
  return json({
    success: true,
    status,
    amount,
    profit: reserved.profit,
    owner_type: reserved.owner_type,
    owner_id: reserved.owner_id,
    refund_id: refundId,
    message: `Credited ${Number(reserved.base_credit).toFixed(2)} base price to the store wallet, took ${amount.toFixed(2)} (the amount the customer paid) from it, and refunded ${amount.toFixed(2)} to the customer through Paystack.`,
  });
});
