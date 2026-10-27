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
  const storefrontPrice = Number(searchParams.get("price"));
  const { toast } = useToast();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [paymentState, setPaymentState] = useState<{ status: "idle" | "checking" | "paid" | "pending" | "verification" | "error"; login?: string | null; password?: string | null; instructions?: string | null; verificationEmail?: string | null; assignmentId?: string | null; verificationRequestId?: string | null; verificationCode?: string | null }>({ status: "idle" });
  const [verificationLoading, setVerificationLoading] = useState(false);

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

  useEffect(() => {
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (!reference || searchParams.get("payment") !== "subscription") return;
    let cancelled = false;
    setPaymentState({ status: "checking" });

    const verifyPayment = async () => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        let data: any = null;
        let error: unknown = null;
        try {
          const response = await fetch("/api/private-share/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference }) });
          data = await response.json().catch(() => null);
          if (!response.ok && !data?.payment_confirmed) error = new Error(data?.error || "Verification failed");
        } catch (fetchError) {
          error = fetchError;
        }
        if (cancelled) return;
        // A 202 response can include payment_confirmed while the webhook is still
        // creating the subscription row. Do not discard that response as an error.
        if (data?.payment_confirmed) {
          if (data.credentials_ready) {
            setPaymentState({ status: "paid", login: data.login_identifier, password: data.login_password, instructions: data.customer_instructions });
            return;
          }
          if (data.verification_required && data.verification_email) {
            setPaymentState({ status: "verification", verificationEmail: data.verification_email, assignmentId: data.assignment_id, instructions: data.customer_instructions });
            return;
          }
          if (!data.retryable) {
            setPaymentState({ status: "pending", instructions: data.customer_instructions });
            return;
          }
        }
        lastError = error || new Error("Payment is not confirmed yet");
        if (attempt < 11) await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
      if (!cancelled) setPaymentState({ status: "pending", instructions: "Your payment was received. We are assigning your private slot and login details now. Keep this page open and check again shortly." });
    };
    void verifyPayment();
    return () => { cancelled = true; };
  }, [searchParams, serviceId]);

  const requestVerificationCode = async () => {
    if (!paymentState.assignmentId) return;
    setVerificationLoading(true);
    const { data, error } = await supabase.rpc("private_share_customer_request_code", { p_assignment_id: paymentState.assignmentId });
    setVerificationLoading(false);
    if (error) { toast({ title: "Verification request unavailable", description: error.message, variant: "destructive" }); return; }
    setPaymentState((current) => ({ ...current, status: "verification", verificationRequestId: data?.request_id || current.verificationRequestId }));
  };

  const pollVerificationCode = async () => {
    if (!paymentState.verificationRequestId) return;
    setVerificationLoading(true);
    const { data, error } = await supabase.rpc("private_share_customer_poll_code", { p_request_id: paymentState.verificationRequestId });
    setVerificationLoading(false);
    if (error) { toast({ title: "Could not check for the code", description: error.message, variant: "destructive" }); return; }
    if (data?.status === "ready") setPaymentState((current) => ({ ...current, verificationCode: data.code }));
    else toast({ title: "Code not received yet", description: "Return to the service, request the email code, then check again here." });
  };

  const startPaystackCheckout = async () => {
    if (!service) return;
    setPurchaseLoading(true);
    const amount = Number.isFinite(storefrontPrice) && storefrontPrice > 0 ? storefrontPrice : Number(service.price);
    const phone = `000000${Date.now().toString().slice(-4)}`;
    const email = `private-${service.id}-${Date.now()}@datapluggh.com`;
    const { data, error } = await supabase.functions.invoke("initialize-payment", {
      body: {
        email, amount, phone, access_pin: "0000", service_id: service.id,
        callback_url: `${window.location.origin}/private-subscription/${service.id}?payment=subscription`,
        metadata: { type: "service_payment", service_payment: true, service_id: service.id, service_name: service.name, service_type: "private_shared", private_delivery_mode: "onsite", source: searchParams.get("source") || "storefront", seller_store_kind: searchParams.get("seller_store_kind") || null, seller_store_id: searchParams.get("seller_store_id") || null, agent_store_id: searchParams.get("seller_store_kind") === "agent" ? searchParams.get("seller_store_id") : null, subagent_store_id: searchParams.get("seller_store_kind") === "subagent" ? searchParams.get("seller_store_id") : null, subsubagent_store_id: searchParams.get("seller_store_kind") === "subsubagent" ? searchParams.get("seller_store_id") : null },
      },
    });
    setPurchaseLoading(false);
    if (error || !data?.authorization_url) { toast({ title: "Payment unavailable", description: error?.message || data?.error || "Secure checkout could not be started.", variant: "destructive" }); return; }
    window.location.assign(data.authorization_url);
  };

  if (loading) return <main className="mx-auto max-w-3xl p-6 text-muted-foreground">Loading private subscription...</main>;
  if (!service) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Subscription unavailable</h1><p className="text-muted-foreground">This private subscription is unavailable or no longer active.</p><Button onClick={() => navigate(-1)}>Back</Button></main>;
  const image = service.logo_url || "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=900&q=80";
  const isNetflix = /netflix/i.test(service.name);
  return <main className="min-h-screen bg-[#f7f8fc] p-4 text-[#111936] sm:p-8"><div className="mx-auto max-w-5xl"><Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">← Back to services</Button><div className="grid gap-5 md:grid-cols-2"><section className="rounded-2xl border border-[#e1e4ef] bg-white p-5 shadow-sm"><img src={image} alt={service.name} className="aspect-[4/3] w-full rounded-xl object-cover" /><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Private subscription</p><h1 className="mt-2 text-3xl font-black">{service.name}</h1><p className="mt-3 text-sm leading-6 text-[#69708a]">{service.description || "Get reliable private access with your own dedicated subscription."}</p><div className="mt-5 rounded-xl border border-[#e1e4ef] bg-[#f7f8fc] p-4"><div className="flex items-center justify-between text-sm"><span>Price</span><strong>GHS {(Number.isFinite(storefrontPrice) && storefrontPrice > 0 ? storefrontPrice : Number(service.price)).toFixed(2)}</strong></div><div className="mt-3 flex items-center justify-between border-t border-[#e1e4ef] pt-3 text-sm"><span>Delivery</span><strong>Private access</strong></div></div></section><section className="rounded-2xl border border-[#e1e4ef] bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7161f4]">Order details</p><h2 className="mt-2 text-2xl font-black">Complete your order</h2><p className="mt-2 text-sm text-[#69708a]">Pay securely through Paystack. No wallet or customer account is required for storefront checkout.</p><div className="mt-5 rounded-xl bg-[#eef2f8] p-4 text-sm leading-6 text-[#46506d]"><strong>How it works</strong><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Open secure Paystack checkout.</li><li>Complete payment.</li><li>Return here to receive your private login and instructions.</li></ol>{isNetflix && <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-950"><strong>Netflix:</strong> Do not close this page. After your Netflix email is assigned, use that email to sign in, request the Netflix verification code, then return here to retrieve the code and complete login.</p>}</div>{paymentState.status === "checking" && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Payment received. Verifying your private access...</div>}
          {paymentState.status === "paid" && <div className="mt-5 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><strong>Your private login is ready</strong><div><span className="font-semibold">Email / username:</span> {paymentState.login}</div><div><span className="font-semibold">Password:</span> {paymentState.password}</div>{paymentState.instructions && <p className="border-t border-emerald-200 pt-3">{paymentState.instructions}</p>}</div>}
          {paymentState.status === "verification" && <div className="mt-5 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><strong>Email verification required</strong><p>Use this assigned email on {service.name}: <span className="font-semibold break-all">{paymentState.verificationEmail}</span></p><p>Return to the service and request the verification email. When you have requested the code, come back here and check for it.</p>{paymentState.verificationCode ? <div className="rounded-lg border border-blue-300 bg-white p-3 text-center"><span className="block text-xs font-semibold uppercase tracking-wide text-blue-700">Verification code</span><span className="text-2xl font-black tracking-[0.3em]">{paymentState.verificationCode}</span></div> : !paymentState.verificationRequestId ? <Button type="button" onClick={requestVerificationCode} disabled={verificationLoading} className="w-full bg-[#2864e8] hover:bg-[#1d52ca]">{verificationLoading ? "Preparing verification..." : "I requested the code — check here"}</Button> : <Button type="button" onClick={pollVerificationCode} disabled={verificationLoading} className="w-full bg-[#2864e8] hover:bg-[#1d52ca]">{verificationLoading ? "Checking..." : "Show verification code"}</Button>}{paymentState.instructions && <p className="border-t border-blue-200 pt-3">{paymentState.instructions}</p>}</div>}
          {paymentState.status === "pending" && <div className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>{isNetflix ? "Your Netflix private access is being prepared" : "Private access is being assigned"}</strong><p className="mt-1">Your payment is confirmed. {isNetflix ? "Your assigned Netflix email will appear here first. Keep this page open, use that email to request Netflix’s verification code, then return here to retrieve the code and finish signing in." : "Your private slot and login details will appear here as soon as the assignment finishes."}</p>{paymentState.instructions && <p className="border-t border-amber-200 pt-2">{paymentState.instructions}</p>}<Button type="button" onClick={() => window.location.reload()} className="w-full bg-amber-700 hover:bg-amber-800">Check assignment again</Button></div>}
          {paymentState.status === "error" && <div className="mt-5 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><strong>Payment verification is temporarily unavailable</strong><p>{paymentState.instructions || "We could not verify this payment yet. Keep your Paystack receipt and try again."}</p><Button type="button" onClick={() => window.location.reload()} className="w-full bg-red-700 hover:bg-red-800">Check payment again</Button></div>}
          {(paymentState.status === "idle" || paymentState.status === "error") && <Button onClick={startPaystackCheckout} disabled={purchaseLoading || paymentState.status === "checking"} className="mt-5 w-full bg-[#2864e8] hover:bg-[#1d52ca]">{purchaseLoading ? "Opening secure checkout..." : `Pay with Paystack — GHS ${(Number.isFinite(storefrontPrice) && storefrontPrice > 0 ? storefrontPrice : Number(service.price)).toFixed(2)}`}</Button>}</section></div></div></main>;
}
