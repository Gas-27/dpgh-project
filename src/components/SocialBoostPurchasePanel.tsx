import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Props = { walletBalance: number; ownerType?: string };
const platforms = ["TikTok", "Instagram", "Snapchat", "Facebook", "YouTube", "WhatsApp"];
const servicesByPlatform: Record<string, string[]> = {
  TikTok: ["TikTok Followers", "TikTok Likes", "TikTok Views", "TikTok Shares"],
  Instagram: ["Instagram Followers", "Instagram Likes", "Instagram Views", "Instagram Comments"],
  Snapchat: ["Snapchat Followers", "Snapchat Views", "Snapchat Subscribers"],
  Facebook: ["Facebook Followers", "Facebook Likes", "Facebook Views", "Facebook Comments"],
  YouTube: ["YouTube Subscribers", "YouTube Views", "YouTube Likes", "YouTube Comments"],
  WhatsApp: ["WhatsApp Channel Followers", "WhatsApp Post Views", "WhatsApp Reactions"],
};

export default function SocialBoostPurchasePanel({ walletBalance, ownerType = "user" }: Props) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("TikTok");
  const [service, setService] = useState("TikTok Followers");
  const [targetLink, setTargetLink] = useState("");
  const [quantity, setQuantity] = useState(50);
  const [price, setPrice] = useState(49);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [orderId, setOrderId] = useState("");
  const services = servicesByPlatform[platform] ?? servicesByPlatform.TikTok;

  useEffect(() => {
    setService(services[0]);
  }, [platform]);

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

  const total = useMemo(() => Math.round((quantity / 1000) * price * 100) / 100, [quantity, price]);
  const buy = async () => {
    if (!targetLink.trim()) return toast({ title: "Account link required", description: "Enter the social profile or post link to boost.", variant: "destructive" });
    if (quantity < 50 || quantity > 50000) return toast({ title: "Invalid quantity", description: "Quantity must be between 50 and 50,000.", variant: "destructive" });
    setBuying(true);
    const { data, error } = await (supabase as any).rpc("purchase_social_boost", { p_platform: platform, p_service: service, p_target_link: targetLink.trim(), p_quantity: quantity });
    setBuying(false);
    if (error) return toast({ title: "Purchase failed", description: error.message.includes("Insufficient") ? "Insufficient wallet balance." : error.message, variant: "destructive" });
    setOrderId(data?.id ?? "");
    toast({ title: "Social Boost order placed", description: `GHC ${Number(data?.amount ?? total).toFixed(2)} was deducted from your wallet.` });
  };

  return <section className="space-y-5 rounded-2xl border border-cyan-400/60 bg-[#061326] p-4 text-white shadow-[0_0_30px_rgba(0,160,255,.18)] sm:p-6">
    <div className="rounded-2xl border border-blue-400/70 bg-gradient-to-br from-[#105bc8] via-[#073b91] to-[#7b0ed9] p-5 shadow-[0_0_28px_rgba(0,160,255,.25)]"><span className="inline-flex rounded-full bg-cyan-400/25 px-3 py-1 text-xs font-bold text-cyan-100">Grow Your Presence</span><h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Social <span className="text-cyan-300">Boost</span></h2><p className="mt-2 max-w-xl text-sm leading-6 text-blue-50">Boost your social across TikTok, Instagram, Snapchat, Facebook, YouTube and WhatsApp with targeted engagement.</p><div className="mt-4 grid grid-cols-3 gap-2 text-xs text-blue-50"><span>More followers</span><span>More engagement</span><span>More growth</span></div></div><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Social Boost Purchase</h2><p className="text-sm text-blue-100/70">Wallet balance: GHC {Number(walletBalance).toFixed(2)}</p></div><span className="rounded-full bg-cyan-400/15 px-3 py-1 text-sm font-bold text-cyan-200">GHC {total.toFixed(2)}</span></div>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{platforms.map((item) => <button type="button" key={item} onClick={() => setPlatform(item)} className={`rounded-xl border p-2 text-xs font-semibold ${platform === item ? "border-cyan-300 bg-blue-500/30" : "border-blue-500/50 bg-[#061326]"}`}>{platform === item && <Check className="mx-auto mb-1 h-4 w-4 text-cyan-300" />}{item}</button>)}</div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="relative block text-sm font-semibold">Service<select value={service} onChange={(event) => setService(event.target.value)} className="mt-2 w-full appearance-none rounded-xl border border-blue-500 bg-[#061326] px-3 py-3 font-normal"><option>{services[0]}</option>{services.slice(1).map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 bottom-3 h-4 w-4" /></label><label className="text-sm font-semibold">Quantity<Input className="mt-2 border-blue-500 bg-[#061326]" type="number" min={50} max={50000} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><span className="text-xs font-normal text-blue-100/70">Minimum 50, maximum 50,000</span></label></div>
    <label className="block text-sm font-semibold">Account or content link<Input className="mt-2 border-blue-500 bg-[#061326]" value={targetLink} onChange={(event) => setTargetLink(event.target.value)} placeholder={`https://${platform.toLowerCase()}.com/yourusername`} /></label>
    <Button type="button" onClick={buy} disabled={buying || loading} className="w-full bg-gradient-to-r from-cyan-500 to-violet-600 font-bold">{buying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" />} Purchase with wallet</Button>
    {orderId && <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">Order placed successfully. Order ID: {orderId}</p>}
  </section>;
}
