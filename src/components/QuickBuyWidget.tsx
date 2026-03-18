import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wifi } from "lucide-react";

const networks = [
  { id: "mtn", name: "MTN", color: "bg-mtn text-primary-foreground" },
  { id: "airteltigo", name: "AirtelTigo", color: "bg-telecel text-foreground" },
  { id: "telecel", name: "Telecel", color: "bg-telecel text-foreground" },
];

const plans: Record<string, { gb: string; price: string }[]> = {
  mtn: [
    { gb: "1GB", price: "GH₵ 4.00" },
    { gb: "2GB", price: "GH₵ 7.00" },
    { gb: "5GB", price: "GH₵ 15.00" },
    { gb: "10GB", price: "GH₵ 28.00" },
  ],
  airteltigo: [
    { gb: "1GB", price: "GH₵ 3.50" },
    { gb: "2GB", price: "GH₵ 6.50" },
    { gb: "5GB", price: "GH₵ 14.00" },
    { gb: "10GB", price: "GH₵ 26.00" },
  ],
  telecel: [
    { gb: "1GB", price: "GH₵ 3.50" },
    { gb: "2GB", price: "GH₵ 6.00" },
    { gb: "5GB", price: "GH₵ 13.00" },
    { gb: "10GB", price: "GH₵ 25.00" },
  ],
};

const QuickBuyWidget = () => {
  const [selectedNetwork, setSelectedNetwork] = useState("mtn");
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [phone, setPhone] = useState("");

  const ctaLink = useMemo(() => {
    const params = new URLSearchParams();
    params.set("network", selectedNetwork);
    if (selectedPlan !== null) {
      params.set("plan", plans[selectedNetwork][selectedPlan].gb);
    }
    if (phone.trim()) {
      params.set("phone", phone.trim());
    }
    return `/packages?${params.toString()}`;
  }, [phone, selectedNetwork, selectedPlan]);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-5 glow-primary-sm">
      <div className="flex items-center gap-2">
        <Wifi className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-semibold text-foreground">Quick Buy</h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {networks.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => { setSelectedNetwork(n.id); setSelectedPlan(null); }}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              selectedNetwork === n.id
                ? `${n.color} shadow-md`
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {n.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {plans[selectedNetwork].map((plan, i) => (
          <button
            key={plan.gb}
            type="button"
            onClick={() => setSelectedPlan(i)}
            className={`rounded-lg border p-3 text-left transition-all ${
              selectedPlan === i
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40"
            }`}
          >
            <p className="font-display text-lg font-bold text-foreground">{plan.gb}</p>
            <p className="text-xs text-muted-foreground">{plan.price}</p>
          </button>
        ))}
      </div>

      <input
        type="tel"
        placeholder="Enter phone number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />

      <Button variant="hero" className="w-full" size="lg" asChild>
        <Link to={ctaLink}>Buy Now</Link>
      </Button>
    </div>
  );
};

export default QuickBuyWidget;
