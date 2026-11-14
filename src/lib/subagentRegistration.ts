import { DOMAINS } from "@/config/domains";

export const PENDING_SUBAGENT_LOGIN_KEY = "pending_subagent_login";

export interface PendingSubagentLogin {
  email: string;
  password: string;
  reference: string;
  createdAt: number;
}

export function savePendingSubagentLogin(value: PendingSubagentLogin) {
  sessionStorage.setItem(PENDING_SUBAGENT_LOGIN_KEY, JSON.stringify(value));
}

export function readPendingSubagentLogin(): PendingSubagentLogin | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SUBAGENT_LOGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.email === "string" && typeof parsed?.password === "string") {
      return parsed as PendingSubagentLogin;
    }
  } catch {
    // fall through to null
  }
  return null;
}

export function clearPendingSubagentLogin() {
  sessionStorage.removeItem(PENDING_SUBAGENT_LOGIN_KEY);
}

// The sub-agent dashboard lives at /dashboard on agentsstore.shop and at
// /subagent-dashboard everywhere else. Using the current origin keeps the
// freshly created session valid, because sessions are stored per origin.
export function getSubagentDashboardPath(): string {
  const hostname = window.location.hostname.toLowerCase();
  const onSubagentDomain =
    hostname === DOMAINS.SUBAGENT_STORE ||
    hostname === `www.${DOMAINS.SUBAGENT_STORE}` ||
    hostname.endsWith(`.${DOMAINS.SUBAGENT_STORE}`);
  return onSubagentDomain ? "/dashboard" : "/subagent-dashboard";
}

// Edge function errors carry the JSON body on error.context.
export async function readFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const fnError = error as { message?: string; context?: Response } | null;
  try {
    const body = await fnError?.context?.json();
    if (body?.error) return String(body.error);
  } catch {
    // keep the default message
  }
  return fnError?.message || fallback;
}
