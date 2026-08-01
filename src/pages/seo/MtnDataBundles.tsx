import { Link } from "react-router-dom";
import { CheckCircle, Zap, Shield, Clock, Star, Smartphone } from "lucide-react";
import SeoPageLayout from "@/components/SeoPageLayout";

const breadcrumbs = [
  { label: "Home", href: "/" },
  { label: "Data Bundles", href: "/packages" },
  { label: "MTN Data Bundles" },
];

const faqs = [
  {
    question: "How long does it take to receive MTN data bundles from DataPlug?",
    answer:
      "For numbers already verified in our system, MTN data bundles are delivered within seconds of payment confirmation. New MTN numbers require a one-time beneficiary verification by MTN, which may take a few hours, but all future purchases to that number will be instant.",
  },
  {
    question: "What MTN data bundle sizes are available on DataPlug?",
    answer:
      "DataPlug offers a wide range of MTN data bundles in Ghana — from small daily plans (100MB, 500MB) to weekly bundles (1GB, 2GB, 5GB) and monthly plans (10GB, 20GB, 50GB, 100GB). Plans are updated regularly to match what MTN makes available.",
  },
  {
    question: "Can I buy MTN data for someone else in Ghana?",
    answer:
      "Yes. On DataPlug you can buy MTN data bundles for any MTN Ghana number, not just your own. Just enter the recipient's number when checking out. This makes DataPlug ideal for sending data as a gift or topping up family and friends.",
  },
  {
    question: "Is it safe to buy MTN data bundles online from DataPlug?",
    answer:
      "Absolutely. DataPlug uses Paystack for all payments — a PCI-DSS compliant payment gateway trusted by thousands of businesses across Ghana. Your card details are never stored on our servers.",
  },
  {
    question: "What happens if my MTN data purchase fails?",
    answer:
      "If an order fails after payment, your wallet or card is fully refunded within 1–3 business days. You can also retry the purchase immediately on a successful wallet refund. Our support team is available on WhatsApp to assist with any issues.",
  },
  {
    question: "Do I need an account to buy MTN data on DataPlug?",
    answer:
      "You can browse and buy data as a guest using the Quick Buy feature on our homepage. Creating a free account gives you order history, a wallet for faster checkout, and access to discounted agent pricing.",
  },
  {
    question: "Why is DataPlug cheaper than buying MTN data directly?",
    answer:
      "DataPlug is an authorised MTN data reseller and buys bundles in bulk, passing those savings on to customers. Our prices are consistently lower than the MTN direct top-up price for the same bundle.",
  },
];

const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "MTN Ghana Data Bundles",
  description:
    "Buy affordable MTN Ghana data bundles online. Instant delivery to any MTN number in Ghana. Daily, weekly, and monthly internet plans.",
  brand: { "@type": "Brand", name: "MTN Ghana" },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "GHS",
    lowPrice: "1.00",
    highPrice: "500.00",
    offerCount: "30",
    availability: "https://schema.org/InStock",
    seller: { "@type": "Organization", name: "DataPlug Ghana" },
  },
};

const BENEFITS = [
  { icon: Zap, title: "Instant Delivery", body: "Data sent directly to any MTN Ghana number within seconds for verified numbers." },
  { icon: CheckCircle, title: "Genuine MTN Bundles", body: "All bundles are sourced directly from MTN Ghana — no third-party risks." },
  { icon: Shield, title: "Secure Payments", body: "Checkout via Paystack. Your card details are encrypted and never stored." },
  { icon: Clock, title: "24/7 Availability", body: "Buy MTN data any time of day, any day of the week — no closing hours." },
  { icon: Star, title: "Best Prices in Ghana", body: "Bulk-sourced bundles mean you always pay less than the MTN direct price." },
  { icon: Smartphone, title: "Buy for Any Number", body: "Send data to yourself, family, or friends — any MTN Ghana number works." },
];

