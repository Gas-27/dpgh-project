import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Gamepad2, Search, Send, Swords, UserPlus, Ban, MessageCircle } from "lucide-react";
import GameHubMatchCard from "@/components/GameHubMatchCard";
import { useToast } from "@/hooks/use-toast";
import {
  blockPlayer,
  challengePlayer,
  fetchMyPlayer,
  fetchThread,
  friendlyChatError,
  markThreadRead,
  searchPlayers,
  sendMessage,
  setUsername,
  useConversations,
  type ChatMessage,
  type GamePlayer,
} from "@/lib/gameHubSocial";
import { findHubGame, hubGames, type HubGame } from "@/lib/gameHubGames";

type ChatProps = { user: User | null; onPlayGame: (game: HubGame) => void };

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fieldClasses =
  "w-full rounded-xl border border-violet-400/30 bg-violet-950/80 px-3 py-2.5 text-sm text-white placeholder:text-violet-300/50 focus:outline-none focus:ring-2 focus:ring-violet-400";

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-violet-400/25 bg-violet-950/60 px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-700"><MessageCircle className="h-6 w-6 text-white" aria-hidden="true" /></span>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-violet-200/80">{text}</p>
    </div>
  );
}

function UsernameSetup({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const save = useMutation({
    mutationFn: () => setUsername(name),
    onSuccess: onDone,
    onError: (error) => toast({ title: friendlyChatError(error), variant: "destructive" }),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      className="space-y-3 rounded-3xl border border-violet-400/25 bg-violet-950/60 p-5"
    >
      <h3 className="text-lg font-bold text-white">Choose your player name</h3>
      <p className="text-sm leading-relaxed text-violet-200/80">Other players find and message you by this name. Your email stays private.</p>
      <label htmlFor="gamehub-username" className="sr-only">Player name</label>
      <input id="gamehub-username" value={name} onChange={(event) => setName(event.target.value)} maxLength={20} placeholder="e.g. kofi_gamer" autoComplete="off" className={fieldClasses} />
      <p className="text-xs text-violet-300/70">3-20 letters, numbers or underscores.</p>
      <button type="submit" disabled={save.isPending || name.trim().length < 3} className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {save.isPending ? "Saving..." : "Save name"}
      </button>
    </form>
  );
}

function MessageBubble({ message, meId, peer, onPlayGame }: { message: ChatMessage; meId: string; peer: GamePlayer; onPlayGame: (game: HubGame) => void }) {
  const mine = message.senderId === meId;
  const game = message.kind === "game_invite" && message.gameId ? findHubGame(message.gameId) : undefined;
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "rounded-br-md bg-violet-600 text-white" : "rounded-bl-md bg-violet-900/80 text-violet-50"}`}>
        {message.kind === "match" && message.matchId ? (
          <GameHubMatchCard matchId={message.matchId} meId={meId} peerName={peer.username} />
        ) : game ? (
          <div className="w-52 space-y-2">
            <img src={game.image || "/placeholder.svg"} alt="" className="h-24 w-full rounded-xl object-cover" />
            <p className="text-sm font-semibold">{message.body}</p>
            <button type="button" onClick={() => onPlayGame(game)} className="w-full rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-violet-950 hover:bg-amber-300">
              Play {game.name}
            </button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
        )}
        <p className="mt-1 text-right text-[10px] text-white/55">{timeLabel(message.createdAt)}</p>
      </div>
    </li>
  );
}

function Thread({ me, peer, onBack, onPlayGame }: { me: string; peer: GamePlayer; onBack: () => void; onPlayGame: (game: HubGame) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [inviteGameId, setInviteGameId] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const endRef = useRef<HTMLLIElement | null>(null);
  const threadKey = ["gamehub-thread", me, peer.id];

  const { data: messages = [], isLoading } = useQuery({ queryKey: threadKey, queryFn: () => fetchThread(me, peer.id), staleTime: 5_000 });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    markThreadRead(peer.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["gamehub-conversations"] }))
      .catch(() => undefined);
  }, [messages.length, peer.id, queryClient]);

  const appendMessage = (message: ChatMessage) => {
    queryClient.setQueryData<ChatMessage[]>(threadKey, (current = []) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
    void queryClient.invalidateQueries({ queryKey: ["gamehub-conversations"] });
  };
  const onError = (error: unknown) => toast({ title: friendlyChatError(error), variant: "destructive" });

  const send = useMutation({
    mutationFn: (body: string) => sendMessage(peer.id, body),
    onSuccess: (message) => {
      appendMessage(message);
      setText("");
    },
    onError,
  });
  const invite = useMutation({
    mutationFn: (game: HubGame) => sendMessage(peer.id, `Let's play ${game.name}!`, "game_invite", game.id),
    onSuccess: (message) => {
      appendMessage(message);
      setInviteGameId("");
    },
    onError,
  });
  const challenge = useMutation({
    mutationFn: () => challengePlayer(peer.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: threadKey });
      void queryClient.invalidateQueries({ queryKey: ["gamehub-conversations"] });
    },
    onError,
  });
  const block = useMutation({
    mutationFn: () => blockPlayer(peer.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gamehub-conversations"] });
      toast({ title: `${peer.username} blocked` });
      onBack();
    },
    onError,
  });

  const submit = () => {
    const body = text.trim();
    if (body && !send.isPending) send.mutate(body);
  };
  const inviteGame = inviteGameId ? findHubGame(inviteGameId) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-900/70 text-white hover:bg-violet-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <h3 className="min-w-0 flex-1 truncate text-lg font-bold text-white">{peer.username}</h3>
        {confirmBlock ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => block.mutate()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Confirm block</button>
            <button type="button" onClick={() => setConfirmBlock(false)} className="rounded-lg px-2 py-1.5 text-xs text-violet-200">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmBlock(true)} aria-label={`Block ${peer.username}`} className="flex h-9 w-9 items-center justify-center rounded-full text-violet-300 hover:bg-violet-900/70">
            <Ban className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-950/60 p-2">
        <button type="button" disabled={challenge.isPending} onClick={() => challenge.mutate()} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          <Swords className="h-4 w-4" aria-hidden="true" /> Tic-Tac-Toe duel
        </button>
        <label htmlFor="gamehub-invite-game" className="sr-only">Invite to a game</label>
        <select id="gamehub-invite-game" value={inviteGameId} onChange={(event) => setInviteGameId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-violet-400/30 bg-violet-950 px-2 py-2 text-xs text-white">
          <option value="">Invite to a game...</option>
          {hubGames.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
        </select>
        {inviteGame ? (
          <button type="button" disabled={invite.isPending} onClick={() => invite.mutate(inviteGame)} className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-violet-950 disabled:opacity-60">
            <Gamepad2 className="h-4 w-4" aria-hidden="true" /> Send
          </button>
        ) : null}
      </div>

      <ul className="flex max-h-[42dvh] min-h-[180px] flex-col gap-2 overflow-y-auto rounded-2xl border border-violet-400/15 bg-[#0a0418] p-3" aria-label={`Messages with ${peer.username}`}>
        {isLoading ? <li className="text-center text-xs text-violet-300/70">Loading messages...</li> : null}
        {!isLoading && messages.length === 0 ? <li className="py-8 text-center text-sm text-violet-300/70">Say hi to {peer.username} or start a duel.</li> : null}
        {messages.map((message) => <MessageBubble key={message.id} message={message} meId={me} peer={peer} onPlayGame={onPlayGame} />)}
        <li ref={endRef} aria-hidden="true" />
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <label htmlFor="gamehub-message" className="sr-only">Message</label>
        <input
          id="gamehub-message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
          }}
          maxLength={1000}
          placeholder={`Message ${peer.username}`}
          autoComplete="off"
          className={fieldClasses}
        />
        <button type="submit" disabled={send.isPending || !text.trim()} aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50">
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function PlayerSearch({ onSelect }: { onSelect: (player: GamePlayer) => void }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["gamehub-search", trimmed],
    queryFn: () => searchPlayers(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 15_000,
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300/70" aria-hidden="true" />
        <label htmlFor="gamehub-search" className="sr-only">Find a player by name</label>
        <input id="gamehub-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a player by name" autoComplete="off" className={`${fieldClasses} pl-9`} />
      </div>
      {trimmed.length >= 2 ? (
        <ul className="divide-y divide-violet-400/10 overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-950/70">
          {results.map((player) => (
            <li key={player.id}>
              <button type="button" onClick={() => onSelect(player)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-violet-900/60">
                <span className="truncate text-sm font-semibold text-white">{player.username}</span>
                <UserPlus className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
              </button>
            </li>
          ))}
          {!isFetching && results.length === 0 ? <li className="px-4 py-3 text-sm text-violet-300/70">No players found.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

function ConversationList({ userId, onSelect }: { userId: string; onSelect: (player: GamePlayer) => void }) {
  const { data: conversations = [], isLoading } = useConversations(userId, true);
  return (
    <section aria-label="Conversations" className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-violet-300/80">Your chats</h3>
      {isLoading ? <p className="text-sm text-violet-300/70">Loading...</p> : null}
      {!isLoading && conversations.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-violet-400/25 px-4 py-6 text-center text-sm leading-relaxed text-violet-300/80">
          No chats yet. Search for a friend&apos;s player name above to say hi or challenge them to a game.
        </p>
      ) : null}
      <ul className="space-y-2">
        {conversations.map((conversation) => (
          <li key={conversation.peerId}>
            <button
              type="button"
              onClick={() => onSelect({ id: conversation.peerId, username: conversation.peerUsername })}
              className="flex w-full items-center gap-3 rounded-2xl border border-violet-400/20 bg-violet-950/70 px-3 py-3 text-left hover:bg-violet-900/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-700 text-sm font-bold uppercase text-white">{conversation.peerUsername.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-white">{conversation.peerUsername}</span>
                  <span className="shrink-0 text-[10px] text-violet-300/70">{timeLabel(conversation.lastAt)}</span>
                </span>
                <span className="block truncate text-xs text-violet-200/75">
                  {conversation.lastFromMe ? "You: " : ""}
                  {conversation.lastKind === "match" ? "Tic-Tac-Toe duel" : conversation.lastBody}
                </span>
              </span>
              {conversation.unread > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white" aria-label={`${conversation.unread} unread`}>{conversation.unread}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function GameHubChat({ user, onPlayGame }: ChatProps) {
  const queryClient = useQueryClient();
  const [peer, setPeer] = useState<GamePlayer | null>(null);
  const userId = user?.id;
  const { data: me, isLoading } = useQuery({
    queryKey: ["gamehub-player", userId],
    queryFn: () => fetchMyPlayer(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  if (!user) return <Notice title="Sign in to chat" text="Log in from your dashboard, then open Game Hub again to message friends and challenge them to games." />;
  if (isLoading) return <p className="py-10 text-center text-sm text-violet-300/70">Loading...</p>;
  if (!me) return <UsernameSetup onDone={() => void queryClient.invalidateQueries({ queryKey: ["gamehub-player", userId] })} />;

  if (peer) return <Thread me={me.id} peer={peer} onBack={() => setPeer(null)} onPlayGame={onPlayGame} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-violet-300/80">
        Playing as <span className="font-semibold text-white">{me.username}</span>
      </p>
      <PlayerSearch onSelect={setPeer} />
      <ConversationList userId={me.id} onSelect={setPeer} />
    </div>
  );
}
