import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APIPricingTab } from "@/components/APIPricingTab";
import { useAuth } from "@/hooks/useAuth";
import { useOptimizedRealtime } from "@/hooks/useOptimizedRealtime";
import { useDatabaseSearch } from "@/hooks/useDatabaseSearch";
import { usePaginatedData } from "@/hooks/usePaginatedData";
import { getAPIErrorLogs, markErrorAsResolved, deleteAPIError, retryFailedOrder, retryAllFailedOrders } from "@/hooks/useAPIErrorLogging";
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
  Loader2, Wallet, Search, Bell, Send, ArrowDownToLine, ShieldAlert, Shield, Gift, AlertCircle, Settings2, Megaphone, Smartphone, LogIn, DollarSign, Package, Play, MessageCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import ComplaintsManager from "@/components/ComplaintsManager";
import PushNotificationManager from "@/components/PushNotificationManager";
import AdminAFABundleManager from "@/components/AdminAFABundleManager";
import AdminAFABundleRegistrations from "@/components/AdminAFABundleRegistrations";
import AdminYouTubeUrlManager from "@/components/AdminYouTubeUrlManager";
import AdminAFAManager from "@/components/AdminAFAManager";
import AnnouncementManager from "@/components/AnnouncementManager";
import { DOMAINS } from "@/config/domains";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ============================================================
// Interfaces
// ============================================================
interface DataPackage {
  id: string; network: string; size_gb: number; price: number; agent_price: number; api_price: number; active: boolean;
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
  payment_method: string; subagent_store_id?: string | null; customer_id?: string | null;
  api_user?: string | null; package_id?: string | null; base_price?: number | null;
  agent_price?: number | null; refunded_amount?: number | null;
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
type Section = "prices" | "orders" | "agents" | "subagents" | "sub_subagents" | "topup" | "withdrawals" | "users" | "customers" | "notifications" | "push" | "spinwheel" | "afa" | "afa_bundles" | "complaints" | "api_errors" | "settings";

const AdminDashboard = () => {
  const { signOut, user: currentUser } = useAuth();
  const { toast } = useToast();

  // ======================== State ========================
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [agents, setAgents] = useState<AgentStore[]>([]);
  const [subagents, setSubagents] = useState<any[]>([]);
  const [subSubagents, setSubSubagents] = useState<any[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerExactMatch, setCustomerExactMatch] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrdersFromDB, setFilteredOrdersFromDB] = useState<Order[]>([]);
  const [isFilteringOrders, setIsFilteringOrders] = useState(false);
  const [apiErrors, setAPIErrors] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [topupHistory, setTopupHistory] = useState<TopupRecord[]>([]);
  const [filteredTopupHistory, setFilteredTopupHistory] = useState<TopupRecord[]>([]);
  const [topupSearching, setTopupSearching] = useState(false);
  const [subSubagentPage, setSubSubagentPage] = useState(1);
  
  // Total counts from database
  const [totalCounts, setTotalCounts] = useState({ orders: 0, agents: 0, subagents: 0, sub_subagents: 0, users: 0, withdrawals: 0, topups: 0, complaints: 0 });
  const [unapprovedWithdrawals, setUnapprovedWithdrawals] = useState(0);
  
