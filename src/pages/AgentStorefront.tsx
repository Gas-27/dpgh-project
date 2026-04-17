import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PaymentDialog from "@/components/PaymentDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import { Zap, MessageCircle, Phone, Wifi, Shield, Clock, Star, Search, Package, CheckCircle, XCircle, X, Loader2, Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AgentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  theme_config?: {
    primary: string;
    primary_foreground: string;
    background: string;
    card_background: string;
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

const formatNetworkName = (network: string) => {
  if (network === "mtn") return "MTN";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "telecel") return "Telecel";
  return network;
};

const copyToClipboard = async (text: string, toast: any) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Contact information copied to clipboard.",
    });
  } catch (err) {
    toast({
      title: "Failed to copy",
      description: "Please copy manually.",
      variant: "destructive",
    });
  }
};

// Helper: Get store name from subdomain (e.g., "acme" from "acme.datastores.shop")
const getStoreNameFromSubdomain = (): string | null => {
  const hostname = window.location.hostname;
  // Only match if the hostname ends with .datastores.shop
  if (hostname.endsWith('.datastores.shop')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }
  }
  return null;
};

// ============================================================
// ORDER TRACKING CARD – STEP TIMELINE (unchanged)
// ============================================================
const OrderTrackingCard = ({ order, store, toast }: { order: Order; store: AgentStore; toast: any }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const orderCreatedAt = new Date(order.created_at);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
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
    if (order.network === "mtn") {
      extraNote = "Please check your MTNUP2U and MTN messages for delivery confirmation.";
    } else if (order.network === "airteltigo") {
      extraNote = "Please check your AirtelTigo iShare and BigTime messages for delivery confirmation.";
    } else if (order.network === "telecel") {
      extraNote = "Please check your Telecel messages for delivery confirmation.";
    } else {
      extraNote = "Please check your messages for delivery confirmation.";
    }
  }
  else if (elapsedMinutes >= 60) {
    currentStep = 3;
    if (order.network === "mtn") {
      statusMessage = "Please be expecting your data any moment from now. Check your MTN and MTNUP2U messages for delivery confirmation.";
    } else if (order.network === "airteltigo") {
      statusMessage = "Please be expecting your data any moment from now. Check your AirtelTigo iShare or BigTime messages for delivery confirmation.";
    } else if (order.network === "telecel") {
      statusMessage = "Please be expecting your data any moment from now. Check your Telecel messages for delivery confirmation.";
    } else {
      statusMessage = "Please be expecting your data any moment from now. Check your messages for delivery confirmation.";
    }
    extraNote = "The order has left our system and is now with the network you bought the data from. All delays from now are from them.";
  }
  else if (elapsedMinutes >= 12) {
    currentStep = 3;
    statusMessage = `Waiting for validation from ${formatNetworkName(order.network)}...`;
    if (elapsedMinutes >= 15) {
      statusMessage = "Your order can be delivered any moment from now. You can ignore the progress steps. Please report only if data is not delivered while it shows 'Delivered'.";
    }
  }
  else if (elapsedMinutes >= 9) {
    currentStep = 2;
    statusMessage = `Order sent to ${formatNetworkName(order.network)} for validation`;
    extraNote = "Now waiting for validation from the network to deliver your data. All delay now is from the network you bought the data from.";
  }
  else {
    currentStep = 1;
    statusMessage = "Order being processed...";
  }

  const orderDate = new Date(order.created_at).toLocaleString();
  const contactMessage = `Order from ${orderDate}\nNetwork: ${formatNetworkName(order.network)}\nData: ${order.size_gb}GB\nAmount: GH₵ ${Number(order.amount).toFixed(2)}\nCustomer: ${order.customer_number}\n\nPlease help resolve this issue. Contact: ${store.support_number}`;

  const whatsappNumber = store.whatsapp_number.replace(/[^0-9]/g, "");
  const whatsappMessage = encodeURIComponent(
    `Hello, I am reporting that my order shows as "Delivered" but I have not received the data.\n\nOrder Details:\n- Order Date: ${orderDate}\n- Network: ${formatNetworkName(order.network)}\n- Data: ${order.size_gb}GB\n- Amount: GH₵ ${Number(order.amount).toFixed(2)}\n- Customer Number: ${order.customer_number}\n- Order Status: ${order.status} / ${order.fulfillment_status}\n- Order ID: ${order.id}\n\nPlease investigate and assist. Thank you.`
  );
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

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
          <Button
            variant="outline"
            size="sm"
            className="w-full border-yellow-600/50 text-yellow-600 hover:bg-yellow-600/10"
            asChild
          >
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />
              Report: Delivered but not received
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
            if (step.step < currentStep) {
              icon = <Check className="h-4 w-4 text-green-400" />;
            } else if (step.step === currentStep) {
              icon = <Loader2 className="h-4 w-4 text-primary animate-spin" />;
            } else {
              icon = <Clock className="h-4 w-4 text-muted-foreground" />;
            }
            return (
              <div key={step.step} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.step < currentStep ? "bg-green-600/20 text-green-400" :
                  step.step === currentStep ? "bg-primary/20 text-primary border border-primary/50" :
                    "bg-muted text-muted-foreground"
                  }`}>
                  {icon}
                </div>
                <span className={`text-xs text-center mt-1 ${step.step === currentStep ? "text-primary font-medium" : "text-muted-foreground"
                  }`}>
                  {step.name}
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
          onClick={() => copyToClipboard(contactMessage, toast)}
        >
          <Copy className="h-4 w-4 mr-2" />
          Contact Support ({store.support_number})
        </Button>
      )}
    </div>
  );
};

// ============================================================
// MAIN AGENT STOREFRONT COMPONENT (updated to use subdomain)
// ============================================================
const AgentStorefront = () => {
  // Get store name from subdomain first, fallback to URL param for backward compatibility
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

  const searchOrders = useCallback(async () => {
    if (!store || !searchQuery.trim()) return;
    setSearching(true);
    setSearchPerformed(true);
    const trimmedQuery = searchQuery.trim();
    let query = supabase
      .from("orders")
      .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, created_at")
      .eq("agent_store_id", store.id);
    if (trimmedQuery.length === 36 && trimmedQuery.includes("-")) {
      query = query.eq("id", trimmedQuery);
    } else {
      query = query.ilike("customer_number", `%${trimmedQuery}%`);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) setOrders(data as Order[]);
    else setOrders([]);
    setSearching(false);
  }, [store, searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setOrders([]);
    setSearchPerformed(false);
  };

  useEffect(() => {
    const fetchStore = async () => {
      if (!storeName) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: stores } = await supabase
        .from("agent_stores")
        .select("id, store_name, whatsapp_number, support_number, theme_config")
        .eq("approved", true) as any;

      const matched = (stores ?? []).find((s: any) => {
        const slug = s.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        return slug === storeName;
      });

      if (!matched) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!matched.theme_config) {
        matched.theme_config = {
          primary: "#38bdf8",
          primary_foreground: "#000000",
          background: "#0a0a0a",
          card_background: "#171717",
        };
      }
      setStore(matched);
      const [pkgRes, priceRes] = await Promise.all([
        supabase.from("data_packages").select("id, network, size_gb, price").eq("active", true).order("size_gb"),
        supabase.from("agent_package_prices").select("package_id, sell_price").eq("agent_store_id", matched.id),
      ]);
      setPackages(pkgRes.data ?? []);
      const priceMap: Record<string, number> = {};
      (priceRes.data ?? []).forEach((p: AgentPrice) => {
        priceMap[p.package_id] = p.sell_price;
      });
      setAgentPrices(priceMap);
      setLoading(false);
    };
    fetchStore();
  }, [storeName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Zap className="h-10 w-10 text-primary animate-pulse" />
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="font-display text-2xl font-bold">Store Not Found</h1>
        </div>
      </div>
    );
  }

  const filteredPackages = packages.filter((p) => p.network === networkFilter);
  const whatsappLink = `https://wa.me/${store.whatsapp_number.replace(/[^0-9]/g, "")}`;
  const getPrice = (pkg: DataPackage) => agentPrices[pkg.id] ?? pkg.price;
  const networkColors: Record<string, string> = {
    mtn: "from-yellow-500 to-yellow-600",
    airteltigo: "from-red-500 to-red-600",
    telecel: "from-red-600 to-rose-700",
  };
  const selectedPaymentPrice = paymentPkg ? getPrice(paymentPkg) : 0;

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

  const { theme_config } = store;
  const primaryGradient = `linear-gradient(135deg, ${theme_config.primary}20, ${theme_config.primary}05)`;

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: theme_config.background,
        '--primary': theme_config.primary,
        '--primary-foreground': theme_config.primary_foreground,
      } as React.CSSProperties}
    >
      <header className="border-b border-border bg-background/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${theme_config.primary}, ${theme_config.primary}cc)` }}
            >
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">{store.store_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${store.support_number}`}>
                <Phone className="h-4 w-4 mr-1" /> Call
              </a>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden py-16 md:py-20">
        <div className="absolute inset-0" style={{ background: primaryGradient }} />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px]"
          style={{ background: `${theme_config.primary}30` }}
        />
        <div className="container relative text-center space-y-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
            style={{
              borderColor: `${theme_config.primary}50`,
              background: `${theme_config.primary}10`,
              color: theme_config.primary,
            }}
          >
            <Wifi className="h-4 w-4" /> Fast & Reliable Data Delivery
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
            Cheap Data Bundles<br />
            <span style={{ color: theme_config.primary }}>Instant Delivery</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-lg">
            Get the best data deals from <span className="text-foreground font-semibold">{store.store_name}</span>. Select your network and package below.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground pt-2">
            <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Trusted Seller</span>
            <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> &lt;60min Delivery</span>
            <span className="flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> 24/7 Support</span>
          </div>
        </div>
      </section>

      {/* Order Tracking Section */}
      <div className="container pb-10">
        <Card
          className="border"
          style={{
            borderColor: `${theme_config.primary}30`,
            backgroundColor: `${theme_config.primary}08`,
          }}
        >
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
              <div className="flex-1">
                <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-primary" />
                  Track Your Order
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter your phone number or order ID to check the status of your purchase.
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
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {searchPerformed && (
              <div className="mt-6">
                {searching ? (
                  <div className="text-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-3" />
                    <p className="text-muted-foreground">Searching for your order...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 border border-border rounded-lg bg-background/50">
                    <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No orders found for "{searchQuery}".</p>
                    <p className="text-xs text-muted-foreground mt-1">Please check your phone number or order ID and try again.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Found {orders.length} order(s):</p>
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
                              <Badge className={
                                order.status === "completed" || order.status === "paid"
                                  ? "bg-green-600/20 text-green-400 border-green-600/30"
                                  : order.status === "pending"
                                    ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                                    : "bg-red-600/20 text-red-400 border-red-600/30"
                              }>
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
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="container pb-6">
        <div className="flex gap-2 justify-center">
          {["mtn", "airteltigo", "telecel"].map((net) => (
            <Button
              key={net}
              variant={networkFilter === net ? "hero" : "outline"}
              size="sm"
              className="min-w-[100px]"
              onClick={() => setNetworkFilter(net)}
              style={
                networkFilter === net
                  ? { backgroundColor: theme_config.primary, color: theme_config.primary_foreground }
                  : {}
              }
            >
              {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
            </Button>
          ))}
        </div>
      </div>

      <div className="container pb-20">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredPackages.map((pkg) => {
            const price = getPrice(pkg);
            return (
              <Card key={pkg.id} className="group border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
                <CardContent className="p-0">
                  <div
                    className="h-1.5"
                    style={{ background: `linear-gradient(90deg, ${theme_config.primary}, ${theme_config.primary}cc)` }}
                  />
                  <div className="p-4 text-center space-y-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center mx-auto group-hover:bg-opacity-20 transition-colors"
                      style={{ backgroundColor: `${theme_config.primary}20` }}
                    >
                      <Wifi className="h-5 w-5" style={{ color: theme_config.primary }} />
                    </div>
                    <p className="font-display text-2xl font-bold text-foreground">{pkg.size_gb}GB</p>
                    <p className="text-xl font-bold" style={{ color: theme_config.primary }}>
                      GH₵ {Number(price).toFixed(2)}
                    </p>
                    <Button
                      variant="hero"
                      size="sm"
                      className="w-full"
                      style={{ backgroundColor: theme_config.primary, color: theme_config.primary_foreground }}
                      onClick={() => setPaymentPkg(pkg)}
                    >
                      Buy Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {filteredPackages.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No packages available for this network.</p>
        )}
      </div>

      <footer className="border-t border-border py-8 bg-card/50">
        <div className="container text-center space-y-3">
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <MessageCircle className="h-4 w-4" /> {store.whatsapp_number}
            </a>
            <a href={`tel:${store.support_number}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Phone className="h-4 w-4" /> {store.support_number}
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-display font-bold"><span className="text-foreground">DATA PLUG</span> <span style={{ color: theme_config.primary }}>GH</span></span>
          </p>
        </div>
      </footer>

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