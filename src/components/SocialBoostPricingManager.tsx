import { useEffect, useMemo, useState } from "react";
import { Save, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { groupByPlatform } from "@/lib/socialBoostPlatforms";

type Service = { service_id: number; service_name: string; category: string; admin_price_per_1000: number; base_price_per_1000?: number; default_price_per_1000: number; max_reseller_price_per_1000: number };

const baseOf = (service: Service) => Number(service.base_price_per_1000) > 0 ? Number(service.base_price_per_1000) : Number(service.admin_price_per_1000);

export default function SocialBoostPricingManager({ ownerId, ownerType }: { ownerId?: string; ownerType?: string }) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [prices, setPrices] = useState<Record<number, number | "">>({});
  const [markup, setMarkup] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any).from("social_boost_service_pricing").select("service_id,service_name,category,admin_price_per_1000,base_price_per_1000,default_price_per_1000,max_reseller_price_per_1000").order("category").order("service_name");
const removedServiceNames = new Set([
        "facebook custom comments ( female )",
        "facebook custom comments ( male )",
      ]);
      const rows = ((data ?? []).filter((row: Service) => !removedServiceNames.has(String(row.service_name).trim().toLowerCase())) as Service[]).map((row) => ({ ...row, base_price_per_1000: baseOf(row) }));
      setServices(rows);
        const { data: user } = await supabase.auth.getUser();
      let pricingUserId = user.user?.id ?? null;
      if (ownerId) {
        const table = ownerType === "agent" ? "agent_stores" : ownerType === "subagent" ? "subagent_stores" : "sub_subagent_stores";
        const { data: store } = await (supabase as any).from(table).select("user_id,owner_id,created_by").eq("id", ownerId).maybeSingle();
        pricingUserId = store?.user_id ?? store?.owner_id ?? store?.created_by ?? pricingUserId;
      }
      if (pricingUserId && rows.length) {
        const { data: saved } = await (supabase as any).from("social_boost_reseller_pricing").select("service_id,price_per_1000").eq("user_id", pricingUserId);
        setPrices(Object.fromEntries(rows.map((row: Service) => {
          const savedPrice = (saved ?? []).find((item: any) => Number(item.service_id) === Number(row.service_id));
          const candidate = Number(savedPrice?.price_per_1000);
          const base = baseOf(row);
          const agentSelling = Number(row.default_price_per_1000);
          const maximum = Number(row.max_reseller_price_per_1000);
          const defaultPrice = Number.isFinite(agentSelling) && agentSelling > 0 ? agentSelling : base;
          const validSavedPrice = Number.isFinite(candidate) && candidate >= base && candidate <= maximum;
          return [row.service_id, validSavedPrice ? candidate : defaultPrice];
        })));
      }
    };
    void load();
  }, [ownerId, ownerType]);
  const update = (id: number, value: string) => setPrices((current) => ({ ...current, [id]: value.trim() === "" ? "" : Number(value) }));
  const applyMarkup = () => {
    const percent = Number(markup);
    if (!Number.isFinite(percent)) return;
    setPrices(Object.fromEntries(services.map((service) => [service.service_id, Math.min(service.max_reseller_price_per_1000, Number(((Number(service.default_price_per_1000) > 0 ? service.default_price_per_1000 : baseOf(service)) * (1 + percent / 100)).toFixed(2)))])));
  };
  const save = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return toast({ title: "Sign in required", description: "Sign in before saving Social Boost prices.", variant: "destructive" });
    const invalid = services.find((service) => { const value = prices[service.service_id]; return typeof value !== "number" || !Number.isFinite(value) || value < baseOf(service) || value > service.max_reseller_price_per_1000; });
    if (invalid) return toast({ title: "Price outside allowed range", description: `Prices must stay between the admin default and maximum cap for ${invalid.service_name}.`, variant: "destructive" });
    setSaving(true);
    let pricingUserId = data.user.id;
    if (ownerId) {
      for (const table of ["agent_stores", "subagent_stores", "sub_subagent_stores"]) {
        const { data: store } = await (supabase as any).from(table).select("user_id,owner_id,created_by").eq("id", ownerId).maybeSingle();
        if (store) { pricingUserId = store.user_id ?? store.owner_id ?? store.created_by ?? pricingUserId; break; }
      }
    }
    const rows = services.map((service) => ({ user_id: pricingUserId, service_id: service.service_id, price_per_1000: typeof prices[service.service_id] === "number" ? prices[service.service_id] : (Number(service.default_price_per_1000) > 0 ? Number(service.default_price_per_1000) : baseOf(service)), updated_at: new Date().toISOString() }));
    const { error } = await (supabase as any).from("social_boost_reseller_pricing").upsert(rows, { onConflict: "user_id,service_id" });
    setSaving(false);
    toast(error ? { title: "Prices not saved", description: error.message, variant: "destructive" } : { title: "Social Boost prices saved" });
  };
  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return services;
    return services.filter((service) => `${service.service_name} ${service.category} ${service.service_id}`.toLowerCase().includes(term));
  }, [search, services]);
  const grouped = useMemo(() => groupByPlatform(filteredServices, (service) => ({ category: service.category, name: service.service_name })), [filteredServices]);
  return <Card><CardHeader><CardTitle>Social Boost prices</CardTitle><p className="text-sm text-muted-foreground">Admin defaults are your cost. Add a markup for your storefront, without exceeding the admin maximum.</p><div className="flex flex-col gap-2 sm:flex-row"><Input className="sm:max-w-72" placeholder="Search service, category, or ID" value={search} onChange={(event) => setSearch(event.target.value)} /><Input className="sm:max-w-40" type="number" placeholder="Markup %" value={markup} onChange={(event) => setMarkup(event.target.value)} /><Button type="button" variant="outline" onClick={applyMarkup}><Percent className="mr-2 h-4 w-4" />Apply markup</Button></div></CardHeader><CardContent className="space-y-5">{grouped.length === 0 && <p className="text-sm text-muted-foreground">No services match your search.</p>}{grouped.map(([platform, rows]) => <div key={platform}><h3 className="mb-2 border-b pb-1 text-base font-bold">{platform} <span className="text-xs font-normal text-muted-foreground">({rows.length})</span></h3><div className="space-y-2">{rows.map((service) => { const admin = baseOf(service); const defaultAgent = Number(service.default_price_per_1000) > 0 ? Number(service.default_price_per_1000) : admin; const entered = prices[service.service_id]; const value = typeof entered === "number" && Number.isFinite(entered) ? entered : defaultAgent; return <div key={service.service_id} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]"><div><p className="font-medium">{service.service_name}</p><p className="text-xs text-muted-foreground">{service.category} · Base price / 1K</p></div><Badge variant="outline" className="h-10 justify-center">GHC {admin.toFixed(2)}</Badge><label className="text-xs text-muted-foreground">Your price / 1K<Input className="mt-1" type="number" min={admin} max={service.max_reseller_price_per_1000} step="0.01" value={prices[service.service_id] ?? defaultAgent} onChange={(event) => update(service.service_id, event.target.value)} /><span className="mt-1 block text-[11px]">Minimum GHC {admin.toFixed(2)} · Default agent price GHC {defaultAgent.toFixed(2)} · Maximum GHC {service.max_reseller_price_per_1000.toFixed(2)}</span></label><div className="text-xs text-muted-foreground">Profit / 1K<strong className="mt-1 block text-base text-emerald-600">GHC {(value - admin).toFixed(2)}</strong><span>Max GHC {service.max_reseller_price_per_1000.toFixed(2)}</span></div></div>; })}</div></div>)}<Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save Social Boost prices"}</Button></CardContent></Card>;
}

void 0;
