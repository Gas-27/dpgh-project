import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Store, Settings, LogOut, BarChart3, ShoppingCart, ArrowDownToLine, Copy,
  ExternalLink, Wallet, Loader2, Phone, Menu
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";

interface SubSubagentStore {
  id: string;
  store_name: string;
  whatsapp_number?: string;
  support_number?: string;
  momo_number?: string;
  momo_name?: string;
  momo_network?: string;
  wallet_balance: number;
  approved: boolean;
  subagent_store_id: string;
  top_reference: string;
  created_at: string;
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

const SubSubagentDashboard = () => {
  const { signOut, user, isSubSubagent } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<SubSubagentStore | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [walletAmount, setWalletAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  // Fetch store data
  useEffect(() => {
    if (!user) return;
    fetchStoreData();
  }, [user]);

  const fetchStoreData = async () => {
    try {
      const { data: storeData, error: storeError } = await supabase
        .from("sub_subagent_stores")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (storeError) {
        console.error("[v0] Error fetching store:", storeError);
        return;
      }

      setStore(storeData);
      setEditData({ ...storeData });

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("sub_subagent_store_id", storeData.id)
        .order("created_at", { ascending: false });

      if (!ordersError) {
        setOrders(ordersData || []);
      }
    } catch (error) {
      console.error("[v0] Error:", error);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const { error } = await supabase
        .from("sub_subagent_stores")
        .update({
          store_name: editData.store_name,
          support_number: editData.support_number,
          whatsapp_number: editData.whatsapp_number,
          momo_name: editData.momo_name,
          momo_number: editData.momo_number,
          momo_network: editData.momo_network,
        })
        .eq("id", store?.id);

      if (error) throw error;

      setStore(editData);
      setEditMode(false);
      toast({ title: "Success", description: "Settings updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" });
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) < 10) {
      toast({ title: "Error", description: "Minimum withdrawal is GH₵ 10.00", variant: "destructive" });
      return;
    }

    if (parseFloat(withdrawAmount) > store!.wallet_balance) {
      toast({ title: "Error", description: "Insufficient wallet balance", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from("withdrawal_requests")
        .insert([
          {
            sub_subagent_store_id: store?.id,
            amount: parseFloat(withdrawAmount),
            status: "pending",
          },
        ]);

      if (error) throw error;

      toast({ title: "Success", description: "Withdrawal request submitted" });
      setWithdrawAmount("");
      fetchStoreData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit withdrawal request", variant: "destructive" });
    }
  };

  if (!isSubSubagent) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No store data found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRevenue = orders
    .filter(o => o.status === "completed")
    .reduce((sum, o) => sum + (o.amount || 0), 0);

  const pendingOrders = orders.filter(o => o.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-foreground">{store.store_name}</h1>
              <p className="text-xs text-muted-foreground">Ref: {store.top_reference}</p>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="space-y-2 mt-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveTab("overview");
                    document.querySelector("[data-sheet-close]")?.click();
                  }}
                >
                  <BarChart3 className="h-4 w-4 mr-2" /> Overview
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveTab("orders");
                    document.querySelector("[data-sheet-close]")?.click();
                  }}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" /> Orders
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveTab("withdraw");
                    document.querySelector("[data-sheet-close]")?.click();
                  }}
                >
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Withdraw
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveTab("settings");
                    document.querySelector("[data-sheet-close]")?.click();
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-600 hover:text-red-700"
                  onClick={() => signOut()}
                >
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="hidden" />

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Wallet Balance</p>
                  <p className="text-3xl font-bold text-foreground mt-2">GH₵ {store.wallet_balance.toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold text-foreground mt-2">GH₵ {totalRevenue.toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{pendingOrders}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Store Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Top Up Reference</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-lg font-mono font-bold text-primary">{store.top_reference}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(store.top_reference);
                        toast({ title: "Copied to clipboard" });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">MoMo Account</p>
                  <p className="text-foreground mt-1">{store.momo_name} - {store.momo_number} ({store.momo_network?.toUpperCase()})</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No orders yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Customer</TableCell>
                          <TableCell>Network</TableCell>
                          <TableCell>Size</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {orders.map(order => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">{order.customer_number}</TableCell>
                            <TableCell>{order.network?.toUpperCase()}</TableCell>
                            <TableCell>{order.size_gb}GB</TableCell>
                            <TableCell>GH₵ {order.amount?.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                                {order.status}
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
            <Card>
              <CardHeader>
                <CardTitle>Request Withdrawal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Available Balance</p>
                  <p className="text-2xl font-bold text-primary mt-1">GH₵ {store.wallet_balance.toFixed(2)}</p>
                </div>

                <div>
                  <Label htmlFor="withdrawAmount">Withdrawal Amount (Minimum GH₵ 10)</Label>
                  <Input
                    id="withdrawAmount"
                    type="number"
                    placeholder="Enter amount"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    min="10"
                    step="0.01"
                    className="mt-2"
                  />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">MoMo Account</p>
                  <p className="text-foreground font-semibold mt-1">
                    {store.momo_name} - {store.momo_number}
                  </p>
                </div>

                <Button
                  onClick={handleRequestWithdrawal}
                  className="w-full"
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}
                >
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  Request Withdrawal
                </Button>

                <p className="text-xs text-muted-foreground">
                  Withdrawals are processed within 24 hours to your registered MoMo account.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Store Settings</CardTitle>
                  <Button
                    size="sm"
                    variant={editMode ? "destructive" : "outline"}
                    onClick={() => {
                      if (editMode) {
                        setEditData({ ...store });
                      } else {
                        setEditData({ ...store });
                      }
                      setEditMode(!editMode);
                    }}
                  >
                    {editMode ? "Cancel" : "Edit"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editMode ? (
                  <>
                    <div>
                      <Label htmlFor="store_name">Store Name</Label>
                      <Input
                        id="store_name"
                        value={editData.store_name}
                        onChange={e => setEditData({ ...editData, store_name: e.target.value })}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="support_number">Support Number</Label>
                      <Input
                        id="support_number"
                        value={editData.support_number}
                        onChange={e => setEditData({ ...editData, support_number: e.target.value })}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                      <Input
                        id="whatsapp_number"
                        value={editData.whatsapp_number}
                        onChange={e => setEditData({ ...editData, whatsapp_number: e.target.value })}
                        className="mt-2"
                      />
                    </div>

                    <Button onClick={handleUpdateSettings} className="w-full">
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Store Name</p>
                      <p className="text-foreground font-semibold mt-1">{store.store_name}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Support Number</p>
                      <p className="text-foreground font-semibold mt-1">{store.support_number}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp Number</p>
                      <p className="text-foreground font-semibold mt-1">{store.whatsapp_number}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">MoMo Account</p>
                      <p className="text-foreground font-semibold mt-1">
                        {store.momo_name} - {store.momo_number}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SubSubagentDashboard;
