import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PaymentDialog from "@/components/PaymentDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import { Zap, Phone, Wifi, Shield, Clock, Star, Search, Package, CheckCircle, XCircle, X, Loader2, Check, Copy, Bell, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ============================================================
// INTERFACES
// ============================================================
interface AgentStore {
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
}

interface AgentPrice {
  package_id: string;
  sell_price: number;
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

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const formatNetworkName = (network: string) => {
  if (network === "mtn") return "MTN";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "telecel") return "Telecel";
  return network;
};

const copyToClipboard = async (text: string, toast: any) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Contact information copied to clipboard." });
  } catch (err) {
    toast({ title: "Failed to copy", description: "Please copy manually.", variant: "destructive" });
  }
};

const getStoreNameFromSubdomain = (): string | null => {
  const hostname = window.location.hostname;
  if (hostname.endsWith('.datastores.shop')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) return parts[0].toLowerCase().trim();
  }
  return null;
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

const getNetworkLabelColor = (network: string) => {
  const defaultColors: Record<string, string> = {
    mtn: "#fbbf24",
    airteltigo: "#60a5fa",
    telecel: "#f87171",
  };
  return defaultColors[network] || "#ffffff";
};

// ---------- PHONE FORMATTING HELPERS ----------
const formatDisplayPhone = (phone: string): string => {
  if (!phone) return phone;
  const cleaned = phone.trim();
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('233')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+233' + cleaned.slice(1);
  return cleaned;
};

const getInternationalDigits = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('233')) return cleaned;
  if (cleaned.startsWith('0')) return '233' + cleaned.slice(1);
  return cleaned;
};
// -----------------------------------------------

