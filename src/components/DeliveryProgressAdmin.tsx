import { useEffect, useState } from "react";
import { Save, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Source = "manual" | "orders" | "fake";
type Setting = {
  network: string; enabled: boolean; is_default?: boolean; source: Source;
  min_minutes: number | string; max_minutes: number | string; rotation_minutes: number | string;
  fake_enabled: boolean; fake_prefix: string; fake_count: number | string;
  status_color: "green" | "red" | "yellow"; message: string;
};
const networks = ["mtn", "mtn_express", "telecel", "airteltigo"];
const labels: Record<string, string> = { mtn: "MTN", mtn_express: "MTN Express", telecel: "Telecel", airteltigo: "AirtelTigo" };
const defaults = networks.map((network) => ({ network, enabled: true, source: network === "mtn_express" ? "fake" as Source : "manual" as Source, min_minutes: network === "mtn_express" ? 15 : 30, max_minutes: network === "mtn_express" ? 90 : 240, rotation_minutes: 30, fake_enabled: network === "mtn_express", fake_prefix: network === "telecel" ? "020" : network === "airteltigo" ? "026" : "024", fake_count: 10, status_color: "green" as const, message: `${labels[network]} orders are being processed. Please allow the estimated delivery window.` }));

export default function DeliveryProgressAdmin() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [defaultNetwork, setDefaultNetwork] = useState("mtn_express");
  const [saving, setSaving] = useState(false);
  useEffect(() => { supabase.from("delivery_progress_settings").select("network, enabled, is_default, source, min_minutes, max_minutes, rotation_minutes, fake_enabled, fake_prefix, fake_count, status_color, message").order("network").then(({ data }) => { setGlobalEnabled((data ?? []).find((s: any) => s.network === "__global__")?.enabled ?? true); setDefaultNetwork((data ?? []).find((s: any) => s.is_default)?.network ?? "mtn_express"); setSettings(networks.map((n) => ({ ...defaults.find((d) => d.network === n)!, ...((data ?? []).find((s: any) => s.network === n) ?? {}) }))); }); }, []);
  const update = (network: string, patch: Partial<Setting>) => setSettings((items) => items.map((item) => item.network === network ? { ...item, ...patch } : item));
  const save = async () => { setSaving(true); const normalized = settings.map((s) => ({ ...s, min_minutes: Math.max(2, Number(s.min_minutes) || 2), max_minutes: Math.max(Math.max(2, Number(s.min_minutes) || 2), Number(s.max_minutes) || 2), rotation_minutes: Math.max(1, Number(s.rotation_minutes) || 1), fake_count: Math.min(100, Math.max(1, Number(s.fake_count) || 1)), source: s.fake_enabled ? "fake" : s.source === "fake" ? "orders" : s.source, is_default: s.network === defaultNetwork, updated_at: new Date().toISOString() })); const { error } = await supabase.rpc("save_delivery_progress_settings", { payload: [...normalized, { network: "__global__", enabled: globalEnabled, is_default: false, source: "manual", min_minutes: 2, max_minutes: 2, rotation_minutes: 1, fake_enabled: false, fake_prefix: "", fake_count: 1, status_color: "green", message: "", updated_at: new Date().toISOString() }] }); setSaving(false); toast(error ? { title: "Could not save delivery settings", description: "Apply the delivery progress SQL migration first.", variant: "destructive" } : { title: "Delivery settings saved" }); };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="size-5" />Delivery Progress Controls</CardTitle></CardHeader><CardContent className="flex flex-col gap-6"><div className="flex items-center justify-between rounded-lg border p-4"><div><Label>Show delivery progress card</Label><p className="text-sm text-muted-foreground">Turn the customer-facing card on or off.</p></div><Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} /></div>{settings.map((s) => <section key={s.network} className="flex flex-col gap-4 rounded-xl border p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">{labels[s.network]}</h3><p className="text-sm text-muted-foreground">Network delivery progress</p></div><Switch checked={s.enabled} onCheckedChange={(checked) => update(s.network, { enabled: checked })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-2"><Label>Use fake delivery data</Label><Switch checked={s.fake_enabled} onCheckedChange={(checked) => update(s.network, { fake_enabled: checked, source: checked ? "fake" : "orders" })} /></div><div className="flex flex-col gap-2"><Label>Default network</Label><Switch checked={defaultNetwork === s.network} onCheckedChange={(checked) => checked && setDefaultNetwork(s.network)} /></div><div className="flex flex-col gap-2"><Label>From minutes</Label><Input type="number" min={2} value={s.min_minutes} onChange={(e) => update(s.network, { min_minutes: e.target.value })} /></div><div className="flex flex-col gap-2"><Label>To minutes</Label><Input type="number" min={2} value={s.max_minutes} onChange={(e) => update(s.network, { max_minutes: e.target.value })} /></div><div className="flex flex-col gap-2"><Label>Fake rotation minutes</Label><Input type="number" min={1} value={s.rotation_minutes} onChange={(e) => update(s.network, { rotation_minutes: e.target.value })} /></div><div className="flex flex-col gap-2"><Label>Fake number count</Label><Input type="number" min={1} max={100} value={s.fake_count} onChange={(e) => update(s.network, { fake_count: e.target.value })} /></div><div className="flex flex-col gap-2 sm:col-span-2"><Label>Fake number prefix</Label><Input value={s.fake_prefix} onChange={(e) => update(s.network, { fake_prefix: e.target.value })} /></div><div className="flex flex-col gap-2 sm:col-span-2"><Label>Customer-facing message</Label><Textarea value={s.message} onChange={(e) => update(s.network, { message: e.target.value })} rows={3} /></div></div></section>)}<Button onClick={save} disabled={saving} className="w-fit"><Save className="mr-2 size-4" />{saving ? "Saving..." : "Save delivery settings"}</Button></CardContent></Card>;
}
