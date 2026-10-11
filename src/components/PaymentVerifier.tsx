import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SocialBoostSuccessDialog from "@/components/SocialBoostSuccessDialog";
import {
  TRACK_ORDER_EVENT,
  TRACK_ORDER_STORAGE_KEY,
  isSocialBoostReference,
  socialBoostOrderNumberFromReference,
  socialBoostServiceLabel,
} from "@/lib/socialBoostMessages";

const PaymentVerifier = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");
  const [open, setOpen] = useState(false);
  const [socialBoost, setSocialBoost] = useState<{ orderNumber: string | number | null; serviceName: string | null } | null>(null);

  useEffect(() => {
    const payment = searchParams.get("payment");
    const reference = searchParams.get("reference") || searchParams.get("trxref");

    if (payment === "verifying" && reference) {
      setOpen(true);
      if (isSocialBoostReference(reference)) {
        void verifySocialBoost(reference);
      } else {
        verifyPayment(reference);
      }
    }
  }, [searchParams]);

  const verifySocialBoost = async (reference: string) => {
    const derivedOrderNumber = socialBoostOrderNumberFromReference(reference);
    const findOrder = async () => {
      if (!derivedOrderNumber) return null;
      const { data, error } = await (supabase as any).rpc("get_public_social_boost_order", { p_order_number: String(derivedOrderNumber) });
      if (error) return null;
      return Array.isArray(data) ? data[0] ?? null : data ?? null;
    };
    const showOrder = (order: any) => {
      setSocialBoost({
        orderNumber: order?.order_number ?? derivedOrderNumber,
        serviceName: socialBoostServiceLabel(order?.service) || null,
      });
      setStatus("success");
    };

    try {
      // The webhook creates the order after Paystack redirects, so wait for it.
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const order = await findOrder();
        if (order) return showOrder(order);
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }

      const { data, error } = await supabase.functions.invoke("verify-payment", { body: { reference } });
      if (!error && (data?.success || data?.payment_confirmed)) {
        const order = await findOrder();
        return showOrder(order);
      }
    } catch (err) {
      console.log("[v0] Social Boost verification pending:", err);
    }

    setStatus("error");
    setMessage(
      derivedOrderNumber
        ? `Your payment is still being confirmed. Your order number will be ${derivedOrderNumber}. Please check Track Order shortly.`
        : "Payment is still processing. Please check your orders shortly.",
    );
  };

  const verifyPayment = async (reference: string) => {
    const orderExists = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, paystack_reference, status, fulfillment_status")
        .eq("paystack_reference", reference)
        .limit(1)
        .maybeSingle();

      return !error && Boolean(data?.id);
    };

    const showSuccess = () => {
      setStatus("success");
      setMessage("Payment confirmed! Your data is being processed and will be delivered shortly.");
    };

    try {
      // The webhook may have already created the order. Prefer that durable result
      // so a slow or already-processed verification request cannot block the user.
      if (await orderExists()) {
        showSuccess();
        return;
      }

      const verification = supabase.functions.invoke("verify-payment", { body: { reference } });
      const timeout = new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("Verification is still processing")), 5000),
      );
      const result = await Promise.race([verification, timeout]);
      const { data, error } = result;

      if (!error && (data?.success || data?.payment_confirmed)) {
        showSuccess();
        return;
      }

      // Do not show a false failure when the webhook/verification is still writing.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        if (await orderExists()) {
          showSuccess();
          return;
        }
      }

      setStatus("error");
      setMessage(error?.message || data?.error || "Payment verification is still processing. Please check your orders shortly.");
    } catch (err: any) {
      // A timeout or non-2xx response is not proof that payment failed. The
      // webhook may still have confirmed the payment and created the order.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (await orderExists()) {
          showSuccess();
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      setStatus("error");
      setMessage("Payment is still processing. Please check your orders shortly.");
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Clean up URL params
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("payment");
    newParams.delete("reference");
    newParams.delete("trxref");
    setSearchParams(newParams, { replace: true });
  };

  const handleTrack = () => {
    const orderNumber = socialBoost?.orderNumber;
    if (orderNumber) {
      window.sessionStorage.setItem(TRACK_ORDER_STORAGE_KEY, String(orderNumber));
      window.dispatchEvent(new CustomEvent(TRACK_ORDER_EVENT, { detail: String(orderNumber) }));
    }
    handleClose();
    window.setTimeout(() => document.getElementById("social-boost-track-order")?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
  };

  const handleNewOrder = () => {
    handleClose();
    window.setTimeout(() => document.getElementById("social-boost-order-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  if (!open) return null;

  if (socialBoost && status === "success") {
    return (
      <SocialBoostSuccessDialog
        open
        orderNumber={socialBoost.orderNumber}
        serviceName={socialBoost.serviceName}
        onTrack={handleTrack}
        onNewOrder={handleNewOrder}
        onClose={handleClose}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {status === "verifying" ? "Verifying Payment" : status === "success" ? "Payment Successful!" : "Payment Issue"}
          </DialogTitle>
          <DialogDescription>
            {status === "verifying" ? "Please wait while we confirm your payment..." : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          {status === "verifying" && (
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          )}
          {status === "success" && (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          )}
          {status === "error" && (
            <AlertCircle className="h-12 w-12 text-destructive" />
          )}
          <p className="text-center text-foreground">{message}</p>
          {status !== "verifying" && (
            <Button variant="hero" onClick={handleClose}>
              Continue
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentVerifier;
