import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Clock3, Info, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { normalizeOrderStatus } from "@/utils/orderStatus";

type Network = "mtn" | "mtn_express" | "telecel" | "airteltigo";
type Setting = { network: Network; enabled: boolean; is_default?: boolean; source: "manual" | "orders" | "fake"; min_minutes: number; max_minutes: number; rotation_minutes: number; fake_enabled: boolean; fake_prefix: string; fake_count: number; status_color?: "green" | "red" | "yellow"; message: string };
type Order = { id?: string | number; customer_number?: string | null; network: string; status: string; fulfillment_status: string; order_status: string; created_at?: string | null; updated_at?: string | null };
const labels: Record<Network, string> = { mtn: "MTN", mtn_express: "MTN Express", telecel: "Telecel", airteltigo: "AirtelTigo" };
const defaults: Setting[] = ["mtn", "mtn_express", "telecel", "airteltigo"].map((network) => ({ network: network as Network, enabled: true, source: network === "mtn" || network === "mtn_express" ? "orders" : "manual", min_minutes: 30, max_minutes: 240, rotation_minutes: 30, fake_enabled: false, fake_prefix: network === "telecel" ? "020" : network === "airteltigo" ? "026" : "024", fake_count: 10, message: `${labels[network as Network]} orders are being processed. Please allow the estimated delivery window.` }));
const normalize = (value?: string | null): Network | null => { const n = (value ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_"); if (["mtn_express", "mtnexpress", "express_mtn"].includes(n)) return "mtn_express"; if (["mtn", "mtn_4g", "mtn_data"].includes(n)) return "mtn"; if (["telecel", "vodafone"].includes(n)) return "telecel"; if (["airteltigo", "airtel_tigo", "airtel", "tigo"].includes(n)) return "airteltigo"; return null; };
const date = (v?: string | null) => v ? new Intl.DateTimeFormat("en-GH", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(v)) : "—";
const duration = (a?: string | null, b?: string | null) => { if (!a || !b) return "—"; const m = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)); if (m === 0) return "instant"; return m < 60 ? `${m} minutes` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim(); };
const windowText = (m: number) => m < 60 ? `${m} minutes` : `${Math.floor(m / 60)}${m % 60 ? `h ${m % 60}m` : " hours"}`;
const masked = (number?: string | number | null) => { const s = String(number ?? "").replace(/\D/g, ""); return s.length >= 6 ? `${s.slice(0, 3)}****${s.slice(-3)}` : "—"; };
const PREFIXES: Record<Network, string[]> = { mtn: ["024", "054", "055", "059"], mtn_express: ["024", "054", "055", "059"], telecel: ["020", "050"], airteltigo: ["026", "056", "027", "057"] };
const fakeId = (prefixes: string, slot: number) => { const list = prefixes.split(",").map((p) => p.replace(/\D/g, "").slice(0, 3)).filter((p) => p.length === 3); const safeSlot = Math.max(0, slot); const prefix = list[safeSlot % Math.max(1, list.length)] || "024"; const seed = `${safeSlot}:${prefix}`.split("").reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7); const suffix = String((seed * 2654435761) % 1000000).padStart(6, "0"); return `${prefix}${suffix}`; };

