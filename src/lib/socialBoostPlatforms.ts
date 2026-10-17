const knownPlatforms = ["TikTok", "Instagram", "Facebook", "YouTube", "WhatsApp", "Telegram", "Twitter", "Snapchat", "Spotify", "LinkedIn", "Threads", "Discord"];

export function getSocialBoostPlatform(category?: string | null, name?: string | null): string {
  const haystack = `${category ?? ""} ${name ?? ""}`.toLowerCase();
  const matched = knownPlatforms.find((platform) => haystack.includes(platform.toLowerCase()));
  if (matched) return matched;
  if (haystack.includes("twitter") || /\bx\b/.test(haystack)) return "Twitter";
  const first = String(category ?? "").trim().split(/\s+/)[0];
  return first || "Other";
}

export function groupByPlatform<T>(items: T[], getKeys: (item: T) => { category?: string | null; name?: string | null }): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const { category, name } = getKeys(item);
    const platform = getSocialBoostPlatform(category, name);
    groups.set(platform, [...(groups.get(platform) ?? []), item]);
  }
  const order = (platform: string) => {
    const index = knownPlatforms.indexOf(platform);
    return index === -1 ? knownPlatforms.length : index;
  };
  return Array.from(groups.entries()).sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]));
}
