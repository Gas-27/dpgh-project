import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, ShoppingCart, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { detectNetwork, phoneMatchesNetwork, isValidPhoneLength } from "@/lib/phoneUtils";

interface DataPackage {
  id: string;
  size_gb: number;
  price: number;
  network: string;
}

interface SubSubagentStore {
  id: string;
  store_name: string;
  momo_number: string;
  momo_name: string;
  whatsapp_number: string;
  top_reference: string;
}

export default function SubSubagentStorefront() {
  const { subagentStoreName, subSubagentStoreName } = useParams();
  const { toast } = useToast();

  const [subSubagentStore, setSubSubagentStore] = useState<SubSubagentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<DataPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showTrackOrder, setShowTrackOrder] = useState(false);
  const [trackingPhone, setTrackingPhone] = useState("");
  const [trackedOrders, setTrackedOrders] = useState<any[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch subagent store to get subagent_store_id
        const { data: subagentData, error: subagentError } = await supabase
          .from("subagent_stores")
          .select("id")
          .eq("store_name", subagentStoreName)
          .single();

        if (subagentError || !subagentData) {
          setError("Subagent store not found");
          return;
        }

        // Fetch sub-subagent store
        const { data: subSubagentData, error: subSubagentError } = await supabase
          .from("sub_subagent_stores")
          .select("*")
          .eq("subagent_store_id", subagentData.id)
          .eq("store_name", subSubagentStoreName)
          .single();

        if (subSubagentError || !subSubagentData) {
          setError("Sub-subagent store not found");
          return;
        }

        // Fetch packages for all networks
        const { data: packagesData, error: packagesError } = await supabase
          .from("data_packages")
          .select("*")
          .eq("active", true)
          .in("network", ["mtn", "airteltigo", "telecel"])
          .order("network, size_gb");

        if (packagesError) throw packagesError;

        // Fetch custom prices for this sub-subagent store
        const { data: customPricesData, error: pricesError } = await supabase
          .from("sub_subagent_package_prices")
          .select("package_id, sell_price")
          .eq("sub_subagent_store_id", subSubagentData.id);

        if (pricesError) throw pricesError;

        // Build a map of custom prices
        const customPriceMap: Record<string, number> = {};
        (customPricesData || []).forEach((price: any) => {
          customPriceMap[price.package_id] = price.sell_price;
        });

        // Apply custom prices to packages if available
        const packagesWithPrices = (packagesData || []).map((pkg: any) => ({
          ...pkg,
          price: customPriceMap[pkg.id] !== undefined ? customPriceMap[pkg.id] : pkg.price
        }));

        setSubSubagentStore(subSubagentData);
        setPackages(packagesWithPrices);
      } catch (err) {
        console.error("Error loading storefront:", err);
        setError("Failed to load storefront");
      } finally {
        setLoading(false);
      }
    };

    if (subagentStoreName && subSubagentStoreName) {
      fetchData();
    }
  }, [subagentStoreName, subSubagentStoreName]);

  const filteredPackages = packages.filter(p => p.network === networkFilter);

  const handleBuyPackage = async () => {
    if (!selectedPackage || !customerPhone || !subSubagentStore) return;

    if (!isValidPhoneLength(customerPhone)) {
      toast({ title: "Error", description: "Phone number must be exactly 10 digits", variant: "destructive" });
      return;
    }

    const detectedNetwork = detectNetwork(customerPhone);
    if (!phoneMatchesNetwork(customerPhone, selectedPackage.network)) {
      toast({
        title: "Error",
        description: `Phone number doesn't match ${selectedPackage.network.toUpperCase()} network`,
        variant: "destructive"
      });
      return;
    }

    try {
      setPurchasing(true);

      const { error } = await supabase
        .from("orders")
        .insert({
          sub_subagent_store_id: subSubagentStore.id,
          package_id: selectedPackage.id,
          customer_number: customerPhone,
          network: selectedPackage.network,
          size_gb: selectedPackage.size_gb,
          amount: selectedPackage.price,
          base_price: selectedPackage.price,
          selling_price: selectedPackage.price,
          profit: 0,
          status: "pending",
          fulfillment_status: "pending",
          payment_method: "cash"
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Order placed! Contact support for delivery."
      });

      setCustomerPhone("");
      setSelectedPackage(null);
      setShowCheckout(false);
    } catch (err) {
      console.error("Error placing order:", err);
      toast({ title: "Error", description: "Failed to place order", variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  const handleTrackOrder = async () => {
    if (!trackingPhone || !subSubagentStore) return;

    if (!isValidPhoneLength(trackingPhone)) {
      toast({ title: "Error", description: "Phone number must be exactly 10 digits", variant: "destructive" });
      return;
    }

    try {
      setTrackingLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("sub_subagent_store_id", subSubagentStore.id)
        .eq("phone_number", trackingPhone)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTrackedOrders(data || []);
      if (!data || data.length === 0) {
        toast({
          title: "No Orders Found",
          description: "No orders found for this phone number"
        });
      }
    } catch (err) {
      console.error("Error tracking order:", err);
      toast({ title: "Error", description: "Failed to track order", variant: "destructive" });
    } finally {
      setTrackingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !subSubagentStore) {
    return (
      <div className="container py-12">
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold">{error || "Store not found"}</p>
              <p className="text-sm text-muted-foreground">Please check the store URL and try again</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between py-4">
          <div>
            <h1 className="text-xl font-bold">{subSubagentStore.store_name}</h1>
            <p className="text-xs text-muted-foreground">Ref: {subSubagentStore.top_reference}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setShowTrackOrder(true)}>
              Track Order
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{subSubagentStore.whatsapp_number}</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="container py-8 space-y-6">
        {/* Network Filter */}
        <div className="flex flex-wrap gap-2">
          {["mtn", "airteltigo", "telecel"].map(net => (
            <Button
              key={net}
              variant={networkFilter === net ? "hero" : "outline"}
              size="sm"
              onClick={() => setNetworkFilter(net)}
            >
              {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
            </Button>
          ))}
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPackages.map(pkg => (
            <Card
              key={pkg.id}
              className="cursor-pointer border transition-all hover:border-primary hover:shadow-lg"
              onClick={() => {
                setSelectedPackage(pkg);
                setShowCheckout(true);
              }}
            >
              <CardContent className="p-6 text-center space-y-3">
                <div>
                  <p className="text-3xl font-bold text-primary">{pkg.size_gb}</p>
                  <p className="text-sm text-muted-foreground">GB</p>
                </div>
                <div className="border-t border-b border-border py-3">
                  <p className="text-2xl font-bold">GH₵ {pkg.price.toFixed(2)}</p>
                </div>
                <Button className="w-full" size="sm">
                  <ShoppingCart className="h-4 w-4 mr-1" /> Buy Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPackages.length === 0 && (
          <Card className="border-border">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No packages available for this network</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Purchase</DialogTitle>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4">
              <div className="bg-secondary/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Package</p>
                <p className="text-2xl font-bold">{selectedPackage.size_gb}GB - GH₵ {selectedPackage.price.toFixed(2)}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  type="tel"
                  placeholder="024XXXXXXX"
                  maxLength="10"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                />
                <p className="text-xs text-muted-foreground">Must be a valid {selectedPackage.network.toUpperCase()} number</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCheckout(false)} disabled={purchasing}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleBuyPackage}
                  disabled={purchasing || !customerPhone || !selectedPackage}
                >
                  {purchasing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-1" /> Complete Purchase
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Track Order Dialog */}
      <Dialog open={showTrackOrder} onOpenChange={setShowTrackOrder}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Track Your Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                placeholder="024XXXXXXX"
                maxLength="10"
                value={trackingPhone}
                onChange={e => setTrackingPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleTrackOrder}
              disabled={trackingLoading || !trackingPhone}
            >
              {trackingLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Searching...
                </>
              ) : (
                "Track Order"
              )}
            </Button>

            {trackedOrders.length > 0 && (
              <div className="space-y-3 mt-4">
                <p className="font-medium text-sm">Orders for {trackingPhone}</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {trackedOrders.map((order: any) => (
                    <Card key={order.id} className="p-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Order ID:</span>
                          <span className="font-mono text-xs">{order.id.substring(0, 8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Package:</span>
                          <span className="font-medium">{order.size_gb}GB</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">GH₵ {order.amount?.toFixed(2) || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant={order.status === "completed" ? "default" : order.status === "pending" ? "secondary" : "destructive"}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Date:</span>
                          <span>{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
