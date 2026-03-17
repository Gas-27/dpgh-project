import { Smartphone, Radio, Phone, UserPlus } from "lucide-react";

const services = [
  {
    icon: Smartphone,
    title: "MTN Data",
    description: "Affordable MTN data bundles delivered instantly to any MTN number.",
    accent: "text-mtn border-mtn/30 bg-mtn/10",
  },
  {
    icon: Radio,
    title: "AirtelTigo Data",
    description: "Fast and reliable AirtelTigo bundles at unbeatable prices.",
    accent: "text-telecel border-telecel/30 bg-telecel/10",
  },
  {
    icon: Phone,
    title: "Telecel Data",
    description: "Top up any Telecel line with data in seconds.",
    accent: "text-telecel border-telecel/30 bg-telecel/10",
  },
  {
    icon: UserPlus,
    title: "MTN Afa Registration",
    description: "Register for MTN Afa quickly and easily through our platform.",
    accent: "text-mtn border-mtn/30 bg-mtn/10",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="py-24">
      <div className="container space-y-12">
        <div className="text-center space-y-3">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Our Services</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Everything you need for mobile data — all networks, all in one place.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div
              key={s.title}
              className="group rounded-xl border border-border bg-card p-6 space-y-4 hover:border-primary/40 transition-colors"
            >
              <div className={`inline-flex rounded-lg border p-3 ${s.accent}`}>
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
