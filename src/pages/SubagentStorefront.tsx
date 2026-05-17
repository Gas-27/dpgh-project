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
  MessageCircle, Users, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReportComplaintDialog from "@/components/ReportComplaintDialog";

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

const slugify = (name: string) =>
  name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");

const getNetworkColor = (network: string) => {
  const colors: Record<string, string> = { mtn: "#fbbf24", airteltigo: "#ef4444", telecel: "#3b82f6" };
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

// Order Tracking Card Component
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
        // No complaint found
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
  } else if (elapsedMinutes >= 60) {
    currentStep = 3;
    statusMessage = "Your order is being processed and will be delivered shortly.";
    extraNote = "Most orders complete within 3-4 hours. If delivery takes longer, please wait patiently.";
  } else if (elapsedMinutes >= 5) {
    currentStep = 2;
    statusMessage = "Payment confirmed. Processing your data bundle...";
  } else {
    currentStep = 1;
    statusMessage = "Order received. Verifying payment...";
  }

  const steps = [
    { label: "Order Placed", icon: Package },
    { label: "Payment Confirmed", icon: CheckCircle },
    { label: "Processing", icon: Clock },
    { label: "Delivered", icon: Rocket },
  ];

  const showReportButton = currentStep === 4;
  const theme = store.theme_config || defaultTheme;
  const primaryColor = theme.primary || defaultTheme.primary;

  return (
    <div className="space-y-4 mt-3 p-4 rounded-lg border border-border bg-background/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx + 1 <= currentStep;
            return (
              <div key={idx} className="flex flex-col items-center gap-1 min-w-[60px]">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive ? "text-white" : "bg-secondary text-muted-foreground"
                  }`}
                  style={isActive ? { backgroundColor: primaryColor } : {}}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-[10px] text-center ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
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
            <CheckCircle className="h-4 w-4" /> Report has been sent to the seller
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Status: {complaintStatus === "in-progress" ? "In Progress" : "Pending"}. The seller is working on it for you.
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

      // Find matching store - try multiple strategies
      let matched = stores.find((s: any) => s.store_name && slugify(s.store_name) === normalized);
      if (!matched) matched = stores.find((s: any) => s.store_name && s.store_name.toLowerCase().trim() === normalized);
      if (!matched) matched = stores.find((s: any) => s.store_name && s.store_name.toLowerCase().replace(/\s+/g, "-") === normalized);
      if (!matched) matched = stores.find((s: any) => s.store_name && slugify(s.store_name).replace(/-/g, "") === normalized.replace(/-/g, ""));
      // Also try matching by ID as fallback
      if (!matched) matched = stores.find((s: any) => s.id === urlStoreName);

      if (!matched) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      matched.theme_config = { ...defaultTheme, ...(matched.theme_config || {}) };
      matched.show_whatsapp_group_icon = matched.show_whatsapp_group_icon ?? false;
      setStore(matched);

      // Fetch packages and prices
      const [pkgRes, priceRes, agentPriceRes] = await Promise.all([
        supabase.from("data_packages").select("id, network, size_gb, price").eq("active", true).order("size_gb"),
        supabase.from("subagent_package_prices").select("package_id, sell_price").eq("subagent_store_id", matched.id),
        supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", matched.agent_store_id),
      ]);

      setPackages(pkgRes.data || []);

      // Use subagent prices if set, fallback to agent prices
      const priceMap: Record<string, number> = {};
      (agentPriceRes.data || []).forEach((p: any) => { priceMap[p.package_id] = p.sell_price; });
      (priceRes.data || []).forEach((p: any) => { priceMap[p.package_id] = p.sell_price; });
      setSubagentPrices(priceMap);
      
      setLoading(false);
    };

    fetchStore();
  }, [urlStoreName]);

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

  // Order search
  const searchOrders = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchPerformed(true);

    const raw = searchQuery.trim();
    const noSpaces = stripSpaces(raw);

    let query = supabase
      .from("orders")
      .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, created_at")
      .eq("subagent_store_id", store?.id);

    if (noSpaces.length === 36 && raw.includes("-")) {
      query = query.eq("id", raw);
    } else {
      query = query.ilike("customer_number", `%${noSpaces}%`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      setOrders(data as Order[]);
    } else {
      setOrders([]);
    }
    setSearching(false);
  }, [searchQuery, store?.id]);

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
                  orders.map((order) => (
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
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
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
    </div>
  );
}

export default SubagentStorefront;
