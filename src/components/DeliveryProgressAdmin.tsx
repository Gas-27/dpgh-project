import { useEffect, useState } from "react";
import { Save, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Setting = { network: string; enabled: boolean; source: "manual" | "orders"; min_minutes: number; max_minutes: number; message: string };
const networks = ["mtn", "mtn_express", "telecel", "airteltigo"];
const labels: Record<string, string> = { mtn: "MTN", mtn_express: "MTN Express", telecel: "Telecel", airteltigo: "AirtelTigo" };

export default function DeliveryProgressAdmin() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { supabase.from("delivery_progress_settings").select("network, enabled, source, min_minutes, max_minutes, message").order("network").then(({ data }) => setSettings((data as Setting[]) ?? [])); }, []);
  const update = (network: string, patch: Partial<Setting>) => setSettings((items) => items.map((item) => item.network === network ? { ...item, ...patch } : item));
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("delivery_progress_settings").upsert(settings.map(({ network, ...values }) => ({ network, ...values, updated_at: new Date().toISOString() })));
    setSaving(false);
    toast(error ? { title: "Could not save delivery settings", description: error.message, variant: "destructive" } : { title: "Delivery settings saved" });
  };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" />Delivery Progress Controls</CardTitle><p className="text-sm text-muted-foreground">Manage the public delivery notice and estimated windows by network.</p></CardHeader><CardContent className="space-y-4">
    {!settings.length && <p className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-muted-foreground">Run <code>CREATE_DELIVERY_PROGRESS_SETTINGS.sql</code> in Supabase first, then reload this tab.</p>}
    {settings.map((item) => <div key={item.network} className="space-y-4 rounded-lg border border-border p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">{labels[item.network] ?? item.network}</h3><div className="flex items-center gap-2 text-sm"><Switch checked={item.enabled} onCheckedChange={(enabled) => update(item.network, { enabled })} /><Label>Visible</Label></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Source</Label><Select value={item.source} onValueChange={(source: "manual" | "orders") => update(item.network, { source })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual window</SelectItem><SelectItem value="orders">Adjust by order volume</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Minimum minutes</Label><Input type="number" min="0" value={item.min_minutes} onChange={(e) => update(item.network, { min_minutes: Number(e.target.value) })} /></div><div className="space-y-2"><Label>Maximum minutes</Label><Input type="number" min={item.min_minutes} value={item.max_minutes} onChange={(e) => update(item.network, { max_minutes: Number(e.target.value) })} /></div></div><div className="space-y-2"><Label>Customer-facing message</Label><Textarea value={item.message} onChange={(e) => update(item.network, { message: e.target.value })} rows={2} /></div></div>)}
    <Button onClick={save} disabled={saving || !settings.length}><Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save delivery settings"}</Button>
  </CardContent></Card>;
}
