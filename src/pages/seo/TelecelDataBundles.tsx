import { Link } from "react-router-dom";
import { CheckCircle, Zap, Shield, Clock, Star, Smartphone } from "lucide-react";
import SeoPageLayout from "@/components/SeoPageLayout";

const breadcrumbs = [
  { label: "Home", href: "/" },
  { label: "Data Bundles", href: "/packages" },
  { label: "Telecel Data Bundles" },
];

const faqs = [
  {
    question: "How fast are Telecel data bundles delivered through DataPlug?",
    answer:
      "Telecel data bundles purchased through DataPlug are delivered instantly — usually within a few seconds of payment confirmation. There is no beneficiary verification delay for Telecel numbers.",
  },
  {
    question: "What Telecel data bundle plans are available on DataPlug?",
    answer:
      "DataPlug stocks Telecel daily, weekly, and monthly data bundle plans for Ghana. Bundle sizes range from small 100MB day packs to large 50GB+ monthly plans. Check the packages page for the latest available plans and prices.",
  },
  {
    question: "Can I buy Telecel data for someone else?",
    answer:
      "Yes. You can buy Telecel data for any Telecel Ghana number. Simply enter the recipient's number during checkout. There is no restriction on buying for others.",
  },
  {
    question: "Is Telecel data from DataPlug genuine?",
    answer:
      "Yes. DataPlug is an authorised reseller and sources all Telecel bundles directly from the network. You will receive the exact data allocation shown at checkout — no tricks, no partial deliveries.",
  },
  {
    question: "What payment methods can I use to buy Telecel data?",
    answer:
      "DataPlug accepts Mobile Money (MoMo, Telecel Cash, AirtelTigo Money) and all major debit and credit cards through Paystack. Wallet top-up is also available for faster repeat purchases.",
  },
  {
    question: "Is there a refund if my Telecel data order fails?",
    answer:
      "If a Telecel data order fails, your payment is automatically refunded to your DataPlug wallet or original payment method. Contact our WhatsApp support if a refund does not reflect within 24 hours.",
  },
];

const BENEFITS = [
  { icon: Zap, title: "Instant Delivery", body: "Telecel bundles credited to the recipient number within seconds of payment." },
  { icon: CheckCircle, title: "Genuine Bundles", body: "Sourced directly from Telecel Ghana — same bundles, lower price." },
  { icon: Shield, title: "Secure Checkout", body: "Paystack-powered payments. Cards encrypted and never stored." },
  { icon: Clock, title: "Available 24/7", body: "Buy Telecel data at any hour, including weekends and public holidays." },
  { icon: Star, title: "Best Prices", body: "Bulk sourcing means DataPlug prices beat direct Telecel top-up rates." },
  { icon: Smartphone, title: "Buy for Any Number", body: "Top up your own Telecel line or send data to friends and family." },
];

export default function TelecelDataBundles() {
  return (
    <SeoPageLayout
      title="Buy Telecel Data Bundles in Ghana | DataPlug"
      canonicalPath="/telecel-data-bundles"
      breadcrumbs={breadcrumbs}
      headline="Buy Telecel Data Bundles in Ghana"
      subheadline="Affordable Telecel Ghana data bundles delivered instantly to any Telecel number. No queues, no store visits — buy online in under 60 seconds."
      accentClass="text-red-400"
      faqs={faqs}
    >
      {/* Intro */}
      <section aria-labelledby="why-dataplug-telecel">
        <h2
          id="why-dataplug-telecel"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          Why Buy Telecel Data Bundles on DataPlug?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Telecel Ghana (formerly Vodafone Ghana) is one of the country&apos;s major
          mobile networks, known for its strong data infrastructure. DataPlug makes buying
          Telecel data bundles fast, cheap, and convenient — no need to visit a Telecel
          service centre or use USSD codes. Buy directly from your phone or computer,
          pay with MoMo or card, and the data arrives in seconds.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass rounded-xl p-5 flex flex-col gap-3">
              <div className="flex-shrink-0 rounded-lg bg-red-400/10 p-2 w-fit">
                <Icon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section aria-labelledby="telecel-plans">
        <h2
          id="telecel-plans"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          Telecel Ghana Data Bundle Plans
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          DataPlug&apos;s Telecel catalogue covers the most popular plan sizes so you can
          find exactly the right bundle for your usage — from a quick social-media boost
          to a full month of unlimited streaming.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: "Daily Bundles", desc: "Small plans for light use — social media, WhatsApp, and short browsing sessions. Valid for 24 hours." },
            { label: "Weekly Bundles", desc: "Mid-size plans ideal for regular users who want a week of comfortable browsing. Valid for 7 days." },
            { label: "Monthly Bundles", desc: "High-capacity plans for heavy users, streaming, remote work, and gaming. Valid for 30 days." },
          ].map(({ label, desc }) => (
            <div key={label} className="glass-sm rounded-xl p-4 border-l-4 border-red-400/50">
              <h3 className="font-semibold text-foreground mb-1">{label}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-muted-foreground text-sm">
          See live prices on the{" "}
          <Link to="/packages" className="text-primary hover:underline font-medium">
            data packages page
          </Link>
          .
        </p>
      </section>

      {/* How to buy */}
      <section aria-labelledby="how-to-buy-telecel">
        <h2
          id="how-to-buy-telecel"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          How to Buy Telecel Data Bundles Online
        </h2>
        <ol className="space-y-4 list-none">
          {[
            { step: "1", title: "Visit the Packages page", body: "Browse the full Telecel data catalogue with real-time prices." },
            { step: "2", title: "Pick your bundle", body: "Select the size and validity that suits your needs." },
            { step: "3", title: "Enter the Telecel number", body: "Type the recipient Telecel Ghana number (yours or someone else's)." },
            { step: "4", title: "Pay with MoMo or card", body: "Complete the secure Paystack checkout in under 30 seconds." },
            { step: "5", title: "Receive your data instantly", body: "The bundle is credited to the Telecel number immediately after payment." },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4 items-start">
              <div className="flex-shrink-0 rounded-full bg-red-400/20 text-red-400 font-bold text-sm w-8 h-8 flex items-center justify-center">
                {step}
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="telecel-trust" className="glass rounded-2xl p-6 md:p-8">
        <h2 id="telecel-trust" className="font-display text-xl font-bold text-foreground mb-3">
          Ghana&apos;s Trusted Telecel Data Reseller
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          DataPlug processes Telecel data orders around the clock for customers across
          all regions of Ghana. Our platform is designed to be simple enough to use on
          any phone, including entry-level smartphones. Support is always a WhatsApp
          message away.
        </p>
      </section>
    </SeoPageLayout>
  );
}
