import { useState } from "react";
import { ChevronDown, Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  { value: "mtn", label: "MTN only (024, 025, 053, 054, 055, 059)" },
  { value: "telecel", label: "Telecel only (020, 050)" },
];

export default function SmsNumberGenerator({ ownerType, ownerId, walletBalance, onGenerated, onBalanceChange }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
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
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-primary/20 bg-primary/5">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-left" aria-label="Toggle number generator">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Generate fresh numbers for your ad
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 px-3 pb-3">
        <p className="text-xs text-muted-foreground text-pretty">
          Our system generates accurate 10-digit Ghana MTN and Telecel numbers you can send your bulk SMS ads to.
          You pay from your wallet first, then the numbers are added to the recipients box below.
        </p>

        <div className="flex items-start gap-2 rounded-md border bg-background/60 p-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-pretty">
            Every number is brand new. We never generate a number that has ever bought data on our platform, and we never give the same number to two people.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sms-gen-package">Package</Label>
            <Select value={String(selected)} onValueChange={(value) => setSelected(Number(value))}>
              <SelectTrigger id="sms-gen-package"><SelectValue placeholder="Choose a package" /></SelectTrigger>
              <SelectContent>
                {PACKAGES.map((item) => (
                  <SelectItem key={item.count} value={String(item.count)}>{item.count} numbers - GHS {item.price}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sms-gen-network">Network</Label>
            <Select value={network} onValueChange={(value) => setNetwork(value as Network)}>
              <SelectTrigger id="sms-gen-network"><SelectValue placeholder="Choose a network" /></SelectTrigger>
              <SelectContent>
                {NETWORKS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
