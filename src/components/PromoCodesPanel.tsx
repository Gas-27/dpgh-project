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
function makeCode() {
return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

export default function PromoCodesPanel({ walletBalance, adminMode = false }: PromoCodesPanelProps) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [network, setNetwork] = useState("MTN");
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
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
  const codeQuantity = typeof quantity === "number" ? quantity : 0;
  const total = pricePerCode * codeQuantity;
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
    if (!codeQuantity) return toast({ title: "Enter the number of codes", variant: "destructive" });
    const created = Array.from({ length: codeQuantity }, () => ({ code: makeCode(), size: selected.size_gb, network: selected.network, used: false }));
    setCodes((current) => [...created, ...current]);
    toast({ title: "Codes generated", description: `${codeQuantity} claim codes created.` });
  };

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-2xl font-bold"><Gift className="text-primary" /> Promo Codes</h2><p className="text-sm text-muted-foreground">Buy data in bulk and share one-time claim codes with customers.</p></div><Button onClick={generate}><Plus data-icon="inline-start" /> Generate Codes</Button></div>
    <div className="grid gap-4 sm:grid-cols-4">{[["Available Balance", `GH₵${walletBalance.toFixed(2)}`], ["Active Codes", activeCodes.length], ["Claimed", codes.filter((code) => code.used).length], ["Expired", 0]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary">{value}</p></CardContent></Card>)}</div>
    <Card><CardContent className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">Claim Button Visible</p><p className="text-sm text-muted-foreground">Customers can see the FREE DATA claim button on your storefront.</p></div><Switch checked={claimVisible} onCheckedChange={setClaimVisible} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Generate New Promo Codes</CardTitle></CardHeader><CardContent className="flex flex-col gap-5">
      <div className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Network</span><div className="grid gap-2 sm:grid-cols-3">{networkLabels.map((item) => <Button key={item} type="button" variant={network.toLowerCase() === item.toLowerCase() ? "default" : "secondary"} onClick={() => chooseNetwork(item)}>{item}</Button>)}</div></div>
      <div className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Data Package (GB) — agent price</span><div className="flex flex-wrap gap-2">{networkPackages.map((item) => <Button key={item.id} type="button" variant={selected?.id === item.id ? "default" : "secondary"} onClick={() => setSelectedId(item.id)}>{item.size_gb}GB (GH₵{Number(item.agent_price ?? item.price).toFixed(2)})</Button>)}</div></div>
      <label className="flex flex-col gap-2 text-sm">Number of Codes<Input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(event.target.value === "" ? "" : Math.min(100, Math.max(1, Number(event.target.value))))} /></label>
      <p className="text-sm text-muted-foreground">Payment is taken automatically from the wallet. Codes do not expire; each code can be claimed only once.</p>
      <div className="rounded-lg border border-primary/40 p-4 text-sm"><div className="flex justify-between"><span>Cost per code:</span><strong>GH₵{pricePerCode.toFixed(2)}</strong></div><div className="flex justify-between"><span>Number of codes:</span><strong>{codeQuantity}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-base"><strong>Total Cost:</strong><strong className="text-primary">GH₵{total.toFixed(2)}</strong></div></div>
      <Button type="button" onClick={generate} disabled={!selected || (!adminMode && total > walletBalance)} variant="secondary">Generate {codeQuantity} Codes for GH₵{total.toFixed(2)}</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center justify-between">Your Codes<Button variant="outline" size="sm" onClick={() => copy(activeCodes.map((code) => code.code).join("\n"))} disabled={!activeCodes.length}><Copy data-icon="inline-start" /> Copy Active Codes</Button></CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{codes.length === 0 ? <p className="py-8 text-center text-muted-foreground">No promo codes generated yet.</p> : codes.map((item) => <div key={item.code} className="flex items-center justify-between gap-3 rounded-lg border p-3"><span className={item.used ? "font-mono text-muted-foreground line-through" : "font-mono text-primary"}>{item.code}</span><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{item.network} · {item.size}GB · {item.used ? "CLAIMED" : "ACTIVE"}</span><Button variant="ghost" size="icon" onClick={() => copy(item.code)} aria-label={`Copy ${item.code}`}><Copy /></Button></div></div>)}</CardContent></Card>
  </div>;
}
