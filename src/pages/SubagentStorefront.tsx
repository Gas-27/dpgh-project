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
  Zap, Phone, Wifi, Shield, Clock, Star, Search, Package, CheckCircle, XCircle,
  X, Loader2, Check, Copy, Bell, Megaphone, Rocket, MessageCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ============================================================
// INTERFACES
// ============================================================
interface SubagentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  whatsapp_group?: string | null;
  show_whatsapp_group_icon?: boolean;
}

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
}

interface SubagentPrice {
  id: string;
  package_id: string;
  base_cost: number;
  sell_price: number;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  customer_amount: number;
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

const getNetworkLabelColor = (network: string) => {
  const defaultColors: Record<string, string> = {
    mtn: "#fbbf24",
    airteltigo: "#60a5fa",
    telecel: "#f87171",
  };
  return defaultColors[network] || "#ffffff";
};

// ============================================================
// ORDER TRACKING CARD
// ============================================================
const OrderTrackingCard = ({ order, store, toast }: { order: Order; store: SubagentStore; toast: any }): JSX.Element => {
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

  if (elapsedMinutes >= 60) {
    currentStep = 3;
    statusMessage = "Your data bundle has been delivered successfully.";
    if (order.network === "mtn") extraNote = "Please check your MTNUP2U and MTN messages for delivery confirmation.";
    else if (order.network === "airteltigo") extraNote = "Please check your AirtelTigo iShare and BigTime messages for delivery confirmation.";
    else if (order.network === "telecel") extraNote = "Please check your Telecel messages for delivery confirmation.";
    else extraNote = "Please check your messages for delivery confirmation.";
  } else if (elapsedMinutes >= 15) {
    currentStep = 2;
    statusMessage = "Processing your order...";
  } else {
    currentStep = 1;
    statusMessage = "Order received! Processing...";
  }

  const steps = [
    { number: 1, title: "Order Received", icon: CheckCircle },
    { number: 2, title: "Processing", icon: Clock },
    { number: 3, title: "Delivered", icon: CheckCircle },
  ];

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-blue-900">Order Tracking</h3>
          <Badge variant="secondary" className="bg-blue-100 text-blue-900">
            {order.fulfillment_status === "pending" ? "Processing" : "Completed"}
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Progress Steps */}
          <div className="flex justify-between">
            {steps.map((step) => {
              const isActive = step.number <= currentStep;
              const Icon = step.icon;
              return (
                <div key={step.number} className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                      isActive ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-center font-medium">{step.title}</span>
                </div>
              );
            })}
          </div>

          {/* Status Message */}
          <div className="bg-white rounded p-3 border border-blue-100">
            <p className="text-sm font-medium text-blue-900">{statusMessage}</p>
            {extraNote && <p className="text-xs text-blue-700 mt-1">{extraNote}</p>}
          </div>

          {/* Order Details */}
          <div className="text-xs space-y-1 text-gray-600">
            <p>
              <span className="font-semibold">Order ID:</span> {order.id}
            </p>
            <p>
              <span className="font-semibold">Network:</span> {formatNetworkName(order.network)}
            </p>
            <p>
              <span className="font-semibold">Package:</span> {order.size_gb}GB
            </p>
          </div>

          {/* Contact Support */}
          {order.fulfillment_status === "pending" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => copyToClipboard(store.whatsapp_number, toast)}
            >
              <MessageCircle className="w-3 h-3 mr-2" />
              Contact Support
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const SubagentStorefront = () => {
  const { subagentStoreName } = useParams<{ subagentStoreName?: string }>();
  const { toast } = useToast();
  const [store, setStore] = useState<SubagentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [prices, setPrices] = useState<Record<string, SubagentPrice>>({});
  const [loading, setLoading] = useState(true);
  const [selectedNetwork, setSelectedNetwork] = useState("mtn");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<DataPackage | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showOrderTracking, setShowOrderTracking] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        let storeName = subagentStoreName || getStoreNameFromSubdomain();
        if (!storeName) throw new Error("Store not found");

        // Fetch subagent store via agent_stores (since subagent stores might be accessed via subdomain)
        const { data: storeData, error: storeError } = await supabase
          .from("subagent_stores")
          .select("*")
          .ilike("store_name", storeName)
          .single();

        if (storeError || !storeData) {
          throw new Error("Subagent store not found");
        }

        setStore(storeData as SubagentStore);

        // Fetch packages
        const { data: pkgData, error: pkgError } = await supabase
          .from("data_packages")
          .select("*")
          .eq("active", true)
          .order("network")
          .order("size_gb");

        if (pkgError) throw pkgError;
        setPackages((pkgData || []) as DataPackage[]);

        // Fetch subagent prices
        const { data: priceData, error: priceError } = await supabase
          .from("subagent_package_prices")
          .select("*")
          .eq("subagent_store_id", storeData.id);

        if (priceError) throw priceError;

        const priceMap: Record<string, SubagentPrice> = {};
        (priceData || []).forEach((p: any) => {
          priceMap[p.package_id] = p;
        });
        setPrices(priceMap);

