import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { normalizeOrderStatus } from "@/utils/orderStatus";

const PAGE_SIZE = 20;
const db = supabase as any;

interface PreUpgradeHistoryProps {
  view: "orders" | "topups";
}

export default function PreUpgradeHistory({ view }: PreUpgradeHistoryProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [topups, setTopups] = useState<any[]>([]);
  const [movedAmount, setMovedAmount] = useState(0);
  const [movedAt, setMovedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      try {
        if (view === "orders") {
          const { data, count, error } = await db
            .from("orders")
            .select("id, created_at, customer_number, network, size_gb, size_gb_text, amount, selling_price, status, order_status, fulfillment_status", { count: "exact" })
            .eq("user_id", user.id)
            .is("agent_store_id", null)
            .order("created_at", { ascending: false })
            .range(from, to);
          if (error) throw error;
          if (cancelled) return;
          setOrders(data ?? []);
          setTotal(count ?? 0);
        } else {
          const { data: customer } = await db.from("customers").select("id").eq("user_id", user.id).maybeSingle();
          if (!customer?.id) {
            if (!cancelled) { setTopups([]); setTotal(0); }
          } else {
            const { data, count, error } = await db
              .from("user_wallet_topups")
              .select("id, created_at, amount, status, paystack_reference", { count: "exact" })
              .eq("customer_id", customer.id)
              .order("created_at", { ascending: false })
              .range(from, to);
            if (error) throw error;
            if (cancelled) return;
            setTopups(data ?? []);
            setTotal(count ?? 0);
          }
        }
        const { data: transfer } = await db
          .from("agent_upgrade_transfers")
          .select("user_wallet_moved, created_at")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) {
          setMovedAmount(Number(transfer?.user_wallet_moved ?? 0));
          setMovedAt(transfer?.created_at ?? null);
        }
      } catch (err) {
        console.error("PreUpgradeHistory load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, page, view, user?.id]);

  const rows = view === "orders" ? orders : topups;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="font-display flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" /> Before you became an agent
          </CardTitle>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          {movedAmount > 0 && movedAt && (
            <p className="text-sm text-muted-foreground">
              GHS {movedAmount.toFixed(2)} from your user wallet was added to your agent wallet on {new Date(movedAt).toLocaleDateString()}.
            </p>
          )}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No activity from before you became an agent.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                {view === "orders" ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Network</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="text-sm whitespace-nowrap">{order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{order.customer_number || "—"}</TableCell>
                          <TableCell className="uppercase text-sm">{order.network || "—"}</TableCell>
                          <TableCell className="font-display font-bold">{order.size_gb_text || (order.size_gb != null ? `${order.size_gb}GB` : "—")}</TableCell>
                          <TableCell>GHC {Number(order.amount || 0).toFixed(2)}</TableCell>
                          <TableCell><OrderStatusBadge status={normalizeOrderStatus(order)} network={order.network} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topups.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">GHC {Number(t.amount).toFixed(2)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs capitalize">{t.status || "—"}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{t.paystack_reference || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
