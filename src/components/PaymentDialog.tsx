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
  package?: { id: string; network: string; size_gb: number; size_gb_text?: string; user_price?: number; agent_price?: number };
  network?: string;
  price: number;
  packageId?: string;
  agentStoreId?: string;
  subagentStoreId?: string;
  subsubagentStoreId?: string;
  storeId?: string;
  phoneNumber?: string;
  onPhoneNumberChange?: (phone: string) => void;
  storeName?: string;
}

const LOCK_MINUTES = 4;
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
  subsubagentStoreId,
  storeId,
  phoneNumber,
  onPhoneNumberChange,
}: PaymentDialogProps) => {
  const { user, hasPendingAgentStore } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<"phone" | "confirm">("phone");
  const [phone, setPhone] = useState(phoneNumber || "");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Support both prop patterns
  const isDialogOpen = open ?? isOpen ?? false;
  const displayPackageName = packageName || (pkg ? (pkg.network === "mtn_mashup" && pkg.size_gb_text ? pkg.size_gb_text : `${pkg.size_gb}GB`) : "");
  const packageInfo = pkg;
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

    // COMMENTED OUT: mashup packages deactivated
    // Special MTN Mashup: Only MTN numbers allowed
    const selectedNetwork = network || packageInfo?.network || "";
    if (false && selectedNetwork === "mtn_mashup" && detectedNetwork !== "mtn") {
      toast({
        title: "MTN Only",
        description: `Special MTN Mashup is only available for MTN numbers. Your number appears to be ${detectedNetwork.toUpperCase()}.`,
        variant: "destructive",
      });
      return;
    }

    // Check if phone matches the selected network (allow mtn to buy mtn_mashup, mashup, and mtn_express)
    const isValidForMTNVariant = (selectedNetwork === "mtn_mashup" || selectedNetwork === "mashup" || selectedNetwork === "mtn_express") && detectedNetwork === "mtn";
    if (selectedNetwork && selectedNetwork !== "mtn_mashup" && selectedNetwork !== "mashup" && selectedNetwork !== "mtn_express" && !isValidForMTNVariant && !phoneMatchesNetwork(phone, selectedNetwork)) {
      toast({
        title: "Network mismatch",
        description: `This phone number appears to be ${detectedNetwork.toUpperCase()}, but you selected ${selectedNetwork === "mtn_express" ? "MTN Express" : selectedNetwork.toUpperCase()} package`,
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
    // Clear any previous errors
    setPaymentError(null);
    
    // Validate package ID before proceeding
    if (!actualPackageId) {
      console.error("[v0] Payment failed: No package ID", { packageId, pkg });
      const errorMsg = "Invalid package selected. Please try again.";
      setPaymentError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    
    // For mashup network ONLY (not mtn_mashup), validate that we can find a datahubnet ID
    const selectedNetwork = network || packageInfo?.network || "";
    // Only validate datahubnet IDs for "mashup" network (which uses datahubnet)
    // MTN_MASHUP uses Dakazina provider, not datahubnet, so skip this validation for it
    if (selectedNetwork === "mashup") {
      // Use inline mapping exactly like wallet purchases
      const mashupMapping: Record<string, number> = {
        "1.7GB": 14,
        "5.1GB": 3,
        "2.6 GB + 1,077 mins": 16,
        "1077mins + 2.6GB": 16,
        "1077 mins + 2.6GB": 16,
        "1077mins+2.6GB": 16,
        "8.2GB": 17,
        "11.9GB": 18,
        "3.61GB + 1485Mins": 20,
        "1485mins + 3.61GB": 20,
        "1485 mins + 3.61GB": 20,
        "1485mins+3.61GB": 20,
        "15.3GB": 19,
      };
      const sizeGbText = packageInfo?.size_gb_text?.trim() || "";
      const datahubnetId = mashupMapping[sizeGbText];
      
      if (!datahubnetId) {
        console.error("[v0] Payment failed: Could not find datahubnet ID for mashup package", {
          network: selectedNetwork,
          packageInfo,
          sizeGbText: packageInfo?.size_gb_text,
          sizeGb: packageInfo?.size_gb,
        });
        const errorMsg = `Error: Unable to process mashup package. Package configuration missing. Please contact support.`;
        setPaymentError(errorMsg);
        toast({
          title: "Package Configuration Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }
    }
    
    // Validate price is not 0 or undefined
    if (!price || price <= 0) {
      console.error("[v0] Payment failed: Invalid price", { price });
      const errorMsg = "Package price not loaded. Please close this dialog and try again.";
      setPaymentError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error("[v0] Payment timeout - request took too long");
      setLoading(false);
      const errorMsg = "The payment request is taking too long. Please try again.";
      setPaymentError(errorMsg);
      toast({
        title: "Payment Timeout",
        description: errorMsg,
        variant: "destructive",
      });
    }, 30000); // 30 second timeout
    
    try {
      const normalizedPhone = normalizePhone(phone.trim());

      // Paystack rejects malformed / fake email addresses (e.g. bogus TLDs like
      // "@dhid.vlkcf") with "Invalid Email Address Passed", which surfaces as a
      // 400 from the edge function. Many accounts — especially test and
      // pending-agent accounts — were created with junk emails we cannot verify.
      // To guarantee the charge always initializes, we send Paystack a
      // deterministic, guaranteed-valid email built from the phone number on the
      // store's real domain. The account's real email is still preserved in the
      // metadata (user_email) for internal records and receipts.
      const digitsOnlyPhone = normalizedPhone.replace(/[^0-9]/g, "");
      const userEmail = `${digitsOnlyPhone}@dataplug.store`;
      const accountEmail = user?.email?.trim() || "";

      // If buying from a storefront (agent/subagent) stay on that page.
      // If a logged-in user buys from the public /packages page, redirect back
      // to /user-dashboard so <PaymentVerifier> can process the order exactly
      // like the UserDashboard buy-data Paystack flow does.
      // Guest (no user) stays on /packages where its own verifier handles it.
      const returnPath = actualStoreId
        ? window.location.pathname
        : user
        ? "/user-dashboard"
        : "/packages";

      const callbackUrl = `${window.location.origin}${returnPath}?payment=verifying`;

      // For mashup network ONLY, get datahubnet ID using inline mapping
      // MTN_MASHUP uses Dakazina provider, not datahubnet, so don't lookup ID for it
      let datahubnetId = undefined;
      
      if (network === "mashup" && packageInfo?.size_gb_text) {
        // Use inline mapping exactly like wallet purchases do
        const mashupMapping: Record<string, number> = {
          "1.7GB": 14,
          "5.1GB": 3,
          "2.6 GB + 1,077 mins": 16,
          "1077mins + 2.6GB": 16,
          "1077 mins + 2.6GB": 16,
          "1077mins+2.6GB": 16,
          "8.2GB": 17,
          "11.9GB": 18,
          "3.61GB + 1485Mins": 20,
          "1485mins + 3.61GB": 20,
          "1485 mins + 3.61GB": 20,
          "1485mins+3.61GB": 20,
          "15.3GB": 19,
        };
        const sizeGbText = packageInfo.size_gb_text.trim();
        datahubnetId = mashupMapping[sizeGbText];
      }

      // Mirror exactly how UserDashboard initializes payment:
      // amount = total including 1.98% Paystack fee, phone always in metadata
      const paystackTotal = Math.round((price + (price * PAYSTACK_CHARGE_PERCENT) / 100) * 100) / 100;

      const payloadBody = {
        amount: paystackTotal,
        email: userEmail,
        phone: normalizedPhone,
        callback_url: callbackUrl,
        metadata: {
          phone: normalizedPhone,
          package_id: actualPackageId,
          network,
          package_name: displayPackageName,
          size_gb: packageInfo?.size_gb ?? null,
          customer_id: user?.id || null,
          // Preserve the account's real email for records/receipts even though the
          // Paystack `email` field uses the guaranteed-valid phone-based address.
          ...(accountEmail && { user_email: accountEmail }),
          // Pending agents (store not yet approved) must be treated as regular users —
          // send null so the edge function takes the direct data_packages path.
          agent_store_id: hasPendingAgentStore ? null : (actualStoreId || null),
          subagent_store_id: subsubagentStoreId ? null : (subagentStoreId || null),
          subsubagent_store_id: subsubagentStoreId || null,
          ...(packageInfo?.size_gb_text && { size_gb_text: packageInfo.size_gb_text }),
          ...(datahubnetId && { data_package_id: datahubnetId }),
        },
      };

      const response = await supabase.functions.invoke("initialize-payment", {
        body: payloadBody,
      });

      const { data, error } = response;

      clearTimeout(timeoutId);

      if (error) {
        console.error("[v0] Payment error from edge function:", error);
        // supabase.functions.invoke wraps non-2xx responses in FunctionsHttpError.
        // The real message the edge function returned lives in error.context (a Response).
        let detailedMsg = "";
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json().catch(() => null);
            console.error("[v0] Edge function error body (json):", body);
            detailedMsg = body?.error || body?.message || "";
          } else if (ctx && typeof ctx.text === "function") {
            const text = await ctx.clone().text().catch(() => "");
            console.error("[v0] Edge function error body (text):", text);
            detailedMsg = text;
          }
        } catch (readErr) {
          console.error("[v0] Failed to read edge error body:", readErr);
        }
        const errorMsg = detailedMsg || error?.message || "Failed to initialize payment. Please check your connection and try again.";
        setPaymentError(errorMsg);
        throw new Error(errorMsg);
      }

      if (data?.authorization_url) {
        storePurchaseTime(normalizedPhone);
        // Don't set loading false - let the page redirect handle it
        // This ensures UI shows "Processing..." during redirect
        window.location.replace(data.authorization_url);
      } else {
        const errorMsg = data?.error || "Failed to get payment URL from Paystack - no authorization URL returned";
        console.error("[v0] No authorization URL in response:", data);
        setPaymentError(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errorMsg = err.message || "Something went wrong. Please try again.";
      setPaymentError(errorMsg);
      console.error("[v0] Payment error:", err);
      toast({
        title: "Payment Error",
        description: errorMsg,
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
                      ⚠️ Network providers rule: You can't purchase for the same number again until {LOCK_MINUTES} minutes have passed. This helps prevent duplicate orders and ensures your purchase is delivered correctly.
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
                    <span>GHC {price.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Paystack Charge ({PAYSTACK_CHARGE_PERCENT}%)
                    </span>
                    <span>GHC {charge.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-border my-1" />

                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span className="text-primary">GHC {total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-red-600 paystack-warning">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                  ⚠️ Make sure you are not owing on your contact. ⚠️
                </div>

                {paymentError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3">
                    <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{paymentError}</p>
                  </div>
                )}

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
                      `Pay GHC ${total.toFixed(2)}`
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
