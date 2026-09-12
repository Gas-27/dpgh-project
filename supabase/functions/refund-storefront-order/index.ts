import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!authHeader) return json({ error: "Authentication required" }, 401);
  if (!secret || !serviceKey) return json({ error: "Refund service is not configured" }, 500);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Authentication required" }, 401);

  const body = await req.json().catch(() => null);
  const orderId = String(body?.order_id ?? "").trim();
  const role = String(body?.actor_role ?? "").trim();
  const storefrontId = String(body?.storefront_id ?? "").trim();
  const reference = String(body?.paystack_reference ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const amount = Number(body?.amount);
  if (!orderId || !storefrontId || !reference || !["agent", "subagent", "sub_subagent", "subsubagent"].includes(role) || !Number.isFinite(amount) || amount <= 0) {
    return json({ error: "Order, storefront, role, Paystack reference, and a positive amount are required" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: order, error: orderError } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (orderError) return json({ error: `Could not verify the order: ${orderError.message}` }, 500);
  if (!order) return json({ error: "Order not found" }, 404);
  const storedReference = String(order.paystack_reference ?? "").trim();
  if (!storedReference) return json({ error: "This order has no Paystack reference and cannot be refunded." }, 400);
  if (storedReference !== reference) return json({ error: "The Paystack reference does not match this order." }, 400);
  const serverAmount = Number(order.amount ?? order.total_amount ?? order.agent_price ?? order.base_price ?? order.selling_price ?? 0);
  if (!Number.isFinite(serverAmount) || serverAmount <= 0) return json({ error: "This order has no valid refundable amount." }, 400);

  const { data: reservation, error: reservationError } = await admin.rpc("refund_storefront_order", {
    p_order_id: orderId,
    p_actor_user_id: user.id,
    p_actor_role: role,
    p_storefront_id: storefrontId,
    p_amount: serverAmount,
    p_phone: String(order.customer_number ?? phone).trim() || null,
    p_paystack_reference: storedReference,
    p_reason: body?.reason ? String(body.reason).slice(0, 500) : null,
  });
  if (reservationError) return json({ error: reservationError.message }, 400);

  const refundId = reservation.refund_id as string;
  const paystack = await fetch("https://api.paystack.co/refund", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: storedReference, amount: Math.round(serverAmount * 100), currency: "GHS", customer_note: "Refund from your original purchase" }),
  });
  const paystackBody = await paystack.json().catch(() => ({}));

  if (!paystack.ok || paystackBody?.status === false) {
    await admin.from("paystack_refunds").update({ status: "failed", wallet_deduction_status: "restored", reason: paystackBody?.message ?? "Paystack refund failed", provider_payload: paystackBody, updated_at: new Date().toISOString() }).eq("id", refundId);
    return json({ error: paystackBody?.message ?? "Paystack could not start the refund" }, 502);
  }

  await admin.from("paystack_refunds").update({ paystack_refund_id: String(paystackBody?.data?.id ?? ""), provider_payload: paystackBody, updated_at: new Date().toISOString() }).eq("id", refundId);
  return json({ success: true, refund_id: refundId, status: "pending", message: "Refund through Paystack submitted. Processing usually takes a few minutes, but can take up to 7 days." });
});
