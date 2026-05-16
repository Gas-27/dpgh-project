import { useState, useEffect, useRef, useCallback } from "react";
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
  ChevronDown, ChevronUp, BookOpen, Percent, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NotificationPopup from "@/components/NotificationPopup";
import SubagentsList from "@/components/SubagentsList";
import SubagentPricesManager from "@/components/SubagentPricesManager";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";
import { toPng } from "html-to-image";

// ==================== INTERFACES ====================
interface AgentStore {
  id: string; store_name: string; whatsapp_number: string; support_number: string;
  whatsapp_group: string | null; show_whatsapp_group_icon: boolean;
  momo_number: string; momo_name: string; momo_network: string; approved: boolean;
  wallet_balance: number; topup_reference: string; store_headline: string;
  tutorial_video_url: string | null; allow_subagent_registration?: boolean;
  theme_config: { primary: string; primary_foreground: string; background: string; card_background: string; gridColumns: number; };
}
interface DataPackage { id: string; network: string; size_gb: number; price: number; agent_price: number; active: boolean; }
interface Order { id: string; customer_number: string; network: string; size_gb: number; amount: number; status: string; fulfillment_status: string; payment_method: string; created_at: string; package_id: string; }
interface WithdrawalRequest { id: string; amount: number; status: string; created_at: string; }
interface ProfitStats { totalRevenue: number; totalCost: number; totalProfit: number; availableForWithdrawal: number; }
interface Notification { id: string; message: string; is_active: boolean; created_at: string; expires_at: string | null; }

// ==================== CONSTANTS ====================
const DEFAULT_THEME = { primary: "#38bdf8", primary_foreground: "#000000", background: "#0a0a0a", card_background: "#171717", gridColumns: 2 };
const DEFAULT_FLYER_COLORS = { mtnColor: "#f5b81b", airtelColor: "#3b3bdb", telecelColor: "#cc0000", buttonBg: "#0066ff" };

const FLYER_W = 1080;
const FLYER_H = 1920;

const MTN_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 75];
const AIRTEL_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50];
const TELECEL_SIZES = [2, 3, 5, 10, 15, 20, 25, 30, 35, 40, 50, 100];

const ORDERS_PAGE_SIZE = 100;

