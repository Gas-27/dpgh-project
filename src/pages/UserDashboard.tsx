import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WalletTopupDialog from "@/components/WalletTopupDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Download, TrendingUp, Key, Settings, ShoppingCart, Wallet, Copy, Eye, EyeOff, Phone, CreditCard, Zap, BarChart3, Home, LogOut, Menu, Coins, Lock, AlertCircle, Users, Bell } from "lucide-react";
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
  const [showNormalWalletTopup, setShowNormalWalletTopup] = useState(false);

  // API Orders state
  const [apiOrders, setApiOrders] = useState<any[]>([]);
  const [loadingApiOrders, setLoadingApiOrders] = useState(false);
  const [apiOrdersSearch, setApiOrdersSearch] = useState("");
  const [apiOrdersStatusFilter, setApiOrdersStatusFilter] = useState("");

  // Menu navigation
  const [activeMenu, setActiveMenu] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "buy-data", label: "Buy Data", icon: ShoppingCart },
    { id: "orders", label: "Orders", icon: BarChart3 },
    { id: "api-key", label: "API Key", icon: Zap },
    { id: "api-packages", label: "API Packages", icon: Package },
    { id: "topup", label: "Top Up", icon: Coins },
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
        
        // Fetch orders for this user
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false })
          .range(0, 99999999);

        if (ordersError) {
          console.error("[v0] Error fetching orders:", ordersError);
        } else {
          const userOrders = (ordersData as Order[]) || [];
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
          .select("api_key, wallet")
          .eq("identity_id", user.id)
          .eq("is_user", true)
          .maybeSingle();

        if (apiUserData?.api_key) {
          setApiKey(apiUserData.api_key);
          setApiWallet(apiUserData.wallet || 0);
        }

        // Fetch user's normal wallet
        const { data: userWalletData } = await supabase
          .from("user_wallets")
          .select("balance, topup_reference")
          .eq("user_id", user.id)
          .maybeSingle();

        if (userWalletData) {
          setNormalWallet(userWalletData.balance || 0);
        }

        // Check if user is a customer and fetch topup reference
        const { data: customerData } = await supabase
          .from("customers")
          .select("topup_reference")
          .eq("user_id", user.id)
          .maybeSingle();

        if (customerData?.topup_reference) {
          setTopupReference(customerData.topup_reference);
        } else if (userWalletData?.topup_reference) {
          setTopupReference(userWalletData.topup_reference);
        }

        // Fetch all packages
        const { data: packagesData } = await supabase
          .from("data_packages")
          .select("*")
          .order("size_gb");

        if (packagesData) {
          setPackages(packagesData);
        }
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
    setShowNormalWalletTopup(true);
  };

  const detectNetwork = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("024") || cleaned.startsWith("054") || cleaned.startsWith("055")) return "mtn";
    if (cleaned.startsWith("027") || cleaned.startsWith("057")) return "airteltigo";
    if (cleaned.startsWith("020") || cleaned.startsWith("026") || cleaned.startsWith("056")) return "telecel";
    return "unknown";
  };

  const phoneMatchesNetwork = (phone: string, network: string) => {
    return detectNetwork(phone) === network;
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
          .from("user_wallets")
          .update({ balance: normalWallet - price })
          .eq("user_id", user.id);

        if (walletError) {
          toast({ title: "Error", description: walletError.message, variant: "destructive" });
          setBuyLoading(false);
          return;
        }

        setNormalWallet(normalWallet - price);
      }

      // Create order record
      const { error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          customer_number: buyPhone.trim(),
          network: buyPkg.network,
          size_gb: buyPkg.size_gb,
          amount: price,
          status: "pending",
          fulfillment_status: "processing",
          payment_method: buyPaymentMethod,
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
    } catch (err) {
      console.error("[v0] Error processing purchase:", err);
      toast({ title: "Error", description: "Failed to process purchase", variant: "destructive" });
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
      case "api-key":
        return renderApiKey();
      case "api-packages":
        return renderApiPackages();
      case "topup":
        return renderTopup();
      case "settings":
        return renderSettings();
      default:
        return null;
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Button onClick={handleOpenNormalWalletTopup} className="flex-1" size="sm" variant="outline">
                Add Funds
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-pink-500/5 hover:border-purple-500/50 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">API Wallet</p>
              <Zap className="h-5 w-5 text-purple-400" />
            </div>
            <p className="font-display text-3xl font-bold text-purple-400">GHC {Number(apiWallet).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-2">For API purchases</p>
            <Button onClick={handleOpenApiWalletTopup} className="mt-4 w-full" size="sm">
              Add Funds
            </Button>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 hover:border-amber-500/50 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Total Purchased</p>
              <TrendingUp className="h-5 w-5 text-amber-400" />
            </div>
            <p className="font-display text-3xl font-bold text-amber-400">{totalDataPurchased.toFixed(1)}GB</p>
            <p className="text-xs text-muted-foreground mt-2">Spent: GHC {Number(totalSpent).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top-up Reference and Codes Card */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-base">Account Reference Codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Top-up Reference</Label>
            <Select defaultValue={topupReference || ""}>
              <SelectTrigger className="bg-muted">
                <SelectValue placeholder="Select reference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={topupReference || ""}>{topupReference || "Loading..."}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">Use this when making top-ups to your account</p>
          </div>

          {/* USSD Code */}
          <div className="pt-2 border-t border-border">
            <Label className="text-xs text-muted-foreground mb-2 block">USSD Code</Label>
            <div className="bg-background p-3 rounded-lg border border-border flex items-center justify-between">
              <p className="font-display font-bold text-primary">*123#</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText("*123#");
                  toast({ title: "Copied!", description: "USSD code copied to clipboard" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Dial this to check your balance</p>
          </div>

          {/* Access Code Zero */}
          <div className="pt-2 border-t border-border">
            <Label className="text-xs text-muted-foreground mb-2 block">Access Code</Label>
            <div className="bg-background p-3 rounded-lg border border-border flex items-center justify-between">
              <p className="font-display font-bold text-primary">0</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText("0");
                  toast({ title: "Copied!", description: "Access code copied to clipboard" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Use this code for special access</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{orders.length}</p>
            <p className="text-sm text-muted-foreground mt-2">Total orders placed</p>
          </CardContent>
        </Card>

      </div>
    </div>
  );

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

  const renderOrders = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Orders</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">View all your data purchase orders</p>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No orders found</p>
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
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{order.customer_number}</TableCell>
                      <TableCell className="text-xs">
                        <span className="px-2 py-1 rounded bg-muted text-foreground">{order.network?.toUpperCase()}</span>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-cyan-400">{order.size_gb}GB</TableCell>
                      <TableCell className="text-xs font-semibold">GHC {Number(order.amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          order.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          order.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                          order.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                        </span>
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

  const renderApiKey = () => (
    <div className="space-y-6">
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
    </div>
  );

  const renderApiPackages = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Data Packages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map(pkg => (
              <Card key={pkg.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{pkg.size_gb}GB</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">API Price</p>
                  <p className="font-display text-2xl font-bold text-purple-400">GHC {Number(pkg.api_price).toFixed(2)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
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
          <div className="hidden lg:flex flex-col w-64 bg-muted/50 border-r border-border px-4 py-6 gap-2">
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

            {/* Agent-Only Section */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground px-3 mb-2 uppercase">Agent Features</p>
              <div className="space-y-1">
                {agentOnlyItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground opacity-50 cursor-not-allowed"
                    >
                      <Lock className="h-4 w-4" />
                      {item.label}
                    </div>
                  );
                })}
              </div>
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
                <div className="space-y-1 flex-1">
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

                {/* Agent-Only Section */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground px-3 mb-2 uppercase">Agent Features</p>
                  <div className="space-y-1">
                    {agentOnlyItems.map(item => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground opacity-50"
                        >
                          <Lock className="h-4 w-4" />
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
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
        isOpen={showNormalWalletTopup}
        onClose={() => setShowNormalWalletTopup(false)}
        onSuccess={() => {
          setShowNormalWalletTopup(false);
          // Refresh wallet balance
        }}
        wallet="normal"
      />

      <WalletTopupDialog
        isOpen={showApiWalletTopup}
        onClose={() => setShowApiWalletTopup(false)}
        onSuccess={() => {
          setShowApiWalletTopup(false);
          // Refresh wallet balance
        }}
        wallet="api"
      />

      <Footer />
    </div>
  );
};

export default UserDashboard;
