import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import FaqBlock from "@/components/seo/FaqBlock";
import JsonLd from "@/components/seo/JsonLd";
import RelatedGuides from "@/components/seo/RelatedGuides";
import SeoWidget from "@/components/seo/SeoWidgets";
import { getGuide } from "@/data/seo/guides.mjs";
import { articleSchema } from "@/data/seo/schema.mjs";
import { SITE, absoluteUrl, withSuffix } from "@/data/seo/site.mjs";
import { setHeadMeta } from "@/lib/headMeta";
import NotFound from "@/pages/NotFound";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" });

export default function GuidePage() {
  const { slug = "" } = useParams();
  const guide: any = getGuide(slug);

  useEffect(() => {
    if (!guide) return;
    setHeadMeta({
      title: withSuffix(guide.metaTitle),
      description: guide.description,
      keywords: guide.keywords,
      canonicalUrl: absoluteUrl(`/guides/${guide.slug}`),
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      image: SITE.defaultOgImage.replace("page=home", `page=guide&slug=${guide.slug}`),
      siteName: SITE.name,
      type: "article",
    });
  }, [guide]);

  if (!guide) return <NotFound />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <Breadcrumbs
          items={[{ label: "Home", to: "/" }, { label: "Guides", to: "/guides" }, { label: guide.h1 }]}
        />
        <article className="space-y-8">
          <header className="space-y-3">
            <h1 className="text-balance text-3xl font-bold md:text-4xl">{guide.h1}</h1>
            <p className="text-sm text-muted-foreground">
              Last updated <time dateTime={guide.updated}>{formatDate(guide.updated)}</time>
            </p>
            {guide.intro.map((text: string) => (
              <p key={text} className="leading-relaxed text-muted-foreground">{text}</p>
            ))}
          </header>

          {guide.sections.map((section: any) => (
            <section key={section.h2} className="space-y-3">
              <h2 className="text-2xl font-semibold">{section.h2}</h2>
              {section.p?.map((text: string) => (
                <p key={text} className="leading-relaxed text-muted-foreground">{text}</p>
              ))}
              {section.bullets && (
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {section.bullets.map((item: string) => <li key={item}>{item}</li>)}
                </ul>
              )}
              {section.widget && <SeoWidget name={section.widget} />}
            </section>
          ))}

          {guide.cta && (
            <p>
              <Link
                to={guide.cta.to}
                className="inline-flex rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground"
              >
                {guide.cta.label}
              </Link>
            </p>
          )}
        </article>

        <FaqBlock faqs={guide.faqs} />
        <RelatedGuides slugs={guide.related} />
        <JsonLd data={articleSchema(guide)} />
      </main>
    </div>
  );
}
