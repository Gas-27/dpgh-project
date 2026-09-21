import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  Layers,
  Lightbulb,
  Link2,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Props = { walletBalance: number; ownerType?: string; canSetPrices?: boolean; checkoutMode?: "wallet" | "paystack" };
type ProviderService = { service: number; name: string; category: string; rate: string; min: string; max: string; average?: string; average_time?: string; note?: string; notes?: string; refill?: boolean; cancel?: boolean };

const platforms = ["TikTok", "Instagram", "Facebook", "YouTube", "WhatsApp"];
const platformIcons: Record<string, string> = {
  TikTok: "https://cdn.simpleicons.org/tiktok",
  Instagram: "https://cdn.simpleicons.org/instagram/white",
  Facebook: "https://cdn.simpleicons.org/facebook/white",
  YouTube: "https://cdn.simpleicons.org/youtube/white",
  WhatsApp: "https://cdn.simpleicons.org/whatsapp/white",
};
const platformTileBg: Record<string, string> = {
  TikTok: "bg-black",
  Instagram: "bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400",
  Facebook: "bg-blue-600",
  YouTube: "bg-red-600",
  WhatsApp: "bg-green-500",
};
const fallbackServices: ProviderService[] = [{ service: 1, name: "Followers", category: "TikTok", rate: "0.90", min: "50", max: "50000", average_time: "4 Hours", refill: true, cancel: true }];

