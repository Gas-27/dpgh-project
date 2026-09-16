import { Link } from "react-router-dom";
import { TrendingDown, Zap, CheckCircle, Repeat, Users, Shield } from "lucide-react";
import SeoPageLayout from "@/components/SeoPageLayout";

const breadcrumbs = [
  { label: "Home", href: "/" },
  { label: "Cheap Data Bundles Ghana" },
];

const faqs = [
  {
    question: "Why are DataPlug data bundles cheaper than buying directly from the network?",
    answer:
      "DataPlug buys data bundles in bulk from all three Ghanaian networks — MTN, Telecel, and AirtelTigo. Bulk purchasing unlocks wholesale pricing, and we pass those savings on to our customers. The result is consistently lower prices than the direct network USSD or app rates.",
  },
  {
    question: "Which network has the cheapest data bundles in Ghana?",
    answer:
      "Prices change regularly. DataPlug displays live prices for MTN, Telecel, and AirtelTigo side by side on our packages page, so you can always compare and choose the cheapest option for the size you need.",
  },
  {
    question: "Are cheap data bundles on DataPlug reliable?",
    answer:
      "Yes. Low price does not mean lower quality on DataPlug. All bundles are genuine network-sourced data — the same internet speed, coverage, and validity as buying from the network directly, just at a discounted price.",
  },
  {
    question: "What is the cheapest data bundle available in Ghana on DataPlug?",
    answer:
      "DataPlug stocks small daily plans starting from very low prices for all three networks. Visit the packages page to see the current cheapest options — prices are updated in real time.",
  },
  {
    question: "How do I get even cheaper data bundles in Ghana?",
    answer:
      "Sign up as a DataPlug agent or subagent to unlock wholesale pricing — significantly cheaper than the already-discounted customer rates. Agent accounts are free to create and come with a personal storefront you can share with your own customers.",
  },
  {
    question: "Is there a minimum purchase amount for cheap data bundles on DataPlug?",
    answer:
      "No minimum purchase. You can buy a single small bundle for a few Ghana Cedis. There is no commitment or subscription required.",
  },
];

const PILLARS = [
  { icon: TrendingDown, title: "Wholesale Pricing", body: "Bulk-sourced bundles from all 3 networks = consistently cheaper than the direct network price." },
  { icon: Zap, title: "Instant Delivery", body: "Fast delivery to any MTN, Telecel, or AirtelTigo number. No waiting." },
  { icon: CheckCircle, title: "All Networks Covered", body: "One platform for MTN, Telecel, and AirtelTigo cheap data bundles in Ghana." },
  { icon: Repeat, title: "Easy Repeat Purchases", body: "Save favourite numbers and reorder in one click with a DataPlug account." },
  { icon: Users, title: "Agent Discounts Available", body: "Resellers get even cheaper wholesale rates through our free agent programme." },
  { icon: Shield, title: "Secure & Trusted", body: "Paystack payments. No card data stored. Thousands of happy customers." },
];

export default function CheapDataBundlesGhana() {
  return (
    <SeoPageLayout
      title="Cheap Data Bundles Ghana | Buy Affordable Internet Plans | DataPlug"
      canonicalPath="/cheap-data-bundles-ghana"
      breadcrumbs={breadcrumbs}
      headline="Cheap Data Bundles in Ghana"
      subheadline="Buy the cheapest MTN, Telecel, and AirtelTigo data bundles online. Bulk-sourced prices that beat every network's direct rate — instant delivery, 24/7."
      accentClass="text-primary"
      faqs={faqs}
    >
      {/* Intro */}
      <section aria-labelledby="why-cheap">
        <h2
          id="why-cheap"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          Ghana&apos;s Cheapest Online Data Bundle Store
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          DataPlug was built with one goal: make data bundles more affordable for every
          Ghanaian. We source MTN, Telecel, and AirtelTigo bundles in bulk at wholesale
          prices and sell them to customers at rates consistently lower than the official
          network top-up channels — no promo codes needed, no limited-time offers.
          Every day, every plan, every network is priced to beat the competition.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Whether you are looking for cheap MTN data bundles, affordable Telecel internet
          plans, or the best AirtelTigo data deals in Ghana, DataPlug has you covered
          with instant online delivery and zero hidden fees.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {PILLARS.map(({ icon: Icon, title, body }) => (
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

      {/* Network comparison */}
      <section aria-labelledby="network-comparison">
        <h2
          id="network-comparison"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          Compare Cheap Data Bundles Across All Networks
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          DataPlug is the only platform in Ghana where you can compare MTN, Telecel,
          and AirtelTigo data bundle prices side by side and buy the cheapest one
          instantly — all without switching apps or dialing USSD codes.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { network: "MTN Ghana", color: "border-yellow-400/50 text-yellow-400", desc: "Ghana's largest network. Best coverage, wide range of plan sizes.", href: "/mtn-data-bundles" },
            { network: "Telecel Ghana", color: "border-red-400/50 text-red-400", desc: "Strong data infrastructure. Popular for reliable urban connectivity.", href: "/telecel-data-bundles" },
            { network: "AirtelTigo", color: "border-orange-400/50 text-orange-400", desc: "Wide regional coverage. Good value for everyday data users.", href: "/airteltigo-data-bundles" },
          ].map(({ network, color, desc, href }) => (
            <div key={network} className={`glass-sm rounded-xl p-4 border-l-4 ${color.split(" ")[0]}`}>
              <h3 className={`font-bold mb-1 ${color.split(" ")[1]}`}>{network}</h3>
              <p className="text-sm text-muted-foreground mb-3">{desc}</p>
              <Link to={href} className="text-xs text-primary hover:underline font-medium">
                View {network} plans &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section aria-labelledby="save-more">
        <h2
          id="save-more"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          How to Save Even More on Data Bundles in Ghana
        </h2>
        <div className="space-y-4">
          {[
            { title: "Buy larger plans", body: "Bigger bundle sizes always have a lower cost-per-MB than small daily plans. If you use data regularly, a weekly or monthly plan will save you more over time." },
            { title: "Top up your DataPlug wallet", body: "Load your wallet in advance and use it for one-click purchases. This avoids any payment processing delays and keeps your buying history in one place." },
            { title: "Become a DataPlug agent", body: "If you buy data frequently or want to resell to others, an agent account unlocks wholesale prices that are significantly cheaper than the standard customer rate." },
            { title: "Follow DataPlug on social media", body: "We occasionally run promotions and bonus data offers. Following our social channels is the easiest way to catch limited-time deals." },
          ].map(({ title, body }) => (
            <div key={title} className="flex gap-4 items-start">
              <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="cheap-cta" className="glass rounded-2xl p-6 md:p-8">
        <h2 id="cheap-cta" className="font-display text-xl font-bold text-foreground mb-3">
          Start Saving on Data Today
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Thousands of Ghanaians already save money every month by switching from
          direct network top-ups to DataPlug. Compare prices, pick the cheapest bundle,
          and get your data in seconds. No app download required — works on any browser.
        </p>
      </section>
    </SeoPageLayout>
  );
}