const menuItems = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "buy", label: "Buy Data", icon: ShoppingCart },
  { id: "store", label: "Store Prices", icon: Store },
  { id: "subagents", label: "Subagents", icon: Users },
  { id: "subagent-prices", label: "Subagent Prices", icon: CreditCard },
  { id: "flyer", label: "Flyer Generator", icon: Image },
  { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
  { id: "topup", label: "Top Up", icon: Coins },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

const MANUAL_SECTIONS = [
  {
    icon: "📊", title: "Overview", content: `Your command centre. At a glance:
• Store Status – confirms your store is live.
• Total Orders – every order ever placed through your store.
• Pending Orders – orders still being processed.
• Revenue – total money collected from customers.
• Total Profit – earnings after subtracting the base (cost) price.
• Available for Withdrawal – your wallet balance you can cash out.

The Recent Orders table loads 100 orders at a time. Click "Load More" to see the next 100. Use the search box to filter by phone number or order ID.` },
  {
    icon: "🛒", title: "Buy Data", content: `Buy data for a customer or yourself from your wallet.

1. Check your wallet balance at the top — top up if needed.
2. Select a network tab (MTN, AirtelTigo, Telecel).
3. Tap a package, enter the recipient's phone number, then confirm.

Payment Methods:
• Wallet – deducts from your pre-loaded wallet. Instant, no extra charges.
• Paystack – pay per order with a small Paystack fee added.

⚠️ If you have a pending withdrawal, the system will prevent you from buying data that would push your balance below the pending withdrawal amount to protect your funds.

Note: 45-minute cooldown per phone number to prevent duplicate orders.` },
  {
    icon: "🏷️", title: "Store Prices", content: `Set what your customers pay on your public store.

• Base Price (Cost) – fixed price you pay. You cannot sell below this.
• Your Selling Price – set any amount above the base price.
• Profit – auto-calculated: Selling Price minus Base Price.

How to update:
1. Select the network tab.
2. Type the new price in the input box.
3. Click "Save Prices".

Your live store reflects changes immediately.

💡 Markup Feature:
• Enter a percentage (e.g., +10) and click "Apply Markup".
• The markup is applied to the BASE PRICE of the currently selected network.
• Example: If base price = GHC 4.10, +10% becomes GHC 4.51.
• After applying, you must click "Save Prices" to store the changes permanently.` },
  {
    icon: "🖼️", title: "Flyer Generator", content: `Generate a professional promotional flyer showing all your current prices.

• Flyer is 1080 × 1920 px (portrait) — ideal for WhatsApp, Facebook, Instagram stories.
• Prices are pulled automatically from your Store Prices.
• Your store name appears at the top instead of "DATA PLUG .STORE".
• Your support contact number appears in the footer.

Customisation:
• Use the colour pickers to change accent colours per network.
• Save Colours to remember your choices. Reset to restore defaults.

Sharing:
• "Download PNG" saves the full-resolution image to your device.
• "Preview as Image" opens the flyer in a new tab – from there you can long‑press / right‑click and save or share.
• "Share Flyer" uses the native share sheet to send the image directly to WhatsApp (on mobile) or downloads the image and opens WhatsApp (on desktop).` },
  {
    icon: "💸", title: "Withdraw", content: `Cash out your wallet balance to your MoMo account.

• Minimum: GH₵ 10.00.
• Processed within 24 hours.
• Only one pending withdrawal at a time.
• Your MoMo details are shown for confirmation before submitting.

Withdrawal History shows all past requests and their status.` },
  {
    icon: "💰", title: "Top Up Wallet", content: `Add money to your wallet to buy data without Paystack charges.

Steps:
1. Dial *170# on your MTN MoMo phone.
2. Transfer Money → MoMo User.
3. Enter the recipient number shown on the page.
4. Enter the amount.
5. Use your unique Top-Up Reference as the transaction reference.
6. Send the transaction ID to admin via WhatsApp or call.
7. Wallet credited after admin verifies.

⚠️ Always include your reference code or your wallet will not be credited.` },
  {
    icon: "🎨", title: "Appearance", content: `Customise how your public store looks.

• Store Headline – text shown at the top of your store page.
• Primary Colour – buttons and accents across your storefront.
• Text on Primary – text colour on buttons.
• Page Background – main background colour.
• Card Background – colour of each product card.
• Grid Columns – products shown side by side (1–6).

A live preview shows exactly how your store will look. Click Save to apply changes.` },
  {
    icon: "🔔", title: "Notifications", content: `Send pop-up announcements that appear on your public store page.

Examples:
• "🎉 Special promo: 20% off AirtelTigo this weekend!"
• "⚡ New Telecel packages added!"
• "📢 Temporarily offline for maintenance."

How to create:
1. Type your message.
2. Optionally set an expiry date.
3. Click Send.

Managing: Toggle Active/Inactive to show or hide without deleting. Bin icon to delete permanently.` },
  {
    icon: "⚙️", title: "Settings", content: `Update your store's core information.

• Store Name – displayed on your storefront and used to generate your store URL.
• WhatsApp Number – customers can message you on this number.
• Support Number – shown in the footer of your promotional flyer.
• WhatsApp Group Link – optional link for customers to join your group/channel.
• Show Group Icon – toggle the WhatsApp join button on your store (on by default).
• MoMo Name / Number / Network – for processing withdrawals.
• Top-Up Reference – your unique code for wallet top-ups (read-only).

Note: The Support Number shown here is what appears in the contact footer of your generated flyer.` },
  {
    icon: "📜", title: "Rules", content: `Before making an order, make sure you are not owing airtime, MoMo, or bundles.
You cannot make an order for the same number when the first order has not been delivered (either from our site or other sites) – this can override your previous order.
Before bringing a report from a customer to the admin, make sure to ask them the questions above before reporting.` },
];

// ==================== MAIN COMPONENT ====================
const AgentDashboard = () => {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [store, setStore] = useState<AgentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [agentPrices, setAgentPrices] = useState<Record<string, number>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [subagents, setSubagents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [savingPrices, setSavingPrices] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [storeForm, setStoreForm] = useState({
    store_name: "", whatsapp_number: "", support_number: "",
    whatsapp_group: "", show_whatsapp_group_icon: true,
    momo_number: "", momo_name: "", momo_network: "",
  });
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
  const [markupPercent, setMarkupPercent] = useState("");

  // Flyer
  const flyerRef = useRef<HTMLDivElement>(null);
  const flyerContainerRef = useRef<HTMLDivElement>(null);
  const [generatingFlyer, setGeneratingFlyer] = useState(false);
  const [flyerScale, setFlyerScale] = useState(1);
  const [flyerColors, setFlyerColors] = useState(() => {
    try { const s = localStorage.getItem("flyerColors"); return s ? JSON.parse(s) : DEFAULT_FLYER_COLORS; }
    catch { return DEFAULT_FLYER_COLORS; }
  });
  const [shareText, setShareText] = useState("");

  const hasPendingWithdrawal = withdrawals.some(w => w.status === "pending");
  const pendingWithdrawalAmount = withdrawals.filter(w => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);
  const effectiveBalance = Math.max(0, Number(store?.wallet_balance ?? 0) - pendingWithdrawalAmount);

  // ─── flyer scale ──────────────────────────────────────────────────────────
  const recalcScale = useCallback(() => {
    if (!flyerContainerRef.current) return;
    const cw = flyerContainerRef.current.clientWidth || 600;
    setFlyerScale(cw / FLYER_W);
  }, []);
  useEffect(() => {
    if (activeTab !== "flyer") return;
    const t = setTimeout(recalcScale, 50);
    window.addEventListener("resize", recalcScale);
    return () => { clearTimeout(t); window.removeEventListener("resize", recalcScale); };
  }, [activeTab, recalcScale]);

  // ─── total profit from ALL DB orders ────────────────────────────────────
  const fetchTotalProfit = async () => {
    if (!store?.id) return;
    const { data, error } = await supabase
      .from("orders")
      .select("amount, package_id")
      .eq("agent_store_id", store.id)
      .in("status", ["paid", "completed"]);
    if (error) {
      console.error("Error fetching profit sum:", error);
      return;
    }
    let totalRevenue = 0, totalCost = 0;
    for (const order of data) {
      totalRevenue += Number(order.amount);
      const pkg = packages.find(p => p.id === order.package_id);
      if (pkg) totalCost += pkg.agent_price;
    }
    setProfitStats(prev => ({
      ...prev,
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      availableForWithdrawal: store.wallet_balance ?? 0,
    }));
  };

  const fetchAllData = async () => {
    if (!user) return;
    const { data: sd, error: se } = await supabase.from("agent_stores").select("*").eq("user_id", user.id).maybeSingle();
    if (se) { console.error(se); setLoading(false); return; }
    if (sd) {
      if (sd.show_whatsapp_group_icon == null) { sd.show_whatsapp_group_icon = true; await supabase.from("agent_stores").update({ show_whatsapp_group_icon: true }).eq("id", sd.id); }
      if (!sd.store_headline) { sd.store_headline = `Get the best data deals from ${sd.store_name}. Select your network and package below`; await supabase.from("agent_stores").update({ store_headline: sd.store_headline }).eq("id", sd.id); }
      setStore(sd as AgentStore);
      setStoreHeadline(sd.store_headline || "");
      if (sd.theme_config) setThemeColors({ ...DEFAULT_THEME, ...sd.theme_config });
      else { await supabase.from("agent_stores").update({ theme_config: DEFAULT_THEME }).eq("id", sd.id); setThemeColors(DEFAULT_THEME); }
      setStoreForm({
        store_name: sd.store_name, whatsapp_number: sd.whatsapp_number,
        support_number: sd.support_number, whatsapp_group: sd.whatsapp_group || "",
        show_whatsapp_group_icon: sd.show_whatsapp_group_icon ?? true,
        momo_number: sd.momo_number, momo_name: sd.momo_name, momo_network: sd.momo_network,
      });

      const [pkgR, priceR, orderR, orderCountR, wdR, subagentR] = await Promise.all([
        supabase.from("data_packages").select("*").eq("active", true).order("size_gb"),
        supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", sd.id),
        supabase.from("orders").select("*").eq("agent_store_id", sd.id).order("created_at", { ascending: false }).range(0, ORDERS_PAGE_SIZE - 1),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("agent_store_id", sd.id),
        supabase.from("withdrawal_requests").select("*").eq("agent_store_id", sd.id).order("created_at", { ascending: false }),
        supabase.from("subagent_stores").select("*").eq("agent_store_id", sd.id).order("created_at", { ascending: false }),
      ]);

      const pkgs = pkgR.data ?? [];
      setPackages(pkgs);
      const pm: Record<string, number> = {};
      (priceR.data ?? []).forEach((p: any) => { pm[p.package_id] = p.sell_price; });
      setAgentPrices(pm);
      const os = (orderR.data as Order[]) ?? [];
      setOrders(os);
      setOrdersPage(1);
      setOrdersTotal(orderCountR.count ?? 0);
      const wd = (wdR.data as WithdrawalRequest[]) ?? [];
      setWithdrawals(wd);
      const subags = subagentR.data ?? [];
      setSubagents(subags);
      setProfitStats(prev => ({ ...prev, availableForWithdrawal: sd.wallet_balance ?? 0 }));

      const slug = sd.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const url = `https://${slug}.datastores.shop`;
      setShareText(
        `🔥 Get the BEST data deals from *${sd.store_name}*!\n\n` +
        `📱 MTN • AirtelTigo • Telecel\n` +
        `⚡ Instant delivery • 24/7 Support\n\n` +
        `🛒 Shop now: ${url}\n` +
        `📞 Contact: ${sd.support_number}`
      );
      await fetchTotalProfit();
    } else {
      const { data: pkgData } = await supabase.from("data_packages").select("*").eq("active", true).order("size_gb");
      setPackages(pkgData ?? []);
    }
    setLoading(false);
  };

  const loadMoreOrders = async () => {
    if (!store) return;
    setLoadingMoreOrders(true);
    const nextPage = ordersPage + 1;
    const from = nextPage * ORDERS_PAGE_SIZE - ORDERS_PAGE_SIZE;
    const to = nextPage * ORDERS_PAGE_SIZE - 1;
    const { data } = await supabase.from("orders").select("*").eq("agent_store_id", store.id).order("created_at", { ascending: false }).range(from, to);
    if (data && data.length > 0) { setOrders(prev => [...prev, ...(data as Order[])]); setOrdersPage(nextPage); }
    setLoadingMoreOrders(false);
  };

  useEffect(() => { if (user) fetchAllData(); }, [user]);

  // Realtime subscriptions (toasts removed for wallet and price updates)
  useEffect(() => {
    if (!store?.id) return;
    const c1 = supabase.channel("agent-store-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "agent_stores", filter: `id=eq.${store.id}` }, () => fetchAllData())
      .subscribe();
    const c2 = supabase.channel("withdrawal-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "withdrawal_requests", filter: `agent_store_id=eq.${store.id}` }, (p) => {
        if ((p.new as any).status === "completed" && (p.old as any).status !== "completed") { fetchAllData(); toast({ title: "Withdrawal approved!" }); }
        else if ((p.new as any).status !== (p.old as any).status) fetchAllData();
      }).subscribe();
    const c3 = supabase.channel("agent-price-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_package_prices", filter: `agent_store_id=eq.${store.id}` }, () => fetchAllData())
      .subscribe();
    const c4 = supabase.channel("order-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `agent_store_id=eq.${store.id}` }, () => fetchAllData())
      .subscribe();
    return () => {
      supabase.removeChannel(c1);
      supabase.removeChannel(c2);
      supabase.removeChannel(c3);
      supabase.removeChannel(c4);
    };
  }, [store?.id]);

  useEffect(() => {
    if (orders.length > 0 && packages.length > 0) fetchTotalProfit();
  }, [orders, packages]);

  const fetchNotifications = async () => {
    if (!store?.id) return; setLoadingNotifications(true);
    const { data, error } = await supabase.from("agent_notifications").select("*").eq("agent_store_id", store.id).order("created_at", { ascending: false });
    if (!error && data) setNotifications(data as Notification[]);
    setLoadingNotifications(false);
  };
  useEffect(() => { if (store?.id) fetchNotifications(); }, [store]);

  const createNotification = async () => {
    if (!store || !newNotificationMsg.trim()) { toast({ title: "Error", description: "Please enter a message", variant: "destructive" }); return; }
    setSendingNotification(true);
    const expires_at = newNotificationExpiry ? new Date(newNotificationExpiry).toISOString() : null;
    const { error } = await supabase.from("agent_notifications").insert({ agent_store_id: store.id, message: newNotificationMsg.trim(), is_active: true, expires_at });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Notification sent!" }); setNewNotificationMsg(""); setNewNotificationExpiry(""); fetchNotifications(); }
    setSendingNotification(false);
  };
  const toggleNotificationActive = async (id: string, cur: boolean) => {
    const { error } = await supabase.from("agent_notifications").update({ is_active: !cur }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else fetchNotifications();
  };
  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("agent_notifications").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else fetchNotifications();
  };

  const saveThemeColors = async () => {
    if (!store) return; setSavingTheme(true);
    const { error } = await supabase.from("agent_stores").update({ theme_config: themeColors }).eq("id", store.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else toast({ title: "Theme updated!" });
    setSavingTheme(false);
  };
  const resetToDefault = () => setThemeColors(DEFAULT_THEME);
  const changeColumns = (d: number) => setThemeColors({ ...themeColors, gridColumns: Math.min(6, Math.max(1, (themeColors.gridColumns || 2) + d)) });

  const saveStoreHeadline = async () => {
    if (!store) return; setSavingHeadline(true);
    const { error } = await supabase.from("agent_stores").update({ store_headline: storeHeadline }).eq("id", store.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Headline updated!" }); setStore({ ...store, store_headline: storeHeadline }); }
    setSavingHeadline(false);
  };

  // Price handling with markup
  const handlePriceChange = (id: string, v: string) => setEditedPrices(p => ({ ...p, [id]: parseFloat(v) }));
  const savePrices = async () => {
    if (!store) return; setSavingPrices(true);
    try {
      for (const [id, sp] of Object.entries(editedPrices)) {
        const pkg = packages.find(p => p.id === id); if (!pkg) continue;
        if (isNaN(sp) || sp <= 0) { toast({ title: "Invalid price", variant: "destructive" }); setSavingPrices(false); return; }
        if (sp < pkg.agent_price) { toast({ title: "Price below cost", variant: "destructive" }); setSavingPrices(false); return; }
      }
      for (const [id, sp] of Object.entries(editedPrices)) {
        if (agentPrices[id] !== undefined) await supabase.from("agent_package_prices").update({ sell_price: Number(sp) }).eq("agent_store_id", store.id).eq("package_id", id);
        else await supabase.from("agent_package_prices").insert({ agent_store_id: store.id, package_id: id, sell_price: Number(sp) });
      }
      const { data: fp } = await supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", store.id);
      const nm: Record<string, number> = {}; (fp ?? []).forEach((p: any) => { nm[p.package_id] = p.sell_price; });
      setAgentPrices(nm); setEditedPrices({});
      toast({ title: "Prices saved!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSavingPrices(false); }
  };

  const applyMarkup = () => {
    const percent = parseFloat(markupPercent);
    if (isNaN(percent)) {
      toast({ title: "Invalid percentage", description: "Enter a number like 10 or -5", variant: "destructive" });
      return;
    }
    const multiplier = 1 + percent / 100;
    const newEdited: Record<string, number> = { ...editedPrices };
    const currentNetworkPackages = packages.filter(p => p.network === networkFilter);
    let appliedCount = 0;
    for (const pkg of currentNetworkPackages) {
      const basePrice = pkg.agent_price;
      let newPrice = basePrice * multiplier;
      newPrice = Math.round(newPrice * 100) / 100;
      if (newPrice < basePrice) newPrice = basePrice;
      newEdited[pkg.id] = newPrice;
      appliedCount++;
    }
    setEditedPrices(newEdited);
    const networkName = networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel";
    toast({
      title: `Markup applied to ${networkName} packages`,
      description: `${percent}% markup applied to the base price of ${appliedCount} packages. Remember to click "Save Prices" to keep these changes.`,
    });
  };

  const saveStoreInfo = async () => {
    if (!store) return; setSavingStore(true);
    const { error } = await supabase.from("agent_stores").update({
      store_name: storeForm.store_name, whatsapp_number: storeForm.whatsapp_number,
      support_number: storeForm.support_number, whatsapp_group: storeForm.whatsapp_group || null,
      show_whatsapp_group_icon: storeForm.show_whatsapp_group_icon,
      momo_number: storeForm.momo_number, momo_name: storeForm.momo_name, momo_network: storeForm.momo_network,
    }).eq("id", store.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setStore({ ...store, ...storeForm, whatsapp_group: storeForm.whatsapp_group || null }); setEditingStore(false); toast({ title: "Store updated!" }); }
    setSavingStore(false);
  };

  const openBuyDialog = (pkg: DataPackage) => { setBuyPkg(pkg); setBuyPhone(""); setBuyStep("phone"); setBuyPaymentMethod("wallet"); setBuyDialogOpen(true); };

  const handleBuyConfirm = async () => {
    if (!store || !buyPkg) return; setBuyLoading(true);
    if (buyPaymentMethod === "wallet") {
      const ap = Number(buyPkg.agent_price);
      const balanceAfterBuy = Number(store.wallet_balance) - ap;
      if (balanceAfterBuy < pendingWithdrawalAmount) {
        toast({ title: "Purchase blocked", description: `Pending withdrawal of GH₵ ${pendingWithdrawalAmount.toFixed(2)} would leave balance too low.`, variant: "destructive" });
        setBuyLoading(false); return;
      }
    }
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
      setStore({ ...store, wallet_balance: Number(store.wallet_balance) - ap });
      toast({ title: "Order placed!" }); setBuyDialogOpen(false);
      fetchAllData();
    } else {
      try {
        const email = user?.email || `agent-${store.id}@datapluggh.com`;
        const total = Math.round((ap + (ap * 1.95 / 100)) * 100) / 100;
        const { data, error } = await supabase.functions.invoke("initialize-payment", { body: { email, amount: total, phone: buyPhone.trim(), callback_url: `${window.location.origin}/agent?payment=verifying`, metadata: { package_id: buyPkg.id, network: buyPkg.network, package_name: `${buyPkg.size_gb}GB`, agent_store_id: store.id, payment_method: "paystack", use_agent_price: true } } });
        if (error) throw error;
        if (data?.authorization_url) window.location.href = data.authorization_url; else throw new Error(data?.error || "Failed to initialize payment");
      } catch (e: any) { toast({ title: "Payment Error", description: e.message, variant: "destructive" }); }
    }
    setBuyLoading(false);
  };

  const handleWithdraw = async () => {
    if (!store) return;
    if (hasPendingWithdrawal) { toast({ title: "Pending withdrawal exists", variant: "destructive" }); return; }
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 10) { toast({ title: "Minimum is GH₵ 10.00", variant: "destructive" }); return; }
    if (amt > Number(store.wallet_balance)) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setWithdrawLoading(true);
    const { error } = await supabase.from("withdrawal_requests").insert({ agent_store_id: store.id, amount: amt });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Withdrawal requested!" }); setWithdrawAmount(""); fetchAllData(); }
    setWithdrawLoading(false);
  };

  // ==================== FLYER FUNCTIONS ====================
  const getFlyerPrice = (pkg: DataPackage) => agentPrices[pkg.id] ?? pkg.price;
  const getMtnPkgs = () => MTN_SIZES.map(s => { const p = packages.find(x => x.network === "mtn" && x.size_gb === s); return p ? { size: s, price: getFlyerPrice(p) } : null; }).filter(Boolean) as { size: number; price: number }[];
  const getAirtelPkgs = () => AIRTEL_SIZES.map(s => { const p = packages.find(x => x.network === "airteltigo" && x.size_gb === s); return p ? { size: s, price: getFlyerPrice(p) } : null; }).filter(Boolean) as { size: number; price: number }[];
  const getTelecelPkgs = () => TELECEL_SIZES.map(s => { const p = packages.find(x => x.network === "telecel" && x.size_gb === s); return p ? { size: s, price: getFlyerPrice(p) } : null; }).filter(Boolean) as { size: number; price: number }[];

  const saveFlyerColors = (c: typeof flyerColors) => { setFlyerColors(c); localStorage.setItem("flyerColors", JSON.stringify(c)); toast({ title: "Colours saved!" }); };

  const generatePng = async (): Promise<string> => {
    const el = flyerRef.current;
    if (!el) throw new Error("Flyer element not found");
    const prev = el.style.transform;
    el.style.transform = "none";
    try {
      return await toPng(el, {
        quality: 1,
        width: FLYER_W,
        height: FLYER_H,
        pixelRatio: 1,
        backgroundColor: "#000000",
        skipFonts: false,
        style: { transform: "none", transformOrigin: "top left" },
      });
    } finally {
      el.style.transform = prev;
    }
  };

  const downloadFlyer = async () => {
    setGeneratingFlyer(true);
    try {
      const dataUrl = await generatePng();
      const a = document.createElement("a");
      a.download = `${(store?.store_name || "flyer").replace(/\s+/g, "-")}-prices.png`;
      a.href = dataUrl; a.click();
      toast({ title: "Flyer downloaded!", description: `Saved as ${FLYER_W}×${FLYER_H} PNG.` });
    } catch (e: any) { toast({ title: "Download failed", description: e.message, variant: "destructive" }); }
    finally { setGeneratingFlyer(false); }
  };

  const previewAsImage = async () => {
    setGeneratingFlyer(true);
    try {
      const dataUrl = await generatePng();
      const win = window.open();
      if (win) {
        win.document.write(`<html><head><title>Flyer Preview</title></head><body style="margin:0; display:flex; justify-content:center; align-items:center; background:#000;"><img src="${dataUrl}" style="max-width:100%; height:auto; box-shadow:0 4px 20px rgba(0,0,0,0.5);" /></body></html>`);
        win.document.close();
      } else {
        toast({ title: "Pop‑up blocked", description: "Please allow pop‑ups for this site.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    }
    setGeneratingFlyer(false);
  };

  // ─── IMPROVED SHARE FUNCTION – shares image directly via Web Share API ───
  const shareFlyer = async () => {
    setGeneratingFlyer(true);
    try {
      const dataUrl = await generatePng();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "flyer.png", { type: "image/png" });

      // 1. Try to share the image file (mobile browsers that support file sharing)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${store?.store_name} – Data Bundles`,
          text: shareText,
          files: [file],
        });
        toast({ title: "Shared!", description: "Image and text sent via WhatsApp." });
        setGeneratingFlyer(false);
        return;
      }

      // 2. If share is available but cannot share files, share text and download image
      if (navigator.share) {
        await navigator.share({
          title: `${store?.store_name} – Data Bundles`,
          text: shareText,
        });
        // Also download the image for the user
        const a = document.createElement("a");
        a.download = "flyer.png";
        a.href = dataUrl;
        a.click();
        toast({ title: "Text shared!", description: "Image saved to your device. Attach it in WhatsApp." });
        setGeneratingFlyer(false);
        return;
      }

      // 3. Desktop fallback: download image + open WhatsApp with text
      const a = document.createElement("a");
      a.download = "flyer.png";
      a.href = dataUrl;
      a.click();
      const encodedText = encodeURIComponent(shareText);
      window.open(`https://wa.me/?text=${encodedText}`, "_blank");
      toast({ title: "Image downloaded & WhatsApp opened", description: "Attach the image to complete the share." });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast({ title: "Sharing failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setGeneratingFlyer(false);
    }
  };

  const copyPhoneNumber = (p: string) => { navigator.clipboard.writeText(p); toast({ title: "Copied!", description: p }); };
  const copyStoreLink = () => { navigator.clipboard.writeText(storeUrl); toast({ title: "Link copied!", description: storeUrl }); };
  const copyRef = () => { if (store?.topup_reference) { navigator.clipboard.writeText(store.topup_reference); toast({ title: "Reference copied!" }); } };

  // ─── GUARDS ───────────────────────────────────────────────────────────────
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
  const storeName = store?.store_name || "DATA PLUG .STORE";
  const supportNum = store?.support_number || "";

  const totalOrders = ordersTotal;
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const filteredOrders = orders.filter(o => o.customer_number.toLowerCase().includes(orderSearch.toLowerCase()) || o.id.toLowerCase().includes(orderSearch.toLowerCase()));
  const hasMoreOrders = orders.length < ordersTotal;

  const mtnPkgs = getMtnPkgs();
  const airtelPkgs = getAirtelPkgs();
  const telecelPkgs = getTelecelPkgs();

  const PkgCard = ({ size, price, network, accent, textColor = "#000" }: { size: number; price: number; network: string; accent: string; textColor?: string }) => (
    <div style={{ borderRadius: 10, padding: "12px 6px 10px", textAlign: "center", background: `${accent}18`, border: `1.5px solid ${accent}35`, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{size}GB</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: `${accent}cc`, textTransform: "uppercase", letterSpacing: 0.3 }}>{network}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#ddd" }}>GHC{price.toFixed(2)}</div>
      <div style={{ width: "90%", padding: "5px 0", borderRadius: 5, background: accent, color: textColor, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.2 }}>Buy Now</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <NotificationPopup />

      {/* NAV */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer"><Menu className="h-5 w-5 text-primary" /><span className="font-display text-lg font-bold text-primary animate-pulse">MENU</span></div>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4 bg-card border-r border-border">
              <SheetHeader className="mb-6"><SheetTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Menu</SheetTitle></SheetHeader>
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
            <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sign Out</Button>
          </div>
        </div>
      </nav>

      <div className="container py-8 space-y-6">
        {store && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div><p className="text-sm font-semibold text-foreground">Your Store Website</p><p className="text-xs text-muted-foreground">{storeUrl}</p></div>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={copyStoreLink}><Copy className="h-4 w-4 mr-1" /> Copy Link</Button><Button variant="hero" size="sm" asChild><a href={storeUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Visit Store</a></Button></div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="hidden" />

          {/* ============================= OVERVIEW ============================= */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            <Card className="border-primary/30 bg-primary/5">
              <button onClick={() => setManualOpen(v => !v)} className="w-full flex items-center justify-between p-4 text-left">
                <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-primary" /><div><p className="font-display font-bold text-foreground">📖 Dashboard Instruction Manual</p><p className="text-xs text-muted-foreground">Tap to {manualOpen ? "hide" : "view"} a full guide on how every section works</p></div></div>
                {manualOpen ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-primary" />}
              </button>
              {manualOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Tap any section to expand its guide.Tap on the MENU above to see these section </p>
                  {MANUAL_SECTIONS.map((sec, i) => (
                    <div key={i} className="border border-border rounded-lg overflow-hidden">
                      <button onClick={() => setOpenManualSection(openManualSection === i ? null : i)} className="w-full flex items-center justify-between p-3 text-left bg-card hover:bg-secondary/50 transition-colors">
                        <span className="font-semibold text-foreground flex items-center gap-2"><span>{sec.icon}</span> {sec.title}</span>
                        {openManualSection === i ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      </button>
                      {openManualSection === i && (
                        <div className="p-3 bg-background border-t border-border">
                          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{sec.content}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Store Status</p><Badge className="mt-2 bg-green-600/20 text-green-400 border-green-600/30">Active</Badge></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Total Orders</p><p className="font-display text-2xl font-bold mt-1 text-foreground">{totalOrders}</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Pending</p><p className="font-display text-2xl font-bold mt-1 text-primary">{pendingOrders}</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Revenue</p><p className="font-display text-2xl font-bold mt-1 text-green-400">GH₵ {profitStats.totalRevenue.toFixed(2)}</p></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Profit</p><p className="font-display text-2xl font-bold text-green-400 mt-1">GH₵ {profitStats.totalProfit.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">(Selling Price - Base Price)</p></div><TrendingUp className="h-8 w-8 text-green-400 opacity-50" /></div></CardContent></Card>
              <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Available for Withdrawal</p><p className="font-display text-2xl font-bold text-yellow-400 mt-1">GH₵ {Number(store?.wallet_balance ?? 0).toFixed(2)}</p>{hasPendingWithdrawal && <p className="text-xs text-orange-400 mt-1">⚠️ GH₵ {pendingWithdrawalAmount.toFixed(2)} pending withdrawal</p>}</div><ArrowDownToLine className="h-8 w-8 text-yellow-400 opacity-50" /></div></CardContent></Card>
            </div>
            <Card className="border-border">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="font-display text-lg">Orders <span className="text-sm font-normal text-muted-foreground">({orders.length} of {ordersTotal} shown)</span></CardTitle>
                <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by number or order ID..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="pl-9" /></div>
              </CardHeader>
              <CardContent>
                {filteredOrders.length === 0 ? <p className="text-muted-foreground text-center py-4">No orders found.</p> : (
                  <>
                    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Number</TableHead><TableHead>Network</TableHead><TableHead>Size</TableHead><TableHead>Sell Price</TableHead><TableHead>Base Cost</TableHead><TableHead>Profit</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>{filteredOrders.map(order => { const pkg = packages.find(p => p.id === order.package_id); const cost = pkg?.agent_price || 0; const profit = Number(order.amount) - cost; return (<TableRow key={order.id}><TableCell className="text-sm">{new Date(order.created_at).toLocaleDateString()}</TableCell><TableCell className="font-mono text-sm">{order.customer_number}</TableCell><TableCell className="uppercase text-sm">{order.network}</TableCell><TableCell className="font-display font-bold">{order.size_gb}GB</TableCell><TableCell>GH₵ {Number(order.amount).toFixed(2)}</TableCell><TableCell className="text-muted-foreground">GH₵ {cost.toFixed(2)}</TableCell><TableCell className={profit >= 0 ? "text-green-400 font-semibold" : "text-red-400"}>GH₵ {profit.toFixed(2)}</TableCell><TableCell><Badge variant="outline" className="text-xs">{order.payment_method === "wallet" ? "Wallet" : "Paystack"}</Badge></TableCell><TableCell><Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>{order.status === "paid" ? "completed" : order.status}</Badge></TableCell></TableRow>); })}</TableBody></Table></div>
                    {hasMoreOrders && !orderSearch && <div className="flex justify-center mt-4"><Button variant="outline" onClick={loadMoreOrders} disabled={loadingMoreOrders} className="gap-2">{loadingMoreOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{loadingMoreOrders ? "Loading..." : `Load More (${ordersTotal - orders.length} remaining)`}</Button></div>}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================= BUY DATA ============================= */}
          <TabsContent value="buy" className="space-y-4 mt-0">
            {store && (<Card className={`border-border ${hasPendingWithdrawal ? "border-orange-500/30 bg-orange-500/5" : "bg-secondary/30"}`}>
              <CardContent className="p-4 space-y-1"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /><span className="font-medium">Wallet Balance:</span></div><span className="font-display text-xl font-bold text-primary">GH₵ {store.wallet_balance?.toFixed(2) ?? "0.00"}</span></div>{hasPendingWithdrawal && <p className="text-xs text-orange-400">⚠️ GH₵ {pendingWithdrawalAmount.toFixed(2)} reserved for pending withdrawal. Effective spendable: <strong>GH₵ {effectiveBalance.toFixed(2)}</strong></p>}</CardContent>
            </Card>)}
            <div className="flex gap-2 flex-wrap">{["mtn", "airteltigo", "telecel"].map(net => (<Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>{net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}</Button>))}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredPackages.map(pkg => {
                const ap = Number(pkg.agent_price);
                const wouldUnderflow = hasPendingWithdrawal && (Number(store?.wallet_balance ?? 0) - ap) < pendingWithdrawalAmount;
                return (<Card key={pkg.id} className={`border-border transition-all ${wouldUnderflow ? "opacity-50" : "hover:border-primary/50"}`}>
                  <CardContent className="p-4 text-center space-y-3"><div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto"><Wifi className="h-5 w-5 text-primary" /></div><p className="font-display text-xl font-bold text-foreground">{pkg.size_gb}GB</p><p className="text-lg font-bold text-primary">GH₵ {ap.toFixed(2)}</p><p className="text-xs text-muted-foreground">Agent Price</p>{wouldUnderflow ? <p className="text-xs text-orange-400">Blocked — pending withdrawal</p> : null}<Button variant="hero" size="sm" className="w-full" onClick={() => openBuyDialog(pkg)} disabled={wouldUnderflow}>Buy Now</Button></CardContent></Card>);
              })}
            </div>
          </TabsContent>

          {/* ============================= STORE PRICES ============================= */}
          <TabsContent value="store" className="space-y-4 mt-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2 flex-wrap">{["mtn", "airteltigo", "telecel"].map(net => (<Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>{net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}</Button>))}</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Markup:</span>
                <Input type="number" placeholder="+10" value={markupPercent} onChange={e => setMarkupPercent(e.target.value)} className="w-20 h-8 text-sm" />
                <Button variant="outline" size="sm" onClick={applyMarkup}><Percent className="h-3 w-3 mr-1" /> Apply</Button>
              </div>
              {Object.keys(editedPrices).length > 0 && <Button variant="hero" size="sm" onClick={savePrices} disabled={savingPrices}><Save className="h-4 w-4 mr-1" />{savingPrices ? "Saving..." : "Save Prices"}</Button>}
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
              <p className="font-semibold">USE Markup if you feel lazy and do not want to edit each GB price one by one <br></br>💡 Markup Explanation(Remember to click save after applying markup</p>
              <p className="text-xs text-muted-foreground">Markup changes all your selling price for the selected network base on the percentage you want all the prices to be increase by  .Markup is applied to the <strong>Base Price</strong> (your cost). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"}</strong>).</p>
            </div>
            <p className="text-sm text-muted-foreground">Your profit = Selling Price - Base Price. Use markup to increase all prices by a % (based on base price).</p>
            <Card className="border-border"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Size</TableHead><TableHead>Base Price</TableHead><TableHead>Your Selling Price</TableHead><TableHead>Profit</TableHead></TableRow></TableHeader>
              <TableBody>{filteredPackages.map(pkg => { const cur = editedPrices[pkg.id] ?? agentPrices[pkg.id] ?? pkg.price; const profit = cur - pkg.agent_price; return (<TableRow key={pkg.id}><TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell><TableCell className="text-muted-foreground">GH₵ {Number(pkg.agent_price).toFixed(2)}</TableCell><TableCell><Input type="number" step="0.01" value={cur} onChange={e => handlePriceChange(pkg.id, e.target.value)} className="w-24 h-8" /></TableCell><TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>GH₵ {profit.toFixed(2)}</TableCell></TableRow>); })}</TableBody></Table></div></Card>
          </TabsContent>

          {/* ============================= FLYER GENERATOR ============================= */}
          <TabsContent value="flyer" className="mt-0">
            <div className="space-y-4">
              <Card className="border-border">
                <CardHeader className="pb-3"><CardTitle className="font-display flex items-center gap-2"><Image className="h-5 w-5 text-primary" /> Flyer Generator</CardTitle><p className="text-sm text-muted-foreground">Live prices auto-populate. Customise colours, edit share message, then download or share directly to WhatsApp.</p></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-3 items-center">
                      {([{ label: "MTN", key: "mtnColor" }, { label: "Airtel", key: "airtelColor" }, { label: "Telecel", key: "telecelColor" }, { label: "Brand", key: "buttonBg" }] as { label: string; key: keyof typeof flyerColors }[]).map(({ label, key }) => (<div key={key} className="flex items-center gap-2"><Label className="text-xs">{label}</Label><Input type="color" value={flyerColors[key]} onChange={e => setFlyerColors({ ...flyerColors, [key]: e.target.value })} className="w-10 h-8 p-0 cursor-pointer" /></div>))}
                    </div>
                    <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => saveFlyerColors(flyerColors)}><Save className="h-3 w-3 mr-1" /> Save</Button><Button variant="ghost" size="sm" onClick={() => saveFlyerColors(DEFAULT_FLYER_COLORS)}><RotateCcw className="h-3 w-3 mr-1" /> Reset</Button></div>
                  </div>
                  <div className="space-y-1"><Label className="text-sm font-medium">Share Message <span className="text-muted-foreground font-normal text-xs">(editable)</span></Label><Textarea value={shareText} onChange={e => setShareText(e.target.value)} rows={4} className="text-sm font-mono" /></div>

                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={downloadFlyer} disabled={generatingFlyer} className="gap-2 flex-1 sm:flex-none">
                      {generatingFlyer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PNG
                    </Button>
                    <Button variant="hero" onClick={previewAsImage} disabled={generatingFlyer} className="gap-2 flex-1 sm:flex-none">
                      {generatingFlyer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />} Preview as Image
                    </Button>
                    <Button variant="secondary" onClick={shareFlyer} disabled={generatingFlyer} className="gap-2 flex-1 sm:flex-none">
                      {generatingFlyer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share Flyer
                    </Button>
                  </div>
                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm">
                    <p className="font-semibold flex items-center gap-1"><Image className="h-4 w-4" /> How to save & share</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      📱 <strong>Mobile:</strong> Tap "Share Flyer" to send the image directly via WhatsApp (native share sheet).<br />
                      💻 <strong>Desktop:</strong> The image will be downloaded, then WhatsApp opens with your message – attach the downloaded image manually.<br />
                      💾 <strong>Download PNG:</strong> Saves the image to your device.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <div ref={flyerContainerRef} className="w-full overflow-hidden rounded-lg border border-border" style={{ aspectRatio: `${FLYER_W} / ${FLYER_H}`, position: "relative", background: "#000" }}>
                <div ref={flyerRef} style={{ width: FLYER_W, height: FLYER_H, transform: `scale(${flyerScale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0, backgroundColor: "#000000", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", overflow: "hidden" }}>
                  {/* TOP NAV */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", backgroundColor: "#0a0a0a", borderBottom: "1px solid #1e1e1e" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, background: flyerColors.buttonBg, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div><span style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>{storeName.toUpperCase()}</span></div>
                    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>{["Packages", "Services", "Become an Agent"].map(l => (<span key={l} style={{ fontSize: 14, color: "#666", fontWeight: 500 }}>{l}</span>))}<span style={{ fontSize: 13, color: flyerColors.buttonBg, fontWeight: 700, padding: "5px 14px", background: `${flyerColors.buttonBg}20`, borderRadius: 7, border: `1px solid ${flyerColors.buttonBg}40` }}>Agent Dashboard</span><span style={{ fontSize: 14, color: "#888" }}>Sign Out</span></div>
                  </div>
                  <div style={{ textAlign: "center", padding: "30px 20px 14px" }}><div style={{ fontSize: 46, fontWeight: 900, color: "#fff", letterSpacing: -1, textTransform: "uppercase" }}>DATA BUNDLES – ALL NETWORKS</div><div style={{ fontSize: 18, color: "#777", marginTop: 6 }}>Affordable. Instant. Reliable.</div></div>
                  <div style={{ display: "flex", justifyContent: "center", margin: "0 auto 20px", width: "fit-content" }}>{[{ label: "MTN", bg: flyerColors.mtnColor, txt: "#000" }, { label: "AirtelTigo", bg: flyerColors.airtelColor, txt: "#fff" }, { label: "Telecel", bg: flyerColors.telecelColor, txt: "#fff" }].map((tab, i) => (<div key={tab.label} style={{ padding: "13px 52px", background: tab.bg, color: tab.txt, fontSize: 17, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, borderRadius: i === 0 ? "9px 0 0 9px" : i === 2 ? "0 9px 9px 0" : "0", border: `2px solid ${tab.bg}` }}>{tab.label}</div>))}</div>
                  {/* MTN */}
                  <div style={{ margin: "0 20px 16px", border: `2px solid ${flyerColors.mtnColor}50`, borderRadius: 14, overflow: "hidden" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#0e0b00", borderBottom: `1px solid ${flyerColors.mtnColor}30` }}><span style={{ fontSize: 22, fontWeight: 900, color: flyerColors.mtnColor, letterSpacing: 1, textTransform: "uppercase" }}>MTN DATA BUNDLES</span><span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.mtnColor, border: `2px solid ${flyerColors.mtnColor}`, borderRadius: 20, padding: "4px 16px" }}>MTN</span></div><div style={{ backgroundColor: "#0a0800", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>{mtnPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} network="MTN" accent={flyerColors.mtnColor} textColor="#000" />)}</div></div>
                  {/* AirtelTigo */}
                  <div style={{ margin: "0 20px 16px", border: `2px solid ${flyerColors.airtelColor}50`, borderRadius: 14, overflow: "hidden" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#06041a", borderBottom: `1px solid ${flyerColors.airtelColor}30` }}><span style={{ fontSize: 22, fontWeight: 900, color: flyerColors.airtelColor, letterSpacing: 1, textTransform: "uppercase" }}>AIRTELTIGO DATA BUNDLES</span><span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.airtelColor, border: `2px solid ${flyerColors.airtelColor}`, borderRadius: 20, padding: "4px 16px" }}>airtel tigo</span></div><div style={{ backgroundColor: "#050314", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>{airtelPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} network="AIRTELTIGO" accent={flyerColors.airtelColor} textColor="#fff" />)}</div></div>
                  {/* Telecel */}
                  <div style={{ margin: "0 20px 16px", border: `2px solid ${flyerColors.telecelColor}50`, borderRadius: 14, overflow: "hidden" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#120000", borderBottom: `1px solid ${flyerColors.telecelColor}30` }}><span style={{ fontSize: 22, fontWeight: 900, color: flyerColors.telecelColor, letterSpacing: 1, textTransform: "uppercase" }}>TELECEL DATA BUNDLES</span><span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.telecelColor, border: `2px solid ${flyerColors.telecelColor}`, borderRadius: 20, padding: "4px 16px" }}>telecel</span></div><div style={{ backgroundColor: "#0e0000", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>{telecelPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} network="TELECEL" accent={flyerColors.telecelColor} textColor="#fff" />)}</div></div>
                  {/* Contact footer */}
                  <div style={{ margin: "0 20px 16px", background: "#0d7c30", borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}><div style={{ width: 52, height: 52, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="30" height="30" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg></div><div><div style={{ fontSize: 20, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>NEED HELP OR HAVE QUESTIONS?</div><div style={{ fontSize: 14, color: "#86efac", marginTop: 3 }}>Contact us directly on WhatsApp or Call.</div></div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.35)", borderRadius: 40, padding: "12px 30px", border: "1.5px solid rgba(255,255,255,0.15)", flexShrink: 0 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg><span style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>{supportNum}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#25D366", borderRadius: 40, padding: "12px 24px", flexShrink: 0 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg><span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Chat on WhatsApp</span></div>
                  </div>
                  <div style={{ textAlign: "center", paddingBottom: 24, fontSize: 16, color: "#444" }}><span style={{ color: flyerColors.buttonBg }}>{storeUrl}</span></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Output: {FLYER_W} × {FLYER_H} px. Contact shown: <strong>{supportNum || "— set in Settings"}</strong></p>
            </div>
          </TabsContent>

          {/* ============================= WITHDRAW ============================= */}
          <TabsContent value="withdraw" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Card className="border-primary/30 bg-primary/5"><CardContent className="p-6 text-center space-y-2"><TrendingUp className="h-10 w-10 text-primary mx-auto" /><p className="text-muted-foreground text-sm">Total Profit</p><p className="font-display text-3xl font-bold text-green-400">GH₵ {profitStats.totalProfit.toFixed(2)}</p></CardContent></Card><Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-6 text-center space-y-2"><ArrowDownToLine className="h-10 w-10 text-yellow-400 mx-auto" /><p className="text-muted-foreground text-sm">Wallet Balance</p><p className="font-display text-3xl font-bold text-yellow-400">GH₵ {Number(store?.wallet_balance ?? 0).toFixed(2)}</p></CardContent></Card></div>
            <Card className="border-border"><CardHeader><CardTitle className="font-display text-lg">Request Withdrawal</CardTitle></CardHeader><CardContent className="space-y-4">{hasPendingWithdrawal && (<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3"><p className="text-sm text-yellow-400 font-medium">⚠️ You have a pending withdrawal of GH₵ {pendingWithdrawalAmount.toFixed(2)}. Please wait until it completes before requesting another.</p></div>)}<div className="rounded-xl border border-border bg-secondary/50 p-4"><div className="grid grid-cols-3 gap-4 text-sm"><div className="text-center"><p className="text-xs text-muted-foreground">MoMo Name</p><p className="font-bold">{store?.momo_name}</p></div><div className="text-center"><p className="text-xs text-muted-foreground">MoMo Number</p><p className="font-bold">{store?.momo_number}</p></div><div className="text-center"><p className="text-xs text-muted-foreground">Network</p><p className="font-bold">{store?.momo_network?.toUpperCase()}</p></div></div></div><p className="text-xs text-muted-foreground">Minimum: GH₵ 10.00. Processed within 24 hours.</p><div className="flex gap-2 items-end"><div className="flex-1 space-y-1"><Label>Amount (GH₵)</Label><Input type="number" step="0.01" placeholder="e.g. 50.00" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} disabled={hasPendingWithdrawal} /></div><Button variant="hero" onClick={handleWithdraw} disabled={withdrawLoading || hasPendingWithdrawal}>{withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />}Withdraw</Button></div></CardContent></Card>
            {withdrawals.length > 0 && (<Card className="border-border"><CardHeader><CardTitle className="font-display text-lg">Withdrawal History</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{withdrawals.map(w => (<TableRow key={w.id}><TableCell className="text-sm">{new Date(w.created_at).toLocaleString()}</TableCell><TableCell className="font-bold">GH₵ {Number(w.amount).toFixed(2)}</TableCell><TableCell><Badge className={w.status === "completed" ? "bg-green-600/20 text-green-400 border-green-600/30" : w.status === "pending" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" : "bg-red-600/20 text-red-400 border-red-600/30"}>{w.status}</Badge></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>)}
          </TabsContent>

          {/* ============================= TOP UP ============================= */}
          <TabsContent value="topup" className="mt-0">
            <Card className="border-border"><CardHeader><CardTitle className="font-display flex items-center gap-2"><Coins className="h-5 w-5 text-primary" /> Top Up Your Wallet</CardTitle></CardHeader><CardContent className="space-y-6"><div className="rounded-lg bg-primary/5 border border-primary/30 p-4 text-center"><p className="text-sm text-muted-foreground">Current Wallet Balance</p><p className="font-display text-3xl font-bold text-primary">GH₵ {store?.wallet_balance?.toFixed(2) ?? "0.00"}</p></div><div className="space-y-4"><h3 className="font-semibold text-lg">Steps to top up:</h3><ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground"><li>Dial <span className="font-mono font-bold text-foreground">*170#</span> on your MTN MoMo phone.</li><li>Select <b>1</b> (Transfer Money) → <b>1</b> (MoMo User).</li><li>Recipient: <span className="font-mono font-bold text-foreground">0599449202</span> <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1" onClick={() => copyPhoneNumber("0599449202")}><Copy className="h-3 w-3" /></Button></li><li>Enter the amount.</li><li>Reference: <div className="mt-2 p-3 bg-secondary/50 rounded-lg border border-border font-mono font-bold text-center text-primary text-xl">{store?.topup_reference ?? "N/A"}<Button variant="ghost" size="sm" className="ml-2 h-8" onClick={copyRef}><Copy className="h-3 w-3" /> Copy</Button></div></li><li>Send transaction ID to: <div className="mt-2 flex flex-wrap gap-3"><Button variant="outline" size="sm" asChild><a href="https://wa.me/233200511211" target="_blank" rel="noopener noreferrer">📱 WhatsApp 0200511211</a></Button><Button variant="outline" size="sm" asChild><a href="tel:0599449202">📞 Call 0599449202</a></Button></div></li></ol></div><div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm"><p className="font-semibold text-yellow-400">⚠️ Important</p><p className="text-muted-foreground">Admin credits your wallet after verifying the transaction ID.</p></div></CardContent></Card>
          </TabsContent>

          {/* ============================= APPEARANCE ============================= */}
          <TabsContent value="appearance" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border"><CardHeader><CardTitle className="font-display">Customise Your Storefront</CardTitle></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label>Store Headline</Label><Textarea value={storeHeadline} onChange={e => setStoreHeadline(e.target.value)} rows={2} placeholder="Get the best data deals from ..." /><Button variant="outline" size="sm" onClick={saveStoreHeadline} disabled={savingHeadline}>{savingHeadline ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Headline</Button></div><div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">{[{ label: "Primary Colour", key: "primary" }, { label: "Text on Primary", key: "primary_foreground" }, { label: "Page Background", key: "background" }, { label: "Card Background", key: "card_background" }].map(({ label, key }) => (<div key={key} className="space-y-1"><Label className="text-sm">{label}</Label><div className="flex gap-2 items-center"><Input type="color" value={(themeColors as any)[key]} onChange={e => setThemeColors({ ...themeColors, [key]: e.target.value })} className="w-12 h-9 p-1 cursor-pointer" /><Input type="text" value={(themeColors as any)[key]} onChange={e => setThemeColors({ ...themeColors, [key]: e.target.value })} className="flex-1 font-mono text-sm" /></div></div>))}</div><div className="border-t border-border pt-4"><Label className="mb-2 block font-semibold flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" /> Grid Columns</Label><div className="flex items-center gap-2 max-w-xs"><Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => changeColumns(-1)} disabled={themeColors.gridColumns <= 1}><Minus className="h-4 w-4" /></Button><Input type="number" min={1} max={6} value={themeColors.gridColumns} onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1 && v <= 6) setThemeColors({ ...themeColors, gridColumns: v }); }} className="w-20 text-center" /><Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => changeColumns(1)} disabled={themeColors.gridColumns >= 6}><PlusIcon className="h-4 w-4" /></Button><span className="text-sm text-muted-foreground ml-2">columns per row</span></div></div><div className="flex gap-3 pt-2"><Button variant="hero" onClick={saveThemeColors} disabled={savingTheme} className="flex-1">{savingTheme ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Theme</Button><Button variant="outline" onClick={resetToDefault} className="flex-1"><RotateCcw className="h-4 w-4 mr-1" />Reset</Button></div></CardContent></Card>
              <Card className="border-border"><CardHeader><CardTitle className="font-display text-base">Live Preview</CardTitle><p className="text-xs text-muted-foreground">This is exactly how your public store will look.</p></CardHeader><CardContent><div className="rounded-xl overflow-hidden border border-border" style={{ backgroundColor: themeColors.background, minHeight: 320 }}><div className="p-4" style={{ backgroundColor: themeColors.background }}><div className="text-center mb-3"><p className="font-bold text-sm" style={{ color: themeColors.primary }}>{store?.store_name || "Your Store Name"}</p><p className="text-xs mt-1" style={{ color: `${themeColors.primary}99` }}>{storeHeadline || "Your store headline"}</p></div><div className="grid gap-2 mt-3" style={{ gridTemplateColumns: `repeat(${Math.min(themeColors.gridColumns, 4)}, minmax(0, 1fr))` }}>{Array.from({ length: Math.min(themeColors.gridColumns * 2, 8) }).map((_, i) => (<div key={i} className="rounded-lg p-2 text-center text-xs" style={{ backgroundColor: themeColors.card_background, border: `1px solid ${themeColors.primary}30` }}><div className="font-bold text-white text-sm">{[1, 2, 3, 4, 5, 6, 8, 10][i] || i + 1}GB</div><div className="text-xs mt-1" style={{ color: `${themeColors.primary}cc` }}>MTN</div><div className="text-xs" style={{ color: "#ccc" }}>GH₵ {(4 + i * 3).toFixed(2)}</div><div className="mt-1 rounded text-xs py-0.5 font-bold" style={{ backgroundColor: themeColors.primary, color: themeColors.primary_foreground }}>Buy</div></div>))}</div></div></div><p className="text-xs text-muted-foreground mt-2 text-center">{themeColors.gridColumns} column{themeColors.gridColumns !== 1 ? "s" : ""} per row • Changes apply live after saving</p></CardContent></Card>
            </div>
          </TabsContent>

          {/* ============================= SUBAGENTS ============================= */}
          <TabsContent value="subagents" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-border">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-2">Total Subagents</p>
                  <p className="text-3xl font-bold">{subagents.length}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-2">Total Profit from Subagents</p>
                  <p className="text-3xl font-bold text-green-400">GH₵{subagents.reduce((sum, s) => sum + (Number(s.wallet_balance) || 0), 0).toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-2">Total Orders from Subagents</p>
                  <p className="text-3xl font-bold text-blue-400">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display flex items-center gap-2">
                  <Users className="h-5 w-5" /> Your Subagents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-blue-400 mb-2">Allow Subagent Registration</p>
                      <p className="text-sm text-muted-foreground mb-4">When enabled, a "Become a Subagent" button will appear on your storefront.</p>
                    </div>
                    <Switch 
                      checked={store?.allow_subagent_registration || false}
                      onCheckedChange={async (checked) => {
                        try {
                          const { error } = await supabase
                            .from('agent_stores')
                            .update({ allow_subagent_registration: checked })
                            .eq('id', store?.id);
                          if (error) throw error;
                          setStore(prev => prev ? { ...prev, allow_subagent_registration: checked } : null);
                          toast({ title: checked ? "Registration enabled" : "Registration disabled" });
                        } catch (error) {
                          console.error('Error updating subagent setting:', error);
                          toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
                        }
                      }}
                    />
                  </div>
                </div>

                <SubagentsList
                  agentStoreId={store?.id || ""}
                  subagents={subagents}
                  onSuspend={async (id: string) => {
                    const { error } = await supabase
                      .from("subagent_stores")
                      .update({ approved: false })
                      .eq("id", id);
                    if (!error) {
                      setSubagents(prev => prev.filter(s => s.id !== id));
                    }
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================= SUBAGENT PRICES ============================= */}
          <TabsContent value="subagent-prices" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Set Subagent Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-6">Set the selling prices for your subagents. These prices apply to all your subagents.</p>
                <SubagentPricesManager
                  agentStoreId={store?.id || ""}
                  packages={packages}
                  agentPrices={agentPrices}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================= NOTIFICATIONS ============================= */}
          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card className="border-border"><CardHeader><CardTitle className="font-display flex items-center gap-2"><Bell className="h-5 w-5" /> Send Notification to Storefront</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Message</Label><Textarea placeholder="e.g., 🎉 Special offer: 20% off all bundles this weekend!" value={newNotificationMsg} onChange={e => setNewNotificationMsg(e.target.value)} rows={3} /></div><div className="space-y-2"><Label>Expiry (optional)</Label><Input type="datetime-local" value={newNotificationExpiry} onChange={e => setNewNotificationExpiry(e.target.value)} /><p className="text-xs text-muted-foreground">Leave empty for no expiry.</p></div><Button variant="hero" onClick={createNotification} disabled={sendingNotification}>{sendingNotification ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Send Notification</Button></CardContent></Card>
            <Card className="border-border"><CardHeader><CardTitle className="font-display">Active &amp; Past Notifications</CardTitle></CardHeader><CardContent>{loadingNotifications ? (<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>) : notifications.length === 0 ? (<p className="text-center text-muted-foreground py-8">No notifications yet.</p>) : (<div className="space-y-4">{notifications.map(n => (<div key={n.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-lg bg-card"><div className="flex-1"><p className="font-medium">{n.message}</p><div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1"><span>Created: {new Date(n.created_at).toLocaleString()}</span>{n.expires_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Expires: {new Date(n.expires_at).toLocaleString()}</span>}</div></div><div className="flex gap-2"><Badge variant={n.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleNotificationActive(n.id, n.is_active)}>{n.is_active ? "Active" : "Inactive"}</Badge><Button variant="ghost" size="icon" onClick={() => deleteNotification(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>))}</div>)}</CardContent></Card>
          </TabsContent>

          {/* ============================= SETTINGS ============================= */}
          <TabsContent value="settings" className="mt-0">
            <Card className="border-border"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="font-display">Store Information</CardTitle>{!editingStore && <Button variant="outline" size="sm" onClick={() => setEditingStore(true)}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>}</CardHeader><CardContent className="space-y-4">{editingStore ? (<><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-2"><Label>Store Name</Label><Input value={storeForm.store_name} onChange={e => setStoreForm({ ...storeForm, store_name: e.target.value })} /></div><div className="space-y-2"><Label>WhatsApp Number</Label><Input value={storeForm.whatsapp_number} onChange={e => setStoreForm({ ...storeForm, whatsapp_number: e.target.value })} /></div><div className="space-y-2"><Label>Support Number <span className="text-xs text-primary font-normal">(shown on flyer footer)</span></Label><Input value={storeForm.support_number} onChange={e => setStoreForm({ ...storeForm, support_number: e.target.value })} /></div><div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between gap-4 flex-wrap"><Label>WhatsApp Group / Channel Link</Label><div className="flex items-center gap-2"><Label htmlFor="show-group-icon" className="text-sm text-muted-foreground cursor-pointer">Show join icon on storefront</Label><Switch id="show-group-icon" checked={storeForm.show_whatsapp_group_icon} onCheckedChange={c => setStoreForm({ ...storeForm, show_whatsapp_group_icon: c })} /></div></div><Input value={storeForm.whatsapp_group} onChange={e => setStoreForm({ ...storeForm, whatsapp_group: e.target.value })} placeholder="Paste the WhatsApp link here" /><p className="text-xs text-muted-foreground">{storeForm.show_whatsapp_group_icon ? "✅ A WhatsApp join icon will appear on your storefront." : "❌ The join icon will be hidden."}</p></div><div className="space-y-2"><Label>MoMo Name</Label><Input value={storeForm.momo_name} onChange={e => setStoreForm({ ...storeForm, momo_name: e.target.value })} /></div><div className="space-y-2"><Label>MoMo Number</Label><Input value={storeForm.momo_number} onChange={e => setStoreForm({ ...storeForm, momo_number: e.target.value })} /></div><div className="space-y-2"><Label>MoMo Network</Label><Input value={storeForm.momo_network} onChange={e => setStoreForm({ ...storeForm, momo_network: e.target.value })} placeholder="mtn / airteltigo / telecel" /></div></div><div className="flex gap-2 pt-2"><Button variant="hero" size="sm" onClick={saveStoreInfo} disabled={savingStore}><Save className="h-4 w-4 mr-1" />{savingStore ? "Saving..." : "Save Changes"}</Button><Button variant="outline" size="sm" onClick={() => setEditingStore(false)}>Cancel</Button></div></>) : (<div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">Store Name</p><p className="font-semibold">{store?.store_name}</p></div><div><p className="text-muted-foreground">WhatsApp</p><p className="font-semibold">{store?.whatsapp_number}</p></div><div><p className="text-muted-foreground">Support Number</p><p className="font-semibold">{store?.support_number}</p></div><div><p className="text-muted-foreground">WhatsApp Group</p><p className="font-semibold">{store?.whatsapp_group || "Not set"}</p></div><div><p className="text-muted-foreground">Show Group Icon</p><p className="font-semibold">{store?.show_whatsapp_group_icon !== false ? "Yes (default)" : "No"}</p></div><div><p className="text-muted-foreground">MoMo Name</p><p className="font-semibold">{store?.momo_name}</p></div><div><p className="text-muted-foreground">MoMo Number</p><p className="font-semibold">{store?.momo_number}</p></div><div><p className="text-muted-foreground">MoMo Network</p><p className="font-semibold">{store?.momo_network?.toUpperCase()}</p></div><div className="col-span-2"><p className="text-muted-foreground">Topup Reference</p><p className="font-display text-xl font-bold text-primary">{store?.topup_reference}</p></div></div>)}</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={buyDialogOpen} onOpenChange={v => !v && setBuyDialogOpen(false)}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader><DialogTitle className="font-display text-xl">Buy {buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</DialogTitle><DialogDescription>Purchase data at agent price</DialogDescription></DialogHeader>
          {buyStep === "phone" ? (
            <div className="space-y-4 pt-2"><div className="space-y-2"><Label>Recipient Phone Number</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="tel" placeholder="0XX XXX XXXX" value={buyPhone} onChange={e => setBuyPhone(e.target.value)} className="pl-10" autoFocus /></div></div><Button variant="hero" className="w-full" onClick={() => { if (buyPhone.trim().length < 10) { toast({ title: "Invalid number", variant: "destructive" }); return; } setBuyStep("confirm"); }}>Continue</Button></div>
          ) : (
            <div className="space-y-4 pt-2"><div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Package</span><span className="font-semibold">{buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Phone</span><span className="font-semibold">{buyPhone}</span></div><div className="border-t border-border my-1" /><div className="flex justify-between text-base font-bold"><span>Agent Price</span><span className="text-primary">GH₵ {Number(buyPkg?.agent_price ?? 0).toFixed(2)}</span></div></div>{hasPendingWithdrawal && (<div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-xs text-orange-400">⚠️ You have a pending withdrawal of GH₵ {pendingWithdrawalAmount.toFixed(2)}. Wallet balance after buying must not drop below this amount.</div>)}<div className="space-y-2"><Label>Payment Method</Label><Select value={buyPaymentMethod} onValueChange={v => setBuyPaymentMethod(v as "paystack" | "wallet")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="wallet"><span className="flex items-center gap-2"><Wallet className="h-4 w-4" />Wallet (GH₵ {store?.wallet_balance?.toFixed(2) ?? "0.00"})</span></SelectItem><SelectItem value="paystack"><span className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Paystack (+ charges)</span></SelectItem></SelectContent></Select></div><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setBuyStep("phone")} disabled={buyLoading}>Back</Button><Button variant="hero" className="flex-1" onClick={handleBuyConfirm} disabled={buyLoading}>{buyLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Processing...</> : "Confirm Purchase"}</Button></div></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentDashboard;
