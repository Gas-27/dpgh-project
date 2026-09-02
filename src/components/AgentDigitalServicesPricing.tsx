import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, BriefcaseBusiness } from "lucide-react";

type Service = { id: string; name: string; category: string; price: number; is_free: boolean; agent_min_price: number; agent_max_price: number };
type Price = { service_id: string; base_price: number; sell_price: number | string; max_price: number };

export default function AgentDigitalServicesPricing({ agentStoreId }: { agentStoreId: string }) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: serviceRows, error: serviceError }, { data: priceRows }] = await Promise.all([
        supabase.from("digital_services").select("id,name,category,price,is_free,agent_min_price,agent_max_price").order("category").order("name"),
        supabase.from("agent_service_pricing").select("service_id,base_price,sell_price,max_price").eq("agent_store_id", agentStoreId),
      ]);
      if (serviceError) { toast({ title: "Services unavailable", description: serviceError.message, variant: "destructive" }); return; }
      const rows = (serviceRows ?? []) as Service[];
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

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" />Service prices</CardTitle><p className="text-sm text-muted-foreground">Set your selling price above the admin base price. Prices cannot exceed the admin limit.</p></CardHeader><CardContent className="space-y-3">{services.map((service) => { const price = prices[service.id]; return <div key={service.id} className={`grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[1fr_auto_auto_auto] ${service.active ? "" : "opacity-60"}`}><div><p className="font-semibold">{service.name} {!service.active && <Badge variant="destructive" className="ml-2">Locked by admin</Badge>}</p><p className="text-xs text-muted-foreground">{service.category}</p></div><div><p className="text-xs text-muted-foreground">Admin base</p><Badge variant="outline">GHC {Number(price?.base_price ?? 0).toFixed(2)}</Badge></div><div><p className="text-xs text-muted-foreground">Your price</p><Input disabled={!service.active} className="w-32" type="number" min={price?.base_price} max={price?.max_price} step="0.01" value={price?.sell_price ?? ""} onChange={(e) => setPrices((current) => ({ ...current, [service.id]: { ...current[service.id], sell_price: e.target.value } }))} /></div><div className="flex items-end"><Button size="sm" onClick={() => void save(service)} disabled={saving === service.id}><Save className="mr-1 h-4 w-4" />{saving === service.id ? "Saving" : "Save"}</Button></div><p className="text-xs text-muted-foreground md:col-span-4">Allowed range: GHC {Number(price?.base_price ?? 0).toFixed(2)} – GHC {Number(price?.max_price ?? 0).toFixed(2)}. Profit: GHC {Math.max(0, Number(price?.sell_price ?? 0) - Number(price?.base_price ?? 0)).toFixed(2)}</p></div>; })}</CardContent></Card>;
}
