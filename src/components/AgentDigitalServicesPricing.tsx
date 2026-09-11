import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, BriefcaseBusiness, LockKeyhole, Globe2 } from "lucide-react";

type Service = { id: string; name: string; category: string; price: number; is_free: boolean; active: boolean; agent_min_price: number; agent_max_price: number; service_type: "public_shared" | "private_shared" };
type Price = { service_id: string; base_price: number; sell_price: number | string; max_price: number };

export default function AgentDigitalServicesPricing({ agentStoreId }: { agentStoreId: string }) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [share, setShare] = useState<"public_shared" | "private_shared">("public_shared");

  useEffect(() => {
    const load = async () => {
      const [{ data: serviceRows, error: serviceError }, { data: priceRows }] = await Promise.all([
        supabase.from("digital_services").select("id,name,category,price,is_free,active,agent_min_price,agent_max_price,service_type").order("active", { ascending: false }).order("category").order("name"),
        supabase.from("agent_service_pricing").select("service_id,base_price,sell_price,max_price").eq("agent_store_id", agentStoreId),
      ]);
      if (serviceError) { toast({ title: "Services unavailable", description: serviceError.message, variant: "destructive" }); return; }
      const rows = [...((serviceRows ?? []) as Service[])].sort((a, b) => Number(b.active) - Number(a.active) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      setServices(rows);
      const next: Record<string, Price> = {};
      rows.forEach((service) => {
        const existing = (priceRows ?? []).find((item: Price) => item.service_id === service.id);
        const base = Number(service.agent_min_price || service.price || 0);
        const max = Number(service.agent_max_price || service.price * 2 || base);
        next[service.id] = existing ? { ...existing, base_price: base, max_price: max } : { service_id: service.id, base_price: base, sell_price: Math.max(base, Number(service.price || 0)), max_price: max };
      });
      setPrices(next);
    };
    void load();
  }, [agentStoreId, toast]);

  const save = async (service: Service) => {
    const price = prices[service.id];
    if (!price) return;
    const sell = Number(price.sell_price);
    if (!Number.isFinite(sell) || sell < price.base_price || sell > price.max_price) {
      toast({ title: "Invalid selling price", description: `Use a price between GHC ${price.base_price.toFixed(2)} and GHC ${price.max_price.toFixed(2)}.`, variant: "destructive" });
      return;
    }
    setSaving(service.id);
    const { error } = await supabase.from("agent_service_pricing").upsert({ agent_store_id: agentStoreId, service_id: service.id, base_price: price.base_price, sell_price: sell, max_price: price.max_price, updated_at: new Date().toISOString() }, { onConflict: "agent_store_id,service_id" });
    setSaving(null);
    toast(error ? { title: "Price not saved", description: error.message, variant: "destructive" } : { title: "Service price saved" });
  };

  const visibleServices = useMemo(() => services.filter((service) => service.service_type === share), [services, share]);

  return <Card className="overflow-hidden"><CardHeader className="border-b border-border/70 bg-card/70"><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" />Service prices</CardTitle><p className="text-sm text-muted-foreground">Manage public shared and private shared services independently.</p><div className="grid grid-cols-2 gap-2 pt-3"><Button type="button" variant={share === "public_shared" ? "default" : "outline"} className="justify-start" onClick={() => setShare("public_shared")}><Globe2 className="mr-2 h-4 w-4" />Public share</Button><Button type="button" variant={share === "private_shared" ? "default" : "outline"} className="justify-start" onClick={() => setShare("private_shared")}><LockKeyhole className="mr-2 h-4 w-4" />Private share</Button></div></CardHeader><CardContent className="space-y-3 p-4">{visibleServices.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No {share === "private_shared" ? "private" : "public"} shared services are available.</div> : visibleServices.map((service) => { const price = prices[service.id]; return <div key={service.id} className={`rounded-xl border border-border bg-background/50 p-4 ${service.active ? "" : "opacity-60"}`}><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{service.name} <Badge variant="outline" className="ml-2">{share === "private_shared" ? "Private share" : "Public share"}</Badge>{!service.active && <Badge variant="destructive" className="ml-2">Locked by admin</Badge>}</p><p className="text-xs text-muted-foreground">{service.category}</p></div><div className="flex flex-wrap items-end gap-3"><div><p className="text-xs text-muted-foreground">Admin base</p><Badge variant="outline">GHC {Number(price?.base_price ?? 0).toFixed(2)}</Badge></div><div><p className="text-xs text-muted-foreground">Your price</p><Input disabled={!service.active} className="w-32" type="number" min={price?.base_price} max={price?.max_price} step="0.01" value={price?.sell_price ?? ""} onChange={(e) => setPrices((current) => ({ ...current, [service.id]: { ...current[service.id], sell_price: e.target.value } }))} /></div><Button size="sm" onClick={() => void save(service)} disabled={saving === service.id}><Save className="mr-1 h-4 w-4" />{saving === service.id ? "Saving" : "Save"}</Button></div></div><p className="mt-3 text-xs text-muted-foreground">Allowed range: GHC {Number(price?.base_price ?? 0).toFixed(2)} – GHC {Number(price?.max_price ?? 0).toFixed(2)}. Profit: GHC {Math.max(0, Number(price?.sell_price ?? 0) - Number(price?.base_price ?? 0)).toFixed(2)}</p></div>; })}</CardContent></Card>;
}
