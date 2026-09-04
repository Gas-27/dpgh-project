import { Link } from "react-router-dom";
import { TrendingUp, Store, Users, Wallet, BarChart3, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import SeoPageLayout from "@/components/SeoPageLayout";

const breadcrumbs = [
  { label: "Home", href: "/" },
  { label: "Become an Agent", href: "/become-agent" },
  { label: "Data Reseller Business Ghana" },
];

const faqs = [
  {
    question: "How do I start a data reseller business in Ghana with DataPlug?",
    answer:
      "Register for a free DataPlug agent account at dataplug.store/signup. Once approved, you will get a personal storefront link to share with your customers, a funded wallet to buy wholesale data bundles, and access to the agent dashboard to manage orders and sub-agents.",
  },
  {
    question: "How much does it cost to become a DataPlug data reseller agent?",
    answer:
      "Creating an agent account on DataPlug is completely free. There are no monthly fees, no registration fees, and no minimum purchase requirements. You only pay for the data bundles you buy to sell to customers.",
  },
  {
    question: "How much can I earn as a DataPlug data reseller in Ghana?",
    answer:
      "Your earnings depend on how many bundles you sell and your margin. DataPlug agents buy at wholesale prices and set their own retail prices. Typical agents earn between GHS 200 and GHS 2,000+ per month depending on their customer volume.",
  },
  {
    question: "Can I have my own data bundle storefront website?",
    answer:
      "Yes. Every DataPlug agent gets a free personal storefront — a dedicated branded page you can share with customers. Your customers can browse bundles and place orders directly through your storefront, with sales credited to your account.",
  },
  {
    question: "Can I recruit sub-agents under my DataPlug agent account?",
    answer:
      "Yes. DataPlug supports a multi-tier agency model. As an agent you can recruit sub-agents, and sub-agents can recruit sub-sub-agents. You earn a margin on every sale made by agents in your network.",
  },
  {
    question: "What networks can DataPlug agents sell data bundles for?",
    answer:
      "DataPlug agents can sell MTN, Telecel, and AirtelTigo data bundles, as well as MTN AFA registration services. All three networks are available at wholesale pricing from a single dashboard.",
  },
  {
    question: "Do I need any technical skills to run a data reseller business on DataPlug?",
    answer:
      "No technical skills are needed. The DataPlug agent dashboard is designed to be simple and usable on any smartphone. You can manage orders, top up your wallet, and track earnings from a single screen.",
  },
];

const BENEFITS = [
  { icon: TrendingUp, title: "Wholesale Pricing", body: "Buy MTN, Telecel, and AirtelTigo bundles at bulk rates and sell at your own price." },
  { icon: Store, title: "Free Personal Storefront", body: "Get a branded store page to share with your customers — no website needed." },
  { icon: Users, title: "Multi-Tier Network", body: "Recruit sub-agents and earn on every bundle they sell within your network." },
  { icon: Wallet, title: "Instant Wallet System", body: "Fund your wallet once and process orders instantly — no payment friction." },
  { icon: BarChart3, title: "Real-Time Dashboard", body: "Track all orders, sales, earnings, and sub-agent activity from one screen." },
  { icon: Shield, title: "Zero Registration Fee", body: "Agent accounts are completely free. No monthly subscription, ever." },
];

export default function DataResellerAgent() {
  return (
    <SeoPageLayout
      title="Start a Data Reseller Business in Ghana | DataPlug Agent Programme"
      canonicalPath="/data-reseller-agent-ghana"
      breadcrumbs={breadcrumbs}
      headline="Start a Data Reseller Business in Ghana"
      subheadline="Become a DataPlug agent and sell MTN, Telecel, and AirtelTigo data bundles at wholesale prices. Free storefront, real-time dashboard, multi-tier earnings."
      accentClass="text-primary"
      faqs={faqs}
    >
      {/* Intro */}
      <section aria-labelledby="agent-intro">
        <h2
          id="agent-intro"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          The DataPlug Agent Programme
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          DataPlug offers one of Ghana&apos;s most generous data reseller programmes.
          As an agent, you buy MTN, Telecel, and AirtelTigo data bundles at wholesale
          prices and resell them to customers at a margin you set yourself. Your
          customers order through your personal DataPlug storefront, and you earn on
          every sale — all tracked in real time through your dashboard.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          The programme is completely free to join and works from any smartphone.
          Whether you are starting a side hustle or building a full-time data reseller
          business in Ghana, DataPlug gives you the tools to do it without any
          technical knowledge or upfront investment.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass rounded-xl p-5 flex flex-col gap-3">
              <div className="flex-shrink-0 rounded-lg bg-primary/10 p-2 w-fit">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section aria-labelledby="agent-tiers">
        <h2
          id="agent-tiers"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          Agent, Sub-Agent, and Sub-Sub-Agent Tiers
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          DataPlug uses a three-tier agency model that lets you build a network of
          resellers under your account and earn passive income from their sales.
        </p>
        <div className="grid gap-4">
          {[
            { tier: "Agent", price: "Free", desc: "Direct access to wholesale data pricing. Personal storefront. Full dashboard access. Earn on every sale you process directly." },
            { tier: "Sub-Agent", price: "Under an Agent", desc: "Recruited by an agent. Gets their own storefront and dashboard at the agent's wholesale rate. A portion of each sale goes to the parent agent." },
            { tier: "Sub-Sub-Agent", price: "Under a Sub-Agent", desc: "The third tier. Has their own storefront and earns on their own sales. Both the sub-agent and agent above them earn a share of each sale." },
          ].map(({ tier, price, desc }) => (
            <div key={tier} className="glass-sm rounded-xl p-5 flex flex-col md:flex-row gap-4">
              <div className="md:w-40 flex-shrink-0">
                <div className="font-display font-bold text-lg text-primary">{tier}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{price}</div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to start */}
      <section aria-labelledby="how-to-start">
        <h2
          id="how-to-start"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          How to Start Your Data Reseller Business
        </h2>
        <ol className="space-y-4 list-none">
          {[
            { step: "1", title: "Register for free", body: "Create your agent account at dataplug.store/signup. Approval is fast — usually within the same day." },
            { step: "2", title: "Fund your wallet", body: "Top up your DataPlug wallet with the amount you want to invest. This becomes your buying power for wholesale bundles." },
            { step: "3", title: "Share your storefront", body: "Every agent gets a unique storefront link. Share it with customers via WhatsApp, social media, or word of mouth." },
            { step: "4", title: "Process orders and earn", body: "When a customer buys from your storefront, the data is delivered instantly and your wallet margin is credited automatically." },
            { step: "5", title: "Grow by recruiting sub-agents", body: "Bring other resellers into your network and earn a percentage on every bundle they sell." },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4 items-start">
              <div className="flex-shrink-0 rounded-full bg-primary/20 text-primary font-bold text-sm w-8 h-8 flex items-center justify-center">
                {step}
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <Button variant="hero" size="lg" asChild>
            <Link to="/become-agent">Register as an Agent Today</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="agent-trust" className="glass rounded-2xl p-6 md:p-8">
        <h2 id="agent-trust" className="font-display text-xl font-bold text-foreground mb-3">
          A Growing Network of Ghana Data Resellers
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          DataPlug agents operate across all regions of Ghana — from market traders in
          Accra to university campus resellers in Kumasi and Tamale. Our platform is
          built to support any scale of reseller business, from a single agent selling to
          close friends to an organised network of dozens of sub-agents.
        </p>
      </section>
    </SeoPageLayout>
  );
}
