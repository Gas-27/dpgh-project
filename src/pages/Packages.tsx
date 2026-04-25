import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import NotificationPopup from "@/components/NotificationPopup";
import PaymentDialog from "@/components/PaymentDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Wifi, Search, Package, CheckCircle, Clock, XCircle, X, Loader2, Check, Mail, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Network = "mtn" | "airteltigo" | "telecel";

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

const networkConfig: Record<Network, { label: string; color: string }> = {
  mtn: { label: "MTN", color: "text-yellow-400" },
  airteltigo: { label: "AirtelTigo", color: "text-blue-400" },
  telecel: { label: "Telecel", color: "text-red-400" },
};

const formatNetworkName = (network: string) => {
  if (network === "mtn") return "MTN";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "telecel") return "Telecel";
  return network;
};

// ============================================================
// ORDER TRACKING CARD – STEP TIMELINE
// ============================================================
const OrderTrackingCard = ({ order, toast }: { order: Order; toast: any }) => {
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

  // Email support (dataplugstore@gmail.com) with pre‑filled details
  const emailSubject = encodeURIComponent("Order Support Request");
  const emailBody = encodeURIComponent(
    `Hello,\n\nI need assistance with my order.\n\nOrder Details:\n- Order Date: ${orderDate}\n- Network: ${formatNetworkName(order.network)}\n- Data: ${order.size_gb}GB\n- Amount: GH₵ ${Number(order.amount).toFixed(2)}\n- Customer Number: ${order.customer_number}\n- Order Status: ${order.status} / ${order.fulfillment_status}\n- Order ID: ${order.id}\n\nPlease help resolve this issue.\n\nThank you.`
  );
  const mailtoLink = `mailto:dataplugstore@gmail.com?subject=${emailSubject}&body=${emailBody}`;

  // WhatsApp report link (for "Delivered but not received")
  const whatsappNumber = "233200511211"; // Change to your actual WhatsApp number
  const whatsappMessage = encodeURIComponent(
    `Hello, I am reporting that my order shows as "Delivered" but I have not received the data.\n\nOrder Details:\n- Order Date: ${orderDate}\n- Network: ${formatNetworkName(order.network)}\n- Data: ${order.size_gb}GB\n- Amount: GH₵ ${Number(order.amount).toFixed(2)}\n- Customer Number: ${order.customer_number}\n- Order Status: ${order.status} / ${order.fulfillment_status}\n- Order ID: ${order.id}\n\nPlease investigate and assist. Thank you.`
  );
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const showSupportButton = elapsedMinutes >= 132 && currentStep !== 4;
  const showReportButton = currentStep === 4 && elapsedMinutes >= 150 && elapsedMinutes < 3030;

  // Delivered step UI
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
              Only Report: if it shows Delivered<br /> here
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
          asChild
        >
          <a href={mailtoLink}>
            <Mail className="h-4 w-4 mr-2" />
            Contact Support (dataplugstore@gmail.com)
          </a>
        </Button>
      )}
    </div>
  );
};

