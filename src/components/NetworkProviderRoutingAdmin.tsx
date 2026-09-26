import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Route, Trash2 } from "lucide-react";

type Flow = "purchase" | "fulfillment";
type RouteRow = { id: string; network_key: string; flow: Flow; provider_key: string; enabled: boolean; updated_at: string };
type SizeRouteRow = { id: string; network_key: string; flow: Flow; size_gb: number; provider_key: string; enabled: boolean; updated_at: string };

const networks = [
  { key: "mtn", label: "MTN" },
  { key: "mtn_express", label: "MTN Express" },
  { key: "mtn_xpress", label: "MTN Xpress" },
  { key: "telecel", label: "Telecel" },
  { key: "airteltigo", label: "AirtelTigo" },
  { key: "mtn_mashup", label: "MTN Mashup" },
  { key: "mashup", label: "Mashup" },
  { key: "atbigtime", label: "AT BigTime" },
];
const fallbackRoutes: Record<string, Record<Flow, string>> = {
  mtn: { purchase: "dakazina", fulfillment: "dakazina" },
  mtn_express: { purchase: "ghdataconnect", fulfillment: "ghdataconnect" },
  telecel: { purchase: "ghdataconnect", fulfillment: "dakazina" },
  airteltigo: { purchase: "ghdataconnect", fulfillment: "dakazina" },
  mtn_mashup: { purchase: "dakazina", fulfillment: "dakazina" },
  mashup: { purchase: "datahubnet", fulfillment: "datahubnet" },
  atbigtime: { purchase: "ghdataconnect", fulfillment: "ghdataconnect" },
};

const providerCatalog = [
  { key: "dakazina", label: "Dakazina" },
  { key: "ghdataconnect", label: "GH Data Connect" },
  { key: "bossudata", label: "BossuData" },
  { key: "cledanet", label: "Cledanet" },
  { key: "spendless", label: "Spendless" },
  { key: "orisjay", label: "Orisjay" },
  { key: "datahubnet", label: "Datahubnet" },
  { key: "fastdealgh", label: "FastDealGH" },
  { key: "bundlezone", label: "Bundle Zone" },
  { key: "fricopay", label: "Fricopay" },
];
const providersByFlow: Record<Flow, typeof providerCatalog> = {
  purchase: providerCatalog,
  fulfillment: providerCatalog,
};

