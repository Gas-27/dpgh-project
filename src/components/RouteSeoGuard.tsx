import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getSeoOrigin, getStorefrontSeo, isJustBuyHost, isStoreHost, shouldNoIndex } from "@/config/seoRoutes";
import { setHeadMeta } from "@/lib/headMeta";
import { SITE, absoluteUrl, withSuffix } from "@/data/seo/site.mjs";
import { getPageForPath } from "@/data/seo/pages.mjs";
import { organizationSchema, websiteSchema } from "@/data/seo/schema.mjs";
import JsonLd from "@/components/seo/JsonLd";

const INDEX_ROBOTS = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

export default function RouteSeoGuard() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const hostname = window.location.hostname;
    const cleanPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    const privateArea = shouldNoIndex(pathname, search);
    // Agent / sub-agent / custom-domain stores are copies of the main site: noindex, but let
    // crawlers follow links so link equity still reaches justbuygh.com.
    const robots = privateArea ? "noindex, nofollow" : isStoreHost(hostname) ? "noindex, follow" : INDEX_ROBOTS;

    // Guides set their own metadata from the guide page component.
    if (isJustBuyHost(hostname) && !privateArea && (cleanPath === "/guides" || cleanPath.startsWith("/guides/"))) {
      let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (!el) {
        el = document.createElement("meta");
        el.name = "robots";
        document.head.appendChild(el);
      }
      el.content = robots;
      return;
    }

    const seo = getStorefrontSeo(hostname);
    const origin = getSeoOrigin(hostname);
    const page = isJustBuyHost(hostname) && !privateArea ? getPageForPath(cleanPath) : null;

    if (page) {
      setHeadMeta({
        title: withSuffix(page.metaTitle),
        description: page.description,
        keywords: page.keywords,
        canonicalUrl: absoluteUrl(page.path),
        robots,
        image: SITE.defaultOgImage.replace("page=home", `page=${page.path === "/" ? "home" : page.path.slice(1)}`),
        imageAlt: `${page.h1} - ${SITE.name}`,
        siteName: SITE.name,
      });
      return;
    }

    setHeadMeta({
      title: privateArea ? `${seo.siteName} | Private Area` : `${seo.title} | ${seo.siteName}`,
      description: privateArea ? seo.description : seo.description,
      canonicalUrl: `${origin}${cleanPath}`,
      robots,
      siteName: seo.siteName,
    });
  }, [pathname, search]);

  if (!isJustBuyHost()) return null;
  return <JsonLd data={[organizationSchema(), websiteSchema()]} />;
}
