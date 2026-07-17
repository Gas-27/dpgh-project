import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WalletTopupDialog from "@/components/WalletTopupDialog";
import AFAPackagesDisplay from "@/components/AFAPackagesDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Download, TrendingUp, Key, Settings, ShoppingCart, Wallet, Copy, Eye, EyeOff, Phone, CreditCard, Zap, BarChart3, Home, LogOut, Menu, Coins, Lock, AlertCircle, Users, Bell, Image as ImageIcon, Share2, Search } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  created_at: string;
}

const UserDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [buyPaymentMethod, setBuyPaymentMethod] = useState<"paystack" | "wallet">("wallet");
  const [buyLoading, setBuyLoading] = useState(false);
  const [topupReference, setTopupReference] = useState<string>("");
  const [showApiWalletTopup, setShowApiWalletTopup] = useState(false);
  const [orderFilter, setOrderFilter] = useState<"all" | "today" | "yesterday" | "week" | "month" | "custom">("all");
  const [totalOrders, setTotalOrders] = useState(0);
  const [topupHistory, setTopupHistory] = useState<any[]>([]);
  const [showNormalWalletTopup, setShowNormalWalletTopup] = useState(false);

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

  // Menu navigation
  const [activeMenu, setActiveMenu] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "buy-data", label: "Buy Data", icon: ShoppingCart },
    { id: "orders", label: "Orders", icon: BarChart3 },
    { id: "rewards", label: "Rewards & Benefits", icon: ImageIcon },
    { id: "api-key", label: "API Key", icon: Zap },
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
    if (!user?.id) return;

    const fetchUserData = async () => {
      try {
        setLoading(true);
        console.log("[v0] Fetching orders for user:", user.id);
        
        // Fetch orders for this user
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", user.id)
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
          .eq("identity_id", user.id)
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
          .eq("user_id", user.id)
          .maybeSingle();

        let customerPkId: string | null = null;
        if (customerData) {
          customerPkId = customerData.id;
          setNormalWallet(customerData.wallet_balance || 0);
          if (customerData.topup_reference) {
            setTopupReference(customerData.topup_reference);
          } else {
            // Generate a default top-up reference if none exists
            setTopupReference(`user${user.id.substring(0, 8)}`);
          }
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
  }, [user?.id, toast]);

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

  // Fetch API orders when needed
  useEffect(() => {
    if (apiKey) {
      fetchApiOrders();
    }
  }, [apiKey]);

  const fetchApiOrders = async () => {
    setLoadingApiOrders(true);
    try {
      const response = await fetch("/api/get-orders", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.orders) {
          setApiOrders(data.data.orders);
        }
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
    
    const matchStatus = apiOrdersStatusFilter === "" || 
      order.order_status === apiOrdersStatusFilter;

    return matchSearch && matchStatus;
  });

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
        .eq("identity_id", user?.id)
        .maybeSingle();

      const existingApiWallet = existingData?.wallet || 0;

      const upsertData: any = {
        identity_id: user?.id,
        api_key: newApiKey,
        is_agent: false,
        is_user: true,
        wallet: existingApiWallet,
        updated_at: new Date().toISOString(),
        role: 'user',
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
    setBuyPaymentMethod("wallet");
    setBuyDialogOpen(true);
  };

  const handleBuyConfirm = async () => {
    if (!buyPkg || !user?.id) return;
    setBuyLoading(true);
    try {
      const price = Number(buyPkg.price);

      // Check for rate limit (45 minute window)
      const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
      const { data: recentOrders } = await supabase
        .from("orders")
        .select("created_at")
        .eq("customer_number", buyPhone.trim())
        .eq("customer_id", user.id)
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
          .eq("user_id", user.id);

        if (walletError) {
          toast({ title: "Error", description: walletError.message, variant: "destructive" });
          setBuyLoading(false);
          return;
        }

        setNormalWallet(normalWallet - price);

        // Create order record for wallet payment
        const { error: orderError } = await supabase
          .from("orders")
          .insert({
            package_id: buyPkg.id,
            customer_id: user.id,
            customer_number: buyPhone.trim(),
            network: buyPkg.network,
            size_gb: buyPkg.size_gb,
            amount: price,
            status: "pending",
            fulfillment_status: "processing",
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
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });
        
        if (ordersData) setOrders(ordersData as Order[]);
      } else if (buyPaymentMethod === "paystack") {
        // Paystack payment flow - similar to Packages page
        const payloadBody = {
          amount: price,
          email: `${buyPhone}@dataplug.store`,
          phone: buyPhone.trim(),
          callback_url: `${window.location.origin}/user-dashboard?payment=success`,
          metadata: {
            type: "buy_data",
            phone: buyPhone.trim(),
            network: buyPkg.network,
            package_id: buyPkg.id,
            size_gb: buyPkg.size_gb,
            customer_id: user.id
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
      case "rewards":
        return renderFlyerGenerator();
      case "api-key":
        return renderApiKey();
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
    // Get recent orders for display
    const recentOrders = orders.slice(0, 10);
    
    return (
    <div className="space-y-6">
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
            <div className="flex gap-2 mt-4">
              <Button onClick={() => setActiveMenu("buy-data")} className="flex-1" size="sm" variant="default">
                Buy Data
              </Button>
              <Button onClick={() => { console.log("[v0] Top Up clicked"); setShowNormalWalletTopup(true); }} className="flex-1" size="sm" variant="outline">
                Top Up
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards Row - Like Agent Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground text-sm">Total Orders</p>
            <p className="font-display text-3xl font-bold mt-2 text-foreground">{orders.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground text-sm">Pending Orders</p>
            <p className="font-display text-3xl font-bold mt-2 text-primary">{orders.filter(o => o.status === 'pending' || o.status === 'processing').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Large Info Cards - Like Agent Dashboard */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Amount Spent</p>
                <p className="font-display text-3xl font-bold text-green-400 mt-2">GHC {totalSpent.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">All-time spending</p>
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
                  {orders.map(order => (
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
                        <Badge className={`text-xs ${
                          order.status === 'completed' || order.status === 'paid' ? 'bg-green-600/20 text-green-400 border-green-600/30' :
                          order.status === 'pending' ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30' :
                          'bg-slate-600/20 text-slate-400 border-slate-600/30'
                        }`}>
                          {order.status === 'paid' ? 'Completed' : order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                        </Badge>
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
            {['mtn', 'telecel', 'airteltigo'].map(network => (
              <Button
                key={network}
                variant={networkFilter === network ? "default" : "outline"}
                onClick={() => setNetworkFilter(network)}
                className="text-xs sm:text-sm"
              >
                {network.toUpperCase()}
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
    const filteredOrders = orders.filter(order => 
      order.customer_number?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      order.id?.toLowerCase().includes(orderSearch.toLowerCase())
    );

    // Calculate stats
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
    const totalSpent = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">Total Orders</p>
              <p className="font-display text-3xl font-bold mt-2 text-foreground">{totalOrders}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">Pending Orders</p>
              <p className="font-display text-3xl font-bold mt-2 text-primary">{pendingOrders}</p>
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
                        <TableCell>
                          <Badge className={`text-xs ${
                            order.status === 'completed' || order.status === 'paid' ? 'bg-green-600/20 text-green-400 border-green-600/30' :
                            order.status === 'pending' ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30' :
                            order.status === 'processing' ? 'bg-blue-600/20 text-blue-400 border-blue-600/30' :
                            'bg-slate-600/20 text-slate-400 border-slate-600/30'
                          }`}>
                            {order.status === 'paid' ? 'Completed' : order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                          </Badge>
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

          {/* API Packages Grid - Exact styling from AgentDashboard */}
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
                  <CardContent className="pt-4">
                    <p className="font-display text-lg font-bold text-foreground">{pkg.size_gb_text || pkg.size_gb + "GB"}</p>
                    <p className="text-lg font-bold text-cyan-400">GHC {apiPrice.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">API Price</p>
                  </CardContent>
                </Card>
              );
            })}
            {packages.filter(p => {
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
          {apiOrders.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No API orders yet. Purchase API data packages to see your order history.</p>
              <Button onClick={() => setActiveMenu("api-key")} className="mt-4">
                View API Packages
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiOrders.map(order => (
                <div key={order.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{order.package_size}GB - {order.network}</p>
                      <p className="text-sm text-muted-foreground">Order ID: {order.id.substring(0, 8)}</p>
                    </div>
                    <p className="font-display font-bold text-purple-400">GHC {Number(order.amount).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>Status: <span className="text-green-400">{order.status}</span></span>
                    <span>Date: {new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
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

        {/* Agent Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agent Benefits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</div>
              <div>
                <p className="font-semibold text-sm">Bulk Orders</p>
                <p className="text-xs text-muted-foreground">Purchase large quantities at discounted rates</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</div>
              <div>
                <p className="font-semibold text-sm">Custom Pricing</p>
                <p className="text-xs text-muted-foreground">Set your own prices and margins</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</div>
              <div>
                <p className="font-semibold text-sm">Subagents</p>
                <p className="text-xs text-muted-foreground">Recruit and manage subagents</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</div>
              <div>
                <p className="font-semibold text-sm">Earnings Dashboard</p>
                <p className="text-xs text-muted-foreground">Track commissions and withdrawals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upgrade Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-green-600/30 bg-green-600/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Minimum Orders</p>
              <p className="text-2xl font-display font-bold text-green-400 mt-2">5+</p>
              <p className="text-xs text-muted-foreground mt-1">Completed orders required</p>
            </div>
            <div className="p-4 border border-green-600/30 bg-green-600/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Account Age</p>
              <p className="text-2xl font-display font-bold text-green-400 mt-2">7+ days</p>
              <p className="text-xs text-muted-foreground mt-1">Days since registration</p>
            </div>
            <div className="p-4 border border-green-600/30 bg-green-600/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Verification</p>
              <p className="text-2xl font-display font-bold text-green-400 mt-2">Email</p>
              <p className="text-xs text-muted-foreground mt-1">Email must be verified</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Button */}
      <Card className="border-primary/50">
        <CardContent className="pt-6">
          <Button 
            className="w-full h-12 text-lg font-semibold"
            onClick={async () => {
              try {
                // Create agent account with same email
                const response = await supabase.functions.invoke("create-agent-account", {
                  body: {
                    email: user?.email,
                    user_id: user?.id,
                  }
                });

                if (response.error) {
                  toast({
                    title: "Error",
                    description: response.error.message || "Failed to upgrade to agent",
                    variant: "destructive"
                  });
                  return;
                }

                toast({
                  title: "Success!",
                  description: "You are now an Agent! Refresh to see new features.",
                });

                // Redirect to agent dashboard after 2 seconds
                setTimeout(() => {
                  window.location.href = "/agent";
                }, 2000);
              } catch (err) {
                console.error("[v0] Error upgrading to agent:", err);
                toast({
                  title: "Error",
                  description: "Failed to process upgrade. Please try again.",
                  variant: "destructive"
                });
              }
            }}
          >
            Upgrade to Agent Now
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">Same email will be used for your agent account</p>
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
      
      <div className="pt-24 pb-12">
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
              <Button size="lg" className="rounded-full shadow-lg">
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

              <div>
                <Label>Payment Method</Label>
                <Select value={buyPaymentMethod} onValueChange={(value: any) => setBuyPaymentMethod(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wallet">
                      Wallet (Balance: GHC {Number(normalWallet).toFixed(2)})
                    </SelectItem>
                    <SelectItem value="paystack">
                      Paystack
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                <p className="text-sm"><span className="text-muted-foreground">Payment:</span> {buyPaymentMethod === "wallet" ? "Wallet" : "Paystack"}</p>
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
  identityId={user?.id}
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

      <Footer />
    </div>
  );
};

export default UserDashboard;
