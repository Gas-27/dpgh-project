import { useState, useEffect } from "react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Store, Wifi, Settings, ExternalLink, Copy, BarChart3, ShoppingCart, Save,
  LogOut, Zap, Edit2, Wallet, Phone, CreditCard, Loader2, ArrowDownToLine,
  TrendingUp, Search, Palette, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NotificationPopup from "@/components/NotificationPopup";

interface AgentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  whatsapp_group: string | null;
  momo_number: string;
  momo_name: string;
  momo_network: string;
  approved: boolean;
  wallet_balance: number;
  topup_reference: string;
  theme_config?: {
    primary: string;
    primary_foreground: string;
    background: string;
    card_background: string;
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

// NEW DEFAULT THEME (dark mode with light blue primary)
const DEFAULT_THEME = {
  primary: "#38bdf8",
  primary_foreground: "#000000",
  background: "#0a0a0a",
  card_background: "#171717",
};

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
    momo_number: "", momo_name: "", momo_network: "",
  });
  const [savingStore, setSavingStore] = useState(false);
  const [profitStats, setProfitStats] = useState<ProfitStats>({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    availableForWithdrawal: 0,
  });

  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [buyPkg, setBuyPkg] = useState<DataPackage | null>(null);
  const [buyPhone, setBuyPhone] = useState("");
  const [buyStep, setBuyStep] = useState<"phone" | "confirm">("phone");
  const [buyPaymentMethod, setBuyPaymentMethod] = useState<"paystack" | "wallet">("paystack");
  const [buyLoading, setBuyLoading] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [themeColors, setThemeColors] = useState(DEFAULT_THEME);
  const [savingTheme, setSavingTheme] = useState(false);

  const hasPendingWithdrawal = withdrawals.some(w => w.status === "pending");

  const calculateProfitStats = (ordersList: Order[], packagesList: DataPackage[]) => {
    let totalRevenue = 0;
    let totalCost = 0;

    ordersList.forEach(order => {
      if (order.status === "completed" || order.status === "paid") {
        totalRevenue += Number(order.amount);
        const pkg = packagesList.find(p => p.id === order.package_id);
        if (pkg) {
          totalCost += pkg.agent_price;
        }
      }
    });

    const totalProfit = totalRevenue - totalCost;
    const availableForWithdrawal = store?.wallet_balance || 0;

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      availableForWithdrawal,
    };
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: storeData } = await supabase
        .from("agent_stores").select("*").eq("user_id", user.id).maybeSingle() as any;
      setStore(storeData as AgentStore | null);

      if (storeData) {
        if (storeData.theme_config) {
          setThemeColors(storeData.theme_config);
        } else {
          // Save new default theme to DB if not set
          await supabase
            .from("agent_stores")
            .update({ theme_config: DEFAULT_THEME } as any)
            .eq("id", storeData.id);
        }

        setStoreForm({
          store_name: storeData.store_name, whatsapp_number: storeData.whatsapp_number,
          support_number: storeData.support_number, whatsapp_group: storeData.whatsapp_group || "",
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
        const stats = calculateProfitStats(ordersData, packagesData);
        setProfitStats(stats);
      } else {
        const { data: pkgData } = await supabase.from("data_packages").select("*").eq("active", true).order("size_gb");
        setPackages(pkgData ?? []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (orders.length > 0 && packages.length > 0) {
      const stats = calculateProfitStats(orders, packages);
      setProfitStats(stats);
    }
  }, [orders, packages]);

  const saveThemeColors = async () => {
    if (!store) return;
    setSavingTheme(true);
    const { error } = await supabase
      .from("agent_stores")
      .update({ theme_config: themeColors } as any)
      .eq("id", store.id);
    if (error) {
      toast({ title: "Error saving colours", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Store colours updated!", description: "Your storefront will now use these colours." });
    }
    setSavingTheme(false);
  };

  const resetToDefault = () => {
    setThemeColors(DEFAULT_THEME);
  };

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
  const storeUrl = `${window.location.origin}/store/${storeSlug}`;

  const copyStoreLink = () => {
    navigator.clipboard.writeText(storeUrl);
    toast({ title: "Link copied!", description: storeUrl });
  };

  const copyRef = () => {
    if (store?.topup_reference) {
      navigator.clipboard.writeText(store.topup_reference);
      toast({ title: "Reference copied!" });
    }
  };

  const handlePriceChange = (pkgId: string, value: string) => {
    setEditedPrices((prev) => ({ ...prev, [pkgId]: parseFloat(value) }));
  };

  const savePrices = async () => {
    if (!store) return;
    setSavingPrices(true);

    for (const [pkgId, sellPrice] of Object.entries(editedPrices)) {
      const pkg = packages.find(p => p.id === pkgId);
      if (!pkg) continue;

      if (isNaN(sellPrice) || sellPrice <= 0) {
        toast({ title: "Validation error", description: `Price for ${pkg.size_gb}GB ${pkg.network} must be a valid positive number.`, variant: "destructive" });
        setSavingPrices(false);
        return;
      }

      if (sellPrice < pkg.agent_price) {
        toast({ title: "Validation error", description: `Price for ${pkg.size_gb}GB ${pkg.network} cannot be below GH₵ ${pkg.agent_price.toFixed(2)}.`, variant: "destructive" });
        setSavingPrices(false);
        return;
      }
    }

    for (const [pkgId, sellPrice] of Object.entries(editedPrices)) {
      const numericPrice = Number(sellPrice);
      const existing = agentPrices[pkgId];

      if (existing !== undefined) {
        await supabase.from("agent_package_prices").update({ sell_price: numericPrice }).eq("agent_store_id", store.id).eq("package_id", pkgId);
      } else {
        await supabase.from("agent_package_prices").insert({ agent_store_id: store.id, package_id: pkgId, sell_price: numericPrice });
      }
      setAgentPrices((prev) => ({ ...prev, [pkgId]: numericPrice }));
    }

    setEditedPrices({});
    setSavingPrices(false);
    toast({ title: "Prices saved!" });
  };

  const saveStoreInfo = async () => {
    if (!store) return;
    setSavingStore(true);
    const { error } = await supabase.from("agent_stores").update({
      store_name: storeForm.store_name, whatsapp_number: storeForm.whatsapp_number,
      support_number: storeForm.support_number, whatsapp_group: storeForm.whatsapp_group || null,
      momo_number: storeForm.momo_number, momo_name: storeForm.momo_name, momo_network: storeForm.momo_network,
    }).eq("id", store.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setStore({ ...store, ...storeForm, whatsapp_group: storeForm.whatsapp_group || null });
      setEditingStore(false);
      toast({ title: "Store info updated!" });
    }
    setSavingStore(false);
  };

  const openBuyDialog = (pkg: DataPackage) => {
    setBuyPkg(pkg);
    setBuyPhone("");
    setBuyStep("phone");
    setBuyPaymentMethod("paystack");
    setBuyDialogOpen(true);
  };

  const handleBuyConfirm = async () => {
    if (!store || !buyPkg) return;
    setBuyLoading(true);

    const agentPrice = Number(buyPkg.agent_price);

    if (buyPaymentMethod === "wallet") {
      if (Number(store.wallet_balance) < agentPrice) {
        toast({ title: "Insufficient balance", description: "Top up your wallet to continue.", variant: "destructive" });
        setBuyLoading(false);
        return;
      }

      const { error: walletErr } = await supabase.from("agent_stores").update({ wallet_balance: Number(store.wallet_balance) - agentPrice }).eq("id", store.id);
      if (walletErr) {
        toast({ title: "Error", description: walletErr.message, variant: "destructive" });
        setBuyLoading(false);
        return;
      }

      const { data: orderData, error: orderErr } = await supabase.from("orders").insert({
        customer_number: buyPhone.trim(),
        network: buyPkg.network,
        size_gb: buyPkg.size_gb,
        amount: agentPrice,
        package_id: buyPkg.id,
        agent_store_id: store.id,
        status: "paid",
        fulfillment_status: "pending",
        payment_method: "wallet",
      }).select("id").single();

      if (orderErr) {
        toast({ title: "Order error", description: orderErr.message, variant: "destructive" });
        setBuyLoading(false);
        return;
      }

      await supabase.functions.invoke("fulfill-order", { body: { order_id: orderData.id } });
      setStore({ ...store, wallet_balance: Number(store.wallet_balance) - agentPrice });
      toast({ title: "Order placed!", description: "Your data is being processed." });
      setBuyDialogOpen(false);

      const { data: newOrders } = await supabase.from("orders").select("*").eq("agent_store_id", store.id).order("created_at", { ascending: false }).limit(100);
      setOrders((newOrders as Order[]) ?? []);
    } else {
      try {
        const userEmail = user?.email || `agent-${store.id}@datapluggh.com`;
        const PAYSTACK_CHARGE_PERCENT = 1.95;
        const total = Math.round((agentPrice + (agentPrice * PAYSTACK_CHARGE_PERCENT / 100)) * 100) / 100;
        const callbackUrl = `${window.location.origin}/agent?payment=verifying`;
        const { data, error } = await supabase.functions.invoke("initialize-payment", {
          body: {
            email: userEmail,
            amount: total,
            phone: buyPhone.trim(),
            callback_url: callbackUrl,
            metadata: {
              package_id: buyPkg.id,
              network: buyPkg.network,
              package_name: `${buyPkg.size_gb}GB`,
              agent_store_id: store.id,
              payment_method: "paystack",
              use_agent_price: true,
            },
          },
        });
        if (error) throw error;
        if (data?.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          throw new Error(data?.error || "Failed to initialize payment");
        }
      } catch (err: any) {
        toast({ title: "Payment Error", description: err.message, variant: "destructive" });
      }
    }
    setBuyLoading(false);
  };

  const handleWithdraw = async () => {
    if (!store) return;

    if (hasPendingWithdrawal) {
      toast({
        title: "Withdrawal already pending",
        description: "You have a pending withdrawal request. Please wait until it is completed before requesting another.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(withdrawAmount);

    if (!amount || amount < 10) {
      toast({ title: "Minimum withdrawal is GH₵ 10.00", variant: "destructive" });
      return;
    }

    if (amount > profitStats.availableForWithdrawal) {
      toast({ title: "Insufficient balance", description: `Your available balance for withdrawal is GH₵ ${profitStats.availableForWithdrawal.toFixed(2)}`, variant: "destructive" });
      return;
    }

    setWithdrawLoading(true);
    const { error } = await supabase.from("withdrawal_requests").insert({ agent_store_id: store.id, amount });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Withdrawal request placed!", description: "You will receive payment within 24 hours." });
      setWithdrawAmount("");
      const { data } = await supabase.from("withdrawal_requests").select("*").eq("agent_store_id", store.id).order("created_at", { ascending: false });
      setWithdrawals((data as WithdrawalRequest[]) ?? []);
    }
    setWithdrawLoading(false);
  };

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  const filteredOrders = orders.filter(order =>
    order.customer_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
    order.id.toLowerCase().includes(orderSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <NotificationPopup />
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">{store?.store_name ?? "Agent Dashboard"}</span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (<Button variant="ghost" size="sm" asChild><Link to="/admin">Admin</Link></Button>)}
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
                <Button variant="hero" size="sm" asChild><Link to={`/store/${storeSlug}`} target="_blank"><ExternalLink className="h-4 w-4 mr-1" /> Visit Store</Link></Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap justify-center gap-2 h-auto p-2 bg-transparent">
            <TabsTrigger value="overview" className="flex-1 min-w-[100px]"><BarChart3 className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
            <TabsTrigger value="buy" className="flex-1 min-w-[100px]"><ShoppingCart className="h-4 w-4 mr-1" /> Buy Data</TabsTrigger>
            <TabsTrigger value="store" className="flex-1 min-w-[100px]"><Store className="h-4 w-4 mr-1" /> Store Prices</TabsTrigger>
            <TabsTrigger value="withdraw" className="flex-1 min-w-[100px]"><ArrowDownToLine className="h-4 w-4 mr-1" /> Withdraw</TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1 min-w-[100px]"><Palette className="h-4 w-4 mr-1" /> Appearance</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 min-w-[100px]"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">Store Status</p>
                  <Badge className="mt-2 bg-green-600/20 text-green-400 border-green-600/30">Active</Badge>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">Total Orders</p>
                  <p className="font-display text-2xl font-bold mt-1 text-foreground">{totalOrders}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">Pending</p>
                  <p className="font-display text-2xl font-bold mt-1 text-primary">{pendingOrders}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">Revenue</p>
                  <p className="font-display text-2xl font-bold mt-1 text-green-400">GH₵ {profitStats.totalRevenue.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Profit</p>
                      <p className="font-display text-2xl font-bold text-green-400 mt-1">GH₵ {profitStats.totalProfit.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">(Selling Price - Base Price)</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-400 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Available for Withdrawal</p>
                      <p className="font-display text-2xl font-bold text-yellow-400 mt-1">GH₵ {Number(store?.wallet_balance ?? 0).toFixed(2)}</p>
                    </div>
                    <ArrowDownToLine className="h-8 w-8 text-yellow-400 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="font-display text-lg">Recent Orders</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by number or order ID..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                {filteredOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No orders found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Selling Price</TableHead>
                          <TableHead>Base Cost</TableHead>
                          <TableHead>Your Profit</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.slice(0, 20).map((order) => {
                          const pkg = packages.find(p => p.id === order.package_id);
                          const cost = pkg?.agent_price || 0;
                          const profit = Number(order.amount) - cost;
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="text-sm">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="font-mono text-sm">{order.customer_number}</TableCell>
                              <TableCell className="uppercase text-sm">{order.network}</TableCell>
                              <TableCell className="font-display font-bold">{order.size_gb}GB</TableCell>
                              <TableCell className="font-medium">GH₵ {Number(order.amount).toFixed(2)}</TableCell>
                              <TableCell className="text-muted-foreground">GH₵ {cost.toFixed(2)}</TableCell>
                              <TableCell className={profit >= 0 ? "text-green-400 font-semibold" : "text-red-400"}>GH₵ {profit.toFixed(2)}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{order.payment_method === "wallet" ? "Wallet" : "Paystack"}</Badge></TableCell>
                              <TableCell><Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>{order.status === "paid" ? "completed" : order.status}</Badge></TableCell>
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

          {/* BUY DATA TAB */}
          <TabsContent value="buy" className="space-y-4 mt-6">
            <div className="flex gap-2 flex-wrap">
              {["mtn", "airteltigo", "telecel"].map((net) => (
                <Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>
                  {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredPackages.map((pkg) => (
                <Card key={pkg.id} className="border-border hover:border-primary/50 transition-all">
                  <CardContent className="p-4 text-center space-y-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto"><Wifi className="h-5 w-5 text-primary" /></div>
                    <p className="font-display text-xl font-bold text-foreground">{pkg.size_gb}GB</p>
                    <p className="text-lg font-bold text-primary">GH₵ {Number(pkg.agent_price).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Agent Price</p>
                    <Button variant="hero" size="sm" className="w-full" onClick={() => openBuyDialog(pkg)}>Buy Now</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* STORE PRICES TAB */}
          <TabsContent value="store" className="space-y-4 mt-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-2 flex-wrap">
                {["mtn", "airteltigo", "telecel"].map((net) => (
                  <Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>
                    {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
                  </Button>
                ))}
              </div>
              {Object.keys(editedPrices).length > 0 && (<Button variant="hero" size="sm" onClick={savePrices} disabled={savingPrices}><Save className="h-4 w-4 mr-1" /> {savingPrices ? "Saving..." : "Save Prices"}</Button>)}
            </div>
            <p className="text-sm text-muted-foreground">Set your sell prices. Your profit = Selling Price - Base Price.</p>
            <Card className="border-border">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Size</TableHead><TableHead>Base Price (Your Cost)</TableHead><TableHead>Your Selling Price</TableHead><TableHead>Your Profit</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPackages.map((pkg) => {
                      const currentSellPrice = editedPrices[pkg.id] ?? agentPrices[pkg.id] ?? pkg.price;
                      const profit = currentSellPrice - pkg.agent_price;
                      return (
                        <TableRow key={pkg.id}>
                          <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                          <TableCell className="text-muted-foreground">GH₵ {Number(pkg.agent_price).toFixed(2)}</TableCell>
                          <TableCell><Input type="number" step="0.01" value={editedPrices[pkg.id] ?? agentPrices[pkg.id] ?? pkg.price} onChange={(e) => handlePriceChange(pkg.id, e.target.value)} className="w-24 h-8" /></TableCell>
                          <TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>GH₵ {profit.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* WITHDRAW TAB */}
          <TabsContent value="withdraw" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-primary/30 bg-primary/5"><CardContent className="p-6 text-center space-y-2"><TrendingUp className="h-10 w-10 text-primary mx-auto" /><p className="text-muted-foreground text-sm">Total Profit (from sales)</p><p className="font-display text-3xl font-bold text-green-400">GH₵ {profitStats.totalProfit.toFixed(2)}</p></CardContent></Card>
              <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="p-6 text-center space-y-2"><ArrowDownToLine className="h-10 w-10 text-yellow-400 mx-auto" /><p className="text-muted-foreground text-sm">Available for Withdrawal</p><p className="font-display text-3xl font-bold text-yellow-400">GH₵ {profitStats.availableForWithdrawal.toFixed(2)}</p><p className="text-xs text-muted-foreground">(Profit + Wallet Top-ups)</p></CardContent></Card>
            </div>

            <Card className="border-border">
              <CardHeader><CardTitle className="font-display text-lg">Request Withdrawal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {hasPendingWithdrawal && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                    <p className="text-sm text-yellow-400 font-medium">⚠️ You have a pending withdrawal request. Please wait until it is completed before requesting another.</p>
                  </div>
                )}
                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center"><p className="text-xs text-muted-foreground">MoMo Name</p><p className="font-bold text-foreground">{store?.momo_name}</p></div>
                    <div className="text-center"><p className="text-xs text-muted-foreground">MoMo Number</p><p className="font-bold text-foreground">{store?.momo_number}</p></div>
                    <div className="text-center"><p className="text-xs text-muted-foreground">Network</p><p className="font-bold text-foreground">{store?.momo_network?.toUpperCase()}</p></div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Minimum withdrawal: GH₵ 10.00. Withdrawals processed within 24 hours.</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label>Amount (GH₵)</Label>
                    <Input type="number" step="0.01" placeholder="e.g. 50.00" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} disabled={hasPendingWithdrawal} />
                  </div>
                  <Button variant="hero" onClick={handleWithdraw} disabled={withdrawLoading || hasPendingWithdrawal}>
                    {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />}
                    Withdraw
                  </Button>
                </div>
              </CardContent>
            </Card>

            {withdrawals.length > 0 && (
              <Card className="border-border">
                <CardHeader><CardTitle className="font-display text-lg">Withdrawal History</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="text-sm">{new Date(w.created_at).toLocaleString()}</TableCell>
                          <TableCell className="font-bold">GH₵ {Number(w.amount).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={
                              w.status === "completed" ? "bg-green-600/20 text-green-400 border-green-600/30"
                                : w.status === "pending" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                                  : "bg-red-600/20 text-red-400 border-red-600/30"
                            }>{w.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* APPEARANCE TAB */}
          <TabsContent value="appearance" className="mt-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display">Customise Your Storefront Colours</CardTitle>
                <p className="text-sm text-muted-foreground">Choose colours that match your brand. Your public store will update immediately.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Primary Colour (buttons, accents)</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" value={themeColors.primary} onChange={(e) => setThemeColors({ ...themeColors, primary: e.target.value })} className="w-16 h-10 p-1" />
                      <Input type="text" value={themeColors.primary} onChange={(e) => setThemeColors({ ...themeColors, primary: e.target.value })} className="flex-1" placeholder="#38bdf8" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Text Colour on Primary</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" value={themeColors.primary_foreground} onChange={(e) => setThemeColors({ ...themeColors, primary_foreground: e.target.value })} className="w-16 h-10 p-1" />
                      <Input type="text" value={themeColors.primary_foreground} onChange={(e) => setThemeColors({ ...themeColors, primary_foreground: e.target.value })} className="flex-1" placeholder="#000000" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Page Background</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" value={themeColors.background} onChange={(e) => setThemeColors({ ...themeColors, background: e.target.value })} className="w-16 h-10 p-1" />
                      <Input type="text" value={themeColors.background} onChange={(e) => setThemeColors({ ...themeColors, background: e.target.value })} className="flex-1" placeholder="#0a0a0a" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Card Background</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" value={themeColors.card_background} onChange={(e) => setThemeColors({ ...themeColors, card_background: e.target.value })} className="w-16 h-10 p-1" />
                      <Input type="text" value={themeColors.card_background} onChange={(e) => setThemeColors({ ...themeColors, card_background: e.target.value })} className="flex-1" placeholder="#171717" />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
                  <p className="text-sm font-medium">Preview</p>
                  <div className="rounded-md p-4" style={{ backgroundColor: themeColors.background }}>
                    <div className="rounded-md p-3" style={{ backgroundColor: themeColors.card_background }}>
                      <div className="inline-block px-3 py-1 rounded-md text-sm" style={{ backgroundColor: themeColors.primary, color: themeColors.primary_foreground }}>Button Example</div>
                      <p className="text-sm mt-2" style={{ color: themeColors.primary }}>Accent text colour</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="hero" onClick={saveThemeColors} disabled={savingTheme} className="flex-1">
                    {savingTheme ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save Colours
                  </Button>
                  <Button variant="outline" onClick={resetToDefault} className="flex-1">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset to Default
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="mt-6">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="font-display">Store Information</CardTitle>{!editingStore && (<Button variant="outline" size="sm" onClick={() => setEditingStore(true)}><Edit2 className="h-4 w-4 mr-1" /> Edit</Button>)}</CardHeader>
              <CardContent className="space-y-4">
                {editingStore ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Store Name</Label><Input value={storeForm.store_name} onChange={(e) => setStoreForm({ ...storeForm, store_name: e.target.value })} /></div>
                      <div className="space-y-2"><Label>WhatsApp Number</Label><Input value={storeForm.whatsapp_number} onChange={(e) => setStoreForm({ ...storeForm, whatsapp_number: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Support Number</Label><Input value={storeForm.support_number} onChange={(e) => setStoreForm({ ...storeForm, support_number: e.target.value })} /></div>
                      <div className="space-y-2"><Label>WhatsApp Group Link</Label><Input value={storeForm.whatsapp_group} onChange={(e) => setStoreForm({ ...storeForm, whatsapp_group: e.target.value })} placeholder="Optional" /></div>
                      <div className="space-y-2"><Label>MoMo Name</Label><Input value={storeForm.momo_name} onChange={(e) => setStoreForm({ ...storeForm, momo_name: e.target.value })} /></div>
                      <div className="space-y-2"><Label>MoMo Number</Label><Input value={storeForm.momo_number} onChange={(e) => setStoreForm({ ...storeForm, momo_number: e.target.value })} /></div>
                      <div className="space-y-2"><Label>MoMo Network</Label><Input value={storeForm.momo_network} onChange={(e) => setStoreForm({ ...storeForm, momo_network: e.target.value })} placeholder="mtn / airteltigo / telecel" /></div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="hero" size="sm" onClick={saveStoreInfo} disabled={savingStore}><Save className="h-4 w-4 mr-1" /> {savingStore ? "Saving..." : "Save Changes"}</Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingStore(false)}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Store Name</p><p className="font-semibold text-foreground">{store?.store_name}</p></div>
                    <div><p className="text-muted-foreground">WhatsApp</p><p className="font-semibold text-foreground">{store?.whatsapp_number}</p></div>
                    <div><p className="text-muted-foreground">Support Number</p><p className="font-semibold text-foreground">{store?.support_number}</p></div>
                    <div><p className="text-muted-foreground">WhatsApp Group</p><p className="font-semibold text-foreground">{store?.whatsapp_group || "Not set"}</p></div>
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

      {/* Buy Data Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={(v) => { if (!v) setBuyDialogOpen(false); }}>
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
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Package</span><span className="font-semibold text-foreground">{buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Phone</span><span className="font-semibold text-foreground">{buyPhone}</span></div>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between text-base font-bold"><span className="text-foreground">Agent Price</span><span className="text-primary">GH₵ {Number(buyPkg?.agent_price ?? 0).toFixed(2)}</span></div>
              </div>
              <div className="space-y-2"><Label>Payment Method</Label><Select value={buyPaymentMethod} onValueChange={(v) => setBuyPaymentMethod(v as "paystack" | "wallet")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paystack"><span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Paystack (+ charges)</span></SelectItem></SelectContent></Select></div>
              <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setBuyStep("phone")} disabled={buyLoading}>Back</Button><Button variant="hero" className="flex-1" onClick={handleBuyConfirm} disabled={buyLoading}>{buyLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Processing...</> : "Confirm Purchase"}</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentDashboard;