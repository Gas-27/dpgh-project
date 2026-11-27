export interface HeadMetaOptions {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
  siteName: string;
  type?: "website" | "article";
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Applies title, description, canonical, robots, Open Graph and Twitter tags in one call. */
export function setHeadMeta(options: HeadMetaOptions) {
  document.title = options.title;
  upsertMeta("name", "description", options.description);
  if (options.keywords?.length) upsertMeta("name", "keywords", options.keywords.join(", "));
  upsertMeta("name", "robots", options.robots);
  upsertMeta("name", "googlebot", options.robots);
  upsertCanonical(options.canonicalUrl);

  upsertMeta("property", "og:title", options.title);
  upsertMeta("property", "og:description", options.description);
  upsertMeta("property", "og:url", options.canonicalUrl);
  upsertMeta("property", "og:type", options.type ?? "website");
  upsertMeta("property", "og:site_name", options.siteName);
  upsertMeta("property", "og:locale", "en_GH");
  if (options.image) {
    upsertMeta("property", "og:image", options.image);
    upsertMeta("property", "og:image:alt", options.imageAlt ?? options.title);
    upsertMeta("name", "twitter:image", options.image);
  }

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", options.title);
  upsertMeta("name", "twitter:description", options.description);
}
