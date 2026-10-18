export const knownPlatforms = ["TikTok", "Instagram", "Facebook", "YouTube", "WhatsApp", "Telegram", "Twitter", "Snapchat", "Spotify", "LinkedIn", "Threads", "Discord", "Twitch", "Kick", "Pinterest", "Reddit"];

function matchPlatform(text?: string | null): string | null {
  const lower = String(text ?? "").toLowerCase();
  if (!lower) return null;
  const matched = knownPlatforms.find((platform) => lower.includes(platform.toLowerCase()));
  if (matched) return matched;
  if (/tweet|\bx\.com\b|\bx\b/.test(lower)) return "Twitter";
  return null;
}

// The category decides the platform; the service name is only a fallback so that
// "US number verifications / Tiktok USA number verification" stays out of the TikTok list.
export function getSocialBoostPlatform(category?: string | null, name?: string | null): string {
  const matched = matchPlatform(category) ?? matchPlatform(name);
  if (matched) return matched;
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
