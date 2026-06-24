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
import { Loader2, Package, Download, TrendingUp, Key, Settings, ShoppingCart, Wallet, Copy, Eye, EyeOff, Phone, CreditCard } from "lucide-react";
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
          .select("balance, topup_reference")
          .eq("user_id", user.id)
          .maybeSingle();

        if (userWalletData) {
          setNormalWallet(userWalletData.balance || 0);
        }

        // Check if user is a customer and fetch topup reference from customers table
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
          role: "customer",
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

  const detectNetwork = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    // MTN: 024, 054, 055
    if (cleaned.startsWith("024") || cleaned.startsWith("054") || cleaned.startsWith("055")) return "mtn";
    // AirtelTigo: 027, 057
    if (cleaned.startsWith("027") || cleaned.startsWith("057")) return "airteltigo";
    // Telecel: 020, 026, 056
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

        // Deduct from wallet and create order
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
            {/* Top-up Reference Card */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="text-base">Your Top-up Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Use this reference when making top-ups to your account</p>
                <div className="bg-muted p-4 rounded-lg border border-border">
                  <p className="font-display text-2xl font-bold text-primary">{topupReference || "Loading..."}</p>
                </div>
              </CardContent>
            </Card>

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

            {/* API Key Warning */}
            <Card className="border-red-500/50 bg-red-500/10">
              <CardHeader>
                <CardTitle className="text-base text-red-500">⚠️ Important: API Key Warning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-red-400 font-semibold">
                  Only generate an API key if you have your own data website and want to connect your source to our platform.
                </p>
                <p className="text-muted-foreground">
                  API keys are for developers and businesses with their own infrastructure. If you simply want to buy data packages, you don't need an API key.
                </p>
              </CardContent>
            </Card>

            {/* What is API Section */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="text-base">What is the API?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  The API allows developers to programmatically purchase data and integrate our service into their applications or websites. If you don't have a technical team or website, you don't need to generate an API key.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                  <li>Build custom applications that buy data automatically</li>
                  <li>Integrate data purchases into your website</li>
                  <li>Automate bulk purchases for your business</li>
                </ul>
              </CardContent>
            </Card>

            {/* API Wallet Card */}
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-yellow-400" />
                  API Wallet Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-6 rounded-lg border border-border text-center">
                  <p className="text-sm text-muted-foreground mb-2">Your Balance</p>
                  <p className="font-display text-3xl font-bold text-yellow-400">GH₵ {Number(apiWallet).toFixed(2)}</p>
                </div>
                <p className="text-xs text-muted-foreground text-center">Use this wallet exclusively for API-based purchases and automated requests.</p>
                
                {/* Top Up API Wallet */}
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-semibold">Top Up API Wallet</p>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">GH₵</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        id="api-wallet-topup"
                        className="pl-12 pr-3 text-base font-semibold"
                        min="1"
                      />
                    </div>
                    <Button
                      variant="hero"
                      onClick={() => {
                        const input = (document.getElementById("api-wallet-topup") as HTMLInputElement);
                        if (input?.value) {
                          handleTopUp(Number(input.value));
                        }
                      }}
                    >
                      Top Up
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[100, 200, 500, 1000].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() => handleTopUp(amount)}
                      >
                        GH₵ {amount}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Buy Data Tab */}
          <TabsContent value="buy-data" className="space-y-4 mt-0">
            {/* Wallet Balance Card */}
            <Card className="bg-secondary/30">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <span className="font-medium">Wallet Balance:</span>
                  </div>
                  <span className="font-display text-xl font-bold text-primary">GH₵ {normalWallet.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

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

            {/* Data Packages Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {packages.filter(p => p.network === networkFilter).map((pkg) => {
                const price = Number(pkg.price || 0);
                return (
                  <Card key={pkg.id} className="border-slate-700/50 bg-slate-900/5 hover:border-slate-600/50 transition-all">
                    <CardContent>
                      <p className="font-display text-lg font-bold text-foreground">{pkg.size_gb_text || pkg.size_gb + "GB"}</p>
                      <p className="text-lg font-bold text-cyan-400">GH₵ {price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">User Price</p>
                      <Button 
                        variant="hero" 
                        size="sm" 
                        className="w-full bg-cyan-600 hover:bg-cyan-700 mt-2"
                        onClick={() => openBuyDialog(pkg)}
                      >
                        Buy Now
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Top Up Tab */}
          <TabsContent value="top-up" className="space-y-6">
            {/* Wallet Type Explanation */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="text-base">Top Up Your Normal Wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Your <strong>Normal Wallet</strong> is used to purchase data packages directly through the Buy Data section. Add funds here to start buying data immediately.
                </p>
                <p className="text-muted-foreground text-xs">
                  <strong>Note:</strong> The API Wallet is for programmatic purchases only and is topped up separately in the API section.
                </p>
              </CardContent>
            </Card>

            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-orange-400" />
                  Add Funds to Normal Wallet
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">Top up your wallet for buying data packages</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Top Up Normal Wallet Section */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Top Up Normal Wallet (Data Purchases)</p>
                  <p className="text-xs text-muted-foreground">Balance: <strong>GH₵ {normalWallet.toFixed(2)}</strong></p>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">GH₵</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={customTopupAmount}
                        onChange={(e) => setCustomTopupAmount(e.target.value)}
                        className="pl-12 pr-3 text-base font-semibold"
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[100, 200, 500, 1000].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        className="h-12"
                        onClick={() => {
                          setCustomTopupAmount(amount.toString());
                          handleTopUp(amount);
                        }}
                      >
                        GH₵ {amount}
                      </Button>
                    ))}
                  </div>
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

        {/* Buy Dialog */}
        <Dialog open={buyDialogOpen} onOpenChange={v => !v && setBuyDialogOpen(false)}>
          <DialogContent className="sm:max-w-md border-border bg-card">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Buy {buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</DialogTitle>
              <DialogDescription>Purchase data at user price</DialogDescription>
            </DialogHeader>
            {buyStep === "phone" ? (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Recipient Phone Number (exactly 10 digits)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="tel" 
                      placeholder="0XX XXX XXXX" 
                      maxLength={10} 
                      value={buyPhone} 
                      onChange={e => setBuyPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className={`pl-10 ${buyPhone.length > 0 && buyPhone.length < 10 ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      autoFocus
                    />
                  </div>
                  {buyPhone.length > 0 && buyPhone.length < 10 && (
                    <p className="text-xs text-red-500">{10 - buyPhone.length} digit{10 - buyPhone.length !== 1 ? "s" : ""} remaining</p>
                  )}
                </div>
                <Button 
                  variant="hero" 
                  className="w-full" 
                  onClick={() => {
                    if (!isValidPhoneLength(buyPhone)) {
                      toast({ title: "Phone number must be exactly 10 digits", variant: "destructive" });
                      return;
                    }
                    const detected = detectNetwork(buyPhone);
                    if (buyPkg && !phoneMatchesNetwork(buyPhone, buyPkg.network)) {
                      toast({ title: "Network mismatch", description: `This phone appears to be ${detected.toUpperCase()}, but you selected ${buyPkg.network.toUpperCase()}`, variant: "destructive" });
                      return;
                    }
                    setBuyStep("confirm");
                  }}
                >
                  Continue
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Package</span>
                    <span className="font-semibold">{buyPkg?.size_gb}GB {buyPkg?.network.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-semibold">{buyPhone}</span>
                  </div>
                  <div className="border-t border-border my-1" />
                  <div className="flex justify-between text-base font-bold">
                    <span>Price</span>
                    <span className="text-primary">GH₵ {Number(buyPkg?.price ?? 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={buyPaymentMethod} onValueChange={v => setBuyPaymentMethod(v as "paystack" | "wallet")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wallet">
                        <span className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          Wallet (GH₵ {normalWallet.toFixed(2)})
                        </span>
                      </SelectItem>
                      <SelectItem value="paystack">
                        <span className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Paystack (+ charges)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setBuyStep("phone")} disabled={buyLoading}>Back</Button>
                  <Button variant="hero" className="flex-1" onClick={handleBuyConfirm} disabled={buyLoading}>
                    {buyLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        Processing...
                      </>
                    ) : (
                      "Confirm Purchase"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Footer />
    </div>
  );
};

export default UserDashboard;
