import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageName: string;
  network: string;
  price: number;
  packageId: string;
  agentStoreId?: string;
}

const PAYSTACK_CHARGE_PERCENT = 1.98;
const PAYSTACK_FLAT_FEE = 0;

function calculateTotal(price: number) {
  const charge = (price * PAYSTACK_CHARGE_PERCENT) / 100 + PAYSTACK_FLAT_FEE;
  return {
    charge: Math.round(charge * 100) / 100,
    total: Math.round((price + charge) * 100) / 100,
  };
}

const PaymentDialog = ({
  open,
  onOpenChange,
  packageName,
  network,
  price,
  packageId,
  agentStoreId,
}: PaymentDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "confirm">("phone");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { charge, total } = calculateTotal(price);

  const requiresAuth = !agentStoreId;

  const handleContinue = () => {
    if (requiresAuth && !user) {
      toast({
        title: "Login Required",
        description: "Please create an account or log in to purchase data.",
        variant: "destructive",
      });
      onOpenChange(false);
      navigate("/login");
      return;
    }

    if (phone.trim().length < 10) {
      toast({
        title: "Invalid number",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setStep("confirm");
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      const userEmail =
        user?.email ||
        `${phone.replace(/[^0-9]/g, "")}@datapluggh.com`;

      const returnPath = agentStoreId
        ? window.location.pathname
        : "/packages";

      const callbackUrl = `${window.location.origin}${returnPath}?payment=verifying`;

      const { data, error } = await supabase.functions.invoke(
        "initialize-payment",
        {
          body: {
            email: userEmail,
            amount: total,
            phone: phone.trim(),
            callback_url: callbackUrl,
            metadata: {
              package_id: packageId,
              network,
              package_name: packageName,
              agent_store_id: agentStoreId || null,
            },
          },
        }
      );

      if (error) throw error;

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error(data?.error || "Failed to initialize payment");
      }
    } catch (err: any) {
      toast({
        title: "Payment Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setStep("phone");
      setPhone("");
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Buy {packageName} {network.toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Enter the phone number to receive data
          </DialogDescription>
        </DialogHeader>

        {step === "phone" ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="pay-phone">Recipient Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="pay-phone"
                  type="tel"
                  placeholder="0XX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            <Button
              variant="hero"
              className="w-full"
              onClick={handleContinue}
            >
              Continue
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Package</span>
                <span className="font-semibold text-foreground">
                  {packageName} {network.toUpperCase()}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-semibold text-foreground">
                  {phone}
                </span>
              </div>

              <div className="border-t border-border my-1" />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data Price</span>
                <span>GH₵ {price.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Paystack Charge ({PAYSTACK_CHARGE_PERCENT}%)
                </span>
                <span>GH₵ {charge.toFixed(2)}</span>
              </div>

              <div className="border-t border-border my-1" />

              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="text-primary">
                  GH₵ {total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* 🔥 PULSING WARNING */}
            <div className="flex items-center gap-2 text-xs text-red-600 paystack-warning ">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              ⚠️🚨 Confirm the phone number is correct before proceeding. Do not place multiple orders for the same number unless the previous one is delivered.
              🚨⚠️
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("phone")}
                disabled={loading}
              >
                Back
              </Button>

              <Button
                variant="hero"
                className="flex-1"
                onClick={handlePay}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Processing...
                  </>
                ) : (
                  `Pay GH₵ ${total.toFixed(2)}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;