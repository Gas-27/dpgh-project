import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Gift, Loader2, CheckCircle, X, Trophy, Calendar, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClaimFreeDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId?: string | null;
  subagentStoreId?: string | null;
}

// Default values - can be overridden by admin settings
const DEFAULT_REQUIRED_GB = 35;
const DEFAULT_FREE_REWARD_GB = 1;

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

// Get start and end of current week (Monday to Sunday)
const getWeekBounds = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
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
  
  // Admin configurable settings
  const [requiredGb, setRequiredGb] = useState(DEFAULT_REQUIRED_GB);
  const [freeRewardGb, setFreeRewardGb] = useState(DEFAULT_FREE_REWARD_GB);
  const [telecelEnabled, setTelecelEnabled] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load admin settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("free_data_required_gb, free_data_reward_gb, free_data_telecel_enabled")
          .eq("id", 1)
          .single();
        
        if (data) {
          setRequiredGb(data.free_data_required_gb ?? DEFAULT_REQUIRED_GB);
          setFreeRewardGb(data.free_data_reward_gb ?? DEFAULT_FREE_REWARD_GB);
          setTelecelEnabled(data.free_data_telecel_enabled ?? false);
        }
      } catch (err) {
        console.log("Using default free data settings");
      } finally {
        setSettingsLoaded(true);
      }
    };
    
    if (open) loadSettings();
  }, [open]);

  // Get eligible networks based on settings
  const getEligibleNetworks = () => {
    const networks = ["mtn", "airteltigo", "airtel-tigo", "at"];
    if (telecelEnabled) {
      networks.push("telecel", "vodafone");
    }
    return networks;
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhone("");
      setEligibilityChecked(false);
      setTotalGbThisWeek(0);
      setCanClaim(false);
      setAlreadyClaimed(false);
      setClaimSuccess(false);
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
      const { weekStart } = getWeekBounds();
      const eligibleNetworks = getEligibleNetworks();

      // Check total GB purchased this week for this phone number
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("size_gb, created_at, network")
        .eq("customer_number", normalizedPhone)
        .in("status", ["completed", "paid"])
        .gte("created_at", weekStart.toISOString());

      if (ordersError) throw ordersError;

      // Only count eligible network orders
      const eligibleOrders = orders?.filter(order => {
        const network = (order.network || "").toLowerCase();
        return eligibleNetworks.some(n => network.includes(n));
      }) || [];
      
      const totalGb = eligibleOrders.reduce((sum, order) => sum + (order.size_gb || 0), 0);
      setTotalGbThisWeek(totalGb);

      // Check if user already claimed this week
      const { data: claims, error: claimsError } = await supabase
        .from("free_data_claims")
        .select("created_at")
        .eq("phone_number", normalizedPhone)
        .gte("created_at", weekStart.toISOString())
        .limit(1);

      if (claimsError && claimsError.code !== "PGRST116") {
        console.log("Claims table check:", claimsError);
      }

      const hasClaimed = claims && claims.length > 0;
      setAlreadyClaimed(hasClaimed);

      setCanClaim(totalGb >= requiredGb && !hasClaimed);
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
          gb_amount: freeRewardGb,
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
          network: "mtn", // Default to MTN for free data
          size_gb: freeRewardGb,
          amount: 0,
          status: "completed",
          fulfillment_status: "pending",
          agent_store_id: storeId || null,
          subagent_store_id: subagentStoreId || null,
          payment_method: "free_data_claim",
        });

      if (orderError) throw orderError;

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

  const progressPercent = Math.min((totalGbThisWeek / requiredGb) * 100, 100);
  const gbRemaining = Math.max(requiredGb - totalGbThisWeek, 0);
  const { weekEnd } = getWeekBounds();
  const networkText = telecelEnabled ? "MTN, AirtelTigo or Telecel" : "MTN or AirtelTigo";

  if (!settingsLoaded) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm border-green-500/30" style={{ background: "linear-gradient(160deg, #001a00 0%, #003300 55%, #001a00 100%)" }}>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-green-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-green-500/30" style={{ background: "linear-gradient(160deg, #001a00 0%, #003300 55%, #001a00 100%)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-center text-white flex items-center justify-center gap-2">
            <Gift className="h-6 w-6 text-green-400" /> Claim Free Data
          </DialogTitle>
          <DialogDescription className="text-center text-green-300 text-xs">
            Buy {requiredGb}GB of <span className="font-bold text-yellow-300">{networkText}</span> data in a week and get <span className="font-bold text-yellow-300">{freeRewardGb}GB FREE!</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info Box - Week Details */}
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-200 space-y-1">
                <p><span className="font-bold">Week runs Monday to Sunday.</span></p>
                <p>Offer expires: <span className="font-bold text-yellow-300">{weekEnd.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span></p>
                <p className="text-blue-300/70">If not claimed by Sunday, the offer resets and is lost.</p>
                {!telecelEnabled && <p className="text-orange-300/80">Telecel purchases do not count (no {freeRewardGb}GB available).</p>}
              </div>
            </div>
          </div>

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
                      <span>{networkText} this week</span>
                      <span className="font-bold">{totalGbThisWeek}GB / {requiredGb}GB</span>
                    </div>
                    <Progress value={progressPercent} className="h-3 bg-gray-700" />
                    {totalGbThisWeek < requiredGb && (
                      <p className="text-xs text-green-400 mt-2 text-center">
                        Buy <span className="font-bold">{gbRemaining}GB</span> more {networkText} to unlock your free data!
                      </p>
                    )}
                    {totalGbThisWeek >= requiredGb && !alreadyClaimed && (
                      <p className="text-xs text-yellow-400 mt-2 text-center font-bold animate-pulse">
                        You&apos;ve reached {requiredGb}GB! Claim your free data NOW before Sunday!
                      </p>
                    )}
                  </div>

                  {/* Status Messages */}
                  {alreadyClaimed && (
                    <div className="bg-orange-900/40 border border-orange-500/40 rounded-lg p-3 text-center">
                      <p className="text-orange-300 text-sm font-bold">Already Claimed This Week</p>
                      <p className="text-orange-200/70 text-xs mt-1">
                        You&apos;ve already claimed your free data this week. Come back next Monday!
                      </p>
                    </div>
                  )}

                  {/* Claim Button - Only visible and enabled when requirements are met */}
                  {canClaim ? (
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
                  ) : !alreadyClaimed && totalGbThisWeek < requiredGb ? (
                    <Button
                      disabled
                      className="w-full bg-gray-700 text-gray-400 font-bold text-lg py-6 cursor-not-allowed opacity-50"
                    >
                      <Trophy className="mr-2 h-5 w-5" />
                      Buy {gbRemaining}GB More to Claim
                    </Button>
                  ) : null}
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
                Your free {freeRewardGb}GB will be sent to your number shortly.
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
