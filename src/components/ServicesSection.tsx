import { Link } from "react-router-dom";
import { Smartphone, Radio, Phone, UserPlus, Zap, Shield, TrendingDown, Clock, Users, HeadphonesIcon } from "lucide-react";

const services = [
  {
    icon: Smartphone,
    title: "MTN Data Bundles",
    description: "Buy affordable MTN data bundles instantly delivered to any MTN Ghana number. Daily, weekly and monthly internet plans at the best prices.",
    accent: "text-mtn border-mtn/30 bg-mtn/10",
    href: "/mtn-data-bundles",
  },
  {
    icon: Radio,
    title: "AirtelTigo Data Bundles",
    description: "Fast and reliable AirtelTigo data bundles at unbeatable prices. Buy internet bundles for any AirtelTigo number in Ghana.",
    accent: "text-telecel border-telecel/30 bg-telecel/10",
    href: "/airteltigo-data-bundles",
  },
  {
    icon: Phone,
    title: "Telecel Data Bundles",
    description: "Top up any Telecel Ghana line with affordable data bundles in seconds. Buy cheap Telecel internet packages online.",
    accent: "text-telecel border-telecel/30 bg-telecel/10",
    href: "/telecel-data-bundles",
  },
  {
    icon: UserPlus,
    title: "MTN AFA Registration",
    description: "Register for MTN AFA quickly and easily through our platform. Unlock special MTN data packages and benefits.",
    accent: "text-mtn border-mtn/30 bg-mtn/10",
    href: "/packages",
  },
];

const trustPillars = [
  { icon: TrendingDown, title: "Lowest Prices in Ghana", body: "Bulk-sourced bundles from all networks mean our prices beat the direct network rate every time." },
  { icon: Zap, title: "Instant Delivery", body: "Data reaches the recipient number within seconds of payment — no waiting, no manual processing." },
  { icon: Shield, title: "Secure Payments", body: "All transactions are processed by Paystack, Ghana's most trusted payment gateway." },
  { icon: Clock, title: "Available 24/7", body: "Buy data bundles any time of day, any day of the year. We never close." },
  { icon: Users, title: "Agent Programme", body: "Join thousands of Ghanaian data resellers earning monthly income through the DataPlug agent network." },
  { icon: HeadphonesIcon, title: "WhatsApp Support", body: "Real humans available on WhatsApp to resolve any order issue quickly." },
];

const ServicesSection = () => {
  return (
    <section id="services" aria-labelledby="services-heading" className="py-24">
      <div className="container space-y-16">
        {/* Service cards */}
        <div className="space-y-10">
          <div className="text-center space-y-3">
            <h2 id="services-heading" className="font-display text-3xl font-bold sm:text-4xl">
              Buy Data Bundles in Ghana
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              MTN, AirtelTigo and Telecel data bundles — all networks, instant delivery, best prices in Ghana.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" role="list">
            {services.map((s) => (
              <article
                key={s.title}
                role="listitem"
                className="group rounded-xl border border-border bg-card p-6 space-y-4 hover:border-primary/40 transition-colors"
              >
                <div className={`inline-flex rounded-lg border p-3 ${s.accent}`} aria-hidden="true">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                <Link
                  to={s.href}
                  className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                >
                  Learn more &rarr;
                </Link>
              </article>
            ))}
          </div>
        </div>

        {/* Trust pillars */}
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Why Choose DataPlug?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Ghana&apos;s most reliable online data bundle store — trusted by over 72,000 customers and a growing network of reseller agents.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trustPillars.map(({ icon: Icon, title, body }) => (
              <article key={title} className="glass rounded-xl p-6 space-y-3">
                <div className="inline-flex rounded-lg bg-primary/10 p-3" aria-hidden="true">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
