import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { DOMAINS } from "@/config/domains";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  Store, Wifi, Settings, ExternalLink, Copy, BarChart3, ShoppingCart, Save,
  LogOut, Zap, Edit2, Wallet, Phone, CreditCard, Loader2, ArrowDownToLine,
  TrendingUp, Search, Palette, RotateCcw, Bell, Plus, Trash2, Calendar,
  LayoutGrid, Minus, Plus as PlusIcon, Coins, Menu, Image, Download, Share2,
  ChevronDown, ChevronUp, BookOpen, Percent, Users, AlertCircle, ShieldAlert,
  Send, Eye, Upload, FileSpreadsheet, Layers, MessageCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ChatBot from "@/components/ChatBot";
import NotificationPopup from "@/components/NotificationPopup";
import WalletTopupDialog from "@/components/WalletTopupDialog";
import SubagentsList from "@/components/SubagentsList";
import SubagentPricesManager from "@/components/SubagentPricesManager";
import AgentAFAPriceManager from "@/components/AgentAFAPriceManager";
import AgentAFABundleRegistrations from "@/components/AgentAFABundleRegistrations";
import AgentYouTubeSection from "@/components/AgentYouTubeSection";
import ComplaintsManager from "@/components/ComplaintsManager";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";
import { toPng } from "html-to-image";
import NetworkIndicator from "@/components/NetworkIndicator";
import { detectNetwork, phoneMatchesNetwork, isValidPhoneLength } from "@/lib/phoneUtils";

// Helper function to get current order stage
function getOrderStage(order: any): string {
  const elapsed = (Date.now() - new Date(order.created_at).getTime()) / 1000;
  const orderStatus = order.order_status?.toLowerCase().trim() || "";
  // COMMENTED OUT: mashup packages deactivated
  const isMashup = false; // order.network === "mtn_mashup" || order.network === "mashup";
  
  if (isMashup) {
    if (orderStatus === "delivered" || orderStatus === "completed") {
      return "Order Delivered";
    } else if (elapsed >= 5) {
      return "Network Validation";
    } else {
      return "Order Placed";
    }
  } else {
    // Standard networks (time-based)
    if (elapsed >= 300 * 60) {
      return "Order Delivered";
    } else if (elapsed >= 60 * 60) {
      return "Network Validation";
    } else if (elapsed >= 9 * 60) {
      return "Sent to Network";
    } else {
      return "Order Placed";
    }
  }
}

// ==================== INTERFACES ====================
interface AgentStore {
  id: string; user_id?: string; subagent_commission_balance?: number; store_name: string; whatsapp_number: string; support_number: string;
  whatsapp_group: string | null; show_whatsapp_group_icon: boolean; show_ussd_on_storefront: boolean;
  momo_number: string; momo_name: string; momo_network: string; approved: boolean;
  wallet_balance: number; topup_reference: string; store_headline: string;
  tutorial_video_url: string | null; allow_subagent_registration?: boolean;
  theme_config: { primary: string; primary_foreground: string; background: string; card_background: string; gridColumns: number; };
  }
interface DataPackage { id: string; network: string; size_gb: number; price: number; agent_price: number; api_price: number; active: boolean; }
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

const menuItems = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "buy", label: "Buy Data", icon: ShoppingCart },
  { id: "bulk", label: "Bulk Orders", icon: Layers },
  { id: "store", label: "Store Prices", icon: Store },
  { id: "subagents", label: "Subagents", icon: Users },
  { id: "subagent-prices", label: "Subagent Prices", icon: CreditCard },
  { id: "afa", label: "AFA Bundles", icon: Zap },
  { id: "flyer", label: "Flyer Generator", icon: Image },
  // COMMENTED OUT: mashup packages deactivated
  // { id: "mashup-flyer", label: "MTN Mashup Flyer", icon: Zap },
  { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
  { id: "topup", label: "Top Up", icon: Coins },
  { id: "api-key", label: "API Key", icon: Zap },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "complaints", label: "Complaints", icon: AlertCircle },
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
• My Wallet – your wallet balance you can cash out.

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

Note: 10-minute cooldown per phone number to prevent duplicate orders.` },
  {
    icon: "📦", title: "Bulk Orders", content: `Send data to multiple recipients at once using your wallet.

How to use:
1. SELECT NETWORK – Choose MTN, Telecel, or AirtelTigo.
2. RECIPIENTS – Upload a CSV/Excel file OR type manually.
   • Format: phone number followed by GB size, one per line
   • Example: 0241234567 2 (sends 2GB to that number)
3. GLOBAL PACKAGE (Optional) – Set a default GB size for all recipients without specified sizes.
4. Review the summary showing total recipients, total GB, and total cost.
5. Click "Pay with Wallet" to process all orders at once.

Tips:
• CSV/Excel files should have phone numbers in Column A, GB sizes in Column B.
• The system validates phone prefixes for the selected network.
• Results table shows success/failure for each recipient after processing.
• Insufficient wallet balance will prevent processing.` },
  {
    icon: "🏷️", title: "Store Prices", content: `Set what your customers pay on your public store.

• Base Price (Cost) – fixed price you pay. You cannot sell below this.
• Your Selling Price ������������������� set any amount above the base price.
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
    icon: "👥", title: "Subagents", content: `Manage people who sell under your store.

• Subagents are sellers who have their own store but operate under you.
• When a subagent makes a sale, you earn a commission from their profit.
• You can view all your subagents, their store names, and contact info.
• Enable/disable subagent registration from Settings.

Subagent Profit Split:
• When a customer buys from a subagent store:
  - The subagent earns their profit (Selling Price - Base Cost)
  - You earn a commission percentage from that profit
  - Commission rate is set in your settings (default 10%)` },
  {
    icon: "💰", title: "Subagent Prices", content: `Set the base prices your subagents will use.

• Base Price for Subagents – The minimum price your subagents can sell at.
• This is different from your storefront selling price.
• Subagents can set their own selling prices above this base.
• Their profit = Their Selling Price - Your Base Price for them.

Example:
• Your cost (agent price): GH₵ 4.00
• Base price for subagents: GH₵ 4.30
• Subagent sells at: GH₵ 4.50
• Subagent profit: GH₵ 0.20
• Your commission (10%): GH₵ 0.02` },
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
    icon: "📢", title: "Complaints", content: `View and manage customer complaints from your stores.

The Complaints section has two tabs:
• Storefront Complaints – Issues reported from your main storefront.
• Agent Store Complaints – Issues reported from your subagent stores.

For subagent store complaints, you'll see:
• The subagent store name
• The subagent's contact number
• Order details and customer info

Important: All complaints sent to your storefront and subagent stores are automatically forwarded to admin for resolution. You can track their status here.` },
  {
    icon: "📜", title: "Rules", content: `Before making an order, make sure you are not owing airtime, MoMo, or bundles.
You cannot make an order for the same number when the first order has not been delivered (either from our site or other sites) – this can override your previous order.
Before bringing a report from a customer to the admin, make sure to ask them the questions above before reporting.` },
];

