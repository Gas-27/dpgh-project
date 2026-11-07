type MarketplaceViewProduct = {
  id: string;
  admin_boost?: boolean | null;
  boost_global?: boolean | null;
  boost_global_expires_at?: string | null;
  boost_sitewide?: boolean | null;
  boost_sitewide_expires_at?: string | null;
};

type ViewRange = readonly [min: number, max: number];

const NORMAL_RANGE: ViewRange = [32, 89];
const BOOSTED_RANGE: ViewRange = [110, 140];
const GOLDEN_RANGE: ViewRange = [150, 210];
const STARTING_RANGE: ViewRange = [9, 31];

// Beyond this many real views, the remainder is added at the range average to keep rendering cheap.
const MAX_SAMPLED_VIEWS = 2000;

function isActiveBoost(enabled?: boolean | null, expiresAt?: string | null) {
  return Boolean(enabled && (!expiresAt || new Date(expiresAt).getTime() > Date.now()));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function getMarketplaceViewRange(product: MarketplaceViewProduct): ViewRange {
  if (product.admin_boost) return GOLDEN_RANGE;
  if (isActiveBoost(product.boost_global, product.boost_global_expires_at) || isActiveBoost(product.boost_sitewide, product.boost_sitewide_expires_at)) return BOOSTED_RANGE;
  return NORMAL_RANGE;
}

/**
 * Every real view adds a value inside the product's tier range. The value for each view is derived
 * from the product id and the view number, so the total is stable between refreshes but different
 * from product to product.
 */
export function getMarketplaceDisplayViews(product: MarketplaceViewProduct, rawViews: number) {
  const [min, max] = getMarketplaceViewRange(product);
  const span = max - min + 1;
  const views = Math.max(0, Math.floor(rawViews || 0));
  const sampled = Math.min(views, MAX_SAMPLED_VIEWS);

  let total = 0;
  for (let view = 1; view <= sampled; view += 1) {
    total += min + (hashString(`${product.id}:${view}`) % span);
  }
  if (views > sampled) total += (views - sampled) * Math.round((min + max) / 2);

  const [startMin, startMax] = STARTING_RANGE;
  const startingNumber = startMin + (hashString(`offset:${product.id}`) % (startMax - startMin + 1));
  return total + startingNumber;
}

/** Guarantees no two products in the same list show the same view total. */
export function getUniqueMarketplaceViews(products: Array<MarketplaceViewProduct & { marketplace_view_count?: number | null }>) {
  const result = new Map<string, number>();
  const used = new Set<number>();
  const ordered = [...products].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const product of ordered) {
    let value = getMarketplaceDisplayViews(product, Number(product.marketplace_view_count || 0));
    while (used.has(value)) value += 1 + (hashString(`${product.id}:${value}`) % 2);
    used.add(value);
    result.set(product.id, value);
  }
  return result;
}