// ============================================================
// MAIN PACKAGES COMPONENT
// ============================================================
const Packages = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(() => {
    const network = searchParams.get("network");
    return network === "mtn" || network === "airteltigo" || network === "telecel" ? network : "mtn";
  });
  const [loading, setLoading] = useState(true);
  const [paymentPkg, setPaymentPkg] = useState<DataPackage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);

  useEffect(() => {
    const fetchPackages = async () => {
      const { data } = await supabase
        .from("data_packages")
        .select("id, network, size_gb, price")
        .eq("active", true)
        .order("size_gb", { ascending: true });
      setPackages(data ?? []);
      setLoading(false);
    };
    fetchPackages();
  }, []);

  useEffect(() => {
    const network = searchParams.get("network");
    if (network === "mtn" || network === "airteltigo" || network === "telecel") {
      setSelectedNetwork(network);
    }
  }, [searchParams]);

  const filtered = useMemo(
    () => packages.filter((pkg) => pkg.network === selectedNetwork),
    [packages, selectedNetwork]
  );

  const handleBuyNow = (pkg: DataPackage) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please create an account or log in to purchase data.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }
    setPaymentPkg(pkg);
  };

  const searchOrders = async () => {
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
    }
    setSearching(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setOrders([]);
    setSearchPerformed(false);
  };

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

  return (
    <div className="min-h-screen bg-background">
      <NotificationPopup />
      <Navbar />
      <div className="container pt-24 pb-16">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-center mb-2">
          Data <span className="text-primary">Packages</span>
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          Choose your network and select a data bundle
        </p>

        {/* Order Tracking Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <Card className="border-primary/30 bg-primary/5">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        Please check your phone number or order ID and try again.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">Found {orders.length} order(s):</p>
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
                                    {order.id.slice(0, 8)}...
                                  </Badge>
                                  <span className="text-sm font-medium text-foreground">
                                    {order.customer_number}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="uppercase text-muted-foreground">{order.network}</span>
                                  <span className="font-display font-bold">{order.size_gb}GB</span>
                                  <span className="text-primary">GH₵ {Number(order.amount).toFixed(2)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(order.created_at).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(order.status)}
                                <Badge
                                  className={
                                    order.status === "completed" || order.status === "paid"
                                      ? "bg-green-600/20 text-green-400 border-green-600/30"
                                      : order.status === "pending"
                                        ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                                        : "bg-red-600/20 text-red-400 border-red-600/30"
                                  }
                                >
                                  {getStatusText(order.status)}
                                </Badge>
                              </div>
                            </div>
                            <div className="pt-3">
                              <OrderTrackingCard order={order} toast={toast} />
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

        {/* Network Filter Buttons */}
        <div className="flex justify-center gap-3 mb-8">
          {(Object.keys(networkConfig) as Network[]).map((net) => (
            <Button
              key={net}
              variant={selectedNetwork === net ? "hero" : "outline"}
              onClick={() => setSelectedNetwork(net)}
              className="font-semibold"
            >
              {networkConfig[net].label}
            </Button>
          ))}
        </div>

        {/* Packages Grid - Styled like the image */}
        {loading ? (
          <div className="text-center text-muted-foreground">Loading packages...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((pkg) => (
              <Card
                key={pkg.id}
                className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group"
                style={{
                  background: "linear-gradient(135deg, #2d1b69 0%, #1a0a3e 100%)",
                }}
              >
                <CardContent className="p-4 text-center space-y-2">
                  {/* GB Size */}
                  <p className="text-3xl md:text-4xl font-bold text-white">
                    {pkg.size_gb}GB
                  </p>

                  {/* Network Name */}
                  <p className={`text-sm font-semibold uppercase tracking-wide ${networkConfig[selectedNetwork].color}`}>
                    {networkConfig[selectedNetwork].label}
                  </p>

                  {/* Price */}
                  <p className="text-xl font-bold text-white">
                    GHC{Number(pkg.price).toFixed(2)}
                  </p>

                  {/* Buy Now Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full mt-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium"
                    onClick={() => handleBuyNow(pkg)}
                  >
                    Buy Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {paymentPkg && (
        <PaymentDialog
          open={!!paymentPkg}
          onOpenChange={(v) => !v && setPaymentPkg(null)}
          packageName={`${paymentPkg.size_gb}GB`}
          network={selectedNetwork}
          price={Number(paymentPkg.price)}
          packageId={paymentPkg.id}
        />
      )}
      <PaymentVerifier />

      {/* Floating WhatsApp Button */}
      <a
        href="https://whatsapp.com/channel/0029Vb6Yd9ALo4hZ2ikWCV1z"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          backgroundColor: "#25D366",
          borderRadius: "30px",
          padding: "10px 15px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
          cursor: "pointer",
          transition: "transform 0.2s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
          alt="Join WhatsApp Channel"
          style={{ width: "35px", height: "35px" }}
        />
        <span
          style={{
            color: "white",
            fontWeight: "bold",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          Join channel – get updates & free giveaways
        </span>
      </a>
    </div>
  );
};

export default Packages;