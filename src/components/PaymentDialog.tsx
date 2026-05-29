import { useState, useRef, useEffect } from "react";
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
import { Loader2, Phone, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import NetworkIndicator from "@/components/NetworkIndicator";
import { detectNetwork, phoneMatchesNetwork } from "@/lib/phoneUtils";

interface PaymentDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  packageName?: string;
  package?: { id: string; network: string; size_gb: number };
  network?: string;
  price: number;
  packageId?: string;
  agentStoreId?: string;
  subagentStoreId?: string;
  storeId?: string;
  phoneNumber?: string;
  onPhoneNumberChange?: (phone: string) => void;
  storeName?: string;
}

const LOCK_MINUTES = 10;
const PAYSTACK_CHARGE_PERCENT = 1.98;

// Calculate Paystack charge
function calculateTotal(price: number) {
  const charge = (price * PAYSTACK_CHARGE_PERCENT) / 100;
  return {
    charge: Math.round(charge * 100) / 100,
    total: Math.round((price + charge) * 100) / 100,
  };
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "");
}

const PaymentDialog = ({
  open,
  isOpen,
  onOpenChange,
  packageName,
  package: pkg,
  network: networkProp,
  price,
  packageId,
  agentStoreId,
  subagentStoreId,
  storeId,
  phoneNumber,
  onPhoneNumberChange,
}: PaymentDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<"phone" | "confirm">("phone");
  const [phone, setPhone] = useState(phoneNumber || "");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  // Support both prop patterns
  const isDialogOpen = open ?? isOpen ?? false;
  const displayPackageName = packageName || (pkg ? `${pkg.size_gb}GB` : "");
  const network = networkProp || pkg?.network || "";
  const actualPackageId = packageId || pkg?.id || "";
  const actualStoreId = agentStoreId || storeId || "";

  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Calculate total with Paystack charge
  const { charge, total } = calculateTotal(price);

  const isPhoneValid = (value: string) => /^\d{10}$/.test(value);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    if (digitsOnly.length <= 10) {
      setPhone(digitsOnly);
      if (onPhoneNumberChange) {
        onPhoneNumberChange(digitsOnly);
      }
    }
  };

  const handlePhoneFocus = () => {
    setTimeout(() => {
      continueButtonRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 300);
  };

  // Local storage check – prevent repeated purchases for same number within lock period
  const checkRecentPurchase = (phoneNumber: string): boolean => {
    const normalized = normalizePhone(phoneNumber);
    const lastPurchaseStr = localStorage.getItem(`last_purchase_${normalized}`);
    if (!lastPurchaseStr) return false;

    const lastPurchaseTime = parseInt(lastPurchaseStr, 10);
    const now = Date.now();
    const minutesSince = (now - lastPurchaseTime) / 1000 / 60;

    if (minutesSince < LOCK_MINUTES) {
      const remainingMinutes = Math.ceil(LOCK_MINUTES - minutesSince);
      toast({
        title: "Purchase Blocked",
        description: `You cannot make another purchase for ${phoneNumber} within ${LOCK_MINUTES} minutes. Please wait ${remainingMinutes} more minute(s).`,
        variant: "destructive",
      });
      return true;
    }
    return false;
  };

  const storePurchaseTime = (phoneNumber: string) => {
    const normalized = normalizePhone(phoneNumber);
    localStorage.setItem(`last_purchase_${normalized}`, Date.now().toString());
  };

  // ✅ No authentication required – anyone can continue
  const handleContinue = async () => {
    if (!isPhoneValid(phone)) {
      toast({
        title: "Invalid number",
        description: "Phone number must be exactly 10 digits.",
        variant: "destructive",
      });
      return;
    }

    // Check for invalid phone prefix
    const detectedNetwork = detectNetwork(phone);
    if (detectedNetwork === "unknown") {
      toast({
        title: "Invalid phone prefix",
        description: "Please check the phone number. The prefix does not match any known network (MTN, Telecel, or AirtelTigo).",
        variant: "destructive",
      });
      return;
    }

    // Check if phone matches the selected network
    const selectedNetwork = network || packageInfo?.network || "";
    if (selectedNetwork && !phoneMatchesNetwork(phone, selectedNetwork)) {
      toast({
        title: "Network mismatch",
        description: `This phone number appears to be ${detectedNetwork.toUpperCase()}, but you selected ${selectedNetwork.toUpperCase()} package`,
        variant: "destructive",
      });
      return;
    }

    setChecking(true);
    const isBlocked = checkRecentPurchase(phone);
    setChecking(false);

    if (!isBlocked) {
      setStep("confirm");
    }
  };

  const handlePay = async () => {
    // Debug logging to identify issues with specific stores
    console.log("[v0] PaymentDialog handlePay called with:", {
      actualPackageId,
      actualStoreId,
      subagentStoreId,
      price,
      network,
      phone,
      packageInfo: pkg ? { id: pkg.id, network: pkg.network, size_gb: pkg.size_gb } : null,
    });
    
    // Validate package ID before proceeding
    if (!actualPackageId) {
      console.error("[v0] Payment failed: No package ID", { packageId, pkg });
      toast({
        title: "Error",
        description: "Invalid package selected. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate price is not 0 or undefined
    if (!price || price <= 0) {
      console.error("[v0] Payment failed: Invalid price", { price });
      toast({
        title: "Error",
        description: "Package price not loaded. Please close this dialog and try again.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error("[v0] Payment timeout - request took too long");
      setLoading(false);
      toast({
        title: "Payment Timeout",
        description: "The payment request is taking too long. Please try again.",
        variant: "destructive",
      });
    }, 30000); // 30 second timeout
    
    try {
      const normalizedPhone = normalizePhone(phone.trim());
      const userEmail =
        user?.email || `${normalizedPhone.replace(/[^0-9]/g, "")}@datapluggh.com`;

      const returnPath = actualStoreId
        ? window.location.pathname
        : "/packages";

      const callbackUrl = `${window.location.origin}${returnPath}?payment=verifying`;

      console.log("[v0] Calling initialize-payment with:", {
        email: userEmail,
        amount: price,
        phone: normalizedPhone,
        callback_url: callbackUrl,
        metadata: {
          package_id: actualPackageId,
          network,
          package_name: displayPackageName,
          agent_store_id: actualStoreId || null,
          subagent_store_id: subagentStoreId || null,
        },
      });

      const { data, error } = await supabase.functions.invoke(
        "initialize-payment",
        {
          body: {
            email: userEmail,
            amount: price,
            phone: normalizedPhone,
            callback_url: callbackUrl,
            metadata: {
              package_id: actualPackageId,
              network,
              package_name: displayPackageName,
              agent_store_id: actualStoreId || null,
              subagent_store_id: subagentStoreId || null,
            },
          },
        }
      );

      console.log("[v0] initialize-payment response:", { data, error });

      clearTimeout(timeoutId);

      if (error) {
        console.error("[v0] Payment error from edge function:", error);
        throw error;
      }

      if (data?.authorization_url) {
        console.log("[v0] Redirecting to Paystack:", data.authorization_url);
        storePurchaseTime(normalizedPhone);
        // Don't set loading false - let the page redirect handle it
        // This ensures UI shows "Processing..." during redirect
        window.location.replace(data.authorization_url);
      } else {
        console.error("[v0] No authorization URL in response:", data);
        throw new Error(data?.error || "Failed to get payment URL from Paystack - no authorization URL returned");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      toast({
        title: "Payment Error",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
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

  const isContinueDisabled = checking || !isPhoneValid(phone);

  useEffect(() => {
    if (open && step === "phone") {
      setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 100);
    }
  }, [open, step]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md border-border bg-card p-0 overflow-hidden"
        style={{ zIndex: 99999 }}
      >
        <div className="flex flex-col max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                Buy {displayPackageName} {(network || "").toUpperCase()}
              </DialogTitle>
              <DialogDescription>
                Enter the phone number to receive data
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 flex-1">
            {step === "phone" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pay-phone">Recipient Phone Number (10 digits)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={phoneInputRef}
                      id="pay-phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="024XXXXXXX"
                      value={phone}
                      onChange={handlePhoneChange}
                      onFocus={handlePhoneFocus}
                      maxLength={10}
                      className={`pl-10 ${!isPhoneValid(phone) && phone.length > 0 ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter exactly 10 digits (e.g., 024XXXXXXX)
                  </p>
                  {phone.length > 0 && !isPhoneValid(phone) && (
                    <p className="text-xs text-red-500">
                      Phone number must be exactly 10 digits (currently {phone.length})
                    </p>
                  )}
                  <NetworkIndicator phone={phone} />
                </div>

                <Button
                  ref={continueButtonRef}
                  variant="hero"
                  className="w-full"
                  onClick={handleContinue}
                  disabled={isContinueDisabled}
                >
                  {checking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Checking...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold">Please confirm:</p>
                    <p>
                      The contact <span className="font-bold">{phone}</span> is correct and
                      it belongs to  <span className="font-bold">{(network || "").toUpperCase()}</span> network.
                    </p>
                    <p className="text-xs mt-1 font-medium">
                      ⚠️ Network providers rule: You cannot make another
                      purchase for the same number unless after {LOCK_MINUTES} minutes. This is to prevent the order from being seen as duplicate,
                      making the network provider deliver the order only once.
                    </p>
                    <p className="text-xs mt-2 font-medium text-red-600">
                      ⚠️ IMPORTANT: If the {LOCK_MINUTES}-minute timer has ended but you have NOT received your data yet, 
                      DO NOT buy another package until you receive the previous one. Buying again may override your pending order. 
                      Proceed at your own risk!
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Package</span>
                    <span className="font-semibold text-foreground">
                      {displayPackageName} {(network || "").toUpperCase()}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-semibold text-foreground">{phone}</span>
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
                    <span className="text-primary">GH₵ {total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-red-600 paystack-warning">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                  ⚠️ Make sure you are not owing on your contact. ⚠️
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
