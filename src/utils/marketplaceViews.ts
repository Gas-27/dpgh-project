type MarketplaceViewProduct = {
  id: string;
  admin_boost?: boolean | null;
  boost_global?: boolean | null;
  boost_global_expires_at?: string | null;
  boost_sitewide?: boolean | null;
  boost_sitewide_expires_at?: string | null;
};

function isActiveBoost(enabled?: boolean | null, expiresAt?: string | null) {
  return Boolean(enabled && (!expiresAt || new Date(expiresAt).getTime() > Date.now()));
}

export function getMarketplaceViewWeight(product: MarketplaceViewProduct) {
  if (product.admin_boost) return 370;
  if (isActiveBoost(product.boost_global, product.boost_global_expires_at) || isActiveBoost(product.boost_sitewide, product.boost_sitewide_expires_at)) return 314;
  return 254;
}

export function getMarketplaceDisplayViews(product: MarketplaceViewProduct, rawViews: number) {
  let hash = 0;
  for (const character of product.id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const tieBreaker = (hash % 2) + 1;
  return Math.max(0, Math.floor(rawViews || 0)) * getMarketplaceViewWeight(product) + tieBreaker;
}
