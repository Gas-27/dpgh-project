import { Link } from "react-router-dom";
import { getGuide } from "@/data/seo/guides.mjs";

export default function RelatedGuides({ slugs, title = "Related guides" }: { slugs: string[]; title?: string }) {
  const guides = slugs.map((slug) => getGuide(slug)).filter(Boolean);
  if (!guides.length) return null;
  return (
    <section aria-labelledby="related-guides-heading" className="space-y-3">
      <h2 id="related-guides-heading" className="text-xl font-semibold text-foreground">{title}</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {guides.map((guide: any) => (
          <li key={guide.slug}>
            <Link
              to={`/guides/${guide.slug}`}
              className="block rounded-xl border border-border bg-card p-4 text-foreground transition hover:border-primary"
            >
              <span className="font-medium">{guide.h1}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{guide.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