// ==================== MAIN COMPONENT ====================
const AgentDashboard = () => {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  // Check if admin is impersonating
  const [isImpersonating] = useState(() => !!localStorage.getItem("admin_impersonate_agent"));
  const [impersonatedUserId] = useState<string | null>(() => localStorage.getItem("admin_impersonate_agent"));

  const exitImpersonation = () => {
    localStorage.removeItem("admin_impersonate_agent");
    window.location.href = "/admin";
  };

  const [store, setStore] = useState<AgentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [storeBalance, setStoreBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [transferRecipients, setTransferRecipients] = useState<any[]>([]);
  const [subagentOrdersCount, setSubagentOrdersCount] = useState(0);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [subagentProfitForAgent, setSubagentProfitForAgent] = useState(0);
  const [subagents, setSubagents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [savingPrices, setSavingPrices] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [storeForm, setStoreForm] = useState({
  store_name: "", whatsapp_number: "", support_number: "",
  whatsapp_group: "", show_whatsapp_group_icon: true, show_ussd_on_storefront: true,
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
  const [withdrawSource, setWithdrawSource] = useState<"wallet" | "subagent_commission">("wallet");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const [createNewRecipient, setCreateNewRecipient] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<any>(null);
  const [recipientName, setRecipientName] = useState("");
  const [mobileNetwork, setMobileNetwork] = useState("mtn");
  const [mobileNumber, setMobileNumber] = useState("");
  const [showTopupDialog, setShowTopupDialog] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupHistory, setTopupHistory] = useState<{ id: string; amount: number; paystack_reference: string | null; created_at: string; source: string }[]>([]);
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
  const [afaTabActive, setAfaTabActive] = useState("pricing");
  const [manualOpen, setManualOpen] = useState(false);
  const [openManualSection, setOpenManualSection] = useState<number | null>(null);
  const [markupPercent, setMarkupPercent] = useState("");
  
  // Notifications to subagents
  const [subagentNotificationMsg, setSubagentNotificationMsg] = useState("");
  const [sendingSubagentNotification, setSendingSubagentNotification] = useState(false);
  const [subagentNotifications, setSubagentNotifications] = useState<any[]>([]);
  
  // Bulk Orders
  const [bulkNetwork, setBulkNetwork] = useState<"mtn" | "telecel" | "airteltigo">("mtn");
  const [bulkRecipients, setBulkRecipients] = useState("");
  const [bulkGlobalSize, setBulkGlobalSize] = useState<number | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ phone: string; size: number; status: string; error?: string }[]>([]);
  
  // API Key
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [wallet, setWallet] = useState<number>(0);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [loadingApiKey, setLoadingApiKey] = useState(true);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [agentPrices, setAgentPrices] = useState<Record<string, number>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({});
  const [subagentBasePrices, setSubagentBasePrices] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination and date filtering
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 50; // Changed from 100 to 50 for "Load More" functionality
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week" | "month" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

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
  const effectiveBalance = Math.max(0, profitStats.availableForWithdrawal - pendingWithdrawalAmount);

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

  // ─── total profit from ALL DB orders (including subagent orders) ────────────────────────────────────
  const fetchTotalProfit = async () => {
    if (!store?.id) return;
    
    // First, fetch the agent's custom base prices from admin (if any)
    const { data: customBasePrices } = await supabase
      .from("agent_custom_base_prices")
      .select("package_id, custom_base_price")
      .eq("agent_store_id", store.id);
    
    const agentCustomBasePriceMap: Record<string, number> = {};
    (customBasePrices || []).forEach((p: any) => {
      if (p.custom_base_price) agentCustomBasePriceMap[p.package_id] = p.custom_base_price;
    });
    
    // Fetch direct orders (orders from agent's storefront - NOT subagent orders)
    const { data: directOrders, error: directError } = await supabase
      .from("orders")
      .select("amount, package_id, subagent_store_id, selling_price, base_price, profit")
      .eq("agent_store_id", store.id)
      .is("subagent_store_id", null)
      .in("status", ["paid", "completed"])
      .range(0, 99999);
    
    if (directError) {
      console.error("Error fetching profit sum:", directError);
      return;
    }
    
    // Fetch subagent orders (orders from subagent storefronts that belong to this agent)
    const { data: subagentStoreIds } = await supabase
      .from("subagent_stores")
      .select("id")
      .eq("agent_store_id", store.id);
    
    const subagentIds = (subagentStoreIds || []).map(s => s.id);
    
    let subagentOrders: any[] = [];
    if (subagentIds.length > 0) {
      const { data: subOrders } = await supabase
        .from("orders")
        .select("amount, package_id, subagent_store_id, selling_price, base_price, profit")
        .in("subagent_store_id", subagentIds)
        .in("status", ["paid", "completed"])
        .range(0, 99999);
      subagentOrders = subOrders || [];
    }
    
    let directRevenue = 0, directProfit = 0, subagentRevenue = 0, subagentProfit = 0;
    
    // Calculate profit from direct orders using STORED VALUES
    // Use stored selling_price/base_price/profit if available, fallback to dynamic calc for old orders
    for (const order of directOrders || []) {
      const storedSellPrice = order.selling_price;
      const storedProfit = order.profit;
      
      if (storedSellPrice && storedSellPrice > 0 && storedProfit !== null && storedProfit !== undefined) {
        // Use stored values - these are permanent
        directRevenue += Number(storedSellPrice);
        directProfit += Number(storedProfit);
      } else {
        // Fallback for old orders without stored prices
        directRevenue += Number(order.amount);
        const pkg = packages.find(p => p.id === order.package_id);
        if (pkg) {
          const agentCost = agentCustomBasePriceMap[order.package_id] || pkg.agent_price;
          directProfit += (Number(order.amount) - agentCost);
        }
      }
    }
    
    // For subagent orders, we use the stored subagent_commission_balance from agent_stores
    // This is the PERMANENT value that gets updated when subagent sales happen
    // Don't calculate dynamically - just use what's in the database
    const storedSubagentCommission = Number(store?.subagent_commission_balance ?? 0);
    
    // Revenue from subagent orders - use stored values
    for (const order of subagentOrders) {
      // Add revenue from subagent orders using stored selling_price if available
      const orderRevenue = order.selling_price && order.selling_price > 0 
        ? Number(order.selling_price) 
        : Number(order.amount);
      subagentRevenue += orderRevenue;
    }
    
    const totalRevenue = directRevenue + subagentRevenue;
    // Total profit = direct profit from own orders + stored subagent commission from database
    const combinedProfit = directProfit + storedSubagentCommission;
    
    setProfitStats({
      totalRevenue,
      totalCost: 0, // Not needed anymore
      totalProfit: combinedProfit,
      availableForWithdrawal: Number(store?.wallet_balance ?? 0), // Use stored wallet balance
    });
    
    // Also store the subagent profit separately for display (from database)
    setSubagentProfitForAgent(storedSubagentCommission);
  };

  const refetchStoreData = async () => {
    console.log("[v0] refetchStoreData called - fetching fresh store data from database");
    const effectiveUserId = impersonatedUserId || user?.id;
    if (!effectiveUserId) {
      console.error("[v0] No user ID available for refetch");
      return;
    }
    try {
      const { data: sd, error } = await supabase.from("agent_stores").select("*").eq("user_id", effectiveUserId).maybeSingle();
      if (error) {
        console.error("[v0] Error refetching store:", error);
        return;
      }
      if (sd) {
        console.log("[v0] Store refetched successfully:", { id: sd.id, afa_bundle_price: sd.afa_bundle_price });
        setStore(sd as AgentStore);
      }
    } catch (err) {
      console.error("[v0] Exception refetching store:", err);
    }
  };

  // Fetch existing API key for agent
  const fetchApiKey = async (storeId: string) => {
    try {
      setLoadingApiKey(true);
      console.log("[v0] Fetching API key for store:", storeId);
      
      const { data, error } = await supabase
        .from("api_users")
        .select("api_key, wallet")
        .eq("identity_id", storeId)
        .eq("is_agent", true)
        .maybeSingle();
      
      console.log("[v0] API key fetch response:", { data, error });
      
      if (error && error.code !== "PGRST116") {
        console.error("[v0] Error fetching API key:", error);
      }
      
      if (data) {
        console.log("[v0] API user data found, setting state:", data);
        setApiKey(data.api_key || null);
        setWallet(data.wallet || 0);
      } else {
        console.log("[v0] No API user data found for store");
        setApiKey(null);
        setWallet(0);
      }
    } catch (err) {
      console.error("[v0] Exception fetching API key:", err);
      setApiKey(null);
      setWallet(0);
    } finally {
      setLoadingApiKey(false);
    }
  };

  // Generate API key directly with Supabase (allows regeneration)
  const handleGenerateApiKey = async () => {
    const effectiveUserId = impersonatedUserId || user?.id;
    if (!effectiveUserId) return;
    setGeneratingApiKey(true);
    try {
      console.log("[v0] Generating API key for user:", effectiveUserId);
      
      // Generate a new API key using Web Crypto API
      const array = new Uint8Array(32);
      globalThis.crypto.getRandomValues(array);
      const apiKey = 'pk_live_' + Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      console.log("[v0] Generated API key:", apiKey.substring(0, 20) + "...");
      
      // First, fetch existing API user record to preserve wallet balance
      const { data: existingData } = await supabase
        .from("api_users")
        .select("wallet")
        .eq("identity_id", effectiveUserId)
        .maybeSingle();
      
      const existingWallet = existingData?.wallet || 0;
      
      // Upsert the API user record, preserving wallet balance
      const upsertData: any = {
        identity_id: effectiveUserId,
        api_key: apiKey,
        is_agent: true,
        is_user: false,
        wallet: existingWallet,
        updated_at: new Date().toISOString(),
      };
      
      // Add role field - the database trigger requires it
      upsertData.role = 'agent';
      
      console.log("[v0] Upserting with data:", { ...upsertData, api_key: '****' });
      
      const { data, error } = await supabase
        .from("api_users")
        .upsert(upsertData, {
          onConflict: 'identity_id'
        })
        .select()
        .single();
      
      console.log("[v0] Upsert result:", { data, error });
      
      if (error) {
        console.error("[v0] Error upserting API key:", error);
        let errorMsg = error.message || "Failed to generate API key";
        if (error.message && error.message.includes("row-level security")) {
          errorMsg = "RLS policy needs to be configured. Please contact admin.";
        }
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
      } else {
        setApiKey(apiKey);
        setWallet(data?.wallet || 0);
        setShowRegenerateConfirm(false);
        toast({ title: "Success", description: apiKey ? "API key regenerated successfully" : "API key generated successfully", variant: "default" });
      }
    } catch (err) {
      console.error("[v0] Error generating API key:", err);
      toast({ title: "Error", description: "Failed to generate API key", variant: "destructive" });
    } finally {
      setGeneratingApiKey(false);
    }
  };

  // Copy API key to clipboard
  const handleCopyApiKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    toast({ title: "Copied", description: "API key copied to clipboard", variant: "default" });
  };

  const fetchAllData = async () => {
    const effectiveUserId = impersonatedUserId || user?.id;
    if (!effectiveUserId) return;
    const { data: sd, error: se } = await supabase.from("agent_stores").select("*").eq("user_id", effectiveUserId).maybeSingle();
    if (se) { console.error(se); setLoading(false); return; }
  if (sd) {
  if (sd.show_whatsapp_group_icon == null) { sd.show_whatsapp_group_icon = true; await supabase.from("agent_stores").update({ show_whatsapp_group_icon: true }).eq("id", sd.id); }
  if (sd.show_ussd_on_storefront == null) { sd.show_ussd_on_storefront = true; await supabase.from("agent_stores").update({ show_ussd_on_storefront: true }).eq("id", sd.id); }
  if (!sd.store_headline) { sd.store_headline = `Get the best data deals from ${sd.store_name}. Select your network and package below`; await supabase.from("agent_stores").update({ store_headline: sd.store_headline }).eq("id", sd.id); }
      setStore(sd as AgentStore);
      setStoreHeadline(sd.store_headline || "");
      fetchApiKey(effectiveUserId);
      if (sd.theme_config) setThemeColors({ ...DEFAULT_THEME, ...sd.theme_config });
      else { await supabase.from("agent_stores").update({ theme_config: DEFAULT_THEME }).eq("id", sd.id); setThemeColors(DEFAULT_THEME); }
  setStoreForm({
  store_name: sd.store_name, whatsapp_number: sd.whatsapp_number,
  support_number: sd.support_number, whatsapp_group: sd.whatsapp_group || "",
  show_whatsapp_group_icon: sd.show_whatsapp_group_icon ?? true,
  show_ussd_on_storefront: sd.show_ussd_on_storefront ?? true,
  momo_number: sd.momo_number, momo_name: sd.momo_name, momo_network: sd.momo_network,
  });

      const [pkgR, priceR, orderR, payoutR, subagentR, customBasePriceR, subagentPriceR, specialMTNR, recipientsR] = await Promise.all([
        supabase.from("data_packages").select("*").order("size_gb"),
        supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", sd.id),
        supabase.from("orders").select("*", { count: "exact" }).eq("agent_store_id", sd.id).order("created_at", { ascending: false }).range(0, 99999),
        supabase.from("payout_requests").select("*, transfer_recipients(account_holder_name, mobile_money_network, mobile_money_number, account_number, bank_name, provider_type)").eq("requester_id", sd.id).order("created_at", { ascending: false }),
        supabase.from("subagent_stores").select("*").eq("agent_store_id", sd.id).order("created_at", { ascending: false }),
        supabase.from("agent_custom_base_prices").select("package_id, custom_base_price").eq("agent_store_id", sd.id),
        supabase.from("subagent_package_prices").select("package_id, base_price").eq("agent_store_id", sd.id),
        supabase.from("agent_special_mtn_mashup_pricing").select("tier_1_price, tier_2_price, tier_3_price, tier_4_price").eq("agent_id", effectiveUserId).maybeSingle(),
        supabase.from("transfer_recipients").select("*").eq("user_id", effectiveUserId).eq("status", "active").order("created_at", { ascending: false }),
      ]);

      // Apply custom base prices set by admin - override agent_price with custom_base_price
      const customPriceMap: Record<string, number> = {};
      (customBasePriceR.data ?? []).forEach((p: any) => { customPriceMap[p.package_id] = p.custom_base_price; });
      
      const pkgs = (pkgR.data ?? []).map((pkg: any) => ({
        ...pkg,
        agent_price: customPriceMap[pkg.id] ?? pkg.agent_price, // Use custom base price if set by admin
      }));
      setPackages(pkgs);
      const pm: Record<string, number> = {};
      (priceR.data ?? []).forEach((p: any) => { pm[p.package_id] = p.sell_price; });
      setAgentPrices(pm);
      const subPm: Record<string, number> = {};
      (subagentPriceR.data ?? []).forEach((p: any) => { subPm[p.package_id] = p.base_price; });
      setSubagentBasePrices(subPm);
      
      const os = (orderR.data as Order[]) ?? [];
      // Store the exact total order count from Supabase (not just the fetched data length)
      setTotalOrderCount(orderR.count ?? os.length);
      
      // Enrich mtn_mashup and mashup orders with size_gb_text and data_package_id
      const enrichedOrders = await Promise.all(os.map(async (order: any) => {
        if ((order.network === "mtn_mashup" || order.network === "mashup") && order.package_id) {
          const { data: pkg } = await supabase.from("data_packages").select("size_gb_text, data_package_id").eq("id", order.package_id).single();
          return { ...order, size_gb_text: pkg?.size_gb_text, data_package_id: pkg?.data_package_id };
        }
        return order;
      }));
      setOrders(enrichedOrders);
      const payoutData = (payoutR.data ?? []).map((p: any) => {
        const recipientDetails = p.transfer_recipients || {};
        return {
          ...p,
          id: p.id,
          amount: p.amount,
          created_at: p.created_at,
          status: p.status,
          account_holder_name: recipientDetails.account_holder_name || "Unknown",
          provider_type: recipientDetails.provider_type,
          mobile_money_network: recipientDetails.mobile_money_network,
          mobile_money_number: recipientDetails.mobile_money_number,
          account_number: recipientDetails.account_number,
          bank_name: recipientDetails.bank_name,
          transfer_code: p.transfer_code,
        };
      });
      setWithdrawals(payoutData);
      setTransferRecipients(recipientsR.data ?? []);
      const subags = subagentR.data ?? [];
      setSubagents(subags);
    
    // Fetch topup history
    const { data: topups } = await supabase
      .from("wallet_topups")
      .select("id, amount, paystack_reference, created_at")
      .eq("agent_store_id", sd.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTopupHistory((topups || []).map(t => ({ ...t, source: t.paystack_reference ? "Paystack" : "Admin" })));
    
    // Fetch subagent orders count
    const subagentIds = subags.map((s: any) => s.id);
    if (subagentIds.length > 0) {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("subagent_store_id", subagentIds);
      setSubagentOrdersCount(count || 0);
    } else {
      setSubagentOrdersCount(0);
    }
    
    // Don't set availableForWithdrawal here - let fetchTotalProfit calculate it based on actual profit

      const slug = sd.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const url = DOMAINS.getAgentStoreUrl(sd.store_name);
      const ussdText = sd.topup_reference ? `\n\n📲 USSD: *380*455#\n🔑 Access Code: ${sd.topup_reference}` : "";
      setShareText(
        `🔥 Get the BEST data deals from *${sd.store_name}*!\n\n` +
        `📱 MTN • AirtelTigo • Telecel\n` +
        `⚡ Instant delivery • 24/7 Support${ussdText}\n\n` +
        `🛒 Shop now: ${url}\n` +
        `📞 Contact: ${sd.support_number}`
      );
      await fetchTotalProfit();
    } else {
          const { data: pkgData } = await supabase.from("data_packages").select("*").order("size_gb");
      setPackages(pkgData ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { if (user || isImpersonating) fetchAllData(); }, [user, isImpersonating, impersonatedUserId]);

  // Subscribe to real-time changes in agent_stores for bundle price and other updates
  useEffect(() => {
    if (!store?.id) {
      console.log('[v0] No store ID yet, subscription not set up:', store?.id);
      return;
    }

    console.log('[v0] Setting up realtime subscription for store:', store.id);
    const subscription = supabase
      .channel(`agent_stores_${store.id}_dashboard_updates`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_stores',
          filter: `id=eq.${store.id}`,
        },
        (payload) => {
          console.log('[v0] Agent store updated via realtime for store', store.id, ':', payload);
          if (payload.new) {
            console.log('[v0] Updating store state with new data from realtime:', payload.new);
            setStore(prev => prev ? { ...prev, ...payload.new } : null);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[v0] Subscription status for store', store.id, ':', status, err);
      });

    return () => {
      console.log('[v0] Unsubscribing from realtime channel for store', store.id);
      subscription.unsubscribe();
    };
  }, [store?.id]);

  // Subscribe to real-time package changes for instant price updates
  useEffect(() => {
    const channel = supabase
      .channel('agent_dashboard_packages_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'data_packages',
        },
        (payload) => {
          console.log('[v0] Agent dashboard received package update:', payload);
          
          if (payload.eventType === 'UPDATE') {
            setPackages((prev) =>
              prev.map((pkg) =>
                pkg.id === payload.new.id
                  ? { ...pkg, ...payload.new }
                  : pkg
              ).sort((a, b) => a.size_gb - b.size_gb)
            );
          } else if (payload.eventType === 'INSERT') {
            setPackages((prev) => 
              [...prev, payload.new as any].sort((a, b) => a.size_gb - b.size_gb)
            );
          } else if (payload.eventType === 'DELETE') {
            setPackages((prev) => prev.filter((pkg) => pkg.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('[v0] Agent dashboard packages realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  // Check for pending wallet topup from URL params or sessionStorage
  useEffect(() => {
    if (!store?.id) return;
    
    // Check URL params first (Paystack redirects back with reference in URL)
    const urlParams = new URLSearchParams(window.location.search);
    const urlRef = urlParams.get("reference") || urlParams.get("trxref");
    const sessionRef = sessionStorage.getItem("pending_wallet_topup");
    const ref = urlRef || sessionRef;
    
    if (!ref) return;
    
    // Clear URL params
    if (urlRef) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    supabase.functions.invoke("verify-payment", { body: { reference: ref } })
      .then(({ data, error }) => {
        if (data?.success && !data?.already_processed) {
          toast({ title: "Wallet topped up!", description: data.message });
          fetchAllData();
        } else if (data?.already_processed) {
          fetchAllData();
        }
        sessionStorage.removeItem("pending_wallet_topup");
      })
      .catch(() => {
        sessionStorage.removeItem("pending_wallet_topup");
      });
  }, [store?.id]);

  // Realtime subscriptions DISABLED - No longer auto-refresh on changes
  // Previously this would trigger fetchAllData() on any database updates (orders, prices, withdrawals, etc.)
  // This was causing constant page refreshes that interfered with user edits and was very annoying
  // Users can now manually refresh with Cmd+R / Ctrl+R or the browser refresh button
  useEffect(() => {
    if (!store?.id) return;
    
    // This effect is kept but doesn't do anything - realtime subscriptions are disabled
    // If you want to re-enable realtime notifications for critical events like order receipts,
    // you can uncomment the channel subscriptions below, but keep fetchAllData() calls commented out
    
    return () => {
      // Cleanup code would go here if subscriptions were active
    };
  }, [store?.id, subagents]);

  // Auto-refresh DISABLED - Users can manually refresh with browser refresh button
  // Previously this would auto-refresh wallet balance, commission balance, and orders every 1 second
  // This was disabled because it was causing unnecessary page updates and was annoying when users were editing data
  // Users can still manually refresh the page with Cmd+R / Ctrl+R or use the browser's refresh button

  useEffect(() => {
    if (orders.length > 0 && packages.length > 0) fetchTotalProfit();
  }, [orders, packages]);

  // Listen for AFA pricing tab switch events
  useEffect(() => {
    const handleSwitchToAFAPricing = () => {
      setActiveTab("afa");
      setAfaTabActive("pricing");
    };

    window.addEventListener("switchToAFAPricingTab", handleSwitchToAFAPricing);
    return () => window.removeEventListener("switchToAFAPricingTab", handleSwitchToAFAPricing);
  }, []);

  const fetchNotifications = async () => {
    if (!store?.id) return; 
    setLoadingNotifications(true);
    const { data, error } = await supabase
      .from("agent_notifications")
      .select("*")
      .eq("agent_store_id", store.id)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[v0] Error fetching notifications:", error);
    } else if (data) {
      setNotifications(data as Notification[]);
    }
    setLoadingNotifications(false);
  };
  useEffect(() => { 
    if (store?.id) fetchNotifications(); 
  }, [store?.id]);

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

  // Subagent Notifications (agent to their subagents)
  const fetchSubagentNotifications = async () => {
    if (!store?.id) return;
    const { data, error } = await supabase
      .from("agent_to_subagent_notifications")
      .select("*")
      .eq("agent_store_id", store.id)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("[v0] Error fetching subagent notifications:", error);
    } else if (data) {
      setSubagentNotifications(data);
    }
  };
  useEffect(() => { 
    if (store?.id) fetchSubagentNotifications(); 
  }, [store?.id]);

  const sendSubagentNotification = async () => {
    if (!store?.id || !subagentNotificationMsg.trim()) {
      toast({ title: "Error", description: "Please enter a message", variant: "destructive" });
      return;
    }
    setSendingSubagentNotification(true);
    const { error } = await supabase.from("agent_to_subagent_notifications").insert({
      agent_store_id: store.id,
      message: subagentNotificationMsg.trim(),
      is_active: true,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notification sent to all subagents!" });
      setSubagentNotificationMsg("");
      fetchSubagentNotifications();
    }
    setSendingSubagentNotification(false);
  };

  const deleteSubagentNotification = async (id: string) => {
    const { error } = await supabase.from("agent_to_subagent_notifications").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else fetchSubagentNotifications();
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
  const handlePriceChange = (id: string, v: string) => {
    // Allow empty string for clearing the box - store as string for display
    setEditedPrices(p => ({ ...p, [id]: v === "" ? "" : (parseFloat(v) || v) }));
  };
  const savePrices = async () => {
    if (!store) return; setSavingPrices(true);
    try {
      for (const [id, sp] of Object.entries(editedPrices)) {
        const pkg = packages.find(p => p.id === id); if (!pkg) continue;
        const numPrice = typeof sp === "string" ? parseFloat(sp) : sp;
        if (isNaN(numPrice) || numPrice <= 0) { toast({ title: "Invalid price", variant: "destructive" }); setSavingPrices(false); return; }
        if (numPrice < pkg.agent_price) { toast({ title: "Price below cost", variant: "destructive" }); setSavingPrices(false); return; }
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
    const currentNetworkPackages = packages.filter(p => {
                // COMMENTED OUT: mashup packages deactivated
                if (false && networkFilter === "mtn_mashup") {
                  return p.network === "mtn_mashup" || p.network === "mashup";
      }
      return p.network === networkFilter;
    });
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
  show_ussd_on_storefront: storeForm.show_ussd_on_storefront,
  momo_number: storeForm.momo_number, momo_name: storeForm.momo_name, momo_network: storeForm.momo_network,
  }).eq("id", store.id);
  if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  else { setStore({ ...store, ...storeForm, whatsapp_group: storeForm.whatsapp_group || null }); setEditingStore(false); toast({ title: "Store updated!" }); }
  setSavingStore(false);
  };

  const openBuyDialog = (pkg: DataPackage) => { 
    console.log('[v0] Opening buy dialog with package:', pkg);
    setBuyPkg(pkg); 
    setBuyPhone(""); 
    setBuyStep("phone"); 
    setBuyPaymentMethod("wallet"); 
    setBuyDialogOpen(true); 
  };

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
      // Extract size_gb the same way verify-payment does: match first numeric value
      const packageName = buyPkg.size_gb_text || buyPkg.size_gb?.toString() || "";
      const sizeMatch = packageName.toString().match(/(\d+(?:\.\d+)?)/);
      const extractedSize = sizeMatch ? parseFloat(sizeMatch[1]) : buyPkg.size_gb;
      
      // For mashup packages, get datahubnet ID from the hardcoded mapping
      let dataPackageId = undefined;
      console.log("[v0] Wallet purchase - buyPkg details:", { network: buyPkg.network, size_gb_text: buyPkg.size_gb_text, size_gb: buyPkg.size_gb, allKeys: Object.keys(buyPkg) });
      if (buyPkg.network === "mashup" && buyPkg.size_gb_text) {
        // Map size_gb_text to datahubnet ID
        const mashupMapping: Record<string, number> = {
          "1.7GB": 14,
          "5.1GB": 3,
          "2.6 GB + 1,077 mins": 16,
          "8.2GB": 17,
          "11.9GB": 18,
          "3.61GB + 1485Mins": 20,
          "15.3GB": 19,
        };
        dataPackageId = mashupMapping[buyPkg.size_gb_text];
        console.log("[v0] Mashup mapping lookup - size_gb_text:", buyPkg.size_gb_text, "result:", dataPackageId);
      } else {
        console.log("[v0] Not a mashup or missing size_gb_text - network:", buyPkg.network);
      }
      
      const { data: od, error: oe } = await supabase.from("orders").insert({ 
        customer_number: buyPhone.trim(), 
        network: buyPkg.network, 
        size_gb: extractedSize, 
        amount: ap, 
        package_id: buyPkg.id, 
        agent_store_id: store.id, 
        status: "paid", 
        fulfillment_status: "pending", 
        payment_method: "wallet"
      }).select("id").single();
      if (oe) { toast({ title: "Order error", description: oe.message, variant: "destructive" }); setBuyLoading(false); return; }
      console.log("[v0] Wallet order created, invoking fulfill-order for order:", od.id, "network:", buyPkg.network, "dataPackageId:", dataPackageId);
      const { data: fulfillData, error: fulfillError } = await supabase.functions.invoke("fulfill-order", { body: { order_id: od.id, data_package_id: dataPackageId } });
      if (fulfillError) { console.log("[v0] Fulfill-order error:", fulfillError); toast({ title: "Fulfillment error", description: fulfillError.message || "Order created but fulfillment failed", variant: "destructive" }); }
      setStore({ ...store, wallet_balance: Number(store.wallet_balance) - ap });
      toast({ title: "Order placed!" }); setBuyDialogOpen(false);
      fetchAllData();
    } else {
      try {
        const email = user?.email || `agent-${store.id}@datapluggh.com`;
        const total = Math.round((ap + (ap * 1.95 / 100)) * 100) / 100;
        const { data, error } = await supabase.functions.invoke("initialize-payment", { body: { email, amount: total, phone: buyPhone.trim(), callback_url: `${window.location.origin}/agent?payment=verifying`, metadata: { package_id: buyPkg.id, network: buyPkg.network, package_name: `${(buyPkg as any).mins ? (buyPkg as any).mins + " mins + " : ""}${(buyPkg.network === "mtn_mashup" || buyPkg.network === "mashup") ? buyPkg.size_gb_text : buyPkg.size_gb + "GB"}`, agent_store_id: store.id, payment_method: "paystack", use_agent_price: true, ...((buyPkg.network === "mtn_mashup" || buyPkg.network === "mashup") ? { sizeGbText: buyPkg.size_gb_text, data_package_id: (buyPkg as any).data_package_id } : {}) } } });
        if (error) throw error;
        if (data?.authorization_url) window.location.href = data.authorization_url; else throw new Error(data?.error || "Failed to initialize payment");
      } catch (e: any) { toast({ title: "Payment Error", description: e.message, variant: "destructive" }); }
    }
    setBuyLoading(false);
  };

  const handleDeleteRecipient = async (recipientCode: string) => {
    if (!window.confirm("Are you sure you want to delete this recipient? This action cannot be undone.")) {
      return;
    }
    try {
      const { error } = await supabase
        .from("transfer_recipients")
        .delete()
        .eq("recipient_code", recipientCode);
      
      if (error) throw error;
      
      toast({ title: "Recipient deleted successfully" });
      setTransferRecipients(transferRecipients.filter(r => r.recipient_code !== recipientCode));
      if (selectedRecipient === recipientCode) {
        setSelectedRecipient("");
      }
    } catch (error: any) {
      toast({ title: "Failed to delete recipient", description: error.message, variant: "destructive" });
    }
  };

  const handleEditRecipient = (recipient: any) => {
    setEditingRecipient(recipient);
    setRecipientName(recipient.account_holder_name);
    setMobileNetwork(recipient.mobile_money_network || "mtn");
    setMobileNumber(recipient.mobile_money_number);
    setCreateNewRecipient(true);
  };

  const handleSaveEditedRecipient = async () => {
    if (!recipientName.trim() || !mobileNumber.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from("transfer_recipients")
        .update({
          account_holder_name: recipientName,
          mobile_money_network: mobileNetwork,
          mobile_money_number: mobileNumber,
        })
        .eq("recipient_code", editingRecipient.recipient_code);
      
      if (error) throw error;
      
      toast({ title: "Recipient updated successfully" });
      setTransferRecipients(transferRecipients.map(r => 
        r.recipient_code === editingRecipient.recipient_code 
          ? { ...r, account_holder_name: recipientName, mobile_money_network: mobileNetwork, mobile_money_number: mobileNumber }
          : r
      ));
      setEditingRecipient(null);
      setRecipientName("");
      setMobileNetwork("mtn");
      setMobileNumber("");
      setCreateNewRecipient(false);
    } catch (error: any) {
      toast({ title: "Failed to update recipient", description: error.message, variant: "destructive" });
    }
  };

  const handleWithdraw = async () => {
    if (!store) return;
    if (hasPendingWithdrawal) { toast({ title: "Pending withdrawal exists", variant: "destructive" }); return; }
    
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 15) { toast({ title: "Minimum withdrawal is GH₵ 15.00", variant: "destructive" }); return; }
    
    const availableBalance = withdrawSource === "subagent_commission" 
      ? Number(store.subagent_commission_balance ?? 0) 
      : Number(store.wallet_balance ?? 0);
    
    if (amt > availableBalance) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    
    // Validate recipient selection or new recipient creation
    if (!createNewRecipient && !selectedRecipient) { 
      toast({ title: "Select a recipient", variant: "destructive" }); 
      return; 
    }
    
    // Validate new recipient form if creating new
    if (createNewRecipient) {
      if (transferRecipients.length >= 4) { 
        toast({ title: "Maximum 4 recipients allowed", variant: "destructive" }); 
        return; 
      }
      if (!recipientName.trim()) { toast({ title: "Enter recipient name", variant: "destructive" }); return; }
      if (!mobileNumber.trim()) { toast({ title: "Enter mobile number", variant: "destructive" }); return; }
    }
    
    setWithdrawLoading(true);
    try {
      // Calculate tiered fee: below 100 = 5%, 100+ = 1.5%
      const feePercentage = amt < 100 ? 0.05 : 0.015;
      const amountAfterFee = amt * (1 - feePercentage);
      
      const payload: any = {
        requester_type: "agent",
        requester_id: store.id,
        amount: amountAfterFee, // Send fee-deducted amount to edge function
        original_amount: amt, // Track original amount for records
        fee_percentage: feePercentage * 100, // Store fee percentage for records
        withdrawal_source: withdrawSource === "subagent_commission" ? "subagent_commission_balance" : "wallet_balance",
      };

      // If creating new recipient, include recipient details (only mobile money)
      if (createNewRecipient) {
        payload.recipient_details = {
          account_holder_name: recipientName,
          provider_type: "mobile_money",
          mobile_money_network: mobileNetwork,
          mobile_money_number: mobileNumber,
        };
      } else {
        // Use existing recipient
        payload.recipient_id = selectedRecipient;
      }

      // Get valid Supabase session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("Authentication failed. Please log in again.");
      }

      // The payout edge function authorizes the store against the authenticated
      // session user (token). During admin impersonation the displayed `store`
      // belongs to another agent, so we must resolve and use the store owned by
      // the actual logged-in user to keep the request valid and self-consistent.
      const authUserId = session.user.id;
      let requesterStoreId = store.id;
      if (store.user_id && store.user_id !== authUserId) {
        const { data: ownStore, error: ownStoreError } = await supabase
          .from("agent_stores")
          .select("id, wallet_balance, subagent_commission_balance")
          .eq("user_id", authUserId)
          .single();
        if (ownStoreError || !ownStore) {
          throw new Error("Your agent store could not be found for this account.");
        }
        requesterStoreId = ownStore.id;
        const ownAvailable = withdrawSource === "subagent_commission"
          ? Number(ownStore.subagent_commission_balance ?? 0)
          : Number(ownStore.wallet_balance ?? 0);
        if (amt > ownAvailable) {
          throw new Error("Insufficient balance in your store for this withdrawal.");
        }
      }
      payload.requester_id = requesterStoreId;

      const response = await fetch(
        "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request",
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Withdrawal failed");
      }

      toast({ title: "Transfer Sent!", description: `GH₵ ${amountAfterFee.toFixed(2)} sent instantly (after 5% fee)` });
      setWithdrawAmount("");
      setSelectedRecipient("");
      setCreateNewRecipient(false);
      setRecipientName("");
      setMobileNumber("");
      // Wait a moment for the database to sync, then refresh
      setTimeout(() => fetchAllData(), 1000);
    } catch (error: any) {
      console.error("[v0] Withdrawal error:", error);
      toast({ title: "Withdrawal failed", description: error.message, variant: "destructive" });
    } finally {
      setWithdrawLoading(false);
    }
  };

  // ==================== FLYER FUNCTIONS ====================
  const getFlyerPrice = (pkg: DataPackage) => agentPrices[pkg.id] ?? pkg.price;
  const getMtnPkgs = () => MTN_SIZES.map(s => { const p = packages.find(x => x.network === "mtn" && x.size_gb === s); return p ? { size: s, price: getFlyerPrice(p) } : null; }).filter(Boolean) as { size: number; price: number }[];
  const getAirtelPkgs = () => AIRTEL_SIZES.map(s => { const p = packages.find(x => (x.network === "airteltigo" || x.network === "atbigtime" || x.network === "atbigshare") && x.size_gb === s); return p ? { size: s, price: getFlyerPrice(p) } : null; }).filter(Boolean) as { size: number; price: number }[];
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
  
  // Paystack wallet top up
  const handlePaystackTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount < 1) {
      toast({ title: "Invalid amount", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!user?.email || !store?.id) {
      toast({ title: "Error", description: "Please log in to top up", variant: "destructive" });
      return;
    }
    
    setTopupLoading(true);
    try {
      const res = await supabase.functions.invoke("initialize-payment", {
        body: {
          amount,
          email: user.email,
          phone: store.support_number || store.whatsapp_number || "0000000000",
          callback_url: `${window.location.origin}/agent`,
          metadata: {
            type: "wallet_topup",
            agent_store_id: store.id,
            amount
          }
        }
      });
      
      if (res.error) throw new Error(res.error.message);
      if (!res.data?.authorization_url) throw new Error("No authorization URL");
      
      sessionStorage.setItem("pending_wallet_topup", res.data.reference);
      window.location.href = res.data.authorization_url;
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    } finally {
      setTopupLoading(false);
    }
  };
  
  // ──��� GUARDS ───────────��────────────────────────────────────────────����──────
  if (authLoading || loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3"><Zap className="h-10 w-10 text-primary animate-pulse" /><p className="text-muted-foreground font-display">Loading dashboard...</p></div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) { if (!store) return <Navigate to="/agent-onboarding" replace />; if (!store.approved) return <Navigate to="/pending-approval" replace />; }

  const filteredPackages = packages.filter(p => {
    if (networkFilter === "mtn_mashup") {
      return p.network === "mtn_mashup" || p.network === "mashup";
    }
    if (networkFilter === "airteltigo") {
      return p.network === "airteltigo" || p.network === "atbigtime";
    }
    return p.network === networkFilter;
  });
  const storeSlug = store ? store.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "";
  const storeUrl = store ? DOMAINS.getAgentStoreUrl(store.store_name) : "";
  const storeName = store?.store_name || "DATA PLUG .STORE";
  const supportNum = store?.support_number || "";

  // Date filter helper function
  const getDateFilteredOrders = (orderList: Order[]) => {
    if (dateFilter === "all") return orderList;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    return orderList.filter(order => {
      const orderDate = new Date(order.created_at);
      switch (dateFilter) {
        case "today":
          return orderDate >= today;
        case "yesterday":
          return orderDate >= yesterday && orderDate < today;
        case "week":
          return orderDate >= weekAgo;
        case "month":
          return orderDate >= monthAgo;
        case "custom":
          const start = customStartDate ? new Date(customStartDate) : new Date(0);
          const end = customEndDate ? new Date(customEndDate + "T23:59:59") : new Date();
          return orderDate >= start && orderDate <= end;
        default:
          return true;
      }
    });
  };

  const dateFilteredOrders = getDateFilteredOrders(orders);
  // Use totalOrderCount when viewing all dates (which is the true total from database), otherwise use filtered length
  const totalOrders = dateFilter === "all" ? totalOrderCount : dateFilteredOrders.length;
  const pendingOrders = dateFilteredOrders.filter(o => o.status === "pending").length;
  const filteredOrders = getDateFilteredOrders(orders).filter(o => o.customer_number.toLowerCase().includes(orderSearch.toLowerCase()) || o.id.toLowerCase().includes(orderSearch.toLowerCase()));
  
  // Calculate filtered profit stats based on date filter (no useMemo to avoid hook issues)
  const filteredProfitStats = (() => {
    const completedOrders = dateFilteredOrders.filter(o => o.status === "completed" || o.status === "paid");
    let revenue = 0;
    let profit = 0;
    
    for (const order of completedOrders) {
      const orderRevenue = order.selling_price && order.selling_price > 0 
        ? Number(order.selling_price) 
        : Number(order.amount);
      revenue += orderRevenue;
      
      // Calculate profit
      if (order.profit !== null && order.profit !== undefined && order.profit !== 0) {
        profit += Number(order.profit);
      } else {
        const pkg = packages.find(p => p.id === order.package_id);
        const baseCost = order.base_price || pkg?.agent_price || 0;
        profit += orderRevenue - baseCost;
      }
    }
    
    return { totalRevenue: revenue, totalProfit: profit };
  })();
  
  // Calculate breakdown by profit source
  const profitBreakdown = (() => {
    // AFA Registration profit - hardcoded to 0 for now since we don't track it separately
    const afaProfit = 0;
    
    // Storefront profit (from orders)
    let storefrontProfit = 0;
    const completedOrders = dateFilteredOrders.filter(o => o.status === "completed" || o.status === "paid");
    for (const order of completedOrders) {
      const orderRevenue = order.selling_price && order.selling_price > 0 
        ? Number(order.selling_price) 
        : Number(order.amount);
      
      if (order.profit !== null && order.profit !== undefined && order.profit !== 0) {
        storefrontProfit += Number(order.profit);
      } else {
        const pkg = packages.find(p => p.id === order.package_id);
        const baseCost = order.base_price || pkg?.agent_price || 0;
        storefrontProfit += orderRevenue - baseCost;
      }
    }
    
    // Subagent registration fees - calculated from subagent stores with registration_fee_amount
    const subagentProfit = (subagents ?? []).reduce((sum: number, s: any) => sum + (Number(s.registration_fee_amount) || 0), 0);
    
    return { afaProfit, storefrontProfit, subagentProfit, totalProfit: afaProfit + storefrontProfit + subagentProfit };
  })();
  
  // Calculate wallet purchases (from buy data transactions using wallet)
  const walletPurchases = (() => {
    return (orders ?? []).reduce((sum: number, order: any) => {
      // Only count wallet purchases (buy data transactions that used wallet payment)
      if (order.payment_method === "wallet" && order.type === "buy_data") {
        return sum + (Number(order.amount) || Number(order.selling_price) || 0);
      }
      return sum;
    }, 0);
  })();
  
  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage);

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
      {/* Admin Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-blue-500/20 border-b border-blue-500/30 px-4 py-3">
          <div className="container flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-blue-400" />
              <p className="text-blue-400 font-semibold">Admin View: You are viewing {store?.store_name}&apos;s dashboard</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exitImpersonation}
              className="text-blue-400 border-blue-400 hover:bg-blue-400/20"
            >
              Exit to Admin
            </Button>
          </div>
        </div>
      )}
      <NotificationPopup />

      {/* NAV */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer"><Menu className="h-5 w-5 text-primary" /><span className="font-display text-lg font-bold text-primary animate-pulse">MENU</span></div>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4 bg-card border-r border-border flex flex-col">
              <SheetHeader className="mb-4"><SheetTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Menu</SheetTitle></SheetHeader>
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-2 pb-4">
                  {menuItems.map(item => (
                    <SheetClose asChild key={item.id}>
                      <button onClick={() => setActiveTab(item.id)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-left w-full">
                        <item.icon className="h-5 w-5 text-primary" /><span className="font-medium">{item.label}</span>
                      </button>
                    </SheetClose>
                  ))}
                </div>
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
            
            {/* TRAINING VIDEOS */}
            <AgentYouTubeSection />

            {/* Date Filter for Stats */}
            <div className="flex flex-wrap items-center gap-2 bg-card p-3 rounded-lg border border-border">
              <span className="text-sm font-medium">Filter Stats & Orders:</span>
              {(["all", "today", "yesterday", "week", "month", "custom"] as const).map(filter => (
                <Button
                  key={filter}
                  variant={dateFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDateFilter(filter); setCurrentPage(1); }}
                  className="text-xs"
                >
                  {filter === "all" ? "All Time" : filter === "week" ? "This Week" : filter === "month" ? "This Month" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
              {dateFilter === "custom" && (
                <>
                  <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-36 h-8" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-36 h-8" />
                </>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">Store Status</p><Badge className="mt-2 bg-green-600/20 text-green-400 border-green-600/30">Active</Badge></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">{dateFilter !== "all" ? "Orders (Filtered)" : "Total Orders"}</p><p className="font-display text-2xl font-bold mt-1 text-foreground">{totalOrders}</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">{dateFilter !== "all" ? "Pending (Filtered)" : "Pending"}</p><p className="font-display text-2xl font-bold mt-1 text-primary">{pendingOrders}</p></CardContent></Card>
              <Card className="border-border"><CardContent className="p-6 text-center"><p className="text-muted-foreground text-sm">{dateFilter !== "all" ? "Revenue (Filtered)" : "Revenue"}</p><p className="font-display text-2xl font-bold mt-1 text-green-400">GH₵ {filteredProfitStats.totalRevenue.toFixed(2)}</p></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-6"><div className="flex items-center justify-between"><div className="flex-1"><p className="text-sm text-muted-foreground">{dateFilter !== "all" ? "Profit (Filtered)" : "Total Profit"}</p><p className="font-display text-2xl font-bold text-green-400 mt-1">GH₵ {filteredProfitStats.totalProfit.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">{dateFilter !== "all" ? "Based on filter" : "All-time profit"}</p><details className="mt-2 cursor-pointer group"><summary className="text-xs text-green-300 font-semibold hover:text-green-200 transition-colors flex items-center gap-1 p-1 rounded hover:bg-green-500/20"><span>What is this?</span><ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" /></summary><div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-xs space-y-1"><div className="text-muted-foreground text-xs leading-relaxed"><p><strong>Total Profit</strong></p><p className="mt-1">This is a display of your profit from store sales and PROFIT FROM subagent. This money is already part of your wallet balance and you can spend or withdraw it anytime.</p></div></div></details></div><TrendingUp className="h-8 w-8 text-green-400 opacity-50" /></div></CardContent></Card>
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">My Wallet</p>
                      <p className="font-display text-2xl font-bold text-yellow-400 mt-1">GH₵ {Number(store?.wallet_balance ?? 0).toFixed(2)}</p>
                      {hasPendingWithdrawal && <p className="text-xs text-orange-400 mt-1">GH₵ {pendingWithdrawalAmount.toFixed(2)} pending withdrawal</p>}
                      <details className="mt-3 cursor-pointer group">
                        <summary className="text-xs text-yellow-300 font-semibold hover:text-yellow-200 transition-colors flex items-center gap-2 p-2 rounded hover:bg-yellow-500/10">
                          <span>How is my wallet calculated?</span>
                          <ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" />
                        </summary>
                        <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs space-y-2">
                          <div className="space-y-1 text-muted-foreground leading-relaxed text-xs">
                            <p>Your wallet balance is calculated from:</p>
                            <p>+ Profits from store sales</p>
                            <p>+ Profit from subagent registration (only if you have set it up)</p>
                            <p>+ Profit from AFA registration (only if it is set up)</p>
                            <p>+ Wallet top-ups</p>
                            <p>- Data purchases made using your wallet (Buy Data)</p>
                            <p>- Total withdrawals</p>
                            <p className="text-yellow-300 font-semibold mt-2">The remaining amount is your current wallet balance.</p>
                          </div>
                        </div>
                      </details>
                    </div>
                    <ArrowDownToLine className="h-8 w-8 text-yellow-400 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-primary/30 bg-primary/5"><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Profit from Subagents</p><p className="font-display text-2xl font-bold text-primary mt-1">GH₵ {Number(store?.subagent_commission_balance ?? 0).toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">Withdraw separately in Wallet tab</p></div><Users className="h-8 w-8 text-primary opacity-50" /></div></CardContent></Card>
            </div>
            
            {/* USSD Access Code Card */}
            {store?.topup_reference && (
              <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="text-center md:text-left">
                      <p className="text-sm text-muted-foreground mb-1">Your customers can buy data via USSD</p>
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        <div className="p-3 bg-primary/20 rounded-lg">
                          <p className="text-2xl font-bold font-mono text-primary">*380*455#</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-muted-foreground">Access Code</p>
                          <p className="text-3xl font-bold font-mono text-foreground">{store.topup_reference}</p>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText("*380*455#");
                        toast({ title: "Copied!", description: "USSD code copied to clipboard" });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" /> Copy USSD Code
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="border-border">
              <CardHeader className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="font-display text-lg">Orders ({filteredOrders.length})</CardTitle>
                  <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by number or order ID..." value={orderSearch} onChange={e => { setOrderSearch(e.target.value); setCurrentPage(1); }} className="pl-9" /></div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredOrders.length === 0 ? <p className="text-muted-foreground text-center py-4">No orders found.</p> : (
                  <>
                    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date & Time</TableHead><TableHead>Number</TableHead><TableHead>Network</TableHead><TableHead>Size</TableHead><TableHead>Sell Price</TableHead><TableHead>Base Cost</TableHead><TableHead>Profit</TableHead><TableHead>Method</TableHead><TableHead>Source</TableHead><TableHead>Order Status</TableHead><TableHead>Payment Status</TableHead></TableRow></TableHeader>
                      <TableBody>{paginatedOrders.map(order => { 
                        const isSubagentOrder = !!order.subagent_store_id;
                        const pkg = packages.find(p => p.id === order.package_id);
                        const adminBasePrice = pkg?.agent_price || 0; // What admin charges agent
                        
                        let sellPrice: number;
                        let baseCost: number;
                        let profit: number;
                        
                        if (isSubagentOrder) {
                          // AGENT'S PERSPECTIVE for subagent orders:
                          // - Sell Price = what agent charged subagent (from subagent_package_prices)
                          // - Base Cost = what admin charges agent (agent_price from data_packages)
                          // - Profit = agent's commission (sell price - base cost)
                          const agentPriceToSubagent = subagentBasePrices[order.package_id] || adminBasePrice;
                          sellPrice = agentPriceToSubagent;
                          baseCost = adminBasePrice;
                          profit = sellPrice - baseCost;
                        } else {
                          // DIRECT ORDERS: Use stored values or fallback
                          const storedSellPrice = order.selling_price ?? null;
                          const storedBaseCost = order.base_price ?? null;
                          const storedProfit = order.profit ?? null;
                          
                          sellPrice = (storedSellPrice && storedSellPrice > 0) ? storedSellPrice : Number(order.amount);
                          baseCost = (storedBaseCost && storedBaseCost > 0) ? storedBaseCost : adminBasePrice;
                          profit = (storedProfit !== null && storedProfit !== 0) ? storedProfit : (sellPrice - baseCost);
                        }
                        
                        // Determine if this is an API order (has agent_store_id, no subagent_store_id, and likely came from API)
                        const isAPIOrder = order.agent_store_id && !order.subagent_store_id && order.payment_method !== "wallet";
                        
                        return (<TableRow key={order.id}><TableCell className="text-sm whitespace-nowrap">{new Date(order.created_at).toLocaleString()}</TableCell><TableCell className="font-mono text-sm">{order.customer_number}</TableCell><TableCell className="uppercase text-sm">{order.network}</TableCell><TableCell className="font-display font-bold">{(order as any).size_gb_text || order.size_gb + "GB"}</TableCell><TableCell>GH₵ {Number(sellPrice).toFixed(2)}</TableCell><TableCell className="text-muted-foreground">GH₵ {Number(baseCost).toFixed(2)}</TableCell><TableCell className={profit >= 0 ? "text-green-400 font-semibold" : "text-red-400"}>GH₵ {Number(profit).toFixed(2)}</TableCell><TableCell><Badge variant="outline" className="text-xs">{order.payment_method === "wallet" ? "Wallet" : "Paystack"}</Badge></TableCell><TableCell>{isSubagentOrder ? <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">Subagent</Badge> : isAPIOrder ? <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/30">API</Badge> : <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">Direct</Badge>}</TableCell><TableCell className="capitalize text-sm"><Badge variant="outline" className="text-xs">{getOrderStage(order)}</Badge></TableCell><TableCell><Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>{order.status === "paid" ? "completed" : order.status}</Badge></TableCell></TableRow>); })}</TableBody></Table></div>
                    {/* Load More Button */}
                    {currentPage * ordersPerPage < filteredOrders.length && (
                      <div className="flex items-center justify-center mt-6">
                        <Button onClick={() => setCurrentPage(p => p + 1)} className="w-full sm:w-auto">
                          Load More Orders ({filteredOrders.length - currentPage * ordersPerPage} remaining)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* API USER ORDERS SECTION */}

          </TabsContent>

          {/* ============================= BUY DATA ============================= */}
          <TabsContent value="buy" className="space-y-4 mt-0">
            {store && (<Card className={`border-border ${hasPendingWithdrawal ? "border-orange-500/30 bg-orange-500/5" : "bg-secondary/30"}`}>
              <CardContent className="p-4 space-y-1"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /><span className="font-medium">Wallet Balance:</span></div><span className="font-display text-xl font-bold text-primary">GH₵ {store.wallet_balance?.toFixed(2) ?? "0.00"}</span></div>{hasPendingWithdrawal && <p className="text-xs text-orange-400">⚠️ GH₵ {pendingWithdrawalAmount.toFixed(2)} reserved for pending withdrawal. Effective spendable: <strong>GH₵ {effectiveBalance.toFixed(2)}</strong></p>}</CardContent>
            </Card>)}
            <div className="flex gap-2 flex-wrap">
              {["mtn", "airteltigo", "telecel"].map(net => (
                <Button 
                  key={net} 
                  variant={networkFilter === net ? "hero" : "outline"} 
                  size="sm" 
                  onClick={() => setNetworkFilter(net)}
                >
                  {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : net === "telecel" ? "Telecel" : ""}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {packages.filter(p => {
                // COMMENTED OUT: mashup packages deactivated
                if (false && networkFilter === "mtn_mashup") {
                  return p.network === "mtn_mashup" || p.network === "mashup";
                }
      if (networkFilter === "airteltigo") {
        return p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
      }
      return p.network === networkFilter;
              }).map((pkg) => {
                const price = Number(pkg.agent_price || pkg.price);
                const wouldUnderflow = hasPendingWithdrawal && (Number(store?.wallet_balance ?? 0) - price) < pendingWithdrawalAmount;
                const isInactive = pkg.active === false;
                return (
                  <Card key={pkg.id} className={`relative border-slate-700/50 bg-slate-900/5 transition-all ${isInactive ? "opacity-50 grayscale" : "hover:border-slate-600/50"}`}>
                    {isInactive && (
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow">
                        Not available
                      </div>
                    )}
                    <CardContent>
                      <p className="font-display text-lg font-bold text-foreground">{pkg.size_gb_text || pkg.size_gb + "GB"}</p>
                      <p className="text-lg font-bold text-cyan-400">GH₵ {price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Agent Price</p>
                      {wouldUnderflow && !isInactive ? <p className="text-xs text-orange-400">Blocked — pending withdrawal</p> : null}
                      <Button variant="hero" size="sm" className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-100 disabled:cursor-not-allowed" onClick={() => !isInactive && openBuyDialog({ ...pkg, agent_price: price, price: price } as any)} disabled={wouldUnderflow || isInactive}>{isInactive ? "Not Available" : "Buy Now"}</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ============================= STORE PRICES ============================= */}
          <TabsContent value="store" className="space-y-4 mt-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Network filter buttons */}
              <div className="flex gap-2 flex-wrap">
                {["mtn", "airteltigo", "telecel"].map(net => (
                  <Button 
                    key={net} 
                    variant={networkFilter === net ? "hero" : "outline"} 
                    size="sm" 
                    onClick={() => setNetworkFilter(net)}
                  >
                    {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : net === "telecel" ? "Telecel" : ""}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Markup:</span>
                <Input type="number" placeholder="+10" value={markupPercent} onChange={e => setMarkupPercent(e.target.value)} className="w-20 h-8 text-sm" />
                <Button variant="outline" size="sm" onClick={applyMarkup}><Percent className="h-3 w-3 mr-1" /> Apply</Button>
              </div>
              {Object.keys(editedPrices).length > 0 && <Button variant="hero" size="sm" onClick={savePrices} disabled={savingPrices}><Save className="h-4 w-4 mr-1" />{savingPrices ? "Saving..." : "Save Prices"}</Button>}
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
              <p className="font-semibold">USE Markup if you feel lazy and do not want to edit each GB price one by one <br></br>���� Markup Explanation(Remember to click save after applying markup</p>
              <p className="text-xs text-muted-foreground">Markup changes all your selling price for the selected network base on the percentage you want all the prices to be increase by  .Markup is applied to the <strong>Base Price</strong> (your cost). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"}</strong>).</p>
            </div>
            <p className="text-sm text-muted-foreground">Your profit = Selling Price - Base Price. Use markup to increase all prices by a % (based on base price).</p>
            <Card className="border-border"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Size</TableHead><TableHead>Base Price</TableHead><TableHead>Your Selling Price</TableHead><TableHead>Profit</TableHead></TableRow></TableHeader>
              <TableBody>{filteredPackages.map(pkg => { const cur = editedPrices[pkg.id] ?? agentPrices[pkg.id] ?? pkg.price; const profit = cur - pkg.agent_price; const isInactive = pkg.active === false; return (<TableRow key={pkg.id} className={isInactive ? "opacity-50" : ""}><TableCell className="font-display font-bold">{pkg.size_gb_text || pkg.size_gb + "GB"}{isInactive && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Not available</span>}</TableCell><TableCell className="text-muted-foreground">GH₵ {Number(pkg.agent_price).toFixed(2)}</TableCell><TableCell><Input type="number" step="0.01" value={cur} onChange={e => handlePriceChange(pkg.id, e.target.value)} className="w-24 h-8" /></TableCell><TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>GH₵ {profit.toFixed(2)}</TableCell></TableRow>); })}</TableBody></Table></div></Card>
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
                  {/* TOP NAV - Store Name */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", backgroundColor: "#0a0a0a", borderBottom: "1px solid #1e1e1e" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, background: flyerColors.buttonBg, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div><span style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>{storeName.toUpperCase()}</span></div>
                    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>{["Packages", "Services", "Become an Agent"].map(l => (<span key={l} style={{ fontSize: 14, color: "#666", fontWeight: 500 }}>{l}</span>))}<span style={{ fontSize: 13, color: flyerColors.buttonBg, fontWeight: 700, padding: "5px 14px", background: `${flyerColors.buttonBg}20`, borderRadius: 7, border: `1px solid ${flyerColors.buttonBg}40` }}>Agent Dashboard</span><span style={{ fontSize: 14, color: "#888" }}>Sign Out</span></div>
                  </div>
                  
                  {/* INFO HEADER - USSD Code, Access Code, Help, Phone */}
                  <div style={{ display: "flex", alignItems: "stretch", padding: "16px 32px", gap: 16, backgroundColor: "#0a0a0a" }}>
                    {/* USSD Code Box */}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#111", border: "1.5px solid #333", borderRadius: 12 }}>
                      <div style={{ width: 48, height: 48, background: "#222", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #444" }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: flyerColors.buttonBg, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>USSD CODE</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginTop: 2, fontFamily: "monospace" }}>*380*455#</div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Dial to purchase instantly.</div>
                      </div>
                    </div>
                    {/* Access Code Box */}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#111", border: "1.5px solid #333", borderRadius: 12 }}>
                      <div style={{ width: 48, height: 48, background: "#222", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #444" }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: flyerColors.airtelColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>ACCESS CODE</div>
                        <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", marginTop: 0, fontFamily: "monospace" }}>{store?.topup_reference || "0"}</div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 0 }}>Required for all purchases.</div>
                      </div>
                    </div>
                    {/* Help Box */}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#111", border: "1.5px solid #333", borderRadius: 12 }}>
                      <div style={{ width: 48, height: 48, background: "#fbbf24", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="#000"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: flyerColors.mtnColor, fontWeight: 800, textTransform: "uppercase" }}>NEED HELP OR HAVE</div>
                        <div style={{ fontSize: 13, color: flyerColors.mtnColor, fontWeight: 800, textTransform: "uppercase" }}>QUESTIONS?</div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Contact us directly on WhatsApp or Call.</div>
                      </div>
                    </div>
                    {/* Phone Number Box */}
                    <div style={{ flex: 1.2, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: "16px 20px", background: "#111", border: "1.5px solid #333", borderRadius: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <div style={{ width: 40, height: 40, background: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                        </div>
                        <span style={{ fontSize: 26, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{supportNum}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#25D366", borderRadius: 20, padding: "8px 18px" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Chat on WhatsApp</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Title */}
                  <div style={{ textAlign: "center", padding: "20px 20px 14px" }}><div style={{ fontSize: 46, fontWeight: 900, color: "#fff", letterSpacing: -1, textTransform: "uppercase" }}>DATA BUNDLES – ALL NETWORKS</div><div style={{ fontSize: 18, color: "#777", marginTop: 6 }}>Affordable. Instant. Reliable.</div></div>
                  <div style={{ display: "flex", justifyContent: "center", margin: "0 auto 20px", width: "fit-content" }}>{[{ label: "MTN", bg: flyerColors.mtnColor, txt: "#000" }, { label: "AirtelTigo", bg: flyerColors.airtelColor, txt: "#fff" }, { label: "Telecel", bg: flyerColors.telecelColor, txt: "#fff" }].map((tab, i) => (<div key={tab.label} style={{ padding: "13px 52px", background: tab.bg, color: tab.txt, fontSize: 17, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, borderRadius: i === 0 ? "9px 0 0 9px" : i === 2 ? "0 9px 9px 0" : "0", border: `2px solid ${tab.bg}` }}>{tab.label}</div>))}</div>
                  {/* MTN */}
                  <div style={{ margin: "0 20px 16px", border: `2px solid ${flyerColors.mtnColor}50`, borderRadius: 14, overflow: "hidden" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#0e0b00", borderBottom: `1px solid ${flyerColors.mtnColor}30` }}><span style={{ fontSize: 22, fontWeight: 900, color: flyerColors.mtnColor, letterSpacing: 1, textTransform: "uppercase" }}>MTN DATA BUNDLES</span><span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.mtnColor, border: `2px solid ${flyerColors.mtnColor}`, borderRadius: 20, padding: "4px 16px" }}>MTN</span></div><div style={{ backgroundColor: "#0a0800", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>{mtnPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} network="MTN" accent={flyerColors.mtnColor} textColor="#000" />)}</div></div>
                  {/* AirtelTigo */}
                  <div style={{ margin: "0 20px 16px", border: `2px solid ${flyerColors.airtelColor}50`, borderRadius: 14, overflow: "hidden" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#06041a", borderBottom: `1px solid ${flyerColors.airtelColor}30` }}><span style={{ fontSize: 22, fontWeight: 900, color: flyerColors.airtelColor, letterSpacing: 1, textTransform: "uppercase" }}>AIRTELTIGO DATA BUNDLES</span><span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.airtelColor, border: `2px solid ${flyerColors.airtelColor}`, borderRadius: 20, padding: "4px 16px" }}>airtel tigo</span></div><div style={{ backgroundColor: "#050314", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>{airtelPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} network="AIRTELTIGO" accent={flyerColors.airtelColor} textColor="#fff" />)}</div></div>
                  {/* Telecel */}
                  <div style={{ margin: "0 20px 16px", border: `2px solid ${flyerColors.telecelColor}50`, borderRadius: 14, overflow: "hidden" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#120000", borderBottom: `1px solid ${flyerColors.telecelColor}30` }}><span style={{ fontSize: 22, fontWeight: 900, color: flyerColors.telecelColor, letterSpacing: 1, textTransform: "uppercase" }}>TELECEL DATA BUNDLES</span><span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.telecelColor, border: `2px solid ${flyerColors.telecelColor}`, borderRadius: 20, padding: "4px 16px" }}>telecel</span></div><div style={{ backgroundColor: "#0e0000", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>{telecelPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} network="TELECEL" accent={flyerColors.telecelColor} textColor="#fff" />)}</div></div>
                  {/* Store URL Footer */}
                  <div style={{ textAlign: "center", paddingBottom: 24, paddingTop: 10, fontSize: 18, color: "#666" }}><span style={{ color: flyerColors.buttonBg, fontWeight: 600 }}>{storeUrl}</span></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Output: {FLYER_W} × {FLYER_H} px. Contact shown: <strong>{supportNum || "— set in Settings"}</strong></p>
            </div>
          </TabsContent>

          {/* ============================= BULK ORDERS ============================= */}
          <TabsContent value="bulk" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Bulk Orders</CardTitle>
                <p className="text-sm text-muted-foreground">Send data to multiple recipients at once. Uses your wallet balance.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Step 1: Select Network */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                    <span className="font-semibold text-lg">SELECT NETWORK</span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <Button variant={bulkNetwork === "mtn" ? "default" : "outline"} className={`px-8 py-6 text-lg font-bold ${bulkNetwork === "mtn" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}`} onClick={() => setBulkNetwork("mtn")}>MTN</Button>
                    <Button variant={bulkNetwork === "telecel" ? "default" : "outline"} className={`px-8 py-6 text-lg font-bold ${bulkNetwork === "telecel" ? "bg-red-600 hover:bg-red-700" : ""}`} onClick={() => setBulkNetwork("telecel")}>Telecel</Button>
                    <Button variant={bulkNetwork === "airteltigo" ? "default" : "outline"} className={`px-8 py-6 text-lg font-bold ${bulkNetwork === "airteltigo" ? "bg-blue-600 hover:bg-blue-700" : ""}`} onClick={() => setBulkNetwork("airteltigo")}>AirtelTigo</Button>
                  </div>
                </div>

                {/* Step 2: Recipients */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                    <span className="font-semibold text-lg">RECIPIENTS</span>
                  </div>
                  
                  {/* CSV Upload */}
                  <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const text = evt.target?.result as string;
                        const lines = text.split("\n").filter(l => l.trim()).map(l => {
                          const parts = l.split(/[,\t]/).map(p => p.trim());
                          return `${parts[0]} ${parts[1] || ""}`.trim();
                        }).join("\n");
                        setBulkRecipients(lines);
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }} />
                    <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="font-semibold">Upload CSV / Excel file</p>
                    <p className="text-sm text-muted-foreground">Column A: phone - Column B: GB size (optional)</p>
                  </div>

                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-sm text-muted-foreground">or type manually</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>

                  {/* Manual Input */}
                  <Textarea
                    placeholder={`0241234567 2\n0551234567 5\n0591234567 10`}
                    value={bulkRecipients}
                    onChange={(e) => setBulkRecipients(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />

                  {/* Format Guide */}
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-yellow-500">Format: 0241234567 2 (phone then GB size per line)</p>
                    <p className="text-sm text-muted-foreground">Or use the global package below if all numbers get the same bundle.</p>
                    <p className="text-xs text-muted-foreground">
                      Valid prefixes: {bulkNetwork === "mtn" ? "024, 025, 053, 054, 055, 059" : bulkNetwork === "telecel" ? "020, 050" : "026, 027, 056, 057"}
                    </p>
                  </div>
                </div>

                {/* Step 3: Global Package (optional) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                    <span className="font-semibold text-lg">GLOBAL PACKAGE (Optional)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">If set, all recipients without a specified GB size will receive this package.</p>
                  <Select value={bulkGlobalSize?.toString() || "none"} onValueChange={(v) => setBulkGlobalSize(v === "none" ? null : Number(v))}>
                    <SelectTrigger className="w-full md:w-64">
                      <SelectValue placeholder="Select GB size for all" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (use per-line sizes)</SelectItem>
                      {packages.filter(p => p.network.toLowerCase() === bulkNetwork && p.active).map(p => (
                        <SelectItem key={p.id} value={p.size_gb.toString()}>{p.size_gb}GB - GH₵ {(p.agent_price ?? p.price).toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Summary & Actions */}
                <div className="border-t pt-4 space-y-4">
                  {(() => {
                    const lines = bulkRecipients.split("\n").filter(l => l.trim());
                    const parsed = lines.map(line => {
                      const parts = line.trim().split(/\s+/);
                      const phone = parts[0]?.replace(/\D/g, "") || "";
                      const size = parts[1] ? Number(parts[1]) : bulkGlobalSize;
                      return { phone, size };
                    }).filter(r => r.phone.length === 10 && r.size && r.size > 0);
                    
                    const totalGb = parsed.reduce((sum, r) => sum + (r.size || 0), 0);
                    const totalCost = parsed.reduce((sum, r) => {
                      const pkg = packages.find(p => p.network.toLowerCase() === bulkNetwork && p.size_gb === r.size);
                      const price = pkg ? (pkg.agent_price ?? pkg.price) : 0;
                      return sum + price;
                    }, 0);
                    const walletBalance = store?.wallet_balance || 0;
                    
                    return (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-secondary/50 rounded-lg">
                            <p className="text-2xl font-bold">{parsed.length}</p>
                            <p className="text-xs text-muted-foreground">Valid Recipients</p>
                          </div>
                          <div className="text-center p-3 bg-secondary/50 rounded-lg">
                            <p className="text-2xl font-bold">{totalGb}GB</p>
                            <p className="text-xs text-muted-foreground">Total Data</p>
                          </div>
                          <div className="text-center p-3 bg-secondary/50 rounded-lg">
                            <p className="text-2xl font-bold text-yellow-500">GH₵ {totalCost.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Total Cost</p>
                          </div>
                          <div className="text-center p-3 bg-secondary/50 rounded-lg">
                            <p className={`text-2xl font-bold ${walletBalance >= totalCost ? "text-green-500" : "text-red-500"}`}>GH₵ {walletBalance.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Wallet Balance</p>
                          </div>
                        </div>
                        
                        {walletBalance < totalCost && parsed.length > 0 && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-500 text-sm">
                            Insufficient wallet balance. You need GH��� {(totalCost - walletBalance).toFixed(2)} more.
                          </div>
                        )}
                        
                        <div className="flex gap-3 flex-wrap">
                          <Button
                            variant="hero"
                            className="flex-1"
                            disabled={bulkProcessing || parsed.length === 0 || walletBalance < totalCost}
                            onClick={async () => {
                              if (!store) return;
                              setBulkProcessing(true);
                              setBulkResults([]);
                              
                              const results: typeof bulkResults = [];
                              let totalDeducted = 0;
                              
                              for (const recipient of parsed) {
                                const pkg = packages.find(p => p.network.toLowerCase() === bulkNetwork && p.size_gb === recipient.size);
                                if (!pkg) {
                                  results.push({ phone: recipient.phone, size: recipient.size || 0, status: "failed", error: "Package not found" });
                                  continue;
                                }
                                
                                const price = pkg.agent_price ?? pkg.price;
                                
                                try {
                                  // Create order
                                  const { error: orderError } = await supabase.from("orders").insert({
                                    package_id: pkg.id,
                                    size_gb_text: pkg.network === "mtn_mashup" ? pkg.size_gb_text : null,
                                    agent_store_id: store.id,
                                    customer_number: recipient.phone,
                                    network: bulkNetwork,
                                    size_gb: recipient.size,
                                    amount: price,
                                    base_price: price,
                                    selling_price: price,
                                    payment_method: "wallet",
                                    status: "paid",
                                    fulfillment_status: "pending"
                                  });
                                  
                                  if (orderError) throw orderError;
                                  totalDeducted += price;
                                  results.push({ phone: recipient.phone, size: recipient.size || 0, status: "success" });
                                } catch (err: any) {
                                  results.push({ phone: recipient.phone, size: recipient.size || 0, status: "failed", error: err.message });
                                }
                              }
                              
                              // Deduct total from wallet
                              if (totalDeducted > 0) {
                                await supabase.from("agent_stores").update({ wallet_balance: walletBalance - totalDeducted }).eq("id", store.id);
                                setStore(prev => prev ? { ...prev, wallet_balance: walletBalance - totalDeducted } : prev);
                              }
                              
                              setBulkResults(results);
                              setBulkProcessing(false);
                              toast({ title: "Bulk Order Complete", description: `${results.filter(r => r.status === "success").length}/${results.length} orders created successfully.` });
                              fetchData();
                            }}
                          >
                            {bulkProcessing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : <><Wallet className="h-4 w-4 mr-2" /> Pay with Wallet (GH₵ {totalCost.toFixed(2)})</>}
                          </Button>
                          <Button variant="outline" onClick={() => { setBulkRecipients(""); setBulkResults([]); setBulkGlobalSize(null); }}>
                            <RotateCcw className="h-4 w-4 mr-2" /> Clear
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Results */}
                {bulkResults.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Results</h4>
                    <div className="max-h-64 overflow-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Phone</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkResults.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono">{r.phone}</TableCell>
                              <TableCell>{r.size}GB</TableCell>
                              <TableCell>
                                <Badge variant={r.status === "success" ? "default" : "destructive"}>
                                  {r.status === "success" ? "Sent" : r.error || "Failed"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Success: {bulkResults.filter(r => r.status === "success").length} | Failed: {bulkResults.filter(r => r.status === "failed").length}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================= MASHUP FLYER ============================= */}
                {/* COMMENTED OUT: mashup packages deactivated
                <TabsContent value="mashup-flyer" className="space-y-6 mt-0">
            {store && (
              <MashupFlyerGenerator
                storeName={store.store_name}
                storeUrl={storeUrl}
                whatsappNumber={store.whatsapp_number}
                supportNumber={store.support_number}
                packages={packages}
                agentPrices={agentPrices}
                topupReference={store.topup_reference}
                isSubagent={false}
              />
            )}
          </TabsContent>

          {/* ============================= TOP UP ============================= */}
          <TabsContent value="topup" className="space-y-6 mt-0">
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" /> Instant Top Up with Paystack
                </CardTitle>
                <p className="text-sm text-muted-foreground">Top up instantly with any amount using card or mobile money</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Amount (GH₵)</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    className="text-lg"
                  />
                  <p className="text-xs text-muted-foreground">A small Paystack fee (1.98%) will be added to your payment.</p>
                </div>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={!topupAmount || Number(topupAmount) < 1 || topupLoading}
                  onClick={handlePaystackTopup}
                >
                  {topupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  Pay Now
                </Button>
              </CardContent>
            </Card>

            {/* Manual MoMo Top Up */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Coins className="h-5 w-5 text-yellow-400" /> Manual Top Up via MoMo
                </CardTitle>
                <p className="text-sm text-muted-foreground">Transfer directly via MTN MoMo (minimum GH₵ 100)</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-yellow-400">🏷️ Minimum top up amount: GH₵ 100</p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">1.</span>
                    <span>Dial <span className="font-mono bg-slate-800 px-2 py-1 rounded">*188#</span> on your MTN Mobile phone</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">2.</span>
                    <span>Select 1 (Transfer Money) → 1 (Mobile User)</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">3.</span>
                    <span>Recipient: <span className="font-mono bg-slate-800 px-2 py-1 rounded">80984482202</span></span>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">4.</span>
                    <span>Enter the amount (minimum GH₵ 100)</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">5.</span>
                    <span>Reference: (optional)</span>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Send transaction ID to:</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-xs text-red-400 font-medium">🚨 Important: Always include your reference code. Admin credits your wallet after verifying the transaction.</p>
                </div>
              </CardContent>
            </Card>

            {/* Top Up History */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Top Up History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topupHistory.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No top-up history yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topupHistory.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">{new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                            <TableCell className="font-semibold text-green-400">GH₵ {Number(t.amount).toFixed(2)}</TableCell>
                            <TableCell><Badge variant={t.source === "Paystack" ? "default" : "secondary"}>{t.source}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{t.paystack_reference || "Admin credit"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================= WITHDRAW ============================= */}
          <TabsContent value="withdraw" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className={`cursor-pointer transition-all ${withdrawSource === "wallet" ? "border-yellow-500 bg-yellow-500/10" : "border-border"}`} onClick={() => setWithdrawSource("wallet")}>
                <CardContent className="p-6 text-center space-y-2">
                  <ArrowDownToLine className="h-10 w-10 text-yellow-400 mx-auto" />
<p className="text-muted-foreground text-sm">My Wallet</p>
  <p className="font-display text-3xl font-bold text-yellow-400">GH₵ {Number(store?.wallet_balance ?? 0).toFixed(2)}</p>
                  {withdrawSource === "wallet" && <Badge className="bg-yellow-500 text-black">Selected</Badge>}
                </CardContent>
              </Card>
              <Card className={`cursor-pointer transition-all ${withdrawSource === "subagent_commission" ? "border-primary bg-primary/10" : "border-border"}`} onClick={() => setWithdrawSource("subagent_commission")}>
                <CardContent className="p-6 text-center space-y-2">
                  <Users className="h-10 w-10 text-primary mx-auto" />
                  <p className="text-muted-foreground text-sm">Profit from Subagents</p>
                  <p className="font-display text-3xl font-bold text-primary">GH₵ {Number(store?.subagent_commission_balance ?? 0).toFixed(2)}</p>
                  {withdrawSource === "subagent_commission" && <Badge className="bg-primary text-black">Selected</Badge>}
                </CardContent>
              </Card>
            </div>
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display text-lg">Request Paystack Transfer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasPendingWithdrawal && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-sm text-yellow-400 font-medium">You have a pending withdrawal of GH₵ {pendingWithdrawalAmount.toFixed(2)}. Please wait until it completes.</p>
                  </div>
                )}
                
                {/* Recipient Selection or Creation */}
                {!createNewRecipient ? (
                  <>
                    {transferRecipients.length > 0 && (
                      <div className="space-y-2">
                        <Label>Select Recipient</Label>
                        <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a recipient..." />
                          </SelectTrigger>
                          <SelectContent>
                            {transferRecipients.map((r: any) => (
                              <SelectItem key={r.recipient_code} value={r.recipient_code}>
                                {r.account_holder_name} • {r.provider_type === "mobile_money" ? `${r.mobile_money_network?.toUpperCase()}: ${r.mobile_money_number}` : `Bank: ${r.account_number}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="space-y-1 mt-3">
                          {transferRecipients.map((r: any) => (
                            <div key={r.recipient_code} className="flex items-center justify-between gap-2 p-2 rounded border border-border text-sm bg-muted/30">
                              <span className="flex-1 truncate text-sm">{r.account_holder_name} • {r.mobile_money_network?.toUpperCase()}</span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleEditRecipient(r)}
                                  title="Edit recipient"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                  onClick={() => handleDeleteRecipient(r.recipient_code)}
                                  title="Delete recipient"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setCreateNewRecipient(true)}
                      disabled={transferRecipients.length >= 4 || !!impersonatedUserId}
                      title={impersonatedUserId ? "Cannot create new recipients while impersonating. Use existing recipients only." : ""}
                    >
                      {impersonatedUserId ? "Cannot Add Recipient While Impersonating" : transferRecipients.length === 0 ? "Add Recipient" : `+ Add New Recipient (${transferRecipients.length}/4)`}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="ghost" 
                      className="text-xs" 
                      onClick={() => {
                        setCreateNewRecipient(false);
                        setEditingRecipient(null);
                        setRecipientName("");
                        setMobileNetwork("mtn");
                        setMobileNumber("");
                      }}
                    >
                      ← Back to Recipients
                    </Button>
                    
                    <div className="space-y-3 border border-border rounded-lg p-4">
                      <h3 className="font-medium">{editingRecipient ? "Edit Recipient" : "Create New Recipient"}</h3>
                      <div className="space-y-1">
                        <Label>Full Name</Label>
                        <Input 
                          placeholder="John Doe" 
                          value={recipientName}
                          onChange={e => setRecipientName(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label>Mobile Network</Label>
                        <Select value={mobileNetwork} onValueChange={setMobileNetwork}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mtn">MTN</SelectItem>
                            <SelectItem value="telecel">Telecel</SelectItem>
                            <SelectItem value="airteltigo">AirtelTigo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-1">
                        <Label>Mobile Number</Label>
                        <Input 
                          placeholder="024XXXXXXX" 
                          value={mobileNumber}
                          onChange={e => setMobileNumber(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-1 pt-3 border-t border-border">
                        <Label>Amount (GH₵)</Label>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          className="text-lg"
                        />
                      </div>

                      {withdrawAmount && Number(withdrawAmount) > 0 && (
                        <div className="space-y-2 text-sm">
                          {(() => {
                            const amount = Number(withdrawAmount);
                            const feeRate = amount >= 100 ? 0.015 : 0.05;
                            const feeAmount = amount * feeRate;
                            const recipientAmount = amount - feeAmount;
                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Amount to Deduct:</span>
                                  <span className="font-semibold">GH₵ {amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Fee ({(feeRate * 100).toFixed(1)}%):</span>
                                  <span className="font-semibold text-red-400">GH₵ {feeAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t border-border pt-2">
                                  <span className="text-muted-foreground">Recipient Receives:</span>
                                  <span className="font-semibold text-green-400">GH₵ {recipientAmount.toFixed(2)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <p className="text-xs text-red-400 font-medium">⚠️ IMPORTANT WARNING</p>
                        <p className="text-xs text-red-300 mt-1">Once a withdrawal is sent, it CANNOT be reversed. Please double-check the recipient details before confirming.</p>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">Minimum: GH₵ 15.00 | Processed Instantly ⚡</p>

                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => {
                            setCreateNewRecipient(false);
                            setEditingRecipient(null);
                            setRecipientName("");
                            setMobileNetwork("mtn");
                            setMobileNumber("");
                          }}
                        >
                          Cancel
                        </Button>
                        {editingRecipient ? (
                          <Button 
                            variant="hero"
                            className="flex-1 bg-amber-600 hover:bg-amber-700"
                            disabled={!recipientName.trim() || !mobileNumber.trim()}
                            onClick={() => handleSaveEditedRecipient()}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        ) : (
                          <Button 
                            variant="hero"
                            className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                            disabled={!recipientName.trim() || !mobileNumber.trim() || !withdrawAmount || Number(withdrawAmount) < 15 || Number(withdrawAmount) > effectiveBalance || withdrawLoading}
                            onClick={() => handleWithdraw()}
                          >
                            {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
                            Send Transfer
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
                
                {!createNewRecipient && (transferRecipients.length > 0 || selectedRecipient) && (
                  <>
                    <div className="space-y-3">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label>Amount (GH₵)</Label>
                          <Input
                            type="number"
                            placeholder="Enter amount"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            className="text-lg"
                          />
                        </div>
                        <Button 
                          variant="hero" 
                          className="self-end bg-cyan-600 hover:bg-cyan-700"
                          disabled={!withdrawAmount || Number(withdrawAmount) < 1 || Number(withdrawAmount) > effectiveBalance || withdrawLoading}
                          onClick={() => handleWithdraw()}
                        >
                          {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
                          Transfer
                        </Button>
                      </div>

                      {/* Fee Breakdown */}
                      {withdrawAmount && Number(withdrawAmount) > 0 && (
                        <div className="space-y-2 text-sm">
                          {(() => {
                            const amount = Number(withdrawAmount);
                            const feeRate = amount >= 100 ? 0.015 : 0.05;
                            const feeAmount = amount * feeRate;
                            const recipientAmount = amount - feeAmount;
                            
                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Amount to Deduct:</span>
                                  <span className="font-semibold">GH₵ {amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Fee ({(feeRate * 100).toFixed(1)}%):</span>
                                  <span className="font-semibold text-red-400">GH₵ {feeAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t border-border pt-2">
                                  <span className="text-muted-foreground">Recipient Receives:</span>
                                  <span className="font-semibold text-green-400">GH₵ {recipientAmount.toFixed(2)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Withdrawal Fees Info */}
                      <Collapsible>
                        <CollapsibleTrigger className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                          Withdrawal Fees
                          <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 bg-slate-800/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                          <p>A small fee applies based on your withdrawal amount:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Less than GH₵ 100: 5% fee</li>
                            <li>GH₵ 100 or more: 1.5% fee</li>
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Important Warning */}
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <p className="text-xs text-red-400 font-medium">⚠️ IMPORTANT WARNING</p>
                        <p className="text-xs text-red-300 mt-1">Once a withdrawal is sent, it CANNOT be reversed. Please double-check the recipient details before confirming. You are responsible for any funds sent to the wrong account.</p>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">Minimum: GH₵ 15.00 | Processed Instantly ⚡</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Payout History */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display">Payout History</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No withdrawals yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Transfer Code</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withdrawals.map((w) => (
                          <TableRow key={w.id}>
                            <TableCell className="text-sm">{new Date(w.created_at).toLocaleDateString([], { year: 'numeric', month: 'numeric', day: 'numeric' })}, {new Date(w.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</TableCell>
                            <TableCell className="font-semibold">GH₵ {Number(w.amount).toFixed(2)}</TableCell>
                            <TableCell className="text-sm">
                              <div>
                                <div className="font-medium">{w.account_holder_name || w.recipient_account_name || "Unknown"}</div>
                                <div className="text-xs text-muted-foreground">MTN: {w.recipient_phone || w.phone_number || "N/A"}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={w.status === "completed" || w.status === "success" ? "default" : w.status === "pending" ? "secondary" : "destructive"}>
                                {w.status === "success" ? "success" : w.status?.toUpperCase() || "PENDING"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {w.transfer_code || w.reference_code || (w.status === "completed" || w.status === "success" ? "-" : "-")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================= APPEARANCE ============================= */}
          <TabsContent value="appearance" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border"><CardHeader><CardTitle className="font-display">Customise Your Storefront</CardTitle></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label>Store Headline</Label><Textarea value={storeHeadline} onChange={e => setStoreHeadline(e.target.value)} rows={2} placeholder="Get the best data deals from ..." /><Button variant="outline" size="sm" onClick={saveStoreHeadline} disabled={savingHeadline}>{savingHeadline ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Headline</Button></div><div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">{[{ label: "Primary Colour", key: "primary" }, { label: "Text on Primary", key: "primary_foreground" }, { label: "Page Background", key: "background" }, { label: "Card Background", key: "card_background" }].map(({ label, key }) => (<div key={key} className="space-y-1"><Label className="text-sm">{label}</Label><div className="flex gap-2 items-center"><Input type="color" value={(themeColors as any)[key]} onChange={e => setThemeColors({ ...themeColors, [key]: e.target.value })} className="w-12 h-9 p-1 cursor-pointer" /><Input type="text" value={(themeColors as any)[key]} onChange={e => setThemeColors({ ...themeColors, [key]: e.target.value })} className="flex-1 font-mono text-sm" /></div></div>))}</div><div className="border-t border-border pt-4"><Label className="mb-2 block font-semibold flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" /> Grid Layout</Label><div className="flex items-center gap-2 max-w-xs"><span className="text-sm font-semibold">1 column per row (Fixed)</span></div><p className="text-xs text-muted-foreground mt-2">Display is locked to single column for optimal mobile experience.</p></div><div className="flex gap-3 pt-2"><Button variant="hero" onClick={saveThemeColors} disabled={savingTheme} className="flex-1">{savingTheme ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Theme</Button><Button variant="outline" onClick={resetToDefault} className="flex-1"><RotateCcw className="h-4 w-4 mr-1" />Reset</Button></div></CardContent></Card>
              <Card className="border-border"><CardHeader><CardTitle className="font-display text-base">Live Preview</CardTitle><p className="text-xs text-muted-foreground">This is exactly how your public store will look.</p></CardHeader><CardContent><div className="rounded-xl overflow-hidden border border-border" style={{ backgroundColor: themeColors.background, minHeight: 320 }}><div className="p-4" style={{ backgroundColor: themeColors.background }}><div className="text-center mb-3"><p className="font-bold text-sm" style={{ color: themeColors.primary }}>{store?.store_name || "Your Store Name"}</p><p className="text-xs mt-1" style={{ color: `${themeColors.primary}99` }}>{storeHeadline || "Your store headline"}</p></div><div className="grid gap-2 mt-3" style={{ gridTemplateColumns: `repeat(1, minmax(0, 1fr))` }}>{Array.from({ length: 2 }).map((_, i) => (<div key={i} className="rounded-lg p-2 text-center text-xs" style={{ backgroundColor: themeColors.card_background, border: `1px solid ${themeColors.primary}30` }}><div className="font-bold text-white text-sm">{[1, 2, 3, 4, 5, 6, 8, 10][i] || i + 1}GB</div><div className="text-xs mt-1" style={{ color: `${themeColors.primary}cc` }}>MTN</div><div className="text-xs" style={{ color: "#ccc" }}>GH₵ {(4 + i * 3).toFixed(2)}</div><div className="mt-1 rounded text-xs py-0.5 font-bold" style={{ backgroundColor: themeColors.primary, color: themeColors.primary_foreground }}>Buy</div></div>))}</div></div></div><p className="text-xs text-muted-foreground mt-2 text-center">1 column per row • Changes apply live after saving</p></CardContent></Card>
            </div>
          </TabsContent>

          {/* ============================= API KEY ============================= */}
          <TabsContent value="api-key" className="mt-0 space-y-4">
            {/* API Key Warning */}
            <Card className="border-red-500/50 bg-red-500/10">
              <CardHeader>
                <CardTitle className="text-base text-red-500">⚠️ Important: API Key Warning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-red-400 font-semibold">
                  Only generate an API key if you have your own data source and want to connect it to our platform.
                </p>
                <p className="text-muted-foreground">
                  API keys are for integrating external systems and sources. If you simply want to resell data, you don't need an API key.
                </p>
              </CardContent>
            </Card>

            {/* API Key Card */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  API Key
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use your API key to integrate with external applications and automate data purchases programmatically.
                </p>
                
                {loadingApiKey ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : apiKey ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input 
                        value={apiKey} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCopyApiKey}
                        className="gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded">
                      ⚠️ Keep this key secret. Never share it publicly.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowRegenerateConfirm(true)}
                      className="w-full gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Regenerate Key
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="hero" 
                    onClick={handleGenerateApiKey}
                    disabled={generatingApiKey}
                    className="w-full gap-2"
                  >
                    {generatingApiKey ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Generate API Key
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* API Packages Display */}
            {apiKey && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Available Packages for API
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">These are the packages you can purchase through your API integration.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    {["mtn", "airteltigo", "telecel"].map(net => (
                      <Button 
                        key={net} 
                        variant={networkFilter === net ? "hero" : "outline"} 
                        size="sm" 
                        onClick={() => setNetworkFilter(net)}
                      >
                        {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : net === "telecel" ? "Telecel" : ""}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {packages.filter(p => {
                      if (networkFilter === "airteltigo") {
                        return p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
                      }
                      return p.network === networkFilter;
                    }).map((pkg) => {
                      const apiPrice = Number(pkg.api_price || pkg.agent_price || pkg.price);
                      return (
                        <Card key={pkg.id} className="border-slate-700/50 bg-slate-900/5 hover:border-slate-600/50 transition-all">
                          <CardContent>
                            <p className="font-display text-lg font-bold text-foreground">{pkg.size_gb_text || pkg.size_gb + "GB"}</p>
                            <p className="text-lg font-bold text-cyan-400">GH₵ {apiPrice.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">API Price</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* API Contact Section */}
            {apiKey && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-base">Need Help with API?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Now that you've set up your API, contact us to learn more about integration options and technical support.
                  </p>
                  <a 
                    href={`https://wa.me/+233200511211?text=Hi,%20I%20am%20${encodeURIComponent(store?.name || 'Agent')}.%20I%20am%20contacting%20you%20to%20enquire%20about%20the%20API%20since%20I%20have%20set%20up%20my%20API%20and%20wanted%20to%20know%20more`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    Contact via WhatsApp
                  </a>
                </CardContent>
              </Card>
            )}

            {/* API Wallet Card */}
            {apiKey && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    API Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-lg border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">Wallet Balance</p>
                    <p className="text-2xl font-bold text-primary">GHC {wallet.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-2">Available for API purchases</p>
                  </div>
                  <Button 
                    onClick={() => setShowTopupDialog(true)}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Top Up Wallet
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Regenerate Confirmation Dialog */}
            <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Regenerate API Key?</DialogTitle>
                  <DialogDescription>
                    This will generate a new API key and invalidate your current key. Any applications using the old key will stop working. Are you sure?
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowRegenerateConfirm(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleGenerateApiKey}
                    disabled={generatingApiKey}
                    className="gap-2"
                  >
                    {generatingApiKey ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* API Wallet Top Up Dialog */}
            <WalletTopupDialog
              open={showTopupDialog}
              onOpenChange={setShowTopupDialog}
              currentBalance={wallet}
              walletType="api"
              apiKey={apiKey || undefined}
              identityId={store?.id}
              callbackUrl={`${window.location.origin}/agent?tab=api-key`}
            />
          </TabsContent>

          {/* ============================= SUBAGENTS ============================= */}
          <TabsContent value="subagents" className="mt-0 space-y-6">
            {/* Send Notification to Subagents - AT THE TOP */}
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-400" /> Send Notification to All Subagents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Send a popup notification that all your subagents will see when they open their dashboard.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Type your notification message..."
                    value={subagentNotificationMsg}
                    onChange={(e) => setSubagentNotificationMsg(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    variant="hero" 
                    onClick={sendSubagentNotification} 
                    disabled={sendingSubagentNotification || !subagentNotificationMsg.trim()}
                  >
                    {sendingSubagentNotification ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Send
                  </Button>
                </div>
                {subagentNotifications.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold">Recent Notifications Sent</p>
                    {subagentNotifications.slice(0, 3).map((n) => (
                      <div key={n.id} className="flex items-start justify-between p-3 bg-secondary/30 rounded-lg">
                        <div>
                          <p className="text-sm">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteSubagentNotification(n.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
                  <p className="text-3xl font-bold text-green-400">GH₵{subagentProfitForAgent.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-2">Total Orders from Subagents</p>
                  <p className="text-3xl font-bold text-blue-400">{subagentOrdersCount}</p>
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

                {/* Subagent Fee Settings */}
                {store?.allow_subagent_registration && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-green-400 mb-2">Subagent Registration Fee</p>
                          <p className="text-sm text-muted-foreground mb-4">Charge a one-time registration fee for new subagents. Turn off to allow free registration. if is turn on and subagent pay the money is added to your wallet automatically </p>
                        </div>
                        <Switch 
                          checked={store?.subagent_fee_enabled || false}
                          onCheckedChange={async (checked) => {
                            try {
                              const { error } = await supabase
                                .from('agent_stores')
                                .update({ subagent_fee_enabled: checked })
                                .eq('id', store?.id);
                              if (error) throw error;
                              setStore(prev => prev ? { ...prev, subagent_fee_enabled: checked } : null);
                              toast({ title: checked ? "Fee enabled" : "Fee disabled" });
                            } catch (error) {
                              console.error('Error updating fee setting:', error);
                              toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
                            }
                          }}
                        />
                      </div>

                      {store?.subagent_fee_enabled && (
                        <div className="border-t border-green-500/20 pt-4">
                          <Label className="text-sm font-semibold mb-2 block">Fee Amount (GH₵)</Label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="e.g., 10.00"
                              value={store?.subagent_fee_amount || ""}
                              onChange={(e) => {
                                const value = e.target.value === "" ? 0 : Number(e.target.value);
                                setStore(prev => prev ? { ...prev, subagent_fee_amount: value } : null);
                              }}
                              className="flex-1"
                            />
                            <Button 
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('agent_stores')
                                    .update({ subagent_fee_amount: store?.subagent_fee_amount || 0 })
                                    .eq('id', store?.id);
                                  if (error) throw error;
                                  toast({ title: "Fee updated", description: `Registration fee set to GH₵ ${store?.subagent_fee_amount?.toFixed(2)}` });
                                } catch (error) {
                                  console.error('Error updating fee:', error);
                                  toast({ title: "Error", description: "Failed to update fee", variant: "destructive" });
                                }
                              }}
                              className="gap-2"
                            >
                              <Save className="h-4 w-4" /> Save Fee
                            </Button>
                          </div>
                          <p className="text-xs text-green-400 mt-2">Subagents will need to pay this amount to register under your store.The money is added to your my wallet automatically when they pay</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <SubagentsList
                  agentStoreId={store?.id || ""}
                  subagents={subagents}
                  onRefresh={async () => {
                    const { data } = await supabase
                      .from("subagent_stores")
                      .select("*")
                      .eq("agent_store_id", store?.id);
                    if (data) setSubagents(data);
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
                <p className="text-sm text-muted-foreground mb-6">Set the base selling prices for subagents. These are the prices subagents will see and use as their starting point to set their own store prices. All subagents use these same prices.</p>
                <SubagentPricesManager
                  agentStoreId={store?.id || ""}
                  packages={packages}
                  agentPrices={agentPrices}
                  onPricesSaved={fetchAllData}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================= NOTIFICATIONS ============================= */}
          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card className="border-border"><CardHeader><CardTitle className="font-display flex items-center gap-2"><Bell className="h-5 w-5" /> Send Notification to Storefront</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Message</Label><Textarea placeholder="e.g., 🎉 Special offer: 20% off all bundles this weekend!" value={newNotificationMsg} onChange={e => setNewNotificationMsg(e.target.value)} rows={3} /></div><div className="space-y-2"><Label>Expiry (optional)</Label><Input type="datetime-local" value={newNotificationExpiry} onChange={e => setNewNotificationExpiry(e.target.value)} /><p className="text-xs text-muted-foreground">Leave empty for no expiry.</p></div><Button variant="hero" onClick={createNotification} disabled={sendingNotification}>{sendingNotification ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Send Notification</Button></CardContent></Card>
            <Card className="border-border"><CardHeader><CardTitle className="font-display">Active &amp; Past Notifications</CardTitle></CardHeader><CardContent>{loadingNotifications ? (<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>) : notifications.length === 0 ? (<p className="text-center text-muted-foreground py-8">No notifications yet.</p>) : (<div className="space-y-4">{notifications.map(n => (<div key={n.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-lg bg-card"><div className="flex-1"><p className="font-medium">{n.message}</p><div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1"><span>Created: {new Date(n.created_at).toLocaleString()}</span>{n.expires_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Expires: {new Date(n.expires_at).toLocaleString()}</span>}</div></div><div className="flex gap-2"><Badge variant={n.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleNotificationActive(n.id, n.is_active)}>{n.is_active ? "Active" : "Inactive"}</Badge><Button variant="ghost" size="icon" onClick={() => deleteNotification(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>))}</div>)}</CardContent></Card>
          </TabsContent>

          {/* ============================= COMPLAINTS ============================= */}
          <TabsContent value="complaints" className="mt-0 space-y-6">
            <ComplaintsManager isAgent={true} agentStoreId={store?.id} />
          </TabsContent>

          {/* ============================= AFA BUNDLES ============================= */}
          <TabsContent value="afa" className="mt-0 space-y-6">
            {/* AFA Profit Card */}
            {store && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    Your AFA Bundle Profit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-muted-foreground mb-1">Your Set Price</p>
                      <p className="text-2xl font-bold text-blue-600">₵{(store.afa_bundle_price || 0).toFixed(2)}</p>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-muted-foreground mb-1">Profit Per Registration</p>
                      <p className="text-2xl font-bold text-green-600">
                        ₵{Math.max(0, (store.afa_bundle_price || 0) - 15).toFixed(2)}
                      </p>
                      <p className="text-xs text-green-600 mt-2">
                        Your profit is automatically credited to your wallet when registrations are completed.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 p-3 rounded">
                    Your profit = Your set price (₵{(store.afa_bundle_price || 0).toFixed(2)}) - Base price (₵15.00)
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ============================= API KEY ============================= */}
            <Card className="border-border mt-6">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  API Key
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use your API key to integrate with external applications and automate data purchases.
                </p>
                
                {loadingApiKey ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : apiKey ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Input 
                          value={apiKey} 
                          readOnly 
                          className="font-mono text-xs pr-10"
                        />
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCopyApiKey}
                        className="gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                      ⚠️ Keep this key secret. Never share it publicly.
                    </p>
                  </div>
                ) : (
                  <Button 
                    variant="hero" 
                    onClick={handleGenerateApiKey}
                    disabled={generatingApiKey}
                    className="w-full gap-2"
                  >
                    {generatingApiKey ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Generate API Key
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
            
            <Tabs value={afaTabActive} onValueChange={setAfaTabActive} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="registrations">Bundle Registrations</TabsTrigger>
              </TabsList>

              <TabsContent value="pricing" className="space-y-6 mt-4">
                <AgentAFAPriceManager onPriceSaved={refetchStoreData} />
              </TabsContent>

              <TabsContent value="registrations" className="space-y-6 mt-4">
                {store && <AgentAFABundleRegistrations agentStoreId={store.id} primaryColor={themeColors?.primaryColor || "#000000"} />}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ============================= SETTINGS ============================= */}
          <TabsContent value="settings" className="mt-0">
            <Card className="border-border"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="font-display">Store Information</CardTitle>{!editingStore && <Button variant="outline" size="sm" onClick={() => setEditingStore(true)}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>}</CardHeader><CardContent className="space-y-4">{editingStore ? (<><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-2"><Label>Store Name</Label><Input value={storeForm.store_name} onChange={e => setStoreForm({ ...storeForm, store_name: e.target.value })} /></div><div className="space-y-2"><Label>WhatsApp Number</Label><Input value={storeForm.whatsapp_number} onChange={e => setStoreForm({ ...storeForm, whatsapp_number: e.target.value })} /></div><div className="space-y-2"><Label>Support Number <span className="text-xs text-primary font-normal">(shown on flyer footer)</span></Label><Input value={storeForm.support_number} onChange={e => setStoreForm({ ...storeForm, support_number: e.target.value })} /></div><div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between gap-4 flex-wrap"><Label>WhatsApp Group / Channel Link</Label><div className="flex items-center gap-2"><Label htmlFor="show-group-icon" className="text-sm text-muted-foreground cursor-pointer">Show join icon on storefront</Label><Switch id="show-group-icon" checked={storeForm.show_whatsapp_group_icon} onCheckedChange={c => setStoreForm({ ...storeForm, show_whatsapp_group_icon: c })} /></div></div><Input value={storeForm.whatsapp_group} onChange={e => setStoreForm({ ...storeForm, whatsapp_group: e.target.value })} placeholder="Paste the WhatsApp link here" /><p className="text-xs text-muted-foreground">{storeForm.show_whatsapp_group_icon ? "The WhatsApp join icon will appear on your storefront." : "The join icon will be hidden."}</p></div><div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between gap-4 flex-wrap"><Label>USSD Access Code</Label><div className="flex items-center gap-2"><Label htmlFor="show-ussd" className="text-sm text-muted-foreground cursor-pointer">Show USSD on storefront</Label><Switch id="show-ussd" checked={storeForm.show_ussd_on_storefront} onCheckedChange={c => setStoreForm({ ...storeForm, show_ussd_on_storefront: c })} /></div></div><p className="text-xs text-muted-foreground">{storeForm.show_ussd_on_storefront ? "The USSD code (*380*455#) and your access code will be displayed on your storefront." : "USSD information will be hidden from your storefront."}</p></div><div className="space-y-2"><Label>MoMo Name</Label><Input value={storeForm.momo_name} onChange={e => setStoreForm({ ...storeForm, momo_name: e.target.value })} /></div><div className="space-y-2"><Label>MoMo Number</Label><Input value={storeForm.momo_number} onChange={e => setStoreForm({ ...storeForm, momo_number: e.target.value })} /></div><div className="space-y-2"><Label>MoMo Network</Label><Input value={storeForm.momo_network} onChange={e => setStoreForm({ ...storeForm, momo_network: e.target.value })} placeholder="mtn / airteltigo / telecel" /></div></div><div className="flex gap-2 pt-2"><Button variant="hero" size="sm" onClick={saveStoreInfo} disabled={savingStore}><Save className="h-4 w-4 mr-1" />{savingStore ? "Saving..." : "Save Changes"}</Button><Button variant="outline" size="sm" onClick={() => setEditingStore(false)}>Cancel</Button></div></>) : (<div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">Store Name</p><p className="font-semibold">{store?.store_name}</p></div><div><p className="text-muted-foreground">WhatsApp</p><p className="font-semibold">{store?.whatsapp_number}</p></div><div><p className="text-muted-foreground">Support Number</p><p className="font-semibold">{store?.support_number}</p></div><div><p className="text-muted-foreground">WhatsApp Group</p><p className="font-semibold">{store?.whatsapp_group || "Not set"}</p></div><div><p className="text-muted-foreground">Show Group Icon</p><p className="font-semibold">{store?.show_whatsapp_group_icon !== false ? "Yes (default)" : "No"}</p></div><div><p className="text-muted-foreground">MoMo Name</p><p className="font-semibold">{store?.momo_name}</p></div><div><p className="text-muted-foreground">MoMo Number</p><p className="font-semibold">{store?.momo_number}</p></div><div><p className="text-muted-foreground">MoMo Network</p><p className="font-semibold">{store?.momo_network?.toUpperCase()}</p></div><div className="col-span-2"><p className="text-muted-foreground">Topup Reference</p><p className="font-display text-xl font-bold text-primary">{store?.topup_reference}</p></div></div>)}</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={buyDialogOpen} onOpenChange={v => !v && setBuyDialogOpen(false)}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader><DialogTitle className="font-display text-xl">{buyPkg?.network === "special-mtn" ? `Buy ${(buyPkg as any).mins || 0} mins + ${buyPkg?.size_gb}GB` : `Buy ${buyPkg?.size_gb}GB ${buyPkg?.network.toUpperCase()}`}</DialogTitle><DialogDescription>Purchase {buyPkg?.network === "special-mtn" ? "minutes + data" : "data"} at agent price</DialogDescription></DialogHeader>
          {buyStep === "phone" ? (
            <div className="space-y-4 pt-2"><div className="space-y-2"><Label>Recipient Phone Number (exactly 10 digits)</Label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="tel" placeholder="0XX XXX XXXX" maxLength={10} value={buyPhone} onChange={e => setBuyPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className={`pl-10 ${buyPhone.length > 0 && buyPhone.length < 10 ? "border-red-500 focus-visible:ring-red-500" : ""}`} autoFocus /></div>{buyPhone.length > 0 && buyPhone.length < 10 && (<p className="text-xs text-red-500">{10 - buyPhone.length} digit{10 - buyPhone.length !== 1 ? "s" : ""} remaining</p>)}<NetworkIndicator phone={buyPhone} /></div><Button variant="hero" className="w-full" onClick={() => { if (!isValidPhoneLength(buyPhone)) { toast({ title: "Phone number must be exactly 10 digits", variant: "destructive" }); return; } const detected = detectNetwork(buyPhone); if ((buyPkg?.network === "mtn_mashup" || buyPkg?.network === "mashup") && detected !== "mtn") { toast({ title: "MTN Only", description: `This package is only available for MTN numbers. This appears to be ${detected.toUpperCase()}.`, variant: "destructive" }); return; } if (buyPkg?.network && buyPkg.network !== "mtn_mashup" && buyPkg.network !== "mashup" && !phoneMatchesNetwork(buyPhone, buyPkg?.network || "")) { toast({ title: "Network mismatch", description: `This phone number appears to be ${detected.toUpperCase()}, but you selected ${buyPkg?.network.toUpperCase()} package`, variant: "destructive" }); return; } setBuyStep("confirm"); }}>Continue</Button></div>
          ) : (
            <div className="space-y-4 pt-2"><div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
              <>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Package</span><span className="font-semibold">{buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Phone</span><span className="font-semibold">{buyPhone}</span></div>
              </>
            <div className="border-t border-border my-1" /><div className="flex justify-between text-base font-bold"><span>Agent Price</span><span className="text-primary">GH₵ {Number(buyPkg?.agent_price ?? 0).toFixed(2)}</span></div></div>{hasPendingWithdrawal && (<div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-xs text-orange-400">⚠���� You have a pending withdrawal of GH₵ {pendingWithdrawalAmount.toFixed(2)}. Wallet balance after buying must not drop below this amount.</div>)}<div className="space-y-2"><Label>Payment Method</Label><Select value={buyPaymentMethod} onValueChange={v => setBuyPaymentMethod(v as "paystack" | "wallet")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="wallet"><span className="flex items-center gap-2"><Wallet className="h-4 w-4" />Wallet (GH�� {store?.wallet_balance?.toFixed(2) ?? "0.00"})</span></SelectItem><SelectItem value="paystack"><span className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Paystack (+ charges)</span></SelectItem></SelectContent></Select></div><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setBuyStep("phone")} disabled={buyLoading}>Back</Button><Button variant="hero" className="flex-1" onClick={handleBuyConfirm} disabled={buyLoading}>{buyLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Processing...</> : "Confirm Purchase"}</Button></div></div>
          )}
        </DialogContent>
      </Dialog>
      
      <ChatBot page="agent-dashboard" />
    </div>
  );
};

export default AgentDashboard;
