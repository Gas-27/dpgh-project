import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { publicSupabase as supabase } from "@/integrations/supabase/public-client";
import { DOMAINS } from "@/config/domains";
import { findStoreByName, fetchAllStores } from "@/utils/storeUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PaymentDialog from "@/components/PaymentDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import {
  Zap, Phone, Wifi, Clock, Search, Package,
  CheckCircle, XCircle, X, Loader2, Copy, Bell, Megaphone, Rocket,
  MessageCircle, Users, AlertTriangle, Check, Gift,
  LinkIcon, Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const ReportComplaintDialog = lazy(() => import("@/components/ReportComplaintDialog"));
import { ComplaintNotesThread } from "@/components/ComplaintNotesThread";
const ClaimFreeDataDialog = lazy(() => import("@/components/ClaimFreeDataDialog"));
import DraggableFAB from "@/components/DraggableFAB";
import PackageStatusIndicator, { PackageStatus } from "@/components/PackageStatusIndicator";
  import DeliveryProgressCard from "@/components/DeliveryProgressCard";
import SmsComposer from "@/components/SmsComposer";
  import { useOrderStatusRefresh } from "@/hooks/useOrderStatusRefresh";
import ChatBot from "@/components/ChatBot";
import AFAPackagesDisplay from "@/components/AFAPackagesDisplay";
import AFARegistrationTracker from "@/components/AFARegistrationTracker";
import AFARegistrationSuccess from "@/components/AFARegistrationSuccess";
import AFARegistrationFormStandalone from "@/components/AFARegistrationFormStandalone";

// Utility function to update page metadata dynamically
const updatePageMetadata = (storeName: string, description?: string, imageUrl?: string) => {
  try {
    // Update document title
    document.title = `${storeName} - Buy Affordable Data Bundles Instantly`;

    // Update og:title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `${storeName} - Buy Affordable Data Bundles Instantly`);

    // Update twitter:title
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', `${storeName} - Buy Affordable Data Bundles Instantly`);

    // Update og:description
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const desc = description || `Get instant data bundles from ${storeName}. Buy affordable MTN, AirtelTigo & Telecel data bundles. Fast, reliable 24/7 service.`;
    if (ogDesc) ogDesc.setAttribute('content', desc);

    // Update twitter:description
    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) twitterDesc.setAttribute('content', desc);

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);

    // Update og:image if provided
    if (imageUrl) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) ogImage.setAttribute('content', imageUrl);

      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (twitterImage) twitterImage.setAttribute('content', imageUrl);
    }
  } catch (error) {
    console.error("[v0] Error updating page metadata:", error);
  }
};

interface SubagentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  whatsapp_group?: string | null;
  show_whatsapp_group_icon?: boolean;
  show_ussd_on_storefront?: boolean;
  topup_reference?: string;
  theme_config?: {
    primary: string;
    primary_foreground: string;
    background: string;
    card_background: string;
    gridColumns?: number;
  };
  agent_store_id: string;
  approved?: boolean;
  suspended?: boolean;
}

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
  size_gb_text?: string;
  active?: boolean;
  is_online?: boolean;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  status: string;
  fulfillment_status: string;
  order_status: string;
  created_at: string;
  provider_reference?: string | null;
}

interface Notification {
  id: string;
  message: string;
  created_at: string;
}

const formatNetworkName = (network: string) => {
  if (network === "mtn") return "MTN";
  if (network === "mtn_express") return "MTN Express";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "telecel") return "Telecel";
  return network;
};

// Note: slugify is now imported from @/utils/storeUtils

