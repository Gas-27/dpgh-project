import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Clock3, Info, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { normalizeOrderStatus } from "@/utils/orderStatus";

type Network = "all" | "mtn" | "mtn_express" | "telecel" | "airteltigo";
type DeliverySetting = { network: Exclude<Network, "all">; enabled: boolean; source: "manual" | "orders"; min_minutes: number; max_minutes: number; message: string };

const defaults: DeliverySetting[] = [
  { network: "mtn", enabled: true, source: "manual", min_minutes: 60, max_minutes: 240, message: "There may be a validation issue on the MTN portal. Orders are still being processed and will be delivered." },
  { network: "mtn_express", enabled: true, source: "manual", min_minutes: 15, max_minutes: 90, message: "MTN Express orders are usually delivered quickly, but delivery can vary by order volume." },
  { network: "telecel", enabled: true, source: "manual", min_minutes: 30, max_minutes: 180, message: "Telecel orders are being processed. Please allow the estimated delivery window." },
  { network: "airteltigo", enabled: true, source: "manual", min_minutes: 30, max_minutes: 180, message: "AirtelTigo orders are being processed. Please allow the estimated delivery window." },
];

const labels: Record<Network, string> = { all: "All networks", mtn: "MTN", mtn_express: "MTN Express", telecel: "Telecel", airteltigo: "AirtelTigo" };
const minutes = (value: number) => value < 60 ? `${value} minutes` : `${Math.floor(value / 60)}${value % 60 ? `h ${value % 60}m` : " hours"}`;

export default function DeliveryProgressCard() {
  const [network, setNetwork] = useState<Network>("all");
  const [settings, setSettings] = useState<DeliverySetting[]>(defaults);
  const [orders, setOrders] = useState<Array<{ network: string; status: string; fulfillment_status: string; order_status: string }>>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [{ data: rows }, { data: recentOrders }] = await Promise.all([
        supabase.from("delivery_progress_settings").select("network, enabled, source, min_minutes, max_minutes, message"),
        supabase.from("orders").select("network, status, fulfillment_status, order_status").order("created_at", { ascending: false }).limit(500),
      ]);
      if (!active) return;
      if (rows?.length) setSettings(rows as DeliverySetting[]);
      setOrders(recentOrders ?? []);
    };
    load();
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => settings.filter((item) => item.enabled && (network === "all" || item.network === network)), [network, settings]);
  if (!visible.length) return null;

  const getEstimate = (item: DeliverySetting) => {
    if (item.source !== "orders") return item;
    const recent = orders.filter((order) => order.network.toLowerCase() === item.network);
    const activeCount = recent.filter((order) => !["delivered", "refunded", "failed"].includes(normalizeOrderStatus(order))).length;
    const extra = Math.min(240, Math.floor(activeCount / 100) * 15);
    return { ...item, min_minutes: item.min_minutes + extra, max_minutes: item.max_minutes + extra };
  };

  return (
    <Card className="mx-auto mb-8 max-w-4xl overflow-hidden border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-xl"><Truck className="h-5 w-5 text-primary" />Delivery Progress</CardTitle>
          <Select value={network} onValueChange={(value) => setNetwork(value as Network)}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.keys(labels).map((key) => <SelectItem key={key} value={key}>{labels[key as Network]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {visible.map((raw) => { const item = getEstimate(raw); return (
          <div key={item.network} className="rounded-lg border border-border bg-background/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3"><span className="mt-1 size-3 shrink-0 rounded-full bg-destructive" /><div><p className="font-semibold">{item.message}</p><p className="mt-1 text-sm text-muted-foreground">Estimated delivery: <strong className="text-foreground">{minutes(item.min_minutes)} – {minutes(item.max_minutes)}</strong></p></div></div>
              <Badge variant="outline" className="w-fit gap-1"><Clock3 className="h-3 w-3" />{labels[item.network]}</Badge>
            </div>
          </div>
        ); })}
        <Button variant="ghost" size="sm" className="w-fit gap-2 px-0 text-muted-foreground" onClick={() => setDetailsOpen((open) => !open)}><Info className="h-4 w-4" />What should you know?<ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} /></Button>
        {detailsOpen && <p className="text-sm leading-6 text-muted-foreground">This is an estimated delivery window, not a guarantee. Delivery speed can differ by phone number, network validation, and order volume. To see the actual status of your order, use the Track Order bar above the packages. Some orders may be delivered faster while others remain processing or waiting.</p>}
      </CardContent>
    </Card>
  );
}
