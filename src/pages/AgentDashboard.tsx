import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Store, Wifi, Settings, ExternalLink, Copy, BarChart3, ShoppingCart, Save,
  LogOut, Zap, Edit2, Wallet, Phone, CreditCard, Loader2, ArrowDownToLine,
  TrendingUp, Search, Palette, RotateCcw, Bell, Plus, Trash2, Calendar,
  LayoutGrid, Minus, Plus as PlusIcon, Coins, Menu, Image, Download, Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NotificationPopup from "@/components/NotificationPopup";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { toPng } from "html-to-image";

// ---------- INTERFACES ----------
interface AgentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  whatsapp_group: string | null;
  show_whatsapp_group_icon: boolean;
  momo_number: string;
  momo_name: string;
  momo_network: string;
  approved: boolean;
  wallet_balance: number;
  topup_reference: string;
  store_headline: string;
  tutorial_video_url: string | null;
  theme_config: {
    primary: string;
    primary_foreground: string;
    background: string;
    card_background: string;
    gridColumns: number;
  };
}

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
  agent_price: number;
  active: boolean;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  status: string;
  fulfillment_status: string;
  payment_method: string;
  created_at: string;
  package_id: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface ProfitStats {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  availableForWithdrawal: number;
}

interface Notification {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

const DEFAULT_THEME = {
  primary: "#38bdf8",
  primary_foreground: "#000000",
  background: "#0a0a0a",
  card_background: "#171717",
  gridColumns: 2,
};

const DEFAULT_FLYER_COLORS = {
  mtnColor: "#f5b81b",
  airtelColor: "#a855f7",
  telecelColor: "#ef4444",
  buttonBg: "#0066ff",
  buttonText: "#ffffff",
};

const MTN_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 100];
const AIRTEL_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40];
const TELECEL_SIZES = [2, 3, 5, 10, 11, 15, 16, 20, 22, 25, 30, 33, 40, 44, 50];