        // Fetch notifications
        const { data: notifData } = await supabase
          .from("notifications")
          .select("*")
          .eq("target_role", "user")
          .order("created_at", { ascending: false })
          .limit(5);

        setNotifications((notifData || []) as Notification[]);
      } catch (err: any) {
        console.error("[v0] Error initializing SubagentStorefront:", err);
        toast({
          title: "Error",
          description: err.message || "Failed to load store",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [subagentStoreName]);

  // ==================== HANDLERS ====================
  const networkPackages = packages
    .filter((p) => p.network === selectedNetwork)
    .filter((p) =>
      searchQuery === ""
        ? true
        : p.size_gb.toString().includes(searchQuery) || p.network.includes(searchQuery)
    );

  const handleBuyPackage = (pkg: DataPackage) => {
    setSelectedPackage(pkg);
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = async (order: any) => {
    setCurrentOrder(order);
    setShowOrderTracking(true);
    setShowPaymentDialog(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading store...</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
          <p className="text-gray-600">
            We couldn't find the subagent store you're looking for. Please check the URL and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-blue-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                {store.store_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="font-bold text-lg text-gray-900">{store.store_name}</h1>
                <p className="text-xs text-gray-500">Subagent Store</p>
              </div>
            </div>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-700" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Notifications Dropdown */}
        {showNotifications && notifications.length > 0 && (
          <div className="border-t border-blue-100 bg-blue-50 p-4">
            <div className="max-w-6xl mx-auto space-y-2">
              {notifications.map((notif) => (
                <div key={notif.id} className="text-sm text-gray-700 p-2 bg-white rounded border border-blue-100">
                  <p className="font-medium flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-blue-600" />
                    {notif.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Store Hero */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border-l-4 border-blue-600">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Get Instant Data</h2>
              <p className="text-gray-600 mb-4">
                Fast, reliable data bundles for MTN, AirtelTigo, and Telecel networks.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-800">Instant Delivery</Badge>
                <Badge className="bg-blue-100 text-blue-800">Best Prices</Badge>
                <Badge className="bg-purple-100 text-purple-800">24/7 Support</Badge>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-blue-600">
              <Zap className="w-6 h-6" />
              <Rocket className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Show Order Tracking if Active */}
        {showOrderTracking && currentOrder && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Track Your Order</h2>
              <button
                onClick={() => setShowOrderTracking(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <OrderTrackingCard order={currentOrder} store={store} toast={toast} />
          </div>
        )}

        {/* Network Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {["mtn", "airteltigo", "telecel"].map((network) => (
            <button
              key={network}
              onClick={() => setSelectedNetwork(network)}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                selectedNetwork === network
                  ? "bg-blue-600 text-white shadow-md scale-105"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {formatNetworkName(network)}
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search packages by size (e.g., 1, 5, 10)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {networkPackages.length > 0 ? (
            networkPackages.map((pkg) => {
              const price = prices[pkg.id];
              const sellPrice = price?.sell_price || pkg.price;

              return (
                <Card
                  key={pkg.id}
                  className="hover:shadow-lg transition-all cursor-pointer border-blue-100 hover:border-blue-300"
                  onClick={() => handleBuyPackage(pkg)}
                >
                  <CardContent className="p-6 text-center">
                    <div className="mb-4">
                      <p className="text-4xl font-bold text-blue-600">{pkg.size_gb}</p>
                      <p className="text-gray-600 text-sm">GB</p>
                    </div>
                    <div className="mb-4 border-t border-blue-100 pt-4">
                      <p className="text-gray-600 text-xs mb-1">Price</p>
                      <p className="text-2xl font-bold text-gray-900">GH₵ {sellPrice.toFixed(2)}</p>
                    </div>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                      Buy Now
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12">
              <Wifi className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No packages available for this network</p>
              <p className="text-sm text-gray-500">Please try another network</p>
            </div>
          )}
        </div>

        {/* Contact Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-600" />
              Need Help?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">WhatsApp Support</p>
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => copyToClipboard(store.whatsapp_number, toast)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {store.whatsapp_number}
                </Button>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Support Hotline</p>
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => copyToClipboard(store.support_number, toast)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {store.support_number}
                </Button>
              </div>
            </div>
            {store.whatsapp_group && store.show_whatsapp_group_icon && (
              <div className="mt-4">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  asChild
                >
                  <a href={store.whatsapp_group} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Join WhatsApp Group
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        {selectedPackage && (
          <PaymentDialog
            isOpen={showPaymentDialog}
            onClose={() => setShowPaymentDialog(false)}
            package={selectedPackage}
            store={store}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            storeType="subagent"
            storeId={store.id}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {/* Payment Verifier */}
        {showPaymentDialog && selectedPackage && (
          <PaymentVerifier package={selectedPackage} />
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>
            Powered by Data Plus Store • {store.store_name} Subagent • {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubagentStorefront;
