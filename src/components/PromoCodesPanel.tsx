import { useMemo, useState } from "react";
import { Copy, Gift, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type PromoCode = { code: string; size: number; used: boolean };
type PromoCodesPanelProps = { walletBalance: number; adminMode?: boolean };

function makeCode(size: number) {
  return `JBG-${size}GB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default function PromoCodesPanel({ walletBalance, adminMode = false }: PromoCodesPanelProps) {
  const { toast } = useToast();
  const [size, setSize] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [claimVisible, setClaimVisible] = useState(false);
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const pricePerCode = adminMode ? 0 : size * 4.1;
  const total = pricePerCode * quantity;
  const activeCodes = useMemo(() => codes.filter((code) => !code.used), [codes]);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: "Promo code copied to clipboard." });
  };

  const generate = () => {
    if (!adminMode && total > walletBalance) {
      toast({ title: "Insufficient wallet balance", description: "Top up your wallet before generating codes." });
      return;
    }
    setCodes((current) => [...Array.from({ length: quantity }, () => ({ code: makeCode(size), size, used: false })), ...current]);
    toast({ title: "Codes generated", description: `${quantity} one-time claim code${quantity === 1 ? "" : "s"} created.` });
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-2xl font-bold"><Gift className="text-primary" /> Promo Codes</h2><p className="text-sm text-muted-foreground">Generate one-time data codes to share with customers.</p></div><Button onClick={generate}><Plus data-icon="inline-start" /> Generate Codes</Button></div>
    <div className="grid gap-4 sm:grid-cols-4">{[["Available Balance", `GH₵${walletBalance.toFixed(2)}`], ["Active Codes", activeCodes.length], ["Claimed", codes.filter((code) => code.used).length], ["Expired", 0]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary">{value}</p></CardContent></Card>)}</div>
    <Card><CardContent className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">Claim Button Visible</p><p className="text-sm text-muted-foreground">Show the free-data claim button on your storefront.</p></div><Switch checked={claimVisible} onCheckedChange={setClaimVisible} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Generate New Promo Codes</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><label className="grid gap-2 text-sm">Data Package (GB)<Input type="number" min={1} value={size} onChange={(event) => setSize(Math.max(1, Number(event.target.value) || 1))} /></label><label className="grid gap-2 text-sm">Number of Codes<Input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} /></label><div className="rounded-lg border p-3 text-sm"><p>Cost per code: GH₵{pricePerCode.toFixed(2)}</p><p className="font-bold">Total: GH₵{total.toFixed(2)}</p></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center justify-between">Your Codes<Button variant="outline" size="sm" onClick={() => copy(activeCodes.map((code) => code.code).join("\n"))} disabled={!activeCodes.length}><Copy data-icon="inline-start" /> Copy Active Codes</Button></CardTitle></CardHeader><CardContent className="space-y-2">{codes.length === 0 ? <p className="py-8 text-center text-muted-foreground">No promo codes generated yet.</p> : codes.map((item) => <div key={item.code} className="flex items-center justify-between gap-3 rounded-lg border p-3"><span className={item.used ? "font-mono text-muted-foreground line-through" : "font-mono text-primary"}>{item.code}</span><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{item.size}GB · {item.used ? "CLAIMED" : "ACTIVE"}</span><Button variant="ghost" size="icon" onClick={() => copy(item.code)} aria-label={`Copy ${item.code}`}><Copy /></Button></div></div>)}</CardContent></Card>
  </div>;
}
  
