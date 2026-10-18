import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { groupByPlatform } from "@/lib/socialBoostPlatforms";
import { fetchAllRows } from "@/lib/fetchAllRows";
import CollapsibleSection from "@/components/CollapsibleSection";

type ProviderService = { service: number; name: string; category: string; rate: string; min: string; max: string; average_time?: string; average_completion_time?: string; notes?: string; note?: string };
type ServicePrice = { admin: number; base: number; default: number; max: number; minQuantity: number; maxQuantity: number; averageTime: string; notes: string };
type PriceField = keyof ServicePrice;

const PAGE_SIZE = 25;
const emptyPrice: ServicePrice = { admin: 0, base: 0, default: 0, max: 0, minQuantity: 1, maxQuantity: 1, averageTime: "", notes: "" };
const PRICE_FIELDS: { field: PriceField; label: string }[] = [
  { field: "admin", label: "User price / 1K" },
  { field: "base", label: "Base price for agent network / 1K" },
  { field: "default", label: "Default agent selling price / 1K" },
  { field: "max", label: "Maximum reseller / 1K" },
];

type ServiceCardProps = { service: ProviderService; price: ServicePrice; onChange: (id: number, field: PriceField, value: number | string) => void; onDelete: (service: ProviderService) => void };

function ServiceCard({ service, price: p, onChange, onDelete }: ServiceCardProps) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{service.category} · {service.name}</p>
          <p className="text-xs text-muted-foreground">Provider rate {service.rate} / 1K · ID {service.service}</p>
        </div>
        <Button variant="destructive" size="icon" type="button" aria-label={`Delete ${service.name}`} onClick={() => onDelete(service)}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <Tabs defaultValue="price">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="price">Price</TabsTrigger>
          <TabsTrigger value="quantity">Quantity</TabsTrigger>
          <TabsTrigger value="time">Completion time</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="price" className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRICE_FIELDS.map(({ field, label }) => (
            <label key={field} className="text-xs font-medium">{label}
              <Input type="number" min="0" step="0.01" value={p[field] as number} onChange={(e) => onChange(service.service, field, Number(e.target.value) || 0)} />
            </label>
          ))}
        </TabsContent>
        <TabsContent value="quantity" className="grid gap-3 pt-3 sm:grid-cols-2">
          <label className="text-xs font-medium">Minimum quantity<Input type="number" min="1" value={p.minQuantity} onChange={(e) => onChange(service.service, "minQuantity", Number(e.target.value) || 1)} /></label>
          <label className="text-xs font-medium">Maximum quantity<Input type="number" min="1" value={p.maxQuantity} onChange={(e) => onChange(service.service, "maxQuantity", Number(e.target.value) || 1)} /></label>
        </TabsContent>
        <TabsContent value="time" className="pt-3">
          <label className="text-xs font-medium">Average completion time<Input value={p.averageTime} onChange={(e) => onChange(service.service, "averageTime", e.target.value)} /></label>
        </TabsContent>
        <TabsContent value="notes" className="pt-3">
          <label className="text-xs font-medium">Notes<Textarea value={p.notes} onChange={(e) => onChange(service.service, "notes", e.target.value)} /></label>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type PlatformServicesProps = { items: ProviderService[]; getPrice: (service: ProviderService) => ServicePrice } & Pick<ServiceCardProps, "onChange" | "onDelete">;

function PlatformServices({ items, getPrice, onChange, onDelete }: PlatformServicesProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  return (
    <div className="space-y-3 pt-1">
      {items.slice(0, visible).map((service) => <ServiceCard key={service.service} service={service} price={getPrice(service)} onChange={onChange} onDelete={onDelete} />)}
      {items.length > visible && (
        <Button variant="outline" size="sm" type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
          Show {Math.min(PAGE_SIZE, items.length - visible)} more ({items.length - visible} remaining)
        </Button>
      )}
    </div>
  );
}

