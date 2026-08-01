import { Link } from "react-router-dom";
import SeoPageLayout from "@/components/SeoPageLayout";
import { Crown, TrendingDown, Zap, Star, Shield, Users, CheckCircle2 } from "lucide-react";

const plans = [
  {
    name: "Basic",
    price: "Free",
    period: "",
    highlight: false,
    features: [
      "Buy data bundles at standard prices",
      "Instant delivery on all networks",
      "Paystack-secured payments",
      "24/7 access",
    ],
  },
  {
    name: "Premium",
    price: "GHS 10",
    period: "/ month",
    highlight: true,
    badge: "Most Popular",
    features: [
      "Everything in Basic",
      "Exclusive discounted data bundle prices",
      "Priority order processing",
      "Early access to new bundle deals",
      "Dedicated WhatsApp support line",
      "Monthly bonus data reward",
    ],
  },
  {
    name: "Agent",
    price: "GHS 0",
    period: "one-time setup",
    highlight: false,
    features: [
      "Everything in Premium — free",
      "Wholesale data bundle pricing",
      "Sub-agent network management",
      "USSD service access",
      "Instant wallet withdrawals",
      "Branded storefront page",
    ],
  },
];

const faqs = [
  { question: "What is DataPlug Premium subscription?", answer: "DataPlug Premium is a monthly subscription that gives you access to exclusive discounted data bundle prices, priority processing, and dedicated support. For as little as GHS 10/month, you save significantly more on data purchases each month." },
  { question: "How much can I save with DataPlug Premium in Ghana?", answer: "Premium subscribers typically save GHS 20–50 per month compared to standard prices, depending on how much data they buy. The subscription pays for itself after just 2–3 data bundle purchases." },
  { question: "Is DataPlug the cheapest data subscription in Ghana?", answer: "DataPlug offers some of the most competitive data subscription prices in Ghana. Our wholesale sourcing model allows us to offer prices well below network operator direct rates. Premium subscribers get even lower prices on top of already-cheap standard rates." },
  { question: "How do I subscribe to DataPlug Premium?", answer: "Create a free account at dataplug.store, log in to your dashboard, and select 'Upgrade to Premium'. Payment is via Mobile Money or card and your subscription activates immediately." },
  { question: "Can I cancel my DataPlug Premium subscription?", answer: "Yes. You can cancel your subscription at any time from your account dashboard. Your Premium benefits remain active until the end of your current billing period." },
  { question: "What is the difference between Premium and Agent?", answer: "Premium is for regular buyers who want cheaper prices and better service. Agent is for people who want to build a reseller business — agents get Premium benefits for free, plus wholesale pricing and their own sub-agent network." },
];

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "DataPlug Premium Subscription Ghana",
  "description": "Monthly subscription for cheaper data bundles, priority service, and exclusive deals in Ghana.",
  "provider": { "@type": "Organization", "name": "DataPlug Ghana" },
  "offers": { "@type": "Offer", "price": "10", "priceCurrency": "GHS", "availability": "https://schema.org/InStock" },
  "areaServed": "GH",
};

export default function PremiumSubscription() {
  return (
    <SeoPageLayout
      title="DataPlug Premium Subscription — Cheapest Data Plans Ghana 2026"
      canonicalPath="/premium-subscription"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Premium Subscription" },
      ]}
      headline="Ghana's Cheapest Data Subscription — DataPlug Premium"
      subheadline="Get exclusive discounts on MTN, Telecel, and AirtelTigo data bundles with DataPlug Premium. The most affordable data subscription in Ghana — starting from GHS 10/month."
      accentClass="text-primary"
      faqs={faqs}
      schemas={[serviceSchema]}
    >
      {/* Plan cards */}
      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="font-display text-2xl font-bold text-foreground mb-6 text-center">
          Choose Your Plan
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative rounded-xl border p-6 space-y-4 flex flex-col ${plan.highlight ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border glass"}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    <Star className="h-3 w-3" aria-hidden="true" /> {plan.badge}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
                <p className="text-2xl font-extrabold text-primary mt-1">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.period}</span></p>
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={plan.name === "Agent" ? "/become-agent" : "/signup"}
                className={`block text-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${plan.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:bg-secondary/60 text-foreground"}`}
              >
                {plan.name === "Agent" ? "Become an Agent" : plan.name === "Basic" ? "Get Started Free" : "Subscribe Now"}
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section aria-labelledby="benefits-heading">
        <h2 id="benefits-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Why Subscribe to DataPlug Premium?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Standard data bundle prices in Ghana are already some of the lowest online. DataPlug Premium goes even further —
          giving subscribers access to wholesale-adjacent prices that typically only agents and bulk buyers can access. For the
          average Ghanaian data buyer who spends GHS 50–150 per month on data, the GHS 10 Premium subscription pays for
          itself multiple times over.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: TrendingDown, title: "Lower Prices Every Month", body: "Premium subscribers access a separate, cheaper price list not available to free users." },
            { icon: Zap, title: "Priority Order Queue", body: "Your orders jump the queue during peak hours, ensuring the fastest possible delivery." },
            { icon: Crown, title: "Exclusive Deals", body: "Flash sales, limited-time bundle offers, and bonus data are only available to Premium members." },
            { icon: Shield, title: "Dedicated Support", body: "Premium members get a dedicated WhatsApp support line for faster issue resolution." },
            { icon: Users, title: "Agent Upgrade Path", body: "Easily upgrade from Premium to full Agent status to unlock wholesale pricing and reseller tools." },
            { icon: Star, title: "Monthly Bonus Data", body: "Each month of your Premium subscription includes a free bonus data reward on your account." },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass rounded-xl border border-border p-4 space-y-2">
              <div className="inline-flex rounded-lg bg-primary/10 p-2" aria-hidden="true">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Internal links */}
      <section className="glass rounded-xl border border-border p-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">Related Services</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { to: "/packages", label: "Browse Data Bundle Packages" },
            { to: "/data-reseller-agent-ghana", label: "Become a Data Reseller Agent" },
            { to: "/data-agent-business-ghana", label: "Build a Data Agent Business" },
            { to: "/cheap-data-bundles-ghana", label: "Cheapest Data Bundles Ghana" },
          ].map(({ to, label }) => (
            <Link key={to} to={to} className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Zap className="h-3 w-3" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </SeoPageLayout>
  );
}
