import { supabase } from "@/integrations/supabase/client";

type PasswordSignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

export type SecureSignInResult =
  | { status: "ok"; result: PasswordSignInResult }
  | { status: "locked"; message: string; retryAfterSeconds: number }
  | { status: "rejected"; message: string; attemptsLeft: number | null }
  | { status: "error"; message: string };

const LOCKOUT_STORAGE_PREFIX = "login_lockout_until:";
const DEFAULT_LOCK_SECONDS = 60;
const RETRY_MESSAGE = "Sign-in failed, please try again.";

const lockoutKey = (email: string) => `${LOCKOUT_STORAGE_PREFIX}${email.trim().toLowerCase()}`;

export function readStoredLockout(email: string): number | null {
  if (!email.trim()) return null;
  try {
    const raw = window.localStorage.getItem(lockoutKey(email));
    const unlockAt = raw ? Number(raw) : NaN;
    if (!Number.isFinite(unlockAt)) return null;
    if (unlockAt <= Date.now()) {
      window.localStorage.removeItem(lockoutKey(email));
      return null;
    }
    return unlockAt;
  } catch {
    return null;
  }
}

export function storeLockout(email: string, unlockAt: number) {
  try {
    window.localStorage.setItem(lockoutKey(email), String(unlockAt));
  } catch {
    // Storage can be unavailable (private mode); the in-memory countdown still works.
  }
}

export function clearStoredLockout(email: string) {
  try {
    window.localStorage.removeItem(lockoutKey(email));
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function readErrorResponse(error: unknown): Promise<{ status: number | null; body: Record<string, unknown> | null }> {
  const context = (error as { context?: Response } | null)?.context;
  if (!context || typeof context.json !== "function") return { status: null, body: null };

  let body: Record<string, unknown> | null = null;
  try {
    body = await context.json();
  } catch {
    body = null;
  }
  return { status: typeof context.status === "number" ? context.status : null, body };
}

const asText = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

/**
 * Asks the `secure-login` edge function to approve the attempt, then signs in
 * immediately. The approval is single-use and valid for 60 seconds, so
 * signInWithPassword must run right away and only once.
 */
export async function secureSignIn(email: string, password: string): Promise<SecureSignInResult> {
  const { data, error } = await supabase.functions.invoke("secure-login", {
    body: { email, password },
  });

  if (error) {
    const { status, body } = await readErrorResponse(error);

    if (status === 429) {
      const retryAfter = Number(body?.retry_after_seconds);
      return {
        status: "locked",
        message: asText(body?.error, "Too many wrong passwords."),
        retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : DEFAULT_LOCK_SECONDS,
      };
    }

    if (status === 401) {
      const attemptsLeft = Number(body?.attempts_left);
      return {
        status: "rejected",
        message: asText(body?.error, "Invalid email or password."),
        attemptsLeft: Number.isFinite(attemptsLeft) ? attemptsLeft : null,
      };
    }

    if (status === null) {
      return { status: "error", message: "Could not reach the server. Check your connection and try again." };
    }

    return { status: "error", message: asText(body?.error, RETRY_MESSAGE) };
  }

  if (!data || (data as { ok?: boolean }).ok !== true) {
    return { status: "error", message: asText((data as { error?: unknown } | null)?.error, RETRY_MESSAGE) };
  }

  const result = await supabase.auth.signInWithPassword({ email, password });

  if (result.error && /invalid login credentials/i.test(result.error.message)) {
    return { status: "error", message: RETRY_MESSAGE };
  }

  return { status: "ok", result };
}
