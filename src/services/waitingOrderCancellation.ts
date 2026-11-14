import { supabase } from "@/integrations/supabase/client";

export type WaitingOrderActorRole = "agent" | "user" | "customer";

export async function cancelWaitingOrder(orderId: string, actorRole: WaitingOrderActorRole, reason?: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const actorUserId = sessionData.session?.user?.id;
  if (!actorUserId) throw new Error("Your session has expired. Please sign in again.");

  const { data, error } = await supabase.rpc("cancel_waiting_order", {
    p_order_id: orderId,
    p_actor_user_id: actorUserId,
    p_actor_role: actorRole,
    p_reason: reason || "Waiting order cancelled after 3 days",
  });
  if (error) throw new Error(error.message || "Unable to cancel this order");
  if (!data?.success) throw new Error(data?.error || "Unable to cancel this order");
  return data as { success: true; order_id: string; amount: number; store_id: string };
}
