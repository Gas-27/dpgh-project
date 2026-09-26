import SeoPageLayout from "@/components/SeoPageLayout";
import { TrendingDown, Users, RefreshCw, BadgeCheck } from "lucide-react";
import { Link } from "react-router-dom";

const tiers = [
  { name: "Standard User", price: "Retail price", desc: "Regular bundle prices. No account required. One-off purchases." },
  { name: "DataPlug Agent", price: "Up to 30% off retail", desc: "Register as an agent, top up a wallet and buy at discounted wholesale rates for resale." },
  { name: "Sub-Agent", price: "Tiered sub-agent pricing", desc: "Agents can onboard sub-agents and earn a commission margin on every sale their network makes." },
];

const faqs = [
  {
    question: "What are wholesale data bundles in Ghana?",
    answer: "Wholesale data bundles are internet bundles purchased at below-retail prices in bulk or through a reseller account. On DataPlug, agents access these rates automatically after wallet top-up.",
  },
  {
    question: "How much cheaper are wholesale data bundles on DataPlug?",
    answer: "DataPlug agents typically save 15–30% compared to buying direct from the network via USSD or the network's app. Exact savings vary by network and bundle.",
  },
  {
    question: "Do I need a minimum order to get wholesale prices?",
    answer: "No minimum order. Once you register as a DataPlug agent and fund your wallet, every bundle you buy is at the wholesale agent rate.",
  },
  {
    question: "Can I buy wholesale data for other people's numbers?",
    answer: "Yes. DataPlug agents buy bundles at wholesale rates and send them to any valid MTN, Telecel, or AirtelTigo number in Ghana.",
  },
  {
    question: "How do I start buying wholesale data bundles?",
    answer: "Sign up for a free DataPlug account, request agent status, fund your wallet, and start buying at wholesale prices immediately.",
  },
];

export default function WholesaleDataBundlesGhana() {
  return (
    <SeoPageLayout
      title="Wholesale Data Bundles Ghana — Best Prices for Resellers"
      description="Buy wholesale data bundles in Ghana at the lowest reseller prices. MTN, Telecel, and AirtelTigo bulk data for agents and businesses. Register free on DataPlug."
      canonicalPath="/wholesale-data-bundles-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Wholesale Data Bundles Ghana" },
      ]}
      headline="Wholesale Data Bundles in Ghana — Cheapest Reseller Prices"
      subheadline="Access below-retail wholesale data bundle prices for MTN, Telecel, and AirtelTigo in Ghana. Join thousands of DataPlug agents buying in bulk and earning from every resale."
      faqs={faqs}
    >
      {/* Benefits */}
      <section aria-labelledby="benefits-heading">
        <h2 id="benefits-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          Why Buy Wholesale Data Bundles on DataPlug?
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { icon: TrendingDown, title: "Up to 30% Below Retail", body: "Our bulk purchasing agreements with network operators mean our agents pay less than buying direct every time." },
            { icon: Users, title: "Unlimited Sub-Agents", body: "Build your own network. Every agent can onboard unlimited sub-agents and earn commissions passively." },
            { icon: RefreshCw, title: "Instant Restocking", body: "Wallet-based system means no delays. Fund once and buy bundles for any number at any time." },
            { icon: BadgeCheck, title: "Trusted by 72K+ Customers", body: "DataPlug has processed over 72,000 data bundle orders across Ghana since launch." },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass rounded-xl border border-border p-5 flex gap-4">
              <div className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing tiers */}
      <section aria-labelledby="tiers-heading">
        <h2 id="tiers-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          DataPlug Pricing Tiers
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {tiers.map(({ name, price, desc }) => (
            <article key={name} className="glass rounded-xl border border-border p-5 space-y-2">
              <h3 className="font-display font-bold text-foreground">{name}</h3>
              <p className="text-primary text-sm font-semibold">{price}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA links */}
      <section aria-labelledby="start-heading">
        <h2 id="start-heading" className="font-display text-xl font-bold text-foreground mb-4">
          Ready to Start Buying Wholesale?
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/become-agent" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            Become an Agent
          </Link>
          <Link to="/data-reseller-agent-ghana" className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors">
            Learn About the Agent Programme
          </Link>
        </div>
      </section>
    </SeoPageLayout>
  );
}
