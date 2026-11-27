import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { GUIDES, GUIDES_INDEX } from "@/data/seo/guides.mjs";
import { SITE, absoluteUrl, withSuffix } from "@/data/seo/site.mjs";
import { setHeadMeta } from "@/lib/headMeta";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" });

export default function Guides() {
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase();

  useEffect(() => {
    setHeadMeta({
      title: withSuffix(GUIDES_INDEX.metaTitle),
      description: GUIDES_INDEX.description,
      keywords: GUIDES_INDEX.keywords,
      canonicalUrl: absoluteUrl("/guides"),
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      image: SITE.defaultOgImage.replace("page=home", "page=guides"),
      siteName: SITE.name,
    });
  }, []);

  const guides = useMemo(
    () =>
      query
        ? GUIDES.filter((guide: any) => `${guide.h1} ${guide.description}`.toLowerCase().includes(query))
        : GUIDES,
    [query],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Guides" }]} />
        <header className="space-y-3">
          <h1 className="text-balance text-3xl font-bold md:text-4xl">{GUIDES_INDEX.h1}</h1>
          <p className="leading-relaxed text-muted-foreground">{GUIDES_INDEX.intro}</p>
        </header>
        {guides.length === 0 && <p className="text-muted-foreground">No guides match your search.</p>}
        <ul className="grid gap-4 md:grid-cols-2">
          {guides.map((guide: any) => (
            <li key={guide.slug}>
              <article className="h-full rounded-xl border border-border bg-card p-5 transition hover:border-primary">
                <h2 className="text-lg font-semibold">
                  <Link to={`/guides/${guide.slug}`}>{guide.h1}</Link>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Last updated <time dateTime={guide.updated}>{formatDate(guide.updated)}</time>
                </p>
              </article>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