// ============================================================
// ORDER TRACKING CARD
// ============================================================
const OrderTrackingCard = ({ order, store, toast }: { order: Order; store: AgentStore; toast: any }): JSX.Element => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const orderCreatedAt = new Date(order.created_at);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = currentTime.getTime() - orderCreatedAt.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);

  let currentStep = 1;
  let statusMessage = "";
  let extraNote = null;

  if (elapsedMinutes >= 150) {
    currentStep = 4;
    statusMessage = "Your data bundle has been delivered successfully.";
    if (order.network === "mtn") extraNote = "Please check your MTNUP2U and MTN messages for delivery confirmation.";
    else if (order.network === "airteltigo") extraNote = "Please check your AirtelTigo iShare and BigTime messages for delivery confirmation.";
    else if (order.network === "telecel") extraNote = "Please check your Telecel messages for delivery confirmation.";
    else extraNote = "Please check your messages for delivery confirmation.";
  } else if (elapsedMinutes >= 60) {
    currentStep = 3;
    if (order.network === "mtn") statusMessage = "Please be expecting your data any moment from now. Check your MTN and MTNUP2U messages for delivery confirmation.";
    else if (order.network === "airteltigo") statusMessage = "Please be expecting your data any moment from now. Check your AirtelTigo iShare or BigTime messages for delivery confirmation.";
    else if (order.network === "telecel") statusMessage = "Please be expecting your data any moment from now. Check your Telecel messages for delivery confirmation.";
    else statusMessage = "Please be expecting your data any moment from now. Check your messages for delivery confirmation.";
    extraNote = "The order has left our system and is now with the network you bought the data from. All delays from now are from them.";
  } else if (elapsedMinutes >= 12) {
    currentStep = 3;
    statusMessage = `Waiting for validation from ${formatNetworkName(order.network)}...`;
    if (elapsedMinutes >= 15) statusMessage = "Your order can be delivered any moment from now. You can ignore the progress steps. Please report only if data is not delivered while it shows 'Delivered'.";
  } else if (elapsedMinutes >= 9) {
    currentStep = 2;
    statusMessage = `Order sent to ${formatNetworkName(order.network)} for validation`;
    extraNote = "Now waiting for validation from the network to deliver your data. All delay now is from the network you bought the data from.";
  } else {
    currentStep = 1;
    statusMessage = "Order being processed...";
  }

  const orderDate = new Date(order.created_at).toLocaleString();
  const contactMessage = `Order from ${orderDate}\nNetwork: ${formatNetworkName(order.network)}\nData: ${order.size_gb}GB\nAmount: GH₵ ${Number(order.amount).toFixed(2)}\nCustomer: ${order.customer_number}\n\nPlease help resolve this issue. Contact: ${store.support_number}`;

  const whatsappNumberDigits = getInternationalDigits(store.whatsapp_number);
  const whatsappMessage = encodeURIComponent(
    `Hello, I am reporting that my order shows as "Delivered" but I have not received the data.\n\nOrder Details:\n- Order Date: ${orderDate}\n- Network: ${formatNetworkName(order.network)}\n- Data: ${order.size_gb}GB\n- Amount: GH₵ ${Number(order.amount).toFixed(2)}\n- Customer Number: ${order.customer_number}\n- Order Status: ${order.status} / ${order.fulfillment_status}\n- Order ID: ${order.id}\n\nPlease investigate and assist. Thank you.`
  );
  const whatsappLink = `https://wa.me/${whatsappNumberDigits}?text=${whatsappMessage}`;

  const showSupportButton = elapsedMinutes >= 132 && currentStep !== 4;
  const showReportButton = currentStep === 4 && elapsedMinutes >= 150 && elapsedMinutes < 3030;

  if (currentStep === 4) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Delivery Status</span>
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            <CheckCircle className="h-3 w-3 mr-1" /> Delivered
          </Badge>
        </div>
        <div className="relative">
          <div className="flex items-center justify-between">
            {["Order Placed", "Sent to Network", "Network Validation", "Delivered"].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center flex-1">
                <div className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-xs text-center mt-1 text-muted-foreground">{step}</span>
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
        {showReportButton && (
          <Button variant="outline" size="sm" className="w-full border-yellow-600/50 text-yellow-600 hover:bg-yellow-600/10" asChild>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg" alt="WhatsApp" className="h-4 w-4 mr-2" style={{ filter: 'invert(1)' }} />
              Only Report: if it shows Delivered <br />here
              but you did not received it
            </a>
          </Button>
        )}
      </div>
    );
  }

  const steps = [
    { name: "Order Placed", step: 1 },
    { name: "Sent to Network", step: 2 },
    { name: "Network Validation", step: 3 },
    { name: "Delivered", step: 4 },
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step) => {
            let icon;
            if (step.step < currentStep) icon = <Check className="h-4 w-4 text-green-400" />;
            else if (step.step === currentStep) icon = <Loader2 className="h-4 w-4 text-primary animate-spin" />;
            else icon = <Clock className="h-4 w-4 text-muted-foreground" />;
            return (
              <div key={step.step} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.step < currentStep ? "bg-green-600/20 text-green-400" : step.step === currentStep ? "bg-primary/20 text-primary border border-primary/50" : "bg-muted text-muted-foreground"}`}>
                  {icon}
                </div>
                <span className={`text-xs text-center mt-1 ${step.step === currentStep ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-10">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentStep - 1) / 3) * 100}%` }} />
        </div>
      </div>

      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-foreground font-medium">{statusMessage}</p>
        {extraNote && (
          <p className="text-xs text-muted-foreground mt-2 border-t pt-2 border-primary/20">
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
        <Button variant="outline" size="sm" className="w-full" onClick={() => copyToClipboard(contactMessage, toast)}>
          <Copy className="h-4 w-4 mr-2" />
          Contact Support ({store.support_number})
        </Button>
      )}
    </div>
  );
};

