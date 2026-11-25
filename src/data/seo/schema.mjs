// JSON-LD builders shared by the React app and the build-time prerender script.
// No aggregateRating anywhere: we have no real ratings to report.

import { SITE, absoluteUrl } from "./site.mjs";

const ctx = "https://schema.org";

export function organizationSchema() {
  const org = {
    "@context": ctx,
    "@type": "Organization",
    "@id": `${SITE.origin}/#organization`,
    name: SITE.name,
    url: SITE.origin,
    logo: SITE.logo,
    areaServed: { "@type": "Country", name: "Ghana" },
  };
  if (SITE.sameAs.length) org.sameAs = SITE.sameAs;
  return org;
}

export function websiteSchema() {
  return {
    "@context": ctx,
    "@type": "WebSite",
    "@id": `${SITE.origin}/#website`,
    name: SITE.name,
    url: SITE.origin,
    inLanguage: "en-GH",
    publisher: { "@id": `${SITE.origin}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.origin}/guides?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(items) {
  return {
    "@context": ctx,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.to ? { item: absoluteUrl(item.to) } : {}),
    })),
  };
}

export function faqSchema(faqs) {
  if (!faqs?.length) return null;
  return {
    "@context": ctx,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

export function articleSchema(guide) {
  return {
    "@context": ctx,
    "@type": "Article",
    headline: guide.h1,
    description: guide.description,
    inLanguage: "en-GH",
    mainEntityOfPage: absoluteUrl(`/guides/${guide.slug}`),
    dateModified: guide.updated,
    datePublished: guide.updated,
    author: { "@type": "Organization", name: SITE.name, url: SITE.origin },
    publisher: { "@id": `${SITE.origin}/#organization` },
  };
}

/**
 * Product/Offer schema from live rows. `items` = [{ name, price, url?, description? }].
 * Returns null when there is nothing to describe, so we never publish an empty or invented offer.
 */
export function productOffersSchema(items, pagePath) {
  const valid = (items || []).filter((item) => item.name && Number.isFinite(Number(item.price)) && Number(item.price) > 0);
  if (!valid.length) return null;
  return valid.map((item) => ({
    "@context": ctx,
    "@type": "Product",
    name: item.name,
    ...(item.description ? { description: item.description } : {}),
    brand: { "@type": "Brand", name: item.brand || SITE.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "GHS",
      price: Number(item.price).toFixed(2),
      availability: "https://schema.org/InStock",
      url: absoluteUrl(item.url || pagePath),
      seller: { "@id": `${SITE.origin}/#organization` },
    },
  }));
}
