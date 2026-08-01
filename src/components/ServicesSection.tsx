import { Smartphone, Radio, Phone, UserPlus } from "lucide-react";

const services = [
  {
    icon: Smartphone,
    title: "MTN Data Bundles",
    description: "Buy affordable MTN data bundles instantly delivered to any MTN Ghana number. Daily, weekly and monthly internet plans at the best prices.",
    accent: "text-mtn border-mtn/30 bg-mtn/10",
  },
  {
    icon: Radio,
    title: "AirtelTigo Data Bundles",
    description: "Fast and reliable AirtelTigo data bundles at unbeatable prices. Buy internet bundles for any AirtelTigo number in Ghana.",
    accent: "text-telecel border-telecel/30 bg-telecel/10",
  },
  {
    icon: Phone,
    title: "Telecel Data Bundles",
    description: "Top up any Telecel Ghana line with affordable data bundles in seconds. Buy cheap Telecel internet packages online.",
    accent: "text-telecel border-telecel/30 bg-telecel/10",
  },
  {
    icon: UserPlus,
    title: "MTN AFA Registration",
    description: "Register for MTN AFA quickly and easily through our platform. Unlock special MTN data packages and benefits.",
    accent: "text-mtn border-mtn/30 bg-mtn/10",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" aria-labelledby="services-heading" className="py-24">
      <div className="container space-y-12">
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
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
