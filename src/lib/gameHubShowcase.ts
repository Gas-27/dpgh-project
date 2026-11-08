import { useEffect, useMemo, useState } from "react";
import type { LeaderboardPeriod, LeaderboardRow } from "@/lib/gameHubApi";

// Public Game Hub social proof. These figures are display-only and never touch rewards or the admin metrics,
// which keep reading the real data.

const FIRST_NAMES = [
  "kwame", "ama", "kofi", "akosua", "yaw", "abena", "kojo", "efua", "kwesi", "adwoa", "nana", "esi", "fiifi", "araba",
  "kobby", "afia", "papa", "maame", "samuel", "grace", "daniel", "mercy", "michael", "joyce", "isaac", "linda", "emma",
  "prince", "bright", "godwin", "ernest", "felix", "gifty", "hannah", "irene", "jerry", "karen", "lawrence", "mabel",
  "nelson", "olivia", "peter", "rita", "stephen", "theresa", "victor", "wilson", "yvonne", "zainab", "ibrahim", "fatima",
  "mohammed", "abu", "salma", "issah", "rashid", "hawa", "alhassan", "naa", "dzifa", "selorm", "edem", "mawuli", "elikem",
];
const DOMAIN_LETTERS = ["g", "g", "g", "g", "y", "h", "o", "i"];

function hashSeed(text: string): number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86_400_000;

// Ghana is on UTC all year, so the daily reset lines up with local midnight.
function dayIndex(now: number): number {
  return Math.floor(now / DAY_MS);
}

function dayKey(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

/** Winners shown on a game card. Starts at 0 at midnight and climbs through the day, then resets. */
export function showcaseWinsToday(gameId: string, now = Date.now()): number {
  const index = dayIndex(now);
  const dailyTarget = 22 + Math.floor(seededRandom(hashSeed(`wins|${gameId}|${dayKey(index)}`))() * 74);
  const dayFraction = (now - index * DAY_MS) / DAY_MS;
  return Math.floor(dailyTarget * Math.pow(dayFraction, 0.8));
}

export function useShowcaseWinCounts(gameIds: string[], enabled = true): Record<string, number> {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  const idKey = gameIds.join("|");
  return useMemo(
    () => Object.fromEntries(idKey.split("|").filter(Boolean).map((id) => [id, showcaseWinsToday(id, now)])),
    [idKey, now],
  );
}

function periodKey(period: LeaderboardPeriod, now: number): string {
  const index = dayIndex(now);
  switch (period) {
    case "today": return dayKey(index);
    case "yesterday": return dayKey(index - 1);
    case "week": return `w${Math.floor(index / 7)}`;
    case "month": return dayKey(index).slice(0, 7);
    default: return "all";
  }
}

const PERIOD_SIZE: Record<LeaderboardPeriod, [number, number]> = {
  today: [1120, 1380],
  yesterday: [1180, 1420],
  week: [1900, 2200],
  month: [2300, 2700],
  all: [2800, 3300],
};

function showcaseRows(gameId: string | null, period: LeaderboardPeriod, now: number): LeaderboardRow[] {
  const key = `${gameId ?? "all"}|${period}|${periodKey(period, now)}`;
  const random = seededRandom(hashSeed(`board|${key}`));
  const [min, max] = PERIOD_SIZE[period];
  const allGamesSize = min + Math.floor(random() * (max - min));
  // A single game holds roughly a fifth to a third of the day's players.
  const size = gameId ? Math.floor(allGamesSize * (0.16 + random() * 0.14)) : allGamesSize;
  const topScore = (gameId ? 1400 + random() * 2600 : 3200 + random() * 5200) * (period === "today" || period === "yesterday" ? 1 : 1.8);
  const usedNames = new Set<string>();
  const rows: LeaderboardRow[] = [];
  for (let i = 0; i < size; i += 1) {
    const rowRandom = seededRandom(hashSeed(`${key}|${i}`));
    const isGuest = rowRandom() < 0.28;
    let player: string;
    if (isGuest) {
      player = `Guest-${Math.floor(1000 + rowRandom() * 8999)}`;
    } else {
      const name = FIRST_NAMES[Math.floor(rowRandom() * FIRST_NAMES.length)];
      const domain = DOMAIN_LETTERS[Math.floor(rowRandom() * DOMAIN_LETTERS.length)];
      player = `${name.slice(0, 2)}***@${domain}***`;
    }
    if (usedNames.has(player)) player = `${player.replace("***@", `${Math.floor(rowRandom() * 90) + 10}***@`)}`;
    usedNames.add(player);
    const curve = Math.pow(1 - i / size, 1.7);
    const score = Math.max(5, Math.round(topScore * curve * (0.9 + rowRandom() * 0.2)));
    rows.push({ rank: 0, player, score, games_played: 1 + Math.floor(rowRandom() * (period === "today" ? 6 : 24)), is_you: false, is_guest: isGuest });
  }
  return rows;
}

/** Real players are merged into a populated board; the real player's own row keeps its flag. */
export function withShowcaseLeaderboard(real: LeaderboardRow[], gameId: string | null, period: LeaderboardPeriod, now = Date.now()): LeaderboardRow[] {
  const merged = [...real, ...showcaseRows(gameId, period, now)];
  // Stable sort: real players win ties against showcase entries.
  const sorted = merged
    .map((row, order) => ({ row, order }))
    .sort((a, b) => b.row.score - a.row.score || a.order - b.order)
    .map(({ row }, index) => ({ ...row, rank: index + 1 }));
  return sorted;
}
