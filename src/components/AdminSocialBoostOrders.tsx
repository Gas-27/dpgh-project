import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const terminalStatuses = new Set(["completed", "complete", "delivered", "canceled", "cancelled", "failed", "failure"]);

function providerFields(payload: any) {
  return {
    provider_status: String(payload?.status ?? payload?.provider_status ?? "processing"),
    remains: Number(payload?.remains ?? payload?.remaining ?? 0),
    start_count: payload?.start_count == null ? null : Number(payload.start_count),
  };
}

export default function AdminSocialBoostOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (sync = true) => {
    setLoading(true);
    const columns = "id,order_number,created_at,target_link,amount,selling_amount,base_amount,profit_amount,owner_type,owner_store_id,seller_store_kind,seller_store_id,payment_reference,start_count,quantity,service,provider_status,remains,provider_order_id";
    // Keep the admin view bounded and deterministic: the database returns only the newest 1,000 rows.
    // This includes every creation path because API, user, agent, subagent, sub-subagent and customer
    // orders are all persisted in social_boost_orders.
    const { data: latestOrders, error: ordersError } = await (supabase as any)
      .from("social_boost_orders")
      .select(columns)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1000);
    let next = ordersError ? [] : (latestOrders ?? []);
    if (sync && next.some((order: any) => order.provider_order_id && !terminalStatuses.has(String(order.provider_status ?? "").toLowerCase()))) {
      setSyncing(true);
      next = await Promise.all(next.map(async (order: any) => {
        if (!order.provider_order_id || terminalStatuses.has(String(order.provider_status ?? "").toLowerCase())) return order;
        const { data: latest } = await supabase.functions.invoke("social-boost", { body: { action: "status", order: order.provider_order_id } });
        const fields = providerFields(latest);
        await (supabase as any).rpc("update_social_boost_order_status", {
          p_provider_order_id: String(order.provider_order_id),
          p_status: fields.provider_status,
          p_start_count: fields.start_count,
          p_remains: fields.remains,
        });
        return { ...order, ...fields };
      }));
      setSyncing(false);
    }
    setOrders(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Social Boost Orders</h2><p className="text-sm text-muted-foreground">Live provider status, exact remaining quantity, and start count. Use Refresh when you want to sync provider status.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading || syncing}><RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Syncing…" : "Refresh"}</Button></div><div className="overflow-x-auto rounded-xl border"><Table className="min-w-[1250px]"><TableHeader><TableRow className="bg-[#dddff5]"><TableHead>Date</TableHead><TableHead>Order</TableHead><TableHead>Source</TableHead><TableHead>Link</TableHead><TableHead>Charge</TableHead><TableHead>Start count</TableHead><TableHead>Quantity</TableHead><TableHead>Service</TableHead><TableHead>Status</TableHead><TableHead>Remains</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={10}>Loading live order data…</TableCell></TableRow> : orders.map((order) => <TableRow key={order.order_number}><TableCell className="whitespace-nowrap">{new Date(order.created_at).toLocaleString()}</TableCell><TableCell className="whitespace-nowrap">#{order.order_number}</TableCell><TableCell className="whitespace-nowrap">{order.owner_type === "api" ? "API user" : order.seller_store_kind ? `${order.seller_store_kind} storefront` : order.owner_type === "subsubagent" ? "Sub-subagent" : order.owner_type === "subagent" ? "Subagent" : order.owner_type === "agent" ? "Agent" : order.owner_type === "customer" ? "Customer" : order.payment_reference ? "Direct Paystack" : "Direct wallet"}</TableCell><TableCell className="max-w-[260px] truncate text-blue-600" title={order.target_link}>{order.target_link}</TableCell><TableCell className="whitespace-nowrap">{Number(order.amount ?? order.selling_amount ?? 0).toFixed(2)}</TableCell><TableCell>{order.start_count ?? "—"}</TableCell><TableCell>{order.quantity}</TableCell><TableCell>{order.service}</TableCell><TableCell>{order.provider_status ?? "Processing"}</TableCell><TableCell>{order.remains ?? order.quantity}</TableCell></TableRow>)}</TableBody></Table></div></div>;
}

export async function refreshSocialBoostOrderStatus(order: any) {
  if (!order.provider_order_id) return null;
  const { data } = await supabase.functions.invoke("social-boost", { body: { action: "status", order: order.provider_order_id } });
  return providerFields(data);
}
