import { useMemo, useState } from "react";
import { Check, Clipboard, Eye, RefreshCw } from "lucide-react";
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
  const [view, setView] = useState<"waiting" | "seen">("waiting");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const relevant = useMemo(() => orders.filter((order) => isWaiting(order) || isCanceled(order)), [orders]);
  const visible = useMemo(() => relevant.filter((order) => (view === "waiting" ? !order.admin_seen : order.admin_seen) && `${order.customer_number} ${order.id} ${order.network || ""}`.toLowerCase().includes(search.toLowerCase())), [relevant, search, view]);
  const total = visible.reduce((sum, order) => sum + Number(order.amount || 0), 0);

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
      <div className="flex flex-wrap gap-2"><Button variant={view === "waiting" ? "default" : "outline"} onClick={() => setView("waiting")}>Waiting for admin ({relevant.filter((order) => !order.admin_seen).length})</Button><Button variant={view === "seen" ? "default" : "outline"} onClick={() => setView("seen")}>Seen ({relevant.filter((order) => order.admin_seen).length})</Button><Button variant="outline" onClick={copyNumbers} disabled={!visible.length}><Clipboard className="mr-2 h-4 w-4" />Copy numbers</Button><span className="ml-auto self-center text-sm text-muted-foreground">{visible.length} orders · GHC {total.toFixed(2)}</span></div>
      <Input placeholder="Search number, order ID, or network" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="space-y-2">{visible.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No orders waiting for admin.</p> : visible.map((order) => <div key={order.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono">{order.customer_number}</strong><Badge variant={isCanceled(order) ? "destructive" : "secondary"}>{isCanceled(order) ? "canceled by storefront" : "waiting"}</Badge></div><p className="text-xs text-muted-foreground">{order.network || ""} · Order {order.id} · {order.created_at ? new Date(order.created_at).toLocaleString() : ""}</p></div>{view === "waiting" && <Button size="sm" onClick={() => void markSeen([order.id])} disabled={saving}><Eye className="mr-2 h-4 w-4" />Mark seen</Button>}{view === "seen" && <Badge variant="outline"><Check className="mr-1 h-3 w-3" />Seen</Badge>}</div>)}</div>
    </CardContent>
  </Card>;
}

export { isWaiting, isCanceled };
