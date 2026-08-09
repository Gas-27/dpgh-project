import { useEffect, useState } from "react";
import { Play, Save, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type Setting = {
  network: string;
  enabled: boolean;
  auto_enabled: boolean;
  auto_min_minutes: number | string;
  auto_max_minutes: number | string;
};

const networks = ["mtn", "mtn_express", "telecel", "airteltigo"];
const labels: Record<string, string> = { mtn: "MTN", mtn_express: "MTN Express", telecel: "Telecel", airteltigo: "AirtelTigo" };

export default function DeliveryAutomationAdmin() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("delivery_progress_settings").select("network, enabled, auto_enabled, auto_min_minutes, auto_max_minutes").order("network").then(({ data }) => {
      const rows = data ?? [];
      setGlobalEnabled((rows.find((row: any) => row.network === "__global__") as any)?.enabled ?? true);
      setSettings(networks.map((network) => {
        const row = rows.find((item: any) => item.network === network) as any;
        return { network, enabled: row?.enabled ?? true, auto_enabled: row?.auto_enabled ?? false, auto_min_minutes: row?.auto_min_minutes ?? 30, auto_max_minutes: row?.auto_max_minutes ?? 180 };
      }));
    });
  }, []);

  const update = (network: string, patch: Partial<Setting>) => setSettings((items) => items.map((item) => item.network === network ? { ...item, ...patch } : item));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("save_delivery_progress_settings", { payload: settings.map((setting) => ({ ...setting, auto_min_minutes: Number(setting.auto_min_minutes), auto_max_minutes: Number(setting.auto_max_minutes) })).concat([{ network: "__global__", enabled: globalEnabled }]) });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save automation", description: `${error.message}. Run the updated CREATE_DELIVERY_PROGRESS_SETTINGS.sql migration, then retry.`, variant: "destructive" });
      return;
    }
    toast({ title: "Delivery automation saved", description: "These values are now stored and will remain after refresh." });
  };

  const runAutomation = async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("admin_run_delivery_automation");
    setRunning(false);
    if (error) toast({ title: "Automation could not run", description: "Apply the SQL migration and confirm your admin session.", variant: "destructive" });
    else { setLastRun(new Date().toLocaleString()); toast({ title: "Automation completed", description: `${Number(data ?? 0)} processing orders updated.` }); }
  };

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="size-5 text-primary" /> Delivery automation</CardTitle><p className="text-sm text-muted-foreground">Choose networks and the processing window that moves eligible orders to delivered.</p></CardHeader><CardContent className="space-y-5"><div className="flex items-center justify-between rounded-lg border p-4"><div><Label className="text-base">Automation enabled</Label><p className="text-sm text-muted-foreground">Only orders still marked processing are changed.</p></div><Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} /></div>{settings.map((setting) => <div key={setting.network} className="grid gap-4 rounded-lg border p-4 md:grid-cols-[1fr_auto_1fr_1fr]"><div><Label className="text-base">{labels[setting.network]}</Label><p className="text-sm text-muted-foreground">Network automation</p></div><div className="flex items-center gap-2"><Switch checked={setting.auto_enabled} onCheckedChange={(checked) => update(setting.network, { auto_enabled: checked })} /><span className="text-sm">Auto</span></div><div className="space-y-2"><Label htmlFor={`${setting.network}-min`}>From minutes</Label><Input id={`${setting.network}-min`} type="number" min="0" value={setting.auto_min_minutes} onChange={(event) => update(setting.network, { auto_min_minutes: event.target.value })} /></div><div className="space-y-2"><Label htmlFor={`${setting.network}-max`}>To minutes</Label><Input id={`${setting.network}-max`} type="number" min="1" value={setting.auto_max_minutes} onChange={(event) => update(setting.network, { auto_max_minutes: event.target.value })} /></div></div>)}<div className="flex flex-wrap items-center gap-3"><Button onClick={save} disabled={saving}><Save className="mr-2 size-4" />{saving ? "Saving..." : "Save automation"}</Button><Button variant="outline" onClick={runAutomation} disabled={running || !globalEnabled}><Play className="mr-2 size-4" />{running ? "Running..." : "Run now"}</Button>{lastRun && <span className="text-sm text-muted-foreground">Last run: {lastRun}</span>}</div><p className="text-xs text-muted-foreground">Run now is an admin action. For unattended processing, configure Supabase Cron or an external scheduler to call the protected function.</p></CardContent></Card>;
}
