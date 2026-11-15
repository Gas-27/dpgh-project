import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;

export type SnakeStatus = "draft" | "open" | "finished" | "cancelled";

export type SnakeContest = {
  id: string;
  title: string;
  description: string;
  entry_fee: number;
  prize_gb: number;
  match_minutes: number;
  min_length: number;
  max_attempts: number;
  closes_at: string;
  status: SnakeStatus;
  winner_name: string | null;
  winner_length: number | null;
  prize_claimed: boolean;
  can_claim: boolean;
  players: number;
  my_attempts: number;
  my_best: number | null;
  my_pending: string | null;
  leaders: { username: string; length: number }[];
};

export type AdminSnakeContest = SnakeContest & { prize_phone: string | null; collected: number };

export type SnakeContestInput = {
  id?: string;
  title: string;
  description: string;
  entry_fee: number;
  prize_gb: number;
  match_minutes: number;
  min_length: number;
  max_attempts: number;
  closes_at: string;
  publish: boolean;
};

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const fetchSnakeContests = () => rpc<SnakeContest[]>("gamehub_snake_list");
export const joinSnakeContest = (id: string, hint: string | null) => rpc<{ ok: boolean; attempt_id: string }>("gamehub_snake_join", { p_c: id, p_hint: hint });
export const startSnakeAttempt = (attemptId: string) => rpc<{ ok: boolean; match_minutes: number }>("gamehub_snake_start", { p_attempt: attemptId });
export const submitSnakeAttempt = (attemptId: string, length: number) => rpc<{ ok: boolean; length: number }>("gamehub_snake_submit", { p_attempt: attemptId, p_length: length });
export const claimSnakePrize = (id: string, phone: string) => rpc<{ ok: boolean; reward_gb: number }>("gamehub_snake_claim_prize", { p_c: id, p_phone: phone });

export const fetchAdminSnakeContests = () => rpc<AdminSnakeContest[]>("gamehub_snake_admin_list");
export const saveAdminSnakeContest = (input: SnakeContestInput) => rpc<string>("gamehub_snake_admin_save", { p: input });
export const cancelAdminSnakeContest = (id: string) => rpc<void>("gamehub_snake_admin_cancel", { p_c: id });
export const endAdminSnakeContest = (id: string) => rpc<void>("gamehub_snake_admin_end", { p_c: id });
