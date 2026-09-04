import SeoPageLayout from "@/components/SeoPageLayout";
import { Link } from "react-router-dom";

const bundleTypes = [
  { type: "Daily Bundles", validity: "24 hours", bestFor: "Light browsing, WhatsApp, quick checks", networks: ["MTN", "Telecel", "AirtelTigo"] },
  { type: "Weekly Bundles", validity: "7 days", bestFor: "Regular social media, video calls, streaming", networks: ["MTN", "Telecel", "AirtelTigo"] },
  { type: "Monthly Bundles", validity: "30 days", bestFor: "Heavy users, businesses, students, remote workers", networks: ["MTN", "Telecel", "AirtelTigo"] },
  { type: "Night Bundles", validity: "Midnight–5am", bestFor: "Downloads, updates, streaming at off-peak rates", networks: ["MTN"] },
];

const faqs = [
  {
    question: "What are internet bundles in Ghana?",
    answer: "Internet bundles (also called data bundles) are prepaid packages of mobile internet data sold by Ghana's networks — MTN, Telecel, and AirtelTigo. They are valid for a set period (daily, weekly, or monthly) and cover a set amount of data (e.g. 1GB, 5GB, 10GB).",
  },
  {
    question: "Which network has the best internet bundles in Ghana in 2026?",
    answer: "MTN Ghana generally has the widest coverage and largest bundle range. Telecel offers competitive pricing on mid-size bundles. AirtelTigo is strong in specific regions. DataPlug offers all three so you can compare and buy the best deal for your location.",
  },
  {
    question: "How do I activate internet bundles in Ghana?",
    answer: "With DataPlug, you don't need to activate bundles manually — they are delivered instantly to the recipient's number after purchase. For network-direct USSD codes, each network has its own activation dial code.",
  },
  {
    question: "Can I share internet bundles with family in Ghana?",
    answer: "Yes. DataPlug lets you buy data for any MTN, Telecel, or AirtelTigo number — so you can easily top up your family's data from one account.",
  },
  {
    question: "What is the cheapest internet bundle in Ghana?",
    answer: "The cheapest bundles available vary by network and bundle size. DataPlug consistently offers below-retail prices, especially for agent-registered users who get wholesale rates.",
  },
  {
    question: "Do Ghana internet bundles work for WhatsApp and TikTok?",
    answer: "Yes. Standard internet bundles from MTN, Telecel, and AirtelTigo work for all apps including WhatsApp, TikTok, YouTube, Facebook, Instagram, and web browsing.",
  },
];

export default function InternetBundlesGhana() {
  return (
    <SeoPageLayout
      title="Internet Bundles Ghana — Buy MTN, Telecel & AirtelTigo Data"
      description="Compare and buy internet bundles in Ghana for MTN, Telecel, and AirtelTigo. Daily, weekly, and monthly data plans at the cheapest prices on DataPlug."
      canonicalPath="/internet-bundles-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Internet Bundles Ghana" },
      ]}
      headline="Internet Bundles in Ghana — Compare & Buy All Networks"
      subheadline="Browse daily, weekly, and monthly internet bundles for MTN, Telecel, and AirtelTigo Ghana. DataPlug delivers the cheapest data prices with instant activation on every number."
      faqs={faqs}
    >
      {/* Bundle types */}
      <section aria-labelledby="types-heading">
        <h2 id="types-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          Types of Internet Bundles in Ghana
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {bundleTypes.map(({ type, validity, bestFor, networks }) => (
            <article key={type} className="glass rounded-xl border border-border p-5 space-y-2">
              <h3 className="font-display font-bold text-foreground">{type}</h3>
              <p className="text-xs text-primary font-medium">Validity: {validity}</p>
              <p className="text-sm text-muted-foreground">{bestFor}</p>
              <div className="flex gap-1.5 flex-wrap">
                {networks.map((n) => (
                  <span key={n} className="rounded-full bg-secondary/60 px-2 py-0.5 text-xs text-muted-foreground">{n}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Network guides */}
      <section aria-labelledby="network-guide-heading">
        <h2 id="network-guide-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Internet Bundles by Network
        </h2>
        <nav aria-label="Network guide links" className="grid gap-3 sm:grid-cols-3">
          {[
            { to: "/mtn-data-bundles", label: "MTN Internet Bundles", sub: "Ghana's largest mobile network", color: "border-yellow-400/30 hover:border-yellow-400/60" },
            { to: "/telecel-data-bundles", label: "Telecel Internet Bundles", sub: "Competitive pricing, strong in Accra", color: "border-red-400/30 hover:border-red-400/60" },
            { to: "/airteltigo-data-bundles", label: "AirtelTigo Internet Bundles", sub: "Strong northern and regional coverage", color: "border-orange-400/30 hover:border-orange-400/60" },
          ].map(({ to, label, sub, color }) => (
            <Link key={to} to={to} className={`glass rounded-xl border p-4 space-y-1 transition-colors ${color}`}>
              <p className="font-semibold text-foreground text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </Link>
          ))}
        </nav>
      </section>

      {/* Tips */}
      <section aria-labelledby="tips-heading">
        <h2 id="tips-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Tips for Choosing the Right Internet Bundle in Ghana
        </h2>
        <ul className="space-y-3 text-sm text-muted-foreground" role="list">
          {[
            "Check your average monthly data usage before choosing a plan — most smartphone users in Ghana use 3–8 GB per month.",
            "Weekly bundles often offer better value-for-money than daily bundles if you use data regularly.",
            "MTN night bundles are excellent for downloads and updates — valid from midnight to 5am at very low cost.",
            "If you share data with family, buying from a DataPlug agent account lets you top up multiple numbers from a single wallet.",
            "Monthly bundles are the most cost-effective for heavy users, students, and remote workers.",
          ].map((tip, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex-shrink-0 text-primary font-bold">{i + 1}.</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>
    </SeoPageLayout>
  );
}
