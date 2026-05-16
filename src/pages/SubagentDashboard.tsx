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
  Store, Settings, LogOut, BarChart3, ShoppingCart, ArrowDownToLine, Copy,
  ExternalLink, Wallet, Loader2, Edit2, Save, Phone, Menu, Image, Bell, Palette, Percent
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import FlyerGenerator from "@/components/FlyerGenerator";

interface SubagentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  momo_number: string;
  momo_name: string;
  momo_network: string;
  wallet_balance: number;
  approved: boolean;
  agent_store_id: string;
  created_at: string;
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

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

const SubagentDashboard = () => {
  const { signOut, user, isSubagent } = useAuth();
  const { toast } = useToast();

  const [subagentStore, setSubagentStore] = useState<SubagentStore | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [storeForm, setStoreForm] = useState<Partial<SubagentStore>>({});
  const [saving, setSaving] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [packages, setPackages] = useState<any[]>([]);
  const [subagentPrices, setSubagentPrices] = useState<Record<string, number>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [markupPercent, setMarkupPercent] = useState("");
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [savingPrices, setSavingPrices] = useState(false);

  useEffect(() => {
    if (!isSubagent) return;
    fetchData();
  }, [isSubagent, user?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;

      // Fetch subagent store
      const { data: store, error: storeErr } = await supabase
        .from("subagent_stores")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (storeErr) throw storeErr;
      setSubagentStore(store);
      setStoreForm(store);

      if (!store?.id) return;

      // Fetch orders
      const { data: ordersList } = await supabase
        .from("orders")
        .select("*")
        .eq("subagent_store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setOrders(ordersList || []);

      // Fetch withdrawal requests
      const { data: withdrawList } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("subagent_store_id", store.id)
        .order("created_at", { ascending: false });
      setWithdrawals(withdrawList || []);

      // Fetch packages
      const { data: pkgList } = await supabase
        .from("data_packages")
        .select("*")
        .eq("active", true)
        .order("size_gb");
      setPackages(pkgList || []);

      // Fetch subagent prices
      const { data: pricesList } = await supabase
        .from("agent_package_prices")
        .select("package_id, sell_price")
        .eq("agent_store_id", store.agent_store_id);
      
      if (pricesList) {
        const priceMap: Record<string, number> = {};
        pricesList.forEach((p: any) => {
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
      const { error } = await supabase
        .from("subagent_stores")
        .update({
          store_name: storeForm.store_name,
          whatsapp_number: storeForm.whatsapp_number,
          support_number: storeForm.support_number,
        })
        .eq("id", subagentStore?.id);

      if (error) throw error;
      setSubagentStore(prev => prev ? { ...prev, ...storeForm } : null);
      setEditingStore(false);
      toast({ title: "✅ Store updated successfully" });
    } catch (error) {
      console.error("Error saving store:", error);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!withdrawAmount || !subagentStore) return;
    try {
      const amount = parseFloat(withdrawAmount);
      if (amount > (subagentStore.wallet_balance || 0)) {
        toast({ title: "Error", description: "Insufficient wallet balance", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("withdrawal_requests")
        .insert({
          subagent_store_id: subagentStore.id,
          amount,
          status: "pending"
        });

      if (error) throw error;
      toast({ title: "✅ Withdrawal request submitted" });
      setWithdrawAmount("");
      fetchData();
    } catch (error) {
      console.error("Error requesting withdrawal:", error);
      toast({ title: "Error", description: "Failed to submit withdrawal request", variant: "destructive" });
    }
  };

  const filteredPackages = packages.filter(p => p.network === networkFilter);

  const handlePriceChange = (packageId: string, value: string) => {
    setEditedPrices(prev => ({
      ...prev,
      [packageId]: parseFloat(value) || 0
    }));
  };

  const applyMarkup = () => {
    if (!markupPercent) {
      toast({ title: "Error", description: "Enter a markup percentage", variant: "destructive" });
      return;
    }

    const markup = parseFloat(markupPercent) / 100;
    const networkName = networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel";
    
    filteredPackages.forEach(pkg => {
      const basePrice = subagentPrices[pkg.id] || pkg.price || 0;
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
    try {
      setSavingPrices(true);
      
      for (const [packageId, price] of Object.entries(editedPrices)) {
        const { error } = await supabase
          .from("subagent_package_prices")
          .upsert(
            {
              subagent_store_id: subagentStore?.id,
              package_id: packageId,
              sell_price: price
            },
            { onConflict: "subagent_store_id,package_id" }
          );

        if (error) throw error;
      }

      setEditedPrices({});
      setMarkupPercent("");
      toast({ title: "Success", description: "Prices saved successfully" });
    } catch (error) {
      console.error("Error saving prices:", error);
      toast({ title: "Error", description: "Failed to save prices", variant: "destructive" });
    } finally {
      setSavingPrices(false);
    }
  };

  if (!isSubagent) {
    return <Navigate to="/" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subagentStore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="border-border w-96">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">No subagent store found. Please complete your registration.</p>
            <Button variant="hero" asChild>
              <Link to="/">Go Home</Link>
            </Button>
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
    { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
    { id: "flyer", label: "Flyer Generator", icon: Image },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const totalRevenue = orders.reduce((sum, order) => sum + (order.status === "completed" ? order.amount : 0), 0);
  const pendingOrders = orders.filter(o => o.status !== "completed").length;
  const storeUrl = `${window.location.origin}/subagent/${subagentStore.id}`;

  const copyStoreLink = async () => {
    await navigator.clipboard.writeText(storeUrl);
    toast({ title: "✅ Store link copied!" });
  };

  return (
    <div className="min-h-screen bg-background">
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
            <SheetContent side="left" className="w-64 p-4 bg-card border-r border-border">
              <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" /> Menu
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-2">
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
              <p className="text-sm font-semibold text-foreground">Your Subagent Store</p>
              <p className="text-xs text-muted-foreground">{storeUrl}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyStoreLink}>
                <Copy className="h-4 w-4 mr-1" /> Copy Link
              </Button>
              <Button variant="hero" size="sm" asChild>
                <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Visit Store
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="hidden" />

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-border">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Wallet Balance</p>
                    <p className="text-3xl font-bold text-primary mt-2">GH₵{(subagentStore?.wallet_balance || 0).toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-3xl font-bold text-green-500 mt-2">GH₵{totalRevenue.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Pending Orders</p>
                    <p className="text-3xl font-bold text-orange-500 mt-2">{pendingOrders}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader>
                <CardTitle>Store Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Approval Status</span>
                  <Badge variant={subagentStore.approved ? "default" : "secondary"}>
                    {subagentStore.approved ? "✅ Approved" : "⏳ Pending Approval"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Member Since</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(subagentStore.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUY DATA */}
          <TabsContent value="buy" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Buy Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Purchase data bundles to resell in your store. Contact support for bulk ordering.</p>
                <Button className="mt-4">Coming Soon</Button>
              </CardContent>
            </Card>
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
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.slice(0, 10).map(order => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">{order.customer_number}</TableCell>
                            <TableCell>{order.network.toUpperCase()}</TableCell>
                            <TableCell>{order.size_gb}GB</TableCell>
                            <TableCell className="font-semibold">GH₵{order.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={order.fulfillment_status === "delivered" ? "default" : "secondary"}>
                                {order.fulfillment_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString()}
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

          {/* WITHDRAW */}
          <TabsContent value="withdraw" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Request Withdrawal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-400">Available Balance: <span className="font-bold">GH₵{(subagentStore?.wallet_balance || 0).toFixed(2)}</span></p>
                </div>
                <div className="space-y-2">
                  <Label>Amount to Withdraw</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleRequestWithdrawal}>
                  Request Withdrawal
                </Button>
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
                          <p className="font-medium">GH₵{w.amount.toFixed(2)}</p>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2 flex-wrap">{["mtn", "airteltigo", "telecel"].map(net => (<Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>{net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}</Button>))}</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Markup:</span>
                <Input type="number" placeholder="+10" value={markupPercent} onChange={e => setMarkupPercent(e.target.value)} className="w-20 h-8 text-sm" />
                <Button variant="outline" size="sm" onClick={applyMarkup}><Percent className="h-3 w-3 mr-1" /> Apply</Button>
              </div>
              {Object.keys(editedPrices).length > 0 && <Button variant="hero" size="sm" onClick={savePrices} disabled={savingPrices}><Save className="h-4 w-4 mr-1" />{savingPrices ? "Saving..." : "Save Prices"}</Button>}
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
              <p className="font-semibold">USE Markup if you feel lazy and do not want to edit each GB price one by one <br></br>💡 Markup Explanation(Remember to click save after applying markup</p>
              <p className="text-xs text-muted-foreground">Markup changes all your selling price for the selected network based on the percentage you want all the prices to be increase by .Markup is applied to the <strong>Base Price</strong> (agent&apos;s base price). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"}</strong>).</p>
            </div>
            <p className="text-sm text-muted-foreground">Your profit = Your Selling Price - Base Price. Use markup to increase all prices by a % (based on base price).</p>
            <Card className="border-border"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Size</TableHead><TableHead>Agent Base Price</TableHead><TableHead>Your Selling Price</TableHead><TableHead>Profit</TableHead></TableRow></TableHeader>
              <TableBody>{filteredPackages.map(pkg => { const cur = editedPrices[pkg.id] ?? subagentPrices[pkg.id] ?? pkg.price; const profit = cur - (subagentPrices[pkg.id] || pkg.price || 0); return (<TableRow key={pkg.id}><TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell><TableCell className="text-muted-foreground">GH₵ {Number(subagentPrices[pkg.id] || pkg.price).toFixed(2)}</TableCell><TableCell><Input type="number" step="0.01" value={cur} onChange={e => handlePriceChange(pkg.id, e.target.value)} className="w-24 h-8" /></TableCell><TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>GH₵ {profit.toFixed(2)}</TableCell></TableRow>); })}</TableBody></Table></div></Card>
          </TabsContent>

          {/* APPEARANCE */}
          <TabsContent value="appearance" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Store Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-400">Store appearance settings are the same as your store information. Edit your store name and contact details in the Settings tab.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Store Name</Label>
                    <p className="text-foreground">{subagentStore?.store_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">WhatsApp Number</Label>
                    <p className="text-foreground">{subagentStore?.whatsapp_number}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTIFICATIONS */}
          <TabsContent value="notifications" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">New Orders</p>
                      <p className="text-xs text-muted-foreground">Get notified when customers place orders</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">Order Completed</p>
                      <p className="text-xs text-muted-foreground">Get notified when orders are completed</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">Withdrawal Updates</p>
                      <p className="text-xs text-muted-foreground">Get notified about withdrawal requests</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5" />
                  </div>
                </div>
                <Button className="w-full">Save Notification Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FLYER GENERATOR */}
          <TabsContent value="flyer" className="mt-0 space-y-6">
            {subagentStore && (
              <FlyerGenerator
                storeName={subagentStore.store_name}
                storeId={subagentStore.id}
                whatsappNumber={subagentStore.whatsapp_number}
                supportNumber={subagentStore.support_number}
              />
            )}
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-0 space-y-6">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Store Information</CardTitle>
                {!editingStore && (
                  <Button variant="outline" size="sm" onClick={() => setEditingStore(true)}>
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