function PricingPanel() {
  const { toast } = useToast();
  const [services, setServices] = useState<ProviderService[]>([]);
  const [prices, setPrices] = useState<Record<number, ServicePrice>>({});
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [newService, setNewService] = useState({ service: "", name: "", category: "", rate: "0", min: "1", max: "100000" });

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term ? services.filter((item) => `${item.name} ${item.category} ${item.service}`.toLowerCase().includes(term)) : services;
    return groupByPlatform(list, (item) => ({ category: item.category, name: item.name }));
  }, [search, services]);

  const load = async () => {
    setLoading(true);
    try {
      const rows: any[] = await fetchAllRows(() => (supabase as any).from("social_boost_service_pricing").select("service_id,service_name,category,provider_rate,admin_price_per_1000,base_price_per_1000,default_price_per_1000,max_reseller_price_per_1000,min_quantity,max_quantity,average_completion_time,notes").order("service_id"));
      setServices(rows.map((row) => ({ service: Number(row.service_id), name: row.service_name || `Service ${row.service_id}`, category: row.category || "Social Boost", rate: String(row.provider_rate ?? 0), min: String(row.min_quantity ?? 1), max: String(row.max_quantity ?? 100000), average_completion_time: row.average_completion_time, notes: row.notes })));
      setPrices(Object.fromEntries(rows.map((row) => [Number(row.service_id), { admin: Number(row.admin_price_per_1000 ?? 0), base: Number(row.base_price_per_1000 ?? 0), default: Number(row.default_price_per_1000 ?? 0), max: Number(row.max_reseller_price_per_1000 ?? 0), minQuantity: Number(row.min_quantity ?? 1), maxQuantity: Number(row.max_quantity ?? 1), averageTime: row.average_completion_time ?? "", notes: row.notes ?? "" }])));
      setDirty(new Set());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load services");
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const update = (id: number, field: PriceField, value: number | string) => {
    setPrices((current) => ({ ...current, [id]: { ...emptyPrice, ...current[id], [field]: value } }));
    setDirty((current) => new Set(current).add(id));
  };
  const getPrice = (service: ProviderService): ServicePrice => prices[service.service] ?? { ...emptyPrice, admin: Number(service.rate), base: Number(service.rate), default: Number(service.rate), max: Number(service.rate), minQuantity: Number(service.min), maxQuantity: Number(service.max), averageTime: service.average_completion_time ?? service.average_time ?? "", notes: service.notes ?? service.note ?? "" };

  const save = async () => {
    if (dirty.size === 0) { toast({ title: "No changes to save" }); return; }
    setSaving(true);
    const byId = new Map(services.map((service) => [service.service, service]));
    const rows = [...dirty].flatMap((id) => {
      const service = byId.get(id);
      if (!service) return [];
      const p = getPrice(service);
      return [{ service_id: service.service, service_name: service.name, category: service.category, provider_rate: Number(service.rate) || 0, admin_price_per_1000: p.admin, base_price_per_1000: p.base, default_price_per_1000: p.default, max_reseller_price_per_1000: p.max, min_quantity: p.minQuantity, max_quantity: p.maxQuantity, average_completion_time: p.averageTime, notes: p.notes, updated_at: new Date().toISOString() }];
    });
    let error: { message: string } | null = null;
    for (let i = 0; i < rows.length && !error; i += 200) {
      const result = await (supabase as any).from("social_boost_service_pricing").upsert(rows.slice(i, i + 200), { onConflict: "service_id" });
      error = result.error;
    }
    setSaving(false);
    if (error) { toast({ title: "Pricing not saved", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Saved ${rows.length} service${rows.length === 1 ? "" : "s"}` });
    setDirty(new Set());
  };

  const addService = () => {
    const service = Number(newService.service);
    if (!Number.isInteger(service) || service <= 0 || !newService.name.trim() || !newService.category.trim()) { toast({ title: "Enter a valid service ID, name, and category", variant: "destructive" }); return; }
    if (services.some((item) => item.service === service)) { toast({ title: "That service ID already exists", variant: "destructive" }); return; }
    setServices((current) => [...current, { ...newService, service, name: newService.name.trim(), category: newService.category.trim() }]);
    const rate = Number(newService.rate) || 0;
    setPrices((current) => ({ ...current, [service]: { admin: rate, base: rate, default: rate, max: rate, minQuantity: Number(newService.min) || 1, maxQuantity: Number(newService.max) || 100000, averageTime: "", notes: "" } }));
    setDirty((current) => new Set(current).add(service));
    setNewService({ service: "", name: "", category: "", rate: "0", min: "1", max: "100000" });
  };

  const removeService = async (service: ProviderService) => {
    if (!window.confirm(`Delete ${service.category} · ${service.name}?`)) return;
    const { error } = await (supabase as any).from("social_boost_service_pricing").delete().eq("service_id", service.service);
    if (error) { toast({ title: "Service not deleted", description: error.message, variant: "destructive" }); return; }
    setServices((current) => current.filter((item) => item.service !== service.service));
    setPrices((current) => { const next = { ...current }; delete next[service.service]; return next; });
    setDirty((current) => { const next = new Set(current); next.delete(service.service); return next; });
    toast({ title: "Service deleted" });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading services…</p>;
  if (loadError) return <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"><p className="font-semibold">Could not load services</p><p className="mt-1 text-muted-foreground">{loadError}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void load()}>Try again</Button></div>;

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">Open a platform to edit its services. Only services you change are saved, so saving stays fast.</p>

      <CollapsibleSection variant="row" title="Add service">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Input aria-label="Service ID" placeholder="Service ID" type="number" value={newService.service} onChange={(e) => setNewService({ ...newService, service: e.target.value })} />
          <Input aria-label="Service name" placeholder="Name" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
          <Input aria-label="Service category" placeholder="Category" value={newService.category} onChange={(e) => setNewService({ ...newService, category: e.target.value })} />
          <Input aria-label="Provider rate" placeholder="Provider rate" type="number" value={newService.rate} onChange={(e) => setNewService({ ...newService, rate: e.target.value })} />
          <Input aria-label="Minimum quantity" placeholder="Min quantity" type="number" value={newService.min} onChange={(e) => setNewService({ ...newService, min: e.target.value })} />
          <Input aria-label="Maximum quantity" placeholder="Max quantity" type="number" value={newService.max} onChange={(e) => setNewService({ ...newService, max: e.target.value })} />
        </div>
        <Button className="mt-3" type="button" onClick={addService}><Plus className="mr-2 h-4 w-4" />Add service</Button>
      </CollapsibleSection>

      <div className="my-4 flex flex-wrap items-center gap-3">
        <Input className="sm:max-w-sm" aria-label="Search services" placeholder="Search by service name, category, or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="button" disabled={saving || dirty.size === 0} onClick={() => void save()}>
          <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : dirty.size ? `Save ${dirty.size} changed` : "No changes"}
        </Button>
      </div>

      <div className="space-y-2">
        {grouped.length === 0 && <p className="text-sm text-muted-foreground">No services match your search.</p>}
        {grouped.map(([platform, platformServices]) => (
          <CollapsibleSection key={platform} variant="row" title={platform} forceOpen={Boolean(search.trim())} badge={<Badge variant="secondary">{platformServices.length}</Badge>}>
            <PlatformServices items={platformServices} getPrice={getPrice} onChange={update} onDelete={(service) => void removeService(service)} />
          </CollapsibleSection>
        ))}
      </div>

      {dirty.size > 0 && (
        <Button className="mt-4" type="button" disabled={saving} onClick={() => void save()}>
          <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : `Save ${dirty.size} changed`}
        </Button>
      )}
    </div>
  );
}

export default function AdminSocialBoostPricing() {
  return (
    <CollapsibleSection title="Social Boost service pricing" description="Add, edit, or delete services and set the four price tiers, quantities, completion time, and notes.">
      <PricingPanel />
    </CollapsibleSection>
  );
}
