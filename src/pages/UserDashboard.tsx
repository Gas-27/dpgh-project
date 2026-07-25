import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WalletTopupDialog from "@/components/WalletTopupDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import AFAPackagesDisplay from "@/components/AFAPackagesDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Download, TrendingUp, Key, Settings, ShoppingCart, Wallet, Copy, Eye, EyeOff, Phone, CreditCard, Zap, BarChart3, Home, LogOut, Menu, Coins, Lock, AlertCircle, Users, Bell, Image as ImageIcon, Share2, Search, Smartphone, Store, Globe, Palette, Rocket, ArrowRight, Send, Crown, Tag, BookOpen, MoreHorizontal } from "lucide-react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  size_gb_text?: string;
  price: number;
  api_price: number;
  active: boolean;
  is_online?: boolean;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  status: string;
  fulfillment_status: string;
  order_status?: string;
  payment_method?: string;
  refunded_amount?: number | null;
  created_at: string;
  customer_id?: string;
  api_user?: string | number;
}

// Delivery status shown to the user (mirrors the Agent dashboard).
// Prefer order_status; fall back to fulfillment_status.
const getDeliveryStatus = (order: Order) => {
  // A refunded order takes priority regardless of the other status fields.
  if (order.status === "refunded" || order.fulfillment_status === "refunded") return "refunded";
  const raw = (order.order_status || order.fulfillment_status || "pending").toLowerCase();
  if (raw === "paid") return "processing";
  return raw;
};

const getOrderStatusLabel = (status: string): string => {
  switch ((status || "").toLowerCase().trim()) {
    case "pending":    return "Waiting for Portal";
    case "processing": return "Processing";
    case "waiting":    return "Waiting";
    case "delivered":  return "Delivered";
    case "failed":     return "Failed";
    case "refunded":   return "Refunded";
    case "completed":  return "Delivered";
    default:           return status || "Pending";
  }
};

const deliveryStatusClass = (status: string) =>
  status === "completed" || status === "delivered" ? "bg-green-600/20 text-green-400 border-green-600/30" :
  status === "processing" ? "bg-blue-600/20 text-blue-400 border-blue-600/30" :
  status === "pending" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" :
  status === "waiting" ? "bg-purple-600/20 text-purple-400 border-purple-600/30" :
  status === "failed" ? "bg-red-600/20 text-red-400 border-red-600/30" :
  status === "refunded" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
  "bg-slate-600/20 text-slate-400 border-slate-600/30";

const UserDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Admin impersonation: when an admin clicks "Login As" on a customer, the
  // customer's auth user id is stored in localStorage. Use it as the effective
  // user id so all reads/writes target the customer's account, not the admin's.
  const [impersonatedCustomerId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem("admin_impersonate_customer") : null)
  );
  const [impersonatedCustomerName] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem("admin_impersonate_customer_name") : null)
  );
  const isImpersonating = !!impersonatedCustomerId;
  const effectiveUserId = impersonatedCustomerId || user?.id;

  const exitImpersonation = () => {
    localStorage.removeItem("admin_impersonate_customer");
    localStorage.removeItem("admin_impersonate_customer_name");
    window.location.href = "/admin-only";
  };
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRefundedOnly, setShowRefundedOnly] = useState(false);
  const [totalDataPurchased, setTotalDataPurchased] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiWallet, setApiWallet] = useState(0);
  const [normalWallet, setNormalWallet] = useState(0);
  const [customTopupAmount, setCustomTopupAmount] = useState("");
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [buyPkg, setBuyPkg] = useState<DataPackage | null>(null);
  const [buyPhone, setBuyPhone] = useState("");
  const [buyStep, setBuyStep] = useState<"phone" | "confirm">("phone");
  const [buyPaymentMethod, setBuyPaymentMethod] = useState<"paystack" | "wallet">("paystack");
  const [buyLoading, setBuyLoading] = useState(false);
  const [topupReference, setTopupReference] = useState<string>("");
  const [showApiWalletTopup, setShowApiWalletTopup] = useState(false);
  const [orderFilter, setOrderFilter] = useState<"all" | "today" | "yesterday" | "week" | "month" | "custom">("all");
  const [totalOrders, setTotalOrders] = useState(0);
  const [topupHistory, setTopupHistory] = useState<any[]>([]);
  const [showNormalWalletTopup, setShowNormalWalletTopup] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // API Orders state
  const [apiOrders, setApiOrders] = useState<any[]>([]);
  const [loadingApiOrders, setLoadingApiOrders] = useState(false);
  const [apiOrdersSearch, setApiOrdersSearch] = useState("");
  const [apiOrdersStatusFilter, setApiOrdersStatusFilter] = useState("");

  // Flyer generation state
  const [generatingFlyer, setGeneratingFlyer] = useState(false);
  const [shareText, setShareText] = useState("");

  // Agent features dropdown state
  const [agentFeaturesOpen, setAgentFeaturesOpen] = useState(false);

  // Orders search state
  const [orderSearch, setOrderSearch] = useState("");

  // Overview date filtering and stats
  const [overviewDateFilter, setOverviewDateFilter] = useState<"all" | "today" | "yesterday" | "week" | "month" | "custom">("all");
  const [customDateStart, setCustomDateStart] = useState<string>("");
  const [customDateEnd, setCustomDateEnd] = useState<string>("");

  // Refund stats and filtering
  const [refundFilter, setRefundFilter] = useState<"all" | "processing" | "delivered" | "refunded">("all");

  // Agent upgrade confirmation modal
  const [showUpgradeConfirmation, setShowUpgradeConfirmation] = useState(false);
  const [registrationFee, setRegistrationFee] = useState<number>(0);
  const [registrationFeeLoading, setRegistrationFeeLoading] = useState(false);

  // Menu navigation
  const [activeMenu, setActiveMenu] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "buy-data", label: "Buy Data", icon: ShoppingCart },
    { id: "orders", label: "Orders", icon: BarChart3 },
    { id: "refunds", label: "Refunds", icon: Wallet },
    { id: "rewards", label: "Rewards & Benefits", icon: ImageIcon },
    { id: "api-key", label: "API Key", icon: Zap },
    { id: "api-docs", label: "API Docs", icon: BookOpen },
    { id: "api-orders", label: "API Orders", icon: BarChart3 },
    { id: "afa-registration", label: "AFA Registration", icon: Package },
    { id: "topup", label: "Top Up", icon: Coins },
    { id: "become-agent", label: "Become an Agent", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  // Agent-only features (locked for regular users)
  const agentOnlyItems = [
    { id: "bulk-orders", label: "Bulk Orders", icon: ShoppingCart },
    { id: "store-prices", label: "Store Prices", icon: CreditCard },
    { id: "subagents", label: "Subagents", icon: Users },
    { id: "subagent-prices", label: "Subagent Prices", icon: TrendingUp },
    { id: "appearance", label: "Appearance", icon: Settings },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "withdraw", label: "Withdraw", icon: Wallet },
    { id: "ussd-code", label: "USSD Code", icon: Smartphone },
    { id: "view-subagents", label: "View Subagents", icon: Users },
    { id: "view-sub-subagents", label: "View Sub-Subagents", icon: Users },
    { id: "more", label: "More...", icon: MoreHorizontal },
  ];

  const { signOut } = useAuth();

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  // Fetch user orders and API key
  useEffect(() => {
    if (!effectiveUserId) return;

    const fetchUserData = async () => {
      try {
        setLoading(true);
        console.log("[v0] Fetching orders for user:", effectiveUserId);
        
        // Fetch orders for this user
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", effectiveUserId)
          .order("created_at", { ascending: false })
          .range(0, 99999999);

        console.log("[v0] Orders fetch result - Error:", ordersError, "Data:", ordersData);

        if (ordersError) {
          console.error("[v0] Error fetching orders:", ordersError);
        } else {
          const userOrders = (ordersData as Order[]) || [];
          console.log("[v0] User orders loaded:", userOrders.length, "orders");
          setOrders(userOrders);

          let totalGB = 0;
          let totalCost = 0;
          
          userOrders.forEach((order) => {
            totalGB += order.size_gb || 0;
            totalCost += Number(order.amount) || 0;
          });

          setTotalDataPurchased(totalGB);
          setTotalSpent(totalCost);
        }

        // Fetch user's API key and both wallet types
        const { data: apiUserData } = await supabase
          .from("api_users")
          .select("id, api_key, wallet")
          .eq("identity_id", effectiveUserId)
          .eq("is_user", true)
          .maybeSingle();

        let apiUserId: string | null = null;
        if (apiUserData) {
          apiUserId = apiUserData.id;
          if (apiUserData.api_key) {
            setApiKey(apiUserData.api_key);
            setApiWallet(apiUserData.wallet || 0);
          }
        }

        // Fetch user's normal wallet from customers table
        // customers.user_id is the auth user id; customers.id is the PK
        const { data: customerData } = await supabase
          .from("customers")
          .select("*")
          .eq("user_id", effectiveUserId)
          .maybeSingle();

        let customerPkId: string | null = null;
        if (customerData) {
          customerPkId = customerData.id;
          setNormalWallet(customerData.wallet_balance || 0);
          // Always use the DB value — the SQL trigger assigns it on row creation
          setTopupReference(customerData.topup_reference || "");
        }

        // Fetch all packages
        const { data: packagesData } = await supabase
          .from("data_packages")
          .select("*")
          .order("size_gb");

        if (packagesData) {
          setPackages(packagesData);
        }

        // Fetch topup history for BOTH wallets
        // Normal wallet (customer_id is the customers PK)
        const { data: normalTopupHistory } = customerPkId
          ? await supabase
              .from("user_wallet_topups")
              .select("id, customer_id, amount, paystack_reference, status, created_at")
              .eq("customer_id", customerPkId)
              .eq("status", "completed")
              .order("created_at", { ascending: false })
              .limit(20)
          : { data: null };

        // API wallet (api_user_id is the api_users PK)
        const { data: apiTopupHistory } = apiUserId
          ? await supabase
              .from("api_wallet_topups")
              .select("id, api_user_id, amount, paystack_reference, status, created_at")
              .eq("api_user_id", apiUserId)
              .eq("status", "completed")
              .order("created_at", { ascending: false })
              .limit(20)
          : { data: null };

        const normalTopups = (normalTopupHistory || []).map((t: any) => ({
          ...t,
          wallet_type: "normal",
          reference: t.paystack_reference,
        }));

        const apiTopups = (apiTopupHistory || []).map((t: any) => ({
          ...t,
          wallet_type: "api",
          reference: t.paystack_reference,
        }));

        // Merge and sort both histories by date (newest first)
        const combinedTopups = [...normalTopups, ...apiTopups].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setTopupHistory(combinedTopups);
      } catch (err) {
        console.error("[v0] Error loading user data:", err);
        toast({ title: "Error", description: "Failed to load your data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [effectiveUserId, toast, refreshKey]);

  // After returning from Paystack (Buy Data), claim the newly created order for this user.
  // The verify-payment function creates the order (async), so we poll by paystack_reference
  // and set customer_id = user.id. This makes Paystack purchases appear in Overview/Orders
  // even before the edge function's own customer_id linking is deployed.
  // Safe because the orders table has RLS disabled.
  useEffect(() => {
    if (!user?.id) return;

    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get("payment");
    const reference =
      params.get("reference") ||
      params.get("trxref") ||
      sessionStorage.getItem("pending_buy_payment");

    if (paymentState !== "verifying" || !reference) return;

    let cancelled = false;
    let attempts = 0;

    const claimOrder = async () => {
      while (!cancelled && attempts < 12) {
        attempts++;
        const { data: existing } = await supabase
          .from("orders")
          .select("id, customer_id")
          .eq("paystack_reference", reference)
          .maybeSingle();

        if (existing) {
          if (!existing.customer_id) {
            await supabase
              .from("orders")
              .update({ customer_id: user.id })
              .eq("id", existing.id);
          }
          sessionStorage.removeItem("pending_buy_payment");
          sessionStorage.removeItem("pending_buy_phone");
          sessionStorage.removeItem("pending_buy_package");
          if (!cancelled) setRefreshKey((k) => k + 1);
          return;
        }

        // Order not created yet - wait and retry
        await new Promise((r) => setTimeout(r, 2500));
      }
    };

    claimOrder();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Subscribe to real-time package changes
  useEffect(() => {
    const channel = supabase
      .channel('user_dashboard_packages_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'data_packages',
        },
        (payload) => {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch API orders when user is known
  useEffect(() => {
    const userId = impersonatedCustomerId || user?.id;
    if (userId) {
      fetchApiOrders();
    }
  }, [user?.id, impersonatedCustomerId]);

  const fetchApiOrders = async () => {
    const userId = impersonatedCustomerId || user?.id;
    if (!userId) return;
    setLoadingApiOrders(true);
    try {
      // Step 1: find this user's api_users.id via identity_id
      const { data: apiUserRow, error: apiUserError } = await supabase
        .from("api_users")
        .select("id")
        .eq("identity_id", userId)
        .maybeSingle();

      if (apiUserError) {
        console.log("[v0] Error fetching api_users row:", apiUserError);
        setLoadingApiOrders(false);
        return;
      }

      if (!apiUserRow) {
        // User has no api_users entry — no API orders
        setApiOrders([]);
        setLoadingApiOrders(false);
        return;
      }

      // Step 2: fetch orders where api_user = api_users.id
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("api_user", apiUserRow.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("[v0] Error fetching API orders:", error);
      } else {
        setApiOrders(data ?? []);
      }
    } catch (error) {
      console.log("[v0] Error fetching API orders:", error);
    } finally {
      setLoadingApiOrders(false);
    }
  };

  const filteredApiOrders = apiOrders.filter((order) => {
    const matchSearch = apiOrdersSearch === "" || 
      order.customer_number?.includes(apiOrdersSearch) ||
      order.network?.toLowerCase().includes(apiOrdersSearch.toLowerCase());
    
    const effectiveStatus = (order.order_status || order.fulfillment_status || order.status || "").toLowerCase();
    const matchStatus = apiOrdersStatusFilter === "" || 
      effectiveStatus === apiOrdersStatusFilter.toLowerCase();

    return matchSearch && matchStatus;
  });

  // Fetch agent registration fee
  const fetchRegistrationFee = async () => {
    setRegistrationFeeLoading(true);
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("agent_registration_fee")
        .maybeSingle();
      if (data?.agent_registration_fee) {
        setRegistrationFee(Number(data.agent_registration_fee));
      }
    } catch (error) {
      console.log("[v0] Error fetching registration fee:", error);
    } finally {
      setRegistrationFeeLoading(false);
    }
  };

  // Get filtered orders and stats for the overview based on date filter
  const getFilteredOverviewStats = () => {
    const now = new Date();
    let startDate: Date;

    switch (overviewDateFilter) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "yesterday":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return {
          filteredOrders: orders.filter(o => {
            const oDate = new Date(o.created_at);
            return oDate >= startDate && oDate < endDate;
          }),
          totalSpent: orders.filter(o => {
            const oDate = new Date(o.created_at);
            return oDate >= startDate && oDate < endDate;
          }).reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
        };
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "custom":
        if (!customDateStart || !customDateEnd) return { filteredOrders: orders, totalSpent: orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0) };
        startDate = new Date(customDateStart);
        const customEnd = new Date(customDateEnd);
        return {
          filteredOrders: orders.filter(o => {
            const oDate = new Date(o.created_at);
            return oDate >= startDate && oDate <= customEnd;
          }),
          totalSpent: orders.filter(o => {
            const oDate = new Date(o.created_at);
            return oDate >= startDate && oDate <= customEnd;
          }).reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
        };
      default: // all
        return { filteredOrders: orders, totalSpent: orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0) };
    }

    return {
      filteredOrders: orders.filter(o => new Date(o.created_at) >= startDate),
      totalSpent: orders.filter(o => new Date(o.created_at) >= startDate).reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
    };
  };

  const { filteredOrders: overviewFilteredOrders, totalSpent: overviewTotalSpent } = getFilteredOverviewStats();

  const generateApiKey = async () => {
    if (generatingApiKey) return;
    setGeneratingApiKey(true);
    try {
      const array = new Uint8Array(32);
      globalThis.crypto.getRandomValues(array);
      const newApiKey = 'pk_live_' + Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { data: existingData } = await supabase
        .from("api_users")
        .select("wallet")
        .eq("identity_id", effectiveUserId)
        .maybeSingle();

      const existingApiWallet = existingData?.wallet || 0;

      const upsertData: any = {
        identity_id: effectiveUserId,
        api_key: newApiKey,
        is_agent: false,
        is_user: true,
        wallet: existingApiWallet,
        updated_at: new Date().toISOString(),
        role: 'user',
        // Populate profile fields so admin can search by name/email
        ...(user?.email && { email: user.email, user_email: user.email }),
        ...(user?.user_metadata?.full_name && { full_name: user.user_metadata.full_name }),
        ...(user?.user_metadata?.name && !user?.user_metadata?.full_name && { full_name: user.user_metadata.name }),
      };

      const { data, error } = await supabase
        .from("api_users")
        .upsert(upsertData, {
          onConflict: 'identity_id'
        })
        .select()
        .single();

      if (error) {
        console.error("[v0] Error:", error);
        toast({ title: "Error", description: error.message || "Failed to generate API key", variant: "destructive" });
      } else {
        setApiKey(newApiKey);
        setApiWallet(existingApiWallet);
        toast({ title: "Success", description: apiKey || newApiKey ? "API key regenerated successfully" : "API key generated successfully", variant: "default" });
      }
    } catch (err) {
      console.error("[v0] Error generating API key:", err);
      toast({ title: "Error", description: "Failed to generate API key", variant: "destructive" });
    } finally {
      setGeneratingApiKey(false);
    }
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      toast({ title: "Success", description: "API key copied to clipboard", variant: "default" });
    }
  };

  const handleOpenApiWalletTopup = () => {
    setShowApiWalletTopup(true);
  };

  const handleOpenNormalWalletTopup = () => {
    console.log("[v0] Opening normal wallet topup dialog");
    setShowNormalWalletTopup(true);
  };

  const detectNetwork = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("024") || cleaned.startsWith("054") || cleaned.startsWith("025") || cleaned.startsWith("053") || cleaned.startsWith("059")|| cleaned.startsWith("055")) return "mtn";
    if (cleaned.startsWith("027") || cleaned.startsWith("026") || cleaned.startsWith("056")|| cleaned.startsWith("057")) return "airteltigo";
    if (cleaned.startsWith("020") || cleaned.startsWith("050")) return "telecel";
    return "unknown";
  };

  const phoneMatchesNetwork = (phone: string, network: string) => {
    const detectedNetwork = detectNetwork(phone);
    const normalizedNetwork = network.toLowerCase();
    return detectedNetwork === normalizedNetwork;
  };

  const isValidPhoneLength = (phone: string) => phone.length === 10;

  const openBuyDialog = (pkg: DataPackage) => {
    setBuyPkg(pkg);
    setBuyPhone("");
    setBuyStep("phone");
    setBuyPaymentMethod("paystack");
    setBuyDialogOpen(true);
  };

  const handleBuyConfirm = async () => {
    if (!buyPkg || !effectiveUserId) return;
    setBuyLoading(true);
    try {
      const price = Number(buyPkg.price);

      // Check for rate limit (45 minute window)
      const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      const { data: recentOrders } = await supabase
        .from("orders")
        .select("created_at")
        .eq("customer_number", buyPhone.trim())
        .eq("customer_id", effectiveUserId)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentOrders && recentOrders.length > 0) {
        const el = Math.floor((Date.now() - new Date(recentOrders[0].created_at).getTime()) / 60000);
        toast({ title: "Rate limit", description: `Wait ${45 - el} more minute(s).`, variant: "destructive" });
        setBuyLoading(false);
        return;
      }

      if (buyPaymentMethod === "wallet") {
        if (normalWallet < price) {
          toast({ title: "Insufficient balance", variant: "destructive" });
          setBuyLoading(false);
          return;
        }

        const { error: walletError } = await supabase
          .from("customers")
          .update({ wallet_balance: normalWallet - price })
          .eq("user_id", effectiveUserId);

        if (walletError) {
          toast({ title: "Error", description: walletError.message, variant: "destructive" });
          setBuyLoading(false);
          return;
        }

        setNormalWallet(normalWallet - price);

        // Create order record for wallet payment.
        // Wallet money is already deducted above, so the order is PAID.
        // fulfillment_status "pending" lets the auto-retry/fulfill flow process it.
        const { error: orderError } = await supabase
          .from("orders")
          .insert({
            package_id: buyPkg.id,
            customer_id: effectiveUserId,
            customer_number: buyPhone.trim(),
            network: buyPkg.network,
            size_gb: buyPkg.size_gb,
            amount: price,
            status: "paid",
            fulfillment_status: "pending",
            payment_method: "wallet",
            source: "web"
          });

        if (orderError) {
          toast({ title: "Error", description: orderError.message, variant: "destructive" });
          setBuyLoading(false);
          return;
        }

        toast({ title: "Order placed!", description: `Data purchase initiated for ${buyPhone}`, variant: "default" });
        setBuyDialogOpen(false);
        
        // Refresh orders
        const { data: ordersData } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", effectiveUserId)
          .order("created_at", { ascending: false });
        
        if (ordersData) setOrders(ordersData as Order[]);
      } else if (buyPaymentMethod === "paystack") {
        // Paystack payment flow - uses the same verify-payment path as the Packages page.
        // callback "?payment=verifying" triggers <PaymentVerifier /> which calls verify-payment
        // and creates the order. customer_id ties the order to this user's dashboard.
        // Add the 1.98% Paystack processing fee on top of the package price.
        const paystackTotal = Math.round((price + (price * 1.98) / 100) * 100) / 100;
        const payloadBody = {
          amount: paystackTotal,
          email: user?.email || `${buyPhone.trim()}@dataplug.store`,
          phone: buyPhone.trim(),
          callback_url: `${window.location.origin}/user-dashboard?payment=verifying`,
          metadata: {
            phone: buyPhone.trim(),
            network: buyPkg.network,
            package_id: buyPkg.id,
            package_name: `${buyPkg.size_gb}GB`,
            size_gb: buyPkg.size_gb,
            customer_id: effectiveUserId,
            agent_store_id: null,
            subagent_store_id: null,
          }
        };

        console.log("[v0] Buy Data Paystack payload:", payloadBody);

        const res = await supabase.functions.invoke("initialize-payment", {
          body: payloadBody,
        });

        console.log("[v0] Paystack response:", res);

        if (res.error) throw new Error(res.error.message);
        if (!res.data?.authorization_url) throw new Error("No authorization URL in response");

        // Store pending payment info
        sessionStorage.setItem("pending_buy_payment", res.data.reference);
        sessionStorage.setItem("pending_buy_phone", buyPhone.trim());
        sessionStorage.setItem("pending_buy_package", JSON.stringify({
          id: buyPkg.id,
          network: buyPkg.network,
          size_gb: buyPkg.size_gb,
          price: price
        }));

        // Redirect to Paystack
        window.location.href = res.data.authorization_url;
      }
    } catch (err) {
      console.error("[v0] Error processing purchase:", err);
      toast({ title: "Error", description: (err as any).message || "Failed to process purchase", variant: "destructive" });
    } finally {
      setBuyLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Render content based on active menu
  const renderContent = () => {
    switch (activeMenu) {
      case "overview":
        return renderOverview();
      case "buy-data":
        return renderBuyData();
      case "orders":
        return renderOrders();
      case "refunds":
        return renderRefunds();
      case "rewards":
        return renderFlyerGenerator();
      case "api-key":
        return renderApiKey();
      case "api-docs":
        return renderApiDocs();
      case "api-orders":
        return renderApiOrders();
      case "afa-registration":
        return renderAfaRegistration();
      case "topup":
        return renderTopup();
      case "become-agent":
        return renderBecomeAgent();
      case "settings":
        return renderSettings();
      default:
        return null;
    }
  };

  const renderOverview = () => {
    return (
    <div className="space-y-6">
      {/* Become an Agent CTA Card */}
      <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">Ready to grow your earnings?</p>
            <p className="text-sm text-muted-foreground mt-1">Become an agent and unlock exclusive benefits</p>
          </div>
          <button
            onClick={() => setActiveMenu("become-agent")}
            className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium whitespace-nowrap transition-all"
          >
            Become an Agent
          </button>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 hover:border-cyan-500/50 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Wallet Balance</p>
              <Wallet className="h-5 w-5 text-cyan-400" />
            </div>
            <p className="font-display text-3xl font-bold text-cyan-400">GHC {Number(normalWallet).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-2">For regular purchases</p>
            {topupReference && (
              <div className="mt-3 flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-md px-3 py-2">
                <span className="text-xs text-muted-foreground shrink-0">Top-up Reference:</span>
                <span className="font-mono font-bold text-cyan-400 text-sm tracking-wider">{topupReference}</span>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <Button onClick={() => setActiveMenu("buy-data")} className="flex-1" size="sm" variant="default">
                Buy Data
              </Button>
              <Button onClick={() => setShowNormalWalletTopup(true)} className="flex-1" size="sm" variant="outline">
                Top Up
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Filter Buttons */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground mb-3">Filter Stats & Orders:</p>
        <div className="flex flex-wrap gap-2">
          {["all", "today", "yesterday", "week", "month", "custom"].map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setOverviewDateFilter(filter as any);
                if (filter !== "custom") {
                  setCustomDateStart("");
                  setCustomDateEnd("");
                }
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                overviewDateFilter === filter
                  ? "bg-cyan-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {filter === "all" ? "All Time" : filter === "today" ? "Today" : filter === "yesterday" ? "Yesterday" : filter === "week" ? "This Week" : filter === "month" ? "This Month" : "Custom"}
            </button>
          ))}
        </div>
        {overviewDateFilter === "custom" && (
          <div className="flex gap-2 mt-3">
            <input
              type="date"
              value={customDateStart}
              onChange={e => setCustomDateStart(e.target.value)}
              className="px-3 py-2 rounded border border-border bg-background text-foreground text-sm"
            />
            <input
              type="date"
              value={customDateEnd}
              onChange={e => setCustomDateEnd(e.target.value)}
              className="px-3 py-2 rounded border border-border bg-background text-foreground text-sm"
            />
          </div>
        )}
      </div>

      {/* Stats Cards Row - Like Agent Dashboard */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="border-border">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground text-sm">{overviewDateFilter !== "all" ? "Orders (Filtered)" : "Total Orders"}</p>
            <p className="font-display text-3xl font-bold mt-2 text-foreground">{overviewFilteredOrders.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Large Info Cards - Like Agent Dashboard */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{overviewDateFilter !== "all" ? "Amount Spent (Filtered)" : "Total Amount Spent"}</p>
                <p className="font-display text-3xl font-bold text-green-400 mt-2">GHC {overviewTotalSpent.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">{overviewDateFilter === "all" ? "All-time spending" : `Spending (${overviewDateFilter})`}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Reference and Codes Card */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm text-muted-foreground mb-1">Check your balance via USSD</p>
              <div className="flex items-center justify-center md:justify-start gap-3">
                <div className="p-3 bg-primary/20 rounded-lg">
                  <p className="text-2xl font-bold font-mono text-primary">*380*455#</p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">Access Code</p>
                  <p className="text-3xl font-bold font-mono text-foreground">0</p>
                </div>
              </div>
            </div>
            <Button 
              variant="default"
              size="sm"
              onClick={() => {
                window.location.href = "tel:*380*455%23";
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Phone className="h-4 w-4 mr-2" /> Call
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table with Search - Like Agent Dashboard */}
      <Card className="border-border">
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="font-display text-lg">Orders ({orders.length})</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by phone or order ID..." 
                value={orderSearch} 
                onChange={e => setOrderSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="userRefundedFilter" checked={showRefundedOnly} onChange={e => setShowRefundedOnly(e.target.checked)} className="rounded border-input" />
            <label htmlFor="userRefundedFilter" className="text-sm cursor-pointer text-muted-foreground hover:text-foreground">Show refunded orders only</label>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No orders yet. Start by purchasing a data package.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Date & Time</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Network</TableHead>
                    <TableHead className="text-xs">Size</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.filter(o => {
                    const matchesSearch = o.customer_number?.includes(orderSearch.toLowerCase()) || o.id.toLowerCase().includes(orderSearch.toLowerCase());
                    const matchesRefundFilter = showRefundedOnly ? (o.status === "refunded" || o.fulfillment_status === "refunded") : true;
                    return matchesSearch && matchesRefundFilter;
                  }).map(order => (
                    <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="text-sm whitespace-nowrap">{new Date(order.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm font-mono">{order.customer_number}</TableCell>
                      <TableCell className="text-sm uppercase font-semibold">{order.network}</TableCell>
                      <TableCell className="text-sm font-display font-bold text-cyan-400">{order.size_gb || 0}GB</TableCell>
                      <TableCell className="text-sm font-semibold">GHC {Number(order.amount || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {order.payment_method === "wallet" ? "Wallet" : "Paystack"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.order_status || order.fulfillment_status || order.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {orders.length > 10 && (
                <div className="flex justify-center mt-6">
                  <Button onClick={() => setActiveMenu("orders")} className="w-full sm:w-auto">
                    View All Orders ({orders.length - 10} more)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
  };

  const renderBuyData = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Buy Data Packages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Network Filter */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'mtn', label: 'MTN' },
              { key: 'mtn_express', label: 'MTN Express' },
              { key: 'telecel', label: 'Telecel' },
              { key: 'airteltigo', label: 'AirtelTigo' },
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={networkFilter === key ? "default" : "outline"}
                onClick={() => setNetworkFilter(key)}
                className="text-xs sm:text-sm"
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Packages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {packages
              .filter(pkg => pkg.network.toLowerCase() === networkFilter.toLowerCase())
              .map(pkg => (
                <Card key={pkg.id} className={pkg.active ? "" : "opacity-50"}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{pkg.size_gb}GB</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">{pkg.network.toUpperCase()}</p>
                      </div>
                      {!pkg.active && <Badge variant="secondary">Offline</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">User Price</p>
                      <p className="font-display text-2xl font-bold text-cyan-400">GHC {Number(pkg.price).toFixed(2)}</p>
                    </div>
                    <Button
                      onClick={() => openBuyDialog(pkg)}
                      disabled={!pkg.active}
                      className="w-full"
                      size="sm"
                    >
                      {pkg.active ? "Buy Now" : "Unavailable"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderOrders = () => {
    // Filter orders based on search
    const filteredOrders = orders.filter(order => {
      if (!orderSearch) return true;
      const search = orderSearch.toLowerCase();
      return (
        (order.customer_number && String(order.customer_number).toLowerCase().includes(search)) ||
        (order.id && String(order.id).toLowerCase().includes(search)) ||
        (order.network && String(order.network).toLowerCase().includes(search)) ||
        (order.paystack_reference && String(order.paystack_reference).toLowerCase().includes(search))
      );
    });

    // Calculate stats
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">Total Orders</p>
              <p className="font-display text-3xl font-bold mt-2 text-foreground">{totalOrders}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">Total Spent</p>
              <p className="font-display text-3xl font-bold mt-2 text-cyan-400">GHC {totalSpent.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders Table with Search */}
        <Card className="border-border">
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="font-display text-lg">Orders ({filteredOrders.length})</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by phone or order ID..." 
                  value={orderSearch} 
                  onChange={e => setOrderSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">{orderSearch ? "No orders found matching your search" : "No orders yet"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Date & Time</TableHead>
                      <TableHead className="text-xs">Phone</TableHead>
                      <TableHead className="text-xs">Network</TableHead>
                      <TableHead className="text-xs">Size</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Method</TableHead>
                      <TableHead className="text-xs">Source Account</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="text-sm whitespace-nowrap">{new Date(order.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-sm font-mono">{order.customer_number}</TableCell>
                        <TableCell className="text-sm uppercase font-semibold">{order.network}</TableCell>
                        <TableCell className="text-sm font-display font-bold text-cyan-400">{order.size_gb || 0}GB</TableCell>
                        <TableCell className="text-sm font-semibold">GHC {Number(order.amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {order.payment_method === "wallet" ? "Wallet" : "Paystack"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="space-y-1">
                            <Badge className={`text-xs ${(order as any).api_user ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                              {(order as any).api_user ? "API User" : "Direct"}
                            </Badge>
                            <p className="text-xs text-muted-foreground font-mono">
                              {(order as any).api_user ? String((order as any).api_user).slice(0, 12) : (order as any).customer_id ? String((order as any).customer_id).slice(0, 12) : order.customer_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const s = getDeliveryStatus(order);
                            return (
                              <Badge className={`text-xs ${deliveryStatusClass(s)}`}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const generatePng = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DATA PLUG', 540, 120);

    // Subtitle
    ctx.fillStyle = '#00BFFF';
    ctx.font = '24px Arial';
    ctx.fillText('PREMIUM DATA PACKAGES', 540, 180);
    ctx.fillText('Affordable. Instant. Reliable.', 540, 220);

    let yPos = 280;
    const lineHeight = 40;
    const sectionHeight = 520;

    // MTN Section
    ctx.strokeStyle = '#FFA500';
    ctx.fillStyle = '#FFA500';
    ctx.lineWidth = 3;
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('MTN DATA BUNDLES', 60, yPos);
    yPos += lineHeight + 20;

    const mtnPkgs = packages.filter(p => p.network.toLowerCase() === 'mtn').slice(0, 10);
    mtnPkgs.forEach((pkg, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const x = 60 + (col * 190);
      const y = yPos + (row * 90);

      ctx.fillStyle = 'rgba(255, 165, 0, 0.1)';
      ctx.fillRect(x, y, 170, 70);
      ctx.strokeStyle = '#FFA500';
      ctx.strokeRect(x, y, 170, 70);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`${pkg.size_gb}GB`, x + 10, y + 30);

      ctx.fillStyle = '#FFA500';
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`GHC ${Number(pkg.price).toFixed(2)}`, x + 10, y + 60);
    });

    yPos += sectionHeight;

    // Airtel Section
    ctx.fillStyle = '#9D4EDD';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('AIRTELTIGO DATA BUNDLES', 60, yPos);
    yPos += lineHeight + 20;

    const airtelPkgs = packages.filter(p => p.network.toLowerCase() === 'airteltigo').slice(0, 10);
    airtelPkgs.forEach((pkg, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const x = 60 + (col * 190);
      const y = yPos + (row * 90);

      ctx.fillStyle = 'rgba(157, 78, 221, 0.1)';
      ctx.fillRect(x, y, 170, 70);
      ctx.strokeStyle = '#9D4EDD';
      ctx.strokeRect(x, y, 170, 70);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`${pkg.size_gb}GB`, x + 10, y + 30);

      ctx.fillStyle = '#9D4EDD';
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`GHC ${Number(pkg.price).toFixed(2)}`, x + 10, y + 60);
    });

    yPos += sectionHeight;

    // Telecel Section
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('TELECEL DATA BUNDLES', 60, yPos);
    yPos += lineHeight + 20;

    const telecelPkgs = packages.filter(p => p.network.toLowerCase() === 'telecel').slice(0, 10);
    telecelPkgs.forEach((pkg, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const x = 60 + (col * 190);
      const y = yPos + (row * 90);

      ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
      ctx.fillRect(x, y, 170, 70);
      ctx.strokeStyle = '#FF0000';
      ctx.strokeRect(x, y, 170, 70);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`${pkg.size_gb}GB`, x + 10, y + 30);

      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`GHC ${Number(pkg.price).toFixed(2)}`, x + 10, y + 60);
    });

    return canvas.toDataURL('image/png');
  };

  const shareFlyer = async () => {
    setGeneratingFlyer(true);
    try {
      const packageLink = "https://www.dataplug.store/packages";
      const userMessage = shareText || "Get premium data packages at great prices!";
      const fullShareText = `${userMessage}\n\n${packageLink}`;

      const dataUrl = await generatePng();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "data-flyer.png", { type: "image/png" });

      // Try to share the image file
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'Data Plug - Premium Data Packages',
            text: fullShareText,
            files: [file],
          });
          toast({ title: "Shared!", description: "Flyer and link sent!" });
          setGeneratingFlyer(false);
          return;
        } catch (shareErr: any) {
          if (shareErr.name !== "AbortError") {
            console.log("[v0] File share failed, falling back");
          } else {
            setGeneratingFlyer(false);
            return;
          }
        }
      }

      // Fallback: share text and download image
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Data Plug - Premium Data Packages',
            text: fullShareText,
          });
          const a = document.createElement("a");
          a.download = "data-flyer.png";
          a.href = dataUrl;
          a.click();
          toast({ title: "Link shared!", description: "Image saved. Attach it in WhatsApp." });
          setGeneratingFlyer(false);
          return;
        } catch (shareErr: any) {
          if (shareErr.name !== "AbortError") {
            console.log("[v0] Text share failed, using download");
          } else {
            setGeneratingFlyer(false);
            return;
          }
        }
      }

      // Desktop fallback
      const a = document.createElement("a");
      a.download = "data-flyer.png";
      a.href = dataUrl;
      a.click();
      
      try {
        await navigator.clipboard.writeText(fullShareText);
        toast({ title: "Image downloaded!", description: "Link copied. Paste in WhatsApp." });
      } catch {
        const encodedText = encodeURIComponent(fullShareText);
        window.open(`https://wa.me/?text=${encodedText}`, "_blank");
        toast({ title: "Image downloaded!", description: "WhatsApp opened to share." });
      }
    } catch (err: any) {
      console.error("[v0] Share error:", err);
      toast({ title: "Error", description: "Could not generate flyer", variant: "destructive" });
    } finally {
      setGeneratingFlyer(false);
    }
  };

  const renderFlyerGenerator = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Rewards & Benefits - Promotional Flyer
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">Generate and share a professional promotional flyer with all your data packages. Share directly to WhatsApp or download for social media.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Flyer Preview */}
          <div className="border border-border rounded-lg overflow-hidden bg-black">
            <div className="relative bg-black" style={{ aspectRatio: "1080/1920", maxWidth: "300px", margin: "0 auto" }}>
              <div className="w-full h-full p-4 flex flex-col justify-between text-white" style={{ fontSize: "11px" }}>
                <div className="text-center">
                  <h1 className="font-bold mb-1" style={{ fontSize: "28px" }}>DATA PLUG</h1>
                  <p className="text-cyan-400 text-xs mb-3">PREMIUM DATA PACKAGES</p>
                  <p className="text-xs mb-4">Affordable. Instant. Reliable.</p>
                </div>

                <div className="flex-1 space-y-2 text-xs">
                  <div className="border border-orange-500/50 rounded p-1.5">
                    <p className="text-orange-400 font-bold text-xs mb-1">MTN</p>
                    <div className="grid grid-cols-3 gap-0.5">
                      {packages.filter(p => p.network.toLowerCase() === 'mtn').slice(0, 6).map(pkg => (
                        <div key={pkg.id} className="bg-black/50 p-0.5 rounded border border-orange-500/30 text-center">
                          <p className="font-semibold text-xs">{pkg.size_gb}GB</p>
                          <p className="text-orange-400 text-xs">GHC {Number(pkg.price).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-purple-500/50 rounded p-1.5">
                    <p className="text-purple-400 font-bold text-xs mb-1">AIRTELTIGO</p>
                    <div className="grid grid-cols-3 gap-0.5">
                      {packages.filter(p => p.network.toLowerCase() === 'airteltigo').slice(0, 6).map(pkg => (
                        <div key={pkg.id} className="bg-black/50 p-0.5 rounded border border-purple-500/30 text-center">
                          <p className="font-semibold text-xs">{pkg.size_gb}GB</p>
                          <p className="text-purple-400 text-xs">GHC {Number(pkg.price).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-red-500/50 rounded p-1.5">
                    <p className="text-red-400 font-bold text-xs mb-1">TELECEL</p>
                    <div className="grid grid-cols-3 gap-0.5">
                      {packages.filter(p => p.network.toLowerCase() === 'telecel').slice(0, 6).map(pkg => (
                        <div key={pkg.id} className="bg-black/50 p-0.5 rounded border border-red-500/30 text-center">
                          <p className="font-semibold text-xs">{pkg.size_gb}GB</p>
                          <p className="text-red-400 text-xs">GHC {Number(pkg.price).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-center border-t border-border/50 pt-2">
                  <p className="text-cyan-400 font-bold text-xs mb-0.5">dataplug.store</p>
                  <p className="text-muted-foreground text-xs">Premium Data Reseller</p>
                </div>
              </div>
            </div>
          </div>

          {/* Share Text Editor */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold mb-2 block">Share Message (Optional)</label>
              <p className="text-xs text-muted-foreground mb-2">Edit your message. The package link will always be included.</p>
              <textarea
                value={shareText || "Get premium data packages at great prices!"}
                onChange={(e) => setShareText(e.target.value)}
                className="w-full p-3 bg-muted border border-border rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your promotional message..."
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              Link will be added: <span className="font-mono text-cyan-400">https://www.dataplug.store/packages</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              className="flex-1" 
              onClick={shareFlyer}
              disabled={generatingFlyer}
            >
              {generatingFlyer ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Share Flyer
            </Button>
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={async () => {
                const dataUrl = await generatePng();
                const a = document.createElement("a");
                a.download = "data-flyer.png";
                a.href = dataUrl;
                a.click();
                toast({ title: "Downloaded!", description: "Flyer saved to your device" });
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderApiKey = () => (
    <div className="space-y-6">
      {/* Need Help with API Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Need Help with API?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Now that you&apos;ve set up your API, contact us to learn more about integration options and technical support.
          </p>
          <a
            href="https://whatsapp.com/channel/0029Vb69LKt42DcgVbzaUS1q"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            <Send className="h-4 w-4" />
            Contact via WhatsApp
          </a>
        </CardContent>
      </Card>

      {/* API Wallet Card */}
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-pink-500/5 hover:border-purple-500/50 transition-all">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">API Wallet</p>
            <Zap className="h-5 w-5 text-purple-400" />
          </div>
          <p className="font-display text-3xl font-bold text-purple-400">GHC {Number(apiWallet).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-2">For API purchases</p>
          <Button onClick={() => { console.log("[v0] Top Up API clicked"); setShowApiWalletTopup(true); }} className="mt-4 w-full" size="sm">
            Top Up
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKey ? (
            <>
              <div>
                <Label className="text-sm">Your API Key</Label>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 bg-muted p-3 rounded-lg border border-border flex items-center gap-2 font-mono text-sm">
                    {showApiKey ? apiKey : "•".repeat(apiKey.length)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyApiKey}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={generateApiKey} disabled={generatingApiKey} className="w-full">
                {generatingApiKey ? "Generating..." : "Regenerate Key"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Generate an API key to use our programmatic API</p>
              <Button onClick={generateApiKey} disabled={generatingApiKey} className="w-full">
                {generatingApiKey ? "Generating..." : "Generate API Key"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* API Packages Section - Exact replica of AgentDashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Available Packages for API
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">These are the packages you can purchase through your API integration. Generate an API key above to start building.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Network Filter Buttons */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "mtn", label: "MTN" },
              { key: "mtn_express", label: "MTN Express" },
              { key: "airteltigo", label: "AirtelTigo" },
              { key: "telecel", label: "Telecel" },
              { key: "afa", label: "AFA Registration" },
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

          {/* API Packages Grid - Exact styling from AgentDashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {networkFilter === "afa" ? (
              <Card className="border-slate-700/50 bg-slate-900/5 hover:border-slate-600/50 transition-all">
                <CardContent className="pt-4">
                  <p className="font-display text-lg font-bold text-foreground">AFA Registration</p>
                  <p className="text-lg font-bold text-cyan-400">GHC 9.50</p>
                  <p className="text-xs text-muted-foreground">API Price</p>
                </CardContent>
              </Card>
            ) : (
              packages.filter(p => {
                if (networkFilter === "airteltigo") {
                  return p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
                }
                return p.network === networkFilter;
              }).map((pkg) => {
                const apiPrice = Number(pkg.api_price || pkg.agent_price || pkg.price);
                return (
                  <Card key={pkg.id} className="border-slate-700/50 bg-slate-900/5 hover:border-slate-600/50 transition-all">
                    <CardContent className="pt-4">
                      <p className="font-display text-lg font-bold text-foreground">{pkg.size_gb_text || pkg.size_gb + "GB"}</p>
                      <p className="text-lg font-bold text-cyan-400">GHC {apiPrice.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">API Price</p>
                    </CardContent>
                  </Card>
                );
              })
            )}
            {networkFilter !== "afa" && packages.filter(p => {
              if (networkFilter === "airteltigo") {
                return p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
              }
              return p.network === networkFilter;
            }).length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No packages available for {networkFilter === "airteltigo" ? "AirtelTigo" : networkFilter === "mtn" ? "MTN" : "Telecel"}.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderApiDocs = () => (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <BookOpen className="h-8 w-8 text-blue-400 flex-shrink-0" />
            <div>
              <h2 className="font-display text-2xl font-bold">API Documentation</h2>
              <p className="text-sm text-muted-foreground mt-2">Integrate DataPlug's API into your application for seamless data purchases and order management.</p>
              <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <p className="text-sm font-mono text-foreground">Base URL: https://api.dataplug.store/functions/v1</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-cyan-400" />
            Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">All API requests require your API key in the Authorization header:</p>
          <div className="bg-muted p-4 rounded-lg border border-border font-mono text-sm space-y-2">
            <div>Authorization: Bearer pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</div>
          </div>
          <p className="text-xs text-muted-foreground">Your API key can be found in the <span className="font-semibold">API Key</span> tab above.</p>
        </CardContent>
      </Card>

      {/* Supported Networks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-green-400" />
            Supported Networks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { code: "mtn", name: "MTN Ghana" },
              { code: "telecel", name: "Telecel Ghana" },
              { code: "airteltigo", name: "AirtelTigo Ghana" },
            ].map(network => (
              <div key={network.code} className="p-3 bg-muted rounded-lg border border-border">
                <p className="font-mono text-sm font-semibold text-cyan-400">{network.code}</p>
                <p className="text-sm text-muted-foreground">{network.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Endpoints */}
      <div className="space-y-4">
        {/* GET /get-packages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-mono">GET</span>
              <span>/get-packages</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Retrieve all available data packages with pricing.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-semibold mb-2">Query Parameters (Optional):</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <span className="font-mono">network</span> - Filter by single network</li>
                <li>• <span className="font-mono">networks[]</span> - Filter by multiple networks</li>
              </ul>
            </div>
            <div className="bg-muted p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-2">Example:</p>
              <p className="font-mono text-xs">GET /get-packages?network=mtn</p>
            </div>
          </CardContent>
        </Card>

        {/* POST /purchase */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-mono">POST</span>
              <span>/purchase</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Purchase a data package using your wallet balance.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Request Body:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• <span className="font-mono">network</span> (required) - mtn, telecel, airteltigo</li>
                <li>• <span className="font-mono">size_gb</span> (required) - Package size in GB</li>
                <li>• <span className="font-mono">phone</span> (required) - Recipient phone number (024XXXXXXX)</li>
              </ul>
            </div>
            <div className="bg-muted p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-2">Example Request:</p>
              <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
{`curl -X POST "https://api.dataplug.store/functions/v1/purchase" \\
  -H "Authorization: Bearer pk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mtn",
    "size_gb": 2,
    "phone": "024XXXXXXX"
  }'`}
              </pre>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Success Response (200):</p>
              <pre className="font-mono text-xs overflow-x-auto bg-muted p-3 rounded-lg border border-border whitespace-pre-wrap break-words">
{`{
  "success": true,
  "message": "Purchase successful",
  "data": {
    "order_id": "550e8400-e29b-41d4",
    "provider_reference": "REF_12345",
    "network": "mtn",
    "size_gb": 2,
    "phone": "024XXXXXXX",
    "amount": 7.59,
    "wallet_balance": 92.41,
    "status": "completed"
  }
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* GET /get-orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-mono">GET</span>
              <span>/get-orders</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Retrieve all orders for the authenticated API user.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Query Parameters (Optional):</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <span className="font-mono">limit</span> (integer) - Orders to return (default: 50)</li>
                <li>• <span className="font-mono">offset</span> (integer) - Orders to skip (default: 0)</li>
                <li>• <span className="font-mono">status</span> - Filter by status (pending, processing, completed, failed, delivered)</li>
                      <li>• <span className="font-mono">network</span> - Filter by network (mtn, telecel, airteltigo)</li>
              </ul>
            </div>
            <div className="bg-muted p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-2">Example Requests:</p>
              <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
{`# Get all orders (default limit 50)
curl -X GET "https://api.dataplug.store/functions/v1/get-orders" \\
  -H "Authorization: Bearer pk_live_xxx"

# Get orders filtered by status
curl -X GET "https://api.dataplug.store/functions/v1/get-orders?status=completed" \\
  -H "Authorization: Bearer pk_live_xxx"

# Get orders with pagination and filters
curl -X GET "https://api.dataplug.store/functions/v1/get-orders?status=completed&network=mtn&limit=10" \\
  -H "Authorization: Bearer pk_live_xxx"`}
              </pre>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Success Response (200):</p>
              <pre className="font-mono text-xs overflow-x-auto bg-muted p-3 rounded-lg border border-border whitespace-pre-wrap break-words">
{`{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "30218de5-2991-4c8d",
        "customer_number": "0200511211",
        "network": "telecel",
        "amount": 36.20,
        "order_status": "completed",
        "provider_reference": "API_1782860161668",
        "created_at": "2026-06-30T22:56:02.022+00:00"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 1,
      "returned": 1
    }
  }
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* GET /track-order */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-mono">GET</span>
              <span>/track-order</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Get the current status of a specific order.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Required Parameters:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <span className="font-mono">reference</span> (string) - Order ID (UUID) or provider_reference</li>
              </ul>
            </div>
            <div className="bg-muted p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-2">Example Request:</p>
              <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
{`curl -X GET "https://api.dataplug.store/functions/v1/track-order?reference=API_1782860161668" \\
  -H "Authorization: Bearer pk_live_xxx"`}
              </pre>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Success Response (200):</p>
              <pre className="font-mono text-xs overflow-x-auto bg-muted p-3 rounded-lg border border-border whitespace-pre-wrap break-words">
{`{
  "success": true,
  "data": {
    "order_id": "550e8400-e29b-41d4",
    "reference": "REF_12345",
    "phone": "024XXXXXXX",
    "network": "mtn",
    "size_gb": 2,
    "amount": 7.59,
    "paystack_status": "completed",
    "fulfillment_status": "completed",
    "created_at": "2026-07-08T10:00:00.000Z",
    "updated_at": "2026-07-08T10:05:00.000Z"
  }
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* POST /afa-api-registration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-mono">POST</span>
              <span>/afa-api-registration</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Register for AFA services. Cost: GHC 9.50</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Request Body:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <span className="font-mono">fullName</span> (required) - Full name</li>
                <li>• <span className="font-mono">phoneNumber</span> (required) - Phone number</li>
                <li>• <span className="font-mono">idNumber</span> (required) - ID number</li>
                <li>• <span className="font-mono">dateOfBirth</span> (required) - Date of birth (YYYY-MM-DD)</li>
                <li>• <span className="font-mono">town</span> (required) - Town/City</li>
                <li>• <span className="font-mono">occupation</span> (required) - Occupation</li>
                <li>• <span className="font-mono">region</span> (required) - Region</li>
                <li>• <span className="font-mono">cropProduce</span> (required) - Crop produce</li>
                <li>• <span className="font-mono">callbackUrl</span> (optional) - Webhook URL for status updates</li>
              </ul>
            </div>
            <div className="bg-muted p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-2">Example Request:</p>
              <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
{`curl -X POST "https://api.dataplug.store/functions/v1/afa-api-registration" \\
  -H "Authorization: Bearer pk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "fullName": "John Doe",
    "phoneNumber": "0241234567",
    "idNumber": "GHA-123456789-0",
    "dateOfBirth": "1990-01-15",
    "town": "Accra",
    "occupation": "Teacher",
    "region": "Greater Accra",
    "cropProduce": "Maize",
    "callbackUrl": "https://your-domain.com/webhook/afa"
  }'`}
              </pre>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Success Response (200):</p>
              <pre className="font-mono text-xs overflow-x-auto bg-muted p-3 rounded-lg border border-border whitespace-pre-wrap break-words">
{`{
  "success": true,
  "message": "AFA registration successful",
  "data": {
    "registration_id": "uuid",
    "fullName": "John Doe",
    "phoneNumber": "0241234567",
    "idNumber": "GHA-123456789-0",
    "status": "completed",
    "amount_paid": 9.50,
    "wallet_balance": 90.50
  }
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Order Status Values */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400" />
              Order Status Values
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { status: "pending", desc: "Order created, awaiting processing" },
                { status: "processing", desc: "Order is being processed" },
                { status: "completed", desc: "Order completed successfully" },
                { status: "failed", desc: "Order failed" },
                { status: "delivered", desc: "Data delivered to recipient" },
              ].map(item => (
                <div key={item.status} className="flex gap-3 items-start p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-cyan-400 whitespace-nowrap">{item.status}</span>
                  <span className="text-sm text-muted-foreground">{item.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Error Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { code: "400", desc: "Bad Request - Invalid parameters" },
                { code: "401", desc: "Unauthorized - Invalid or missing API key" },
                { code: "402", desc: "Payment Required - Insufficient wallet balance" },
                { code: "403", desc: "Forbidden - API key is inactive" },
                { code: "404", desc: "Not Found - Package or order not found" },
                { code: "500", desc: "Internal Server Error" },
              ].map(err => (
                <div key={err.code} className="flex gap-3 items-start p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="font-mono text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded whitespace-nowrap">{err.code}</span>
                  <span className="text-sm text-muted-foreground">{err.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Important Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2 ml-4">
              <li>• Prices are automatically determined from the package database</li>
              <li>• Wallet balance is deducted immediately upon successful purchase</li>
              <li>• Provider reference is saved for order tracking</li>
              <li>• Keep your API key secure and never share it publicly</li>
              <li>• API calls are rate-limited to ensure fair usage</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderApiOrders = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            API Orders
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">Track your API purchase history and order details</p>
        </CardHeader>
        <CardContent>
          {loadingApiOrders ? (
            <div className="flex justify-center items-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : apiOrders.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No API orders yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search + filter */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <input
                  type="text"
                  placeholder="Search by phone or network..."
                  value={apiOrdersSearch}
                  onChange={e => setApiOrdersSearch(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
                />
                <select
                  value={apiOrdersStatusFilter}
                  onChange={e => setApiOrdersStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              {filteredApiOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No orders match your search.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Contact</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Network</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Amount</th>
                        <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Order Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApiOrders.map(order => {
                        const fs = order.order_status || order.fulfillment_status || order.status || 'pending';
                        return (
                          <tr key={order.id} className={`border-t border-border hover:bg-muted/30 transition-colors ${fs === 'refunded' ? 'bg-amber-500/5' : ''}`}>
                            <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString()}{' '}
                              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-3 py-2 text-xs font-mono">{order.customer_number}</td>
                            <td className="px-3 py-2 text-xs">
                              <span className="px-2 py-0.5 rounded bg-muted text-foreground">{order.network?.toUpperCase()}</span>
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-cyan-400">
                              {order.size_gb_text || `${order.size_gb}GB`}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold">
                              GHC {Number(order.selling_price || order.amount || 0).toFixed(2)}
                              {fs === 'refunded' && order.refunded_amount != null && (
                                <span className="block text-xs text-amber-400 mt-0.5">GHC {Number(order.refunded_amount).toFixed(2)} refunded</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <OrderStatusBadge status={fs} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderAfaRegistration = () => (
    <AFAPackagesDisplay
      onRegisterClick={(packageId, packageName, price) => {
        toast({ 
          title: "Ready to register", 
          description: `Selected: ${packageName} - GHC ${price.toFixed(2)}` 
        });
        setActiveMenu("buy-data");
      }}
    />
  );

  const renderRefunds = () => {
    // Filter refunded orders — check all three status fields since different parts of
    // the system may write to different columns (order_status vs fulfillment_status vs status).
    const refundedOrders = orders.filter(o =>
      o.fulfillment_status === "refunded" ||
      o.status === "refunded" ||
      (o.order_status || "").toLowerCase() === "refunded"
    );
    
    let filteredRefunds = refundedOrders;
    if (refundFilter === "processing") {
      filteredRefunds = refundedOrders.filter(o => o.fulfillment_status === "processing");
    } else if (refundFilter === "delivered") {
      filteredRefunds = refundedOrders.filter(o => o.fulfillment_status === "completed");
    } else if (refundFilter === "refunded") {
      filteredRefunds = refundedOrders.filter(o =>
        o.fulfillment_status === "refunded" ||
        o.status === "refunded" ||
        (o.order_status || "").toLowerCase() === "refunded"
      );
    }

    const totalRefundAmount = filteredRefunds.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    return (
      <div className="space-y-6">
        {/* Refund Stats Card */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Refunded Orders</p>
                <p className="font-display text-3xl font-bold text-amber-400 mt-2">{refundedOrders.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total refund value: GHC {totalRefundAmount.toFixed(2)}</p>
              </div>
              <Wallet className="h-8 w-8 text-amber-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Refund Filter Buttons */}
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-3">Filter Refunds:</p>
          <div className="flex flex-wrap gap-2">
            {["all", "processing", "delivered", "refunded"].map((filter) => (
              <button
                key={filter}
                onClick={() => setRefundFilter(filter as any)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  refundFilter === filter
                    ? "bg-amber-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {filter === "all" ? "All Refunds" : filter === "processing" ? "Processing" : filter === "delivered" ? "Delivered" : "Refunded"}
              </button>
            ))}
          </div>
        </div>

        {/* Refunded Orders Table */}
        {filteredRefunds.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No refunded orders</p>
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
                  <TableHead>Amount</TableHead>
                  <TableHead>Refund Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRefunds.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="text-sm text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="font-medium">{order.customer_number}</TableCell>
                    <TableCell className="uppercase text-sm">{order.network}</TableCell>
                    <TableCell>GHC {Number(order.amount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        {order.fulfillment_status === "refunded" || order.status === "refunded" ? "Refunded" : "Processing"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    );
  };

  const renderBecomeAgent = () => (
    <div className="space-y-6">
      <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Users className="h-6 w-6" />
            Become an Agent
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">Upgrade your account to unlock agent features and start earning commissions!</p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Account Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Account Type</p>
              <p className="text-2xl font-display font-bold text-foreground mt-1">Regular User</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-mono text-sm mt-1">{user?.email}</p>
            </div>
            <div className="pt-4 border-t border-border">
              <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Eligible for Agent Status</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Highlights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Why Agents Love Our Platform</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <p className="font-display font-bold text-2xl text-primary">10+</p>
              <p className="text-xs text-muted-foreground mt-1">Revenue streams and earning opportunities</p>
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-cyan-400">Unlimited</p>
              <p className="text-xs text-muted-foreground mt-1">Commission levels - build your own empire</p>
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-green-400">24/7</p>
              <p className="text-xs text-muted-foreground mt-1">Instant withdrawals, anytime you want</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exclusive Agent Benefits */}
      <div>
        <h3 className="text-lg font-bold mb-4 text-foreground">Exclusive Agent Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { icon: Smartphone, title: "Free Personal USSD", description: "Get your own USSD code to sell data bundles directly to customers - free of charge", color: "from-blue-600 to-blue-700" },
            { icon: Store, title: "Free Shop USSD", description: "Create your shop with a unique USSD code - your subagents also get free USSD codes", color: "from-cyan-600 to-cyan-700" },
            { icon: Crown, title: "Boss Mode - You're in Charge", description: "Build your own hierarchy - subagents who recruit sub-subagents, all under your control", color: "from-yellow-600 to-yellow-700" },
            { icon: Globe, title: "Custom Store Link", description: "Get your personalized storefront URL with your shop name - build your brand", color: "from-purple-600 to-purple-700" },
            { icon: Palette, title: "Free Flyer Generator", description: "Create beautiful, customizable flyers to promote your business on social media", color: "from-pink-600 to-pink-700" },
            { icon: Send, title: "Notification System", description: "Send notifications to all your subagents instantly and update your storefront for customers to see every visit", color: "from-teal-600 to-teal-700" },
            { icon: Users, title: "Build Subagents", description: "Recruit subagents who get their own USSD codes, stores, and earning power", color: "from-green-600 to-green-700" },
            { icon: BarChart3, title: "Multi-Level Earnings", description: "Your subagents can recruit agents - earn commissions at every level", color: "from-orange-600 to-orange-700" },
            { icon: Settings, title: "AFA Management", description: "Set your own AFA bundle prices and manage registrations from your dashboard", color: "from-red-600 to-red-700" },
            { icon: Zap, title: "API Access", description: "Access our API with heavily discounted pricing for bulk operations", color: "from-yellow-600 to-yellow-700" },
            { icon: Wallet, title: "Instant Withdrawals", description: "Withdraw your earnings instantly, anytime - no delays or hidden fees", color: "from-emerald-600 to-emerald-700" },
            { icon: Share2, title: "Marketing Tools", description: "Access templates, promotional content, and ready-made marketing materials", color: "from-indigo-600 to-indigo-700" },
          ].map((benefit, index) => {
            const IconComponent = benefit.icon;
            return (
              <Card key={index} className="hover:border-primary/50 transition-all">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${benefit.color} text-white flex-shrink-0`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">{benefit.title}</h4>
                      <p className="text-xs text-muted-foreground leading-tight">{benefit.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Your Path to Success */}
      <div>
        <h3 className="text-lg font-bold mb-4 text-foreground">Your Path to Success</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold mx-auto mb-3">1</div>
              <p className="font-semibold text-sm mb-2">Sign Up</p>
              <p className="text-xs text-muted-foreground">Set up your store details &amp; get your personal USSD</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="bg-cyan-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold mx-auto mb-3">2</div>
              <p className="font-semibold text-sm mb-2">Setup Shop</p>
              <p className="text-xs text-muted-foreground">Create storefront &amp; start selling</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold mx-auto mb-3">3</div>
              <p className="font-semibold text-sm mb-2">Build Network &amp; Earn</p>
              <p className="text-xs text-muted-foreground">Recruit agents &amp; enjoy multi-level earnings</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upgrade Button */}
      <Card className="border-primary/50">
        <CardContent className="pt-6">
          <Button
            className="w-full h-12 text-lg font-semibold"
            onClick={async () => {
              try {
                // Check if user already has a pending agent account
                const { data: existingAgent, error } = await supabase
                  .from("agent_stores")
                  .select("id, approved")
                  .eq("user_id", effectiveUserId)
                  .maybeSingle();
                
                if (error) {
                  console.log("[v0] Error checking agent account:", error);
                  fetchRegistrationFee();
                  setShowUpgradeConfirmation(true);
                  return;
                }
                
                if (existingAgent && !existingAgent.approved) {
                  // User has pending agent account, redirect to pending approval page
                  navigate("/pending-approval");
                } else {
                  // User doesn't have pending account, show upgrade confirmation
                  fetchRegistrationFee();
                  setShowUpgradeConfirmation(true);
                }
              } catch (err) {
                console.log("[v0] Exception checking agent account:", err);
                fetchRegistrationFee();
                setShowUpgradeConfirmation(true);
              }
            }}
            disabled={registrationFeeLoading}
          >
            {registrationFeeLoading ? "Loading..." : "Upgrade to Agent Now"}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">You&apos;ll set up your store details next, using your current account email.</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderTopup = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Funds to Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-base font-semibold mb-3 block">Regular Wallet</Label>
              <Button onClick={handleOpenNormalWalletTopup} className="w-full">
                <Wallet className="h-4 w-4 mr-2" />
                Top Up Wallet
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Current: GHC {Number(normalWallet).toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-base font-semibold mb-3 block">API Wallet</Label>
              <Button onClick={handleOpenApiWalletTopup} className="w-full" variant="outline">
                <Zap className="h-4 w-4 mr-2" />
                Top Up API Wallet
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Current: GHC {Number(apiWallet).toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top-up History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Top-up History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topupHistory && topupHistory.length > 0 ? (
              topupHistory.map((topup: any, idx: number) => (
                <div key={idx} className="border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{topup.wallet_type === "normal" ? "Wallet" : "API Wallet"} Top-up</p>
                      <p className="text-xs text-muted-foreground">ID: {topup.reference?.substring(0, 8) || "N/A"}</p>
                    </div>
                    <p className="font-bold text-green-400">+GHC {Number(topup.amount).toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{new Date(topup.created_at).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No top-up history yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Email</Label>
            <p className="font-mono text-sm bg-muted p-2 rounded mt-1">{user?.email}</p>
          </div>
          <Button onClick={() => signOut()} variant="destructive" className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {isImpersonating && (
        <div className="fixed top-16 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2 flex items-center justify-between text-sm font-medium">
          <span>
            Admin view: You are viewing{" "}
            <strong>{impersonatedCustomerName || "this customer"}</strong>&apos;s account.
          </span>
          <button
            onClick={exitImpersonation}
            className="rounded bg-black/80 text-white px-3 py-1 text-xs font-semibold hover:bg-black"
          >
            Exit &amp; Return to Admin
          </button>
        </div>
      )}

      <div className={`pb-12 ${isImpersonating ? "pt-32" : "pt-24"}`}>
        <div className="container mb-8">
          <h1 className="font-display text-4xl font-bold text-foreground mb-2">My Dashboard</h1>
          <p className="text-muted-foreground">Manage your account and purchases</p>
        </div>

        <div className="flex min-h-[calc(100vh-200px)]">
          {/* Desktop Sidebar */}
          <div className="hidden lg:flex flex-col w-64 bg-muted/50 border-r border-border px-4 py-6 overflow-y-auto">
            <div className="space-y-1">
              {menuItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveMenu(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                      activeMenu === item.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="my-4 border-t border-border" />

            {/* Agent Features Dropdown */}
            <div>
              <button
                onClick={() => setAgentFeaturesOpen(!agentFeaturesOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Agent Features
                </span>
                <svg
                  className={`h-4 w-4 transition-transform ${agentFeaturesOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              {agentFeaturesOpen && (
                <div className="mt-1 ml-4 space-y-1 border-l border-border pl-3">
                  {agentOnlyItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground opacity-60"
                        title="Available in Agent Dashboard"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button and Sidebar */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden fixed bottom-6 right-6 z-50">
              <Button size="lg" className="rounded-full shadow-lg animate-pulse hover:animate-none">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full p-6 gap-4">
                <h2 className="font-display text-lg font-bold">Menu</h2>
                <div className="space-y-1 flex-1 overflow-y-auto">
                  {menuItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveMenu(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                          activeMenu === item.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Agent Features Dropdown */}
                <div>
                  <button
                    onClick={() => setAgentFeaturesOpen(!agentFeaturesOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Agent Features
                    </span>
                    <svg
                      className={`h-4 w-4 transition-transform ${agentFeaturesOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>
                  {agentFeaturesOpen && (
                    <div className="mt-1 ml-4 space-y-1 border-l border-border pl-3">
                      {agentOnlyItems.map(item => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground opacity-60"
                            title="Available in Agent Dashboard"
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Main Content Area */}
          <div className="flex-1 p-4 lg:p-8 overflow-auto">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Buy Package Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buy {buyPkg?.size_gb}GB Package</DialogTitle>
          </DialogHeader>

          {buyStep === "phone" ? (
            <div className="space-y-4">
              <div>
                <Label>Phone Number</Label>
                <Input
                  placeholder="0201234567"
                  value={buyPhone}
                  onChange={(e) => setBuyPhone(e.target.value)}
                  maxLength="10"
                  className="mt-1"
                />
                {buyPhone && !phoneMatchesNetwork(buyPhone, buyPkg?.network || "") && (
                  <p className="text-xs text-red-400 mt-1">Phone number doesn't match {buyPkg?.network} network</p>
                )}
              </div>

              {/* Network provider debt warning — shown before payment selection */}
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-400 leading-relaxed">
                <span className="font-semibold block mb-1">Important Notice</span>
                Make sure you have no outstanding airtime, mobile money (MoMo), or bundle debt on the recipient number. Network providers will not deliver data to numbers with unpaid balances — this is a network rule we cannot override.
              </div>

              <div>
                <Label>Payment Method</Label>
                <div className="mt-1 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setBuyPaymentMethod("paystack")}
                    aria-pressed={buyPaymentMethod === "paystack"}
                    className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      buyPaymentMethod === "paystack" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${buyPaymentMethod === "paystack" ? "border-primary" : "border-muted-foreground"}`}>
                        {buyPaymentMethod === "paystack" && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </span>
                      Paystack
                    </span>
                    <span className="text-xs font-medium text-yellow-400">1.98% fee added</span>
                  </button>
                  <div className="flex gap-2 items-stretch">
                    <button
                      type="button"
                      onClick={() => setBuyPaymentMethod("wallet")}
                      aria-pressed={buyPaymentMethod === "wallet"}
                      className={`flex-1 flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                        buyPaymentMethod === "wallet" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${buyPaymentMethod === "wallet" ? "border-primary" : "border-muted-foreground"}`}>
                          {buyPaymentMethod === "wallet" && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </span>
                        Wallet (GHC {Number(normalWallet).toFixed(2)})
                      </span>
                      <span className="text-xs font-medium text-green-400">No fee added</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNormalWalletTopup(true)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg border border-cyan-600/30 bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20 transition-colors whitespace-nowrap"
                    >
                      Add Fund
                    </button>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => {
                  if (!buyPhone || !isValidPhoneLength(buyPhone)) {
                    toast({ title: "Invalid phone", description: "Please enter a valid 10-digit phone number", variant: "destructive" });
                    return;
                  }
                  if (!phoneMatchesNetwork(buyPhone, buyPkg?.network || "")) {
                    toast({ title: "Network mismatch", description: "Phone number doesn't match the selected network", variant: "destructive" });
                    return;
                  }
                  setBuyStep("confirm");
                }}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">Phone:</span> {buyPhone}</p>
                <p className="text-sm"><span className="text-muted-foreground">Network:</span> {buyPkg?.network.toUpperCase()}</p>
                <p className="text-sm"><span className="text-muted-foreground">Package:</span> {buyPkg?.size_gb}GB</p>
                <p className="text-sm"><span className="text-muted-foreground">Amount:</span> GHC {Number(buyPkg?.price || 0).toFixed(2)}</p>
                {buyPaymentMethod === "paystack" && (
                  <>
                    <p className="text-sm"><span className="text-muted-foreground">Paystack Fee (1.98%):</span> GHC {(Number(buyPkg?.price || 0) * 1.98 / 100).toFixed(2)}</p>
                    <p className="text-sm font-semibold"><span className="text-muted-foreground">Total:</span> GHC {(Number(buyPkg?.price || 0) * 1.0198).toFixed(2)}</p>
                  </>
                )}
                <p className="text-sm"><span className="text-muted-foreground">Payment:</span> {buyPaymentMethod === "wallet" ? "Wallet (No fee)" : "Paystack"}</p>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setBuyStep("phone")} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleBuyConfirm}
                  disabled={buyLoading}
                  className="flex-1"
                >
                  {buyLoading ? "Processing..." : "Confirm Purchase"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Topup Dialogs */}
      <WalletTopupDialog
  open={showNormalWalletTopup}
  onOpenChange={setShowNormalWalletTopup}
  currentBalance={normalWallet}
  walletType="normal"
  identityId={effectiveUserId}
  userEmail={user?.email}
  callbackUrl={`${window.location.origin}/user-dashboard?wallet=success`}
  />

      <WalletTopupDialog
        open={showApiWalletTopup}
        onOpenChange={setShowApiWalletTopup}
        currentBalance={apiWallet}
        walletType="api"
        apiKey={apiKey}
        callbackUrl={`${window.location.origin}/user-dashboard?wallet=success`}
      />

      {/* Verifies Paystack data purchases on return and creates the order */}
      <PaymentVerifier />

      <WhatsAppFloatingButton />

      <Footer />
      {/* Agent Upgrade Confirmation Modal */}
      {showUpgradeConfirmation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Become an Agent?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-2">
                    <p className="font-semibold text-foreground">Important Information:</p>
                    <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                      <li>Your current User account will be <span className="font-semibold text-red-400">permanently closed</span> when you upgrade to Agent</li>
                      <li><span className="font-semibold text-red-400">Any money remaining in your wallet will be lost</span> when this account is closed</li>
                      <li>Please <span className="font-semibold text-foreground">withdraw or spend all your wallet balance</span> before proceeding</li>
                      <li>Current wallet balance: <span className="font-semibold text-cyan-400">GHC {Number(normalWallet).toFixed(2)}</span></li>
                      <li>After upgrading, you cannot go back to a User account - you will become an Agent</li>
                      <li>You will complete agent setup and proceed to payment to activate your agent account</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="agree-terms"
                    className="rounded border-border"
                  />
                  <span className="text-sm text-muted-foreground">I understand that my account will be closed and I have cleared my wallet</span>
                </label>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowUpgradeConfirmation(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const checkbox = document.getElementById("agree-terms") as HTMLInputElement;
                    if (!checkbox?.checked) {
                      toast({ title: "Please confirm you understand the terms", variant: "destructive" });
                      return;
                    }
                    setShowUpgradeConfirmation(false);
                    navigate("/agent-onboarding");
                  }}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  I Understand - Proceed
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