export default function DeliveryProgressCard({ selectedNetwork }: { selectedNetwork?: string }) {
  const [network, setNetwork] = useState<Network>(() => normalize(selectedNetwork) ?? "mtn_express");
  const networkWasSelectedRef = useRef(false);
  useEffect(() => {
    const next = normalize(selectedNetwork);
    if (next) {
      networkWasSelectedRef.current = true;
      setNetwork(next);
    }
  }, [selectedNetwork]);
  const [settings, setSettings] = useState<Setting[]>(defaults); const [globalEnabled, setGlobalEnabled] = useState(true); const [orders, setOrders] = useState<Order[]>([]); const [open, setOpen] = useState(false);
  const load = async () => {
    const [settingsResult, ordersResult] = await Promise.all([supabase.from("delivery_progress_settings").select("network, enabled, is_default, source, min_minutes, max_minutes, rotation_minutes, fake_enabled, fake_prefix, fake_count, status_color, message"), supabase.from("orders").select("id, customer_number, network, status, fulfillment_status, order_status, created_at, updated_at").order("updated_at", { ascending: false }).limit(1000)]); const saved = (settingsResult.data as Setting[]) ?? []; const configuredDefault = saved.find((s: any) => s.is_default)?.network;
    if (!networkWasSelectedRef.current && configuredDefault && configuredDefault !== "__global__") {
      setNetwork(configuredDefault as Network);
    } setGlobalEnabled((saved.find((s: any) => s.network === "__global__") as any)?.enabled ?? true); setSettings(defaults.map((d) => ({ ...d, ...(saved.find((s) => s.network === d.network) ?? {}) }))); setOrders((ordersResult.data ?? []) as Order[]); };
  useEffect(() => {
    load();
    const refresh = window.setInterval(load, 15000);
    const channel = supabase.channel("delivery-progress-live").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).on("postgres_changes", { event: "*", schema: "public", table: "delivery_progress_settings" }, load).subscribe();
    return () => { window.clearInterval(refresh); supabase.removeChannel(channel); };
  }, []);
  const item = settings.find((s) => s.network === network);
  const deliveredOrders = useMemo(() => orders.filter((o) => normalize(o.network) === network && String(o.order_status || "").trim().toLowerCase().replace(/[\s_]+/g, "-") === "delivered" && o.created_at && o.updated_at && new Date(o.updated_at).getTime() >= new Date(o.created_at).getTime()).sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()), [orders, network]);
  const real = deliveredOrders[0];
  const active = orders.filter((o) => { const status = String(o.order_status || "").trim().toLowerCase().replace(/_/g, "-"); return normalize(o.network) === network && !["delivered", "refunded", "failed"].includes(status); }).length;
  const realDurations = deliveredOrders.map((o) => Math.max(0, Math.round((new Date(o.updated_at!).getTime() - new Date(o.created_at!).getTime()) / 60000)));
  const realMin = realDurations.length ? Math.min(...realDurations) : 0;
  const realMax = realDurations.length ? Math.max(...realDurations) : 0;
  const fakeMode = item?.fake_enabled === true || item?.source === "fake";
  const fake = fakeMode && item ? { id: fakeId(item.fake_prefix || PREFIXES[network].join(","), Math.floor(Date.now() / Math.max(1, item.rotation_minutes * 60000)) % Math.max(1, item.fake_count)), customer_number: fakeId(item.fake_prefix || PREFIXES[network].join(","), Math.floor(Date.now() / Math.max(1, Number(item.rotation_minutes) * 60000))), network, status: "delivered", fulfillment_status: "delivered", order_status: "delivered", created_at: (() => { const min = Math.max(2, Number(item.min_minutes) || 2); const max = Math.max(min, Number(item.max_minutes) || min); const slot = Math.floor(Date.now() / Math.max(1, Number(item.rotation_minutes) || 1) / 60000); const took = min + (Math.abs(slot * 7919) % (max - min + 1)); return new Date(Date.now() - took * 60000).toISOString(); })(), updated_at: new Date().toISOString() } : null;
  if (!globalEnabled || !item || !item.enabled) return null;
  const shown = fake ?? real; const extra = item.source === "orders" ? Math.min(240, Math.floor(active / 100) * 15) : 0;
  const estimateMin = item.source === "orders" && realDurations.length ? realMin : item.min_minutes + extra;
  const estimateMax = item.source === "orders" && realDurations.length ? realMax : item.max_minutes + extra;
  return <Card style={{ backgroundColor: "#32177a", color: "#ffffff" }} className="delivery-progress-card relative mb-4 w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-[#5b3aa2] bg-[#32177a] text-black shadow-lg sm:mx-auto sm:max-w-6xl"><CardHeader className="px-4 pb-2 pt-3 sm:px-5"><div className="flex items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-base text-white sm:text-lg"><Truck className="size-4 text-cyan-300" />Delivery Progress</CardTitle><Select value={network} onValueChange={(v) => {
              networkWasSelectedRef.current = true;
              setNetwork(v as Network);
            }}><SelectTrigger aria-label="Select delivery network" style={{ color: "#000", WebkitTextFillColor: "#000" }} className="h-9 w-full min-w-0 border-2 border-cyan-300 bg-white font-semibold !text-black shadow-sm sm:w-48 [&_*]:!text-black"><SelectValue style={{ color: "#000", WebkitTextFillColor: "#000" }} className="!text-black [&_*]:!text-black" placeholder="Select network" /></SelectTrigger><SelectContent className="bg-white text-black">{Object.entries(labels).map(([k, v]) => <SelectItem className="text-black focus:bg-slate-100 focus:text-black" key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div></CardHeader><CardContent className="flex flex-col gap-2 px-4 pb-4 sm:px-5"><div style={{ backgroundColor: "#321d73", color: "#ffffff" }} className="delivery-status-message flex gap-2 rounded-2xl border border-[#5b3aa2] bg-[#321d73] p-3 text-black"><span className={`mt-1 size-2.5 shrink-0 rounded-full ${item.status_color === "red" ? "bg-red-500" : item.status_color === "yellow" ? "bg-yellow-400" : "bg-emerald-500"}`} /><div><p className="text-xs font-medium leading-4 text-black sm:text-sm">{item.message?.trim() || `${labels[network]} orders are being processed. Please allow the estimated delivery window.`}</p><p className="mt-1 text-xs text-[#d7c8ff]">Estimated delivery: <strong className="text-white">{windowText(estimateMin)} – {windowText(estimateMax)}</strong></p></div></div><div className="delivery-last-order flex gap-2 rounded-2xl border border-violet-400/30 bg-[#17113d] p-3 text-black"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" /><div className="min-w-0 text-xs text-black sm:text-sm">{shown ? <><p><strong className="text-emerald-400">Last delivered:</strong> <span className="font-medium text-white">{masked(shown.customer_number)}</span></p><p className="text-[#d7c8ff]">Placed {date(shown.created_at)} · Delivered {date(shown.updated_at)} · Took <strong className="text-white">{duration(shown.created_at, shown.updated_at)}</strong></p></> : <p className="text-[#d7c8ff]">No delivered {labels[network]} order found yet. This card reads delivery status directly from the orders table.</p>}</div><Badge variant="outline" className="ml-auto flex h-fit shrink-0 gap-1 border-slate-300 bg-white px-2 text-black"><Clock3 className="size-3" />{labels[network]}</Badge></div><Button variant="ghost" size="sm" className="w-fit gap-2 px-0 text-xs text-white" onClick={() => setOpen(!open)}><Info className="size-4" />What should you know?<ChevronDown className={`size-4 ${open ? "rotate-180" : ""}`} /></Button>{open && <p className="text-xs leading-5 text-white">This is an estimated delivery window, not a guarantee. Track your own order from the Track Order bar for its actual status.</p>}</CardContent></Card>;
}
