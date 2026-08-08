import { useMemo, useState } from "react";
import { Calendar, CheckCircle2, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const networks = [
  ["all", "All networks"],
  ["mtn", "MTN"],
  ["mtn_express", "MTN Express"],
  ["telecel", "Telecel"],
  ["airteltigo", "AirtelTigo"],
] as const;
const statuses = ["pending", "processing", "waiting", "in-queue", "completed", "delivered", "failed"];
const normalize = (value: string | null | undefined) => (value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");

export default function AdminOrderStatusUpdater() {
  const { toast } = useToast();
  const [network, setNetwork] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime] = useState("23:59");
  const [fromStatus, setFromStatus] = useState("processing");
  const [toStatus, setToStatus] = useState("delivered");
  const [matches, setMatches] = useState<{ id: string; network: string; order_status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const canSearch = Boolean(from && to && fromStatus && toStatus && from <= to && fromTime && toTime && (from < to || fromTime <= toTime));
  const networkLabel = useMemo(() => networks.find(([value]) => value === network)?.[1], [network]);

  const preview = async () => {
    if (!canSearch) { toast({ title: "Complete the filters", description: "Choose a valid start and end date.", variant: "destructive" }); return; }
    setLoading(true);
    let query = supabase.from("orders").select("id, network, order_status, created_at").gte("created_at", `${from}T${fromTime}:00.000Z`).lte("created_at", `${to}T${toTime}:59.999Z`).order("created_at", { ascending: false }).limit(5000);
    if (network !== "all") query = query.in("network", network === "airteltigo" ? ["airteltigo", "airtel_tigo", "airtel-tigo", "airtel", "tigo"] : [network]);
    const { data, error } = await query;
    setLoading(false);
    if (error) { toast({ title: "Could not preview orders", description: error.message, variant: "destructive" }); return; }
    const filtered = (data || []).filter((row) => normalize(row.order_status) === normalize(fromStatus));
    setMatches(filtered as typeof matches);
    toast({ title: "Preview ready", description: `${filtered.length} ${networkLabel?.toLowerCase() || "matching"} order${filtered.length === 1 ? "" : "s"} found.` });
  };

  const updateOrders = async () => {
    if (!matches.length || fromStatus === toStatus) return;
    setUpdating(true);
    const ids = matches.map((row) => row.id);
    const { error } = await supabase.from("orders").update({ order_status: toStatus, updated_at: new Date().toISOString() }).in("id", ids);
    setUpdating(false);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    setMatches((rows) => rows.map((row) => ({ ...row, order_status: toStatus })));
    toast({ title: "Orders updated", description: `${ids.length} order${ids.length === 1 ? "" : "s"} marked ${toStatus}.` });
  };

  return <Card className="border-border">
    <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Bulk order delivery status</CardTitle><p className="text-sm text-muted-foreground">Preview and update orders directly in the orders table by network, date, exact time window, and current status. Times use UTC, matching Supabase timestamps.</p></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2"><Label>Network</Label><Select value={network} onValueChange={setNetwork}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{networks.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Current status</Label><Select value={fromStatus} onValueChange={setFromStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>New status</Label><Select value={toStatus} onValueChange={setToStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>From date</Label><div className="relative"><Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div></div>
        <div className="space-y-2"><Label>To date</Label><div className="relative"><Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div></div>
        <div className="space-y-2"><Label>From time</Label><Input type="time" value={fromTime} onChange={(event) => setFromTime(event.target.value)} /></div>
        <div className="space-y-2"><Label>To time</Label><Input type="time" value={toTime} onChange={(event) => setToTime(event.target.value)} /></div>
        <div className="flex items-end"><Button className="w-full" onClick={preview} disabled={loading || !canSearch}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Preview matching orders</Button></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4"><div><p className="font-medium">{matches.length} orders selected</p><p className="text-sm text-muted-foreground">Only orders matching every filter will be updated.</p></div><Button onClick={updateOrders} disabled={updating || !matches.length || fromStatus === toStatus} variant="default">{updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update order status</Button></div>
    </CardContent>
  </Card>;
}
