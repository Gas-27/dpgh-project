import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default function AdminSocialBoostOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("social_boost_orders").select("order_number,created_at,target_link,amount,start_count,quantity,service,provider_status,remains,provider_order_id").order("created_at", { ascending: false }).limit(250);
    setOrders(data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  return <div className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Social Boost Orders</h2><Button variant="outline" onClick={() => void load()}>Refresh</Button></div><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow className="bg-[#dddff5]"><TableHead>Date</TableHead><TableHead>Order</TableHead><TableHead>Link</TableHead><TableHead>Charge</TableHead><TableHead>Start count</TableHead><TableHead>Quantity</TableHead><TableHead>Service</TableHead><TableHead>Status</TableHead><TableHead>Remains</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={9}>Loading...</TableCell></TableRow> : orders.map((order) => <TableRow key={order.order_number}><TableCell>{new Date(order.created_at).toLocaleString()}</TableCell><TableCell>#{order.order_number}</TableCell><TableCell className="max-w-[220px] break-all text-blue-600">{order.target_link}</TableCell><TableCell>{Number(order.amount ?? 0).toFixed(2)}</TableCell><TableCell>{order.start_count ?? "—"}</TableCell><TableCell>{order.quantity}</TableCell><TableCell>{order.service}</TableCell><TableCell>{order.provider_status ?? "Processing"}</TableCell><TableCell>{order.remains ?? order.quantity}</TableCell></TableRow>)}</TableBody></Table></div></div>;
}

export async function refreshSocialBoostOrderStatus(order: any) {
  if (!order.provider_order_id) return;
  const { data } = await supabase.functions.invoke("social-boost", { body: { action: "status", order: order.provider_order_id } });
  return data;
}
