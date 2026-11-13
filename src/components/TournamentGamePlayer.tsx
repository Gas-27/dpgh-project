import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Maximize2, Minimize2, Swords } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFriendlyBlockedMessage } from "@/lib/blockedMessages";
import { hubGames } from "@/lib/gameHubGames";
import {
  completeTournamentLevel,
  fetchMyTournamentGame,
  loseTournamentLife,
  openLiveChannel,
  reportTournamentIntegrity,
  startTournamentAttempt,
  tournamentGameName,
  type AttemptResult,
} from "@/lib/gameHubTournaments";
import { useLiveFrames } from "@/components/TournamentLiveView";

type Props = { tournamentId: string; onClose: () => void };

type GameMessage = { source?: string; type?: string; level?: number; kind?: string };

const oppStatusLabel: Record<string, string> = {
  ready: "Getting ready",
  playing: "Playing",
  cleared: "Cleared the game",
  over: "Finished",
  forfeit: "Did not play",
};

export default function TournamentGamePlayer({ tournamentId, onClose }: Props) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const attemptRef = useRef<AttemptResult | null>(null);
  const frameReadyRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const sendRef = useRef<((frame: { user_id: string; image: string | null; level: number; at: number }) => void) | null>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);

  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [deadline, setDeadline] = useState(0);

  const { data: info, isFetched } = useQuery({
    queryKey: ["tm-my-game", tournamentId],
    queryFn: () => fetchMyTournamentGame(tournamentId),
    refetchInterval: 2500,
  });

  const matchGameId = info?.match_game_id ?? null;
  const game = info ? hubGames.find((item) => item.id === info.game_id) : undefined;
  const { frames, isFresh } = useLiveFrames(matchGameId);

  // A new game in the same match resets everything; the server decides when that happens.
  useEffect(() => {
    attemptRef.current = null;
    frameReadyRef.current = false;
    setAttempt(null);
    setStarted(false);
    setExpanded(false);
  }, [matchGameId]);

  useEffect(() => {
    if (info) setDeadline(Date.now() + info.start_seconds_left * 1000);
  }, [info?.match_game_id, info?.start_seconds_left]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isFetched && info === null) onClose();
  }, [isFetched, info, onClose]);

  const post = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ source: "gamehub-parent", ...message }, window.location.origin);
  }, []);

  const pushState = useCallback(() => {
    const current = attemptRef.current;
    if (!current || !frameReadyRef.current) return;
    post({
      type: "gh-state",
      level: current.level,
      target: current.target,
      lives: current.lives,
      status: current.status,
      playSeconds: 0,
      requiredSeconds: null,
      rewardGb: 0,
      config: {},
      tier1Level: null,
      tier1RewardGb: null,
      lifePrice: 0,
      guest: false,
    });
  }, [post]);

  const applyAttempt = useCallback((next: AttemptResult) => {
    attemptRef.current = next;
    setAttempt(next);
  }, []);

  // Live picture channel: publish my frames, receive nothing here (opponent frames come from useLiveFrames).
  useEffect(() => {
    if (!matchGameId) return;
    const live = openLiveChannel(matchGameId, () => undefined);
    sendRef.current = live.send;
    return () => {
      sendRef.current = null;
      live.close();
    };
  }, [matchGameId]);

  useEffect(() => {
    if (!started || !info || attempt?.status !== "active") return;
    const timer = window.setInterval(() => {
      let image: string | null = null;
      try {
        const source = iframeRef.current?.contentDocument?.querySelector("canvas");
        if (source && source.width > 0 && source.height > 0) {
          const scratch = scratchRef.current ?? document.createElement("canvas");
          scratchRef.current = scratch;
          scratch.width = 200;
          scratch.height = Math.max(1, Math.round((200 * source.height) / source.width));
          scratch.getContext("2d")?.drawImage(source, 0, 0, scratch.width, scratch.height);
          image = scratch.toDataURL("image/jpeg", 0.45);
        }
      } catch {
        image = null;
      }
      sendRef.current?.({ user_id: info.me.user_id, image, level: attemptRef.current?.level ?? 1, at: Date.now() });
    }, 800);
    return () => window.clearInterval(timer);
  }, [started, info, attempt?.status]);

  useEffect(() => {
    if (!matchGameId) return;
    const enqueue = (task: () => Promise<void>) => {
      queueRef.current = queueRef.current.then(task).catch(() => undefined);
    };
    const reply = (result: AttemptResult, extra?: Record<string, unknown>) => {
      applyAttempt(result);
      post({ type: "gh-level-result", ok: result.ok, level: result.level, lives: result.lives, status: result.status, playSeconds: 0, ...extra });
    };
    const fail = (error: unknown) => {
      const message = getFriendlyBlockedMessage(error) ?? (error as Error).message;
      post({ type: "gh-level-result", ok: false, message });
      toast({ title: "Tournament", description: message, variant: "destructive" });
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as GameMessage | null;
      if (!data || data.source !== "gamehub" || typeof data.type !== "string") return;

      if (data.type === "gh-ready") {
        frameReadyRef.current = true;
        pushState();
        return;
      }
      const current = attemptRef.current;
      if (!current || current.status !== "active") return;

      if (data.type === "gh-level-complete") {
        const level = Number(data.level);
        if (!Number.isFinite(level)) return;
        enqueue(async () => {
          try {
            const result = await completeTournamentLevel(matchGameId, level);
            reply(result, result.reason === "too_fast" ? { message: "That was too fast to be real. Play it properly." } : undefined);
          } catch (error) {
            fail(error);
          }
        });
      } else if (data.type === "gh-life-lost" || data.type === "gh-reset-streak") {
        enqueue(async () => {
          try {
            reply(await loseTournamentLife(matchGameId));
          } catch (error) {
            fail(error);
          }
        });
      } else if (data.type === "gh-integrity") {
        const kind = data.kind;
        if (!kind) return;
        enqueue(async () => {
          try {
            reply(await reportTournamentIntegrity(matchGameId, kind));
          } catch (error) {
            fail(error);
          }
        });
      } else if (data.type === "gh-market-load" || data.type === "gh-market-buy") {
        post({ type: "gh-market", ok: false, message: "The market is closed during tournaments.", owned: [], inv: {}, balance: null });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [matchGameId, applyAttempt, post, pushState, toast]);

  const handleStart = async () => {
    if (!matchGameId) return;
    setStarting(true);
    try {
      const result = await startTournamentAttempt(matchGameId);
      applyAttempt(result);
      frameReadyRef.current = false;
      setStarted(true);
    } catch (error) {
      toast({ title: "Could not start", description: getFriendlyBlockedMessage(error) ?? (error as Error).message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  if (!info || !game?.native) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0d0620] text-sm font-semibold text-white">Loading your match...</div>
    );
  }

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  const finishedMine = info.me.status === "cleared" || info.me.status === "over" || info.me.status === "forfeit" || (attempt !== null && attempt.status !== "active");
  const canPlay = !finishedMine && (info.me.status === "ready" || info.me.status === "playing");
  const oppFrame = frames[info.opponent.user_id];
  const oppFresh = isFresh(info.opponent.user_id);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0d0620] text-white">
      <header className="flex items-center gap-2 border-b border-violet-400/20 px-3 py-2">
        <button type="button" onClick={onClose} aria-label="Back to tournament" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-900/70">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            Game {info.game_no}: {tournamentGameName(info.game_id)}
          </p>
          <p className="truncate text-xs text-violet-300">
            You {info.me.wins} - {info.opponent.wins} @{info.opponent.username} - first to {info.wins_needed}
          </p>
        </div>
        {attempt?.status === "active" ? (
          <span className="shrink-0 rounded-lg bg-violet-900/70 px-2.5 py-1.5 text-xs font-bold">
            Level {attempt.level}/{attempt.target}
          </span>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        {started && attempt?.status === "active" ? (
          <iframe
            key={matchGameId}
            ref={iframeRef}
            title={game.name}
            src={`${game.native.src}?hub=1&k=${matchGameId}`}
            allow="fullscreen; autoplay"
            className="h-full w-full border-0 bg-black"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <Swords className="h-10 w-10 text-amber-300" aria-hidden="true" />
            {canPlay ? (
              <>
                <div>
                  <p className="text-lg font-bold">{tournamentGameName(info.game_id)}</p>
                  <p className="mt-1 text-sm text-violet-200">You have one life. Reach level {info.target} or get further than @{info.opponent.username}. The faster finisher wins a tie.</p>
                </div>
                {info.me.status === "ready" ? (
                  <p className={`text-sm font-semibold ${secondsLeft <= 30 ? "text-rose-300" : "text-amber-200"}`}>
                    Start within {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")} or you forfeit this game
                  </p>
                ) : (
                  <p className="text-sm text-amber-200">Your attempt is already running. Resume it now.</p>
                )}
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={starting || (info.me.status === "ready" && secondsLeft === 0)}
                  className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {starting ? "Starting..." : info.me.status === "playing" ? "Resume" : "Start game"}
                </button>
              </>
            ) : (
              <div>
                <p className="text-lg font-bold">
                  {info.me.status === "cleared" ? "You cleared it" : info.me.status === "forfeit" ? "You forfeited this game" : `You reached level ${attempt?.level ?? info.me.level}`}
                </p>
                <p className="mt-2 text-sm text-violet-200">
                  @{info.opponent.username}: {oppStatusLabel[info.opponent.status] ?? info.opponent.status}, level {info.opponent.level}
                </p>
                <p className="mt-3 text-xs text-violet-300/70">Waiting for the result. The next game opens automatically.</p>
              </div>
            )}
          </div>
        )}

        <div
          className={
            expanded
              ? "absolute inset-x-0 bottom-0 z-30 flex h-1/2 flex-col border-t-2 border-amber-300/60 bg-black"
              : "absolute bottom-3 right-3 z-30 w-28 overflow-hidden rounded-xl border border-violet-300/40 bg-black shadow-lg"
          }
        >
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Shrink opponent view" : "Expand opponent view"}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-1 bg-violet-950/95 px-2 py-1 text-[11px] font-bold text-white"
          >
            <span className="truncate">@{info.opponent.username}</span>
            {expanded ? <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          </button>
          <div className={`flex items-center justify-center bg-black ${expanded ? "min-h-0 flex-1" : "h-20"}`}>
            {oppFresh && oppFrame?.image ? (
              <img src={oppFrame.image || "/placeholder.svg"} alt={`Live view of ${info.opponent.username}`} className="h-full w-full object-contain" />
            ) : (
              <p className="px-2 text-center text-[11px] text-violet-200/80">
                {oppStatusLabel[info.opponent.status] ?? info.opponent.status}
                <br />
                Level {info.opponent.level}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
