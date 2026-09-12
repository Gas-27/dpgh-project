import { supabase } from "@/integrations/supabase/client";

export interface StorefrontRefundInput {
  orderId: string;
  actorRole: "agent" | "subagent" | "sub_subagent";
  storefrontId: string;
  amount: number;
  paystackReference: string;
  phone?: string;
  reason?: string;
}

export async function refundStorefrontOrder(input: StorefrontRefundInput) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Your session has expired. Please sign in again before requesting a refund.");

  const { data: payload, error } = await supabase.functions.invoke("refund-storefront-order", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      order_id: input.orderId,
      actor_role: input.actorRole,
      storefront_id: input.storefrontId,
      amount: input.amount,
      paystack_reference: input.paystackReference,
      phone: input.phone,
      reason: input.reason,
    },
  });
  if (error) {
    const context = (error as any).context;
    const details = context ? await context.json().catch(() => null) : null;
    throw new Error(details?.error || details?.message || error.message || "Refund request failed");
  }
  if (!payload?.success) throw new Error(payload?.error || "Unable to start Paystack refund");
  return payload as { success: true; refund_id: string; status: "pending"; message: string };
}
