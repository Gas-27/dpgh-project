import { useCallback, useEffect, useState } from "react";
import {
  clearStoredLockout,
  formatCountdown,
  readStoredLockout,
  secureSignIn,
  storeLockout,
  type SecureSignInResult,
} from "@/lib/secureSignIn";

const LOCKED_PREFIX = "Too many wrong passwords. Try again in";

/**
 * Wraps `secureSignIn` with the shared lockout UI state: the error message,
 * a live countdown, and persistence of the unlock time per email address.
 */
export function useSecureSignIn(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [unlockAt, setUnlockAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setUnlockAt(readStoredLockout(normalizedEmail));
    setNow(Date.now());
  }, [normalizedEmail]);

  useEffect(() => {
    if (unlockAt === null) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= unlockAt) {
        clearStoredLockout(normalizedEmail);
        setUnlockAt(null);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [unlockAt, normalizedEmail]);

  const secondsLeft = unlockAt === null ? 0 : Math.max(0, Math.ceil((unlockAt - now) / 1000));
  const isLocked = secondsLeft > 0;

  const submit = useCallback(
    async (rawEmail: string, password: string): Promise<SecureSignInResult> => {
      const cleanEmail = rawEmail.trim();
      const storedUnlock = readStoredLockout(cleanEmail);
      if (storedUnlock !== null) {
        setUnlockAt(storedUnlock);
        setNow(Date.now());
        return {
          status: "locked",
          message: LOCKED_PREFIX,
          retryAfterSeconds: Math.ceil((storedUnlock - Date.now()) / 1000),
        };
      }

      setMessage(null);
      const outcome = await secureSignIn(cleanEmail, password);

      if (outcome.status === "locked") {
        const nextUnlock = Date.now() + outcome.retryAfterSeconds * 1000;
        storeLockout(cleanEmail, nextUnlock);
        setUnlockAt(nextUnlock);
        setNow(Date.now());
      } else if (outcome.status === "rejected" || outcome.status === "error") {
        setMessage(outcome.message);
      } else {
        clearStoredLockout(cleanEmail);
      }

      return outcome;
    },
    [],
  );

  const notice = isLocked ? `${LOCKED_PREFIX} ${formatCountdown(secondsLeft)}` : message;

  return { submit, isLocked, notice };
}
