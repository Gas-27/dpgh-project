import { canonicalUrl, SITE_ORIGIN } from "@/config/seoRoutes";
import { defaultSeoKeywords } from "@/data/seoKeywords";

export const DEFAULT_DESCRIPTION = "Buy affordable MTN, Telecel and AirtelTigo data bundles in Ghana with DataPlug. Compare packages, pay securely and get fast delivery.";
export const DEFAULT_IMAGE = `${SITE_ORIGIN}/icons/icon-512x512.png`;

export function generatePageMetadata(input: {
  title: string;
  description?: string;
  path: string;
  keywords?: string[];
  image?: string;
  noIndex?: boolean;
}) {
  const title = input.title.includes("DataPlug") ? input.title : `${input.title} | DataPlug Store`;
  const description = input.description || DEFAULT_DESCRIPTION;
  const url = canonicalUrl(input.path);
  const image = input.image || DEFAULT_IMAGE;
  return {
    title,
    description,
    keywords: input.keywords?.length ? Array.from(new Set([...input.keywords, ...defaultSeoKeywords])) : defaultSeoKeywords,
    canonical: url,
    robots: input.noIndex ? "noindex, nofollow" : "index, follow",
    openGraph: { type: "website", siteName: "DataPlug Store", locale: "en_GH", url, title, description, image },
    twitter: { card: "summary_large_image", title, description, image },
  };
}