export default function MtnDataBundles() {
  return (
    <SeoPageLayout
      title="Buy MTN Data Bundles in Ghana | DataPlug"
      canonicalPath="/mtn-data-bundles"
      breadcrumbs={breadcrumbs}
      headline="Buy MTN Data Bundles in Ghana"
      subheadline="Fast, affordable MTN data bundles delivered instantly to any MTN Ghana number. Daily, weekly, and monthly internet plans — cheaper than buying direct."
      accentClass="text-yellow-400"
      faqs={faqs}
      schemas={[productSchema]}
    >
      {/* Why buy MTN data on DataPlug */}
      <section aria-labelledby="why-dataplug-mtn">
        <h2
          id="why-dataplug-mtn"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          Why Buy MTN Data Bundles on DataPlug?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          DataPlug is Ghana&apos;s trusted online data bundle store. We are an authorised
          MTN data reseller, meaning every bundle you buy comes directly from MTN Ghana
          at prices that beat the official top-up rates. Whether you need a quick 500MB
          for the day or a 50GB monthly plan for heavy streaming, DataPlug has you covered
          — with instant delivery and zero queues.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="glass rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex-shrink-0 rounded-lg bg-yellow-400/10 p-2 w-fit">
                <Icon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Available plans overview */}
      <section aria-labelledby="mtn-plans">
        <h2
          id="mtn-plans"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          MTN Ghana Data Bundle Plans
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          DataPlug stocks all the popular MTN Ghana data bundle sizes. Our catalogue is
          updated in real time whenever MTN Ghana changes its pricing or introduces new
          plans. The following plan categories are currently available:
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: "Daily Bundles", desc: "100MB – 1GB. Perfect for light browsing, social media, and WhatsApp use. Validity: 24 hours." },
            { label: "Weekly Bundles", desc: "1GB – 10GB. Great for regular use throughout the week. Validity: 7 days." },
            { label: "Monthly Bundles", desc: "5GB – 100GB+. Best value for heavy internet users, streamers, and remote workers. Validity: 30 days." },
            { label: "MTN Express Bundles", desc: "Instant-delivery express data bundles with slightly different validity tiers. Ideal for urgent top-ups." },
          ].map(({ label, desc }) => (
            <div key={label} className="glass-sm rounded-xl p-4 border-l-4 border-yellow-400/50">
              <h3 className="font-semibold text-foreground mb-1">{label}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-muted-foreground text-sm">
          View live prices and availability on the{" "}
          <Link to="/packages" className="text-primary hover:underline font-medium">
            data bundle packages page
          </Link>
          .
        </p>
      </section>

      {/* How to buy */}
      <section aria-labelledby="how-to-buy-mtn">
        <h2
          id="how-to-buy-mtn"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          How to Buy MTN Data Bundles on DataPlug
        </h2>
        <ol className="space-y-4 list-none">
          {[
            { step: "1", title: "Go to the Packages page", body: "Browse available MTN data bundle sizes and prices. No account required." },
            { step: "2", title: "Select your bundle", body: "Click the MTN bundle you want to buy. You can filter by size, price, or validity." },
            { step: "3", title: "Enter the recipient number", body: "Type the MTN Ghana number that should receive the data. It can be your own number or someone else's." },
            { step: "4", title: "Pay securely", body: "Complete payment with Mobile Money or a debit/credit card via Paystack." },
            { step: "5", title: "Receive your data", body: "The data bundle is sent instantly to the MTN number entered. You will receive a confirmation on screen." },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4 items-start">
              <div className="flex-shrink-0 rounded-full bg-yellow-400/20 text-yellow-400 font-bold text-sm w-8 h-8 flex items-center justify-center">
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

      {/* Trust signals */}
      <section aria-labelledby="mtn-trust" className="glass rounded-2xl p-6 md:p-8">
        <h2 id="mtn-trust" className="font-display text-xl font-bold text-foreground mb-3">
          Trusted by Thousands of Ghanaians
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          DataPlug has processed tens of thousands of MTN data bundle orders across Ghana.
          Our customers include individual users, students, businesses, and a growing
          network of reseller agents in Accra, Kumasi, Tamale, Cape Coast, and beyond.
          We are available on WhatsApp for support and maintain a public order-status
          tracking system so you always know where your data is.
        </p>
      </section>
    </SeoPageLayout>
  );
}
