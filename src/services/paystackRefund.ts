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
  const { data, error } = await supabase.functions.invoke("refund-storefront-order", {
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
  if (error) throw new Error(error.message || "Unable to start Paystack refund");
  if (!data?.success) throw new Error(data?.error || "Unable to start Paystack refund");
  return data as { success: true; refund_id: string; status: "pending"; message: string };
}
