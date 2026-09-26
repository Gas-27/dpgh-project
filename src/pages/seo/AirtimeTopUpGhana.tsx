import { Link } from "react-router-dom";
import SeoPageLayout from "@/components/SeoPageLayout";
import { Phone, Zap, Shield, Clock, Smartphone, Wifi } from "lucide-react";

const networks = [
  { name: "MTN Airtime", desc: "Top up any MTN Ghana number instantly. Works for calls, SMS, and USSD codes.", accent: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5", href: "/packages" },
  { name: "Telecel Airtime", desc: "Buy Telecel (formerly Vodafone) airtime online for any Ghana Telecel number.", accent: "text-red-400 border-red-400/20 bg-red-400/5", href: "/packages" },
  { name: "AirtelTigo Airtime", desc: "Instant AirtelTigo airtime top-up delivered to any AirtelTigo number in Ghana.", accent: "text-orange-400 border-orange-400/20 bg-orange-400/5", href: "/packages" },
];

const faqs = [
  { question: "Can I buy airtime online in Ghana?", answer: "Yes. DataPlug allows you to buy airtime for MTN, Telecel, and AirtelTigo online in Ghana. Simply visit dataplug.store, select airtime, choose the network and amount, enter the phone number, and pay via MoMo or card. Delivery is instant." },
  { question: "What is the cheapest airtime in Ghana?", answer: "Airtime is sold at face value across all networks, but DataPlug's agent accounts can access promotional rates. Buying data bundles instead of raw airtime generally gives better value for internet usage — compare data vs airtime at /packages." },
  { question: "How do I buy airtime for someone else in Ghana?", answer: "On DataPlug, you can buy airtime for any number — not just your own. Enter the recipient's number during checkout and pay via Mobile Money or card. The airtime is sent directly to their number." },
  { question: "Is it safe to buy airtime online in Ghana?", answer: "Yes. DataPlug uses Paystack, Ghana's most trusted payment gateway, to process all transactions. Your payment details are encrypted and never stored on DataPlug's servers." },
  { question: "How do I check my airtime balance in Ghana?", answer: "MTN: dial *124#. Telecel: dial *124#. AirtelTigo: dial *124#. You can also check via your network's official app or USSD code." },
  { question: "Can I buy airtime at midnight in Ghana?", answer: "Yes. DataPlug operates 24 hours a day, 7 days a week. You can buy airtime for any Ghanaian network at any time, including midnight, weekends, and public holidays." },
];

export default function AirtimeTopUpGhana() {
  return (
    <SeoPageLayout
      title="Buy Airtime Online Ghana 2026 — MTN, Telecel, AirtelTigo | DataPlug"
      canonicalPath="/airtime-top-up-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Services", href: "/#services" },
        { label: "Airtime Top-Up Ghana" },
      ]}
      headline="Buy Airtime Instantly in Ghana — MTN, Telecel & AirtelTigo"
      subheadline="Top up any Ghanaian mobile number with airtime in seconds. Buy MTN, Telecel, and AirtelTigo airtime online 24/7 — no USSD codes, no queues, instant delivery."
      accentClass="text-primary"
      faqs={faqs}
    >
      <section aria-labelledby="networks-heading">
        <h2 id="networks-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          Buy Airtime for All Networks in Ghana
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {networks.map((net) => (
            <Link key={net.name} to={net.href} className={`rounded-xl border p-5 space-y-2 hover:opacity-80 transition-opacity ${net.accent}`}>
              <h3 className="font-display text-base font-semibold">{net.name}</h3>
              <p className="text-xs text-muted-foreground">{net.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="why-dataplug-heading">
        <h2 id="why-dataplug-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Why Buy Airtime on DataPlug?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Zap, title: "Instant Delivery", body: "Airtime arrives in seconds — no delays, no manual processing." },
            { icon: Shield, title: "Secure Payments", body: "Paystack-powered checkout. No card data stored on our servers." },
            { icon: Clock, title: "24/7 Availability", body: "Buy airtime at any hour — midnight, weekends, holidays." },
            { icon: Smartphone, title: "Any Number", body: "Top up your own number or buy airtime as a gift for anyone." },
            { icon: Wifi, title: "All Networks", body: "MTN, Telecel, and AirtelTigo all supported on one platform." },
            { icon: Phone, title: "No USSD Needed", body: "No dialling codes required — just visit the website and pay." },
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

      <section aria-labelledby="data-vs-airtime-heading">
        <h2 id="data-vs-airtime-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Airtime vs Data Bundles — Which is Better Value in Ghana?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          In Ghana, buying a dedicated data bundle almost always gives better value for internet usage than spending airtime
          credit on browsing. Airtime-based data rates are typically 3–5x more expensive per megabyte than buying a bundle
          directly. For example, 1 GB of airtime-based browsing on MTN may cost GHS 15–20, while a dedicated 1 GB bundle
          from DataPlug costs GHS 6–8.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Use airtime for calls and SMS. Use dedicated data bundles from DataPlug for internet. This simple habit can save
          a Ghanaian user GHS 50–100 per month. See our <Link to="/cheap-data-bundles-ghana" className="text-primary hover:underline">cheap data bundles</Link> page for the best deals.
        </p>
      </section>
    </SeoPageLayout>
  );
}
