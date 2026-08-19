import { useEffect, useMemo, useState } from "react";
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

type Setting = { network: string; enabled: boolean; is_default?: boolean; source: "manual" | "orders" | "fake"; min_minutes: number | string; max_minutes: number | string; rotation_minutes: number | string; fake_enabled: boolean; fake_prefix: string; fake_count: number | string; status_color: "green" | "red" | "yellow"; message: string };
type Order = { id: string; customer_number?: string | null; network?: string | null; order_status?: string | null; status?: string | null; fulfillment_status?: string | null; created_at?: string | null };
const networks = ["mtn", "mtn_express", "telecel", "airteltigo"];
const labels: Record<string, string> = { mtn: "MTN", mtn_express: "MTN Express", telecel: "Telecel", airteltigo: "AirtelTigo" };
const prefixes: Record<string, string> = { mtn: "024, 054, 055, 059", mtn_express: "024, 054, 055, 059", telecel: "020, 050", airteltigo: "026, 056" };
const defaults = networks.map((network) => ({ network, enabled: true, source: "orders" as const, min_minutes: 30, max_minutes: 240, rotation_minutes: 30, fake_enabled: false, fake_prefix: prefixes[network], fake_count: 10, status_color: "green" as const, message: `${labels[network]} orders are being processed. Please allow the estimated delivery window.` }));
const normalizeNetwork = (value?: string | null) => String(value || "").toLowerCase().trim().replace(/[\s-]+/g, "_") === "mtnexpress" ? "mtn_express" : String(value || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
const orderStatus = (order: Order) => String(order.order_status || order.fulfillment_status || order.status || "pending").toLowerCase().replace(/_/g, "-");

export default function DeliveryProgressAdmin() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [defaultNetwork, setDefaultNetwork] = useState("mtn");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState("mtn");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [targetStatus, setTargetStatus] = useState("processing");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: settingRows, error: settingsError }, { data: orderRows, error: ordersError }] = await Promise.all([
      supabase.from("delivery_progress_settings").select("network, enabled, is_default, source, min_minutes, max_minutes, rotation_minutes, fake_enabled, fake_prefix, fake_count, status_color, message").order("network"),
      supabase.from("orders").select("id, customer_number, network, order_status, status, fulfillment_status, created_at").order("created_at", { ascending: false }).limit(300),
    ]);
    if (settingsError || ordersError) toast({ title: "Could not load delivery controls", description: settingsError?.message || ordersError?.message, variant: "destructive" });
    const rows = settingRows ?? [];
    setGlobalEnabled(rows.find((row: any) => row.network === "__global__")?.enabled ?? true);
    setDefaultNetwork(rows.find((row: any) => row.is_default)?.network ?? "mtn");
    setSettings(networks.map((network) => ({ ...defaults.find((item) => item.network === network)!, ...(rows.find((row: any) => row.network === network) ?? {}) })));
    setOrders((orderRows ?? []) as Order[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  const update = (network: string, patch: Partial<Setting>) => setSettings((items) => items.map((item) => item.network === network ? { ...item, ...patch } : item));
  const current = settings.find((setting) => setting.network === selectedNetwork);
  const matchingOrders = useMemo(() => orders.filter((order) => normalizeNetwork(order.network) === selectedNetwork), [orders, selectedNetwork]);
  const selectedCount = selectedOrders.length;
  const toggleOrder = (id: string) => setSelectedOrders((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const selectAll = () => setSelectedOrders(selectedOrders.length === matchingOrders.length ? [] : matchingOrders.map((order) => order.id));

  const save = async () => {
    if (!current) return;
    if (selectedCount === 0) { toast({ title: "Select orders first", description: `Choose the ${labels[selectedNetwork]} orders that should receive the status update.`, variant: "destructive" }); return; }
    setSaving(true);
    const normalized = settings.map((setting) => ({ ...setting, min_minutes: Math.max(2, Number(setting.min_minutes) || 2), max_minutes: Math.max(Math.max(2, Number(setting.min_minutes) || 2), Number(setting.max_minutes) || 2), rotation_minutes: Math.max(1, Number(setting.rotation_minutes) || 1), fake_count: Math.min(100, Math.max(1, Number(setting.fake_count) || 1)), fake_prefix: setting.fake_prefix.split(",").map((prefix) => prefix.replace(/\D/g, "").slice(0, 3)).filter(Boolean).join(", "), source: setting.fake_enabled ? "fake" : setting.source === "fake" ? "orders" : setting.source, is_default: setting.network === defaultNetwork, updated_at: new Date().toISOString() }));
    const { error: settingsError } = await supabase.rpc("save_delivery_progress_settings", { payload: [...normalized, { network: "__global__", enabled: globalEnabled, is_default: false, source: "manual", min_minutes: 2, max_minutes: 2, rotation_minutes: 1, fake_enabled: false, fake_prefix: "", fake_count: 1, status_color: "green", message: "", updated_at: new Date().toISOString() }] });
    if (settingsError) { setSaving(false); toast({ title: "Could not save delivery settings", description: settingsError.message, variant: "destructive" }); return; }
    const { error: statusError } = await supabase.from("orders").update({ order_status: targetStatus, fulfillment_status: targetStatus, updated_at: new Date().toISOString() }).in("id", selectedOrders);
    setSaving(false);
    if (statusError) { toast({ title: "Progress saved, statuses failed", description: statusError.message, variant: "destructive" }); return; }
    toast({ title: `${labels[selectedNetwork]} progress updated`, description: `${selectedCount} selected order${selectedCount === 1 ? "" : "s"} changed to ${targetStatus}. Unselected orders were left unchanged.` });
    setSelectedOrders([]);
    await load();
  };

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="size-5" />Delivery Progress Controls</CardTitle></CardHeader><CardContent className="flex flex-col gap-6">
    <div className="flex items-center justify-between rounded-lg border p-4"><div><Label>Show delivery progress card</Label><p className="text-sm text-muted-foreground">Turn the customer-facing card on or off.</p></div><Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} /></div>
    {settings.map((setting) => <section key={setting.network} className="flex flex-col gap-4 rounded-xl border p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">{labels[setting.network]}</h3><p className="text-sm text-muted-foreground">Network-specific customer progress settings.</p></div><Switch checked={setting.enabled} onCheckedChange={(checked) => update(setting.network, { enabled: checked })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-2"><Label>Use fake delivery data</Label><Switch checked={setting.fake_enabled} onCheckedChange={(checked) => update(setting.network, { fake_enabled: checked, source: checked ? "fake" : "orders" })} /></div><div className="flex flex-col gap-2"><Label>Default network</Label><Switch checked={defaultNetwork === setting.network} onCheckedChange={(checked) => checked && setDefaultNetwork(setting.network)} /></div><div className="flex flex-col gap-2"><Label>Estimate from minutes</Label><Input type="number" min={2} value={setting.min_minutes} onChange={(event) => update(setting.network, { min_minutes: event.target.value })} /></div><div className="flex flex-col gap-2"><Label>Estimate to minutes</Label><Input type="number" min={2} value={setting.max_minutes} onChange={(event) => update(setting.network, { max_minutes: event.target.value })} /></div><div className="flex flex-col gap-2"><Label>Fake number rotation minutes</Label><Input type="number" min={1} value={setting.rotation_minutes} onChange={(event) => update(setting.network, { rotation_minutes: event.target.value })} /></div><div className="flex flex-col gap-2"><Label>Fake number count</Label><Input type="number" min={1} max={100} value={setting.fake_count} onChange={(event) => update(setting.network, { fake_count: event.target.value })} /></div><div className="flex flex-col gap-2 sm:col-span-2"><Label>Fake number prefixes</Label><Input value={setting.fake_prefix} onChange={(event) => update(setting.network, { fake_prefix: event.target.value })} /></div><div className="flex flex-col gap-2 sm:col-span-2"><Label>Customer-facing message</Label><Textarea value={setting.message} onChange={(event) => update(setting.network, { message: event.target.value })} /></div></div></section>)}
    <section className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4"><div><h3 className="font-semibold">Update selected order statuses</h3><p className="text-sm text-muted-foreground">Choose a network, select only the orders to update, and leave all other orders untouched.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-2"><Label>Network</Label><Select value={selectedNetwork} onValueChange={(value) => { setSelectedNetwork(value); setSelectedOrders([]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{networks.map((network) => <SelectItem key={network} value={network}>{labels[network]}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-col gap-2"><Label>New status</Label><Select value={targetStatus} onValueChange={setTargetStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["pending", "processing", "delivered", "failed", "refunded"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div></div><div className="flex items-center justify-between rounded-md border bg-background p-3"><div><p className="font-medium">{selectedCount} selected of {matchingOrders.length} {labels[selectedNetwork]} orders</p><p className="text-xs text-muted-foreground">Unselected orders are your exempt orders.</p></div><Button type="button" variant="outline" size="sm" onClick={selectAll}>{selectedCount === matchingOrders.length ? "Clear all" : "Select all"}</Button></div><div className="max-h-72 overflow-y-auto rounded-md border">{loading ? <p className="p-4 text-sm text-muted-foreground">Loading orders…</p> : matchingOrders.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No orders found for this network.</p> : matchingOrders.map((order) => <label key={order.id} className="flex cursor-pointer items-center gap-3 border-b p-3 last:border-b-0"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleOrder(order.id)} /><span className="min-w-0 flex-1"><span className="block font-medium">{order.customer_number || order.id}</span><span className="text-xs text-muted-foreground">{orderStatus(order)} · {order.created_at ? new Date(order.created_at).toLocaleString() : "no date"}</span></span></label>)}</div></section>
    <Button className="w-full gap-2" onClick={save} disabled={saving}><Save className="size-4" />{saving ? "Saving…" : "Save progress and selected statuses"}</Button>
  </CardContent></Card>;
}
