import { DOMAINS } from "@/config/domains";

/**
 * Utility to find a store from ANY input (subdomain, path parameter, etc)
 * Handles consistent normalization and matching across the entire app
 */

export interface StoreData {
  id: string;
  store_name: string;
  [key: string]: any;
}

export type StoreType = "agent" | "subagent";

/**
 * Generic slugify function matching the one used in storefronts
 */
export const slugify = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/'/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Find a store by name using normalized matching
 * Works for both agent_stores and subagent_stores
 */
export const findStoreByName = (
  storeName: string | null | undefined,
  stores: StoreData[]
): StoreData | null => {
  if (!storeName || !stores || stores.length === 0) {
    console.log("[v0] findStoreByName: No storeName or stores", { storeName, storeCount: stores?.length });
    return null;
  }

  const normalized = storeName.toLowerCase().trim();
  const normalizedSlugified = slugify(normalized);
  const normalizedClean = normalized.replace(/[^a-z0-9]/g, "");

  console.log("[v0] findStoreByName: Searching", {
    searchFor: storeName,
    normalized,
    normalizedSlugified,
    normalizedClean,
    availableStores: stores.slice(0, 5).map((s) => ({
      name: s.store_name,
      slug: s.store_name_slug,
    })),
  });

  // Strategy 1: Try exact name match (case-insensitive)
  let matched = stores.find(
    (s) => s.store_name && s.store_name.toLowerCase().trim() === normalized
  );
  if (matched) {
    console.log("[v0] Match found at Strategy 1 (exact name):", matched.store_name);
    return matched;
  }

  // Strategy 2: Try database slug field if populated
  matched = stores.find((s) => s.store_name_slug && s.store_name_slug === normalizedSlugified);
  if (matched) {
    console.log("[v0] Match found at Strategy 2 (database slug):", matched.store_name);
    return matched;
  }

  // Strategy 3: Try slugified comparison
  matched = stores.find((s) => s.store_name && slugify(s.store_name) === normalizedSlugified);
  if (matched) {
    console.log("[v0] Match found at Strategy 3 (slugified):", matched.store_name);
    return matched;
  }

  // Strategy 4: Try normalized clean comparison (all special chars removed)
  matched = stores.find(
    (s) =>
      s.store_name &&
      slugify(s.store_name).replace(/[^a-z0-9]/g, "") === normalizedClean
  );
  if (matched) {
    console.log("[v0] Match found at Strategy 4 (clean comparison):", matched.store_name);
    return matched;
  }

  // Strategy 5: Last resort - clean both sides completely
  matched = stores.find(
    (s) =>
      s.store_name &&
      s.store_name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedClean
  );
  if (matched) {
    console.log("[v0] Match found at Strategy 5 (complete clean):", matched.store_name);
    return matched;
  }

  console.log("[v0] No match found after all strategies");
  return null;
};

/**
 * Extract store name from subdomain
 * e.g., "emefa-datahub.datastores.shop" → "emefa-datahub"
 */
export const getStoreNameFromSubdomain = (hostname: string): string | null => {
  if (hostname.endsWith(`.${DOMAINS.AGENT_STORE}`)) {
    const parts = hostname.split(".");
    if (parts.length >= 3) {
      return parts[0].toLowerCase().trim();
    }
  }
  return null;
};

/**
 * Normalize store name for display (inverse of slugify when needed)
 * Handles converting kebab-case back to readable format if needed
 */
export const normalizeStoreName = (name: string): string => {
  return name.replace(/-/g, " ").trim();
};
