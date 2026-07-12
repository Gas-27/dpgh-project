import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeWalletTopup, redirectToPaystack } from "@/lib/walletTopup";

interface WalletTopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  walletType: "api" | "normal";
  // Either api_key OR identity_id must be provided
  apiKey?: string;
  identityId?: string;
  callbackUrl: string;
}

const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function WalletTopupDialog({
  open,
  onOpenChange,
  currentBalance,
  walletType,
  apiKey,
  identityId,
  callbackUrl,
}: WalletTopupDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTopup = async (topupAmount: number) => {
    if (!topupAmount || topupAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Validate that at least one identifier is provided
    if (!apiKey && !identityId) {
      toast({
        title: "Error",
        description: "Unable to process request. Missing required information.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await initializeWalletTopup({
        ...(apiKey && { api_key: apiKey }),
        ...(identityId && { identity_id: identityId }),
        amount: topupAmount,
        callback_url: callbackUrl,
      });

      if (!response.success || !response.data?.authorization_url) {
        toast({
          title: "Payment Initialization Failed",
          description: response.error || response.message,
          variant: "destructive",
        });
        return;
      }

      // Show confirmation with fee breakdown
      toast({
        title: "Payment Initialized",
        description: `Amount: GHC${response.data.base_amount.toFixed(2)} + GHC${response.data.fee_amount.toFixed(2)} fee = GHC${response.data.amount.toFixed(2)}`,
      });

      // Redirect to Paystack
      redirectToPaystack(response.data.authorization_url);
    } catch (error) {
      console.error("[v0] Error processing wallet topup:", error);
      toast({
        title: "Error",
        description: "Failed to process top-up. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    const topupAmount = parseFloat(amount);
    handleTopup(topupAmount);
  };

  const handleQuickAmount = (quickAmount: number) => {
    handleTopup(quickAmount);
  };

  const handleClose = () => {
    setAmount("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Top Up {walletType === "api" ? "API" : "Normal"} Wallet
          </DialogTitle>
          <DialogDescription>
            Add funds to your {walletType === "api" ? "API" : "normal"} wallet using Paystack
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Balance Display */}
          <div className="bg-muted p-4 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-3xl font-display font-bold text-primary">
              GHC {currentBalance.toFixed(2)}
            </p>
          </div>

          {/* Amount Input */}
          <div className="space-y-3">
            <Label htmlFor="topup-amount">Amount (GHC)</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                  GHC
                </span>
                <Input
                  id="topup-amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="pl-12"
                  disabled={loading}
                />
              </div>
              <Button
                onClick={handleProceed}
                disabled={!amount || parseFloat(amount) <= 0 || loading}
                className="px-6"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Proceed
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum amount: GHC 1.00
            </p>
          </div>

          {/* Quick Amount Buttons */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Quick Amounts</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAmount(quickAmount)}
                  disabled={loading}
                >
                  GHC {quickAmount}
                </Button>
              ))}
            </div>
          </div>

          {/* Fee Information */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-400">Processing Fee Applied</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A small processing fee will be added to your amount at checkout. You'll see the total before confirming payment.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