export default function SocialBoostPurchasePanel({ walletBalance, ownerType = "user", canSetPrices = false, checkoutMode = "wallet" }: Props) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState("TikTok");
  const [catalog, setCatalog] = useState<ProviderService[]>(fallbackServices);
  const [service, setService] = useState(fallbackServices[0]);
  const [serviceType, setServiceType] = useState(fallbackServices[0].name);
  const [targetLink, setTargetLink] = useState("");
  const [quantity, setQuantity] = useState(50);
  const [price, setPrice] = useState(49);
  const [searchOrder, setSearchOrder] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [buying, setBuying] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [resellerPrices, setResellerPrices] = useState<Record<number, number>>({});
  const [resellerCaps, setResellerCaps] = useState<Record<number, number>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  const platformServices = catalog.filter((item) => item.category.toLowerCase().includes(platform.toLowerCase()));
  const services = platformServices.length ? platformServices : catalog;
  const serviceCategories = Array.from(new Set(services.map((item) => item.category.trim()))).filter(Boolean);
  const selectedCategory = service?.category ?? serviceCategories[0] ?? platform;
  const categoryServices = services.filter((item) => item.category === selectedCategory);
  const serviceTypes = Array.from(new Set(categoryServices.map((item) => item.name.trim()))).filter(Boolean);

  useEffect(() => {
    let mounted = true;
    supabase.functions.invoke("social-boost", { body: { action: "services" } }).then(({ data }) => {
      if (mounted && Array.isArray(data) && data.length) setCatalog(data);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const next = services.find((item) => item.category === selectedCategory && item.name === serviceType) ?? categoryServices[0] ?? services[0] ?? fallbackServices[0];
    setService(next);
    setServiceType(next.name);
    setQuantity(Number(next.min) || 50);
  }, [platform, catalog, selectedCategory]);

  useEffect(() => {
    if (!serviceTypes.includes(serviceType)) setServiceType(serviceTypes[0] ?? fallbackServices[0].name);
  }, [serviceTypes, serviceType]);

  useEffect(() => {
    let mounted = true;
    (supabase as any)
      .from("social_boost_service_pricing")
      .select("admin_price_per_1000,default_price_per_1000,max_reseller_price_per_1000,min_quantity,max_quantity,average_completion_time,notes")
      .eq("service_id", service.service)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!mounted) return;
        setPrice(Number(data?.admin_price_per_1000 || data?.default_price_per_1000 || service.rate || 49));
        setService((current) => ({
          ...current,
          min: String(data?.min_quantity ?? current.min),
          max: String(data?.max_quantity ?? current.max),
          average_time: data?.average_completion_time ?? current.average_time,
          notes: data?.notes ?? current.notes,
        }));
        setResellerCaps((current) => ({ ...current, [service.service]: Number(data?.max_reseller_price_per_1000 || 0) }));
      });
    return () => { mounted = false; };
  }, [service.service, service.rate]);

  useEffect(() => {
    if (!canSetPrices) return;
    (supabase as any).from("social_boost_reseller_pricing").select("service_id,price_per_1000").then(({ data }: any) => {
      if (Array.isArray(data)) setResellerPrices(Object.fromEntries(data.map((row: any) => [row.service_id, Number(row.price_per_1000)])));
    });
  }, [canSetPrices]);

  const min = Number(service.min) || 10;
  const max = Number(service.max) || 50000;
  const total = useMemo(() => Math.round((quantity / 1000) * price * 100) / 100, [quantity, price]);

  const buy = async () => {
    if (!targetLink.trim()) return toast({ title: "Account link required", description: "Enter the social profile or post link to boost.", variant: "destructive" });
    if (quantity < min || quantity > max) return toast({ title: "Invalid quantity", description: `This service accepts ${min.toLocaleString()} to ${max.toLocaleString()}.`, variant: "destructive" });
    setBuying(true);
    if (checkoutMode === "paystack") {
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: {
          email: `social_boost_${Date.now()}@datapluggh.com`,
          amount: total,
          callback_url: `${window.location.origin}/social-boost?payment=success`,
          metadata: { kind: "social_boost", platform, service_id: service.service, service_name: service.name, target_link: targetLink.trim(), quantity },
        },
      });
      setBuying(false);
      if (error || !data?.authorization_url) return toast({ title: "Payment could not start", description: error?.message ?? "Paystack did not return a checkout link.", variant: "destructive" });
      window.location.assign(data.authorization_url);
      return;
    }
    const { data: provider, error: providerError } = await supabase.functions.invoke("social-boost", { body: { action: "add", service: service.service, link: targetLink.trim(), quantity } });
    if (providerError || !provider?.order) {
      setBuying(false);
      return toast({ title: "Social Boost provider rejected the order", description: providerError?.message ?? provider?.error ?? "The provider did not return an order ID.", variant: "destructive" });
    }
    const { data, error } = await (supabase as any).rpc("purchase_social_boost", {
      p_platform: platform,
      p_service: `${service.service}:${service.name}`,
      p_target_link: targetLink.trim(),
      p_quantity: quantity,
      p_provider_order_id: String(provider.order),
    });
    setBuying(false);
    if (error) return toast({ title: "Wallet purchase failed", description: error.message, variant: "destructive" });
    setOrderId(String(data?.order_number ?? data?.id ?? ""));
    toast({ title: "Social Boost order placed", description: `Order #${data?.order_number ?? data?.id} sent to the provider. GHC ${Number(data?.amount ?? total).toFixed(2)} was deducted from your wallet.` });
  };

  const trackOrder = async () => {
    if (!searchOrder.trim()) return;
    const { data: local, error: localError } = await (supabase as any)
      .from("social_boost_orders")
      .select("order_number,created_at,target_link,amount,quantity,service,provider_order_id,provider_status,start_count,remains")
      .eq("order_number", Number(searchOrder.trim()))
      .maybeSingle();
    if (localError || !local) return setOrderStatus(localError?.message ?? "Order not found");
    const providerOrder = local.provider_order_id ?? searchOrder.trim();
    const { data, error } = await supabase.functions.invoke("social-boost", { body: { action: "status", order: providerOrder } });
    if (error) return setOrderStatus(error.message);
    const latest = { ...local, ...(data ?? {}), provider_status: data?.status ?? local.provider_status };
    setTrackedOrder(latest);
    setOrderStatus(data?.status ? `Status: ${data.status}` : data?.error ?? "Order status unavailable");
  };

  const saveResellerPrices = async () => {
    setSavingPrices(true);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      setSavingPrices(false);
      return toast({ title: "Sign in required", description: "Sign in before saving reseller prices.", variant: "destructive" });
    }
    const rows = services.map((item) => ({
      user_id: userId,
      service_id: item.service,
      price_per_1000: Math.min(resellerPrices[item.service] ?? price, resellerCaps[item.service] || Number.MAX_SAFE_INTEGER),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await (supabase as any).from("social_boost_reseller_pricing").upsert(rows, { onConflict: "user_id,service_id" });
    setSavingPrices(false);
    toast(error ? { title: "Prices not saved", description: error.message, variant: "destructive" } : { title: "Social Boost prices saved" });
  };

const noteLines = String(service.notes || service.note || "No additional note has been configured for this service.")
  .split(/\r?\n|•|\|/)
  .map((line) => line.trim())
  .filter(Boolean);

  return (
    <section className="social-boost-phone-shell space-y-3 rounded-[22px] bg-[#020c22] p-3 text-white sm:p-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-[#0b3fb4] via-[#0a2f8f] to-[#3a0f8f] p-5 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_25%,rgba(56,189,248,0.35),transparent_55%)]" />
        <div className="relative z-10 max-w-full sm:max-w-[56%]">
          <span className="inline-flex items-center rounded-full bg-blue-500 px-4 py-1.5 text-xs font-bold sm:text-sm">Grow Your Presence</span>
          <h1 className="mt-3 text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl">
            Social <span className="text-cyan-300">Boost</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-blue-50/90 sm:text-base">
            Boost all your social across TikTok, Instagram, Facebook, YouTube and WhatsApp with real, targeted engagement.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold sm:gap-6 sm:text-sm">
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20"><Zap className="h-4 w-4 text-cyan-300" /></span>
              More Followers
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20"><TrendingUp className="h-4 w-4 text-cyan-300" /></span>
              More Engagement
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20"><Users className="h-4 w-4 text-cyan-300" /></span>
              More Growth
            </span>
          </div>
        </div>
        <div className="relative z-10 mt-6 flex justify-center sm:absolute sm:right-4 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 sm:justify-end">
          <div className="relative h-40 w-40 sm:h-56 sm:w-56">
            <div className="absolute inset-0 rounded-full border border-cyan-400/40" />
            <div className="absolute inset-4 rounded-full border border-fuchsia-400/30" />
            <div className="absolute left-1/2 top-1/2 flex h-20 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-slate-900 shadow-[0_0_25px_rgba(56,189,248,0.6)] sm:h-28 sm:w-16">
              <TrendingUp className="h-6 w-6 text-cyan-300 sm:h-8 sm:w-8" />
            </div>
            {platforms.map((item, index) => {
              const angle = (index / platforms.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 42;
              const left = 50 + radius * Math.cos(angle);
              const top = 50 + radius * Math.sin(angle);
              return (
                <span
                  key={item}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl shadow-lg sm:h-11 sm:w-11 ${platformTileBg[item]}`}
                >
                  <img src={platformIcons[item] || "/placeholder.svg"} alt={item} className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Track Order */}
      <div className="rounded-2xl border border-blue-500/60 bg-[#061b43] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-cyan-300"><Package className="h-6 w-6" /></span>
            <div>
              <h2 className="font-bold leading-none">Track Order</h2>
              <p className="text-xs text-blue-100/60">Check your order status anytime.</p>
            </div>
          </div>
          <div className="flex flex-1 gap-2 sm:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200/60" />
              <Input aria-label="Order ID" value={searchOrder} onChange={(e) => setSearchOrder(e.target.value)} placeholder="Enter Order ID" className="border-blue-500/70 bg-[#08122b] pl-9" />
            </div>
            <Button onClick={trackOrder} className="shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold hover:opacity-90">Check Status</Button>
          </div>
        </div>
        {orderStatus && <p className="mt-3 text-sm text-cyan-200">{orderStatus}</p>}
        {trackedOrder && (
          <div className="mt-3 overflow-x-auto rounded-xl bg-white text-slate-950">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-[#dddff5] font-semibold">
                <tr>{["Date", "Link", "Charge", "Start count", "Quantity", "Service", "Status", "Remains"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-3 py-3">{new Date(trackedOrder.created_at).toLocaleString()}</td>
                  <td className="max-w-[240px] break-all px-3 py-3 text-blue-700">{trackedOrder.target_link}</td>
                  <td className="px-3 py-3">{Number(trackedOrder.amount ?? trackedOrder.charge ?? 0).toFixed(2)}</td>
                  <td className="px-3 py-3">{trackedOrder.start_count ?? "—"}</td>
                  <td className="px-3 py-3">{trackedOrder.quantity}</td>
                  <td className="px-3 py-3">{trackedOrder.service}</td>
                  <td className="px-3 py-3">{trackedOrder.status ?? trackedOrder.provider_status ?? "Processing"}</td>
                  <td className="px-3 py-3">{trackedOrder.remains ?? trackedOrder.remaining ?? trackedOrder.quantity}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Select Platform */}
      <div className="rounded-2xl border border-blue-500/60 bg-[#061b43] p-4">
        <h2 className="flex items-center gap-1.5 font-bold">
          Select Platform <Info className="h-4 w-4 text-cyan-300" />
        </h2>
        <p className="mb-3 text-xs text-blue-100/60">Choose where you want to grow</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {platforms.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setPlatform(item)}
              className={`relative rounded-xl border p-3 text-center transition ${platform === item ? "border-cyan-300 bg-blue-500/25 shadow-[0_0_15px_rgba(0,200,255,.35)]" : "border-blue-500/40 bg-[#08122b]"}`}
            >
              {platform === item && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[#020c22]"><Check className="h-3 w-3" /></span>
              )}
              <span className={`mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-lg ${platformTileBg[item]}`}>
                <img src={platformIcons[item] || "/placeholder.svg"} alt="" className="h-6 w-6" />
              </span>
              <span className="text-xs font-semibold">{item}</span>
            </button>
          ))}
        </div>
      </div>

      {canSetPrices && (
        <div className="rounded-2xl border border-cyan-400/40 bg-[#061b43] p-4">
          <h2 className="font-bold text-cyan-200">Your Social Boost storefront prices</h2>
          <p className="mb-3 text-xs text-blue-100/60">Set a customer price per service. Admin maximum caps are enforced automatically.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((item) => (
              <label key={item.service} className="text-xs font-semibold">
                {item.category} · {item.name}
                <Input
                  type="number"
                  min="0.01"
                  max={resellerCaps[item.service] || undefined}
                  step="0.01"
                  value={resellerPrices[item.service] ?? price}
                  onChange={(e) => setResellerPrices((current) => ({ ...current, [item.service]: Number(e.target.value) || 0 }))}
                  className="mt-1 border-blue-500/70 bg-[#08122b]"
                />
                <span className="text-[11px] font-normal text-blue-100/50">Max: {resellerCaps[item.service] ? `${resellerCaps[item.service].toFixed(2)} / 1K` : "Admin default"}</span>
              </label>
            ))}
          </div>
          <Button onClick={saveResellerPrices} disabled={savingPrices} className="mt-3">{savingPrices ? "Saving..." : "Save storefront prices"}</Button>
        </div>
      )}

      {/* Order form */}
      <div className="space-y-4 rounded-2xl border border-blue-500/60 bg-[#061b43] p-4 sm:p-5">
        {/* Service */}
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-cyan-300"><User className="h-4 w-4" /></span>
          <label className="flex-1 text-sm font-semibold">
            <span className="flex items-center gap-1.5">Service <Info className="h-3.5 w-3.5 text-cyan-300" /></span>
            <span className="mt-0.5 block text-xs font-normal text-blue-100/60">What do you want to boost?</span>
            <select
              value={selectedCategory}
              onChange={(e) => { const next = services.find((item) => item.category === e.target.value) ?? services[0] ?? fallbackServices[0]; setService(next); setServiceType(next.name); }}
              className="mt-2 w-full rounded-xl border border-blue-400/60 bg-[#08122b] px-4 py-3 text-white"
            >
              {serviceCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        </div>

        {/* Type */}
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-cyan-300"><Layers className="h-4 w-4" /></span>
          <label className="flex-1 text-sm font-semibold">
            <span className="flex items-center gap-1.5">Type <Info className="h-3.5 w-3.5 text-cyan-300" /></span>
            <span className="mt-0.5 block text-xs font-normal text-blue-100/60">Choose a service category</span>
            <select
              value={serviceType}
              onChange={(e) => { const next = categoryServices.find((item) => item.name === e.target.value) ?? categoryServices[0] ?? service; setServiceType(e.target.value); setService(next); }}
              className="mt-2 w-full rounded-xl border border-blue-400/60 bg-[#08122b] px-4 py-3 text-white"
            >
              {serviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>

        {/* Account link */}
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-cyan-300"><Link2 className="h-4 w-4" /></span>
          <div className="flex-1 text-sm font-semibold">
            <span className="flex items-center gap-1.5">{platform} account link <Info className="h-3.5 w-3.5 text-cyan-300" /></span>
            <span className="mt-0.5 block text-xs font-normal text-blue-100/60">Enter your {platform} username or profile link.</span>
            <div className="relative mt-2">
              <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200/60" />
              <Input
                className="border-blue-400/60 bg-[#08122b] pl-9"
                value={targetLink}
                onChange={(e) => setTargetLink(e.target.value)}
                placeholder={`e.g. https://www.${platform.toLowerCase()}.com/@yourusername`}
              />
            </div>
            {targetLink.trim() && (
              <div className="mt-2 rounded-xl border border-cyan-400/50 bg-[#08122b] p-3">
                <p className="text-xs text-cyan-200">Account link preview</p>
                <a href={targetLink.trim()} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-blue-200 underline">{targetLink.trim()}</a>
              </div>
            )}
          </div>
        </div>

        {/* Quantity + Price */}
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-cyan-300"><Box className="h-4 w-4" /></span>
          <div className="flex-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold">Quantity <Info className="h-3.5 w-3.5 text-cyan-300" /></span>
            <span className="mt-0.5 block text-xs font-normal text-blue-100/60">How many {serviceType.toLowerCase()} do you want?</span>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                <Input
                  className="border-blue-400/60 bg-[#08122b]"
                  type="number"
                  min={min}
                  max={max}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  placeholder="Enter quantity"
                />
                <p className="mt-1 text-xs text-blue-100/60">
                  Min {min.toLocaleString()} – Max {max.toLocaleString()}
                  <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-cyan-200">{price.toFixed(0)}/1K</span>
                </p>
              </div>
              <div className="rounded-xl border border-blue-400/60 bg-gradient-to-br from-[#08122b] to-[#0e2352] p-4 text-center sm:w-40">
                <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-100/70">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[10px] text-white">$</span> Price
                </p>
                <p className="mt-1 text-2xl font-black">{total.toFixed(0)} GHS</p>
              </div>
            </div>
          </div>
        </div>

        {/* Completion time */}
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-cyan-300"><Clock3 className="h-4 w-4" /></span>
          <div className="flex-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold">Average completion time <Info className="h-3.5 w-3.5 text-cyan-300" /></span>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-blue-400/60 bg-[#08122b] px-4 py-3">
              <Zap className="h-4 w-4 text-cyan-300" />
              <span className="text-sm">{service.average_time || service.average || "Provider estimate"}</span>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="relative overflow-hidden rounded-xl border border-cyan-400/40 bg-gradient-to-br from-[#08122b] to-[#0e2352] p-4">
          <ShieldCheck className="absolute -bottom-3 -right-3 h-24 w-24 text-cyan-400/10" />
          <div className="relative z-10 max-w-[85%]">
            <p className="flex items-center gap-1.5 text-sm font-bold text-cyan-300"><Lightbulb className="h-4 w-4" /> Note</p>
            <ol className="mt-2 space-y-1 text-sm text-blue-100/80">
              {noteLines.map((line, index) => (
                <li key={index} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-cyan-300">{index + 1}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>
          <CheckCircle2 className="absolute bottom-3 right-3 z-10 h-9 w-9 text-cyan-300" />
        </div>

        {/* Purchase */}
        <Button type="button" onClick={buy} disabled={buying} className="group h-14 w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 text-base font-black hover:opacity-90 sm:text-lg">
          {buying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" />}
          Purchase Now
          <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
        </Button>
      </div>

      {/* Trust footer */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-blue-500/60 bg-[#061b43] p-4 text-xs sm:grid-cols-4">
        <span className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-start sm:text-left">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
          <span><b className="block">Safe &amp; Secure</b><small className="text-blue-100/50">Your account is safe</small></span>
        </span>
        <span className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-start sm:text-left">
          <Zap className="h-5 w-5 text-cyan-300" />
          <span><b className="block">Fast Delivery</b><small className="text-blue-100/50">Get results quickly</small></span>
        </span>
        <span className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-start sm:text-left">
          <Users className="h-5 w-5 text-cyan-300" />
          <span><b className="block">24/7 Support</b><small className="text-blue-100/50">We&apos;re here to help</small></span>
        </span>
        <span className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-start sm:text-left">
          <Sparkles className="h-5 w-5 text-cyan-300" />
          <span><b className="block">Trusted Service</b><small className="text-blue-100/50">Thousands of happy users</small></span>
        </span>
      </div>
    </section>
  );
}
