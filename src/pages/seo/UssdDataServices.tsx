import { Link } from "react-router-dom";
import SeoPageLayout from "@/components/SeoPageLayout";
import { Hash, Smartphone, Wifi, Zap, Users, Shield } from "lucide-react";

const faqs = [
  { question: "What is a USSD data service in Ghana?", answer: "USSD (Unstructured Supplementary Service Data) is a mobile communication protocol that allows users to interact with services by dialling short codes like *170# on their phone. DataPlug's USSD service allows agents to sell data bundles and manage transactions even on basic feature phones without internet access." },
  { question: "How do DataPlug agents use USSD services?", answer: "DataPlug agents can access the USSD portal to buy data bundles, check wallet balances, process transactions, and manage their sub-agents — all without needing an internet connection or smartphone. This is particularly useful for agents in rural Ghana." },
  { question: "Can I sell data bundles without a smartphone in Ghana?", answer: "Yes. DataPlug's USSD service is designed to allow agents to operate their data reseller business from any mobile phone — including basic feature phones — by dialling USSD codes. Contact DataPlug to get your USSD access credentials." },
  { question: "What USSD codes do MTN, Telecel, and AirtelTigo use for data in Ghana?", answer: "MTN: *170# (Mobile Money and services). Telecel: *700# (services menu). AirtelTigo: *185# (mobile money and services). However, DataPlug agents get access to simplified USSD codes that process data bundle purchases much more quickly than network-direct codes." },
  { question: "Is USSD available for sub-agents on DataPlug?", answer: "Yes. Main agents, sub-agents, and sub-sub-agents can all access DataPlug's USSD service. This enables agents at every level to process transactions and check balances without needing a smartphone or internet connection." },
];

export default function UssdDataServices() {
  return (
    <SeoPageLayout
      title="USSD Data Services Ghana — Sell Data Without a Smartphone | DataPlug"
      canonicalPath="/ussd-data-services-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Agent Services", href: "/data-agent-business-ghana" },
        { label: "USSD Data Services Ghana" },
      ]}
      headline="USSD Data Services for Agents in Ghana — Sell Data on Any Phone"
      subheadline="DataPlug's USSD service lets agents buy and sell data bundles from any mobile phone — no smartphone or internet connection needed. Perfect for agents across all of Ghana."
      accentClass="text-primary"
      faqs={faqs}
    >
      <section aria-labelledby="what-ussd-heading">
        <h2 id="what-ussd-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          What is USSD and How Does it Work for Data Agents?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          USSD (Unstructured Supplementary Service Data) is a communication protocol built into every mobile phone — including basic feature phones. When you dial a code like <code className="text-primary bg-primary/10 px-1 rounded">*170#</code> on your phone, you are using USSD. It does not require a data connection or smartphone.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          DataPlug has integrated USSD access for its agent network. This means agents — including those in rural areas of Ghana with limited internet access — can use DataPlug to process data bundle sales, check wallet balances, and manage transactions through simple USSD menus on any mobile phone.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Hash, title: "No Internet Needed", body: "USSD works on any mobile network signal — no data connection or Wi-Fi required." },
            { icon: Smartphone, title: "Works on Any Phone", body: "Basic keypad phones, old smartphones, feature phones — USSD works on all of them." },
            { icon: Wifi, title: "Real-Time Transactions", body: "Transactions process in real-time through the DataPlug backend — the same speed as the web platform." },
            { icon: Zap, title: "Instant Delivery", body: "Data bundles purchased via USSD are delivered to the recipient number in seconds." },
            { icon: Users, title: "All Agent Tiers", body: "Main agents, sub-agents, and sub-sub-agents all have access to USSD service." },
            { icon: Shield, title: "Secure Access", body: "PIN-protected USSD sessions ensure only you can access your DataPlug wallet and transactions." },
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

      <section aria-labelledby="who-ussd-heading">
        <h2 id="who-ussd-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Who Benefits Most from DataPlug&apos;s USSD Service?
        </h2>
        <ul className="space-y-3 text-muted-foreground">
          {[
            { title: "Rural Agents", body: "Agents in areas with poor internet coverage can still run a full data reseller business using USSD on 2G or 3G signals." },
            { title: "Market Traders", body: "Traders in busy markets who cannot always use a smartphone app can process data sales quickly via USSD codes." },
            { title: "Schools and Institutions", body: "Schools can set up agent accounts and buy data bundles for students via USSD without requiring a dedicated device." },
            { title: "Sub-Agent Networks", body: "Main agents can empower sub-agents across different regions of Ghana by giving them USSD access rather than requiring smartphones." },
          ].map(({ title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary" aria-hidden="true" />
              <p><span className="font-semibold text-foreground">{title}: </span>{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-xl border border-border p-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">Related Agent Services</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { to: "/data-agent-business-ghana", label: "Build a Data Agent Business" },
            { to: "/data-reseller-agent-ghana", label: "Data Reseller Agent Guide" },
            { to: "/become-agent", label: "Register as an Agent" },
            { to: "/data-api-ghana", label: "Data Bundle API" },
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
