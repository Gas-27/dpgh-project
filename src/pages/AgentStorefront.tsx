import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { publicSupabase as supabase } from "@/integrations/supabase/public-client";
import { DOMAINS } from "@/config/domains";
import { getStoreNameFromSubdomain, findStoreByName, fetchAllStores } from "@/utils/storeUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import PaymentDialog from "@/components/PaymentDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import AFARegistrationSuccess from "@/components/AFARegistrationSuccess";
const ReportComplaintDialog = lazy(() => import("@/components/ReportComplaintDialog"));
import { ComplaintNotesThread } from "@/components/ComplaintNotesThread";
const ClaimFreeDataDialog = lazy(() => import("@/components/ClaimFreeDataDialog"));
import AFAPackagesDisplay from "@/components/AFAPackagesDisplay";
import {
  Zap, Phone, Wifi, Shield, Clock, Star, Search, Package,
  CheckCircle, XCircle, X, Loader2, Check, Copy, Bell, Megaphone, Rocket, AlertTriangle, Gift,
  Layers, FileSpreadsheet, RotateCcw, LinkIcon, Share2, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DraggableFAB from "@/components/DraggableFAB";
import PackageStatusIndicator, { PackageStatus } from "@/components/PackageStatusIndicator";
import ChatBot from "@/components/ChatBot";
import { normalizeOrderStatus, orderStatusLabel } from "@/utils/orderStatus";

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

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────
interface AgentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  whatsapp_group?: string | null;
  show_whatsapp_group_icon?: boolean;
  show_ussd_on_storefront?: boolean;
  topup_reference?: string;
  allow_subagent_registration?: boolean;
  theme_config?: {
    primary: string;
    primary_foreground: string;
    background: string;
    card_background: string;
    gridColumns?: number;
    gb_text_color?: string;
    price_text_color?: string;
    button_text_color?: string;
    button_bg_color?: string;
    button_border_color?: string;
  };
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
}

interface Notification {
  id: string;
  message: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const formatNetworkName = (network: string) => {
  if (network === "mtn") return "MTN";
  if (network === "mtn_express") return "MTN Express";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "telecel") return "Telecel";
  return network;
};

const copyToClipboard = async (text: string, toast: any) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Contact information copied to clipboard." });
  } catch {
    toast({ title: "Failed to copy", description: "Please copy manually.", variant: "destructive" });
  }
};

// Note: getStoreNameFromSubdomain and slugify are now imported from @/utils/storeUtils

