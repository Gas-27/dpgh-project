import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, MessageCircle, Phone, Wifi } from "lucide-react";

interface AgentStore {
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

const AgentStorefront = () => {
  const { storeName } = useParams<{ storeName: string }>();
  const [store, setStore] = useState<AgentStore | null>(null);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchStore = async () => {
      // Fetch all approved stores and match by slug
      const { data: stores } = await supabase
        .from("agent_stores")
        .select("store_name, whatsapp_number, support_number, approved")
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

      const { data: pkgs } = await supabase
        .from("data_packages")
        .select("id, network, size_gb, price")
        .eq("active", true)
        .order("size_gb");

      setPackages(pkgs ?? []);
      setLoading(false);
    };

    fetchStore();
  }, [storeName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading store...</div>
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold text-foreground">
              {store.store_name}
            </span>
          </div>
          <Button variant="hero" size="sm" asChild>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-1" /> Order Now
            </a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 text-center space-y-4">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
          Affordable Data Bundles
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Get the best data deals from {store.store_name}. Fast delivery, reliable service.
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" /> {store.whatsapp_number}
          </span>
          <span className="flex items-center gap-1">
            <Phone className="h-4 w-4" /> {store.support_number}
          </span>
        </div>
      </section>

      {/* Network Filter */}
      <div className="container pb-4">
        <div className="flex gap-2 justify-center">
          {["mtn", "airteltigo", "telecel"].map((net) => (
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
      </div>

      {/* Packages Grid */}
      <div className="container pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredPackages.map((pkg) => (
            <Card key={pkg.id} className="border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-4 text-center space-y-2">
                <Wifi className="h-6 w-6 text-primary mx-auto" />
                <p className="font-display text-xl font-bold text-foreground">{pkg.size_gb}GB</p>
                <p className="text-lg font-semibold text-primary">GH₵ {Number(pkg.price).toFixed(2)}</p>
                <Button variant="hero" size="sm" className="w-full" asChild>
                  <a
                    href={`${whatsappLink}?text=${encodeURIComponent(`Hi, I'd like to buy ${pkg.size_gb}GB ${networkFilter.toUpperCase()} data for GH₵${Number(pkg.price).toFixed(2)}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Buy Now
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>Powered by <span className="text-primary font-semibold">Data Plug GH</span></p>
      </footer>
    </div>
  );
};

export default AgentStorefront;
