import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Zap, Check, X, Save, Eye, Plus, Trash2, Users, RefreshCw, ShoppingCart,
  Loader2, Wallet, Search, Bell, Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface DataPackage {
  id: string; network: string; size_gb: number; price: number; agent_price: number; active: boolean;
}

interface AgentStore {
  id: string; user_id: string; store_name: string; whatsapp_number: string; support_number: string;
  whatsapp_group: string | null; momo_number: string; momo_name: string; momo_network: string;
  approved: boolean; created_at: string; wallet_balance: number; topup_reference: string;
}

interface UserProfile {
  id: string; full_name: string | null; phone: string | null; created_at: string | null; role: string;
}

interface Order {
  id: string; customer_number: string; network: string; size_gb: number; amount: number;
  status: string; fulfillment_status: string; api_response: string | null;
  paystack_reference: string | null; created_at: string | null; agent_store_id: string | null;
  payment_method: string;
}

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [agents, setAgents] = useState<AgentStore[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, { price?: number; agent_price?: number }>>({});
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPkg, setNewPkg] = useState({ network: "mtn", size_gb: "", price: "", agent_price: "" });
  const [retryingOrders, setRetryingOrders] = useState<Set<string>>(new Set());

  // Topup state
  const [topupSearch, setTopupSearch] = useState("");
  const [topupAgent, setTopupAgent] = useState<AgentStore | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  // Notification state
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTarget, setNotifTarget] = useState("all");
  const [sendingNotif, setSendingNotif] = useState(false);

  const fetchData = async () => {
    setDataLoading(true);
    const [pkgRes, agentRes, profilesRes, rolesRes, ordersRes] = await Promise.all([
      supabase.from("data_packages").select("*").order("size_gb"),
      supabase.from("agent_stores").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
    ]);
    setPackages(pkgRes.data ?? []);
    setAgents((agentRes.data as AgentStore[]) ?? []);
    setOrders((ordersRes.data as Order[]) ?? []);

    const rolesMap: Record<string, string> = {};
    (rolesRes.data ?? []).forEach((r: any) => { rolesMap[r.user_id] = r.role; });
    const userList = (profilesRes.data ?? []).map((p: any) => ({ ...p, role: rolesMap[p.id] || "user" }));
    setUsers(userList);
    setDataLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handlePriceChange = (id: string, field: "price" | "agent_price", value: string) => {
    setEditedPrices((prev) => ({ ...prev, [id]: { ...prev[id], [field]: parseFloat(value) || 0 } }));
  };

  const savePrices = async () => {
    setSaving(true);
    for (const [id, changes] of Object.entries(editedPrices)) {
      await supabase.from("data_packages").update(changes).eq("id", id);
    }
    setEditedPrices({});
    await fetchData();
    setSaving(false);
    toast({ title: "Prices updated!" });
  };

  const toggleActive = async (pkgId: string, active: boolean) => {
    await supabase.from("data_packages").update({ active }).eq("id", pkgId);
    setPackages((prev) => prev.map((p) => (p.id === pkgId ? { ...p, active } : p)));
    toast({ title: active ? "Package activated" : "Package deactivated" });
  };

  const deletePackage = async (pkgId: string) => {
    await supabase.from("data_packages").delete().eq("id", pkgId);
    setPackages((prev) => prev.filter((p) => p.id !== pkgId));
    toast({ title: "Package deleted" });
  };

  const addPackage = async () => {
    const size = parseFloat(newPkg.size_gb);
    const price = parseFloat(newPkg.price);
    const agentPrice = parseFloat(newPkg.agent_price);
    if (!size || !price || !agentPrice) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    const { error } = await supabase.from("data_packages").insert({ network: newPkg.network, size_gb: size, price, agent_price: agentPrice });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setAddDialogOpen(false);
    setNewPkg({ network: "mtn", size_gb: "", price: "", agent_price: "" });
    await fetchData();
    toast({ title: "Package added!" });
  };

  const toggleApproval = async (agentId: string, approved: boolean) => {
    await supabase.from("agent_stores").update({ approved }).eq("id", agentId);
    await fetchData();
    toast({ title: approved ? "Agent approved!" : "Agent suspended" });
  };

  const retryOrder = async (orderId: string) => {
    setRetryingOrders((prev) => new Set(prev).add(orderId));
    try {
      const { data, error } = await supabase.functions.invoke("fulfill-order", { body: { order_id: orderId } });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Order fulfilled successfully!" });
      } else {
        toast({ title: "Fulfillment failed", description: data?.message || "Check API balance", variant: "destructive" });
      }
      await fetchData();
    } catch (err: any) {
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    } finally {
      setRetryingOrders((prev) => { const next = new Set(prev); next.delete(orderId); return next; });
    }
  };

  const retryAllFailed = async () => {
    const failedOrders = orders.filter((o) => o.fulfillment_status === "failed");
    for (const order of failedOrders) { await retryOrder(order.id); }
  };

  // Topup search
  const searchTopupRef = () => {
    const found = agents.find((a) => a.topup_reference === topupSearch.trim());
    if (found) {
      setTopupAgent(found);
    } else {
      setTopupAgent(null);
      toast({ title: "Not found", description: "No agent with that reference code.", variant: "destructive" });
    }
  };

  const creditWallet = async () => {
    if (!topupAgent) return;
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setTopupLoading(true);

    const newBalance = Number(topupAgent.wallet_balance) + amount;
    const { error: updateErr } = await supabase.from("agent_stores")
      .update({ wallet_balance: newBalance }).eq("id", topupAgent.id);

    if (updateErr) {
      toast({ title: "Error", description: updateErr.message, variant: "destructive" });
      setTopupLoading(false);
      return;
    }

    await supabase.from("wallet_topups").insert({
      agent_store_id: topupAgent.id, amount,
    });

    setTopupAgent({ ...topupAgent, wallet_balance: newBalance });
    setTopupAmount("");
    toast({ title: "Wallet credited!", description: `GH₵ ${amount.toFixed(2)} added to ${topupAgent.store_name}` });
    setTopupLoading(false);
    await fetchData();
  };

  // Send notification
  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast({ title: "Fill title and message", variant: "destructive" });
      return;
    }
    setSendingNotif(true);
    const { error } = await supabase.from("notifications").insert({
      title: notifTitle.trim(), message: notifMessage.trim(), target_role: notifTarget,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notification sent!" });
      setNotifTitle(""); setNotifMessage(""); setNotifTarget("all");
    }
    setSendingNotif(false);
  };

  const filteredPackages = packages.filter((p) => p.network === networkFilter);
  const storeSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const failedCount = orders.filter((o) => o.fulfillment_status === "failed").length;

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">Admin <span className="text-primary">Dashboard</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild><Link to="/">User View</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link to="/agent">Agent View</Link></Button>
            <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
          </div>
        </div>
      </nav>

      <div className="container py-8 space-y-8">
        <Tabs defaultValue="prices">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="prices">Prices</TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="h-4 w-4 mr-1" /> Orders
              {failedCount > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0">{failedCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="agents">Agents ({agents.filter((a) => !a.approved).length})</TabsTrigger>
            <TabsTrigger value="topup"><Wallet className="h-4 w-4 mr-1" /> Topup</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" /> Users</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-1" /> Notify</TabsTrigger>
          </TabsList>

          {/* PRICES TAB */}
          <TabsContent value="prices" className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-2">
                {["mtn", "airteltigo", "telecel"].map((net) => (
                  <Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>
                    {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Package
                </Button>
                {Object.keys(editedPrices).length > 0 && (
                  <Button variant="hero" size="sm" onClick={savePrices} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </div>
            </div>
            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>User Price (GH₵)</TableHead>
                    <TableHead>Agent Price (GH₵)</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPackages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" defaultValue={pkg.price}
                          onChange={(e) => handlePriceChange(pkg.id, "price", e.target.value)} className="w-24 h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" defaultValue={pkg.agent_price}
                          onChange={(e) => handlePriceChange(pkg.id, "agent_price", e.target.value)} className="w-24 h-8" />
                      </TableCell>
                      <TableCell>
                        <Switch checked={pkg.active} onCheckedChange={(checked) => toggleActive(pkg.id, checked)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deletePackage(pkg.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ORDERS TAB */}
          <TabsContent value="orders" className="space-y-4">
            {failedCount > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <p className="text-sm text-foreground">
                  <span className="font-bold text-destructive">{failedCount} failed</span> order(s) — top up API balance and retry.
                </p>
                <Button variant="destructive" size="sm" onClick={retryAllFailed}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Retry All Failed
                </Button>
              </div>
            )}
            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Fulfillment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No orders yet.</TableCell></TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.created_at ? new Date(order.created_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="font-medium">{order.customer_number}</TableCell>
                        <TableCell className="uppercase text-sm">{order.network}</TableCell>
                        <TableCell className="font-display font-bold">{order.size_gb}GB</TableCell>
                        <TableCell>GH₵ {Number(order.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {order.payment_method === "wallet" ? "Wallet" : "Paystack"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.status === "completed" || order.status === "paid" ? "default" : "secondary"}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.fulfillment_status === "completed" ? "default" : order.fulfillment_status === "failed" ? "destructive" : "secondary"}>
                            {order.fulfillment_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.fulfillment_status !== "completed" && (
                            <Button variant="outline" size="sm" onClick={() => retryOrder(order.id)} disabled={retryingOrders.has(order.id)}>
                              {retryingOrders.has(order.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" /> Retry</>}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* AGENTS TAB */}
          <TabsContent value="agents" className="space-y-4">
            {agents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No agent applications yet.</p>
            ) : (
              agents.map((agent) => (
                <Card key={agent.id} className="border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="space-y-1">
                        <h3 className="font-display font-bold text-lg">{agent.store_name}</h3>
                        <p className="text-sm text-muted-foreground">Ref: <span className="font-bold text-primary">{agent.topup_reference}</span></p>
                        <p className="text-sm text-muted-foreground">WhatsApp: {agent.whatsapp_number}</p>
                        <p className="text-sm text-muted-foreground">Support: {agent.support_number}</p>
                        <p className="text-xs text-muted-foreground">MoMo: {agent.momo_name} • {agent.momo_number} • {agent.momo_network.toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">Wallet: <span className="font-bold text-green-400">GH₵ {Number(agent.wallet_balance).toFixed(2)}</span></p>
                        {agent.approved && (
                          <Link to={`/store/${storeSlug(agent.store_name)}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Eye className="h-3 w-3" /> View Store
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {agent.approved ? (
                          <>
                            <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Approved</Badge>
                            <Button variant="outline" size="sm" onClick={() => toggleApproval(agent.id, false)}>
                              <X className="h-4 w-4 mr-1" /> Suspend
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge variant="secondary">Pending</Badge>
                            <Button variant="hero" size="sm" onClick={() => toggleApproval(agent.id, true)}>
                              <Check className="h-4 w-4 mr-1" /> Approve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* TOPUP TAB */}
          <TabsContent value="topup" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" /> Credit Agent Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Enter 4-digit Topup Reference" value={topupSearch}
                      onChange={(e) => setTopupSearch(e.target.value)} className="pl-10" maxLength={4}
                      onKeyDown={(e) => e.key === "Enter" && searchTopupRef()} />
                  </div>
                  <Button variant="hero" onClick={searchTopupRef}>
                    <Search className="h-4 w-4 mr-1" /> Search
                  </Button>
                </div>

                {topupAgent && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div><p className="text-muted-foreground">Store</p><p className="font-bold text-foreground">{topupAgent.store_name}</p></div>
                      <div><p className="text-muted-foreground">Reference</p><p className="font-bold text-primary">{topupAgent.topup_reference}</p></div>
                      <div><p className="text-muted-foreground">MoMo</p><p className="font-bold text-foreground">{topupAgent.momo_name}</p></div>
                      <div><p className="text-muted-foreground">Balance</p><p className="font-bold text-green-400">GH₵ {Number(topupAgent.wallet_balance).toFixed(2)}</p></div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label>Amount to Credit (GH₵)</Label>
                        <Input type="number" step="0.01" placeholder="e.g. 50.00" value={topupAmount}
                          onChange={(e) => setTopupAmount(e.target.value)} />
                      </div>
                      <Button variant="hero" onClick={creditWallet} disabled={topupLoading}>
                        {topupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wallet className="h-4 w-4 mr-1" />}
                        Credit
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users" className="space-y-4">
            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : u.role === "agent" ? "secondary" : "outline"}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* NOTIFICATIONS TAB */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" /> Send Notification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select value={notifTarget} onValueChange={setNotifTarget}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users & Agents</SelectItem>
                      <SelectItem value="user">Users Only</SelectItem>
                      <SelectItem value="agent">Agents Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="Notification title" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea placeholder="Write your message here..." value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)} rows={4} />
                </div>
                <Button variant="hero" onClick={sendNotification} disabled={sendingNotif}>
                  {sendingNotif ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Send Notification
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Package Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">Add New Package</DialogTitle>
            <DialogDescription>Create a new data package.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Network</Label>
              <Select value={newPkg.network} onValueChange={(v) => setNewPkg((p) => ({ ...p, network: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mtn">MTN</SelectItem>
                  <SelectItem value="airteltigo">AirtelTigo</SelectItem>
                  <SelectItem value="telecel">Telecel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Size (GB)</Label>
              <Input type="number" placeholder="e.g. 5" value={newPkg.size_gb} onChange={(e) => setNewPkg((p) => ({ ...p, size_gb: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>User Price (GH₵)</Label>
              <Input type="number" step="0.01" placeholder="e.g. 15.00" value={newPkg.price} onChange={(e) => setNewPkg((p) => ({ ...p, price: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Agent Price (GH₵)</Label>
              <Input type="number" step="0.01" placeholder="e.g. 12.00" value={newPkg.agent_price} onChange={(e) => setNewPkg((p) => ({ ...p, agent_price: e.target.value }))} />
            </div>
            <Button variant="hero" className="w-full" onClick={addPackage}>
              <Plus className="h-4 w-4 mr-1" /> Add Package
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
