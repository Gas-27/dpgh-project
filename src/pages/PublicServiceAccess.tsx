import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Copy, Eye, EyeOff, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Service } from "@/components/DigitalServicesCatalog";

type Credential = { email: string | null; password: string | null; instructions: string | null };

const youtubeEmbedUrl = (value?: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    const id = url.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
};

export default function PublicServiceAccess() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const initialAccess = location.state as { credential?: Credential; credentials?: Credential[] } | null;
  const [credentials, setCredentials] = useState<Credential[]>(initialAccess?.credentials || (initialAccess?.credential ? [initialAccess.credential] : []));
  const credential = credentials[0] || null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = serviceId
        ? await supabase.from("digital_services").select("id,slug,name,category,description,price,duration,icon,logo_url,official_url,service_type,private_delivery_mode,is_free,active,help_video_url").eq("id", serviceId).eq("service_type", "public_shared").eq("active", true).maybeSingle()
        : { data: null };
      if (!cancelled) { setService(data as Service | null); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [serviceId]);

  useEffect(() => {
    if (searchParams.get("service_payment") !== "verifying" || !serviceId) return;
    const pendingRaw = sessionStorage.getItem("pending_service_payment");
    const reference = pendingRaw ? (JSON.parse(pendingRaw) as { reference?: string }).reference : null;
    if (!reference) return;
    let cancelled = false;
    supabase.functions.invoke("verify-payment", { body: { reference } }).then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || data?.error) { setError(data?.error || "Payment could not be verified yet. Please try again."); return; }
      sessionStorage.removeItem("pending_service_payment");
      const pending = pendingRaw ? JSON.parse(pendingRaw) as { phone?: string; pin?: string } : {};
      const accessResult = await supabase.functions.invoke("activate-service", { body: { service_id: serviceId, phone: pending.phone, pin: pending.pin } });
      if (accessResult.error || (!accessResult.data?.credential && !accessResult.data?.credentials?.length)) { setError(accessResult.data?.error || "Payment was confirmed, but access details are not ready yet."); return; }
      setPhone(pending.phone || "");
      setPin(pending.pin || "");
      setCredentials(accessResult.data.credentials || (accessResult.data.credential ? [accessResult.data.credential] : []));
    });
    return () => { cancelled = true; };
  }, [searchParams, serviceId]);

  const unlock = async () => {
    if (!service) return;
    if (!/^\d{10}$/.test(phone) || !/^\d{4}$/.test(pin)) {
      setError("Enter your 10-digit phone number and 4-digit access code.");
      return;
    }
    setError(null);
    setUnlocking(true);
    const result = await supabase.functions.invoke("activate-service", { body: { service_id: service.id, phone, pin, free_service: service.is_free === true } });
    setUnlocking(false);
    if (result.error || (!result.data?.credential && !result.data?.credentials?.length)) {
      let detail: string = result.data?.error || "";
      const context = (result.error as { context?: Response } | null)?.context;
      if (!detail && context?.clone) {
        const body = await context.clone().json().catch(() => null);
        detail = body?.error || body?.message || "";
      }
      setError(detail || "No paid access was found for these details. Please make payment first.");
      return;
    }
    setCredentials(result.data.credentials || (result.data.credential ? [result.data.credential] : []));
  };

  const copy = async (value: string | null, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast({ title: `${label} copied` });
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 text-muted-foreground">Loading service...</main>;
  if (!service) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">Service unavailable</h1>
        <p className="text-muted-foreground">This service is unavailable or no longer active.</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </main>
    );
  }

  const image = service.logo_url || "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=900&q=80";
  const helpUrl = youtubeEmbedUrl(service.help_video_url);

  return (
    <main className="min-h-screen bg-[#f7f8fc] p-4 text-[#111936] sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">← Back to services</Button>
        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-[#e1e4ef] bg-white p-5 shadow-sm">
            <img src={image} alt={service.name} className="aspect-[4/3] w-full rounded-xl object-cover" />
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Public share</p>
            <h1 className="mt-2 text-3xl font-black text-balance">{service.name}</h1>
            <p className="mt-3 text-sm leading-6 text-[#69708a]">{service.description || "Access your shared service login here."}</p>
            <div className="mt-5 rounded-xl border border-[#e1e4ef] bg-[#f7f8fc] p-4">
              <div className="flex items-center justify-between text-sm"><span>Price</span><strong>{service.is_free ? "Free" : `GHS ${Number(service.price).toFixed(2)}`}</strong></div>
              <div className="mt-3 flex items-center justify-between border-t border-[#e1e4ef] pt-3 text-sm"><span>Delivery</span><strong>Shared login</strong></div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e4ef] bg-white p-5 shadow-sm">
            {credential ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Your access</p>
                <h2 className="mt-2 text-2xl font-black">Your login is ready</h2>
                <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p className="font-bold">⚠️ Please don&apos;t make any changes to the account.</p><p><span className="font-semibold">ℹ️ This is a shared account, so it might show as busy and may log out frequently.</span> You can purchase a private share plan at a very cheap cost to avoid these issues and enjoy uninterrupted access.</p></div><p className="mt-4 text-sm leading-6 text-[#69708a]">Use any of the shared logins below. Public share has no individual slot assignment or per-customer slot limit.</p>
                <div className="mt-5 space-y-3">
                  {credentials.map((item, index) => <div key={`${item.email || "login"}-${index}`} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                    <p className="mb-3 font-bold">Shared login {index + 1}</p>
                    <div className="flex items-center justify-between gap-2"><div className="min-w-0"><span className="font-semibold">Email / username:</span> <span className="break-all">{item.email}</span></div><Button type="button" size="icon" variant="ghost" aria-label={`Copy email ${index + 1}`} onClick={() => copy(item.email, "Email")}><Copy className="h-4 w-4" /></Button></div>
                    <div className="mt-2 flex items-center justify-between gap-2"><div className="min-w-0"><span className="font-semibold">Password:</span> <span className="break-all">{item.password}</span></div><Button type="button" size="icon" variant="ghost" aria-label={`Copy password ${index + 1}`} onClick={() => copy(item.password, "Password")}><Copy className="h-4 w-4" /></Button></div>
                    {item.instructions && <p className="mt-3 border-t border-emerald-200 pt-3 leading-6">{item.instructions}</p>}
                    {service.official_url && <Button asChild className="mt-4 w-full bg-[#2864e8] hover:bg-[#1d52ca]"><a href={service.official_url} target="_blank" rel="noopener noreferrer">Open {service.name}</a></Button>}
                  </div>)}
                </div>
                {helpUrl && <iframe title={`${service.name} help video`} src={helpUrl} className="mt-4 aspect-video w-full rounded-xl" allowFullScreen />}
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Secure access</p>
                <h2 className="mt-2 flex items-center gap-2 text-2xl font-black"><Lock className="h-5 w-5" aria-hidden="true" />Enter your details</h2>
                <p className="mt-2 text-sm leading-6 text-[#69708a]">Enter the phone number and 4-digit access code you used when paying. After payment, you will see all shared emails and login details here.</p>
                <div className="mt-5 space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="access-phone">Phone number</Label>
                    <Input id="access-phone" inputMode="numeric" maxLength={10} placeholder="0241234567" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="access-pin">4-digit access code</Label>
                    <div className="relative">
                      <Input id="access-pin" inputMode="numeric" maxLength={4} type={showPin ? "text" : "password"} placeholder="0000" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) unlock(); }} />
                      <button type="button" aria-label={showPin ? "Hide access code" : "Show access code"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#69708a]" onClick={() => setShowPin(!showPin)}>
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
                  <Button onClick={unlock} disabled={unlocking} className="w-full bg-[#2864e8] hover:bg-[#1d52ca]">{unlocking ? "Checking payment..." : "View my service"}</Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