export default function NetworkProviderRoutingAdmin() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [sizeRoutes, setSizeRoutes] = useState<SizeRouteRow[]>([]);
  const [sizeLoading, setSizeLoading] = useState(true);
  const [sizeSaving, setSizeSaving] = useState<string | null>(null);
  const [newSizeNetwork, setNewSizeNetwork] = useState(networks[0].key);
  const [newSizeFlow, setNewSizeFlow] = useState<Flow>("purchase");
  const [newSizeGb, setNewSizeGb] = useState("");
  const [newSizeProvider, setNewSizeProvider] = useState(providerCatalog[0].key);

  const loadRoutes = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("network_provider_routes").select("id,network_key,flow,provider_key,enabled,updated_at").order("network_key").order("flow");
    if (error) toast({ title: "Could not load routing", description: error.message, variant: "destructive" });
    else setRoutes((data ?? []) as RouteRow[]);
    setLoading(false);
  };

  const loadSizeRoutes = async () => {
    setSizeLoading(true);
    const { data, error } = await supabase.from("network_provider_size_routes").select("id,network_key,flow,size_gb,provider_key,enabled,updated_at").order("network_key").order("flow").order("size_gb");
    if (error) toast({ title: "Could not load size overrides", description: error.message, variant: "destructive" });
    else setSizeRoutes((data ?? []) as SizeRouteRow[]);
    setSizeLoading(false);
  };

  useEffect(() => { void loadRoutes(); void loadSizeRoutes(); }, []);

  const addSizeRoute = async () => {
    const sizeGb = Number(newSizeGb);
    if (!newSizeGb || Number.isNaN(sizeGb) || sizeGb <= 0) { toast({ title: "Enter a valid size in GB", variant: "destructive" }); return; }
    const key = "new";
    setSizeSaving(key);
    const { data, error } = await supabase.rpc("admin_upsert_network_provider_size_route", { p_network_key: newSizeNetwork, p_flow: newSizeFlow, p_size_gb: sizeGb, p_provider_key: newSizeProvider, p_enabled: true });
    if (error) toast({ title: "Override not saved", description: error.message, variant: "destructive" });
    else if (data) {
      const saved = data as SizeRouteRow;
      setSizeRoutes((current) => [...current.filter((item) => !(item.network_key === saved.network_key && item.flow === saved.flow && item.size_gb === saved.size_gb)), saved]);
      setNewSizeGb("");
      toast({ title: "Override saved", description: `${newSizeNetwork} ${newSizeFlow} at ${sizeGb}GB now uses ${newSizeProvider}.` });
    }
    setSizeSaving(null);
  };

  const toggleSizeRoute = async (row: SizeRouteRow, enabled: boolean) => {
    const key = row.id;
    setSizeSaving(key);
    const { data, error } = await supabase.rpc("admin_upsert_network_provider_size_route", { p_network_key: row.network_key, p_flow: row.flow, p_size_gb: row.size_gb, p_provider_key: row.provider_key, p_enabled: enabled });
    if (error) toast({ title: "Override not updated", description: error.message, variant: "destructive" });
    else if (data) { const saved = data as SizeRouteRow; setSizeRoutes((current) => current.map((item) => item.id === saved.id ? saved : item)); }
    setSizeSaving(null);
  };

  const deleteSizeRoute = async (row: SizeRouteRow) => {
    const key = row.id;
    setSizeSaving(key);
    const { error } = await supabase.rpc("admin_delete_network_provider_size_route", { p_id: row.id });
    if (error) toast({ title: "Could not delete override", description: error.message, variant: "destructive" });
    else { setSizeRoutes((current) => current.filter((item) => item.id !== row.id)); toast({ title: "Override deleted" }); }
    setSizeSaving(null);
  };

  const updateRoute = async (row: RouteRow, patch: Partial<Pick<RouteRow, "provider_key" | "enabled">>) => {
    const providerKey = patch.provider_key ?? row.provider_key;
    const enabled = patch.enabled ?? row.enabled;
    const key = `${row.network_key}-${row.flow}`;
    setSaving(key);
    const { data, error } = await supabase.rpc("admin_upsert_network_provider_route", { p_network_key: row.network_key, p_flow: row.flow, p_provider_key: providerKey, p_enabled: enabled });
    if (error) toast({ title: "Route not saved", description: error.message, variant: "destructive" });
    else if (data) {
      const saved = data as RouteRow;
      setRoutes((current) => {
        const exists = current.some((item) => item.network_key === row.network_key && item.flow === row.flow);
        return exists
          ? current.map((item) => item.network_key === row.network_key && item.flow === row.flow ? saved : item)
          : [...current, saved];
      });
      toast({ title: "Route saved", description: `${row.network_key} ${row.flow} now uses ${providerKey}.` });
    }
    setSaving(null);
  };

  const routeFor = (networkKey: string, flow: Flow): RouteRow => {
    const existing = routes.find((row) => row.network_key === networkKey && row.flow === flow);
    return existing ?? {
      id: `fallback-${networkKey}-${flow}`,
      network_key: networkKey,
      flow,
      provider_key: fallbackRoutes[networkKey]?.[flow] ?? providersByFlow[flow][0].key,
      enabled: true,
      updated_at: "",
    };
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Route className="size-5" /> Network provider routing</CardTitle>
          <CardDescription>Choose the provider independently for every network in purchase and fulfillment flows. Changes apply to new requests.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadRoutes()} disabled={loading}><RefreshCw data-icon="inline-start" /> Refresh</Button>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="animate-spin" /> Loading routes...</div> : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="p-3 text-left font-medium">Network</th><th className="p-3 text-left font-medium">Purchase provider</th><th className="p-3 text-left font-medium">Fulfillment provider</th></tr></thead>
              <tbody>
                {networks.map((network) => <tr key={network.key} className="border-t">
                  <td className="p-3 font-medium">{network.label}</td>
                  {(["purchase", "fulfillment"] as Flow[]).map((flow) => { const row = routeFor(network.key, flow); const key = `${network.key}-${flow}`; return <td className="p-3" key={flow}><div className="flex min-w-52 items-center gap-2"><Select value={row.provider_key} onValueChange={(value) => void updateRoute(row, { provider_key: value })} disabled={saving === key}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{providersByFlow[flow].map((provider) => <SelectItem key={provider.key} value={provider.key}>{provider.label}</SelectItem>)}</SelectContent></Select><Switch checked={row.enabled} onCheckedChange={(checked) => void updateRoute(row, { enabled: checked })} disabled={saving === key} aria-label={`${network.label} ${flow} enabled`} />{saving === key && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</div></td>; })}
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Route className="size-5" /> Size-specific overrides</CardTitle>
          <CardDescription>Route one exact data size (e.g. 5GB on MTN) to a different provider while everything else keeps using the default routing above.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadSizeRoutes()} disabled={sizeLoading}><RefreshCw data-icon="inline-start" /> Refresh</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <div className="min-w-40">
            <Select value={newSizeNetwork} onValueChange={setNewSizeNetwork}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{networks.map((network) => <SelectItem key={network.key} value={network.key}>{network.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="min-w-32">
            <Select value={newSizeFlow} onValueChange={(value) => setNewSizeFlow(value as Flow)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="purchase">Purchase</SelectItem><SelectItem value="fulfillment">Fulfillment</SelectItem></SelectContent></Select>
          </div>
          <Input className="w-28" type="number" min="0" step="0.1" placeholder="Size (GB)" value={newSizeGb} onChange={(e) => setNewSizeGb(e.target.value)} />
          <div className="min-w-44">
            <Select value={newSizeProvider} onValueChange={setNewSizeProvider}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{providerCatalog.map((provider) => <SelectItem key={provider.key} value={provider.key}>{provider.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button size="sm" onClick={() => void addSizeRoute()} disabled={sizeSaving === "new"}>{sizeSaving === "new" ? <Loader2 className="size-4 animate-spin" /> : "Add override"}</Button>
        </div>
        {sizeLoading ? <div className="flex items-center gap-2 py-6 text-muted-foreground"><Loader2 className="animate-spin" /> Loading overrides...</div> : sizeRoutes.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No size-specific overrides yet. Everything uses the default network routing above.</p> : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="p-3 text-left font-medium">Network</th><th className="p-3 text-left font-medium">Flow</th><th className="p-3 text-left font-medium">Size (GB)</th><th className="p-3 text-left font-medium">Provider</th><th className="p-3 text-left font-medium">Enabled</th><th className="p-3 text-left font-medium"></th></tr></thead>
              <tbody>
                {sizeRoutes.map((row) => <tr key={row.id} className="border-t">
                  <td className="p-3 font-medium">{networks.find((n) => n.key === row.network_key)?.label ?? row.network_key}</td>
                  <td className="p-3 capitalize">{row.flow}</td>
                  <td className="p-3">{row.size_gb}</td>
                  <td className="p-3">{providerCatalog.find((p) => p.key === row.provider_key)?.label ?? row.provider_key}</td>
                  <td className="p-3"><Switch checked={row.enabled} onCheckedChange={(checked) => void toggleSizeRoute(row, checked)} disabled={sizeSaving === row.id} aria-label={`${row.network_key} ${row.flow} ${row.size_gb}GB enabled`} /></td>
                  <td className="p-3"><Button variant="ghost" size="sm" onClick={() => void deleteSizeRoute(row)} disabled={sizeSaving === row.id}><Trash2 className="size-4" /></Button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
