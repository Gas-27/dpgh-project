import JsonLd from "@/components/seo/JsonLd";
import { faqSchema } from "@/data/seo/schema.mjs";

export interface Faq {
  q: string;
  a: string;
}

export default function FaqBlock({ faqs, heading = "Frequently asked questions" }: { faqs: Faq[]; heading?: string }) {
  if (!faqs?.length) return null;
  return (
    <section aria-labelledby="faq-heading" className="space-y-3">
      <h2 id="faq-heading" className="text-xl font-semibold text-foreground">{heading}</h2>
      <div className="space-y-2">
        {faqs.map((faq) => (
          <details key={faq.q} className="group rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer list-none font-medium text-foreground">
              <h3 className="inline text-base font-medium">{faq.q}</h3>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
          </details>
        ))}
      </div>
      <JsonLd data={faqSchema(faqs)} />
    </section>
  );
}
