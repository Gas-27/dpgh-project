import { Link } from "react-router-dom";
import { Crown, CheckCircle2, ArrowRight, X } from "lucide-react";
import { useState } from "react";

const PERKS = [
  "Exclusive discounted bundle prices",
  "Priority order processing",
  "Monthly bonus data reward",
  "Dedicated WhatsApp support",
];

/**
 * PremiumSubscriptionBanner
 *
 * A dismissible site-wide banner promoting the Premium subscription.
 * Dismissal is stored in sessionStorage so it reappears on next visit.
 */
export default function PremiumSubscriptionBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("premium_banner_dismissed") === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  function handleDismiss() {
    try {
      sessionStorage.setItem("premium_banner_dismissed", "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <aside
      role="complementary"
      aria-label="DataPlug Premium subscription offer"
      className="relative border border-primary/30 bg-primary/5 rounded-xl overflow-hidden"
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss Premium subscription banner"
        className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Icon + headline */}
          <div className="flex items-start gap-3 flex-1 pr-6">
            <div className="flex-shrink-0 rounded-xl bg-primary/15 p-2.5" aria-hidden="true">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-0.5">
                DataPlug Premium
              </p>
              <h2 className="font-display text-base sm:text-lg font-bold text-foreground text-balance">
                Ghana&apos;s cheapest data subscription — from just{" "}
                <span className="text-primary">GHS&nbsp;10&nbsp;/&nbsp;month</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Unlock exclusive discounted prices on every MTN, Telecel, and AirtelTigo bundle you buy.
              </p>

              {/* Perks inline */}
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" aria-hidden="true" />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2 sm:flex-shrink-0">
            <Link
              to="/premium-subscription"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              See Premium Plans
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
