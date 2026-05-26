import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PaymentDialog from "@/components/PaymentDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import {
  Zap, Phone, Wifi, Clock, Search, Package,
  CheckCircle, XCircle, X, Loader2, Copy, Bell, Megaphone, Rocket,
  MessageCircle, Users, AlertTriangle, Check, Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReportComplaintDialog from "@/components/ReportComplaintDialog";
import ClaimFreeDataDialog from "@/components/ClaimFreeDataDialog";

interface SubagentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  whatsapp_group?: string | null;
  show_whatsapp_group_icon?: boolean;
  theme_config?: {
    primary: string;
    primary_foreground: string;
    background: string;
    card_background: string;
    gridColumns?: number;
  };
  agent_store_id: string;
  approved?: boolean;
}

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  status: string;
  fulfillment_status: string;
  created_at: string;
}

interface Notification {
  id: string;
  message: string;
  created_at: string;
}

const formatNetworkName = (network: string) => {
  if (network === "mtn") return "MTN";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "telecel") return "Telecel";
  return network;
};

// Sanitize store name for URL matching - removes apostrophes, periods, and spaces
const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()                           // Remove leading/trailing spaces
    .replace(/'/g, "")                // Remove apostrophes (store'name -> storename)
    .replace(/\./g, "")               // Remove periods (store.name -> storename)
    .replace(/\s+/g, "-")             // Replace spaces with hyphens
    .replace(/-+/g, "-")              // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, "");         // Remove leading/trailing hyphens

const getNetworkColor = (network: string) => {
  const colors: Record<string, string> = { mtn: "#fbbf24", airteltigo: "#3b82f6", telecel: "#ef4444" };
  return colors[network] || "#22c55e";
};

const formatDisplayPhone = (phone: string): string => {
  if (!phone) return phone;
  const cleaned = phone.trim();
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("233")) return "+" + cleaned;
  if (cleaned.startsWith("0")) return "+233" + cleaned.slice(1);
  return cleaned;
};

const getInternationalDigits = (phone: string): string => {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("233")) return cleaned;
  if (cleaned.startsWith("0")) return "233" + cleaned.slice(1);
  return cleaned;
};

const stripSpaces = (s: string) => s.replace(/\s+/g, "");

