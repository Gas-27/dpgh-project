import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Store, Wifi, Settings } from "lucide-react";
import { Link } from "react-router-dom";

interface AgentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  approved: boolean;
}

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
  agent_price: number;
}

const AgentDashboard = () => {
  const { user, isAgent, loading: authLoading, signOut } = useAuth();
  const [store, setStore] = useState<AgentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkFilter, setNetworkFilter] = useState("mtn");

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [storeRes, pkgRes] = await Promise.all([
        supabase.from("agent_stores").select("*").eq("user_id", user.id).single(),
        supabase.from("data_packages").select("*").eq("active", true).order("size_gb"),
      ]);
      setStore(storeRes.data);
      setPackages(pkgRes.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!store) return <Navigate to="/agent-onboarding" replace />;
  if (!store.approved) return <Navigate to="/pending-approval" replace />;

  const filteredPackages = packages.filter((p) => p.network === networkFilter);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">
              {store.store_name}
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
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">Store Status</p>
              <Badge className="mt-2 bg-green-600/20 text-green-400 border-green-600/30">Active</Badge>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">WhatsApp</p>
              <p className="font-display font-bold mt-1">{store.whatsapp_number}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">Support Line</p>
              <p className="font-display font-bold mt-1">{store.support_number}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="packages">
          <TabsList>
            <TabsTrigger value="packages">
              <Wifi className="h-4 w-4 mr-1" /> My Packages
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-1" /> Store Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="space-y-4 mt-4">
            <div className="flex gap-2">
              {["mtn", "airteltigo", "telecel"].map((net) => (
                <Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(net)}>
                  {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
                </Button>
              ))}
            </div>

            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Your Cost</TableHead>
                    <TableHead>Suggested Sell Price</TableHead>
                    <TableHead>Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPackages.map((pkg) => {
                    const profit = pkg.price - pkg.agent_price;
                    return (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                        <TableCell>GH₵ {Number(pkg.agent_price).toFixed(2)}</TableCell>
                        <TableCell>GH₵ {Number(pkg.price).toFixed(2)}</TableCell>
                        <TableCell className="text-green-400 font-semibold">
                          GH₵ {profit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-display">Store Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Store Name</p>
                    <p className="font-semibold">{store.store_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">WhatsApp</p>
                    <p className="font-semibold">{store.whatsapp_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Support Number</p>
                    <p className="font-semibold">{store.support_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Approved</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AgentDashboard;
