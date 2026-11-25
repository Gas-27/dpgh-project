export const MASHUP_NETWORK_KEY = "mashup" as const;
export const MASHUP_MTN_ONLY_MESSAGE = "MashUp bundles are for MTN numbers only";

/** Only these data_packages.bundle_id values are the current MashUp packages. Older mashup rows must never show. */
export const MASHUP_BUNDLE_IDS: readonly number[] = [42, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53];

/** Networks that have their own packages named by size_gb_text (special bundles and MashUp). */
export const SPECIAL_NETWORK_KEYS = ["mtn_special", "telecel_special", MASHUP_NETWORK_KEY] as const;
export type SpecialNetworkKey = (typeof SPECIAL_NETWORK_KEYS)[number];

export const NETWORK_LABELS: Record<string, string> = {
  mtn: "MTN",
  mtn_express: "MTN Express",
  airteltigo: "AirtelTigo",
  telecel: "Telecel",
  mtn_special: "MTN Special",
  telecel_special: "Telecel Special",
  mashup: "MTN MashUp",
  mtn_mashup: "MTN MashUp",
};

const normalizeKey = (value?: string | null) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

export const isMashupNetwork = (value?: string | null): boolean => normalizeKey(value) === MASHUP_NETWORK_KEY;

/**
 * True for every package that may be shown to people. Non-MashUp packages are untouched;
 * MashUp packages must be active and belong to the current MashUp bundle ids.
 */
export const isVisiblePackage = (pkg?: { network?: string | null; active?: boolean | null; bundle_id?: number | string | null } | null): boolean => {
  if (!pkg) return false;
  if (!isMashupNetwork(pkg.network)) return true;
  if (pkg.active === false) return false;
  return MASHUP_BUNDLE_IDS.includes(Number(pkg.bundle_id));
};

/** Drops old/inactive MashUp rows from a package list. */
export const filterVisiblePackages = <T extends { network?: string | null; active?: boolean | null; bundle_id?: number | string | null }>(packages: T[] | null | undefined): T[] =>
  (packages ?? []).filter(isVisiblePackage);

/**
 * Admin lists show every package, but MashUp rows are limited to the current bundle ids
 * (inactive ones stay so the admin can switch them back on).
 */
export const filterAdminPackages = <T extends { network?: string | null; bundle_id?: number | string | null }>(packages: T[] | null | undefined): T[] =>
  (packages ?? []).filter((p) => !isMashupNetwork(p.network) || MASHUP_BUNDLE_IDS.includes(Number(p.bundle_id)));

/** Fixed MashUp pricing rules for the agent chain (agent -> subagent -> sub-subagent). */
export const MASHUP_FIRST_TIER_COUNT = 4;
export const MASHUP_DOWNSTREAM_MARKUP_FIRST = 0.3;
export const MASHUP_DOWNSTREAM_MARKUP_REST = 0.6;
export const MASHUP_STORE_DEFAULT_PROFIT = 1;
export const MASHUP_STORE_MAX_PROFIT = 2;
export const MASHUP_LOCKED_MESSAGE =
  "MTN MashUp prices are set by default and cannot be changed. The price shown here is what you get with every MashUp purchase.";

export const roundMoney = (value: number): number => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** Data amount in MB parsed from a MashUp package name such as "198 mins + 512MB" or "2.6GB". */
const getMashupDataMb = (pkg: { size_gb_text?: string | null; size_gb?: number | string | null }): number => {
  const text = String(pkg.size_gb_text ?? "");
  const match = text.match(/([\d.,]+)\s*(GB|MB)/i);
  if (match) {
    const amount = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(amount)) return match[2].toUpperCase() === "GB" ? amount * 1024 : amount;
  }
  const gb = Number(pkg.size_gb);
  return isNaN(gb) ? Number.MAX_SAFE_INTEGER : gb * 1024;
};

/**
 * Fixed profit added on top of the parent's cost for each visible MashUp package.
 * The 4 smallest packages get 0.30 and every other package gets 0.60.
 */
