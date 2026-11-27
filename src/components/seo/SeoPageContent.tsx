import { Link, useLocation } from "react-router-dom";
import { isJustBuyHost, shouldNoIndex } from "@/config/seoRoutes";
import { getPageForPath } from "@/data/seo/pages.mjs";
import { productOffersSchema } from "@/data/seo/schema.mjs";
import { networkLabel, usePrices1GB, useSubscriptionServices } from "@/hooks/useSeoLiveData";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import FaqBlock from "@/components/seo/FaqBlock";
import JsonLd from "@/components/seo/JsonLd";
import RelatedGuides from "@/components/seo/RelatedGuides";
import SeoWidget from "@/components/seo/SeoWidgets";

function LiveProductSchema({ kinds, path }: { kinds: string[]; path: string }) {
  const wantsData = kinds.includes("data");
  const wantsSubs = kinds.includes("subscription");
  const prices = usePrices1GB();
  const subs = useSubscriptionServices();
  const items: { name: string; price: number; url: string; description?: string }[] = [];
  if (wantsData) {
    (prices.data ?? []).forEach((row) =>
      items.push({ name: `${networkLabel(row.network)} 1GB data bundle (Ghana)`, price: row.price, url: path }),
    );
  }
  if (wantsSubs) {
    (subs.data ?? []).forEach((service) =>
      items.push({ name: service.name, price: service.price, url: path, description: service.description ?? undefined }),
    );
  }
  return <JsonLd data={productOffersSchema(items, path)} />;
}

export default function SeoPageContent() {
  const { pathname, search } = useLocation();
  if (!isJustBuyHost() || shouldNoIndex(pathname, search)) return null;
  const page: any = getPageForPath(pathname);
  if (!page) return null;

  const crumbs = [{ label: "Home", to: "/" }, ...(page.path === "/" ? [] : [{ label: page.h1 }])];

  return (
    <section aria-label={page.h1} className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 text-foreground">
      {page.path !== "/" && <Breadcrumbs items={crumbs} />}
      <header className="space-y-3">
        <h1 className="text-balance text-3xl font-bold md:text-4xl">{page.h1}</h1>
        <p className="leading-relaxed text-muted-foreground">{page.intro}</p>
      </header>

      {page.sections.map((section: any) => (
        <section key={section.h2} className="space-y-3">
          <h2 className="text-xl font-semibold">{section.h2}</h2>
          {section.p?.map((text: string) => (
            <p key={text} className="leading-relaxed text-muted-foreground">{text}</p>
          ))}
          {section.bullets && (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {section.bullets.map((item: string) => <li key={item}>{item}</li>)}
            </ul>
          )}
          {section.links && (
            <ul className="grid gap-3 md:grid-cols-2">
              {section.links.map((link: any) => (
                <li key={link.to}>
                  <Link to={link.to} className="block rounded-xl border border-border bg-card p-4 transition hover:border-primary">
                    <span className="font-medium text-foreground">{link.label}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{link.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {section.widget && <SeoWidget name={section.widget} />}
        </section>
      ))}

      <FaqBlock faqs={page.faqs} />
      <RelatedGuides slugs={page.related} />
      {page.schema?.length > 0 && <LiveProductSchema kinds={page.schema} path={page.path} />}
    </section>
  );
}
