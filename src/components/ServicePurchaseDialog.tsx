import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Service } from "./DigitalServicesCatalog";

const FEE = 1.98;
const youtubeEmbedUrl = (value?: string | null) => { if (!value) return null; try { const url = new URL(value); if (url.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${url.pathname.slice(1)}`; const id = url.searchParams.get("v"); return id ? `https://www.youtube.com/embed/${id}` : null; } catch { return null; } };

export default function ServicePurchaseDialog({ service, onOpenChange }: { service: Service | null; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [activationLoading, setActivationLoading] = useState(false);
  const [showPin, setShowPin] = useState(true);
  const [credential, setCredential] = useState<{ email: string | null; password: string | null; instructions: string | null } | null>(null);
  const total = Math.round((Number(service?.price || 0) * (1 + FEE / 100)) * 100) / 100;

  const activate = async () => {
    if (!service || !/^\d{10}$/.test(phone) || !/^\d{4}$/.test(pin)) {
      toast({ title: "Check your details", description: "Enter the phone and 4-digit access code used at checkout.", variant: "destructive" });
      return;
    }
    setActivationLoading(true);
    const { data, error } = await supabase.functions.invoke("activate-service", { body: { service_id: service.id, phone, pin, free_service: service.is_free === true } });
    setActivationLoading(false);
    if (error || !data?.credential) {
      console.error("[v0] Service activation failed:", error || data); toast({ title: "Access unavailable", description: data?.error || error?.message || "We could not create or find access for this service. Please try again.", variant: "destructive" });
      return;
    }
    setCredential(data.credential);
  };

  const submit = async () => {
    if (!service || !/^\d{10}$/.test(phone) || !/^\d{4}$/.test(pin)) {
      toast({ title: "Check your details", description: "Enter a 10-digit phone number and a 4-digit access code.", variant: "destructive" });
      return;
    }
    const price = Number(service.price);
    if (service.is_free) { await activate(); return; }
    if (!Number.isFinite(price) || price <= 0) { toast({ title: "Payment unavailable", description: "This service has no valid price yet. Please choose another service or ask an admin to set its price.", variant: "destructive" }); return; }
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase.functions.invoke("initialize-payment", { body: {
      amount: total,
      email: `${phone}@dataplug.store`,
      phone,
      service_id: service.id,
      service_name: service.name,
      service_type: service.service_type,
      access_pin: pin,
      customer_phone: phone,
      callback_url: `${window.location.origin}/packages?service_payment=verifying`,
      metadata: { type: "service_payment", service_id: service.id, service_name: service.name, service_type: service.service_type, customer_phone: phone, access_pin: pin, customer_id: auth.user?.id || null, service_payment: true },
    }});
    setLoading(false);
    if (error || !data?.authorization_url) {
      let detail = data?.error || error?.message || "We could not start payment. Please try again.";
      const context = (error as any)?.context;
      if (context && typeof context.clone === "function") { const body = await context.clone().json().catch(() => null); detail = body?.error || body?.message || detail; }
      console.error("[v0] Service payment initialization failed:", error || data);
      toast({ title: "Payment unavailable", description: detail, variant: "destructive" });
      return;
    }
    window.location.assign(data.authorization_url);
  };

  return <Dialog open={!!service} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{service?.name}</DialogTitle><DialogDescription>Pay first. After verified payment, your assigned login will be available using your phone number and 4-digit access code.</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-lg bg-muted p-3 text-sm"><div className="flex justify-between"><span>Service price</span><span>GHC {Number(service?.price || 0).toFixed(2)}</span></div><div className="flex justify-between"><span>Paystack charge</span><span>GHC {(total - Number(service?.price || 0)).toFixed(2)}</span></div><div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total</span><span>GHC {total.toFixed(2)}</span></div></div><div className="space-y-2"><Label htmlFor="service-phone">Phone number</Label><Input id="service-phone" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} /></div><div className="space-y-2"><Label htmlFor="service-pin">Create 4-digit access code</Label><div className="relative"><Input id="service-pin" className="pr-11" inputMode="numeric" maxLength={4} type={showPin ? "text" : "password"} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /><button type="button" aria-label={showPin ? "Hide access code" : "Show access code"} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground" onClick={() => setShowPin((visible) => !visible)}>{showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>{youtubeEmbedUrl(service?.help_video_url) && <details className="overflow-hidden rounded-lg border"><summary className="cursor-pointer px-3 py-2 text-sm font-medium">How to use this service</summary><div className="aspect-video w-full bg-muted"><iframe title={`${service?.name} help video`} src={youtubeEmbedUrl(service?.help_video_url) || undefined} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div></details>}<Button className="w-full" onClick={() => void submit()} disabled={loading || (!service?.is_free && Number(service?.price || 0) <= 0)}>{loading ? "Preparing…" : service?.is_free ? "Get free access" : Number(service?.price || 0) <= 0 ? "Price unavailable" : `Pay GHC ${total.toFixed(2)}`}</Button><div className="border-t pt-4"><p className="mb-3 text-sm font-medium">Already paid? Activate your access</p><Button variant="outline" className="w-full" onClick={() => void activate()} disabled={activationLoading}>{activationLoading ? "Checking access…" : "Activate service"}</Button></div>{credential && <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><p className="font-semibold">Your assigned access</p><p><span className="font-medium">Email:</span> {credential.email || "Not provided"}</p><p><span className="font-medium">Password:</span> {credential.password || "Not provided"}</p>{credential.instructions && <p className="text-muted-foreground">{credential.instructions?.split(/(https?:\/\/[^\s]+)/g).map((part, index) => /^https?:\/\//.test(part) ? <a key={index} href={part} target="_blank" rel="noreferrer" className="text-primary underline">{part}</a> : part)}</p>}</div>}</div></DialogContent></Dialog>;
}
