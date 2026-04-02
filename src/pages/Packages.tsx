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
import { Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Network = "mtn" | "airteltigo" | "telecel";

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
}

const networkConfig: Record<Network, { label: string; color: string }> = {
  mtn: { label: "MTN", color: "text-mtn" },
  airteltigo: { label: "AirtelTigo", color: "text-telecel" },
  telecel: { label: "Telecel", color: "text-telecel" },
};

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

    void fetchPackages();
  }, []);

  useEffect(() => {
    const network = searchParams.get("network");
    if (network === "mtn" || network === "airteltigo" || network === "telecel") {
      setSelectedNetwork(network);
    }
  }, [searchParams]);

  const filtered = useMemo(
    () => packages.filter((pkg) => pkg.network === selectedNetwork),
    [packages, selectedNetwork],
  );

  const handleBuyNow = (pkg: DataPackage) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please create an account or log in to purchase data.", variant: "destructive" });
      navigate("/login");
      return;
    }
    setPaymentPkg(pkg);
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

        {loading ? (
          <div className="text-center text-muted-foreground">Loading packages...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((pkg) => (
              <Card key={pkg.id} className="border-border transition-colors group hover:border-primary/50">
                <CardContent className="p-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                    <Wifi className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-display text-2xl font-bold">{pkg.size_gb}GB</p>
                    <p className={`text-xs font-semibold ${networkConfig[selectedNetwork].color}`}>
                      {networkConfig[selectedNetwork].label}
                    </p>
                  </div>
                  <p className="font-display text-lg font-bold text-primary">
                    GH₵ {Number(pkg.price).toFixed(2)}
                  </p>
                  <Button variant="hero" size="sm" className="w-full" onClick={() => handleBuyNow(pkg)}>
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
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "10px",          // space between icon and text
          backgroundColor: "#25D366",
          borderRadius: "30px", // rounded pill shape for icon + text
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
