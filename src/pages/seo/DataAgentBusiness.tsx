import { Link } from "react-router-dom";
import SeoPageLayout from "@/components/SeoPageLayout";
import { Users, TrendingUp, Network, Zap, DollarSign, Shield } from "lucide-react";

const tiers = [
  {
    layer: "Layer 1",
    role: "Main Agent",
    color: "border-primary/40 bg-primary/5",
    labelColor: "text-primary",
    desc: "You register as a Main Agent on DataPlug. You receive wholesale data bundle pricing, your own branded storefront, and a management dashboard where you control everything below you.",
    earn: "Earn a margin on every bundle sold through your storefront and every bundle sold by all agents under you.",
  },
  {
    layer: "Layer 2",
    role: "Sub-Agent",
    color: "border-blue-400/40 bg-blue-400/5",
    labelColor: "text-blue-400",
    desc: "Main Agents can create Sub-Agents under them. Each Sub-Agent gets their own DataPlug storefront and can sell data bundles to their own customers at prices the Main Agent sets.",
    earn: "Main Agents earn a commission on every Sub-Agent sale. Sub-Agents earn a margin set by the Main Agent.",
  },
  {
    layer: "Layer 3",
    role: "Sub-Sub-Agent",
    color: "border-green-400/40 bg-green-400/5",
    labelColor: "text-green-400",
    desc: "Sub-Agents can create Sub-Sub-Agents under them. This third layer allows you to build a network of sellers across different communities, schools, or markets in Ghana.",
    earn: "Commissions flow upward through all three layers. The bigger your network, the more you earn passively.",
  },
];

const faqs = [
  { question: "What is a data reseller agent in Ghana?", answer: "A data reseller agent in Ghana is someone who buys data bundles at wholesale prices and resells them to customers at a profit. DataPlug's agent programme is one of the most advanced in Ghana, offering a 3-layer reseller structure that allows agents to build entire distribution networks." },
  { question: "How much can I earn as a DataPlug agent in Ghana?", answer: "Earnings depend on your sales volume and your network size. Agents earn a margin of GHS 1–5 per bundle sold, and receive commissions on all sales by agents they have created under them. Agents with active sub-agent networks earn GHS 500–5,000 per month." },
  { question: "How do I become a data agent in Ghana?", answer: "Register at dataplug.store, verify your account, and apply for agent status. Once approved, your wallet is activated, you receive your branded storefront link, and you can start selling data bundles immediately. See /become-agent for the full guide." },
  { question: "What is a sub-agent in the DataPlug system?", answer: "A sub-agent is a reseller created under a main agent. Sub-agents get their own DataPlug storefront and can buy and sell data bundles at prices set by their main agent. Main agents earn a commission on every sub-agent sale." },
  { question: "What is a multi-level data reseller system?", answer: "DataPlug's multi-level reseller system has 3 tiers: Main Agent → Sub-Agent → Sub-Sub-Agent. This structure allows entrepreneurs to build an entire distribution network where they earn commissions passively from every sale made by agents below them." },
  { question: "Can I run a data reseller business from my phone in Ghana?", answer: "Yes. The entire DataPlug agent system is managed through a mobile-friendly web dashboard. You can manage your storefront, track sales, top up wallets, create sub-agents, and process withdrawals entirely from your smartphone." },
];

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "DataPlug Data Agent Business Ghana",
  "description": "Build a 3-layer data reseller network in Ghana. Become a DataPlug agent and earn from wholesale data bundle sales.",
  "provider": { "@type": "Organization", "name": "DataPlug Ghana" },
  "areaServed": "GH",
};

export default function DataAgentBusiness() {
  return (
    <SeoPageLayout
      title="Build a Data Agent Business in Ghana 2026 — 3-Layer Reseller System | DataPlug"
      canonicalPath="/data-agent-business-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Agent Programme", href: "/become-agent" },
        { label: "Data Agent Business Ghana" },
      ]}
      headline="Build a Profitable Data Agent Business in Ghana with DataPlug"
      subheadline="Ghana's most advanced 3-layer data reseller system. Start as a Main Agent, build a network of Sub-Agents, and earn passive commissions on every data bundle sold across your entire distribution network."
      accentClass="text-primary"
      faqs={faqs}
      schemas={[orgSchema]}
    >
      {/* 3-layer visual */}
      <section aria-labelledby="tiers-heading">
        <h2 id="tiers-heading" className="font-display text-2xl font-bold text-foreground mb-2">
          DataPlug&apos;s Unique 3-Layer Agent Network
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Most data reseller platforms in Ghana only have a single tier. DataPlug&apos;s unique 3-layer structure lets you build
          a scalable business where your income grows even when you are not actively selling.
        </p>
        <div className="space-y-4">
          {tiers.map((tier, i) => (
            <article key={tier.layer} className={`rounded-xl border p-6 ${tier.color}`}>
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm ${tier.color} ${tier.labelColor}`} aria-hidden="true">
                  {i + 1}
                </div>
                <div className="space-y-1">
                  <p className={`text-xs font-semibold uppercase tracking-widest ${tier.labelColor}`}>{tier.layer}</p>
                  <h3 className="font-display text-lg font-bold text-foreground">{tier.role}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tier.desc}</p>
                  <p className="text-sm font-medium text-foreground mt-2">
                    <span className={tier.labelColor}>Earnings: </span>{tier.earn}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Why DataPlug */}
      <section aria-labelledby="why-agent-heading">
        <h2 id="why-agent-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Why Start a Data Business with DataPlug?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: TrendingUp, title: "Wholesale Prices", body: "Agents buy at prices well below standard rates, creating healthy profit margins on every sale." },
            { icon: Network, title: "Branded Storefront", body: "Each agent gets their own DataPlug storefront link they can share with customers." },
            { icon: DollarSign, title: "Instant Withdrawals", body: "Withdraw your earnings instantly to Mobile Money (MoMo) at any time from your dashboard." },
            { icon: Users, title: "Build Your Network", body: "Create sub-agents under you and earn commissions on their entire sales volume." },
            { icon: Zap, title: "No Stock Needed", body: "DataPlug is fully digital — no physical stock, no storage, no delivery logistics." },
            { icon: Shield, title: "Trusted Platform", body: "DataPlug is Ghana's most established online data platform, trusted by 72,000+ customers." },
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

      {/* Related */}
      <section className="glass rounded-xl border border-border p-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">Related Pages</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { to: "/data-reseller-agent-ghana", label: "Data Reseller Agent Guide" },
            { to: "/data-api-ghana", label: "Data Bundle API for Businesses" },
            { to: "/premium-subscription", label: "Premium Subscription" },
            { to: "/ussd-data-services-ghana", label: "USSD Data Services for Agents" },
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
