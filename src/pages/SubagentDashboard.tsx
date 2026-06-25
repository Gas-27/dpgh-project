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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Store, Settings, LogOut, BarChart3, ShoppingCart, ArrowDownToLine, Copy,
  ExternalLink, Wallet, Loader2, Edit2, Save, Phone, Menu, Image, Bell, Palette, Percent, AlertTriangle, ShieldAlert,
  ChevronUp, ChevronDown, BookOpen, Search, TrendingUp, Plus, Minus, LayoutGrid, RotateCcw, Layers, FileSpreadsheet, Upload, Zap,
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
import SubSubagentPricesManager from "@/components/SubSubagentPricesManager";
import SubSubagentsList from "@/components/SubSubagentsList";
import { DOMAINS } from "@/config/domains";

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
  { icon: "📦", title: "Bulk Orders", content: `Send data to multiple recipients at once using your wallet.\n\nHow to use:\n1. SELECT NETWORK – Choose MTN, Telecel, or AirtelTigo.\n2. RECIPIENTS – Upload a CSV/Excel file OR type manually.\n   • Format: phone number followed by GB size, one per line\n   • Example: 0241234567 2 (sends 2GB to that number)\n3. GLOBAL PACKAGE (Optional) – Set a default GB size for all recipients.\n4. Review the summary showing total recipients, total GB, and total cost.\n5. Click "Pay with Wallet" to process all orders at once.\n\nTips:\n• CSV/Excel files should have phone in Column A, GB sizes in Column B.\n• Results table shows success/failure for each recipient.` },
  { icon: "💰", title: "Store Prices", content: `Set your selling prices for each data package.\n\n• Cost from Agent = what your agent charges you\n• Your Selling Price = what customers pay you\n• Profit = Your Selling Price - Cost from Agent\n\nUse markup to increase all prices by a percentage.` },
  { icon: "📦", title: "Orders", content: `View all customer orders.\n\n• Track order status (pending, completed, failed)\n• See customer details and amounts\n• Monitor your sales history` },
  { icon: "💸", title: "Withdraw", content: `Cash out your wallet balance to your MoMo account.\n\n• Minimum withdrawal: GH₵ 10.00\n• Only one pending withdrawal at a time\n• Processed within 24 hours` },
  { icon: "🎨", title: "Flyer Generator", content: `Create promotional flyers for your store.\n\n• Customize colors and design\n• Add your store name and contact\n• Download or share to WhatsApp` },
  { icon: "🎨", title: "Appearance", content: `Customize your store appearance.\n\n• Change primary color\n• Update store banner\n• Modify theme settings` },
  { icon: "⚙️", title: "Settings", content: `Manage your store information.\n\n• Store Name\n• WhatsApp Number\n• Support Number` },
];

