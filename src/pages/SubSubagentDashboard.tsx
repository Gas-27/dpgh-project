import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Store, Settings, LogOut, BarChart3, ShoppingCart, ArrowDownToLine, Copy,
  ExternalLink, Wallet, Loader2, Edit2, Save, Phone, Menu, Image, Bell, Palette, Percent, AlertTriangle, ShieldAlert,
  ChevronUp, ChevronDown, BookOpen, Search, TrendingUp, Plus, Minus, LayoutGrid, RotateCcw, Zap,
  Users, DollarSign, Send, Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import NetworkIndicator from "@/components/NetworkIndicator";
import { detectNetwork, phoneMatchesNetwork, isValidPhoneLength } from "@/lib/phoneUtils";
import { Switch } from "@/components/ui/switch";
import FlyerGenerator from "@/components/FlyerGenerator";
// COMMENTED OUT: mashup packages deactivated
// import MashupFlyerGenerator from "@/components/MashupFlyerGenerator";
import SubagentYouTubeSection from "@/components/SubagentYouTubeSection";
import { DOMAINS } from "@/config/domains";
import ChatBot from "@/components/ChatBot";

// Helper function to get current order stage
function getOrderStatusLabel(status: string): string {
  switch ((status || "").toLowerCase().trim()) {
    case "pending":    return "Waiting for Portal";
    case "processing": return "Processing";
    case "waiting":    return "Waiting";
    case "delivered":  return "Delivered";
    case "failed":     return "Failed";
    case "refunded":   return "Refunded";
    default:           return status || "Pending";
  }
}

function getOrderStage(order: any): string {
  const orderStatus = order.order_status?.toLowerCase().trim() || "";
  return getOrderStatusLabel(orderStatus);
}

