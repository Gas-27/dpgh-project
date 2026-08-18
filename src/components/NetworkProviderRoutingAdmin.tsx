import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Route } from "lucide-react";

type Flow = "purchase" | "fulfillment";
type RouteRow = { id: string; network_key: string; flow: Flow; provider_key: string; enabled: boolean; updated_at: string };

const networks = [
  { key: "mtn", label: "MTN" },
  { key: "telecel", label: "Telecel" },
  { key: "airteltigo", label: "AirtelTigo" },
  { key: "mtn_mashup", label: "MTN Mashup" },
  { key: "mashup", label: "Mashup" },
];
const providers = [
  { key: "ghdataconnect", label: "GH Data Connect" },
  { key: "dakazina", label: "Dakazina" },
  { key: "bossudata", label: "BossuData" },
  { key: "cledanet", label: "Cledanet" },
  { key: "spendless", label: "Spendless" },
  { key: "orisjay", label: "Orisjay" },
  { key: "datahubnet", label: "Datahubnet" },
];

export default function NetworkProviderRoutingAdmin() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadRoutes = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("network_provider_routes").select("id,network_key,flow,provider_key,enabled,updated_at").order("network_key").order("flow");
    if (error) toast({ title: "Could not load routing", description: error.message, variant: "destructive" });
    else setRoutes((data ?? []) as RouteRow[]);
    setLoading(false);
  };

  useEffect(() => { void loadRoutes(); }, []);

  const updateRoute = async (row: RouteRow, patch: Partial<Pick<RouteRow, "provider_key" | "enabled">>) => {
    const providerKey = patch.provider_key ?? row.provider_key;
    const enabled = patch.enabled ?? row.enabled;
    const key = `${row.network_key}-${row.flow}`;
    setSaving(key);
    const { data, error } = await supabase.rpc("admin_upsert_network_provider_route", { p_network_key: row.network_key, p_flow: row.flow, p_provider_key: providerKey, p_enabled: enabled });
    if (error) toast({ title: "Route not saved", description: error.message, variant: "destructive" });
    else if (data) { setRoutes((current) => current.map((item) => item.id === row.id ? { ...item, provider_key: data.provider_key, enabled: data.enabled, updated_at: data.updated_at } : item)); toast({ title: "Route saved", description: `${row.network_key} ${row.flow} now uses ${providerKey}.` }); }
    setSaving(null);
  };

  const routeFor = (networkKey: string, flow: Flow) => routes.find((row) => row.network_key === networkKey && row.flow === flow);

  return (
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
                  {(["purchase", "fulfillment"] as Flow[]).map((flow) => { const row = routeFor(network.key, flow); const key = `${network.key}-${flow}`; return <td className="p-3" key={flow}>{row ? <div className="flex min-w-52 items-center gap-2"><Select value={row.provider_key} onValueChange={(value) => void updateRoute(row, { provider_key: value })} disabled={saving === key}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{providers.map((provider) => <SelectItem key={provider.key} value={provider.key}>{provider.label}</SelectItem>)}</SelectContent></Select><Switch checked={row.enabled} onCheckedChange={(checked) => void updateRoute(row, { enabled: checked })} disabled={saving === key} aria-label={`${network.label} ${flow} enabled`} />{saving === key && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</div> : <Badge variant="outline">Not configured</Badge>}</td>; })}
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
