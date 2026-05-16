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
import { Switch } from "@/components/ui/switch";
import {
  Store, Wifi, Settings, ExternalLink, Copy, BarChart3, ShoppingCart, Save,
  LogOut, Zap, Edit2, Wallet, Phone, CreditCard, Loader2, ArrowDownToLine,
  TrendingUp, Search, Bell, Plus, Trash2, LayoutGrid, Coins, Menu,
  ChevronDown, ChevronUp, BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NotificationPopup from "@/components/NotificationPopup";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";

interface SubagentStore {
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
  agent_store_id: string;
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

const DEFAULT_THEME = {
  primary: "#38bdf8",
  primary_foreground: "#000000",
  background: "#0a0a0a",
  card_background: "#171717",
  gridColumns: 2,
};

const ORDERS_PAGE_SIZE = 100;

const menuItems = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "buy", label: "Buy Data", icon: ShoppingCart },
  { id: "store", label: "Store Prices", icon: Store },
  { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
  { id: "topup", label: "Top Up", icon: Coins },
  { id: "settings", label: "Settings", icon: Settings },
];

export function SubagentDashboard() {
  const { user, isSubagent, signOut } = useAuth();
  const { toast } = useToast();

  // Redirect non-subagents
  if (!isSubagent) {
    return <Navigate to="/" />;
  }

  const [activeTab, setActiveTab] = useState("overview");
  const [subagentStore, setSubagentStore] = useState<SubagentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [profitStats, setProfitStats] = useState<ProfitStats>({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    availableForWithdrawal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<{ [key: string]: number }>({});
  const [selectedNetwork, setSelectedNetwork] = useState("mtn");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ordersOffset, setOrdersOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch subagent store
  useEffect(() => {
    const fetchSubagentStore = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("subagent_stores")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Failed to fetch subagent store:", error);
        toast({
          title: "Error",
          description: "Failed to load your subagent store",
          variant: "destructive",
        });
        return;
      }

      setSubagentStore(data);
    };

    fetchSubagentStore();
  }, [user, toast]);

  // Fetch packages and prices
  useEffect(() => {
    const fetchPackagesAndPrices = async () => {
      if (!user || !subagentStore) return;

      // Fetch packages
      const { data: packagesData, error: packagesError } = await supabase
        .from("data_packages")
        .select("*")
        .eq("active", true);

      if (packagesError) {
        console.error("Failed to fetch packages:", packagesError);
        return;
      }

      setPackages(packagesData || []);

      // Fetch subagent prices
      const { data: pricesData, error: pricesError } = await supabase
        .from("subagent_package_prices")
        .select("*")
        .eq("subagent_store_id", subagentStore.id);

      if (pricesError) {
        console.error("Failed to fetch prices:", pricesError);
        return;
      }

      const pricesMap: { [key: string]: number } = {};
      (pricesData || []).forEach((price) => {
        pricesMap[price.package_id] = price.sell_price;
      });
      setPrices(pricesMap);
    };

    fetchPackagesAndPrices();
  }, [user, subagentStore]);

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!subagentStore) return;

      let query = supabase
        .from("orders")
        .select("*")
        .eq("subagent_store_id", subagentStore.id)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(
          `customer_number.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query
        .range(ordersOffset, ordersOffset + ORDERS_PAGE_SIZE - 1);

      if (error) {
        console.error("Failed to fetch orders:", error);
        return;
      }

      if (ordersOffset === 0) {
        setOrders(data || []);
      } else {
        setOrders((prev) => [...prev, ...(data || [])]);
      }

      // Calculate stats
      const totalRevenue = (data || []).reduce(
        (sum, order) => sum + (order.status === "completed" ? order.amount : 0),
        0
      );

      const totalCost = (data || []).reduce((sum, order) => {
        const pkg = packages.find((p) => p.id === order.package_id);
        return sum + (order.status === "completed" ? (pkg?.agent_price || 0) : 0);
      }, 0);

      setProfitStats({
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        availableForWithdrawal: subagentStore.wallet_balance,
      });

      setLoading(false);
    };

    fetchOrders();
  }, [subagentStore, searchQuery, ordersOffset, packages]);

  // Fetch withdrawals
  useEffect(() => {
    const fetchWithdrawals = async () => {
      if (!subagentStore) return;

      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("subagent_store_id", subagentStore.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch withdrawals:", error);
        return;
      }

      setWithdrawals(data || []);
    };

    fetchWithdrawals();
  }, [subagentStore]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subagentStore || !withdrawAmount) {
      toast({
        title: "Error",
        description: "Please enter an amount",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(withdrawAmount);

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amount < 10) {
      toast({
        title: "Error",
        description: "Minimum withdrawal is GH₵ 10.00",
        variant: "destructive",
      });
      return;
    }

    if (amount > subagentStore.wallet_balance) {
      toast({
        title: "Error",
        description: "Insufficient balance",
        variant: "destructive",
      });
      return;
    }

    setIsWithdrawing(true);

    try {
      const { error } = await supabase
        .from("withdrawal_requests")
        .insert({
          subagent_store_id: subagentStore.id,
          amount,
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Withdrawal request submitted successfully",
      });

      setWithdrawAmount("");
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast({
        title: "Error",
        description: "Failed to process withdrawal",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading && !subagentStore) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!subagentStore) {
    return <Navigate to="/subagent/setup" />;
  }

  const networkPackages = packages.filter((p) => p.network === selectedNetwork);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Mobile Header */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <div className="md:hidden flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
          <h1 className="font-bold text-cyan-400">{subagentStore.store_name}</h1>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
        </div>
        <SheetContent side="left" className="w-64 bg-gray-900">
          <SheetHeader>
            <SheetTitle className="text-cyan-400">Menu</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 mt-4">
            {menuItems.map((item) => (
              <SheetClose key={item.id} asChild>
                <Button
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab(item.id)}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Button>
              </SheetClose>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start text-red-400 hover:text-red-300"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex flex-col w-64 bg-gray-900 min-h-screen border-r border-gray-800 p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-cyan-400">
              {subagentStore.store_name}
            </h1>
            <p className="text-sm text-gray-400 mt-2">Subagent Dashboard</p>
          </div>

          <nav className="space-y-2 flex-1">
            {menuItems.map((item) => (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab(item.id)}
              >
                <item.icon className="w-4 h-4 mr-2" />
                {item.label}
              </Button>
            ))}
          </nav>

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Top Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-900 border-b border-gray-800">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-400">
                  GH₵{profitStats.totalRevenue.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  GH₵{profitStats.totalProfit.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Wallet Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-400">
                  GH₵{subagentStore.wallet_balance.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-400">
                  {orders.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Input
                      placeholder="Search by phone number or order ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setOrdersOffset(0);
                      }}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-700">
                          <TableHead>Phone</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-gray-400">
                              No orders yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          orders.map((order) => (
                            <TableRow key={order.id} className="border-gray-700">
                              <TableCell>{order.customer_number}</TableCell>
                              <TableCell className="uppercase">{order.network}</TableCell>
                              <TableCell>{order.size_gb}GB</TableCell>
                              <TableCell>GH₵{order.amount.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    order.status === "completed"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {order.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(order.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {orders.length >= ORDERS_PAGE_SIZE && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() =>
                        setOrdersOffset((prev) => prev + ORDERS_PAGE_SIZE)
                      }
                    >
                      Load More Orders
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Store Prices Tab */}
            <TabsContent value="store" className="space-y-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Manage Store Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {["mtn", "airteltigo", "telecel"].map((network) => (
                      <Button
                        key={network}
                        variant={
                          selectedNetwork === network ? "default" : "outline"
                        }
                        className="capitalize"
                        onClick={() => setSelectedNetwork(network)}
                      >
                        {network === "airteltigo" ? "AirtelTigo" : network.toUpperCase()}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {networkPackages.map((pkg) => (
                      <div key={pkg.id} className="border border-gray-700 rounded-lg p-4">
                        <div className="flex justify-between mb-2">
                          <span className="font-medium">{pkg.size_gb}GB</span>
                          <span className="text-xs text-gray-400">
                            Base: GH₵{pkg.agent_price.toFixed(2)}
                          </span>
                        </div>
                        <Input
                          type="number"
                          placeholder="Enter selling price"
                          value={prices[pkg.id] || ""}
                          onChange={(e) =>
                            setPrices({
                              ...prices,
                              [pkg.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                    ))}
                  </div>

                  <Button className="mt-6 w-full">
                    <Save className="w-4 h-4 mr-2" />
                    Save Prices
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Withdraw Tab */}
            <TabsContent value="withdraw" className="space-y-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Withdraw Funds</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-300">MoMo Account</Label>
                    <div className="mt-2 p-3 bg-gray-700 rounded border border-gray-600">
                      <p className="text-sm">
                        {subagentStore.momo_name} ({subagentStore.momo_network})
                      </p>
                      <p className="text-sm font-mono mt-1">
                        {subagentStore.momo_number}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300">Available Balance</Label>
                    <p className="text-2xl font-bold text-yellow-400 mt-2">
                      GH₵{subagentStore.wallet_balance.toFixed(2)}
                    </p>
                  </div>

                  <form onSubmit={handleWithdraw} className="space-y-4">
                    <div>
                      <Label htmlFor="amount" className="text-gray-300">
                        Amount (Minimum: GH₵ 10.00)
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter amount"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        min="10"
                        step="0.01"
                        className="mt-2 bg-gray-700 border-gray-600 text-white"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isWithdrawing}
                      className="w-full"
                    >
                      {isWithdrawing && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Request Withdrawal
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Withdrawal History</CardTitle>
                </CardHeader>
                <CardContent>
                  {withdrawals.length === 0 ? (
                    <p className="text-gray-400">No withdrawal requests yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-700">
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withdrawals.map((w) => (
                          <TableRow key={w.id} className="border-gray-700">
                            <TableCell>GH₵{w.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  w.status === "completed"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {w.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(w.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Store Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-300">Store Name</Label>
                    <p className="mt-2 text-white">{subagentStore.store_name}</p>
                  </div>

                  <div>
                    <Label className="text-gray-300">WhatsApp Number</Label>
                    <p className="mt-2 text-white">{subagentStore.whatsapp_number}</p>
                  </div>

                  <div>
                    <Label className="text-gray-300">Support Number</Label>
                    <p className="mt-2 text-white">{subagentStore.support_number}</p>
                  </div>

                  <div>
                    <Label className="text-gray-300">MoMo Details</Label>
                    <p className="mt-2 text-white">
                      {subagentStore.momo_number} ({subagentStore.momo_name})
                    </p>
                  </div>

                  <div>
                    <Label className="text-gray-300">Approved Status</Label>
                    <Badge
                      className="mt-2"
                      variant={subagentStore.approved ? "default" : "secondary"}
                    >
                      {subagentStore.approved ? "Approved" : "Pending Approval"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <NotificationPopup />
    </div>
  );
}

export default SubagentDashboard;
