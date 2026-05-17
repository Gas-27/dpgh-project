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
  ExternalLink, Wallet, Loader2, Edit2, Save, Phone, Menu, Image, Bell, Palette, Percent,
  ChevronUp, ChevronDown, BookOpen, Search, TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import FlyerGenerator from "@/components/FlyerGenerator";
import { DOMAINS } from "@/config/domains";

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

// Instruction manual sections
const MANUAL_SECTIONS = [
  { icon: "📊", title: "Overview", content: `Your dashboard home. See wallet balance, total revenue, pending orders, and store status at a glance.\n\n• Wallet Balance – funds available to withdraw\n• Total Revenue – sum of all completed orders\n• Pending Orders – orders awaiting fulfillment` },
  { icon: "🛒", title: "Buy Data", content: `Purchase data bundles at your agent's base price to resell in your store.\n\n• Select network (MTN, AirtelTigo, Telecel)\n• Choose package size\n• Enter customer number\n• Confirm purchase` },
  { icon: "💰", title: "Store Prices", content: `Set your selling prices for each data package.\n\n• Base Price = price your agent gives you\n• Your Selling Price = what customers pay\n• Profit = Selling Price - Base Price\n\nUse markup to increase all prices by a percentage.` },
  { icon: "📦", title: "Orders", content: `View all customer orders.\n\n• Track order status (pending, completed, failed)\n• See customer details and amounts\n• Monitor your sales history` },
  { icon: "💸", title: "Withdraw", content: `Cash out your wallet balance to your MoMo account.\n\n• Minimum withdrawal: GH₵ 10.00\n• Only one pending withdrawal at a time\n• Processed within 24 hours` },
  { icon: "🎨", title: "Flyer Generator", content: `Create promotional flyers for your store.\n\n• Customize colors and design\n• Add your store name and contact\n• Download or share to WhatsApp` },
  { icon: "🎨", title: "Appearance", content: `Customize your store appearance.\n\n• Change primary color\n• Update store banner\n• Modify theme settings` },
  { icon: "⚙️", title: "Settings", content: `Manage your store information.\n\n• Store Name\n• WhatsApp Number\n• Support Number` },
];

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
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [basePrices, setBasePrices] = useState<Record<string, number>>({});
  const [subagentPrices, setSubagentPrices] = useState<Record<string, number>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [markupPercent, setMarkupPercent] = useState("");
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [savingPrices, setSavingPrices] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [openManualSection, setOpenManualSection] = useState<number | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [buyingPkg, setBuyingPkg] = useState<any>(null);
  const [buyCustomerNumber, setBuyCustomerNumber] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);

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

      // Fetch base prices from parent agent
      const { data: agentPricesList } = await supabase
        .from("agent_package_prices")
        .select("package_id, sell_price")
        .eq("agent_store_id", store.agent_store_id);
      
      if (agentPricesList) {
        const priceMap: Record<string, number> = {};
        agentPricesList.forEach((p: any) => {
          priceMap[p.package_id] = p.sell_price;
        });
        setBasePrices(priceMap);
      }

      // Fetch subagent's own selling prices
      const { data: subagentPricesList } = await supabase
        .from("subagent_package_prices")
        .select("package_id, sell_price")
        .eq("subagent_store_id", store.id);
      
      if (subagentPricesList) {
        const priceMap: Record<string, number> = {};
        subagentPricesList.forEach((p: any) => {
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
    
    const amount = parseFloat(withdrawAmount);
    
    // Validate minimum withdrawal
    if (amount < 10) {
      toast({ title: "Error", description: "Minimum withdrawal is GH₵ 10.00", variant: "destructive" });
      return;
    }
    
    // Check for pending withdrawal
    const hasPending = withdrawals.some(w => w.status === "pending");
    if (hasPending) {
      toast({ title: "Error", description: "You already have a pending withdrawal. Please wait until it completes.", variant: "destructive" });
      return;
    }
    
    if (amount > (subagentStore.wallet_balance || 0)) {
      toast({ title: "Error", description: "Insufficient wallet balance", variant: "destructive" });
      return;
    }

    try {
      setWithdrawLoading(true);
      const { error } = await supabase
        .from("withdrawal_requests")
        .insert({
          subagent_store_id: subagentStore.id,
          amount,
          status: "pending"
        });

      if (error) throw error;
      toast({ title: "Success", description: "Withdrawal request submitted successfully" });
      setWithdrawAmount("");
      fetchData();
    } catch (error) {
      console.error("Error requesting withdrawal:", error);
      toast({ title: "Error", description: "Failed to submit withdrawal request", variant: "destructive" });
    } finally {
      setWithdrawLoading(false);
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
    try {
      setSavingPrices(true);

      // Validate that no price is below agent's base price
      for (const [packageId, price] of Object.entries(editedPrices)) {
        const basePrice = basePrices[packageId] || 0;
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

  const handleBuyData = async () => {
    if (!buyingPkg || !buyCustomerNumber || !subagentStore) return;
    
    const price = basePrices[buyingPkg.id] || buyingPkg.price || 0;
    
    if (price > (subagentStore.wallet_balance || 0)) {
      toast({ title: "Error", description: "Insufficient wallet balance", variant: "destructive" });
      return;
    }
    
    try {
      setBuyLoading(true);
      
      // Create order
      const { error: orderError } = await supabase.from("orders").insert({
        subagent_store_id: subagentStore.id,
        customer_number: buyCustomerNumber,
        network: buyingPkg.network,
        size_gb: buyingPkg.size_gb,
        amount: price,
        status: "pending",
        fulfillment_status: "pending"
      });
      
      if (orderError) throw orderError;
      
      // Deduct from wallet
      const { error: walletError } = await supabase
        .from("subagent_stores")
        .update({ wallet_balance: (subagentStore.wallet_balance || 0) - price })
        .eq("id", subagentStore.id);
      
      if (walletError) throw walletError;
      
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
  const totalOrders = orders.length;
  const hasPendingWithdrawal = withdrawals.some(w => w.status === "pending");
  const pendingWithdrawalAmount = withdrawals.filter(w => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);
  const storeUrl = DOMAINS.getSubagentStoreUrl(subagentStore.store_name);
  const filteredOrders = orders.filter(o => 
    o.customer_number?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.id?.toLowerCase().includes(orderSearch.toLowerCase())
  );

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
                  <p className="font-display text-2xl font-bold mt-1 text-green-400">GH₵ {totalRevenue.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Wallet & Profit Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Wallet Balance</p>
                      <p className="font-display text-2xl font-bold text-green-400 mt-1">GH₵ {(subagentStore?.wallet_balance || 0).toFixed(2)}</p>
                    </div>
                    <Wallet className="h-8 w-8 text-green-400 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Available for Withdrawal</p>
                      <p className="font-display text-2xl font-bold text-yellow-400 mt-1">GH₵ {Number(subagentStore?.wallet_balance ?? 0).toFixed(2)}</p>
                      {hasPendingWithdrawal && <p className="text-xs text-orange-400 mt-1">GH₵ {pendingWithdrawalAmount.toFixed(2)} pending withdrawal</p>}
                    </div>
                    <ArrowDownToLine className="h-8 w-8 text-yellow-400 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Orders Table */}
            <Card className="border-border">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="font-display text-lg">Recent Orders</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by number..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="pl-9" />
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
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.slice(0, 10).map(order => (
                          <TableRow key={order.id}>
                            <TableCell className="text-sm">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="font-mono text-sm">{order.customer_number}</TableCell>
                            <TableCell className="uppercase text-sm">{order.network}</TableCell>
                            <TableCell className="font-display font-bold">{order.size_gb}GB</TableCell>
                            <TableCell>GH₵ {Number(order.amount).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>
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

          {/* BUY DATA */}
          <TabsContent value="buy" className="mt-0 space-y-6">
            <Card className={`border-border ${hasPendingWithdrawal ? "border-orange-500/30 bg-orange-500/5" : "bg-secondary/30"}`}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <span className="font-medium">Wallet Balance:</span>
                  </div>
                  <span className="font-display text-xl font-bold text-primary">GH₵ {(subagentStore?.wallet_balance || 0).toFixed(2)}</span>
                </div>
                {hasPendingWithdrawal && <p className="text-xs text-orange-400">GH₵ {pendingWithdrawalAmount.toFixed(2)} reserved for pending withdrawal.</p>}
              </CardContent>
            </Card>
            <div className="flex gap-2 flex-wrap">
              {["mtn", "airteltigo", "telecel"].map(net => (
                <Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>
                  {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredPackages.map(pkg => {
                const basePrice = basePrices[pkg.id] || pkg.price || 0;
                return (
                  <Card key={pkg.id} className="border-border transition-all hover:border-primary/50">
                    <CardContent className="p-4 text-center space-y-3">
                      <p className="font-display text-xl font-bold text-foreground">{pkg.size_gb}GB</p>
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
                    <button onClick={() => { setBuyingPkg(null); setBuyCustomerNumber(""); }} className="text-muted-foreground hover:text-foreground text-2xl">×</button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="font-display text-2xl font-bold text-primary">GH₵ {Number(basePrices[buyingPkg.id] || buyingPkg.price || 0).toFixed(2)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Customer Phone Number</Label>
                      <Input
                        placeholder="e.g. 0551234567"
                        value={buyCustomerNumber}
                        onChange={e => setBuyCustomerNumber(e.target.value)}
                      />
                    </div>
                    <Button variant="hero" className="w-full" onClick={handleBuyData} disabled={buyLoading || !buyCustomerNumber}>
                      {buyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Confirm Purchase
                    </Button>
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
                <CardTitle className="font-display text-lg">Request Withdrawal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasPendingWithdrawal && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-sm text-yellow-400 font-medium">You have a pending withdrawal of GH₵ {pendingWithdrawalAmount.toFixed(2)}. Please wait until it completes before requesting another.</p>
                  </div>
                )}
                <div className="rounded-xl border border-border bg-secondary/50 p-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">MoMo Name</p>
                      <p className="font-bold">{subagentStore?.momo_name || "Not set"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">MoMo Number</p>
                      <p className="font-bold">{subagentStore?.momo_number || "Not set"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Network</p>
                      <p className="font-bold">{subagentStore?.momo_network?.toUpperCase() || "Not set"}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-400">Available Balance: <span className="font-bold">GH₵ {(subagentStore?.wallet_balance || 0).toFixed(2)}</span></p>
                </div>
                <p className="text-xs text-muted-foreground">Minimum: GH₵ 10.00. Processed within 24 hours.</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label>Amount (GH₵)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 10.00"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      disabled={hasPendingWithdrawal}
                    />
                  </div>
                  <Button variant="hero" onClick={handleRequestWithdrawal} disabled={withdrawLoading || hasPendingWithdrawal}>
                    {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />}
                    Withdraw
                  </Button>
                </div>
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
                        variant={networkFilter === net ? "hero" : "outline"} 
                        size="sm" 
                        onClick={() => setNetworkFilter(net)}
                      >
                        {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
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
                  <p className="font-semibold">USE Markup if you feel lazy and do not want to edit each GB price one by one <br />💡 Markup Explanation (Remember to click save after applying markup)</p>
                  <p className="text-xs text-muted-foreground mt-2">Markup changes all your selling price for the selected network based on the percentage you want all the prices to be increase by. Markup is applied to the <strong>Base Price</strong> (agent&apos;s base price). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"}</strong>).</p>
                </div>
                <p className="text-sm text-muted-foreground">Your profit = Your Selling Price - Base Price. Use markup to increase all prices by a % (based on base price).</p>
                <Card className="border-border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Size</TableHead>
                          <TableHead>Agent Base Price</TableHead>
                          <TableHead>Your Selling Price</TableHead>
                          <TableHead>Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPackages.length > 0 ? (
                          filteredPackages.map(pkg => {
                            const basePrice = basePrices[pkg.id] || pkg.price || 0;
                            const cur = editedPrices[pkg.id] ?? subagentPrices[pkg.id] ?? basePrice;
                            const profit = cur - basePrice;
                            const isInvalid = editedPrices[pkg.id] !== undefined && editedPrices[pkg.id] < basePrice;
                            return (
                              <TableRow key={pkg.id}>
                                <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                                <TableCell className="text-muted-foreground">
                                  GH₵ {Number(basePrice).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      min={basePrice}
                                      value={cur} 
                                      onChange={e => handlePriceChange(pkg.id, e.target.value)} 
                                      className={`w-24 h-8 ${isInvalid ? "border-red-500" : ""}`}
                                    />
                                    {isInvalid && (
                                      <p className="text-xs text-red-500">Min: GH₵ {basePrice.toFixed(2)}</p>
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
                              No packages for {networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"}
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
                storeUrl={storeUrl}
                whatsappNumber={subagentStore.whatsapp_number || ""}
                supportNumber={subagentStore.support_number || ""}
                packages={packages}
                agentPrices={subagentPrices}
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
