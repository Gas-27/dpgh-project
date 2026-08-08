import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Clock3, Info, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { normalizeOrderStatus } from "@/utils/orderStatus";

type Network = "mtn" | "mtn_express" | "telecel" | "airteltigo";
type DeliverySetting = { network: Network; enabled: boolean; source: "manual" | "orders"; min_minutes: number; max_minutes: number; message: string };
type DeliveryOrder = { id?: string | number; network: string; status: string; fulfillment_status: string; order_status: string; created_at?: string | null; updated_at?: string | null };

const defaults: DeliverySetting[] = [
  { network: "mtn", enabled: true, source: "manual", min_minutes: 60, max_minutes: 240, message: "There may be a validation issue on the MTN portal. Orders are still being processed and will be delivered." },
  { network: "mtn_express", enabled: true, source: "manual", min_minutes: 15, max_minutes: 90, message: "MTN Express orders are usually delivered quickly, but delivery can vary by order volume." },
  { network: "telecel", enabled: true, source: "manual", min_minutes: 30, max_minutes: 180, message: "Telecel orders are being processed. Please allow the estimated delivery window." },
  { network: "airteltigo", enabled: true, source: "manual", min_minutes: 30, max_minutes: 180, message: "AirtelTigo orders are being processed. Please allow the estimated delivery window." },
];

const labels: Record<Network, string> = { mtn: "MTN", mtn_express: "MTN Express", telecel: "Telecel", airteltigo: "AirtelTigo" };
const normalizeNetwork = (value?: string | null): Network | null => {
  const normalized = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["mtn_express", "mtnexpress", "express_mtn"].includes(normalized)) return "mtn_express";
  if (["mtn", "mtn_4g", "mtn_data"].includes(normalized)) return "mtn";
  if (["telecel", "vodafone"].includes(normalized)) return "telecel";
  if (["airteltigo", "airtel_tigo", "airtel", "tigo"].includes(normalized)) return "airteltigo";
  return null;
};
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("en-GH", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
const duration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return "—";
  const total = Math.max(2, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  return total < 60 ? `${total} minutes` : `${Math.floor(total / 60)}h ${total % 60 ? `${total % 60}m` : ""}`.trim();
};
const minutes = (value: number) => value < 60 ? `${value} minutes` : `${Math.floor(value / 60)}${value % 60 ? `h ${value % 60}m` : " hours"}`;

export default function DeliveryProgressCard() {
  const [network, setNetwork] = useState<Network>("mtn_express");
  const [settings, setSettings] = useState<DeliverySetting[]>(defaults);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [{ data: rows }, { data: recentOrders }] = await Promise.all([
        supabase.from("delivery_progress_settings").select("network, enabled, source, min_minutes, max_minutes, message"),
        supabase.from("orders").select("id, network, status, fulfillment_status, order_status, created_at, updated_at").order("created_at", { ascending: false }).limit(500),
      ]);
      if (!active) return;
      if (rows?.length) setSettings(rows as DeliverySetting[]);
      setOrders((recentOrders ?? []) as DeliveryOrder[]);
    };
    load();
    return () => { active = false; };
  }, []);

  const item = useMemo(() => settings.find((setting) => setting.network === network && setting.enabled), [network, settings]);
  const latestDelivered = useMemo(() => orders.filter((order) => normalizeNetwork(order.network) === network && normalizeOrderStatus(order) === "delivered").sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0], [network, orders]);
  if (!item) return null;

  const activeCount = orders.filter((order) => normalizeNetwork(order.network) === network && !["delivered", "refunded", "failed"].includes(normalizeOrderStatus(order))).length;
  const extra = item.source === "orders" ? Math.min(240, Math.floor(activeCount / 100) * 15) : 0;
  const deliveredAt = latestDelivered?.updated_at;
  const orderLabel = latestDelivered?.id || "—";

  return (
    <Card className="mx-auto mb-8 w-full max-w-3xl overflow-hidden border-primary/30 bg-primary/5 shadow-sm">
      <CardHeader className="px-5 pb-3 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><Truck className="size-5 text-primary" />Delivery Progress</CardTitle>
          <Select value={network} onValueChange={(value) => setNetwork(value as Network)}>
            <SelectTrigger className="h-9 w-36 sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(labels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-5 pb-5 sm:px-6">
        <div className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <span className="mt-1 size-3 shrink-0 rounded-full bg-destructive" />
          <div><p className="text-sm font-medium leading-5">{item.message}</p><p className="mt-1 text-xs text-muted-foreground">Estimated delivery: <strong className="text-foreground">{minutes(item.min_minutes + extra)} – {minutes(item.max_minutes + extra)}</strong></p></div>
        </div>
        <div className="flex gap-3 rounded-lg border border-border bg-background/70 p-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="min-w-0 text-sm"><p><strong className="text-emerald-700">Last delivered:</strong> <span className="font-medium">#{orderLabel}</span></p><p className="text-muted-foreground">Placed {formatDate(latestDelivered?.created_at)} · Delivered {formatDate(deliveredAt)} · Took <strong className="text-foreground">{duration(latestDelivered?.created_at, deliveredAt)}</strong></p></div>
          <Badge variant="outline" className="ml-auto hidden h-fit shrink-0 gap-1 sm:flex"><Clock3 className="size-3" />{labels[network]}</Badge>
        </div>
        <Button variant="ghost" size="sm" className="w-fit gap-2 px-0 text-xs text-muted-foreground" onClick={() => setDetailsOpen((open) => !open)}><Info className="size-4" />What should you know?<ChevronDown className={`size-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} /></Button>
        {detailsOpen && <p className="text-xs leading-5 text-muted-foreground">This is an estimated delivery window, not a guarantee. Delivery speed can differ by phone number, network validation, and order volume. For your actual order status, use the Track Order bar. Some orders may be delivered faster while others remain processing or waiting.</p>}
      </CardContent>
    </Card>
  );
}
