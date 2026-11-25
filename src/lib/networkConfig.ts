export const SPECIAL_NETWORK_KEYS = ["mtn_special", "telecel_special"] as const;
export type SpecialNetworkKey = (typeof SPECIAL_NETWORK_KEYS)[number];

export const NETWORK_LABELS: Record<string, string> = {
  mtn: "MTN",
  mtn_express: "MTN Express",
  airteltigo: "AirtelTigo",
  telecel: "Telecel",
  mtn_special: "MTN Special",
  telecel_special: "Telecel Special",
};

const normalizeKey = (value?: string | null) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

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
  if (key === "telecel_special") return "telecel";
  return key;
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
export const getActiveSpecialNetworks = (packages: Array<{ network?: string | null; active?: boolean | null }>): SpecialNetworkKey[] =>
  SPECIAL_NETWORK_KEYS.filter((key) => packages.some((p) => normalizeKey(p.network) === key && p.active !== false));
