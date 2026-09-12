import SeoPageLayout from "@/components/SeoPageLayout";
import { Link } from "react-router-dom";
import { CheckCircle2, Info } from "lucide-react";

const afaBenefits = [
  "Access to special MTN AFA internet bundles at lower prices than standard data plans",
  "AFA registration qualifies your SIM for certain MTN financial and data promotions",
  "Some AFA bundles offer higher data volumes at the same price point as regular bundles",
  "Available for MTN Ghana SIM cards only — the registration is free and quick",
];

const faqs = [
  {
    question: "What is MTN AFA registration in Ghana?",
    answer: "MTN AFA (Affordable Data For All) is a programme by MTN Ghana that allows registered users to access special discounted data bundle rates. Registration is free and links your SIM to the AFA programme.",
  },
  {
    question: "How do I register for MTN AFA in Ghana?",
    answer: "You can register for MTN AFA through the DataPlug platform which handles the registration process on your behalf quickly and reliably, or through MTN's own registration channels.",
  },
  {
    question: "What bundles are available after AFA registration?",
    answer: "After AFA registration, MTN Ghana SIM holders get access to special AFA data plans which typically offer more data per Ghana Cedi than standard retail bundles.",
  },
  {
    question: "Is MTN AFA registration free?",
    answer: "Yes, MTN AFA registration itself is free. You pay only for the data bundles you purchase after registration.",
  },
  {
    question: "Can DataPlug buy AFA bundles for my number?",
    answer: "Yes. DataPlug supports purchasing MTN AFA bundles for registered MTN numbers. Select the AFA category on the packages page after your number has been registered.",
  },
  {
    question: "How long does AFA registration take?",
    answer: "Registration through DataPlug typically takes a few minutes. MTN confirms activation via SMS to the registered number.",
  },
];

export default function AfaBundleGhana() {
  return (
    <SeoPageLayout
      title="MTN AFA Bundle Ghana — Register & Buy AFA Data Bundles"
      description="Register for MTN AFA in Ghana and access special discounted data bundles. DataPlug handles AFA registration and lets you buy AFA bundles instantly for any MTN number."
      canonicalPath="/afa-bundle-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "MTN Data Bundles", href: "/mtn-data-bundles" },
        { label: "MTN AFA Bundle Ghana" },
      ]}
      headline="MTN AFA Bundle Ghana — Special Data Rates for Registered Users"
      subheadline="MTN's Affordable Data For All (AFA) programme unlocks special discounted bundle prices for registered MTN Ghana SIM cards. DataPlug handles registration and lets you buy AFA bundles instantly."
      accentClass="text-yellow-400"
      faqs={faqs}
    >
      {/* What is AFA */}
      <section aria-labelledby="afa-heading">
        <h2 id="afa-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          What is the MTN AFA Programme?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          MTN Ghana&apos;s Affordable Data For All (AFA) initiative is designed to give more Ghanaians access to affordable mobile internet. Registered SIM cards receive access to special bundle pricing not available through standard retail channels.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          DataPlug is an authorised platform where you can complete MTN AFA registration and immediately purchase AFA bundles for any registered MTN Ghana number — without visiting a service centre or dialling complex USSD codes.
        </p>
      </section>

      {/* Benefits */}
      <section aria-labelledby="benefits-afa-heading">
        <h2 id="benefits-afa-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Benefits of MTN AFA Registration
        </h2>
        <ul className="space-y-3" role="list">
          {afaBenefits.map((benefit, i) => (
            <li key={i} className="flex gap-3 items-start">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">{benefit}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Info note */}
      <section aria-labelledby="note-heading" className="glass rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-5">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 id="note-heading" className="font-semibold text-foreground mb-1">Important Note</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              MTN AFA bundles are only available for MTN Ghana SIM cards. The recipient number must be a valid, active MTN Ghana line. AFA registration is required before AFA-rate bundles can be purchased for a number.
            </p>
          </div>
        </div>
      </section>

      {/* CTA links */}
      <section aria-labelledby="afa-cta-heading">
        <h2 id="afa-cta-heading" className="font-display text-xl font-bold text-foreground mb-4">
          Get Started with MTN AFA Bundles
        </h2>
        <nav aria-label="AFA bundle action links" className="flex flex-wrap gap-3">
          <Link to="/packages" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            Buy MTN AFA Bundles
          </Link>
          <Link to="/mtn-data-bundles" className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors">
            All MTN Data Bundles
          </Link>
        </nav>
      </section>
    </SeoPageLayout>
  );
}