export const getMashupDownstreamMarkups = <T extends { id: string; network?: string | null; active?: boolean | null; bundle_id?: number | string | null; size_gb_text?: string | null; size_gb?: number | string | null }>(
  packages: T[] | null | undefined,
): Record<string, number> => {
  const mashups = (packages ?? []).filter((p) => isMashupNetwork(p.network) && p.active !== false && MASHUP_BUNDLE_IDS.includes(Number(p.bundle_id)));
  const sorted = [...mashups].sort((a, b) => {
    const diff = getMashupDataMb(a) - getMashupDataMb(b);
    if (diff !== 0) return diff;
    return MASHUP_BUNDLE_IDS.indexOf(Number(a.bundle_id)) - MASHUP_BUNDLE_IDS.indexOf(Number(b.bundle_id));
  });
  const result: Record<string, number> = {};
  sorted.forEach((pkg, index) => {
    result[pkg.id] = index < MASHUP_FIRST_TIER_COUNT ? MASHUP_DOWNSTREAM_MARKUP_FIRST : MASHUP_DOWNSTREAM_MARKUP_REST;
  });
  return result;
};

/** Fixed pricing rules for MTN Special and Telecel Special down the agent chain. */
export const SPECIAL_DOWNSTREAM_MARKUP = 0.5;
export const SPECIAL_STORE_DEFAULT_PROFIT = 0.8;
export const SPECIAL_STORE_MAX_PROFIT = 2.5;

/** MTN Special and Telecel Special have locked downstream prices (MashUp has its own tiered rule). */
export const isPriceLockedSpecialNetwork = (value?: string | null): boolean => {
  const key = normalizeKey(value);
  return key === "mtn_special" || key === "telecel_special";
};

/** True for every network whose subagent / sub-subagent base prices are fixed by default. */
export const isLockedPricingNetwork = (value?: string | null): boolean => isMashupNetwork(value) || isPriceLockedSpecialNetwork(value);

export const getLockedPriceMessage = (network?: string | null): string =>
  isPriceLockedSpecialNetwork(network)
    ? `${getNetworkLabelInternal(network)} prices are set by default and cannot be changed. The price shown here is what you get with every ${getNetworkLabelInternal(network)} purchase.`
    : MASHUP_LOCKED_MESSAGE;

const getNetworkLabelInternal = (value?: string | null): string => NETWORK_LABELS[normalizeKey(value)] ?? String(value ?? "");

/** Fixed profit label for the locked-price notice, e.g. "GHC 0.50 on every MTN Special bundle". */
export const getLockedProfitDescription = (network?: string | null): string =>
  isPriceLockedSpecialNetwork(network)
    ? `Your profit is GHC ${SPECIAL_DOWNSTREAM_MARKUP.toFixed(2)} on every ${getNetworkLabelInternal(network)} bundle.`
    : `Your profit is GHC ${MASHUP_DOWNSTREAM_MARKUP_FIRST.toFixed(2)} on the first 4 MashUp bundles and GHC ${MASHUP_DOWNSTREAM_MARKUP_REST.toFixed(2)} on the rest.`;

/**
 * Fixed profit added on top of the parent's cost for every locked package:
 * MashUp uses its tiered markup, MTN Special and Telecel Special use a flat 0.50.
 */
export const getLockedDownstreamMarkups = <T extends { id: string; network?: string | null; active?: boolean | null; bundle_id?: number | string | null; size_gb_text?: string | null; size_gb?: number | string | null }>(
  packages: T[] | null | undefined,
): Record<string, number> => {
  const result = getMashupDownstreamMarkups(packages);
  (packages ?? []).forEach((p) => {
    if (isPriceLockedSpecialNetwork(p.network) && p.active !== false) result[p.id] = SPECIAL_DOWNSTREAM_MARKUP;
  });
  return result;
};

/** Default store selling price: cost plus 1 cedi for MashUp, plus 0.80 for MTN / Telecel Special. */
export const getMashupDefaultStorePrice = (cost: number, network?: string | null): number =>
  roundMoney(Number(cost) + (isPriceLockedSpecialNetwork(network) ? SPECIAL_STORE_DEFAULT_PROFIT : MASHUP_STORE_DEFAULT_PROFIT));

