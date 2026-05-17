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
  Loader2, Wallet, Search, Bell, Send, ArrowDownToLine, ShieldAlert, Gift, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import ComplaintsManager from "@/components/ComplaintsManager";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ============================================================
// Interfaces
// ============================================================
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
interface WithdrawalRequest {
  id: string; agent_store_id: string; amount: number; status: string;
  created_at: string; processed_at: string | null;
}
interface TopupRecord {
  id: string; agent_store_id: string; amount: number; created_at: string;
  agent_stores: { store_name: string; topup_reference: string; wallet_balance: number; momo_name: string; } | null;
}
interface SpinSegment {
  type: "gb" | "message";
  value: number | string;
  label: string;
  weight: number;
}
type Section = "prices" | "orders" | "agents" | "subagents" | "topup" | "withdrawals" | "users" | "notifications" | "spinwheel" | "complaints";

const AdminDashboard = () => {
  const { signOut, user: currentUser } = useAuth();
  const { toast } = useToast();

  // ======================== State ========================
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [agents, setAgents] = useState<AgentStore[]>([]);
  const [subagents, setSubagents] = useState<any[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [topupHistory, setTopupHistory] = useState<TopupRecord[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, { price?: number; agent_price?: number }>>({});
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPkg, setNewPkg] = useState({ network: "mtn", size_gb: "", price: "", agent_price: "" });
  const [retryingOrders, setRetryingOrders] = useState<Set<string>>(new Set());
  const [processingWithdrawals, setProcessingWithdrawals] = useState<Set<string>>(new Set());

  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [withdrawalSearchTerm, setWithdrawalSearchTerm] = useState("");

  const [topupSearch, setTopupSearch] = useState("");
  const [topupAgent, setTopupAgent] = useState<AgentStore | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTarget, setNotifTarget] = useState("all");
  const [sendingNotif, setSendingNotif] = useState(false);

  // Spin wheel state
  const [spinConfig, setSpinConfig] = useState<{
    id: number;
    enabled: boolean;
    default_network: string;
    payment_required: boolean;
    payment_amount: number;
    segments: SpinSegment[];
  } | null>(null);
  const [spinSaving, setSpinSaving] = useState(false);

  // Admin permissions state
  const [currentUserSections, setCurrentUserSections] = useState<Section[]>([]);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<UserProfile | null>(null);
  const [userSections, setUserSections] = useState<Section[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [makeAdminDialogOpen, setMakeAdminDialogOpen] = useState(false);
  const [selectedUserForAdmin, setSelectedUserForAdmin] = useState<UserProfile | null>(null);
  const [newAdminSections, setNewAdminSections] = useState<Section[]>([]);
  const [makingAdmin, setMakingAdmin] = useState(false);

  // ======================== Data fetching (initial) ========================
  const fetchData = async () => {
    setDataLoading(true);
    await refreshData();
    setDataLoading(false);
  };

  // Silent background refresh (no loading state)
  const refreshData = async () => {
    const [pkgRes, agentRes, profilesRes, rolesRes, ordersRes, withdrawRes, topupRes, subagentRes] = await Promise.all([
      supabase.from("data_packages").select("*").order("size_gb"),
      supabase.from("agent_stores").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabase
        .from("wallet_topups")
        .select("id, agent_store_id, amount, created_at, agent_stores ( store_name, topup_reference, wallet_balance, momo_name )")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("subagent_stores").select("*").order("created_at", { ascending: false }),
    ]);
    setPackages(pkgRes.data ?? []);
    setAgents((agentRes.data as AgentStore[]) ?? []);
    setOrders((ordersRes.data as Order[]) ?? []);
    setWithdrawals((withdrawRes.data as WithdrawalRequest[]) ?? []);
    setTopupHistory((topupRes.data as any[]) ?? []);
    setSubagents((subagentRes.data ?? []));

    const rolesMap: Record<string, string> = {};
    (rolesRes.data ?? []).forEach((r: any) => { rolesMap[r.user_id] = r.role; });
    const userList = (profilesRes.data ?? []).map((p: any) => ({ ...p, role: rolesMap[p.id] || "user" }));
    setUsers(userList);
  };

  // ======================== Spin wheel config ========================
  const fetchSpinConfig = async () => {
    const { data, error } = await supabase.from("spin_config").select("*").eq("id", 1).maybeSingle();
    if (error) {
      console.error("Fetch spin config error:", error);
      toast({ title: "Error", description: "Failed to load spin config", variant: "destructive" });
      return;
    }
    if (data) {
      setSpinConfig(data);
    } else {
      setSpinConfig({
        id: 1,
        enabled: true,
        default_network: "mtn",
        payment_required: true,
        payment_amount: 2,
        segments: [
          { type: "gb", value: 1, label: "1 GB", weight: 40 },
          { type: "gb", value: 2, label: "2 GB", weight: 35 },
          { type: "gb", value: 10, label: "10 GB", weight: 5 },
          { type: "message", value: "", label: "Better luck next time!", weight: 20 },
          { type: "message", value: "", label: "Almost there!", weight: 0 },
          { type: "message", value: "", label: "Keep spinning!", weight: 0 },
          { type: "message", value: "", label: "You can do it!", weight: 0 },
          { type: "message", value: "", label: "Nice try!", weight: 0 },
          { type: "message", value: "", label: "Try again!", weight: 0 },
        ],
      });
    }
  };

  const saveSpinConfig = async () => {
    if (!spinConfig) return;
    setSpinSaving(true);
    const { id, ...updateData } = spinConfig;
    const { error } = await supabase
      .from("spin_config")
      .update({
        enabled: updateData.enabled,
        default_network: updateData.default_network,
        payment_required: updateData.payment_required,
        payment_amount: updateData.payment_amount,
        segments: updateData.segments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) {
      console.error("Spin save error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Spin configuration saved!" });
      await fetchSpinConfig();
    }
    setSpinSaving(false);
  };

  const updateSpinConfigNumber = (field: "payment_amount", value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    setSpinConfig(prev => prev ? { ...prev, [field]: isNaN(num) ? 0 : num } : null);
  };

  const updateSpinSegment = (index: number, field: keyof SpinSegment, value: any) => {
    if (!spinConfig) return;
    const newSegments = [...spinConfig.segments];
    if (field === "value") {
      const num = value === "" ? 0 : parseFloat(value);
      newSegments[index] = { ...newSegments[index], value: isNaN(num) ? 0 : num };
    } else if (field === "weight") {
      const num = value === "" ? 0 : parseFloat(value);
      newSegments[index] = { ...newSegments[index], weight: isNaN(num) ? 0 : num };
    } else {
      newSegments[index] = { ...newSegments[index], [field]: value };
    }
    setSpinConfig({ ...spinConfig, segments: newSegments });
  };

  // ======================== Admin permissions ========================
  const fetchCurrentUserPermissions = async (userId: string) => {
    const { data, error } = await supabase
      .from("admin_permissions")
      .select("sections")
      .eq("user_id", userId)
      .single();
    if (!error && data) {
      setCurrentUserSections(data.sections as Section[]);
    } else {
      setCurrentUserSections(["prices", "orders", "agents", "subagents", "topup", "withdrawals", "users", "notifications", "spinwheel", "complaints"]);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    const { data, error } = await supabase
      .from("admin_permissions")
      .select("sections")
      .eq("user_id", userId)
      .single();
    if (!error && data) {
      setUserSections(data.sections as Section[]);
    } else {
      setUserSections([]);
    }
  };

  const saveUserPermissions = async () => {
    if (!selectedUserForPermissions) return;
    setSavingPermissions(true);
    const { error } = await supabase
      .from("admin_permissions")
      .upsert({
        user_id: selectedUserForPermissions.id,
        sections: userSections,
      });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Permissions saved", description: `Updated access for ${selectedUserForPermissions.full_name || selectedUserForPermissions.id}` });
      setPermissionsDialogOpen(false);
      await refreshData(); // silent refresh
    }
    setSavingPermissions(false);
  };

  const makeAdminWithPermissions = async () => {
    if (!selectedUserForAdmin) return;
    setMakingAdmin(true);
    try {
      await supabase.from("user_roles").delete().eq("user_id", selectedUserForAdmin.id);
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: selectedUserForAdmin.id, role: "admin" });
      if (roleError) throw roleError;
      const { error: permError } = await supabase
        .from("admin_permissions")
        .upsert({
          user_id: selectedUserForAdmin.id,
          sections: newAdminSections,
        });
      if (permError) throw permError;
      toast({ title: "Admin created", description: `${selectedUserForAdmin.full_name || selectedUserForAdmin.id} is now an admin with selected permissions.` });
      setMakeAdminDialogOpen(false);
      setSelectedUserForAdmin(null);
      setNewAdminSections([]);
      await refreshData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setMakingAdmin(false);
    }
  };

  const removeAdmin = async (user: UserProfile) => {
    try {
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id)
        .eq("role", "admin");
      if (roleError) throw roleError;
      const { error: permError } = await supabase
        .from("admin_permissions")
        .delete()
        .eq("user_id", user.id);
      if (permError) throw permError;
      toast({ title: "Admin removed", description: `${user.full_name || user.id} is no longer an admin.` });
      await refreshData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchData();
    fetchSpinConfig();
    if (currentUser?.id) {
      fetchCurrentUserPermissions(currentUser.id);
    }
  }, []);

  // ======================== Auto‑retry pending orders ========================
  useEffect(() => {
    const autoRetryPendingOrders = async () => {
      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("fulfillment_status", "pending")
        .eq("status", "paid");
      if (!pendingOrders?.length) return;
      for (const order of pendingOrders) {
        if (retryingOrders.has(order.id)) continue;
        const { data: fresh } = await supabase
          .from("orders")
          .select("fulfillment_status")
          .eq("id", order.id)
          .single();
        if (fresh?.fulfillment_status !== "pending") continue;
        await retryOrder(order.id);
      }
    };
    const interval = setInterval(autoRetryPendingOrders, 30000);
    return () => clearInterval(interval);
  }, [retryingOrders]);

  // ======================== Withdrawal email listener ========================
  useEffect(() => {
    const channel = supabase
      .channel("withdrawal-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "withdrawal_requests" },
        async (payload) => {
          const newWithdrawal = payload.new as WithdrawalRequest;
          const { data: agent } = await supabase
            .from("agent_stores")
            .select("store_name, whatsapp_number, momo_name, momo_number, momo_network, wallet_balance")
            .eq("id", newWithdrawal.agent_store_id)
            .single();
          if (!agent) return;
          const currentBalance = Number(agent.wallet_balance);
          const requestedAmount = Number(newWithdrawal.amount);
          const remainingBalance = currentBalance - requestedAmount;
          try {
            await supabase.functions.invoke("send-withdrawal-notification", {
              body: {
                to: "georgeagyemangsakyi27@gmail.com",
                agentName: agent.store_name,
                contact: agent.whatsapp_number || agent.momo_number || "No contact",
                momoName: agent.momo_name || "Not set",
                amount: requestedAmount,
                currentBalance: currentBalance.toFixed(2),
                remainingBalance: remainingBalance.toFixed(2),
              },
            });
          } catch (err) {
            console.error("Failed to send withdrawal email:", err);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ======================== Price management ========================
  const handlePriceChange = (id: string, field: "price" | "agent_price", value: string) => {
    setEditedPrices((prev) => ({ ...prev, [id]: { ...prev[id], [field]: parseFloat(value) || 0 } }));
  };

  const savePrices = async () => {
    setSaving(true);
    const updates = Object.entries(editedPrices);
    for (const [id, changes] of updates) {
      await supabase.from("data_packages").update(changes).eq("id", id);
    }
    setEditedPrices({});
    await refreshData(); // silent refresh
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
    await refreshData();
    toast({ title: "Package added!" });
  };

  // ======================== Agents ========================
  const toggleApproval = async (agentId: string, approved: boolean) => {
    await supabase.from("agent_stores").update({ approved }).eq("id", agentId);
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, approved } : a)));
    toast({ title: approved ? "Agent approved!" : "Agent suspended" });
  };

  // ======================== Orders ========================
  const retryOrder = async (orderId: string) => {
    if (retryingOrders.has(orderId)) return;
    setRetryingOrders((prev) => new Set(prev).add(orderId));
    try {
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("fulfillment_status, status")
        .eq("id", orderId)
        .single();
      if (!currentOrder) { toast({ title: "Order not found" }); return; }
      if (currentOrder.fulfillment_status === "completed" || currentOrder.fulfillment_status === "failed") {
        toast({ title: "Order already processed", description: `Status: ${currentOrder.fulfillment_status}` });
        return;
      }
      if (currentOrder.status !== "paid") { toast({ title: "Order not paid yet", variant: "destructive" }); return; }
      const { data, error } = await supabase.functions.invoke("fulfill-order", { body: { order_id: orderId } });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Order fulfilled successfully!" });
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, fulfillment_status: "completed" } : o));
      } else {
        toast({ title: "Fulfillment failed", description: data?.message || "Check API balance", variant: "destructive" });
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, fulfillment_status: "failed" } : o));
      }
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

  // ======================== Wallet topup ========================
  const searchTopupRef = () => {
    const found = agents.find((a) => a.topup_reference === topupSearch.trim());
    if (found) setTopupAgent(found);
    else { setTopupAgent(null); toast({ title: "Not found", description: "No agent with that reference code.", variant: "destructive" }); }
  };

  const creditWallet = async () => {
    if (!topupAgent) return;
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setTopupLoading(true);
    const newBalance = Number(topupAgent.wallet_balance) + amount;
    const { error: updateErr } = await supabase.from("agent_stores").update({ wallet_balance: newBalance }).eq("id", topupAgent.id);
    if (updateErr) { toast({ title: "Error", description: updateErr.message, variant: "destructive" }); setTopupLoading(false); return; }
    const { data: newTopup, error: insertErr } = await supabase
      .from("wallet_topups")
      .insert({ agent_store_id: topupAgent.id, amount })
      .select("id, agent_store_id, amount, created_at, agent_stores ( store_name, topup_reference, wallet_balance, momo_name )")
      .single();
    if (!insertErr && newTopup) {
      setTopupHistory((prev) => [newTopup as any, ...prev]);
    }
    setAgents((prev) => prev.map((a) => a.id === topupAgent.id ? { ...a, wallet_balance: newBalance } : a));
    setTopupAgent({ ...topupAgent, wallet_balance: newBalance });
    setTopupAmount("");
    toast({ title: "Wallet credited!", description: `GH₵ ${amount.toFixed(2)} added to ${topupAgent.store_name}` });
    setTopupLoading(false);
  };

  // ======================== Notifications ========================
  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) { toast({ title: "Fill title and message", variant: "destructive" }); return; }
    setSendingNotif(true);
    const effectiveTarget = notifTarget === "user" ? "all" : notifTarget;
    const { error } = await supabase.from("notifications").insert({
      title: notifTitle.trim(),
      message: notifMessage.trim(),
      target_role: effectiveTarget
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Notification sent!" }); setNotifTitle(""); setNotifMessage(""); setNotifTarget("all"); }
    setSendingNotif(false);
  };

  // ======================== Withdrawals ========================
  const processWithdrawal = async (withdrawalId: string, agentStoreId: string, amount: number) => {
    setProcessingWithdrawals((prev) => new Set(prev).add(withdrawalId));
    try {
      const agent = agents.find((a) => a.id === agentStoreId);
      if (!agent) throw new Error("Agent not found");
      const newBalance = Number(agent.wallet_balance) - amount;
      await supabase.from("agent_stores").update({ wallet_balance: newBalance }).eq("id", agentStoreId);
      await supabase.from("withdrawal_requests").update({ status: "completed", processed_at: new Date().toISOString() }).eq("id", withdrawalId);
      setAgents((prev) => prev.map((a) => a.id === agentStoreId ? { ...a, wallet_balance: newBalance } : a));
      setWithdrawals((prev) => prev.map((w) => w.id === withdrawalId ? { ...w, status: "completed", processed_at: new Date().toISOString() } : w));
      toast({ title: "Withdrawal processed!", description: `GH₵ ${amount.toFixed(2)} deducted. New balance: GH₵ ${newBalance.toFixed(2)}.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingWithdrawals((prev) => { const next = new Set(prev); next.delete(withdrawalId); return next; });
    }
  };

  // ======================== Helpers ========================
  const canSee = (section: Section) => currentUserSections.includes(section);

  const filteredPackages = packages.filter((p) => p.network === networkFilter);
  const storeSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const failedCount = orders.filter((o) => o.fulfillment_status === "failed").length;
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  const filteredAgents = agents.filter((agent) => agent.store_name.toLowerCase().includes(agentSearchTerm.toLowerCase()));
  const filteredUsers = users.filter((user) => (user.full_name?.toLowerCase() || "").includes(userSearchTerm.toLowerCase()));
  const filteredOrders = orders.filter((order) => order.customer_number.toLowerCase().includes(orderSearchTerm.toLowerCase()));
  const filteredWithdrawals = withdrawals.filter((withdrawal) => {
    const agent = agents.find((a) => a.id === withdrawal.agent_store_id);
    return agent?.store_name.toLowerCase().includes(withdrawalSearchTerm.toLowerCase()) ?? false;
  });

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

      <div className="container py-4 md:py-8 space-y-4 md:space-y-8 px-2 md:px-4">
        <Tabs defaultValue="prices">
          <TabsList className="mb-6 flex-wrap gap-1 h-auto p-1 md:p-2 bg-background border border-border rounded-lg overflow-x-auto w-full flex">
            {canSee("prices") && <TabsTrigger value="prices" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap">Prices</TabsTrigger>}
            {canSee("orders") && (
              <TabsTrigger value="orders" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1">
                <ShoppingCart className="h-3 w-3 md:h-4 md:w-4" /> Orders
                {failedCount > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">{failedCount}</Badge>}
              </TabsTrigger>
            )}
            {canSee("agents") && <TabsTrigger value="agents" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap">Agents ({agents.filter((a) => !a.approved).length})</TabsTrigger>}
            {canSee("subagents") && <TabsTrigger value="subagents" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Users className="h-3 w-3 md:h-4 md:w-4" /> Subagents ({subagents.filter((s) => !s.approved).length})</TabsTrigger>}
            {canSee("topup") && <TabsTrigger value="topup" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Wallet className="h-3 w-3 md:h-4 md:w-4" /> Topup</TabsTrigger>}
            {canSee("withdrawals") && (
              <TabsTrigger value="withdrawals" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1">
                <ArrowDownToLine className="h-3 w-3 md:h-4 md:w-4" /> Withdrawals
                {pendingWithdrawals.length > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">{pendingWithdrawals.length}</Badge>}
              </TabsTrigger>
            )}
            {canSee("users") && <TabsTrigger value="users" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Users className="h-3 w-3 md:h-4 md:w-4" /> Users</TabsTrigger>}
            {canSee("notifications") && <TabsTrigger value="notifications" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Bell className="h-3 w-3 md:h-4 md:w-4" /> Notify</TabsTrigger>}
            {canSee("spinwheel") && <TabsTrigger value="spinwheel" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Gift className="h-3 w-3 md:h-4 md:w-4" /> Spin</TabsTrigger>}
            {canSee("complaints") && <TabsTrigger value="complaints" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><AlertCircle className="h-3 w-3 md:h-4 md:w-4" /> Complaints</TabsTrigger>}
          </TabsList>

          {/* PRICES TAB */}
          {canSee("prices") && (
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
                  <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Package</Button>
                  {Object.keys(editedPrices).length > 0 && (
                    <Button variant="hero" size="sm" onClick={savePrices} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Changes"}</Button>
                  )}
                </div>
              </div>
              <Card className="border-border">
                <Table>
                  <TableHeader><TableRow><TableHead>Size</TableHead><TableHead>User Price (GH₵)</TableHead><TableHead>Agent Price (GH₵)</TableHead><TableHead>Active</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredPackages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                        <TableCell><Input type="number" step="0.01" defaultValue={pkg.price} onChange={(e) => handlePriceChange(pkg.id, "price", e.target.value)} className="w-24 h-8" /></TableCell>
                        <TableCell><Input type="number" step="0.01" defaultValue={pkg.agent_price} onChange={(e) => handlePriceChange(pkg.id, "agent_price", e.target.value)} className="w-24 h-8" /></TableCell>
                        <TableCell><Switch checked={pkg.active} onCheckedChange={(checked) => toggleActive(pkg.id, checked)} /></TableCell>
                        <TableCell><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deletePackage(pkg.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          )}

          {/* ORDERS TAB */}
          {canSee("orders") && (
            <TabsContent value="orders" className="space-y-4">
              {failedCount > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <p className="text-sm text-foreground"><span className="font-bold text-destructive">{failedCount} failed</span> order(s) — payment received but data not fulfilled. Top up API balance and retry.</p>
                  <Button variant="destructive" size="sm" onClick={retryAllFailed}><RefreshCw className="h-4 w-4 mr-1" /> Retry All Failed</Button>
                </div>
              )}
              <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by phone number..." value={orderSearchTerm} onChange={(e) => setOrderSearchTerm(e.target.value)} className="pl-10" /></div>
              <Card className="border-border">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Phone</TableHead><TableHead>Network</TableHead><TableHead>Size</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Payment</TableHead><TableHead>Fulfillment</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No orders match your search.</TableCell></TableRow> :
                      filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="text-sm text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</TableCell>
                          <TableCell className="font-medium">{order.customer_number}</TableCell>
                          <TableCell className="uppercase text-sm">{order.network}</TableCell>
                          <TableCell className="font-display font-bold">{order.size_gb}GB</TableCell>
                          <TableCell>GH₵ {Number(order.amount).toFixed(2)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{order.payment_method === "wallet" ? "Wallet" : "Paystack"}</Badge></TableCell>
                          <TableCell><Badge variant={order.status === "completed" || order.status === "paid" ? "default" : "secondary"}>{order.status}</Badge></TableCell>
                          <TableCell><Badge variant={order.fulfillment_status === "completed" ? "default" : order.fulfillment_status === "failed" ? "destructive" : "secondary"}>{order.fulfillment_status}</Badge></TableCell>
                          <TableCell>
                            {order.fulfillment_status !== "completed" && (
                              <Button variant="outline" size="sm" onClick={() => retryOrder(order.id)} disabled={retryingOrders.has(order.id)}>
                                {retryingOrders.has(order.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" /> Retry</>}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    }
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          )}

          {/* AGENTS TAB */}
          {canSee("agents") && (
            <TabsContent value="agents" className="space-y-4">
              <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by store name..." value={agentSearchTerm} onChange={(e) => setAgentSearchTerm(e.target.value)} className="pl-10" /></div>
              {filteredAgents.length === 0 ? <p className="text-muted-foreground text-center py-8">No agents match your search.</p> :
                filteredAgents.map((agent) => (
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
                          {agent.approved && <Link to={`/store/${storeSlug(agent.store_name)}`} className="text-xs text-primary hover:underline flex items-center gap-1"><Eye className="h-3 w-3" /> View Store</Link>}
                        </div>
                        <div className="flex items-center gap-2">
                          {agent.approved ? (
                            <><Badge className="bg-green-600/20 text-green-400 border-green-600/30">Approved</Badge><Button variant="outline" size="sm" onClick={() => toggleApproval(agent.id, false)}><X className="h-4 w-4 mr-1" /> Suspend</Button></>
                          ) : (
                            <><Badge variant="secondary">Pending</Badge><Button variant="hero" size="sm" onClick={() => toggleApproval(agent.id, true)}><Check className="h-4 w-4 mr-1" /> Approve</Button></>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              }
            </TabsContent>
          )}

          {/* SUBAGENTS TAB */}
          {canSee("subagents") && (
            <TabsContent value="subagents" className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by store name..." className="pl-10" />
              </div>
              
              {subagents.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="py-12">
                    <p className="text-center text-muted-foreground">No subagents yet.</p>
                  </CardContent>
                </Card>
              ) : (
                subagents.map((subagent) => (
                  <Card key={subagent.id} className="border-border bg-card/50">
                    <CardContent className="p-3 md:p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
                        <div className="flex-1 space-y-2 md:space-y-3 min-w-0">
                          <h3 className="font-display font-bold text-base md:text-lg text-foreground truncate">{subagent.store_name}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-3 text-xs md:text-sm">
                            <div className="min-w-0">
                              <p className="text-muted-foreground text-xs">Parent Agent</p>
                              <p className="font-semibold text-foreground truncate">{subagent.agent_stores?.store_name || 'N/A'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-muted-foreground text-xs">Revenue</p>
                              <p className="font-bold text-green-400">GH₵ {Number(subagent.wallet_balance).toFixed(2)}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-muted-foreground text-xs">WhatsApp</p>
                              <p className="font-semibold text-foreground">{subagent.whatsapp_number}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-muted-foreground text-xs">Support</p>
                              <p className="font-semibold text-foreground">{subagent.support_number}</p>
                            </div>
                            <div className="col-span-2 md:col-span-2 min-w-0">
                              <p className="text-muted-foreground text-xs mb-1">MoMo Account</p>
                              <p className="font-semibold text-foreground truncate">{subagent.momo_name} • {subagent.momo_number} ({subagent.momo_network.toUpperCase()})</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <Badge className="bg-green-600/20 text-green-400 border-green-600/30 font-semibold">
                            Active
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          )}

          {/* TOPUP TAB */}
          {canSee("topup") && (
            <TabsContent value="topup" className="space-y-6">
              <Card className="border-border">
                <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Credit Agent Wallet</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Enter Topup Reference (5+ digits)" value={topupSearch} onChange={(e) => setTopupSearch(e.target.value)} className="pl-10" onKeyDown={(e) => e.key === "Enter" && searchTopupRef()} />
                    </div>
                    <Button variant="hero" onClick={searchTopupRef}><Search className="h-4 w-4 mr-1" /> Search</Button>
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
                        <div className="flex-1 space-y-1"><Label>Amount to Credit (GH₵)</Label><Input type="number" step="0.01" placeholder="e.g. 50.00" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} /></div>
                        <Button variant="hero" onClick={creditWallet} disabled={topupLoading}>{topupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wallet className="h-4 w-4 mr-1" />} Credit</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardHeader><CardTitle className="font-display text-lg">Top‑up History</CardTitle></CardHeader>
                <CardContent>
                  {topupHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No top‑ups recorded yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Store</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>MoMo Name</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Store Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topupHistory.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">{new Date(t.created_at).toLocaleString()}</TableCell>
                            <TableCell className="font-medium">{t.agent_stores?.store_name ?? "—"}</TableCell>
                            <TableCell className="text-primary">{t.agent_stores?.topup_reference ?? "—"}</TableCell>
                            <TableCell>{t.agent_stores?.momo_name ?? "—"}</TableCell>
                            <TableCell>GH₵ {Number(t.amount).toFixed(2)}</TableCell>
                            <TableCell>GH₵ {t.agent_stores?.wallet_balance?.toFixed(2) ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* WITHDRAWALS TAB */}
          {canSee("withdrawals") && (
            <TabsContent value="withdrawals" className="space-y-4">
              {pendingWithdrawals.length > 0 && (
                <div className="p-4 rounded-lg border border-yellow-600/30 bg-yellow-600/5">
                  <p className="text-sm text-foreground"><span className="font-bold text-yellow-400">{pendingWithdrawals.length} pending</span> withdrawal request(s) awaiting processing.</p>
                </div>
              )}
              <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by agent store name..." value={withdrawalSearchTerm} onChange={(e) => setWithdrawalSearchTerm(e.target.value)} className="pl-10" /></div>
              <Card className="border-border">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Agent</TableHead><TableHead>Amount</TableHead><TableHead>Wallet Balance</TableHead><TableHead>MoMo Name</TableHead><TableHead>MoMo Number</TableHead><TableHead>Network</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredWithdrawals.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No withdrawals match your search.</TableCell></TableRow> :
                      filteredWithdrawals.map((w) => {
                        const agent = agents.find((a) => a.id === w.agent_store_id);
                        return (
                          <TableRow key={w.id}>
                            <TableCell className="text-sm text-muted-foreground">{new Date(w.created_at).toLocaleString()}</TableCell>
                            <TableCell className="font-medium">{agent?.store_name ?? "—"}</TableCell>
                            <TableCell className="font-display font-bold text-primary">GH₵ {Number(w.amount).toFixed(2)}</TableCell>
                            <TableCell className="font-bold text-green-400">GH₵ {Number(agent?.wallet_balance ?? 0).toFixed(2)}</TableCell>
                            <TableCell>{agent?.momo_name ?? "—"}</TableCell>
                            <TableCell className="font-mono">{agent?.momo_number ?? "—"}</TableCell>
                            <TableCell className="uppercase text-sm">{agent?.momo_network ?? "—"}</TableCell>
                            <TableCell><Badge className={w.status === "completed" ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>{w.status}</Badge></TableCell>
                            <TableCell>
                              {w.status === "pending" && (
                                <Button variant="hero" size="sm" onClick={() => processWithdrawal(w.id, w.agent_store_id, Number(w.amount))} disabled={processingWithdrawals.has(w.id)}>
                                  {processingWithdrawals.has(w.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Confirm Sent</>}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    }
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          )}

          {/* USERS TAB */}
          {canSee("users") && (
            <TabsContent value="users" className="space-y-4">
              <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className="pl-10" /></div>
              <Card className="border-border">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                        <TableCell><Badge variant={u.role === "admin" ? "default" : u.role === "agent" ? "secondary" : "outline"}>{u.role}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="space-x-2">
                          {u.role !== "admin" ? (
                            <Button variant="outline" size="sm" onClick={() => {
                              setSelectedUserForAdmin(u);
                              setNewAdminSections(["prices", "orders", "agents", "topup", "withdrawals", "users", "notifications", "spinwheel", "complaints"]);
                              setMakeAdminDialogOpen(true);
                            }}>
                              <ShieldAlert className="h-4 w-4 mr-1" /> Make Admin
                            </Button>
                          ) : (
                            <>
                              <Button variant="outline" size="sm" onClick={() => {
                                setSelectedUserForPermissions(u);
                                fetchUserPermissions(u.id);
                                setPermissionsDialogOpen(true);
                              }}>
                                <ShieldAlert className="h-4 w-4 mr-1" /> Set Permissions
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => removeAdmin(u)}>
                                <Trash2 className="h-4 w-4 mr-1" /> Remove Admin
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          )}

          {/* NOTIFICATIONS TAB */}
          {canSee("notifications") && (
            <TabsContent value="notifications" className="space-y-6">
              <Card className="border-border">
                <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Send Notification</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select value={notifTarget} onValueChange={setNotifTarget}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users & Agents (including non‑logged‑in)</SelectItem>
                        <SelectItem value="user">Users Only (also shown to non‑logged‑in visitors)</SelectItem>
                        <SelectItem value="agent">Agents Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Note: "User" target will also be visible to non‑logged‑in visitors.</p>
                  </div>
                  <div className="space-y-2"><Label>Title</Label><Input placeholder="Notification title" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Message</Label><Textarea placeholder="Write your message here..." value={notifMessage} onChange={(e) => setNotifMessage(e.target.value)} rows={4} /></div>
                  <Button variant="hero" onClick={sendNotification} disabled={sendingNotif}>{sendingNotif ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />} Send Notification</Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* SPIN WHEEL TAB */}
          {canSee("spinwheel") && spinConfig && (
            <TabsContent value="spinwheel" className="space-y-6">
              <Card className="border-border">
                <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Spin Wheel Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Enable Spin Wheel</Label>
                      <p className="text-sm text-muted-foreground">When disabled, the spin button will not appear on the Packages page.</p>
                    </div>
                    <Switch checked={spinConfig.enabled} onCheckedChange={(checked) => setSpinConfig({ ...spinConfig, enabled: checked })} />
                  </div>

                  <div className="space-y-4 border p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Require Payment</Label>
                        <p className="text-sm text-muted-foreground">If OFF, spins are free (no Paystack).</p>
                      </div>
                      <Switch checked={spinConfig.payment_required} onCheckedChange={(checked) => setSpinConfig({ ...spinConfig, payment_required: checked })} />
                    </div>
                    {spinConfig.payment_required && (
                      <div className="flex items-center gap-4">
                        <Label>Payment Amount (GHS)</Label>
                        <Input type="number" step="0.5" className="w-28" value={spinConfig.payment_amount} onChange={(e) => updateSpinConfigNumber("payment_amount", e.target.value)} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Default Network (shown big and bold on wheel)</Label>
                    <Select value={spinConfig.default_network} onValueChange={(val) => setSpinConfig({ ...spinConfig, default_network: val })}>
                      <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mtn">MTN</SelectItem>
                        <SelectItem value="airteltigo">AirtelTigo</SelectItem>
                        <SelectItem value="telecel">Telecel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Wheel Segments (9 slots)</Label>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          if (spinConfig.segments.length >= 12) {
                            toast({ title: "Max 12 segments", variant: "destructive" });
                            return;
                          }
                          setSpinConfig({ ...spinConfig, segments: [...spinConfig.segments, { type: "message", value: "", label: "New", weight: 1 }] });
                        }}>
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          if (spinConfig.segments.length <= 2) {
                            toast({ title: "Minimum 2 segments", variant: "destructive" });
                            return;
                          }
                          setSpinConfig({ ...spinConfig, segments: spinConfig.segments.slice(0, -1) });
                        }}>
                          <Trash2 className="h-4 w-4 mr-1" /> Remove Last
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Each segment’s label, type, and weight. Higher weight = higher chance. (Min 2, Max 12)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {spinConfig.segments.map((seg, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">Slot {idx + 1}</Badge>
                              <Select value={seg.type} onValueChange={(val) => updateSpinSegment(idx, "type", val)}>
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gb">GB Prize</SelectItem>
                                  <SelectItem value="message">Message</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {seg.type === "gb" ? (
                              <>
                                <Input type="number" placeholder="GB value" value={seg.value} onChange={(e) => updateSpinSegment(idx, "value", e.target.value)} />
                                <Input placeholder="Label (e.g., 1 GB)" value={seg.label} onChange={(e) => updateSpinSegment(idx, "label", e.target.value)} />
                              </>
                            ) : (
                              <Input placeholder="Motivational message" value={seg.label} onChange={(e) => updateSpinSegment(idx, "label", e.target.value)} />
                            )}
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Weight</Label>
                              <Input type="number" className="w-24" value={seg.weight} onChange={(e) => updateSpinSegment(idx, "weight", e.target.value)} />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Button onClick={saveSpinConfig} disabled={spinSaving}>
                    {spinSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save Spin Configuration
                  </Button>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Wheel Preview ({spinConfig.segments.length} segments)</p>
                    <div className="w-48 h-48 relative mx-auto">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {spinConfig.segments.map((_, i) => {
                          const count = spinConfig.segments.length;
                          const start = (i * 360) / count;
                          const end = ((i + 1) * 360) / count;
                          const x1 = 50 + 40 * Math.cos((start * Math.PI) / 180);
                          const y1 = 50 + 40 * Math.sin((start * Math.PI) / 180);
                          const x2 = 50 + 40 * Math.cos((end * Math.PI) / 180);
                          const y2 = 50 + 40 * Math.sin((end * Math.PI) / 180);
                          const largeArc = end - start <= 180 ? 0 : 1;
                          const d = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                          const textAngle = start + (end - start) / 2;
                          const tx = 50 + 25 * Math.cos((textAngle * Math.PI) / 180);
                          const ty = 50 + 25 * Math.sin((textAngle * Math.PI) / 180);
                          const colors = ["#ff6384", "#36a2eb", "#ffce56", "#4bc0c0", "#9966ff", "#ff9f40", "#8e5ea2", "#3cba9f", "#e8c3b9"];
                          return (
                            <g key={i}>
                              <path d={d} fill={colors[i % colors.length]} stroke="white" strokeWidth="0.5" />
                              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="4" fill="white" fontWeight="bold">{i + 1}</text>
                            </g>
                          );
                        })}
                        <circle cx="50" cy="50" r="8" fill="white" stroke="#333" strokeWidth="1" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* COMPLAINTS TAB */}
          {canSee("complaints") && (
            <TabsContent value="complaints" className="space-y-6">
              <ComplaintsManager />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Dialogs (unchanged) */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader><DialogTitle className="font-display">Add New Package</DialogTitle><DialogDescription>Create a new data package.</DialogDescription></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Network</Label><Select value={newPkg.network} onValueChange={(v) => setNewPkg((p) => ({ ...p, network: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mtn">MTN</SelectItem><SelectItem value="airteltigo">AirtelTigo</SelectItem><SelectItem value="telecel">Telecel</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Size (GB)</Label><Input type="number" placeholder="e.g. 5" value={newPkg.size_gb} onChange={(e) => setNewPkg((p) => ({ ...p, size_gb: e.target.value }))} /></div>
            <div className="space-y-2"><Label>User Price (GH₵)</Label><Input type="number" step="0.01" placeholder="e.g. 15.00" value={newPkg.price} onChange={(e) => setNewPkg((p) => ({ ...p, price: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Agent Price (GH₵)</Label><Input type="number" step="0.01" placeholder="e.g. 12.00" value={newPkg.agent_price} onChange={(e) => setNewPkg((p) => ({ ...p, agent_price: e.target.value }))} /></div>
            <Button variant="hero" className="w-full" onClick={addPackage}><Plus className="h-4 w-4 mr-1" /> Add Package</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Admin Permissions for {selectedUserForPermissions?.full_name || selectedUserForPermissions?.id}</DialogTitle><DialogDescription>Select which sections this admin can access.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {(["prices", "orders", "agents", "topup", "withdrawals", "users", "notifications", "spinwheel", "complaints"] as Section[]).map(section => (
              <div key={section} className="flex items-center gap-2">
                <Switch checked={userSections.includes(section)} onCheckedChange={() => setUserSections(prev => prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section])} id={`perm-${section}`} />
                <Label htmlFor={`perm-${section}`} className="capitalize">{section}</Label>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={saveUserPermissions} disabled={savingPermissions}>
              {savingPermissions ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={makeAdminDialogOpen} onOpenChange={setMakeAdminDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Make Admin: {selectedUserForAdmin?.full_name || selectedUserForAdmin?.id}</DialogTitle><DialogDescription>Select which sections this new admin can access.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {(["prices", "orders", "agents", "topup", "withdrawals", "users", "notifications", "spinwheel"] as Section[]).map(section => (
              <div key={section} className="flex items-center gap-2">
                <Switch checked={newAdminSections.includes(section)} onCheckedChange={() => setNewAdminSections(prev => prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section])} id={`new-perm-${section}`} />
                <Label htmlFor={`new-perm-${section}`} className="capitalize">{section}</Label>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setMakeAdminDialogOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={makeAdminWithPermissions} disabled={makingAdmin}>
              {makingAdmin ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldAlert className="h-4 w-4 mr-1" />}
              Confirm Admin
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
