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

  const requestBody = {
    order_id: input.orderId,
    actor_role: input.actorRole,
    storefront_id: input.storefrontId,
    amount: input.amount,
    paystack_reference: input.paystackReference,
    phone: input.phone,
    reason: input.reason,
  };
  const invokeRefund = (token: string) => supabase.functions.invoke("refund-storefront-order", {
    headers: { Authorization: `Bearer ${token}` },
    body: requestBody,
  });

  let { data: payload, error } = await invokeRefund(accessToken ?? "");
  if (error?.context?.status === 401 && accessToken) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    const refreshedToken = refreshed.session?.access_token;
    if (!refreshError && refreshedToken) {
      ({ data: payload, error } = await invokeRefund(refreshedToken));
    }
  }
  if (error?.context?.status === 401) {
    const context = error.context;
    const details = context ? await context.clone().json().catch(() => null) : null;
    throw new Error(details?.error || "Refund authorization failed. Please retry the refund.");
  }
  if (error) {
    const context = (error as any).context;
    const details = context ? await context.json().catch(() => null) : null;
    throw new Error(details?.error || details?.message || error.message || "Refund request failed");
  }
  if (!payload?.success) throw new Error(payload?.error || "Unable to start Paystack refund");
  return payload as { success: true; refund_id: string; status: "pending"; message: "Refund through Paystack submitted. Refunds usually take 20 minutes to 72 hours. The money will return to the account or number used for the purchase, and Paystack will notify the customer." };
}
