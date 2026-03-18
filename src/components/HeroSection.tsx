import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import QuickBuyWidget from "./QuickBuyWidget";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen pt-16 flex items-center overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="container grid gap-12 lg:grid-cols-2 lg:gap-16 items-center py-20">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Instant Delivery • 24/7 Reliable
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            Your <span className="text-primary">Data Plug</span> in Ghana
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground leading-relaxed">
            Buy affordable data bundles for MTN, AirtelTigo & Telecel instantly.
            Fast, reliable, and available around the clock.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button variant="hero" size="lg" asChild>
              <Link to="/packages">Get Started</Link>
            </Button>
            <Button variant="hero-outline" size="lg" asChild>
              <Link to="/signup">Become an Agent</Link>
            </Button>
          </div>

          <div className="flex gap-8 pt-4">
            <div>
              <p className="font-display text-2xl font-bold text-foreground">10K+</p>
              <p className="text-xs text-muted-foreground">Happy Users</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-foreground">99.9%</p>
              <p className="text-xs text-muted-foreground">Uptime</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-foreground">&lt;10mins</p>
              <p className="text-xs text-muted-foreground">Delivery Time</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <QuickBuyWidget />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
