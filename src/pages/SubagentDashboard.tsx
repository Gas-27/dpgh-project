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
  ChevronDown, ChevronUp, BookOpen, Percent,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";

// ==================== INTERFACES ====================
interface SubagentStore {
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
  parent_agent_store_id: string;
}

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
  agent_price: number;
}

interface SubagentPrice {
  id: string;
  package_id: string;
  base_cost: number;
  sell_price: number;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  customer_amount: number;
  agent_cost: number;
  profit: number;
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

// ==================== CONSTANTS ====================
const MTN_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 75];
const AIRTEL_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50];
const TELECEL_SIZES = [2, 3, 5, 10, 15, 20, 25, 30, 35, 40, 50, 100];
const ORDERS_PAGE_SIZE = 100;

const menuItems = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "store", label: "Store Prices", icon: Store },
  { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
  { id: "topup", label: "Top Up", icon: Coins },
  { id: "settings", label: "Settings", icon: Settings },
];

// ==================== MAIN COMPONENT ====================
const SubagentDashboard = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [activeMenu, setActiveMenu] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<SubagentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [prices, setPrices] = useState<Record<string, SubagentPrice>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<ProfitStats>({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    availableForWithdrawal: 0,
  });
  const [selectedNetwork, setSelectedNetwork] = useState("mtn");
  const [tempPrices, setTempPrices] = useState<Record<string, string>>({});
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [ordersOffset, setOrdersOffset] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    if (userRole !== "subagent") {
      return;
    }
    const initialize = async () => {
      try {
        setLoading(true);
        if (!user?.id) throw new Error("No user ID");

        // Fetch subagent store
        const { data: storeData, error: storeError } = await supabase
          .from("subagent_stores")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (storeError) throw storeError;
        if (!storeData) throw new Error("No store found");

        setStore(storeData as SubagentStore);

        // Fetch packages
        const { data: pkgData, error: pkgError } = await supabase
          .from("data_packages")
          .select("*")
          .eq("active", true)
          .order("network")
          .order("size_gb");

        if (pkgError) throw pkgError;
        setPackages((pkgData || []) as DataPackage[]);

        // Fetch subagent prices
        const { data: priceData, error: priceError } = await supabase
          .from("subagent_package_prices")
          .select("*")
          .eq("subagent_store_id", storeData.id);

        if (priceError) throw priceError;

        const priceMap: Record<string, SubagentPrice> = {};
        (priceData || []).forEach((p: any) => {
          priceMap[p.package_id] = p;
        });
        setPrices(priceMap);

        // Fetch stats
        await fetchStats(storeData.id);

        // Fetch orders
        await fetchOrders(storeData.id, 0);

        // Fetch withdrawal history
        const { data: withdrawalData } = await supabase
          .from("subagent_withdrawal_requests")
          .select("*")
          .eq("subagent_store_id", storeData.id)
          .order("created_at", { ascending: false });

        setWithdrawalHistory((withdrawalData || []) as WithdrawalRequest[]);
      } catch (err: any) {
        console.error("[v0] Error initializing SubagentDashboard:", err);
        toast({
          title: "Error",
          description: err.message || "Failed to load dashboard",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [user, userRole]);

  // ==================== HELPER FUNCTIONS ====================
  const fetchStats = async (storeId: string) => {
    try {
      const { data, error } = await supabase
        .from("subagent_orders")
        .select("customer_amount, agent_cost, profit, status")
        .eq("subagent_store_id", storeId);

      if (error) throw error;

      const orders = data || [];
      const completedOrders = orders.filter(o => o.status === "completed");
      
      const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.customer_amount || 0), 0);
      const totalCost = completedOrders.reduce((sum, o) => sum + (o.agent_cost || 0), 0);
      const totalProfit = completedOrders.reduce((sum, o) => sum + (o.profit || 0), 0);
      const availableForWithdrawal = (store?.wallet_balance || 0);

      setStats({
        totalRevenue,
        totalCost,
        totalProfit,
        availableForWithdrawal,
      });
    } catch (err: any) {
      console.error("[v0] Error fetching stats:", err);
    }
  };

  const fetchOrders = async (storeId: string, offset: number) => {
    try {
      setOrdersLoading(true);
      const { data, error } = await supabase
        .from("subagent_orders")
        .select("*")
        .eq("subagent_store_id", storeId)
        .order("created_at", { ascending: false })
        .range(offset, offset + ORDERS_PAGE_SIZE - 1);

      if (error) throw error;

      if (offset === 0) {
        setOrders((data || []) as Order[]);
      } else {
        setOrders(prev => [...prev, ...(data || []) as Order[]]);
      }
    } catch (err: any) {
      console.error("[v0] Error fetching orders:", err);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSavePrices = async () => {
    if (!store) return;

    try {
      setLoading(true);
      const networkPackages = packages.filter(p => p.network === selectedNetwork);

      for (const pkg of networkPackages) {
        const newPrice = tempPrices[pkg.id];
        if (!newPrice) continue;

        const parsedPrice = parseFloat(newPrice);
        if (isNaN(parsedPrice) || parsedPrice < 0) continue;

        const existing = prices[pkg.id];
        if (existing) {
          const { error } = await supabase
            .from("subagent_package_prices")
            .update({ sell_price: parsedPrice, updated_at: new Date().toISOString() })
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("subagent_package_prices")
            .insert({
              subagent_store_id: store.id,
              package_id: pkg.id,
              base_cost: pkg.agent_price,
              sell_price: parsedPrice,
            });

          if (error) throw error;
        }
      }

      // Refresh prices
      const { data: priceData } = await supabase
        .from("subagent_package_prices")
        .select("*")
        .eq("subagent_store_id", store.id);

      const priceMap: Record<string, SubagentPrice> = {};
      (priceData || []).forEach((p: any) => {
        priceMap[p.package_id] = p;
      });
      setPrices(priceMap);
      setTempPrices({});

      toast({
        title: "Success",
        description: "Prices updated successfully",
      });
    } catch (err: any) {
      console.error("[v0] Error saving prices:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to save prices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async () => {
    if (!store || !withdrawalAmount) return;

    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount < 10) {
      toast({
        title: "Error",
        description: "Minimum withdrawal is GH₵ 10.00",
        variant: "destructive",
      });
      return;
    }

    if (amount > store.wallet_balance) {
      toast({
        title: "Error",
        description: "Insufficient wallet balance",
        variant: "destructive",
      });
      return;
    }

    try {
      setWithdrawalLoading(true);
      const { error } = await supabase
        .from("subagent_withdrawal_requests")
        .insert({
          subagent_store_id: store.id,
          amount: amount,
          status: "pending",
        });

      if (error) throw error;

      // Update wallet balance
      await supabase
        .from("subagent_stores")
        .update({ wallet_balance: store.wallet_balance - amount })
        .eq("id", store.id);

      setWithdrawalAmount("");
      setStore({ ...store, wallet_balance: store.wallet_balance - amount });

      // Refresh history
      const { data: withdrawalData } = await supabase
        .from("subagent_withdrawal_requests")
        .select("*")
        .eq("subagent_store_id", store.id)
        .order("created_at", { ascending: false });

      setWithdrawalHistory((withdrawalData || []) as WithdrawalRequest[]);

      toast({
        title: "Success",
        description: "Withdrawal request submitted. Processing within 24 hours.",
      });
    } catch (err: any) {
      console.error("[v0] Error submitting withdrawal:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to submit withdrawal",
        variant: "destructive",
      });
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.customer_number.includes(searchQuery) || order.id.includes(searchQuery)
  );

  const networkPackages = packages.filter(p => p.network === selectedNetwork);

  if (!user || userRole !== "subagent") {
    return <Navigate to="/login" />;
  }

  if (loading && !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-semibold text-lg">Loading Dashboard...</div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Store Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Your subagent store could not be loaded. Please contact your agent.
            </p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">{store.store_name}</span>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-sm">
              <p className="text-muted-foreground">Wallet Balance</p>
              <p className="font-bold text-lg">GH₵ {store.wallet_balance.toFixed(2)}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">Dashboard</Link>
            </Button>
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="space-y-4 mt-8">
                {menuItems.map(item => (
                  <Button
                    key={item.id}
                    variant={activeMenu === item.id ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => {
                      setActiveMenu(item.id);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:block w-64 border-r border-border bg-card p-4 min-h-screen sticky top-16">
          <div className="space-y-2">
            {menuItems.map(item => (
              <Button
                key={item.id}
                variant={activeMenu === item.id ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveMenu(item.id)}
              >
                <item.icon className="w-4 h-4 mr-2" />
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6">
          {/* Overview */}
          {activeMenu === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{orders.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">GH₵ {stats.totalRevenue.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">GH₵ {stats.totalProfit.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Available Withdrawal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">GH₵ {store.wallet_balance.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Orders */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex gap-2">
                    <Input
                      placeholder="Search by phone or order ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Profit</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.slice(0, 20).map(order => (
                          <TableRow key={order.id}>
                            <TableCell className="text-xs">
                              {new Date(order.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs">{order.customer_number}</TableCell>
                            <TableCell className="text-xs">{order.network.toUpperCase()}</TableCell>
                            <TableCell className="text-xs">GH₵ {order.customer_amount.toFixed(2)}</TableCell>
                            <TableCell className="text-xs font-semibold text-green-600">
                              GH₵ {order.profit.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={order.status === "completed" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {filteredOrders.length > 20 && (
                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      onClick={() => {
                        setOrdersOffset(ordersOffset + ORDERS_PAGE_SIZE);
                        fetchOrders(store.id, ordersOffset + ORDERS_PAGE_SIZE);
                      }}
                      disabled={ordersLoading}
                    >
                      {ordersLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Load More
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Store Prices */}
          {activeMenu === "store" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Set Your Prices</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Select Network</Label>
                    <Tabs value={selectedNetwork} onValueChange={setSelectedNetwork}>
                      <TabsList>
                        <TabsTrigger value="mtn">MTN</TabsTrigger>
                        <TabsTrigger value="airteltigo">AirtelTigo</TabsTrigger>
                        <TabsTrigger value="telecel">Telecel</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {networkPackages.map(pkg => {
                      const price = prices[pkg.id];
                      const currentPrice = tempPrices[pkg.id] || (price?.sell_price?.toString() || "");
                      const baseCost = price?.base_cost || pkg.agent_price;
                      const sellPrice = parseFloat(currentPrice || "0");
                      const profit = sellPrice - baseCost;

                      return (
                        <div key={pkg.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-semibold">{pkg.size_gb}GB</p>
                              <p className="text-xs text-muted-foreground">
                                Agent Cost: GH₵ {baseCost.toFixed(2)}
                              </p>
                            </div>
                            <Badge variant="secondary">Your Price</Badge>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={baseCost.toFixed(2)}
                            value={currentPrice}
                            onChange={(e) =>
                              setTempPrices({ ...tempPrices, [pkg.id]: e.target.value })
                            }
                            min={baseCost}
                            className="mb-2"
                          />
                          {currentPrice && (
                            <div className="text-xs">
                              <p className="text-muted-foreground">
                                Profit per sale: <span className="font-semibold text-green-600">
                                  GH₵ {profit.toFixed(2)}
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSavePrices}
                    disabled={loading || Object.keys(tempPrices).length === 0}
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Prices
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Withdraw */}
          {activeMenu === "withdraw" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Withdraw Profit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Current Balance</p>
                    <p className="text-3xl font-bold">GH₵ {store.wallet_balance.toFixed(2)}</p>
                  </div>

                  <div className="border-t pt-4">
                    <Label>MoMo Details (for verification)</Label>
                    <div className="mt-3 text-sm space-y-1 bg-muted p-3 rounded">
                      <p>
                        <span className="font-semibold">{store.momo_name}</span>
                      </p>
                      <p className="text-muted-foreground">
                        {store.momo_network.toUpperCase()} • {store.momo_number}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="withdrawal-amount">Withdrawal Amount (Min: GH₵ 10.00)</Label>
                    <Input
                      id="withdrawal-amount"
                      type="number"
                      step="0.01"
                      placeholder="Enter amount..."
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      min="10"
                      max={store.wallet_balance}
                      className="mt-2"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleWithdrawal}
                    disabled={withdrawalLoading || !withdrawalAmount}
                  >
                    {withdrawalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Request Withdrawal
                  </Button>
                </CardContent>
              </Card>

              {/* Withdrawal History */}
              <Card>
                <CardHeader>
                  <CardTitle>Withdrawal History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawalHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No withdrawals yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        withdrawalHistory.map(wr => (
                          <TableRow key={wr.id}>
                            <TableCell className="text-xs">
                              {new Date(wr.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-semibold">GH₵ {wr.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  wr.status === "approved"
                                    ? "default"
                                    : wr.status === "rejected"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {wr.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Top Up */}
          {activeMenu === "topup" && (
            <Card>
              <CardHeader>
                <CardTitle>Top Up Wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                  <p className="font-semibold mb-2">Steps to Top Up:</p>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Dial <span className="font-mono bg-muted px-1">*170#</span> on your MTN MoMo phone</li>
                    <li>Select Transfer Money → MoMo User</li>
                    <li>Enter recipient: <span className="font-semibold">{store.momo_number}</span></li>
                    <li>Enter amount you want to top up</li>
                    <li>Use your reference code: <span className="font-mono font-bold bg-yellow-100 px-1">{store.topup_reference}</span></li>
                    <li>Send transaction ID to admin via WhatsApp</li>
                    <li>Your wallet will be credited after admin verification</li>
                  </ol>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-amber-900">
                    ⚠️ Important: Always include your reference code or your wallet won't be credited!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settings */}
          {activeMenu === "settings" && (
            <Card>
              <CardHeader>
                <CardTitle>Store Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Store Name</Label>
                    <p className="font-semibold">{store.store_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">WhatsApp Number</Label>
                    <p className="font-semibold">{store.whatsapp_number}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Support Number</Label>
                    <p className="font-semibold">{store.support_number}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">MoMo Account</Label>
                    <p className="font-semibold">
                      {store.momo_name} ({store.momo_network.toUpperCase()})
                    </p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    To update your settings, please contact your parent agent.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubagentDashboard;
