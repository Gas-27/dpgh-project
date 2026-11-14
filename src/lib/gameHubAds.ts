import { supabase } from "@/integrations/supabase/client";

export type GameHubAd = {
  id: string;
  title: string;
  price: number;
  image: string | null;
  hasInlineImage: boolean;
  golden: boolean;
  url: string;
};

type MarketplaceRow = {
  id: string;
  title: string;
  price: number | string;
  image_urls?: string[] | null;
  has_inline_image?: boolean | null;
  admin_boost?: boolean | null;
  boost_global?: boolean | null;
  boost_global_expires_at?: string | null;
  boost_sitewide?: boolean | null;
  boost_sitewide_expires_at?: string | null;
};

function isActiveBoost(enabled?: boolean | null, expiresAt?: string | null) {
  return Boolean(enabled && (!expiresAt || new Date(expiresAt).getTime() > Date.now()));
}

function productUrl(row: MarketplaceRow) {
  const slug = row.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
  return `/marketplace/product/${row.id}/${slug}`;
}

/** Only golden-boosted and boosted marketplace products are eligible to appear as Game Hub ads. */
export async function fetchGameHubAds(): Promise<GameHubAd[]> {
  const { data, error } = await (supabase as any).rpc("marketplace_products_page", {
    p_search: "",
    p_page: 0,
    p_page_size: 40,
    p_sort: "newest",
  });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as MarketplaceRow[];
  return rows
    .filter((row) => row.admin_boost || isActiveBoost(row.boost_global, row.boost_global_expires_at) || isActiveBoost(row.boost_sitewide, row.boost_sitewide_expires_at))
    .map((row) => ({
      id: row.id,
      title: row.title,
      price: Number(row.price) || 0,
      image: Array.isArray(row.image_urls) && row.image_urls.length ? row.image_urls[0] : null,
      hasInlineImage: Boolean(row.has_inline_image),
      golden: Boolean(row.admin_boost),
      url: productUrl(row),
    }));
}

/** Products whose first photo is stored inline are returned without a URL; load that photo on demand. */
export async function fetchGameHubAdImage(productId: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc("marketplace_product_image", { p_id: productId });
  if (error) return null;
  return typeof data === "string" && data ? data : null;
}

/** Golden-boosted products are twice as likely to be picked as normally boosted ones. */
export function pickGameHubAd(ads: GameHubAd[]): GameHubAd | null {
  if (!ads.length) return null;
  const weighted = ads.flatMap((ad) => (ad.golden ? [ad, ad] : [ad]));
  return weighted[Math.floor(Math.random() * weighted.length)];
}
