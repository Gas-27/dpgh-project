import { Link } from "react-router-dom";
import { Code2, Zap, Shield, BarChart3, Globe, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import SeoPageLayout from "@/components/SeoPageLayout";

const breadcrumbs = [
  { label: "Home", href: "/" },
  { label: "Data API Ghana" },
];

const faqs = [
  {
    question: "What is the DataPlug Ghana data bundle API?",
    answer:
      "The DataPlug API allows developers and businesses to programmatically purchase MTN, Telecel, and AirtelTigo data bundles in Ghana from their own applications. You send an API request with the bundle ID and recipient number, and DataPlug delivers the data and returns a confirmation — no manual steps required.",
  },
  {
    question: "Who can use the DataPlug data bundle API?",
    answer:
      "The DataPlug API is available to registered agents and approved business accounts. Use cases include fintech apps, mobile wallets, e-commerce reward systems, automated top-up services, and any application that needs to programmatically deliver mobile data in Ghana.",
  },
  {
    question: "Which networks does the DataPlug API support?",
    answer:
      "The API supports MTN Ghana, Telecel Ghana, and AirtelTigo — all three major Ghanaian mobile networks. You can query available bundles and prices for all networks through a single API endpoint.",
  },
  {
    question: "How do I get API access for buying data bundles in Ghana?",
    answer:
      "Create a DataPlug agent account, then contact our support team via WhatsApp or email to request API access. We will provide you with an API key and the full documentation to get started.",
  },
  {
    question: "Is the DataPlug data bundle API reliable and fast?",
    answer:
      "Yes. DataPlug processes thousands of API orders daily with a typical response time of under 3 seconds. Our infrastructure is built for high-volume automated purchases with 99%+ uptime.",
  },
  {
    question: "What does the DataPlug API cost?",
    answer:
      "API access itself has no separate fee. You pay the standard wholesale data bundle price for each transaction, plus a small per-transaction fee for high-volume API users. Contact us for volume pricing details.",
  },
];

const FEATURES = [
  { icon: Zap, title: "Instant Data Delivery", body: "API orders are processed and delivered within seconds — same speed as the dashboard." },
  { icon: Code2, title: "Simple REST API", body: "Standard JSON over HTTPS. Integrate with any language or framework in minutes." },
  { icon: Shield, title: "Secure API Keys", body: "Each API key is scoped to your account. Rate limiting and IP whitelisting available." },
  { icon: BarChart3, title: "Order Tracking", body: "Every API transaction returns a unique order ID you can use to query status." },
  { icon: Globe, title: "All 3 Networks", body: "MTN, Telecel, and AirtelTigo available through a single unified API endpoint." },
  { icon: Repeat, title: "Bulk Order Support", body: "Process multiple data orders in a single API call for high-volume use cases." },
];

export default function DataApiGhana() {
  return (
    <SeoPageLayout
      title="Ghana Data Bundle API | Buy MTN, Telecel & AirtelTigo Data Programmatically | DataPlug"
      canonicalPath="/data-api-ghana"
      breadcrumbs={breadcrumbs}
      headline="Ghana Data Bundle API"
      subheadline="Programmatically buy MTN, Telecel, and AirtelTigo data bundles in Ghana via REST API. Instant delivery, simple integration, wholesale pricing."
      accentClass="text-primary"
      faqs={faqs}
    >
      {/* Intro */}
      <section aria-labelledby="api-intro">
        <h2
          id="api-intro"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          Automate Data Bundle Purchases in Ghana
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The DataPlug Data Bundle API lets developers and businesses integrate Ghanaian
          mobile data purchases directly into their applications. Whether you are building
          a fintech platform, a mobile wallet, a rewards system, or an automated
          top-up service, the DataPlug API gives you programmatic access to MTN,
          Telecel, and AirtelTigo data bundles at wholesale pricing.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          The API is RESTful, returns JSON, and requires no special SDK. If your
          application can make an HTTPS POST request, you can start buying data bundles
          in Ghana programmatically.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
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

      {/* Use cases */}
      <section aria-labelledby="api-use-cases">
        <h2
          id="api-use-cases"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          API Use Cases
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { title: "Fintech & Mobile Wallets", desc: "Allow your wallet app users to buy data bundles as a native feature — no redirect to an external site." },
            { title: "E-Commerce Loyalty Rewards", desc: "Reward customers with data bundles automatically when they reach a purchase milestone or refer a friend." },
            { title: "Corporate Data Top-Up", desc: "Automate monthly data allowances for employees across all three networks from a single script." },
            { title: "Data Reseller Platforms", desc: "Build your own branded data bundle selling app on top of the DataPlug API without managing network integrations yourself." },
            { title: "ISP & MVNO Systems", desc: "Integrate Ghanaian mobile data purchasing into your existing internet service provider backend." },
            { title: "HR & Payroll Systems", desc: "Include data bundles as part of employee benefits — distributed automatically each month via API." },
          ].map(({ title, desc }) => (
            <div key={title} className="glass-sm rounded-xl p-4 border-l-4 border-primary/40">
              <h3 className="font-semibold text-foreground mb-1 text-sm">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to get access */}
      <section aria-labelledby="api-access">
        <h2
          id="api-access"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          How to Get API Access
        </h2>
        <ol className="space-y-4 list-none">
          {[
            { step: "1", title: "Create an agent account", body: "Register at dataplug.store/signup. API access is available to agent-tier accounts and above." },
            { step: "2", title: "Contact us to request API access", body: "Send a WhatsApp message or email with your account details and your intended use case." },
            { step: "3", title: "Receive your API key and documentation", body: "We will send you a secure API key and full endpoint documentation, including code examples in JavaScript, Python, and PHP." },
            { step: "4", title: "Fund your wallet", body: "API orders deduct from your DataPlug wallet balance. Fund it in advance to avoid interruptions." },
            { step: "5", title: "Start sending API requests", body: "Make your first test request and verify that data is delivered to the target number. Production integration typically takes less than an hour." },
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
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Button variant="hero" size="lg" asChild>
            <Link to="/signup">Create Agent Account</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a href="https://wa.me/233000000000" target="_blank" rel="noopener noreferrer">
              Request API Access via WhatsApp
            </a>
          </Button>
        </div>
      </section>

      <section aria-labelledby="api-trust" className="glass rounded-2xl p-6 md:p-8">
        <h2 id="api-trust" className="font-display text-xl font-bold text-foreground mb-3">
          Built for Ghana&apos;s Developer Ecosystem
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          DataPlug&apos;s API is already powering automated data purchases for businesses
          in Ghana. Our infrastructure handles thousands of API requests daily and is
          designed to scale with your usage. We offer dedicated support for API
          integrators to ensure smooth onboarding and ongoing reliability.
        </p>
      </section>
    </SeoPageLayout>
  );
}
