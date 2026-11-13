import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;

export type WithdrawalRole = "agent" | "subagent" | "sub_subagent";

export type RoleControl = { paused: boolean; message: string };
export type WithdrawalControls = Record<WithdrawalRole, RoleControl>;

export const WITHDRAWAL_ROLES: { role: WithdrawalRole; label: string }[] = [
  { role: "agent", label: "Agents" },
  { role: "subagent", label: "Subagents" },
  { role: "sub_subagent", label: "Sub-subagents" },
];

export const DEFAULT_PAUSE_MESSAGE = "Withdrawals are temporarily unavailable. Please try again later.";

export function emptyControls(): WithdrawalControls {
  return {
    agent: { paused: false, message: "" },
    subagent: { paused: false, message: "" },
    sub_subagent: { paused: false, message: "" },
  };
}

export async function fetchWithdrawalControls(): Promise<WithdrawalControls> {
  const { data, error } = await db.rpc("get_withdrawal_controls");
  if (error) throw new Error(error.message);
  const base = emptyControls();
  const raw = (data ?? {}) as Partial<Record<WithdrawalRole, Partial<RoleControl>>>;
  for (const { role } of WITHDRAWAL_ROLES) {
    base[role] = { paused: Boolean(raw[role]?.paused), message: String(raw[role]?.message ?? "") };
  }
  return base;
}

export async function saveWithdrawalControls(controls: WithdrawalControls): Promise<void> {
  const { error } = await db.rpc("admin_set_withdrawal_controls", { p: controls });
  if (error) throw new Error(error.message);
}

/** Returns the admin's message when withdrawals are paused for this role, otherwise null. */
export async function getWithdrawalPauseMessage(role: WithdrawalRole): Promise<string | null> {
  try {
    const controls = await fetchWithdrawalControls();
    const control = controls[role];
    if (!control.paused) return null;
    return control.message.trim() || DEFAULT_PAUSE_MESSAGE;
  } catch {
    // The edge function enforces the pause server-side, so a failed lookup must not block the UI.
    return null;
  }
}
