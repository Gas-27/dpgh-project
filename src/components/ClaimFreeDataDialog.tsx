import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Loader2, CheckCircle, X, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { detectNetwork, normalizePhone as normalizePhoneUtil, isValidPhone as isValidPhoneUtil, phoneMatchesNetwork } from "@/lib/phoneUtils";
import NetworkIndicator from "@/components/NetworkIndicator";

interface ClaimFreeDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: string | null;
  subagentStoreId?: string | null;
}

const FREE_REWARD_GB = 1;

// Normalize phone number to consistent format
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    return "0" + digits.slice(3);
  }
  if (digits.length === 9 && !digits.startsWith("0")) {
    return "0" + digits;
  }
  return digits;
};

const isValidPhone = (phone: string): boolean => {
  const normalized = normalizePhone(phone);
  return /^0[235]\d{8}$/.test(normalized);
};

export default function ClaimFreeDataDialog({ open, onOpenChange, storeId, subagentStoreId }: ClaimFreeDataDialogProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [validatedCode, setValidatedCode] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimOrderId, setClaimOrderId] = useState<string | null>(null);
  
  const freeRewardGb = Number(validatedCode?.size_gb ?? FREE_REWARD_GB);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhone("");
      setPromoCode("");
      setCodeError("");
      setValidatedCode(null);
      setEligibilityChecked(false);
      setCanClaim(false);
      setClaimSuccess(false);
      setClaimOrderId(null);
    }
  }, [open]);

  const checkEligibility = async () => {
    setCodeError("");
    setValidatedCode(null);
    const normalizedCode = promoCode.trim().toUpperCase();
    if (!normalizedCode) {
      setCodeError("Enter the generated promo code to continue.");
      return;
    }
    const { data: code, error: codeErrorResponse } = await supabase
      .from("promo_codes")
      .select("id, code, package_id, size_gb, network, claimed_at, expires_at, refunded_at, is_fake")
      .eq("code", normalizedCode)
      .maybeSingle();
    if (codeErrorResponse || !code) {
      setCodeError("This promo code does not exist.");
      return;
    }
    if (code.is_fake || code.claimed_at) {
      setCodeError("This promo code has already been used.");
      return;
    }
    if (code.refunded_at) {
      setCodeError("This promo code was refunded and cannot be claimed.");
      return;
    }
    if (code.expires_at && new Date(code.expires_at).getTime() <= Date.now()) {
      setCodeError("This promo code has expired.");
      return;
    }
    setValidatedCode(code);
    if (!isValidPhone(phone)) {
      toast({ title: "Invalid Phone", description: "Please enter a valid phone number", variant: "destructive" });
      return;
    }
    if (!phoneMatchesNetwork(normalizePhone(phone), String(code.network || ""))) {
      setCodeError(`This code is for ${code.network}. Enter a ${code.network} phone number.`);
      return;
    }

    setChecking(true);
    try {
      // Promo-code eligibility is independent of purchase volume. The atomic
      // claimed_at update below enforces one-time use when Claim is pressed.
      setCanClaim(true);
      setEligibilityChecked(true);
    } finally {
      setChecking(false);
    }
  };

  const handleClaim = async () => {
    if (!canClaim || !validatedCode) return;

    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(phone.trim());

      const detectedNetwork = detectNetwork(normalizedPhone);
      const claimNetwork = detectedNetwork !== "unknown" ? detectedNetwork : String(validatedCode.network || "mtn").toLowerCase();
      
      // Get a valid package_id for the free data (find package matching detected network and reward GB)
      const { data: packageData, error: packageError } = await supabase
        .from("data_packages")
        .select("id, size_gb")
        .eq("id", validatedCode.package_id)
        .eq("network", claimNetwork)
        .eq("size_gb", freeRewardGb)
        .eq("active", true)
        .single();

      if (packageError || !packageData) {
        throw new Error(`The ${validatedCode.network} package for ${freeRewardGb}GB is unavailable.`);
      }
      const packageId = packageData.id;

      // Create a pending order for admin to fulfill
      const { data: createdOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          package_id: packageId,
          customer_number: normalizedPhone,
          network: claimNetwork,
          size_gb: freeRewardGb,
          amount: 0,
          status: "paid",
          fulfillment_status: "pending",
          payment_method: "free_data_claim",
          agent_store_id: storeId || null,
          subagent_store_id: subagentStoreId || null,
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { data: claimedCode, error: codeClaimError } = await supabase
        .from("promo_codes")
        .update({ claimed_at: new Date().toISOString() })
        .eq("id", validatedCode.id)
        .is("claimed_at", null)
        .is("refunded_at", null)
        .select("id")
        .maybeSingle();
      if (codeClaimError || !claimedCode) {
        await supabase.from("orders").delete().eq("id", createdOrder.id);
        throw new Error("This promo code has already been used by someone else. Please use another code.");
      }

      const { error: claimError } = await supabase
        .from("free_data_claims")
        .insert({
          phone_number: normalizedPhone,
          gb_amount: freeRewardGb,
          total_gb_purchased: 0,
          agent_store_id: storeId || null,
          subagent_store_id: subagentStoreId || null,
        });
      if (claimError) {
        await Promise.all([
          supabase.from("promo_codes").update({ claimed_at: null }).eq("id", validatedCode.id),
          supabase.from("orders").delete().eq("id", createdOrder.id),
        ]);
        throw claimError;
      }

      setClaimOrderId(createdOrder?.id ?? null);
      setClaimSuccess(true);
      toast({ 
        title: "Congratulations!", 
        description: `You've claimed your free ${freeRewardGb}GB! It will be sent to ${normalizedPhone} shortly.` 
      });
    } catch (err: any) {
      console.error("Error claiming free data:", err);
      toast({ title: "Error", description: err.message || "Failed to claim free data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-lg max-h-[min(760px,calc(100dvh-2rem))] overflow-y-auto overscroll-contain border-green-500/30 p-4 sm:p-6" style={{ background: "linear-gradient(160deg, #001a00 0%, #003300 55%, #001a00 100%)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-center text-white flex items-center justify-center gap-2">
            <Gift className="h-6 w-6 text-green-400" /> Claim Free Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!claimSuccess ? (
            <>
              <div>
                <Label className="text-green-200 text-xs mb-1 block">Enter your generated promo code</Label>
                <Input
                  placeholder="e.g. VJK3PGE2JME3"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value.toUpperCase().replace(/\s/g, "")); setCodeError(""); setValidatedCode(null); }}
                  className="bg-white/10 text-white border-white/20 placeholder:text-white/30 tracking-widest font-mono"
                  disabled={eligibilityChecked}
                />
                {codeError && <p className="mt-1 text-xs text-red-300">{codeError}</p>}
                {validatedCode && <p className="mt-1 text-xs text-green-300">Code accepted. Continue with your phone number.</p>}
              </div>
              <div>
                <Label className="text-green-200 text-xs mb-1 block">Enter your phone number</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="0501234567"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                        setEligibilityChecked(false);
                      }}
                      className="bg-white/10 text-white border-white/20 placeholder:text-white/30 text-sm pr-8"
                      disabled={eligibilityChecked}
                    />
                    {phone && !eligibilityChecked && (
                      <button
                        type="button"
                        onClick={() => setPhone("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {eligibilityChecked ? (
                    <Button
                      onClick={() => {
                        setPhone("");
                        setEligibilityChecked(false);
                      }}
                      variant="outline"
                      className="shrink-0 text-sm px-3 bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      Clear
                    </Button>
                  ) : (
                    <Button
                      onClick={checkEligibility}
                      disabled={!isValidPhone(phone) || checking}
                      className="bg-green-600 hover:bg-green-700 shrink-0 text-sm px-3"
                    >
                      {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                    </Button>
                  )}
                </div>
                <NetworkIndicator phone={phone} />
              </div>

              {eligibilityChecked && (
                <div className="space-y-4">
                  {canClaim && (
                    <Button
                      onClick={handleClaim}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 font-bold text-lg py-6 animate-pulse"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin mr-2 h-5 w-5" />
                      ) : (
                        <Trophy className="mr-2 h-5 w-5" />
                      )}
                      Claim Your Free {freeRewardGb}GB!
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-12 w-12 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Claim Successful!</h3>
              <p className="text-green-300 text-sm">
                {freeRewardGb}GB {validatedCode?.network?.toUpperCase() || "data"} will be sent to {phone} shortly.
              </p>
              {claimOrderId && (
                <p className="mt-2 text-xs text-green-200/80">
                  Order ID: <span className="font-mono">{claimOrderId}</span>. Track this order on the site using your phone number or order ID.
                </p>
              )}
              <Button
                onClick={() => onOpenChange(false)}
                className="mt-4 bg-green-600 hover:bg-green-700"
              >
                Track Order / Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
