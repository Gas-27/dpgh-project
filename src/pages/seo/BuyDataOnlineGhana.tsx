import SeoPageLayout from "@/components/SeoPageLayout";
import { Link } from "react-router-dom";
import { CheckCircle2, Smartphone, Shield, Zap } from "lucide-react";

const steps = [
  { step: "1", title: "Choose Your Network", body: "Pick MTN, Telecel, or AirtelTigo from the packages page." },
  { step: "2", title: "Select a Bundle", body: "Choose the data size and validity that suits your usage." },
  { step: "3", title: "Enter Recipient Number", body: "Type any active Ghanaian mobile number to receive the data." },
  { step: "4", title: "Pay Securely", body: "Pay via Mobile Money or card through Paystack in seconds." },
  { step: "5", title: "Data Delivered Instantly", body: "The recipient gets their data bundle within moments of payment." },
];

const faqs = [
  {
    question: "How do I buy data online in Ghana?",
    answer: "Visit dataplug.store, select your network (MTN, Telecel, or AirtelTigo), pick a bundle, enter the phone number, and pay via Mobile Money or card. Data is delivered instantly.",
  },
  {
    question: "Which networks can I buy data for on DataPlug?",
    answer: "DataPlug supports all three major Ghanaian networks: MTN Ghana, Telecel Ghana, and AirtelTigo Ghana.",
  },
  {
    question: "Can I buy data for someone else's number?",
    answer: "Yes. DataPlug allows you to buy data for any valid MTN, Telecel, or AirtelTigo number in Ghana — not just your own.",
  },
  {
    question: "Is it safe to buy data online in Ghana?",
    answer: "Yes. DataPlug uses Paystack, Ghana's leading payment gateway, for all transactions. Your card and Mobile Money details are never stored on our servers.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept MTN MoMo, Telecel Cash, AirtelTigo Money, Visa, and Mastercard through Paystack.",
  },
  {
    question: "Do I need an account to buy data?",
    answer: "No account is required for a one-off purchase. Creating a free account gives you order history and access to discounted agent prices.",
  },
];

export default function BuyDataOnlineGhana() {
  return (
    <SeoPageLayout
      title="Buy Data Online in Ghana — MTN, Telecel & AirtelTigo"
      description="Buy data bundles online in Ghana for MTN, Telecel, and AirtelTigo. Instant delivery, lowest prices, pay with Mobile Money or card. Available 24/7 on DataPlug."
      canonicalPath="/buy-data-online-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Buy Data Online Ghana" },
      ]}
      headline="Buy Data Online in Ghana — Instant, Safe & Cheap"
      subheadline="The fastest way to buy data bundles in Ghana for any MTN, Telecel, or AirtelTigo number. Pay with Mobile Money or card and get data in seconds — no USSD, no queues."
      faqs={faqs}
    >
      {/* How it works */}
      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          How to Buy Data Online in Ghana (5 Steps)
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5" role="list">
          {steps.map(({ step, title, body }) => (
            <li key={step} className="glass rounded-xl border border-border p-5 space-y-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold font-display">
                {step}
              </span>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why DataPlug */}
      <section aria-labelledby="why-heading">
        <h2 id="why-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          Why Buy Data Online on DataPlug?
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { icon: Zap, title: "Instant Delivery", body: "Data reaches the recipient number within seconds — no waiting or manual activation needed." },
            { icon: Shield, title: "100% Secure Payments", body: "Every transaction goes through Paystack, PCI-DSS compliant and trusted by millions in Ghana." },
            { icon: Smartphone, title: "All Networks Covered", body: "Buy MTN, Telecel, and AirtelTigo data bundles from a single platform, 24 hours a day." },
            { icon: CheckCircle2, title: "No Account Required", body: "Guest checkout available. Create an account for order history and access to wholesale reseller prices." },
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

      {/* Network links */}
      <section aria-labelledby="networks-heading">
        <h2 id="networks-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Choose Your Network
        </h2>
        <nav aria-label="Network guide links" className="flex flex-wrap gap-3">
          {[
            { to: "/mtn-data-bundles", label: "MTN Data Bundles", color: "border-yellow-400/40 text-yellow-400 bg-yellow-400/5 hover:bg-yellow-400/10" },
            { to: "/telecel-data-bundles", label: "Telecel Data Bundles", color: "border-red-400/40 text-red-400 bg-red-400/5 hover:bg-red-400/10" },
            { to: "/airteltigo-data-bundles", label: "AirtelTigo Data Bundles", color: "border-orange-400/40 text-orange-400 bg-orange-400/5 hover:bg-orange-400/10" },
            { to: "/cheap-data-bundles-ghana", label: "Cheap Data Bundles", color: "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10" },
          ].map(({ to, label, color }) => (
            <Link key={to} to={to} className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${color}`}>
              {label}
            </Link>
          ))}
        </nav>
      </section>
    </SeoPageLayout>
  );
}
