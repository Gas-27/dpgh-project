import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Service } from "@/components/DigitalServicesCatalog";

export default function PrivateSubscriptionCheckout() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = serviceId
        ? await supabase.from("digital_services").select("id,slug,name,category,description,price,duration,icon,logo_url,official_url,service_type,private_delivery_mode,is_free,active,help_video_url").eq("id", serviceId).eq("service_type", "private_shared").eq("active", true).maybeSingle()
        : { data: null };
      if (!cancelled) { setService(data as Service | null); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [serviceId]);

  const startPaystackCheckout = async () => {
    if (!service) return;
    setPurchaseLoading(true);
    const amount = Number(service.price);
    const phone = `000000${Date.now().toString().slice(-4)}`;
    const email = `private-${service.id}-${Date.now()}@datapluggh.com`;
    const { data, error } = await supabase.functions.invoke("initialize-payment", {
      body: {
        email, amount, phone, access_pin: "0000", service_id: service.id,
        callback_url: `${window.location.origin}/private-subscription/${service.id}?payment=subscription`,
        metadata: { service_id: service.id, service_name: service.name, service_type: "private_shared", private_delivery_mode: "onsite", source: searchParams.get("source") || "storefront", seller_store_kind: searchParams.get("seller_store_kind") || null, seller_store_id: searchParams.get("seller_store_id") || null },
      },
    });
    setPurchaseLoading(false);
    if (error || !data?.authorization_url) { toast({ title: "Payment unavailable", description: error?.message || data?.error || "Secure checkout could not be started.", variant: "destructive" }); return; }
    window.location.assign(data.authorization_url);
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 text-muted-foreground">Loading private subscription...</main>;
  if (!service) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Subscription unavailable</h1><p className="text-muted-foreground">This private subscription is unavailable or no longer active.</p><Button onClick={() => navigate(-1)}>Back</Button></main>;
  const image = service.logo_url || "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=900&q=80";
  return <main className="min-h-screen bg-[#f7f8fc] p-4 text-[#111936] sm:p-8"><div className="mx-auto max-w-5xl"><Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">← Back to services</Button><div className="grid gap-5 md:grid-cols-2"><section className="rounded-2xl border border-[#e1e4ef] bg-white p-5 shadow-sm"><img src={image} alt={service.name} className="aspect-[4/3] w-full rounded-xl object-cover" /><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Private subscription</p><h1 className="mt-2 text-3xl font-black">{service.name}</h1><p className="mt-3 text-sm leading-6 text-[#69708a]">{service.description || "Get reliable private access with your own dedicated subscription."}</p><div className="mt-5 rounded-xl border border-[#e1e4ef] bg-[#f7f8fc] p-4"><div className="flex items-center justify-between text-sm"><span>Price</span><strong>GHS {Number(service.price).toFixed(2)}</strong></div><div className="mt-3 flex items-center justify-between border-t border-[#e1e4ef] pt-3 text-sm"><span>Delivery</span><strong>Private access</strong></div></div></section><section className="rounded-2xl border border-[#e1e4ef] bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Order details</p><h2 className="mt-2 text-2xl font-black">Complete your order</h2><p className="mt-2 text-sm text-[#69708a]">Pay securely through Paystack. No wallet or customer account is required for storefront checkout.</p><div className="mt-5 rounded-xl bg-[#eef2f8] p-4 text-sm leading-6 text-[#46506d]"><strong>How it works</strong><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Open secure Paystack checkout.</li><li>Complete payment.</li><li>Return here to receive your private login and instructions.</li></ol></div><Button onClick={startPaystackCheckout} disabled={purchaseLoading} className="mt-5 w-full bg-[#2864e8] hover:bg-[#1d52ca]">{purchaseLoading ? "Opening secure checkout..." : `Pay with Paystack — GHS ${Number(service.price).toFixed(2)}`}</Button></section></div></div></main>;
}
