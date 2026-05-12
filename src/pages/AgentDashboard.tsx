import { useState, useEffect, useRef } from "react";
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
  ChevronDown, ChevronUp, BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NotificationPopup from "@/components/NotificationPopup";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";
import { toPng } from "html-to-image";

// ─── INTERFACES ───────────────────────────────────────────
interface AgentStore {
  id: string; store_name: string; whatsapp_number: string; support_number: string;
  whatsapp_group: string | null; show_whatsapp_group_icon: boolean;
  momo_number: string; momo_name: string; momo_network: string;
  approved: boolean; wallet_balance: number; topup_reference: string;
  store_headline: string; tutorial_video_url: string | null;
  theme_config: { primary: string; primary_foreground: string; background: string; card_background: string; gridColumns: number; };
}
interface DataPackage { id: string; network: string; size_gb: number; price: number; agent_price: number; active: boolean; }
interface Order { id: string; customer_number: string; network: string; size_gb: number; amount: number; status: string; fulfillment_status: string; payment_method: string; created_at: string; package_id: string; }
interface WithdrawalRequest { id: string; amount: number; status: string; created_at: string; }
interface ProfitStats { totalRevenue: number; totalCost: number; totalProfit: number; availableForWithdrawal: number; }
interface Notification { id: string; message: string; is_active: boolean; created_at: string; expires_at: string | null; }

// ─── CONSTANTS ────────────────────────────────────────────
const DEFAULT_THEME = { primary: "#38bdf8", primary_foreground: "#000000", background: "#0a0a0a", card_background: "#171717", gridColumns: 2 };
const DEFAULT_FLYER_COLORS = { mtnColor: "#f5b81b", airtelColor: "#3b3bdb", telecelColor: "#cc0000", buttonBg: "#0066ff" };

// Exact sizes visible in screenshot
const MTN_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 100];
const AIRTEL_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40];
const TELECEL_SIZES = [2, 3, 5, 10, 11, 15, 16, 20, 22, 25, 30, 33, 40, 44, 50];

// Flyer true canvas size (1023×1491) — exported at this resolution
const FLYER_W = 1023;
const FLYER_H = 1491;

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

// ─── INSTRUCTION MANUAL DATA ──────────────────────────────
const MANUAL_SECTIONS = [
  {
    title: "📊 Overview",
    content: `The Overview is your dashboard home. Here you can see:
• Store Status — whether your store is active and approved.
• Total Orders — how many orders have been placed through your store.
• Pending Orders — orders that are still being processed.
• Total Revenue — the total amount customers have paid through your store.
• Total Profit — your revenue minus your base (agent) cost for all packages.
• Available for Withdrawal — your current wallet balance, ready to withdraw.
• Recent Orders table — shows the last 20 orders with full details including your profit per order.
Use the search box to find any order by phone number or order ID.`,
  },
  {
    title: "🛒 Buy Data",
    content: `Use this section to purchase data directly for any phone number using YOUR agent prices (not customer prices), saving you money.
• Your current Wallet Balance is shown at the top.
• Select the network (MTN, AirtelTigo, Telecel).
• Tap any package to open the buy dialog.
• Enter the recipient's phone number.
• Choose payment method:
  – Wallet (recommended): deducted instantly from your wallet, no extra charges.
  – Paystack: online card payment with a small 1.95% processing fee.
• The data is sent automatically after payment.
⚠️ Rate limit: You cannot buy data for the same number more than once every 45 minutes.`,
  },
  {
    title: "🏪 Store Prices",
    content: `This is where you set the prices your CUSTOMERS see and pay on your store website.
• The Base Price column shows what YOU pay (your agent cost).
• The Selling Price column is what your customers pay — you set this.
• Your Profit = Selling Price − Base Price.
• You cannot set a selling price lower than the base price.
• Click Save Prices after making changes.
💡 Tip: A reasonable markup of GH₵ 1–5 per package is typical. The higher your selling price, the more profit per sale — but stay competitive!`,
  },
  {
    title: "🖼️ Flyer Generator",
    content: `Create a professional price flyer to share with your customers on WhatsApp, Facebook, or anywhere.
• The flyer automatically uses YOUR store's selling prices, so it's always up to date.
• Customise the accent colours for each network using the colour pickers.
• The contact number shown at the bottom of the flyer is your Support Number (set in Settings).
• Edit the Share Message — this text is sent alongside the image when you share.
• Download PNG: saves a high-resolution 1023×1491 px image to your device.
• Share Flyer: opens your device's native share sheet so you can send to WhatsApp, Telegram, etc.
💡 Tip: Save your custom colours using the Save button so they persist next time.`,
  },
  {
    title: "💸 Withdraw",
    content: `Request a withdrawal of your profits to your registered MoMo account.
• You can only have ONE pending withdrawal at a time.
• Minimum withdrawal is GH₵ 10.00.
• Enter the amount and click Withdraw.
• Withdrawals are processed within 24 hours by the admin.
• Your MoMo name, number, and network are shown for confirmation — update them in Settings if needed.
• Once approved, you'll receive an instant notification and the status will update to "completed".`,
  },
  {
    title: "💰 Top Up",
    content: `Add money to your wallet so you can buy data at agent prices without Paystack charges.
• Follow the MoMo transfer steps shown on screen.
• Send to the number shown (0599449202) using your unique Top-Up Reference as the transaction note.
• After sending, copy the transaction ID from your phone's confirmation message and send it to the admin via WhatsApp or call.
• Your wallet will be credited by the admin after verification (usually within minutes during business hours).
💡 Tip: Keep your wallet topped up so you can fulfill orders quickly without any delays.`,
  },
  {
    title: "🎨 Appearance",
    content: `Customise how your store website looks to your customers.
• Store Headline: the main tagline customers see when they open your store — make it catchy!
• Primary Colour: used for buttons, highlights and accents across your store.
• Text on Primary: the text colour shown on primary-coloured buttons.
• Page Background & Card Background: control the overall feel of the store.
• Grid Columns: set how many packages appear per row (1–6). 2 columns is recommended for mobile customers.
• Click Save after making changes. Click Reset to go back to the default theme.`,
  },
  {
    title: "🔔 Notifications",
    content: `Send pop-up announcements to ALL visitors of your store website.
• Write a message (e.g. "Weekend promo — 20% off all MTN bundles!").
• Optionally set an expiry date/time — after this, the notification won't show anymore.
• Click Send Notification — it appears immediately on your store.
• You can toggle notifications Active/Inactive without deleting them.
• Delete old notifications using the trash icon.
💡 Tip: Use notifications to promote new offers, announce downtime, or greet new customers.`,
  },
  {
    title: "⚙️ Settings",
    content: `Manage your store's contact and payment information.
• Store Name: your public brand name (also affects your store URL).
• WhatsApp Number: used for the WhatsApp contact button on your storefront.
• Support Number: shown on your flyer and used for customer support calls.
• WhatsApp Group Link: optional — lets customers join your promo channel.
• Show Group Icon: toggle whether the join button appears on your storefront.
• MoMo Name / Number / Network: your mobile money details for receiving withdrawals.
• Top-Up Reference: your unique code — always use this when topping up your wallet.
⚠️ Keep your support number and MoMo details accurate at all times.`,
  },
];

