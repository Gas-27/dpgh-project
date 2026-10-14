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
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import SocialBoostSuccessDialog from "@/components/SocialBoostSuccessDialog";
import {
  SOCIAL_BOOST_DUPLICATE_NOTICE,
  TRACK_ORDER_EVENT,
  TRACK_ORDER_STORAGE_KEY,
  formatRefundDestination,
  getSocialBoostDeliveryMessage,
  isSocialBoostOrderActive,
  isSocialBoostOrderCancelled,
  socialBoostOrderNumberFromReference,
  socialBoostServiceLabel,
} from "@/lib/socialBoostMessages";

type Props = { walletBalance: number; ownerType?: string; storeId?: string | null; canSetPrices?: boolean; checkoutMode?: "wallet" | "paystack"; showHistory?: boolean; pricingMode?: "user" | "storefront"; purchaseSource?: "Dashboard" | "Packages page" | "Storefront"; requireAuth?: boolean };
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

export default function SocialBoostPurchasePanel({ walletBalance, ownerType = "user", storeId = null, canSetPrices = false, checkoutMode = "wallet", showHistory = true, pricingMode = "storefront", purchaseSource, requireAuth = false }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const resolvedPurchaseSource = purchaseSource ?? (checkoutMode === "wallet" ? "Dashboard" : ["agent", "subagent", "subsubagent"].includes(ownerType) ? "Storefront" : "Packages page");
  const normalizedOwnerType = ownerType === "sub_subagent" ? "subsubagent" : ownerType;
  const [purchasedServiceName, setPurchasedServiceName] = useState("");
  const [walletSuccessOpen, setWalletSuccessOpen] = useState(false);
  const [platform, setPlatform] = useState("TikTok");
  const [catalog, setCatalog] = useState<ProviderService[]>(fallbackServices);
  const [service, setService] = useState(fallbackServices[0]);
  const [serviceType, setServiceType] = useState(fallbackServices[0].name);
  const [targetLink, setTargetLink] = useState("");
  const [commentType, setCommentType] = useState("Average Quality Comments");
  const [customComments, setCustomComments] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [price, setPrice] = useState(49);
  const [searchOrder, setSearchOrder] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [buying, setBuying] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [resellerPrices, setResellerPrices] = useState<Record<number, number>>({});
  const [adminPrices, setAdminPrices] = useState<Record<number, number>>({});
  const [resellerCaps, setResellerCaps] = useState<Record<number, number>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  const cancelledHistory = useMemo(() => history.filter((item) => isSocialBoostOrderCancelled(item)), [history]);
  const activeHistory = useMemo(() => history.filter((item) => !isSocialBoostOrderCancelled(item)), [history]);
  const historyTotals = useMemo(() => activeHistory.reduce((totals, item) => ({
    sales: totals.sales + Number(item.selling_amount ?? 0),
    profit: totals.profit + Number(item.profit_amount ?? 0),
  }), { sales: 0, profit: 0 }), [activeHistory]);
  const getHistorySource = (item: any) => {
    if (item.seller_store_kind) return `${item.seller_store_kind} storefront`;
    if (String(item.owner_type ?? "").toLowerCase() === "api") return "API wallet";
    if (["agent", "subagent", "subsubagent"].includes(String(item.owner_type ?? "").toLowerCase())) return `${item.owner_type} wallet`;
    return "Dashboard wallet";
  };

  const platformServices = catalog.filter((item) => item.category.toLowerCase().includes(platform.toLowerCase()));

    const services = platformServices.length ? platformServices : catalog;
  const serviceCategories = Array.from(new Set(services.map((item) => item.category.trim()))).filter(Boolean);
  const [selectedCategory, setSelectedCategory] = useState("TikTok");
  const activeCategory = serviceCategories.includes(selectedCategory) ? selectedCategory : serviceCategories.find((category) => category.toLowerCase().includes(platform.toLowerCase())) ?? service?.category ?? serviceCategories[0] ?? platform;
  const categoryServices = services.filter((item) => item.category === activeCategory);
  const orderedCategoryServices = [...categoryServices].sort((a, b) => {
    const aFollowers = a.name.toLowerCase().includes("follower") ? 0 : 1;
    const bFollowers = b.name.toLowerCase().includes("follower") ? 0 : 1;
    return aFollowers - bFollowers || a.name.localeCompare(b.name);
  });
  const serviceTypes = Array.from(new Set(orderedCategoryServices.map((item) => item.name.trim()))).filter(Boolean);

  useEffect(() => {
    let mounted = true;
  Promise.all([
    checkoutMode === "wallet"
      ? supabase.functions.invoke("social-boost", { body: { action: "services" } })
      : Promise.resolve({ data: [] }),
    (supabase as any).from("social_boost_service_pricing").select("service_id,service_name,category,provider_rate,default_price_per_1000,admin_price_per_1000,min_quantity,max_quantity,average_completion_time,notes"),
  ]).then(([providerResult, pricingResult]) => {
    if (!mounted) return;
    const providerServices = Array.isArray(providerResult.data) ? providerResult.data : [];
    const removedServiceNames = new Set(["facebook custom comments ( female )", "facebook custom comments ( male )"]);
    const pricingServices = Array.isArray(pricingResult.data) ? pricingResult.data.filter((row: any) => !removedServiceNames.has(String(row.service_name || "").trim().toLowerCase())).map((row: any) => ({
      service: Number(row.service_id),
      name: String(row.service_name || `Service ${row.service_id}`),
      category: String(row.category || "Social Boost"),
      rate: String(Number(row.admin_price_per_1000) > 0 ? row.admin_price_per_1000 : Number(row.default_price_per_1000) > 0 ? row.default_price_per_1000 : row.provider_rate ?? 0),
      min: String(row.min_quantity ?? 1),
      max: String(row.max_quantity ?? 100000),
      average_time: String(row.average_completion_time || "Provider estimate"),
      notes: String(row.notes || "No additional note has been configured for this service."),
    })) : [];
    const configuredIds = new Set(pricingServices.map((item) => Number(item.service)));
    const merged = [...pricingServices, ...providerServices.filter((item: any) => !configuredIds.has(Number(item.service)))];
    if (merged.length) setCatalog(merged);
  });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const preferred = categoryServices.find((item) => {
      const name = item.name.toLowerCase();
      const platformName = platform.toLowerCase();
      return name.includes("follower") && (name.includes(platformName) || item.category.toLowerCase().includes(platformName));
    }) ?? categoryServices.find((item) => item.name.toLowerCase().includes("follower"));
    const next = preferred ?? orderedCategoryServices[0] ?? services[0] ?? fallbackServices[0];
    setService(next);
    setServiceType(next.name);
    setQuantity(Number(next.min) || 50);
  }, [platform, catalog, activeCategory]);

  useEffect(() => {
    if (!serviceTypes.includes(serviceType)) setServiceType(serviceTypes[0] ?? fallbackServices[0].name);
  }, [serviceTypes, serviceType]);

  const loadHistory = async (sync = true) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId && !storeId) {
      setHistory([]);
      return;
    }
    const orderFields = "order_number,created_at,target_link,quantity,service,provider_order_id,provider_status,start_count,remains,selling_amount,base_amount,profit_amount,owner_type,owner_store_id,seller_store_kind,seller_store_id,payment_reference,refunded_at,refund_amount,refund_destination";
    const queries = [];
    const ownerIds = new Set(userId ? [userId] : []);
    if (userId) {
      const { data: apiUsers } = await (supabase as any).from("api_users").select("id,identity_id").or(`identity_id.eq.${userId},id.eq.${userId}`);
      (apiUsers ?? []).forEach((apiUser: any) => {
        if (apiUser.id) ownerIds.add(String(apiUser.id));
        if (apiUser.identity_id) ownerIds.add(String(apiUser.identity_id));
      });
    }
    if (ownerIds.size) {
      queries.push((supabase as any).from("social_boost_orders").select(orderFields).in("user_id", Array.from(ownerIds)).order("created_at", { ascending: false }).limit(200));
    }
    if (storeId) {
      queries.push((supabase as any).from("social_boost_orders").select(orderFields).or(`owner_store_id.eq.${storeId},seller_store_id.eq.${storeId}`).order("created_at", { ascending: false }).limit(100));
    }
    const results = await Promise.all(queries);
    let next = Array.from(new Map(results.flatMap((result: any) => result.data ?? []).map((item: any) => [item.order_number, item])).values())
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);
    setHistory(next);
    if (!sync) return;
    const finalStatuses = new Set(["completed", "complete", "delivered", "canceled", "cancelled", "failed", "failure"]);
    const pending = next.filter((item: any) => item.provider_order_id && !finalStatuses.has(String(item.provider_status ?? "").toLowerCase()));
    if (!pending.length) return;
    const updates = await Promise.all(pending.map(async (item: any) => {
      try {
        const { data: latest, error } = await supabase.functions.invoke("social-boost", { body: { action: "status", order: item.provider_order_id } });
        if (error || !latest || latest.error) return null;
        const fields = {
          provider_status: String(latest.status ?? item.provider_status ?? "processing"),
          start_count: latest.start_count == null ? null : Number(latest.start_count),
          remains: latest.remains == null ? null : Number(latest.remains),
        };
        await (supabase as any).rpc("update_social_boost_order_status", {
          p_provider_order_id: String(item.provider_order_id),
          p_status: fields.provider_status,
          p_start_count: fields.start_count,
          p_remains: fields.remains,
        });
        return [item.order_number, fields] as const;
      } catch {
        return null;
      }
    }));
    const byOrder = new Map(updates.filter(Boolean) as Array<readonly [number, any]>);
    if (byOrder.size) setHistory((current: any[]) => current.map((item) => byOrder.has(item.order_number) ? { ...item, ...byOrder.get(item.order_number) } : item));
    // A newly cancelled order is refunded by the database; reload to show the refund.
    if (Array.from(byOrder.values()).some((fields) => isSocialBoostOrderCancelled(fields))) await loadHistory(false);
  };

  useEffect(() => {
    const runTrack = (orderNumber: string) => {
      setSearchOrder(orderNumber);
      void trackOrder(orderNumber);
    };
    const stored = window.sessionStorage.getItem(TRACK_ORDER_STORAGE_KEY);
    if (stored) {
      window.sessionStorage.removeItem(TRACK_ORDER_STORAGE_KEY);
      runTrack(stored);
    }
    const onTrack = (event: Event) => {
      const orderNumber = String((event as CustomEvent).detail ?? "");
      window.sessionStorage.removeItem(TRACK_ORDER_STORAGE_KEY);
      if (orderNumber) runTrack(orderNumber);
    };
    window.addEventListener(TRACK_ORDER_EVENT, onTrack);
    return () => window.removeEventListener(TRACK_ORDER_EVENT, onTrack);
  }, []);

  useEffect(() => {
    void loadHistory();
    const timer = window.setInterval(() => void loadHistory(), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (params.get("payment") !== "verifying" || !reference) return;

    let mounted = true;
    let attempts = 0;
    const maxAttempts = 40;
    const derivedOrderNumber = socialBoostOrderNumberFromReference(reference);
    const findOrder = async () => {
      const { data: byReference, error: referenceError } = await (supabase as any).rpc("get_public_social_boost_order_by_reference", { p_reference: reference });
      const referenceOrder = Array.isArray(byReference) ? byReference[0] ?? null : byReference ?? null;
      const { data, error } = referenceOrder || !derivedOrderNumber
        ? { data: referenceOrder, error: referenceError }
        : await (supabase as any).rpc("get_public_social_boost_order", { p_order_number: String(derivedOrderNumber) });
      const order = Array.isArray(data) ? data[0] : data;

      if (!mounted) return;
      if (order?.order_number) {
        setOrderId(String(order.order_number));
        setSearchOrder(String(order.order_number));
        setPurchasedServiceName(socialBoostServiceLabel(order.service));
        setWalletSuccessOpen(true);
        await loadHistory(false);
        return;
      }

      // Paystack redirects before the webhook has necessarily finished. Keep
      // the customer on a neutral pending state instead of showing a failure.
      if (error && attempts === 0) console.log("[v0] Social Boost payment lookup pending:", error.message);
      attempts += 1;
      if (attempts < maxAttempts) window.setTimeout(findOrder, 2000);
    };

    void findOrder();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadConfiguration = async () => {
      const table = (supabase as any).from("social_boost_service_pricing");
      const columns = "service_id,service_name,category,admin_price_per_1000,base_price_per_1000,default_price_per_1000,max_reseller_price_per_1000,min_quantity,max_quantity,average_completion_time,notes";
      const byId = await table.select(columns).eq("service_id", service.service).maybeSingle();
      const data = byId.data ?? (await table.select(columns).ilike("service_name", service.name).ilike("category", service.category).maybeSingle()).data;
      if (!mounted) return;
const userPrice = Number(data?.admin_price_per_1000 ?? service.rate ?? 0);
  const basePrice = Number(data?.base_price_per_1000) > 0 ? Number(data?.base_price_per_1000) : userPrice;
  const defaultAgentPrice = Number(data?.default_price_per_1000) > 0 ? Number(data?.default_price_per_1000) : basePrice;
  let customPrice: number | null = null;
  if (pricingMode === "storefront" && storeId) {
    const storeTable = normalizedOwnerType === "agent" ? "agent_stores" : normalizedOwnerType === "subagent" ? "subagent_stores" : "sub_subagent_stores";
    const { data: storeRow } = await (supabase as any).from(storeTable).select("user_id").eq("id", storeId).maybeSingle();
    if (storeRow?.user_id) {
      const { data: savedPrice } = await (supabase as any).from("social_boost_reseller_pricing").select("price_per_1000").eq("user_id", storeRow.user_id).eq("service_id", service.service).maybeSingle();
      const candidate = Number(savedPrice?.price_per_1000);
      const maximum = Number(data?.max_reseller_price_per_1000 ?? 0);
      if (Number.isFinite(candidate) && candidate >= basePrice && (!maximum || candidate <= maximum)) customPrice = candidate;
    }
  }
  const configuredPrice = pricingMode === "user" || !storeId ? userPrice : customPrice ?? defaultAgentPrice;
  const adminPrice = userPrice;
      if (!Number.isFinite(adminPrice) || adminPrice <= 0) return;
        setAdminPrices((current) => ({ ...current, [service.service]: configuredPrice }));
        setPrice(configuredPrice);
        setService((current) => ({
          ...current,
          min: String(data?.min_quantity ?? current.min),
          max: String(data?.max_quantity ?? current.max),
          average_time: data?.average_completion_time ?? current.average_time,
          notes: data?.notes ?? current.notes,
        }));
      setResellerCaps((current) => ({ ...current, [service.service]: Number(data?.max_reseller_price_per_1000 || 0) }));
    };
    void loadConfiguration();
    return () => { mounted = false; };
  }, [service.service, service.rate, pricingMode, storeId, normalizedOwnerType]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      let pricingUserId = authData.user?.id ?? null;
if (storeId && ["agent", "subagent", "subsubagent"].includes(normalizedOwnerType)) {
  const table = normalizedOwnerType === "agent" ? "agent_stores" : normalizedOwnerType === "subagent" ? "subagent_stores" : "sub_subagent_stores";
        const { data: store } = await (supabase as any).from(table).select("*").eq("id", storeId).maybeSingle();
        pricingUserId = store?.user_id ?? store?.owner_id ?? store?.created_by ?? pricingUserId;
      }
      if (!pricingUserId) return;
      const { data } = await (supabase as any)
        .from("social_boost_reseller_pricing")
        .select("service_id,price_per_1000")
        .eq("user_id", pricingUserId);
      if (mounted && Array.isArray(data)) setResellerPrices(Object.fromEntries(data.map((row: any) => [row.service_id, Number(row.price_per_1000)])));
    })();
    return () => { mounted = false; };
  }, [canSetPrices, ownerType, storeId]);

  const min = Number(service.min) || 10;
  const max = Number(service.max) || 50000;
  const numericQuantity = typeof quantity === "number" ? quantity : 0;
  const total = useMemo(() => Math.round((numericQuantity / 1000) * price * 1000) / 1000, [numericQuantity, price]);

  const validateBeforePayment = () => {
    const warnings: string[] = [];
    const link = targetLink.trim();
    if (!link) warnings.push("No social media link was entered.");
    if (link.length > 500) warnings.push("The link is longer than 500 characters.");
    if (/\s/.test(link)) warnings.push("The link contains spaces.");

    let url: URL | null = null;
    try {
      url = new URL(link);
    } catch {
      warnings.push("The link is not a complete web link starting with https://.");
    }

    if (url && (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes("."))) {
      warnings.push("The link does not look like a valid social media link.");
    }

    if (url) {
      const hostname = url.hostname.toLowerCase();
      const domains: Record<string, string[]> = {
        TikTok: ["tiktok.com"],
        Instagram: ["instagram.com"],
        Facebook: ["facebook.com", "fb.com", "fb.watch", "fb.me"],
        YouTube: ["youtube.com", "youtu.be"],
        WhatsApp: ["whatsapp.com", "wa.me"],
      };
      const matchesPlatform = (domains[platform] ?? []).some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
      if (!matchesPlatform) warnings.push(`This link does not appear to belong to ${platform}.`);
    }

    const minimum = Number(service.min) || 1;
    const maximum = Number(service.max) || 100000000;
    if (!Number.isInteger(numericQuantity) || numericQuantity < minimum || numericQuantity > maximum) {
      warnings.push(`This service normally accepts ${minimum.toLocaleString()} to ${maximum.toLocaleString()}.`);
    }

    if (!Number.isFinite(total) || total <= 0) warnings.push("The order price could not be calculated correctly.");
    if (/comment/i.test(`${service.name} ${activeCategory}`) && !customComments.trim()) warnings.push("No comment text was entered for this comment service.");
    return warnings;
  };

  const buy = async () => {
    if (requireAuth && !user) {
      navigate("/login", { state: { from: "/packages" } });
      return;
    }
    const validationWarnings = validateBeforePayment();
    if (validationWarnings.length > 0) {
      const proceed = window.confirm(`Please review this order before paying:\n\n${validationWarnings.join("\n")}\n\nIf you continue, the provider may reject the order and the order may be refunded. Continue anyway?`);
      if (!proceed) return;
    }
    const isCustomComments = /comment/i.test(`${service.name} ${activeCategory}`);
    const providerComments = customComments.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join("\n");
    setBuying(true);
    if (await hasActiveDuplicate()) {
      setBuying(false);
      return toast({ title: "Order still processing", description: SOCIAL_BOOST_DUPLICATE_NOTICE, variant: "destructive" });
    }
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;

    if (checkoutMode === "paystack") {
      const { data, error } = await supabase.functions.invoke("initialize-payment", {
        body: {
          email: currentUser?.email || `social_boost_${Date.now()}@datapluggh.com`,
          amount: total,
          callback_url: `${window.location.origin}${window.location.pathname}${window.location.search ? `${window.location.search}&` : "?"}payment=verifying`,
          metadata: { type: "social_boost", ...(currentUser?.id ? { user_id: currentUser.id } : {}), platform, service_id: service.service, service_name: service.name, target_link: targetLink.trim(), quantity: numericQuantity, ...(isCustomComments ? { comment_type: commentType, comments: providerComments } : {}), owner_type: normalizedOwnerType, seller_store_kind: ["agent", "subagent", "subsubagent"].includes(normalizedOwnerType) ? normalizedOwnerType : null, seller_store_id: ["agent", "subagent", "subsubagent"].includes(normalizedOwnerType) ? storeId : null },
        },
      });
      setBuying(false);
      if (data?.code === "duplicate_order") return toast({ title: "Order still processing", description: data.error ?? SOCIAL_BOOST_DUPLICATE_NOTICE, variant: "destructive" });
      if (error || !data?.authorization_url) return toast({ title: "Payment could not start", description: error?.message ?? data?.error ?? "Paystack did not return a checkout link.", variant: "destructive" });
      window.location.assign(data.authorization_url);
      return;
    }
    const { data: walletOrder, error: walletError } = await (supabase as any).rpc("purchase_social_boost", {
      p_platform: platform,
      p_service: `${service.service}:${service.name}`,
      p_target_link: targetLink.trim(),
      p_quantity: numericQuantity,
      p_provider_order_id: null,
    });
    if (walletError || !walletOrder?.order_number) {
      setBuying(false);
      return toast({ title: "Wallet purchase failed", description: walletError?.message ?? "Your wallet could not be charged.", variant: "destructive" });
    }
    const { data: provider, error: providerError } = await supabase.functions.invoke("social-boost", { body: { action: "add", service: service.service, link: targetLink.trim(), quantity: numericQuantity, wallet_order_number: walletOrder.order_number, payment_method: "wallet", ...(isCustomComments ? { type: commentType, comments: providerComments } : {}) } });
    setBuying(false);
    if (providerError || !provider?.order) {
      return toast({ title: "Social Boost provider rejected the order", description: providerError?.message ?? provider?.error ?? "Your wallet order is being reviewed because the provider did not return an order ID.", variant: "destructive" });
    }
    setOrderId(String(walletOrder.order_number));
    setPurchasedServiceName(service.name);
    setWalletSuccessOpen(true);
    await loadHistory();
  };

  const hasActiveDuplicate = async () => {
    const normalizeLink = (value: string) => value.trim().toLowerCase().replace(/\/+$/, "");
    const link = normalizeLink(targetLink);
    const matches = history.filter((item) => {
      const sameService = String(item.service ?? "").split(":")[0] === String(service.service);
      return sameService && normalizeLink(String(item.target_link ?? "")) === link && isSocialBoostOrderActive(item);
    });
    for (const item of matches) {
      if (!item.provider_order_id) return true;
      const { data } = await supabase.functions.invoke("social-boost", { body: { action: "status", order: String(item.provider_order_id) } });
      if (!data?.status) return true;
      if (isSocialBoostOrderActive({ provider_status: data.status })) return true;
    }
    return false;
  };

  const trackOrder = async (orderNumber?: string) => {
    const lookup = (orderNumber ?? searchOrder).trim();
    if (!lookup) return;
    const { data: local, error: localError } = await (supabase as any).rpc("get_public_social_boost_order", { p_order_number: lookup });
    if (localError || !local) return setOrderStatus(localError?.message ?? "Order not found");
    const order = Array.isArray(local) ? local[0] : local;
    if (localError || !order) return setOrderStatus(localError?.message ?? "Order not found");
  const providerOrder = order.provider_order_id ?? searchOrder.trim();
  const { data, error } = order.provider_order_id
    ? await supabase.functions.invoke("social-boost", { body: { action: "status", order: providerOrder } })
    : { data: null, error: null };
  if (error && !order.provider_status) return setOrderStatus("This order is still being processed. Please try again shortly.");
  const latest = { ...order, ...(data ?? {}), provider_status: data?.status ?? order.provider_status };
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

      {orderId && (
        <div className="rounded-2xl border border-emerald-400/70 bg-emerald-950/40 p-4 text-emerald-50" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />
            <div>
              <h2 className="font-bold">Social Boost purchase successful</h2>
              <p className="mt-1 text-sm text-emerald-100/90">Your Social Boost purchase was made through the {resolvedPurchaseSource}. {getSocialBoostDeliveryMessage(purchasedServiceName || service.name)} Keep this order number and use it to track your purchase.</p>
              <p className="mt-3 text-lg font-black tracking-wide">Order #{orderId}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/80">Purchase source: {resolvedPurchaseSource}</p>
              <Button type="button" size="sm" className="mt-3 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={() => { setSearchOrder(orderId); document.getElementById("social-boost-track-order")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                Track this order
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Track Order */}
      <div id="social-boost-track-order" className="rounded-2xl border border-blue-500/60 bg-[#061b43] p-4">
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
            <Button onClick={() => void trackOrder()} className="shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold hover:opacity-90">Check Status</Button>
          </div>
        </div>
        {orderStatus && <p className="mt-3 text-sm text-cyan-200">{orderStatus}</p>}
        {trackedOrder && (
          <div className="mt-3 overflow-x-auto rounded-xl bg-white text-slate-950">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-[#dddff5] font-semibold">
                <tr>{["Date", "Link", "Start count", "Quantity", "Service", "Status", "Remains"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr>
              </thead>
              <tbody><tr className="border-t"><td className="px-3 py-3">{new Date(trackedOrder.created_at).toLocaleString()}</td><td className="max-w-[240px] break-all px-3 py-3 text-blue-700">{trackedOrder.target_link}</td><td className="px-3 py-3">{trackedOrder.start_count ?? "—"}</td><td className="px-3 py-3">{trackedOrder.quantity}</td><td className="px-3 py-3">{trackedOrder.service}</td><td className="px-3 py-3">{isSocialBoostOrderCancelled(trackedOrder) ? (trackedOrder.is_storefront_order ? "Cancelled - contact store owner" : "Cancelled - refunded") : trackedOrder.status ?? trackedOrder.provider_status ?? "Processing"}</td><td className="px-3 py-3">{trackedOrder.remains ?? trackedOrder.remaining ?? trackedOrder.quantity}</td></tr></tbody>
            </table>
          </div>
        )}
        {trackedOrder && isSocialBoostOrderCancelled(trackedOrder) && (
          <div className="mt-3 rounded-xl border border-amber-400/70 bg-amber-950/40 p-4 text-sm text-amber-50" role="alert">
            <p className="font-bold">This Social Boost order was cancelled.</p>
            {trackedOrder.is_storefront_order ? (
              <>
                <p className="mt-1">
                  Please contact the store owner{trackedOrder.store_name ? ` (${trackedOrder.store_name})` : ""} for your refund.
                  {trackedOrder.store_contact ? <> Store owner number: <a href={`tel:${trackedOrder.store_contact}`} className="font-black underline">{trackedOrder.store_contact}</a></> : " The store owner number is not available, so please use the contact details on this store."}
                </p>
                <p className="mt-2 text-xs text-amber-100/90">Orders may be cancelled when another order for the same link is still processing or when a technical issue prevents fulfillment. You can retry after the active order is completed, cancelled, or failed.</p>
              </>
            ) : (
              <p className="mt-1">
                {trackedOrder.refunded_at
                  ? `GHC ${Number(trackedOrder.refund_amount ?? 0).toFixed(2)} has been refunded to ${trackedOrder.refund_destination === "api_wallet" ? "the API wallet" : "the wallet"} used for this order.`
                  : "Your refund is being processed and will be returned to the wallet used for this order."}
              </p>
            )}
            {!trackedOrder.is_storefront_order && <p className="mt-2 text-xs text-amber-100/90">Orders may be cancelled when another order for the same link is still processing or when a technical issue prevents fulfillment. You can retry after the active order is completed, cancelled, or failed.</p>}
          </div>
        )}
  <div id="social-boost-history" className={`${showHistory ? "" : "hidden"} mt-5 overflow-hidden rounded-xl bg-white text-slate-950`}>
  <div className="border-b bg-[#dddff5] px-3 py-3 font-semibold">
    <div>My Social Boost History</div>
    <div className="mt-1 text-xs font-normal text-slate-600">Dashboard wallet, API wallet, and storefront purchases are shown here.</div>
  </div>
  <div className="grid gap-3 border-b bg-slate-50 p-3 sm:grid-cols-2">
    <div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Sales shown</div><div className="mt-1 text-lg font-bold">GHC {historyTotals.sales.toFixed(2)}</div></div>
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Your profit is credited to your wallet</div><div className="mt-1 text-lg font-bold text-emerald-800">GHC {historyTotals.profit.toFixed(2)}</div><div className="mt-1 text-xs text-emerald-700">This amount has already been added directly to your wallet.</div></div>
  </div>
  <div className="max-h-[22rem] overflow-auto">
  <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="font-semibold"><tr>{["Order", "Date", "Source", "Link", "Quantity", "Service", "Status", "Remains", "Price", "Profit"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead>
            <tbody>{activeHistory.length ? activeHistory.map((item) => <tr key={item.order_number} className="border-t align-top"><td className="whitespace-nowrap px-3 py-3">#{item.order_number}</td><td className="whitespace-nowrap px-3 py-3">{new Date(item.created_at).toLocaleString()}</td><td className="whitespace-nowrap px-3 py-3">{getHistorySource(item)}</td><td className="max-w-[260px] truncate px-3 py-3 text-blue-700" title={item.target_link}>{item.target_link}</td><td className="px-3 py-3">{item.quantity}</td><td className="px-3 py-3">{item.service}</td><td className="px-3 py-3">{item.provider_status ?? "Processing"}</td><td className="px-3 py-3">{item.remains ?? item.quantity}</td><td className="px-3 py-3">{item.selling_amount != null ? `GHC ${Number(item.selling_amount).toFixed(2)}` : "—"}</td><td className="px-3 py-3 text-emerald-700">{item.profit_amount != null ? `GHC ${Number(item.profit_amount).toFixed(2)}` : "—"}</td></tr>) : <tr><td colSpan={10} className="px-3 py-6 text-center text-slate-500">No social boost orders yet.</td></tr>}</tbody>
            </table>
          </div>
  </div>

  <div id="social-boost-cancelled-refunds" className={`${showHistory ? "" : "hidden"} mt-5 overflow-hidden rounded-xl bg-white text-slate-950`}>
    <div className="border-b bg-amber-100 px-3 py-3 font-semibold">
      <div>Cancelled &amp; Refunded Social Boost Orders</div>
      <div className="mt-1 text-xs font-normal text-slate-600">Cancelled dashboard orders are refunded to your wallet. Cancelled storefront orders are refunded to the store owner, who refunds the customer.</div>
    </div>
    <div className="max-h-[22rem] overflow-auto">
      <table className="min-w-[900px] w-full text-left text-sm">
        <thead className="font-semibold"><tr>{["Order", "Date", "Source", "Link", "Quantity", "Service", "Amount", "Refund", "Refunded to"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead>
        <tbody>
          {cancelledHistory.length ? cancelledHistory.map((item) => (
            <tr key={item.order_number} className="border-t align-top">
              <td className="whitespace-nowrap px-3 py-3">#{item.order_number}</td>
              <td className="whitespace-nowrap px-3 py-3">{new Date(item.created_at).toLocaleString()}</td>
              <td className="whitespace-nowrap px-3 py-3">{getHistorySource(item)}</td>
              <td className="max-w-[260px] truncate px-3 py-3 text-blue-700" title={item.target_link}>{item.target_link}</td>
              <td className="px-3 py-3">{item.quantity}</td>
              <td className="px-3 py-3">{item.service}</td>
              <td className="px-3 py-3">{item.selling_amount != null ? `GHC ${Number(item.selling_amount).toFixed(2)}` : "—"}</td>
              <td className="px-3 py-3 font-semibold text-emerald-700">{item.refunded_at ? `GHC ${Number(item.refund_amount ?? 0).toFixed(2)}` : "Processing"}</td>
              <td className="px-3 py-3">{item.refunded_at ? formatRefundDestination(item.refund_destination) : "Pending"}</td>
            </tr>
          )) : <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">No cancelled or refunded Social Boost orders.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>
  
  {/* Select Platform */}
      <div id="social-boost-order-form" className="scroll-mt-4 rounded-2xl border border-blue-500/60 bg-[#061b43] p-4">
        <h2 className="flex items-center gap-1.5 font-bold">
          Select Platform <Info className="h-4 w-4 text-cyan-300" />
        </h2>
        <p className="mb-3 text-xs text-blue-100/60">Choose where you want to grow</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {platforms.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => { setPlatform(item); setServiceType(""); }}
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
          <label className="min-w-0 flex-1 text-sm font-semibold">
            <span className="flex items-center gap-1.5">Service <Info className="h-3.5 w-3.5 text-cyan-300" /></span>
            <span className="mt-0.5 block text-xs font-normal text-blue-100/60">What do you want to boost?</span>
            <select
              value={activeCategory}
              onChange={(e) => { const category = e.target.value; const next = services.find((item) => item.category === category) ?? services[0] ?? fallbackServices[0]; setSelectedCategory(category); setService(next); setServiceType(next.name); }}
              className="mt-2 w-full rounded-xl border border-blue-400/60 bg-[#08122b] px-4 py-3 text-white"
            >
              {serviceCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        </div>

        {/* Type */}
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-cyan-300"><Layers className="h-4 w-4" /></span>
          <label className="min-w-0 flex-1 text-sm font-semibold">
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
          <div className="min-w-0 flex-1 text-sm font-semibold overflow-hidden">
            <span className="flex items-center gap-1.5">{platform} account link <Info className="h-3.5 w-3.5 text-cyan-300" /></span>
            <span className="mt-0.5 block text-xs font-normal text-blue-100/60">Paste the exact {platform} profile, post, video, or channel link you want to boost. Preview it before purchasing.</span>
            <div className="relative mt-2">
              <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200/60" />
              <Input
                className="min-w-0 w-full max-w-full border-blue-400/60 bg-[#08122b] pl-9"
                value={targetLink}
                onChange={(e) => setTargetLink(e.target.value)}
                placeholder={`e.g. https://www.${platform.toLowerCase()}.com/@yourusername`}
              />
            </div>
            {targetLink.trim() && (
              <div className="mt-2 rounded-xl border border-cyan-400/50 bg-[#08122b] p-3">
                <p className="text-xs font-semibold text-cyan-200">Preview and verify your link</p>
                <p className="mt-1 text-xs text-blue-100/70">Open the preview and confirm it goes to the exact account, post, video, or channel you want to boost.</p>
                {/^https?:\/\//i.test(targetLink.trim()) ? <a href={targetLink.trim()} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-blue-200 underline">Open link preview <ArrowRight className="h-3.5 w-3.5" /></a> : <p className="mt-2 text-xs text-amber-200">Use a complete link beginning with https:// so the preview opens the right place.</p>}
                <p className="mt-2 truncate text-xs text-blue-100/60" title={targetLink.trim()}>{targetLink.trim()}</p>
              </div>
            )}
          </div>
        </div>

        {(/comment/i.test(`${service.name} ${activeCategory}`)) && (
          <div className="space-y-3 rounded-xl border border-fuchsia-400/50 bg-[#08122b] p-4">
            <label className="block text-sm font-semibold">Comment type
              <select value={commentType} onChange={(e) => setCommentType(e.target.value)} className="mt-2 w-full rounded-xl border border-blue-400/60 bg-[#061b43] px-4 py-3 text-white">
                <option>Average Quality Comments</option><option>High Quality Comments</option><option>Emoji Comments</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">Comments
              <span className="mt-0.5 block text-xs font-normal text-blue-100/60">Separate each comment by moving to a new line.</span>
              <textarea value={customComments} onChange={(e) => setCustomComments(e.target.value)} rows={5} placeholder="Write one comment per line" className="mt-2 w-full rounded-xl border border-blue-400/60 bg-[#061b43] px-4 py-3 text-sm text-white placeholder:text-blue-100/40" />
              <span className="text-xs font-normal text-blue-100/60">Min: {min.toLocaleString()} – Max: {max.toLocaleString()}</span>
            </label>
          </div>
        )}

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
  onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Enter quantity"
                />
                <p className="mt-1 text-xs text-blue-100/60">
                  Min {min.toLocaleString()} – Max {max.toLocaleString()}
                  <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-cyan-200">{price.toLocaleString(undefined, { maximumFractionDigits: 0 })}/1K</span>
                </p>
              </div>
              <div className="rounded-xl border border-blue-400/60 bg-gradient-to-br from-[#08122b] to-[#0e2352] p-4 text-center sm:w-40">
                <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-100/70">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[10px] text-white">$</span> Price
                </p>
                <p className="mt-1 text-2xl font-black">{total.toFixed(3)} GHS</p>
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

        <p className="rounded-xl border border-amber-400/50 bg-amber-950/30 p-3 text-sm font-semibold text-amber-100" role="note">{SOCIAL_BOOST_DUPLICATE_NOTICE}</p>

        {/* Purchase */}
        <Button type="button" onClick={buy} disabled={buying} className="group h-14 w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 text-base font-black hover:opacity-90 sm:text-lg">
          {buying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" />}
          {requireAuth && !user ? "Sign in to purchase" : "Purchase Now"}
          <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
        </Button>
      </div>

      <SocialBoostSuccessDialog
        open={walletSuccessOpen}
        orderNumber={orderId}
        serviceName={purchasedServiceName}
        onClose={() => setWalletSuccessOpen(false)}
        onNewOrder={() => {
          setWalletSuccessOpen(false);
          window.setTimeout(() => document.getElementById("social-boost-order-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
        }}
        onTrack={() => {
          setWalletSuccessOpen(false);
          setSearchOrder(orderId);
          void trackOrder(orderId);
          window.setTimeout(() => document.getElementById("social-boost-track-order")?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
        }}
      />

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
      </div>
    </section>
  );
}
