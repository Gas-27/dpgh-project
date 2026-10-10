import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2 } from "lucide-react";

type Service = { service_id: number; service_name: string; category: string; admin_price_per_1000: number; min_quantity: number; max_quantity: number; average_completion_time?: string | null; notes?: string | null };

export default function SocialBoostApiCatalog() {
  const [services, setServices] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("social_boost_service_pricing").select("service_id,service_name,category,admin_price_per_1000,min_quantity,max_quantity,average_completion_time,notes").order("category").order("service_id");
      const removedServiceNames = new Set(["facebook custom comments ( female )", "facebook custom comments ( male )"]);
      const visibleServices = (data ?? []).filter((service) => !removedServiceNames.has(String(service.service_name).trim().toLowerCase()));
      if (active) { setServices(visibleServices as Service[]); setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, []);

  return <Collapsible open={open} onOpenChange={setOpen}>
    <Card className="border-cyan-500/30">
      <CollapsibleTrigger className="w-full text-left"><CardHeader className="flex flex-row items-center justify-between gap-4"><div><CardTitle className="text-base">Available Social Boost services</CardTitle><p className="mt-1 text-sm text-muted-foreground">Open to view every service ID, category, admin base price, limits, completion time, and notes. Orders and history are shown in My Social Boost History.</p></div><ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} /></CardHeader></CollapsibleTrigger>
      <CollapsibleContent><CardContent>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : services.length === 0 ? <p className="text-sm text-muted-foreground">No Social Boost services are configured yet.</p> : <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">ID</th><th className="p-2">Service</th><th className="p-2">Category</th><th className="p-2">Admin base / 1,000</th><th className="p-2">Quantity limit</th><th className="p-2">Completion</th><th className="p-2">Notes</th></tr></thead><tbody>{services.map((service) => <tr className="border-b" key={service.service_id}><td className="p-2 font-mono">{service.service_id}</td><td className="p-2 font-medium">{service.service_name}</td><td className="p-2"><Badge variant="outline">{service.category}</Badge></td><td className="p-2">{service.admin_price_per_1000}</td><td className="p-2">{service.min_quantity}–{service.max_quantity}</td><td className="p-2">{service.average_completion_time || "Provider dependent"}</td><td className="p-2 text-muted-foreground">{service.notes || "—"}</td></tr>)}</tbody></table></div>}</CardContent></CollapsibleContent>
    </Card>
  </Collapsible>;
}
