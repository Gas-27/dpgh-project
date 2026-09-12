import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { StorefrontRefundRecord } from "@/hooks/useStorefrontRefunds";

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: typeof Clock }> = {
  pending: { label: "Refund Pending", badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
  processing: { label: "Refund Processing", badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Loader2 },
  processed: { label: "Refund Completed", badgeClass: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  completed: { label: "Refund Completed", badgeClass: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  failed: { label: "Refund Failed", badgeClass: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
};

/**
 * Clickable status badge for a storefront (direct Paystack) refund. Shows the live
 * pending / processing / completed / failed state and opens a detail dialog with the
 * Paystack reference, amount, and exactly when the refund was initiated and completed.
 */
export function RefundStatusCell({ refund }: { refund: StorefrontRefundRecord }) {
  const [open, setOpen] = useState(false);
  const config = STATUS_CONFIG[refund.status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
        <Badge className={`text-xs whitespace-nowrap ${config.badgeClass}`}>
          <Icon className={`w-3 h-3 mr-1 ${refund.status === "processing" ? "animate-spin" : ""}`} />
          {config.label}
        </Badge>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Paystack Refund Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className={`text-xs ${config.badgeClass}`}>
                <Icon className={`w-3 h-3 mr-1 ${refund.status === "processing" ? "animate-spin" : ""}`} />
                {config.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">GHC {Number(refund.amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground shrink-0">Paystack Reference</span>
              <span className="font-mono text-xs truncate">{refund.paystack_reference || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Initiated</span>
              <span>{refund.created_at ? new Date(refund.created_at).toLocaleString() : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span className={refund.processed_at ? "" : "text-muted-foreground italic"}>
                {refund.processed_at ? new Date(refund.processed_at).toLocaleString() : "Not yet completed"}
              </span>
            </div>
            {refund.reason && (
              <div>
                <span className="text-muted-foreground block mb-1">Reason</span>
                <p className="text-xs text-foreground/80">{refund.reason}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Refunds take 30 minutes to 7 days for Paystack to send back to the customer number used for the
              purchase.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
