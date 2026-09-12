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
  if (!authHeader || !secret || !serviceKey) return json({ error: "Refund service is not configured" }, 500);

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
  const { data: reservation, error: reservationError } = await admin.rpc("refund_storefront_order", {
    p_order_id: orderId,
    p_actor_user_id: user.id,
    p_actor_role: role,
    p_storefront_id: storefrontId,
    p_amount: amount,
    p_phone: phone || null,
    p_paystack_reference: reference,
    p_reason: body?.reason ? String(body.reason).slice(0, 500) : null,
  });
  if (reservationError) return json({ error: reservationError.message }, 400);

  const refundId = reservation.refund_id as string;
  const paystack = await fetch("https://api.paystack.co/refund", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: reference, amount: Math.round(amount * 100), currency: "GHS", customer_note: "Refund from your original purchase" }),
  });
  const paystackBody = await paystack.json().catch(() => ({}));

  if (!paystack.ok || paystackBody?.status === false) {
    await admin.from("paystack_refunds").update({ status: "failed", wallet_deduction_status: "restored", reason: paystackBody?.message ?? "Paystack refund failed", provider_payload: paystackBody, updated_at: new Date().toISOString() }).eq("id", refundId);
    return json({ error: paystackBody?.message ?? "Paystack could not start the refund" }, 502);
  }

  await admin.from("paystack_refunds").update({ paystack_refund_id: String(paystackBody?.data?.id ?? ""), provider_payload: paystackBody, updated_at: new Date().toISOString() }).eq("id", refundId);
  return json({ success: true, refund_id: refundId, status: "pending", message: "Refund through Paystack submitted. Processing usually takes a few minutes, but can take up to 7 days." });
});
