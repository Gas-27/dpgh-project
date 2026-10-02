import { useEffect, useMemo, useState } from "react";
import { Copy, Gift, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type DataPackage = { id: string; network: string; size_gb: number; agent_price: number; price: number; active: boolean };
type PromoCode = { code: string; size: number; network: string; used: boolean };
type PromoCodesPanelProps = { walletBalance: number; adminMode?: boolean };

const networkLabels = ["MTN", "Telecel", "AirtelTigo"];
const expiryOptions = ["1 hour", "6 hours", "24 hours", "7 days"];

function makeCode(prefix: string, size: number) {
  return `${prefix || "JBG"}-${size}GB-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export default function PromoCodesPanel({ walletBalance, adminMode = false }: PromoCodesPanelProps) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [network, setNetwork] = useState("MTN");
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [expiry, setExpiry] = useState("1 hour");
  const [prefix, setPrefix] = useState("");
  const [payFrom, setPayFrom] = useState<"wallet" | "profit">("wallet");
  const [claimVisible, setClaimVisible] = useState(false);
  const [codes, setCodes] = useState<PromoCode[]>([]);

  useEffect(() => {
    let active = true;
    supabase.from("data_packages").select("id, network, size_gb, agent_price, price, active").eq("active", true).order("size_gb").then(({ data }) => {
      if (!active) return;
      const rows = (data ?? []) as DataPackage[];
      setPackages(rows);
      const first = rows.find((item) => item.network.toLowerCase() === "mtn" ) ?? rows[0];
      if (first) { setNetwork(first.network); setSelectedId(first.id); }
    });
    return () => { active = false; };
  }, []);

  const networkPackages = useMemo(() => packages.filter((item) => item.network.toLowerCase() === network.toLowerCase()), [network, packages]);
  const selected = packages.find((item) => item.id === selectedId) ?? networkPackages[0];
  const pricePerCode = adminMode ? 0 : Number(selected?.agent_price ?? selected?.price ?? 0);
  const total = pricePerCode * quantity;
  const activeCodes = codes.filter((code) => !code.used);

  const chooseNetwork = (value: string) => {
    setNetwork(value);
    const first = packages.find((item) => item.network.toLowerCase() === value.toLowerCase());
    setSelectedId(first?.id ?? "");
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: "Promo code copied to clipboard." });
  };

  const generate = () => {
    if (!selected) return toast({ title: "Choose a data package", variant: "destructive" });
    if (!adminMode && total > walletBalance) return toast({ title: "Insufficient wallet balance", description: "Top up your wallet before generating codes.", variant: "destructive" });
    const created = Array.from({ length: quantity }, () => ({ code: makeCode(prefix, selected.size_gb), size: selected.size_gb, network: selected.network, used: false }));
    setCodes((current) => [...created, ...current]);
    toast({ title: "Codes generated", description: `${quantity} ${selected.size_gb}GB ${selected.network} codes created.` });
  };

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-2xl font-bold"><Gift className="text-primary" /> Promo Codes</h2><p className="text-sm text-muted-foreground">Buy data in bulk and share one-time claim codes with customers.</p></div><Button onClick={generate}><Plus data-icon="inline-start" /> Generate Codes</Button></div>
    <div className="grid gap-4 sm:grid-cols-4">{[["Available Balance", `GH₵${walletBalance.toFixed(2)}`], ["Active Codes", activeCodes.length], ["Claimed", codes.filter((code) => code.used).length], ["Expired", 0]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary">{value}</p></CardContent></Card>)}</div>
    <Card><CardContent className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">Claim Button Visible</p><p className="text-sm text-muted-foreground">Customers can see the FREE DATA claim button on your storefront.</p></div><Switch checked={claimVisible} onCheckedChange={setClaimVisible} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Generate New Promo Codes</CardTitle></CardHeader><CardContent className="flex flex-col gap-5">
      <div className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Network</span><div className="grid gap-2 sm:grid-cols-3">{networkLabels.map((item) => <Button key={item} type="button" variant={network.toLowerCase() === item.toLowerCase() ? "default" : "secondary"} onClick={() => chooseNetwork(item)}>{item}</Button>)}</div></div>
      <div className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Data Package (GB) — agent price</span><div className="flex flex-wrap gap-2">{networkPackages.map((item) => <Button key={item.id} type="button" variant={selected?.id === item.id ? "default" : "secondary"} onClick={() => setSelectedId(item.id)}>{item.size_gb}GB (GH₵{Number(item.agent_price ?? item.price).toFixed(2)})</Button>)}</div></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm">Number of Codes<Input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} /></label><label className="flex flex-col gap-2 text-sm">Expires After<select className="h-10 rounded-md border bg-background px-3" value={expiry} onChange={(event) => setExpiry(event.target.value)}>{expiryOptions.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <div className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Pay From</span><div className="grid gap-2 sm:grid-cols-2"><Button type="button" variant={payFrom === "wallet" ? "default" : "secondary"} onClick={() => setPayFrom("wallet")}>Account Balance</Button><Button type="button" variant={payFrom === "profit" ? "default" : "secondary"} onClick={() => setPayFrom("profit")}>Profit Balance</Button></div></div>
      <label className="flex flex-col gap-2 text-sm">Custom Prefix (optional)<Input value={prefix} onChange={(event) => setPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} placeholder="e.g. FREE, XMAS" /></label>
      <div className="rounded-lg border border-primary/40 p-4 text-sm"><div className="flex justify-between"><span>Cost per code:</span><strong>GH₵{pricePerCode.toFixed(2)}</strong></div><div className="flex justify-between"><span>Number of codes:</span><strong>{quantity}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-base"><strong>Total Cost:</strong><strong className="text-primary">GH₵{total.toFixed(2)}</strong></div></div>
      <Button type="button" onClick={generate} disabled={!selected || (!adminMode && total > walletBalance)} variant="secondary">Generate {quantity} Codes for GH₵{total.toFixed(2)}</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center justify-between">Your Codes<Button variant="outline" size="sm" onClick={() => copy(activeCodes.map((code) => code.code).join("\n"))} disabled={!activeCodes.length}><Copy data-icon="inline-start" /> Copy Active Codes</Button></CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{codes.length === 0 ? <p className="py-8 text-center text-muted-foreground">No promo codes generated yet.</p> : codes.map((item) => <div key={item.code} className="flex items-center justify-between gap-3 rounded-lg border p-3"><span className={item.used ? "font-mono text-muted-foreground line-through" : "font-mono text-primary"}>{item.code}</span><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{item.network} · {item.size}GB · {item.used ? "CLAIMED" : "ACTIVE"}</span><Button variant="ghost" size="icon" onClick={() => copy(item.code)} aria-label={`Copy ${item.code}`}><Copy /></Button></div></div>)}</CardContent></Card>
  </div>;
}
