import { useMemo, useState } from "react";
import { Check, Clipboard, Download, Eye, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Order = { id: string; customer_number: string; network?: string; amount?: number; status?: string; order_status?: string; fulfillment_status?: string; admin_seen?: boolean; admin_seen_at?: string | null; created_at?: string | null; agent_store_id?: string | null; subagent_store_id?: string | null; sub_subagent_store_id?: string | null };

function statusOf(order: Order) { return String(order.order_status || order.status || order.fulfillment_status || "").toLowerCase().replace(/-/g, "_"); }
function isWaiting(order: Order) { return ["waiting", "number_verifying", "number_verifying_for_mtn", "verifying"].some((value) => statusOf(order).includes(value)); }
function isCanceled(order: Order) { return ["canceled", "cancelled"].some((value) => statusOf(order).includes(value)); }

export default function AdminWaitingOrders({ orders, onRefresh }: { orders: Order[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [view, setView] = useState<"waiting" | "canceled" | "seen">("waiting");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const relevant = useMemo(() => orders.filter((order) => isWaiting(order) || isCanceled(order)), [orders]);
  const visible = useMemo(() => relevant.filter((order) => {
    const matchesView = view === "canceled" ? isCanceled(order) : view === "waiting" ? isWaiting(order) && !order.admin_seen : order.admin_seen && !isCanceled(order);
    return matchesView && `${order.customer_number} ${order.id} ${order.network || ""}`.toLowerCase().includes(search.toLowerCase());
  }), [relevant, search, view]);
  const canceledOrders = relevant.filter(isCanceled);
  const total = visible.reduce((sum, order) => sum + Number(order.amount || 0), 0);

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function downloadSelected() {
    const rows = visible.filter((order) => selectedIds.includes(order.id));
    if (!rows.length) return;
    const header = ["Order ID", "Customer Number", "Network", "Amount", "Status", "Created At"];
    const csv = [header, ...rows.map((order) => [order.id, order.customer_number, order.network || "", order.amount || 0, statusOf(order), order.created_at || ""])]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "canceled-waiting-orders.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function markSeen(ids: string[]) {
    if (!ids.length) return;
    setSaving(true);
    const { error } = await supabase.from("orders").update({ admin_seen: true, admin_seen_at: new Date().toISOString() }).in("id", ids);
    setSaving(false);
    if (error) toast({ title: "Could not mark orders as seen", description: error.message, variant: "destructive" });
    else { toast({ title: "Orders marked as seen" }); onRefresh(); }
  }

  async function copyNumbers() {
    await navigator.clipboard.writeText(visible.map((order) => order.customer_number).join("\n"));
    toast({ title: "Numbers copied" });
  }

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle>Waiting and canceled numbers</CardTitle><p className="text-sm text-muted-foreground">Numbers canceled by storefront owners or still waiting for verification.</p></div><Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2"><Button variant={view === "waiting" ? "default" : "outline"} onClick={() => { setView("waiting"); setSelectedIds([]); }}>Waiting for admin ({relevant.filter((order) => isWaiting(order) && !order.admin_seen).length})</Button><Button variant={view === "canceled" ? "default" : "outline"} onClick={() => { setView("canceled"); setSelectedIds([]); }}>Canceled ({canceledOrders.length})</Button><Button variant={view === "seen" ? "default" : "outline"} onClick={() => { setView("seen"); setSelectedIds([]); }}>Seen ({relevant.filter((order) => order.admin_seen && !isCanceled(order)).length})</Button><Button variant="outline" onClick={copyNumbers} disabled={!visible.length}><Clipboard className="mr-2 h-4 w-4" />Copy numbers</Button><Button variant="outline" onClick={downloadSelected} disabled={!selectedIds.length}><Download className="mr-2 h-4 w-4" />Download selected</Button><span className="ml-auto self-center text-sm text-muted-foreground">{visible.length} orders · GHC {total.toFixed(2)}</span></div>
      <Input placeholder="Search number, order ID, or network" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="space-y-2">{visible.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No {view === "canceled" ? "canceled" : "waiting"} orders found.</p> : visible.map((order) => <div key={order.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"><label className="flex items-start gap-3"><input type="checkbox" aria-label={`Select order ${order.id}`} checked={selectedIds.includes(order.id)} onChange={() => toggleSelected(order.id)} className="mt-1 h-4 w-4" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="font-mono">{order.customer_number}</strong><Badge variant={isCanceled(order) ? "destructive" : "secondary"}>{isCanceled(order) ? "canceled by storefront" : "waiting"}</Badge></span><span className="block text-xs text-muted-foreground">{order.network || ""} · Order {order.id} · {order.created_at ? new Date(order.created_at).toLocaleString() : ""}</span></span></label>{view === "waiting" && <Button size="sm" onClick={() => void markSeen([order.id])} disabled={saving}><Eye className="mr-2 h-4 w-4" />Mark seen</Button>}{view === "seen" && <Badge variant="outline"><Check className="mr-1 h-3 w-3" />Seen</Badge>}</div>)}</div>
    </CardContent>
  </Card>;
}

export { isWaiting, isCanceled };
