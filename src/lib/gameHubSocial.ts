import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// The chat tables and RPCs are not in the generated Supabase types yet.
const db = supabase as unknown as SupabaseClient;

export type GamePlayer = { id: string; username: string };

export type Conversation = {
  peerId: string;
  peerUsername: string;
  lastBody: string;
  lastKind: ChatMessageKind;
  lastAt: string;
  lastFromMe: boolean;
  unread: number;
};

export type ChatMessageKind = "text" | "game_invite" | "match";

export type ChatMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  kind: ChatMessageKind;
  body: string;
  gameId: string | null;
  matchId: string | null;
  createdAt: string;
};

export type TttStatus = "pending" | "active" | "finished" | "declined";

export type TttMatch = {
  id: string;
  playerX: string;
  playerO: string;
  board: string;
  turn: string | null;
  status: TttStatus;
  winner: string | null;
  isDraw: boolean;
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  kind: ChatMessageKind;
  body: string;
  game_id: string | null;
  match_id: string | null;
  created_at: string;
};

type MatchRow = {
  id: string;
  player_x: string;
  player_o: string;
  board: string;
  turn: string | null;
  status: TttStatus;
  winner: string | null;
  is_draw: boolean;
};

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  senderId: row.sender_id,
  recipientId: row.recipient_id,
  kind: row.kind,
  body: row.body,
  gameId: row.game_id,
  matchId: row.match_id,
  createdAt: row.created_at,
});

const toMatch = (row: MatchRow): TttMatch => ({
  id: row.id,
  playerX: row.player_x,
  playerO: row.player_o,
  board: row.board,
  turn: row.turn,
  status: row.status,
  winner: row.winner,
  isDraw: row.is_draw,
});

const ERROR_COPY: Record<string, string> = {
  not_signed_in: "Sign in to use messages.",
  username_required: "Pick a username first.",
  username_taken: "That username is taken. Try another.",
  invalid_username: "Use 3-20 letters, numbers or underscores.",
  player_not_found: "That player could not be found.",
  blocked: "You cannot message this player.",
  slow_down: "You are sending too fast. Wait a moment.",
  invalid_body: "Messages must be 1-1000 characters.",
  not_your_turn: "It is not your turn.",
  cell_taken: "That square is already taken.",
  match_not_active: "This match is not active.",
  match_not_pending: "This challenge was already answered.",
  match_not_found: "Match not found.",
};

export function friendlyChatError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  return ERROR_COPY[message.trim()] ?? "Something went wrong. Please try again.";
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export async function fetchMyPlayer(userId: string): Promise<GamePlayer | null> {
  const { data, error } = await db.from("gamehub_players").select("user_id, username").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? { id: data.user_id as string, username: data.username as string } : null;
}

export const setUsername = (username: string) => rpc<string>("gamehub_set_username", { p_username: username });

export async function searchPlayers(query: string): Promise<GamePlayer[]> {
  const rows = await rpc<{ player_id: string; player_username: string }[]>("gamehub_search_players", { p_query: query });
  return (rows ?? []).map((row) => ({ id: row.player_id, username: row.player_username }));
}

export async function fetchConversations(): Promise<Conversation[]> {
  const rows = await rpc<
    { peer_id: string; peer_username: string; last_body: string; last_kind: ChatMessageKind; last_at: string; last_from_me: boolean; unread_count: number }[]
  >("gamehub_conversations");
  return (rows ?? []).map((row) => ({
    peerId: row.peer_id,
    peerUsername: row.peer_username,
    lastBody: row.last_body,
    lastKind: row.last_kind,
    lastAt: row.last_at,
    lastFromMe: row.last_from_me,
    unread: row.unread_count,
  }));
}

export async function fetchThread(me: string, peer: string): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("gamehub_messages")
    .select("id, sender_id, recipient_id, kind, body, game_id, match_id, created_at")
    .or(`and(sender_id.eq.${me},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${me})`)
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).map(toMessage).reverse();
}

export async function sendMessage(recipient: string, body: string, kind: "text" | "game_invite" = "text", gameId?: string): Promise<ChatMessage> {
  const row = await rpc<MessageRow>("gamehub_send_message", { p_recipient: recipient, p_body: body, p_kind: kind, p_game_id: gameId ?? null });
  return toMessage(row);
}

export const markThreadRead = (peer: string) => rpc<void>("gamehub_mark_read", { p_peer: peer });

export const blockPlayer = (user: string) => rpc<void>("gamehub_block_player", { p_user: user, p_blocked: true });

export async function challengePlayer(opponent: string): Promise<TttMatch> {
  return toMatch(await rpc<MatchRow>("gamehub_challenge", { p_opponent: opponent }));
}

export async function respondToMatch(matchId: string, accept: boolean): Promise<TttMatch> {
  return toMatch(await rpc<MatchRow>("gamehub_respond_match", { p_match: matchId, p_accept: accept }));
}

export async function playMove(matchId: string, cell: number): Promise<TttMatch> {
  return toMatch(await rpc<MatchRow>("gamehub_play_move", { p_match: matchId, p_cell: cell }));
}

export async function fetchMatch(matchId: string): Promise<TttMatch | null> {
  const { data, error } = await db
    .from("gamehub_matches")
    .select("id, player_x, player_o, board, turn, status, winner, is_draw")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data ? toMatch(data as MatchRow) : null;
}

export function useConversations(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["gamehub-conversations", userId],
    queryFn: fetchConversations,
    enabled: enabled && Boolean(userId),
    staleTime: 10_000,
  });
}

/** Keeps open chats and matches fresh as the other player sends messages or moves. */
export function useGameHubRealtime(userId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !userId) return;
    const channel = db
      .channel(`gamehub-social-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gamehub_messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["gamehub-conversations"] });
        void queryClient.invalidateQueries({ queryKey: ["gamehub-thread"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "gamehub_matches" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["gamehub-match"] });
      })
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [userId, enabled, queryClient]);
}