  const [editedPrices, setEditedPrices] = useState<Record<string, { price?: number; agent_price?: number; api_price?: number }>>({});
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPkg, setNewPkg] = useState({ network: "mtn", size_gb: "", price: "", agent_price: "", api_price: "" });
  const [retryingOrders, setRetryingOrders] = useState<Set<string>>(new Set());
  const [retryingAllOrders, setRetryingAllOrders] = useState(false);
  const [processingWithdrawals, setProcessingWithdrawals] = useState<Set<string>>(new Set());

  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [agentExactMatch, setAgentExactMatch] = useState(false);
  const [subagentExactMatch, setSubagentExactMatch] = useState(false);
  const [subSubagentExactMatch, setSubSubagentExactMatch] = useState(false);
  const [subSubagentSearchTerm, setSubSubagentSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderLatestFilter, setOrderLatestFilter] = useState<number | null>(null);
  const [orderDateFrom, setOrderDateFrom] = useState<string>("");
  const [orderDateTo, setOrderDateTo] = useState<string>("");
  const [withdrawalSearchTerm, setWithdrawalSearchTerm] = useState("");
  const [subagentSearchTerm, setSubagentSearchTerm] = useState("");
  const [topupSearchTerm, setTopupSearchTerm] = useState("");
  const [complaintSearchTerm, setComplaintSearchTerm] = useState("");

  // Filter states for Orders, Agents, and Subagents
  const [orderNetworkFilter, setOrderNetworkFilter] = useState<string>("all");
  const [orderFulfillmentFilter, setOrderFulfillmentFilter] = useState<string>("all");
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState<string>("all");
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>("all");
  const [orderDeliveryFilter, setOrderDeliveryFilter] = useState<string>("all");
  const [agentApprovalFilter, setAgentApprovalFilter] = useState<string>("all");
  const [subagentStatusFilter, setSubagentStatusFilter] = useState<string>("all");

  // Multi-select and refund state for orders
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [refundingOrders, setRefundingOrders] = useState<Set<string>>(new Set());
  const [refundAction, setRefundAction] = useState<"" | "refund">("") ;
  const [showRefundedOnly, setShowRefundedOnly] = useState(false);
  const [reversingRefundIds, setReversingRefundIds] = useState<Set<string>>(new Set());
  // Incremented by the realtime listener to signal the auto-refund draining effect
  const [pendingAutoRefundTick, setPendingAutoRefundTick] = useState(0);

  // Pagination state
  const [agentPage, setAgentPage] = useState(1);
  const [subagentPage, setSubagentPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [topupPage, setTopupPage] = useState(1);
  const PAGE_SIZE = 100;

  // Lazy loading state - tracks which tabs have been clicked and loaded
  // Start with withdrawals tab (loads first)
  const [activeTab, setActiveTab] = useState("orders");
  const [loadedTabs, setLoadedTabs] = useState(new Set<string>()); // Track which tabs have been loaded

  // Agent-specific pricing state
  const [agentPriceDialogOpen, setAgentPriceDialogOpen] = useState(false);
  const [selectedAgentForPricing, setSelectedAgentForPricing] = useState<AgentStore | null>(null);
  const [agentCustomPrices, setAgentCustomPrices] = useState<Record<string, number>>({});
  const [loadingAgentPrices, setLoadingAgentPrices] = useState(false);

  // Database search hooks for real-time searching
  const orderSearch = useDatabaseSearch<Order>(
    "orders",
    "customer_number",
    "id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status, api_response, paystack_reference, created_at, agent_store_id, payment_method, subagent_store_id, customer_id, package_id, refunded_amount, refunded_at, api_user, sub_subagent_store_id"
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

  const agentSearch = useDatabaseSearch<AgentStore>(
    "agent_stores",
    "store_name",
    "id, user_id, store_name, whatsapp_number, support_number, whatsapp_group, momo_number, momo_name, momo_network, approved, created_at, wallet_balance, topup_reference, subagent_commission_balance"
  );

  const subagentSearch = useDatabaseSearch<any>(
    "subagent_stores",
    "store_name",
    "id, store_name, agent_store_id, created_at, agent_stores(store_name, id, user_id)"
  );

  const topupDatabaseSearch = useDatabaseSearch<any>(
    "wallet_topups",
    "agent_store_id",
    "id, agent_store_id, amount, created_at, agent_stores ( store_name, topup_reference, wallet_balance, momo_name )"
  );
  
  const [savingAgentPrices, setSavingAgentPrices] = useState(false);
  const [agentPriceNetworkFilter, setAgentPriceNetworkFilter] = useState("mtn");

  const [topupSearch, setTopupSearch] = useState("");
  const [topupAgent, setTopupAgent] = useState<AgentStore | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  // API user wallet topup
  const [apiTopupSearch, setApiTopupSearch] = useState("");
  const [apiTopupUser, setApiTopupUser] = useState<{ id: string; store_name?: string; user_email?: string; email?: string; wallet: number; topup_reference: string } | null>(null);
  const [apiTopupAmount, setApiTopupAmount] = useState("");
  const [apiTopupLoading, setApiTopupLoading] = useState(false);

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
  const [sourceInfo, setSourceInfo] = useState<{
    type: string;
    storeName: string;
    contact: string;
    storeUrl?: string;
    topupReference?: string;
    parentSubagentName?: string;
    parentSubagentUrl?: string;
    parentAgentName?: string;
    parentAgentUrl?: string;
  } | null>(null);
  
  // App settings state
  const [agentRegistrationFee, setAgentRegistrationFee] = useState(30);
  const [afaRegistrationFee, setAfaRegistrationFee] = useState(50);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Chatbot on/off toggle
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [savingChatbot, setSavingChatbot] = useState(false);

  // Free Data Offer settings
  const [freeDataConfig, setFreeDataConfig] = useState({
    enabled: true,
    required_gb: 35,
    reward_gb: 1,
    telecel_enabled: false,
  });
  const [freeDataSaving, setFreeDataSaving] = useState(false);

  // Special MTN Mashup Pricing
  const [specialMTNPricing, setSpecialMTNPricing] = useState({
    tier1_user_price: "6.00",
    tier1_agent_price: "6.00",
    tier2_user_price: "13.00",
    tier2_agent_price: "13.00",
    tier3_user_price: "25.00",
    tier3_agent_price: "25.00",
    tier4_user_price: "35.00",
    tier4_agent_price: "35.00",
  });
  const [specialMTNEnabled, setSpecialMTNEnabled] = useState({
    tier1: true,
    tier2: true,
    tier3: true,
    tier4: true,
  });
  const [savingSpecialMTN, setSavingSpecialMTN] = useState(false);

  // ======================== Data fetching (initial) ========================
  const fetchData = async () => {
    setDataLoading(true);
    await refreshData();

    // Load static config once on mount only (not on every refreshData call)
    try {
      const { data: afaSettings } = await supabase
        .from("afa_settings")
        .select("base_registration_price")
        .single();
      if (afaSettings?.base_registration_price) {
        setAfaRegistrationFee(afaSettings.base_registration_price);
      }
    } catch {
      setAfaRegistrationFee(14);
    }

    try {
      const { data: ssData } = await supabase
        .from("sub_subagent_stores")
        .select("*, subagent_stores(id, store_name, agent_store_id)")
        .order("created_at", { ascending: false })
        .limit(200);
      setSubSubagents(ssData || []);
      setLoadedTabs(prev => new Set([...prev, "sub_subagents"]));
    } catch {
      setSubSubagents([]);
    }

    setDataLoading(false);
  };

  // Helper function to fetch records with pagination (NOT all records)
  // Only fetches first 200 records to prevent database timeout
  const fetchRecords = async (table: string, select: string = "*", orderBy?: { column: string; ascending: boolean }, limit: number = 200) => {
    try {
      let query = supabase.from(table).select(select);
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending });
      }
      // Use range instead of limit to avoid Supabase's 1000-row limit
      const { data, error } = await query.range(0, limit - 1);
      if (error) {
        console.error(`[v0] Error fetching ${table}:`, error?.message || error);
        return [];
      }
      console.log(`[v0] Fetched ${table}: ${data?.length || 0} records`);
      return data || [];
    } catch (err) {
      console.error(`[v0] Exception fetching ${table}:`, err);
      return [];
    }
  };

  // Fetch all topups with store data using RPC function (NO LIMIT - loads all topups)
  const fetchAllTopupsWithStores = async () => {
    try {
      const { data, error } = await supabase.rpc('get_topups_with_store_data');
      if (error) {
        console.error('Error fetching topups with stores:', error);
        return [];
      }
      // Transform the flat response into TopupRecord structure
      return (data || []).map((row: any) => ({
        id: row.id,
        agent_store_id: row.agent_store_id,
        amount: row.amount,
        created_at: row.created_at,
        agent_stores: {
          id: row.agent_store_id,
          store_name: row.store_name,
          topup_reference: row.topup_reference,
          wallet_balance: row.wallet_balance,
          momo_name: row.momo_name,
          momo_number: row.momo_number,
          momo_network: row.momo_network,
        },
      }));
    } catch (err) {
      console.error('Exception fetching topups with stores:', err);
      return [];
    }
  };

  const fetchWithdrawalsWithStores = async (limit: number = 10000) => {
    try {
      // Query payout_requests directly — paginate to get everything past Supabase's 1000-row default
      let allRows: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: chunk, error } = await supabase
          .from("payout_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) {
          console.error("Error fetching payout_requests:", error);
          break;
        }
        if (!chunk || chunk.length === 0) break;
        allRows = allRows.concat(chunk);
        if (chunk.length < pageSize || allRows.length >= limit) break;
        page++;
      }

      if (allRows.length === 0) return [];

      // payout_requests uses requester_type + requester_id (not agent_store_id/subagent_store_id).
      // Also support legacy rows that use agent_store_id / subagent_store_id / sub_subagent_store_id.
      const agentIds = [...new Set(allRows.flatMap((r: any) => {
        const ids: string[] = [];
        if (r.requester_type === "agent" && r.requester_id) ids.push(r.requester_id);
        if (r.agent_store_id) ids.push(r.agent_store_id);
        return ids;
      }))];
      const subagentIds = [...new Set(allRows.flatMap((r: any) => {
        const ids: string[] = [];
        if (r.requester_type === "subagent" && r.requester_id && !r.sub_subagent_store_id) ids.push(r.requester_id);
        if (r.subagent_store_id && !r.sub_subagent_store_id) ids.push(r.subagent_store_id);
        return ids;
      }))];
      const subSubIds = [...new Set(allRows.filter((r: any) => r.sub_subagent_store_id).map((r: any) => r.sub_subagent_store_id))];
      const recipientIds = [...new Set(allRows.filter((r: any) => r.recipient_id).map((r: any) => r.recipient_id))];

      const [agentStoresRes, subagentStoresRes, subSubStoresRes, recipientsRes] = await Promise.all([
        agentIds.length > 0 ? supabase.from("agent_stores").select("id, store_name, user_id, momo_name, momo_number, momo_network, wallet_balance, subagent_commission_balance").in("id", agentIds) : { data: [] },
        subagentIds.length > 0 ? supabase.from("subagent_stores").select("id, store_name, user_id, momo_name, momo_number, momo_network, wallet_balance").in("id", subagentIds) : { data: [] },
        subSubIds.length > 0 ? supabase.from("sub_subagent_stores").select("id, store_name, user_id, momo_name, momo_number, momo_network, wallet_balance").in("id", subSubIds) : { data: [] },
        recipientIds.length > 0 ? supabase.from("transfer_recipients").select("id, recipient_name, account_name, momo_number, momo_network, account_number, bank_name").in("id", recipientIds) : { data: [] },
      ]);

      const agentMap = Object.fromEntries((agentStoresRes.data || []).map((s: any) => [s.id, s]));
      const subagentMap = Object.fromEntries((subagentStoresRes.data || []).map((s: any) => [s.id, s]));
      const subSubMap = Object.fromEntries((subSubStoresRes.data || []).map((s: any) => [s.id, s]));
      const recipientMap = Object.fromEntries((recipientsRes.data || []).map((r: any) => [r.id, r]));

      return allRows.map((w: any) => {
        // Resolve agent store: try requester_id (new schema) then legacy agent_store_id
        const agentStoreId = (w.requester_type === "agent" ? w.requester_id : null) || w.agent_store_id || null;
        const agentStore = agentStoreId ? (agentMap[agentStoreId] || null) : null;

        const isSubSub = !!w.sub_subagent_store_id;
        // Resolve subagent/sub-subagent store
        const subagentStoreId = (w.requester_type === "subagent" && !isSubSub ? w.requester_id : null) || (w.subagent_store_id && !isSubSub ? w.subagent_store_id : null) || null;
        const subStore = isSubSub
          ? (subSubMap[w.sub_subagent_store_id] || null)
          : (subagentStoreId ? (subagentMap[subagentStoreId] || null) : null);

        // Paystack recipient — used as fallback for MoMo name/number/network
        const recipient = recipientMap[w.recipient_id] || null;
        const recipientMomoName = recipient?.account_name || recipient?.recipient_name || null;
        const recipientMomoNumber = recipient?.momo_number || recipient?.account_number || null;
        const recipientMomoNetwork = recipient?.momo_network || recipient?.bank_name || null;

        // Determine the withdrawing store for name/momo display
        const isSubagentType = w.requester_type === "subagent" || !!w.subagent_store_id;
        const displayStore = isSubSub ? subStore : (isSubagentType ? subStore : agentStore);

        // Derive effective IDs for backward compat with rest of component
        const effectiveAgentStoreId = agentStoreId;
        const effectiveSubagentStoreId = isSubSub ? null : (subagentStoreId || w.subagent_store_id || null);
        const effectiveSubSubStoreId = isSubSub ? (w.sub_subagent_store_id || null) : null;

        return {
          id: w.id,
          agent_store_id: effectiveAgentStoreId,
          subagent_store_id: effectiveSubagentStoreId,
          sub_subagent_store_id: effectiveSubSubStoreId,
          recipient_id: w.recipient_id,
          request_type: w.request_type || w.requester_type || null,
          amount: w.amount,
          status: w.status,
          created_at: w.created_at,
          processed_at: w.processed_at || w.completed_at || null,
          approved_at: w.approved_at,
          withdrawal_source: w.withdrawal_source || (isSubagentType || isSubSub ? "subagent_commission" : "wallet_balance"),
          transfer_code: w.transfer_code,
          paystack_reference: w.paystack_reference,
          failure_reason: w.failure_reason,
          source_balance_before: w.source_balance_before,
          source_balance_after: w.source_balance_after,
          agent_store: agentStore ? {
            id: agentStore.id,
            store_name: agentStore.store_name,
            user_id: agentStore.user_id,
            momo_name: agentStore.momo_name || (displayStore === agentStore ? recipientMomoName : null),
            momo_number: agentStore.momo_number || (displayStore === agentStore ? recipientMomoNumber : null),
            momo_network: agentStore.momo_network || (displayStore === agentStore ? recipientMomoNetwork : null),
            wallet_balance: agentStore.wallet_balance,
            subagent_commission_balance: agentStore.subagent_commission_balance,
          } : null,
          subagent_store: subStore ? {
            id: subStore.id,
            store_name: subStore.store_name,
            user_id: subStore.user_id,
            momo_name: subStore.momo_name || recipientMomoName,
            momo_number: subStore.momo_number || recipientMomoNumber,
            momo_network: subStore.momo_network || recipientMomoNetwork,
            wallet_balance: subStore.wallet_balance,
          } : (recipientMomoName || recipientMomoNumber ? {
            id: null,
            store_name: recipientMomoName || "—",
            user_id: null,
            momo_name: recipientMomoName,
            momo_number: recipientMomoNumber,
            momo_network: recipientMomoNetwork,
            wallet_balance: 0,
          } : null),
        };
      });
    } catch (err) {
      console.error("Exception fetching payout_requests:", err);
      return [];
    }
  };

  // Server-side search for topups by store name or reference number using RPC
  // Always queries Supabase directly, independent of loaded data
  const searchTopupsByStoreOrReference = async (searchQuery: string) => {
    setTopupSearching(true);
    try {
      const query = searchQuery.trim();
      
      // If search is empty, fetch all topups from Supabase (not from pre-loaded data)
      if (!query || query.length === 0) {
        const { data, error } = await supabase.rpc('get_topups_with_store_data');
        
        if (error) {
          console.error("[v0] Error fetching all topups:", error);
          setFilteredTopupHistory([]);
          setTopupSearching(false);
          return;
        }
        
        const results = (data || []).map((row: any) => ({
          id: row.id,
          agent_store_id: row.agent_store_id,
          amount: row.amount,
          created_at: row.created_at,
          agent_stores: {
            id: row.agent_store_id,
            store_name: row.store_name,
            topup_reference: row.topup_reference,
            wallet_balance: row.wallet_balance,
            momo_name: row.momo_name,
            momo_number: row.momo_number,
            momo_network: row.momo_network,
          },
        }));
        
        setFilteredTopupHistory(results);
        setTopupSearching(false);
        return;
      }
      
      // Call the RPC function that searches topups by store name or reference
      const { data, error } = await supabase.rpc('search_topups_by_store_or_ref', { search_query: query });
      
      if (error) {
        console.error("[v0] Topup search error:", error);
        setFilteredTopupHistory([]);
        setTopupSearching(false);
        return;
      }

      // Transform the flat response into TopupRecord structure
      const results = (data || []).map((row: any) => ({
        id: row.id,
        agent_store_id: row.agent_store_id,
        amount: row.amount,
        created_at: row.created_at,
        agent_stores: {
          id: row.agent_store_id,
          store_name: row.store_name,
          topup_reference: row.topup_reference,
          wallet_balance: row.wallet_balance,
          momo_name: row.momo_name,
          momo_number: row.momo_number,
          momo_network: row.momo_network,
        },
      }));

      setFilteredTopupHistory(results);
    } catch (err) {
      console.error("[v0] Topup search exception:", err);
      setFilteredTopupHistory([]);
    } finally {
      setTopupSearching(false);
    }
  };

  // Handle tab change - lazy load data when tab is clicked
  const handleTabChange = async (tabValue: string) => {
    setActiveTab(tabValue);
    
    // If this tab has already been loaded, don't fetch again
    if (loadedTabs.has(tabValue)) {
      return;
    }
    
    // Mark tab as loaded
    setLoadedTabs(prev => new Set(prev).add(tabValue));
    
    // Fetch data for this specific tab
    try {
      if (tabValue === "withdrawals") {
        const data = await fetchWithdrawalsWithStores(10000);
        setWithdrawals(data ?? []);
      } else if (tabValue === "topup") {
        const data = await fetchAllTopupsWithStores();
        setTopupHistory(data ?? []);
        setFilteredTopupHistory(data ?? []);
      } else if (tabValue === "orders") {
        const data = await fetchRecords("orders", "id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status, api_response, paystack_reference, created_at, agent_store_id, payment_method, subagent_store_id, customer_id, api_user, package_id, refunded_amount, sub_subagent_store_id", { column: "created_at", ascending: false }, 1000);
        setOrders(data ?? []);
        // Auto-refund any orders that are already order_status="failed" but not yet refunded.
        // These may have arrived before the realtime listener was active.
        const unrefundedFailed = (data ?? []).filter((o: any) => {
          const os = (o.order_status || "").toLowerCase();
          const alreadyDone = o.status === "refunded" || o.fulfillment_status === "refunded" || Number(o.refunded_amount) > 0;
          return os === "failed" && !alreadyDone;
        });
        if (unrefundedFailed.length > 0) {
          const ids = new Set<string>(unrefundedFailed.map((o: any) => o.id as string));
          // Small delay to ensure processRefunds closure is fresh
          setTimeout(() => { processRefunds(ids); }, 200);
        }
      } else if (tabValue === "agents") {
        const data = await fetchRecords("agent_stores", "id, user_id, store_name, whatsapp_number, support_number, whatsapp_group, momo_number, momo_name, momo_network, approved, created_at, wallet_balance, topup_reference, subagent_commission_balance", { column: "created_at", ascending: false }, 1000);
        setAgents(data ?? []);
      } else if (tabValue === "subagents") {
        const data = await fetchRecords("subagent_stores", "id, store_name, agent_store_id, created_at, whatsapp_number, support_number, momo_number, momo_name, momo_network, wallet_balance, agent_stores(store_name, id, user_id)", { column: "created_at", ascending: false }, 1000);
        setSubagents(data ?? []);
      } else if (tabValue === "users") {
        const data = await fetchRecords("profiles", "id, full_name, phone, created_at", { column: "created_at", ascending: false }, 10000);
        setUsers(data ?? []);
      } else if (tabValue === "customers") {
        const data = await fetchCustomers();
        setCustomers(data ?? []);
      } else if (tabValue === "sub_subagents") {
        await fetchSubSubagents();
      } else if (tabValue === "api_errors") {
        const logs = await getAPIErrorLogs({ resolved: false, limit: 1000 });
        setAPIErrors(logs ?? []);
      }
    } catch (error) {
      console.error(`Error loading ${tabValue} tab:`, error);
    }
  };
  const refreshData = async () => {
    try {
      // Load packages and app settings only — withdrawals/agents/etc load lazily via handleTabChange
      const [pkgResult, appSettingsResult] = await Promise.all([
        supabase.from("data_packages").select("id, network, size_gb, price, agent_price, api_price, active").order("size_gb").limit(100),
        supabase
          .from("app_settings")
          .select("agent_registration_fee, free_data_enabled, free_data_required_gb, free_data_reward_gb, free_data_telecel_enabled, chatbot_enabled")
          .eq("id", 1)
          .single(),
      ]);

      setPackages(pkgResult.data ?? []);

      const appSettings = appSettingsResult.data;
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
        if (typeof appSettings.chatbot_enabled === 'boolean') {
          setChatbotEnabled(appSettings.chatbot_enabled);
        }
      }
    } catch (error) {
      console.error("[v0] Error in refreshData:", error);
    }
  };
  
  // Fetch sub-subagents with their parent subagent info
  const fetchSubSubagents = async () => {
    try {
      const { data, error } = await supabase
        .from("sub_subagent_stores")
        .select("*, subagent_stores(id, store_name, agent_store_id)")
        .order("created_at", { ascending: false })
        .limit(200);
      
      if (error) {
        console.error("[v0] Supabase error:", error);
        toast({ title: "Error", description: "Failed to fetch sub-subagents", variant: "destructive" });
        setSubSubagents([]);
        return;
      }
      
      setSubSubagents(data || []);
      setLoadedTabs(prev => new Set([...prev, "sub_subagents"]));
    } catch (error) {
      console.error("[v0] Exception fetching sub-subagents:", error);
      toast({ title: "Error", description: "Failed to load sub-subagents", variant: "destructive" });
      setSubSubagents([]);
    }
  };

  // Load data when active tab changes
  useEffect(() => {
    if (activeTab === "orders" && !loadedTabs.has("orders")) {
      handleTabChange("orders");
    } else if (activeTab === "subagents" && subagents.length === 0) {
      handleTabChange("subagents");
    } else if (activeTab === "sub_subagents" && !loadedTabs.has("sub_subagents")) {
      fetchSubSubagents();
    } else if (activeTab === "customers" && customers.length === 0) {
      fetchCustomers();
    }
  }, [activeTab]);

  // Save app settings
  const saveAppSettings = async () => {
    setSavingSettings(true);
    try {
      // Save agent fee
      const { error: agentErr } = await supabase
        .from("app_settings")
        .upsert({ id: 1, agent_registration_fee: agentRegistrationFee });
      
      if (agentErr) throw agentErr;
      
      // Save AFA fee
      const { error: afaErr } = await supabase
        .from("afa_settings")
        .upsert({ base_registration_price: afaRegistrationFee });
      
      if (afaErr) throw afaErr;
      
      toast({ title: "Success!", description: "All fees saved successfully" });
    } catch (error: any) {
      console.error("[v0] Save error:", error);
      toast({ 
        title: "Error saving", 
        description: error?.message || "Failed to save settings", 
        variant: "destructive" 
      });
    } finally {
      setSavingSettings(false);
    }
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
  
  // Save chatbot enabled/disabled setting
  const saveChatbotSetting = async (enabled: boolean) => {
    setSavingChatbot(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: 1, chatbot_enabled: enabled });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setChatbotEnabled(!enabled); // revert on error
    } else {
      setChatbotEnabled(enabled);
      toast({ title: enabled ? "Support Chat enabled" : "Support Chat disabled", description: enabled ? "Visitors can now open the support chat." : "Visitors will see an unavailability message." });
    }
    setSavingChatbot(false);
  };

  // Save special MTN mashup pricing
  const saveSpecialMTNPricing = async () => {
    setSavingSpecialMTN(true);
    try {
      const { error } = await supabase
        .from("afa_settings")
        .update({
          special_mtn_mashup_1_user_price: parseFloat(specialMTNPricing.tier1_user_price),
          special_mtn_mashup_1_agent_price: parseFloat(specialMTNPricing.tier1_agent_price),
          special_mtn_mashup_1_enabled: specialMTNEnabled.tier1,
          special_mtn_mashup_2_user_price: parseFloat(specialMTNPricing.tier2_user_price),
          special_mtn_mashup_2_agent_price: parseFloat(specialMTNPricing.tier2_agent_price),
          special_mtn_mashup_2_enabled: specialMTNEnabled.tier2,
          special_mtn_mashup_3_user_price: parseFloat(specialMTNPricing.tier3_user_price),
          special_mtn_mashup_3_agent_price: parseFloat(specialMTNPricing.tier3_agent_price),
          special_mtn_mashup_3_enabled: specialMTNEnabled.tier3,
          special_mtn_mashup_4_user_price: parseFloat(specialMTNPricing.tier4_user_price),
          special_mtn_mashup_4_agent_price: parseFloat(specialMTNPricing.tier4_agent_price),
          special_mtn_mashup_4_enabled: specialMTNEnabled.tier4,
        })
        .eq("id", "1");
      
      if (error) {
        throw error;
      }
      
      toast({ title: "Special MTN Mashup pricing saved!" });
    } catch (error: any) {
      console.error("[v0] Error saving Special MTN pricing:", error);
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to save pricing",
        variant: "destructive"
      });
    } finally {
      setSavingSpecialMTN(false);
    }
  };

  // Fetch special MTN mashup pricing
  const fetchSpecialMTNPricing = async () => {
    try {
      // Fetch Special MTN packages from data_packages table
      const { data } = await supabase
        .from("data_packages")
        .select("id, package_name, user_price, agent_price, is_active, mins")
        .eq("network", "mtn")
        .like("package_name", "Special MTN Mashup%")
        .order("mins", { ascending: true });
      
      if (data && data.length === 4) {
        setSpecialMTNPricing({
          tier1_user_price: String(data[0].user_price || "6.00"),
          tier1_agent_price: String(data[0].agent_price || "6.00"),
          tier2_user_price: String(data[1].user_price || "13.00"),
          tier2_agent_price: String(data[1].agent_price || "13.00"),
          tier3_user_price: String(data[2].user_price || "25.00"),
          tier3_agent_price: String(data[2].agent_price || "25.00"),
          tier4_user_price: String(data[3].user_price || "35.00"),
          tier4_agent_price: String(data[3].agent_price || "35.00"),
        });
        setSpecialMTNEnabled({
          tier1: data[0].is_active !== false,
          tier2: data[1].is_active !== false,
          tier3: data[2].is_active !== false,
          tier4: data[3].is_active !== false,
        });
      }
    } catch (error) {
      console.error("[v0] Error fetching Special MTN pricing:", error);
    }
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
    const allSections: Section[] = ["prices", "orders", "agents", "subagents", "sub_subagents", "topup", "withdrawals", "users", "customers", "notifications", "push", "spinwheel", "afa", "afa_bundles", "complaints", "settings"];
    
    const { data, error } = await supabase
      .from("admin_permissions")
      .select("sections")
      .eq("user_id", userId)
      .single();
    
    // Always use all sections (merge DB sections with all available sections to ensure new sections are always accessible)
    if (data && data.sections && Array.isArray(data.sections)) {
      // Merge database sections with all available sections to ensure new sections added later are included
      const mergedSections = Array.from(new Set([...data.sections, ...allSections])) as Section[];
      setCurrentUserSections(mergedSections);
    } else {
      // No record or error - grant all sections by default
      setCurrentUserSections(allSections);
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
    fetchSpecialMTNPricing();
    if (currentUser?.id) {
      fetchCurrentUserPermissions(currentUser.id);
    }
  }, []);

  // Subscribe to real-time package changes — set up once on mount only
  useEffect(() => {
    const channel = supabase
      .channel('admin_packages_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'data_packages' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setPackages(prev => prev.map(pkg => pkg.id === payload.new.id ? { ...pkg, ...payload.new } : pkg).sort((a, b) => a.size_gb - b.size_gb));
        } else if (payload.eventType === 'INSERT') {
          setPackages(prev => [...prev, payload.new as DataPackage].sort((a, b) => a.size_gb - b.size_gb));
        } else if (payload.eventType === 'DELETE') {
          setPackages(prev => prev.filter(pkg => pkg.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Lightweight background refresh - only fetch counts every 10 seconds
  useEffect(() => {
    const refreshCountsOnly = async () => {
      try {
        const [ordersCount, agentsCount, subagentsCount, subSubagentsCount, usersCount, withdrawalsCount, topupsCount] = await Promise.all([
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase.from("agent_stores").select("id", { count: "exact", head: true }),
          supabase.from("subagent_stores").select("id", { count: "exact", head: true }),
          supabase.from("sub_subagent_stores").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }),
          supabase.from("wallet_topups").select("id", { count: "exact", head: true }),
        ]);
        
        setTotalCounts({
          orders: ordersCount.count ?? 0,
          agents: agentsCount.count ?? 0,
          subagents: subagentsCount.count ?? 0,
          sub_subagents: subSubagentsCount.count ?? 0,
          users: usersCount.count ?? 0,
          withdrawals: withdrawalsCount.count ?? 0,
          topups: topupsCount.count ?? 0,
          complaints: 0,
        });
      } catch (error) {
        console.error("[v0] Error refreshing counts:", error);
      }
    };

    // Initial count refresh
    refreshCountsOnly();
    
    // Refresh counts every 60 seconds (lightweight - counts only, no record data)
    const interval = setInterval(refreshCountsOnly, 60000);
    return () => clearInterval(interval);
  }, []);
  
  // Realtime subscriptions disabled - causes excessive refreshes and tab jumping
  // Admin dashboard works best with manual tab refreshes only
  /*
  useOptimizedRealtime(
    () => {
      // Only refresh data if a tab other than prices is currently active
      if (activeTab !== "prices" && loadedTabs.has(activeTab)) {
        handleTabChange(activeTab);
      }
    },
    5000, // 5 second debounce - less aggressive than 2 seconds
    [
      { name: 'orders' },
      { name: 'agent_stores' },
      { name: 'subagent_stores' },
      { name: 'withdrawal_requests' },
      { name: 'wallet_topups' },
      { name: 'profiles' },
    ]
  );
  */

  // Auto-retry pending orders - 3 second interval
  useEffect(() => {
    const autoRetryPendingOrders = async () => {
      try {
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
      } catch (error) {
        console.error("[v0] Auto-retry error:", error);
      }
    };
    const interval = setInterval(autoRetryPendingOrders, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Calculate unapproved withdrawals count
  useEffect(() => {
    if (withdrawals && withdrawals.length > 0) {
      const unapprovedCount = withdrawals.filter(w => w.status !== "completed" && w.status !== "approved").length;
      setUnapprovedWithdrawals(unapprovedCount);
    }
  }, [withdrawals]);

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
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Debounced server-side search for topups
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchTopupsByStoreOrReference(topupSearchTerm);
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(debounceTimer);
  }, [topupSearchTerm]);

  // ======================== Pending auto-refund queue ========================
  // The realtime listener runs inside a useEffect with [] so it holds a stale
  // closure — processRefunds does not exist yet when that effect mounts.
  // Instead the listener pushes order IDs into this ref and a separate effect
  // (declared AFTER processRefunds) drains the queue and runs the actual refund.
  const pendingAutoRefundIds = useRef<Set<string>>(new Set());

  // ======================== Real-time order status listener ========================
  useEffect(() => {
    const channel = supabase
      .channel("order-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          // Update only the affected order in state — avoid full refreshData() which hammers the DB
          const updated = payload.new as Order;
          const prev = payload.old as Partial<Order>;
          setOrders(prevOrders => prevOrders.map(o => o.id === updated.id ? { ...o, ...updated } : o));

          // Queue auto-refund when order_status transitions TO "failed" and the
          // order has not already been refunded.  The actual processRefunds call
          // happens in the effect below (declared after processRefunds).
          const newStatus = ((updated as any).order_status || "").toLowerCase();
          const oldStatus = ((prev as any).order_status || "").toLowerCase();
          const alreadyRefunded =
            updated.status === "refunded" ||
            updated.fulfillment_status === "refunded" ||
            Number((updated as any).refunded_amount) > 0;

          if (newStatus === "failed" && oldStatus !== "failed" && !alreadyRefunded) {
            pendingAutoRefundIds.current.add(updated.id);
            // Trigger the draining effect by updating a state counter
            setPendingAutoRefundTick(t => t + 1);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ======================== Withdrawal email listener + UI refresh ========================
  useEffect(() => {
    const channel = supabase
      .channel("withdrawal-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "withdrawal_requests" },
        async (payload) => {
          // Refresh withdrawal list if withdrawals tab is loaded
          if (loadedTabs.has("withdrawals")) {
            const updatedWithdrawals = await fetchWithdrawalsWithStores(10000);
            setWithdrawals(updatedWithdrawals ?? []);
          }

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
                                currentBalance: Number(currentBalance || 0).toFixed(2),
                                remainingBalance: Number(remainingBalance || 0).toFixed(2),
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
  const handlePriceChange = (id: string, field: "price" | "agent_price" | "api_price", value: string) => {
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
    const apiPrice = parseFloat(newPkg.api_price);
    if (!size || !price || !agentPrice || !apiPrice) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    const { error } = await supabase.from("data_packages").insert({ network: newPkg.network, size_gb: size, price, agent_price: agentPrice, api_price: apiPrice });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setAddDialogOpen(false);
    setNewPkg({ network: "mtn", size_gb: "", price: "", agent_price: "", api_price: "" });
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
  const queryOrdersFromDB = async (network: string, fulfillment: string, paymentStatus: string) => {
    setIsFilteringOrders(true);
    try {
      // Build query with DB-side filters — do NOT filter in memory
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);

      // Apply network filter directly on DB
      if (network !== "all") {
        if (network === "airtel") {
          query = query.in("network", ["airteltigo", "atbigtime", "atbigshare"]);
        } else {
          query = query.eq("network", network);
        }
      }

      // Apply fulfillment/order_status filter directly on DB
      if (fulfillment !== "all") {
        query = query.eq("order_status", fulfillment);
      }

      // Apply payment/status filter directly on DB
      if (paymentStatus !== "all") {
        query = query.eq("status", paymentStatus);
      }

      const { data: filtered, error } = await query;

      if (error) {
        console.error("[v0] Error querying orders from DB:", error);
        toast({ title: "Error", description: "Failed to filter orders", variant: "destructive" });
        return;
      }

      setFilteredOrdersFromDB(filtered || []);
    } catch (error) {
      console.error("[v0] Error querying orders from DB:", error);
      toast({ title: "Error", description: "Failed to filter orders", variant: "destructive" });
    } finally {
      setIsFilteringOrders(false);
    }
  };

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

  // Process refunds for selected orders
  const processRefunds = async (overrideOrderIds?: Set<string>) => {
    const idsToProcess = overrideOrderIds ?? selectedOrderIds;
    if (idsToProcess.size === 0) {
      if (!overrideOrderIds) {
        toast({ title: "Error", description: "No orders selected", variant: "destructive" });
      }
      return;
    }

    setRefundingOrders(idsToProcess);
    let successCount = 0;
    let errorCount = 0;

    // Resolve the authoritative base price the admin gave the agent for this package.
    // Storefront orders only store the customer-facing "amount", so we must look up the
    // real admin base price: a per-agent custom base price first, then the global package
    // agent_price, then finally whatever price fields the order happens to carry.
    const resolveAgentBasePrice = async (order: any, agentStoreId: string | null | undefined) => {
      if (order.package_id && agentStoreId) {
        const { data: custom } = await supabase
          .from("agent_custom_base_prices")
          .select("custom_base_price")
          .eq("agent_store_id", agentStoreId)
          .eq("package_id", order.package_id)
          .maybeSingle();
        if (custom?.custom_base_price != null) return Number(custom.custom_base_price);
      }
      if (order.package_id) {
        const { data: pkg } = await supabase
          .from("data_packages")
          .select("agent_price")
          .eq("id", order.package_id)
          .maybeSingle();
        if (pkg?.agent_price != null) return Number(pkg.agent_price);
      }
      // Use || (not ??) so that 0 falls through to the next value.
      // base_price is often stored as 0 on old orders; fall back to agent_price then amount.
      return Number(order.base_price || order.agent_price || order.amount) || 0;
    };

    // Resolves the price the admin charged an API user for a given order.
    // Checks per-user custom prices first, then falls back to data_packages.api_price,
    // then the stored order.amount as a last resort.
    const resolveApiPrice = async (order: any, apiUserId: string) => {
      if (order.package_id && apiUserId) {
        const { data: custom } = await supabase
          .from("api_user_package_prices")
          .select("custom_price")
          .eq("api_user_id", apiUserId)
          .eq("package_id", order.package_id)
          .maybeSingle();
        if (custom?.custom_price != null) return Number(custom.custom_price);
      }
      if (order.package_id) {
        const { data: pkg } = await supabase
          .from("data_packages")
          .select("api_price")
          .eq("id", order.package_id)
          .maybeSingle();
        if (pkg?.api_price != null) return Number(pkg.api_price);
      }
      return Number(order.base_price ?? order.amount) || 0;
    };

    for (const orderId of idsToProcess) {
      try {
        // Try to find order in local array first, then fetch from Supabase if not found
        let order = orders.find(o => o.id === orderId);
        if (!order) {
          console.log("[v0] Order not in local array, fetching from Supabase:", orderId);
          const { data: fetchedOrder, error: fetchErr } = await supabase
            .from("orders")
            .select(`*`)
            .eq("id", orderId)
            .maybeSingle();
          if (fetchErr || !fetchedOrder) {
            console.log("[v0] Failed to fetch order from Supabase:", orderId, fetchErr);
            errorCount++;
            continue;
          }
          order = fetchedOrder;
          console.log("[v0] Order fetched from Supabase:", orderId);
        }

        // Skip orders that are already refunded — check status, fulfillment_status,
        // and refunded_amount so no order can ever be refunded twice.
        // NOTE: order_status is intentionally NOT checked here because it is
        // preserved as "failed" (or whatever it was) so the admin can see the cause.
        const alreadyRefunded =
          order.status === "refunded" ||
          order.fulfillment_status === "refunded" ||
          (Number((order as any).refunded_amount) > 0);
        if (alreadyRefunded) {
          // Only show a warning toast when the admin manually triggered the refund
          if (!overrideOrderIds) {
            toast({ title: "Already refunded", description: `Order ${orderId.slice(0, 8)} was already refunded.`, variant: "destructive" });
          }
          continue;
        }

        // The amount the customer paid (used only for direct/API user refunds).
        const paidAmount = Number(order.amount) || 0;
        let refundAmount = paidAmount;
        let targetWalletUpdated = false;



        // Refund routing priority:
        // 1. agent_store_id → agent wallet (agent orders ALSO have customer_id set,
        //    so agent_store_id MUST be checked first or refund goes to wrong wallet)
        // 2. subagent_store_id → subagent wallet
        // 3. customer_id only → direct customer wallet (no agent involved)
        // 4. api_user → api wallet

        if (order.agent_store_id) {
          // Agent order: refund to agent_stores.wallet_balance at base price.
          refundAmount = await resolveAgentBasePrice(order, order.agent_store_id);

          const { data: agent } = await supabase
            .from("agent_stores")
            .select("id, wallet_balance")
            .eq("id", order.agent_store_id)
            .maybeSingle();

          if (agent) {
            const newBalance = (Number(agent.wallet_balance) || 0) + refundAmount;
            const { error: updateErr } = await supabase
              .from("agent_stores")
              .update({ wallet_balance: newBalance })
              .eq("id", agent.id);
            if (!updateErr) targetWalletUpdated = true;
            else console.log("[v0] agent wallet update failed:", updateErr.message);
          } else {
            console.log("[v0] agent_store not found for refund:", order.agent_store_id);
          }
        } else if (order.subagent_store_id) {
          // Subagent order: refund to subagent_stores.wallet_balance at base price.
          refundAmount = await resolveAgentBasePrice(order, order.agent_store_id ?? null);

          const { data: subagent } = await supabase
            .from("subagent_stores")
            .select("id, wallet_balance")
            .eq("id", order.subagent_store_id)
            .maybeSingle();

          if (subagent) {
            const newBalance = (Number(subagent.wallet_balance) || 0) + refundAmount;
            const { error: updateErr } = await supabase
              .from("subagent_stores")
              .update({ wallet_balance: newBalance })
              .eq("id", subagent.id);
            if (!updateErr) targetWalletUpdated = true;
          }
        } else if (order.customer_id) {
          // Check first: did an agent buy this from the Packages page? (agent_store_id was null
          // at the time of order but the customer_id maps to an approved agent store)
          const { data: agentByUser } = await supabase
            .from("agent_stores")
            .select("id, wallet_balance")
            .eq("user_id", order.customer_id)
            .eq("approved", true)
            .maybeSingle();

          if (agentByUser) {
            // Treat as an agent order: refund base price to agent wallet
            refundAmount = await resolveAgentBasePrice(order, agentByUser.id);
            const newBalance = (Number(agentByUser.wallet_balance) || 0) + refundAmount;
            const { error: updateErr } = await supabase
              .from("agent_stores")
              .update({ wallet_balance: newBalance })
              .eq("id", agentByUser.id);
            if (!updateErr) {
              targetWalletUpdated = true;
            } else {
              toast({ title: `Refund failed`, description: updateErr.message, variant: "destructive" });
              continue;
            }
          } else {
          // Direct customer order (no agent involved): refund to customers.wallet_balance.
          refundAmount = paidAmount;

          const { data: customer, error: fetchErr } = await supabase
            .from("customers")
            .select("id, wallet_balance")
            .eq("user_id", order.customer_id)
            .maybeSingle();

          if (customer) {
            const newBalance = (Number(customer.wallet_balance) || 0) + refundAmount;
            const { error: updateErr } = await supabase
              .from("customers")
              .update({ wallet_balance: newBalance })
              .eq("id", customer.id);
            if (!updateErr) {
              targetWalletUpdated = true;
            } else {
              toast({ title: `Refund failed`, description: updateErr.message, variant: "destructive" });
              continue;
            }
          } else {
            const { error: insertErr } = await supabase
              .from("customers")
              .insert({ user_id: order.customer_id, wallet_balance: refundAmount });
            if (!insertErr) {
              targetWalletUpdated = true;
            } else {
              toast({ title: `Refund failed`, description: insertErr.message || fetchErr?.message || "Customer wallet not found", variant: "destructive" });
              continue;
            }
          }
          } // end else (not an agent buying from Packages)
        } else if (order.api_user) {
          // API user order: order.api_user stores api_users.id (the PK uuid).
          // The 400 error was caused by selecting a non-existent column 'wallet_balance'
          // — the actual column is 'wallet'. Look up directly by PK id.
          const { data: apiUser, error: apiUserErr } = await supabase
            .from("api_users")
            .select("id, wallet")
            .eq("id", order.api_user)
            .maybeSingle();

          if (apiUserErr) {
            console.log("[v0] api_users lookup error:", apiUserErr.message, apiUserErr.details);
          }

          // Refund using the price admin charged this specific API user (per-user or api_price)
          refundAmount = await resolveApiPrice(order, apiUser?.id ?? order.api_user);

          if (apiUser) {
            const newBalance = (Number(apiUser.wallet) || 0) + refundAmount;
            const { error: updateErr } = await supabase
              .from("api_users")
              .update({ wallet: newBalance })
              .eq("id", apiUser.id);
            if (!updateErr) {
              targetWalletUpdated = true;
            } else {
              console.log("[v0] api_users wallet update error:", updateErr.message);
            }
          } else {
            // Fallback: try looking up by identity_id in case old orders stored auth UUID
            const { data: apiUserByIdentity } = await supabase
              .from("api_users")
              .select("id, wallet")
              .eq("identity_id", order.api_user)
              .maybeSingle();

            if (apiUserByIdentity) {
              refundAmount = await resolveApiPrice(order, apiUserByIdentity.id);
              const newBalance = (Number(apiUserByIdentity.wallet) || 0) + refundAmount;
              const { error: updateErr } = await supabase
                .from("api_users")
                .update({ wallet: newBalance })
                .eq("id", apiUserByIdentity.id);
              if (!updateErr) targetWalletUpdated = true;
            }
          }
        }

        if (targetWalletUpdated) {
          // Mark order as refunded. Try to store the refund amount/date; if those
          // columns don't exist yet, fall back to just the status fields.
          let refundErr: any = null;
          // NOTE: we intentionally preserve order_status as-is (e.g. "failed") so
          // the admin can see why the refund was triggered. We only mark status and
          // fulfillment_status as "refunded" to flag the payment/fulfillment columns.
          const richUpdate = await supabase
            .from("orders")
            .update({
              fulfillment_status: "refunded",
              status: "refunded",
              refunded_amount: refundAmount,
              refunded_at: new Date().toISOString(),
            })
            .eq("id", orderId);
          if (richUpdate.error) {
            const basicUpdate = await supabase
              .from("orders")
              .update({ fulfillment_status: "refunded", status: "refunded" })
              .eq("id", orderId);
            refundErr = basicUpdate.error;
          }

          if (!refundErr) {
            successCount++;
            setOrders((prev) =>
              prev.map((o) =>
                o.id === orderId
                  ? { ...o, fulfillment_status: "refunded", status: "refunded", refunded_amount: refundAmount }
                  : o
              )
            );
          } else {
            console.log("[v0] Order update failed, incrementing error count");
            errorCount++;
          }
        } else {
          console.log("[v0] Target wallet NOT updated. Order source not identified:", {
            has_subagent_store_id: !!order.subagent_store_id,
            has_agent_store_id: !!order.agent_store_id,
            has_api_user: !!order.api_user,
            has_customer_id: !!order.customer_id,
            order_source: order.payment_method || "unknown"
          });
          errorCount++;
        }
      } catch (error) {
        console.log("[v0] Refund error for order", orderId, ":", error);
        errorCount++;
      }
    }

    setRefundingOrders(new Set());
    setSelectedOrderIds(new Set());
    setRefundAction("");

    toast({
      title: "Refund Complete",
      description: `${successCount} refunded, ${errorCount} failed`,
      variant: errorCount > 0 ? "destructive" : "default"
    });
  };

  // ======================== Auto-refund draining effect ========================
  // This effect is declared AFTER processRefunds so it holds a fresh closure.
  // The realtime listener above cannot call processRefunds directly because it
  // is mounted before processRefunds is defined (stale closure). Instead it
  // pushes IDs to pendingAutoRefundIds and increments pendingAutoRefundTick to
  // wake this effect up with the current version of processRefunds.
  useEffect(() => {
    if (pendingAutoRefundTick === 0) return;
    const ids = new Set(pendingAutoRefundIds.current);
    if (ids.size === 0) return;
    pendingAutoRefundIds.current.clear();
    processRefunds(ids);
  // processRefunds is intentionally omitted from deps — we want the version
  // that is current when the tick fires, not a stale re-subscribed copy.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoRefundTick]);

  // Reverse a refund: take money back from the wallet and mark order as not refunded
  const reverseRefund = async (orderId: string) => {
    try {
      // Try local array first; if not found (e.g. from a different page of results) fetch from DB
      let order: typeof orders[0] | null = orders.find(o => o.id === orderId) ?? null;
      if (!order) {
        const { data: fetchedOrder, error: fetchErr } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();
        if (fetchErr || !fetchedOrder) {
          toast({ title: "Error", description: "Order not found in database", variant: "destructive" });
          return;
        }
        order = fetchedOrder;
      }

      const isRefunded = order.fulfillment_status === "refunded" || order.status === "refunded";
      if (!isRefunded || !order.refunded_amount) {
        toast({ title: "Error", description: "This order has not been refunded", variant: "destructive" });
        return;
      }

      setReversingRefundIds(new Set([...reversingRefundIds, orderId]));
      const refundAmount = Number(order.refunded_amount);
      let targetWalletUpdated = false;

      // Determine target wallet and deduct the refund amount.
      // agent_store_id MUST be checked before customer_id — agent orders have both set.
      if (order.agent_store_id) {
        // Agent refund reversal: deduct from agent wallet
        const { data: agent } = await supabase
          .from("agent_stores")
          .select("id, wallet_balance")
          .eq("id", order.agent_store_id)
          .maybeSingle();

        if (agent) {
          const newBalance = Math.max(0, (Number(agent.wallet_balance) || 0) - refundAmount);
          const { error: updateErr } = await supabase
            .from("agent_stores")
            .update({ wallet_balance: newBalance })
            .eq("id", agent.id);
          if (!updateErr) targetWalletUpdated = true;
        }
      } else if (order.subagent_store_id) {
        // Subagent refund reversal: deduct from subagent wallet
        const { data: subagent } = await supabase
          .from("subagent_stores")
          .select("id, wallet_balance")
          .eq("id", order.subagent_store_id)
          .maybeSingle();

        if (subagent) {
          const newBalance = Math.max(0, (Number(subagent.wallet_balance) || 0) - refundAmount);
          const { error: updateErr } = await supabase
            .from("subagent_stores")
            .update({ wallet_balance: newBalance })
            .eq("id", subagent.id);
          if (!updateErr) targetWalletUpdated = true;
        }
      } else if (order.customer_id) {
        // Check if this customer_id belongs to an agent (e.g. bought via Packages page
        // where agent_store_id was null at the time of the original order).
        const { data: agentByUser } = await supabase
          .from("agent_stores")
          .select("id, wallet_balance")
          .eq("user_id", order.customer_id)
          .eq("approved", true)
          .maybeSingle();

        if (agentByUser) {
          // Deduct from agent wallet instead
          const newBalance = Math.max(0, (Number(agentByUser.wallet_balance) || 0) - refundAmount);
          const { error: updateErr } = await supabase
            .from("agent_stores")
            .update({ wallet_balance: newBalance })
            .eq("id", agentByUser.id);
          if (!updateErr) targetWalletUpdated = true;
        } else {
        // Direct customer refund reversal: deduct from customers.wallet_balance
        const { data: customer } = await supabase
          .from("customers")
          .select("id, wallet_balance")
          .eq("user_id", order.customer_id)
          .maybeSingle();

        if (customer) {
          const newBalance = Math.max(0, (Number(customer.wallet_balance) || 0) - refundAmount);
          const { error: updateErr } = await supabase
            .from("customers")
            .update({ wallet_balance: newBalance })
            .eq("id", customer.id);
          if (!updateErr) targetWalletUpdated = true;
        }
        } // end else (not an agent)
      } else if (order.api_user) {
        // API refund: deduct from API user wallet
        const { data: apiUser } = await supabase
          .from("api_users")
          .select("wallet")
          .eq("topup_reference", order.api_user)
          .maybeSingle();

        if (apiUser) {
          const newBalance = Math.max(0, (apiUser.wallet || 0) - refundAmount);
          const { error: updateErr } = await supabase
            .from("api_users")
            .update({ wallet: newBalance })
            .eq("topup_reference", order.api_user);
          if (!updateErr) targetWalletUpdated = true;
        }
      }

      if (targetWalletUpdated) {
        // Mark order as NOT refunded
        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            fulfillment_status: "completed",
            status: "completed",
            refunded_amount: null,
            refunded_at: null,
          })
          .eq("id", orderId);

        if (!updateErr) {
          toast({
            title: "Refund Reversed",
            description: `GHC ${refundAmount.toFixed(2)} has been deducted from the wallet`,
            variant: "default"
          });
          // Refresh orders
          const { data: updatedOrder } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .maybeSingle();
          if (updatedOrder) {
            setOrders(orders.map(o => o.id === orderId ? updatedOrder : o));
          }
        } else {
          toast({ title: "Error", description: "Failed to mark order as completed", variant: "destructive" });
        }
      } else {
        toast({ title: "Error", description: "Failed to deduct from wallet", variant: "destructive" });
      }

      setReversingRefundIds(new Set([...reversingRefundIds].filter(id => id !== orderId)));
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
      setReversingRefundIds(new Set([...reversingRefundIds].filter(id => id !== orderId)));
    }
  };

  // ======================== API User Wallet topup ========================
  const searchApiTopupRef = async () => {
    const raw = apiTopupSearch.trim();
    if (!raw) { setApiTopupUser(null); return; }
    try {
      // Build variants: exact, with "us" suffix, and without "us" suffix
      const variants = [raw];
      if (!raw.toLowerCase().endsWith("us")) variants.push(`${raw}us`);
      else if (raw.length > 2) variants.push(raw.slice(0, -2));

      // Try exact match first across all variants, then fall back to ilike
      const { data, error } = await supabase
        .from("api_users")
        .select("id, store_name, user_email, email, wallet, topup_reference")
        .or(variants.map(v => `topup_reference.eq.${v}`).join(","))
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({ title: "Not found", description: "No API user found with that top-up reference.", variant: "destructive" });
        setApiTopupUser(null);
        return;
      }
      setApiTopupUser(data);
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
      setApiTopupUser(null);
    }
  };

  const creditApiWallet = async () => {
    if (!apiTopupUser) return;
    const amount = parseFloat(apiTopupAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Invalid amount", description: "Enter a valid amount greater than 0.", variant: "destructive" }); return; }
    setApiTopupLoading(true);
    try {
      const newBalance = Number(apiTopupUser.wallet || 0) + amount;
      const { error } = await supabase.from("api_users").update({ wallet: newBalance }).eq("id", apiTopupUser.id);
      if (error) throw error;
      setApiTopupUser({ ...apiTopupUser, wallet: newBalance });
      setApiTopupAmount("");
      toast({ title: "API wallet credited!", description: `GHC ${amount.toFixed(2)} added to ${apiTopupUser.store_name || apiTopupUser.user_email || apiTopupUser.email}. New balance: GHC ${newBalance.toFixed(2)}` });
    } catch (err: any) {
      toast({ title: "Credit failed", description: err.message, variant: "destructive" });
    } finally {
      setApiTopupLoading(false);
    }
  };

  // ======================== Wallet topup ========================
  const searchTopupRef = async () => {
    if (!topupSearch.trim()) {
      setTopupAgent(null);
      return;
    }
    
    try {
      // Query Supabase directly for agent by exact topup_reference match
      const { data, error } = await supabase
        .from("agent_stores")
        .select("id, store_name, topup_reference, wallet_balance, momo_name, momo_number, momo_network")
        .eq("topup_reference::text", topupSearch.trim())
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine
        console.error("Error searching topup reference:", error);
        toast({ 
          title: "Error", 
          description: "Error searching for agent store", 
          variant: "destructive" 
        });
        setTopupAgent(null);
        return;
      }

      if (data) {
        setTopupAgent(data);
      } else {
        toast({ 
          title: "Not found", 
          description: "No agent with that reference code.", 
          variant: "destructive" 
        }); 
        setTopupAgent(null);
      }
    } catch (err) {
      console.error("Exception searching topup reference:", err);
      toast({ 
        title: "Error", 
        description: "Error searching for agent store", 
        variant: "destructive" 
      });
      setTopupAgent(null);
    }
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
    toast({ title: "Wallet credited!", description: `GHC ${Number(amount || 0).toFixed(2)} added to ${topupAgent.store_name}` });
    setTopupLoading(false);
  };



  // Fetch customers from database
  const fetchCustomers = async (searchTerm = "", exactMatch = false) => {
  try {
  let query = supabase
  .from("customers")
  .select("*")
  .order("customer_since", { ascending: false });

  const term = searchTerm.trim();
  if (term) {
    const escaped = term.replace(/[%(),]/g, "");
    query = exactMatch
      ? query.or(`first_name.eq.${escaped},last_name.eq.${escaped},email.eq.${escaped},topup_reference.eq.${escaped},phone_number.eq.${escaped}`)
      : query.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,topup_reference.ilike.%${escaped}%,phone_number.ilike.%${escaped}%`);
  }

  const { data, error } = await query;


      if (error) {
        console.error("[v0] Error fetching customers:", error.message);
        toast({ title: "Error", description: "Failed to fetch customers", variant: "destructive" });
        return [];
      }

      console.log("[v0] Fetched customers:", data?.length || 0);
      setCustomers(data || []);
      return data || [];
    } catch (err) {
      console.error("[v0] Exception fetching customers:", err);
      return [];
    }
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
  const processWithdrawal = async (withdrawalId: string, agentStoreId: string | null, amount: number, withdrawalSource: string = "wallet", subagentStoreId?: string | null, subsubagentStoreId?: string | null) => {
    setProcessingWithdrawals((prev) => new Set(prev).add(withdrawalId));
    try {
      // Re-fetch the withdrawal to get the correct source and IDs
      const { data: withdrawalData } = await supabase
        .from("withdrawal_requests")
        .select("withdrawal_source, agent_store_id, subagent_store_id, sub_subagent_store_id")
        .eq("id", withdrawalId)
        .single();
      
      const confirmedSource = withdrawalData?.withdrawal_source || withdrawalSource || "wallet";
      const isSubsubagentWithdrawal = !!withdrawalData?.sub_subagent_store_id;
      const isSubagentWithdrawal = !!withdrawalData?.subagent_store_id && !isSubsubagentWithdrawal;
      const isSubagentProfit = confirmedSource === "subagent_commission";
      
      if (isSubsubagentWithdrawal) {
        // SUBSUBAGENT WITHDRAWAL - fetch fresh balance from database first
        const { data: freshSubsubagent, error: fetchError } = await supabase
          .from("subagent_stores")
          .select("wallet_balance")
          .eq("id", withdrawalData.sub_subagent_store_id)
          .single();
        
        if (fetchError || !freshSubsubagent) throw new Error("Failed to fetch subsubagent balance");
        
        const currentBalance = Number(freshSubsubagent.wallet_balance ?? 0);
        const newBalance = currentBalance - amount;
        
        await supabase.from("subagent_stores").update({ wallet_balance: newBalance }).eq("id", withdrawalData.sub_subagent_store_id);
        await supabase.from("withdrawal_requests").update({ status: "completed", processed_at: new Date().toISOString() }).eq("id", withdrawalId);
        
        // Update local state
        setSubagents((prev) => prev.map((s) => s.id === withdrawalData.sub_subagent_store_id ? { ...s, wallet_balance: newBalance } : s));
        setWithdrawals((prev) => prev.map((w) => w.id === withdrawalId ? { ...w, status: "completed", processed_at: new Date().toISOString() } : w));
        
        toast({ title: "Withdrawal processed!", description: `GHC ${Number(amount || 0).toFixed(2)} deducted from SubSubagent wallet. New balance: GHC ${Number(newBalance || 0).toFixed(2)}.` });
      } else if (isSubagentWithdrawal) {
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
        
        toast({ title: "Withdrawal processed!", description: `GHC ${Number(amount || 0).toFixed(2)} deducted from Subagent wallet. New balance: GHC ${Number(newBalance || 0).toFixed(2)}.` });
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
        toast({ title: "Withdrawal processed!", description: `GHC ${Number(amount || 0).toFixed(2)} deducted from ${sourceLabel}. New balance: GHC ${Number(newBalance || 0).toFixed(2)}.` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingWithdrawals((prev) => { const next = new Set(prev); next.delete(withdrawalId); return next; });
    }
  };

  // ======================== Helpers ========================
  const canSee = (section: Section) => currentUserSections.includes(section);

  const filteredPackages = packages.filter((p) => {
    if (networkFilter === "airteltigo") {
      return p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
    }
    return p.network === networkFilter;
  });
  const failedCount = orders.filter((o) => o.fulfillment_status === "failed").length;
  const refundedCount = orders.filter((o) => o.fulfillment_status === "refunded" || o.status === "refunded").length;
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  
  const filteredAgents = (agentSearchTerm.length > 0 ? agentSearch.results : agents)
    .filter((agent) => {
      if (agentExactMatch && agentSearchTerm.length > 0) {
        const t = agentSearchTerm.toLowerCase();
        const match = agent.store_name?.toLowerCase() === t || agent.topup_reference?.toLowerCase() === t;
        if (!match) return false;
      }
      return agentApprovalFilter === "all" ? true : (agentApprovalFilter === "approved" ? agent.approved : !agent.approved);
    });
  
  // Use database search results if searching, otherwise use local users (first 100)
  const filteredUsers = userSearchTerm.length > 0 ? profileSearch.results : users;
  
  // Use database filtered results if filters are active, otherwise use search results
  let baseOrders = (orderNetworkFilter !== "all" || orderFulfillmentFilter !== "all" || orderPaymentStatusFilter !== "all")
    ? filteredOrdersFromDB
    : (orderSearchTerm.length > 0 ? orderSearch.results : orders);

  // Apply latest orders filter (keep only last N orders per customer)
  if (orderLatestFilter && orderLatestFilter > 0 && orderSearchTerm.length > 0) {
    const ordersPerCustomer = new Map<string, typeof baseOrders>();
    baseOrders.forEach(order => {
      const customer = order.customer_number || "unknown";
      if (!ordersPerCustomer.has(customer)) {
        ordersPerCustomer.set(customer, []);
      }
      ordersPerCustomer.get(customer)!.push(order);
    });

    baseOrders = [];
    ordersPerCustomer.forEach(customerOrders => {
      // Sort by date descending and take latest N
      const sorted = customerOrders
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, orderLatestFilter);
      baseOrders.push(...sorted);
    });

    // Re-sort all results by date
    baseOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  // Apply date range, source, delivery status, and refund filters
  const filteredOrders = baseOrders.filter(order => {
    // Refund filter — an order is considered refunded when status OR fulfillment_status is "refunded"
    // (order_status is preserved as the original value, e.g. "failed", so we don't check it here)
    if (showRefundedOnly) {
      const isRefunded = order.fulfillment_status === "refunded" || order.status === "refunded";
      if (!isRefunded) return false;
    }

    // Date range
    if (orderDateFrom || orderDateTo) {
      const orderDate = new Date(order.created_at || 0).getTime();
      const fromDate = orderDateFrom ? new Date(orderDateFrom).getTime() : 0;
      const toDate = orderDateTo ? new Date(orderDateTo).getTime() + 86400000 : Infinity;
      if (orderDate < fromDate || orderDate > toDate) return false;
    }

    // Source filter
    if (orderSourceFilter !== "all") {
      const hasSubSubagent = !!(order as any).sub_subagent_store_id;
      const hasSubagent = !!order.subagent_store_id;
      const hasAgent = !!order.agent_store_id;
      const isAPI = !!(order.api_user && String(order.api_user).trim() !== "");
      if (orderSourceFilter === "sub-subagent" && !hasSubSubagent) return false;
      if (orderSourceFilter === "subagent" && (hasSubSubagent || !hasSubagent)) return false;
      if (orderSourceFilter === "agent" && (hasSubagent || hasSubSubagent || isAPI)) return false;
      if (orderSourceFilter === "direct" && (hasAgent || isAPI)) return false;
      if (orderSourceFilter === "api" && !isAPI) return false;
    }

    // Delivery status filter
    if (orderDeliveryFilter !== "all") {
      const deliveryStatus = (
        (order as any).order_status ||
        order.fulfillment_status ||
        order.status ||
        ""
      ).toLowerCase();
      if (deliveryStatus !== orderDeliveryFilter) return false;
    }

    return true;
  });
  
  const filteredWithdrawals = withdrawals
    .filter((withdrawal) => {
      // If no search term, show all
      if (!withdrawalSearchTerm) return true;
      
      // Check if it's a subagent withdrawal
      if (withdrawal.subagent_store_id) {
        const subagent = subagents.find((s) => s.id === withdrawal.subagent_store_id);
        return subagent?.store_name.toLowerCase().includes(withdrawalSearchTerm.toLowerCase()) ?? false;
      }
      // Otherwise, check agent store
      const agent = agents.find((a) => a.id === withdrawal.agent_store_id);
      return agent?.store_name.toLowerCase().includes(withdrawalSearchTerm.toLowerCase()) ?? false;
    })
    // Sort: pending first, then by date descending
    .sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const filteredSubagents = (subagentSearchTerm.length > 0 ? subagentSearch.results : subagents)
    .filter((subagent) => {
      if (subagentExactMatch && subagentSearchTerm.length > 0) {
        const t = subagentSearchTerm.toLowerCase();
        const match = subagent.store_name?.toLowerCase() === t || subagent.top_reference?.toLowerCase() === t;
        if (!match) return false;
      }
      return subagentStatusFilter === "all" ? true : (subagentStatusFilter === "active" ? !subagent.suspended : subagent.suspended);
    });

  const filteredSubSubagents = subSubagentSearchTerm.length > 0
    ? subSubagents.filter((s) => {
        const t = subSubagentSearchTerm.toLowerCase();
        if (subSubagentExactMatch) {
          return s.store_name?.toLowerCase() === t || s.top_reference?.toLowerCase() === t;
        }
        return s.store_name?.toLowerCase().includes(t) || s.top_reference?.toLowerCase().includes(t);
      })
    : subSubagents;

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
        <Tabs value={activeTab} onValueChange={handleTabChange} defaultValue="prices">
          <TabsList className="mb-6 flex-wrap gap-1 h-auto p-1 md:p-2 bg-background border border-border rounded-lg overflow-x-auto w-full flex">
            <TabsTrigger value="prices" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap">Prices</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1">
              <ShoppingCart className="h-3 w-3 md:h-4 md:w-4" /> Orders
              {failedCount > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">{failedCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap">Agents ({agents.filter((a) => !a.approved).length})</TabsTrigger>
            <TabsTrigger value="subagents" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Users className="h-3 w-3 md:h-4 md:w-4" /> Subagents ({subagents.filter((s) => !s.approved).length})</TabsTrigger>
            <TabsTrigger value="sub_subagents" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Users className="h-3 w-3 md:h-4 md:w-4" /> Sub-Subagents ({subSubagents.filter((s) => !s.approved).length})</TabsTrigger>
            <TabsTrigger value="topup" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Wallet className="h-3 w-3 md:h-4 md:w-4" /> Topup</TabsTrigger>
            <TabsTrigger value="withdrawals" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4" /> Withdrawals ({totalCounts.withdrawals})
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Users className="h-3 w-3 md:h-4 md:w-4" /> Users</TabsTrigger>
            <TabsTrigger value="customers" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Users className="h-3 w-3 md:h-4 md:w-4" /> Customers</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Bell className="h-3 w-3 md:h-4 md:w-4" /> Notify</TabsTrigger>
            <TabsTrigger value="push" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Smartphone className="h-3 w-3 md:h-4 md:w-4" /> Push</TabsTrigger>
            <TabsTrigger value="spinwheel" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Gift className="h-3 w-3 md:h-4 md:w-4" /> Spin</TabsTrigger>
            <TabsTrigger value="afa" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Zap className="h-3 w-3 md:h-4 md:w-4" /> AFA</TabsTrigger>
            <TabsTrigger value="afa_bundles" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Package className="h-3 w-3 md:h-4 md:w-4" /> AFA Bundles</TabsTrigger>
            <TabsTrigger value="complaints" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><AlertCircle className="h-3 w-3 md:h-4 md:w-4" /> Complaints</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Settings2 className="h-3 w-3 md:h-4 md:w-4" /> Settings</TabsTrigger>
          <TabsTrigger value="api_pricing" className="text-xs md:text-sm px-2 md:px-3 py-1 md:py-2 whitespace-nowrap flex items-center gap-1"><Zap className="h-3 w-3 md:h-4 md:w-4" /> API Pricing</TabsTrigger>
          </TabsList>

          {/* PRICES TAB */}
          {canSee("prices") && (
            <TabsContent value="prices" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                  {[
                    { key: "mtn", label: "MTN" },
                    { key: "mtn_express", label: "MTN Express" },
                    { key: "airteltigo", label: "AirtelTigo" },
                    { key: "telecel", label: "Telecel" },
                  ].map(({ key, label }) => (
                    <Button key={key} variant={networkFilter === key ? "hero" : "outline"} size="sm" onClick={() => setNetworkFilter(key)}>
                      {label}
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
                  <TableHeader><TableRow><TableHead>Size</TableHead><TableHead>User Price (GHC)</TableHead><TableHead>Agent Price (GHC)</TableHead><TableHead>API Price (GHC)</TableHead><TableHead>Active</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredPackages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                        <TableCell><Input type="number" step="0.01" defaultValue={pkg.price} onChange={(e) => handlePriceChange(pkg.id, "price", e.target.value)} className="w-24 h-8" /></TableCell>
                        <TableCell><Input type="number" step="0.01" defaultValue={pkg.agent_price} onChange={(e) => handlePriceChange(pkg.id, "agent_price", e.target.value)} className="w-24 h-8" /></TableCell>
                        <TableCell><Input type="number" step="0.01" defaultValue={pkg.api_price} onChange={(e) => handlePriceChange(pkg.id, "api_price", e.target.value)} className="w-24 h-8" /></TableCell>
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
              {refundedCount > 0 && (
                <div className="flex items-center justify-between p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <p className="text-sm text-foreground">
                    <span className="font-bold text-amber-500">{refundedCount} refunded</span> order(s) in the current view — these orders had their payments returned to the buyer&apos;s wallet.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                    onClick={() => setShowRefundedOnly(!showRefundedOnly)}
                  >
                    {showRefundedOnly ? "Show All Orders" : "View Refunded Only"}
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <textarea 
                    placeholder="Search by phone number (paste multiple separated by commas, newlines, or spaces)..." 
                    value={orderSearchTerm}
                    onChange={(e) => {
                      setOrderSearchTerm(e.target.value);
                      if (e.target.value.length > 0) {
                        orderSearch.search(e.target.value);
                      }
                    }}
                    className="pl-10 w-full min-h-20 p-3 rounded-md border border-input bg-background text-sm resize-none" 
                  />
                  {orderSearch.isSearching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {orderSearchTerm && (
                  <p className="text-xs text-muted-foreground">
                    Found <span className="font-semibold text-foreground">{orderSearch.results.length}</span> order(s) matching your search
                  </p>
                )}
              </div>

              {/* Latest Orders & Date Range Filters — shown below search box */}
              {orderSearchTerm && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="text-xs font-medium block mb-1">Show Only Latest</label>
                      <select 
                        value={orderLatestFilter === null ? "" : orderLatestFilter}
                        onChange={(e) => setOrderLatestFilter(e.target.value === "" ? null : parseInt(e.target.value))}
                        className="px-2 py-1 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">All Orders</option>
                        <option value="1">Last 1</option>
                        <option value="2">Last 2</option>
                        <option value="3">Last 3</option>
                        <option value="5">Last 5</option>
                        <option value="10">Last 10</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    <div>
                      <label className="text-xs font-medium block mb-1">From Date</label>
                      <input 
                        type="date"
                        value={orderDateFrom}
                        onChange={(e) => setOrderDateFrom(e.target.value)}
                        className="px-2 py-1 rounded-md border border-input bg-background text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">To Date</label>
                      <input 
                        type="date"
                        value={orderDateTo}
                        onChange={(e) => setOrderDateTo(e.target.value)}
                        className="px-2 py-1 rounded-md border border-input bg-background text-xs"
                      />
                    </div>
                    {(orderLatestFilter || orderDateFrom || orderDateTo) && (
                      <button
                        onClick={() => {
                          setOrderLatestFilter(null);
                          setOrderDateFrom("");
                          setOrderDateTo("");
                        }}
                        className="px-2 py-1 text-xs rounded-md border border-input bg-muted hover:bg-muted/80"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Show Refunded Only Checkbox */}
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showRefundedOnly}
                    onChange={(e) => setShowRefundedOnly(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Show refunded orders only</span>
                </label>
              </div>

              {/* Order Filters */}
              <div className="flex gap-2 flex-wrap">
                <Select value={orderNetworkFilter} onValueChange={(value) => {
                  setOrderNetworkFilter(value);
                  if (value === "all" && orderFulfillmentFilter === "all" && orderPaymentStatusFilter === "all") {
                    setFilteredOrdersFromDB([]);
                  } else {
                    queryOrdersFromDB(value, orderFulfillmentFilter, orderPaymentStatusFilter);
                  }
                }}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Network" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Networks</SelectItem>
                    <SelectItem value="mtn">MTN</SelectItem>
                    <SelectItem value="mtn_express">MTN Express</SelectItem>
                    <SelectItem value="airtel">AirtelTigo</SelectItem>
                    <SelectItem value="telecel">Telecel</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orderFulfillmentFilter} onValueChange={(value) => {
                  setOrderFulfillmentFilter(value);
                  if (orderNetworkFilter === "all" && value === "all" && orderPaymentStatusFilter === "all") {
                    setFilteredOrdersFromDB([]);
                  } else {
                    queryOrdersFromDB(orderNetworkFilter, value, orderPaymentStatusFilter);
                  }
                }}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Fulfillment" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orderPaymentStatusFilter} onValueChange={(value) => {
                  setOrderPaymentStatusFilter(value);
                  if (orderNetworkFilter === "all" && orderFulfillmentFilter === "all" && value === "all") {
                    setFilteredOrdersFromDB([]);
                  } else {
                    queryOrdersFromDB(orderNetworkFilter, orderFulfillmentFilter, value);
                  }
                }}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Filter by Payment" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payment Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orderSourceFilter} onValueChange={setOrderSourceFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Filter by Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="agent">Agent Storefront</SelectItem>
                    <SelectItem value="subagent">Subagent Storefront</SelectItem>
                    <SelectItem value="sub-subagent">Sub-Subagent Storefront</SelectItem>
                    <SelectItem value="direct">Direct (Main Site)</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orderDeliveryFilter} onValueChange={setOrderDeliveryFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Filter by Delivery" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Delivery Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                // Show loading state if tab just loaded
                if (activeTab === "orders" && !loadedTabs.has("orders")) {
                  return (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
                      ))}
                    </div>
                  );
                }
                
                const paginated = filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);
                const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
                
                return (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredOrders.length === 0 ? 0 : (orderPage - 1) * PAGE_SIZE + 1} - {Math.min(orderPage * PAGE_SIZE, filteredOrders.length)} of {totalCounts.orders} orders
                    </p>
                    <Card className="border-border">
                      {selectedOrderIds.size > 0 && (
                        <div className="p-3 bg-cyan-500/10 border-b border-cyan-500/30 flex items-center justify-between">
                          <p className="text-sm font-medium text-cyan-400">{selectedOrderIds.size} order{selectedOrderIds.size !== 1 ? "s" : ""} selected</p>
                          <select
                            value={refundAction}
                            onChange={(e) => {
                              setRefundAction(e.target.value as "refund" | "");
                              if (e.target.value === "refund") {
                                processRefunds();
                              }
                            }}
                            disabled={refundingOrders.size > 0}
                            className="px-3 py-1 rounded border border-cyan-500/30 bg-background text-foreground text-sm"
                          >
                            <option value="">Select Action...</option>
                            <option value="refund">Refund Selected Orders</option>
                          </select>
                        </div>
                      )}
                      <Table>
                        <TableHeader><TableRow><TableHead style={{ width: "40px" }}><input type="checkbox" checked={selectedOrderIds.size === paginated.length && paginated.length > 0} onChange={(e) => { if (e.target.checked) { setSelectedOrderIds(new Set(paginated.map(o => o.id))); } else { setSelectedOrderIds(new Set()); } }} className="rounded border-border" /></TableHead><TableHead>Date & Time</TableHead><TableHead>Phone</TableHead><TableHead>Network</TableHead><TableHead>Size</TableHead><TableHead>Amount</TableHead><TableHead>Refund</TableHead><TableHead>Source</TableHead><TableHead>Method</TableHead><TableHead>Payment</TableHead><TableHead>Fulfillment</TableHead><TableHead>Order Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {paginated.length === 0 ? <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No orders match your search.</TableCell></TableRow> :
                            paginated.map((order) => {
                              // Determine source
                              const agentStore = order.agent_store_id ? agents.find(a => a.id === order.agent_store_id) : null;
                              const subagentStore = order.subagent_store_id ? subagents.find(s => s.id === order.subagent_store_id) : null;
                              const subSubagentStore = (order as any).sub_subagent_store_id ? subSubagents.find((s: any) => s.id === (order as any).sub_subagent_store_id) : null;
                              // An order is only an API order when it was actually placed via the API
                              // (i.e. the api_user field is set). Missing store IDs alone means a
                              // direct main-site order, NOT an API order.
                              const isAPIOrder = !!(order.api_user && String(order.api_user).trim() !== "");
                              
                              let sourceType = "Main Site";
                              // For direct (non-agent/non-API) orders, show the customer email
                              const directCustomerEmail = (!order.agent_store_id && !order.subagent_store_id && !(order as any).sub_subagent_store_id && !isAPIOrder)
                                ? (customers as any[])?.find?.((c: any) => c.user_id === order.customer_id)?.email || null
                                : null;
                              let sourceLabel = isAPIOrder ? "API" : (directCustomerEmail || "Direct");
                              let sourceBadgeClass = isAPIOrder ? "bg-orange-500/10 text-orange-400 border-orange-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30";
                              
                              if (subSubagentStore) {
                                sourceType = "Sub-Subagent";
                                sourceLabel = subSubagentStore.store_name || "Sub-Subagent";
                                sourceBadgeClass = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
                              } else if (subagentStore) {
                                sourceType = "Subagent";
                                sourceLabel = subagentStore.store_name || "Subagent";
                                sourceBadgeClass = "bg-purple-500/10 text-purple-400 border-purple-500/30";
                              } else if (agentStore) {
                                sourceType = "Agent";
                                sourceLabel = agentStore.store_name || "Agent";
                                sourceBadgeClass = "bg-green-500/10 text-green-400 border-green-500/30";
                              }
                              
                              return (
                              <TableRow key={order.id} className={selectedOrderIds.has(order.id) ? "bg-cyan-500/10" : ""}>
                                <TableCell style={{ width: "40px" }} className="text-center"><input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={(e) => { if (e.target.checked) { setSelectedOrderIds(new Set([...selectedOrderIds, order.id])); } else { const newSet = new Set(selectedOrderIds); newSet.delete(order.id); setSelectedOrderIds(newSet); } }} className="rounded border-border" /></TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</TableCell>
                                <TableCell className="font-medium">{order.customer_number}</TableCell>
                                <TableCell className="uppercase text-sm">{order.network}</TableCell>
                                <TableCell className="font-display font-bold">{order.size_gb}GB</TableCell>
                                <TableCell>GHC {Number(order.amount || 0).toFixed(2)}</TableCell>
                                <TableCell>
                                  {order.refunded_amount ? (
                                    <span className="text-green-600 font-semibold">GHC {Number(order.refunded_amount).toFixed(2)}</span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs cursor-pointer hover:opacity-80 ${sourceBadgeClass}`}
                                      onClick={() => {
                                        if (subSubagentStore) {
                                          const parentSubagent = subagentStore || subagents.find((s: any) => s.id === subSubagentStore.subagent_store_id) || (subSubagentStore as any).subagent_stores || null;
                                          const parentAgent = agentStore || (parentSubagent?.agent_store_id ? agents.find((a: any) => a.id === parentSubagent.agent_store_id) || (parentSubagent as any).agent_stores || null : null);
                                          setSourceInfo({
                                            type: "Sub-Subagent Store",
                                            storeName: subSubagentStore.store_name || "Unknown",
                                            contact: subSubagentStore.support_number || subSubagentStore.whatsapp_number || "N/A",
                                            storeUrl: subSubagentStore.user_id ? `#impersonate:sub_subagent:${subSubagentStore.user_id}` : subSubagentStore.store_url || undefined,
                                            parentSubagentName: parentSubagent?.store_name || undefined,
                                            parentSubagentUrl: parentSubagent?.user_id ? `#impersonate:subagent:${parentSubagent.user_id}` : parentSubagent?.store_url || undefined,
                                            parentAgentName: parentAgent?.store_name || undefined,
                                            parentAgentUrl: parentAgent?.user_id ? `#impersonate:agent:${parentAgent.user_id}` : parentAgent?.store_url || undefined,
                                          });
                                          setSourceDialogOpen(true);
                                        } else if (subagentStore) {
                                          // Try local agents array first; fall back to the embedded agent_stores join on subagentStore
                                          const parentAgent = agents.find((a: any) => a.id === subagentStore.agent_store_id)
                                            || (subagentStore as any).agent_stores || null;
                                          setSourceInfo({
                                            type: "Subagent Store",
                                            storeName: subagentStore.store_name || "Unknown",
                                            contact: subagentStore.support_number || subagentStore.whatsapp_number || "N/A",
                                            storeUrl: subagentStore.user_id ? `#impersonate:subagent:${subagentStore.user_id}` : subagentStore.store_url || undefined,
                                            parentAgentName: parentAgent?.store_name || undefined,
                                            parentAgentUrl: parentAgent?.user_id ? `#impersonate:agent:${parentAgent.user_id}` : parentAgent?.store_url || undefined,
                                          });
                                          setSourceDialogOpen(true);
                                        } else if (agentStore) {
                                          setSourceInfo({
                                            type: "Agent Store",
                                            storeName: agentStore.store_name || "Unknown",
                                            contact: agentStore.whatsapp_number || agentStore.support_number || "N/A",
                                            storeUrl: agentStore.user_id ? `#impersonate:agent:${agentStore.user_id}` : agentStore.store_url || undefined,
                                          });
                                          setSourceDialogOpen(true);
                                        } else if (isAPIOrder) {
                                          setSourceInfo({
                                            type: "API User",
                                            storeName: order.api_user || "Unknown API User",
                                            contact: "N/A",
                                          });
                                          setSourceDialogOpen(true);
                                        } else {
                                          // Show customer email + top-up reference for direct orders
                                          const customerRecord = (customers as any[])?.find?.((c: any) => c.user_id === order.customer_id);
                                          const customerEmail = customerRecord?.email || order.customer_number || "Unknown Customer";
                                          const topupRef = (order as any).topup_reference || (order as any).paystack_reference || (order as any).payment_reference || undefined;
                                          setSourceInfo({
                                            type: "Customer Account",
                                            storeName: customerEmail,
                                            contact: order.customer_number || "N/A",
                                            topupReference: topupRef,
                                            storeUrl: `/user-dashboard?impersonate=${order.customer_id}`,
                                          });
                                          setSourceDialogOpen(true);
                                        }
                                      }}
                                    >
                                      {sourceLabel.length > 12 ? sourceLabel.slice(0, 12) + "..." : sourceLabel}
                                    </Badge>
                                    {isAPIOrder && (
                                      <p className="text-xs text-muted-foreground">
                                        <span>API: {(order.api_user || "").slice(0, 16)}</span>
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{order.payment_method === "wallet" ? "Wallet" : "Paystack"}</Badge></TableCell>
                                <TableCell>
                                  {/* Payment status: for failed orders that have been refunded,
                                      show "paid" because the customer did pay — then show refund badge */}
                                  {order.status === "refunded" ? (
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="default" className="text-xs">paid</Badge>
                                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Refunded</Badge>
                                    </div>
                                  ) : (
                                    <Badge variant={order.status === "completed" || order.status === "paid" ? "default" : "secondary"}>{order.status}</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {/* Fulfillment status: for failed orders that have been refunded,
                                      show "completed" because delivery was attempted — then show refund badge */}
                                  {order.fulfillment_status === "refunded" ? (
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="default" className="text-xs">completed</Badge>
                                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Refunded</Badge>
                                    </div>
                                  ) : order.fulfillment_status === "delivered" ? (
                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Delivered</Badge>
                                  ) : (
                                    <Badge variant={order.fulfillment_status === "completed" ? "default" : order.fulfillment_status === "failed" ? "destructive" : "secondary"}>{order.fulfillment_status}</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const os = (order.order_status || "").toLowerCase().trim();
                                    const cls =
                                      os === "delivered" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                                      os === "pending"   ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                                      os === "processing"? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                                      os === "waiting"   ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                                      os === "refunded"  ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                                      os === "failed"    ? "bg-red-500/20 text-red-400 border-red-500/30" :
                                                           "bg-slate-500/20 text-slate-400 border-slate-500/30";
                                    const osLabel = os === "pending" ? "Waiting for Portal" : os === "processing" ? "Processing" : os === "waiting" ? "Waiting" : os === "delivered" ? "Delivered" : os === "failed" ? "Failed" : os === "refunded" ? "Refunded" : (os || "—");
                                    return <Badge className={cls}>{osLabel}</Badge>;
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {order.fulfillment_status !== "completed" && order.fulfillment_status !== "delivered" && (
                                      <Button variant="outline" size="sm" onClick={() => retryOrder(order.id)} disabled={retryingOrders.has(order.id)}>
                                        {retryingOrders.has(order.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" /> Retry</>}
                                      </Button>
                                    )}
                                    <Button 
                                      variant={order.fulfillment_status === "completed" || order.fulfillment_status === "delivered" ? "default" : "secondary"} 
                                      size="sm" 
                                      onClick={() => toggleOrderFulfillment(order.id, order.fulfillment_status)}
                                    >
                                      {order.fulfillment_status === "completed" || order.fulfillment_status === "delivered" ? "Unfulfill" : "Fulfill"}
                                    </Button>
                                    {(order.fulfillment_status === "refunded" || order.status === "refunded") && order.refunded_amount && (
                                      <Button 
                                        variant="destructive" 
                                        size="sm" 
                                        onClick={() => reverseRefund(order.id)}
                                        disabled={reversingRefundIds.has(order.id)}
                                      >
                                        {reversingRefundIds.has(order.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reverse"}
                                      </Button>
                                    )}
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
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex flex-col gap-1 flex-1 max-w-sm">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by store name..." 
                      value={agentSearchTerm}
                      onChange={(e) => {
                        setAgentSearchTerm(e.target.value);
                        if (e.target.value.length > 0) {
                          agentSearch.search(e.target.value);
                        }
                      }}
                      className="pl-10" 
                    />
                    {agentSearch.isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agentExactMatch}
                      onChange={(e) => setAgentExactMatch(e.target.checked)}
                      className="rounded border-border"
                    />
                    Exact match
                  </label>
                </div>
                
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
                // Show loading state if agents tab just opened
                if (activeTab === "agents" && !loadedTabs.has("agents")) {
                  return (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
                      ))}
                    </div>
                  );
                }
                
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
                              <p className="text-xs text-muted-foreground">Wallet: <span className="font-bold text-green-400">GHC {Number(agent.wallet_balance || 0).toFixed(2)}</span></p>
                              <p className="text-xs text-muted-foreground">Subagent Profit: <span className="font-bold text-purple-400">GHC {Number(agent.subagent_commission_balance || 0).toFixed(2)}</span></p>
                              {agent.approved && <a href={DOMAINS.getAgentStoreUrl(agent.store_name)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1"><Eye className="h-3 w-3" /> View Store</a>}
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
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex flex-col gap-1 flex-1 max-w-sm">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by store name..." 
                      className="pl-10" 
                      value={subagentSearchTerm}
                      onChange={(e) => {
                        setSubagentSearchTerm(e.target.value);
                        if (e.target.value.length > 0) {
                          subagentSearch.search(e.target.value);
                        }
                      }}
                    />
                    {subagentSearch.isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={subagentExactMatch}
                      onChange={(e) => setSubagentExactMatch(e.target.checked)}
                      className="rounded border-border"
                    />
                    Exact match
                  </label>
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
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 text-xs md:text-sm">
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
                                <p className="text-muted-foreground text-xs">MoMo Name</p>
                                <p className="font-semibold text-foreground truncate">{subagent.momo_name}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">MoMo Number</p>
                                <p className="font-semibold text-foreground">{subagent.momo_number || 'N/A'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">MoMo Network</p>
                                <p className="font-semibold text-foreground">{subagent.momo_network || 'N/A'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Wallet Balance</p>
                                <p className="font-bold text-yellow-400">GHC {Number(subagent.wallet_balance || 0).toFixed(2)}</p>
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
                                // Pass store ID so we can query directly
                                const tokenData = JSON.stringify({ 
                                  storeId: subagent.id,
                                  storeName: subagent.store_name,
                                  userId: subagent.user_id,
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

          {/* SUB-SUBAGENTS TAB */}
          {canSee("sub_subagents") && (
            <TabsContent value="sub_subagents" className="space-y-4">
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex flex-col gap-1 flex-1 max-w-sm">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by store name..." 
                      className="pl-10" 
                      value={subSubagentSearchTerm}
                      onChange={(e) => setSubSubagentSearchTerm(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={subSubagentExactMatch}
                      onChange={(e) => setSubSubagentExactMatch(e.target.checked)}
                      className="rounded border-border"
                    />
                    Exact match
                  </label>
                </div>
              </div>
              
              {filteredSubSubagents.length === 0 ? (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="py-8 space-y-3 text-center">
                    <p className="text-muted-foreground font-semibold">No sub-subagents found.</p>
                    <p className="text-xs text-muted-foreground">Check the Subagents tab to manage sub-subagents.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Total Sub-Subagents: {filteredSubSubagents.length}
                  </p>
                  {filteredSubSubagents.map((subSubagent) => (
                    <Card key={subSubagent.id} className="border-border bg-card/50">
                      <CardContent className="p-3 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
                          <div className="flex-1 space-y-2 md:space-y-3 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-bold text-base md:text-lg text-foreground truncate">{subSubagent.store_name}</h3>
                              <Badge variant={subSubagent.approved ? "default" : "secondary"}>
                                {subSubagent.approved ? "Active" : "Pending"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 text-xs md:text-sm">
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Parent Subagent</p>
                                <p className="font-semibold text-foreground truncate">{subSubagent.subagent_stores?.store_name || 'N/A'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Top Reference</p>
                                <p className="font-mono text-cyan-400">{subSubagent.top_reference}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">WhatsApp</p>
                                <p className="font-semibold text-foreground">{subSubagent.whatsapp_number}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Support</p>
                                <p className="font-semibold text-foreground">{subSubagent.support_number}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">MoMo Name</p>
                                <p className="font-semibold text-foreground truncate">{subSubagent.momo_name}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Wallet Balance</p>
                                <p className="font-bold text-yellow-400">GHC {Number(subSubagent.wallet_balance || 0).toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`https://${DOMAINS.SUBAGENT_STORE}/${subSubagent.subagent_stores?.store_name}/store/${subSubagent.store_name}`, "_blank")}
                              className="text-xs"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Store
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const tokenData = JSON.stringify({ 
                                  storeId: subSubagent.id,
                                  storeName: subSubagent.store_name,
                                  userId: subSubagent.user_id,
                                  isSubSubagent: true,
                                  timestamp: Date.now() 
                                });
                                const token = btoa(encodeURIComponent(tokenData));
                                window.location.href = `https://${DOMAINS.SUBAGENT_STORE}/sub-subagent-dashboard?admin_token=${token}`;
                              }}
                              className="text-xs bg-blue-600/20 text-blue-400 border-blue-600/30 hover:bg-blue-600/30"
                            >
                              <LogIn className="h-3 w-3 mr-1" />
                              Dashboard
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
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
                        <div><p className="text-muted-foreground">Balance</p><p className="font-bold text-green-400">GHC {Number(topupAgent.wallet_balance || 0).toFixed(2)}</p></div>
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1"><Label>Amount to Credit (GHC)</Label><Input type="number" step="0.01" placeholder="e.g. 50.00" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} /></div>
                        <Button variant="hero" onClick={creditWallet} disabled={topupLoading}>{topupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wallet className="h-4 w-4 mr-1" />} Credit</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              {/* API User Wallet Top-up */}
              <Card className="border-border">
                <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Credit API User Wallet</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Enter API user top-up reference (e.g. 1576 or 4277us)"
                        value={apiTopupSearch}
                        onChange={(e) => setApiTopupSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && searchApiTopupRef()}
                        className="pl-10"
                      />
                    </div>
                    <Button variant="hero" onClick={searchApiTopupRef}><Search className="h-4 w-4 mr-1" /> Search</Button>
                  </div>
                  {apiTopupUser && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        <div><p className="text-muted-foreground">Name / Store</p><p className="font-bold text-foreground">{apiTopupUser.store_name || apiTopupUser.user_email || apiTopupUser.email || "—"}</p></div>
                        <div><p className="text-muted-foreground">Top-up Reference</p><p className="font-bold text-primary">{apiTopupUser.topup_reference}</p></div>
                        <div><p className="text-muted-foreground">Current Balance</p><p className="font-bold text-green-400">GHC {Number(apiTopupUser.wallet || 0).toFixed(2)}</p></div>
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label>Amount to Credit (GHC)</Label>
                          <Input type="number" step="0.01" min="0.01" placeholder="e.g. 50.00" value={apiTopupAmount} onChange={(e) => setApiTopupAmount(e.target.value)} />
                        </div>
                        <Button variant="hero" onClick={creditApiWallet} disabled={apiTopupLoading}>
                          {apiTopupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wallet className="h-4 w-4 mr-1" />} Credit
                        </Button>
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
                    <Input 
                      placeholder="Search by store name or ref..." 
                      value={topupSearchTerm} 
                      onChange={(e) => {
                        setTopupSearchTerm(e.target.value);
                      }} 
                      className="pl-10" 
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Use server-side filtered results (from searchTopupsByStoreOrReference)
                    const displayTopups = topupSearchTerm.length > 0 
                      ? filteredTopupHistory 
                      : topupHistory;
                    
                    const paginated = displayTopups.slice((topupPage - 1) * PAGE_SIZE, topupPage * PAGE_SIZE);
                    const totalPages = Math.ceil(displayTopups.length / PAGE_SIZE);
                    
                    return displayTopups.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">{topupSearchTerm ? "No top-ups found matching your search." : "No top-ups found."}</p>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-4">
                          Showing {displayTopups.length > 0 ? (topupPage - 1) * PAGE_SIZE + 1 : 0} - {Math.min(topupPage * PAGE_SIZE, displayTopups.length)} of {displayTopups.length} top-ups
                          {topupSearching && " (searching...)"}
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
                                <TableCell>GHC {Number(t.amount || 0).toFixed(2)}</TableCell>
                                <TableCell>GHC {(t.agent_stores?.wallet_balance ? Number(t.agent_stores.wallet_balance || 0).toFixed(2) : "—")}</TableCell>
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
                        <TableHeader><TableRow><TableHead>Date & Time</TableHead><TableHead>Agent/Subagent</TableHead><TableHead>Type</TableHead><TableHead>Source</TableHead><TableHead>Amount</TableHead><TableHead>Before</TableHead><TableHead>After</TableHead><TableHead>MoMo Name</TableHead><TableHead>MoMo Number</TableHead><TableHead>Network</TableHead><TableHead>Transfer Code</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {paginated.length === 0 ? <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">No withdrawals match your search.</TableCell></TableRow> :
                            paginated.map((w) => {
                              const isSubsubagentWithdrawal = !!w.sub_subagent_store_id;
                              const isSubagentWithdrawal = !!w.subagent_store_id && !isSubsubagentWithdrawal;
                              const isSubagentProfit = w.withdrawal_source === "subagent_commission";
                              
                              // Get store data from nested objects - handle all three types.
                              // Prefer request_type from the payout_requests row; fall back to
                              // inferring from store ID presence when request_type is absent.
                              const rawRequestType = ((w as any).request_type || "").toLowerCase();
                              let store, typeLabel;
                              if (rawRequestType === "sub_subagent" || rawRequestType === "sub-subagent" || isSubsubagentWithdrawal) {
                                store = w.subagent_store;
                                typeLabel = "Sub-Subagent";
                              } else if (rawRequestType === "subagent" || isSubagentWithdrawal) {
                                store = w.subagent_store;
                                typeLabel = "Subagent";
                              } else {
                                store = w.agent_store;
                                typeLabel = rawRequestType === "agent" ? "Agent" : (w.agent_store?.store_name ? "Agent" : "—");
                              }
                              
                              const storeName = store?.store_name || "—";
                              const momoName = store?.momo_name || "—";
                              const momoNumber = store?.momo_number || "—";
                              const momoNetwork = store?.momo_network || "—";
                              
                              // Get wallet balance based on withdrawal type
                              let walletBalance = 0;
                              if (isSubagentWithdrawal) {
                                walletBalance = store?.wallet_balance || 0;
                              } else {
                                walletBalance = isSubagentProfit ? (store?.subagent_commission_balance || 0) : (store?.wallet_balance || 0);
                              }
                              
                              return (
                                <TableRow key={w.id}>
                                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</TableCell>
                                  <TableCell className="font-medium">{storeName}</TableCell>
                                  <TableCell>
                                    <Badge className={
                                      isSubsubagentWithdrawal 
                                        ? "bg-purple-600/20 text-purple-400 border-purple-600/30"
                                        : isSubagentWithdrawal 
                                        ? "bg-orange-600/20 text-orange-400 border-orange-600/30" 
                                        : "bg-cyan-600/20 text-cyan-400 border-cyan-600/30"
                                    }>
                                      {typeLabel}
                                    </Badge>
                                  </TableCell>
                                  <TableCell><Badge className={isSubagentProfit ? "bg-purple-600/20 text-purple-400 border-purple-600/30" : "bg-blue-600/20 text-blue-400 border-blue-600/30"}>{isSubagentProfit ? "Subagent Profit" : "Wallet"}</Badge></TableCell>
                                  <TableCell className="font-display font-bold text-primary">GHC {Number(w.amount || 0).toFixed(2)}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{(w as any).source_balance_before != null ? `GHC ${Number((w as any).source_balance_before).toFixed(2)}` : "—"}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{(w as any).source_balance_after != null ? `GHC ${Number((w as any).source_balance_after).toFixed(2)}` : "—"}</TableCell>
                                  <TableCell>{momoName || "—"}</TableCell>
                                  <TableCell className="font-mono">{momoNumber || "—"}</TableCell>
                                  <TableCell className="uppercase text-sm">{momoNetwork || "—"}</TableCell>
                                  <TableCell className="font-mono text-xs">{(w as any).transfer_code || (w as any).paystack_reference || "—"}</TableCell>
                                  <TableCell>
                                    <div className="space-y-0.5">
                                      <Badge className={w.status === "success" || w.status === "completed" ? "bg-green-600/20 text-green-400 border-green-600/30" : w.status === "failed" ? "bg-red-600/20 text-red-400 border-red-600/30" : "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"}>{w.status}</Badge>
                                      {(w as any).failure_reason && <p className="text-xs text-destructive max-w-[140px] truncate" title={(w as any).failure_reason}>{(w as any).failure_reason}</p>}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1 flex-wrap">
                                      {w.status === "pending" && (
                                        <Button variant="hero" size="sm" onClick={() => processWithdrawal(w.id, w.agent_store_id, Number(w.amount), w.withdrawal_source, w.subagent_store_id, w.sub_subagent_store_id)} disabled={processingWithdrawals.has(w.id)}>
                                          {processingWithdrawals.has(w.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Confirm Sent</>}
                                        </Button>
                                      )}
                                      {/* Login as the withdrawing store owner */}
                                      {(() => {
                                        const loginUserId = isSubsubagentWithdrawal
                                          ? w.subagent_store?.user_id
                                          : isSubagentWithdrawal
                                          ? w.subagent_store?.user_id
                                          : w.agent_store?.user_id;
                                        const loginRole = isSubsubagentWithdrawal ? "sub_subagent" : isSubagentWithdrawal ? "subagent" : "agent";
                                        const loginLabel = isSubsubagentWithdrawal ? "Sub-Subagent" : isSubagentWithdrawal ? "Subagent" : "Agent";
                                        if (!loginUserId) return null;
                                        return (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              if (loginRole === "agent") {
                                                localStorage.setItem("admin_impersonate_agent", loginUserId);
                                                window.open("/agent-dashboard", "_blank");
                                              } else if (loginRole === "subagent") {
                                                localStorage.setItem("admin_impersonate_subagent", loginUserId);
                                                window.open("/subagent-dashboard", "_blank");
                                              } else {
                                                localStorage.setItem("admin_impersonate_sub_subagent", loginUserId);
                                                window.open("/sub-subagent-dashboard", "_blank");
                                              }
                                            }}
                                          >
                                            <LogIn className="h-4 w-4 mr-1" /> Login as {loginLabel}
                                          </Button>
                                        );
                                      })()}
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
            <TabsContent value="users" className="space-y-6">
              {/* Users List Section */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Users Directory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                                    <div className="flex gap-2 flex-wrap">
                                      <Button variant="outline" size="sm" onClick={async () => {
                                        try {
                                          // Check if already a sub_admin
                                          const { data: existing } = await supabase.from("user_roles").select("id").eq("user_id", u.id).eq("role", "sub_admin").maybeSingle();
                                          if (existing) {
                                            // Remove sub_admin role
                                            await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "sub_admin");
                                            toast({ title: "Sub-Admin role removed", description: `${u.full_name || u.id} is no longer a sub-admin.` });
                                          } else {
                                            await supabase.from("user_roles").insert({ user_id: u.id, role: "sub_admin" });
                                            toast({ title: "Sub-Admin role granted", description: `${u.full_name || u.id} can now access /sub-admin.` });
                                          }
                                          // Reload users list
                                          const refreshed = await fetchRecords("profiles", "id, full_name, phone, created_at", { column: "created_at", ascending: false }, 10000);
                                          setUsers(refreshed ?? []);
                                        } catch (e: any) {
                                          toast({ title: "Error", description: e.message, variant: "destructive" });
                                        }
                                      }} className="border-primary/40 text-primary hover:bg-primary/10">
                                        <Shield className="h-4 w-4 mr-1" />
                                        {u.role === "sub_admin" ? "Remove Sub-Admin" : "Make Sub-Admin"}
                                      </Button>
                                    </div>
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
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* CUSTOMERS TAB */}
          {canSee("customers") && (
            <TabsContent value="customers" className="space-y-4">
              <div className="flex gap-3 flex-wrap items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, email, phone, or top-up ref..."
                    className="pl-10"
                    value={customerSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomerSearchTerm(value);
                      fetchCustomers(value, customerExactMatch);
                    }}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={customerExactMatch}
                    onChange={(e) => {
                      setCustomerExactMatch(e.target.checked);
                      fetchCustomers(customerSearchTerm, e.target.checked);
                    }}
                    className="rounded border-border"
                  />
                  Exact match
                </label>
              </div>
              
              {customers.length === 0 ? (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="py-8 space-y-3">
                    <p className="text-center text-muted-foreground font-semibold">No customers found.</p>
                    <p className="text-center text-xs text-muted-foreground">To set up customers:</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Run the CREATE_CUSTOMERS_TABLE.sql in your Supabase SQL editor</li>
                      <li>Customers will appear here after they register and make purchases</li>
                    </ol>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Total Customers: {customers.length}
                  </p>
                  {customers
                    .filter(c => 
              !customerSearchTerm ||
              `${c.first_name} ${c.last_name}`.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
              c.email?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
              c.topup_reference?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
              c.phone_number?.includes(customerSearchTerm)
                    )
                    .map((customer) => (
                    <Card key={customer.id} className="border-border bg-card/50">
                      <CardContent className="p-3 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
                          <div className="flex-1 space-y-2 md:space-y-3 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-bold text-base md:text-lg text-foreground truncate">{customer.first_name || 'Customer'} {customer.last_name || ''}</h3>
                              <Badge variant={customer.status === 'active' ? 'default' : customer.status === 'inactive' ? 'secondary' : 'destructive'}>
                                {customer.status || 'active'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 text-xs md:text-sm">
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Email</p>
                                <p className="font-semibold text-foreground truncate">{customer.email || '—'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Phone</p>
                                <p className="font-semibold text-foreground">{customer.phone_number || '—'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Top-up Ref</p>
                                <p className="font-mono text-cyan-400 font-bold">{customer.topup_reference || '—'}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Total Orders</p>
                                <p className="font-semibold text-foreground">{customer.total_orders || 0}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Total Spent</p>
                                <p className="font-bold text-green-400">GHC {Number(customer.total_purchases || 0).toFixed(2)}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Member Since</p>
                                <p className="font-semibold text-foreground">{new Date(customer.customer_since).toLocaleDateString()}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground text-xs">Last Purchase</p>
                                <p className="font-semibold text-foreground">{customer.last_purchase_date ? new Date(customer.last_purchase_date).toLocaleDateString() : '�����'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                localStorage.setItem("admin_impersonate_customer", customer.user_id || customer.id);
                                localStorage.setItem("admin_impersonate_customer_name", `${customer.first_name} ${customer.last_name}`);
                                window.location.href = "/user-dashboard";
                              }}
                            >
                              <LogIn className="h-3 w-3 mr-1" />
                              Login As
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => toast({ title: "Customer", description: `Viewing ${customer.first_name} ${customer.last_name}'s profile` })}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Profile
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
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

            {canSee("complaints") && (
              <TabsContent value="complaints" className="space-y-6">
                <ComplaintsManager />
              </TabsContent>
            )}

            {canSee("afa") && (
              <TabsContent value="afa" className="space-y-6">
                <AdminAFAManager />
              </TabsContent>
            )}

            {canSee("afa_bundles") && (
              <TabsContent value="afa_bundles" className="space-y-6">
                <AdminAFABundleManager />
                <AdminAFABundleRegistrations />
              </TabsContent>
            )}

            {canSee("afa_youtube") && (
              <TabsContent value="afa_youtube" className="space-y-6">
                <AdminYouTubeUrlManager />
              </TabsContent>
            )}

            {canSee("push") && (
              <TabsContent value="push" className="space-y-6">
                <PushNotificationManager />
              </TabsContent>
            )}

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
                          <Label>Fee Amount (GHC)</Label>
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
                      <p className="text-xs text-muted-foreground">Current fee: GHC{Number(agentRegistrationFee || 0).toFixed(2)}</p>
                    </div>

                    {/* AFA Registration Fee section removed - moved to dedicated AFA tab */}

                    {/* Announcement Video */}
                    <Card className="border-border">
                      <CardHeader>
                        <CardTitle className="font-display text-lg">Announcement Video (User Dashboard)</CardTitle>
                        <p className="text-sm text-muted-foreground">Paste a YouTube link and title. It appears as a small collapsible dropdown at the top of the Overview section in the User Dashboard.</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <AnnouncementManager />
                      </CardContent>
                    </Card>

                    {/* Support Chat Toggle */}
                    <Card className="border-border">
                      <CardHeader>
                        <CardTitle className="font-display text-lg flex items-center gap-2">
                          <MessageCircle className="h-5 w-5 text-cyan-500" /> Support Chat
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between border p-4 rounded-lg bg-cyan-900/10 border-cyan-500/30">
                          <div className="space-y-0.5">
                            <Label className="text-base font-semibold">Enable Support ChatBot</Label>
                            <p className="text-sm text-muted-foreground">
                              {chatbotEnabled
                                ? "Chat is live — visitors can open the support chat on all pages."
                                : "Chat is off — visitors see \"We are currently unavailable, come back later\"."}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {savingChatbot && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            <Switch
                              checked={chatbotEnabled}
                              onCheckedChange={(checked) => saveChatbotSetting(checked)}
                              disabled={savingChatbot}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          The toggle saves instantly. When disabled, the chat icon is still visible but opens an offline message.
                        </p>
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
                  </CardContent>
              </Card>

              {/* Special MTN Mashup Pricing */}
              <Card className="border-amber-500/30 bg-amber-50/5">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <span className="text-xl">⚡</span> Special MTN Mashup Pricing
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Manage pricing and enable/disable for the 4 Special MTN Mashup tiers</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tier 1 */}
                    <div className="border p-4 rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-amber-600">Tier 1: 125 mins + 0.36GB</div>
                        <Switch 
                          checked={specialMTNEnabled.tier1}
                          onCheckedChange={(checked) => setSpecialMTNEnabled({...specialMTNEnabled, tier1: checked})}
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">User Price (GHC)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={specialMTNPricing.tier1_user_price}
                            onChange={(e) => setSpecialMTNPricing({...specialMTNPricing, tier1_user_price: e.target.value})}
                            disabled={!specialMTNEnabled.tier1}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Agent Base Price (GHC)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={specialMTNPricing.tier1_agent_price}
                            onChange={(e) => setSpecialMTNPricing({...specialMTNPricing, tier1_agent_price: e.target.value})}
                            disabled={!specialMTNEnabled.tier1}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 2 */}
                    <div className="border p-4 rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-amber-600">Tier 2: 360 mins + 0.87GB</div>
                        <Switch 
                          checked={specialMTNEnabled.tier2}
                          onCheckedChange={(checked) => setSpecialMTNEnabled({...specialMTNEnabled, tier2: checked})}
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">User Price (GHC)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={specialMTNPricing.tier2_user_price}
                            onChange={(e) => setSpecialMTNPricing({...specialMTNPricing, tier2_user_price: e.target.value})}
                            disabled={!specialMTNEnabled.tier2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Agent Base Price (GHC)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={specialMTNPricing.tier2_agent_price}
                            onChange={(e) => setSpecialMTNPricing({...specialMTNPricing, tier2_agent_price: e.target.value})}
                            disabled={!specialMTNEnabled.tier2}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 3 */}
                    <div className="border p-4 rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-amber-600">Tier 3: 700 mins + 1.6GB</div>
                        <Switch 
                          checked={specialMTNEnabled.tier3}
                          onCheckedChange={(checked) => setSpecialMTNEnabled({...specialMTNEnabled, tier3: checked})}
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">User Price (GHC)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={specialMTNPricing.tier3_user_price}
                            onChange={(e) => setSpecialMTNPricing({...specialMTNPricing, tier3_user_price: e.target.value})}
                            disabled={!specialMTNEnabled.tier3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Agent Base Price (GHC)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={specialMTNPricing.tier3_agent_price}
                            onChange={(e) => setSpecialMTNPricing({...specialMTNPricing, tier3_agent_price: e.target.value})}
                            disabled={!specialMTNEnabled.tier3}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 4 */}
                    <div className="border p-4 rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-amber-600">Tier 4: 1000 mins + 2.6GB</div>
                        <Switch 
                          checked={specialMTNEnabled.tier4}
                          onCheckedChange={(checked) => setSpecialMTNEnabled({...specialMTNEnabled, tier4: checked})}
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">User Price (GHC)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={specialMTNPricing.tier4_user_price}
                            onChange={(e) => setSpecialMTNPricing({...specialMTNPricing, tier4_user_price: e.target.value})}
                            disabled={!specialMTNEnabled.tier4}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Agent Base Price (GHC)</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            value={specialMTNPricing.tier4_agent_price}
                            onChange={(e) => setSpecialMTNPricing({...specialMTNPricing, tier4_agent_price: e.target.value})}
                            disabled={!specialMTNEnabled.tier4}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveSpecialMTNPricing} disabled={savingSpecialMTN} className="flex-1 bg-amber-600 hover:bg-amber-700">
                      {savingSpecialMTN ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Special MTN Pricing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            )}

            {/* API Pricing Tab */}
            <TabsContent value="api_pricing" className="space-y-6">
              <APIPricingTab supabase={supabase} packages={packages} />
            </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs (unchanged) */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader><DialogTitle className="font-display">Add New Package</DialogTitle><DialogDescription>Create a new data package.</DialogDescription></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Network</Label><Select value={newPkg.network} onValueChange={(v) => setNewPkg((p) => ({ ...p, network: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mtn">MTN</SelectItem><SelectItem value="mtn_express">MTN Express</SelectItem><SelectItem value="airteltigo">AirtelTigo</SelectItem><SelectItem value="telecel">Telecel</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Size (GB)</Label><Input type="number" placeholder="e.g. 5" value={newPkg.size_gb} onChange={(e) => setNewPkg((p) => ({ ...p, size_gb: e.target.value }))} /></div>
            <div className="space-y-2"><Label>User Price (GHC)</Label><Input type="number" step="0.01" placeholder="e.g. 15.00" value={newPkg.price} onChange={(e) => setNewPkg((p) => ({ ...p, price: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Agent Price (GHC)</Label><Input type="number" step="0.01" placeholder="e.g. 12.00" value={newPkg.agent_price} onChange={(e) => setNewPkg((p) => ({ ...p, agent_price: e.target.value }))} /></div>
            <div className="space-y-2"><Label>API Price (GHC)</Label><Input type="number" step="0.01" placeholder="e.g. 10.00" value={newPkg.api_price} onChange={(e) => setNewPkg((p) => ({ ...p, api_price: e.target.value }))} /></div>
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
                {[
                  { key: "mtn", label: "MTN" },
                  { key: "mtn_express", label: "MTN Express" },
                  { key: "airteltigo", label: "AirtelTigo" },
                  { key: "telecel", label: "Telecel" },
                ].map(({ key, label }) => (
                  <Button
                    key={key}
                    variant={agentPriceNetworkFilter === key ? "hero" : "outline"}
                    size="sm"
                    onClick={() => setAgentPriceNetworkFilter(key)}
                  >
                    {label}
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
                    <TableHead>Default Price (GHC)</TableHead>
                    <TableHead>Custom Price (GHC)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages
                    .filter(pkg => {
                      if (agentPriceNetworkFilter === "airteltigo") {
                        return (pkg.network === "airteltigo" || pkg.network === "atbigtime" || pkg.network === "atbigshare") && pkg.active;
                      }
                      return pkg.network === agentPriceNetworkFilter && pkg.active;
                    })
                    .map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-display font-bold">{pkg.size_gb_text || `${pkg.size_gb}GB`}</TableCell>
                        <TableCell className="text-muted-foreground">GHC {Number(pkg.agent_price || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={`Default: ${Number(pkg.agent_price || 0).toFixed(2)}`}
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
            {(["prices", "orders", "agents", "topup", "withdrawals", "users", "customers", "notifications", "spinwheel", "complaints"] as Section[]).map(section => (
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Order Source Details
            </DialogTitle>
            <DialogDescription>Information about where this order came from</DialogDescription>
          </DialogHeader>
          {sourceInfo && (
            <div className="space-y-3 py-2">
              <Badge variant="outline" className="text-xs">{sourceInfo.type}</Badge>

              {/* Main store / customer card */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                {sourceInfo.type === "Customer Account" ? (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Customer</p>
                    <p className="font-semibold text-foreground">{sourceInfo.storeName}</p>
                    {sourceInfo.topupReference && (
                      <p className="text-xs text-muted-foreground">Top-up Ref: <span className="font-mono text-foreground">{sourceInfo.topupReference}</span></p>
                    )}
                    {sourceInfo.contact && sourceInfo.contact !== "N/A" && (
                      <p className="text-sm text-muted-foreground">Phone: {sourceInfo.contact}</p>
                    )}
                    {sourceInfo.storeUrl && (
                      <Button variant="outline" size="sm" className="w-full text-xs mt-1" onClick={() => {
                        const url = sourceInfo!.storeUrl!;
                        if (url.startsWith("#impersonate:customer:")) {
                          const customerId = url.split(":")[2];
                          window.open(`/user-dashboard?impersonate=${customerId}`, "_blank");
                        } else {
                          window.open(url, "_blank");
                        }
                      }}>
                        Login to Customer Dashboard
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                      {sourceInfo.type === "Agent Store" ? "Agent" : sourceInfo.type === "Subagent Store" ? "Subagent" : sourceInfo.type === "Sub-Subagent Store" ? "Sub-Subagent" : "Store"}
                    </p>
                    <p className="font-semibold text-foreground">{sourceInfo.storeName}</p>
                    {sourceInfo.contact && sourceInfo.contact !== "N/A" && (
                      <a href={`tel:${sourceInfo.contact}`} className="text-sm text-primary hover:underline block">{sourceInfo.contact}</a>
                    )}
                    {sourceInfo.storeUrl && (
                      <Button variant="outline" size="sm" className="w-full text-xs mt-1" onClick={() => {
                        const url = sourceInfo!.storeUrl!;
                        if (url.startsWith("#impersonate:")) {
                          const parts = url.split(":");
                          const role = parts[1];
                          const userId = parts[2];
                          if (role === "agent") {
                            localStorage.setItem("admin_impersonate_agent", userId);
                            window.open("/agent", "_blank");
                          } else if (role === "subagent") {
                            localStorage.setItem("admin_impersonate_subagent", userId);
                            window.open("/subagent-dashboard", "_blank");
                          } else if (role === "sub_subagent") {
                            localStorage.setItem("admin_impersonate_sub_subagent", userId);
                            window.open("/sub-subagent-dashboard", "_blank");
                          }
                        } else {
                          window.open(url, "_blank");
                        }
                      }}>
                        Login to {sourceInfo.type === "Agent Store" ? "Agent" : sourceInfo.type === "Subagent Store" ? "Subagent" : "Sub-Subagent"} Dashboard
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Hierarchy for subagent / sub-subagent */}
              {(sourceInfo.parentSubagentName || sourceInfo.parentAgentName) && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Hierarchy</p>
                  {sourceInfo.parentSubagentName && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Under Subagent</p>
                        <p className="text-sm font-medium text-foreground">{sourceInfo.parentSubagentName}</p>
                      </div>
                      {sourceInfo.parentSubagentUrl && (
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                          const url = sourceInfo!.parentSubagentUrl!;
                          if (url.startsWith("#impersonate:subagent:")) {
                            localStorage.setItem("admin_impersonate_subagent", url.split(":")[2]);
                            window.open("/subagent-dashboard", "_blank");
                          } else { window.open(url, "_blank"); }
                        }}>
                          Login
                        </Button>
                      )}
                    </div>
                  )}
                  {sourceInfo.parentAgentName && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Under Agent</p>
                        <p className="text-sm font-medium text-foreground">{sourceInfo.parentAgentName}</p>
                      </div>
                      {sourceInfo.parentAgentUrl && (
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                          const url = sourceInfo!.parentAgentUrl!;
                          if (url.startsWith("#impersonate:agent:")) {
                            localStorage.setItem("admin_impersonate_agent", url.split(":")[2]);
                            window.open("/agent", "_blank");
                          } else { window.open(url, "_blank"); }
                        }}>
                          Login
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setSourceDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
