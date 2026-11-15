import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Gift, Loader2, Timer, Trophy, Users, Wallet } from "lucide-react";
import { walletHintFromPath } from "@/components/GameHubRewardPlayer";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getFriendlyBlockedMessage } from "@/lib/blockedMessages";
import {
  claimSnakePrize,
  fetchSnakeContests,
  joinSnakeContest,
  startSnakeAttempt,
  submitSnakeAttempt,
  type SnakeContest,
  type SnakeRound,
} from "@/lib/gameHubSnake";
import { fetchMyPlayer } from "@/lib/gameHubSocial";

const QUERY_KEY = ["snake-contests"];

function errorText(error: unknown): string {
  return getFriendlyBlockedMessage(error) ?? (error as Error).message;
}

function timeLeft(closesAt: string, now: number): string {
  const ms = new Date(closesAt).getTime() - now;
  if (ms <= 0) return "Closed";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m ${Math.floor((ms % 60000) / 1000)}s left`;
}

type ActiveMatch = { attemptId: string; round: SnakeRound; clockSkew: number };

type MatchProps = { match: ActiveMatch; contestId: string; minutes: number; onDone: () => void };

async function fetchPlayerIdentity(): Promise<{ id: string; name: string }> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? "";
  const player = userId ? await fetchMyPlayer(userId).catch(() => null) : null;
  return { id: userId, name: player?.username ?? "Player" };
}

function SnakeMatch({ match, contestId, minutes, onDone }: MatchProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { data: identity } = useQuery({ queryKey: ["snake-identity"], queryFn: fetchPlayerIdentity, staleTime: 60_000 });

  useEffect(() => {
    const container = containerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    container?.requestFullscreen?.().catch(() => undefined);
    (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape").catch(() => undefined);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      screen.orientation?.unlock?.();
    };
  }, []);

  useEffect(() => {
    if (!identity) return;
    const sendToGame = (message: Record<string, unknown>) => frameRef.current?.contentWindow?.postMessage(message, "*");
    let subscribed = false;
    const channel = supabase.channel(`snake-room-${contestId}-${match.round.round_start_ms}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channel
      .on("broadcast", { event: "*" }, (message) => sendToGame({ type: "snake-net-recv", event: message.event, payload: message.payload }))
      .subscribe((status) => {
        subscribed = status === "SUBSCRIBED";
        if (subscribed) sendToGame({ type: "snake-net-ready" });
      });

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; attemptId?: string; length?: number; event?: string; payload?: unknown } | null;
      if (!data) return;
      if (data.type === "snake-net-send" && subscribed && data.event) {
        void channel.send({ type: "broadcast", event: data.event, payload: data.payload });
      } else if (data.type === "snake-net-hello" && subscribed) {
        sendToGame({ type: "snake-net-ready" });
      } else if (data.type === "snake-leave") {
        onDone();
      } else if (data.type === "snake-contest-result" && data.attemptId === match.attemptId) {
        submitSnakeAttempt(match.attemptId, Number(data.length) || 0)
          .then(() => sendToGame({ type: "snake-contest-saved" }))
          .catch((error) => toast({ title: "Could not save your result", description: errorText(error), variant: "destructive" }));
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      void supabase.removeChannel(channel);
    };
  }, [identity, contestId, match, onDone, toast]);

  if (!identity) return null;

  const params = new URLSearchParams({
    attempt: match.attemptId,
    contest: contestId,
    minutes: String(minutes),
    name: identity.name,
    uid: identity.id,
    rs: String(match.round.round_start_ms),
    re: String(match.round.round_end_ms),
    skew: String(match.clockSkew),
  });

  return createPortal(
    <div ref={containerRef} className="fixed inset-0 z-[9999] bg-[#0d0620]" style={{ height: "100dvh", width: "100vw" }}>
      <iframe ref={frameRef} title="Snake War live match" src={`/games/snake-war-contest.html?${params.toString()}`} className="block h-full w-full border-0" allow="autoplay; fullscreen" />
    </div>,
    document.body,
  );
}

