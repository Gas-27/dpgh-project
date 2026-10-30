import { useState } from "react";
import { Loader2, Plus, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DOMAINS } from "@/config/domains";
import WalletTopupDialog from "@/components/WalletTopupDialog";

type Props = { balance: number; ownerType: string; ownerId?: string | null };

const QUICK_AMOUNTS = [20, 50, 100, 200];

type TopupConfig = { type: string; metadataKey: string; sessionKey: string; callbackUrl: string; extraSession?: [string, string] };

function resolveTopupConfig(ownerType: string, ownerId: string): TopupConfig | null {
  const origin = window.location.origin;
  if (ownerType === "agent") return { type: "wallet_topup", metadataKey: "agent_store_id", sessionKey: "pending_wallet_topup", callbackUrl: `${origin}/agent` };
  if (ownerType === "subagent") return { type: "subagent_wallet_topup", metadataKey: "subagent_store_id", sessionKey: "pending_subagent_wallet_topup", callbackUrl: `${origin}/dashboard` };
  if (ownerType === "subsubagent" || ownerType === "sub_subagent") {
    return {
      type: "subsubagent_wallet_topup",
      metadataKey: "subsubagent_store_id",
      sessionKey: "pending_subsubagent_wallet_topup",
      callbackUrl: `https://${DOMAINS.SUBAGENT_STORE}/sub-subagent-dashboard?store_id=${ownerId}`,
      extraSession: ["pending_subsubagent_topup_store_id", ownerId],
    };
  }
  return null;
}

export default function SocialBoostWalletBar({ balance, ownerType, ownerId }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const isCustomer = ownerType === "customer" || ownerType === "user";

  const startStoreTopup = async (value: number) => {
    if (!value || value < 1) {
      toast({ title: "Invalid amount", description: "Enter an amount of at least GHC 1.", variant: "destructive" });
      return;
    }
    const config = ownerId ? resolveTopupConfig(ownerType, ownerId) : null;
    if (!config || !ownerId || !user?.email) {
      toast({ title: "Top-up unavailable", description: "Please sign in again to add funds.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("initialize-payment", {
        body: {
          amount: value,
          email: user.email,
          phone: "0000000000",
          callback_url: config.callbackUrl,
          metadata: { type: config.type, [config.metadataKey]: ownerId, amount: value },
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (!res.data?.authorization_url) throw new Error("No authorization URL");
      sessionStorage.setItem(config.sessionKey, res.data.reference);
      if (config.extraSession) sessionStorage.setItem(config.extraSession[0], config.extraSession[1]);
      window.location.href = res.data.authorization_url;
    } catch (error) {
      toast({ title: "Payment error", description: error instanceof Error ? error.message : "Could not start the payment.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-400/40 bg-[#08122b] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
          <Wallet className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-blue-100/70">Wallet balance</p>
          <p className="truncate text-lg font-black text-white">GHC {Number(balance || 0).toFixed(2)}</p>
        </div>
      </div>
      <Button type="button" onClick={() => setOpen(true)} className="shrink-0 bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400">
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add funds
      </Button>

      {isCustomer ? (
        <WalletTopupDialog
          open={open}
          onOpenChange={setOpen}
          currentBalance={balance}
          walletType="normal"
          identityId={ownerId ?? undefined}
          userEmail={user?.email}
          callbackUrl={`${window.location.origin}/user-dashboard?wallet=success`}
        />
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add funds to wallet</DialogTitle>
              <DialogDescription>Current balance: GHC {Number(balance || 0).toFixed(2)}. You will be redirected to Paystack to pay.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((quick) => (
                <Button key={quick} type="button" variant="outline" disabled={loading} onClick={() => setAmount(String(quick))}>{quick}</Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-boost-topup-amount">Amount (GHC)</Label>
              <Input id="social-boost-topup-amount" type="number" inputMode="decimal" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Enter amount" />
            </div>
            <Button type="button" disabled={loading} onClick={() => void startStoreTopup(Number(amount))}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue to Paystack
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