const getNetworkLabelColor = (network: string) => {
  const colors: Record<string, string> = { mtn: "#fbbf24", mtn_express: "#f59e0b", airteltigo: "#60a5fa", telecel: "#f87171" };
  return colors[network] || "#ffffff";
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

/**
 * Strip ALL whitespace from a phone string so that
 * "059 944 9202", "05 99 44 92 02", and "0599449202" all normalize to "0599449202".
 */
const stripSpaces = (s: string): string => s.replace(/\s+/g, "");

// ──────�����──────────────────────��──────────────────────────────────────────────
// ORDER TRACKING CARD
// Delivery (step 4) only appears after 200 minutes.
// ───�����───────────────────────────────���────────────────────���────────────────────
const OrderTrackingCard = ({
  order,
  store,
  toast,
  onReportClick,
}: {
  order: Order;
  store: AgentStore;
  toast: any;
  onReportClick: (order: Order) => void;
}): JSX.Element => {
  const [complaintStatus, setComplaintStatus] = useState<string | null>(null);
  const [complaintId, setComplaintId] = useState<string | null>(null);
  const [pendingNotes, setPendingNotes] = useState(0);
  const [totalNotes, setTotalNotes] = useState(0);

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
    const interval = setInterval(fetchComplaintStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [order.id]);

  // ── Status-based step logic (no time dependency) ──
  // Use the same status precedence as the order table, including fulfillment_status.
  const orderStatus = normalizeOrderStatus(order);
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
  } else if (orderStatus === "waiting") {
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
    statusMessage = `Order sent to ${formatNetworkName(order.network)} for delivery.`;
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
    statusMessage = `Order sent to ${formatNetworkName(order.network)} for delivery.`;
    extraNote = "Waiting for the network to deliver your data.";
  }

  const orderDate = new Date(order.created_at).toLocaleString();
  const contactMessage = `Order from ${orderDate}\nNetwork: ${formatNetworkName(order.network)}\nData: ${(order as any).size_gb_text || order.size_gb + "GB"}\nAmount: GHC ${Number(order.amount).toFixed(2)}\nCustomer: ${order.customer_number}\n\nPlease help resolve this issue. Contact: ${store.support_number}`;

  const whatsappNumberDigits = getInternationalDigits(store.whatsapp_number);
  const whatsappMessage = encodeURIComponent(
    `Hello, I am reporting that my order shows as "Delivered" but I have not received the data.\n\nOrder Details:\n- Order Date: ${orderDate}\n- Network: ${formatNetworkName(order.network)}\n- Data: ${(order as any).size_gb_text || order.size_gb + "GB"}\n- Amount: GHC ${Number(order.amount).toFixed(2)}\n- Customer Number: ${order.customer_number}\n- Order Status: ${order.status} / ${order.fulfillment_status}\n- Order ID: ${order.id}\n\nPlease investigate and assist. Thank you.`
  );
  const whatsappLink = `https://wa.me/${whatsappNumberDigits}?text=${whatsappMessage}`;

  // Support button: show whenever order is not yet delivered
  const showSupportButton = currentStep !== 4;
  
  // Report button: show only when order status is "delivered"
  const showReportButton = orderStatus === "delivered";

  const isRefunded = orderStatus === "refunded";
  const stepLabels = ["Order Placed", "Number Verifying", "Processing", isRefunded ? "Refunded" : "Delivered"];

  // ── Delivered / Refunded state ──
  if (currentStep === 4) {
    return (
      <div className="space-y-4">
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

  // ������ In-progress state ──
  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex items-center justify-between">
          {stepLabels.map((label, idx) => {
            const n = idx + 1;
            let icon;
            if (n < currentStep) icon = <Check className="h-4 w-4 text-green-400" />;
            else if (n === currentStep)
              icon = <Loader2 className="h-4 w-4 text-primary animate-spin" />;
            else icon = <Clock className="h-4 w-4 text-muted-foreground" />;
            return (
              <div key={n} className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${n < currentStep
                    ? "bg-green-600/20 text-green-400"
                    : n === currentStep
                      ? "bg-primary/20 text-primary border border-primary/50"
                      : "bg-muted text-muted-foreground"
                    }`}
                >
                  {icon}
                </div>
                <span
                  className={`text-xs text-center mt-1 ${n === currentStep ? "text-primary font-medium" : "text-muted-foreground"
                    }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-10">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-foreground font-medium">{statusMessage}</p>
        {extraNote && (
          <p className="text-xs text-muted-foreground mt-2 border-t pt-2 border-primary/20">
            {extraNote}
          </p>
        )}

      </div>


    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION MODAL
// ─────────────────────────────────────────────────────────────────────────────
const NotificationModal = ({
  notifications,
  onDismiss,
  onCloseAll,
  primaryColor,
}: {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onCloseAll: () => void;
  primaryColor: string;
}): JSX.Element => {
  if (notifications.length === 0) return null as any;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-w-md w-full mx-4 bg-card rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="relative p-6 pb-4 text-center">
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}cc)` }}
          />
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <Megaphone className="h-6 w-6" style={{ color: primaryColor }} />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">Announcement</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Important information from the store
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-8 w-8 rounded-full"
            onClick={onCloseAll}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="p-4 rounded-lg border bg-secondary/20"
              style={{ borderColor: `${primaryColor}30` }}
            >
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 mt-0.5 shrink-0" style={{ color: primaryColor }} />
                <p className="text-foreground text-sm flex-1">{notif.message}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 hover:bg-destructive/10"
                  onClick={() => onDismiss(notif.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 pl-8">
                {new Date(notif.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {notifications.length > 1 && (
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={onCloseAll}>
              Dismiss All
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────��─────────────────────────────────────────����─────────────────────────────
// MAIN AGENT STOREFRONT
// ─�����������────────────────────────��──────────────────────────────────────────────────
const AgentStorefront = () => {
  let { storeName: paramStoreName } = useParams<{ storeName: string }>();
  const subdomainStoreName = getStoreNameFromSubdomain(window.location.hostname);
  const storeName = subdomainStoreName || paramStoreName;

  const { toast } = useToast();
  const navigate = useNavigate();

  // Simply render the storefront - subagent dashboard is on its own /subagent-dashboard route

  const [store, setStore] = useState<AgentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [agentPrices, setAgentPrices] = useState<Record<string, number>>({});
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paymentPkg, setPaymentPkg] = useState<DataPackage | null>(null);

  // ── Order tracking ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // ─��� Notifications ──

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  // ���─ Report complaint dialog �������
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportOrder, setReportOrder] = useState<Order | null>(null);
  
  // ── Claim Free Data dialog ──
  const [claimFreeDataOpen, setClaimFreeDataOpen] = useState(false);
  const [freeDataEnabled, setFreeDataEnabled] = useState(true);

  // ── Category ──
  const [activeCategory, setActiveCategory] = useState<
    "data" | "afa" | "vouchers" | "services" | "bulk"
  >("data");
  
  // ── Bulk Orders ──
  const [bulkNetwork, setBulkNetwork] = useState<"mtn" | "telecel" | "airteltigo">("mtn");
  const [bulkRecipients, setBulkRecipients] = useState("");
  const [bulkGlobalSize, setBulkGlobalSize] = useState<number | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);


  // ── AFA Packages ──
  // (Handled by AFABundleSection component)

  // Handle bulk payment callback - show success message after returning from Paystack
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("bulk_payment") === "true" && urlParams.get("reference")) {
      toast({
        title: "Bulk Order Placed Successfully!",
        description: "Your orders have been placed. You can track them using the Track Order section above.",
        duration: 8000,
      });
      // Clear URL params without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  // ── Default theme ──
  const defaultTheme = {
    primary: "#a78bfa",
    primary_foreground: "#ffffff",
    background: "#0f0f0f",
    card_background: "linear-gradient(135deg, #2d1b69 0%, #1a0a3e 100%)",
    gridColumns: 2,
    gb_text_color: "#ffffff",
    price_text_color: "#ffffff",
    button_text_color: "#ffffff",
    button_bg_color: "rgba(255,255,255,0.1)",
    button_border_color: "rgba(255,255,255,0.2)",
  };

  const theme = store?.theme_config || defaultTheme;
  const gridColumns = theme.gridColumns || 2;
  const primaryColor = theme.primary || defaultTheme.primary;
  const primaryForeground = theme.primary_foreground || defaultTheme.primary_foreground;
  const backgroundColor = theme.background || defaultTheme.background;
  const cardBackground = theme.card_background || defaultTheme.card_background;
  const gbTextColor = theme.gb_text_color || defaultTheme.gb_text_color;
  const priceTextColor = theme.price_text_color || defaultTheme.price_text_color;
  const buttonTextColor = theme.button_text_color || defaultTheme.button_text_color;
  const buttonBgColor = theme.button_bg_color || defaultTheme.button_bg_color;
  const buttonBorderColor = theme.button_border_color || defaultTheme.button_border_color;

  const fetchingRef = useRef(false);

  // ── WhatsApp text auto-hide after 4 seconds ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGroupTooltip(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // ── Price refresh ──
  const refreshPrices = useCallback(async () => {
    if (!store?.id || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from("agent_package_prices")
        .select("package_id, sell_price")
        .eq("agent_store_id", store.id);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((p: any) => { map[p.package_id] = p.sell_price; });
      setAgentPrices(map);
    } catch (err: any) {
      console.error("[PRICE REFRESH] Error:", err.message);
    } finally {
      fetchingRef.current = false;
    }
  }, [store?.id]);

  // ── Initial data fetch ──
  useEffect(() => {
    const fetchStore = async () => {
      if (!storeName) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Fetch ALL agent and subagent stores via pagination (bypasses the 1000-row cap)
      const [agentStores, subagentStores] = await Promise.all([
        fetchAllStores(supabase, "agent_stores"),
        fetchAllStores(supabase, "subagent_stores", "*, agent_stores(store_name)"),
      ]);

      // Try to find match in agent stores first
      let matched = findStoreByName(storeName, agentStores);

      // If no agent store match, try subagent stores (works on any domain)
      if (!matched) {
        matched = findStoreByName(storeName, subagentStores);

        if (matched) {
          // For subagent stores, fetch prices from subagent_package_prices or use parent agent's prices
          matched.theme_config = { ...defaultTheme, ...(matched.theme_config || {}) };
          matched.show_whatsapp_group_icon = matched.show_whatsapp_group_icon ?? false;
          matched.is_subagent_store = true;
          setStore(matched);

          const [pkgRes, subagentPriceRes, agentPriceRes] = await Promise.all([
            supabase
          .from("data_packages")
          .select("*")
          .order("size_gb"),
            supabase
              .from("subagent_package_prices")
              .select("package_id, sell_price")
              .eq("subagent_store_id", matched.id),
            supabase
              .from("agent_package_prices")
              .select("package_id, sell_price")
              .eq("agent_store_id", matched.agent_store_id),
          ]);
          setPackages(pkgRes.data ?? []);

          // Use subagent prices if available, otherwise fall back to agent prices
          const priceMap: Record<string, number> = {};
          (agentPriceRes.data ?? []).forEach((p: any) => {
            priceMap[p.package_id] = p.sell_price;
          });
          (subagentPriceRes.data ?? []).forEach((p: any) => {
            priceMap[p.package_id] = p.sell_price;
          });
          setAgentPrices(priceMap);
          setLoading(false);
          return;
        }
      }

      if (!matched) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      matched.theme_config = { ...defaultTheme, ...(matched.theme_config || {}) };
      matched.show_whatsapp_group_icon = matched.show_whatsapp_group_icon ?? false;
      setStore(matched);

      const [pkgRes, priceRes, appSettingsRes] = await Promise.all([
        supabase.from("data_packages").select("*").order("size_gb"),
        supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", matched.id),
        supabase.from("app_settings").select("free_data_enabled").eq("id", 1).single(),
      ]);
      setPackages(pkgRes.data ?? []);
      const priceMap: Record<string, number> = {};
      (priceRes.data ?? []).forEach((p: any) => { priceMap[p.package_id] = p.sell_price; });
      setAgentPrices(priceMap);
      if (appSettingsRes.data) setFreeDataEnabled(appSettingsRes.data.free_data_enabled ?? true);
      setLoading(false);
    };
    fetchStore();
  }, [storeName, subdomainStoreName]);

  // ── Update page metadata when store loads ──
  useEffect(() => {
    if (store?.store_name) {
      updatePageMetadata(store.store_name);
    }
  }, [store?.store_name]);
  useEffect(() => {
    if (!store?.id) return;
    refreshPrices();
    const interval = setInterval(refreshPrices, 15_000);
    return () => clearInterval(interval);
  }, [store?.id, refreshPrices]);

  useEffect(() => {
    if (!store?.id) return;
    const channel = supabase
      .channel(`prices-${store.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_package_prices", filter: `agent_store_id=eq.${store.id}` },
        () => refreshPrices()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store?.id, refreshPrices]);

  // ── Real-time store settings updates (spin wheel, theme, etc.) ──
  useEffect(() => {
    if (!store?.id) return;
    const isSubagent = !!(store as any).is_subagent_store;
    const tableName = isSubagent ? "subagent_stores" : "agent_stores";
    
    const storeChannel = supabase
      .channel(`store-settings-${store.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: tableName, filter: `id=eq.${store.id}` },
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
    
    return () => { supabase.removeChannel(storeChannel); };
  }, [store?.id]);

  // ── Real-time order status updates for MTN orders ──
  useEffect(() => {
    if (!store?.id) return;
    
    const ordersChannel = supabase
      .channel(`orders-${store.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `agent_store_id=eq.${store.id}` },
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

  // ── Notifications ──
  const fetchNotifications = useCallback(async () => {
    if (!store?.id) return;
    const now = new Date().toISOString();
    const { data, error } = await (supabase
      .from("agent_notifications" as any)
      .select("id, message, created_at")
      .eq("agent_store_id", store.id)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })) as any;
    if (!error && data) {
      const active = data as Notification[];
      setNotifications(active);
      const undismissed = active.filter((n) => !dismissedIds.includes(n.id));
      if (undismissed.length > 0 && !modalOpen) setModalOpen(true);
    }
  }, [store?.id, dismissedIds, modalOpen]);

  useEffect(() => { if (store?.id) fetchNotifications(); }, [store?.id, fetchNotifications]);


  const dismissNotification = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem(`dismissed_notifications_${store?.id}`, JSON.stringify(next));
    if (notifications.filter((n) => !next.includes(n.id)).length === 0) setModalOpen(false);
  };

  const closeAllNotifications = () => {
    const allIds = notifications.map((n) => n.id);
    const next = [...dismissedIds, ...allIds];
    setDismissedIds(next);
    localStorage.setItem(`dismissed_notifications_${store?.id}`, JSON.stringify(next));
    setModalOpen(false);
  };

  const undismissedNotifications = notifications.filter((n) => !dismissedIds.includes(n.id));

  // ── Order search ──
  // Phone numbers are stripped of ALL spaces before comparing so
  // "059 944 9202", "05 99 44 92 02", "0599449202" all match the same record.
  const searchOrders = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchPerformed(true);

    // Remove every space the user may have typed
    const raw = searchQuery.trim();
    const noSpaces = stripSpaces(raw);

    let query = supabase
      .from("orders")
      .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, order_status, created_at, package_id");

    // If it looks like a UUID, search by ID directly
    if (noSpaces.length === 36 && raw.includes("-")) {
      query = query.eq("id", raw);
    } else {
      // Search for the stripped number inside stored customer_number
      // (stored numbers should also be stripped of spaces, but ilike handles it)
      query = query.ilike("customer_number", `%${noSpaces}%`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      // For mtn_mashup and mashup orders, fetch size_gb_text and data_package_id from data_packages
      const enrichedOrders = await Promise.all(data.map(async (order: any) => {
        if ((order.network === "mtn_mashup" || order.network === "mashup") && order.package_id) {
          const { data: pkg } = await supabase.from("data_packages").select("size_gb_text, data_package_id").eq("id", order.package_id).single();
          return { ...order, size_gb_text: pkg?.size_gb_text, data_package_id: pkg?.data_package_id };
        }
        return order;
      }));
      setOrders(enrichedOrders as Order[]);
    } else {
      setOrders([]);
      if (error) console.error("Order search error:", error);
    }
    setSearching(false);
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setOrders([]);
    setSearchPerformed(false);
  };

  // ── Render helpers ──
  const filteredPackages = packages.filter((p) => {
    if (networkFilter === "airteltigo") {
      return p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
    }
    return p.network === networkFilter;
  });
  const getPrice = (pkg: DataPackage) => agentPrices[pkg.id] ?? pkg.price;
  const selectedPaymentPrice = paymentPkg ? getPrice(paymentPkg) : 0;

  const displayWhatsApp = store ? formatDisplayPhone(store.whatsapp_number) : "";
  const whatsappLink = store ? `https://wa.me/${getInternationalDigits(store.whatsapp_number)}` : "#";
  const groupLink =
    store?.show_whatsapp_group_icon && store?.whatsapp_group ? store.whatsapp_group : null;

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

  const getGbFontSize = () => {
    if (gridColumns >= 5) return "text-xl sm:text-2xl";
    if (gridColumns >= 3) return "text-2xl sm:text-3xl";
    return "text-3xl sm:text-4xl";
  };
  const getPriceFontSize = () => {
    if (gridColumns >= 5) return "text-sm sm:text-base";
    if (gridColumns >= 3) return "text-base sm:text-lg";
    return "text-lg sm:text-xl";
  };
  const getButtonSize = () => (gridColumns >= 4 ? "xs" : "sm");
  const getPadding = () => {
    if (gridColumns >= 5) return "p-2 sm:p-3";
    if (gridColumns >= 3) return "p-3";
    return "p-4";
  };

  const renderComingSoon = () => (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-6">
        <Rocket className="h-12 w-12 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Coming Soon!</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        We're working hard to bring you this feature. Stay tuned for exciting updates!
      </p>
    </div>
  );

  // ── Early returns ──
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Zap className="h-10 w-10 text-primary animate-pulse" />
      </div>
    );
  if (notFound || !store)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="font-display text-2xl font-bold">Store Not Found</h1>
        </div>
      </div>
    );

  // ── JSX ──
  return (
    <div
      className="min-h-screen relative"
      style={{ backgroundColor: backgroundColor } as React.CSSProperties}
    >
      {/* Notification modal */}
      {modalOpen && undismissedNotifications.length > 0 && (
        <NotificationModal
          notifications={undismissedNotifications}
          onDismiss={dismissNotification}
          onCloseAll={closeAllNotifications}
          primaryColor={primaryColor}
        />
      )}

      {/* Header */}
      <header className="border-b border-border bg-background/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
            >
              <Zap className="h-5 w-5" style={{ color: primaryForeground }} />
            </div>
            <span className="font-display text-lg font-bold">{store.store_name}</span>
          </div>
          <div className="flex items-center gap-2">
            {groupLink && (
              <Button variant="ghost" size="icon" asChild>
                <a href={groupLink} target="_blank" rel="noopener noreferrer" title="Join WhatsApp Group">
                  <Users className="h-5 w-5" style={{ color: primaryColor }} />
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${store.support_number}`}>
                <Phone className="h-4 w-4 mr-1" /> Call
              </a>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <img
                  src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg"
                  alt="WhatsApp"
                  className="h-4 w-4 mr-1"
                  style={{ filter: "invert(1)" }}
                />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Store URL Banner - Redesigned for better appeal */}
      {store && (
        <div className="relative px-4 py-6 overflow-hidden">
          <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(135deg, ${primaryColor}30, ${primaryColor}10)` }} />
          <div className="container mx-auto max-w-3xl relative z-10">
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
                    {DOMAINS.getAgentStoreUrl(store.store_name).replace('https://', '')}
                  </code>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  <Button 
                    size="sm" 
                    className="flex-1 sm:flex-auto rounded-lg font-semibold"
                    style={{ backgroundColor: primaryColor, color: primaryForeground }}
                    onClick={() => {
                      const url = DOMAINS.getAgentStoreUrl(store.store_name);
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
                      const url = DOMAINS.getAgentStoreUrl(store.store_name);
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

      {/* Hero */}
      {/* Category tabs */}
      <div className="container pb-8">
        <div className="flex flex-wrap justify-center gap-3 items-center">
          {(["data", "afa", "vouchers", "services", "bulk"] as const).map((cat) => {
            const icons: Record<string, React.ReactNode> = {
              data: <Wifi className="h-4 w-4 mr-2" />,
              afa: <Package className="h-4 w-4 mr-2" />,
              vouchers: <CheckCircle className="h-4 w-4 mr-2" />,
              services: <Rocket className="h-4 w-4 mr-2" />,
              bulk: <Layers className="h-4 w-4 mr-2" />,
            };
            const labels: Record<string, string> = {
              data: "Data",
              afa: "AFA Bundles",
              vouchers: "Instant Data",
              services: "Services",
              bulk: "Bulk Orders",
            };
            return (
              <Button
                key={cat}
                variant={activeCategory === cat ? "hero" : "outline"}
                onClick={() => setActiveCategory(cat)}
                className="font-semibold"
              >
                {icons[cat]}
                {labels[cat]}
              </Button>
            );
          })}
          {store?.allow_subagent_registration !== false && (
            <>
              <div className="h-6 w-px bg-border"></div>
              <Button
                variant="outline"
                onClick={() => navigate("/become-agent")}
                className="font-semibold"
              >
                Become an Agent
              </Button>
            </>
          )}
        </div>
      </div>

      {activeCategory === "data" ? (
        <>
          {/* ── Order Tracking ── */}
          <div className="container pb-10">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                  <div className="flex-1">
                    <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2 mb-2">
                      <Package className="h-5 w-5 text-primary" /> Track Your Order
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Enter your phone number  or order ID to check your
                      purchase status.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="flex-1 min-w-[200px]">
                      <Input
                        placeholder="Phone number or Order ID"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchOrders()}
                        className="bg-background"
                      />
                    </div>
                    <Button variant="hero" onClick={searchOrders} disabled={searching}>
                      {searching ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      ) : (
                        <Search className="h-4 w-4 mr-1" />
                      )}
                      Search
                    </Button>
                    {searchPerformed && (
                      <Button variant="outline" onClick={clearSearch} disabled={searching}>
                        <X className="h-4 w-4 mr-1" /> Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Results */}
                <div className="mt-6">
                  {searching ? (
                    <div className="text-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-3" />
                      <p className="text-muted-foreground">Searching for your order…</p>
                    </div>
                  ) : orders.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-3">
                        Found {orders.length} order(s):
                      </p>
                      <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
                        {orders.map((order) => (
                          <div
                            key={order.id}
                            className="flex flex-col p-4 border border-border rounded-lg bg-background/50 hover:bg-background transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {order.id.slice(0, 8)}…
                                  </Badge>
                                  <span className="text-sm font-medium text-foreground">
                                    {order.customer_number}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="uppercase text-muted-foreground">
                                    {order.network}
                                  </span>
                                  <span className="font-display font-bold">{(order as any).size_gb_text || order.size_gb + "GB"}</span>
                                  <span className="text-primary">
                                    GHC {Number(order.amount).toFixed(2)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(order.created_at).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const displayStatus = normalizeOrderStatus(order);
                                  return (
                                    <>
                                      {getStatusIcon(displayStatus)}
                                      <Badge
                                        className={
                                          displayStatus === "refunded"
                                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                            : displayStatus === "delivered"
                                              ? "bg-green-600/20 text-green-400 border-green-600/30"
                                              : displayStatus === "pending" || displayStatus === "in-queue" || displayStatus === "waiting"
                                                ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                                                : "bg-blue-600/20 text-blue-400 border-blue-600/30"
                                        }
                                      >
                                        {displayStatus === "delivered" ? "Delivered" : orderStatusLabel(order)}
                                      </Badge>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="pt-3">
                              <OrderTrackingCard
                                order={order}
                                store={store}
                                toast={toast}
                                onReportClick={(o) => {
                                  setReportOrder(o);
                                  setReportDialogOpen(true);
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : searchPerformed ? (
                    <div className="text-center py-8 border border-border rounded-lg bg-background/50">
                      <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        No orders found for "{searchQuery}".
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Check the contact well, or check your order ID.
                      </p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Network filter ── */}
          <div className="container pb-6">
            <div className="flex gap-2 justify-center flex-wrap">
              {["mtn", "mtn_express", "airteltigo", "telecel"].map((net) => (
                <Button
                  key={net}
                  variant={networkFilter === net ? "default" : "outline"}
                  size="sm"
                  className="text-xs sm:text-sm"
                  style={networkFilter === net && net === "mtn" ? { background: "#fbbf24", color: "#000" } :
                         networkFilter === net && net === "mtn_express" ? { background: "#f59e0b", color: "#000" } :
                         networkFilter === net && net === "telecel" ? { background: "#ef4444", color: "#fff" } :
                         networkFilter === net && net === "airteltigo" ? { background: "#3b82f6", color: "#fff" } : {}}
                  onClick={() => setNetworkFilter(net)}
                >
                  {net === "mtn" ? "MTN" : net === "mtn_express" ? "MTN Express" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
                </Button>
              ))}
            </div>
          </div>

          {/* USSD Info Banner */}
          {store?.show_ussd_on_storefront !== false && store?.topup_reference && (
            <div className="container pb-4">
              <a href="tel:*380*455#" className="block p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
                <div className="flex items-center justify-center gap-3 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-5 w-5" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Buy data via USSD - No internet needed!</p>
                    <p className="text-xl font-bold font-mono" style={{ color: primaryColor }}>*380*455#</p>
                    <p className="text-xs text-muted-foreground">Access Code: <span className="font-mono font-bold text-foreground">{store.topup_reference}</span></p>
                  </div>
                </div>
              </a>
            </div>
          )}

          {/* Packages grid */}
          <div className="container pb-20">
            <div
              className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, 300px), 1fr))` }}
            >
              {loading ? (
                <div className="col-span-full flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground mb-4">No packages available for this network.</p>
                  <p className="text-sm text-muted-foreground">Check back later or try a different network.</p>
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
                      className={`relative overflow-hidden border-0 shadow-lg transition-all duration-300 group w-full ${isInactive ? "opacity-50 grayscale" : "hover:shadow-xl"}`}
                      style={isMTNMashup ? { background: "linear-gradient(135deg,#FFA500 0%,#FF8C00 100%)" } : { background: cardBackground }}
                    >
                      {isMTNMashup ? (
                        <>
                          <CardContent className="p-6 text-center space-y-4">
                            {(isInactive || isOffline) && (
                              <PackageStatusIndicator status={isOffline ? "offline" : "not_available"} />
                            )}
                            <div className="relative bg-white/20 rounded-lg p-3 mb-3">
                              {showExpress && <div className="absolute top-1 right-1 bg-yellow-400 text-black px-2 py-1 rounded text-xs font-bold">Express</div>}
                              <p className="font-semibold text-base text-white">Special MTN Mashup</p>
                              <p className="text-xs opacity-90 text-white">Data Bundle</p>
                            </div>
                            <p className="text-4xl md:text-5xl font-bold text-white">{pkg.size_gb_text}</p>
                            <p className="text-base font-medium text-white">GHC {Number(price).toFixed(2)} - Valid forever</p>
                            <div className="space-y-2 text-sm text-white">
                              <div className="flex items-center justify-center gap-2"><Check className="h-4 w-4" />No SMS is sent for data delivery. Check your balance before purchasing.</div>
                            </div>
                            <Button variant="secondary" size="lg" className="w-full font-semibold bg-orange-700 hover:bg-orange-800 text-white border-0" onClick={() => setPaymentPkg(pkg)}>Buy Now</Button>
                          </CardContent>
                        </>
                      ) : (
                        <>
                          <CardContent className={`${getPadding()} text-center space-y-1 sm:space-y-2 w-full`}>
                            {(isInactive || isOffline) && (
                              <PackageStatusIndicator status={isOffline ? "offline" : "not_available"} />
                            )}
                            <p
                              className={`${getGbFontSize()} font-bold break-words`}
                              style={{ color: gbTextColor }}
                            >
                              {pkg.size_gb}GB
                            </p>
                            <p
                              className="text-xs sm:text-sm font-semibold uppercase tracking-wide break-words"
                              style={{ color: getNetworkLabelColor(networkFilter) }}
                            >
                              {formatNetworkName(networkFilter)}
                            </p>
                            <p
                              className={`${getPriceFontSize()} font-bold break-words`}
                              style={{ color: priceTextColor }}
                            >
                              GHC{Number(price).toFixed(2)}
                            </p>
                            <Button
                              variant="secondary"
                              size={getButtonSize() === "xs" ? "sm" : (getButtonSize() as any)}
                              disabled={isInactive}
                              className="w-full mt-2 font-medium text-xs sm:text-sm whitespace-nowrap disabled:opacity-100 disabled:cursor-not-allowed"
                              style={isInactive ? {
                                backgroundColor: "transparent",
                                color: "inherit",
                                borderColor: buttonBorderColor,
                                borderWidth: "1px",
                                borderStyle: "solid",
                              } : {
                                backgroundColor: buttonBgColor,
                                color: buttonTextColor,
                                borderColor: buttonBorderColor,
                                borderWidth: "1px",
                                borderStyle: "solid",
                              }}
                              onClick={() => !isInactive && setPaymentPkg(pkg)}
                            >
                              {isInactive ? "Not Available" : "Buy Now"}
                            </Button>
                          </CardContent>
                        </>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : activeCategory === "bulk" ? (
        <div className="container pb-20">
          <Card className="border-primary/30 bg-primary/5 max-w-3xl mx-auto">
            <CardContent className="p-6 space-y-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
                  <Layers className="h-8 w-8" style={{ color: primaryColor }} />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Bulk Orders</h2>
                <p className="text-muted-foreground">Send data to multiple recipients at once via Paystack</p>
              </div>

              {/* Step 1: Select Network */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold" style={{ backgroundColor: primaryColor, color: primaryForeground }}>1</span>
                  <span className="font-semibold text-lg">SELECT NETWORK</span>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <Button variant={bulkNetwork === "mtn" ? "default" : "outline"} className={`px-8 py-6 text-lg font-bold ${bulkNetwork === "mtn" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}`} onClick={() => setBulkNetwork("mtn")}>MTN</Button>
                  <Button variant={bulkNetwork === "telecel" ? "default" : "outline"} className={`px-8 py-6 text-lg font-bold ${bulkNetwork === "telecel" ? "bg-red-600 hover:bg-red-700" : ""}`} onClick={() => setBulkNetwork("telecel")}>Telecel</Button>
                  <Button variant={bulkNetwork === "airteltigo" ? "default" : "outline"} className={`px-8 py-6 text-lg font-bold ${bulkNetwork === "airteltigo" ? "bg-blue-600 hover:bg-blue-700" : ""}`} onClick={() => setBulkNetwork("airteltigo")}>AirtelTigo</Button>
                </div>
              </div>

              {/* Step 2: Recipients */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold" style={{ backgroundColor: primaryColor, color: primaryForeground }}>2</span>
                  <span className="font-semibold text-lg">RECIPIENTS</span>
                </div>
                
                {/* CSV Upload */}
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => bulkFileInputRef.current?.click()}>
                  <input ref={bulkFileInputRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const text = evt.target?.result as string;
                      const lines = text.split("\n").filter(l => l.trim()).map(l => {
                        const parts = l.split(/[,\t]/).map(p => p.trim());
                        return `${parts[0]} ${parts[1] || ""}`.trim();
                      }).join("\n");
                      setBulkRecipients(lines);
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }} />
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="font-semibold">Upload CSV / Excel / Text file</p>
                  <p className="text-sm text-muted-foreground">Column A: phone - Column B: GB size (optional)</p>
                </div>

                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-sm text-muted-foreground">or type manually</span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>

                {/* Manual Input */}
                <textarea
                  placeholder={`0241234567 2\n0551234567 5\n0591234567 10`}
                  value={bulkRecipients}
                  onChange={(e) => setBulkRecipients(e.target.value)}
                  rows={8}
                  className="w-full font-mono text-sm bg-secondary/50 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />

                {/* Format Guide */}
                <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}50`, borderWidth: 1 }}>
                  <p className="font-semibold" style={{ color: primaryColor }}>Format: 0241234567 2 (phone then GB size per line)</p>
                  <p className="text-sm text-muted-foreground">Or use the global package below if all numbers get the same bundle.</p>
                  <p className="text-xs text-muted-foreground">
                    Valid prefixes: {bulkNetwork === "mtn" ? "024, 025, 053, 054, 055, 059" : bulkNetwork === "telecel" ? "020, 050" : "026, 027, 056, 057"}
                  </p>
                </div>
              </div>

              {/* Step 3: Global Package (optional) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold" style={{ backgroundColor: primaryColor, color: primaryForeground }}>3</span>
                  <span className="font-semibold text-lg">GLOBAL PACKAGE (Optional)</span>
                </div>
                <p className="text-sm text-muted-foreground">If set, all recipients without a specified GB size will receive this package.</p>
                <select
                  value={bulkGlobalSize?.toString() || "none"}
                  onChange={(e) => setBulkGlobalSize(e.target.value === "none" ? null : Number(e.target.value))}
                  className="w-full md:w-64 bg-secondary/50 border border-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="none">None (use per-line sizes)</option>
                  {packages.filter(p => p.network.toLowerCase() === bulkNetwork).map(p => {
                    const price = agentPrices[p.id] ?? p.price;
                    return <option key={p.id} value={p.size_gb.toString()}>{p.size_gb}GB - GHC {price.toFixed(2)}</option>;
                  })}
                </select>
              </div>

              {/* Summary & Actions */}
              <div className="border-t pt-4 space-y-4">
                {(() => {
                  const lines = bulkRecipients.split("\n").filter(l => l.trim());
                  const parsed = lines.map(line => {
                    const parts = line.trim().split(/\s+/);
                    const phone = parts[0]?.replace(/\D/g, "") || "";
                    const size = parts[1] ? Number(parts[1]) : bulkGlobalSize;
                    return { phone, size };
                  }).filter(r => r.phone.length === 10 && r.size && r.size > 0);
                  
                  const totalGb = parsed.reduce((sum, r) => sum + (r.size || 0), 0);
                  const totalCost = parsed.reduce((sum, r) => {
                    const pkg = packages.find(p => p.network.toLowerCase() === bulkNetwork && p.size_gb === r.size);
                    const price = pkg ? (agentPrices[pkg.id] ?? pkg.price) : 0;
                    return sum + price;
                  }, 0);
                  const paystackFee = Math.ceil(totalCost * 0.0198 * 100) / 100;
                  const grandTotal = totalCost + paystackFee;
                  
                  return (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-secondary/50 rounded-lg">
                          <p className="text-2xl font-bold">{parsed.length}</p>
                          <p className="text-xs text-muted-foreground">Valid Recipients</p>
                        </div>
                        <div className="text-center p-3 bg-secondary/50 rounded-lg">
                          <p className="text-2xl font-bold">{totalGb}GB</p>
                          <p className="text-xs text-muted-foreground">Total Data</p>
                        </div>
                        <div className="text-center p-3 bg-secondary/50 rounded-lg">
                          <p className="text-2xl font-bold" style={{ color: primaryColor }}>GHC {totalCost.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Data Cost</p>
                        </div>
                        <div className="text-center p-3 bg-secondary/50 rounded-lg">
                          <p className="text-2xl font-bold text-green-500">GHC {grandTotal.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Total (incl. fees)</p>
                        </div>
                      </div>
                      
                      {paystackFee > 0 && (
                        <p className="text-sm text-muted-foreground text-center">Paystack fee (1.98%): GHC {paystackFee.toFixed(2)}</p>
                      )}
                      
                      <div className="flex gap-3 flex-wrap">
                        <Button
                          variant="hero"
                          className="flex-1"
                          disabled={bulkProcessing || parsed.length === 0}
                          onClick={async () => {
                            if (parsed.length === 0 || !store) return;
                            setBulkProcessing(true);
                            
                            try {
                              const recipients = parsed.map(r => {
                                const pkg = packages.find(p => p.network.toLowerCase() === bulkNetwork && p.size_gb === r.size);
                                const price = pkg ? (agentPrices[pkg.id] ?? pkg.price) : 0;
                                return {
                                  phone: r.phone,
                                  size_gb: r.size,
                                  package_id: pkg?.id,
                                  price: price
                                };
                              });
                              
                              const callbackUrl = window.location.href.split("?")[0] + "?bulk_payment=true";
                              
                              const { data, error } = await supabase.functions.invoke("initialize-payment", {
                                body: {
                                  email: `bulk_${Date.now()}@datapluggh.com`,
                                  amount: grandTotal,
                                  phone: recipients[0]?.phone || "0000000000",
                                  callback_url: callbackUrl,
                                  metadata: {
                                    type: "bulk_order",
                                    network: bulkNetwork,
                                    recipients: recipients,
                                    total_gb: totalGb,
                                    recipient_count: parsed.length,
                                    agent_store_id: store.id
                                  }
                                }
                              });
                              
                              if (error) throw error;
                              if (data?.authorization_url) {
                                window.location.href = data.authorization_url;
                              } else {
                                throw new Error("No payment URL received");
                              }
                            } catch (err: any) {
                              toast({ title: "Payment Error", description: err.message, variant: "destructive" });
                            } finally {
                              setBulkProcessing(false);
                            }
                          }}
                        >
                          {bulkProcessing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : <>Pay with Paystack (GHC {grandTotal.toFixed(2)})</>}
                        </Button>
                        <Button variant="outline" onClick={() => { setBulkRecipients(""); setBulkGlobalSize(null); }}>
                          <RotateCcw className="h-4 w-4 mr-2" /> Clear
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : activeCategory === "afa" ? (
        <div className="w-full pb-20">
          <AFAPackagesDisplay
            agentStoreId={store?.id}
            onRegisterClick={(packageId, packageName, price) => {
              setPaymentPkg({
                id: packageId,
                size_gb: 0,
                price: store?.afa_bundle_price || price,
                network: "mtn",
                callbackUrl: typeof window !== 'undefined' ? window.location.href : '',
                agentStoreId: store?.id
              });
            }}
            themeColor={primaryColor}
          />
        </div>
      ) : (
        <div className="container pb-20">{renderComingSoon()}</div>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card/50">
        <div className="container text-center space-y-3">
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <img
                src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg"
                alt="WhatsApp"
                className="h-4 w-4"
                style={{ filter: "invert(0.5)" }}
              />
              {displayWhatsApp}
            </a>
            <a
              href={`tel:${store.support_number}`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Phone className="h-4 w-4" /> {store.support_number}
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            Powered by{" "}
            <span className="font-display font-bold">
              <span className="text-foreground">ZYTRIX</span>{" "}
              <span style={{ color: primaryColor }}>TECH</span>
            </span>
          </p>
          <p className="text-sm text-muted-foreground pt-2">
            Already an agent?{" "}
            <a 
              href="https://agentsstore.shop/login"
              className="font-semibold hover:underline"
              style={{ color: primaryColor }}
            >
              Login here
            </a>
          </p>
        </div>
      </footer>

      {/* WhatsApp group FAB - Draggable */}
      {groupLink && (
        <DraggableFAB
          initialBottom={freeDataEnabled ? 88 : 24}
          initialRight={24}
          storageKey="whatsapp-group-agent"
          href={groupLink}
          title="Join WhatsApp Group"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20B859] text-white shadow-lg transition-all duration-300 hover:scale-110">
            <img
              src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg"
              alt="WhatsApp"
              className="h-6 w-6"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
        </DraggableFAB>
      )}

      {/* Payment dialog */}
      {paymentPkg && (
        <PaymentDialog
          open={!!paymentPkg}
          onOpenChange={(v) => !v && setPaymentPkg(null)}
          package={paymentPkg}
          network={networkFilter}
          price={Number(selectedPaymentPrice)}
          agentStoreId={store.id}
        />
      )}
      <PaymentVerifier />
      <AFARegistrationSuccess />

      {/* Report Complaint Dialog — lazy-loaded to break circular dep */}
      <Suspense fallback={null}>
        {reportOrder && (
          <ReportComplaintDialog
            open={reportDialogOpen}
            onOpenChange={setReportDialogOpen}
            order={reportOrder}
            complaintType="agent"
            agentStoreId={store?.id}
          />
        )}
      </Suspense>

      {/* Claim Free Data Dialog — lazy-loaded to break circular dep */}
      <Suspense fallback={null}>
        <ClaimFreeDataDialog
          open={claimFreeDataOpen}
          onOpenChange={setClaimFreeDataOpen}
          storeId={store?.id}
        />
      </Suspense>

      {/* Claim Free Data FAB - draggable */}
      {freeDataEnabled && (
        <DraggableFAB
          initialBottom={groupLink ? 88 : 24}
          initialRight={24}
          storageKey="claim-free-data-agent"
          onClick={() => setClaimFreeDataOpen(true)}
          title="Claim Free Data"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white shadow-lg transition-all duration-300 hover:scale-110">
            <Gift className="h-6 w-6" />
          </div>
        </DraggableFAB>
      )}

      {/* Support ChatBot */}
      <ChatBot page="agent-storefront" />
    </div>
  );
};

export default AgentStorefront;
