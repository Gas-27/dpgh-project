import { useState } from "react";
import { Clock, Eye, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelWaitingOrder, type WaitingOrderActorRole } from "@/services/waitingOrderCancellation";
import { toast } from "sonner";

type VerificationOrdersCardProps = {
  orders: any[];
  onView: () => void;
  actorRole?: WaitingOrderActorRole;
  onCancelled?: () => void;
};

const verificationStatuses = new Set(["number verifying", "number_verifying", "waiting"]);

export function isVerificationOrder(order: any) {
  const status = String(order.status ?? order.fulfillment_status ?? order.order_status ?? "").toLowerCase().replace(/[-_]/g, " ");
  return verificationStatuses.has(status) && Boolean(order.customer_number);
}

export function VerificationOrdersCard({ orders, onView, actorRole, onCancelled }: VerificationOrdersCardProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const verificationOrders = orders.filter(isVerificationOrder);
  if (!verificationOrders.length) return null;
  const total = verificationOrders.reduce((sum, order) => sum + Number(order.amount ?? order.selling_price ?? 0), 0);
  const eligibleOrders = verificationOrders.filter((order) => {
    const network = String(order.network ?? "").toLowerCase().replace(/_/g, " ");
    return (network === "mtn" || network === "mtn express") && Date.now() - new Date(order.created_at).getTime() >= 48 * 60 * 60 * 1000;
  });

  const handleCancel = async (order: any) => {
    if (!actorRole || cancellingId) return;
    const confirmed = window.confirm("Cancel this waiting order? It will be removed from the MTN approval batch, the number will not be verified, and the amount will be refunded to the store wallet. The customer cannot purchase again with this number for 2 days.");
    if (!confirmed) return;
    setCancellingId(String(order.id));
    try {
      await cancelWaitingOrder(String(order.id), actorRole);
      toast.success("Order cancelled and refunded to the wallet");
      onCancelled?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel order");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-lg bg-amber-100 p-2 text-amber-700"><Clock className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="font-semibold">{verificationOrders.length} {verificationOrders.length === 1 ? "order" : "orders"} on hold — being verified</p>
          <p className="text-xs text-amber-800">GHC {total.toFixed(2)} total · wait 48 hours before cancellation</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" className="text-amber-900 hover:bg-amber-100" onClick={onView}>View <Eye className="ml-1 h-4 w-4" /></Button>
        {eligibleOrders.map((order) => <Button key={order.id} type="button" variant="outline" size="sm" className="border-amber-700 text-amber-900" disabled={Boolean(cancellingId)} onClick={() => handleCancel(order)}><Ban className="mr-1 h-4 w-4" />{cancellingId === String(order.id) ? "Cancelling…" : `Cancel #${String(order.id).slice(0, 8)}`}</Button>)}
      </div>
    </div>
  );
}

export const verificationRefundMessage = "What you need to do: Nothing — no need to re-order or re-pay. Just wait; it delivers once it’s cleared. If you’d rather have a refund, contact support. ⚠️ Note: taking the refund removes this number from the batch we re-submit, so it won’t be delivered later.";