// ============================================================
// NOTIFICATION MODAL
// ============================================================
const NotificationModal = ({ notifications, onDismiss, onCloseAll, primaryColor }: { notifications: Notification[]; onDismiss: (id: string) => void; onCloseAll: () => void; primaryColor: string }): JSX.Element => {
  if (notifications.length === 0) return null as any;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-w-md w-full mx-4 bg-card rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="relative p-6 pb-4 text-center">
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}cc)` }} />
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ backgroundColor: `${primaryColor}20` }}>
            <Megaphone className="h-6 w-6" style={{ color: primaryColor }} />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground">Announcement</h3>
          <p className="text-sm text-muted-foreground mt-1">Important information from the store</p>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-8 w-8 rounded-full" onClick={onCloseAll}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-6 pb-6 space-y-4">
          {notifications.map((notif) => (
            <div key={notif.id} className="p-4 rounded-lg border bg-secondary/20" style={{ borderColor: `${primaryColor}30` }}>
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 mt-0.5 shrink-0" style={{ color: primaryColor }} />
                <p className="text-foreground text-sm flex-1">{notif.message}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:bg-destructive/10" onClick={() => onDismiss(notif.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 pl-8">{new Date(notif.created_at).toLocaleString()}</p>
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

// ============================================================
// MAIN AGENT STOREFRONT COMPONENT
// ============================================================
const AgentStorefront = () => {
  let { storeName: paramStoreName } = useParams<{ storeName: string }>();
  const subdomainStoreName = getStoreNameFromSubdomain();
  const storeName = subdomainStoreName || paramStoreName;

  const { toast } = useToast();
  const [store, setStore] = useState<AgentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [agentPrices, setAgentPrices] = useState<Record<string, number>>({});
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paymentPkg, setPaymentPkg] = useState<DataPackage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [showGroupTooltip, setShowGroupTooltip] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

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

  useEffect(() => { const timer = setTimeout(() => setShowGroupTooltip(false), 9000); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (store?.id) { const stored = localStorage.getItem(`dismissed_notifications_${store.id}`); if (stored) setDismissedIds(JSON.parse(stored)); } }, [store?.id]);

  useEffect(() => {
    if (!store?.id) return;
    const fetchRecent = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, created_at")
        .eq("agent_store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setOrders(data as Order[]);
    };
    fetchRecent();
  }, [store?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!store?.id) return;
    const now = new Date().toISOString();
    const { data, error } = await (supabase
      .from('agent_notifications' as any)
      .select('id, message, created_at')
      .eq('agent_store_id', store.id)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })) as any;
    if (!error && data) {
      const active = data as Notification[];
      setNotifications(active);
      const undismissed = active.filter(n => !dismissedIds.includes(n.id));
      if (undismissed.length > 0 && !modalOpen) setModalOpen(true);
    }
  }, [store?.id, dismissedIds, modalOpen]);

  useEffect(() => { if (store?.id) fetchNotifications(); }, [store?.id, fetchNotifications]);

  const dismissNotification = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem(`dismissed_notifications_${store?.id}`, JSON.stringify(newDismissed));
    const remaining = notifications.filter(n => !newDismissed.includes(n.id));
    if (remaining.length === 0) setModalOpen(false);
  };

  const closeAllNotifications = () => {
    const allIds = notifications.map(n => n.id);
    const newDismissed = [...dismissedIds, ...allIds];
    setDismissedIds(newDismissed);
    localStorage.setItem(`dismissed_notifications_${store?.id}`, JSON.stringify(newDismissed));
    setModalOpen(false);
  };

  const undismissedNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  const searchOrders = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchPerformed(true);
    const trimmedQuery = searchQuery.trim();
    let query = supabase
      .from("orders")
      .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, created_at");

    if (trimmedQuery.length === 36 && trimmedQuery.includes("-")) {
      query = query.eq("id", trimmedQuery);
    } else {
      query = query.ilike("customer_number", `%${trimmedQuery}%`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      setOrders(data as Order[]);
    } else {
      setOrders([]);
      if (error) {
        console.error("Order search error:", error);
        toast({ title: "Search failed", description: error.message, variant: "destructive" });
      }
    }
    setSearching(false);
  }, [searchQuery, toast]);

  const clearSearch = () => {
    setSearchQuery("");
    setOrders([]);
    setSearchPerformed(false);
    if (store?.id) {
      supabase
        .from("orders")
        .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, created_at")
        .eq("agent_store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(5)
        .then(({ data }) => { if (data) setOrders(data as Order[]); });
    }
  };

  useEffect(() => {
    const fetchStore = async () => {
      if (!storeName) { setNotFound(true); setLoading(false); return; }
      const normalized = storeName.toLowerCase().trim();
      const { data: stores } = await supabase.from("agent_stores").select("*").eq("approved", true) as any;
      if (!stores || stores.length === 0) { setNotFound(true); setLoading(false); return; }
      let matched = (stores as any[]).find((s: any) => slugify(s.store_name) === normalized);
      if (!matched) matched = (stores as any[]).find((s: any) => s.store_name.toLowerCase().trim() === normalized);
      if (!matched) matched = (stores as any[]).find((s: any) => slugify(s.store_name).replace(/-/g, '') === normalized.replace(/-/g, ''));
      if (!matched) { setNotFound(true); setLoading(false); return; }
      matched.theme_config = { ...defaultTheme, ...(matched.theme_config || {}) };
      matched.show_whatsapp_group_icon = matched.show_whatsapp_group_icon ?? false;
      setStore(matched);
      const [pkgRes, priceRes] = await Promise.all([
        supabase.from("data_packages").select("id, network, size_gb, price").eq("active", true).order("size_gb"),
        supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", matched.id),
      ]);
      setPackages(pkgRes.data ?? []);
      const priceMap: Record<string, number> = {};
      (priceRes.data ?? []).forEach((p: AgentPrice) => { priceMap[p.package_id] = p.sell_price; });
      setAgentPrices(priceMap);
      setLoading(false);
    };
    fetchStore();
  }, [storeName]);

  const filteredPackages = packages.filter((p) => p.network === networkFilter);
  const getPrice = (pkg: DataPackage) => agentPrices[pkg.id] ?? pkg.price;
  const selectedPaymentPrice = paymentPkg ? getPrice(paymentPkg) : 0;

  const displayWhatsApp = store ? formatDisplayPhone(store.whatsapp_number) : "";
  const whatsappLink = store ? `https://wa.me/${getInternationalDigits(store.whatsapp_number)}` : "#";
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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Zap className="h-10 w-10 text-primary animate-pulse" /></div>;
  if (notFound || !store) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><Zap className="h-12 w-12 text-muted-foreground mx-auto" /><h1 className="font-display text-2xl font-bold">Store Not Found</h1></div></div>;

  const { theme_config } = store;
  const primaryColor = theme_config?.primary || defaultTheme.primary;
  const primaryForeground = theme_config?.primary_foreground || defaultTheme.primary_foreground;
  const backgroundColor = theme_config?.background || defaultTheme.background;
  const cardBackground = theme_config?.card_background || defaultTheme.card_background;
  const gbTextColor = theme_config?.gb_text_color || defaultTheme.gb_text_color;
  const priceTextColor = theme_config?.price_text_color || defaultTheme.price_text_color;
  const buttonTextColor = theme_config?.button_text_color || defaultTheme.button_text_color;
  const buttonBgColor = theme_config?.button_bg_color || defaultTheme.button_bg_color;
  const buttonBorderColor = theme_config?.button_border_color || defaultTheme.button_border_color;

  const getGbFontSize = () => { if (gridColumns >= 5) return "text-xl sm:text-2xl"; if (gridColumns >= 3) return "text-2xl sm:text-3xl"; return "text-3xl sm:text-4xl"; };
  const getPriceFontSize = () => { if (gridColumns >= 5) return "text-sm sm:text-base"; if (gridColumns >= 3) return "text-base sm:text-lg"; return "text-lg sm:text-xl"; };
  const getButtonSize = () => { return gridColumns >= 4 ? "xs" : "sm"; };
  const getPadding = () => { if (gridColumns >= 5) return "p-2 sm:p-3"; if (gridColumns >= 3) return "p-3"; return "p-4"; };

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: backgroundColor } as React.CSSProperties}>
      {modalOpen && undismissedNotifications.length > 0 && (
        <NotificationModal notifications={undismissedNotifications} onDismiss={dismissNotification} onCloseAll={closeAllNotifications} primaryColor={primaryColor} />
      )}

      <header className="border-b border-border bg-background/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
              <Zap className="h-5 w-5" style={{ color: primaryForeground }} />
            </div>
            <span className="font-display text-lg font-bold">{store.store_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild><a href={`tel:${store.support_number}`}><Phone className="h-4 w-4 mr-1" /> Call</a></Button>
            <Button variant="hero" size="sm" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg" alt="WhatsApp" className="h-4 w-4 mr-1" style={{ filter: 'invert(1)' }} />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden py-16 md:py-20">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}05)` }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px]" style={{ background: `${primaryColor}30` }} />
        <div className="container relative text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium" style={{ borderColor: `${primaryColor}50`, background: `${primaryColor}10`, color: primaryColor }}>
            <Wifi className="h-4 w-4" /> Fast & Reliable Data Delivery
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
            Cheap Data Bundles<br /><span style={{ color: primaryColor }}>Instant Delivery</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-lg">
            Get the best data deals from <span className="text-foreground font-semibold">{store.store_name}</span>. Select your network and package below.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground pt-2">
            <span className="flex items-center gap-2"><Shield className="h-4 w-4" style={{ color: primaryColor }} /> Trusted Seller</span>
            <span className="flex items-center gap-2"><Clock className="h-4 w-4" style={{ color: primaryColor }} /> &lt;60min Delivery</span>
            <span className="flex items-center gap-2"><Star className="h-4 w-4" style={{ color: primaryColor }} /> 24/7 Support</span>
          </div>
        </div>
      </section>

      {/* Order Tracking Section */}
      <div className="container pb-10">
        <Card className="border" style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}08` }}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="flex-1">
                <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5" style={{ color: primaryColor }} />
                  Track Your Order
                </h2>
                <p className="text-sm text-muted-foreground">Enter your phone number or order ID to check the status of your purchase.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="flex-1 min-w-[200px]">
                  <Input placeholder="Phone number or Order ID" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchOrders()} className="bg-background" />
                </div>
                <Button variant="hero" onClick={searchOrders} disabled={searching}>
                  {searching ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Search className="h-4 w-4 mr-1" />}
                  Search
                </Button>
                {searchPerformed && (
                  <Button variant="outline" onClick={clearSearch} disabled={searching}><X className="h-4 w-4 mr-1" /> Clear</Button>
                )}
              </div>
            </div>

            <div className="mt-6">
              {orders.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-foreground">{searchPerformed ? `Found ${orders.length} order(s)` : "Recent orders"}:</p>
                  <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="flex flex-col p-4 border border-border rounded-lg bg-background/50 hover:bg-background transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-xs">{order.id.slice(0, 8)}...</Badge>
                              <span className="text-sm font-medium text-foreground">{order.customer_number}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="uppercase text-muted-foreground">{order.network}</span>
                              <span className="font-display font-bold">{order.size_gb}GB</span>
                              <span className="text-primary">GH₵ {Number(order.amount).toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(order.status)}
                            <Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30" : order.status === "pending" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" : "bg-red-600/20 text-red-400 border-red-600/30"}>
                              {getStatusText(order.status)}
                            </Badge>
                          </div>
                        </div>
                        <div className="pt-3">
                          <OrderTrackingCard order={order} store={store} toast={toast} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searching ? (
                <div className="text-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-3" />
                  <p className="text-muted-foreground">Searching for your order...</p>
                </div>
              ) : searchPerformed ? (
                <div className="text-center py-8 border border-border rounded-lg bg-background/50">
                  <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No orders found for "{searchQuery}".</p>
                  <p className="text-xs text-muted-foreground mt-1">Please check your phone number or order ID and try again.</p>
                </div>
              ) : (
                <div className="text-center py-8 border border-border rounded-lg bg-background/50">
                  <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No orders yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Once a customer places an order, it will appear here automatically.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Filter Buttons */}
      <div className="container pb-6">
        <div className="flex gap-2 justify-center">
          {["mtn", "airteltigo", "telecel"].map((net) => (
            <Button key={net} variant={networkFilter === net ? "hero" : "outline"} size="sm" className="min-w-[100px]" onClick={() => setNetworkFilter(net)}
              style={networkFilter === net ? { backgroundColor: primaryColor, color: primaryForeground } : {}}>
              {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
            </Button>
          ))}
        </div>
      </div>

      {/* Packages Grid */}
      <div className="container pb-20">
        <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}>
          {filteredPackages.map((pkg) => {
            const price = getPrice(pkg);
            const networkLabelColor = getNetworkLabelColor(networkFilter);
            const gbFontClass = getGbFontSize();
            const priceFontClass = getPriceFontSize();
            const buttonSize = getButtonSize();
            const paddingClass = getPadding();
            return (
              <Card key={pkg.id} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group w-full" style={{ background: cardBackground }}>
                <CardContent className={`${paddingClass} text-center space-y-1 sm:space-y-2 w-full`}>
                  <p className={`${gbFontClass} font-bold break-words`} style={{ color: gbTextColor }}>{pkg.size_gb}GB</p>
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide break-words" style={{ color: networkLabelColor }}>{formatNetworkName(networkFilter)}</p>
                  <p className={`${priceFontClass} font-bold break-words`} style={{ color: priceTextColor }}>GHC{Number(price).toFixed(2)}</p>
                  <Button variant="secondary" size={buttonSize === "xs" ? "sm" : buttonSize}
                    className="w-full mt-2 font-medium text-xs sm:text-sm whitespace-nowrap"
                    style={{ backgroundColor: buttonBgColor, color: buttonTextColor, borderColor: buttonBorderColor, borderWidth: '1px', borderStyle: 'solid' }}
                    onClick={() => setPaymentPkg(pkg)}>
                    Buy Now
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {filteredPackages.length === 0 && <p className="text-center text-muted-foreground py-12">No packages available for this network.</p>}
      </div>

      <footer className="border-t border-border py-8 bg-card/50">
        <div className="container text-center space-y-3">
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg" alt="WhatsApp" className="h-4 w-4" style={{ filter: 'invert(0.5)' }} />
              {displayWhatsApp}
            </a>
            <a href={`tel:${store.support_number}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Phone className="h-4 w-4" /> {store.support_number}
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-display font-bold"><span className="text-foreground">ZYTRIX</span> <span style={{ color: primaryColor }}>TECH</span></span>
          </p>
        </div>
      </footer>

      {groupLink && (
        <div className="fixed bottom-6 right-6 z-50">
          <a href={groupLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-[#25D366] hover:bg-[#20B859] text-white rounded-full shadow-lg transition-all duration-300 hover:scale-105"
            style={{ padding: showGroupTooltip ? '0.75rem 1.5rem' : '0.75rem' }}>
            <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/whatsapp.svg" alt="WhatsApp" className="h-6 w-6" style={{ filter: 'brightness(0) invert(1)' }} />
            {showGroupTooltip && <span className="font-medium text-sm whitespace-nowrap">Join WhatsApp Group</span>}
          </a>
        </div>
      )}

      {paymentPkg && (
        <PaymentDialog
          open={!!paymentPkg}
          onOpenChange={(v) => !v && setPaymentPkg(null)}
          packageName={`${paymentPkg.size_gb}GB`}
          network={networkFilter}
          price={Number(selectedPaymentPrice)}
          packageId={paymentPkg.id}
          agentStoreId={store.id}
        />
      )}
      <PaymentVerifier />
    </div>
  );
};

export default AgentStorefront;