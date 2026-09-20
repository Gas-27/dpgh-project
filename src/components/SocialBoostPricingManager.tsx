import { useEffect, useMemo, useState } from "react";
import { Save, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Service = { service_id: number; service_name: string; category: string; admin_price_per_1000: number; default_price_per_1000: number; max_reseller_price_per_1000: number };

export default function SocialBoostPricingManager() {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [markup, setMarkup] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any).from("social_boost_service_pricing").select("service_id,service_name,category,admin_price_per_1000,default_price_per_1000,max_reseller_price_per_1000").order("category").order("service_name");
      const rows = (data ?? []) as Service[];
      setServices(rows);
      const { data: user } = await supabase.auth.getUser();
      if (user.user && rows.length) {
        const { data: saved } = await (supabase as any).from("social_boost_reseller_pricing").select("service_id,price_per_1000").eq("user_id", user.user.id);
        setPrices(Object.fromEntries((saved ?? []).map((row: any) => [row.service_id, Number(row.price_per_1000)])));
      }
    };
    void load();
  }, []);
  const update = (id: number, value: string) => setPrices((current) => ({ ...current, [id]: Number(value) || 0 }));
  const applyMarkup = () => {
    const percent = Number(markup);
    if (!Number.isFinite(percent)) return;
    setPrices(Object.fromEntries(services.map((service) => [service.service_id, Math.min(service.max_reseller_price_per_1000, Number((service.default_price_per_1000 * (1 + percent / 100)).toFixed(2)))])));
  };
  const save = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return toast({ title: "Sign in required", description: "Sign in before saving Social Boost prices.", variant: "destructive" });
    const invalid = services.find((service) => { const value = prices[service.service_id] ?? service.default_price_per_1000; return value < service.default_price_per_1000 || value > service.max_reseller_price_per_1000; });
    if (invalid) return toast({ title: "Price outside allowed range", description: `Prices must stay between the admin default and maximum cap for ${invalid.service_name}.`, variant: "destructive" });
    setSaving(true);
    const rows = services.map((service) => ({ user_id: data.user.id, service_id: service.service_id, price_per_1000: prices[service.service_id] ?? service.default_price_per_1000, updated_at: new Date().toISOString() }));
    const { error } = await (supabase as any).from("social_boost_reseller_pricing").upsert(rows, { onConflict: "user_id,service_id" });
    setSaving(false);
    toast(error ? { title: "Prices not saved", description: error.message, variant: "destructive" } : { title: "Social Boost prices saved" });
  };
  const grouped = useMemo(() => services.reduce<Record<string, Service[]>>((result, service) => { (result[service.category] ??= []).push(service); return result; }, {}), [services]);
  return <Card><CardHeader><CardTitle>Social Boost prices</CardTitle><p className="text-sm text-muted-foreground">Admin defaults are your cost. Add a markup for your storefront, without exceeding the admin maximum.</p><div className="flex gap-2"><Input className="max-w-40" type="number" placeholder="Markup %" value={markup} onChange={(event) => setMarkup(event.target.value)} /><Button type="button" variant="outline" onClick={applyMarkup}><Percent className="mr-2 h-4 w-4" />Apply markup</Button></div></CardHeader><CardContent className="space-y-5">{Object.entries(grouped).map(([category, rows]) => <div key={category}><h3 className="mb-2 font-semibold">{category}</h3><div className="space-y-2">{rows.map((service) => { const admin = service.default_price_per_1000; const value = prices[service.service_id] ?? admin; return <div key={service.service_id} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]"><div><p className="font-medium">{service.service_name}</p><p className="text-xs text-muted-foreground">Admin default / 1K</p></div><Badge variant="outline" className="h-10 justify-center">GHC {admin.toFixed(2)}</Badge><label className="text-xs text-muted-foreground">Your price / 1K<Input className="mt-1" type="number" min={admin} max={service.max_reseller_price_per_1000} step="0.01" value={value} onChange={(event) => update(service.service_id, event.target.value)} /></label><div className="text-xs text-muted-foreground">Profit / 1K<strong className="mt-1 block text-base text-emerald-600">GHC {(value - admin).toFixed(2)}</strong><span>Max GHC {service.max_reseller_price_per_1000.toFixed(2)}</span></div></div>; })}</div></div>)}<Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save Social Boost prices"}</Button></CardContent></Card>;
}

void 0;
