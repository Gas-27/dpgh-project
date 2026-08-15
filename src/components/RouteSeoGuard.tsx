import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { canonicalUrl, shouldNoIndex } from "@/config/seoRoutes";

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

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl(pathname);
  }, [pathname, search]);

  return null;
}
