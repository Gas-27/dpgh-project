'use client';

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Wifi } from "lucide-react";
import PaymentDialog from "@/components/PaymentDialog";
import { useFetchRealtimePackages } from "@/hooks/useRealtimePackages";

const networks = [
  { id: "mtn", name: "MTN", color: "bg-mtn text-primary-foreground" },
  { id: "mtn_express", name: "MTN Exp", color: "bg-mtn text-primary-foreground" },
  { id: "airteltigo", name: "AT", color: "bg-telecel text-foreground" },
  { id: "telecel", name: "Telecel", color: "bg-telecel text-foreground" },
];

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
  data_package_id?: string;
  size_gb_text?: string;
  active?: boolean;
}

const QuickBuyWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedNetwork, setSelectedNetwork] = useState("mtn");
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [paymentPkg, setPaymentPkg] = useState<DataPackage | null>(null);

  // Use real-time packages hook for instant updates (include inactive so they show as unavailable)
  const { packages, loading } = useFetchRealtimePackages();

  const filteredPlans = useMemo(
    () => {
      return packages.filter((p) => {
        // COMMENTED OUT: mashup packages deactivated
        // if (selectedNetwork === "mtn_mashup") {
        //   return (p.network === "mtn_mashup" || p.network === "mashup");
        // }
        return p.network === selectedNetwork;
      }).slice(0, 4);
    },
    [packages, selectedNetwork],
  );

  const handleBuyNow = () => {
    if (selectedPlan === null || !filteredPlans[selectedPlan] || filteredPlans[selectedPlan].active === false) {
      navigate(`/packages?network=${selectedNetwork}`);
      return;
    }
    if (!user) {
      navigate("/login");
      return;
    }
    setPaymentPkg(filteredPlans[selectedPlan]);
  };

  return (
    <>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-5 glow-primary-sm">
        <div className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">Quick Buy</h3>
        </div>

        <div className="grid grid-cols-4 gap-1 sm:gap-2">
          {networks.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => { setSelectedNetwork(n.id); setSelectedPlan(null); }}
              className={`rounded-lg px-1 sm:px-2 py-2 text-xs font-semibold transition-all ${
                selectedNetwork === n.id
                  ? `${n.color} shadow-md`
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {n.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border border-border p-3 animate-pulse h-16" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredPlans.map((plan, i) => {
              const isInactive = plan.active === false;
              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={isInactive}
                  onClick={() => !isInactive && setSelectedPlan(i)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    isInactive
                      ? "border-border opacity-50 grayscale cursor-not-allowed"
                      : selectedPlan === i
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40"
                  }`}
                >
                  <p className="font-display text-base sm:text-lg font-bold text-foreground">
                    {`${plan.size_gb}GB`}
                  </p>
                  {isInactive ? (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Not available</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">GHC {Number(plan.price).toFixed(2)}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <Button variant="hero" className="w-full" size="lg" onClick={handleBuyNow}>
          Buy Now
        </Button>
      </div>

      {paymentPkg && (
        <PaymentDialog
          open={!!paymentPkg}
          onOpenChange={(v) => !v && setPaymentPkg(null)}
          package={paymentPkg}
          network={selectedNetwork}
          price={Number(paymentPkg.price)}
        />
      )}
    </>
  );
};

export default QuickBuyWidget;
