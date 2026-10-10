import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2 } from "lucide-react";

type Service = { service_id: number; service_name: string; category: string; admin_price_per_1000: number; min_quantity: number; max_quantity: number; average_completion_time?: string | null; notes?: string | null };
type Order = { order_number: string; created_at: string; service: string; quantity: number; amount: number; provider_status?: string | null; target_link: string };

export default function SocialBoostApiCatalog() {
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const [{ data: catalog }, { data: history }] = await Promise.all([
        supabase.from("social_boost_service_pricing").select("service_id,service_name,category,admin_price_per_1000,min_quantity,max_quantity,average_completion_time,notes").order("category").order("service_id"),
        auth.user ? supabase.from("social_boost_orders").select("order_number,created_at,service,quantity,amount,provider_status,target_link").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(25) : Promise.resolve({ data: [] as Order[] }),
      ]);
      if (active) { setServices((catalog ?? []) as Service[]); setOrders((history ?? []) as Order[]); setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, []);

  return <div className="space-y-4">
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-cyan-500/30">
        <CollapsibleTrigger className="w-full text-left"><CardHeader className="flex flex-row items-center justify-between gap-4"><div><CardTitle className="text-base">Social Boost service catalog</CardTitle><p className="mt-1 text-sm text-muted-foreground">Open to view every service ID, category, admin base price, limits, completion time, and notes.</p></div><ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} /></CardHeader></CollapsibleTrigger>
        <CollapsibleContent><CardContent>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">ID</th><th className="p-2">Service</th><th className="p-2">Category</th><th className="p-2">Admin base / 1,000</th><th className="p-2">Quantity limit</th><th className="p-2">Completion</th><th className="p-2">Notes</th></tr></thead><tbody>{services.map((service) => <tr className="border-b" key={service.service_id}><td className="p-2 font-mono">{service.service_id}</td><td className="p-2 font-medium">{service.service_name}</td><td className="p-2"><Badge variant="outline">{service.category}</Badge></td><td className="p-2">{service.admin_price_per_1000}</td><td className="p-2">{service.min_quantity}–{service.max_quantity}</td><td className="p-2">{service.average_completion_time || "Provider dependent"}</td><td className="p-2 text-muted-foreground">{service.notes || "—"}</td></tr>)}</tbody></table></div>}</CardContent></CollapsibleContent>
      </Card>
    </Collapsible>
    <Card><CardHeader><CardTitle className="text-base">My Social Boost API history</CardTitle><p className="text-sm text-muted-foreground">Recent Social Boost orders made through this account&apos;s API wallet.</p></CardHeader><CardContent><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Order</th><th className="p-2">Date</th><th className="p-2">Service</th><th className="p-2">Quantity</th><th className="p-2">Charged base</th><th className="p-2">Status</th><th className="p-2">Target</th></tr></thead><tbody>{orders.length ? orders.map((order) => <tr className="border-b" key={order.order_number}><td className="p-2 font-mono">#{order.order_number}</td><td className="p-2">{new Date(order.created_at).toLocaleString()}</td><td className="p-2">{order.service}</td><td className="p-2">{order.quantity}</td><td className="p-2">{order.amount}</td><td className="p-2">{order.provider_status || "Processing"}</td><td className="max-w-[220px] truncate p-2">{order.target_link}</td></tr>) : <tr><td className="p-3 text-muted-foreground" colSpan={7}>No API Social Boost orders yet.</td></tr>}</tbody></table></div></CardContent></Card>
  </div>;
}
