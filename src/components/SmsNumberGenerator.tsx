import { useState } from "react";
import { Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Network = "mixed" | "mtn" | "telecel";
type Props = {
  ownerType: "customer" | "agent" | "subagent" | "subsubagent";
  ownerId?: string;
  walletBalance: number | null;
  onGenerated: (numbers: string[]) => void;
  onBalanceChange?: (balance: number) => void;
};

const PACKAGES = [
  { count: 250, price: 3 },
  { count: 500, price: 6 },
  { count: 1000, price: 12 },
] as const;

const NETWORKS: { value: Network; label: string }[] = [
  { value: "mixed", label: "MTN + Telecel" },
  { value: "mtn", label: "MTN only" },
  { value: "telecel", label: "Telecel only" },
];

export default function SmsNumberGenerator({ ownerType, ownerId, walletBalance, onGenerated, onBalanceChange }: Props) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<number>(250);
  const [network, setNetwork] = useState<Network>("mixed");
  const [loading, setLoading] = useState(false);

  const pack = PACKAGES.find((item) => item.count === selected) ?? PACKAGES[0];
  const insufficient = walletBalance !== null && walletBalance < pack.price;

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Your sign-in session has expired. Please sign in again.");
      const { data, error } = await supabase.rpc("generate_sms_numbers", {
        p_owner_type: ownerType,
        p_owner_id: ownerId || uid,
        p_count: pack.count,
        p_network: network,
      });
      if (error) throw error;
      const result = data as { numbers?: string[]; count?: number; balance_after?: number } | null;
      const numbers = result?.numbers ?? [];
      if (!numbers.length) throw new Error("No numbers were returned. Please try again.");
      onGenerated(numbers);
      if (typeof result?.balance_after === "number") onBalanceChange?.(Number(result.balance_after));
      toast({ title: "Numbers generated", description: `${numbers.length} fresh numbers were added to your recipients. GHS ${pack.price.toFixed(2)} was deducted from your wallet.` });
    } catch (error) {
      console.error("[v0] Number generation failed:", error);
      toast({ title: "Could not generate numbers", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3" aria-labelledby="sms-number-generator-title">
      <div className="space-y-1">
        <h3 id="sms-number-generator-title" className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Generate fresh numbers for your ad
        </h3>
        <p className="text-xs text-muted-foreground text-pretty">
          Our system generates accurate, active-format Ghana MTN and Telecel numbers you can send your bulk SMS ads to.
          You pay from your wallet first, then the numbers are added to the recipients box below.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-background/60 p-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-pretty">
          Every number is brand new. We never generate a number that has ever bought data on our platform, and we never give the same number to two people.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Package</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Number package">
          {PACKAGES.map((item) => (
            <button
              key={item.count}
              type="button"
              role="radio"
              aria-checked={selected === item.count}
              onClick={() => setSelected(item.count)}
              className={`flex flex-col items-center rounded-lg border px-2 py-2 text-center transition-colors ${selected === item.count ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              <span className="text-sm font-bold">{item.count}</span>
              <span className="text-[11px] opacity-80">numbers</span>
              <span className="text-xs font-semibold">GHS {item.price}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Network</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Network">
          {NETWORKS.map((item) => (
            <Button key={item.value} type="button" size="sm" role="radio" aria-checked={network === item.value} variant={network === item.value ? "default" : "outline"} onClick={() => setNetwork(item.value)}>
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="h-4 w-4" aria-hidden="true" />
          Wallet: GHS {walletBalance === null ? "—" : walletBalance.toFixed(2)}
        </p>
        <Button type="button" onClick={() => void generate()} disabled={loading || insufficient} className="w-full sm:w-auto">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {loading ? "Generating..." : `Pay GHS ${pack.price} and generate ${pack.count}`}
        </Button>
      </div>
      {insufficient && <p className="text-xs text-destructive">Your wallet balance is too low for this package. Top up your wallet to continue.</p>}
    </section>
  );
}
