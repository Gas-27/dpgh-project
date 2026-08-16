import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { canonicalUrl, getSeoOrigin, getStorefrontSeo, shouldNoIndex } from "@/config/seoRoutes";

export default function RouteSeoGuard() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const noIndex = shouldNoIndex(pathname, search);
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = noIndex ? "noindex, nofollow" : "index, follow";

    const seo = getStorefrontSeo(window.location.hostname);
    document.title = noIndex ? `${seo.siteName} | Private Area` : `${seo.title} | ${seo.siteName}`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description && !noIndex) description.content = seo.description;
    const origin = getSeoOrigin(window.location.hostname);
    const canonicalPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${origin}${canonicalPath}`;
  }, [pathname, search]);

  return null;
}
