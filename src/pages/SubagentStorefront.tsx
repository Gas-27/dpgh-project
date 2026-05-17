import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PaymentDialog from "@/components/PaymentDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import {
  Zap, Phone, Wifi, Shield, Clock, Search, Package,
  CheckCircle, XCircle, X, Loader2, Check, Copy, Bell, Megaphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SubagentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
  whatsapp_group?: string | null;
  theme_config?: {
    primary: string;
    primary_foreground: string;
    background: string;
    card_background: string;
    gridColumns?: number;
  };
  agent_store_id: string;
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
  sell_price: number;
}

const formatNetworkName = (network: string) => {
  if (network === "mtn") return "MTN";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "telecel") return "Telecel";
  return network;
};

// Slugify must match DOMAINS.getSubagentStoreUrl logic
const slugify = (name: string) =>
  name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");

const getNetworkLabelColor = (network: string) => {
  const colors: Record<string, string> = { mtn: "#fbbf24", airteltigo: "#60a5fa", telecel: "#f87171" };
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

export function SubagentStorefront() {
  const { storeName: urlStoreName } = useParams();
  const { toast } = useToast();

  const [store, setStore] = useState<SubagentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [subagentPrices, setSubagentPrices] = useState<SubagentPrice[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState("mtn");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<DataPackage | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Fetch subagent store by name
  useEffect(() => {
    const fetchStore = async () => {
      if (!urlStoreName) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const normalized = urlStoreName.toLowerCase().trim();
      console.log("[v0] Looking for subagent store with URL name:", normalized);

      // Fetch all subagent stores
      const { data: stores, error } = await supabase
        .from("subagent_stores")
        .select("*");

      if (error) {
        console.error("[v0] Error fetching stores:", error);
        setNotFound(true);
        setLoading(false);
        return;
      }
      
      if (!stores || stores.length === 0) {
        console.log("[v0] No subagent stores found in database");
        setNotFound(true);
        setLoading(false);
        return;
      }

      console.log("[v0] Found stores:", stores.map((s: any) => ({ name: s.store_name, slug: slugify(s.store_name) })));

      // Find matching store by name - try multiple matching strategies
      let matched = stores.find((s: any) => slugify(s.store_name) === normalized);
      if (!matched) matched = stores.find((s: any) => s.store_name.toLowerCase().trim() === normalized);
      if (!matched) matched = stores.find((s: any) => s.store_name.toLowerCase().replace(/\s+/g, "-") === normalized);
      if (!matched) matched = stores.find((s: any) => slugify(s.store_name).replace(/-/g, "") === normalized.replace(/-/g, ""));

      if (!matched) {
        console.log("[v0] No matching store found for:", normalized);
        setNotFound(true);
        setLoading(false);
        return;
      }

      console.log("[v0] Matched store:", matched.store_name);
      setStore(matched);
    };

    fetchStore();
  }, [urlStoreName]);

  // Fetch packages
  useEffect(() => {
    const fetchPackages = async () => {
      const { data, error } = await supabase
        .from("data_packages")
        .select("*")
        .eq("active", true);

      if (error) {
        console.error("Failed to fetch packages:", error);
        return;
      }

      setPackages(data || []);
    };

    fetchPackages();
  }, []);

  // Fetch subagent prices
  useEffect(() => {
    const fetchPrices = async () => {
      if (!store) return;

      const { data, error } = await supabase
        .from("subagent_package_prices")
        .select("*")
        .eq("subagent_store_id", store.id);

      if (error) {
        console.error("Failed to fetch prices:", error);
        return;
      }

      setSubagentPrices(data || []);
      setLoading(false);
    };

    fetchPrices();
  }, [store]);

  const handlePackageSelect = (pkg: DataPackage) => {
    setSelectedPackage(pkg);
    setPaymentDialogOpen(true);
  };

  const getPriceForPackage = (packageId: string): number | null => {
    const priceEntry = subagentPrices.find((p) => p.package_id === packageId);
    return priceEntry ? priceEntry.sell_price : null;
  };

  const networkPackages = packages.filter((p) => p.network === selectedNetwork);

  if (loading || !store) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <h1 className="text-3xl font-bold mb-4">Store Not Found</h1>
        <p className="text-gray-400 mb-6">The store you&apos;re looking for doesn&apos;t exist.</p>
        <Button onClick={() => window.location.href = "https://agentsstore.shop"}>
          Go to AgentsStore
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-900 to-blue-900 border-b border-cyan-700 p-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-cyan-400">{store.store_name}</h1>
              <p className="text-sm text-gray-300 mt-1">Premium Data Store</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const whatsappNumber = getInternationalDigits(store.whatsapp_number);
                  window.open(
                    `https://wa.me/${whatsappNumber}`,
                    "_blank"
                  );
                }}
              >
                <Zap className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              {store.whatsapp_group && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(store.whatsapp_group, "_blank");
                  }}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Updates
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Network Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {["mtn", "airteltigo", "telecel"].map((network) => (
            <Button
              key={network}
              variant={selectedNetwork === network ? "default" : "outline"}
              className="capitalize whitespace-nowrap"
              onClick={() => setSelectedNetwork(network)}
              style={
                selectedNetwork === network
                  ? {
                      backgroundColor: getNetworkLabelColor(network),
                      color: "#000",
                      border: "none",
                    }
                  : {}
              }
            >
              <Wifi className="w-4 h-4 mr-2" />
              {formatNetworkName(network)}
            </Button>
          ))}
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {networkPackages.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">No packages available for {formatNetworkName(selectedNetwork)}</p>
            </div>
          ) : (
            networkPackages.map((pkg) => {
              const subagentPrice = getPriceForPackage(pkg.id);
              return (
                <Card
                  key={pkg.id}
                  className="bg-gray-900 border-gray-800 hover:border-cyan-600 transition-colors cursor-pointer"
                  onClick={() => handlePackageSelect(pkg)}
                >
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <div className="text-3xl font-bold text-cyan-400">
                        {pkg.size_gb}
                        <span className="text-lg text-gray-400">GB</span>
                      </div>
                      <Badge
                        className="mt-2"
                        style={{ backgroundColor: getNetworkLabelColor(pkg.network) }}
                      >
                        {formatNetworkName(pkg.network)}
                      </Badge>
                    </div>

                    <div className="border-t border-gray-800 pt-4">
                      <p className="text-sm text-gray-400">Price</p>
                      <p className="text-2xl font-bold text-green-400">
                        GH₵ {subagentPrice?.toFixed(2) || "N/A"}
                      </p>
                    </div>

                    <Button className="w-full bg-cyan-600 hover:bg-cyan-700">
                      Buy Now
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Support Section */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-cyan-400 mb-4">Need Help?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">Support Number</p>
                  <p
                    className="font-mono text-white cursor-pointer hover:text-cyan-400"
                    onClick={async () => {
                      await navigator.clipboard.writeText(store.support_number);
                      toast({ title: "Copied!", description: "Support number copied to clipboard." });
                    }}
                  >
                    {formatDisplayPhone(store.support_number)}
                    <Copy className="w-4 h-4 inline ml-2" />
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-400">WhatsApp</p>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-white hover:text-cyan-400"
                    onClick={() => {
                      const whatsappNumber = getInternationalDigits(store.whatsapp_number);
                      window.open(
                        `https://wa.me/${whatsappNumber}?text=Hello, I need help with my data purchase.`,
                        "_blank"
                      );
                    }}
                  >
                    Chat with us
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      {selectedPackage && (
        <PaymentDialog
          isOpen={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          package={selectedPackage}
          price={getPriceForPackage(selectedPackage.id) || selectedPackage.price}
          storeId={store.agent_store_id}
          subagentStoreId={store.id}
          phoneNumber={phoneNumber}
          onPhoneNumberChange={setPhoneNumber}
          storeName={store.store_name}
        />
      )}

      <PaymentVerifier storeId={store.id} isSubagent={true} />
    </div>
  );
}

export default SubagentStorefront;
