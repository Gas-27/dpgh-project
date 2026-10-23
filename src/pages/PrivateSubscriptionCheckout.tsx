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
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [access, setAccess] = useState<{ email: string | null; password: string | null; instructions: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: auth }, { data: customer }, { data: row }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getUser().then(({ data }) => data.user ? supabase.from("customers").select("id").eq("user_id", data.user.id).maybeSingle() : { data: null }),
        serviceId ? supabase.from("digital_services").select("id,slug,name,category,description,price,duration,icon,logo_url,official_url,service_type,private_delivery_mode,is_free,active,help_video_url").eq("id", serviceId).eq("service_type", "private_shared").eq("active", true).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!cancelled) {
        setOwnerId(customer?.id ?? undefined);
        setService(row as Service | null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceId]);

  if (loading) return <main className="mx-auto max-w-3xl p-6 text-muted-foreground">Loading private subscription...</main>;
  if (!service) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Subscription unavailable</h1><p className="text-muted-foreground">This private subscription is unavailable or no longer active.</p><Button onClick={() => navigate(-1)}>Back</Button></main>;

  const image = service.logo_url || `https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=900&q=80`;
  return <main className="min-h-screen bg-[#f7f8fc] p-4 text-[#111936] sm:p-8"><div className="mx-auto max-w-5xl"><Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">← Back to services</Button><div className="grid gap-5 md:grid-cols-2"><section className="rounded-2xl border border-[#e1e4ef] bg-white p-5 shadow-sm"><img src={image} alt={service.name} className="aspect-[4/3] w-full rounded-xl object-cover" /><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Private subscription</p><h1 className="mt-2 text-3xl font-black">{service.name}</h1><p className="mt-3 text-sm leading-6 text-[#69708a]">{service.description || "Get reliable private access with your own dedicated subscription."}</p><div className="mt-5 rounded-xl border border-[#e1e4ef] bg-[#f7f8fc] p-4"><div className="flex items-center justify-between text-sm"><span>Price</span><strong>GHS {Number(service.price).toFixed(2)}</strong></div><div className="mt-3 flex items-center justify-between border-t border-[#e1e4ef] pt-3 text-sm"><span>Delivery</span><strong>Private access</strong></div></div></section><section className="rounded-2xl border border-[#e1e4ef] bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Order details</p><h2 className="mt-2 text-2xl font-black">Complete your order</h2><p className="mt-2 text-sm text-[#69708a]">Provide your details to proceed with your private subscription.</p><div className="mt-5 rounded-xl bg-[#eef2f8] p-4 text-sm leading-6 text-[#46506d]"><strong>Instructions</strong><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Choose Make purchase to open secure checkout.</li><li>Complete secure payment. No phone number or access code is required.</li><li>Return to this page after payment to see your assigned login and instructions.</li></ol></div><Button onClick={() => setPurchaseOpen(true)} className="mt-5 w-full bg-[#2864e8] hover:bg-[#1d52ca]">Make purchase — GHS {Number(service.price).toFixed(2)}</Button></section></div><section className="mt-5 rounded-2xl border border-[#e1e4ef] bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Product information</p><h2 className="mt-2 text-xl font-bold">Everything you need before you order</h2><p className="mt-3 text-sm leading-6 text-[#69708a]">Your private access is reserved for you, with fewer interruptions and more reliable access.</p></section>{access && <section className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700">Your assigned login</p><h2 className="mt-2 text-xl font-bold">Private access is ready</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-white p-3"><p className="text-xs text-emerald-700">Login</p><p className="font-semibold">{access.email || "Assigned by the provider"}</p></div>{access.password && <div className="rounded-lg bg-white p-3"><p className="text-xs text-emerald-700">Password</p><p className="font-semibold">{access.password}</p></div>}</div>{access.instructions && <p className="mt-4 whitespace-pre-line text-sm leading-6">{access.instructions}</p>}</section>}<ServicePurchaseDialog service={purchaseOpen ? service : null} ownerType="customer" ownerId={ownerId} onOpenChange={setPurchaseOpen} onPrivateAccessReady={(credential) => { setAccess(credential); setPurchaseOpen(false); }} /></div></main>;
}
