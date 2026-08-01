import SeoPageLayout from "@/components/SeoPageLayout";
import { Link } from "react-router-dom";
import { Users, Wallet, TrendingUp, BadgeCheck } from "lucide-react";

const steps = [
  { n: "1", title: "Sign Up for Free", body: "Create a DataPlug account with your name, email, and phone number." },
  { n: "2", title: "Contact Your Agent", body: "Your referring DataPlug agent adds you to their sub-agent network inside their dashboard." },
  { n: "3", title: "Fund Your Wallet", body: "Load your sub-agent wallet via Mobile Money. No minimum deposit required." },
  { n: "4", title: "Start Selling", body: "Buy data bundles at your sub-agent rate and resell to customers at retail price." },
  { n: "5", title: "Earn Every Day", body: "Your margin is automatically added to your wallet on every successful sale." },
];

const faqs = [
  {
    question: "What is a DataPlug sub-agent?",
    answer: "A DataPlug sub-agent is a reseller who joins the platform under an existing agent. Sub-agents get discounted data bundle prices and can sell at retail price to earn the margin.",
  },
  {
    question: "How much can I earn as a DataPlug sub-agent?",
    answer: "Earnings depend on your sales volume. Sub-agents who sell 50–100 bundles per day can earn GHS 200–500 or more per month in margin income. The more you sell, the more you earn.",
  },
  {
    question: "Do I need any experience to become a sub-agent?",
    answer: "No experience needed. DataPlug provides all the tools — dashboard, wallet, and order history — to start selling immediately after registration.",
  },
  {
    question: "How is a sub-agent different from a regular DataPlug agent?",
    answer: "Agents join DataPlug directly and can onboard their own sub-agents. Sub-agents join under an existing agent. Both get discounted prices, but agents have more control and can build their own downline.",
  },
  {
    question: "Can I become a full agent after starting as a sub-agent?",
    answer: "Yes. Sub-agents who demonstrate consistent sales can request an upgrade to full agent status, unlocking deeper discounts and the ability to recruit their own sub-agents.",
  },
];

export default function BecomeSubAgent() {
  return (
    <SeoPageLayout
      title="Become a DataPlug Sub-Agent — Earn Selling Data Bundles in Ghana"
      description="Join the DataPlug sub-agent programme and earn money selling MTN, Telecel, and AirtelTigo data bundles in Ghana. Free to join, instant wallet, no experience needed."
      canonicalPath="/become-sub-agent"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Agent Programme", href: "/data-reseller-agent-ghana" },
        { label: "Become a Sub-Agent" },
      ]}
      headline="Become a DataPlug Sub-Agent — Earn from Data Reselling in Ghana"
      subheadline="Join Ghana's fastest-growing data reseller network as a sub-agent. Get below-retail prices, an instant wallet, and start earning on every bundle you sell — no experience or upfront cost needed."
      faqs={faqs}
    >
      {/* Benefits */}
      <section aria-labelledby="benefits-heading">
        <h2 id="benefits-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          Sub-Agent Benefits
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { icon: TrendingUp, title: "Earn on Every Sale", body: "Your margin is the difference between your sub-agent price and the retail price you charge customers — yours to keep." },
            { icon: Wallet, title: "Wallet-Based System", body: "Fund your sub-agent wallet once and buy as many bundles as you want with instant delivery." },
            { icon: Users, title: "Backed by Your Agent", body: "Your sponsoring agent supports you with pricing, account setup, and technical questions." },
            { icon: BadgeCheck, title: "Trusted Platform", body: "DataPlug is trusted by over 72,000 customers and thousands of resellers across Ghana." },
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

      {/* Steps */}
      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          How to Become a Sub-Agent in 5 Steps
        </h2>
        <ol className="space-y-4" role="list">
          {steps.map(({ n, title, body }) => (
            <li key={n} className="flex gap-4 glass rounded-xl border border-border p-4">
              <span className="flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm font-display">{n}</span>
              <div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Related links */}
      <section aria-labelledby="related-heading">
        <h2 id="related-heading" className="font-display text-xl font-bold text-foreground mb-4">Related Pages</h2>
        <nav aria-label="Agent programme related links" className="flex flex-wrap gap-3">
          <Link to="/data-reseller-agent-ghana" className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">Data Reseller Agent Programme</Link>
          <Link to="/data-agent-business-ghana" className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">Build a Data Agent Business</Link>
          <Link to="/wholesale-data-bundles-ghana" className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-primary/40 transition-colors">Wholesale Data Bundle Prices</Link>
          <Link to="/signup" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">Sign Up Now</Link>
        </nav>
      </section>
    </SeoPageLayout>
  );
}
