import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ServicePurchaseDialog from "@/components/ServicePurchaseDialog";
import type { Service } from "@/components/DigitalServicesCatalog";

export default function PrivateSubscriptionCheckout() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [ownerId, setOwnerId] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: auth }, { data: row }] = await Promise.all([
        supabase.auth.getUser(),
        serviceId ? supabase.from("digital_services").select("id,slug,name,category,description,price,duration,icon,logo_url,official_url,service_type,private_delivery_mode,is_free,active,help_video_url").eq("id", serviceId).eq("service_type", "private_shared").eq("active", true).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!cancelled) {
        setOwnerId(auth.user?.id);
        setService(row as Service | null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceId]);

  if (loading) return <main className="mx-auto max-w-3xl p-6 text-muted-foreground">Loading private subscription...</main>;
  if (!service) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Subscription unavailable</h1><p className="text-muted-foreground">This private subscription is unavailable or no longer active.</p><Button onClick={() => navigate(-1)}>Back</Button></main>;

  return <main className="min-h-screen bg-background p-4 sm:p-8"><div className="mx-auto max-w-2xl"><Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">Back to services</Button><div className="rounded-2xl border bg-card p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-primary">Private subscription checkout</p><h1 className="mt-2 text-3xl font-bold">{service.name}</h1><p className="mt-2 text-muted-foreground">Complete your details and payment below. No WhatsApp order step is required.</p><ServicePurchaseDialog service={service} ownerType="customer" ownerId={ownerId} onOpenChange={(open) => { if (!open) navigate(-1); }} /></div></div></main>;
}
