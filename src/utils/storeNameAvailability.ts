import { supabase } from "@/integrations/supabase/client";
import { DOMAINS } from "@/config/domains";

const MAX_NAME_LENGTH = 40;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The exact URL slug a store name will get (same function that builds the store link). */
export const storeNameToSlug = (name: string): string => DOMAINS.sanitizeStoreName(name);

/**
 * Returns the subset of `slugs` that are already used as a store URL.
 * Asks the database for those exact slugs, so it is correct no matter how many stores exist.
 * agent_stores AND subagent_stores are both checked because the database picks a unique
 * url_slug across both tables, so a clash in either would change the final store link.
 */
export const fetchTakenSlugs = async (slugs: string[]): Promise<Set<string>> => {
  const safeSlugs = Array.from(new Set(slugs.filter((slug) => SLUG_PATTERN.test(slug))));
  const taken = new Set<string>();
  if (safeSlugs.length === 0) return taken;

  const list = safeSlugs.join(",");
  const filter = `store_name_slug.in.(${list}),url_slug.in.(${list})`;
  const db = supabase as any;

  const [agents, subagents] = await Promise.all([
    db.from("agent_stores").select("store_name_slug, url_slug").or(filter).limit(500),
    db.from("subagent_stores").select("store_name_slug, url_slug").or(filter).limit(500),
  ]);

  if (agents.error) throw agents.error;
  if (subagents.error) throw subagents.error;

  const wanted = new Set(safeSlugs);
  for (const row of [...(agents.data ?? []), ...(subagents.data ?? [])]) {
    if (row.store_name_slug && wanted.has(row.store_name_slug)) taken.add(row.store_name_slug);
    if (row.url_slug && wanted.has(row.url_slug)) taken.add(row.url_slug);
  }
  return taken;
};

/** true = the store URL is free, false = the same URL already belongs to a store. */
export const isStoreUrlAvailable = async (name: string): Promise<boolean> => {
  const slug = storeNameToSlug(name);
  if (!slug) return false;
  const taken = await fetchTakenSlugs([slug]);
  return !taken.has(slug);
};

const SUFFIXES = ["GH", "Hub", "Store", "Data", "Plug", "Online", "Express", "Plus", "247", "Gh Store"];
const PREFIXES = ["The", "Best", "Easy", "My"];

const titleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** Candidate names built from what the person typed (not yet checked against the database). */
const buildCandidates = (name: string): string[] => {
  const base = name.replace(/\s+/g, " ").trim();
  if (!base) return [];
  const shown = base === base.toLowerCase() || base === base.toUpperCase() ? titleCase(base.toLowerCase()) : base;
  const year = String(new Date().getFullYear()).slice(-2);

  const candidates = [
    ...SUFFIXES.map((suffix) => `${shown} ${suffix}`),
    ...PREFIXES.map((prefix) => `${prefix} ${shown}`),
    `${shown} ${year}`,
    `${shown} 1`,
    `${shown} 2`,
    `${shown} 7`,
    `${shown} 9`,
  ];

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const slug = storeNameToSlug(candidate);
    if (!slug || candidate.length > MAX_NAME_LENGTH || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
};

/** Up to `limit` names related to `name` whose store URL is currently free. */
export const suggestAvailableStoreNames = async (name: string, limit = 5): Promise<string[]> => {
  const candidates = buildCandidates(name);
  if (candidates.length === 0) return [];
  const taken = await fetchTakenSlugs(candidates.map(storeNameToSlug));
  return candidates.filter((candidate) => !taken.has(storeNameToSlug(candidate))).slice(0, limit);
};