/** Highest store selling price allowed: cost plus 2 cedis for MashUp, plus 2.50 for MTN / Telecel Special. */
export const getMashupMaxStorePrice = (cost: number, network?: string | null): number =>
  roundMoney(Number(cost) + (isPriceLockedSpecialNetwork(network) ? SPECIAL_STORE_MAX_PROFIT : MASHUP_STORE_MAX_PROFIT));

/** Maximum store profit in cedis for a locked network. */
export const getLockedMaxProfit = (network?: string | null): number =>
  isPriceLockedSpecialNetwork(network) ? SPECIAL_STORE_MAX_PROFIT : MASHUP_STORE_MAX_PROFIT;

export const isSpecialNetwork = (value?: string | null): value is SpecialNetworkKey =>
  SPECIAL_NETWORK_KEYS.includes(normalizeKey(value) as SpecialNetworkKey);

/** Human readable network name. Falls back to the raw value for unknown keys. */
export const getNetworkLabel = (value?: string | null): string => {
  const key = normalizeKey(value);
  return NETWORK_LABELS[key] ?? String(value ?? "");
};

/** The main tab a network key belongs to (special networks live inside MTN / Telecel). */
export const getNetworkFamily = (value?: string | null): string => {
  const key = normalizeKey(value);
  if (key === "mtn_special") return "mtn";
  if (key === "mtn_express_special") return "mtn_express";
  if (key === "mtn_mashup") return MASHUP_NETWORK_KEY;
  if (key === "telecel_special") return "telecel";
  return key;
};

export const packageMatchesNetwork = (pkgNetwork?: string | null, selectedNetwork?: string | null): boolean => {
  const pkg = normalizeKey(pkgNetwork);
  const selected = normalizeKey(selectedNetwork);
  if (selected === "mtn_express_special") return pkg === "mtn_special";
  if (selected === "mashup" || selected === "mtn_mashup") return pkg === "mashup" || pkg === "mtn_mashup";
  if (selected === "airteltigo") return ["airteltigo", "atbigtime", "atbigshare"].includes(pkg);
  return pkg === selected;
};

/** Package name shown to people. Always prefers size_gb_text (size_gb is a number such as 0.1 for 200MINS). */
export const getPackageDisplayName = (pkg?: { size_gb_text?: string | null; size_gb?: number | string | null } | null): string => {
  if (!pkg) return "";
  const text = typeof pkg.size_gb_text === "string" ? pkg.size_gb_text.trim() : "";
  if (text) return text;
  return pkg.size_gb !== null && pkg.size_gb !== undefined ? `${pkg.size_gb}GB` : "";
};

/** Name for an order. Special networks must never show size_gb, so they use size_gb_text or the package lookup. */
export const getOrderPackageName = (
  order: { network?: string | null; size_gb_text?: string | null; size_gb?: number | string | null; package_id?: string | null },
  packagesById?: Map<string, { size_gb_text?: string | null; size_gb?: number | string | null }>,
): string => {
  const text = typeof order.size_gb_text === "string" ? order.size_gb_text.trim() : "";
  if (text) return text;
  const pkg = order.package_id ? packagesById?.get(String(order.package_id)) : undefined;
  const fromPackage = pkg ? getPackageDisplayName(pkg) : "";
  if (fromPackage) return fromPackage;
  if (isSpecialNetwork(order.network)) return "";
  return order.size_gb !== null && order.size_gb !== undefined ? `${order.size_gb}GB` : "";
};

/** Network keys of special packages that have at least one active package. */
export const getActiveSpecialNetworks = (packages: Array<{ network?: string | null; active?: boolean | null; bundle_id?: number | string | null }>): SpecialNetworkKey[] =>
  SPECIAL_NETWORK_KEYS.filter((key) => packages.some((p) => normalizeKey(p.network) === key && p.active !== false && isVisiblePackage(p)));
