import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { buildGameHubShareUrl } from "@/lib/gameHubRoute";
import { getGuestId } from "@/lib/gameHubGuest";

// The Game Hub tables and functions are not part of the generated Database types yet.
const db = supabase as unknown as SupabaseClient;

export const GAME_VIDEO_BUCKET = "gamehub-videos";
export const MAX_GAME_VIDEO_BYTES = 50 * 1024 * 1024;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export type GameVideo = {
  game_id: string;
  video_url: string;
  storage_path: string | null;
  updated_at: string;
};

export type LeaderboardRow = {
  rank: number;
  player: string;
  score: number;
  games_played: number;
  is_you: boolean;
  is_guest?: boolean;
};

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "player***";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain.slice(0, 1)}***`;
}

export async function fetchGameVideos(): Promise<GameVideo[]> {
  const { data, error } = await db
    .from("gamehub_game_videos")
    .select("game_id, video_url, storage_path, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GameVideo[];
}

export type LeaderboardPeriod = "today" | "yesterday" | "week" | "month" | "all";

export async function fetchLeaderboard(gameId: string | null, period: LeaderboardPeriod = "all"): Promise<LeaderboardRow[]> {
  const pageSize = 1000;
  const maxPages = 50;
  const rows: LeaderboardRow[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const { data, error } = await db
      .rpc("gamehub_leaderboard_period", { p_game_id: gameId, p_period: period, p_limit: null, p_guest_id: getGuestId() })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as LeaderboardRow[];
    rows.push(...batch.map((row) => ({ ...row, rank: Number(row.rank), score: Number(row.score) })));
    if (batch.length < pageSize) break;
  }
  return rows;
}

export type AdminWalletOption = { type: "customer" | "agent" | "subagent" | "subsubagent"; label: string; balance: number };

export type AdminLeaderboardRow = {
  rank: number;
  user_id: string;
  email: string;
  score: number;
  games_played: number;
  topup_reference: string | null;
  store_name: string | null;
  wallets: AdminWalletOption[];
};

export async function adminFetchLeaderboard(gameId: string | null, period: LeaderboardPeriod): Promise<AdminLeaderboardRow[]> {
  const { data, error } = await db.rpc("gamehub_admin_leaderboard", { p_game_id: gameId, p_period: period, p_limit: 100 });
  if (error) throw error;
  return ((data ?? []) as AdminLeaderboardRow[]).map((row) => ({
    ...row,
    rank: Number(row.rank),
    score: Number(row.score),
    wallets: (row.wallets ?? []).map((wallet) => ({ ...wallet, balance: Number(wallet.balance) })),
  }));
}

export async function adminRewardWallet(input: {
  userId: string;
  walletType: AdminWalletOption["type"];
  amount: number;
  note: string;
  reference: string;
}): Promise<{ balance_after: number }> {
  const { data, error } = await db.rpc("gamehub_admin_reward_wallet", {
    p_user_id: input.userId,
    p_wallet_type: input.walletType,
    p_amount: input.amount,
    p_note: input.note,
    p_reference: input.reference,
  });
  if (error) throw error;
  return data as { balance_after: number };
}

export type PublicReward = { id: string; player: string; amount: number; note: string | null; created_at: string };

export async function fetchPublicRewards(): Promise<PublicReward[]> {
  const { data, error } = await db.rpc("gamehub_public_rewards", { p_limit: 20 });
  if (error) throw error;
  return ((data ?? []) as PublicReward[]).map((row) => ({ ...row, amount: Number(row.amount) }));
}

export type GameHubAnnouncement = { id: string; title: string; body: string; created_at: string };
export type AdminAnnouncement = GameHubAnnouncement & { active: boolean };

export async function fetchActiveAnnouncements(): Promise<GameHubAnnouncement[]> {
  const { data, error } = await db.rpc("gamehub_active_announcements", { p_limit: 5 });
  if (error) throw error;
  return (data ?? []) as GameHubAnnouncement[];
}

export async function adminFetchAnnouncements(): Promise<AdminAnnouncement[]> {
  const { data, error } = await db.rpc("gamehub_admin_announcements");
  if (error) throw error;
  return (data ?? []) as AdminAnnouncement[];
}

export async function adminPostAnnouncement(title: string, body: string): Promise<void> {
  const { error } = await db.rpc("gamehub_admin_post_announcement", { p_title: title, p_body: body });
  if (error) throw error;
}

export async function adminSetAnnouncementActive(id: string, active: boolean): Promise<void> {
  const { error } = await db.rpc("gamehub_admin_set_announcement", { p_id: id, p_active: active });
  if (error) throw error;
}

export async function adminDeleteAnnouncement(id: string): Promise<void> {
  const { error } = await db.rpc("gamehub_admin_delete_announcement", { p_id: id });
  if (error) throw error;
}

export async function submitScore(gameId: string, score: number): Promise<number> {
  const { data, error } = await db.rpc("gamehub_submit_score", { p_game_id: gameId, p_score: Math.floor(score) });
  if (error) throw error;
  return Number(data);
}

export async function submitGuestScore(gameId: string, sessionId: string, score: number): Promise<number> {
  const { data, error } = await db.rpc("gamehub_guest_submit", {
    p_guest_id: getGuestId(),
    p_session_id: sessionId,
    p_game_id: gameId,
    p_score: Math.max(0, Math.floor(score)),
  });
  if (error) throw error;
  return Number(data);
}

export type GameRun = {
  run_id: string;
  game_id: string;
  level: number;
  lives: number;
  status: "active" | "cleared" | "over" | "abandoned" | "flagged";
  target: number;
  lives_bought: number;
  claimed: boolean;
  reward_claimed: boolean;
  life_price: number;
  reward_gb: number;
  reward_enabled: boolean;
  required_seconds: number | null;
  play_seconds: number;
};

export type GameRewardSetting = {
  game_id: string;
  title: string;
  reward_gb: number;
  enabled: boolean;
  updated_at: string;
  target_level: number | null;
  max_level: number | null;
  life_price: number;
  required_seconds: number | null;
};

export async function fetchGameRewardSettings(): Promise<GameRewardSetting[]> {
  const { data, error } = await db.from("gamehub_game_settings").select("game_id, title, reward_gb, enabled, updated_at, target_level, max_level, life_price, required_seconds").order("title");
  if (error) throw error;
  return ((data ?? []) as GameRewardSetting[]).map((row) => ({ ...row, reward_gb: Number(row.reward_gb), life_price: Number(row.life_price) }));
}

export async function adminSetGameReward(gameId: string, gb: number, enabled: boolean): Promise<void> {
  const { error } = await db.rpc("admin_set_gamehub_reward", { p_game_id: gameId, p_gb: gb, p_enabled: enabled });
  if (error) throw error;
}

export type GameRulesInput = {
  gameId: string;
  gb: number;
  enabled: boolean;
  targetLevel: number | null;
  lifePrice: number;
  requiredSeconds: number | null;
};

export async function adminSetGameRules(input: GameRulesInput): Promise<void> {
  const { error } = await db.rpc("admin_set_gamehub_rules", {
    p_game_id: input.gameId,
    p_gb: input.gb,
    p_enabled: input.enabled,
    p_target_level: input.targetLevel,
    p_life_price: input.lifePrice,
    p_required_seconds: input.requiredSeconds,
  });
  if (error) throw error;
}

export async function timedBegin(runId: string): Promise<GameRun> {
  const { data, error } = await db.rpc("gamehub_timed_begin", { p_run_id: runId });
  if (error) throw error;
  return data as GameRun;
}

export async function timedTick(runId: string): Promise<GameRun> {
  const { data, error } = await db.rpc("gamehub_timed_tick", { p_run_id: runId });
  if (error) throw error;
  return data as GameRun;
}

export async function recordShot(runId: string): Promise<GameRun> {
  const { data, error } = await db.rpc("gamehub_record_shot", { p_run_id: runId });
  if (error) throw error;
  return data as GameRun;
}

export type LevelResult = { ok: boolean; reason?: string; run: GameRun };

export async function startGameRun(gameId: string, walletHint: string | null, forceNew = false): Promise<GameRun> {
  const { data, error } = await db.rpc("gamehub_start_run", { p_game_id: gameId, p_wallet_hint: walletHint, p_force_new: forceNew });
  if (error) throw error;
  return data as GameRun;
}

export async function completeGameLevel(runId: string, level: number): Promise<LevelResult> {
  const { data, error } = await db.rpc("gamehub_complete_level", { p_run_id: runId, p_level: level });
  if (error) throw error;
  return data as LevelResult;
}

export async function loseGameLife(runId: string): Promise<GameRun> {
  const { data, error } = await db.rpc("gamehub_lose_life", { p_run_id: runId });
  if (error) throw error;
  return data as GameRun;
}

export async function buyGameLife(runId: string): Promise<{ run: GameRun; balance: number }> {
  const { data, error } = await db.rpc("gamehub_buy_life", { p_run_id: runId });
  if (error) throw error;
  const result = data as { run: GameRun; balance: number };
  return { run: result.run, balance: Number(result.balance) };
}

export async function buyGameArrow(runId: string): Promise<{ run: GameRun; balance: number; arrows_bought: number }> {
  const { data, error } = await db.rpc("gamehub_buy_arrow", { p_run_id: runId });
  if (error) throw error;
  const result = data as { run: GameRun; balance: number; arrows_bought: number };
  return { run: result.run, balance: Number(result.balance), arrows_bought: Number(result.arrows_bought) };
}

export async function endGameRun(runId: string): Promise<GameRun> {
  const { data, error } = await db.rpc("gamehub_end_run", { p_run_id: runId });
  if (error) throw error;
  return data as GameRun;
}

export async function claimGameReward(runId: string, phone: string): Promise<{ order_id: string; phone: string; reward_gb: number }> {
  const { data, error } = await db.rpc("gamehub_claim_reward", { p_run_id: runId, p_phone: phone });
  if (error) throw error;
  return data as { order_id: string; phone: string; reward_gb: number };
}

export async function fetchGameWalletBalance(walletHint: string | null): Promise<number | null> {
  const { data, error } = await db.rpc("gamehub_wallet_balance", { p_hint: walletHint });
  if (error) throw error;
  return data === null || data === undefined ? null : Number(data);
}

export async function uploadGameVideo(gameId: string, file: File): Promise<void> {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) throw new Error("Please choose an MP4, WebM or MOV video.");
  if (file.size > MAX_GAME_VIDEO_BYTES) throw new Error("Video is larger than 50 MB. Trim or compress it and try again.");

  const { data: existing } = await db.from("gamehub_game_videos").select("storage_path").eq("game_id", gameId).maybeSingle();
  const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${gameId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(GAME_VIDEO_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from(GAME_VIDEO_BUCKET).getPublicUrl(path);
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db.from("gamehub_game_videos").upsert({
    game_id: gameId,
    video_url: publicUrl.publicUrl,
    storage_path: path,
    updated_by: auth.user?.id ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    await supabase.storage.from(GAME_VIDEO_BUCKET).remove([path]);
    throw error;
  }
  const previousPath = (existing as { storage_path: string | null } | null)?.storage_path;
  if (previousPath) await supabase.storage.from(GAME_VIDEO_BUCKET).remove([previousPath]);
}

export async function deleteGameVideo(video: GameVideo): Promise<void> {
  const { error } = await db.from("gamehub_game_videos").delete().eq("game_id", video.game_id);
  if (error) throw error;
  if (video.storage_path) await supabase.storage.from(GAME_VIDEO_BUCKET).remove([video.storage_path]);
}

export function buildGameShareUrl(gameId: string): string {
  return buildGameHubShareUrl(gameId);
}

export async function shareText(title: string, text: string, url: string): Promise<"shared" | "copied"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return "shared";
    }
  }
  await navigator.clipboard.writeText(`${text} ${url}`);
  return "copied";
}
