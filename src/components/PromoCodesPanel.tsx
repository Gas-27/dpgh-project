import { useEffect, useMemo, useState } from "react";
import { Copy, Gift, Plus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type DataPackage = { id: string; network: string; size_gb: number; agent_price: number; price: number; active: boolean };
type PromoCode = { id?: string; code: string; size: number; network: string; used: boolean; is_fake?: boolean };
type PromoCodesPanelProps = { walletBalance: number; adminMode?: boolean; ownerType?: "agent" | "subagent" | "subsubagent"; ownerId?: string; };
const networkLabels = ["MTN", "Telecel", "AirtelTigo"];
const makeCode = () => crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();

export default function PromoCodesPanel({ walletBalance, adminMode = false, ownerType = "agent", ownerId }: PromoCodesPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [network, setNetwork] = useState("MTN");
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [claimVisible, setClaimVisible] = useState(false);
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<"real" | "fake">("real");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: auth }, { data: rows }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("data_packages").select("id, network, size_gb, agent_price, price, active").eq("active", true).order("size_gb"),
      ]);
      if (!mounted) return;
      const nextPackages = (rows ?? []) as DataPackage[];
      setUserId(auth.user?.id ?? null);
      setPackages(nextPackages);
      const first = nextPackages.find((item) => item.network.toLowerCase() === "mtn") ?? nextPackages[0];
      if (first) { setNetwork(first.network); setSelectedId(first.id); }
      if (!auth.user) return;
      const storeType = adminMode ? "admin" : "agent";
      const [{ data: setting }, { data: saved }] = await Promise.all([
        supabase.from("promo_code_settings").select("claim_visible").eq("owner_id", auth.user.id).eq("store_type", storeType).maybeSingle(),
        supabase.from("promo_codes").select("id, code, size_gb, network, claimed_at, is_fake").eq("owner_id", auth.user.id).eq("store_type", storeType).order("created_at", { ascending: false }),
      ]);
      if (!mounted) return;
      setClaimVisible(Boolean(setting?.claim_visible));
      setCodes((saved ?? []).map((item: any) => ({ id: item.id, code: item.code, size: Number(item.size_gb), network: item.network, used: Boolean(item.claimed_at), is_fake: item.is_fake })));
    })();
    return () => { mounted = false; };
  }, [adminMode]);

  const networkPackages = useMemo(() => packages.filter((item) => item.network.toLowerCase() === network.toLowerCase()), [network, packages]);
  const selected = packages.find((item) => item.id === selectedId) ?? networkPackages[0];
  const pricePerCode = adminMode ? 0 : Number(selected?.agent_price ?? selected?.price ?? 0);
  const codeQuantity = typeof quantity === "number" ? quantity : 0;
  const grossTotal = pricePerCode * codeQuantity;
  const discountRate = adminMode ? 0 : codeQuantity >= 10 ? 0.03 : 0.02;
  const discountAmount = grossTotal * discountRate;
  const total = grossTotal - discountAmount;
  const activeCodes = codes.filter((code) => !code.used);

  const saveVisibility = async (value: boolean) => {
    setClaimVisible(value);
    if (!userId) return;
    const { error } = await supabase.from("promo_code_settings").upsert({ owner_id: userId, store_type: adminMode ? "admin" : "agent", claim_visible: value, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
    if (error) toast({ title: "Could not save promo settings", description: error.message, variant: "destructive" });
  };
  const chooseNetwork = (value: string) => { setNetwork(value); setSelectedId(packages.find((item) => item.network.toLowerCase() === value.toLowerCase())?.id ?? ""); };
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); toast({ title: "Copied", description: "Promo code copied to clipboard." }); };

  const generate = async () => {
    if (!selected) return toast({ title: "Choose a data package", variant: "destructive" });
    if (!adminMode) { setConfirmOpen(true); return; }
    await completeGeneration();
  };

  const completeGeneration = async () => {
    if (!selected) return toast({ title: "Choose a data package", variant: "destructive" });
    if (!codeQuantity) return toast({ title: "Enter the number of codes", variant: "destructive" });
    if (!adminMode && total > walletBalance) return toast({ title: "Insufficient wallet balance", description: "Top up your wallet before generating codes.", variant: "destructive" });
    if (!userId) return toast({ title: "Sign in required", variant: "destructive" });
    const fake = adminMode && mode === "fake";
    if (!adminMode) {
      if (!ownerId) return toast({ title: "Store could not be identified", description: "Refresh the dashboard and try again.", variant: "destructive" });
      const { error: walletError } = await supabase.rpc("purchase_promo_codes_with_wallet", { p_store_type: ownerType, p_store_id: ownerId, p_amount: total });
      if (walletError) return toast({ title: "Wallet charge failed", description: walletError.message, variant: "destructive" });
    }
    const created = Array.from({ length: codeQuantity }, () => ({ code: makeCode(), owner_id: userId, store_type: adminMode ? "admin" : "agent", package_id: selected.id, network: selected.network, size_gb: selected.size_gb, cost: pricePerCode, is_fake: fake }));
    const { data, error } = await supabase.from("promo_codes").insert(created).select("id, code, size_gb, network, claimed_at, is_fake");
    if (error) return toast({ title: "Codes were not saved", description: error.message, variant: "destructive" });
    setCodes((current) => [...(data ?? []).map((item: any) => ({ id: item.id, code: item.code, size: Number(item.size_gb), network: item.network, used: false, is_fake: item.is_fake })), ...current]);
    toast({ title: fake ? "Fake codes generated" : "Codes generated", description: `${codeQuantity} claim codes saved.` });
  };

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-2xl font-bold"><Gift className="text-primary" /> Promo Codes</h2><p className="text-sm text-muted-foreground">Buy data in bulk and share one-time claim codes with customers.</p></div><Button onClick={generate}><Plus data-icon="inline-start" /> Generate Codes</Button></div>
    <div className="grid gap-4 sm:grid-cols-4">{[["Available Balance", `GH₵${walletBalance.toFixed(2)}`], ["Active Codes", activeCodes.length], ["Claimed", codes.filter((code) => code.used).length], ["Expired", 0]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary">{value}</p></CardContent></Card>)}</div>
    <Card><CardContent className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">Claim Button Visible</p><p className="text-sm text-muted-foreground">Customers can see the FREE DATA claim button on your storefront.</p></div><Switch checked={claimVisible} onCheckedChange={saveVisibility} /></CardContent></Card>
    {adminMode && <Tabs value={mode} onValueChange={(value) => setMode(value as "real" | "fake")}><TabsList><TabsTrigger value="real">Real Code</TabsTrigger><TabsTrigger value="fake">Fake Code</TabsTrigger></TabsList><TabsContent value="fake" className="text-sm text-muted-foreground">Fake codes are saved for audit but always respond that the data has already been claimed.</TabsContent></Tabs>}
    <Card><CardHeader><CardTitle>Generate New Promo Codes</CardTitle></CardHeader><CardContent className="flex flex-col gap-5"><div className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Network</span><div className="grid gap-2 sm:grid-cols-3">{networkLabels.map((item) => <Button key={item} type="button" variant={network.toLowerCase() === item.toLowerCase() ? "default" : "secondary"} onClick={() => chooseNetwork(item)}>{item}</Button>)}</div></div><div className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Data Package (GB) — agent price</span><div className="flex flex-wrap gap-2">{networkPackages.map((item) => <Button key={item.id} type="button" variant={selected?.id === item.id ? "default" : "secondary"} onClick={() => setSelectedId(item.id)}>{item.size_gb}GB (GH₵{Number(item.agent_price ?? item.price).toFixed(2)})</Button>)}</div></div><label className="flex flex-col gap-2 text-sm">Number of Codes<Input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(event.target.value === "" ? "" : Math.min(100, Math.max(1, Number(event.target.value))))} /></label><p className="text-sm text-muted-foreground">{adminMode ? "Admin-generated codes are saved immediately." : "Every code purchase is charged to the wallet. Codes do not expire and can be claimed once."}</p><div className="rounded-lg border border-primary/40 p-4 text-sm"><div className="flex justify-between"><span>Cost per code:</span><strong>GH₵{pricePerCode.toFixed(2)}</strong></div><div className="flex justify-between"><span>Number of codes:</span><strong>{codeQuantity}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-base"><strong>Total Cost:</strong><strong className="text-primary">GH₵{total.toFixed(2)}</strong></div><div className="flex justify-between text-xs text-emerald-600"><span>Discount ({discountRate * 100}%):</span><strong>-GH₵{discountAmount.toFixed(2)}</strong></div></div><Button type="button" onClick={generate} disabled={!selected || (!adminMode && total > walletBalance)} variant="secondary">Generate {codeQuantity} Codes for GH₵{total.toFixed(2)}</Button></CardContent></Card>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm wallet deduction</AlertDialogTitle><AlertDialogDescription>Generating {codeQuantity} code{codeQuantity === 1 ? "" : "s"} will deduct GH₵{total.toFixed(2)} from your wallet after the {discountRate * 100}% discount. Continue?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { setConfirmOpen(false); void completeGeneration(); }}>Agree and continue</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Card><CardHeader><CardTitle className="flex items-center justify-between">Your Codes<Button variant="outline" size="sm" onClick={() => copy(activeCodes.map((code) => code.code).join("\n"))} disabled={!activeCodes.length}><Copy data-icon="inline-start" /> Copy Active Codes</Button></CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{activeCodes.length === 0 ? <p className="py-8 text-center text-muted-foreground">No active promo codes.</p> : activeCodes.map((item) => <div key={item.id ?? item.code} className="flex items-center justify-between gap-3 rounded-lg border p-3"><span className="font-mono text-primary">{item.code}</span><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{item.network} · {item.size}GB · ACTIVE</span><Button variant="ghost" size="icon" onClick={() => copy(item.code)} aria-label={`Copy ${item.code}`}><Copy /></Button></div></div>)}</CardContent></Card>
  </div>;
}
