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
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { reference },
      });

      if (error) throw error;

      if (data?.success) {
        setStatus("success");
        setMessage("Payment confirmed! Your data is being processed and will be delivered shortly.");
      } else {
        setStatus("error");
        setMessage(data?.error || "Payment verification failed.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Something went wrong verifying your payment.");
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
