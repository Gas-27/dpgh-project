import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Check, X, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

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

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [agents, setAgents] = useState<AgentStore[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, { price?: number; agent_price?: number }>>({});
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [pkgRes, agentRes] = await Promise.all([
      supabase.from("data_packages").select("*").order("size_gb"),
      supabase.from("agent_stores").select("*").order("created_at", { ascending: false }),
    ]);
    setPackages(pkgRes.data ?? []);
    setAgents(agentRes.data ?? []);
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

  const toggleApproval = async (agentId: string, approved: boolean) => {
    await supabase.from("agent_stores").update({ approved }).eq("id", agentId);
    await fetchData();
    toast({ title: approved ? "Agent approved!" : "Agent suspended" });
  };

  const filteredPackages = packages.filter((p) => p.network === networkFilter);

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
              <Link to="/">Home</Link>
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
          </TabsList>

          {/* PRICES TAB */}
          <TabsContent value="prices" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {["mtn", "airteltigo", "telecel"].map((net) => (
                  <Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>
                    {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
                  </Button>
                ))}
              </div>
              {Object.keys(editedPrices).length > 0 && (
                <Button variant="hero" size="sm" onClick={savePrices} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>

            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>User Price (GH₵)</TableHead>
                    <TableHead>Agent Price (GH₵)</TableHead>
                    <TableHead>Status</TableHead>
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
                        <Badge variant={pkg.active ? "default" : "secondary"}>
                          {pkg.active ? "Active" : "Inactive"}
                        </Badge>
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
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
