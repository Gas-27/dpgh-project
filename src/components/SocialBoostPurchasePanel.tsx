import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Props = { walletBalance: number; ownerType?: string };
const platforms = ["TikTok", "Instagram", "Snapchat", "Facebook", "YouTube", "WhatsApp"];
type ProviderService = { service: number; name: string; category: string; rate: string; min: string; max: string; average?: string; average_time?: string; refill?: boolean; cancel?: boolean };
const fallbackServices: ProviderService[] = [{ service: 1, name: "Followers", category: "TikTok", rate: "0.90", min: "50", max: "10000", refill: true, cancel: true }];

export default function SocialBoostPurchasePanel({ walletBalance, ownerType = "user" }: Props) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("TikTok");
  const [catalog, setCatalog] = useState<ProviderService[]>(fallbackServices);
  const [service, setService] = useState<ProviderService>(fallbackServices[0]);
  const [targetLink, setTargetLink] = useState("");
  const [quantity, setQuantity] = useState(50);
  const [price, setPrice] = useState(49);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [orderId, setOrderId] = useState("");
  const platformAliases: Record<string, string[]> = { TikTok: ["tiktok", "tiktok"], Instagram: ["instagram"], Snapchat: ["snapchat"], Facebook: ["facebook"], YouTube: ["youtube", "you tube"], WhatsApp: ["whatsapp", "whats app"] };
  const aliases = platformAliases[platform] ?? [platform.toLowerCase()];
  const services = catalog.filter((item) => aliases.some((alias) => `${item.category} ${item.name}`.toLowerCase().includes(alias)));
  const visibleServices = services.length > 0 ? services : catalog;

  useEffect(() => {
    let mounted = true;
    supabase.functions.invoke("social-boost", { body: { action: "services" } }).then(({ data, error }) => {
      if (!mounted) return;
      if (!error && Array.isArray(data) && data.length > 0) setCatalog(data);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const next = visibleServices[0] ?? fallbackServices[0];
    setService(next);
    setQuantity(Math.max(50, Number(next.min)));
  }, [platform, catalog]);

  useEffect(() => {
    let mounted = true;
    (supabase as any).from("social_boost_pricing").select("admin_price_per_1000,agent_price_per_1000,subagent_price_per_1000,sub_subagent_price_per_1000").eq("id", true).maybeSingle().then(({ data, error }: any) => {
      if (!mounted) return;
      if (error) toast({ title: "Pricing unavailable", description: error.message, variant: "destructive" });
      const key = ownerType === "agent" ? "agent_price_per_1000" : ownerType === "subagent" ? "subagent_price_per_1000" : ownerType === "sub_subagent" ? "sub_subagent_price_per_1000" : "admin_price_per_1000";
      setPrice(Number(data?.[key] ?? 49));
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [ownerType, toast]);

  useEffect(() => {
    let mounted = true;
    (supabase as any).from("social_boost_service_pricing").select("admin_price_per_1000").eq("service_id", service.service).maybeSingle().then(({ data }: any) => {
      if (mounted && data?.admin_price_per_1000 != null) setPrice(Number(data.admin_price_per_1000));
    });
    return () => { mounted = false; };
  }, [service.service]);

  const providerRate = Number(service.rate) || 0;
  const total = useMemo(() => Math.round((quantity / 1000) * (price || providerRate) * 100) / 100, [quantity, price, providerRate]);
  const buy = async () => {
    if (!targetLink.trim()) return toast({ title: "Account link required", description: "Enter the social profile or post link to boost.", variant: "destructive" });
    const minimum = Number(service.min) || 10;
    const maximum = Number(service.max) || 50000;
    if (quantity < minimum || quantity > maximum) return toast({ title: "Invalid quantity", description: `This service accepts ${minimum.toLocaleString()} to ${maximum.toLocaleString()}.`, variant: "destructive" });
  setBuying(true);
  const provider = await supabase.functions.invoke("social-boost", { body: { action: "add", service: service.service, link: targetLink.trim(), quantity } });
  if (provider.error || !provider.data?.order) {
    setBuying(false);
    return toast({ title: "Provider order failed", description: provider.error?.message ?? provider.data?.error ?? "ExoBoost did not accept this order.", variant: "destructive" });
  }
  const { data, error } = await (supabase as any).rpc("purchase_social_boost", { p_platform: platform, p_service: `${service.service}:${service.name}`, p_target_link: targetLink.trim(), p_quantity: quantity });
    setBuying(false);
    if (error) return toast({ title: "Purchase failed", description: error.message.includes("Insufficient") ? "Insufficient wallet balance." : error.message, variant: "destructive" });
    setOrderId(data?.id ?? "");
    toast({ title: "Social Boost order placed", description: `GHC ${Number(data?.amount ?? total).toFixed(2)} was deducted from your wallet.` });
  };

  return <section className="space-y-5 rounded-2xl border border-cyan-400/60 bg-[#061326] p-4 text-white shadow-[0_0_30px_rgba(0,160,255,.18)] sm:p-6">
    <div className="rounded-2xl border border-blue-400/70 bg-gradient-to-br from-[#105bc8] via-[#073b91] to-[#7b0ed9] p-5 shadow-[0_0_28px_rgba(0,160,255,.25)]"><span className="inline-flex rounded-full bg-cyan-400/25 px-3 py-1 text-xs font-bold text-cyan-100">Grow Your Presence</span><h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Social <span className="text-cyan-300">Boost</span></h2><p className="mt-2 max-w-xl text-sm leading-6 text-blue-50">Boost your social across TikTok, Instagram, Snapchat, Facebook, YouTube and WhatsApp with targeted engagement.</p><div className="mt-4 grid grid-cols-3 gap-2 text-xs text-blue-50"><span>More followers</span><span>More engagement</span><span>More growth</span></div></div><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Social Boost Purchase</h2><p className="text-sm text-blue-100/70">Wallet balance: GHC {Number(walletBalance).toFixed(2)}</p></div><span className="rounded-full bg-cyan-400/15 px-3 py-1 text-sm font-bold text-cyan-200">GHC {total.toFixed(2)}</span></div>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{platforms.map((item) => <button type="button" key={item} onClick={() => setPlatform(item)} className={`rounded-xl border p-2 text-xs font-semibold ${platform === item ? "border-cyan-300 bg-blue-500/30" : "border-blue-500/50 bg-[#061326]"}`}>{platform === item && <Check className="mx-auto mb-1 h-4 w-4 text-cyan-300" />}{item}</button>)}</div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="relative block text-sm font-semibold">Service<select value={service.service} onChange={(event) => setService(visibleServices.find((item) => item.service === Number(event.target.value)) ?? fallbackServices[0])} className="mt-2 w-full appearance-none rounded-xl border border-blue-500 bg-[#061326] px-3 py-3 font-normal">{visibleServices.map((item) => <option key={item.service} value={item.service}>{item.name} · {item.rate} / 1K</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 bottom-3 h-4 w-4" /></label><label className="text-sm font-semibold">Quantity<Input className="mt-2 border-blue-500 bg-[#061326]" type="number" min={Number(service.min) || 50} max={Number(service.max) || 50000} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><span className="text-xs font-normal text-blue-100/70">Minimum {Number(service.min || 10).toLocaleString()}, maximum {Number(service.max || 50000).toLocaleString()}</span></label></div>
    <div className="grid gap-3 rounded-xl border border-blue-500/60 bg-blue-950/40 p-3 text-sm sm:grid-cols-3"><span>Provider rate <strong>${Number(service.rate || 0).toFixed(3)} / 1K</strong></span><span>Average time <strong>{service.average_time || service.average || "Provider estimate"}</strong></span><span>Features <strong>{service.refill ? "Refill" : "Standard"}{service.cancel ? " · Cancel" : ""}</strong></span></div>
    <label className="block text-sm font-semibold">Account or content link<Input className="mt-2 border-blue-500 bg-[#061326]" value={targetLink} onChange={(event) => setTargetLink(event.target.value)} placeholder={`https://${platform.toLowerCase()}.com/yourusername`} /></label>
    <Button type="button" onClick={buy} disabled={buying || loading} className="w-full bg-gradient-to-r from-cyan-500 to-violet-600 font-bold">{buying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" />} Purchase with wallet</Button>
    {orderId && <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">Order placed successfully. Order ID: {orderId}</p>}
  </section>;
}
