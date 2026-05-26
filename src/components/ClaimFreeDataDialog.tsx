import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Gift, Loader2, CheckCircle, X, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClaimFreeDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: string | null;
  subagentStoreId?: string | null;
}

const REQUIRED_GB = 30;
const FREE_REWARD_GB = 1;
const CLAIM_COOLDOWN_DAYS = 7;

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
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [totalGbThisWeek, setTotalGbThisWeek] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [nextClaimDate, setNextClaimDate] = useState<Date | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhone("");
      setEligibilityChecked(false);
      setTotalGbThisWeek(0);
      setCanClaim(false);
      setAlreadyClaimed(false);
      setClaimSuccess(false);
      setNextClaimDate(null);
    }
  }, [open]);

  const checkEligibility = async () => {
    if (!isValidPhone(phone)) {
      toast({ title: "Invalid Phone", description: "Please enter a valid phone number", variant: "destructive" });
      return;
    }

    setChecking(true);
    try {
      const normalizedPhone = normalizePhone(phone.trim());
      
      // Get the start of the current week (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust so Monday is start
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - diff);
      weekStart.setHours(0, 0, 0, 0);

      // Check total GB purchased this week for this phone number
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("size_gb, created_at")
        .eq("customer_number", normalizedPhone)
        .in("status", ["completed", "paid"])
        .gte("created_at", weekStart.toISOString());

      if (ordersError) throw ordersError;

      const totalGb = orders?.reduce((sum, order) => sum + (order.size_gb || 0), 0) || 0;
      setTotalGbThisWeek(totalGb);

      // Check if user already claimed this week
      const { data: claims, error: claimsError } = await supabase
        .from("free_data_claims")
        .select("created_at")
        .eq("phone_number", normalizedPhone)
        .gte("created_at", weekStart.toISOString())
        .limit(1);

      if (claimsError && claimsError.code !== "PGRST116") {
        // Table might not exist yet, that's ok
        console.log("Claims table check:", claimsError);
      }

      const hasClaimed = claims && claims.length > 0;
      setAlreadyClaimed(hasClaimed);

      if (hasClaimed && claims[0]) {
        // Calculate next claim date (7 days from last claim)
        const lastClaim = new Date(claims[0].created_at);
        const nextClaim = new Date(lastClaim);
        nextClaim.setDate(nextClaim.getDate() + CLAIM_COOLDOWN_DAYS);
        setNextClaimDate(nextClaim);
      }

      setCanClaim(totalGb >= REQUIRED_GB && !hasClaimed);
      setEligibilityChecked(true);
    } catch (err: any) {
      console.error("Error checking eligibility:", err);
      toast({ title: "Error", description: "Failed to check eligibility. Please try again.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const handleClaim = async () => {
    if (!canClaim) return;

    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(phone.trim());

      // Record the claim
      const { error: claimError } = await supabase
        .from("free_data_claims")
        .insert({
          phone_number: normalizedPhone,
          gb_amount: FREE_REWARD_GB,
          total_gb_purchased: totalGbThisWeek,
          agent_store_id: storeId || null,
          subagent_store_id: subagentStoreId || null,
        });

      if (claimError) throw claimError;

      // Create a pending order for admin to fulfill
      const { error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_number: normalizedPhone,
          network: "mtn", // Default network for free data
          size_gb: FREE_REWARD_GB,
          amount: 0,
          status: "completed",
          fulfillment_status: "pending",
          agent_store_id: storeId || null,
          subagent_store_id: subagentStoreId || null,
          payment_reference: `FREE_DATA_CLAIM_${Date.now()}`,
          selling_price: 0,
          base_price: 0,
          profit: 0,
        });

      if (orderError) throw orderError;

      setClaimSuccess(true);
      toast({ 
        title: "Congratulations!", 
        description: `You've claimed your free ${FREE_REWARD_GB}GB! It will be sent to ${normalizedPhone} shortly.` 
      });
    } catch (err: any) {
      console.error("Error claiming free data:", err);
      toast({ title: "Error", description: err.message || "Failed to claim free data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = Math.min((totalGbThisWeek / REQUIRED_GB) * 100, 100);
  const gbRemaining = Math.max(REQUIRED_GB - totalGbThisWeek, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-green-500/30" style={{ background: "linear-gradient(160deg, #001a00 0%, #003300 55%, #001a00 100%)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-center text-white flex items-center justify-center gap-2">
            <Gift className="h-6 w-6 text-green-400" /> Claim Free Data
          </DialogTitle>
          <DialogDescription className="text-center text-green-300 text-xs">
            Buy {REQUIRED_GB}GB in a week and get {FREE_REWARD_GB}GB FREE!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!claimSuccess ? (
            <>
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
              </div>

              {eligibilityChecked && (
                <div className="space-y-4">
                  {/* Progress Section */}
                  <div className="bg-black/30 rounded-lg p-4 border border-green-500/20">
                    <div className="flex justify-between text-xs text-green-300 mb-2">
                      <span>Your progress this week</span>
                      <span className="font-bold">{totalGbThisWeek}GB / {REQUIRED_GB}GB</span>
                    </div>
                    <Progress value={progressPercent} className="h-3 bg-gray-700" />
                    {totalGbThisWeek < REQUIRED_GB && (
                      <p className="text-xs text-green-400 mt-2 text-center">
                        Buy <span className="font-bold">{gbRemaining}GB</span> more to unlock your free data!
                      </p>
                    )}
                    {totalGbThisWeek >= REQUIRED_GB && !alreadyClaimed && (
                      <p className="text-xs text-yellow-400 mt-2 text-center font-bold">
                        You&apos;ve reached {REQUIRED_GB}GB! Claim your free data now!
                      </p>
                    )}
                  </div>

                  {/* Status Messages */}
                  {alreadyClaimed && (
                    <div className="bg-orange-900/40 border border-orange-500/40 rounded-lg p-3 text-center">
                      <p className="text-orange-300 text-sm font-bold">Already Claimed This Week</p>
                      <p className="text-orange-200/70 text-xs mt-1">
                        You&apos;ve already claimed your free data this week.
                        {nextClaimDate && (
                          <> Next claim available: <span className="font-bold">{nextClaimDate.toLocaleDateString()}</span></>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Claim Button */}
                  {canClaim && (
                    <Button
                      onClick={handleClaim}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 font-bold text-lg py-6"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin mr-2 h-5 w-5" />
                      ) : (
                        <Trophy className="mr-2 h-5 w-5" />
                      )}
                      Claim Your Free {FREE_REWARD_GB}GB!
                    </Button>
                  )}

                  {!canClaim && !alreadyClaimed && totalGbThisWeek < REQUIRED_GB && (
                    <div className="text-center">
                      <p className="text-gray-400 text-sm">Keep buying to unlock your reward!</p>
                    </div>
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
                Your free {FREE_REWARD_GB}GB will be sent to your number shortly.
              </p>
              <Button
                onClick={() => onOpenChange(false)}
                className="mt-4 bg-green-600 hover:bg-green-700"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
