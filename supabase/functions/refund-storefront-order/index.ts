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
  const secret = Deno.env.get("PAYSTACK_API_KEY") ?? Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret || !serviceKey) return json({ error: "Refund service is not configured" }, 500);

  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const userClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData } = bearerToken
    ? await userClient.auth.getUser(bearerToken)
    : { data: { user: null } };
  const authenticatedUserId = userData.user?.id ?? null;

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
  if (!authenticatedUserId) return json({ error: "You must be signed in to request a refund." }, 401);
  const actorUserId = authenticatedUserId;
  const storedReference = String(order.paystack_reference ?? "").trim();
  if (!storedReference) return json({ error: "This order has no Paystack reference and cannot be refunded." }, 400);
  if (storedReference !== reference) return json({ error: "The Paystack reference does not match this order." }, 400);
  const allocationAmount = Number(order.refund_allocation_amount ?? 0);
  if (!Number.isFinite(allocationAmount) || allocationAmount <= 0) return json({ error: "An admin must allocate the seller's recorded base price before this refund can be initiated." }, 400);

  const { data: existingRefund } = await admin.from("paystack_refunds").select("id, status, paystack_refund_id").eq("order_id", orderId).eq("paystack_reference", storedReference).in("status", ["pending", "processing", "completed"]).maybeSingle();
  if (existingRefund) return json({ success: true, refund_id: existingRefund.id, status: existingRefund.status, message: "This refund has already been submitted for the order." });

  const { data: debit, error: debitError } = await admin.rpc("seller_debit_order_refund", { p_order_id: orderId, p_actor: actorUserId });
  if (debitError) return json({ error: debitError.message }, 400);
  const serverAmount = allocationAmount;
  if (!Number.isFinite(serverAmount) || serverAmount <= 0) return json({ error: "This order has no valid allocated refund amount." }, 400);
  const { data: reservation, error: reservationError } = await admin.from("paystack_refunds").insert({ order_id: orderId, amount: serverAmount, paystack_reference: storedReference, status: "processing", reason: body?.reason ? String(body.reason).slice(0, 500) : "Seller-initiated Paystack refund", wallet_deduction_status: "deducted" }).select("id").single();
  if (reservationError) return json({ error: reservationError.message }, 409);

  const refundId = reservation.id as string;
  const paystack = await fetch("https://api.paystack.co/refund", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: storedReference, amount: Math.round(serverAmount * 100), currency: "GHS", customer_note: "Refund from your original purchase" }),
  });
  const paystackBody = await paystack.json().catch(() => ({}));

  if (!paystack.ok || paystackBody?.status === false) {
    const { data: orderForRestore } = await admin.from("orders").select("refund_allocation_owner_type, refund_allocation_owner_id").eq("id", orderId).single();
    if (orderForRestore?.refund_allocation_owner_type && orderForRestore?.refund_allocation_owner_id) {
      await admin.rpc("wallet_apply_internal", {
        p_owner_type: orderForRestore.refund_allocation_owner_type,
        p_owner_id: orderForRestore.refund_allocation_owner_id,
        p_delta: allocationAmount,
        p_kind: "refund_debit_reversal",
        p_reference: `${orderId}:refund-reversal`,
        p_note: paystackBody?.message ?? "Paystack refund failed; seller wallet debit restored",
        p_actor: actorUserId,
        p_allow_negative: false,
      });
      await admin.from("orders").update({ refund_allocation_status: "allocated", refund_wallet_debit_at: null }).eq("id", orderId);
    }
    await admin.from("paystack_refunds").update({ status: "failed", reason: paystackBody?.message ?? "Paystack refund failed", provider_payload: paystackBody, updated_at: new Date().toISOString() }).eq("id", refundId);
    return json({ error: paystackBody?.message ?? "Paystack could not start the refund" }, 502);
  }

  const paystackStatus = String(paystackBody?.data?.status ?? "pending").toLowerCase();
  const status = paystackStatus === "processed" || paystackStatus === "completed" ? "processed" : paystackStatus === "failed" ? "failed" : "pending";
  await admin.from("paystack_refunds").update({ paystack_refund_id: String(paystackBody?.data?.id ?? ""), status, provider_payload: paystackBody, processed_at: status === "processed" ? new Date().toISOString() : null, wallet_deduction_status: status === "processed" ? "deducted" : "reserved", updated_at: new Date().toISOString() }).eq("id", refundId);
  return json({ success: true, refund_id: refundId, status, message: `Refund through Paystack submitted using the allocated seller wallet amount (${serverAmount.toFixed(2)}). Refunds usually take 20 minutes to 72 hours. The money returns to the original payment account or number, and Paystack will notify the customer.` });
});
