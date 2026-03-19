import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Zap, Check, X, Save, Eye, Plus, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
  agent_price: number;
  active: boolean;
}

interface AgentStore {
  id: string;
  user_id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  whatsapp_group: string | null;
  momo_number: string;
  momo_name: string;
  momo_network: string;
  approved: boolean;
  created_at: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string | null;
  role: string;
}

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [agents, setAgents] = useState<AgentStore[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, { price?: number; agent_price?: number }>>({});
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPkg, setNewPkg] = useState({ network: "mtn", size_gb: "", price: "", agent_price: "" });

  const fetchData = async () => {
    setDataLoading(true);
    const [pkgRes, agentRes, profilesRes, rolesRes] = await Promise.all([
      supabase.from("data_packages").select("*").order("size_gb"),
      supabase.from("agent_stores").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);

    setPackages(pkgRes.data ?? []);
    setAgents(agentRes.data ?? []);

    // Map users with roles
    const rolesMap: Record<string, string> = {};
    (rolesRes.data ?? []).forEach((r: any) => {
      rolesMap[r.user_id] = r.role;
    });
    const userList = (profilesRes.data ?? []).map((p: any) => ({
      ...p,
      role: rolesMap[p.id] || "user",
    }));
    setUsers(userList);
    setDataLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handlePriceChange = (id: string, field: "price" | "agent_price", value: string) => {
    setEditedPrices((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: parseFloat(value) || 0 },
    }));
  };

  const savePrices = async () => {
    setSaving(true);
    const updates = Object.entries(editedPrices);
    for (const [id, changes] of updates) {
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
    if (!size || !price || !agentPrice) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("data_packages").insert({
      network: newPkg.network,
      size_gb: size,
      price,
      agent_price: agentPrice,
    });
    if (error) {
      toast({ title: "Error adding package", description: error.message, variant: "destructive" });
      return;
    }
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

  const filteredPackages = packages.filter((p) => p.network === networkFilter);
  const storeSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

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
            <span className="font-display text-lg font-bold">
              Admin <span className="text-primary">Dashboard</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">User View</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/agent">Agent View</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
          </div>
        </div>
      </nav>

      <div className="container py-8 space-y-8">
        <Tabs defaultValue="prices">
          <TabsList className="mb-6">
            <TabsTrigger value="prices">Manage Prices</TabsTrigger>
            <TabsTrigger value="agents">Agent Approvals ({agents.filter((a) => !a.approved).length})</TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-1" /> Users ({users.length})
            </TabsTrigger>
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
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? "Saving..." : "Save Changes"}
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
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={pkg.price}
                          onChange={(e) => handlePriceChange(pkg.id, "price", e.target.value)}
                          className="w-24 h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={pkg.agent_price}
                          onChange={(e) => handlePriceChange(pkg.id, "agent_price", e.target.value)}
                          className="w-24 h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={pkg.active}
                          onCheckedChange={(checked) => toggleActive(pkg.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deletePackage(pkg.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
                        <p className="text-sm text-muted-foreground">WhatsApp: {agent.whatsapp_number}</p>
                        <p className="text-sm text-muted-foreground">Support: {agent.support_number}</p>
                        {agent.whatsapp_group && (
                          <p className="text-sm text-muted-foreground">Group: {agent.whatsapp_group}</p>
                        )}
                        <div className="pt-2">
                          <p className="text-xs text-muted-foreground">MoMo: {agent.momo_name} • {agent.momo_number} • {agent.momo_network.toUpperCase()}</p>
                        </div>
                        {agent.approved && (
                          <div className="pt-1">
                            <Link
                              to={`/store/${storeSlug(agent.store_name)}`}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" /> View Store Page
                            </Link>
                          </div>
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
        </Tabs>
      </div>

      {/* Add Package Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">Add New Package</DialogTitle>
            <DialogDescription>Create a new data package for users and agents.</DialogDescription>
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
