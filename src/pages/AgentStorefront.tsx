import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, MessageCircle, Phone, Wifi, Shield, Clock, Star } from "lucide-react";

interface AgentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  support_number: string;
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

const AgentStorefront = () => {
  const { storeName } = useParams<{ storeName: string }>();
  const [store, setStore] = useState<AgentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [agentPrices, setAgentPrices] = useState<Record<string, number>>({});
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchStore = async () => {
      const { data: stores } = await supabase
        .from("agent_stores")
        .select("id, store_name, whatsapp_number, support_number")
        .eq("approved", true);

      const matched = (stores ?? []).find((s: any) => {
        const slug = s.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        return slug === storeName;
      });

      if (!matched) {
        setNotFound(true);
        setLoading(false);
        return;
      }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Zap className="h-10 w-10 text-primary animate-pulse" />
          <p className="text-muted-foreground font-display">Loading store...</p>
        </div>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="font-display text-2xl font-bold text-foreground">Store Not Found</h1>
          <p className="text-muted-foreground">This store doesn't exist or hasn't been approved yet.</p>
        </div>
      </div>
    );
  }

  const filteredPackages = packages.filter((p) => p.network === networkFilter);
  const whatsappLink = `https://wa.me/${store.whatsapp_number.replace(/[^0-9]/g, "")}`;

  const getPrice = (pkg: DataPackage) => {
    return agentPrices[pkg.id] ?? pkg.price;
  };

  const networkColors: Record<string, string> = {
    mtn: "from-yellow-500 to-yellow-600",
    airteltigo: "from-red-500 to-red-600",
    telecel: "from-red-600 to-rose-700",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">
              {store.store_name}
            </span>
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

      {/* Hero Banner */}
      <section className="relative overflow-hidden py-16 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/20 rounded-full blur-[120px]" />
        <div className="container relative text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium">
            <Wifi className="h-4 w-4" /> Fast & Reliable Data Delivery
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
            Cheap Data Bundles<br />
            <span className="text-primary">Instant Delivery</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-lg">
            Get the best data deals from <span className="text-foreground font-semibold">{store.store_name}</span>. Select your network and package below.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground pt-2">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Trusted Seller
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> &lt;10min Delivery
            </span>
            <span className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" /> 24/7 Support
            </span>
          </div>
        </div>
      </section>

      {/* Network Filter */}
      <div className="container pb-6">
        <div className="flex gap-2 justify-center">
          {["mtn", "airteltigo", "telecel"].map((net) => (
            <Button
              key={net}
              variant={networkFilter === net ? "hero" : "outline"}
              size="sm"
              className="min-w-[100px]"
              onClick={() => setNetworkFilter(net)}
            >
              {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
            </Button>
          ))}
        </div>
      </div>

      {/* Packages Grid */}
      <div className="container pb-20">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredPackages.map((pkg) => {
            const price = getPrice(pkg);
            return (
              <Card key={pkg.id} className="group border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
                <CardContent className="p-0">
                  <div className={`h-1.5 bg-gradient-to-r ${networkColors[networkFilter] || "from-primary to-primary/60"}`} />
                  <div className="p-4 text-center space-y-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                      <Wifi className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-display text-2xl font-bold text-foreground">{pkg.size_gb}GB</p>
                    <p className="text-xl font-bold text-primary">GH₵ {Number(price).toFixed(2)}</p>
                    <Button variant="hero" size="sm" className="w-full" asChild>
                      <a
                        href={`${whatsappLink}?text=${encodeURIComponent(`Hi, I'd like to buy ${pkg.size_gb}GB ${networkFilter.toUpperCase()} data for GH₵${Number(price).toFixed(2)}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Buy Now
                      </a>
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

      {/* Footer */}
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
            Powered by{" "}
            <span className="font-display font-bold">
              <span className="text-foreground">DATA PLUG</span>{" "}
              <span className="text-primary">GH</span>
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AgentStorefront;