interface SubagentStore {
  id: string;
  store_name: string;
  whatsapp_number?: string;
  support_number?: string;
  momo_number?: string;
  momo_name?: string;
  momo_network?: string;
  wallet_balance: number;
  approved: boolean;
  agent_store_id: string;
  created_at: string;
  theme_config?: any;
  store_headline?: string;
  whatsapp_group?: string;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  status: string;
  fulfillment_status: string;
  order_status: string;
  created_at: string;
  package_id?: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

// Default theme
const DEFAULT_THEME = { primary: "#38bdf8", primary_foreground: "#000000", background: "#0a0a0a", card_background: "#171717", gridColumns: 2 };

// Instruction manual sections
const MANUAL_SECTIONS = [
  { icon: "📊", title: "Overview", content: `Your dashboard home. See wallet balance, total revenue, pending orders, and store status at a glance.\n\n• Wallet Balance – funds available to withdraw\n• Total Revenue – sum of all completed orders\n• Pending Orders – orders awaiting fulfillment` },
  { icon: "🛒", title: "Buy Data", content: `Purchase data bundles at your agent's base price to resell in your store.\n\n• Select network (MTN, AirtelTigo, Telecel)\n• Choose package size\n• Enter customer number\n• Confirm purchase` },
  { icon: "💰", title: "Store Prices", content: `Set your selling prices for each data package.\n\n• Cost from Agent = what your agent charges you\n• Your Selling Price = what customers pay you\n• Profit = Your Selling Price - Cost from Agent\n\nUse markup to increase all prices by a percentage.` },
  { icon: "📦", title: "Orders", content: `View all customer orders.\n\n• Track order status (pending, completed, failed)\n• See customer details and amounts\n• Monitor your sales history` },
  { icon: "💸", title: "Withdraw", content: `Cash out your wallet balance to your MoMo account.\n\n• Minimum withdrawal: GHC 10.00\n• Only one pending withdrawal at a time\n• Processed within 24 hours` },
  { icon: "🎨", title: "Flyer Generator", content: `Create promotional flyers for your store.\n\n• Customize colors and design\n• Add your store name and contact\n• Download or share to WhatsApp` },
  { icon: "🎨", title: "Appearance", content: `Customize your store appearance.\n\n• Change primary color\n• Update store banner\n• Modify theme settings` },
  { icon: "⚙️", title: "Settings", content: `Manage your store information.\n\n• Store Name\n• WhatsApp Number\n• Support Number` },
];

const SubSubagentDashboard = () => {
  const { signOut, user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Check if admin is impersonating (via token or localStorage)
  const getImpersonationData = () => {
    if (typeof window === 'undefined') return { storeId: null, storeName: null };
    
    // Check URL params first (for cross-domain admin impersonation)
    const adminToken = searchParams.get("admin_token");
    if (adminToken) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(adminToken)));
        if (decoded.timestamp && Date.now() - decoded.timestamp < 3600000) {
          // Store in localStorage for subsequent navigations and remove from URL
          localStorage.setItem("admin_impersonate_subsubagent", decoded.userId || "");
          localStorage.setItem("admin_impersonate_subsubagent_store", decoded.storeId || "");
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return { storeId: decoded.storeId, storeName: decoded.storeName };
        }
      } catch (e) {
        console.error("Invalid admin token");
      }
    }
    
    // Fall back to localStorage
    const storeId = localStorage.getItem("admin_impersonate_subsubagent_store");
    return storeId ? { storeId, storeName: null } : { storeId: null, storeName: null };
  };

  const impersonationData = getImpersonationData();
  const [isImpersonating] = useState(() => !!impersonationData.storeId);
  
  const exitImpersonation = () => {
    localStorage.removeItem("admin_impersonate_subsubagent");
    localStorage.removeItem("admin_impersonate_subsubagent_store");
    window.location.href = "/admin";
  };

  // For sub-subagents, we support store_id from URL (for registration redirect)
  const storeIdFromUrl = searchParams.get("store_id");

  const [subagentStore, setSubagentStore] = useState<SubagentStore | null>(null);
  const [parentSubagentStoreName, setParentSubagentStoreName] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [storeForm, setStoreForm] = useState<Partial<SubagentStore>>({});
  const [saving, setSaving] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [basePrices, setBasePrices] = useState<Record<string, number>>({});
  // What the parent SUBAGENT pays their AGENT per package (the agent->subagent price).
  // Kept separate from basePrices so wallet purchases can split profit across all 3 tiers.
  const [agentToSubagentCost, setAgentToSubagentCost] = useState<Record<string, number>>({});
  const [subagentPrices, setSubagentPrices] = useState<Record<string, number>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({});
  const [markupPercent, setMarkupPercent] = useState("");
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [savingPrices, setSavingPrices] = useState(false);
  // Wallet top-up (Paystack) state
  const [paystackTopupAmount, setPaystackTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupHistory, setTopupHistory] = useState<{ id: string; amount: number; paystack_reference: string | null; created_at: string }[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [openManualSection, setOpenManualSection] = useState<number | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [buyingPkg, setBuyingPkg] = useState<any>(null);
  const [buyCustomerNumber, setBuyCustomerNumber] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [newNotificationMsg, setNewNotificationMsg] = useState("");
  const [newNotificationExpiry, setNewNotificationExpiry] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [themeColors, setThemeColors] = useState(DEFAULT_THEME);
  const [savingTheme, setSavingTheme] = useState(false);
  const [storeHeadline, setStoreHeadline] = useState("");
  const [savingHeadline, setSavingHeadline] = useState(false);

  
  // Pagination for orders
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 50; // Changed from 100 to 50 for "Load More" functionality
  
  // Date filtering for orders/revenue/profit
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week" | "month" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showRefundedOnly, setShowRefundedOnly] = useState(false);
  
  // Notification popup state
  const [showSubagentNotificationPopup, setShowSubagentNotificationPopup] = useState(true);
  const [subSubagentNotifications, setSubSubagentNotifications] = useState<any[]>([]);

  // Helper function to get available wallet balance
  // Uses the actual wallet_balance from database, minus any pending withdrawals
  const getAvailableBalance = () => {
    const dbBalance = subagentStore?.wallet_balance || 0;
    // Deduct pending withdrawals from available balance
    const pendingWithdrawals = withdrawals.filter(w => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);
    return dbBalance - pendingWithdrawals;
  };

  useEffect(() => {
    // For sub-subagents: use store_id from URL (after registration) or user's stored data
    // Or use impersonation data if admin is impersonating
    if (impersonationData?.storeId) {
      fetchData(undefined, impersonationData.storeId);
    } else if (storeIdFromUrl) {
      fetchData(undefined, storeIdFromUrl);
    } else if (user?.id) {
      fetchData(user.id);
    }
  }, [user?.id, storeIdFromUrl, impersonationData?.storeId]);

  // Remember the store id we successfully loaded so that argument-less fetchData() calls
  // always reload by store id (not user-id) to avoid "Store not found" errors.
  const loadedStoreIdRef = useRef<string | null>(null);
  // NOTE: We intentionally do NOT recalculate and sync wallet_balance from the frontend.
  // The wallet is maintained exclusively by server-side functions (paystack-webhook and
  // verify-payment) to prevent the frontend from overwriting valid server-set balances
  // (e.g. topups would be wiped if orders have profit=0 due to a pricing issue).

  // Real-time wallet balance updates
  useEffect(() => {
    if (!subagentStore?.id) return;

    // Subscribe to wallet balance updates in real-time
    const walletChannel = supabase
      .channel(`sub-subagent-wallet-${subagentStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sub_subagent_stores",
          filter: `id=eq.${subagentStore.id}`,
        },
        (payload: any) => {
          const newData = payload.new as any;
          if (newData && newData.wallet_balance !== undefined) {
            setSubagentStore((prev) =>
              prev
                ? { ...prev, wallet_balance: newData.wallet_balance }
                : prev
            );
          }
        }
      )
      .subscribe();

    // Also subscribe to order changes to update wallet in real-time
    const ordersChannel = supabase
      .channel(`sub-subagent-orders-wallet-${subagentStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `sub_subagent_store_id=eq.${subagentStore.id}`,
        },
        () => {
          // Re-fetch orders to update wallet calculation
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to withdrawal changes
    const withdrawalsChannel = supabase
      .channel(`sub-subagent-withdrawals-wallet-${subagentStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
          filter: `sub_subagent_store_id=eq.${subagentStore.id}`,
        },
        () => {
          // Re-fetch data to update wallet
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(withdrawalsChannel);
    };
  }, [subagentStore?.id]);

  // Auto-refresh DISABLED - Users can manually refresh with browser refresh button
  // Previously this would auto-refresh wallet balance and orders every 1 second
  // This was disabled because it was causing unnecessary page updates and was annoying when users were editing data
  // Users can still manually refresh the page with Cmd+R / Ctrl+R or use the browser's refresh button

  // Fetch wallet top-up history
  const fetchTopupHistory = async () => {
    if (!subagentStore?.id) return;
    const { data } = await supabase
      .from("sub_subagent_wallet_topups")
      .select("id, amount, paystack_reference, created_at")
      .eq("sub_subagent_store_id", subagentStore.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTopupHistory(data || []);
  };

  useEffect(() => {
    if (subagentStore?.id) fetchTopupHistory();
  }, [subagentStore?.id]);

  // Paystack wallet top up
  const handlePaystackTopup = async () => {
    const amount = Number(paystackTopupAmount);
    if (!amount || amount < 1) {
      toast({ title: "Invalid amount", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!user?.email || !subagentStore?.id) {
      toast({ title: "Error", description: "Please log in to top up", variant: "destructive" });
      return;
    }
    setTopupLoading(true);
    try {
      const res = await supabase.functions.invoke("initialize-payment", {
        body: {
          amount,
          email: user.email,
          phone: subagentStore.support_number || subagentStore.whatsapp_number || "0000000000",
          // Include store_id in callback so page can load store by ID directly
          // after Paystack redirects back, avoiding the user_id lookup that fails
          // when user_id is not set on the sub_subagent_stores record.
          callback_url: `https://${DOMAINS.SUBAGENT_STORE}/sub-subagent-dashboard?store_id=${subagentStore.id}`,
          metadata: {
            type: "subsubagent_wallet_topup",
            subsubagent_store_id: subagentStore.id,
            amount,
          },
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (!res.data?.authorization_url) throw new Error("No authorization URL");
      // Also stash the store ID so the post-redirect effect can find it
      sessionStorage.setItem("pending_subsubagent_wallet_topup", res.data.reference);
      sessionStorage.setItem("pending_subsubagent_topup_store_id", subagentStore.id);
      window.location.href = res.data.authorization_url;
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    } finally {
      setTopupLoading(false);
    }
  };

  // Check for pending wallet topup from URL params (Paystack callback).
  // Persist the reference in sessionStorage so it survives even if the effect
  // fires before the store finishes loading; the dependency on subagentStore?.id
  // guarantees we retry once the store is available.
  useEffect(() => {
    // Capture URL reference immediately and stash it (before store is ready)
    const urlParams = new URLSearchParams(window.location.search);
    const urlRef = urlParams.get("reference") || urlParams.get("trxref");
    if (urlRef) {
      sessionStorage.setItem("pending_subsubagent_wallet_topup", urlRef);
      // Clean the URL so a page refresh doesn't re-trigger
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!subagentStore?.id) return;
    const ref = sessionStorage.getItem("pending_subsubagent_wallet_topup");
    if (!ref) return;
    // Clear both items to prevent double-processing on re-renders
    sessionStorage.removeItem("pending_subsubagent_wallet_topup");
    sessionStorage.removeItem("pending_subsubagent_topup_store_id");
    supabase.functions.invoke("verify-payment", { body: { reference: ref } })
      .then(({ data }) => {
        if (data?.success && !data?.already_processed) {
          toast({ title: "Wallet topped up!", description: data.message || "Your wallet has been credited." });
        } else if (data?.already_processed) {
          toast({ title: "Wallet topped up!", description: "Your wallet has been credited." });
        }
        // Refresh wallet balance and history from DB
        fetchData();
        fetchTopupHistory();
      })
      .catch(() => {
        // Even on error, refresh in case webhook already handled it
        fetchData();
        fetchTopupHistory();
      });
  }, [subagentStore?.id]);

  const fetchData = async (userId?: string, storeId?: string) => {
    try {
      setLoading(true);
      setLoadError(null);

      // Resolve the store id to load. When fetchData() is called with no args
      // (realtime handlers, post-save refresh), fall back to the impersonation id,
      // the URL id, or the last successfully-loaded store id so we never drop into
      // the user-id branch and wrongly show "Store not found".
      const resolvedStoreId =
        storeId ||
        (!userId
          ? (impersonationData?.storeId || storeIdFromUrl || loadedStoreIdRef.current || undefined)
          : undefined);

      // If we have a resolved store id, load directly by id
      if (resolvedStoreId) {
        console.log("[v0] SubagentDashboard - Loading by storeId:", resolvedStoreId);
        const { data: storeData, error: storeErr } = await supabase
          .from("sub_subagent_stores")
          .select("id, store_name, whatsapp_number, support_number, momo_number, momo_name, momo_network, wallet_balance, approved, created_at, whatsapp_group, updated_at, subagent_store_id, agent_store_id, topup_reference")
          .eq("id", resolvedStoreId)
          .single();

        if (storeErr || !storeData) {
          console.error("[v0] Error fetching subagent store by ID:", storeErr);
          setLoadError("Failed to load your store. Please refresh the page or try again.");
          setLoading(false);
          return;
        }

        const store = storeData;
        console.log("[v0] Loaded store:", store.store_name, "with id:", store.id);
        loadedStoreIdRef.current = store.id;
        setSubagentStore(store);
        setStoreForm(store);
        setLoadError(null);

        // Run all other queries in parallel for faster loading
        console.log("[v0] Starting parallel data queries for store:", store.id);
        const [
          ordersResult,
          withdrawResult,
          packagesResult,
          subagentPricesResult,
          parentSubagentResult,
          parentTemplatePricesResult,
          parentSubagentCostResult
        ] = await Promise.all([
          supabase.from("orders").select("*", { count: "exact" }).eq("sub_subagent_store_id", store.id).order("created_at", { ascending: false }).range(0, 99999999),
          supabase.from("withdrawal_requests").select("*").eq("sub_subagent_store_id", store.id).order("created_at", { ascending: false }),
          supabase.from("data_packages").select("*").order("size_gb"),
          supabase.from("sub_subagent_package_prices").select("package_id, sell_price").eq("sub_subagent_store_id", store.id),
          store.subagent_store_id ? supabase.from("subagent_stores").select("store_name").eq("id", store.subagent_store_id).single() : Promise.resolve({ data: null, error: null }),
          store.subagent_store_id ? supabase.from("sub_subagent_package_prices").select("package_id, base_price, sell_price").eq("subagent_store_id", store.subagent_store_id).is("sub_subagent_store_id", null) : Promise.resolve({ data: null, error: null }),
          // Parent subagent's OWN cost = the AGENT's base price to subagents (base_price is
          // keyed by agent_store_id). Fallback when the subagent has not set a sub-subagent price.
          store.agent_store_id ? supabase.from("subagent_package_prices").select("package_id, base_price").eq("agent_store_id", store.agent_store_id) : Promise.resolve({ data: null, error: null })
        ]);
        console.log("[v0] Parallel queries completed");

        setOrders(ordersResult.data || []);
        setTotalOrderCount(ordersResult.count ?? (ordersResult.data?.length || 0));
        setWithdrawals(withdrawResult.data || []);
        setPackages(packagesResult.data || []);
        
        // Set parent subagent store name if available
        if (parentSubagentResult.data?.store_name) {
          setParentSubagentStoreName(parentSubagentResult.data.store_name);
        }
        
        // Build base prices = "Cost from Agent" for this sub-subagent.
        // Priority (lowest → highest):
        //   1. admin/default package price (ultimate fallback)
        //   2. parent subagent's OWN base cost (what the subagent pays their agent) —
        //      this is what should show when the subagent has NOT set a sub-subagent price
        //   3. parent subagent's sub-subagent template price (sub_subagent_store_id IS NULL)
        const basePriceMap: Record<string, number> = {};
        // 1. Ultimate fallback: admin/default package price
        (packagesResult.data || []).forEach((p: any) => {
          basePriceMap[p.id] = p.price;
        });
        // 2. Fall back to the parent subagent's own cost from their agent.
        //    Also record it separately (agent->subagent price) for 3-tier profit split.
        const agentToSubMap: Record<string, number> = {};
        (parentSubagentCostResult.data || []).forEach((p: any) => {
          if (p.base_price !== null && p.base_price !== undefined) {
            basePriceMap[p.package_id] = Number(p.base_price);
            agentToSubMap[p.package_id] = Number(p.base_price);
          }
        });
        setAgentToSubagentCost(agentToSubMap);
        // 3. Override with the parent subagent's sub-subagent template price (highest priority)
        (parentTemplatePricesResult.data || []).forEach((p: any) => {
          if (p.base_price !== null && p.base_price !== undefined) {
            basePriceMap[p.package_id] = Number(p.base_price);
          }
        });
        setBasePrices(basePriceMap);
        
        // Build subagent prices
        const subagentPriceMap: Record<string, number> = {};
        (subagentPricesResult.data || []).forEach((p: any) => {
          if (p.sell_price !== null && p.sell_price !== undefined) {
            subagentPriceMap[p.package_id] = Number(p.sell_price);
          }
        });
        setSubagentPrices(subagentPriceMap);
        setLoading(false);

      } else {
        // Normal flow - filter by user_id
        const effectiveUserId = userId || user?.id;
        console.log("[v0] SubagentDashboard - fetchData called with effectiveUserId:", effectiveUserId);
        if (!effectiveUserId) {
          setLoadError("Authentication error. Please log in again.");
          setLoading(false);
          return;
        }

        // Fetch subsubagent store first (needed for other queries)
        // Filter by user_id to ensure each subsubagent only sees their own store
        console.log("[v0] Querying sub_subagent_stores with user_id:", effectiveUserId);
        const { data: storeData, error: storeErr } = await supabase
          .from("sub_subagent_stores")
          .select("id, store_name, whatsapp_number, support_number, momo_number, momo_name, momo_network, wallet_balance, approved, created_at, whatsapp_group, updated_at, subagent_store_id, agent_store_id, topup_reference")
          .eq("user_id", effectiveUserId)
          .order("created_at", { ascending: false });

        console.log("[v0] Store query result - error:", storeErr, "count:", storeData?.length);
        if (storeErr) {
          console.error("[v0] Error fetching sub_subagent store:", storeErr);
          setLoadError("Failed to load your store. Please refresh the page or try again.");
          setLoading(false);
          return;
        }

        if (!storeData || storeData.length === 0) {
          console.warn("[v0] No sub_subagent store found for user_id:", effectiveUserId);
          setLoadError("Store not found. Your registration may still be pending. Please contact your parent agent to complete the registration process.");
          setLoading(false);
          return;
        }

        const store = storeData[0];
        console.log("[v0] Loaded store:", store.store_name, "with id:", store.id);
        loadedStoreIdRef.current = store.id;
        setSubagentStore(store);
        setStoreForm(store);
        setLoadError(null);

        // Run all other queries in parallel for faster loading
        const [
          ordersResult,
          withdrawResult,
          packagesResult,
          subagentPricesResult,
          parentSubagentResult,
          parentPricesResult,
          parentTemplatePricesResult,
          parentSubagentCostResult
        ] = await Promise.all([
          supabase.from("orders").select("*", { count: "exact" }).eq("sub_subagent_store_id", store.id).order("created_at", { ascending: false }).range(0, 99999999),
          supabase.from("withdrawal_requests").select("*").eq("sub_subagent_store_id", store.id).order("created_at", { ascending: false }),
          supabase.from("data_packages").select("*").order("size_gb"),
          supabase.from("sub_subagent_package_prices").select("package_id, sell_price").eq("sub_subagent_store_id", store.id),
          store.subagent_store_id ? supabase.from("subagent_stores").select("store_name").eq("id", store.subagent_store_id).single() : Promise.resolve({ data: null, error: null }),
          store.subagent_store_id ? supabase.from("sub_subagent_package_prices").select("package_id, base_price").eq("subagent_store_id", store.subagent_store_id).eq("sub_subagent_store_id", store.id) : Promise.resolve({ data: null, error: null }),
          store.subagent_store_id ? supabase.from("sub_subagent_package_prices").select("package_id, base_price, sell_price").eq("subagent_store_id", store.subagent_store_id).is("sub_subagent_store_id", null) : Promise.resolve({ data: null, error: null }),
          // Parent subagent's OWN cost = the AGENT's base price to subagents.
          // base_price in subagent_package_prices is keyed by agent_store_id (rows keyed by
          // subagent_store_id only hold sell_price). This is the subagent's cost from their
          // agent, used as the fallback when the subagent has not set a sub-subagent price.
          store.agent_store_id ? supabase.from("subagent_package_prices").select("package_id, base_price").eq("agent_store_id", store.agent_store_id) : Promise.resolve({ data: null, error: null })
        ]);

        setOrders(ordersResult.data || []);
        setTotalOrderCount(ordersResult.count ?? (ordersResult.data?.length || 0));
        setWithdrawals(withdrawResult.data || []);
        setPackages(packagesResult.data || []);
        
        // Set parent subagent store name if available
        if (parentSubagentResult.data?.store_name) {
          setParentSubagentStoreName(parentSubagentResult.data.store_name);
        }
        
        // Build base prices = "Cost from Agent" for this sub-subagent.
        // Priority (lowest → highest):
        //   1. admin/default package price (ultimate fallback)
        //   2. parent subagent's OWN base cost (what the subagent pays their agent) —
        //      this is what should show when the subagent has NOT set a sub-subagent price
        //   3. parent subagent's sub-subagent template price (sub_subagent_store_id IS NULL)
        const basePriceMap: Record<string, number> = {};
        // 1. Ultimate fallback: admin/default package price
        (packagesResult.data || []).forEach((p: any) => {
          basePriceMap[p.id] = p.price;
        });
        // 2. Fall back to the parent subagent's own cost from their agent.
        //    Also record it separately (agent->subagent price) for 3-tier profit split.
        const agentToSubMap: Record<string, number> = {};
        (parentSubagentCostResult.data || []).forEach((p: any) => {
          if (p.base_price !== null && p.base_price !== undefined) {
            basePriceMap[p.package_id] = Number(p.base_price);
            agentToSubMap[p.package_id] = Number(p.base_price);
          }
        });
        setAgentToSubagentCost(agentToSubMap);
        // 3. Override with the parent subagent's sub-subagent template price (highest priority)
        (parentTemplatePricesResult.data || []).forEach((p: any) => {
          if (p.base_price !== null && p.base_price !== undefined) {
            basePriceMap[p.package_id] = Number(p.base_price);
          }
        });
        setBasePrices(basePriceMap);
        
        // Build sub-subagent's own sell prices map
        const subagentPriceMap: Record<string, number> = {};
        (subagentPricesResult.data || []).forEach((p: any) => {
          if (p.sell_price !== null && p.sell_price !== undefined) {
            subagentPriceMap[p.package_id] = Number(p.sell_price);
          }
        });
        setSubagentPrices(subagentPriceMap);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: "Failed to load dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Notification functions
  const fetchNotifications = async () => {
    if (!subagentStore?.id) return;
    setLoadingNotifications(true);
    try {
      const { data, error } = await supabase
        .from("sub_subagent_storefront_notifications")
        .select("*")
        .eq("sub_subagent_store_id", subagentStore.id)
        .order("created_at", { ascending: false });
      if (!error && data) setNotifications(data);
      if (error) console.warn("[v0] Error fetching notifications:", error);
    } catch (e) {
      console.warn("[v0] Exception fetching notifications:", e);
    }
    setLoadingNotifications(false);
  };

  // NOTE: agent_to_subagent_notifications are intentionally NOT fetched here.
  // Those are broadcasts from the agent to their DIRECT subagents and must only
  // appear in the SubagentDashboard, not leak into the sub-subagent view.

  useEffect(() => {
    if (subagentStore?.id) {
      fetchNotifications();
      fetchSubSubagentNotifications();
    }
  }, [subagentStore?.id]);



  // Realtime subscriptions DISABLED - No longer auto-refresh on changes
  // Previously this would trigger fetchData() on any database updates (orders, prices, etc.)
  // This was causing constant page refreshes that interfered with user edits and was very annoying
  // Users can now manually refresh with Cmd+R / Ctrl+R or the browser refresh button
  useEffect(() => {
    if (!subagentStore?.id) return;
    
    // Realtime subscriptions disabled - users should manually refresh
    
    return () => {
      // Cleanup would go here if subscriptions were active
    };
  }, [subagentStore?.id]);

  // ── Real-time order status updates ──
  useEffect(() => {
    if (!subagentStore?.id) return;
    
    const ordersChannel = supabase
      .channel(`orders-${subagentStore.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `sub_subagent_store_id=eq.${subagentStore.id}` },
        (payload) => {
          const updatedOrder = payload.new as Order;
          setOrders(prevOrders =>
            prevOrders.map(order =>
              order.id === updatedOrder.id
                ? { ...order, ...updatedOrder }
                : order
            )
          );
        }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(ordersChannel); };
  }, [subagentStore?.id]);

  const createNotification = async () => {
    if (!subagentStore || !newNotificationMsg.trim()) {
      toast({ title: "Error", description: "Please enter a message", variant: "destructive" });
      return;
    }
    setSendingNotification(true);
    const expires_at = newNotificationExpiry ? new Date(newNotificationExpiry).toISOString() : null;
    const { error } = await supabase.from("sub_subagent_storefront_notifications").insert({
      sub_subagent_store_id: subagentStore.id,
      message: newNotificationMsg.trim(),
      is_active: true,
      expires_at
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notification sent!" });
      setNewNotificationMsg("");
      setNewNotificationExpiry("");
      fetchNotifications();
    }
    setSendingNotification(false);
  };

  const toggleNotificationActive = async (id: string, cur: boolean) => {
    const { error } = await supabase.from("sub_subagent_storefront_notifications").update({ is_active: !cur }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("sub_subagent_storefront_notifications").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchNotifications();
  };



  const deleteSubSubagentNotification = async (id: string) => {
    try {
      const { error } = await supabase.from("sub_subagent_notifications").delete().eq("id", id);
      if (error) throw error;
      fetchSubSubagentNotifications();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchSubSubagentNotifications = async () => {
    try {
      if (!subagentStore?.id) return;
      // Fetch notifications sent BY parent subagent TO this sub-subagent
      const { data } = await supabase
        .from("sub_subagent_notifications")
        .select("*")
        .eq("sub_subagent_store_id", subagentStore.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (data) {
        setSubSubagentNotifications(data);
      }
    } catch (error) {
      console.error("Error fetching sub-subagent notifications:", error);
    }
  };






  const handleSavePrices = async () => {
    try {
      setSavingPrices(true);
      const updates = Object.entries(subagentPrices).map(([packageId, price]) => ({
        agent_store_id: subagentStore?.agent_store_id,
        package_id: packageId,
        sell_price: price,
      }));

      for (const update of updates) {
        await supabase
          .from("agent_package_prices")
          .upsert(update, { onConflict: "agent_store_id,package_id" });
      }

      toast({ title: "Success", description: "Prices saved successfully" });
    } catch (error) {
      console.error("Error saving prices:", error);
      toast({ title: "Error", description: "Failed to save prices", variant: "destructive" });
    } finally {
      setSavingPrices(false);
    }
  };

  const handleSaveStore = async () => {
    try {
      setSaving(true);
      
      let finalStoreName = storeForm.store_name;
      
      // If store name has changed, check for uniqueness
      if (storeForm.store_name !== subagentStore?.store_name) {
        const { data: existingStores } = await supabase
          .from("sub_subagent_stores")
          .select("store_name")
          .eq("approved", true)
          .neq("id", subagentStore?.id);  // Exclude this store from comparison
        
        if (existingStores && existingStores.length > 0) {
          const slugifiedName = DOMAINS.sanitizeStoreName(storeForm.store_name);
          
          // Count how many OTHER stores have the same slug
          const duplicates = existingStores.filter((s: any) => {
            const existingSlug = DOMAINS.sanitizeStoreName(s.store_name);
            return existingSlug === slugifiedName;
          });
          
          // If duplicates exist, append a number
          if (duplicates.length > 0) {
            finalStoreName = `${storeForm.store_name} ${duplicates.length + 1}`;
            toast({
              title: "Store name adjusted",
              description: `Store name changed to "${finalStoreName}" to ensure unique URL`,
            });
          }
        }
      }
      
      const { error } = await supabase
        .from("sub_subagent_stores")
        .update({
          store_name: finalStoreName,
          whatsapp_number: storeForm.whatsapp_number,
          support_number: storeForm.support_number,
          whatsapp_group: storeForm.whatsapp_group || null,
          show_whatsapp_group_icon: storeForm.show_whatsapp_group_icon ?? true,
          momo_name: storeForm.momo_name,
          momo_number: storeForm.momo_number,
          momo_network: storeForm.momo_network,
        })
        .eq("id", subagentStore?.id);

      if (error) throw error;
      setSubagentStore(prev => prev ? { ...prev, ...storeForm, store_name: finalStoreName } : null);
      setEditingStore(false);
      toast({ title: "Store updated successfully" });
    } catch (error) {
      console.error("Error saving store:", error);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!withdrawAmount || !subagentStore) return;
    
    const amount = parseFloat(withdrawAmount);
    
    // Validate minimum withdrawal
    if (amount < 10) {
      toast({ title: "Error", description: "Minimum withdrawal is GHC 10.00", variant: "destructive" });
      return;
    }
    
    // Check for pending withdrawal
    const hasPending = withdrawals.some(w => w.status === "pending");
    if (hasPending) {
      toast({ title: "Error", description: "You already have a pending withdrawal. Please wait until it completes.", variant: "destructive" });
      return;
    }
    
    if (amount > getAvailableBalance()) {
      toast({ title: "Error", description: "Insufficient wallet balance", variant: "destructive" });
      return;
    }

    try {
      setWithdrawLoading(true);
      const { error } = await supabase
        .from("withdrawal_requests")
        .insert({
          sub_subagent_store_id: subagentStore.id,
          amount,
          status: "pending"
        });

      if (error) throw error;
      toast({ title: "Success", description: "Withdrawal request submitted successfully" });
      setWithdrawAmount("");
      fetchData();
    } catch (error) {
      console.error("Error requesting withdrawal:", error);
      toast({ title: "Error", description: "Failed to submit withdrawal request", variant: "destructive" });
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Save theme colors
  const saveThemeColors = async () => {
    if (!subagentStore?.id) return;
    try {
      setSavingTheme(true);
      const { error } = await supabase
        .from("sub_subagent_stores")
        .update({ theme_config: themeColors })
        .eq("id", subagentStore.id);
      if (error) throw error;
      toast({ title: "Theme saved!" });
    } catch (error) {
      console.error("Error saving theme:", error);
      toast({ title: "Error", description: "Failed to save theme", variant: "destructive" });
    } finally {
      setSavingTheme(false);
    }
  };

  // Save store headline
  const saveStoreHeadline = async () => {
    if (!subagentStore?.id) return;
    try {
      setSavingHeadline(true);
      const { error } = await supabase
        .from("sub_subagent_stores")
        .update({ store_headline: storeHeadline })
        .eq("id", subagentStore.id);
      if (error) throw error;
      toast({ title: "Headline saved!" });
    } catch (error) {
      console.error("Error saving headline:", error);
      toast({ title: "Error", description: "Failed to save headline", variant: "destructive" });
    } finally {
      setSavingHeadline(false);
    }
  };

  // Change grid columns
  const changeColumns = (delta: number) => {
    const newVal = Math.max(1, Math.min(6, themeColors.gridColumns + delta));
    setThemeColors({ ...themeColors, gridColumns: newVal });
  };

  const filteredPackages = packages.filter(p => {
    // COMMENTED OUT: mashup packages deactivated
    if (false && networkFilter === "mtn_mashup") {
      return p.network === "mtn_mashup" || p.network === "mashup";
    }
    if (networkFilter === "airteltigo") {
      return p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
    }
    return p.network === networkFilter;
  });



  const handlePriceChange = (packageId: string, value: string) => {
    // Allow empty string for clearing the box - store as string for display
    setEditedPrices(prev => ({
      ...prev,
      [packageId]: value === "" ? "" : (parseFloat(value) || value)
    }));
  };

  const applyMarkup = () => {
    if (!markupPercent) {
      toast({ title: "Error", description: "Enter a markup percentage", variant: "destructive" });
      return;
    }

    const markup = parseFloat(markupPercent) / 100;
    const networkName = networkFilter === "mtn" ? "MTN" : networkFilter === "mtn_express" ? "MTN Express" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel";
    
    filteredPackages.forEach(pkg => {
      const basePrice = basePrices[pkg.id] || pkg.price || 0;
      const newPrice = basePrice * (1 + markup);
      setEditedPrices(prev => ({
        ...prev,
        [pkg.id]: parseFloat(newPrice.toFixed(2))
      }));
    });

    toast({
      title: `Markup applied to ${networkName} packages`,
      description: `All prices increased by ${markupPercent}%`
    });
  };

  const savePrices = async () => {
    if (!subagentStore?.id) {
      toast({ title: "Error", description: "Store not found", variant: "destructive" });
      return;
    }
    
    try {
      setSavingPrices(true);

      // Validate that no price is below agent's base price
      for (const [packageId, priceVal] of Object.entries(editedPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        const basePrice = basePrices[packageId] || 0;
        if (isNaN(price) || price <= 0) {
          toast({
            title: "Invalid Price",
            description: "Please enter a valid price",
            variant: "destructive"
          });
          setSavingPrices(false);
          return;
        }
        if (price < basePrice) {
          toast({
            title: "Invalid Price",
            description: `Your price cannot be below agent's base price (GHC ${basePrice.toFixed(2)})`,
            variant: "destructive"
          });
          setSavingPrices(false);
          return;
        }
      }
      
      // Save each price - use delete + insert to avoid upsert issues
      for (const [packageId, priceVal] of Object.entries(editedPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        // First try to delete existing
        await supabase
          .from("sub_subagent_package_prices")
          .delete()
          .eq("sub_subagent_store_id", subagentStore.id)
          .eq("package_id", packageId);
        
        // Insert sell_price (what this sub-subagent charges customers).
        // base_price and subagent_minimum_price = their cost from the parent subagent.
        const costFromAgent = basePrices[packageId] ?? price;
        const { error } = await supabase
          .from("sub_subagent_package_prices")
          .insert({
            sub_subagent_store_id: subagentStore.id,
            subagent_store_id: subagentStore.subagent_store_id,
            package_id: packageId,
            base_price: costFromAgent,
            subagent_minimum_price: costFromAgent,
            sell_price: price
          });

        if (error) {
          console.error("Error saving price:", error);
          throw error;
        }
      }

      // Update local state
      setSubagentPrices(prev => ({ ...prev, ...editedPrices }));
      setEditedPrices({});
      setMarkupPercent("");
      toast({ title: "Success", description: "Prices saved successfully" });
      fetchData(); // Refresh data
    } catch (error) {
      console.error("Error saving prices:", error);
      toast({ title: "Error", description: "Failed to save prices", variant: "destructive" });
    } finally {
      setSavingPrices(false);
    }
  };

  const handleSubSubagentPriceChange = (packageId: string, value: string) => {
    setSubSubagentEditedPrices(prev => ({
      ...prev,
      [packageId]: value === "" ? "" : (parseFloat(value) || value)
    }));
  };

  const applySubSubagentMarkup = () => {
    if (!subSubagentMarkupPercent) {
      toast({ title: "Error", description: "Enter a markup percentage", variant: "destructive" });
      return;
    }

    const markupVal = parseFloat(subSubagentMarkupPercent);
    if (isNaN(markupVal)) {
      toast({ title: "Error", description: "Invalid markup percentage", variant: "destructive" });
      return;
    }

    filteredSubSubagentPackages.forEach(pkg => {
      const yourPrice = subagentPrices[pkg.id] || basePrices[pkg.id] || pkg.price || 0;
      const newPrice = yourPrice * (1 + markupVal / 100);
      setSubSubagentEditedPrices(prev => ({
        ...prev,
        [pkg.id]: parseFloat(newPrice.toFixed(2))
      }));
    });
  };

  const saveSubSubagentPrices = async () => {
    if (!subagentStore?.id) {
      toast({ title: "Error", description: "Store not found", variant: "destructive" });
      return;
    }

    try {
      setSavingSubSubagentPrices(true);

      for (const [packageId, priceVal] of Object.entries(subSubagentEditedPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        const yourPrice = subagentPrices[packageId] || basePrices[packageId] || 0;

        if (isNaN(price) || price <= 0) {
          toast({
            title: "Invalid Price",
            description: "Please enter a valid price",
            variant: "destructive"
          });
          setSavingSubSubagentPrices(false);
          return;
        }

        if (price < yourPrice) {
          toast({
            title: "Invalid Price",
            description: `Sub-subagent price cannot be below your selling price (GHC ${yourPrice.toFixed(2)})`,
            variant: "destructive"
          });
          setSavingSubSubagentPrices(false);
          return;
        }
      }

      for (const [packageId, priceVal] of Object.entries(subSubagentEditedPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        
        // Validate all required fields
        if (!subagentStore.id || !subagentStore.subagent_store_id || !packageId) {
          console.error("[v0] Missing required fields for price insert:", { 
            storeId: subagentStore.id, 
            parentStoreId: subagentStore.subagent_store_id, 
            packageId 
          });
          throw new Error("Missing required store or package information");
        }
        
        await supabase
          .from("sub_subagent_package_prices")
          .delete()
          .eq("sub_subagent_store_id", subagentStore.id)
          .eq("package_id", packageId);

        // Only save sell_price (what the sub-subagent charges their customers).
        // base_price is the cost FROM the subagent — it is set by the subagent's
        // template row and must NOT be overwritten by the sub-subagent's save.
        const { error } = await supabase
          .from("sub_subagent_package_prices")
          .insert({
            sub_subagent_store_id: subagentStore.id,
            subagent_store_id: subagentStore.subagent_store_id,
            package_id: packageId,
            sell_price: price
          });

        if (error) {
          console.error("[v0] Error inserting price:", error);
          throw error;
        }
      }

      setSubSubagentEditedPrices({});
      setSubSubagentMarkupPercent("");
      toast({ title: "Success", description: "Sub-subagent prices saved successfully" });
      fetchData();
    } catch (error) {
      console.error("Error saving sub-subagent prices:", error);
      toast({ title: "Error", description: "Failed to save prices", variant: "destructive" });
    } finally {
      setSavingSubSubagentPrices(false);
    }
  };

  const handleBuyData = async () => {
    if (!buyingPkg || !buyCustomerNumber || !subagentStore) return;
    
    // Validate phone number is exactly 10 digits
    if (!isValidPhoneLength(buyCustomerNumber)) {
      toast({ title: "Error", description: "Phone number must be exactly 10 digits", variant: "destructive" });
      return;
    }
    
    // Validate phone matches selected network (allow mtn to buy mtn_mashup and mashup)
    const isValidForMTNMashup = (buyingPkg.network === "mtn_mashup" || buyingPkg.network === "mashup") && detectNetwork(buyCustomerNumber) === "mtn";
    if (!isValidForMTNMashup && !phoneMatchesNetwork(buyCustomerNumber, buyingPkg.network)) {
      const detected = detectNetwork(buyCustomerNumber);
      toast({ title: "Network mismatch", description: `This phone number appears to be ${detected.toUpperCase()}, but you selected ${buyingPkg.network.toUpperCase()} package`, variant: "destructive" });
      return;
    }
    
    const price = basePrices[buyingPkg.id] || buyingPkg.price || 0;
    
    if (price > getAvailableBalance()) {
      toast({ title: "Error", description: "Insufficient wallet balance", variant: "destructive" });
      return;
    }
    
    try {
      setBuyLoading(true);
      
      // First, get the current wallet balance to ensure we have fresh data
      const { data: freshStore, error: fetchError } = await supabase
        .from("sub_subagent_stores")
        .select("wallet_balance")
        .eq("id", subagentStore.id)
        .single();
      
      if (fetchError || !freshStore) {
        throw new Error("Failed to fetch wallet balance");
      }
      
      const currentBalance = freshStore.wallet_balance || 0;
      
      if (price > currentBalance) {
        toast({ title: "Error", description: "Insufficient wallet balance", variant: "destructive" });
        setBuyLoading(false);
        return;
      }
      
      const newBalance = currentBalance - price;
      
      // Deduct from wallet
      const { error: walletError } = await supabase
        .from("sub_subagent_stores")
        .update({ wallet_balance: newBalance })
        .eq("id", subagentStore.id);
      
      if (walletError) {
        throw new Error("Failed to deduct wallet balance: " + walletError.message);
      }
      
      // Create order with wallet payment method
      // Include agent_store_id so it shows on storefront and for proper tracking
      // Extract size_gb the same way verify-payment does: match first numeric value
      const packageName = buyingPkg.size_gb_text || buyingPkg.size_gb?.toString() || "";
      const sizeMatch = packageName.toString().match(/(\d+(?:\.\d+)?)/);
      const extractedSize = sizeMatch ? parseFloat(sizeMatch[1]) : buyingPkg.size_gb;
      
    // COMMENTED OUT: mashup packages deactivated
    // For mashup packages, get datahubnet ID from the hardcoded mapping
    // This is because mashup uses a separate backend (datahubnet)
    if (false && (buyingPkg.network === "mashup" || buyingPkg.network === "mtn_mashup") && buyingPkg.size_gb_text) {
      // Datahubnet mapping for mashup packages
      const mashupMapping: Record<string, number> = {
          "1.7GB": 14,
          "5.1GB": 3,
          "2.6 GB + 1,077 mins": 16,
          "8.2GB": 17,
          "11.9GB": 18,
          "3.61GB + 1485Mins": 20,
          "15.3GB": 19,
        };
        dataPackageId = mashupMapping[buyingPkg.size_gb_text];
      }
      
      const { data: orderData, error: orderError } = await supabase.from("orders").insert({
        package_id: buyingPkg.id,
        sub_subagent_store_id: subagentStore.id,
        customer_number: buyCustomerNumber,
        network: buyingPkg.network,
        size_gb: extractedSize,
        amount: price,
        base_price: price,
        selling_price: price,
        profit: 0, // Subagent buying at cost, no profit
        payment_method: "wallet",
        status: "paid",
        fulfillment_status: "pending"
      }).select("id").single();
      
      if (orderError) {
        // Rollback wallet if order fails
        await supabase
          .from("sub_subagent_stores")
          .update({ wallet_balance: currentBalance })
          .eq("id", subagentStore.id);
        throw orderError;
      }
      
      // 3-TIER PROFIT SPLIT for a sub-subagent wallet purchase.
      // The sub-subagent buys at THEIR cost (`price`), so they earn no margin here,
      // but the upstream subagent and agent still earn their fixed margins:
      //   agentToSub   = what the subagent pays the agent           (e.g. 4.20)
      //   price        = what the sub-subagent pays the subagent     (e.g. 4.70)
      //   adminBase    = what the agent pays admin                   (e.g. 3.85)
      //   subagentCommission = price - agentToSub                    (e.g. 0.50)
      //   agentCommission    = agentToSub - adminBase                (e.g. 0.35)
      try {
        const adminBasePrice = buyingPkg.agent_price ? Number(buyingPkg.agent_price) : 0;
        const agentToSub = agentToSubagentCost[buyingPkg.id] ?? adminBasePrice;

        // --- Parent SUBAGENT commission -> their wallet_balance ---
        if (subagentStore.subagent_store_id) {
          const subagentCommission = price - agentToSub;
          if (subagentCommission > 0) {
            const { data: parentSub } = await supabase
              .from("subagent_stores")
              .select("wallet_balance")
              .eq("id", subagentStore.subagent_store_id)
              .single();
            if (parentSub) {
              const newBal = (Number(parentSub.wallet_balance) || 0) + subagentCommission;
              await supabase.from("subagent_stores").update({ wallet_balance: newBal }).eq("id", subagentStore.subagent_store_id);
              console.log(`[v0] Wallet purchase - Subagent commission: +${subagentCommission} (new balance: ${newBal})`);
            }
          }
        }

        // --- AGENT commission -> their subagent_commission_balance ---
        if (subagentStore.agent_store_id) {
          const agentCommission = agentToSub - adminBasePrice;
          if (agentCommission > 0) {
            const { data: agentStore } = await supabase
              .from("agent_stores")
              .select("subagent_commission_balance")
              .eq("id", subagentStore.agent_store_id)
              .single();
            if (agentStore) {
              const newCommissionBalance = (agentStore.subagent_commission_balance || 0) + agentCommission;
              await supabase.from("agent_stores").update({ subagent_commission_balance: newCommissionBalance }).eq("id", subagentStore.agent_store_id);
              console.log(`[v0] Wallet purchase - Agent commission: +${agentCommission} (new balance: ${newCommissionBalance})`);
            }
          }
        }
      } catch (profitErr) {
        console.error("[v0] Error distributing profit:", profitErr);
        // Don't throw - order already created successfully, just log the error
      }
      
      // Trigger fulfillment for the order
      if (orderData?.id) {
        try {
          await supabase.functions.invoke("fulfill-order", {
            body: { order_id: orderData.id, data_package_id: dataPackageId }
          });
        } catch (fulfillErr) {
          console.error("Fulfillment trigger error:", fulfillErr);
        }
      }
      
      // Update local state immediately
      setSubagentStore(prev => prev ? { ...prev, wallet_balance: newBalance } : prev);
      
      toast({ title: "Success", description: `${buyingPkg.size_gb}GB data purchased for ${buyCustomerNumber}` });
      setBuyingPkg(null);
      setBuyCustomerNumber("");
      fetchData();
    } catch (error) {
      console.error("Error buying data:", error);
      toast({ title: "Error", description: "Failed to purchase data", variant: "destructive" });
    } finally {
      setBuyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subagentStore || loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="border-border w-96">
          <CardContent className="pt-6 text-center space-y-4">
            {loadError ? (
              <>
                <ShieldAlert className="h-12 w-12 mx-auto text-red-500" />
                <p className="text-foreground font-semibold">{loadError}</p>
                <Button variant="hero" onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/">Go Home</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">No subagent store found. Please complete your registration.</p>
                <Button variant="hero" asChild>
                  <Link to="/">Go Home</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const menuItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "buy", label: "Buy Data", icon: ShoppingCart },
    { id: "store", label: "Store Prices", icon: Store },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "topup", label: "Top Up", icon: Wallet },
    { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
    { id: "flyer", label: "Flyer Generator", icon: Image },
    // COMMENTED OUT: mashup packages deactivated
  // { id: "mashup-flyer", label: "MTN Mashup Flyer", icon: Zap },
    { id: "refunds", label: "Refunds", icon: RotateCcw },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings },
  ];

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

  // Apply date filter to orders for stats
  const dateFilteredOrders = getDateFilteredOrders(orders);

  // Only count customer orders (not wallet purchases by subagent) for revenue
  const customerOrders = dateFilteredOrders.filter(o => o.payment_method !== "wallet");
  const totalRevenue = customerOrders.reduce((sum, order) => sum + ((order.status === "completed" || order.status === "paid") ? Number(order.selling_price || order.amount) : 0), 0);
  
  // Calculate profit from ALL completed orders (customer pays, subagent earns profit)
  const allCompletedOrders = dateFilteredOrders.filter(o => o.status === "completed" || o.status === "paid");
  const totalProfit = allCompletedOrders.reduce((sum, order) => {
    // Use stored profit if available, otherwise calculate from stored prices or fallback
    if (order.profit !== null && order.profit !== undefined && order.profit !== 0) {
      return sum + Number(order.profit);
    }
    // Fallback for old orders without stored profit
    const baseCost = order.base_price || (order.package_id ? (basePrices[order.package_id] || 0) : 0);
    return sum + (Number(order.selling_price || order.amount) - baseCost);
  }, 0);
  
  const pendingOrders = dateFilteredOrders.filter(o => o.status !== "completed").length;
  // Use totalOrderCount when viewing all dates (which is the true total from database), otherwise use filtered length
  const totalOrders = dateFilter === "all" ? totalOrderCount : dateFilteredOrders.length;
  const hasPendingWithdrawal = withdrawals.some(w => w.status === "pending");
  const pendingWithdrawalAmount = withdrawals.filter(w => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);
  const completedWithdrawals = withdrawals.filter(w => w.status === "completed").reduce((s, w) => s + Number(w.amount), 0);
  const totalWithdrawals = withdrawals.reduce((s, w) => s + Number(w.amount), 0);
  // Calculate wallet purchases from orders
  const walletPurchases = orders
    .filter((o) => o.payment_method === "wallet")
    .reduce((s, o) => s + Number(o.amount || 0), 0);
  // Total Paystack top-ups
  const totalTopups = topupHistory.reduce((s, t) => s + Number(t.amount || 0), 0);
  // Wallet balance = Profit + Topups - Completed Withdrawals - Wallet Purchases
  const calculatedWalletBalance = totalProfit + totalTopups - completedWithdrawals - walletPurchases;
  // Prefer database value as it's synced correctly
  const availableWalletBalance = subagentStore?.wallet_balance !== undefined && subagentStore?.wallet_balance !== null 
    ? Number(subagentStore.wallet_balance) 
    : calculatedWalletBalance;
  
  // Available for use = actual wallet balance - pending withdrawals
  const availableForUse = availableWalletBalance - pendingWithdrawalAmount;
  
  // Use store_name, fallback to checking what's actually in the store object
  const storeName = subagentStore?.store_name || subagentStore?.storeName || "";
  // For sub-subagents, use the sub-subagent URL which includes parent subagent store name
  const storeUrl = (storeName && parentSubagentStoreName) ? DOMAINS.getSubSubagentStoreUrl(parentSubagentStoreName, storeName) : "";
  
  // Filter orders by search, date, and optional refunded-only toggle
  const filteredOrders = getDateFilteredOrders(orders).filter(o => {
    const matchesSearch = o.customer_number?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.id?.toLowerCase().includes(orderSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (showRefundedOnly) {
      return o.status === "refunded" || o.fulfillment_status === "refunded" || (o.order_status || "").toLowerCase() === "refunded";
    }
    return true;
  });
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ordersPerPage,
    currentPage * ordersPerPage
  );

  const copyStoreLink = async () => {
    if (!storeUrl) {
      toast({ title: "Error", description: "Store URL not available", variant: "destructive" });
      return;
    }
    await navigator.clipboard.writeText(storeUrl);
    toast({ title: "Store link copied!" });
  };

  // Handle redirects and permission checks
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Redirect if not admin and no valid store
  if (!isAdmin && !subagentStore) {
    return <Navigate to="/" replace />;
  }

  // Redirect if not admin and store not approved
  if (!isAdmin && !subagentStore?.approved) {
    return <Navigate to="/pending-approval" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Notification from parent subagent (shown to sub-subagent as "Admin") */}
      {subSubagentNotifications.length > 0 && showSubagentNotificationPopup && (
        <Dialog open={showSubagentNotificationPopup} onOpenChange={setShowSubagentNotificationPopup}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-400">
                <Bell className="h-5 w-5" /> Message from Your Admin
              </DialogTitle>
              <DialogDescription>
                Important notification from your admin
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {subSubagentNotifications.map((n) => (
                <div key={n.id} className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <p className="text-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowSubagentNotificationPopup(false)}>
                Got it
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Suspension Banner */}
      {subagentStore?.suspended && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3">
          <div className="container flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="text-red-500 font-semibold">Your store has been suspended.</p>
            </div>
            <p className="text-red-400 text-sm">
              Contact your admin {agentInfo?.whatsapp_number ? `(${agentInfo.whatsapp_number})` : ""} for more information.
            </p>
          </div>
        </div>
      )}
      {/* NAV */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                <Menu className="h-5 w-5 text-primary" />
                <span className="font-display text-lg font-bold text-primary">MENU</span>
              </div>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4 bg-card border-r border-border flex flex-col">
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" /> Menu
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-2 pb-4">
                  {menuItems.map(item => (
                    <SheetClose asChild key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-left w-full"
                      >
                        <item.icon className="h-5 w-5 text-primary" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    </SheetClose>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">Home</Link>
            </Button>
            {isImpersonating && (
              <Button variant="ghost" size="sm" onClick={exitImpersonation} className="text-yellow-400 hover:text-yellow-300">
                Exit Impersonation
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <div className="container py-8 space-y-6">
        {/* Store Link Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Your Store Link</p>
              <p className="text-xs text-muted-foreground">{storeUrl || "Store URL not available"}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyStoreLink} disabled={!storeUrl}>
                <Copy className="h-4 w-4 mr-1" /> Copy Link
              </Button>
              <Button 
                variant="hero" 
                size="sm" 
                onClick={() => {
                  if (storeUrl) {
                    window.open(storeUrl, "_blank");
                  } else {
                    toast({ title: "Error", description: "Store URL not available", variant: "destructive" });
                  }
                }}
                disabled={!storeUrl}
              >
                <ExternalLink className="h-4 w-4 mr-1" /> Visit Store
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="hidden" />

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-0 space-y-6">
            {/* Instruction Manual Dropdown */}
            <Card className="border-primary/30 bg-primary/5">
              <button onClick={() => setManualOpen(v => !v)} className="w-full flex items-center justify-between p-4 text-left">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-display font-bold text-foreground">Dashboard Instruction Manual</p>
                    <p className="text-xs text-muted-foreground">Tap to {manualOpen ? "hide" : "view"} a full guide on how every section works</p>
                  </div>
                </div>
                {manualOpen ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-primary" />}
              </button>
              {manualOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Tap any section to expand its guide. Tap on the MENU above to see these sections.</p>
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
            <SubagentYouTubeSection />

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

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">Store Status</p>
                  <Badge className="mt-2 bg-green-600/20 text-green-400 border-green-600/30">
                    {subagentStore.approved ? "Active" : "Pending"}
                  </Badge>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    {dateFilter !== "all" ? `Orders (${dateFilter === "custom" ? "Custom" : dateFilter === "week" ? "This Week" : dateFilter === "month" ? "This Month" : dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)})` : "Total Orders"}
                  </p>
                  <p className="font-display text-2xl font-bold mt-1 text-foreground">{totalOrders}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    {dateFilter !== "all" ? `Revenue (${dateFilter === "custom" ? "Custom" : dateFilter === "week" ? "This Week" : dateFilter === "month" ? "This Month" : dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)})` : "Total Revenue"}
                  </p>
                  <p className="font-display text-2xl font-bold mt-1 text-green-400">GHC{totalRevenue.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    {dateFilter !== "all" ? `Profit (${dateFilter === "custom" ? "Custom" : dateFilter === "week" ? "This Week" : dateFilter === "month" ? "This Month" : dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)})` : "Total Profit"}
                  </p>
                  <p className="font-display text-2xl font-bold mt-1 text-yellow-400">GHC{totalProfit.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            {/* My Wallet Card */}
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">My Wallet</p>
                    <p className="font-display text-2xl font-bold text-yellow-400 mt-1">GHC {availableWalletBalance.toFixed(2)}</p>
                    {hasPendingWithdrawal && <p className="text-xs text-orange-400 mt-1">GHC {pendingWithdrawalAmount.toFixed(2)} pending withdrawal</p>}
                  </div>
                  <ArrowDownToLine className="h-8 w-8 text-yellow-400 opacity-50" />
                </div>
                {/* USSD Code with Access Code */}
                {subagentStore?.topup_reference && (
                  <div className="mt-4 pt-4 border-t border-yellow-500/20">
                    <div className="text-center space-y-3">
                      <p className="text-xs text-muted-foreground">Your customers can buy data via USSD</p>
                      <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                        <p className="text-2xl font-bold font-mono text-primary">*380*455#</p>
                        <p className="text-sm text-muted-foreground mt-2">Access Code:</p>
                        <p className="text-3xl font-bold font-mono text-foreground">{subagentStore.topup_reference}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          navigator.clipboard.writeText("*380*455#");
                          toast({ title: "Copied!", description: "USSD code copied to clipboard" });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" /> Copy USSD Code
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Orders Table */}
            <Card className="border-border">
              <CardHeader className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="font-display text-lg">Orders ({filteredOrders.length})</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant={showRefundedOnly ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setShowRefundedOnly(v => !v); setCurrentPage(1); }}
                      className={showRefundedOnly ? "bg-orange-500 hover:bg-orange-600 text-white border-0" : "border-orange-500/50 text-orange-400 hover:bg-orange-500/10"}
                    >
                      Refunded Only
                    </Button>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search by number..." value={orderSearch} onChange={e => { setOrderSearch(e.target.value); setCurrentPage(1); }} className="pl-9" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No orders found.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Number</TableHead>
                            <TableHead>Network</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Selling Price</TableHead>
                            <TableHead>Base Cost</TableHead>
                            <TableHead>Profit</TableHead>
                            <TableHead>Payment Method</TableHead>
                            <TableHead>Order Status</TableHead>
                            <TableHead>Payment Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedOrders.map(order => {
                            // Sell price = what the sub-subagent charged the customer
                            const storedSellPrice = order.selling_price ?? null;
                            const storedProfit = order.profit ?? null;

                            // Base Cost = what the subagent charges the sub-subagent (the sub-subagent's cost from agent).
                            // basePrices holds the subagent's template cost for this sub-subagent (from sub_subagent_package_prices).
                            // order.base_price stores the same value set at purchase time — use it as the authoritative source
                            // if basePrices isn't loaded yet, but prefer basePrices because it reflects the current cost.
                            const currentCostFromAgent = order.package_id ? (basePrices[order.package_id] || 0) : 0;
                            const storedCostFromAgent = order.base_price ?? null;
                            // Use current cost from basePrices; fall back to what was stored at purchase time
                            const baseCost = currentCostFromAgent > 0 ? currentCostFromAgent : (storedCostFromAgent && storedCostFromAgent > 0 ? storedCostFromAgent : 0);

                            const sellPrice = (storedSellPrice && storedSellPrice > 0) ? storedSellPrice : order.amount;
                            const profit = (storedProfit !== null && storedProfit !== 0) ? storedProfit : (sellPrice - baseCost);
                            
                            return (
                              <TableRow key={order.id}>
                                <TableCell className="text-sm whitespace-nowrap">{new Date(order.created_at).toLocaleString()}</TableCell>
                                <TableCell className="font-mono text-sm">{order.customer_number}</TableCell>
                                <TableCell className="uppercase text-sm">{order.network}</TableCell>
                                <TableCell className="font-display font-bold">{order.network === "mtn_mashup" ? (order.packages as any)?.size_gb_text || order.size_gb + "GB" : order.size_gb + "GB"}</TableCell>
                                <TableCell className="font-semibold">GHC{Number(sellPrice).toFixed(2)}</TableCell>
                                <TableCell className="text-muted-foreground">GHC{Number(baseCost).toFixed(2)}</TableCell>
                                <TableCell className={profit > 0 ? "font-semibold text-green-400" : "text-muted-foreground"}>
                                  GHC{Number(profit).toFixed(2)}
                                </TableCell>
                                <TableCell className="capitalize text-sm">{order.payment_method === "wallet" ? "Wallet" : order.payment_method === "paystack" ? "Paystack" : order.payment_method || "Paystack"}</TableCell>
                                <TableCell>
                                  <OrderStatusBadge status={order.order_status || order.fulfillment_status || order.status} />
                                </TableCell>
                                <TableCell>
                                  {(order.status === "refunded" || order.fulfillment_status === "refunded")
                                    ? <Badge className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">Refunded</Badge>
                                    : <Badge className="text-xs bg-green-600/20 text-green-400 border border-green-600/30">completed</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredOrders.length > ordersPerPage && (() => {
                      const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
                      return (
                        <div className="flex items-center justify-center gap-1 mt-6 flex-wrap">
                          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</Button>
                          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2).map((p, idx, arr) => (
                            <span key={p}>
                              {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
                              <Button variant={currentPage === p ? "hero" : "outline"} size="sm" onClick={() => setCurrentPage(p)}>{p}</Button>
                            </span>
                          ))}
                          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
                          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>Last</Button>
                          <span className="text-xs text-muted-foreground ml-2">Page {currentPage} of {totalPages} ({filteredOrders.length} orders)</span>
                        </div>
                      );
                    })()}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUY DATA */}
          <TabsContent value="buy" className="mt-0 space-y-6">
            <Card className={`border-border ${hasPendingWithdrawal ? "border-orange-500/30 bg-orange-500/5" : "bg-secondary/30"}`}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <span className="font-medium">Wallet Balance:</span>
                  </div>
                  <span className="font-display text-xl font-bold text-primary">GHC {availableWalletBalance.toFixed(2)}</span>
                </div>
                {hasPendingWithdrawal && <p className="text-xs text-orange-400">GHC {pendingWithdrawalAmount.toFixed(2)} reserved for pending withdrawal.</p>}
              </CardContent>
            </Card>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "mtn", label: "MTN" },
                { key: "mtn_express", label: "MTN Express" },
                { key: "airteltigo", label: "AirtelTigo" },
                { key: "telecel", label: "Telecel" },
              ].map(({ key, label }) => (
                <Button key={key} variant={networkFilter === key ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(key)}>
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredPackages.map(pkg => {
                const basePrice = basePrices[pkg.id] || pkg.price || 0;
                const isInactive = pkg.active === false;
                return (
                  <Card key={pkg.id} className={`border-border transition-all relative ${isInactive ? "opacity-50 grayscale" : "hover:border-primary/50"}`}>
                    {isInactive && (
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow">
                        Not available
                      </div>
                    )}
                    <CardContent className="p-4 text-center space-y-3">
                      <p className="font-display text-xl font-bold text-foreground">{pkg.size_gb_text || pkg.size_gb}GB</p>
                      <p className="text-lg font-bold text-primary">GHC {Number(basePrice).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Agent Base Price</p>
                      <Button variant="hero" size="sm" disabled={isInactive} className="w-full disabled:opacity-100 disabled:cursor-not-allowed" onClick={() => !isInactive && setBuyingPkg(pkg)}>{isInactive ? "Not Available" : "Buy Now"}</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Buy Data Modal */}
            {buyingPkg && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-border">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="font-display">Buy {buyingPkg.size_gb}GB {buyingPkg.network.toUpperCase()}</CardTitle>
                    <button onClick={() => { setBuyingPkg(null); setBuyCustomerNumber(""); }} className="text-muted-foreground hover:text-foreground text-2xl">x</button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="font-display text-2xl font-bold text-primary">GHC {Number(basePrices[buyingPkg.id] || buyingPkg.price || 0).toFixed(2)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Customer Phone Number (exactly 10 digits)</Label>
                      <Input
                        placeholder="e.g. 0551234567"
                        maxLength={10}
                        value={buyCustomerNumber}
                        onChange={e => setBuyCustomerNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className={buyCustomerNumber.length > 0 && buyCustomerNumber.length < 10 ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                      {buyCustomerNumber.length > 0 && buyCustomerNumber.length < 10 && (
                        <p className="text-xs text-red-500">{10 - buyCustomerNumber.length} digit{10 - buyCustomerNumber.length !== 1 ? "s" : ""} remaining</p>
                      )}
                      <NetworkIndicator phone={buyCustomerNumber} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        variant="outline" 
                        className="w-full border-green-500 text-green-500 hover:bg-green-500/10" 
                        onClick={handleBuyData} 
                        disabled={buyLoading || !buyCustomerNumber || (basePrices[buyingPkg.id] || buyingPkg.price || 0) > availableWalletBalance}
                      >
                        {buyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                        Pay with Wallet
                      </Button>
                      <Button 
                        variant="hero" 
                        className="w-full" 
                        onClick={async () => {
                          // Paystack payment via backend initialize-payment
                          const price = basePrices[buyingPkg.id] || buyingPkg.price || 0;
                          if (!buyCustomerNumber) {
                            toast({ title: "Error", description: "Enter customer phone number", variant: "destructive" });
                            return;
                          }
                          if (!isValidPhoneLength(buyCustomerNumber)) {
                            toast({ title: "Error", description: "Phone number must be exactly 10 digits", variant: "destructive" });
                            return;
                          }
                          const isValidForMTNMashup = (buyingPkg.network === "mtn_mashup" || buyingPkg.network === "mashup") && detectNetwork(buyCustomerNumber) === "mtn";
    if (!isValidForMTNMashup && buyingPkg.network !== "mashup" && !phoneMatchesNetwork(buyCustomerNumber, buyingPkg.network)) {
                            const detected = detectNetwork(buyCustomerNumber);
                            toast({ title: "Network mismatch", description: `This phone number appears to be ${detected.toUpperCase()}, but you selected ${buyingPkg.network.toUpperCase()} package`, variant: "destructive" });
                            return;
                          }
                          setBuyLoading(true);
                          try {
                            const email = user?.email || `${buyCustomerNumber.replace(/^0/, "233")}@dataplug.store`;
                            const { data, error } = await supabase.functions.invoke("initialize-payment", {
                              body: {
                                email,
                                amount: price,
                                phone: buyCustomerNumber.trim(),
                                callback_url: `https://${DOMAINS.SUBAGENT_STORE}/sub-subagent-dashboard`,
                                metadata: {
                                  package_id: buyingPkg.id,
                                  network: buyingPkg.network,
                                  package_name: `${(buyingPkg.network === "mtn_mashup" || buyingPkg.network === "mashup") ? (buyingPkg as any).size_gb_text : buyingPkg.size_gb + "GB"}`,
                                  subsubagent_store_id: subagentStore?.id,
                                  payment_method: "paystack",
                                  is_subsubagent_order: true,
                                  ...((buyingPkg.network === "mtn_mashup" || buyingPkg.network === "mashup") && { data_package_id: (buyingPkg as any).data_package_id }),
                                },
                              },
                            });
                            if (error || !data?.authorization_url) {
                              throw new Error(error?.message || data?.error || "Payment initialization failed");
                            }
                            window.location.href = data.authorization_url;
                          } catch (err: any) {
                            console.error("Paystack init error:", err);
                            toast({ title: "Error", description: err.message || "Could not initialize payment", variant: "destructive" });
                          } finally {
                            setBuyLoading(false);
                          }
                        }}
                        disabled={buyLoading || !buyCustomerNumber}
                      >
                        {buyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Pay with Paystack
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Wallet Balance: GHC {availableWalletBalance.toFixed(2)}
                      {pendingWithdrawalAmount > 0 && (
                        <div className="text-yellow-400 text-xs mt-1">
                          (GH�� {pendingWithdrawalAmount.toFixed(2)} pending withdrawal)
                        </div>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No orders yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Payment Method</TableHead>
                          <TableHead>Selling Price</TableHead>
                          <TableHead>Base Cost</TableHead>
                          <TableHead>Profit</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.slice(0, 10).map(order => {
                          // Use stored values from order if available, otherwise fall back to current prices
                          const storedSellPrice = order.selling_price ?? null;
                          const storedBaseCost = order.base_price ?? null;
                          const storedProfit = order.profit ?? null;
                          
                          // Fallback calculation for old orders
                          const fallbackBaseCost = order.package_id ? (basePrices[order.package_id] || 0) : 0;
                          const fallbackProfit = order.amount - fallbackBaseCost;
                          
                          // Use stored values if they exist and are non-zero
                          const sellPrice = (storedSellPrice && storedSellPrice > 0) ? storedSellPrice : order.amount;
                          const baseCost = (storedBaseCost && storedBaseCost > 0) ? storedBaseCost : fallbackBaseCost;
                          const profit = (storedProfit !== null && storedProfit !== 0) ? storedProfit : fallbackProfit;
                          
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono text-sm">{order.customer_number}</TableCell>
                              <TableCell>{order.network.toUpperCase()}</TableCell>
                              <TableCell>{order.network === "mtn_mashup" ? (order.packages as any)?.size_gb_text || order.size_gb + "GB" : order.size_gb + "GB"}</TableCell>
                              <TableCell className="capitalize text-sm">{order.payment_method === "wallet" ? "Wallet" : order.payment_method === "paystack" ? "Paystack" : order.payment_method || "Paystack"}</TableCell>
                              <TableCell className="font-semibold">GHC{Number(sellPrice).toFixed(2)}</TableCell>
                              <TableCell className="text-muted-foreground">GHC{Number(baseCost).toFixed(2)}</TableCell>
                              <TableCell className={profit > 0 ? "font-semibold text-green-400" : "text-muted-foreground"}>
                                GHC{Number(profit).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={order.fulfillment_status === "delivered" ? "default" : "secondary"}>
                                  {getOrderStage(order)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(order.created_at).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TOP UP */}
          <TabsContent value="topup" className="mt-0 space-y-6">
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2 text-green-400">
                  <Wallet className="h-5 w-5" /> Top Up via Paystack
                </CardTitle>
                <p className="text-sm text-muted-foreground">Fund your wallet instantly with card or mobile money</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="text-sm mb-1 block">Amount (GHC)</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      min="1"
                      value={paystackTopupAmount}
                      onChange={(e) => setPaystackTopupAmount(e.target.value)}
                      className="text-lg"
                    />
                  </div>
                  <Button
                    variant="hero"
                    className="self-end bg-green-600 hover:bg-green-700"
                    disabled={!paystackTopupAmount || Number(paystackTopupAmount) < 1 || topupLoading}
                    onClick={handlePaystackTopup}
                  >
                    {topupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                    Pay Now
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">A small Paystack fee (1.98%) will be added to your payment.</p>
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
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topupHistory.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">{new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                            <TableCell className="font-semibold text-green-400">GHC {Number(t.amount).toFixed(2)}</TableCell>
                            <TableCell className="font-mono text-xs">{t.paystack_reference || "Manual"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* WITHDRAW */}
          <TabsContent value="withdraw" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display text-lg">Request Withdrawal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasPendingWithdrawal && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-sm text-yellow-400 font-medium">You have a pending withdrawal of GHC {pendingWithdrawalAmount.toFixed(2)}. Please wait until it completes before requesting another.</p>
                  </div>
                )}
                <div className="rounded-xl border border-border bg-secondary/50 p-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">MoMo Name</p>
                      <p className="font-bold">{subagentStore?.momo_name || "Not set"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">MoMo Number</p>
                      <p className="font-bold">{subagentStore?.momo_number || "Not set"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Network</p>
                      <p className="font-bold">{subagentStore?.momo_network?.toUpperCase() || "Not set"}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-400">My Wallet Balance: <span className="font-bold">GH�� {availableWalletBalance.toFixed(2)}</span></p>
                  {pendingWithdrawalAmount > 0 && (
                    <p className="text-xs text-yellow-400 mt-2">
                      (GHC {pendingWithdrawalAmount.toFixed(2)} pending withdrawal - cannot be used until approved)
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Minimum: GHC 10.00. Processed within 24 hours.</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label>Amount (GHC)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 10.00"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      disabled={hasPendingWithdrawal}
                    />
                  </div>
                  <Button variant="hero" onClick={handleRequestWithdrawal} disabled={withdrawLoading || hasPendingWithdrawal}>
                    {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />}
                    Withdraw
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Withdrawal History</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No withdrawals yet</p>
                ) : (
                  <div className="space-y-2">
                    {withdrawals.map(w => (
                      <div key={w.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                        <div>
                          <p className="font-medium">GHC{w.amount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge variant={w.status === "completed" ? "default" : "secondary"}>{w.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* STORE PRICES */}
          <TabsContent value="store" className="space-y-4 mt-0">
            {packages.length === 0 ? (
              <Card className="border-border">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Loading packages...</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: "mtn", label: "MTN" },
                      { key: "mtn_express", label: "MTN Express" },
                      { key: "airteltigo", label: "AirtelTigo" },
                      { key: "telecel", label: "Telecel" },
                    ].map(({ key, label }) => (
                      <Button 
                        key={key} 
                        variant={networkFilter === key ? "hero" : "outline"} 
                        size="sm" 
                        onClick={() => setNetworkFilter(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Markup:</span>
                    <Input 
                      type="number" 
                      placeholder="+10" 
                      value={markupPercent} 
                      onChange={e => setMarkupPercent(e.target.value)} 
                      className="w-20 h-8 text-sm" 
                    />
                    <Button variant="outline" size="sm" onClick={applyMarkup}>
                      <Percent className="h-3 w-3 mr-1" /> Apply
                    </Button>
                  </div>
                  {Object.keys(editedPrices).length > 0 && (
                    <Button variant="hero" size="sm" onClick={savePrices} disabled={savingPrices}>
                      <Save className="h-4 w-4 mr-1" />
                      {savingPrices ? "Saving..." : "Save Prices"}
                    </Button>
                  )}
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                  <p className="font-semibold">USE Markup if you feel lazy and do not want to edit each GB price one by one <br />������ Markup Explanation (Remember to click save after applying markup)</p>
                  <p className="text-xs text-muted-foreground mt-2">Markup changes all your selling price for the selected network based on the percentage you want all the prices to be increase by. Markup is applied to the <strong>Base Price</strong> (agent&apos;s base price). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{networkFilter === "mtn" ? "MTN" : networkFilter === "mtn_express" ? "MTN Express" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"}</strong>).</p>
                </div>
                <p className="text-sm text-muted-foreground">Your profit = Your Selling Price - Cost from Agent. Use markup to increase all prices by a % (based on cost).</p>
                <Card className="border-border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Size</TableHead>
                          <TableHead>Cost from Agent</TableHead>
                          <TableHead>Your Selling Price</TableHead>
                          <TableHead>Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPackages.length > 0 ? (
                          filteredPackages.map(pkg => {
                            const costFromAgent = basePrices[pkg.id] || pkg.price || 0;
                            const savedPrice = subagentPrices[pkg.id];
                            const cur = editedPrices[pkg.id] ?? savedPrice ?? costFromAgent;
                            const profit = cur - costFromAgent;
                            const isInvalid = editedPrices[pkg.id] !== undefined && editedPrices[pkg.id] < costFromAgent;
                            const hasSavedPrice = savedPrice !== undefined;
                            const isInactive = pkg.active === false;
                            return (
                              <TableRow key={pkg.id} className={isInactive ? "opacity-50" : ""}>
                                <TableCell className="font-display font-bold">{pkg.size_gb}GB{isInactive && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Not available</span>}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  GHC {Number(costFromAgent).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      min={costFromAgent}
                                      value={cur} 
                                      onChange={e => handlePriceChange(pkg.id, e.target.value)} 
                                      className={`w-24 h-8 ${isInvalid ? "border-red-500" : hasSavedPrice && !editedPrices[pkg.id] ? "border-green-500" : ""}`}
                                    />
                                    {isInvalid && (
                                      <p className="text-xs text-red-500">Min: GHC {costFromAgent.toFixed(2)}</p>
                                    )}
                                    {hasSavedPrice && !editedPrices[pkg.id] && (
                                      <p className="text-xs text-green-500">Saved</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>
                                  GHC {profit.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                              No packages for {networkFilter === "mtn" ? "MTN" : networkFilter === "mtn_express" ? "MTN Express" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          {/* APPEARANCE */}
          <TabsContent value="appearance" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display">Customise Your Storefront</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Store Headline</Label>
                    <textarea
                      className="w-full rounded-md border border-border bg-background p-3 text-sm min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                      value={storeHeadline}
                      onChange={e => setStoreHeadline(e.target.value)}
                      placeholder="Get the best data deals from ..."
                    />
                    <Button variant="outline" size="sm" onClick={saveStoreHeadline} disabled={savingHeadline}>
                      {savingHeadline ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Save Headline
                    </Button>
                  </div>

                  <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Primary Colour", key: "primary" },
                      { label: "Text on Primary", key: "primary_foreground" },
                      { label: "Page Background", key: "background" },
                      { label: "Card Background", key: "card_background" }
                    ].map(({ label, key }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-sm">{label}</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="color"
                            value={(themeColors as any)[key]}
                            onChange={e => setThemeColors({ ...themeColors, [key]: e.target.value })}
                            className="w-12 h-9 p-1 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={(themeColors as any)[key]}
                            onChange={e => setThemeColors({ ...themeColors, [key]: e.target.value })}
                            className="flex-1 font-mono text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-4">
                    <Label className="mb-2 block font-semibold flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-primary" /> Grid Layout
                    </Label>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-sm font-semibold">1 column per row (Fixed)</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Display is locked to single column for optimal mobile experience.</p>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button variant="hero" onClick={saveThemeColors} disabled={savingTheme}>
                      {savingTheme ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Save Theme
                    </Button>
                    <Button variant="ghost" onClick={() => setThemeColors(DEFAULT_THEME)}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-base">Live Preview</CardTitle>
                  <p className="text-xs text-muted-foreground">This is exactly how your public store will look.</p>
                </CardHeader>
                <CardContent>
                  <div
                    className="rounded-xl overflow-hidden border border-border"
                    style={{ backgroundColor: themeColors.background, minHeight: 320 }}
                  >
                    <div className="p-4" style={{ backgroundColor: themeColors.background }}>
                      <div className="text-center mb-3">
                        <p className="font-bold text-sm" style={{ color: themeColors.primary }}>
                          {subagentStore?.store_name || "Your Store Name"}
                        </p>
                        <p className="text-xs mt-1" style={{ color: `${themeColors.primary}99` }}>
                          {storeHeadline || "Your store headline"}
                        </p>
                      </div>
                      <div
                        className="grid gap-2 mt-3"
                        style={{ gridTemplateColumns: `repeat(1, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: 2 }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded-lg p-2 text-center text-xs"
                            style={{ backgroundColor: themeColors.card_background, border: `1px solid ${themeColors.primary}30` }}
                          >
                            <div className="font-bold text-white text-sm">{[1, 2, 3, 4, 5, 6, 8, 10][i] || i + 1}GB</div>
                            <div className="text-xs mt-1" style={{ color: `${themeColors.primary}cc` }}>MTN</div>
                            <div className="text-xs" style={{ color: "#ccc" }}>GHC {(4 + i * 3).toFixed(2)}</div>
                            <div
                              className="mt-1 rounded text-xs py-0.5 font-bold"
                              style={{ backgroundColor: themeColors.primary, color: themeColors.primary_foreground }}
                            >
                              Buy
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    1 column per row - Changes apply live after saving
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* NOTIFICATIONS */}
          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display text-lg">Send Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Send pop-up announcements that appear on your store page. Use this to announce promos, downtime, or new offers.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Message</Label>
                    <textarea
                      className="w-full rounded-md border border-border bg-background p-3 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter your announcement message..."
                      value={newNotificationMsg}
                      onChange={(e) => setNewNotificationMsg(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Expiry Date (Optional)</Label>
                    <Input
                      type="datetime-local"
                      value={newNotificationExpiry}
                      onChange={(e) => setNewNotificationExpiry(e.target.value)}
                      className="bg-background border-border"
                    />
                    <p className="text-xs text-muted-foreground">Leave empty for no expiry</p>
                  </div>
                  <Button variant="hero" onClick={createNotification} disabled={sendingNotification || !newNotificationMsg.trim()}>
                    {sendingNotification ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                    Send Notification
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display text-lg">Active Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingNotifications ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : notifications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No notifications yet</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-4 rounded-lg border border-border bg-secondary/30">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm whitespace-pre-wrap">{n.message}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>{new Date(n.created_at).toLocaleDateString()}</span>
                              {n.expires_at && <span>Expires: {new Date(n.expires_at).toLocaleDateString()}</span>}
                              <Badge variant={n.is_active ? "default" : "secondary"}>
                                {n.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleNotificationActive(n.id, n.is_active)}
                            >
                              {n.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-400"
                              onClick={() => deleteNotification(n.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FLYER GENERATOR */}
          <TabsContent value="flyer" className="mt-0 space-y-6">
            {subagentStore && (
              <FlyerGenerator
                storeName={subagentStore.store_name}
                storeUrl={storeUrl}
                whatsappNumber={subagentStore.whatsapp_number || ""}
                supportNumber={subagentStore.support_number || ""}
                packages={packages}
                agentPrices={subagentPrices}
                basePrices={basePrices}
                topupReference={subagentStore.topup_reference || ""}
              />
            )}
          </TabsContent>

          {/* COMMENTED OUT: mashup packages deactivated
          MTN MASHUP FLYER
          <TabsContent value="mashup-flyer" className="mt-0 space-y-6">
            {subagentStore && (
              <MashupFlyerGenerator
                storeName={subagentStore.store_name}
                storeUrl={storeUrl}
                whatsappNumber={subagentStore.whatsapp_number || ""}
                supportNumber={subagentStore.support_number || ""}
                packages={packages}
                agentPrices={subagentPrices}
                topupReference={subagentStore.topup_reference || ""}
                isSubagent={true}
              />
            )}
          </TabsContent>
          */}

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Store Information</CardTitle>
                {!editingStore && (
                  <Button variant="outline" size="sm" onClick={() => { 
                    setStoreForm({ 
                      store_name: subagentStore.store_name,
                      whatsapp_number: subagentStore.whatsapp_number,
                      support_number: subagentStore.support_number,
                      whatsapp_group: subagentStore.whatsapp_group,
                      show_whatsapp_group_icon: subagentStore.show_whatsapp_group_icon,
                      show_ussd_on_storefront: subagentStore.show_ussd_on_storefront ?? true,
                      momo_name: subagentStore.momo_name,
                      momo_number: subagentStore.momo_number,
                      momo_network: subagentStore.momo_network,
                    });
                    setEditingStore(true); 
                  }}>
                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {editingStore ? (
                  <>
                    <div className="space-y-2">
                      <Label>Store Name</Label>
                      <Input
                        value={storeForm.store_name || ""}
                        onChange={e => setStoreForm({ ...storeForm, store_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Number</Label>
                      <Input
                        value={storeForm.whatsapp_number || ""}
                        onChange={e => setStoreForm({ ...storeForm, whatsapp_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Support Number</Label>
                      <Input
                        value={storeForm.support_number || ""}
                        onChange={e => setStoreForm({ ...storeForm, support_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <Label>WhatsApp Group / Channel Link</Label>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="show-group-icon" className="text-sm text-muted-foreground cursor-pointer">Show join icon on storefront</Label>
                          <Switch 
                            id="show-group-icon" 
                            checked={storeForm.show_whatsapp_group_icon ?? true} 
                            onCheckedChange={c => setStoreForm({ ...storeForm, show_whatsapp_group_icon: c })} 
                          />
                        </div>
                      </div>
                      <Input 
                        value={storeForm.whatsapp_group || ""} 
                        onChange={e => setStoreForm({ ...storeForm, whatsapp_group: e.target.value })} 
                        placeholder="Paste the WhatsApp link here" 
                      />
                      <p className="text-xs text-muted-foreground">
                        {storeForm.show_whatsapp_group_icon !== false ? "A WhatsApp join icon will appear on your storefront." : "The join icon will be hidden."}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <Label>USSD Access Code</Label>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="show-ussd" className="text-sm text-muted-foreground cursor-pointer">Show USSD on storefront</Label>
                          <Switch 
                            id="show-ussd" 
                            checked={storeForm.show_ussd_on_storefront ?? true} 
                            onCheckedChange={c => setStoreForm({ ...storeForm, show_ussd_on_storefront: c })} 
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {storeForm.show_ussd_on_storefront !== false ? "The USSD code (*380*455#) and your access code will be displayed on your storefront." : "USSD information will be hidden from your storefront."}
                      </p>
                    </div>
                    <div className="border-t border-border pt-4 mt-4">
                      <p className="text-sm font-semibold mb-3">MoMo Payment Details</p>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>MoMo Name</Label>
                          <Input
                            value={storeForm.momo_name || ""}
                            onChange={e => setStoreForm({ ...storeForm, momo_name: e.target.value })}
                            placeholder="Account holder name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>MoMo Number</Label>
                          <Input
                            value={storeForm.momo_number || ""}
                            onChange={e => setStoreForm({ ...storeForm, momo_number: e.target.value })}
                            placeholder="e.g. 0551234567"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Network</Label>
                          <Select value={storeForm.momo_network || ""} onValueChange={v => setStoreForm({ ...storeForm, momo_network: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select network" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mtn">MTN</SelectItem>
                              <SelectItem value="vodafone">Vodafone</SelectItem>
                              <SelectItem value="airteltigo">AirtelTigo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setEditingStore(false)}>Cancel</Button>
                      <Button variant="hero" onClick={handleSaveStore} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                        Save Changes
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Store Name</p>
                      <p className="font-medium">{subagentStore.store_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp Number</p>
                      <p className="font-medium flex items-center gap-2">{subagentStore.whatsapp_number} <Phone className="h-4 w-4" /></p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Support Number</p>
                      <p className="font-medium">{subagentStore.support_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp Group</p>
                      <p className="font-medium">{subagentStore.whatsapp_group || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Show Group Icon</p>
                      <p className="font-medium">{subagentStore.show_whatsapp_group_icon !== false ? "Yes" : "No"}</p>
                    </div>
                    <div className="border-t border-border pt-3 mt-3">
                      <p className="text-sm font-semibold mb-2">MoMo Payment Details</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-sm text-muted-foreground">MoMo Name</p>
                          <p className="font-medium">{subagentStore.momo_name || "Not set"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">MoMo Number</p>
                          <p className="font-medium">{subagentStore.momo_number || "Not set"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Network</p>
                          <p className="font-medium">{subagentStore.momo_network?.toUpperCase() || "Not set"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* =================== REFUNDS TAB =================== */}
          <TabsContent value="refunds" className="mt-0 space-y-6">
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="p-4">
                <p className="text-sm text-orange-400">
                  <strong>Refunds:</strong> These are your orders that have been marked as refunded by admin. Contact your subagent or admin if you need a refund credited back to your wallet.
                </p>
              </CardContent>
            </Card>

            {(() => {
              const isRefunded = (o: Order) =>
                o.fulfillment_status === "refunded" ||
                o.status === "refunded" ||
                (o.order_status || "").toLowerCase() === "refunded";

              const refundedOrders = orders.filter(isRefunded);

              return (
                <>
                  <Card className="border-orange-500/30 bg-orange-500/5">
                    <CardContent className="p-6">
                      <div>
                        <p className="text-xs text-muted-foreground">Refunded Orders</p>
                        <p className="font-display text-3xl font-bold text-orange-400 mt-1">{refundedOrders.length}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {refundedOrders.length === 0 ? (
                    <Card>
                      <CardContent className="p-12 text-center">
                        <RotateCcw className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground">No refunded orders yet</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Network</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {refundedOrders.map((order: any) => (
                            <TableRow key={order.id}>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                              </TableCell>
                              <TableCell className="font-medium">{order.customer_number}</TableCell>
                              <TableCell className="uppercase text-sm">{order.network}</TableCell>
                              <TableCell>{order.size_gb}GB</TableCell>
                              <TableCell className="font-medium">GHS {Number(order.selling_price || order.amount || 0).toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                  Refunded
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
      <ChatBot page="subsubagent-dashboard" />
    </div>
  );
};

export default SubSubagentDashboard;
