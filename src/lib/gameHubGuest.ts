const GUEST_KEY = "gamehub-guest-id";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

// A guest identity only exists for the Game Hub leaderboard; it is never linked to an account.
export function getGuestId(): string {
  try {
    const existing = window.localStorage.getItem(GUEST_KEY);
    if (existing) return existing;
    const created = randomId();
    window.localStorage.setItem(GUEST_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

export function newGuestSessionId(): string {
  return randomId();
}
