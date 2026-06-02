import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedRealtime } from "@/hooks/useOptimizedRealtime";
import { useDatabaseSearch } from "@/hooks/useDatabaseSearch";
import { usePaginatedData } from "@/hooks/usePaginatedData";
import { PaginatedTableFooter } from "@/components/PaginatedTableFooter";
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
  Loader2, Wallet, Search, Bell, Send, ArrowDownToLine, ShieldAlert, Gift, AlertCircle, Settings2, Megaphone, Smartphone, LogIn,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import ComplaintsManager from "@/components/ComplaintsManager";
import PushNotificationManager from "@/components/PushNotificationManager";
import AdminAFAManagementTabs from "@/components/AdminAFAManagementTabs";
import { DOMAINS } from "@/config/domains";
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
    subagent_commission_balance?: number;
  }
interface UserProfile {
  id: string; full_name: string | null; phone: string | null; created_at: string | null; role: string;
}
interface Order {
  id: string; customer_number: string; network: string; size_gb: number; amount: number;
  status: string; fulfillment_status: string; api_response: string | null;
  paystack_reference: string | null; created_at: string | null; agent_store_id: string | null;
  payment_method: string; subagent_store_id?: string | null;
}
  interface WithdrawalRequest {
    id: string; agent_store_id: string | null; subagent_store_id?: string | null; amount: number; status: string;
    created_at: string; processed_at: string | null; withdrawal_source?: string;
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
type Section = "prices" | "orders" | "agents" | "subagents" | "topup" | "withdrawals" | "users" | "notifications" | "push" | "spinwheel" | "complaints" | "settings";

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
  
  // Total counts from database
  const [totalCounts, setTotalCounts] = useState({ orders: 0, agents: 0, subagents: 0, users: 0, withdrawals: 0, topups: 0, complaints: 0 });
  
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
  const [subagentSearchTerm, setSubagentSearchTerm] = useState("");
  const [topupSearchTerm, setTopupSearchTerm] = useState("");
  const [complaintSearchTerm, setComplaintSearchTerm] = useState("");

  // Filter states for Orders, Agents, and Subagents
  const [orderNetworkFilter, setOrderNetworkFilter] = useState<string>("all");
  const [orderFulfillmentFilter, setOrderFulfillmentFilter] = useState<string>("all");
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState<string>("all");
  const [agentApprovalFilter, setAgentApprovalFilter] = useState<string>("all");
  const [subagentStatusFilter, setSubagentStatusFilter] = useState<string>("all");

  // Pagination state
  const [agentPage, setAgentPage] = useState(1);
  const [subagentPage, setSubagentPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [topupPage, setTopupPage] = useState(1);
  const PAGE_SIZE = 100;

  // Agent-specific pricing state
  const [agentPriceDialogOpen, setAgentPriceDialogOpen] = useState(false);
  const [selectedAgentForPricing, setSelectedAgentForPricing] = useState<AgentStore | null>(null);
  const [agentCustomPrices, setAgentCustomPrices] = useState<Record<string, number>>({});
  const [loadingAgentPrices, setLoadingAgentPrices] = useState(false);

  // Database search hooks for real-time searching
  const orderSearch = useDatabaseSearch<Order>(
    "orders",
    "customer_number",
    "id, customer_number, network, size_gb, amount, status, fulfillment_status, api_response, paystack_reference, created_at, agent_store_id, payment_method, subagent_store_id"
  );
  
  const profileSearch = useDatabaseSearch<UserProfile>(
    "profiles",
    "full_name",
    "id, full_name, phone, created_at"
  );
  
  const withdrawalSearch = useDatabaseSearch<WithdrawalRequest>(
    "withdrawal_requests",
    "agent_store_id",
    "id, agent_store_id, subagent_store_id, amount, status, created_at, processed_at, withdrawal_source"
  );
  const [savingAgentPrices, setSavingAgentPrices] = useState(false);
  const [agentPriceNetworkFilter, setAgentPriceNetworkFilter] = useState("mtn");

  const [topupSearch, setTopupSearch] = useState("");
  const [topupAgent, setTopupAgent] = useState<AgentStore | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTarget, setNotifTarget] = useState("all");
  const [notifExpiresAt, setNotifExpiresAt] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [deletingNotif, setDeletingNotif] = useState<string | null>(null);

  // Spin wheel state
  const [spinConfig, setSpinConfig] = useState<{
    id: number;
    enabled: boolean;
    default_network: string;
    payment_required: boolean;
    payment_amount: number;
    segments: SpinSegment[];
    // Prize probabilities (percentages)
    chance_2gb: number;
    chance_1gb: number;
    chance_extra_spin: number;
    // Auto-disable settings
    auto_disable_enabled: boolean;
    auto_disable_order_limit: number;
    current_spin_orders: number;
    display_spin_orders: number; // Admin can manipulate what users see
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
  
  // Source info dialog state
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<{ type: string; storeName: string; contact: string } | null>(null);
  
  // App settings state
  const [agentRegistrationFee, setAgentRegistrationFee] = useState(30);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Free Data Offer settings
  const [freeDataConfig, setFreeDataConfig] = useState({
    enabled: true,
    required_gb: 35,
    reward_gb: 1,
    telecel_enabled: false,
  });
  const [freeDataSaving, setFreeDataSaving] = useState(false);

  // ======================== Data fetching (initial) ========================
  const fetchData = async () => {
    setDataLoading(true);
    await refreshData();
    setDataLoading(false);
  };

  // Helper function to fetch records with pagination (NOT all records)
  // Only fetches first 200 records to prevent database timeout
  const fetchRecords = async (table: string, select: string = "*", orderBy?: { column: string; ascending: boolean }, limit: number = 200) => {
    try {
      let query = supabase.from(table).select(select).limit(limit);
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending });
      }
      const { data, error } = await query;
      if (error) {
        console.error(`Error fetching ${table}:`, error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error(`Exception fetching ${table}:`, err);
      return [];
    }
  };

  // Silent background refresh (no loading state)
  const refreshData = async () => {
    // Fetch all counts first
    const [ordersCount, agentsCount, subagentsCount, usersCount, withdrawalsCount, topupsCount] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("agent_stores").select("id", { count: "exact", head: true }),
      supabase.from("subagent_stores").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }),
      supabase.from("wallet_topups").select("id", { count: "exact", head: true }),
    ]);
    
    // Set total counts immediately
    setTotalCounts({
      orders: ordersCount.count ?? 0,
      agents: agentsCount.count ?? 0,
      subagents: subagentsCount.count ?? 0,
      users: usersCount.count ?? 0,
      withdrawals: withdrawalsCount.count ?? 0,
      topups: topupsCount.count ?? 0,
      complaints: 0,
    });

    // Fetch records with pagination (first 200 of each)
    // Only fetch columns that are actually used in the UI
    // This reduces network payload and prevents database timeouts
    const [pkgData, agentData, profilesData, rolesData, ordersData, withdrawData, topupData, subagentData] = await Promise.all([
      supabase.from("data_packages").select("id, network, size_gb, price, agent_price, active").order("size_gb").limit(100),
      fetchRecords("agent_stores", "id, user_id, store_name, whatsapp_number, support_number, whatsapp_group, momo_number, momo_name, momo_network, approved, created_at, wallet_balance, topup_reference, subagent_commission_balance", { column: "created_at", ascending: false }, 200),
      fetchRecords("profiles", "id, full_name, phone, created_at", { column: "created_at", ascending: false }, 100),
      fetchRecords("user_roles", "user_id, role", undefined, 500),
      fetchRecords("orders", "id, customer_number, network, size_gb, amount, status, fulfillment_status, api_response, paystack_reference, created_at, agent_store_id, payment_method, subagent_store_id", { column: "created_at", ascending: false }, 100),
      fetchRecords("withdrawal_requests", "id, agent_store_id, subagent_store_id, amount, status, created_at, processed_at, withdrawal_source", { column: "created_at", ascending: false }, 1000),
      fetchRecords("wallet_topups", "id, agent_store_id, amount, created_at, agent_stores ( store_name, topup_reference, wallet_balance, momo_name )", { column: "created_at", ascending: false }, 200),
      fetchRecords("subagent_stores", "id, store_name, agent_store_id, created_at, agent_stores(store_name, id, user_id)", { column: "created_at", ascending: false }, 200),
    ]);
    
    setPackages(pkgData.data ?? []);
    setAgents((agentData as AgentStore[]) ?? []);
    setOrders((ordersData as Order[]) ?? []);
    setWithdrawals((withdrawData as WithdrawalRequest[]) ?? []);
    setTopupHistory((topupData as any[]) ?? []);
    setSubagents((subagentData ?? []));

    const rolesMap: Record<string, string> = {};
    (rolesData ?? []).forEach((r: any) => { rolesMap[r.user_id] = r.role; });
    const userList = (profilesData ?? []).map((p: any) => ({ ...p, role: rolesMap[p.id] || "user" }));
    setUsers(userList);
    
    // Fetch app settings
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("agent_registration_fee, free_data_enabled, free_data_required_gb, free_data_reward_gb, free_data_telecel_enabled")
      .eq("id", 1)
      .single();
    if (appSettings?.agent_registration_fee) {
      setAgentRegistrationFee(appSettings.agent_registration_fee);
    }
    if (appSettings) {
      setFreeDataConfig({
        enabled: appSettings.free_data_enabled ?? true,
        required_gb: appSettings.free_data_required_gb ?? 35,
        reward_gb: appSettings.free_data_reward_gb ?? 1,
        telecel_enabled: appSettings.free_data_telecel_enabled ?? false,
      });
    }
  };
  
  // Save app settings
  const saveAppSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: 1, agent_registration_fee: agentRegistrationFee, updated_at: new Date().toISOString() });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved!" });
    }
    setSavingSettings(false);
  };
  
  // Save free data offer settings
  const saveFreeDataSettings = async () => {
    setFreeDataSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ 
        id: 1, 
        free_data_enabled: freeDataConfig.enabled,
        free_data_required_gb: freeDataConfig.required_gb,
        free_data_reward_gb: freeDataConfig.reward_gb,
        free_data_telecel_enabled: freeDataConfig.telecel_enabled,
        updated_at: new Date().toISOString() 
      });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Free Data Settings saved!" });
    }
    setFreeDataSaving(false);
  };
  
  // Fetch notifications
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(data || []);
  };
  
  // Delete notification
  const deleteNotification = async (id: string) => {
    setDeletingNotif(id);
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notification deleted" });
      fetchNotifications();
    }
    setDeletingNotif(null);
  };

  // ======================== Delete Subagent ========================
  const deleteSubagent = async (subagentId: string, subagentName: string) => {
    if (!confirm(`Are you sure you want to delete subagent "${subagentName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // First delete related records to avoid foreign key constraints
      await supabase.from("orders").delete().eq("subagent_store_id", subagentId);
      await supabase.from("withdrawal_requests").delete().eq("subagent_store_id", subagentId);
      await supabase.from("subagent_wallet_topups").delete().eq("subagent_store_id", subagentId);
      await supabase.from("subagent_package_prices").delete().eq("subagent_store_id", subagentId);
      
      const { error } = await supabase.from("subagent_stores").delete().eq("id", subagentId);
      
      if (error) {
        console.error("[v0] Delete subagent error:", error);
        toast({ title: "Error", description: `Failed to delete subagent: ${error.message}`, variant: "destructive" });
        return;
      }
      
      toast({ title: "Success", description: `Subagent "${subagentName}" has been deleted` });
      setSubagents(subagents.filter(s => s.id !== subagentId));
    } catch (err) {
      console.error("[v0] Delete subagent error:", err);
      toast({ title: "Error", description: "Failed to delete subagent", variant: "destructive" });
    }
  };

  // ======================== Suspend/Unsuspend Subagent ========================
  const toggleSubagentSuspension = async (subagentId: string, currentSuspended: boolean, subagentName: string) => {
    try {
      console.log("[v0] Toggling suspension:", { subagentId, currentSuspended, newValue: !currentSuspended });
      
      const { error } = await supabase
        .from("subagent_stores")
        .update({ suspended: !currentSuspended })
        .eq("id", subagentId);
      
      if (error) {
        console.error("[v0] Suspend error:", error);
        toast({ title: "Error", description: `Failed to update subagent status: ${error.message}`, variant: "destructive" });
        return;
      }
      
      const action = currentSuspended ? "unsuspended" : "suspended";
      toast({ title: "Success", description: `Subagent "${subagentName}" has been ${action}` });
      setSubagents(subagents.map(s => s.id === subagentId ? { ...s, suspended: !currentSuspended } : s));
    } catch (err) {
      console.error("[v0] Toggle subagent suspension error:", err);
      toast({ title: "Error", description: "Failed to update subagent status", variant: "destructive" });
    }
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
    setSpinConfig({
      ...data,
      chance_2gb: data.chance_2gb ?? 4,
      chance_1gb: data.chance_1gb ?? 9,
      chance_extra_spin: data.chance_extra_spin ?? 12,
      auto_disable_enabled: data.auto_disable_enabled ?? false,
      auto_disable_order_limit: data.auto_disable_order_limit ?? 100,
      current_spin_orders: data.current_spin_orders ?? 0,
      display_spin_orders: data.display_spin_orders ?? 0,
    });
  } else {
    setSpinConfig({
      id: 1,
      enabled: false,
      default_network: "mtn",
      payment_required: true,
      payment_amount: 2,
      segments: [],
      chance_2gb: 4,
      chance_1gb: 9,
      chance_extra_spin: 12,
      auto_disable_enabled: false,
      auto_disable_order_limit: 100,
      current_spin_orders: 0,
      display_spin_orders: 0,
    });
  }
  };

  const saveSpinConfig = async () => {
    if (!spinConfig) return;
    setSpinSaving(true);
    const updateData = {
      enabled: spinConfig.enabled,
      default_network: spinConfig.default_network,
      payment_required: spinConfig.payment_required,
      payment_amount: spinConfig.payment_amount,
      segments: spinConfig.segments,
      chance_2gb: spinConfig.chance_2gb,
      chance_1gb: spinConfig.chance_1gb,
      chance_extra_spin: spinConfig.chance_extra_spin,
      auto_disable_enabled: spinConfig.auto_disable_enabled,
      auto_disable_order_limit: spinConfig.auto_disable_order_limit,
      current_spin_orders: spinConfig.current_spin_orders,
      display_spin_orders: spinConfig.display_spin_orders,
    };
    const { error } = await supabase
      .from("spin_config")
      .update({
        ...updateData,
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
      setCurrentUserSections(["prices", "orders", "agents", "subagents", "topup", "withdrawals", "users", "notifications", "push", "spinwheel", "complaints", "settings"]);
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
    fetchNotifications();
    if (currentUser?.id) {
      fetchCurrentUserPermissions(currentUser.id);
    }
  }, []);
  
  // Optimized Realtime subscriptions with debouncing
  // Instead of refreshing on every change, we debounce for 2 seconds
  // This means rapid changes (like multiple orders) only trigger ONE refresh
  useOptimizedRealtime(
    () => refreshData(),
    2000, // 2 second debounce
    [
      { name: 'orders' },
      { name: 'agent_stores' },
      { name: 'subagent_stores' },
      { name: 'withdrawal_requests' },
      { name: 'wallet_topups' },
      { name: 'profiles' },
    ]
  );

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

  // Background auto-refresh every 1 second (silent, no page flicker)
  // ONLY refreshes display data - does NOT touch form edits or editedPrices
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Silently refresh ONLY display data in background
      const refreshBackgroundData = async () => {
        try {
          // Fetch counts only (lightweight) - DO NOT touch form data
          const [ordersCount, agentsCount, subagentsCount, usersCount, withdrawalsCount, topupsCount, complaintRes] = await Promise.all([
            supabase.from("orders").select("id", { count: "exact", head: true }),
            supabase.from("agent_stores").select("id", { count: "exact", head: true }),
            supabase.from("subagent_stores").select("id", { count: "exact", head: true }),
            supabase.from("profiles").select("id", { count: "exact", head: true }),
            supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }),
            supabase.from("wallet_topups").select("id", { count: "exact", head: true }),
            supabase.from("complaints").select("id", { count: "exact", head: true }),
          ]);

          // Update ONLY display counts - never touches editedPrices or any forms
          if (ordersCount.count !== undefined) {
            setTotalCounts((prev) => ({
              ...prev,
              orders: ordersCount.count ?? 0,
              agents: agentsCount.count ?? 0,
              subagents: subagentsCount.count ?? 0,
              users: usersCount.count ?? 0,
              withdrawals: withdrawalsCount.count ?? 0,
              topups: topupsCount.count ?? 0,
              complaints: complaintRes.count ?? 0,
            }));
          }
        } catch (error) {
          console.error("[v0] Background refresh error:", error);
          // Fail silently - no error toast to avoid interrupting admin
        }
      };

      refreshBackgroundData();
    }, 1000); // Refresh every 1 second

    return () => clearInterval(intervalId);
  }, []);

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

  // ======================== Agent-Specific Pricing ========================
  const openAgentPricingDialog = async (agent: AgentStore) => {
    setSelectedAgentForPricing(agent);
    setAgentPriceDialogOpen(true);
    setLoadingAgentPrices(true);
    setAgentCustomPrices({});
    
    // Load existing custom prices for this agent
    const { data, error } = await supabase
      .from("agent_custom_base_prices")
      .select("*")
      .eq("agent_store_id", agent.id);
    
    if (!error && data) {
      const priceMap: Record<string, number> = {};
      data.forEach((row: any) => {
        priceMap[row.package_id] = row.custom_base_price;
      });
      setAgentCustomPrices(priceMap);
    }
    setLoadingAgentPrices(false);
  };

  const handleAgentPriceChange = (packageId: string, value: string) => {
    setAgentCustomPrices(prev => ({
      ...prev,
      [packageId]: parseFloat(value) || 0
    }));
  };

  const saveAgentCustomPrices = async () => {
    if (!selectedAgentForPricing) return;
    setSavingAgentPrices(true);
    
    try {
      // Delete existing custom prices for this agent
      await supabase
        .from("agent_custom_base_prices")
        .delete()
        .eq("agent_store_id", selectedAgentForPricing.id);
      
      // Insert new custom prices
      const insertData = Object.entries(agentCustomPrices)
        .filter(([_, price]) => price > 0)
        .map(([packageId, price]) => ({
          agent_store_id: selectedAgentForPricing.id,
          package_id: packageId,
          custom_base_price: price
        }));
      
      if (insertData.length > 0) {
        const { error } = await supabase
          .from("agent_custom_base_prices")
          .insert(insertData);
        
        if (error) throw error;
      }
      
      toast({ title: "Success", description: `Custom prices saved for ${selectedAgentForPricing.store_name}` });
      setAgentPriceDialogOpen(false);
    } catch (error) {
      console.error("Error saving agent custom prices:", error);
      toast({ title: "Error", description: "Failed to save custom prices", variant: "destructive" });
    } finally {
      setSavingAgentPrices(false);
    }
  };

  const resetAgentToDefaultPrices = async () => {
    if (!selectedAgentForPricing) return;
    if (!confirm(`Reset ${selectedAgentForPricing.store_name} to default prices? This will remove all custom prices.`)) return;
    
    setSavingAgentPrices(true);
    try {
      await supabase
        .from("agent_custom_base_prices")
        .delete()
        .eq("agent_store_id", selectedAgentForPricing.id);
      
      setAgentCustomPrices({});
      toast({ title: "Success", description: "Agent reset to default prices" });
      setAgentPriceDialogOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to reset prices", variant: "destructive" });
    } finally {
      setSavingAgentPrices(false);
    }
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
      if (currentOrder.fulfillment_status === "completed") {
        toast({ title: "Order already completed", description: "This order has already been fulfilled successfully." });
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
    const failedOrders = orders.filter((o) => o.fulfillment_status === "failed" && o.status === "paid");
    if (failedOrders.length === 0) {
      toast({ title: "No failed orders", description: "There are no failed orders to retry." });
      return;
    }
    toast({ title: "Retrying failed orders", description: `Retrying ${failedOrders.length} failed order(s)...` });
    for (const order of failedOrders) { await retryOrder(order.id); }
  };

  // Toggle order fulfillment status
  const toggleOrderFulfillment = async (orderId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    const { error } = await supabase
      .from("orders")
      .update({ fulfillment_status: newStatus })
      .eq("id", orderId);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, fulfillment_status: newStatus } : o)
    );

    const action = newStatus === "completed" ? "marked as completed" : "marked as pending";
    toast({ title: "Success", description: `Order ${action}` });
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
    const insertData: any = {
      title: notifTitle.trim(),
      message: notifMessage.trim(),
      target_role: effectiveTarget
    };
    if (notifExpiresAt) {
      insertData.expires_at = new Date(notifExpiresAt).toISOString();
    }
    const { error } = await supabase.from("notifications").insert(insertData);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { 
      toast({ title: "Notification sent!" }); 
      setNotifTitle(""); 
      setNotifMessage(""); 
      setNotifTarget("all"); 
      setNotifExpiresAt("");
      fetchNotifications();
    }
    setSendingNotif(false);
  };

  // ======================== Withdrawals ========================
  const processWithdrawal = async (withdrawalId: string, agentStoreId: string | null, amount: number, withdrawalSource: string = "wallet", subagentStoreId?: string | null) => {
    setProcessingWithdrawals((prev) => new Set(prev).add(withdrawalId));
    try {
      // Re-fetch the withdrawal to get the correct source and IDs
      const { data: withdrawalData } = await supabase
        .from("withdrawal_requests")
        .select("withdrawal_source, agent_store_id, subagent_store_id")
        .eq("id", withdrawalId)
        .single();
      
      const confirmedSource = withdrawalData?.withdrawal_source || withdrawalSource || "wallet";
      const isSubagentWithdrawal = !!withdrawalData?.subagent_store_id;
      const isSubagentProfit = confirmedSource === "subagent_commission";
      
      if (isSubagentWithdrawal) {
        // SUBAGENT WITHDRAWAL - fetch fresh balance from database first
        const { data: freshSubagent, error: fetchError } = await supabase
          .from("subagent_stores")
          .select("wallet_balance")
          .eq("id", withdrawalData.subagent_store_id)
          .single();
        
        if (fetchError || !freshSubagent) throw new Error("Failed to fetch subagent balance");
        
        const currentBalance = Number(freshSubagent.wallet_balance ?? 0);
        const newBalance = currentBalance - amount;
        
        await supabase.from("subagent_stores").update({ wallet_balance: newBalance }).eq("id", withdrawalData.subagent_store_id);
        await supabase.from("withdrawal_requests").update({ status: "completed", processed_at: new Date().toISOString() }).eq("id", withdrawalId);
        
        // Update local state
        setSubagents((prev) => prev.map((s) => s.id === withdrawalData.subagent_store_id ? { ...s, wallet_balance: newBalance } : s));
        setWithdrawals((prev) => prev.map((w) => w.id === withdrawalId ? { ...w, status: "completed", processed_at: new Date().toISOString() } : w));
        
        toast({ title: "Withdrawal processed!", description: `GH₵ ${amount.toFixed(2)} deducted from Subagent wallet. New balance: GH₵ ${newBalance.toFixed(2)}.` });
      } else {
        // AGENT WITHDRAWAL - fetch fresh balance from database first
        const { data: freshAgent, error: fetchError } = await supabase
          .from("agent_stores")
          .select("wallet_balance, subagent_commission_balance")
          .eq("id", agentStoreId)
          .single();
        
        if (fetchError || !freshAgent) throw new Error("Failed to fetch agent balance");
        
        // Choose which balance to deduct from
        const currentBalance = isSubagentProfit 
          ? Number(freshAgent.subagent_commission_balance ?? 0) 
          : Number(freshAgent.wallet_balance ?? 0);
        const newBalance = currentBalance - amount;
        
        // Update the correct balance column
        const updateField = isSubagentProfit ? "subagent_commission_balance" : "wallet_balance";
        await supabase.from("agent_stores").update({ [updateField]: newBalance }).eq("id", agentStoreId);
        await supabase.from("withdrawal_requests").update({ status: "completed", processed_at: new Date().toISOString() }).eq("id", withdrawalId);
        
        // Update local state
        setAgents((prev) => prev.map((a) => a.id === agentStoreId ? { ...a, [updateField]: newBalance } : a));
        setWithdrawals((prev) => prev.map((w) => w.id === withdrawalId ? { ...w, status: "completed", processed_at: new Date().toISOString() } : w));
        
        const sourceLabel = isSubagentProfit ? "Subagent Profit" : "Wallet";
        toast({ title: "Withdrawal processed!", description: `GH₵ ${amount.toFixed(2)} deducted from ${sourceLabel}. New balance: GH₵ ${newBalance.toFixed(2)}.` });
      }
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
  
  const filteredAgents = agents
    .filter((agent) => agent.store_name.toLowerCase().includes(agentSearchTerm.toLowerCase()))
    .filter((agent) => agentApprovalFilter === "all" ? true : (agentApprovalFilter === "approved" ? agent.approved : !agent.approved));
  
  // Use database search results if searching, otherwise use local users (first 100)
  const filteredUsers = userSearchTerm.length > 0 ? profileSearch.results : users;
  
  // Use database search results if searching, otherwise use local data
  const filteredOrders = (orderSearchTerm.length > 0 ? orderSearch.results : orders)
    .filter((order) => {
      const matchesNetwork = orderNetworkFilter === "all" || order.network.toUpperCase() === orderNetworkFilter.toUpperCase();
      const matchesFulfillment = orderFulfillmentFilter === "all" || order.fulfillment_status === orderFulfillmentFilter;
      const matchesPayment = orderPaymentStatusFilter === "all" || order.status === orderPaymentStatusFilter;
      return matchesNetwork && matchesFulfillment && matchesPayment;
    })
    .filter((order) => orderNetworkFilter === "all" ? true : order.network.toLowerCase() === orderNetworkFilter.toLowerCase())
    .filter((order) => orderFulfillmentFilter === "all" ? true : order.fulfillment_status.toLowerCase() === orderFulfillmentFilter.toLowerCase())
    .filter((order) => orderPaymentStatusFilter === "all" ? true : order.status.toLowerCase() === orderPaymentStatusFilter.toLowerCase());
  
  const filteredWithdrawals = withdrawals.filter((withdrawal) => {
    // Check if it's a subagent withdrawal
    if (withdrawal.subagent_store_id) {
      const subagent = subagents.find((s) => s.id === withdrawal.subagent_store_id);
      return subagent?.store_name.toLowerCase().includes(withdrawalSearchTerm.toLowerCase()) ?? false;
    }
    // Otherwise, check agent store
    const agent = agents.find((a) => a.id === withdrawal.agent_store_id);
    return agent?.store_name.toLowerCase().includes(withdrawalSearchTerm.toLowerCase()) ?? false;
  });

  const filteredSubagents = subagents
    .filter((subagent) => subagent.store_name.toLowerCase().includes(subagentSearchTerm.toLowerCase()))
    .filter((subagent) => subagentStatusFilter === "all" ? true : (subagentStatusFilter === "active" ? !subagent.suspended : subagent.suspended));

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
            {canSee("push") && <TabsTrigger value="push" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Smartphone className="h-3 w-3 md:h-4 md:w-4" /> Push</TabsTrigger>}
            {canSee("spinwheel") && <TabsTrigger value="spinwheel" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Gift className="h-3 w-3 md:h-4 md:w-4" /> Spin</TabsTrigger>}
            {canSee("afa") && <TabsTrigger value="afa" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Zap className="h-3 w-3 md:h-4 md:w-4" /> AFA</TabsTrigger>}
{canSee("complaints") && <TabsTrigger value="complaints" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><AlertCircle className="h-3 w-3 md:h-4 md:w-4" /> Complaints</TabsTrigger>}
  {canSee("settings") && <TabsTrigger value="settings" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Settings2 className="h-3 w-3 md:h-4 md:w-4" /> Settings</TabsTrigger>}
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
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by phone number..." 
                  value={orderSearchTerm}
                  onChange={(e) => {
                    setOrderSearchTerm(e.target.value);
                    if (e.target.value.length > 0) {
                      orderSearch.search(e.target.value);
                    }
                  }}
                  className="pl-10" 
                />
                {orderSearch.isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              
              {/* Order Filters */}
              <div className="flex gap-2 flex-wrap">
                <Select value={orderNetworkFilter} onValueChange={setOrderNetworkFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Network" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Networks</SelectItem>
                    <SelectItem value="mtn">MTN</SelectItem>
                    <SelectItem value="airtel">AirtelTigo</SelectItem>
                    <SelectItem value="telecel">Telecel</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orderFulfillmentFilter} onValueChange={setOrderFulfillmentFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Fulfillment" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orderPaymentStatusFilter} onValueChange={setOrderPaymentStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Payment" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payment Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const paginated = filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);
                const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
                
                return (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredOrders.length === 0 ? 0 : (orderPage - 1) * PAGE_SIZE + 1} - {Math.min(orderPage * PAGE_SIZE, filteredOrders.length)} of {totalCounts.orders} orders
                    </p>
                    <Card className="border-border">
                      <Table>
                        <TableHeader><TableRow><TableHead>Date & Time</TableHead><TableHead>Phone</TableHead><TableHead>Network</TableHead><TableHead>Size</TableHead><TableHead>Amount</TableHead><TableHead>Source</TableHead><TableHead>Method</TableHead><TableHead>Payment</TableHead><TableHead>Fulfillment</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {paginated.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No orders match your search.</TableCell></TableRow> :
                            paginated.map((order) => {
                              // Determine source
                              const agentStore = order.agent_store_id ? agents.find(a => a.id === order.agent_store_id) : null;
                              const subagentStore = order.subagent_store_id ? subagents.find(s => s.id === order.subagent_store_id) : null;
                              let sourceType = "Main Site";
                              let sourceLabel = "Direct";
                              let sourceBadgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/30";
                              
                              if (subagentStore) {
                                sourceType = "Subagent";
                                sourceLabel = subagentStore.store_name || "Subagent";
                                sourceBadgeClass = "bg-purple-500/10 text-purple-400 border-purple-500/30";
                              } else if (agentStore) {
                                sourceType = "Agent";
                                sourceLabel = agentStore.store_name || "Agent";
                                sourceBadgeClass = "bg-green-500/10 text-green-400 border-green-500/30";
                              }
                              
                              return (
                              <TableRow key={order.id}>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</TableCell>
                                <TableCell className="font-medium">{order.customer_number}</TableCell>
                                <TableCell className="uppercase text-sm">{order.network}</TableCell>
                                <TableCell className="font-display font-bold">{order.size_gb}GB</TableCell>
                                <TableCell>GH₵ {Number(order.amount).toFixed(2)}</TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs cursor-pointer hover:opacity-80 ${sourceBadgeClass}`}
                                    onClick={() => {
                                      if (subagentStore) {
                                        // For subagent, get contact from parent agent
                                        const parentAgent = agents.find(a => a.id === subagentStore.agent_store_id);
                                        setSourceInfo({
                                          type: "Subagent Store",
                                          storeName: subagentStore.store_name || "Unknown",
                                          contact: parentAgent?.whatsapp_number || parentAgent?.support_number || "N/A"
                                        });
                                        setSourceDialogOpen(true);
                                      } else if (agentStore) {
                                        setSourceInfo({
                                          type: "Agent Store",
                                          storeName: agentStore.store_name || "Unknown",
                                          contact: agentStore.whatsapp_number || agentStore.support_number || "N/A"
                                        });
                                        setSourceDialogOpen(true);
                                      }
                                    }}
                                  >
                                    {sourceLabel.length > 12 ? sourceLabel.slice(0, 12) + "..." : sourceLabel}
                                  </Badge>
                                </TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{order.payment_method === "wallet" ? "Wallet" : "Paystack"}</Badge></TableCell>
                                <TableCell><Badge variant={order.status === "completed" || order.status === "paid" ? "default" : "secondary"}>{order.status}</Badge></TableCell>
                                <TableCell><Badge variant={order.fulfillment_status === "completed" ? "default" : order.fulfillment_status === "failed" ? "destructive" : "secondary"}>{order.fulfillment_status}</Badge></TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {order.fulfillment_status !== "completed" && (
                                      <Button variant="outline" size="sm" onClick={() => retryOrder(order.id)} disabled={retryingOrders.has(order.id)}>
                                        {retryingOrders.has(order.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" /> Retry</>}
                                      </Button>
                                    )}
                                    <Button 
                                      variant={order.fulfillment_status === "completed" ? "default" : "secondary"} 
                                      size="sm" 
                                      onClick={() => toggleOrderFulfillment(order.id, order.fulfillment_status)}
                                    >
                                      {order.fulfillment_status === "completed" ? "Unfulfill" : "Fulfill"}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              );
                            })
                          }
                        </TableBody>
                      </Table>
                    </Card>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button variant="outline" size="sm" disabled={orderPage === 1} onClick={() => setOrderPage(p => p - 1)}>Previous</Button>
                        <span className="text-sm text-muted-foreground">Page {orderPage} of {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={orderPage === totalPages} onClick={() => setOrderPage(p => p + 1)}>Next</Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </TabsContent>
          )}

          {/* AGENTS TAB */}
          {canSee("agents") && (
            <TabsContent value="agents" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by store name..." value={agentSearchTerm} onChange={(e) => setAgentSearchTerm(e.target.value)} className="pl-10" /></div>
                
                <Select value={agentApprovalFilter} onValueChange={setAgentApprovalFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Approval" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const paginated = filteredAgents.slice((agentPage - 1) * PAGE_SIZE, agentPage * PAGE_SIZE);
                const totalPages = Math.ceil(filteredAgents.length / PAGE_SIZE);
                
                return filteredAgents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No agents match your search.</p>
                ) : (
                  <>
                  <p className="text-sm text-muted-foreground">
                    Showing {(agentPage - 1) * PAGE_SIZE + 1} - {Math.min(agentPage * PAGE_SIZE, filteredAgents.length)} of {totalCounts.agents} agents
                  </p>
                    {paginated.map((agent) => (
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
                              <p className="text-xs text-muted-foreground">Subagent Profit: <span className="font-bold text-purple-400">GH₵ {Number(agent.subagent_commission_balance ?? 0).toFixed(2)}</span></p>
                              {agent.approved && <Link to={`/store/${storeSlug(agent.store_name)}`} className="text-xs text-primary hover:underline flex items-center gap-1"><Eye className="h-3 w-3" /> View Store</Link>}
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                {agent.approved ? (
                                  <><Badge className="bg-green-600/20 text-green-400 border-green-600/30">Approved</Badge><Button variant="outline" size="sm" onClick={() => toggleApproval(agent.id, false)}><X className="h-4 w-4 mr-1" /> Suspend</Button></>
                                ) : (
                                  <><Badge variant="secondary">Pending</Badge><Button variant="hero" size="sm" onClick={() => toggleApproval(agent.id, true)}><Check className="h-4 w-4 mr-1" /> Approve</Button></>
                                )}
                              </div>
                              <Button variant="outline" size="sm" onClick={() => openAgentPricingDialog(agent)}>
                                <Wallet className="h-4 w-4 mr-1" /> Edit Base Prices
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  localStorage.setItem("admin_impersonate_agent", agent.user_id);
                                  window.location.href = "/agent";
                                }}
                                className="bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/30"
                              >
                                <LogIn className="h-4 w-4 mr-1" /> Login
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button variant="outline" size="sm" disabled={agentPage === 1} onClick={() => setAgentPage(p => p - 1)}>Previous</Button>
                        <span className="text-sm text-muted-foreground">Page {agentPage} of {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={agentPage === totalPages} onClick={() => setAgentPage(p => p + 1)}>Next</Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </TabsContent>
          )}

          {/* SUBAGENTS TAB */}
          {canSee("subagents") && (
            <TabsContent value="subagents" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by store name..." 
                    className="pl-10" 
                    value={subagentSearchTerm}
                    onChange={(e) => setSubagentSearchTerm(e.target.value)}
                  />
                </div>

                <Select value={subagentStatusFilter} onValueChange={setSubagentStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subagents</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(() => {
                const paginated = filteredSubagents.slice((subagentPage - 1) * PAGE_SIZE, subagentPage * PAGE_SIZE);
                const totalPages = Math.ceil(filteredSubagents.length / PAGE_SIZE);
                
                return filteredSubagents.length === 0 ? (
                <Card className="border-border">
                  <CardContent className="py-12">
                    <p className="text-center text-muted-foreground">No subagents match your search.</p>
                  </CardContent>
                </Card>
              ) : (
                  <>
                  <p className="text-sm text-muted-foreground">
                    Showing {(subagentPage - 1) * PAGE_SIZE + 1} - {Math.min(subagentPage * PAGE_SIZE, filteredSubagents.length)} of {totalCounts.subagents} subagents
                  </p>
                  {paginated.map((subagent) => (
                    <Card key={subagent.id} className={`border-border bg-card/50 ${subagent.suspended ? 'opacity-60' : ''}`}>
                      <CardContent className="p-3 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
                          <div className="flex-1 space-y-2 md:space-y-3 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-bold text-base md:text-lg text-foreground truncate">{subagent.store_name}</h3>
                              {subagent.suspended && (
                                <Badge variant="destructive" className="text-xs">Suspended</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-3 text-xs md:text-sm">
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Parent Agent</p>
                                <p className="font-semibold text-foreground truncate">{subagent.agent_stores?.store_name || 'N/A'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">WhatsApp</p>
                                <p className="font-semibold text-foreground">{subagent.whatsapp_number}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Support</p>
                                <p className="font-semibold text-foreground">{subagent.support_number}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">MoMo</p>
                                <p className="font-semibold text-foreground truncate">{subagent.momo_name}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Wallet Balance</p>
                                <p className="font-bold text-yellow-400">GH₵ {Number(subagent.wallet_balance || 0).toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex flex-wrap gap-2">
                            {subagent.suspended ? (
                              <Badge className="bg-red-600/20 text-red-400 border-red-600/30 font-semibold">
                                Suspended
                              </Badge>
                            ) : (
                              <Badge className="bg-green-600/20 text-green-400 border-green-600/30 font-semibold">
                                Active
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(DOMAINS.getSubagentStoreUrl(subagent.store_name), "_blank")}
                              className="text-xs"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Navigate to subagent domain with impersonation token in URL
                                // Use encodeURIComponent to handle non-Latin1 characters safely
                                const tokenData = JSON.stringify({ 
                                  userId: subagent.user_id, 
                                  storeName: subagent.store_name,
                                  timestamp: Date.now() 
                                });
                                const token = btoa(encodeURIComponent(tokenData));
                                window.location.href = `https://${DOMAINS.SUBAGENT_STORE}/dashboard?admin_token=${token}`;
                              }}
                              className="text-xs bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/30"
                            >
                              <LogIn className="h-3 w-3 mr-1" />
                              Login
                            </Button>
                            <Button
                              variant={subagent.suspended ? "default" : "secondary"}
                              size="sm"
                              onClick={() => toggleSubagentSuspension(subagent.id, subagent.suspended || false, subagent.store_name)}
                              className={`text-xs ${subagent.suspended ? 'bg-green-600 hover:bg-green-700' : ''}`}
                            >
                              {subagent.suspended ? "Unsuspend" : "Suspend"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteSubagent(subagent.id, subagent.store_name)}
                              className="text-xs"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSubagentPage(p => Math.max(1, p - 1))}
                        disabled={subagentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">Page {subagentPage} of {totalPages}</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSubagentPage(p => Math.min(totalPages, p + 1))}
                        disabled={subagentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              );
              })()}
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="font-display text-lg">Top-up History</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by store name..." value={topupSearchTerm} onChange={(e) => setTopupSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const filteredTopups = topupHistory.filter(t => 
                      t.agent_stores?.store_name?.toLowerCase().includes(topupSearchTerm.toLowerCase()) ||
                      t.agent_stores?.topup_reference?.includes(topupSearchTerm)
                    );
                    const paginated = filteredTopups.slice((topupPage - 1) * PAGE_SIZE, topupPage * PAGE_SIZE);
                    const totalPages = Math.ceil(filteredTopups.length / PAGE_SIZE);
                    
                    return filteredTopups.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No top-ups found.</p>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">
                          Showing {(topupPage - 1) * PAGE_SIZE + 1} - {Math.min(topupPage * PAGE_SIZE, filteredTopups.length)} of {filteredTopups.length} top-ups
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date & Time</TableHead>
                              <TableHead>Store</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>MoMo Name</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Store Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginated.map((t) => (
                              <TableRow key={t.id}>
                                <TableCell className="text-sm whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</TableCell>
                                <TableCell className="font-medium">{t.agent_stores?.store_name ?? "—"}</TableCell>
                                <TableCell className="text-primary">{t.agent_stores?.topup_reference ?? "—"}</TableCell>
                                <TableCell>{t.agent_stores?.momo_name ?? "—"}</TableCell>
                                <TableCell>GH₵ {Number(t.amount).toFixed(2)}</TableCell>
                                <TableCell>GH₵ {t.agent_stores?.wallet_balance?.toFixed(2) ?? "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-2 pt-4">
                            <Button variant="outline" size="sm" disabled={topupPage === 1} onClick={() => setTopupPage(p => p - 1)}>Previous</Button>
                            <span className="text-sm text-muted-foreground">Page {topupPage} of {totalPages}</span>
                            <Button variant="outline" size="sm" disabled={topupPage === totalPages} onClick={() => setTopupPage(p => p + 1)}>Next</Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
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
              {(() => {
                const paginated = filteredWithdrawals.slice((withdrawalPage - 1) * PAGE_SIZE, withdrawalPage * PAGE_SIZE);
                const totalPages = Math.ceil(filteredWithdrawals.length / PAGE_SIZE);
                
                return (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredWithdrawals.length === 0 ? 0 : (withdrawalPage - 1) * PAGE_SIZE + 1} - {Math.min(withdrawalPage * PAGE_SIZE, filteredWithdrawals.length)} of {totalCounts.withdrawals} withdrawals
                    </p>
                    <Card className="border-border">
                      <Table>
                        <TableHeader><TableRow><TableHead>Date & Time</TableHead><TableHead>Agent/Subagent</TableHead><TableHead>Type</TableHead><TableHead>Source</TableHead><TableHead>Amount</TableHead><TableHead>Wallet Balance</TableHead><TableHead>MoMo Name</TableHead><TableHead>MoMo Number</TableHead><TableHead>Network</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {paginated.length === 0 ? <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No withdrawals match your search.</TableCell></TableRow> :
                            paginated.map((w) => {
                              const isSubagentWithdrawal = !!w.subagent_store_id;
                              const agent = !isSubagentWithdrawal ? agents.find((a) => a.id === w.agent_store_id) : null;
                              const subagent = isSubagentWithdrawal ? subagents.find((s) => s.id === w.subagent_store_id) : null;
                              const isSubagentProfit = w.withdrawal_source === "subagent_commission";
                              const storeName = isSubagentWithdrawal ? subagent?.store_name : agent?.store_name;
                              const walletBalance = isSubagentWithdrawal ? (subagent?.wallet_balance ?? 0) : (isSubagentProfit ? (agent?.subagent_commission_balance ?? 0) : (agent?.wallet_balance ?? 0));
                              const momoName = isSubagentWithdrawal ? subagent?.momo_name : agent?.momo_name;
                              const momoNumber = isSubagentWithdrawal ? subagent?.momo_number : agent?.momo_number;
                              const momoNetwork = isSubagentWithdrawal ? subagent?.momo_network : agent?.momo_network;
                              return (
                                <TableRow key={w.id}>
                                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</TableCell>
                                  <TableCell className="font-medium">{storeName ?? "—"}</TableCell>
                                  <TableCell><Badge className={isSubagentWithdrawal ? "bg-orange-600/20 text-orange-400 border-orange-600/30" : "bg-cyan-600/20 text-cyan-400 border-cyan-600/30"}>{isSubagentWithdrawal ? "Subagent" : "Agent"}</Badge></TableCell>
                                  <TableCell><Badge className={isSubagentProfit ? "bg-purple-600/20 text-purple-400 border-purple-600/30" : "bg-blue-600/20 text-blue-400 border-blue-600/30"}>{isSubagentProfit ? "Subagent Profit" : "Wallet"}</Badge></TableCell>
                                  <TableCell className="font-display font-bold text-primary">GH₵ {Number(w.amount).toFixed(2)}</TableCell>
                                  <TableCell className="font-bold text-green-400">GH₵ {Number(walletBalance).toFixed(2)}</TableCell>
                                  <TableCell>{momoName ?? "—"}</TableCell>
                                  <TableCell className="font-mono">{momoNumber ?? "—"}</TableCell>
                                  <TableCell className="uppercase text-sm">{momoNetwork ?? "—"}</TableCell>
                                  <TableCell><Badge className={w.status === "completed" ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>{w.status}</Badge></TableCell>
                                  <TableCell>
                                    {w.status === "pending" && (
                                      <Button variant="hero" size="sm" onClick={() => processWithdrawal(w.id, w.agent_store_id, Number(w.amount), w.withdrawal_source, w.subagent_store_id)} disabled={processingWithdrawals.has(w.id)}>
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
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button variant="outline" size="sm" disabled={withdrawalPage === 1} onClick={() => setWithdrawalPage(p => p - 1)}>Previous</Button>
                        <span className="text-sm text-muted-foreground">Page {withdrawalPage} of {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={withdrawalPage === totalPages} onClick={() => setWithdrawalPage(p => p + 1)}>Next</Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </TabsContent>
          )}

          {/* USERS TAB */}
          {canSee("users") && (
            <TabsContent value="users" className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name..." 
                  value={userSearchTerm}
                  onChange={(e) => {
                    setUserSearchTerm(e.target.value);
                    if (e.target.value.length > 0) {
                      profileSearch.search(e.target.value);
                    }
                  }}
                  className="pl-10" 
                />
                {profileSearch.isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {(() => {
                const paginated = filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);
                const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
                
                return (
                  <>
                  <p className="text-sm text-muted-foreground">
                      Showing {filteredUsers.length === 0 ? 0 : (userPage - 1) * PAGE_SIZE + 1} - {Math.min(userPage * PAGE_SIZE, filteredUsers.length)} of {totalCounts.users} users
                  </p>
                    <Card className="border-border">
                      <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {paginated.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users match your search.</TableCell></TableRow> :
                            paginated.map((u) => (
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
                            ))
                          }
                        </TableBody>
                      </Table>
                    </Card>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button variant="outline" size="sm" disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)}>Previous</Button>
                        <span className="text-sm text-muted-foreground">Page {userPage} of {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={userPage === totalPages} onClick={() => setUserPage(p => p + 1)}>Next</Button>
                      </div>
                    )}
                  </>
                );
              })()}
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
                        <SelectItem value="all">All Users & Agents (including non-logged-in)</SelectItem>
                        <SelectItem value="user">Users Only (also shown to non-logged-in visitors)</SelectItem>
                        <SelectItem value="agent">Agents Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Note: "User" target will also be visible to non-logged-in visitors.</p>
                  </div>
                  <div className="space-y-2"><Label>Title</Label><Input placeholder="Notification title" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Message</Label><Textarea placeholder="Write your message here..." value={notifMessage} onChange={(e) => setNotifMessage(e.target.value)} rows={4} /></div>
                  <div className="space-y-2">
                    <Label>Expires At (Optional)</Label>
                    <Input type="datetime-local" value={notifExpiresAt} onChange={(e) => setNotifExpiresAt(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Leave empty for no expiration. After this date/time, the notification will automatically be hidden.</p>
                  </div>
                  <Button variant="hero" onClick={sendNotification} disabled={sendingNotif}>{sendingNotif ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />} Send Notification</Button>
                </CardContent>
              </Card>
              
              {/* Existing Notifications */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" /> Active Notifications ({notifications.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {notifications.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No notifications sent yet</p>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="border rounded-lg p-4 space-y-2 bg-muted/30">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{notif.title}</span>
                                <Badge variant={notif.target === "all" ? "default" : notif.target === "agent" ? "secondary" : "outline"}>
                                  {notif.target === "all" ? "All" : notif.target === "agent" ? "Agents" : "Users"}
                                </Badge>
                                {notif.expires_at && new Date(notif.expires_at) < new Date() && (
                                  <Badge variant="destructive">Expired</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 break-words">{notif.message}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                <span>Created: {new Date(notif.created_at).toLocaleString()}</span>
                                {notif.expires_at && (
                                  <span>Expires: {new Date(notif.expires_at).toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => deleteNotification(notif.id)}
                              disabled={deletingNotif === notif.id}
                            >
                              {deletingNotif === notif.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

                  {/* Prize Probability Controls */}
                  <div className="space-y-4 border p-4 rounded-lg bg-purple-500/5">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">Prize Probabilities (% chance)</Label>
                      <p className="text-sm text-muted-foreground">Set the chance of winning each prize. Remaining % goes to motivational messages.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>2GB Win Chance (%)</Label>
                        <Input 
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={spinConfig.chance_2gb || ''} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setSpinConfig({ ...spinConfig, chance_2gb: val === '' ? 0 : Math.min(100, parseInt(val, 10)) });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Default: 4%</p>
                      </div>
                      <div className="space-y-2">
                        <Label>1GB Win Chance (%)</Label>
                        <Input 
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={spinConfig.chance_1gb || ''} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setSpinConfig({ ...spinConfig, chance_1gb: val === '' ? 0 : Math.min(100, parseInt(val, 10)) });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Default: 9%</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Extra Spin Chance (%)</Label>
                        <Input 
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={spinConfig.chance_extra_spin || ''} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setSpinConfig({ ...spinConfig, chance_extra_spin: val === '' ? 0 : Math.min(100, parseInt(val, 10)) });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Default: 12%</p>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded p-2 text-sm">
                      <span className="font-medium">Current distribution:</span> 2GB: {spinConfig.chance_2gb}% | 1GB: {spinConfig.chance_1gb}% | Extra Spin: {spinConfig.chance_extra_spin}% | Motivational: {Math.max(0, 100 - spinConfig.chance_2gb - spinConfig.chance_1gb - spinConfig.chance_extra_spin)}%
                    </div>
                  </div>

                  {/* Auto-Disable Settings */}
                  <div className="space-y-4 border p-4 rounded-lg bg-orange-500/5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-semibold">Auto-Disable After X Orders</Label>
                        <p className="text-sm text-muted-foreground">Automatically turn off spin wheel after a set number of spin orders are placed.</p>
                      </div>
                      <Switch 
                        checked={spinConfig.auto_disable_enabled} 
                        onCheckedChange={(checked) => setSpinConfig({ ...spinConfig, auto_disable_enabled: checked })} 
                      />
                    </div>
                    
                    {spinConfig.auto_disable_enabled && (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Order Limit (auto-disable after)</Label>
                            <Input 
                              type="text"
                              inputMode="numeric"
                              placeholder="1"
                              value={spinConfig.auto_disable_order_limit || ''} 
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setSpinConfig({ ...spinConfig, auto_disable_order_limit: val === '' ? 0 : Math.max(1, parseInt(val, 10)) });
                              }}
                            />
                            <p className="text-xs text-muted-foreground">Spin wheel disables when this many orders are placed</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Actual Spin Orders (real count)</Label>
                            <Input 
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={spinConfig.current_spin_orders || ''} 
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setSpinConfig({ ...spinConfig, current_spin_orders: val === '' ? 0 : parseInt(val, 10) });
                              }}
                            />
                            <p className="text-xs text-muted-foreground">Real number of spin orders placed</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Display Count (what users see)</Label>
                          <Input 
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={spinConfig.display_spin_orders || ''} 
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setSpinConfig({ ...spinConfig, display_spin_orders: val === '' ? 0 : parseInt(val, 10) });
                            }}
                          />
                          <p className="text-xs text-muted-foreground">You can manipulate what users see as the "current orders" count</p>
                        </div>
                        <div className="bg-muted/50 rounded p-3 space-y-1">
                          <p className="text-sm"><span className="font-medium">Status:</span> {spinConfig.current_spin_orders} / {spinConfig.auto_disable_order_limit} orders</p>
                          <p className="text-sm"><span className="font-medium">Users see:</span> {spinConfig.display_spin_orders} / {spinConfig.auto_disable_order_limit} orders</p>
                          <p className="text-sm"><span className="font-medium">Remaining:</span> {Math.max(0, spinConfig.auto_disable_order_limit - spinConfig.current_spin_orders)} orders until auto-disable</p>
                          {spinConfig.current_spin_orders >= spinConfig.auto_disable_order_limit && (
                            <p className="text-sm text-destructive font-medium">Limit reached! Spin wheel will be disabled.</p>
                          )}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSpinConfig({ ...spinConfig, current_spin_orders: 0, display_spin_orders: 0 })}
                        >
                          Reset Order Counts
                        </Button>
                      </div>
                    )}
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

  {/* AFA BUNDLES TAB */}
  {canSee("afa") && (
  <TabsContent value="afa" className="space-y-6">
    <AdminAFAManagementTabs />
  </TabsContent>
  )}

  {/* PUSH NOTIFICATIONS TAB */}
  {canSee("push") && (
  <TabsContent value="push" className="space-y-6">
    <PushNotificationManager />
  </TabsContent>
  )}
  
  {/* SETTINGS TAB */}
  {canSee("settings") && (
  <TabsContent value="settings" className="space-y-6">
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" /> App Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">Configure global app settings</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Agent Registration Fee */}
        <div className="space-y-4 border p-4 rounded-lg bg-primary/5">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Agent Registration Fee</Label>
            <p className="text-sm text-muted-foreground">The amount new agents must pay to get their store approved (via Paystack)</p>
          </div>
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Fee Amount (GH₵)</Label>
              <Input 
                type="number" 
                min="0" 
                step="0.01"
                value={agentRegistrationFee} 
                onChange={(e) => setAgentRegistrationFee(Number(e.target.value) || 0)} 
              />
            </div>
            <Button onClick={saveAppSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Current fee: GH₵{agentRegistrationFee.toFixed(2)}</p>
        </div>
                </CardContent>
              </Card>

              {/* Free Data Offer Settings */}
              <Card className="border-border">
                <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Gift className="h-5 w-5 text-green-500" /> Free Data Offer Settings</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center justify-between border p-4 rounded-lg bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-500/30">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">Enable Free Data Offer</Label>
                      <p className="text-sm text-muted-foreground">
                        Show or hide the Gift icon on all storefronts
                      </p>
                    </div>
                    <Switch 
                      checked={freeDataConfig.enabled} 
                      onCheckedChange={(checked) => setFreeDataConfig({ ...freeDataConfig, enabled: checked })} 
                    />
                  </div>

                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-sm text-green-300">
                      Users who purchase the required GB within a week (Monday-Sunday) can claim free data once. 
                      If not claimed by Sunday, the offer expires and resets.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Required GB to Claim</Label>
                      <Input 
                        type="text"
                        inputMode="numeric"
                        placeholder="35"
                        value={freeDataConfig.required_gb || ''} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setFreeDataConfig({ ...freeDataConfig, required_gb: val === '' ? 0 : parseInt(val, 10) });
                        }}
                        disabled={!freeDataConfig.enabled}
                      />
                      <p className="text-xs text-muted-foreground">Users must buy this much GB in a week to qualify</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Free Reward GB</Label>
                      <Input 
                        type="text"
                        inputMode="numeric"
                        placeholder="1"
                        value={freeDataConfig.reward_gb || ''} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setFreeDataConfig({ ...freeDataConfig, reward_gb: val === '' ? 0 : parseInt(val, 10) });
                        }}
                        disabled={!freeDataConfig.enabled}
                      />
                      <p className="text-xs text-muted-foreground">How much free data they receive</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border p-4 rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base">Include Telecel Purchases</Label>
                      <p className="text-sm text-muted-foreground">
                        If OFF, only MTN and AirtelTigo purchases count toward the required GB.
                        Turn this ON if Telecel has {freeDataConfig.reward_gb}GB packages available.
                      </p>
                    </div>
                    <Switch 
                      checked={freeDataConfig.telecel_enabled} 
                      onCheckedChange={(checked) => setFreeDataConfig({ ...freeDataConfig, telecel_enabled: checked })}
                      disabled={!freeDataConfig.enabled}
                    />
                  </div>
                  
                  <Button onClick={saveFreeDataSettings} disabled={freeDataSaving}>
                    {freeDataSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save Free Data Settings
                  </Button>
                </CardContent>
              </Card>
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

      {/* Agent-Specific Base Prices Dialog */}
      <Dialog open={agentPriceDialogOpen} onOpenChange={setAgentPriceDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Base Prices for {selectedAgentForPricing?.store_name}</DialogTitle>
            <DialogDescription>
              Set custom base prices for this agent. These prices will override the default agent prices.
              Leave a field empty or at 0 to use the default price.
            </DialogDescription>
          </DialogHeader>
          
          {loadingAgentPrices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="flex gap-2 flex-wrap">
                {["mtn", "airteltigo", "telecel"].map((net) => (
                  <Button
                    key={net}
                    variant={agentPriceNetworkFilter === net ? "hero" : "outline"}
                    size="sm"
                    onClick={() => setAgentPriceNetworkFilter(net)}
                  >
                    {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
                  </Button>
                ))}
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                <p className="text-blue-400">
                  <strong>How it works:</strong> Default Price = What all agents pay. Custom Price = What only this agent pays.
                  If you set a custom price, this agent will be charged that amount instead of the default.
                </p>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Default Price (GH₵)</TableHead>
                    <TableHead>Custom Price (GH₵)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages
                    .filter(pkg => pkg.network === agentPriceNetworkFilter && pkg.active)
                    .map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                        <TableCell className="text-muted-foreground">GH₵ {Number(pkg.agent_price).toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={`Default: ${pkg.agent_price}`}
                            value={agentCustomPrices[pkg.id] || ""}
                            onChange={(e) => handleAgentPriceChange(pkg.id, e.target.value)}
                            className="w-28 h-8"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              
              <div className="flex justify-between gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={resetAgentToDefaultPrices} disabled={savingAgentPrices}>
                  <Trash2 className="h-4 w-4 mr-1" /> Reset to Defaults
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAgentPriceDialogOpen(false)}>Cancel</Button>
                  <Button variant="hero" onClick={saveAgentCustomPrices} disabled={savingAgentPrices}>
                    {savingAgentPrices ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save Prices
                  </Button>
                </div>
              </div>
            </div>
          )}
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

      {/* Source Info Dialog */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Order Source Details</DialogTitle>
            <DialogDescription>Information about where this order came from</DialogDescription>
          </DialogHeader>
          {sourceInfo && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24">Type:</span>
                <Badge variant="outline">{sourceInfo.type}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24">Store Name:</span>
                <span className="font-medium">{sourceInfo.storeName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-24">Contact:</span>
                <a href={`tel:${sourceInfo.contact}`} className="text-primary hover:underline font-medium">{sourceInfo.contact}</a>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSourceDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
