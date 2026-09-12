import { Link } from "react-router-dom";
import { CheckCircle, Zap, Shield, Clock, Star, Smartphone } from "lucide-react";
import SeoPageLayout from "@/components/SeoPageLayout";

const breadcrumbs = [
  { label: "Home", href: "/" },
  { label: "Data Bundles", href: "/packages" },
  { label: "AirtelTigo Data Bundles" },
];

const faqs = [
  {
    question: "How quickly are AirtelTigo data bundles delivered on DataPlug?",
    answer:
      "AirtelTigo data bundles are delivered instantly after payment — typically within a few seconds. There are no verification delays for AirtelTigo numbers.",
  },
  {
    question: "What AirtelTigo data bundle sizes does DataPlug offer?",
    answer:
      "DataPlug offers AirtelTigo data bundles ranging from small daily 100MB packs to large 50GB monthly plans. All standard AirtelTigo Ghana bundle sizes are available and priced competitively.",
  },
  {
    question: "Can I buy AirtelTigo data for another person's number?",
    answer:
      "Yes. Enter any AirtelTigo Ghana number at checkout to send data to that number. It can be a family member, friend, or colleague.",
  },
  {
    question: "Is AirtelTigo data from DataPlug the same as buying from AirtelTigo directly?",
    answer:
      "Yes — the bundles are identical. DataPlug is an authorised reseller, so the data quality, speed, and validity are exactly the same as buying directly from AirtelTigo, just at a lower price.",
  },
  {
    question: "What if my AirtelTigo data order does not arrive?",
    answer:
      "If your AirtelTigo data does not arrive within 5 minutes of payment, contact DataPlug support on WhatsApp with your order ID. We will investigate and resolve the issue promptly, with a full refund if the order cannot be fulfilled.",
  },
  {
    question: "Can I use my DataPlug wallet to buy AirtelTigo data?",
    answer:
      "Yes. Your DataPlug wallet balance can be used to purchase any data bundle — including AirtelTigo. Top up your wallet with MoMo or card, then use it for instant one-click purchases.",
  },
];

const BENEFITS = [
  { icon: Zap, title: "Instant Delivery", body: "AirtelTigo bundles reach the recipient number in seconds." },
  { icon: CheckCircle, title: "Genuine Bundles", body: "Same AirtelTigo Ghana bundles as the network direct — just cheaper." },
  { icon: Shield, title: "Secure Payments", body: "Paystack checkout with full encryption and no card data stored." },
  { icon: Clock, title: "Always Open", body: "Buy AirtelTigo data at 2am on a Sunday — we never close." },
  { icon: Star, title: "Lowest Prices", body: "Bulk-sourced bundles consistently beat the AirtelTigo USSD price." },
  { icon: Smartphone, title: "Any AirtelTigo Number", body: "Top up your own line or gift data to any AirtelTigo Ghana number." },
];

export default function AirtelTigoDataBundles() {
  return (
    <SeoPageLayout
      title="Buy AirtelTigo Data Bundles in Ghana | DataPlug"
      canonicalPath="/airteltigo-data-bundles"
      breadcrumbs={breadcrumbs}
      headline="Buy AirtelTigo Data Bundles in Ghana"
      subheadline="Cheap AirtelTigo Ghana data bundles — instant online delivery, no USSD codes, no queues. Pay with MoMo or card and get your data in seconds."
      accentClass="text-orange-400"
      faqs={faqs}
    >
      {/* Intro */}
      <section aria-labelledby="why-dataplug-airteltigo">
        <h2
          id="why-dataplug-airteltigo"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          Why Buy AirtelTigo Data Bundles on DataPlug?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          AirtelTigo is one of Ghana&apos;s major mobile networks with wide coverage
          across all regions. DataPlug makes buying AirtelTigo data simple — no USSD,
          no scratch cards, no service centre visits. Choose your bundle, enter the
          recipient number, and pay in under a minute. Your data arrives instantly,
          and our prices are lower than the AirtelTigo direct rate.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass rounded-xl p-5 flex flex-col gap-3">
              <div className="flex-shrink-0 rounded-lg bg-orange-400/10 p-2 w-fit">
                <Icon className="h-5 w-5 text-orange-400" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section aria-labelledby="airteltigo-plans">
        <h2
          id="airteltigo-plans"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          AirtelTigo Ghana Data Bundle Plans
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {[
            { label: "Daily Bundles", desc: "Quick boosts for the day. Ideal for WhatsApp, social media, and short browsing. Validity: 24 hours." },
            { label: "Weekly Bundles", desc: "Comfortable internet for the whole week. Great for regular users on a budget. Validity: 7 days." },
            { label: "Monthly Bundles", desc: "Best value for heavy users. Stream, work remotely, and browse without worrying about data. Validity: 30 days." },
            { label: "Night Bundles", desc: "Special lower-cost plans valid during off-peak hours. Perfect for downloading content overnight." },
          ].map(({ label, desc }) => (
            <div key={label} className="glass-sm rounded-xl p-4 border-l-4 border-orange-400/50">
              <h3 className="font-semibold text-foreground mb-1">{label}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          Live prices and availability are always up to date on the{" "}
          <Link to="/packages" className="text-primary hover:underline font-medium">
            packages page
          </Link>
          .
        </p>
      </section>

      {/* How to buy */}
      <section aria-labelledby="how-to-buy-airteltigo">
        <h2
          id="how-to-buy-airteltigo"
          className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4"
        >
          How to Buy AirtelTigo Data Bundles Online
        </h2>
        <ol className="space-y-4 list-none">
          {[
            { step: "1", title: "Go to Packages", body: "Find all available AirtelTigo bundles with live prices." },
            { step: "2", title: "Choose a plan", body: "Select the data size and validity period that fits your needs." },
            { step: "3", title: "Enter the AirtelTigo number", body: "Enter the recipient number — yours or someone else's." },
            { step: "4", title: "Pay securely", body: "Use MoMo, AirtelTigo Money, or any Visa/Mastercard via Paystack." },
            { step: "5", title: "Done — data arrives instantly", body: "The bundle is delivered to the AirtelTigo number within seconds." },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4 items-start">
              <div className="flex-shrink-0 rounded-full bg-orange-400/20 text-orange-400 font-bold text-sm w-8 h-8 flex items-center justify-center">
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

      <section aria-labelledby="airteltigo-trust" className="glass rounded-2xl p-6 md:p-8">
        <h2 id="airteltigo-trust" className="font-display text-xl font-bold text-foreground mb-3">
          A Reliable Source for AirtelTigo Data in Ghana
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Thousands of AirtelTigo customers across Ghana use DataPlug every month for
          affordable, instant data top-ups. We serve individuals, small businesses, and
          agent networks throughout Accra, Kumasi, Tamale, and every other region where
          AirtelTigo has coverage.
        </p>
      </section>
    </SeoPageLayout>
  );
}
