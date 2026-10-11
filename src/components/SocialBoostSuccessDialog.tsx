import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getSocialBoostDeliveryMessage } from "@/lib/socialBoostMessages";

type Props = {
  open: boolean;
  orderNumber: string | number | null;
  serviceName?: string | null;
  onTrack: () => void;
  onNewOrder: () => void;
  onClose: () => void;
};

export default function SocialBoostSuccessDialog({ open, orderNumber, serviceName, onTrack, onNewOrder, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-sm rounded-3xl border-white/10 bg-[#16131c] p-6 text-white sm:max-w-md">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#17301f]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-emerald-400 text-emerald-400">
              <Check className="h-7 w-7" strokeWidth={3} />
            </span>
          </span>
          <DialogTitle className="mt-5 text-2xl font-bold text-white">Purchase successful</DialogTitle>
          <DialogDescription className="mt-3 text-base text-white/75">{getSocialBoostDeliveryMessage(serviceName)}</DialogDescription>
          {orderNumber ? <p className="mt-4 text-lg font-bold text-white/90">Order number: {orderNumber}</p> : null}
          <button
            type="button"
            onClick={onTrack}
            className="mt-6 h-12 w-full rounded-2xl bg-fuchsia-500 text-base font-bold text-black transition hover:bg-fuchsia-400"
          >
            Track my order
          </button>
          <button
            type="button"
            onClick={onNewOrder}
            className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-white/5 text-base font-semibold text-white transition hover:bg-white/10"
          >
            New order
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