const defaultTheme = {
  primary: "#22c55e",
  primary_foreground: "#ffffff",
  background: "#09090b",
  card_background: "#18181b",
  gridColumns: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// ORDER TRACKING CARD (same as AgentStorefront)
// Delivery (step 4) only appears after 200 minutes.
// ─────────────────────────────────────────────────────────────────────────────
const SubagentOrderTrackingCard = ({
  order,
  store,
  onReportClick,
}: {
  order: Order;
  store: SubagentStore;
  onReportClick: (order: Order) => void;
}): JSX.Element => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [complaintStatus, setComplaintStatus] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch complaint status for this order
  useEffect(() => {
    const fetchComplaintStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("complaints")
          .select("status")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setComplaintStatus(data.status);
        }
      } catch (e) {
        // No complaint found, that's okay
      }
    };

    fetchComplaintStatus();
    const interval = setInterval(fetchComplaintStatus, 5000);
    return () => clearInterval(interval);
  }, [order.id]);

  const elapsedMs = currentTime.getTime() - new Date(order.created_at).getTime();
  const elapsedMinutes = elapsedMs / 60_000;

  // Step logic - Delivery (step 4) only after 200 minutes
  let currentStep = 1;
  let statusMessage = "";
  let extraNote: string | null = null;

  if (elapsedMinutes >= 200) {
    currentStep = 4;
    statusMessage = "Your data bundle has been delivered successfully.";
    if (order.network === "mtn")
      extraNote = "Please check your MTNUP2U and MTN messages for delivery confirmation.";
    else if (order.network === "airteltigo")
      extraNote = "Please check your AirtelTigo iShare and BigTime messages for delivery confirmation.";
    else if (order.network === "telecel")
      extraNote = "Please check your Telecel messages for delivery confirmation.";
    else extraNote = "Please check your messages for delivery confirmation.";
  } else if (elapsedMinutes >= 60) {
    currentStep = 3;
    if (order.network === "mtn")
      statusMessage = "Please be expecting your data any moment from now. Check your MTN and MTNUP2U messages for delivery confirmation.";
    else if (order.network === "airteltigo")
      statusMessage = "Please be expecting your data any moment from now. Check your AirtelTigo iShare or BigTime messages for delivery confirmation.";
    else if (order.network === "telecel")
      statusMessage = "Please be expecting your data any moment from now. Check your Telecel messages for delivery confirmation.";
    else
      statusMessage = "Please be expecting your data any moment from now. Check your messages for delivery confirmation.";
    extraNote = "The order has left our system and is now with the network you bought the data from. All delays from now are from them.";
  } else if (elapsedMinutes >= 15) {
    currentStep = 3;
    statusMessage = "Your order can be delivered any moment from now. You can ignore the progress steps. Please report only if data is not delivered while it shows 'Delivered'.";
  } else if (elapsedMinutes >= 12) {
    currentStep = 3;
    statusMessage = `Waiting for validation from ${order.network?.toUpperCase()}...`;
  } else if (elapsedMinutes >= 9) {
    currentStep = 2;
    statusMessage = `Order sent to ${order.network?.toUpperCase()} for validation`;
    extraNote = "Now waiting for validation from the network to deliver your data. All delay now is from the network you bought the data from.";
  } else {
    currentStep = 1;
    statusMessage = "Order being processed...";
  }

  const orderDate = new Date(order.created_at).toLocaleString();
  const contactMessage = `Order from ${orderDate}\nNetwork: ${order.network?.toUpperCase()}\nData: ${order.size_gb}GB\nAmount: GH₵ ${Number(order.amount).toFixed(2)}\nCustomer: ${order.customer_number}\n\nPlease help resolve this issue. Contact: ${store.support_number}`;

  const whatsappNumberDigits = getInternationalDigits(store.whatsapp_number);
  const whatsappMessage = encodeURIComponent(
    `Hello, I am reporting that my order shows as "Delivered" but I have not received the data.\n\nOrder Details:\n- Order Date: ${orderDate}\n- Network: ${order.network?.toUpperCase()}\n- Data: ${order.size_gb}GB\n- Amount: GH₵ ${Number(order.amount).toFixed(2)}\n- Customer Number: ${order.customer_number}\n- Order Status: ${order.status} / ${order.fulfillment_status}\n- Order ID: ${order.id}\n\nPlease investigate and assist. Thank you.`
  );
  const whatsappLink = `https://wa.me/${whatsappNumberDigits}?text=${whatsappMessage}`;

  // Support button: show after 132 min if still not delivered
  const showSupportButton = elapsedMinutes >= 132 && currentStep !== 4;
  // Report button: show once delivered, within a reasonable window
  const showReportButton = currentStep === 4 && elapsedMinutes >= 200 && elapsedMinutes < 3030;

  const stepLabels = ["Order Placed", "Sent to Network", "Network Validation", "Delivered"];
  const theme = store.theme_config || defaultTheme;
  const primaryColor = theme.primary || defaultTheme.primary;

  // Delivered state
  if (currentStep === 4) {
    return (
      <div className="space-y-4 mt-3 p-4 rounded-lg border border-border bg-background/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Delivery Status</span>
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            <CheckCircle className="h-3 w-3 mr-1" /> Delivered
          </Badge>
        </div>

        <div className="relative">
          <div className="flex items-center justify-between">
            {stepLabels.map((label, idx) => (
              <div key={idx} className="flex flex-col items-center flex-1">
                <div className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-xs text-center mt-1 text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <div className="absolute top-4 left-0 w-full h-0.5 bg-green-600/30 -z-10" />
        </div>

        <div className="p-3 rounded-lg bg-green-600/10 border border-green-600/30">
          <p className="text-sm text-foreground font-medium">{statusMessage}</p>
          {extraNote && (
            <p className="text-xs text-muted-foreground mt-2 border-t pt-2 border-green-600/20">
              {extraNote}
            </p>
          )}
        </div>

        {/* Report button - only if no complaint submitted yet */}
        {showReportButton && !complaintStatus && (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-yellow-600/50 text-yellow-600 hover:bg-yellow-600/10"
            onClick={() => onReportClick(order)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Only tap on this Report: If it Shows <br />Delivered but you have not received it
          </Button>
        )}

        {/* Show status message if complaint submitted */}
        {complaintStatus && complaintStatus !== "resolved" && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm font-medium text-yellow-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Report has been sent 
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Status: {complaintStatus === "in-progress" ? "In Progress" : "Pending"}. Your report is being worked on 
            </p>
          </div>
        )}

        {complaintStatus === "resolved" && (
          <div className="p-3 rounded-lg bg-green-600/10 border border-green-600/30">
            <p className="text-sm font-medium text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Your complaint has been resolved
            </p>
          </div>
        )}
      </div>
    );
  }

  // In-progress state
  return (
    <div className="space-y-4 mt-3 p-4 rounded-lg border border-border bg-background/50">
      <div className="relative">
        <div className="flex items-center justify-between">
          {stepLabels.map((label, idx) => {
            const n = idx + 1;
            let icon;
            if (n < currentStep) icon = <Check className="h-4 w-4 text-green-400" />;
            else if (n === currentStep)
              icon = <Loader2 className="h-4 w-4 animate-spin" style={{ color: primaryColor }} />;
            else icon = <Clock className="h-4 w-4 text-muted-foreground" />;
            return (
              <div key={n} className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${n < currentStep
                    ? "bg-green-600/20 text-green-400"
                    : n === currentStep
                      ? "border"
                      : "bg-muted text-muted-foreground"
                  }`}
                  style={n === currentStep ? { backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}50`, color: primaryColor } : {}}
                >
                  {icon}
                </div>
                <span
                  className={`text-xs text-center mt-1 ${n === currentStep ? "font-medium" : "text-muted-foreground"}`}
                  style={n === currentStep ? { color: primaryColor } : {}}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-10">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${((currentStep - 1) / 3) * 100}%`, backgroundColor: primaryColor }}
          />
        </div>
      </div>

      <div className="p-3 rounded-lg border" style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30` }}>
        <p className="text-sm text-foreground font-medium">{statusMessage}</p>
        {extraNote && (
          <p className="text-xs text-muted-foreground mt-2 border-t pt-2" style={{ borderColor: `${primaryColor}20` }}>
            {extraNote}
          </p>
        )}
        {currentStep === 1 && elapsedMinutes < 8 && (
          <p className="text-xs text-muted-foreground mt-1">
            Estimated time remaining: {Math.max(0, Math.ceil(8 - elapsedMinutes))} minute(s)
          </p>
        )}
      </div>

      {showSupportButton && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          asChild
        >
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 mr-2" />
            Contact Support ({store.support_number})
          </a>
        </Button>
      )}
    </div>
  );
};

export function SubagentStorefront() {
  const { storeName: urlStoreName } = useParams();
  const { toast } = useToast();

  const [store, setStore] = useState<SubagentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [subagentPrices, setSubagentPrices] = useState<Record<string, number>>({});
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paymentPkg, setPaymentPkg] = useState<DataPackage | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  
  // Order search
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Report complaint dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportOrder, setReportOrder] = useState<Order | null>(null);
  
  // Claim Free Data dialog
  const [claimFreeDataOpen, setClaimFreeDataOpen] = useState(false);

  // Theme
  const theme = store?.theme_config || defaultTheme;
  const primaryColor = theme.primary || defaultTheme.primary;
  const primaryForeground = theme.primary_foreground || defaultTheme.primary_foreground;
  const bgColor = theme.background || defaultTheme.background;
  const cardBg = theme.card_background || defaultTheme.card_background;
  const gridColumns = theme.gridColumns || 2;

  // Fetch store by name
  useEffect(() => {
    const fetchStore = async () => {
      if (!urlStoreName) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const normalized = urlStoreName.toLowerCase().trim();
      // Normalize for comparison - remove ALL special characters for matching
      const normalizedClean = normalized.replace(/[^a-z0-9]/g, "");

      const { data: stores, error } = await supabase
        .from("subagent_stores")
        .select("*");
      
      if (error) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      
      if (!stores || stores.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Find matching store - try multiple strategies with more robust matching
      let matched = stores.find((s: any) => s.store_name && slugify(s.store_name) === normalized);
      if (!matched) matched = stores.find((s: any) => s.store_name && s.store_name.toLowerCase().trim() === normalized);
      // Normalized clean comparison - removes ALL special characters
      if (!matched) matched = stores.find((s: any) => s.store_name && slugify(s.store_name).replace(/[^a-z0-9]/g, "") === normalizedClean);
      if (!matched) matched = stores.find((s: any) => s.store_name && s.store_name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedClean);
      // Also try matching by ID as fallback
      if (!matched) matched = stores.find((s: any) => s.id === urlStoreName);

      if (!matched) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      matched.theme_config = { ...defaultTheme, ...(matched.theme_config || {}) };
      // Don't override show_whatsapp_group_icon - use database value directly
      setStore(matched);

      // Fetch packages and prices
      // Priority: 1. Subagent's own sell_price, 2. Agent's sell_price, 3. Admin's base prices
      const [pkgRes, subagentOwnPriceRes, agentSellPriceRes] = await Promise.all([
        supabase.from("data_packages").select("id, network, size_gb, price").eq("active", true).order("size_gb"),
        supabase.from("subagent_package_prices").select("package_id, sell_price").eq("subagent_store_id", matched.id),
        supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", matched.agent_store_id),
      ]);

      setPackages(pkgRes.data || []);

      // Build price map with fallback: subagent's own prices -> agent's sell prices -> admin's base
      const priceMap: Record<string, number> = {};
      // First set admin base prices
      (pkgRes.data || []).forEach((p: any) => { priceMap[p.id] = p.price; });
      // Then override with agent's sell prices if set
      (agentSellPriceRes.data || []).forEach((p: any) => { 
        if (p.sell_price != null) priceMap[p.package_id] = Number(p.sell_price); 
      });
      // Finally override with subagent's own prices if set
      (subagentOwnPriceRes.data || []).forEach((p: any) => { 
        if (p.sell_price != null) priceMap[p.package_id] = Number(p.sell_price); 
      });
      
      setSubagentPrices(priceMap);
      
      setLoading(false);
    };

    fetchStore();
  }, [urlStoreName]);

  // Real-time store settings updates (theme, prices, etc.)
  useEffect(() => {
    if (!store?.id) return;
    
    const storeChannel = supabase
      .channel(`subagent-store-settings-${store.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "subagent_stores", filter: `id=eq.${store.id}` },
        (payload) => {
          const newData = payload.new as any;
          setStore(prev => prev ? { 
            ...prev, 
            ...newData,
            theme_config: { ...prev.theme_config, ...(newData.theme_config || {}) }
          } : prev);
        }
      )
      .subscribe();
    
    const priceChannel = supabase
      .channel(`subagent-prices-${store.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subagent_package_prices", filter: `subagent_store_id=eq.${store.id}` },
        async () => {
          const { data } = await supabase
            .from("subagent_package_prices")
            .select("package_id, sell_price")
            .eq("subagent_store_id", store.id);
          if (data) {
            const priceMap: Record<string, number> = {};
            data.forEach((p: any) => { priceMap[p.package_id] = p.sell_price; });
            setSubagentPrices(priceMap);
          }
        }
      )
      .subscribe();
    
    return () => { 
      supabase.removeChannel(storeChannel);
      supabase.removeChannel(priceChannel);
    };
  }, [store?.id]);

  // Notifications
  const fetchNotifications = useCallback(async () => {
    if (!store?.id) return;
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("subagent_notifications")
      .select("id, message, created_at")
      .eq("subagent_store_id", store.id)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false }) as any;
    
    if (data) {
      setNotifications(data);
      const undismissed = data.filter((n: any) => !dismissedIds.includes(n.id));
      if (undismissed.length > 0 && !modalOpen) setModalOpen(true);
    }
  }, [store?.id, dismissedIds, modalOpen]);

  useEffect(() => {
    if (store?.id) {
      fetchNotifications();
      const saved = localStorage.getItem(`dismissed_subagent_notifications_${store.id}`);
      if (saved) setDismissedIds(JSON.parse(saved));
    }
  }, [store?.id, fetchNotifications]);

  const dismissNotification = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem(`dismissed_subagent_notifications_${store?.id}`, JSON.stringify(next));
    if (notifications.filter((n) => !next.includes(n.id)).length === 0) setModalOpen(false);
  };

  const closeAllNotifications = () => {
    const allIds = notifications.map((n) => n.id);
    const next = [...dismissedIds, ...allIds];
    setDismissedIds(next);
    localStorage.setItem(`dismissed_subagent_notifications_${store?.id}`, JSON.stringify(next));
    setModalOpen(false);
  };

  const undismissedNotifications = notifications.filter((n) => !dismissedIds.includes(n.id));

  // Order search - searches both subagent orders and parent agent orders
  const searchOrders = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchPerformed(true);

    const raw = searchQuery.trim();
    const noSpaces = stripSpaces(raw);
    
    let allOrders: Order[] = [];

    // Search subagent orders first
    let subagentQuery = supabase
      .from("orders")
      .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, created_at")
      .eq("subagent_store_id", store?.id);

    if (noSpaces.length === 36 && raw.includes("-")) {
      subagentQuery = subagentQuery.eq("id", raw);
    } else {
      subagentQuery = subagentQuery.ilike("customer_number", `%${noSpaces}%`);
    }

    const { data: subagentData, error: subagentError } = await subagentQuery.order("created_at", { ascending: false });
    if (!subagentError && subagentData) {
      allOrders = [...(subagentData as Order[])];
    }
    
    // Also search parent agent's orders
    if (store?.agent_store_id) {
      let agentQuery = supabase
        .from("orders")
        .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, created_at")
        .eq("agent_store_id", store.agent_store_id)
        .is("subagent_store_id", null); // Only direct agent orders

      if (noSpaces.length === 36 && raw.includes("-")) {
        agentQuery = agentQuery.eq("id", raw);
      } else {
        agentQuery = agentQuery.ilike("customer_number", `%${noSpaces}%`);
      }

      const { data: agentData, error: agentError } = await agentQuery.order("created_at", { ascending: false });
      if (!agentError && agentData) {
        allOrders = [...allOrders, ...(agentData as Order[])];
      }
    }
    
    // Sort all orders by date descending
    allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    setOrders(allOrders);
    setSearching(false);
  }, [searchQuery, store?.id, store?.agent_store_id]);

  const clearSearch = () => {
    setSearchQuery("");
    setOrders([]);
    setSearchPerformed(false);
  };

  // Helpers
  const filteredPackages = packages.filter((p) => p.network === networkFilter);
  const getPrice = (pkg: DataPackage) => subagentPrices[pkg.id] ?? pkg.price;
  const selectedPaymentPrice = paymentPkg ? getPrice(paymentPkg) : 0;

  const displayWhatsApp = store ? formatDisplayPhone(store.whatsapp_number || "") : "";
  const whatsappLink = store ? `https://wa.me/${getInternationalDigits(store.whatsapp_number || "")}` : "#";
  const groupLink = store?.show_whatsapp_group_icon && store?.whatsapp_group ? store.whatsapp_group : null;

  const getStatusIcon = (status: string) => {
    if (status === "completed" || status === "paid") return <CheckCircle className="h-4 w-4 text-green-400" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-yellow-400" />;
    return <XCircle className="h-4 w-4 text-red-400" />;
  };

  const getStatusText = (status: string) => {
    if (status === "completed" || status === "paid") return "Payment Completed";
    if (status === "pending") return "Pending";
    return status;
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bgColor }}>
        <Zap className="h-10 w-10 animate-pulse" style={{ color: primaryColor }} />
      </div>
    );
  }

  // Not found
  if (notFound || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bgColor }}>
        <div className="text-center text-white">
          <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
          <p className="text-gray-400 mb-4">The store you are looking for does not exist.</p>
          <Button onClick={() => window.location.href = "https://agentsstore.shop"} style={{ background: primaryColor, color: primaryForeground }}>
            Go to AgentsStore
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: bgColor, color: "#fff" }}>
      {/* Notification Modal */}
      {modalOpen && undismissedNotifications.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border p-6 space-y-4" style={{ background: cardBg }}>
            <button onClick={closeAllNotifications} className="absolute top-3 right-3 text-muted-foreground hover:text-white"><X className="h-5 w-5" /></button>
            <div className="flex items-center gap-2 text-lg font-bold" style={{ color: primaryColor }}>
              <Megaphone className="h-5 w-5" /> Announcements
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {undismissedNotifications.map((n) => (
                <div key={n.id} className="relative rounded-lg p-3 text-sm" style={{ background: `${primaryColor}15`, borderLeft: `3px solid ${primaryColor}` }}>
                  <button onClick={() => dismissNotification(n.id)} className="absolute top-2 right-2 text-muted-foreground hover:text-white"><X className="h-4 w-4" /></button>
                  <p className="pr-6 text-gray-200 whitespace-pre-wrap">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <Button className="w-full" style={{ background: primaryColor, color: primaryForeground }} onClick={closeAllNotifications}>Dismiss All</Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-md" style={{ background: `${cardBg}ee` }}>
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-3 px-4 py-3">
          <h1 className="font-display text-xl font-bold truncate" style={{ color: primaryColor }}>{store.store_name}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {undismissedNotifications.length > 0 && (
              <Button variant="ghost" size="icon" className="relative" onClick={() => setModalOpen(true)}>
                <Bell className="h-5 w-5" style={{ color: primaryColor }} />
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: primaryColor, color: primaryForeground }}>{undismissedNotifications.length}</span>
              </Button>
            )}
            {groupLink && (
              <Button variant="ghost" size="icon" asChild>
                <a href={groupLink} target="_blank" rel="noopener noreferrer"><Users className="h-5 w-5" style={{ color: primaryColor }} /></a>
              </Button>
            )}
            <Button variant="ghost" size="icon" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-5 w-5" style={{ color: primaryColor }} /></a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Order Search */}
        <Card style={{ background: cardBg }} className="border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders by phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchOrders()}
                  className="pl-10 bg-background border-border"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={searchOrders} disabled={searching} style={{ background: primaryColor, color: primaryForeground }}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
                {searchPerformed && <Button variant="outline" onClick={clearSearch}>Clear</Button>}
              </div>
            </div>
            {searchPerformed && (
              <div className="mt-4 space-y-2">
                {orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No orders found</p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-3">
                    {orders.map((order) => (
                      <div key={order.id} className="p-3 rounded-lg bg-background/50 border border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-sm">{order.customer_number}</p>
                            <p className="text-xs text-muted-foreground">{order.size_gb}GB {formatNetworkName(order.network)} - GH₵{Number(order.amount).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <span className="text-xs">{getStatusText(order.status)}</span>
                          </div>
                        </div>
                        {/* Order Tracking Card */}
                        <SubagentOrderTrackingCard
                          order={order}
                          store={store}
                          onReportClick={(o) => {
                            setReportOrder(o);
                            setReportDialogOpen(true);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 items-center">
          {["mtn", "airteltigo", "telecel"].map((net) => (
            <Button
              key={net}
              variant={networkFilter === net ? "default" : "outline"}
              size="sm"
              onClick={() => setNetworkFilter(net)}
              style={networkFilter === net ? { background: getNetworkColor(net), color: "#000" } : {}}
              className="whitespace-nowrap"
            >
              <Wifi className="h-4 w-4 mr-1" />
              {formatNetworkName(net)}
            </Button>
          ))}
        </div>

        {/* Packages Grid */}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}>
          {filteredPackages.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No packages available</p>
            </div>
          ) : (
            filteredPackages.map((pkg) => {
              const price = getPrice(pkg);
              return (
                <Card key={pkg.id} className="border-border hover:border-primary/50 transition-all cursor-pointer" style={{ background: cardBg }} onClick={() => { setPaymentPkg(pkg); setPaymentOpen(true); }}>
                  <CardContent className="p-4 text-center space-y-2">
                    <Badge style={{ background: getNetworkColor(pkg.network), color: "#000" }}>{formatNetworkName(pkg.network)}</Badge>
                    <p className="text-2xl font-bold" style={{ color: primaryColor }}>{pkg.size_gb}<span className="text-base text-muted-foreground">GB</span></p>
                    <p className="text-lg font-semibold text-green-400">GH₵ {Number(price).toFixed(2)}</p>
                    <Button size="sm" className="w-full" style={{ background: primaryColor, color: primaryForeground }}>Buy Now</Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Support */}
        <Card style={{ background: cardBg }} className="border-border">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3" style={{ color: primaryColor }}>Need Help?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
                <div>
                  <p className="text-muted-foreground text-xs">Support</p>
                  <p className="font-mono cursor-pointer hover:underline" onClick={() => { navigator.clipboard.writeText(store.support_number || ""); toast({ title: "Copied!" }); }}>
                    {formatDisplayPhone(store.support_number || "")} <Copy className="h-3 w-3 inline" />
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
                <div>
                  <p className="text-muted-foreground text-xs">WhatsApp</p>
                  <a href={`${whatsappLink}?text=Hello, I need help with my order.`} target="_blank" rel="noopener noreferrer" className="hover:underline">{displayWhatsApp}</a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-bold">ZYTRIX <span style={{ color: primaryColor }}>TECH</span></span>
          </p>
          <p className="text-sm text-muted-foreground pt-2">
            Already an agent? <a href="https://agentsstore.shop/login" className="font-semibold hover:underline" style={{ color: primaryColor }}>Login here</a>
          </p>
        </footer>
      </main>

      {/* Payment Dialog */}
      {paymentPkg && (
        <PaymentDialog
          isOpen={paymentOpen}
          onOpenChange={setPaymentOpen}
          package={paymentPkg}
          price={selectedPaymentPrice}
          storeId={store.agent_store_id}
          subagentStoreId={store.id}
          phoneNumber={customerPhone}
          onPhoneNumberChange={setCustomerPhone}
          storeName={store.store_name}
        />
      )}

      <PaymentVerifier storeId={store.id} isSubagent={true} />

      {/* Report Complaint Dialog */}
      {reportOrder && (
        <ReportComplaintDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          order={reportOrder}
          complaintType="subagent"
          subagentStoreId={store.id}
        />
      )}

      {/* Floating WhatsApp Group Icon */}
      {groupLink && (
        <a
          href={groupLink}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg hover:scale-105 transition-transform"
          style={{ background: "#25D366", color: "#fff" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          <span className="font-semibold text-sm">Join WhatsApp Group</span>
        </a>
      )}

      {/* Claim Free Data Dialog */}
      <ClaimFreeDataDialog
        open={claimFreeDataOpen}
        onOpenChange={setClaimFreeDataOpen}
        storeId={store.agent_store_id}
        subagentStoreId={store.id}
      />

      {/* Claim Free Data FAB - positioned above WhatsApp if exists */}
      <button
        onClick={() => setClaimFreeDataOpen(true)}
        className="fixed z-50 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white shadow-lg transition-all duration-300 hover:scale-110"
        style={{ bottom: groupLink ? "5.5rem" : "1.5rem", right: "1.5rem" }}
        title="Claim Free Data"
      >
        <Gift className="h-6 w-6" />
      </button>
    </div>
  );
}

export default SubagentStorefront;