// ─── MAIN COMPONENT ───────────────────────────────────────
const AgentDashboard = () => {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
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
  const [storeForm, setStoreForm] = useState({ store_name: "", whatsapp_number: "", support_number: "", whatsapp_group: "", show_whatsapp_group_icon: true, momo_number: "", momo_name: "", momo_network: "" });
  const [savingStore, setSavingStore] = useState(false);
  const [profitStats, setProfitStats] = useState<ProfitStats>({ totalRevenue: 0, totalCost: 0, totalProfit: 0, availableForWithdrawal: 0 });

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
  const [manualOpen, setManualOpen] = useState(false);
  const [openManualSection, setOpenManualSection] = useState<number | null>(null);

  // Flyer
  const flyerRef = useRef<HTMLDivElement>(null);
  const flyerContainerRef = useRef<HTMLDivElement>(null);
  const [generatingFlyer, setGeneratingFlyer] = useState(false);
  const [flyerScale, setFlyerScale] = useState(1);
  const [flyerColors, setFlyerColors] = useState<typeof DEFAULT_FLYER_COLORS>(() => {
    try { const s = localStorage.getItem("flyerColors"); return s ? JSON.parse(s) : DEFAULT_FLYER_COLORS; } catch { return DEFAULT_FLYER_COLORS; }
  });
  const [shareText, setShareText] = useState("");

  const hasPendingWithdrawal = withdrawals.some(w => w.status === "pending");

  // ─── calculate flyer scale to fit container ───
  useEffect(() => {
    const calcScale = () => {
      if (flyerContainerRef.current) {
        const cw = flyerContainerRef.current.clientWidth;
        // fit width; clamp so it never upscales beyond 1
        setFlyerScale(Math.min(1, cw / FLYER_W));
      }
    };
    calcScale();
    window.addEventListener("resize", calcScale);
    return () => window.removeEventListener("resize", calcScale);
  }, [activeTab]);

  // ─── data helpers ─────────────────────────────
  const calcStats = (os: Order[], ps: DataPackage[], bal: number): ProfitStats => {
    let rev = 0, cost = 0;
    os.forEach(o => { if (o.status === "completed" || o.status === "paid") { rev += Number(o.amount); const p = ps.find(x => x.id === o.package_id); if (p) cost += p.agent_price; } });
    return { totalRevenue: rev, totalCost: cost, totalProfit: rev - cost, availableForWithdrawal: bal };
  };

  const fetchAllData = async () => {
    if (!user) return;
    const { data: sd, error: se } = await supabase.from("agent_stores").select("*").eq("user_id", user.id).maybeSingle();
    if (se) { console.error(se); setLoading(false); return; }
    if (sd) {
      if (sd.show_whatsapp_group_icon == null) { sd.show_whatsapp_group_icon = true; await supabase.from("agent_stores").update({ show_whatsapp_group_icon: true }).eq("id", sd.id); }
      if (!sd.store_headline) { sd.store_headline = `Get the best data deals from ${sd.store_name}. Select your network and package below`; await supabase.from("agent_stores").update({ store_headline: sd.store_headline }).eq("id", sd.id); }
      setStore(sd as AgentStore); setStoreHeadline(sd.store_headline || "");
      if (sd.theme_config) setThemeColors({ ...DEFAULT_THEME, ...sd.theme_config });
      else { await supabase.from("agent_stores").update({ theme_config: DEFAULT_THEME }).eq("id", sd.id); setThemeColors(DEFAULT_THEME); }
      setStoreForm({ store_name: sd.store_name, whatsapp_number: sd.whatsapp_number, support_number: sd.support_number, whatsapp_group: sd.whatsapp_group || "", show_whatsapp_group_icon: sd.show_whatsapp_group_icon ?? true, momo_number: sd.momo_number, momo_name: sd.momo_name, momo_network: sd.momo_network });
      const [pkgR, priceR, orderR, wdR] = await Promise.all([
        supabase.from("data_packages").select("*").eq("active", true).order("size_gb"),
        supabase.from("agent_package_prices").select("package_id,sell_price").eq("agent_store_id", sd.id),
        supabase.from("orders").select("*").eq("agent_store_id", sd.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("withdrawal_requests").select("*").eq("agent_store_id", sd.id).order("created_at", { ascending: false }),
      ]);
      const pkgs = pkgR.data ?? []; setPackages(pkgs);
      const pm: Record<string, number> = {}; (priceR.data ?? []).forEach((p: any) => { pm[p.package_id] = p.sell_price; }); setAgentPrices(pm);
      const os = (orderR.data as Order[]) ?? []; setOrders(os);
      const wd = (wdR.data as WithdrawalRequest[]) ?? []; setWithdrawals(wd);
      setProfitStats(calcStats(os, pkgs, sd.wallet_balance ?? 0));
      const slug = sd.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const url = `https://${slug}.datastores.shop`;
      setShareText(`🔥 Get the BEST data deals from *${sd.store_name}*!\n\n📱 MTN • AirtelTigo • Telecel\n⚡ Instant delivery • 24/7 Support\n\n🛒 Order now: ${url}\n📞 Call/WhatsApp: ${sd.support_number}`);
    } else {
      const { data: pkgData } = await supabase.from("data_packages").select("*").eq("active", true).order("size_gb");
      setPackages(pkgData ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { if (user) fetchAllData(); }, [user]);

  useEffect(() => {
    if (!store?.id) return;
    const c1 = supabase.channel('asc').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agent_stores', filter: `id=eq.${store.id}` }, (p) => { fetchAllData(); if ((p.new as any).wallet_balance !== (p.old as any).wallet_balance) toast({ title: "Wallet updated!", description: `GH₵ ${(p.new as any).wallet_balance?.toFixed(2)}` }); }).subscribe();
    const c2 = supabase.channel('wdc').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'withdrawal_requests', filter: `agent_store_id=eq.${store.id}` }, (p) => { if ((p.new as any).status === 'completed' && (p.old as any).status !== 'completed') { fetchAllData(); toast({ title: "Withdrawal approved!" }); } else if ((p.new as any).status !== (p.old as any).status) fetchAllData(); }).subscribe();
    const c3 = supabase.channel('prc').on('postgres_changes', { event: '*', schema: 'public', table: 'agent_package_prices', filter: `agent_store_id=eq.${store.id}` }, () => { fetchAllData(); toast({ title: "Prices updated" }); }).subscribe();
    return () => { supabase.removeChannel(c1); supabase.removeChannel(c2); supabase.removeChannel(c3); };
  }, [store?.id]);

  useEffect(() => { if (!store?.id) return; const t = setInterval(fetchAllData, 10000); return () => clearInterval(t); }, [store?.id]);
  useEffect(() => { if (orders.length > 0 && packages.length > 0) setProfitStats(calcStats(orders, packages, store?.wallet_balance ?? 0)); }, [orders, packages]);

  const fetchNotifications = async () => {
    if (!store?.id) return; setLoadingNotifications(true);
    const { data, error } = await supabase.from('agent_notifications' as any).select('*').eq('agent_store_id', store.id).order('created_at', { ascending: false });
    if (!error && data) setNotifications(data as Notification[]); setLoadingNotifications(false);
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
  const toggleNotif = async (id: string, cur: boolean) => { const { error } = await supabase.from('agent_notifications' as any).update({ is_active: !cur }).eq('id', id); if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else fetchNotifications(); };
  const deleteNotif = async (id: string) => { const { error } = await supabase.from('agent_notifications' as any).delete().eq('id', id); if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else fetchNotifications(); };

  const saveThemeColors = async () => { if (!store) return; setSavingTheme(true); const { error } = await supabase.from("agent_stores").update({ theme_config: themeColors }).eq("id", store.id); if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else toast({ title: "Theme updated!" }); setSavingTheme(false); };
  const resetToDefault = () => setThemeColors(DEFAULT_THEME);
  const changeColumns = (d: number) => setThemeColors({ ...themeColors, gridColumns: Math.min(6, Math.max(1, (themeColors.gridColumns || 2) + d)) });

  const saveStoreHeadline = async () => { if (!store) return; setSavingHeadline(true); const { error } = await supabase.from("agent_stores").update({ store_headline: storeHeadline }).eq("id", store.id); if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else { toast({ title: "Headline updated!" }); setStore({ ...store, store_headline: storeHeadline }); } setSavingHeadline(false); };

  const handlePriceChange = (id: string, v: string) => setEditedPrices(p => ({ ...p, [id]: parseFloat(v) }));
  const savePrices = async () => {
    if (!store) return; setSavingPrices(true);
    try {
      for (const [id, sp] of Object.entries(editedPrices)) { const pkg = packages.find(p => p.id === id); if (!pkg) continue; if (isNaN(sp) || sp <= 0) { toast({ title: "Invalid price", variant: "destructive" }); setSavingPrices(false); return; } if (sp < pkg.agent_price) { toast({ title: "Price below cost", variant: "destructive" }); setSavingPrices(false); return; } }
      for (const [id, sp] of Object.entries(editedPrices)) { if (agentPrices[id] !== undefined) await supabase.from("agent_package_prices").update({ sell_price: Number(sp) }).eq("agent_store_id", store.id).eq("package_id", id); else await supabase.from("agent_package_prices").insert({ agent_store_id: store.id, package_id: id, sell_price: Number(sp) }); }
      const { data: fp } = await supabase.from("agent_package_prices").select("package_id,sell_price").eq("agent_store_id", store.id);
      const nm: Record<string, number> = {}; (fp ?? []).forEach((p: any) => { nm[p.package_id] = p.sell_price; }); setAgentPrices(nm); setEditedPrices({}); toast({ title: "Prices saved!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); } finally { setSavingPrices(false); }
  };

  const saveStoreInfo = async () => {
    if (!store) return; setSavingStore(true);
    const { error } = await supabase.from("agent_stores").update({ store_name: storeForm.store_name, whatsapp_number: storeForm.whatsapp_number, support_number: storeForm.support_number, whatsapp_group: storeForm.whatsapp_group || null, show_whatsapp_group_icon: storeForm.show_whatsapp_group_icon, momo_number: storeForm.momo_number, momo_name: storeForm.momo_name, momo_network: storeForm.momo_network }).eq("id", store.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else { setStore({ ...store, ...storeForm, whatsapp_group: storeForm.whatsapp_group || null }); setEditingStore(false); toast({ title: "Store updated!" }); }
    setSavingStore(false);
  };

  const openBuyDialog = (pkg: DataPackage) => { setBuyPkg(pkg); setBuyPhone(""); setBuyStep("phone"); setBuyPaymentMethod("wallet"); setBuyDialogOpen(true); };
  const handleBuyConfirm = async () => {
    if (!store || !buyPkg) return; setBuyLoading(true);
    const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const { data: ro } = await supabase.from("orders").select("created_at").eq("customer_number", buyPhone.trim()).eq("agent_store_id", store.id).gte("created_at", cutoff).order("created_at", { ascending: false }).limit(1);
    if (ro && ro.length > 0) { const el = Math.floor((Date.now() - new Date(ro[0].created_at).getTime()) / 60000); toast({ title: "Rate limit", description: `Wait ${45 - el} more minute(s).`, variant: "destructive" }); setBuyLoading(false); return; }
    const ap = Number(buyPkg.agent_price);
    if (buyPaymentMethod === "wallet") {
      if (Number(store.wallet_balance) < ap) { toast({ title: "Insufficient balance", variant: "destructive" }); setBuyLoading(false); return; }
      const { error: we } = await supabase.from("agent_stores").update({ wallet_balance: Number(store.wallet_balance) - ap }).eq("id", store.id);
      if (we) { toast({ title: "Error", description: we.message, variant: "destructive" }); setBuyLoading(false); return; }
      const { data: od, error: oe } = await supabase.from("orders").insert({ customer_number: buyPhone.trim(), network: buyPkg.network, size_gb: buyPkg.size_gb, amount: ap, package_id: buyPkg.id, agent_store_id: store.id, status: "paid", fulfillment_status: "pending", payment_method: "wallet" }).select("id").single();
      if (oe) { toast({ title: "Order error", description: oe.message, variant: "destructive" }); setBuyLoading(false); return; }
      await supabase.functions.invoke("fulfill-order", { body: { order_id: od.id } });
      setStore({ ...store, wallet_balance: Number(store.wallet_balance) - ap }); toast({ title: "Order placed!" }); setBuyDialogOpen(false);
      const { data: no } = await supabase.from("orders").select("*").eq("agent_store_id", store.id).order("created_at", { ascending: false }).limit(100); setOrders((no as Order[]) ?? []);
    } else {
      try {
        const email = user?.email || `agent-${store.id}@datapluggh.com`;
        const total = Math.round((ap + (ap * 1.95 / 100)) * 100) / 100;
        const { data, error } = await supabase.functions.invoke("initialize-payment", { body: { email, amount: total, phone: buyPhone.trim(), callback_url: `${window.location.origin}/agent?payment=verifying`, metadata: { package_id: buyPkg.id, network: buyPkg.network, package_name: `${buyPkg.size_gb}GB`, agent_store_id: store.id, payment_method: "paystack", use_agent_price: true } } });
        if (error) throw error; if (data?.authorization_url) window.location.href = data.authorization_url; else throw new Error(data?.error || "Failed to initialize payment");
      } catch (e: any) { toast({ title: "Payment Error", description: e.message, variant: "destructive" }); }
    }
    setBuyLoading(false);
  };

  const handleWithdraw = async () => {
    if (!store) return; if (hasPendingWithdrawal) { toast({ title: "Pending withdrawal exists", variant: "destructive" }); return; }
    const amt = parseFloat(withdrawAmount); if (!amt || amt < 10) { toast({ title: "Minimum is GH₵ 10.00", variant: "destructive" }); return; } if (amt > profitStats.availableForWithdrawal) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setWithdrawLoading(true); const { error } = await supabase.from("withdrawal_requests").insert({ agent_store_id: store.id, amount: amt });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else { toast({ title: "Withdrawal requested!" }); setWithdrawAmount(""); const { data } = await supabase.from("withdrawal_requests").select("*").eq("agent_store_id", store.id).order("created_at", { ascending: false }); setWithdrawals((data as WithdrawalRequest[]) ?? []); }
    setWithdrawLoading(false);
  };

  const copyPhoneNumber = (p: string) => { navigator.clipboard.writeText(p); toast({ title: "Copied!", description: p }); };

  // ─── FLYER helpers ────────────────────────────
  const getFlyerPrice = (pkg: DataPackage) => agentPrices[pkg.id] ?? pkg.price;
  const getMtnPkgs = () => MTN_SIZES.map(s => { const p = packages.find(x => x.network === "mtn" && x.size_gb === s); return p ? { size: s, price: getFlyerPrice(p) } : null; }).filter(Boolean) as { size: number; price: number }[];
  const getAirtelPkgs = () => AIRTEL_SIZES.map(s => { const p = packages.find(x => x.network === "airteltigo" && x.size_gb === s); return p ? { size: s, price: getFlyerPrice(p) } : null; }).filter(Boolean) as { size: number; price: number }[];
  const getTelPkgs = () => TELECEL_SIZES.map(s => { const p = packages.find(x => x.network === "telecel" && x.size_gb === s); return p ? { size: s, price: getFlyerPrice(p) } : null; }).filter(Boolean) as { size: number; price: number }[];

  const saveFlyerColors = (c: typeof flyerColors) => { setFlyerColors(c); try { localStorage.setItem("flyerColors", JSON.stringify(c)); } catch { } toast({ title: "Colours saved!" }); };

  // ─── GENERATE PNG at full 1023×1491 resolution ───
  const generatePng = async (): Promise<string> => {
    if (!flyerRef.current) throw new Error("Flyer not ready");
    // Temporarily override scale to 1 for export
    const el = flyerRef.current;
    const prevTransform = el.style.transform;
    el.style.transform = "scale(1)";
    el.style.transformOrigin = "top left";
    await new Promise(r => requestAnimationFrame(r));
    const dataUrl = await toPng(el, {
      quality: 1, pixelRatio: 1, width: FLYER_W, height: FLYER_H,
      backgroundColor: "#000000",
      style: { transform: "scale(1)", transformOrigin: "top left" },
    });
    el.style.transform = prevTransform;
    return dataUrl;
  };

  const downloadFlyer = async () => {
    setGeneratingFlyer(true);
    try {
      const dataUrl = await generatePng();
      const link = document.createElement("a");
      link.download = `${store?.store_name.replace(/\s+/g, "-") ?? "flyer"}-data-bundles.png`;
      link.href = dataUrl; link.click();
      toast({ title: "Flyer downloaded!", description: "Saved as 1023×1491 PNG." });
    } catch (e: any) { console.error(e); toast({ title: "Download failed", description: e.message, variant: "destructive" }); }
    finally { setGeneratingFlyer(false); }
  };

  const shareFlyer = async () => {
    setGeneratingFlyer(true);
    try {
      const dataUrl = await generatePng();
      // Convert dataURL → Blob → File
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "data-bundles-flyer.png", { type: "image/png" });

      // Try Web Share API with file
      if (typeof navigator.share === "function" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `${store?.store_name} – Data Bundles`, text: shareText, files: [file] });
        toast({ title: "Shared successfully!" });
      }
      // Fallback: share text only + auto-download image
      else if (typeof navigator.share === "function") {
        // download image first so user has it ready to attach
        const link = document.createElement("a"); link.download = "data-bundles-flyer.png"; link.href = dataUrl; link.click();
        await navigator.share({ title: `${store?.store_name} – Data Bundles`, text: shareText });
        toast({ title: "Text shared — image saved to device", description: "Attach the downloaded image when sharing on WhatsApp." });
      }
      // Final fallback: copy text + download image
      else {
        await navigator.clipboard.writeText(shareText);
        const link = document.createElement("a"); link.download = "data-bundles-flyer.png"; link.href = dataUrl; link.click();
        toast({ title: "Text copied & image downloaded!", description: "Paste the text and attach the image on WhatsApp." });
      }
    } catch (e: any) {
      if (e.name !== "AbortError") toast({ title: "Share failed", description: "Try downloading instead.", variant: "destructive" });
    } finally { setGeneratingFlyer(false); }
  };

  // ─── GUARDS ───────────────────────────────────
  if (authLoading || loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3"><Zap className="h-10 w-10 text-primary animate-pulse" /><p className="text-muted-foreground font-display">Loading dashboard...</p></div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) { if (!store) return <Navigate to="/agent-onboarding" replace />; if (!store.approved) return <Navigate to="/pending-approval" replace />; }

  const filteredPackages = packages.filter(p => p.network === networkFilter);
  const storeSlug = store ? store.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "";
  const storeUrl = `https://${storeSlug}.datastores.shop`;
  const copyStoreLink = () => { navigator.clipboard.writeText(storeUrl); toast({ title: "Link copied!", description: storeUrl }); };
  const copyRef = () => { if (store?.topup_reference) { navigator.clipboard.writeText(store.topup_reference); toast({ title: "Reference copied!" }); } };
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const filteredOrders = orders.filter(o => o.customer_number.toLowerCase().includes(orderSearch.toLowerCase()) || o.id.toLowerCase().includes(orderSearch.toLowerCase()));

  const mtnPkgs = getMtnPkgs();
  const airtelPkgs = getAirtelPkgs();
  const telPkgs = getTelPkgs();
  const supportNum = store?.support_number || "0200511211";

  // ─── FLYER PACKAGE CARD (full resolution sizes) ───
  const PkgCard = ({ size, price, net, accent, txtColor = "black" }: { size: number; price: number; net: string; accent: string; txtColor?: string }) => (
    <div style={{ borderRadius: 10, padding: "16px 6px 12px", textAlign: "center", background: `${accent}1a`, border: `1.5px solid ${accent}40`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{size}GB</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: `${accent}cc`, textTransform: "uppercase", letterSpacing: 0.5 }}>{net}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#ddd" }}>GHC{price.toFixed(2)}</div>
      <div style={{ width: "92%", padding: "6px 0", borderRadius: 6, background: accent, color: txtColor, fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3 }}>Buy Now</div>
    </div>
  );

  // ─── JSX ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <NotificationPopup />

      {/* NAV */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                <Menu className="h-5 w-5 text-primary" />
                <span className="font-display text-lg font-bold text-primary animate-pulse">MENU</span>
              </div>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4 bg-card border-r border-border">
              <SheetHeader className="mb-6"><SheetTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" />Menu</SheetTitle></SheetHeader>
              <div className="flex flex-col gap-2">
                {menuItems.map(item => (
                  <SheetClose asChild key={item.id}>
                    <button onClick={() => setActiveTab(item.id)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-left w-full">
                      <item.icon className="h-5 w-5 text-primary" /><span className="font-medium">{item.label}</span>
                    </button>
                  </SheetClose>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-3">
            {isAdmin && <Button variant="ghost" size="sm" asChild><Link to="/admin">Admin</Link></Button>}
            <Button variant="ghost" size="sm" asChild><Link to="/">Home</Link></Button>
            <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" />Sign Out</Button>
          </div>
        </div>
      </nav>

      <div className="container py-8 space-y-6">
        {store && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div><p className="text-sm font-semibold">Your Store Website</p><p className="text-xs text-muted-foreground">{storeUrl}</p></div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyStoreLink}><Copy className="h-4 w-4 mr-1" />Copy Link</Button>
                <Button variant="hero" size="sm" asChild><a href={storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Visit Store</a></Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="hidden" />

          {/* ══════════ OVERVIEW ══════════ */}
          <TabsContent value="overview" className="space-y-6 mt-0">

            {/* ── INSTRUCTION MANUAL DROPDOWN ── */}
            <Card className="border-primary/30 bg-primary/5">
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setManualOpen(v => !v)}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">📖 Dashboard User Guide</p>
                    <p className="text-xs text-muted-foreground">Tap to learn how every section of your dashboard works</p>
                  </div>
                </div>
                {manualOpen ? <ChevronUp className="h-5 w-5 text-primary flex-shrink-0" /> : <ChevronDown className="h-5 w-5 text-primary flex-shrink-0" />}
              </button>
              {manualOpen && (
                <div className="border-t border-primary/20 px-4 pb-4 space-y-2 mt-0">
                  {MANUAL_SECTIONS.map((sec, i) => (
                    <div key={i} className="border border-border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
                        onClick={() => setOpenManualSection(openManualSection === i ? null : i)}
                      >
                        <span className="font-semibold text-sm text-foreground">{sec.title}</span>
                        {openManualSection === i ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      </button>
                      {openManualSection === i && (
                        <div className="px-4 py-3 bg-background/50">
                          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{sec.content}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Store Status</p><Badge className="mt-2 bg-green-600/20 text-green-400 border-green-600/30">Active</Badge></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Total Orders</p><p className="font-display text-2xl font-bold mt-1">{totalOrders}</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Pending</p><p className="font-display text-2xl font-bold mt-1 text-primary">{pendingOrders}</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Revenue</p><p className="font-display text-2xl font-bold mt-1 text-green-400">GH₵ {profitStats.totalRevenue.toFixed(2)}</p></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Profit</p><p className="font-display text-2xl font-bold text-green-400 mt-1">GH₵ {profitStats.totalProfit.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">(Selling Price − Base Price)</p></div><TrendingUp className="h-8 w-8 text-green-400 opacity-50" /></div></CardContent></Card>
              <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Available for Withdrawal</p><p className="font-display text-2xl font-bold text-yellow-400 mt-1">GH₵ {Number(store?.wallet_balance ?? 0).toFixed(2)}</p></div><ArrowDownToLine className="h-8 w-8 text-yellow-400 opacity-50" /></div></CardContent></Card>
            </div>
            <Card className="border-border">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="font-display text-lg">Recent Orders</CardTitle>
                <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by number or ID..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="pl-9" /></div>
              </CardHeader>
              <CardContent>
                {filteredOrders.length === 0 ? <p className="text-muted-foreground text-center py-4">No orders found.</p> : (
                  <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Number</TableHead><TableHead>Network</TableHead><TableHead>Size</TableHead><TableHead>Sell Price</TableHead><TableHead>Base Cost</TableHead><TableHead>Profit</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>{filteredOrders.slice(0, 20).map(order => { const pkg = packages.find(p => p.id === order.package_id); const cost = pkg?.agent_price || 0; const profit = Number(order.amount) - cost; return (<TableRow key={order.id}><TableCell className="text-sm">{new Date(order.created_at).toLocaleDateString()}</TableCell><TableCell className="font-mono text-sm">{order.customer_number}</TableCell><TableCell className="uppercase text-sm">{order.network}</TableCell><TableCell className="font-bold">{order.size_gb}GB</TableCell><TableCell>GH₵ {Number(order.amount).toFixed(2)}</TableCell><TableCell className="text-muted-foreground">GH₵ {cost.toFixed(2)}</TableCell><TableCell className={profit >= 0 ? "text-green-400 font-semibold" : "text-red-400"}>GH₵ {profit.toFixed(2)}</TableCell><TableCell><Badge variant="outline" className="text-xs">{order.payment_method === "wallet" ? "Wallet" : "Paystack"}</Badge></TableCell><TableCell><Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>{order.status === "paid" ? "completed" : order.status}</Badge></TableCell></TableRow>); })}</TableBody></Table></div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════ BUY DATA ══════════ */}
          <TabsContent value="buy" className="space-y-4 mt-0">
            {store && <Card className="border-border bg-secondary/30"><CardContent className="p-4 flex items-center justify-between"><div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /><span className="font-medium">Wallet Balance:</span></div><span className="font-display text-xl font-bold text-primary">GH₵ {store.wallet_balance?.toFixed(2) ?? "0.00"}</span></CardContent></Card>}
            <div className="flex gap-2 flex-wrap">{["mtn", "airteltigo", "telecel"].map(n => <Button key={n} variant={networkFilter === n ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(n)}>{n === "mtn" ? "MTN" : n === "airteltigo" ? "AirtelTigo" : "Telecel"}</Button>)}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{filteredPackages.map(pkg => <Card key={pkg.id} className="border-border hover:border-primary/50 transition-all"><CardContent className="p-4 text-center space-y-3"><div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto"><Wifi className="h-5 w-5 text-primary" /></div><p className="font-display text-xl font-bold">{pkg.size_gb}GB</p><p className="text-lg font-bold text-primary">GH₵ {Number(pkg.agent_price).toFixed(2)}</p><p className="text-xs text-muted-foreground">Agent Price</p><Button variant="hero" size="sm" className="w-full" onClick={() => openBuyDialog(pkg)}>Buy Now</Button></CardContent></Card>)}</div>
          </TabsContent>

          {/* ══════════ STORE PRICES ══════════ */}
          <TabsContent value="store" className="space-y-4 mt-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap">{["mtn", "airteltigo", "telecel"].map(n => <Button key={n} variant={networkFilter === n ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(n)}>{n === "mtn" ? "MTN" : n === "airteltigo" ? "AirtelTigo" : "Telecel"}</Button>)}</div>
              {Object.keys(editedPrices).length > 0 && <Button variant="hero" size="sm" onClick={savePrices} disabled={savingPrices}><Save className="h-4 w-4 mr-1" />{savingPrices ? "Saving..." : "Save Prices"}</Button>}
            </div>
            <p className="text-sm text-muted-foreground">Profit = Selling Price − Base Price.</p>
            <Card className="border-border"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Size</TableHead><TableHead>Base Price</TableHead><TableHead>Your Selling Price</TableHead><TableHead>Profit</TableHead></TableRow></TableHeader>
              <TableBody>{filteredPackages.map(pkg => { const cur = editedPrices[pkg.id] ?? agentPrices[pkg.id] ?? pkg.price; const profit = cur - pkg.agent_price; return <TableRow key={pkg.id}><TableCell className="font-bold">{pkg.size_gb}GB</TableCell><TableCell className="text-muted-foreground">GH₵ {Number(pkg.agent_price).toFixed(2)}</TableCell><TableCell><Input type="number" step="0.01" value={cur} onChange={e => handlePriceChange(pkg.id, e.target.value)} className="w-24 h-8" /></TableCell><TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>GH₵ {profit.toFixed(2)}</TableCell></TableRow>; })}
              </TableBody></Table></div></Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════
              FLYER GENERATOR
          ══════════════════════════════════════════════════════ */}
          <TabsContent value="flyer" className="mt-0">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2"><Image className="h-5 w-5 text-primary" />Flyer Generator</CardTitle>
                <p className="text-sm text-muted-foreground">Customise colours, edit your share message, then download or share directly to WhatsApp.</p>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Colour pickers */}
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex flex-wrap gap-3 items-center">
                    {([{ label: "MTN", key: "mtnColor" }, { label: "Airtel", key: "airtelColor" }, { label: "Telecel", key: "telecelColor" }, { label: "Accent", key: "buttonBg" }] as { label: string; key: keyof typeof flyerColors }[]).map(({ label, key }) => (
                      <div key={key} className="flex items-center gap-2">
                        <Label className="text-xs">{label}</Label>
                        <Input type="color" value={flyerColors[key]} onChange={e => setFlyerColors({ ...flyerColors, [key]: e.target.value })} className="w-10 h-8 p-0 cursor-pointer" />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => saveFlyerColors(flyerColors)}><Save className="h-3 w-3 mr-1" />Save</Button>
                    <Button variant="ghost" size="sm" onClick={() => saveFlyerColors(DEFAULT_FLYER_COLORS)}><RotateCcw className="h-3 w-3 mr-1" />Reset</Button>
                  </div>
                </div>

                {/* Share message */}
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Share Message <span className="text-muted-foreground font-normal text-xs">(editable — sent with the image)</span></Label>
                  <Textarea value={shareText} onChange={e => setShareText(e.target.value)} rows={5} className="text-sm font-mono" />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 flex-wrap">
                  <Button variant="outline" onClick={downloadFlyer} disabled={generatingFlyer} className="gap-2 flex-1 sm:flex-none">
                    {generatingFlyer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download PNG (1023×1491)
                  </Button>
                  <Button variant="hero" onClick={shareFlyer} disabled={generatingFlyer} className="gap-2 flex-1 sm:flex-none">
                    {generatingFlyer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                    Share to WhatsApp / Anywhere
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 On mobile: tapping Share opens WhatsApp, Telegram, etc. directly. On desktop: image downloads + text is copied automatically.
                </p>

                {/* ══ FLYER PREVIEW — full width, no scroll ══ */}
                {/* Container measures its own width; we scale the 1023px canvas down to fill it */}
                <div
                  ref={flyerContainerRef}
                  className="w-full rounded-lg overflow-hidden border border-border"
                  style={{ height: `${FLYER_H * flyerScale}px`, position: "relative" }}
                >
                  {/* The actual flyer canvas — always 1023×1491, scaled down via CSS transform */}
                  <div
                    ref={flyerRef}
                    style={{
                      width: FLYER_W,
                      height: FLYER_H,
                      transform: `scale(${flyerScale})`,
                      transformOrigin: "top left",
                      position: "absolute",
                      top: 0,
                      left: 0,
                      backgroundColor: "#000000",
                      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
                      overflow: "hidden",
                    }}
                  >
                    {/* ── TOP NAV BAR ── */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", backgroundColor: "#0a0a0a", borderBottom: "1px solid #1c1c1c" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 34, height: 34, background: flyerColors.buttonBg, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <span style={{ fontSize: 19, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>DATA PLUG <span style={{ color: flyerColors.buttonBg }}>.STORE</span></span>
                      </div>
                      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                        {["Packages", "Services", "Become an Agent"].map(l => <span key={l} style={{ fontSize: 13, color: "#888", fontWeight: 500 }}>{l}</span>)}
                        <span style={{ fontSize: 13, color: flyerColors.buttonBg, fontWeight: 700, padding: "4px 14px", background: `${flyerColors.buttonBg}20`, borderRadius: 7, border: `1px solid ${flyerColors.buttonBg}50` }}>Agent Dashboard</span>
                        <span style={{ fontSize: 13, color: "#aaa" }}>Sign Out</span>
                      </div>
                    </div>

                    {/* ── PAGE TITLE ── */}
                    <div style={{ textAlign: "center", padding: "30px 20px 14px" }}>
                      <div style={{ fontSize: 46, fontWeight: 900, color: "#fff", letterSpacing: -1, textTransform: "uppercase" }}>DATA BUNDLES – ALL NETWORKS</div>
                      <div style={{ fontSize: 18, color: "#888", marginTop: 6 }}>Affordable. Instant. Reliable.</div>
                    </div>

                    {/* ── NETWORK TABS ── */}
                    <div style={{ display: "flex", justifyContent: "center", margin: "0 auto 22px", width: "fit-content", gap: 0 }}>
                      {[{ label: "MTN", bg: flyerColors.mtnColor, txt: "#000" }, { label: "AirtelTigo", bg: flyerColors.airtelColor, txt: "#fff" }, { label: "Telecel", bg: flyerColors.telecelColor, txt: "#fff" }].map((t, i) => (
                        <div key={t.label} style={{ padding: "12px 50px", background: t.bg, color: t.txt, fontSize: 16, fontWeight: 800, textTransform: "uppercase", borderRadius: i === 0 ? "8px 0 0 8px" : i === 2 ? "0 8px 8px 0" : 0, border: `2px solid ${t.bg}` }}>{t.label}</div>
                      ))}
                    </div>

                    {/* ════ MTN SECTION ════ */}
                    <div style={{ margin: "0 16px 16px", border: `2px solid ${flyerColors.mtnColor}55`, borderRadius: 14, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", backgroundColor: "#0e0b00", borderBottom: `1px solid ${flyerColors.mtnColor}30` }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: flyerColors.mtnColor, letterSpacing: 1, fontStyle: "italic", textTransform: "uppercase" }}>MTN DATA BUNDLES</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.mtnColor, border: `2px solid ${flyerColors.mtnColor}`, borderRadius: 24, padding: "4px 16px" }}>MTN</span>
                      </div>
                      <div style={{ backgroundColor: "#09070000", background: `linear-gradient(180deg,#0e0a00 0%,#080600 100%)`, padding: "10px 10px 14px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                        {mtnPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} net="MTN" accent={flyerColors.mtnColor} txtColor="#000" />)}
                      </div>
                    </div>

                    {/* ════ AIRTELTIGO SECTION ════ */}
                    <div style={{ margin: "0 16px 16px", border: `2px solid ${flyerColors.airtelColor}55`, borderRadius: 14, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", backgroundColor: "#05031a", borderBottom: `1px solid ${flyerColors.airtelColor}30` }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: flyerColors.airtelColor, letterSpacing: 1, fontStyle: "italic", textTransform: "uppercase" }}>AIRTELTIGO DATA BUNDLES</span>
                        {/* Airtel Tigo logo style badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="22" height="22" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
                            <circle cx="20" cy="20" r="20" fill={flyerColors.airtelColor} />
                            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="18" fontWeight="900">a</text>
                          </svg>
                          <span style={{ fontSize: 15, fontWeight: 800, color: flyerColors.airtelColor }}>airtel <span style={{ color: "#fff" }}>tigo</span></span>
                        </div>
                      </div>
                      <div style={{ background: `linear-gradient(180deg,#060318 0%,#030212 100%)`, padding: "10px 10px 14px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                        {airtelPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} net="AIRTELTIGO" accent={flyerColors.airtelColor} txtColor="#fff" />)}
                      </div>
                    </div>

                    {/* ════ TELECEL SECTION ════ */}
                    <div style={{ margin: "0 16px 16px", border: `2px solid ${flyerColors.telecelColor}55`, borderRadius: 14, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", backgroundColor: "#110000", borderBottom: `1px solid ${flyerColors.telecelColor}30` }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: flyerColors.telecelColor, letterSpacing: 1, fontStyle: "italic", textTransform: "uppercase" }}>TELECEL DATA BUNDLES</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: flyerColors.telecelColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
                          </div>
                          <span style={{ fontSize: 15, fontWeight: 800, color: flyerColors.telecelColor }}>telecel</span>
                        </div>
                      </div>
                      <div style={{ background: `linear-gradient(180deg,#120000 0%,#0a0000 100%)`, padding: "10px 10px 14px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                        {telPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} net="TELECEL" accent={flyerColors.telecelColor} txtColor="#fff" />)}
                      </div>
                    </div>

                    {/* ════ CONTACT FOOTER ════ */}
                    <div style={{ margin: "0 16px 16px", background: "#0d7c30", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "nowrap" }}>
                      {/* WhatsApp icon + text */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
                        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                        </div>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>NEED HELP OR HAVE QUESTIONS?</div>
                          <div style={{ fontSize: 13, color: "#86efac", marginTop: 2 }}>Contact us directly on WhatsApp or Call.</div>
                        </div>
                      </div>

                      {/* Phone number pill — uses agent's support_number */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.40)", borderRadius: 40, padding: "10px 28px", border: "1.5px solid rgba(255,255,255,0.15)", flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                        <span style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>{supportNum}</span>
                      </div>

                      {/* Chat on WhatsApp button */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#25D366", borderRadius: 40, padding: "10px 22px", flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Chat on WhatsApp</span>
                      </div>
                    </div>

                    {/* Store URL */}
                    <div style={{ textAlign: "center", paddingBottom: 18, fontSize: 14, color: "#555" }}>
                      <span style={{ color: flyerColors.buttonBg }}>{storeUrl}</span>
                    </div>

                  </div>{/* end flyerRef */}
                </div>{/* end flyerContainerRef */}

                <p className="text-xs text-muted-foreground text-center">Output: 1023 × 1491 px · Prices shown are your store's selling prices · Contact shown is your Support Number from Settings</p>
              </CardContent>
            </Card>
          </TabsContent>
          {/* ══════════════════════════════════════════════════════ */}

          {/* ══════════ WITHDRAW ══════════ */}
          <TabsContent value="withdraw" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-primary/30 bg-primary/5"><CardContent className="p-6 text-center space-y-2"><TrendingUp className="h-10 w-10 text-primary mx-auto" /><p className="text-muted-foreground text-sm">Total Profit</p><p className="font-display text-3xl font-bold text-green-400">GH₵ {profitStats.totalProfit.toFixed(2)}</p></CardContent></Card>
              <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-6 text-center space-y-2"><ArrowDownToLine className="h-10 w-10 text-yellow-400 mx-auto" /><p className="text-muted-foreground text-sm">Available for Withdrawal</p><p className="font-display text-3xl font-bold text-yellow-400">GH₵ {profitStats.availableForWithdrawal.toFixed(2)}</p></CardContent></Card>
            </div>
            <Card className="border-border">
              <CardHeader><CardTitle className="font-display text-lg">Request Withdrawal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {hasPendingWithdrawal && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center"><p className="text-sm text-yellow-400 font-medium">⚠️ You have a pending withdrawal. Please wait until it is completed.</p></div>}
                <div className="rounded-xl border border-border bg-secondary/50 p-4"><div className="grid grid-cols-3 gap-4 text-sm"><div className="text-center"><p className="text-xs text-muted-foreground">MoMo Name</p><p className="font-bold">{store?.momo_name}</p></div><div className="text-center"><p className="text-xs text-muted-foreground">MoMo Number</p><p className="font-bold">{store?.momo_number}</p></div><div className="text-center"><p className="text-xs text-muted-foreground">Network</p><p className="font-bold">{store?.momo_network?.toUpperCase()}</p></div></div></div>
                <p className="text-xs text-muted-foreground">Minimum: GH₵ 10.00. Processed within 24 hours.</p>
                <div className="flex gap-2 items-end"><div className="flex-1 space-y-1"><Label>Amount (GH₵)</Label><Input type="number" step="0.01" placeholder="e.g. 50.00" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} disabled={hasPendingWithdrawal} /></div><Button variant="hero" onClick={handleWithdraw} disabled={withdrawLoading || hasPendingWithdrawal}>{withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />}Withdraw</Button></div>
              </CardContent>
            </Card>
            {withdrawals.length > 0 && <Card className="border-border"><CardHeader><CardTitle className="font-display text-lg">Withdrawal History</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{withdrawals.map(w => <TableRow key={w.id}><TableCell className="text-sm">{new Date(w.created_at).toLocaleString()}</TableCell><TableCell className="font-bold">GH₵ {Number(w.amount).toFixed(2)}</TableCell><TableCell><Badge className={w.status === "completed" ? "bg-green-600/20 text-green-400 border-green-600/30" : w.status === "pending" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" : "bg-red-600/20 text-red-400 border-red-600/30"}>{w.status}</Badge></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}
          </TabsContent>

          {/* ══════════ TOPUP ══════════ */}
          <TabsContent value="topup" className="mt-0">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-display flex items-center gap-2"><Coins className="h-5 w-5 text-primary" />Top Up Your Wallet</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-primary/5 border border-primary/30 p-4 text-center"><p className="text-sm text-muted-foreground">Current Wallet Balance</p><p className="font-display text-3xl font-bold text-primary">GH₵ {store?.wallet_balance?.toFixed(2) ?? "0.00"}</p></div>
                <div className="space-y-4"><h3 className="font-semibold text-lg">Steps to top up:</h3><ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground"><li>Dial <span className="font-mono font-bold text-foreground">*170#</span> on your MTN MoMo phone.</li><li>Select <b>1</b> (Transfer Money) → <b>1</b> (MoMo User).</li><li>Recipient: <span className="font-mono font-bold text-foreground">0599449202</span> <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyPhoneNumber("0599449202")}><Copy className="h-3 w-3" /></Button></li><li>Enter the amount.</li><li>Reference: <div className="mt-2 p-3 bg-secondary/50 rounded-lg border border-border font-mono font-bold text-center text-primary text-xl">{store?.topup_reference ?? "N/A"}<Button variant="ghost" size="sm" className="ml-2 h-8" onClick={copyRef}><Copy className="h-3 w-3" />Copy</Button></div></li><li>Send transaction ID to:<div className="mt-2 flex flex-wrap gap-3"><Button variant="outline" size="sm" asChild><a href="https://wa.me/233200511211" target="_blank" rel="noopener noreferrer">📱 WhatsApp 0200511211</a></Button><Button variant="outline" size="sm" asChild><a href="tel:0599449202">📞 Call 0599449202</a></Button></div></li></ol></div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm"><p className="font-semibold text-yellow-400">⚠️ Important</p><p className="text-muted-foreground">Admin will verify and credit your wallet after you send the transaction ID.</p></div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════ APPEARANCE ══════════ */}
          <TabsContent value="appearance" className="mt-0">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-display">Customise Your Storefront</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2"><Label>Store Headline</Label><Textarea value={storeHeadline} onChange={e => setStoreHeadline(e.target.value)} rows={3} /><Button variant="outline" size="sm" onClick={saveStoreHeadline} disabled={savingHeadline} className="mt-2">{savingHeadline ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Headline</Button></div>
                <div className="border-t border-border pt-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[{ label: "Primary Colour", key: "primary" }, { label: "Text on Primary", key: "primary_foreground" }, { label: "Page Background", key: "background" }, { label: "Card Background", key: "card_background" }].map(({ label, key }) => (
                    <div key={key} className="space-y-2"><Label>{label}</Label><div className="flex gap-2 items-center"><Input type="color" value={(themeColors as any)[key]} onChange={e => setThemeColors({ ...themeColors, [key]: e.target.value })} className="w-16 h-10 p-1" /><Input type="text" value={(themeColors as any)[key]} onChange={e => setThemeColors({ ...themeColors, [key]: e.target.value })} className="flex-1" /></div></div>
                  ))}
                </div>
                <div className="border-t border-border pt-4"><h3 className="text-md font-semibold flex items-center gap-2 mb-3"><LayoutGrid className="h-5 w-5 text-primary" />Grid Columns</h3><div className="max-w-xs"><Label className="mb-2 block">Columns per row</Label><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => changeColumns(-1)} disabled={themeColors.gridColumns <= 1}><Minus className="h-4 w-4" /></Button><Input type="number" min={1} max={6} value={themeColors.gridColumns} onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1 && v <= 6) setThemeColors({ ...themeColors, gridColumns: v }); }} className="w-20 text-center" /><Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => changeColumns(1)} disabled={themeColors.gridColumns >= 6}><PlusIcon className="h-4 w-4" /></Button></div></div></div>
                <div className="flex gap-3"><Button variant="hero" onClick={saveThemeColors} disabled={savingTheme} className="flex-1">{savingTheme ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save</Button><Button variant="outline" onClick={resetToDefault} className="flex-1"><RotateCcw className="h-4 w-4 mr-1" />Reset to Default</Button></div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════ NOTIFICATIONS ══════════ */}
          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card className="border-border"><CardHeader><CardTitle className="font-display flex items-center gap-2"><Bell className="h-5 w-5" />Send Notification</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Message</Label><Textarea placeholder="e.g., Special offer this weekend!" value={newNotificationMsg} onChange={e => setNewNotificationMsg(e.target.value)} rows={3} /></div><div className="space-y-2"><Label>Expiry (optional)</Label><Input type="datetime-local" value={newNotificationExpiry} onChange={e => setNewNotificationExpiry(e.target.value)} /><p className="text-xs text-muted-foreground">Leave empty for no expiry.</p></div><Button variant="hero" onClick={createNotification} disabled={sendingNotification}>{sendingNotification ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Send Notification</Button></CardContent></Card>
            <Card className="border-border"><CardHeader><CardTitle className="font-display">Active &amp; Past Notifications</CardTitle></CardHeader><CardContent>{loadingNotifications ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : notifications.length === 0 ? <p className="text-center text-muted-foreground py-8">No notifications yet.</p> : <div className="space-y-4">{notifications.map(n => <div key={n.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-lg bg-card"><div className="flex-1"><p className="font-medium">{n.message}</p><div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1"><span>Created: {new Date(n.created_at).toLocaleString()}</span>{n.expires_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Expires: {new Date(n.expires_at).toLocaleString()}</span>}</div></div><div className="flex gap-2"><Badge variant={n.is_active ? "default" : "secondary"} className="cursor-pointer hover:opacity-80" onClick={() => toggleNotif(n.id, n.is_active)}>{n.is_active ? "Active" : "Inactive"}</Badge><Button variant="ghost" size="icon" onClick={() => deleteNotif(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div>}</CardContent></Card>
          </TabsContent>

          {/* ══════════ SETTINGS ══════════ */}
          <TabsContent value="settings" className="mt-0">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="font-display">Store Information</CardTitle>{!editingStore && <Button variant="outline" size="sm" onClick={() => setEditingStore(true)}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>}</CardHeader>
              <CardContent className="space-y-4">
                {editingStore ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Store Name</Label><Input value={storeForm.store_name} onChange={e => setStoreForm({ ...storeForm, store_name: e.target.value })} /></div>
                      <div className="space-y-2"><Label>WhatsApp Number</Label><Input value={storeForm.whatsapp_number} onChange={e => setStoreForm({ ...storeForm, whatsapp_number: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Support Number <span className="text-xs text-muted-foreground">(shown on flyer)</span></Label><Input value={storeForm.support_number} onChange={e => setStoreForm({ ...storeForm, support_number: e.target.value })} /></div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between gap-4"><Label>WhatsApp Group Link (Optional)</Label><div className="flex items-center gap-2"><Label htmlFor="sgi" className="text-sm text-muted-foreground cursor-pointer">Show join icon on storefront</Label><Switch id="sgi" checked={storeForm.show_whatsapp_group_icon} onCheckedChange={c => setStoreForm({ ...storeForm, show_whatsapp_group_icon: c })} /></div></div>
                        <Input value={storeForm.whatsapp_group} onChange={e => setStoreForm({ ...storeForm, whatsapp_group: e.target.value })} placeholder="Paste WhatsApp group or channel link" />
                      </div>
                      <div className="space-y-2"><Label>MoMo Name</Label><Input value={storeForm.momo_name} onChange={e => setStoreForm({ ...storeForm, momo_name: e.target.value })} /></div>
                      <div className="space-y-2"><Label>MoMo Number</Label><Input value={storeForm.momo_number} onChange={e => setStoreForm({ ...storeForm, momo_number: e.target.value })} /></div>
                      <div className="space-y-2"><Label>MoMo Network</Label><Input value={storeForm.momo_network} onChange={e => setStoreForm({ ...storeForm, momo_network: e.target.value })} placeholder="mtn / airteltigo / telecel" /></div>
                    </div>
                    <div className="flex gap-2 pt-2"><Button variant="hero" size="sm" onClick={saveStoreInfo} disabled={savingStore}><Save className="h-4 w-4 mr-1" />{savingStore ? "Saving..." : "Save Changes"}</Button><Button variant="outline" size="sm" onClick={() => setEditingStore(false)}>Cancel</Button></div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Store Name</p><p className="font-semibold">{store?.store_name}</p></div>
                    <div><p className="text-muted-foreground">WhatsApp</p><p className="font-semibold">{store?.whatsapp_number}</p></div>
                    <div><p className="text-muted-foreground">Support Number</p><p className="font-semibold">{store?.support_number}</p></div>
                    <div><p className="text-muted-foreground">WhatsApp Group</p><p className="font-semibold">{store?.whatsapp_group || "Not set"}</p></div>
                    <div><p className="text-muted-foreground">MoMo Name</p><p className="font-semibold">{store?.momo_name}</p></div>
                    <div><p className="text-muted-foreground">MoMo Number</p><p className="font-semibold">{store?.momo_number}</p></div>
                    <div><p className="text-muted-foreground">MoMo Network</p><p className="font-semibold">{store?.momo_network?.toUpperCase()}</p></div>
                    <div><p className="text-muted-foreground">Topup Reference</p><p className="font-display text-xl font-bold text-primary">{store?.topup_reference}</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* ══ BUY DIALOG ══ */}
      <Dialog open={buyDialogOpen} onOpenChange={v => !v && setBuyDialogOpen(false)}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader><DialogTitle className="font-display text-xl">Buy {buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</DialogTitle><DialogDescription>Purchase data at agent price</DialogDescription></DialogHeader>
          {buyStep === "phone" ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-2"><Label>Recipient Phone Number</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="tel" placeholder="0XX XXX XXXX" value={buyPhone} onChange={e => setBuyPhone(e.target.value)} className="pl-10" autoFocus /></div></div>
              <Button variant="hero" className="w-full" onClick={() => { if (buyPhone.trim().length < 10) { toast({ title: "Invalid number", variant: "destructive" }); return; } setBuyStep("confirm"); }}>Continue</Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Package</span><span className="font-semibold">{buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Phone</span><span className="font-semibold">{buyPhone}</span></div>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between font-bold"><span>Agent Price</span><span className="text-primary">GH₵ {Number(buyPkg?.agent_price ?? 0).toFixed(2)}</span></div>
              </div>
              <div className="space-y-2"><Label>Payment Method</Label><Select value={buyPaymentMethod} onValueChange={v => setBuyPaymentMethod(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="wallet"><span className="flex items-center gap-2"><Wallet className="h-4 w-4" />Wallet (GH₵ {store?.wallet_balance?.toFixed(2) ?? "0.00"})</span></SelectItem><SelectItem value="paystack"><span className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Paystack (+ charges)</span></SelectItem></SelectContent></Select></div>
              <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setBuyStep("phone")} disabled={buyLoading}>Back</Button><Button variant="hero" className="flex-1" onClick={handleBuyConfirm} disabled={buyLoading}>{buyLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Processing...</> : "Confirm Purchase"}</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentDashboard;