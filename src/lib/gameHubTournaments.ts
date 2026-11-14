import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hubGames } from "@/lib/gameHubGames";

const db = supabase as unknown as SupabaseClient;

export const TOURNAMENT_GAME_IDS = [
  "cup-shuffle",
  "snap-fit",
  "nail-hit",
  "fruits-slash",
  "rock-blast",
  "cut-score",
  "brain-memory",
  "sliding-tiles",
  "stop-timer",
  "endless-runner",
] as const;

export const tournamentGames = TOURNAMENT_GAME_IDS.map((id) => hubGames.find((game) => game.id === id)).filter(
  (game): game is NonNullable<typeof game> => Boolean(game?.native),
);

export function tournamentGameName(gameId: string): string {
  return hubGames.find((game) => game.id === gameId)?.name ?? gameId;
}

export type TournamentStatus = "draft" | "open" | "live" | "finished" | "cancelled";

export type TournamentSummary = {
  id: string;
  title: string;
  description: string;
  entry_fee: number;
  prize_gb: number;
  max_players: number;
  status: TournamentStatus;
  starts_at: string | null;
  entries_count: number;
  joined: boolean;
  winner_name: string | null;
};

export type TournamentStage = { stage_no: number; name: string; games: string[]; wins_needed: number | null };

export type TournamentAttempt = { user_id: string; status: "ready" | "playing" | "cleared" | "over" | "forfeit"; level: number; score: number };

export type TournamentGame = {
  id: string;
  game_no: number;
  game_id: string;
  status: "open" | "finished";
  winner: string | null;
  target: number;
  opened_at: string;
  attempts: TournamentAttempt[];
};

export type TournamentMatch = {
  id: string;
  round: number;
  slot: number;
  stage_no: number;
  status: "waiting" | "live" | "finished";
  p1: string | null;
  p2: string | null;
  p1_name: string | null;
  p2_name: string | null;
  winner: string | null;
  p1_wins: number;
  p2_wins: number;
  wins_needed: number;
  game_ids: string[];
  games: TournamentGame[];
};

export type TournamentDetail = {
  tournament: {
    id: string;
    title: string;
    description: string;
    entry_fee: number;
    prize_gb: number;
    max_players: number;
    status: TournamentStatus;
    starts_at: string | null;
    winner_id: string | null;
    winner_name: string | null;
    prize_claimed: boolean;
    can_claim: boolean;
    joined: boolean;
    me: string | null;
  };
  stages: Array<TournamentStage & { wins_needed: number }>;
  entries: Array<{ user_id: string; username: string; status: "joined" | "disqualified" }>;
  matches: TournamentMatch[];
};

export type MyTournamentGame = {
  match_id: string;
  match_game_id: string;
  game_id: string;
  game_no: number;
  games_total: number;
  wins_needed: number;
  target: number;
  start_seconds_left: number;
  me: { user_id: string; status: TournamentAttempt["status"]; level: number; wins: number };
  opponent: { user_id: string; username: string; status: TournamentAttempt["status"]; level: number; wins: number };
};

export type AttemptResult = { ok: boolean; level: number; target: number; lives: number; status: "active" | "cleared" | "over"; reason?: string };

export type AdminTournament = Omit<TournamentSummary, "joined"> & {
  created_at: string;
  prize_claimed: boolean;
  fees_collected: number;
  stages: TournamentStage[];
};

export type TournamentInput = {
  id?: string;
  title: string;
  description: string;
  entry_fee: number;
  prize_gb: number;
  max_players: number;
  starts_at: string | null;
  publish: boolean;
  stages: Array<{ name: string; games: string[]; wins_needed: number | null }>;
};

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const fetchTournaments = () => rpc<TournamentSummary[]>("gamehub_tournaments_list");
export const fetchTournamentDetail = (id: string) => rpc<TournamentDetail>("gamehub_tournament_detail", { p_t: id });
export const joinTournament = (id: string, hint: string | null) => rpc<{ ok: boolean }>("gamehub_tournament_join", { p_t: id, p_hint: hint });
export const leaveTournament = (id: string) => rpc<void>("gamehub_tournament_leave", { p_t: id });
export const fetchMyTournamentGame = (id: string) => rpc<MyTournamentGame | null>("gamehub_tm_my_game", { p_t: id });
export const startTournamentAttempt = (mg: string) => rpc<AttemptResult>("gamehub_tm_start", { p_mg: mg });
export const completeTournamentLevel = (mg: string, level: number) => rpc<AttemptResult>("gamehub_tm_level_complete", { p_mg: mg, p_level: level });
export const loseTournamentLife = (mg: string) => rpc<AttemptResult>("gamehub_tm_life_lost", { p_mg: mg });
export const reportTournamentIntegrity = (mg: string, kind: string) => rpc<AttemptResult>("gamehub_tm_integrity", { p_mg: mg, p_kind: kind });
export const claimTournamentPrize = (id: string, phone: string) => rpc<{ ok: boolean; reward_gb: number }>("gamehub_tournament_claim_prize", { p_t: id, p_phone: phone });

export const fetchAdminTournaments = () => rpc<AdminTournament[]>("gamehub_admin_tournaments");
export const saveAdminTournament = (input: TournamentInput) => rpc<string>("gamehub_admin_save_tournament", { p: input });
export const startAdminTournament = (id: string) => rpc<void>("gamehub_admin_start_tournament", { p_t: id });
export const cancelAdminTournament = (id: string) => rpc<void>("gamehub_admin_cancel_tournament", { p_t: id });
export const disqualifyTournamentPlayer = (id: string, userId: string) => rpc<void>("gamehub_admin_disqualify", { p_t: id, p_user: userId });

export function stageCountFor(maxPlayers: number): number {
  return Math.max(1, Math.round(Math.log2(maxPlayers)));
}

export function defaultStageName(stageNo: number, total: number): string {
  const fromEnd = total - stageNo;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-final";
  if (fromEnd === 2) return "Quarter-final";
  return `Round ${stageNo}`;
}

// Live view: each player's browser publishes small frames to a broadcast channel keyed by the (unguessable) game id.
// Frames are cosmetic only. Scores and winners always come from the database.
export type LiveFrame = { user_id: string; image: string | null; level: number; at: number };

export function liveChannelName(matchGameId: string): string {
  return `tm-live-${matchGameId}`;
}

export function openLiveChannel(matchGameId: string, onFrame: (frame: LiveFrame) => void) {
  const channel = db.channel(liveChannelName(matchGameId), { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event: "frame" }, (message) => onFrame(message.payload as LiveFrame)).subscribe();
  return {
    send(frame: LiveFrame) {
      void channel.send({ type: "broadcast", event: "frame", payload: frame });
    },
    close() {
      void db.removeChannel(channel);
    },
  };
}
