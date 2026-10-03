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

type DataPackage = { id: string; network: string; size_gb: number; agent_price: number; price: number };
type PromoCode = { id: string; code: string; size: number; network: string; used: boolean; is_fake?: boolean };
type Props = { walletBalance: number; adminMode?: boolean; ownerType?: "agent" | "subagent" | "subsubagent"; ownerId?: string };
const networks = ["MTN", "Telecel", "AirtelTigo"];
const makeCode = () => crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();

export default function PromoCodesPanel({ walletBalance, adminMode = false, ownerType = "agent", ownerId }: Props) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [network, setNetwork] = useState("MTN");
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [claimVisible, setClaimVisible] = useState(false);
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [mode, setMode] = useState<"real" | "fake">("real");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const storeType = adminMode ? "admin" : ownerType;
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: auth }, { data: rows }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("data_packages").select("id, network, size_gb, agent_price, price").eq("active", true).order("size_gb"),
      ]);
      if (!mounted) return;
      setUserId(auth.user?.id ?? null);
      const next = (rows ?? []) as DataPackage[];
      setPackages(next);
      const first = next.find((item) => item.network.toLowerCase() === "mtn") ?? next[0];
      if (first) { setNetwork(first.network); setSelectedId(first.id); }
      if (!auth.user) return;
      const [{ data: setting }, { data: saved }] = await Promise.all([
        supabase.from("promo_code_settings").select("claim_visible").eq("owner_id", auth.user.id).eq("store_type", storeType).maybeSingle(),
        supabase.from("promo_codes").select("id, code, size_gb, network, claimed_at, is_fake").eq("owner_id", auth.user.id).eq("store_type", storeType).order("created_at", { ascending: false }),
      ]);
      if (!mounted) return;
      setClaimVisible(Boolean(setting?.claim_visible));
      setCodes((saved ?? []).map((item: any) => ({ id: item.id, code: item.code, size: Number(item.size_gb), network: item.network, used: Boolean(item.claimed_at), is_fake: item.is_fake })));
    })();
    return () => { mounted = false; };
  }, [storeType]);

  const available = useMemo(() => packages.filter((item) => item.network.toLowerCase() === network.toLowerCase()), [packages, network]);
  const selected = packages.find((item) => item.id === selectedId) ?? available[0];
  const count = typeof quantity === "number" ? quantity : 0;
  const price = Number(selected?.agent_price ?? selected?.price ?? 0);
  const gross = price * count;
  const rate = adminMode ? 0 : count >= 10 ? 0.03 : 0.02;
  const discount = gross * rate;
  const total = gross - discount;
  const active = codes.filter((code) => !code.used);

  const saveVisibility = async (value: boolean) => {
    setClaimVisible(value);
    if (!userId) return;
    const { error } = await supabase.from("promo_code_settings").upsert({ owner_id: userId, store_type: storeType, claim_visible: value, updated_at: new Date().toISOString() }, { onConflict: "owner_id,store_type" });
    if (error) toast({ title: "Could not save promo settings", description: error.message, variant: "destructive" });
  };

  const completeGeneration = async () => {
    if (!selected || count < 1) return toast({ title: "Choose a package and quantity", variant: "destructive" });
    if (!userId) return toast({ title: "Sign in required", variant: "destructive" });
    if (!adminMode) {
      if (!ownerId) return toast({ title: "Store could not be identified", variant: "destructive" });
      if (total > walletBalance) return toast({ title: "Insufficient wallet balance", description: `You need GH₵${total.toFixed(2)} but have GH₵${walletBalance.toFixed(2)}.`, variant: "destructive" });
      const { error } = await supabase.rpc("purchase_promo_codes_with_wallet", { p_store_type: ownerType, p_store_id: ownerId, p_amount: total });
      if (error) return toast({ title: "Wallet charge failed", description: error.message, variant: "destructive" });
    }
    const rows = Array.from({ length: count }, () => ({ code: makeCode(), owner_id: userId, store_type: storeType, package_id: selected.id, network: selected.network, size_gb: selected.size_gb, cost: price, is_fake: adminMode && mode === "fake" }));
    const { data, error } = await supabase.from("promo_codes").insert(rows).select("id, code, size_gb, network, claimed_at, is_fake");
    if (error) return toast({ title: "Codes were not saved", description: error.message, variant: "destructive" });
    setCodes((current) => [...(data ?? []).map((item: any) => ({ id: item.id, code: item.code, size: Number(item.size_gb), network: item.network, used: false, is_fake: item.is_fake })), ...current]);
    setConfirmOpen(false);
    toast({ title: "Codes generated", description: `${count} code${count === 1 ? "" : "s"} saved.` });
  };

  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-2xl font-bold"><Gift className="text-primary" /> Promo Codes</h2><p className="text-sm text-muted-foreground">Buy data in bulk and share one-time claim codes.</p></div><Button onClick={() => adminMode ? void completeGeneration() : setConfirmOpen(true)}><Plus data-icon="inline-start" /> Generate Codes</Button></div>
    <div className="grid gap-4 sm:grid-cols-4">{[["Available Balance", `GH₵${walletBalance.toFixed(2)}`], ["Active Codes", active.length], ["Claimed", codes.filter((code) => code.used).length], ["Expired", 0]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary">{value}</p></CardContent></Card>)}</div>
    <Card><CardContent className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">Claim Button Visible</p><p className="text-sm text-muted-foreground">Customers can see FREE DATA on the applicable storefront.</p></div><Switch checked={claimVisible} onCheckedChange={saveVisibility} /></CardContent></Card>
    {adminMode && <Tabs value={mode} onValueChange={(value) => setMode(value as "real" | "fake")}><TabsList><TabsTrigger value="real">Real Code</TabsTrigger><TabsTrigger value="fake">Fake Code</TabsTrigger></TabsList><TabsContent value="fake" className="pt-3 text-sm text-muted-foreground">Fake codes are saved but always respond that the data has already been claimed.</TabsContent></Tabs>}
    <Card><CardHeader><CardTitle>Generate New Promo Codes</CardTitle></CardHeader><CardContent className="flex flex-col gap-5"><div className="grid gap-2 sm:grid-cols-3">{networks.map((item) => <Button key={item} type="button" variant={network.toLowerCase() === item.toLowerCase() ? "default" : "secondary"} onClick={() => { setNetwork(item); setSelectedId(packages.find((pkg) => pkg.network.toLowerCase() === item.toLowerCase())?.id ?? ""); }}>{item}</Button>)}</div><div className="flex flex-wrap gap-2">{available.map((item) => <Button key={item.id} type="button" variant={selected?.id === item.id ? "default" : "secondary"} onClick={() => setSelectedId(item.id)}>{item.size_gb}GB (GH₵{Number(item.agent_price ?? item.price).toFixed(2)})</Button>)}</div><label className="flex flex-col gap-2 text-sm">Number of Codes<Input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(event.target.value === "" ? "" : Math.min(100, Math.max(1, Number(event.target.value))))} /></label><div className="rounded-lg border border-primary/40 p-4 text-sm"><div className="flex justify-between"><span>Gross total:</span><strong>GH₵{gross.toFixed(2)}</strong></div><div className="flex justify-between text-emerald-600"><span>Discount ({rate * 100}%):</span><strong>-GH₵{discount.toFixed(2)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-base"><strong>Wallet deduction:</strong><strong className="text-primary">GH₵{total.toFixed(2)}</strong></div></div></CardContent></Card>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm wallet deduction</AlertDialogTitle><AlertDialogDescription>GH₵{total.toFixed(2)} will be deducted from your wallet for these codes after the {rate * 100}% discount. Do you agree?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void completeGeneration()}>Agree and continue</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Card><CardHeader><CardTitle className="flex items-center justify-between">Your Codes<Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(active.map((code) => code.code).join("\n"))} disabled={!active.length}><Copy data-icon="inline-start" /> Copy Active Codes</Button></CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{active.length ? active.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><span className="font-mono text-primary">{item.code}</span><span className="text-sm text-muted-foreground">{item.network} · {item.size}GB · ACTIVE</span></div>) : <p className="py-8 text-center text-muted-foreground">No active promo codes.</p>}</CardContent></Card>
  </div>;
}