const getNetworkColor = (network: string) => {
  const colors: Record<string, string> = { mtn: "#fbbf24", mtn_express: "#f59e0b", airteltigo: "#3b82f6", telecel: "#ef4444" };
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
const SubSubagentOrderTrackingCard = ({
  order,
  store,
  onReportClick,
}: {
  order: Order;
  store: SubagentStore;
  onReportClick: (order: Order) => void;
}): JSX.Element => {
  const [complaintStatus, setComplaintStatus] = useState<string | null>(null);
  const [complaintId, setComplaintId] = useState<string | null>(null);
  const [pendingNotes, setPendingNotes] = useState(0);
  const [totalNotes, setTotalNotes] = useState(0);

  // ── WhatsApp text auto-hide after 4 seconds ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGroupTooltip(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch complaint status + ID for this order
  useEffect(() => {
    const fetchComplaintStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("complaints")
          .select("id, status")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setComplaintStatus(data.status);
          setComplaintId(data.id);
        }
      } catch (e) {
        // No complaint found, that's okay
      }
    };

    fetchComplaintStatus();
    const interval = setInterval(fetchComplaintStatus, 5000);
    return () => clearInterval(interval);
  }, [order.id]);

  // ── Status-based step logic (no time dependency) ─�����
  // Check both order_status and status fields — refunded may be set on either
  const rawOrderStatus = order.order_status?.toLowerCase().trim() || "";
  const rawStatus = (order as any).status?.toLowerCase().trim() || "";
  const orderStatus = rawOrderStatus === "refunded" || rawStatus === "refunded"
    ? "refunded"
    : rawOrderStatus || rawStatus;
  let currentStep = 1;
  let statusMessage = "";
  let extraNote: string | null = null;

  if (orderStatus === "delivered") {
    currentStep = 4;
    statusMessage = "Your data bundle has been delivered successfully.";
    if (order.network === "mtn")
      extraNote = "Please check your MTNUP2U and MTN messages for delivery confirmation.";
    else if (order.network === "airteltigo")
      extraNote = "Please check your AirtelTigo iShare and BigTime messages for delivery confirmation.";
    else if (order.network === "telecel")
      extraNote = "Please check your Telecel messages for delivery confirmation.";
    else
      extraNote = "Please check your messages for delivery confirmation.";
  } else if ((orderStatus === "waiting" || orderStatus === "in-queue")) {
    const net = (order.network || "").toLowerCase();
    const isNonMtn = net === "telecel" || net === "airteltigo" || net === "at-bigtime" || net === "at bigtime" || net === "atbigtime";
    currentStep = 2;
    if (isNonMtn) {
      statusMessage = "Your order is in the queue.";
      extraNote = `Your ${formatNetworkName(order.network)} order has been received and is currently queued for processing. It will be picked up and sent to the network shortly. No action is needed on your part — please check back in a few minutes.`;
    } else {
      statusMessage = "Your number is being added to our beneficiary list.";
      extraNote = "MTN's new rule requires your number to be part of our beneficiary list before you can make purchases through our MTN portal. Your number is now being added and we're submitting your contact to MTN for approval. This is a one-time process. Once MTN approves and adds your contact to their list, your order will start processing immediately. Every new order from your contact will then go smoothly straight to processing.";
    }
  } else if (orderStatus === "processing") {
    currentStep = 3;
    statusMessage = `Order sent to ${order.network?.toUpperCase()} for delivery.`;
    extraNote = "Your order is being processed by the network. The status will update automatically once delivered.";
  } else if (orderStatus === "refunded") {
    currentStep = 4;
    statusMessage = "REFUNDED";
    extraNote = "Your order has been refunded to the account you bought from — your agent's wallet on the site (not your MoMo wallet). Your agent will refund you shortly.";
  } else if (orderStatus === "failed") {
    currentStep = 1;
    statusMessage = "This order could not be fulfilled.";
    extraNote = "Please contact support for assistance.";
  } else if (orderStatus === "pending") {
    currentStep = 1;
    statusMessage = "Order is placed and sent to the portal and now waiting for the portal to pick it up for processing.";
    extraNote = "Your order has been received and is in the queue. It will be picked up by the portal for processing shortly.";
  } else {
    // any other status defaults to processing step
    currentStep = 3;
    statusMessage = `Order sent to ${order.network?.toUpperCase()} for delivery.`;
    extraNote = "Waiting for the network to deliver your data.";
  }

  const orderDate = new Date(order.created_at).toLocaleString();


  const whatsappNumberDigits = getInternationalDigits(store.whatsapp_number);
  const whatsappMessage = encodeURIComponent(
    `Hello, I am reporting that my order shows as "Delivered" but I have not received the data.\n\nOrder Details:\n- Order Date: ${orderDate}\n- Network: ${order.network?.toUpperCase()}\n- Data: ${(order as any).size_gb_text || order.size_gb + "GB"}\n- Amount: GHC ${Number(order.amount).toFixed(2)}\n- Customer Number: ${order.customer_number}\n- Order Status: ${order.status} / ${order.fulfillment_status}\n- Order ID: ${order.id}\n\nPlease investigate and assist. Thank you.`
  );
  const whatsappLink = `https://wa.me/${whatsappNumberDigits}?text=${whatsappMessage}`;

  // Report button: show only when order status is "delivered"
  const showReportButton = orderStatus === "delivered";

  const isRefunded = orderStatus === "refunded";
  const stepLabels = ["Order Placed", "Number Verifying", "Processing", isRefunded ? "Refunded" : "Delivered"];
  const theme = store.theme_config || defaultTheme;
  const primaryColor = theme.primary || defaultTheme.primary;

  // Delivered / Refunded state
  if (currentStep === 4) {
    return (
      <div className="space-y-4 mt-3 p-4 rounded-lg border border-border bg-background/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Delivery Status</span>
          {isRefunded ? (
            <Badge className="bg-red-600/20 text-red-400 border-red-600/30 font-semibold tracking-wide">
              <CheckCircle className="h-3 w-3 mr-1" /> Refunded
            </Badge>
          ) : (
            <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
              <CheckCircle className="h-3 w-3 mr-1" /> Delivered
            </Badge>
          )}
        </div>

        <div className="relative">
          <div className="flex items-center justify-between">
            {stepLabels.map((label, idx) => (
              <div key={idx} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isRefunded ? "bg-red-600/20 text-red-400" : "bg-green-600/20 text-green-400"}`}>
                  <Check className="h-4 w-4" />
                </div>
                <span className={`text-xs text-center mt-1 ${idx === 3 && isRefunded ? "text-red-400 font-semibold" : "text-muted-foreground"}`}>{label}</span>
              </div>
            ))}
          </div>
          <div className={`absolute top-4 left-0 w-full h-0.5 -z-10 ${isRefunded ? "bg-red-600/30" : "bg-green-600/30"}`} />
        </div>

        {isRefunded ? (
          <div className="p-3 rounded-lg bg-red-600/10 border border-red-600/30">
            <p className="text-sm font-semibold text-red-400 uppercase tracking-wide">{statusMessage}</p>
            {extraNote && <p className="text-xs text-muted-foreground mt-2 border-t pt-2 border-red-600/20">{extraNote}</p>}
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-green-600/10 border border-green-600/30">
            <p className="text-sm font-semibold text-green-400">{statusMessage}</p>
            {extraNote && <p className="text-xs text-muted-foreground mt-2 border-t pt-2 border-green-600/20">{extraNote}</p>}
          </div>
        )}

        {/* Report button - only if delivered (not refunded) and no complaint yet */}
        {showReportButton && !isRefunded && !complaintStatus && (
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

        {/* Static status box — always shown; thread only visible when admin has notes */}
        {complaintStatus && complaintStatus !== "resolved" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-yellow-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Report has been sent — we are working on it
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Status: {complaintStatus === "in-progress" ? "In Progress" : "Pending"}
                </p>
              </div>
              {pendingNotes > 0 && (
                <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">
                  {pendingNotes} question{pendingNotes > 1 ? "s" : ""} from support
                </span>
              )}
            </div>
            {complaintId && (
              <div className={totalNotes > 0 ? "rounded-lg border border-border bg-card/50 p-3" : "hidden"}>
                <ComplaintNotesThread
                  complaintId={complaintId}
                  isAdmin={false}
                  onPendingCountChange={setPendingNotes}
                  onTotalNotesChange={setTotalNotes}
                />
              </div>
            )}
          </div>
        )}

        {complaintStatus === "resolved" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-green-600/10 border border-green-600/30">
              <p className="text-sm font-medium text-green-400 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Your complaint has been resolved
              </p>
            </div>
            {complaintId && (
              <div className={totalNotes > 0 ? "rounded-lg border border-border bg-card/50 p-3" : "hidden"}>
                <ComplaintNotesThread
                  complaintId={complaintId}
                  isAdmin={false}
                  onPendingCountChange={setPendingNotes}
                  onTotalNotesChange={setTotalNotes}
                />
              </div>
            )}
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

      </div>

    </div>
  );
};

export function SubSubagentStorefront() {
  const { subagentStoreName, subSubagentStoreName: urlStoreName } = useParams<{ subagentStoreName: string; subSubagentStoreName: string }>();
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
  const [agentInfo, setAgentInfo] = useState<{ whatsapp_number?: string; support_number?: string } | null>(null);
  
  // Order search
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const checkingOrderIds = useOrderStatusRefresh(orders, setOrders);
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Report complaint dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportOrder, setReportOrder] = useState<Order | null>(null);
  
  // Claim Free Data dialog
  const [claimFreeDataOpen, setClaimFreeDataOpen] = useState(false);
  const [freeDataEnabled, setFreeDataEnabled] = useState(true);

  // Sub-Subagent Registration
  // ── AFA Packages ──
  const [showAFA, setShowAFA] = useState(false);
  const [showSms, setShowSms] = useState(false);
  const [afaPaymentPkg, setAfaPaymentPkg] = useState<{ id: string; size_gb: number; price: number; network: string } | null>(null);
  const [afaPaymentOpen, setAfaPaymentOpen] = useState(false);

  const [selectedAFAPackage, setSelectedAFAPackage] = useState<{
    id: string;
    name: string;
    price: number;
  } | null>(null);

  // Theme
  const theme = store?.theme_config || defaultTheme;
  const primaryColor = theme.primary || defaultTheme.primary;
  const primaryForeground = theme.primary_foreground || defaultTheme.primary_foreground;
  const bgColor = theme.background || defaultTheme.background;
  const cardBg = theme.card_background || defaultTheme.card_background;
  const gridColumns = theme.gridColumns || 2;

  // ── Update page metadata when store loads ──
  useEffect(() => {
    if (store?.store_name) {
      updatePageMetadata(store.store_name);
    }
  }, [store?.store_name]);

  // Fetch store by name
  useEffect(() => {
    const fetchStore = async () => {
      if (!urlStoreName) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Fetch ALL sub-subagent stores via pagination (bypasses the 1000-row cap)
      const stores = await fetchAllStores(supabase, "sub_subagent_stores");

      if (!stores || stores.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Use unified store matching utility, with ID fallback
      let matched = findStoreByName(urlStoreName, stores);
      if (!matched) matched = stores.find((s: any) => s.id === urlStoreName) || null;

      if (!matched) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      matched.theme_config = { ...defaultTheme, ...(matched.theme_config || {}) };
      // Don't override show_whatsapp_group_icon - use database value directly
      setStore(matched);

      // Compute the customer price EXACTLY like the sub-subagent dashboard "Store Prices" tab.
      // Final price = the sub-subagent's own selling price (sell_price) if they have set one,
      // otherwise the "Cost from Agent", which is built with this priority (lowest → highest):
      //   1. admin/default package price (ultimate fallback)
      //   2. parent subagent's OWN cost from their agent:
      //      subagent_package_prices.base_price WHERE agent_store_id = matched.agent_store_id
      //   3. parent subagent's sub-subagent template price:
      //      sub_subagent_package_prices.base_price WHERE subagent_store_id = parent AND sub_subagent_store_id IS NULL
      const [pkgRes, ownSellRes, agentCostRes, templatePricesRes, appSettingsRes, parentSubagentInfoRes] = await Promise.all([
        supabase.from("data_packages").select("*").order("size_gb"),
        // This sub-subagent's own selling price (what they saved in their dashboard).
        // customer_sell_price is a dedicated column, separate from sell_price (which is
        // the parent subagent's cost price to this sub-subagent) so the two never overwrite
        // each other.
        supabase.from("sub_subagent_package_prices").select("package_id, customer_sell_price, created_at").eq("sub_subagent_store_id", matched.id).order("created_at", { ascending: false }),
        // Parent subagent's own cost from their agent (base_price keyed by agent_store_id)
        matched.agent_store_id ? supabase.from("subagent_package_prices").select("package_id, base_price").eq("agent_store_id", matched.agent_store_id) : Promise.resolve({ data: null, error: null }),
        // Parent subagent's sub-subagent template price (sub_subagent_store_id IS NULL)
        matched.subagent_store_id ? supabase.from("sub_subagent_package_prices").select("package_id, base_price").eq("subagent_store_id", matched.subagent_store_id).is("sub_subagent_store_id", null) : Promise.resolve({ data: null, error: null }),
        supabase.from("app_settings").select("free_data_enabled").eq("id", 1).single(),
        supabase.from("subagent_stores").select("whatsapp_number, support_number").eq("id", matched.subagent_store_id).single(),
      ]);

      setPackages(pkgRes.data || []);
      if (parentSubagentInfoRes.data) setAgentInfo(parentSubagentInfoRes.data);

      // Build "Cost from Agent" map (levels 1-3)
      const baseCostMap: Record<string, number> = {};
      // 1. admin/default package price
      (pkgRes.data || []).forEach((p: any) => { baseCostMap[p.id] = p.price; });
      // 2. parent subagent's own cost from their agent
      (agentCostRes.data || []).forEach((p: any) => { 
        if (p.base_price != null) baseCostMap[p.package_id] = Number(p.base_price); 
      });
      // 3. parent subagent's sub-subagent template price
      (templatePricesRes.data || []).forEach((p: any) => { 
        if (p.base_price != null) baseCostMap[p.package_id] = Number(p.base_price); 
      });

      // Final customer price = sub-subagent's own customer_sell_price if set, else the cost-from-agent.
      // ownSellRes.data is ordered newest-first, so take only the FIRST (newest) row per package —
      // otherwise an older duplicate row later in the array would silently overwrite the current price.
      const priceMap: Record<string, number> = { ...baseCostMap };
      const seenOwnSell = new Set<string>();
      (ownSellRes.data || []).forEach((p: any) => {
        if (p.customer_sell_price != null && !seenOwnSell.has(p.package_id)) {
          priceMap[p.package_id] = Number(p.customer_sell_price);
          seenOwnSell.add(p.package_id);
        }
      });
      
  setSubagentPrices(priceMap);
      if (appSettingsRes.data) setFreeDataEnabled(appSettingsRes.data.free_data_enabled ?? true);
      
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
        { event: "UPDATE", schema: "public", table: "sub_subagent_stores", filter: `id=eq.${store.id}` },
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
    
    // Rebuild price exactly like the dashboard: customer_sell_price if set, else cost-from-agent
    // (admin → parent's agent cost → parent's sub-subagent template).
    const refetchMergedPrices = async () => {
      const [ownSell, agentCost, templatePrices, pkgs] = await Promise.all([
        supabase.from("sub_subagent_package_prices").select("package_id, customer_sell_price, created_at").eq("sub_subagent_store_id", store.id).order("created_at", { ascending: false }),
        store.agent_store_id ? supabase.from("subagent_package_prices").select("package_id, base_price").eq("agent_store_id", store.agent_store_id) : Promise.resolve({ data: null }),
        store.subagent_store_id ? supabase.from("sub_subagent_package_prices").select("package_id, base_price").eq("subagent_store_id", store.subagent_store_id).is("sub_subagent_store_id", null) : Promise.resolve({ data: null }),
        supabase.from("data_packages").select("id, price").eq("active", true),
      ]);
      
      const baseCostMap: Record<string, number> = {};
      // 1. admin prices
      (pkgs.data || []).forEach((p: any) => { baseCostMap[p.id] = p.price; });
      // 2. parent subagent's own cost from their agent
      (agentCost.data || []).forEach((p: any) => { 
        if (p.base_price != null) baseCostMap[p.package_id] = Number(p.base_price); 
      });
      // 3. parent subagent's sub-subagent template price
      (templatePrices.data || []).forEach((p: any) => { 
        if (p.base_price != null) baseCostMap[p.package_id] = Number(p.base_price); 
      });
      // Final: sub-subagent's own customer_sell_price if set, else cost-from-agent.
      // Take only the first (newest) row per package so an older duplicate row can't overwrite it.
      const priceMap: Record<string, number> = { ...baseCostMap };
      const seenOwnSell = new Set<string>();
      (ownSell.data || []).forEach((p: any) => {
        if (p.customer_sell_price != null && !seenOwnSell.has(p.package_id)) {
          priceMap[p.package_id] = Number(p.customer_sell_price);
          seenOwnSell.add(p.package_id);
        }
      });
      
      setSubagentPrices(priceMap);
    };

    const priceChannel = supabase
      .channel(`subagent-prices-${store.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sub_subagent_package_prices", filter: `sub_subagent_store_id=eq.${store.id}` },
        refetchMergedPrices
      )
      .subscribe();

    // Also react live when the parent subagent updates their sub-subagent template price,
    // or when the agent updates the base price they charge the parent subagent — both feed
    // into this sub-subagent's "cost from agent" fallback.
    const templatePriceChannel = store.subagent_store_id
      ? supabase
          .channel(`sub-subagent-template-prices-${store.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "sub_subagent_package_prices", filter: `subagent_store_id=eq.${store.subagent_store_id}` },
            refetchMergedPrices
          )
          .subscribe()
      : null;

    const agentPriceChannel = store.agent_store_id
      ? supabase
          .channel(`sub-subagent-agent-base-prices-${store.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "subagent_package_prices", filter: `agent_store_id=eq.${store.agent_store_id}` },
            refetchMergedPrices
          )
          .subscribe()
      : null;
    
    return () => { 
      supabase.removeChannel(storeChannel);
      supabase.removeChannel(priceChannel);
      if (templatePriceChannel) supabase.removeChannel(templatePriceChannel);
      if (agentPriceChannel) supabase.removeChannel(agentPriceChannel);
    };
  }, [store?.id, store?.subagent_store_id, store?.agent_store_id]);

  // ── Real-time order status updates — filtered to this store only ──
  useEffect(() => {
    if (!store?.id) return;
    const ordersChannel = supabase
      .channel(`sub-subagent-orders-storefront-${store.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `sub_subagent_store_id=eq.${store.id}` },
        (payload) => {
          const updatedOrder = payload.new as Order;
          setOrders(prevOrders =>
            prevOrders.map(order =>
              order.id === updatedOrder.id
                ? { ...order, ...updatedOrder }
                : order
            )
          );
        }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(ordersChannel); };
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
      .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status, created_at, package_id, provider_reference, provider_order_id")
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
        .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status, created_at, package_id, provider_reference, provider_order_id")
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
    
    const refreshedOrders = await Promise.all(allOrders.map(async (order: any) => {
    const existingStatuses = [order.order_status, order.status, order.fulfillment_status].map((value) => String(value ?? "").toLowerCase());
    if (existingStatuses.includes("refunded")) return { ...order, order_status: "refunded", status: "refunded", fulfillment_status: "refunded" };
    if (existingStatuses.some((status) => ["delivered", "completed", "failed", "failure", "cancelled", "canceled"].includes(status))) return order;
    const network = String(order.network ?? "").toLowerCase();
    if (network !== "mtn_express" && network !== "atbigtime") return order;
    const reference = order.provider_reference ?? (order as any).provider_order_id;
    if (!reference) return order;
    const { data: checked, error: checkError } = await supabase.functions.invoke("check-order", {
      body: { order_id: order.id, reference },
    });
    if (checkError) console.error("[v0] Order status check failed:", checkError);
    return checked?.order_status ? { ...order, order_status: checked.order_status, fulfillment_status: checked.order_status, status: checked.order_status } : order;
  }));
  const enrichedOrders = refreshedOrders.map((order) => {
      // COMMENTED OUT: mashup packages deactivated
      // For mtn_mashup and mashup orders, fetch size_gb_text and data_package_id from data_packages
      // This enriches the order with package details
      if (false && (order.network === "mtn_mashup" || order.network === "mashup") && order.package_id) {
        const { data: pkg } = supabase.from("data_packages").select("size_gb_text, data_package_id").eq("id", order.package_id).single();
        return { ...order, size_gb_text: pkg?.size_gb_text, data_package_id: pkg?.data_package_id };
      }
      return order;
    });
    
    setOrders(enrichedOrders);
    setSearching(false);
  }, [searchQuery, store?.id, store?.agent_store_id]);

  const clearSearch = () => {
    setSearchQuery("");
    setOrders([]);
    setSearchPerformed(false);
  };

  // Helpers
  const filteredPackages = packages.filter((p) => {
      // COMMENTED OUT: mashup packages deactivated
    if (networkFilter === "airteltigo") {
      return p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
    }
    return p.network === networkFilter;
  });
  const getPrice = (pkg: DataPackage) => subagentPrices[pkg.id] ?? pkg.price;
  const selectedPaymentPrice = paymentPkg ? getPrice(paymentPkg) : 0;

  const displayWhatsApp = store ? formatDisplayPhone(store.whatsapp_number || "") : "";
  const whatsappLink = store ? `https://wa.me/${getInternationalDigits(store.whatsapp_number || "")}` : "#";
  const groupLink = store?.show_whatsapp_group_icon && store?.whatsapp_group ? store.whatsapp_group : null;

  const getStatusIcon = (status: string) => {
    if (status === "refunded") return <XCircle className="h-4 w-4 text-amber-400" />;
    if (status === "completed" || status === "paid") return <CheckCircle className="h-4 w-4 text-green-400" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-yellow-400" />;
    return <XCircle className="h-4 w-4 text-red-400" />;
  };

  const getStatusText = (status: string) => {
    if (status === "refunded") return "Refunded";
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


      {/* Suspended Store Banner */}
      {store.suspended && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/50 bg-red-950/90 p-6 space-y-4 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-red-500/20 p-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-red-400">Store Suspended</h2>
            <p className="text-gray-300">
              This store has been temporarily suspended and cannot process orders at this time.
            </p>
            {agentInfo?.whatsapp_number && (
              <p className="text-sm text-gray-400">
                For assistance, contact the administrator at: <span className="text-white font-semibold">{agentInfo.whatsapp_number}</span>
              </p>
            )}
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

      {/* Store URL Banner - Redesigned for better appeal */}
      {store && (
        <div className="relative px-4 py-6 overflow-hidden">
          <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(135deg, ${primaryColor}30, ${primaryColor}10)` }} />
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="rounded-xl border-2 p-6 backdrop-blur-sm" style={{ borderColor: `${primaryColor}40`, backgroundColor: `${primaryColor}08` }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                    <Share2 className="h-3 w-3" /> Share Your Store
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">Spread the word and earn more! Share this link with your network:</p>
                  <code 
                    className="block w-full rounded-lg px-3 py-2 font-mono text-sm font-semibold break-all"
                    style={{ color: primaryColor, backgroundColor: `${primaryColor}15`, border: `1px solid ${primaryColor}30` }}
                  >
                    {subagentStoreName && DOMAINS.getSubSubagentStoreUrl(subagentStoreName, store.store_name).replace('https://', '')}
                  </code>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  <Button 
                    size="sm" 
                    className="flex-1 sm:flex-auto rounded-lg font-semibold"
                    style={{ backgroundColor: primaryColor, color: primaryForeground }}
                    onClick={() => {
                      const url = subagentStoreName ? DOMAINS.getSubSubagentStoreUrl(subagentStoreName, store.store_name) : "";
                      if (!url) return;
                      if (navigator.share) {
                        navigator.share({
                          title: `${store.store_name} - Data Store`,
                          text: `Buy affordable data bundles from ${store.store_name}`,
                          url: url,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(url);
                        toast({
                          title: "Link copied!",
                          description: "Store link copied to clipboard",
                        });
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-1 sm:flex-auto rounded-lg"
                    onClick={() => {
                      const url = subagentStoreName ? DOMAINS.getSubSubagentStoreUrl(subagentStoreName, store.store_name) : "";
                      if (!url) return;
                      navigator.clipboard.writeText(url);
                      toast({
                        title: "Link copied!",
                        description: "Store link copied to clipboard",
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                            <p className="text-xs text-muted-foreground">{(order as any).size_gb_text || order.size_gb + "GB"} {formatNetworkName(order.network)} - GHC{Number(order.amount).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <span className="text-xs">{getStatusText(order.status)}</span>{checkingOrderIds.has(order.id) && <span className="text-[11px] text-muted-foreground whitespace-nowrap">checking latest status…</span>}
                          </div>
                        </div>
                        {/* Order Tracking Card */}
                        <SubSubagentOrderTrackingCard
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
        <div className="flex flex-wrap gap-2 pb-2 items-center">
        {["mtn", "mtn_express", "airteltigo", "telecel"].map((net) => (
            <Button
              key={net}
              variant={networkFilter === net && !showAFA ? "default" : "outline"}
              size="sm"
              onClick={() => { setNetworkFilter(net); setShowAFA(false); }}
              style={networkFilter === net && !showAFA ? { background: getNetworkColor(net), color: net === "mtn" || net === "mtn_express" ? "#000" : "#fff" } : {}}
              className="whitespace-nowrap flex-shrink-0 text-xs sm:text-sm"
            >
              <Wifi className="h-4 w-4 mr-1" />
              {formatNetworkName(net)}
            </Button>
          ))}
          <div className="h-6 w-px bg-border flex-shrink-0"></div>
          <Button
            variant={showAFA ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowAFA(!showAFA); setShowSms(false); }}
            style={showAFA ? { background: primaryColor, color: primaryForeground } : {}}
            className="whitespace-nowrap flex-shrink-0 text-xs sm:text-sm font-semibold"
          >
            <Package className="h-4 w-4 mr-1" />
            AFA Bundles
  </Button>
  <div className="h-6 w-px bg-border flex-shrink-0"></div>
  <Button variant={showSms ? "default" : "outline"} size="sm" onClick={() => { setShowSms(!showSms); setShowAFA(false); }} style={showSms ? { background: primaryColor, color: primaryForeground } : {}} className="whitespace-nowrap flex-shrink-0 text-xs sm:text-sm font-semibold"><MessageCircle className="h-4 w-4 mr-1" />SMS</Button>
  </div>
  
  {showSms && <Card className="border-primary/30 bg-primary/5"><CardContent className="p-4 sm:p-6"><h2 className="mb-2 text-center font-display text-2xl font-bold">Bulk SMS</h2><p className="mb-6 text-center text-sm text-muted-foreground">Send SMS and pay securely with Paystack. Sign-in is not required.</p><SmsComposer ownerType="subsubagent" ownerId={store?.id} publicMode storeUrl={typeof window !== "undefined" ? window.location.href : undefined} /></CardContent></Card>}
  
  {/* AFA Bundles Section */}
        {showAFA ? (
          <div className="w-full pb-8 space-y-8">
            {/* Track AFA registration status — shown at the very top */}
            <AFARegistrationTracker storeLabel={store?.store_name} />
            {/* Pass only subsubagentStoreId so the sub-subagent's own set price is shown */}
            <AFAPackagesDisplay
              subsubagentStoreId={store?.id}
              onRegisterClick={(packageId, packageName, price) => {
                setSelectedAFAPackage({ id: packageId, name: packageName, price });
              }}
              themeColor={primaryColor}
            />
          </div>
        ) : null}

        {/* Packages Grid */}
        {!showAFA && !showSms && <>
        {/* USSD Info Banner */}
          {store?.show_ussd_on_storefront !== false && store?.topup_reference && (
            <a href="tel:*380*455#" className="block mb-4 p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
              <div className="flex items-center justify-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Buy data via USSD - No internet needed!</p>
                  <p className="text-xl font-bold font-mono text-primary">*380*455#</p>
                  <p className="text-xs text-muted-foreground">Access Code: <span className="font-mono font-bold text-foreground">{store.topup_reference}</span></p>
                </div>
              </div>
            </a>
          )}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, 300px), 1fr))` }}>
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No packages available for this network</p>
              </div>
            ) : (
              filteredPackages.map((pkg) => {
                const price = getPrice(pkg);
                const isInactive = pkg.active === false;
                const isOffline = pkg.is_online === false;
      // COMMENTED OUT: mashup packages deactivated
      const isMTNMashup = false; // pkg.network === "mtn_mashup" || pkg.network === "mashup";
      // Show Express badge only on specific mtn_mashup packages (matching flyer image)
      const showExpress = false; // pkg.network === "mtn_mashup" && ["125mins + 0.36GB", "360mins + 0.87GB", "700mins + 1.6GB", "1.7GB", "3.4GB", "6.8GB", "8.5GB", "10.2GB", "20GB"].includes(pkg.size_gb_text || "");
                return (
                  <Card 
                    key={pkg.id} 
                    className={`relative border-0 shadow-lg transition-all w-full ${isInactive ? "opacity-50 grayscale cursor-not-allowed" : "hover:shadow-xl cursor-pointer"}`}
                    style={isMTNMashup ? { background: "linear-gradient(135deg,#FFA500 0%,#FF8C00 100%)" } : { background: cardBg, borderColor: "var(--border)" }}
                    onClick={() => { if (isInactive) return; setPaymentPkg(pkg); setPaymentOpen(true); }}
                  >
                    <CardContent className="p-6 text-center space-y-4">
                      {(isInactive || isOffline) && (
                        <PackageStatusIndicator status={isOffline ? "offline" : "not_available"} />
                      )}
                      {isMTNMashup ? (
                        <>
                          <div className="relative bg-white/20 rounded-lg p-3 mb-3">
                            {showExpress && <div className="absolute top-1 right-1 bg-yellow-400 text-black px-2 py-1 rounded text-xs font-bold">Express</div>}
                            <p className="font-semibold text-base text-white">Special MTN Mashup</p>
                            <p className="text-xs opacity-90 text-white">Data Bundle</p>
                          </div>
                          <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">{pkg.size_gb_text}</p>
                          <p className="text-base font-medium text-white">GHC {Number(price).toFixed(2)} - Valid forever</p>
                          <div className="space-y-2 text-sm text-white">
                            <div className="flex items-center justify-center gap-2"><Check className="h-4 w-4" />No SMS is sent for data delivery. Check your balance before purchasing.</div>
                          </div>
                          <Button variant="secondary" size="lg" className="w-full font-semibold bg-orange-700 hover:bg-orange-800 text-white border-0">Buy Now</Button>
                        </>
                      ) : (
                        <>
                          <Badge style={{ background: getNetworkColor(pkg.network), color: "#000" }}>{formatNetworkName(pkg.network)}</Badge>
                          <p className="text-3xl font-bold" style={{ color: primaryColor }}>{pkg.size_gb}<span className="text-lg text-muted-foreground">GB</span></p>
                          <p className="text-xl font-semibold text-green-400">GHC {Number(price).toFixed(2)}</p>
                                                  <Button size="lg" disabled={isInactive} className="w-full font-semibold disabled:opacity-100 disabled:cursor-not-allowed" style={isInactive ? { background: "transparent", color: "inherit", border: "1px solid var(--border)" } : { background: primaryColor, color: primaryForeground }}>{isInactive ? "Not Available" : "Buy Now"}</Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>}

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
        <footer className="text-center py-6 border-t border-border space-y-2">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-bold">ZYTRIX <span style={{ color: primaryColor }}>TECH</span></span>
          </p>
          <p className="text-sm text-muted-foreground">
            agent login? <a href={DOMAINS.getSubSubagentLoginUrl()} className="font-semibold hover:underline" style={{ color: primaryColor }}>Login here</a>
          </p>
          <p className="text-sm text-muted-foreground">
            store owner login? <a href="https://agentsstore.shop/login" className="font-semibold hover:underline" style={{ color: primaryColor }}>Login here</a>
          </p>
        </footer>
      </main>

      {/* Payment Dialog */}
      {paymentPkg && (
        <PaymentDialog
          isOpen={paymentOpen}
          onOpenChange={setPaymentOpen}
          package={paymentPkg}
          packageId={paymentPkg.id}
          price={selectedPaymentPrice}
          storeId={store.agent_store_id}
          subsubagentStoreId={store.id}
          phoneNumber={customerPhone}
          onPhoneNumberChange={setCustomerPhone}
          storeName={store.store_name}
        />
      )}

      <PaymentVerifier storeId={store.id} isSubagent={true} />
      <AFARegistrationSuccess />

      {/* AFA Registration Dialog — uses AFA-registration edge function directly */}
      <Dialog open={!!selectedAFAPackage} onOpenChange={(v) => { if (!v) setSelectedAFAPackage(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AFA Registration — {selectedAFAPackage?.name}</DialogTitle>
            <DialogDescription>
              Complete your details below to register for AFA. Registration fee: GHC{selectedAFAPackage?.price?.toFixed(2)}.
            </DialogDescription>
          </DialogHeader>
          {selectedAFAPackage && (
            <AFARegistrationFormStandalone
              key={selectedAFAPackage.id}
              registrationFee={selectedAFAPackage.price}
              agentStoreId={(store as any).agent_store_id}
              subagentStoreId={(store as any).subagent_store_id}
              subsubagentStoreId={store.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Report Complaint Dialog — lazy-loaded to break circular dep */}
      <Suspense fallback={null}>
        {reportOrder && (
          <ReportComplaintDialog
            open={reportDialogOpen}
            onOpenChange={setReportDialogOpen}
            order={reportOrder}
            complaintType="subagent"
            subagentStoreId={store.id}
          />
        )}
      </Suspense>

      {/* Floating WhatsApp Group Icon - Draggable */}
      {groupLink && (
        <DraggableFAB
          initialBottom={freeDataEnabled ? 88 : 24}
          initialRight={24}
          storageKey="whatsapp-group-subsubagent"
          href={groupLink}
          title="Join WhatsApp Group"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20B859] text-white shadow-lg transition-all duration-300 hover:scale-110">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
          </div>
        </DraggableFAB>
      )}

      {/* Claim Free Data Dialog — lazy-loaded to break circular dep */}
      <Suspense fallback={null}>
        <ClaimFreeDataDialog
          open={claimFreeDataOpen}
          onOpenChange={setClaimFreeDataOpen}
          storeId={store.agent_store_id}
          subagentStoreId={store.id}
        />
      </Suspense>

      {/* Claim Free Data FAB - draggable */}
      {freeDataEnabled && (
        <DraggableFAB
          initialBottom={groupLink ? 88 : 24}
          initialRight={24}
          storageKey="claim-free-data-subagent"
          onClick={() => setClaimFreeDataOpen(true)}
          title="Claim Free Data"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white shadow-lg transition-all duration-300 hover:scale-110">
            <Gift className="h-6 w-6" />
          </div>
        </DraggableFAB>
      )}

      {/* Support ChatBot */}
      <ChatBot page="subsubagent-storefront" />
    </div>
  );
}

export default SubSubagentStorefront;
