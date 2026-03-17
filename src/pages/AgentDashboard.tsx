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
import { Store, Wifi, Settings, ExternalLink, Copy, BarChart3, ShoppingCart, Save, LogOut, Zap, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
}

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
  agent_price: number;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  status: string;
  created_at: string;
}

const AgentDashboard = () => {
  const { user, isAgent, isAdmin, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [store, setStore] = useState<AgentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [agentPrices, setAgentPrices] = useState<Record<string, number>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [savingPrices, setSavingPrices] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [storeForm, setStoreForm] = useState({
    store_name: "",
    whatsapp_number: "",
    support_number: "",
    whatsapp_group: "",
    momo_number: "",
    momo_name: "",
    momo_network: "",
  });
  const [savingStore, setSavingStore] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: storeData } = await supabase
        .from("agent_stores")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setStore(storeData);

      if (storeData) {
        setStoreForm({
          store_name: storeData.store_name,
          whatsapp_number: storeData.whatsapp_number,
          support_number: storeData.support_number,
          whatsapp_group: storeData.whatsapp_group || "",
          momo_number: storeData.momo_number,
          momo_name: storeData.momo_name,
          momo_network: storeData.momo_network,
        });

        const [pkgRes, priceRes, orderRes] = await Promise.all([
          supabase.from("data_packages").select("*").eq("active", true).order("size_gb"),
          supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", storeData.id),
          supabase.from("orders").select("*").eq("agent_store_id", storeData.id).order("created_at", { ascending: false }).limit(50),
        ]);

        setPackages(pkgRes.data ?? []);
        const priceMap: Record<string, number> = {};
        (priceRes.data ?? []).forEach((p: any) => { priceMap[p.package_id] = p.sell_price; });
        setAgentPrices(priceMap);
        setOrders(orderRes.data ?? []);
      } else {
        const { data: pkgData } = await supabase.from("data_packages").select("*").eq("active", true).order("size_gb");
        setPackages(pkgData ?? []);
      }

      setLoading(false);
    };
    fetchData();
  }, [user]);

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

  const handlePriceChange = (pkgId: string, value: string) => {
    setEditedPrices((prev) => ({ ...prev, [pkgId]: parseFloat(value) || 0 }));
  };

  const savePrices = async () => {
    if (!store) return;
    setSavingPrices(true);
    for (const [pkgId, sellPrice] of Object.entries(editedPrices)) {
      const existing = agentPrices[pkgId];
      if (existing !== undefined) {
        await supabase.from("agent_package_prices").update({ sell_price: sellPrice })
          .eq("agent_store_id", store.id).eq("package_id", pkgId);
      } else {
        await supabase.from("agent_package_prices").insert({
          agent_store_id: store.id,
          package_id: pkgId,
          sell_price: sellPrice,
        });
      }
      setAgentPrices((prev) => ({ ...prev, [pkgId]: sellPrice }));
    }
    setEditedPrices({});
    setSavingPrices(false);
    toast({ title: "Prices saved!" });
  };

  const saveStoreInfo = async () => {
    if (!store) return;
    setSavingStore(true);
    const { error } = await supabase.from("agent_stores").update({
      store_name: storeForm.store_name,
      whatsapp_number: storeForm.whatsapp_number,
      support_number: storeForm.support_number,
      whatsapp_group: storeForm.whatsapp_group || null,
      momo_number: storeForm.momo_number,
      momo_name: storeForm.momo_name,
      momo_network: storeForm.momo_network,
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

  // Stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const totalRevenue = orders.filter((o) => o.status === "completed").reduce((sum, o) => sum + Number(o.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">
              {store?.store_name ?? "Agent Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin">Admin</Link>
              </Button>
            )}
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
        {/* Store Link Banner */}
        {store && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Your Store Website</p>
                <p className="text-xs text-muted-foreground">{storeUrl}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyStoreLink}>
                  <Copy className="h-4 w-4 mr-1" /> Copy Link
                </Button>
                <Button variant="hero" size="sm" asChild>
                  <Link to={`/store/${storeSlug}`} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-1" /> Visit Store
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-1" /> Overview
            </TabsTrigger>
            <TabsTrigger value="store">
              <Store className="h-4 w-4 mr-1" /> Store
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="h-4 w-4 mr-1" /> Orders
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-1" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <p className="font-display text-2xl font-bold mt-1 text-green-400">GH₵ {totalRevenue.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display text-lg">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">WhatsApp</p>
                  <p className="font-semibold text-foreground">{store?.whatsapp_number ?? "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Support Line</p>
                  <p className="font-semibold text-foreground">{store?.support_number ?? "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">MoMo</p>
                  <p className="font-semibold text-foreground">{store?.momo_name} • {store?.momo_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">MoMo Network</p>
                  <p className="font-semibold text-foreground">{store?.momo_network?.toUpperCase()}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STORE TAB - Customize Prices */}
          <TabsContent value="store" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {["mtn", "airteltigo", "telecel"].map((net) => (
                  <Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>
                    {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
                  </Button>
                ))}
              </div>
              {Object.keys(editedPrices).length > 0 && (
                <Button variant="hero" size="sm" onClick={savePrices} disabled={savingPrices}>
                  <Save className="h-4 w-4 mr-1" /> {savingPrices ? "Saving..." : "Save Prices"}
                </Button>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Set your own sell prices for each package. Your cost (agent price) is fixed — you keep the difference as profit.
            </p>

            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Your Cost</TableHead>
                    <TableHead>Your Sell Price</TableHead>
                    <TableHead>Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPackages.map((pkg) => {
                    const currentSellPrice = editedPrices[pkg.id] ?? agentPrices[pkg.id] ?? pkg.price;
                    const profit = currentSellPrice - pkg.agent_price;
                    return (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                        <TableCell className="text-muted-foreground">GH₵ {Number(pkg.agent_price).toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={editedPrices[pkg.id] ?? agentPrices[pkg.id] ?? pkg.price}
                            onChange={(e) => handlePriceChange(pkg.id, e.target.value)}
                            className="w-24 h-8"
                          />
                        </TableCell>
                        <TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>
                          GH₵ {profit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ORDERS TAB */}
          <TabsContent value="orders" className="space-y-4 mt-6">
            {orders.length === 0 ? (
              <Card className="border-border">
                <CardContent className="p-12 text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No orders yet. Share your store link to start receiving orders!</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border">
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
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-sm">
                          {new Date(order.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{order.customer_number}</TableCell>
                        <TableCell className="uppercase text-sm">{order.network}</TableCell>
                        <TableCell className="font-display font-bold">{order.size_gb}GB</TableCell>
                        <TableCell>GH₵ {Number(order.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={order.status === "completed"
                            ? "bg-green-600/20 text-green-400 border-green-600/30"
                            : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                          }>
                            {order.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="mt-6">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display">Store Information</CardTitle>
                {!editingStore && (
                  <Button variant="outline" size="sm" onClick={() => setEditingStore(true)}>
                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {editingStore ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Store Name</Label>
                        <Input value={storeForm.store_name} onChange={(e) => setStoreForm({ ...storeForm, store_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>WhatsApp Number</Label>
                        <Input value={storeForm.whatsapp_number} onChange={(e) => setStoreForm({ ...storeForm, whatsapp_number: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Support Number</Label>
                        <Input value={storeForm.support_number} onChange={(e) => setStoreForm({ ...storeForm, support_number: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>WhatsApp Group Link</Label>
                        <Input value={storeForm.whatsapp_group} onChange={(e) => setStoreForm({ ...storeForm, whatsapp_group: e.target.value })} placeholder="Optional" />
                      </div>
                      <div className="space-y-2">
                        <Label>MoMo Name</Label>
                        <Input value={storeForm.momo_name} onChange={(e) => setStoreForm({ ...storeForm, momo_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>MoMo Number</Label>
                        <Input value={storeForm.momo_number} onChange={(e) => setStoreForm({ ...storeForm, momo_number: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>MoMo Network</Label>
                        <Input value={storeForm.momo_network} onChange={(e) => setStoreForm({ ...storeForm, momo_network: e.target.value })} placeholder="mtn / airteltigo / telecel" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="hero" size="sm" onClick={saveStoreInfo} disabled={savingStore}>
                        <Save className="h-4 w-4 mr-1" /> {savingStore ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingStore(false)}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Store Name</p>
                      <p className="font-semibold text-foreground">{store?.store_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">WhatsApp</p>
                      <p className="font-semibold text-foreground">{store?.whatsapp_number}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Support Number</p>
                      <p className="font-semibold text-foreground">{store?.support_number}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">WhatsApp Group</p>
                      <p className="font-semibold text-foreground">{store?.whatsapp_group || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">MoMo Name</p>
                      <p className="font-semibold text-foreground">{store?.momo_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">MoMo Number</p>
                      <p className="font-semibold text-foreground">{store?.momo_number}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">MoMo Network</p>
                      <p className="font-semibold text-foreground">{store?.momo_network?.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Approved</Badge>
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

export default AgentDashboard;