const SubagentDashboard = () => {
  const { signOut, user, isSubagent, isSubSubagent, isAdmin } = useAuth();
  const { toast } = useToast();

  const getImpersonationData = () => {
    if (typeof window === 'undefined') return { userId: null, storeId: null, storeName: null };
    
    // Check URL params first (for cross-domain admin impersonation)
    const urlParams = new URLSearchParams(window.location.search);
    const adminToken = urlParams.get("admin_token");
    if (adminToken) {
      try {
        // Decode URI component first, then parse JSON (to handle non-Latin1 characters)
        const decoded = JSON.parse(decodeURIComponent(atob(adminToken)));
        // Token is va base id for 1 hour
        if (decoded.timestamp && Date.now() - decoded.timestamp < 3600000) {
          // Store in localStorage for subsequent navigations and remove from URL
          localStorage.setItem("admin_impersonate_subagent", decoded.userId || "");
          localStorage.setItem("admin_impersonate_store_id", decoded.storeId || "");
          localStorage.setItem("admin_impersonate_store", decoded.storeName || "");
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return { userId: decoded.userId, storeId: decoded.storeId, storeName: decoded.storeName };
        }
      } catch (e) {
        console.error("Invalid admin token");
      }
    }
    
    // Fall back to localStorage
    const userId = localStorage.getItem("admin_impersonate_subagent");
    const storeId = localStorage.getItem("admin_impersonate_store_id");
    const storeName = localStorage.getItem("admin_impersonate_store");
    return { userId, storeId, storeName };
  };
  
  const [impersonationData] = useState(getImpersonationData);
  const impersonatedUserId = impersonationData.userId;
  const impersonatedStoreId = impersonationData.storeId;
  const isImpersonating = !!impersonatedUserId || !!impersonatedStoreId;

  const [subagentStore, setSubagentStore] = useState<SubagentStore | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [storeForm, setStoreForm] = useState<Partial<SubagentStore>>({});
  const [saving, setSaving] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const [transferRecipients, setTransferRecipients] = useState<any[]>([]);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [createNewRecipient, setCreateNewRecipient] = useState(false);
  const [recipientType, setRecipientType] = useState<"bank" | "mobile_money">("bank");
  const [recipientName, setRecipientName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [mobileNetwork, setMobileNetwork] = useState("mtn");
  const [mobileNumber, setMobileNumber] = useState("");
  const [packages, setPackages] = useState<any[]>([]);
  const [basePrices, setBasePrices] = useState<Record<string, number>>({});
  const [subagentPrices, setSubagentPrices] = useState<Record<string, number>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({});
  const [markupPercent, setMarkupPercent] = useState("");
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [savingPrices, setSavingPrices] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [openManualSection, setOpenManualSection] = useState<number | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [buyingPkg, setBuyingPkg] = useState<any>(null);
  const [buyCustomerNumber, setBuyCustomerNumber] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [subSubagentEditedPrices, setSubSubagentEditedPrices] = useState<Record<string, number | string>>({});
  const [subSubagentMarkupPercent, setSubSubagentMarkupPercent] = useState("");
  const [subSubagentNetworkFilter, setSubSubagentNetworkFilter] = useState("mtn");
  const [savingSubSubagentPrices, setSavingSubSubagentPrices] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [newNotificationMsg, setNewNotificationMsg] = useState("");
  const [newNotificationExpiry, setNewNotificationExpiry] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [themeColors, setThemeColors] = useState(DEFAULT_THEME);
  const [savingTheme, setSavingTheme] = useState(false);
  const [storeHeadline, setStoreHeadline] = useState("");
  const [savingHeadline, setSavingHeadline] = useState(false);
  const [paystackTopupAmount, setPaystackTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupHistory, setTopupHistory] = useState<{ id: string; amount: number; paystack_reference: string | null; created_at: string }[]>([]);
  const [agentInfo, setAgentInfo] = useState<{ whatsapp_number?: string; support_number?: string; store_name?: string } | null>(null);
  
  // Sub-Subagents
  const [subSubagents, setSubSubagents] = useState<any[]>([]);
  const [subSubagentFormOpen, setSubSubagentFormOpen] = useState(false);
  const [loadingSubSubagents, setLoadingSubSubagents] = useState(false);
  const [subSubagentPrices, setSubSubagentPrices] = useState<Record<string, number>>({});
  const [subSubagentEditedSubSubPrices, setSubSubagentEditedSubSubPrices] = useState<Record<string, number | string>>({});
  const [subSubagentMarkupPercentForSubsub, setSubSubagentMarkupPercentForSubsub] = useState("");
  const [subSubagentNetworkFilterForSubsub, setSubSubagentNetworkFilterForSubsub] = useState("mtn");
  const [savingSubSubSubagentPrices, setSavingSubSubSubagentPrices] = useState(false);

  // Load the GLOBAL template prices this subagent has set for their sub-subagents
  // (stored in sub_subagent_package_prices with sub_subagent_store_id = NULL).
  // This mirrors how the Agent loads the base prices it set for subagents.
  useEffect(() => {
    const loadSubSubagentTemplate = async () => {
      if (!subagentStore?.id) return;
      const { data, error } = await supabase
        .from("sub_subagent_package_prices")
        .select("package_id, base_price")
        .eq("subagent_store_id", subagentStore.id)
        .is("sub_subagent_store_id", null);
      if (!error && data) {
        const map: Record<string, number> = {};
        data.forEach((p: any) => {
          if (p.base_price !== null && p.base_price !== undefined) {
            map[p.package_id] = Number(p.base_price);
          }
        });
        setSubSubagentPrices(map);
      }
    };
    loadSubSubagentTemplate();
  }, [subagentStore?.id]);

  const [subSubagentProfitForSubagent, setSubSubagentProfitForSubagent] = useState<number>(0);
  const [subSubagentOrdersCount, setSubSubagentOrdersCount] = useState<number>(0);
  const [subSubagentNotifications, setSubSubagentNotifications] = useState<any[]>([]);
  const [subSubagentNotificationMsg, setSubSubagentNotificationMsg] = useState("");
  const [sendingSubSubagentNotification, setSendingSubSubagentNotification] = useState(false);
  
  // Bulk Orders
  // COMMENTED OUT: mashup packages deactivated
  const [bulkNetwork, setBulkNetwork] = useState<"mtn" | "telecel" | "airteltigo">("mtn");
  const [bulkRecipients, setBulkRecipients] = useState("");
  const [bulkGlobalSize, setBulkGlobalSize] = useState<number | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ phone: string; size: number; status: string; error?: string }[]>([]);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Handle bulk payment callback - show success message after returning from Paystack
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("bulk_payment") === "true" && urlParams.get("reference")) {
      toast({
        title: "Bulk Order Placed Successfully!",
        description: "Your orders have been placed. Check the Orders tab to track them.",
        duration: 8000,
      });
      // Clear URL params without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);
  
  // Pagination for orders
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 50; // Changed from 100 to 50 for "Load More" functionality
  
  // Date filtering for orders/revenue/profit
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week" | "month" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  
  // Agent notification popup state
  const [showAgentNotificationPopup, setShowAgentNotificationPopup] = useState(true);

  // Helper function to get available wallet balance
  // Uses the actual wallet_balance from database, minus any pending withdrawals
  const getAvailableBalance = () => {
    const dbBalance = subagentStore?.wallet_balance || 0;
    // Deduct pending withdrawals from available balance
    const pendingWithdrawals = withdrawals.filter(w => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);
    return dbBalance - pendingWithdrawals;
  };

  // Function to exit impersonation
  const exitImpersonation = () => {
    localStorage.removeItem("admin_impersonate_subagent");
    localStorage.removeItem("admin_impersonate_store_id");
    localStorage.removeItem("admin_impersonate_store");
    localStorage.removeItem("admin_impersonate_return");
    // Redirect back to admin dashboard on main domain
    window.location.href = "https://datastores.shop/admin";
  };

  useEffect(() => {
    // Use impersonated user ID/store ID if available, otherwise use logged in user
    const effectiveUserId = impersonatedUserId || user?.id;
    if (!effectiveUserId && !impersonatedStoreId) {
      return;
    }
    // Load data for any logged-in user, impersonated user, or impersonated store
    if (impersonatedStoreId) {
      fetchData(undefined, impersonatedStoreId);
    } else {
      fetchData(effectiveUserId);
    }
  }, [user?.id, isImpersonating, impersonatedUserId, impersonatedStoreId]);

  // Sync calculated wallet balance to database when data changes
  // Use a ref to track if we've synced to prevent infinite loops
  const hasSyncedRef = useRef(false);
  const lastSyncedBalanceRef = useRef<number | null>(null);
  
  useEffect(() => {
    const syncWalletBalance = async () => {
      if (!subagentStore?.id) return;
      
      // Calculate wallet: Profit + Topups - COMPLETED Withdrawals - Wallet Purchases
      // Backend automatically adds AFA registration profit and subagent registration fees
      const completedOrders = orders.filter(o => (o.status === "completed" || o.status === "paid"));
      const profit = completedOrders.reduce((sum, order) => {
        if (order.profit) return sum + Number(order.profit);
        const baseCost = order.base_price || (order.package_id ? (basePrices[order.package_id] || 0) : 0);
        return sum + (Number(order.selling_price || order.amount) - baseCost);
      }, 0);
      const topups = topupHistory.reduce((s, t) => s + Number(t.amount || 0), 0);
      // Only subtract COMPLETED withdrawals from the stored balance
      const completedWithdrawals = withdrawals.filter(w => w.status === "completed").reduce((s, w) => s + Number(w.amount), 0);
      // Subtract purchases made with wallet (from buy data and bulk order sections)
      const walletPurchases = orders.filter(o => o.payment_method === "wallet" && (o.status === "completed" || o.status === "paid")).reduce((s, o) => s + Number(o.amount || 0), 0);
      const calculatedBalance = profit + topups - completedWithdrawals - walletPurchases;
      
      // Only sync if the balance has changed from last sync
      if (lastSyncedBalanceRef.current === calculatedBalance) return;
      
      // Update the database
      const { error } = await supabase
        .from("subagent_stores")
        .update({ wallet_balance: calculatedBalance })
        .eq("id", subagentStore.id);
      
      if (!error) {
        lastSyncedBalanceRef.current = calculatedBalance;
      }
    };
    
    syncWalletBalance();
  }, [orders.length, topupHistory.length, withdrawals.length, subagentStore?.id]);

  // Real-time wallet balance updates
  useEffect(() => {
    if (!subagentStore?.id) return;

    // Subscribe to wallet balance updates in real-time
    const walletChannel = supabase
      .channel(`subagent-wallet-${subagentStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "subagent_stores",
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
      .channel(`subagent-orders-wallet-${subagentStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `subagent_store_id=eq.${subagentStore.id}`,
        },
        () => {
          // Re-fetch orders to update wallet calculation
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to withdrawal changes
    const withdrawalsChannel = supabase
      .channel(`subagent-withdrawals-wallet-${subagentStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
          filter: `subagent_store_id=eq.${subagentStore.id}`,
        },
        () => {
          // Re-fetch data to update wallet
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to new sub-subagent registrations
    const subSubagentChannel = supabase
      .channel(`subagent-sub-subagents-${subagentStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sub_subagent_stores",
          filter: `subagent_store_id=eq.${subagentStore.id}`,
        },
        () => {
          console.log("[v0] New sub-subagent registered, refreshing list...");
          // Re-fetch data to show new sub-subagent
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(withdrawalsChannel);
      supabase.removeChannel(subSubagentChannel);
    };
  }, [subagentStore?.id]);

  // Auto-refresh DISABLED - Users can manually refresh with browser refresh button
  // Previously this would auto-refresh wallet balance and orders every 1 second
  // This was disabled because it was causing unnecessary page updates and was annoying when users were editing data
  // Users can still manually refresh the page with Cmd+R / Ctrl+R or use the browser's refresh button
  useEffect(() => {
    // Placeholder - auto-refresh disabled
  }, [subagentStore?.id]);

  const fetchData = async (userId?: string, storeId?: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      
      // If admin is impersonating and passed storeId, use that directly
      if (storeId) {
        console.log("[v0] SubagentDashboard - Admin impersonation with storeId:", storeId);
        const { data: storeData, error: storeErr } = await supabase
          .from("subagent_stores")
          .select("id, store_name, whatsapp_number, support_number, momo_number, momo_name, momo_network, wallet_balance, approved, agent_store_id, created_at, theme_config, store_headline, whatsapp_group, topup_reference, allow_sub_subagent_registration")
          .eq("id", storeId)
          .single();

        if (storeErr || !storeData) {
          console.error("[v0] Error fetching subagent store by ID:", storeErr);
          setLoadError("Failed to load your store. Please refresh the page or try again.");
          setLoading(false);
          return;
        }

        const store = storeData;
        console.log("[v0] Loaded store:", store.store_name, "with id:", store.id);
        // Always use the database value for allow_sub_subagent_registration
        setSubagentStore({
          ...store,
          allow_sub_subagent_registration: store.allow_sub_subagent_registration || false
        });
        setStoreForm(store);
        setLoadError(null);
        
        // Set theme colors and headline from store (with null checks)
        if (store?.theme_config && typeof store.theme_config === 'object') {
          setThemeColors({ ...DEFAULT_THEME, ...store.theme_config });
        }
        if (store?.store_headline) {
          setStoreHeadline(store.store_headline);
        }

        // Run all other queries in parallel for faster loading
        const [
          ordersResult,
          withdrawResult,
          packagesResult,
          agentSubagentPricesResult,
          adminCustomPricesResult,
          subagentPricesResult,
          topupsResult,
          agentInfoResult,
          subSubagentsResult,
          recipientsResult,
          payoutResult
        ] = await Promise.all([
          supabase.from("orders").select("*").eq("subagent_store_id", store.id).order("created_at", { ascending: false }).range(0, 99999999),
          supabase.from("withdrawal_requests").select("*").eq("subagent_store_id", store.id).order("created_at", { ascending: false }),
          supabase.from("data_packages").select("*").eq("active", true).order("size_gb"),
          supabase.from("subagent_package_prices").select("package_id, base_price").eq("agent_store_id", store.agent_store_id),
          supabase.from("agent_custom_base_prices").select("package_id, custom_base_price").eq("agent_store_id", store.agent_store_id),
          supabase.from("subagent_package_prices").select("package_id, sell_price").eq("subagent_store_id", store.id),
          supabase.from("subagent_wallet_topups").select("id, amount, paystack_reference, created_at").eq("subagent_store_id", store.id).order("created_at", { ascending: false }).limit(50),
          supabase.from("agent_stores").select("whatsapp_number, support_number, store_name").eq("id", store.agent_store_id).single(),
          supabase.from("sub_subagent_stores").select("*").eq("subagent_store_id", store.id).order("created_at", { ascending: false }),
          supabase.from("transfer_recipients").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }),
          supabase.from("payout_requests").select("*").eq("requester_id", store.id).order("created_at", { ascending: false })
        ]);

        setOrders(ordersResult.data || []);
        const payoutData = (withdrawResult.data ?? []).map((p: any) => {
          const recipientDetails = p.recipient_details || {};
          return {
            ...p,
            account_holder_name: p.account_holder_name || recipientDetails.account_holder_name || p.recipient_name || "Unknown",
            provider_type: p.provider_type || recipientDetails.provider_type,
            mobile_money_network: p.mobile_money_network || recipientDetails.mobile_money_network,
            mobile_money_number: p.mobile_money_number || recipientDetails.mobile_money_number,
            account_number: p.account_number || recipientDetails.account_number,
            bank_name: p.bank_name || recipientDetails.bank_name,
            bank_code: p.bank_code || recipientDetails.bank_code,
          };
        });
        setWithdrawals(payoutData);
        setTransferRecipients(recipientsResult.data || []);
        setPackages(packagesResult.data || []);
        setTopupHistory(topupsResult.data || []);
        if (agentInfoResult.data) setAgentInfo(agentInfoResult.data);
        
        // Fetch sub-subagent orders and calculate profits
        const subSubagentsData = subSubagentsResult.data || [];
        setSubSubagents(subSubagentsData);
        
        if (subSubagentsData.length > 0) {
          const subSubagentIds = subSubagentsData.map(s => s.id);
          const { data: subSubagentOrders } = await supabase
            .from("orders")
            .select("*")
            .in("sub_subagent_store_id", subSubagentIds);
          
          const subSubagentOrdersList = subSubagentOrders || [];
          setSubSubagentOrdersCount(subSubagentOrdersList.length);
          
          // Calculate profit: difference between what sub-subagent charged (order_price) vs what we charged them (package price)
          let totalProfit = 0;
          subSubagentOrdersList.forEach(order => {
            const profit = (Number(order.order_price) || 0) - (Number(order.package_price) || 0);
            if (profit > 0) totalProfit += profit;
          });
          
          setSubSubagentProfitForSubagent(totalProfit);
        }
        
        // Fetch sub-subagent notifications
        await fetchSubSubagentNotifications();
        
        // Build admin custom price map (admin's price to agents - NOT for subagents)
        const adminPriceMap: Record<string, number> = {};
        (adminCustomPricesResult.data || []).forEach((p: any) => {
          if (p.custom_base_price) adminPriceMap[p.package_id] = p.custom_base_price;
        });
        
        // Build agent's subagent base prices map (what agent charges subagent - THIS IS THE CORRECT ONE)
        const agentSubagentPriceMap: Record<string, number> = {};
        (agentSubagentPricesResult.data || []).forEach((p: any) => {
          if (p.base_price !== null && p.base_price !== undefined) {
            agentSubagentPriceMap[p.package_id] = Number(p.base_price);
          }
        });
        
        // Final price map: Agent's subagent price is the ONLY correct base price for subagents
        // Only fall back to admin price if agent hasn't set any prices yet
        const priceMap: Record<string, number> = {};
        const hasAgentPrices = Object.keys(agentSubagentPriceMap).length > 0;
        
        (packagesResult.data || []).forEach((p: any) => {
          if (hasAgentPrices && agentSubagentPriceMap[p.id] !== undefined) {
            // Use agent's price for subagent
            priceMap[p.id] = agentSubagentPriceMap[p.id];
          } else if (adminPriceMap[p.id] !== undefined) {
            // Fallback to admin price only if agent hasn't set prices
            priceMap[p.id] = adminPriceMap[p.id];
          } else {
            // Final fallback to package default
            priceMap[p.id] = p.price;
          }
        });
        setBasePrices(priceMap);
        
        if (subagentPricesResult.data) {
          const subagentPriceMap: Record<string, number> = {};
          subagentPricesResult.data.forEach((p: any) => {
            subagentPriceMap[p.package_id] = p.sell_price;
          });
          setSubagentPrices(subagentPriceMap);
        }
        return;
      } else {
        // Normal flow - filter by user_id
        const effectiveUserId = userId || user?.id;
        console.log("[v0] SubagentDashboard - fetchData called with effectiveUserId:", effectiveUserId);
        if (!effectiveUserId) {
          setLoadError("Authentication error. Please log in again.");
          setLoading(false);
          return;
        }

        // Fetch subagent store first (needed for other queries)
        // Filter by user_id to ensure each subagent only sees their own store
        console.log("[v0] Querying subagent_stores with user_id:", effectiveUserId);
        const { data: storeData, error: storeErr } = await supabase
          .from("subagent_stores")
          .select("id, store_name, whatsapp_number, support_number, momo_number, momo_name, momo_network, wallet_balance, approved, agent_store_id, created_at, theme_config, store_headline, whatsapp_group, topup_reference, allow_sub_subagent_registration")
          .eq("user_id", effectiveUserId);

        console.log("[v0] Store query result - error:", storeErr, "count:", storeData?.length);
        if (storeErr) {
          console.error("[v0] Error fetching subagent store:", storeErr);
          setLoadError("Failed to load your store. Please refresh the page or try again.");
          setLoading(false);
          return;
        }

        if (!storeData || storeData.length === 0) {
          console.warn("[v0] No subagent store found for user_id:", effectiveUserId);
          setLoadError("Store not found. Please contact your agent to complete registration.");
          setLoading(false);
          return;
        }

        const store = storeData[0];
        console.log("[v0] Loaded store:", store.store_name, "with id:", store.id);
        setSubagentStore(store);
        setStoreForm(store);
        setLoadError(null);
        
        // Set theme colors and headline from store (with null checks)
        if (store?.theme_config && typeof store.theme_config === 'object') {
          setThemeColors({ ...DEFAULT_THEME, ...store.theme_config });
        }
        if (store?.store_headline) {
          setStoreHeadline(store.store_headline);
        }

        // Run all other queries in parallel for faster loading
        const [
          ordersResult,
          withdrawResult,
          packagesResult,
          agentSubagentPricesResult,
          adminCustomPricesResult,
          subagentPricesResult,
          topupsResult,
          agentInfoResult,
          subSubagentsResult
        ] = await Promise.all([
          supabase.from("orders").select("*").eq("subagent_store_id", store.id).order("created_at", { ascending: false }).range(0, 99999999),
          supabase.from("withdrawal_requests").select("*").eq("subagent_store_id", store.id).order("created_at", { ascending: false }),
          supabase.from("data_packages").select("*").eq("active", true).order("size_gb"),
          supabase.from("subagent_package_prices").select("package_id, base_price").eq("agent_store_id", store.agent_store_id),
          supabase.from("agent_custom_base_prices").select("package_id, custom_base_price").eq("agent_store_id", store.agent_store_id),
          supabase.from("subagent_package_prices").select("package_id, sell_price").eq("subagent_store_id", store.id),
          supabase.from("subagent_wallet_topups").select("id, amount, paystack_reference, created_at").eq("subagent_store_id", store.id).order("created_at", { ascending: false }).limit(50),
          supabase.from("agent_stores").select("whatsapp_number, support_number, store_name").eq("id", store.agent_store_id).single(),
          supabase.from("sub_subagent_stores").select("*").eq("subagent_store_id", store.id).order("created_at", { ascending: false })
        ]);

        // Enrich mtn_mashup and mashup orders with size_gb_text and data_package_id
        const enrichedOrders2 = await Promise.all((ordersResult.data || []).map(async (order: any) => {
          if ((order.network === "mtn_mashup" || order.network === "mashup") && order.package_id) {
            const { data: pkg } = await supabase.from("data_packages").select("size_gb_text, data_package_id").eq("id", order.package_id).single();
            return { ...order, size_gb_text: pkg?.size_gb_text, data_package_id: pkg?.data_package_id };
          }
          return order;
        }));

        setOrders(ordersResult.data || []);
        const payoutData2 = (withdrawResult.data ?? []).map((p: any) => {
          const recipientDetails = p.recipient_details || {};
          return {
            ...p,
            account_holder_name: p.account_holder_name || recipientDetails.account_holder_name || p.recipient_name || "Unknown",
            provider_type: p.provider_type || recipientDetails.provider_type,
            mobile_money_network: p.mobile_money_network || recipientDetails.mobile_money_network,
            mobile_money_number: p.mobile_money_number || recipientDetails.mobile_money_number,
            account_number: p.account_number || recipientDetails.account_number,
            bank_name: p.bank_name || recipientDetails.bank_name,
            bank_code: p.bank_code || recipientDetails.bank_code,
          };
        });
        setWithdrawals(payoutData2);
        setPackages(packagesResult.data || []);
        setTopupHistory(topupsResult.data || []);
        if (agentInfoResult.data) setAgentInfo(agentInfoResult.data);
        
        // Set sub-subagents
        const subSubagentsData = subSubagentsResult.data || [];
        setSubSubagents(subSubagentsData);
        
        // Calculate sub-subagent stats
        if (subSubagentsData.length > 0) {
          const subSubagentIds = subSubagentsData.map(s => s.id);
          const { data: subSubagentOrders } = await supabase
            .from("orders")
            .select("*")
            .in("sub_subagent_store_id", subSubagentIds);
          
          const subSubagentOrdersList = subSubagentOrders || [];
          setSubSubagentOrdersCount(subSubagentOrdersList.length);
          
          let totalProfit = 0;
          subSubagentOrdersList.forEach(order => {
            const profit = (Number(order.selling_price) || 0) - (Number(order.base_price) || 0);
            totalProfit += profit;
          });
          setSubSubagentTotalProfit(totalProfit);
        }
        
        // Build admin custom price map (admin's price to agents - NOT for subagents)
        const adminPriceMap: Record<string, number> = {};
        (adminCustomPricesResult.data || []).forEach((p: any) => {
          if (p.custom_base_price) adminPriceMap[p.package_id] = p.custom_base_price;
        });
        
        // Build agent's subagent base prices map (what agent charges subagent - THIS IS THE CORRECT ONE)
        const agentSubagentPriceMap: Record<string, number> = {};
        (agentSubagentPricesResult.data || []).forEach((p: any) => {
          if (p.base_price !== null && p.base_price !== undefined) {
            agentSubagentPriceMap[p.package_id] = Number(p.base_price);
          }
        });
        
        // Final price map: Agent's subagent price is the ONLY correct base price for subagents
        // Only fall back to admin price if agent hasn't set any prices yet
        const priceMap: Record<string, number> = {};
        const hasAgentPrices = Object.keys(agentSubagentPriceMap).length > 0;
        
        (packagesResult.data || []).forEach((p: any) => {
          if (hasAgentPrices && agentSubagentPriceMap[p.id] !== undefined) {
            // Use agent's price for subagent
            priceMap[p.id] = agentSubagentPriceMap[p.id];
          } else if (adminPriceMap[p.id] !== undefined) {
            // Fallback to admin price only if agent hasn't set prices
            priceMap[p.id] = adminPriceMap[p.id];
          } else {
            // Final fallback to package default
            priceMap[p.id] = p.price;
          }
        });
        setBasePrices(priceMap);
        
        if (subagentPricesResult.data) {
          const subagentPriceMap: Record<string, number> = {};
          subagentPricesResult.data.forEach((p: any) => {
            subagentPriceMap[p.package_id] = p.sell_price;
          });
          setSubagentPrices(subagentPriceMap);
        }
      }

      if (!storeId) return;

        // Run all other queries in parallel for faster loading
        const [
          ordersResult,
          withdrawResult,
          packagesResult,
          agentSubagentPricesResult,
          adminCustomPricesResult,
          subagentPricesResult,
          topupsResult,
          agentInfoResult
        ] = await Promise.all([
          supabase.from("orders").select("*").eq("subagent_store_id", store.id).order("created_at", { ascending: false }).range(0, 99999999),
          supabase.from("withdrawal_requests").select("*").eq("subagent_store_id", store.id).order("created_at", { ascending: false }),
          supabase.from("data_packages").select("*").eq("active", true).order("size_gb"),
          supabase.from("subagent_package_prices").select("package_id, base_price").eq("agent_store_id", store.agent_store_id),
          supabase.from("agent_custom_base_prices").select("package_id, custom_base_price").eq("agent_store_id", store.agent_store_id),
          supabase.from("subagent_package_prices").select("package_id, sell_price").eq("subagent_store_id", store.id),
          supabase.from("subagent_wallet_topups").select("id, amount, paystack_reference, created_at").eq("subagent_store_id", store.id).order("created_at", { ascending: false }).limit(50),
          supabase.from("agent_stores").select("whatsapp_number, support_number, store_name").eq("id", store.agent_store_id).single()
        ]);

        // Enrich mtn_mashup and mashup orders with size_gb_text and data_package_id
        const enrichedOrders = await Promise.all((ordersResult.data || []).map(async (order: any) => {
          if ((order.network === "mtn_mashup" || order.network === "mashup") && order.package_id) {
            const { data: pkg } = await supabase.from("data_packages").select("size_gb_text, data_package_id").eq("id", order.package_id).single();
            return { ...order, size_gb_text: pkg?.size_gb_text, data_package_id: pkg?.data_package_id };
          }
          return order;
        }));
        setOrders(enrichedOrders);
        const payoutData3 = (withdrawResult.data ?? []).map((p: any) => {
          const recipientDetails = p.recipient_details || {};
          return {
            ...p,
            account_holder_name: p.account_holder_name || recipientDetails.account_holder_name || p.recipient_name || "Unknown",
            provider_type: p.provider_type || recipientDetails.provider_type,
            mobile_money_network: p.mobile_money_network || recipientDetails.mobile_money_network,
            mobile_money_number: p.mobile_money_number || recipientDetails.mobile_money_number,
            account_number: p.account_number || recipientDetails.account_number,
            bank_name: p.bank_name || recipientDetails.bank_name,
            bank_code: p.bank_code || recipientDetails.bank_code,
          };
        });
        setWithdrawals(payoutData3);
        setPackages(packagesResult.data || []);
        setTopupHistory(topupsResult.data || []);
        if (agentInfoResult.data) setAgentInfo(agentInfoResult.data);
      
      // Build admin custom price map (admin's price to agents - NOT for subagents)
      const adminPriceMap: Record<string, number> = {};
      (adminCustomPricesResult.data || []).forEach((p: any) => {
        if (p.custom_base_price) adminPriceMap[p.package_id] = p.custom_base_price;
      });
      
      // Build agent's subagent base prices map (what agent charges subagent - THIS IS THE CORRECT ONE)
      const agentSubagentPriceMap: Record<string, number> = {};
      (agentSubagentPricesResult.data || []).forEach((p: any) => {
        if (p.base_price !== null && p.base_price !== undefined) {
          agentSubagentPriceMap[p.package_id] = Number(p.base_price);
        }
      });
      
      // Final price map: Agent's subagent price is the ONLY correct base price for subagents
      // Only fall back to admin price if agent hasn't set any prices yet
      const priceMap: Record<string, number> = {};
      const hasAgentPrices = Object.keys(agentSubagentPriceMap).length > 0;
      
      (packagesResult.data || []).forEach((p: any) => {
        if (hasAgentPrices && agentSubagentPriceMap[p.id] !== undefined) {
          // Use agent's price for subagent
          priceMap[p.id] = agentSubagentPriceMap[p.id];
        } else if (adminPriceMap[p.id] !== undefined) {
          // Fallback to admin price only if agent hasn't set prices
          priceMap[p.id] = adminPriceMap[p.id];
        } else {
          // Final fallback to package default
          priceMap[p.id] = p.price;
        }
      });
      setBasePrices(priceMap);
      
      if (subagentPricesResult.data) {
        const priceMap: Record<string, number> = {};
        subagentPricesResult.data.forEach((p: any) => {
          priceMap[p.package_id] = p.sell_price;
        });
        setSubagentPrices(priceMap);
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
        .from("subagent_notifications")
        .select("*")
        .eq("subagent_store_id", subagentStore.id)
        .order("created_at", { ascending: false });
      if (!error && data) setNotifications(data);
      if (error) console.warn("[v0] Error fetching notifications:", error);
    } catch (e) {
      console.warn("[v0] Exception fetching notifications:", e);
    }
    setLoadingNotifications(false);
  };

  // Fetch notifications from agent
  const [agentNotifications, setAgentNotifications] = useState<any[]>([]);
  const fetchAgentNotifications = async () => {
    if (!subagentStore?.agent_store_id) return;
    const { data, error } = await supabase
      .from("agent_to_subagent_notifications")
      .select("*")
      .eq("agent_store_id", subagentStore.agent_store_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (!error && data) setAgentNotifications(data);
  };

  useEffect(() => {
    if (subagentStore?.id) {
      fetchNotifications();
      fetchAgentNotifications();
    }
  }, [subagentStore?.id]);

  // Check for pending wallet topup from URL params
  useEffect(() => {
    if (!subagentStore?.id) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlRef = urlParams.get("reference") || urlParams.get("trxref");
    const sessionRef = sessionStorage.getItem("pending_subagent_wallet_topup");
    const ref = urlRef || sessionRef;
    
    if (!ref) return;
    
    if (urlRef) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    supabase.functions.invoke("verify-payment", { body: { reference: ref } })
      .then(({ data }) => {
        if (data?.success && !data?.already_processed) {
          toast({ title: "Wallet topped up!", description: data.message });
          fetchData();
        } else if (data?.already_processed) {
          fetchData();
        }
        sessionStorage.removeItem("pending_subagent_wallet_topup");
      })
      .catch(() => {
        sessionStorage.removeItem("pending_subagent_wallet_topup");
      });
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

  const createNotification = async () => {
    if (!subagentStore || !newNotificationMsg.trim()) {
      toast({ title: "Error", description: "Please enter a message", variant: "destructive" });
      return;
    }
    setSendingNotification(true);
    const expires_at = newNotificationExpiry ? new Date(newNotificationExpiry).toISOString() : null;
    const { error } = await supabase.from("subagent_notifications").insert({
      subagent_store_id: subagentStore.id,
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
    const { error } = await supabase.from("subagent_notifications").update({ is_active: !cur }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from("subagent_notifications").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchNotifications();
  };

  // Sub-Subagent Notification handlers
  const sendSubSubagentNotification = async () => {
    if (!subSubagentNotificationMsg.trim() || !subagentStore?.id) return;
    try {
      setSendingSubSubagentNotification(true);
      // Get all sub-subagents under this subagent
      const { data: subSubagents, error: fetchError } = await supabase
        .from("sub_subagent_stores")
        .select("id")
        .eq("subagent_store_id", subagentStore.id);
      
      if (fetchError) throw fetchError;
      if (!subSubagents || subSubagents.length === 0) {
        toast({ title: "Info", description: "No sub-subagents to send notifications to" });
        setSendingSubSubagentNotification(false);
        return;
      }

      // Create a notification for each sub-subagent
      const notifications = subSubagents.map((ssa: any) => ({
        subagent_store_id: subagentStore.id,
        sub_subagent_store_id: ssa.id,
        message: subSubagentNotificationMsg.trim(),
        is_active: true,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("sub_subagent_notifications").insert(notifications);
      if (error) throw error;
      setSubSubagentNotificationMsg("");
      toast({ title: "Success", description: `Notification sent to ${subSubagents.length} sub-subagent(s)` });
      fetchSubSubagentNotifications();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSendingSubSubagentNotification(false);
    }
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
      const { data } = await supabase
        .from("sub_subagent_notifications")
        .select("*")
        .eq("subagent_store_id", subagentStore.id)
        .order("created_at", { ascending: false });
      if (data) setSubSubagentNotifications(data);
    } catch (error) {
      console.error("Error fetching sub-subagent notifications:", error);
    }
  };
  
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
          callback_url: `${window.location.origin}/subagent`,
          metadata: {
            type: "subagent_wallet_topup",
            subagent_store_id: subagentStore.id,
            amount
          }
        }
      });
      
      if (res.error) throw new Error(res.error.message);
      if (!res.data?.authorization_url) throw new Error("No authorization URL");
      
      sessionStorage.setItem("pending_subagent_wallet_topup", res.data.reference);
      window.location.href = res.data.authorization_url;
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message, variant: "destructive" });
    } finally {
      setTopupLoading(false);
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
          .from("subagent_stores")
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
        .from("subagent_stores")
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
    if (amount < 20) {
      toast({ title: "Error", description: "Minimum withdrawal is GH₵ 20.00", variant: "destructive" });
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

    try {
      setWithdrawLoading(true);
      
      // Calculate fee-deducted amount (5% fee means user receives 95%)
      const amountAfterFee = amount * 0.95;
      
      const payload: any = {
        requester_type: "subagent",
        requester_id: subagentStore.id,
        amount: amountAfterFee, // Send fee-deducted amount to edge function
        original_amount: amount, // Track original amount for records
        withdrawal_source: "wallet_balance",
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
      setBankName("");
      setBankCode("");
      setAccountNumber("");
      setMobileNumber("");
      // Wait a moment for the database to sync, then refresh
      setTimeout(() => fetchData(), 1000);
    } catch (error: any) {
      console.error("[v0] Withdrawal error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
        .from("subagent_stores")
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
        .from("subagent_stores")
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
    return p.network === networkFilter;
  });

  const filteredSubSubagentPackages = packages.filter(p => {
    if (false && subSubagentNetworkFilter === "mtn_mashup") {
      return p.network === "mtn_mashup" || p.network === "mashup";
    }
    return p.network === subSubagentNetworkFilter;
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
    const networkName = networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : networkFilter === "telecel" ? "Telecel" : "MTN Special Mashup";
    
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
            description: `Your price cannot be below agent's base price (GH₵ ${basePrice.toFixed(2)})`,
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
          .from("subagent_package_prices")
          .delete()
          .eq("subagent_store_id", subagentStore.id)
          .eq("package_id", packageId);
        
        // Then insert new
        const { error } = await supabase
          .from("subagent_package_prices")
          .insert({
            subagent_store_id: subagentStore.id,
            package_id: packageId,
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

  // Sub-Subagent pricing handlers - for setting prices we charge sub-subagents
  const handleSubSubagentPriceChange = (packageId: string, value: string) => {
    setSubSubagentEditedSubSubPrices(prev => ({
      ...prev,
      [packageId]: value === "" ? "" : (parseFloat(value) || value)
    }));
  };

  const applySubSubagentMarkupForSubsub = () => {
    if (!subSubagentMarkupPercentForSubsub) {
      toast({ title: "Error", description: "Enter a markup percentage", variant: "destructive" });
      return;
    }

    const markup = parseFloat(subSubagentMarkupPercentForSubsub) / 100;
    const networkName = subSubagentNetworkFilterForSubsub === "mtn" ? "MTN" : subSubagentNetworkFilterForSubsub === "airteltigo" ? "AirtelTigo" : "Telecel";
    
    const filteredPkgs = packages.filter(pkg => pkg.network === subSubagentNetworkFilterForSubsub);
    filteredPkgs.forEach(pkg => {
      // Use your selling price as base for markup (what you charge customers)
      const basePrice = subagentPrices[pkg.id] || basePrices[pkg.id] || pkg.price || 0;
      const newPrice = basePrice * (1 + markup);
      setSubSubagentEditedSubSubPrices(prev => ({
        ...prev,
        [pkg.id]: parseFloat(newPrice.toFixed(2))
      }));
    });

    toast({
      title: `Markup applied to ${networkName} packages`,
      description: `All prices increased by ${subSubagentMarkupPercentForSubsub}%`
    });
  };

  const saveSubSubagentPrices = async () => {
    if (!subagentStore?.id) {
      toast({ title: "Error", description: "Store not found", variant: "destructive" });
      return;
    }
    
    try {
      setSavingSubSubSubagentPrices(true);

      // Validate prices
      for (const [packageId, priceVal] of Object.entries(subSubagentEditedSubSubPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        if (isNaN(price) || price <= 0) {
          toast({
            title: "Invalid Price",
            description: "Please enter a valid price",
            variant: "destructive"
          });
          setSavingSubSubSubagentPrices(false);
          return;
        }
      }
      
      // Save prices to sub_subagent_package_prices table as TEMPLATE prices
      // Template marker: sub_subagent_store_id = NULL indicates these are parent's template prices
      // When a new sub-subagent registers, they query this table with NULL and inherit these as base prices
      for (const [packageId, priceVal] of Object.entries(subSubagentEditedSubSubPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        
        // Delete existing template price (where sub_subagent_store_id is NULL)
        await supabase
          .from("sub_subagent_package_prices")
          .delete()
          .eq("subagent_store_id", subagentStore.id)
          .eq("package_id", packageId)
          .is("sub_subagent_store_id", null);
        
        // Insert new template price - this is what NEW SUB-SUBAGENTS will inherit as their base price
        const { error } = await supabase
          .from("sub_subagent_package_prices")
          .insert({
            subagent_store_id: subagentStore.id,
            package_id: packageId,
            base_price: price,
            subagent_minimum_price: price,
            sell_price: price,
            sub_subagent_store_id: null
          });

        if (error) {
          console.error("[v0] Error saving sub-subagent template price:", error);
          throw error;
        }
      }

      // Update local state so the saved template prices show immediately
      const numericPrices: Record<string, number> = {};
      Object.entries(subSubagentEditedSubSubPrices).forEach(([k, v]) => {
        numericPrices[k] = typeof v === "string" ? parseFloat(v) : v;
      });
      setSubSubagentPrices(prev => ({ ...prev, ...numericPrices }));
      setSubSubagentEditedSubSubPrices({});
      setSubSubagentMarkupPercentForSubsub("");
      toast({ 
        title: "Success", 
        description: "Prices saved! Your sub-subagents will see these as their base prices." 
      });
      fetchData(); // Refresh data
    } catch (error) {
      console.error("[v0] Error saving sub-subagent prices:", error);
      toast({ title: "Error", description: "Failed to save prices", variant: "destructive" });
    } finally {
      setSavingSubSubSubagentPrices(false);
    }
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
        .from("subagent_stores")
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
        .from("subagent_stores")
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
        subagent_store_id: subagentStore.id,
        agent_store_id: subagentStore.agent_store_id, // Include parent agent for storefront display
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
          .from("subagent_stores")
          .update({ wallet_balance: currentBalance })
          .eq("id", subagentStore.id);
        throw orderError;
      }
      
      // ADD AGENT PROFIT for wallet purchases
      // Agent profit = subagent_price (what they charge subagent) - admin_agent_price (what admin charges agent)
      if (subagentStore.agent_store_id) {
        try {
          // Get admin base price (agent_price field in packages)
          const adminBasePrice = buyingPkg.agent_price ? Number(buyingPkg.agent_price) : 0;
          const agentProfit = price - adminBasePrice;
          
          console.log(`[v0] Wallet purchase - Subagent price: ${price}, Admin agent price: ${adminBasePrice}, Agent profit: ${agentProfit}`);
          
          if (agentProfit > 0) {
            // Get agent's current subagent commission balance (Profit from Subagents)
            const { data: agentStore, error: agentFetchError } = await supabase
              .from("agent_stores")
              .select("subagent_commission_balance")
              .eq("id", subagentStore.agent_store_id)
              .single();
            
            if (agentStore && !agentFetchError) {
              const newCommissionBalance = (agentStore.subagent_commission_balance || 0) + agentProfit;
              
              await supabase
                .from("agent_stores")
                .update({ subagent_commission_balance: newCommissionBalance })
                .eq("id", subagentStore.agent_store_id);
              
              console.log(`[v0] Added agent profit: +${agentProfit} to Profit from Subagents (new balance: ${newCommissionBalance})`);
            }
          }
        } catch (profitErr) {
          console.error("[v0] Error adding agent profit:", profitErr);
          // Don't throw - order already created successfully, just log the error
        }
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

  // Only allow pure subagents (not sub-subagents) to access this dashboard
  if (!isSubagent || isSubSubagent) {
    return <Navigate to="/" />;
  }

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
    { id: "bulk", label: "Bulk Orders", icon: Layers },
    { id: "store", label: "Store Prices", icon: Store },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
    { id: "topup", label: "Top Up", icon: Wallet },
    { id: "sub-subagents", label: "Sub-Subagents", icon: Users },
    { id: "sub-subagent-pricing", label: "Sub-Subagent Pricing", icon: DollarSign },
    { id: "flyer", label: "Flyer Generator", icon: Image },
    // COMMENTED OUT: mashup packages deactivated
  // { id: "mashup-flyer", label: "MTN Mashup Flyer", icon: Zap },
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
  const totalOrders = dateFilteredOrders.length;
  const hasPendingWithdrawal = withdrawals.some(w => w.status === "pending");
  const pendingWithdrawalAmount = withdrawals.filter(w => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);
  const completedWithdrawals = withdrawals.filter(w => w.status === "completed").reduce((s, w) => s + Number(w.amount), 0);
  const totalWithdrawals = withdrawals.reduce((s, w) => s + Number(w.amount), 0);
  // Calculate total topups
  const totalTopups = topupHistory.reduce((s, t) => s + Number(t.amount || 0), 0);
  
  // Wallet purchases from buy data and bulk order sections
  const walletPurchases = orders.filter(o => o.payment_method === "wallet" && (o.status === "completed" || o.status === "paid")).reduce((s, o) => s + Number(o.amount || 0), 0);
  
  // Wallet balance = Profit + Topups - Completed Withdrawals - Wallet Purchases
  const calculatedWalletBalance = totalProfit + totalTopups - completedWithdrawals - walletPurchases;
  
  // Calculate profit breakdown by source
  const profitBreakdown = (() => {
    let storefrontProfit = 0;
    let subSubagentProfit = 0;
    
    // Storefront profit from orders
    const completedOrders = allCompletedOrders;
    for (const order of completedOrders) {
      const profit = order.profit !== null && order.profit !== undefined && order.profit !== 0 
        ? Number(order.profit) 
        : (Number(order.selling_price || order.amount) - (order.base_price || (order.package_id ? (basePrices[order.package_id] || 0) : 0)));
      storefrontProfit += profit;
    }
    
    // Sub-subagent profit
    subSubagentProfit = subSubagentProfitForSubagent || 0;
    
    return { storefrontProfit, subSubagentProfit, totalProfit: storefrontProfit + subSubagentProfit };
  })();
  // Prefer database value as it's synced correctly
  const availableWalletBalance = subagentStore?.wallet_balance !== undefined && subagentStore?.wallet_balance !== null 
    ? Number(subagentStore.wallet_balance) 
    : calculatedWalletBalance;
  
  // Available for use = actual wallet balance - pending withdrawals
  const availableForUse = availableWalletBalance - pendingWithdrawalAmount;
  
  // Use store_name, fallback to checking what's actually in the store object
  const storeName = subagentStore?.store_name || subagentStore?.storeName || "";
  const storeUrl = storeName ? DOMAINS.getSubagentStoreUrl(storeName) : "";
  
  // Filter orders by search and apply date filter
  const filteredOrders = getDateFilteredOrders(orders).filter(o => 
    o.customer_number?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.id?.toLowerCase().includes(orderSearch.toLowerCase())
  );
  
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

  return (
    <div className="min-h-screen bg-background">
      {/* Agent Notification Popup Dialog */}
      {agentNotifications.length > 0 && showAgentNotificationPopup && (
        <Dialog open={showAgentNotificationPopup} onOpenChange={setShowAgentNotificationPopup}>
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
              {agentNotifications.map((n) => (
                <div key={n.id} className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <p className="text-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowAgentNotificationPopup(false)}>
                Got it
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Admin Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-blue-500/20 border-b border-blue-500/30 px-4 py-3">
          <div className="container flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-blue-400" />
              <p className="text-blue-400 font-semibold">Admin View: You are viewing {subagentStore?.store_name}'s dashboard</p>
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
                  <p className="font-display text-2xl font-bold mt-1 text-green-400">GH₵{totalRevenue.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    {dateFilter !== "all" ? `Profit (${dateFilter === "custom" ? "Custom" : dateFilter === "week" ? "This Week" : dateFilter === "month" ? "This Month" : dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)})` : "Total Profit"}
                  </p>
                  <p className="font-display text-2xl font-bold mt-1 text-yellow-400">GH₵{totalProfit.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            {/* My Wallet Card */}
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">My Wallet</p>
                    <p className="font-display text-2xl font-bold text-yellow-400 mt-1">GH₵ {availableWalletBalance.toFixed(2)}</p>
                    {hasPendingWithdrawal && <p className="text-xs text-orange-400 mt-1">GH₵ {pendingWithdrawalAmount.toFixed(2)} pending withdrawal</p>}
                    <details className="mt-3 cursor-pointer">
                      <summary className="text-xs text-muted-foreground hover:text-yellow-400 transition-colors">📊 View Detailed Breakdown</summary>
                      <div className="mt-3 space-y-2 text-xs border-t border-yellow-500/20 pt-2">
                        <div className="font-semibold text-yellow-300 mb-2">💰 Profit Sources:</div>
                        <div className="flex justify-between pl-2">
                          <span className="text-muted-foreground">Storefront Sales Profit:</span>
                          <span className="text-green-400 font-semibold">+GH₵ {profitBreakdown.storefrontProfit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pl-2">
                          <span className="text-muted-foreground">Sub-Subagent Registration Profit:</span>
                          <span className="text-green-400 font-semibold">+GH₵ {profitBreakdown.subSubagentProfit.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-yellow-500/20 pt-2 mt-2">
                          <div className="font-semibold text-yellow-300 mb-2">📈 Total Profit:</div>
                          <div className="flex justify-between pl-2">
                            <span className="text-green-400 font-bold">Total:</span>
                            <span className="text-green-400 font-bold">+GH₵ {profitBreakdown.totalProfit.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="border-t border-yellow-500/20 pt-2 mt-2">
                          <div className="font-semibold text-yellow-300 mb-2">💳 Wallet Transactions:</div>
                          <div className="flex justify-between pl-2">
                            <span className="text-muted-foreground">Total Top-ups:</span>
                            <span className="text-blue-400 font-semibold">+GH₵ {totalTopups.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pl-2 mt-1">
                            <span className="text-muted-foreground">Wallet Purchases:</span>
                            <span className="text-orange-400 font-semibold">-GH₵ {walletPurchases.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pl-2 mt-1">
                            <span className="text-muted-foreground">Total Withdrawals:</span>
                            <span className="text-red-400 font-semibold">-GH₵ {totalWithdrawals.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </details>
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
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by number..." value={orderSearch} onChange={e => { setOrderSearch(e.target.value); setCurrentPage(1); }} className="pl-9" />
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
                            // Use stored values from order if available, otherwise fall back to current prices (for old orders)
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
                                <TableCell className="text-sm whitespace-nowrap">{new Date(order.created_at).toLocaleString()}</TableCell>
                                <TableCell className="font-mono text-sm">{order.customer_number}</TableCell>
                                <TableCell className="uppercase text-sm">{order.network}</TableCell>
                                <TableCell className="font-display font-bold">{order.network === "mtn_mashup" ? (order.packages as any)?.size_gb_text || order.size_gb + "GB" : order.size_gb + "GB"}</TableCell>
                                <TableCell className="font-semibold">GH₵{Number(sellPrice).toFixed(2)}</TableCell>
                                <TableCell className="text-muted-foreground">GH₵{Number(baseCost).toFixed(2)}</TableCell>
                                <TableCell className={profit > 0 ? "font-semibold text-green-400" : "text-muted-foreground"}>
                                  GH₵{Number(profit).toFixed(2)}
                                </TableCell>
                                <TableCell className="capitalize text-sm">{order.payment_method === "wallet" ? "Wallet" : order.payment_method === "paystack" ? "Paystack" : order.payment_method || "Paystack"}</TableCell>
                                <TableCell className="capitalize text-sm">
                                  <Badge variant="outline" className="text-xs">
                                    {getOrderStage(order)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>
                                    {order.status === "paid" ? "completed" : order.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
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
                  <span className="font-display text-xl font-bold text-primary">GH₵ {availableWalletBalance.toFixed(2)}</span>
                </div>
                {hasPendingWithdrawal && <p className="text-xs text-orange-400">GH₵ {pendingWithdrawalAmount.toFixed(2)} reserved for pending withdrawal.</p>}
              </CardContent>
            </Card>
            <div className="flex gap-2 flex-wrap">
              {["mtn", "airteltigo", "telecel"].map(net => (
                <Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>
                  {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : net === "telecel" ? "Telecel" : ""}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredPackages.map(pkg => {
                const basePrice = basePrices[pkg.id] || pkg.price || 0;
                return (
                  <Card key={pkg.id} className="border-border transition-all hover:border-primary/50 relative">
                    <CardContent className="p-4 text-center space-y-3">
                      <p className="font-display text-xl font-bold text-foreground">{pkg.size_gb_text || pkg.size_gb}GB</p>
                      <p className="text-lg font-bold text-primary">GH₵ {Number(basePrice).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Agent Base Price</p>
                      <Button variant="hero" size="sm" className="w-full" onClick={() => setBuyingPkg(pkg)}>Buy Now</Button>
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
                      <p className="font-display text-2xl font-bold text-primary">GH₵ {Number(basePrices[buyingPkg.id] || buyingPkg.price || 0).toFixed(2)}</p>
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
                                callback_url: `${window.location.origin}/subagent?payment=verifying`,
                                metadata: {
                                  package_id: buyingPkg.id,
                                  network: buyingPkg.network,
                                  package_name: `${(buyingPkg.network === "mtn_mashup" || buyingPkg.network === "mashup") ? (buyingPkg as any).size_gb_text : buyingPkg.size_gb + "GB"}`,
                                  subagent_store_id: subagentStore?.id,
                                  agent_store_id: subagentStore?.agent_store_id,
                                  payment_method: "paystack",
                                  is_subagent_order: true,
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
                      Wallet Balance: GH₵ {availableWalletBalance.toFixed(2)}
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
                              <TableCell className="font-semibold">GH₵{Number(sellPrice).toFixed(2)}</TableCell>
                              <TableCell className="text-muted-foreground">GH₵{Number(baseCost).toFixed(2)}</TableCell>
                              <TableCell className={profit > 0 ? "font-semibold text-green-400" : "text-muted-foreground"}>
                                GH₵{Number(profit).toFixed(2)}
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

          {/* WITHDRAW */}
          <TabsContent value="withdraw" className="mt-0 space-y-6">
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
                      </div>
                    )}
                    
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setCreateNewRecipient(true)}
                      disabled={transferRecipients.length >= 4}
                    >
                      {transferRecipients.length === 0 ? "Add Recipient" : `+ Add New Recipient (${transferRecipients.length}/4)`}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="ghost" 
                      className="text-xs" 
                      onClick={() => setCreateNewRecipient(false)}
                    >
                      ← Back to Recipients
                    </Button>
                    
                    <div className="space-y-3 border border-border rounded-lg p-4">
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
                            step="0.01"
                            placeholder="e.g. 20.00"
                            value={withdrawAmount}
                            onChange={e => setWithdrawAmount(e.target.value)}
                            disabled={hasPendingWithdrawal}
                          />
                        </div>
                        <Button 
                          variant="hero" 
                          onClick={handleRequestWithdrawal} 
                          disabled={withdrawLoading || hasPendingWithdrawal || !selectedRecipient}
                        >
                          {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />}
                          Transfer
                        </Button>
                      </div>

                      {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                        <div className="bg-slate-900/50 border border-slate-700 rounded p-3 space-y-2">
                          {(() => {
                            const amt = parseFloat(withdrawAmount);
                            const feePercentage = amt < 100 ? 0.05 : 0.015;
                            const feeAmount = amt * feePercentage;
                            const recipientAmount = amt - feeAmount;
                            return (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Amount to Deduct:</span>
                                  <span>GH₵ {amt.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Fee ({(feePercentage * 100).toFixed(1)}%):</span>
                                  <span className="text-red-400">GH₵ {feeAmount.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-semibold">
                                  <span>Recipient Receives:</span>
                                  <span className="text-green-400">GH₵ {recipientAmount.toFixed(2)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label>Amount (GH₵)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 20.00"
                            value={withdrawAmount}
                            onChange={e => setWithdrawAmount(e.target.value)}
                            disabled={hasPendingWithdrawal}
                          />
                        </div>
                        <Button 
                          variant="hero" 
                          onClick={handleRequestWithdrawal} 
                          disabled={withdrawLoading || hasPendingWithdrawal || !selectedRecipient}
                        >
                          {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />}
                          Transfer
                        </Button>
                      </div>

                      {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                        <div className="bg-slate-900/50 border border-slate-700 rounded p-3 space-y-2">
                          {(() => {
                            const amt = parseFloat(withdrawAmount);
                            const feePercentage = amt < 100 ? 0.05 : 0.015;
                            const feeAmount = amt * feePercentage;
                            const recipientAmount = amt - feeAmount;
                            return (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Amount to Deduct:</span>
                                  <span>GH₵ {amt.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Fee ({(feePercentage * 100).toFixed(1)}%):</span>
                                  <span className="text-red-400">GH₵ {feeAmount.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-semibold">
                                  <span>Recipient Receives:</span>
                                  <span className="text-green-400">GH₵ {recipientAmount.toFixed(2)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      <div className="bg-red-500/10 border border-red-500/50 rounded p-3">
                        <p className="text-xs text-red-400 font-semibold mb-1">⚠️ IMPORTANT WARNING</p>
                        <p className="text-xs text-red-300">
                          Once a withdrawal is sent, it CANNOT be reversed. Please double-check the recipient details before confirming. You are responsible for any funds sent to the wrong account.
                        </p>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">Minimum: GH₵ 20.00 | Processed Instantly ⚡</p>
                    </div>
                  </>
                )}

                {createNewRecipient && (
                  <>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <p className="text-sm text-yellow-400">My Wallet Balance: <span className="font-bold">GH₵ {availableWalletBalance.toFixed(2)}</span></p>
                      {pendingWithdrawalAmount > 0 && (
                        <p className="text-xs text-yellow-400 mt-2">
                          (GH₵ {pendingWithdrawalAmount.toFixed(2)} pending withdrawal - cannot be used)
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 20.00"
                            value={withdrawAmount}
                            onChange={e => setWithdrawAmount(e.target.value)}
                            disabled={hasPendingWithdrawal}
                          />
                        </div>
                        <Button 
                          variant="hero" 
                          onClick={handleRequestWithdrawal} 
                          disabled={withdrawLoading || hasPendingWithdrawal}
                        >
                          {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />}
                          Transfer
                        </Button>
                      </div>

                      {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                        <div className="bg-slate-900/50 border border-slate-700 rounded p-3 space-y-2">
                          {(() => {
                            const amt = parseFloat(withdrawAmount);
                            const feePercentage = amt < 100 ? 0.05 : 0.015;
                            const feeAmount = amt * feePercentage;
                            const recipientAmount = amt - feeAmount;
                            return (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Amount to Deduct:</span>
                                  <span>GH₵ {amt.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Fee ({(feePercentage * 100).toFixed(1)}%):</span>
                                  <span className="text-red-400">GH₵ {feeAmount.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-semibold">
                                  <span>Recipient Receives:</span>
                                  <span className="text-green-400">GH₵ {recipientAmount.toFixed(2)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      <div className="bg-red-500/10 border border-red-500/50 rounded p-3">
                        <p className="text-xs text-red-400 font-semibold mb-1">⚠️ IMPORTANT WARNING</p>
                        <p className="text-xs text-red-300">
                          Once a withdrawal is sent, it CANNOT be reversed. Please double-check the recipient details before confirming. You are responsible for any funds sent to the wrong account.
                        </p>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">Minimum: GH₵ 20.00 | Processed Instantly ⚡</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No transfers yet</p>
                ) : (
                  <div className="space-y-2">
                    {withdrawals.map(w => (
                      <div key={w.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                        <div className="flex-1">
                          <p className="font-medium">GH₵ {w.amount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {w.provider_type === "mobile_money" 
                              ? `${w.account_holder_name} • ${w.mobile_money_network?.toUpperCase()}: ${w.mobile_money_number}`
                              : `${w.account_holder_name} • Bank: ${w.account_number}`
                            }
                          </p>
                        </div>
                        <Badge variant={w.status === "completed" ? "default" : w.status === "pending" ? "secondary" : "destructive"}>
                          {w.status}
                        </Badge>
                      </div>
                    ))}
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
                <p className="text-sm text-muted-foreground">Top up instantly with card or mobile money</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="text-sm mb-1 block">Amount (GH₵)</Label>
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
                            <TableCell className="font-semibold text-green-400">GH₵ {Number(t.amount).toFixed(2)}</TableCell>
                            <TableCell className="font-mono text-xs">{agentInfo?.store_name || ""} - {t.paystack_reference || "Manual"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BULK ORDERS */}
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
                  <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => bulkFileInputRef.current?.click()}>
                    <input ref={bulkFileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
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
                  <textarea
                    placeholder={`0241234567 2\n0551234567 5\n0591234567 10`}
                    value={bulkRecipients}
                    onChange={(e) => setBulkRecipients(e.target.value)}
                    rows={8}
                    className="w-full font-mono text-sm bg-secondary/50 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  {/* Format Guide */}
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-yellow-500">Format: 0241234567 2 (phone then GB size per line)</p>
                    <p className="text-sm text-muted-foreground">Or use the global package below if all numbers get the same bundle.</p>
                    <p className="text-xs text-muted-foreground">
                      Valid prefixes: {bulkNetwork === "mtn" ? "024, 025, 053, 054, 055, 059" : bulkNetwork === "telecel" ? "020, 050" : bulkNetwork === "airteltigo" ? "026, 027, 056, 057" : "024, 025, 053, 054, 055, 059"}
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
                      {packages.filter(p => p.network.toLowerCase() === bulkNetwork && p.active).map(p => {
                        const price = basePrices[p.id] ?? p.price;
                        return <SelectItem key={p.id} value={p.size_gb.toString()}>{p.size_gb}GB - GH₵ {price.toFixed(2)}</SelectItem>;
                      })}
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
                      const price = pkg ? (basePrices[pkg.id] ?? pkg.price) : 0;
                      return sum + price;
                    }, 0);
                    const walletBalance = subagentStore?.wallet_balance || 0;
                    
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
                            <p className="text-2xl font-bold text-yellow-500">GH�� {totalCost.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Total Cost</p>
                          </div>
                          <div className="text-center p-3 bg-secondary/50 rounded-lg">
                            <p className={`text-2xl font-bold ${walletBalance >= totalCost ? "text-green-500" : "text-red-500"}`}>GH₵ {walletBalance.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Wallet Balance</p>
                          </div>
                        </div>
                        
                        {walletBalance < totalCost && parsed.length > 0 && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-500 text-sm">
                            Insufficient wallet balance. You need GH₵ {(totalCost - walletBalance).toFixed(2)} more.
                          </div>
                        )}
                        
                        <div className="flex gap-3 flex-wrap">
                          <Button
                            variant="hero"
                            className="flex-1"
                            disabled={bulkProcessing || parsed.length === 0 || walletBalance < totalCost}
                            onClick={async () => {
                              if (!subagentStore) return;
                              setBulkProcessing(true);
                              setBulkResults([]);
                              
                              const results: typeof bulkResults = [];
                              let totalDeducted = 0;
                              
                              // Get fresh wallet balance from database
                              const { data: freshStore } = await supabase
                                .from("subagent_stores")
                                .select("wallet_balance")
                                .eq("id", subagentStore.id)
                                .single();
                              
                              const currentBalance = freshStore?.wallet_balance || 0;
                              
                              // Check if we have enough balance
                              if (currentBalance < totalCost) {
                                toast({ title: "Error", description: "Insufficient wallet balance", variant: "destructive" });
                                setBulkProcessing(false);
                                return;
                              }
                              
                              // First deduct the total amount from wallet to prevent race conditions
                              const newBalance = currentBalance - totalCost;
                              const { error: walletError } = await supabase
                                .from("subagent_stores")
                                .update({ wallet_balance: newBalance })
                                .eq("id", subagentStore.id);
                              
                              if (walletError) {
                                toast({ title: "Error", description: "Failed to process payment", variant: "destructive" });
                                setBulkProcessing(false);
                                return;
                              }
                              
                              // Update local state immediately
                              setSubagentStore(prev => prev ? { ...prev, wallet_balance: newBalance } : prev);
                              
                              for (const recipient of parsed) {
                                const pkg = packages.find(p => p.network.toLowerCase() === bulkNetwork && p.size_gb === recipient.size);
                                if (!pkg) {
                                  results.push({ phone: recipient.phone, size: recipient.size || 0, status: "failed", error: "Package not found" });
                                  continue;
                                }
                                
                                const price = basePrices[pkg.id] ?? pkg.price;
                                
                                try {
                                  // Create order with agent_store_id for tracking
                                  const { data: orderData, error: orderError } = await supabase.from("orders").insert({
                                    package_id: pkg.id,
                                    subagent_store_id: subagentStore.id,
                                    agent_store_id: subagentStore.agent_store_id,
                                    customer_number: recipient.phone,
                                    network: bulkNetwork,
                                    size_gb: recipient.size,
                                    amount: price,
                                    base_price: price,
                                    selling_price: price,
                                    profit: 0,
                                    payment_method: "wallet",
                                    status: "paid",
                                    fulfillment_status: "pending"
                                  }).select("id").single();
                                  
                                  if (orderError) throw orderError;
                                  
                                  // Trigger fulfillment for each order
                                  if (orderData?.id) {
                                    try {
                                      await supabase.functions.invoke("fulfill-order", {
                                        body: { order_id: orderData.id }
                                      });
                                    } catch (fulfillErr) {
                                      console.error("Fulfillment trigger error:", fulfillErr);
                                    }
                                  }
                                  
                                  totalDeducted += price;
                                  results.push({ phone: recipient.phone, size: recipient.size || 0, status: "success" });
                                } catch (err: any) {
                                  results.push({ phone: recipient.phone, size: recipient.size || 0, status: "failed", error: err.message });
                                }
                              }
                              
                              // If some orders failed, refund the difference
                              const actualDeducted = results.filter(r => r.status === "success").reduce((sum, r) => {
                                const pkg = packages.find(p => p.network.toLowerCase() === bulkNetwork && p.size_gb === r.size);
                                return sum + (pkg ? (basePrices[pkg.id] ?? pkg.price) : 0);
                              }, 0);
                              
                              const refundAmount = totalCost - actualDeducted;
                              if (refundAmount > 0) {
                                const refundedBalance = newBalance + refundAmount;
                                await supabase.from("subagent_stores").update({ wallet_balance: refundedBalance }).eq("id", subagentStore.id);
                                setSubagentStore(prev => prev ? { ...prev, wallet_balance: refundedBalance } : prev);
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
                  {/* COMMENTED OUT: mashup packages deactivated */}
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
                  <p className="text-xs text-muted-foreground mt-2">Markup changes all your selling price for the selected network based on the percentage you want all the prices to be increase by. Markup is applied to the <strong>Base Price</strong> (agent&apos;s base price). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"}</strong>).</p>
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
                            return (
                              <TableRow key={pkg.id}>
                                <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                                <TableCell className="text-muted-foreground">
                                  GH₵ {Number(costFromAgent).toFixed(2)}
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
                                      <p className="text-xs text-red-500">Min: GH₵ {costFromAgent.toFixed(2)}</p>
                                    )}
                                    {hasSavedPrice && !editedPrices[pkg.id] && (
                                      <p className="text-xs text-green-500">Saved</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>
                                  GH₵ {profit.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                              No packages for {networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : networkFilter === "telecel" ? "Telecel" : "MTN Special Mashup"}
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
                            <div className="text-xs" style={{ color: "#ccc" }}>GH₵ {(4 + i * 3).toFixed(2)}</div>
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

          {/* SUB-SUBAGENTS */}
          <TabsContent value="sub-subagents" className="mt-0 space-y-6">
            {/* Send Notification to Sub-Subagents - AT THE TOP */}
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-400" /> Send Notification to All Sub-Subagents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Send a popup notification that all your sub-subagents will see when they open their dashboard.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Type your notification message..."
                    value={subSubagentNotificationMsg}
                    onChange={(e) => setSubSubagentNotificationMsg(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    variant="hero" 
                    onClick={sendSubSubagentNotification} 
                    disabled={sendingSubSubagentNotification || !subSubagentNotificationMsg.trim()}
                  >
                    {sendingSubSubagentNotification ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Send
                  </Button>
                </div>
                {subSubagentNotifications.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold">Recent Notifications Sent</p>
                    {subSubagentNotifications.slice(0, 3).map((n) => (
                      <div key={n.id} className="flex items-start justify-between p-3 bg-secondary/30 rounded-lg">
                        <div>
                          <p className="text-sm">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteSubSubagentNotification(n.id)}>
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
                  <p className="text-sm text-muted-foreground mb-2">Total Sub-Subagents</p>
                  <p className="text-3xl font-bold">{subSubagents.length}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-2">Total Profit from Sub-Subagents</p>
                  <p className="text-3xl font-bold text-green-400">GH₵ {subSubagentProfitForSubagent?.toFixed(2) || "0.00"}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-2">Total Orders from Sub-Subagents</p>
                  <p className="text-3xl font-bold text-blue-400">{subSubagentOrdersCount || 0}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display flex items-center gap-2">
                  <Users className="h-5 w-5" /> Your Sub-Subagents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-blue-400 mb-2">Allow Sub-Subagent Registration</p>
                      <p className="text-sm text-muted-foreground mb-4">When enabled, a "Become a Sub-Subagent" button will appear on your storefront.</p>
                    </div>
                    <Switch 
                      checked={subagentStore?.allow_sub_subagent_registration || false}
                      onCheckedChange={async (checked) => {
                        try {
                          setSubagentStore(prev => prev ? { ...prev, allow_sub_subagent_registration: checked } : null);
                          const { error } = await supabase
                            .from('subagent_stores')
                            .update({ allow_sub_subagent_registration: checked })
                            .eq('id', subagentStore?.id);
                          if (error) throw error;
                          toast({ title: checked ? "Registration enabled" : "Registration disabled" });
                        } catch (error) {
                          console.error('Error updating sub-subagent setting:', error);
                          setSubagentStore(prev => prev ? { ...prev, allow_sub_subagent_registration: !checked } : null);
                          toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
                        }
                      }}
                    />
                  </div>
                </div>

                <SubSubagentsList
                  subagentStoreId={subagentStore?.id || ""}
                  subagentStoreName={subagentStore?.store_name || ""}
                  subSubagents={subSubagents}
                  onRefresh={async () => {
                    const { data } = await supabase
                      .from("sub_subagent_stores")
                      .select("*")
                      .eq("subagent_store_id", subagentStore?.id);
                    if (data) setSubSubagents(data);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SUB-SUBAGENT PRICING */}
          {/* SUB-SUBAGENT PRICING */}
          <TabsContent value="sub-subagent-pricing" className="space-y-4 mt-0">
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
                    {["mtn", "airteltigo", "telecel"].map(net => (
                      <Button 
                        key={net} 
                        variant={subSubagentNetworkFilterForSubsub === net ? "hero" : "outline"} 
                        size="sm" 
                        onClick={() => setSubSubagentNetworkFilterForSubsub(net)}
                      >
                        {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : net === "telecel" ? "Telecel" : ""}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Markup:</span>
                    <Input 
                      type="number" 
                      placeholder="+10" 
                      value={subSubagentMarkupPercentForSubsub} 
                      onChange={e => setSubSubagentMarkupPercentForSubsub(e.target.value)} 
                      className="w-20 h-8 text-sm" 
                    />
                    <Button variant="outline" size="sm" onClick={applySubSubagentMarkupForSubsub}>
                      <Percent className="h-3 w-3 mr-1" /> Apply
                    </Button>
                  </div>
                  {Object.keys(subSubagentEditedSubSubPrices).length > 0 && (
                    <Button variant="hero" size="sm" onClick={saveSubSubagentPrices} disabled={savingSubSubSubagentPrices}>
                      <Save className="h-4 w-4 mr-1" />
                      {savingSubSubSubagentPrices ? "Saving..." : "Save Prices"}
                    </Button>
                  )}
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                  <p className="font-semibold">USE Markup if you feel lazy and do not want to edit each GB price one by one <br/>🚀 Markup Explanation (Remember to click save after applying markup)</p>
                  <p className="text-xs text-muted-foreground mt-2">Markup changes all your prices to sub-subagents for the selected network based on the percentage you want all the prices to be increase by. Markup is applied to the <strong>Base Price</strong> (your cost price). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{subSubagentNetworkFilterForSubsub === "mtn" ? "MTN" : subSubagentNetworkFilterForSubsub === "airteltigo" ? "AirtelTigo" : "Telecel"}</strong>).</p>
                </div>
                <p className="text-sm text-muted-foreground">Your profit = Your Sub-Subagent Price - Cost from Agent. Use markup to increase all prices by a % (based on cost).</p>
                <Card className="border-border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Size</TableHead>
                          <TableHead>Cost from Agent</TableHead>
                          <TableHead>Sub-Subagent Price</TableHead>
                          <TableHead>Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packages.filter(pkg => pkg.network === subSubagentNetworkFilterForSubsub).length > 0 ? (
                          packages.filter(pkg => pkg.network === subSubagentNetworkFilterForSubsub).map(pkg => {
                            const costFromAgent = basePrices[pkg.id] || pkg.price || 0;
                            const savedPrice = subSubagentPrices[pkg.id];
                            const cur = subSubagentEditedSubSubPrices[pkg.id] ?? savedPrice ?? costFromAgent;
                            const profit = cur - costFromAgent;
                            const isInvalid = subSubagentEditedSubSubPrices[pkg.id] !== undefined && subSubagentEditedSubSubPrices[pkg.id] < costFromAgent;
                            const hasSavedPrice = savedPrice !== undefined;
                            return (
                              <TableRow key={pkg.id}>
                                <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                                <TableCell className="text-muted-foreground">
                                  GH₵ {Number(costFromAgent).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      min={costFromAgent}
                                      value={cur} 
                                      onChange={e => handleSubSubagentPriceChange(pkg.id, e.target.value)} 
                                      className={`w-24 h-8 ${isInvalid ? "border-red-500" : hasSavedPrice && !subSubagentEditedSubSubPrices[pkg.id] ? "border-green-500" : ""}`}
                                    />
                                    {isInvalid && (
                                      <p className="text-xs text-red-500">Min: GH₵ {costFromAgent.toFixed(2)}</p>
                                    )}
                                    {hasSavedPrice && !subSubagentEditedSubSubPrices[pkg.id] && (
                                      <p className="text-xs text-green-500">Saved</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>
                                  GH₵ {profit.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                              No packages for {subSubagentNetworkFilterForSubsub === "mtn" ? "MTN" : subSubagentNetworkFilterForSubsub === "airteltigo" ? "AirtelTigo" : subSubagentNetworkFilterForSubsub === "telecel" ? "Telecel" : "MTN Special Mashup"}
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
        </Tabs>
      </div>
    </div>
  );
};

export default SubagentDashboard;