const menuItems = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "buy", label: "Buy Data", icon: ShoppingCart },
  { id: "store", label: "Store Prices", icon: Store },
  { id: "flyer", label: "Flyer Generator", icon: Image },
  { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
  { id: "topup", label: "Top Up", icon: Coins },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

const AgentDashboard = () => {
  const { user, isAgent, isAdmin, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [store, setStore] = useState<AgentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [agentPrices, setAgentPrices] = useState<Record<string, number>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [savingPrices, setSavingPrices] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [storeForm, setStoreForm] = useState({
    store_name: "", whatsapp_number: "", support_number: "", whatsapp_group: "",
    show_whatsapp_group_icon: true,
    momo_number: "", momo_name: "", momo_network: "",
  });
  const [savingStore, setSavingStore] = useState(false);
  const [profitStats, setProfitStats] = useState<ProfitStats>({
    totalRevenue: 0, totalCost: 0, totalProfit: 0, availableForWithdrawal: 0,
  });

  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [buyPkg, setBuyPkg] = useState<DataPackage | null>(null);
  const [buyPhone, setBuyPhone] = useState("");
  const [buyStep, setBuyStep] = useState<"phone" | "confirm">("phone");
  const [buyPaymentMethod, setBuyPaymentMethod] = useState<"paystack" | "wallet">("wallet");
  const [buyLoading, setBuyLoading] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [themeColors, setThemeColors] = useState(DEFAULT_THEME);
  const [savingTheme, setSavingTheme] = useState(false);
  const [storeHeadline, setStoreHeadline] = useState("");
  const [savingHeadline, setSavingHeadline] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [newNotificationMsg, setNewNotificationMsg] = useState("");
  const [newNotificationExpiry, setNewNotificationExpiry] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Flyer states
  const flyerRef = useRef<HTMLDivElement>(null);
  const [generatingFlyer, setGeneratingFlyer] = useState(false);
  const [flyerColors, setFlyerColors] = useState(() => {
    const saved = localStorage.getItem("flyerColors");
    return saved ? JSON.parse(saved) : DEFAULT_FLYER_COLORS;
  });
  const [shareText, setShareText] = useState("");

  const hasPendingWithdrawal = withdrawals.some(w => w.status === "pending");

  // ---------- HELPERS ----------
  const calculateProfitStats = (ordersList: Order[], packagesList: DataPackage[]) => {
    let totalRevenue = 0;
    let totalCost = 0;
    ordersList.forEach(order => {
      if (order.status === "completed" || order.status === "paid") {
        totalRevenue += Number(order.amount);
        const pkg = packagesList.find(p => p.id === order.package_id);
        if (pkg) totalCost += pkg.agent_price;
      }
    });
    return {
      totalRevenue, totalCost,
      totalProfit: totalRevenue - totalCost,
      availableForWithdrawal: store?.wallet_balance || 0,
    };
  };

  const fetchAllData = async () => {
    if (!user) return;
    const { data: storeData, error: storeError } = await supabase
      .from("agent_stores").select("*").eq("user_id", user.id).maybeSingle();
    if (storeError) { console.error(storeError); setLoading(false); return; }
    if (storeData) {
      if (storeData.show_whatsapp_group_icon === undefined || storeData.show_whatsapp_group_icon === null) {
        storeData.show_whatsapp_group_icon = true;
        await supabase.from("agent_stores").update({ show_whatsapp_group_icon: true }).eq("id", storeData.id);
      }
      if (!storeData.store_headline) {
        storeData.store_headline = `Get the best data deals from ${storeData.store_name}. Select your network and package below`;
        await supabase.from("agent_stores").update({ store_headline: storeData.store_headline }).eq("id", storeData.id);
      }
      setStore(storeData as AgentStore);
      setStoreHeadline(storeData.store_headline || "");
      if (storeData.theme_config) setThemeColors({ ...DEFAULT_THEME, ...storeData.theme_config });
      else { await supabase.from("agent_stores").update({ theme_config: DEFAULT_THEME }).eq("id", storeData.id); setThemeColors(DEFAULT_THEME); }
      setStoreForm({
        store_name: storeData.store_name, whatsapp_number: storeData.whatsapp_number,
        support_number: storeData.support_number, whatsapp_group: storeData.whatsapp_group || "",
        show_whatsapp_group_icon: storeData.show_whatsapp_group_icon ?? true,
        momo_number: storeData.momo_number, momo_name: storeData.momo_name, momo_network: storeData.momo_network,
      });
      const [pkgRes, priceRes, orderRes, withdrawRes] = await Promise.all([
        supabase.from("data_packages").select("*").eq("active", true).order("size_gb"),
        supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", storeData.id),
        supabase.from("orders").select("*").eq("agent_store_id", storeData.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("withdrawal_requests").select("*").eq("agent_store_id", storeData.id).order("created_at", { ascending: false }),
      ]);
      const packagesData = pkgRes.data ?? [];
      setPackages(packagesData);
      const priceMap: Record<string, number> = {};
      (priceRes.data ?? []).forEach((p: any) => { priceMap[p.package_id] = p.sell_price; });
      setAgentPrices(priceMap);
      const ordersData = (orderRes.data as Order[]) ?? [];
      setOrders(ordersData);
      setWithdrawals((withdrawRes.data as WithdrawalRequest[]) ?? []);
      setProfitStats(calculateProfitStats(ordersData, packagesData));
      const storeSlug = storeData.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const storeUrl = `https://${storeSlug}.datastores.shop`;
      setShareText(`🎉 Get the best data deals from ${storeData.store_name}!\n\n📱 MTN • AirtelTigo • Telecel\n💨 Instant delivery • 24/7 Support\n\nVisit: ${storeUrl}\nWhatsApp: ${storeData.whatsapp_number}`);
    } else {
      const { data: pkgData } = await supabase.from("data_packages").select("*").eq("active", true).order("size_gb");
      setPackages(pkgData ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { if (user) fetchAllData(); }, [user]);

  useEffect(() => {
    if (!store?.id) return;
    const storeChannel = supabase.channel('agent-store-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agent_stores', filter: `id=eq.${store.id}` }, (payload) => {
        fetchAllData();
        if (payload.new && (payload.new as any).wallet_balance !== (payload.old as any).wallet_balance)
          toast({ title: "Wallet updated!", description: `New balance: GH₵ ${(payload.new as any).wallet_balance?.toFixed(2)}` });
      }).subscribe();
    const withdrawalChannel = supabase.channel('withdrawal-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'withdrawal_requests', filter: `agent_store_id=eq.${store.id}` }, (payload) => {
        const newStatus = (payload.new as any)?.status;
        const oldStatus = (payload.old as any)?.status;
        if (newStatus === 'completed' && oldStatus !== 'completed') { fetchAllData(); toast({ title: "Withdrawal approved!" }); }
        else if (newStatus !== oldStatus) fetchAllData();
      }).subscribe();
    const priceChannel = supabase.channel('agent-price-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_package_prices', filter: `agent_store_id=eq.${store.id}` }, () => {
        fetchAllData(); toast({ title: "Prices updated" });
      }).subscribe();
    return () => { supabase.removeChannel(storeChannel); supabase.removeChannel(withdrawalChannel); supabase.removeChannel(priceChannel); };
  }, [store?.id]);

  useEffect(() => {
    if (!store?.id) return;
    const interval = setInterval(() => fetchAllData(), 10000);
    return () => clearInterval(interval);
  }, [store?.id]);

  useEffect(() => {
    if (orders.length > 0 && packages.length > 0) setProfitStats(calculateProfitStats(orders, packages));
  }, [orders, packages]);

  const fetchNotifications = async () => {
    if (!store?.id) return;
    setLoadingNotifications(true);
    const { data, error } = await supabase.from('agent_notifications' as any).select('*').eq('agent_store_id', store.id).order('created_at', { ascending: false });
    if (!error && data) setNotifications(data as Notification[]);
    setLoadingNotifications(false);
  };
  useEffect(() => { if (store?.id) fetchNotifications(); }, [store]);

  const createNotification = async () => {
    if (!store || !newNotificationMsg.trim()) { toast({ title: "Error", description: "Please enter a message", variant: "destructive" }); return; }
    setSendingNotification(true);
    const expires_at = newNotificationExpiry ? new Date(newNotificationExpiry).toISOString() : null;
    const { error } = await supabase.from('agent_notifications' as any).insert({ agent_store_id: store.id, message: newNotificationMsg.trim(), is_active: true, expires_at });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Notification sent!" }); setNewNotificationMsg(""); setNewNotificationExpiry(""); fetchNotifications(); }
    setSendingNotification(false);
  };

  const toggleNotificationActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from('agent_notifications' as any).update({ is_active: !currentActive }).eq('id', id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from('agent_notifications' as any).delete().eq('id', id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchNotifications();
  };

  const saveThemeColors = async () => {
    if (!store) return;
    setSavingTheme(true);
    const { error } = await supabase.from("agent_stores").update({ theme_config: themeColors }).eq("id", store.id);
    if (error) toast({ title: "Error saving theme", description: error.message, variant: "destructive" });
    else toast({ title: "Store theme updated!" });
    setSavingTheme(false);
  };
  const resetToDefault = () => setThemeColors(DEFAULT_THEME);
  const changeColumns = (delta: number) => {
    const newVal = Math.min(6, Math.max(1, (themeColors.gridColumns || 2) + delta));
    setThemeColors({ ...themeColors, gridColumns: newVal });
  };

  const saveStoreHeadline = async () => {
    if (!store) return;
    setSavingHeadline(true);
    const { error } = await supabase.from("agent_stores").update({ store_headline: storeHeadline }).eq("id", store.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Store headline updated!" }); setStore({ ...store, store_headline: storeHeadline }); }
    setSavingHeadline(false);
  };

  const handlePriceChange = (pkgId: string, value: string) => setEditedPrices((prev) => ({ ...prev, [pkgId]: parseFloat(value) }));

  const savePrices = async () => {
    if (!store) return;
    setSavingPrices(true);
    try {
      for (const [pkgId, sellPrice] of Object.entries(editedPrices)) {
        const pkg = packages.find(p => p.id === pkgId);
        if (!pkg) continue;
        if (isNaN(sellPrice) || sellPrice <= 0) { toast({ title: "Validation error", description: `Price for ${pkg.size_gb}GB ${pkg.network} must be a valid positive number.`, variant: "destructive" }); setSavingPrices(false); return; }
        if (sellPrice < pkg.agent_price) { toast({ title: "Validation error", description: `Price for ${pkg.size_gb}GB ${pkg.network} cannot be below GH₵ ${pkg.agent_price.toFixed(2)}.`, variant: "destructive" }); setSavingPrices(false); return; }
      }
      for (const [pkgId, sellPrice] of Object.entries(editedPrices)) {
        const numericPrice = Number(sellPrice);
        if (agentPrices[pkgId] !== undefined) {
          const { error } = await supabase.from("agent_package_prices").update({ sell_price: numericPrice }).eq("agent_store_id", store.id).eq("package_id", pkgId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("agent_package_prices").insert({ agent_store_id: store.id, package_id: pkgId, sell_price: numericPrice });
          if (error) throw error;
        }
      }
      const { data: freshPrices } = await supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", store.id);
      const newPriceMap: Record<string, number> = {};
      (freshPrices ?? []).forEach((p: any) => { newPriceMap[p.package_id] = p.sell_price; });
      setAgentPrices(newPriceMap);
      setEditedPrices({});
      toast({ title: "Prices saved!", description: "New selling prices are now active." });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSavingPrices(false); }
  };

  const saveStoreInfo = async () => {
    if (!store) return;
    setSavingStore(true);
    const { error } = await supabase.from("agent_stores").update({
      store_name: storeForm.store_name, whatsapp_number: storeForm.whatsapp_number,
      support_number: storeForm.support_number, whatsapp_group: storeForm.whatsapp_group || null,
      show_whatsapp_group_icon: storeForm.show_whatsapp_group_icon,
      momo_number: storeForm.momo_number, momo_name: storeForm.momo_name, momo_network: storeForm.momo_network,
    }).eq("id", store.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setStore({ ...store, ...storeForm, whatsapp_group: storeForm.whatsapp_group || null }); setEditingStore(false); toast({ title: "Store info updated!" }); }
    setSavingStore(false);
  };

  const openBuyDialog = (pkg: DataPackage) => { setBuyPkg(pkg); setBuyPhone(""); setBuyStep("phone"); setBuyPaymentMethod("wallet"); setBuyDialogOpen(true); };

  const handleBuyConfirm = async () => {
    if (!store || !buyPkg) return;
    setBuyLoading(true);
    const cutoffTime = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const { data: recentOrders } = await supabase.from("orders").select("created_at").eq("customer_number", buyPhone.trim()).eq("agent_store_id", store.id).gte("created_at", cutoffTime).order("created_at", { ascending: false }).limit(1);
    if (recentOrders && recentOrders.length > 0) {
      const elapsed = Math.floor((Date.now() - new Date(recentOrders[0].created_at).getTime()) / 60000);
      toast({ title: "Rate limit exceeded", description: `Wait ${45 - elapsed} more minute(s).`, variant: "destructive" });
      setBuyLoading(false); return;
    }
    const agentPrice = Number(buyPkg.agent_price);
    if (buyPaymentMethod === "wallet") {
      if (Number(store.wallet_balance) < agentPrice) { toast({ title: "Insufficient balance", variant: "destructive" }); setBuyLoading(false); return; }
      const { error: walletErr } = await supabase.from("agent_stores").update({ wallet_balance: Number(store.wallet_balance) - agentPrice }).eq("id", store.id);
      if (walletErr) { toast({ title: "Error", description: walletErr.message, variant: "destructive" }); setBuyLoading(false); return; }
      const { data: orderData, error: orderErr } = await supabase.from("orders").insert({ customer_number: buyPhone.trim(), network: buyPkg.network, size_gb: buyPkg.size_gb, amount: agentPrice, package_id: buyPkg.id, agent_store_id: store.id, status: "paid", fulfillment_status: "pending", payment_method: "wallet" }).select("id").single();
      if (orderErr) { toast({ title: "Order error", description: orderErr.message, variant: "destructive" }); setBuyLoading(false); return; }
      await supabase.functions.invoke("fulfill-order", { body: { order_id: orderData.id } });
      setStore({ ...store, wallet_balance: Number(store.wallet_balance) - agentPrice });
      toast({ title: "Order placed!" });
      setBuyDialogOpen(false);
      const { data: newOrders } = await supabase.from("orders").select("*").eq("agent_store_id", store.id).order("created_at", { ascending: false }).limit(100);
      setOrders((newOrders as Order[]) ?? []);
    } else {
      try {
        const userEmail = user?.email || `agent-${store.id}@datapluggh.com`;
        const total = Math.round((agentPrice + (agentPrice * 1.95 / 100)) * 100) / 100;
        const { data, error } = await supabase.functions.invoke("initialize-payment", { body: { email: userEmail, amount: total, phone: buyPhone.trim(), callback_url: `${window.location.origin}/agent?payment=verifying`, metadata: { package_id: buyPkg.id, network: buyPkg.network, package_name: `${buyPkg.size_gb}GB`, agent_store_id: store.id, payment_method: "paystack", use_agent_price: true } } });
        if (error) throw error;
        if (data?.authorization_url) window.location.href = data.authorization_url;
        else throw new Error(data?.error || "Failed to initialize payment");
      } catch (err: any) { toast({ title: "Payment Error", description: err.message, variant: "destructive" }); }
    }
    setBuyLoading(false);
  };

  const handleWithdraw = async () => {
    if (!store) return;
    if (hasPendingWithdrawal) { toast({ title: "Withdrawal already pending", variant: "destructive" }); return; }
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 10) { toast({ title: "Minimum withdrawal is GH₵ 10.00", variant: "destructive" }); return; }
    if (amount > profitStats.availableForWithdrawal) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setWithdrawLoading(true);
    const { error } = await supabase.from("withdrawal_requests").insert({ agent_store_id: store.id, amount });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Withdrawal request placed!" }); setWithdrawAmount(""); const { data } = await supabase.from("withdrawal_requests").select("*").eq("agent_store_id", store.id).order("created_at", { ascending: false }); setWithdrawals((data as WithdrawalRequest[]) ?? []); }
    setWithdrawLoading(false);
  };

  // ---------- FLYER HELPERS ----------
  const getFlyerPrice = (pkg: DataPackage) => agentPrices[pkg.id] ?? pkg.price;

  const getMtnPackages = () => MTN_SIZES.map(size => {
    const pkg = packages.find(p => p.network === "mtn" && p.size_gb === size);
    return pkg ? { size, price: getFlyerPrice(pkg) } : null;
  }).filter(Boolean) as { size: number; price: number }[];

  const getAirtelPackages = () => AIRTEL_SIZES.map(size => {
    const pkg = packages.find(p => p.network === "airteltigo" && p.size_gb === size);
    return pkg ? { size, price: getFlyerPrice(pkg) } : null;
  }).filter(Boolean) as { size: number; price: number }[];

  const getTelecelPackages = () => TELECEL_SIZES.map(size => {
    const pkg = packages.find(p => p.network === "telecel" && p.size_gb === size);
    return pkg ? { size, price: getFlyerPrice(pkg) } : null;
  }).filter(Boolean) as { size: number; price: number }[];

  const saveFlyerColors = (colors: typeof flyerColors) => {
    setFlyerColors(colors);
    localStorage.setItem("flyerColors", JSON.stringify(colors));
    toast({ title: "Flyer colours saved!" });
  };

  const downloadFlyer = async () => {
    if (!flyerRef.current) return;
    setGeneratingFlyer(true);
    try {
      const dataUrl = await toPng(flyerRef.current, { quality: 1, pixelRatio: 2, backgroundColor: "#0a0a0f" });
      const link = document.createElement("a");
      link.download = `${store?.store_name.replace(/\s+/g, "-")}-flyer.png`;
      link.href = dataUrl; link.click();
      toast({ title: "Flyer downloaded!" });
    } catch { toast({ title: "Error", description: "Could not generate flyer.", variant: "destructive" }); }
    finally { setGeneratingFlyer(false); }
  };

  const shareFlyer = async () => {
    if (!flyerRef.current) return;
    setGeneratingFlyer(true);
    try {
      const dataUrl = await toPng(flyerRef.current, { quality: 1, pixelRatio: 2, backgroundColor: "#0a0a0f" });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "flyer.png", { type: "image/png" });
      const storeSlug = store?.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const fullShareText = `${shareText}\n\nStore: https://${storeSlug}.datastores.shop`;
      if (navigator.share) {
        await navigator.share({ title: "Data Price Flyer", text: fullShareText, files: [file] });
        toast({ title: "Shared successfully!" });
      } else {
        await navigator.clipboard.writeText(fullShareText);
        toast({ title: "Text copied!" });
        const link = document.createElement("a"); link.download = "flyer.png"; link.href = dataUrl; link.click();
      }
    } catch (error: any) { if (error.name !== "AbortError") toast({ title: "Error", description: "Could not share flyer.", variant: "destructive" }); }
    finally { setGeneratingFlyer(false); }
  };

  const copyPhoneNumber = (phone: string) => { navigator.clipboard.writeText(phone); toast({ title: "Phone number copied!", description: phone }); };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Zap className="h-10 w-10 text-primary animate-pulse" />
          <p className="text-muted-foreground font-display">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    if (!store) return <Navigate to="/agent-onboarding" replace />;
    if (!store.approved) return <Navigate to="/pending-approval" replace />;
  }

  const filteredPackages = packages.filter((p) => p.network === networkFilter);
  const storeSlug = store ? store.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "";
  const storeUrl = `https://${storeSlug}.datastores.shop`;
  const copyStoreLink = () => { navigator.clipboard.writeText(storeUrl); toast({ title: "Link copied!", description: storeUrl }); };
  const copyRef = () => { if (store?.topup_reference) { navigator.clipboard.writeText(store.topup_reference); toast({ title: "Reference copied!" }); } };
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const filteredOrders = orders.filter(order =>
    order.customer_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
    order.id.toLowerCase().includes(orderSearch.toLowerCase())
  );

  const mtnPkgs = getMtnPackages();
  const airtelPkgs = getAirtelPackages();
  const telecelPkgs = getTelecelPackages();

  // ---- FLYER PACKAGE CARD component (inline, scaled for 854x1231) ----
  const FlyerPkgCard = ({
    size, price, network, accentColor, btnTextColor = "#000",
  }: { size: number; price: number; network: string; accentColor: string; btnTextColor?: string }) => (
    <div style={{
      borderRadius: 18, padding: "13px 9px", textAlign: "center",
      background: `${accentColor}12`, border: `2.2px solid ${accentColor}25`,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{size}GB</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: `${accentColor}cc`, textTransform: "uppercase", letterSpacing: 0.6 }}>{network}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#ccc" }}>GH₵{price.toFixed(2)}</div>
      <div style={{
        width: "100%", padding: "6px 0", borderRadius: 9, background: accentColor,
        color: btnTextColor, fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6,
      }}>Buy Now</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <NotificationPopup />

      {/* NAV */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer group">
                  <Menu className="h-5 w-5 text-primary" />
                  <span className="font-display text-lg font-bold text-primary animate-pulse">MENU</span>
                </div>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4 bg-card border-r border-border">
                <SheetHeader className="mb-6">
                  <SheetTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2">
                  {menuItems.map((item) => (
                    <SheetClose asChild key={item.id}>
                      <button onClick={() => setActiveTab(item.id)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-left w-full">
                        <item.icon className="h-5 w-5 text-primary" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    </SheetClose>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && <Button variant="ghost" size="sm" asChild><Link to="/admin">Admin</Link></Button>}
            <Button variant="ghost" size="sm" asChild><Link to="/">Home</Link></Button>
            <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sign Out</Button>
          </div>
        </div>
      </nav>

      <div className="container py-8 space-y-6">
        {store && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Your Store Website</p>
                <p className="text-xs text-muted-foreground">{storeUrl}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyStoreLink}><Copy className="h-4 w-4 mr-1" /> Copy Link</Button>
                <Button variant="hero" size="sm" asChild><a href={storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Visit Store</a></Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="hidden" />

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Store Status</p><Badge className="mt-2 bg-green-600/20 text-green-400 border-green-600/30">Active</Badge></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Total Orders</p><p className="font-display text-2xl font-bold mt-1 text-foreground">{totalOrders}</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Pending</p><p className="font-display text-2xl font-bold mt-1 text-primary">{pendingOrders}</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Revenue</p><p className="font-display text-2xl font-bold mt-1 text-green-400">GH₵ {profitStats.totalRevenue.toFixed(2)}</p></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Profit</p><p className="font-display text-2xl font-bold text-green-400 mt-1">GH₵ {profitStats.totalProfit.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">(Selling Price - Base Price)</p></div><TrendingUp className="h-8 w-8 text-green-400 opacity-50" /></div></CardContent></Card>
              <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Available for Withdrawal</p><p className="font-display text-2xl font-bold text-yellow-400 mt-1">GH₵ {Number(store?.wallet_balance ?? 0).toFixed(2)}</p></div><ArrowDownToLine className="h-8 w-8 text-yellow-400 opacity-50" /></div></CardContent></Card>
            </div>
            <Card className="border-border">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="font-display text-lg">Recent Orders</CardTitle>
                <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by number or order ID..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} className="pl-9" /></div>
              </CardHeader>
              <CardContent>
                {filteredOrders.length === 0 ? (<p className="text-muted-foreground text-center py-4">No orders found.</p>) : (
                  <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Number</TableHead><TableHead>Network</TableHead><TableHead>Size</TableHead><TableHead>Selling Price</TableHead><TableHead>Base Cost</TableHead><TableHead>Your Profit</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{filteredOrders.slice(0, 20).map((order) => { const pkg = packages.find(p => p.id === order.package_id); const cost = pkg?.agent_price || 0; const profit = Number(order.amount) - cost; return (<TableRow key={order.id}><TableCell className="text-sm">{new Date(order.created_at).toLocaleDateString()}</TableCell><TableCell className="font-mono text-sm">{order.customer_number}</TableCell><TableCell className="uppercase text-sm">{order.network}</TableCell><TableCell className="font-display font-bold">{order.size_gb}GB</TableCell><TableCell className="font-medium">GH₵ {Number(order.amount).toFixed(2)}</TableCell><TableCell className="text-muted-foreground">GH₵ {cost.toFixed(2)}</TableCell><TableCell className={profit >= 0 ? "text-green-400 font-semibold" : "text-red-400"}>GH₵ {profit.toFixed(2)}</TableCell><TableCell><Badge variant="outline" className="text-xs">{order.payment_method === "wallet" ? "Wallet" : "Paystack"}</Badge></TableCell><TableCell><Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>{order.status === "paid" ? "completed" : order.status}</Badge></TableCell></TableRow>); })}</TableBody></Table></div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUY DATA */}
          <TabsContent value="buy" className="space-y-4 mt-0">
            {store && (<Card className="border-border bg-secondary/30"><CardContent className="p-4 flex items-center justify-between"><div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /><span className="font-medium">Wallet Balance:</span></div><span className="font-display text-xl font-bold text-primary">GH₵ {store.wallet_balance?.toFixed(2) ?? '0.00'}</span></CardContent></Card>)}
            <div className="flex gap-2 flex-wrap">{["mtn", "airteltigo", "telecel"].map((net) => (<Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>{net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}</Button>))}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{filteredPackages.map((pkg) => (<Card key={pkg.id} className="border-border hover:border-primary/50 transition-all"><CardContent className="p-4 text-center space-y-3"><div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto"><Wifi className="h-5 w-5 text-primary" /></div><p className="font-display text-xl font-bold text-foreground">{pkg.size_gb}GB</p><p className="text-lg font-bold text-primary">GH₵ {Number(pkg.agent_price).toFixed(2)}</p><p className="text-xs text-muted-foreground">Agent Price</p><Button variant="hero" size="sm" className="w-full" onClick={() => openBuyDialog(pkg)}>Buy Now</Button></CardContent></Card>))}</div>
          </TabsContent>

          {/* STORE PRICES */}
          <TabsContent value="store" className="space-y-4 mt-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap">{["mtn", "airteltigo", "telecel"].map((net) => (<Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>{net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}</Button>))}</div>
              {Object.keys(editedPrices).length > 0 && (<Button variant="hero" size="sm" onClick={savePrices} disabled={savingPrices}><Save className="h-4 w-4 mr-1" /> {savingPrices ? "Saving..." : "Save Prices"}</Button>)}
            </div>
            <p className="text-sm text-muted-foreground">Set your sell prices. Your profit = Selling Price - Base Price.</p>
            <Card className="border-border"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Size</TableHead><TableHead>Base Price</TableHead><TableHead>Your Selling Price</TableHead><TableHead>Your Profit</TableHead></TableRow></TableHeader><TableBody>{filteredPackages.map((pkg) => { const currentSellPrice = editedPrices[pkg.id] ?? agentPrices[pkg.id] ?? pkg.price; const profit = currentSellPrice - pkg.agent_price; return (<TableRow key={pkg.id}><TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell><TableCell className="text-muted-foreground">GH₵ {Number(pkg.agent_price).toFixed(2)}</TableCell><TableCell><Input type="number" step="0.01" value={currentSellPrice} onChange={(e) => handlePriceChange(pkg.id, e.target.value)} className="w-24 h-8" /></TableCell><TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>GH₵ {profit.toFixed(2)}</TableCell></TableRow>); })}</TableBody></Table></div></Card>
          </TabsContent>

          {/* ===================== FLYER GENERATOR ===================== */}
          {/* Full‑width, no card wrapper, auto‑scaling flyer */}
          <TabsContent value="flyer" className="mt-0">
            <div className="space-y-5">
              {/* Colour pickers + share message + action buttons (same as before) */}
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3 items-center">
                  {[
                    { label: "MTN", key: "mtnColor" },
                    { label: "Airtel", key: "airtelColor" },
                    { label: "Telecel", key: "telecelColor" },
                    { label: "Button", key: "buttonBg" },
                  ].map(({ label, key }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Label className="text-xs">{label}</Label>
                      <Input type="color" value={(flyerColors as any)[key]}
                        onChange={(e) => setFlyerColors({ ...flyerColors, [key]: e.target.value })}
                        className="w-10 h-8 p-0 cursor-pointer" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveFlyerColors(flyerColors)}><Save className="h-3 w-3 mr-1" /> Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => saveFlyerColors(DEFAULT_FLYER_COLORS)}><RotateCcw className="h-3 w-3 mr-1" /> Reset</Button>
                </div>
              </div>

              <div>
                <Label className="text-sm">Share Message</Label>
                <Textarea value={shareText} onChange={(e) => setShareText(e.target.value)} rows={2} className="mt-1 text-sm" />
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={downloadFlyer} disabled={generatingFlyer}>
                  {generatingFlyer ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} Download PNG
                </Button>
                <Button variant="hero" onClick={shareFlyer} disabled={generatingFlyer}>
                  {generatingFlyer ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Share2 className="h-4 w-4 mr-1" />} Share Flyer
                </Button>
              </div>

              {/* Flyer preview – full width, horizontal scroll if needed, no surrounding white box */}
              <div className="w-full overflow-x-auto bg-black/20 rounded-lg p-2">
                <div className="flex justify-center min-w-[854px]">
                  <div
                    ref={flyerRef}
                    style={{
                      width: 854,
                      minHeight: 1231,
                      backgroundColor: "#060608",
                      fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {/* Top Nav Bar */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "22px 30px", backgroundColor: "#09090d",
                      borderBottom: "2.2px solid #1a1a2e",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                        <div style={{
                          width: 57, height: 57, background: flyerColors.buttonBg,
                          borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="31" height="31" viewBox="0 0 16 16" fill="white">
                            <path d="M13 6H3L2 10h12L13 6zM8 1l1.5 4h-3L8 1zM3 10l1 4h8l1-4H3z" />
                          </svg>
                        </div>
                        <span style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: 0.6 }}>
                          DATA PLUG <span style={{ color: flyerColors.buttonBg }}>.STORE</span>
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 26 }}>
                        {["Packages", "Services", "Become an Agent"].map(l => (
                          <span key={l} style={{ fontSize: 19, color: "#888", fontWeight: 500 }}>{l}</span>
                        ))}
                        <span style={{ fontSize: 19, color: flyerColors.buttonBg, fontWeight: 700, padding: "4px 15px", background: `${flyerColors.buttonBg}20`, borderRadius: 11 }}>Agent Dashboard</span>
                        <span style={{ fontSize: 19, color: "#ccc", fontWeight: 500 }}>Sign Out</span>
                      </div>
                    </div>

                    {/* Page Header */}
                    <div style={{ textAlign: "center", padding: "40px 30px 22px" }}>
                      <div style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: -1, textTransform: "uppercase" }}>
                        DATA BUNDLES – <span style={{ color: "#fff" }}>ALL NETWORKS</span>
                      </div>
                      <div style={{ fontSize: 22, color: "#777", marginTop: 8, fontWeight: 500 }}>
                        Affordable. Instant. Reliable.
                      </div>
                    </div>

                    {/* Network Tabs */}
                    <div style={{ display: "flex", margin: "0 30px 30px", borderRadius: 22, overflow: "hidden", border: "2.2px solid #222" }}>
                      {[
                        { label: "MTN", color: flyerColors.mtnColor, textColor: "#000" },
                        { label: "AirtelTigo", color: flyerColors.airtelColor, textColor: "#fff" },
                        { label: "Telecel", color: flyerColors.telecelColor, textColor: "#fff" },
                      ].map((tab, i) => (
                        <div key={tab.label} style={{
                          flex: 1, padding: "17px 9px", textAlign: "center",
                          background: i === 0 ? tab.color : i === 1 ? tab.color : tab.color,
                          color: tab.textColor,
                          fontSize: 22, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.1,
                        }}>{tab.label}</div>
                      ))}
                    </div>

                    {/* MTN Section */}
                    <div style={{
                      margin: "0 22px 22px",
                      border: `3.3px solid ${flyerColors.mtnColor}40`,
                      borderRadius: 26, overflow: "hidden",
                      backgroundColor: "#0f0c00",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "17px 26px", backgroundColor: "#0a0800",
                        borderBottom: `2.2px solid ${flyerColors.mtnColor}20`,
                      }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: flyerColors.mtnColor, letterSpacing: 1.2, textTransform: "uppercase" }}>
                          MTN DATA BUNDLES
                        </span>
                        <span style={{
                          fontSize: 19, fontWeight: 800, color: flyerColors.mtnColor,
                          border: `2.2px solid ${flyerColors.mtnColor}60`,
                          borderRadius: 44, padding: "4px 17px", textTransform: "uppercase",
                        }}>MTN</span>
                      </div>
                      <div style={{
                        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
                        gap: 9, padding: "13px 13px 17px",
                      }}>
                        {mtnPkgs.map(({ size, price }) => (
                          <FlyerPkgCard key={size} size={size} price={price} network="MTN" accentColor={flyerColors.mtnColor} btnTextColor="#000" />
                        ))}
                      </div>
                    </div>

                    {/* AirtelTigo Section */}
                    <div style={{
                      margin: "0 22px 22px",
                      border: `3.3px solid ${flyerColors.airtelColor}40`,
                      borderRadius: 26, overflow: "hidden",
                      backgroundColor: "#0c0818",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "17px 26px", backgroundColor: "#080514",
                        borderBottom: `2.2px solid ${flyerColors.airtelColor}20`,
                      }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: flyerColors.airtelColor, letterSpacing: 1.2, textTransform: "uppercase" }}>
                          AIRTELTIGO DATA BUNDLES
                        </span>
                        <span style={{
                          fontSize: 19, fontWeight: 800, color: flyerColors.airtelColor,
                          border: `2.2px solid ${flyerColors.airtelColor}60`,
                          borderRadius: 44, padding: "4px 17px",
                        }}>airtel tigo</span>
                      </div>
                      <div style={{
                        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
                        gap: 9, padding: "13px 13px 17px",
                      }}>
                        {airtelPkgs.map(({ size, price }) => (
                          <FlyerPkgCard key={size} size={size} price={price} network="AIRTELTIGO" accentColor={flyerColors.airtelColor} btnTextColor="#fff" />
                        ))}
                      </div>
                    </div>

                    {/* Telecel Section */}
                    <div style={{
                      margin: "0 22px 22px",
                      border: `3.3px solid ${flyerColors.telecelColor}40`,
                      borderRadius: 26, overflow: "hidden",
                      backgroundColor: "#100404",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "17px 26px", backgroundColor: "#0a0000",
                        borderBottom: `2.2px solid ${flyerColors.telecelColor}20`,
                      }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: flyerColors.telecelColor, letterSpacing: 1.2, textTransform: "uppercase" }}>
                          TELECEL DATA BUNDLES
                        </span>
                        <span style={{
                          fontSize: 19, fontWeight: 800, color: flyerColors.telecelColor,
                          border: `2.2px solid ${flyerColors.telecelColor}60`,
                          borderRadius: 44, padding: "4px 17px",
                        }}>telecel</span>
                      </div>
                      <div style={{
                        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
                        gap: 9, padding: "13px 13px 17px",
                      }}>
                        {telecelPkgs.map(({ size, price }) => (
                          <FlyerPkgCard key={size} size={size} price={price} network="TELECEL" accentColor={flyerColors.telecelColor} btnTextColor="#fff" />
                        ))}
                      </div>
                    </div>

                    {/* WhatsApp Join Banner */}
                    {store?.whatsapp_group && (
                      <div style={{
                        margin: "0 22px 22px",
                        background: "#0d7c30",
                        borderRadius: 22,
                        padding: "22px 30px",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="#25D366">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                          <div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Join channel — get updates &amp; free giveaways</div>
                            <div style={{ fontSize: 17, color: "#86efac", marginTop: 3 }}>Stay updated with the latest bundles, promos &amp; offers.</div>
                          </div>
                        </div>
                        <div style={{
                          background: "#fff", color: "#0d7c30", fontWeight: 800, fontSize: 19,
                          padding: "10px 27px", borderRadius: 44,
                        }}>Join Now</div>
                      </div>
                    )}

                    {/* Store URL Footer */}
                    <div style={{ textAlign: "center", padding: "13px 0 26px", fontSize: 20, color: "#444" }}>
                      <span style={{ color: flyerColors.buttonBg }}>{storeUrl}</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Width: 854px, Height: 1231px. Prices shown are your store's selling prices. Tap Share to send image + message.
              </p>
            </div>
          </TabsContent>
          {/* ===================== END FLYER ===================== */}

          {/* WITHDRAW */}
          <TabsContent value="withdraw" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-primary/30 bg-primary/5"><CardContent className="p-6 text-center space-y-2"><TrendingUp className="h-10 w-10 text-primary mx-auto" /><p className="text-muted-foreground text-sm">Total Profit</p><p className="font-display text-3xl font-bold text-green-400">GH₵ {profitStats.totalProfit.toFixed(2)}</p></CardContent></Card>
              <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-6 text-center space-y-2"><ArrowDownToLine className="h-10 w-10 text-yellow-400 mx-auto" /><p className="text-muted-foreground text-sm">Available for Withdrawal</p><p className="font-display text-3xl font-bold text-yellow-400">GH₵ {profitStats.availableForWithdrawal.toFixed(2)}</p></CardContent></Card>
            </div>
            <Card className="border-border">
              <CardHeader><CardTitle className="font-display text-lg">Request Withdrawal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {hasPendingWithdrawal && (<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center"><p className="text-sm text-yellow-400 font-medium">⚠️ You have a pending withdrawal. Please wait until it is completed.</p></div>)}
                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center"><p className="text-xs text-muted-foreground">MoMo Name</p><p className="font-bold text-foreground">{store?.momo_name}</p></div>
                    <div className="text-center"><p className="text-xs text-muted-foreground">MoMo Number</p><p className="font-bold text-foreground">{store?.momo_number}</p></div>
                    <div className="text-center"><p className="text-xs text-muted-foreground">Network</p><p className="font-bold text-foreground">{store?.momo_network?.toUpperCase()}</p></div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Minimum withdrawal: GH₵ 10.00. Processed within 24 hours.</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1"><Label>Amount (GH₵)</Label><Input type="number" step="0.01" placeholder="e.g. 50.00" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} disabled={hasPendingWithdrawal} /></div>
                  <Button variant="hero" onClick={handleWithdraw} disabled={withdrawLoading || hasPendingWithdrawal}>{withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />} Withdraw</Button>
                </div>
              </CardContent>
            </Card>
            {withdrawals.length > 0 && (
              <Card className="border-border">
                <CardHeader><CardTitle className="font-display text-lg">Withdrawal History</CardTitle></CardHeader>
                <CardContent><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{withdrawals.map((w) => (<TableRow key={w.id}><TableCell className="text-sm">{new Date(w.created_at).toLocaleString()}</TableCell><TableCell className="font-bold">GH₵ {Number(w.amount).toFixed(2)}</TableCell><TableCell><Badge className={w.status === "completed" ? "bg-green-600/20 text-green-400 border-green-600/30" : w.status === "pending" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" : "bg-red-600/20 text-red-400 border-red-600/30"}>{w.status}</Badge></TableCell></TableRow>))}</TableBody></Table></CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TOPUP */}
          <TabsContent value="topup" className="mt-0">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-display flex items-center gap-2"><Coins className="h-5 w-5 text-primary" /> Top Up Your Wallet</CardTitle><p className="text-sm text-muted-foreground">Add money to your wallet using MoMo.</p></CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-primary/5 border border-primary/30 p-4 text-center"><p className="text-sm text-muted-foreground">Current Wallet Balance</p><p className="font-display text-3xl font-bold text-primary">GH₵ {store?.wallet_balance?.toFixed(2) ?? '0.00'}</p></div>
                <div className="space-y-4"><h3 className="font-semibold text-lg">Follow these steps to top up:</h3><ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground"><li>Dial <span className="font-mono font-bold text-foreground">*170#</span> on your MTN mobile money registered phone.</li><li>Select option <span className="font-bold text-foreground">1</span> (Transfer Money).</li><li>Select option <span className="font-bold text-foreground">1</span> (MoMo User).</li><li>Enter the recipient number: <span className="font-mono font-bold text-foreground">0599449202</span> <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyPhoneNumber("0599449202")}><Copy className="h-3 w-3" /></Button></li><li>Enter the amount you want to add.</li><li>Use your agent store top-up reference: <div className="mt-2 p-3 bg-secondary/50 rounded-lg border border-border font-mono font-bold text-center text-primary text-xl">{store?.topup_reference ?? "N/A"} <Button variant="ghost" size="sm" className="ml-2 h-8" onClick={copyRef}><Copy className="h-3 w-3" /> Copy</Button></div></li><li>After successful payment, send the transaction ID to: <div className="mt-2 flex flex-wrap gap-3"><Button variant="outline" size="sm" asChild><a href="https://wa.me/233200511211" target="_blank" rel="noopener noreferrer">📱 WhatsApp 0200511211</a></Button><Button variant="outline" size="sm" asChild><a href="tel:0599449202">📞 Call 0599449202</a></Button></div></li></ol></div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm"><p className="font-semibold text-yellow-400">⚠️ Important</p><p className="text-muted-foreground">Once you send the transaction ID, the admin will verify and credit your wallet.</p></div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* APPEARANCE */}
          <TabsContent value="appearance" className="mt-0">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-display">Customise Your Storefront</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2"><Label>Store Headline</Label><Textarea value={storeHeadline} onChange={(e) => setStoreHeadline(e.target.value)} rows={3} /><Button variant="outline" size="sm" onClick={saveStoreHeadline} disabled={savingHeadline} className="mt-2">{savingHeadline ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save Headline</Button></div>
                <div className="border-t border-border pt-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Primary Colour</Label><div className="flex gap-2 items-center"><Input type="color" value={themeColors.primary} onChange={(e) => setThemeColors({ ...themeColors, primary: e.target.value })} className="w-16 h-10 p-1" /><Input type="text" value={themeColors.primary} onChange={(e) => setThemeColors({ ...themeColors, primary: e.target.value })} className="flex-1" /></div></div>
                  <div className="space-y-2"><Label>Text Colour on Primary</Label><div className="flex gap-2 items-center"><Input type="color" value={themeColors.primary_foreground} onChange={(e) => setThemeColors({ ...themeColors, primary_foreground: e.target.value })} className="w-16 h-10 p-1" /><Input type="text" value={themeColors.primary_foreground} onChange={(e) => setThemeColors({ ...themeColors, primary_foreground: e.target.value })} className="flex-1" /></div></div>
                  <div className="space-y-2"><Label>Page Background</Label><div className="flex gap-2 items-center"><Input type="color" value={themeColors.background} onChange={(e) => setThemeColors({ ...themeColors, background: e.target.value })} className="w-16 h-10 p-1" /><Input type="text" value={themeColors.background} onChange={(e) => setThemeColors({ ...themeColors, background: e.target.value })} className="flex-1" /></div></div>
                  <div className="space-y-2"><Label>Card Background</Label><div className="flex gap-2 items-center"><Input type="color" value={themeColors.card_background} onChange={(e) => setThemeColors({ ...themeColors, card_background: e.target.value })} className="w-16 h-10 p-1" /><Input type="text" value={themeColors.card_background} onChange={(e) => setThemeColors({ ...themeColors, card_background: e.target.value })} className="flex-1" /></div></div>
                </div>
                <div className="border-t border-border pt-4"><h3 className="text-md font-semibold flex items-center gap-2 mb-3"><LayoutGrid className="h-5 w-5 text-primary" /> Product Grid Layout</h3><div className="max-w-xs"><Label className="mb-2 block">Columns per row</Label><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => changeColumns(-1)} disabled={themeColors.gridColumns <= 1}><Minus className="h-4 w-4" /></Button><Input type="number" min={1} max={6} value={themeColors.gridColumns} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 1 && val <= 6) setThemeColors({ ...themeColors, gridColumns: val }); }} className="w-20 text-center" /><Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => changeColumns(1)} disabled={themeColors.gridColumns >= 6}><PlusIcon className="h-4 w-4" /></Button></div></div></div>
                <div className="flex gap-3"><Button variant="hero" onClick={saveThemeColors} disabled={savingTheme} className="flex-1">{savingTheme ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save</Button><Button variant="outline" onClick={resetToDefault} className="flex-1"><RotateCcw className="h-4 w-4 mr-1" /> Reset to Default</Button></div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTIFICATIONS */}
          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card className="border-border"><CardHeader><CardTitle className="font-display flex items-center gap-2"><Bell className="h-5 w-5" /> Send Notification</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Message</Label><Textarea placeholder="e.g., Special offer this weekend!" value={newNotificationMsg} onChange={(e) => setNewNotificationMsg(e.target.value)} rows={3} /></div><div className="space-y-2"><Label>Expiry (optional)</Label><Input type="datetime-local" value={newNotificationExpiry} onChange={(e) => setNewNotificationExpiry(e.target.value)} /></div><Button variant="hero" onClick={createNotification} disabled={sendingNotification}>{sendingNotification ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Send Notification</Button></CardContent></Card>
            <Card className="border-border"><CardHeader><CardTitle className="font-display">Active &amp; Past Notifications</CardTitle></CardHeader><CardContent>{loadingNotifications ? (<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>) : notifications.length === 0 ? (<p className="text-center text-muted-foreground py-8">No notifications yet.</p>) : (<div className="space-y-4">{notifications.map((notif) => (<div key={notif.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-lg bg-card"><div className="flex-1"><p className="text-foreground font-medium">{notif.message}</p><div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1"><span>Created: {new Date(notif.created_at).toLocaleString()}</span>{notif.expires_at && (<span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Expires: {new Date(notif.expires_at).toLocaleString()}</span>)}</div></div><div className="flex gap-2"><Badge variant={notif.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleNotificationActive(notif.id, notif.is_active)}>{notif.is_active ? "Active" : "Inactive"}</Badge><Button variant="ghost" size="icon" onClick={() => deleteNotification(notif.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>))}</div>)}</CardContent></Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-0">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="font-display">Store Information</CardTitle>{!editingStore && (<Button variant="outline" size="sm" onClick={() => setEditingStore(true)}><Edit2 className="h-4 w-4 mr-1" /> Edit</Button>)}</CardHeader>
              <CardContent className="space-y-4">
                {editingStore ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Store Name</Label><Input value={storeForm.store_name} onChange={(e) => setStoreForm({ ...storeForm, store_name: e.target.value })} /></div>
                      <div className="space-y-2"><Label>WhatsApp Number</Label><Input value={storeForm.whatsapp_number} onChange={(e) => setStoreForm({ ...storeForm, whatsapp_number: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Support Number</Label><Input value={storeForm.support_number} onChange={(e) => setStoreForm({ ...storeForm, support_number: e.target.value })} /></div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between gap-4"><Label>WhatsApp Group Link (Optional)</Label><div className="flex items-center gap-2"><Label htmlFor="show-group-icon" className="text-sm text-muted-foreground cursor-pointer">Show join icon on storefront</Label><Switch id="show-group-icon" checked={storeForm.show_whatsapp_group_icon} onCheckedChange={(checked) => setStoreForm({ ...storeForm, show_whatsapp_group_icon: checked })} /></div></div>
                        <Input value={storeForm.whatsapp_group} onChange={(e) => setStoreForm({ ...storeForm, whatsapp_group: e.target.value })} placeholder="Paste your WhatsApp group or channel link here" />
                      </div>
                      <div className="space-y-2"><Label>MoMo Name</Label><Input value={storeForm.momo_name} onChange={(e) => setStoreForm({ ...storeForm, momo_name: e.target.value })} /></div>
                      <div className="space-y-2"><Label>MoMo Number</Label><Input value={storeForm.momo_number} onChange={(e) => setStoreForm({ ...storeForm, momo_number: e.target.value })} /></div>
                      <div className="space-y-2"><Label>MoMo Network</Label><Input value={storeForm.momo_network} onChange={(e) => setStoreForm({ ...storeForm, momo_network: e.target.value })} placeholder="mtn / airteltigo / telecel" /></div>
                    </div>
                    <div className="flex gap-2 pt-2"><Button variant="hero" size="sm" onClick={saveStoreInfo} disabled={savingStore}><Save className="h-4 w-4 mr-1" /> {savingStore ? "Saving..." : "Save Changes"}</Button><Button variant="outline" size="sm" onClick={() => setEditingStore(false)}>Cancel</Button></div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Store Name</p><p className="font-semibold text-foreground">{store?.store_name}</p></div>
                    <div><p className="text-muted-foreground">WhatsApp</p><p className="font-semibold text-foreground">{store?.whatsapp_number}</p></div>
                    <div><p className="text-muted-foreground">Support Number</p><p className="font-semibold text-foreground">{store?.support_number}</p></div>
                    <div><p className="text-muted-foreground">WhatsApp Group</p><p className="font-semibold text-foreground">{store?.whatsapp_group || "Not set"}</p></div>
                    <div><p className="text-muted-foreground">Show Group Icon</p><p className="font-semibold text-foreground">{store?.show_whatsapp_group_icon ? "Yes" : "No"}</p></div>
                    <div><p className="text-muted-foreground">MoMo Name</p><p className="font-semibold text-foreground">{store?.momo_name}</p></div>
                    <div><p className="text-muted-foreground">MoMo Number</p><p className="font-semibold text-foreground">{store?.momo_number}</p></div>
                    <div><p className="text-muted-foreground">MoMo Network</p><p className="font-semibold text-foreground">{store?.momo_network?.toUpperCase()}</p></div>
                    <div><p className="text-muted-foreground">Topup Reference</p><p className="font-display text-xl font-bold text-primary">{store?.topup_reference}</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* BUY DIALOG */}
      <Dialog open={buyDialogOpen} onOpenChange={(v) => !v && setBuyDialogOpen(false)}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader><DialogTitle className="font-display text-xl">Buy {buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</DialogTitle><DialogDescription>Purchase data at agent price</DialogDescription></DialogHeader>
          {buyStep === "phone" ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-2"><Label>Recipient Phone Number</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="tel" placeholder="0XX XXX XXXX" value={buyPhone} onChange={(e) => setBuyPhone(e.target.value)} className="pl-10" autoFocus /></div></div>
              <Button variant="hero" className="w-full" onClick={() => { if (buyPhone.trim().length < 10) { toast({ title: "Invalid number", variant: "destructive" }); return; } setBuyStep("confirm"); }}>Continue</Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Package</span><span className="font-semibold">{buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Phone</span><span className="font-semibold">{buyPhone}</span></div>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between text-base font-bold"><span>Agent Price</span><span className="text-primary">GH₵ {Number(buyPkg?.agent_price ?? 0).toFixed(2)}</span></div>
              </div>
              <div className="space-y-2"><Label>Payment Method</Label><Select value={buyPaymentMethod} onValueChange={(v) => setBuyPaymentMethod(v as "paystack" | "wallet")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="wallet"><span className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Wallet (Balance: GH₵ {store?.wallet_balance?.toFixed(2) ?? '0.00'})</span></SelectItem><SelectItem value="paystack"><span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Paystack (+ charges)</span></SelectItem></SelectContent></Select></div>
              <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setBuyStep("phone")} disabled={buyLoading}>Back</Button><Button variant="hero" className="flex-1" onClick={handleBuyConfirm} disabled={buyLoading}>{buyLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Processing...</> : "Confirm Purchase"}</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentDashboard;