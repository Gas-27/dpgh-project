import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Download, TrendingUp, Key, Settings, ShoppingCart, Wallet, Copy, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  size_gb_text?: string;
  price: number;
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

          // Calculate totals
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

        // Fetch user's normal wallet (from user_wallets table)
        const { data: userWalletData } = await supabase
          .from("user_wallets")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();

        if (userWalletData) {
          setNormalWallet(userWalletData.balance || 0);
        }

        // Fetch available packages
        const { data: packagesData } = await supabase
          .from("data_packages")
          .select("*")
          .eq("active", true)
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

  const generateApiKey = async () => {
    if (generatingApiKey) return;
    setGeneratingApiKey(true);
    try {
      const array = new Uint8Array(32);
      globalThis.crypto.getRandomValues(array);
      const newApiKey = 'pk_live_' + Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Fetch existing API wallet to preserve it
      const { data: existingData } = await supabase
        .from("api_users")
        .select("wallet")
        .eq("identity_id", user?.id)
        .maybeSingle();

      const existingApiWallet = existingData?.wallet || 0;

      const { data, error } = await supabase
        .from("api_users")
        .upsert({
          identity_id: user?.id,
          api_key: newApiKey,
          is_agent: false,
          is_user: true,
          wallet: existingApiWallet,
          updated_at: new Date().toISOString(),
        }, {
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
        toast({ title: "Success", description: apiKey ? "API key regenerated successfully" : "API key generated successfully", variant: "default" });
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

  const handleTopUp = async (amount: number) => {
    if (!amount || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    try {
      // Redirect to payment page with amount parameter
      window.location.href = `/checkout?amount=${amount}&type=wallet-topup`;
    } catch (err) {
      console.error("[v0] Error processing top-up:", err);
      toast({ title: "Error", description: "Failed to process top-up", variant: "destructive" });
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container pt-24 pb-12">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold text-foreground mb-2">My Dashboard</h1>
          <p className="text-muted-foreground">Manage your data, API key, and settings</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="api-key">API Key</TabsTrigger>
            <TabsTrigger value="buy-data">Buy Data</TabsTrigger>
            <TabsTrigger value="top-up">Top Up</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Data Purchased */}
              <Card className="border-cyan-500/30 bg-cyan-500/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-cyan-400" />
                    Total Data Purchased
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold text-cyan-400">{totalDataPurchased} GB</p>
                  <p className="text-xs text-muted-foreground mt-2">All time</p>
                </CardContent>
              </Card>

              {/* Total Spent */}
              <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    Total Spent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold text-green-400">GH₵ {totalSpent.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-2">All purchases</p>
                </CardContent>
              </Card>

              {/* Recent Orders Count */}
              <Card className="border-purple-500/30 bg-purple-500/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Download className="h-5 w-5 text-purple-400" />
                    Total Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold text-purple-400">{orders.length}</p>
                  <p className="text-xs text-muted-foreground mt-2">All time</p>
                </CardContent>
              </Card>
            </div>

            {/* Order History Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Recent Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No orders yet. Start by buying a package.</p>
                    <Button variant="hero" className="mt-4" onClick={() => navigate("/packages")}>
                      Buy Data
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.slice(0, 10).map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {new Date(order.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{order.customer_number}</TableCell>
                            <TableCell className="uppercase text-sm">{order.network}</TableCell>
                            <TableCell className="font-display font-bold">{order.size_gb} GB</TableCell>
                            <TableCell className="font-semibold">GH₵ {Number(order.amount).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge 
                                className={
                                  order.status === "completed" || order.status === "paid"
                                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                                    : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                                }
                              >
                                {order.status === "paid" ? "completed" : order.status}
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
          </TabsContent>

          {/* API Key Tab */}
          <TabsContent value="api-key" className="space-y-6">
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-blue-400" />
                  API Key Management
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">Use your API key to programmatically purchase data</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {apiKey ? (
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg border border-border flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-2">Your API Key</p>
                        <p className="font-mono text-sm break-all">
                          {showApiKey ? apiKey : apiKey.substring(0, 20) + '...' + apiKey.substring(apiKey.length - 10)}
                        </p>
                      </div>
                      <div className="flex gap-2">
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
                    <Button 
                      variant="outline" 
                      onClick={generateApiKey} 
                      className="w-full"
                      disabled={generatingApiKey}
                    >
                      {generatingApiKey ? "Generating..." : "Regenerate API Key"}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground mb-4">No API key yet</p>
                    <Button 
                      variant="hero" 
                      onClick={generateApiKey}
                      disabled={generatingApiKey}
                    >
                      {generatingApiKey ? "Generating..." : "Generate API Key"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Wallet Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Normal Wallet Card */}
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-blue-400" />
                    Normal Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted p-6 rounded-lg border border-border text-center">
                    <p className="text-sm text-muted-foreground mb-2">Your Balance</p>
                    <p className="font-display text-3xl font-bold text-blue-400">GH₵ {Number(normalWallet).toFixed(2)}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      const customAmount = prompt("Enter amount to top up:");
                      if (customAmount && !isNaN(Number(customAmount))) {
                        handleTopUp(Number(customAmount));
                      }
                    }}
                  >
                    Add Funds
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">Use this to purchase data packages</p>
                </CardContent>
              </Card>

              {/* API Wallet Card */}
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-yellow-400" />
                    API Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted p-6 rounded-lg border border-border text-center">
                    <p className="text-sm text-muted-foreground mb-2">Your Balance</p>
                    <p className="font-display text-3xl font-bold text-yellow-400">GH₵ {Number(apiWallet).toFixed(2)}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      const customAmount = prompt("Enter amount to top up:");
                      if (customAmount && !isNaN(Number(customAmount))) {
                        handleTopUp(Number(customAmount));
                      }
                    }}
                  >
                    Add Funds
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">Use this for API purchases</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Buy Data Tab */}
          <TabsContent value="buy-data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Available Data Packages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.length === 0 ? (
                    <p className="text-muted-foreground col-span-full text-center py-8">No packages available</p>
                  ) : (
                    packages.map((pkg) => (
                      <Card key={pkg.id} className="border-border">
                        <CardHeader>
                          <CardTitle className="text-lg">{pkg.size_gb} GB</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm text-muted-foreground capitalize">{pkg.network}</p>
                          <p className="font-display text-2xl font-bold">GH₵ {Number(pkg.price).toFixed(2)}</p>
                          <Button 
                            variant="hero" 
                            className="w-full"
                            onClick={() => navigate("/packages")}
                          >
                            Buy Now
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Up Tab */}
          <TabsContent value="top-up" className="space-y-6">
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-orange-400" />
                  Wallet Top Up
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">Add credit to your account for quick purchases</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Custom Amount Section */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Enter Custom Amount</p>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">GH₵</span>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={customTopupAmount}
                        onChange={(e) => setCustomTopupAmount(e.target.value)}
                        className="pl-10"
                        min="1"
                      />
                    </div>
                    <Button
                      variant="hero"
                      onClick={() => {
                        if (customTopupAmount) {
                          handleTopUp(Number(customTopupAmount));
                        }
                      }}
                    >
                      Top Up
                    </Button>
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Quick Top Up</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[100, 200, 500, 1000].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        className="h-16 flex flex-col items-center justify-center hover:border-orange-500/50"
                        onClick={() => {
                          setCustomTopupAmount(amount.toString());
                          handleTopUp(amount);
                        }}
                      >
                        <p className="text-sm font-bold">GH₵ {amount}</p>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    💡 Tip: Top up your wallet to get faster checkout and keep funds ready for quick purchases.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Account Information</p>
                  <div className="bg-muted p-4 rounded-lg border border-border space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-mono">{user?.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">User ID</p>
                      <p className="text-sm font-mono">{user?.id}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Account Actions</p>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      Download My Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
};

export default UserDashboard;
