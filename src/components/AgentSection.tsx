import { Link } from "react-router-dom";
import { Store, DollarSign, Settings, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const perks = [
  { icon: Store, title: "Your Own Mini Website", desc: "Get a branded store to sell data under your name." },
  { icon: DollarSign, title: "Control Your Prices", desc: "Set your own markup and maximize your margins." },
  { icon: Settings, title: "Manage Your Store", desc: "Track orders, customers, and inventory with ease." },
  { icon: TrendingUp, title: "Make Profits", desc: "Earn on every transaction — grow your business." },
];

const AgentSection = () => {
  return (
    <section id="agent" className="py-24 border-t border-border">
      <div className="container grid gap-12 lg:grid-cols-2 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            Agent Portal
          </div>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Start Your <span className="text-primary">Data Business</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-lg">
            Sign up as an agent and get your own mini website to resell data bundles.
            Set your prices, manage your store, and start earning today.
          </p>
          <Button variant="hero" size="lg" asChild>
            <Link to="/signup">Become an Agent</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {perks.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/40 transition-colors">
              <div className="inline-flex rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-primary">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">{p.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AgentSection;
