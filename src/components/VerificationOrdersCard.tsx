import { Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

type VerificationOrdersCardProps = {
  orders: any[];
  onView: () => void;
};

const verificationStatuses = new Set(["number verifying", "number_verifying", "waiting"]);

export function isVerificationOrder(order: any) {
  const status = String(order.status ?? order.fulfillment_status ?? order.order_status ?? "").toLowerCase().replace(/[-_]/g, " ");
  return verificationStatuses.has(status) && Boolean(order.customer_number);
}

export function VerificationOrdersCard({ orders, onView }: VerificationOrdersCardProps) {
  const verificationOrders = orders.filter(isVerificationOrder);
  if (!verificationOrders.length) return null;
  const total = verificationOrders.reduce((sum, order) => sum + Number(order.amount ?? order.selling_price ?? 0), 0);

  return (
    <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-lg bg-amber-100 p-2 text-amber-700"><Clock className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="font-semibold">{verificationOrders.length} {verificationOrders.length === 1 ? "order" : "orders"} on hold — being verified</p>
          <p className="text-xs text-amber-800">GHC {total.toFixed(2)} total · no money is lost</p>
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" className="shrink-0 text-amber-900 hover:bg-amber-100" onClick={onView}>
        View <Eye className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

export const verificationRefundMessage = "What you need to do: Nothing — no need to re-order or re-pay. Just wait; it delivers once it’s cleared. If you’d rather have a refund, contact support. ⚠️ Note: taking the refund removes this number from the batch we re-submit, so it won’t be delivered later.";
