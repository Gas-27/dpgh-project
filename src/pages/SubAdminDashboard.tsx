import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ShoppingCart,
  Users,
  MessageCircle,
  LogOut,
  Shield,
  Package,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ComplaintsManager } from "@/components/ComplaintsManager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  status: string;
  fulfillment_status: string;
  payment_method: string;
  created_at: string;
  source?: string;
}

interface AgentStore {
  id: string;
  store_name: string;
  phone_number: string;
  store_url?: string;
  approved: boolean;
  created_at: string;
  user_id: string;
}

interface SubagentStore {
  id: string;
  store_name: string;
  whatsapp_number?: string;
  store_url?: string;
  created_at: string;
  agent_store_id?: string;
}

interface SubSubagentStore {
  id: string;
  store_name: string;
  phone_number?: string;
  created_at: string;
  subagent_store_id?: string;
}

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Sub-Admin Dashboard
// ---------------------------------------------------------------------------
export default function SubAdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Orders
  const [orderSearch, setOrderSearch] = useState("");
  const [orderResults, setOrderResults] = useState<Order[]>([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const [orderSearched, setOrderSearched] = useState(false);

  // Agents
  const [agents, setAgents] = useState<AgentStore[]>([]);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);

  // Subagents
  const [subagents, setSubagents] = useState<SubagentStore[]>([]);
  const [subagentSearch, setSubagentSearch] = useState("");
  const [subagentLoading, setSubagentLoading] = useState(false);

  // Sub-subagents
  const [subSubagents, setSubSubagents] = useState<SubSubagentStore[]>([]);
  const [subSubagentSearch, setSubSubagentSearch] = useState("");
  const [subSubagentLoading, setSubSubagentLoading] = useState(false);

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerLoaded, setCustomerLoaded] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState("orders");

  // ---------------------------------------------------------------------------
  // Data loaders — only run when user visits a tab
  // ---------------------------------------------------------------------------
  const loadAgents = async () => {
    if (agents.length > 0) return;
    setAgentLoading(true);
    const { data } = await supabase
      .from("agent_stores")
      .select("id, store_name, phone_number, store_url, approved, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    setAgents((data as AgentStore[]) ?? []);
    setAgentLoading(false);
  };

  const loadSubagents = async () => {
    if (subagents.length > 0) return;
    setSubagentLoading(true);
    const { data } = await supabase
      .from("subagent_stores")
      .select("id, store_name, whatsapp_number, store_url, created_at, agent_store_id")
      .order("created_at", { ascending: false })
      .limit(200);
    setSubagents((data as SubagentStore[]) ?? []);
    setSubagentLoading(false);
  };

  const loadSubSubagents = async () => {
    if (subSubagents.length > 0) return;
    setSubSubagentLoading(true);
    const { data } = await supabase
      .from("sub_subagent_stores")
      .select("id, store_name, phone_number, created_at, subagent_store_id")
      .order("created_at", { ascending: false })
      .limit(200);
    setSubSubagents((data as SubSubagentStore[]) ?? []);
    setSubSubagentLoading(false);
  };

  const loadCustomers = async () => {
    if (customerLoaded) return;
    setCustomerLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setCustomers(
      ((data as any[]) ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || "—",
        email: "—",
        phone: p.phone || "—",
        created_at: p.created_at,
      }))
    );
    setCustomerLoaded(true);
    setCustomerLoading(false);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "agents") loadAgents();
    if (tab === "subagents") loadSubagents();
    if (tab === "sub-subagents") loadSubSubagents();
    if (tab === "customers") loadCustomers();
  };

  // ---------------------------------------------------------------------------
  // Order search — only show results after explicit search
  // ---------------------------------------------------------------------------
  const searchOrders = async () => {
    if (!orderSearch.trim()) return;
    setOrderSearching(true);
    setOrderSearched(true);
    try {
      const term = orderSearch.trim();
      const { data, error } = await supabase
        .from("orders")
        .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, payment_method, created_at, source")
        .or(
          `customer_number.ilike.%${term}%,id.ilike.%${term}%,network.ilike.%${term}%`
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setOrderResults((data as Order[]) ?? []);
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setOrderSearching(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/sub-admin-login");
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const networkLabel = (n: string) => {
    const map: Record<string, string> = {
      MTN_EXPRESS: "MTN Express",
      MTN: "MTN",
      VODAFONE: "Vodafone",
      AIRTELTIGO: "AirtelTigo",
      TELECEL: "Telecel",
    };
    return map[n] || n;
  };

  const fulfillmentBadge = (status: string) => {
    const colors: Record<string, string> = {
      delivered: "bg-green-500/20 text-green-400 border-green-500/30",
      pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      failed: "bg-red-500/20 text-red-400 border-red-500/30",
      refunded: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
    const cls = colors[status?.toLowerCase()] ?? "bg-muted text-muted-foreground";
    return <Badge className={`text-xs ${cls}`}>{status || "—"}</Badge>;
  };

  // ---------------------------------------------------------------------------
  // Filtered lists
  // ---------------------------------------------------------------------------
  const filteredAgents = agents.filter(
    (a) =>
      !agentSearch ||
      a.store_name?.toLowerCase().includes(agentSearch.toLowerCase()) ||
      a.phone_number?.includes(agentSearch)
  );
  const filteredSubagents = subagents.filter(
    (s) =>
      !subagentSearch ||
      s.store_name?.toLowerCase().includes(subagentSearch.toLowerCase())
  );
  const filteredSubSubagents = subSubagents.filter(
    (s) =>
      !subSubagentSearch ||
      s.store_name?.toLowerCase().includes(subSubagentSearch.toLowerCase())
  );
  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearch ||
      c.full_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch)
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-foreground">Sub-Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Sub-Admin</Badge>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Read-only notice */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center">
        <p className="text-xs text-amber-400">
          View-only access. You cannot process refunds, change order status, or modify any records.
        </p>
      </div>

      <main className="container py-6 px-4 space-y-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/50 p-1 rounded-lg w-full">
            <TabsTrigger value="orders" className="flex items-center gap-1.5 text-xs">
              <ShoppingCart className="h-3.5 w-3.5" /> Orders
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Agents
            </TabsTrigger>
            <TabsTrigger value="subagents" className="flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Subagents
            </TabsTrigger>
            <TabsTrigger value="sub-subagents" className="flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Sub-Subagents
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-1.5 text-xs">
              <Package className="h-3.5 w-3.5" /> Customers
            </TabsTrigger>
            <TabsTrigger value="complaints" className="flex items-center gap-1.5 text-xs">
              <MessageCircle className="h-3.5 w-3.5" /> Complaints
            </TabsTrigger>
          </TabsList>

          {/* ---------------------------------------------------------------- */}
          {/* ORDERS TAB — search-only, no data until searched                 */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="orders" className="space-y-4 pt-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base">Order Lookup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by phone number, order ID, or network..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) searchOrders();
                      }}
                    />
                  </div>
                  <Button onClick={searchOrders} disabled={orderSearching || !orderSearch.trim()}>
                    {orderSearching ? "Searching..." : "Search"}
                  </Button>
                </div>

                {!orderSearched ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">Enter a phone number or order ID to search for orders.</p>
                  </div>
                ) : orderResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No orders found for that search.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Phone</TableHead>
                          <TableHead className="text-xs">Network</TableHead>
                          <TableHead className="text-xs">Size</TableHead>
                          <TableHead className="text-xs">Amount</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderResults.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(order.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm font-mono">{order.customer_number}</TableCell>
                            <TableCell className="text-xs font-semibold">{networkLabel(order.network)}</TableCell>
                            <TableCell className="text-sm font-bold text-primary">{order.size_gb}GB</TableCell>
                            <TableCell className="text-sm">GHC {Number(order.amount).toFixed(2)}</TableCell>
                            <TableCell>{fulfillmentBadge(order.fulfillment_status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{order.source || "Direct"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-2 text-right">
                      {orderResults.length} result{orderResults.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* AGENTS TAB                                                        */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="agents" className="space-y-4 pt-4">
            <ReadOnlyNotice />
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={agentSearch}
                  onChange={(e) => setAgentSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {agentLoading ? (
              <div className="text-center py-8 text-muted-foreground animate-pulse">Loading agents...</div>
            ) : (
              <Card className="border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Store Name</TableHead>
                      <TableHead className="text-xs">Phone</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Store URL</TableHead>
                      <TableHead className="text-xs">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAgents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No agents found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAgents.map((agent) => (
                        <TableRow key={agent.id}>
                          <TableCell className="font-medium text-sm">{agent.store_name}</TableCell>
                          <TableCell className="text-sm font-mono">{agent.phone_number}</TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs ${
                                agent.approved
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {agent.approved ? "Approved" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-primary">
                            {agent.store_url ? (
                              <a href={agent.store_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                <Eye className="h-3 w-3" /> View Store
                              </a>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(agent.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="px-4 py-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">{filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""}</p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* SUBAGENTS TAB                                                     */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="subagents" className="space-y-4 pt-4">
            <ReadOnlyNotice />
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subagents..."
                  value={subagentSearch}
                  onChange={(e) => setSubagentSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {subagentLoading ? (
              <div className="text-center py-8 text-muted-foreground animate-pulse">Loading subagents...</div>
            ) : (
              <Card className="border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Store Name</TableHead>
                      <TableHead className="text-xs">WhatsApp</TableHead>
                      <TableHead className="text-xs">Store URL</TableHead>
                      <TableHead className="text-xs">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubagents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No subagents found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredSubagents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm">{s.store_name}</TableCell>
                          <TableCell className="text-sm font-mono">{s.whatsapp_number || "—"}</TableCell>
                          <TableCell className="text-xs text-primary">
                            {s.store_url ? (
                              <a href={s.store_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                <Eye className="h-3 w-3" /> View Store
                              </a>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="px-4 py-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">{filteredSubagents.length} subagent{filteredSubagents.length !== 1 ? "s" : ""}</p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* SUB-SUBAGENTS TAB                                                 */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="sub-subagents" className="space-y-4 pt-4">
            <ReadOnlyNotice />
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sub-subagents..."
                  value={subSubagentSearch}
                  onChange={(e) => setSubSubagentSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {subSubagentLoading ? (
              <div className="text-center py-8 text-muted-foreground animate-pulse">Loading sub-subagents...</div>
            ) : (
              <Card className="border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Store Name</TableHead>
                      <TableHead className="text-xs">Phone</TableHead>
                      <TableHead className="text-xs">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubSubagents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No sub-subagents found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredSubSubagents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm">{s.store_name}</TableCell>
                          <TableCell className="text-sm font-mono">{s.phone_number || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="px-4 py-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">{filteredSubSubagents.length} sub-subagent{filteredSubSubagents.length !== 1 ? "s" : ""}</p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* CUSTOMERS TAB                                                     */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="customers" className="space-y-4 pt-4">
            <ReadOnlyNotice />
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {customerLoading ? (
              <div className="text-center py-8 text-muted-foreground animate-pulse">Loading customers...</div>
            ) : (
              <Card className="border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Phone</TableHead>
                      <TableHead className="text-xs">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No customers found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomers.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-sm">{c.full_name}</TableCell>
                          <TableCell className="text-sm font-mono">{c.phone || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="px-4 py-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">{filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}</p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* COMPLAINTS TAB                                                    */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent value="complaints" className="pt-4">
            <ReadOnlyNotice />
            {/* ComplaintsManager in sub-admin mode: no bulk resolve, no status change */}
            <SubAdminComplaintsView />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small read-only badge
// ---------------------------------------------------------------------------
function ReadOnlyNotice() {
  return (
    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-1.5 w-fit">
      <Eye className="h-3.5 w-3.5" />
      View only — no actions available
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-admin complaints view — read-only list with notes thread (admin can add notes)
// ---------------------------------------------------------------------------
function SubAdminComplaintsView() {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
      <p className="font-medium mb-1">Complaints — View Only</p>
      <p className="text-xs text-amber-300/70">
        You can view complaints and add notes/questions to customers, but you cannot change complaint status or resolve them.
      </p>
      <div className="mt-4">
        <ComplaintsManager readOnly={true} />
      </div>
    </div>
  );
}
