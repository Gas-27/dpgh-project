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

const PaymentVerifier = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const payment = searchParams.get("payment");
    const reference = searchParams.get("reference") || searchParams.get("trxref");

    if (payment === "verifying" && reference) {
      setOpen(true);
      verifyPayment(reference);
    }
  }, [searchParams]);

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

  if (!open) return null;

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