function ContestCard({ contest, signedIn }: { contest: SnakeContest; signedIn: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [phone, setPhone] = useState("");
  const [match, setMatch] = useState<ActiveMatch | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const closed = contest.status !== "open" || new Date(contest.closes_at).getTime() <= now;

  const join = useMutation({
    mutationFn: () => joinSnakeContest(contest.id, walletHintFromPath(window.location.pathname)),
    onSuccess: () => {
      toast({ title: "You are in", description: contest.entry_fee > 0 ? "Your entry fee was taken from your wallet." : "Good luck!" });
      refresh();
    },
    onError: (error) => toast({ title: "Could not enter", description: errorText(error), variant: "destructive" }),
  });

  const start = useMutation({
    mutationFn: (attemptId: string) => startSnakeAttempt(attemptId).then((round) => ({ attemptId, round, clockSkew: round.server_ms - Date.now() })),
    onSuccess: (started) => setMatch(started),
    onError: (error) => {
      toast({ title: "Could not start", description: errorText(error), variant: "destructive" });
      refresh();
    },
  });

  const claim = useMutation({
    mutationFn: () => claimSnakePrize(contest.id, phone),
    onSuccess: (result) => {
      toast({ title: "Prize on its way", description: `${result.reward_gb}GB is being sent to your number.` });
      refresh();
    },
    onError: (error) => toast({ title: "Could not claim", description: errorText(error), variant: "destructive" }),
  });

  const attemptsLeft = contest.max_attempts - contest.my_attempts;

  return (
    <li className="space-y-3 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-emerald-900/40 to-violet-950/80 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-bold text-balance">{contest.title}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${closed ? "bg-violet-500/20 text-violet-200" : "bg-emerald-500/20 text-emerald-300"}`}>
          {contest.status === "finished" ? "Finished" : closed ? "Closing" : "Open"}
        </span>
      </div>
      {contest.description ? <p className="text-sm text-violet-200">{contest.description}</p> : null}

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-black/30 p-2"><dt className="text-[10px] uppercase text-violet-300">Prize</dt><dd className="text-base font-extrabold text-amber-300">{contest.prize_gb}GB</dd></div>
        <div className="rounded-xl bg-black/30 p-2"><dt className="text-[10px] uppercase text-violet-300">Entry</dt><dd className="text-base font-extrabold">{contest.entry_fee > 0 ? `GH₵${contest.entry_fee.toFixed(2)}` : "Free"}</dd></div>
        <div className="rounded-xl bg-black/30 p-2"><dt className="text-[10px] uppercase text-violet-300">Match</dt><dd className="text-base font-extrabold">{contest.match_minutes} min</dd></div>
      </dl>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-violet-200">
        <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" aria-hidden="true" /> {contest.status === "finished" ? "Contest over" : timeLeft(contest.closes_at, now)}</span>
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {contest.players} playing</span>
        {contest.min_length > 0 ? <span>Need {contest.min_length}+ segments to win</span> : null}
      </div>
      <p className="text-xs text-violet-300">
        Play one {contest.match_minutes}-minute Snake War match per entry. When the contest closes, the longest snake wins the free data.
      </p>

      {contest.status === "open" && !closed ? (
        contest.my_pending ? (
          <button type="button" onClick={() => start.mutate(contest.my_pending as string)} disabled={start.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-extrabold text-black disabled:opacity-60">
            {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Play your match now
          </button>
        ) : attemptsLeft > 0 ? (
          <button type="button" onClick={() => join.mutate()} disabled={!signedIn || join.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold disabled:opacity-60">
            <Wallet className="h-4 w-4" aria-hidden="true" />
            {!signedIn ? "Sign in to enter" : join.isPending ? "Entering..." : contest.entry_fee > 0 ? `Enter for GH₵${contest.entry_fee.toFixed(2)}${contest.my_attempts > 0 ? " (try again)" : ""}` : "Enter for free"}
          </button>
        ) : (
          <p className="rounded-xl bg-black/30 p-2 text-center text-xs text-violet-200">You have used all your entries.</p>
        )
      ) : null}

      {contest.my_best !== null ? <p className="text-center text-xs font-semibold text-emerald-300">Your best snake: {contest.my_best} segments</p> : null}

      {contest.leaders.length > 0 ? (
        <ol className="space-y-1 text-xs">
          {contest.leaders.map((leader, index) => (
            <li key={`${leader.username}-${index}`} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-1.5">
              <span>{index + 1}. @{leader.username}</span>
              <span className="font-bold text-amber-300">{leader.length}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {contest.status === "finished" ? (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-3 text-center">
          <Trophy className="mx-auto h-7 w-7 text-amber-300" aria-hidden="true" />
          {contest.winner_name ? (
            <>
              <p className="text-xs text-violet-200">Longest snake</p>
              <p className="text-lg font-extrabold text-amber-300">@{contest.winner_name} - {contest.winner_length}</p>
            </>
          ) : (
            <p className="text-sm text-violet-200">Nobody reached the required length, so there was no winner.</p>
          )}
          {contest.can_claim ? (
            <div className="mt-3 space-y-2 text-left">
              <label htmlFor={`snake-phone-${contest.id}`} className="text-xs font-semibold text-violet-200">MTN number to receive {contest.prize_gb}GB</label>
              <Input id={`snake-phone-${contest.id}`} inputMode="tel" placeholder="0241234567" value={phone} onChange={(event) => setPhone(event.target.value)} className="border-violet-400/30 bg-black/30 text-white" />
              <button type="button" onClick={() => claim.mutate()} disabled={claim.isPending || phone.trim().length < 10} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-extrabold text-black disabled:opacity-60">
                <Gift className="h-4 w-4" aria-hidden="true" /> {claim.isPending ? "Claiming..." : "Claim my prize"}
              </button>
            </div>
          ) : contest.prize_claimed ? (
            <p className="mt-1 text-xs text-violet-300">Prize claimed.</p>
          ) : null}
        </div>
      ) : null}

      {match ? (
        <SnakeMatch
          match={match}
          contestId={contest.id}
          minutes={contest.match_minutes}
          onDone={() => {
            setMatch(null);
            refresh();
          }}
        />
      ) : null}
    </li>
  );
}

export default function GameHubSnakeContests({ signedIn }: { signedIn: boolean }) {
  const { data: contests = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchSnakeContests, refetchInterval: 15000 });

  if (isLoading) return <p className="flex items-center justify-center gap-2 py-6 text-sm text-violet-200"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading contests...</p>;
  if (contests.length === 0) return null;

  return (
    <section aria-labelledby="snake-contests-title" className="mb-6 space-y-3">
      <h2 id="snake-contests-title" className="text-sm font-extrabold uppercase tracking-wide text-emerald-300">Snake War contests</h2>
      <ul className="space-y-3">
        {contests.map((contest) => <ContestCard key={contest.id} contest={contest} signedIn={signedIn} />)}
      </ul>
    </section>
  );
}
