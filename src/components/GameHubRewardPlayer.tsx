import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Gift, Heart, ShieldCheck, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  buyGameLife,
  claimGameReward,
  completeGameLevel,
  endGameRun,
  fetchGameWalletBalance,
  loseGameLife,
  startGameRun,
  timedBegin,
  timedTick,
  type GameRun,
} from "@/lib/gameHubApi";
import type { HubGame } from "@/lib/gameHubGames";

type RewardPlayerProps = {
  game: HubGame;
  signedIn: boolean;
  onClose: () => void;
};

type GameMessage = { source?: string; type?: string; level?: number };

const LIFE_PRICE = 4;

function walletHintFromPath(pathname: string): string {
  const path = pathname.toLowerCase();
  if (path.includes("subsub")) return "subsubagent";
  if (path.includes("subagent") || path.includes("sub-agent")) return "subagent";
  if (path.includes("agent")) return "agent";
  return "customer";
}

function formatCedis(value: number | null): string {
  return value === null ? "-" : `GH\u20B5${value.toFixed(2)}`;
}

export default function GameHubRewardPlayer({ game, signedIn, onClose }: RewardPlayerProps) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const runRef = useRef<GameRun | null>(null);
  const frameReadyRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const hintRef = useRef(walletHintFromPath(typeof window === "undefined" ? "" : window.location.pathname));

  const [run, setRun] = useState<GameRun | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [claimedPhone, setClaimedPhone] = useState<string | null>(null);

  const target = game.native?.targetLevel ?? 0;
  const timedMinutes = game.native?.timedMinutes ?? 0;
  const rewardGb = run?.reward_gb ?? 5;
  const gameSrc = `${game.native?.src ?? ""}?hub=1&k=${frameKey}`;
  const tickTimerRef = useRef<number | null>(null);

  const stopTicking = useCallback(() => {
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopTicking, [stopTicking]);

  const post = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ source: "gamehub-parent", ...message }, window.location.origin);
  }, []);

  const applyRun = useCallback((next: GameRun) => {
    runRef.current = next;
    setRun(next);
  }, []);

  const pushState = useCallback(() => {
    const current = runRef.current;
    if (!current || !frameReadyRef.current) return;
    post({
      type: "gh-state",
      level: current.level,
      lives: current.lives,
      status: current.status,
      playSeconds: current.play_seconds,
      requiredSeconds: current.required_seconds,
      rewardGb: current.reward_gb,
    });
  }, [post]);

  const refreshBalance = useCallback(async () => {
    try {
      setBalance(await fetchGameWalletBalance(hintRef.current));
    } catch {
      setBalance(null);
    }
  }, []);

  const beginRun = useCallback(
    async (forceNew: boolean) => {
      setLoadError(null);
      frameReadyRef.current = false;
      try {
        const next = await startGameRun(game.id, hintRef.current, forceNew);
        applyRun(next);
        if (forceNew) setFrameKey((value) => value + 1);
        pushState();
      } catch (error) {
        setLoadError((error as Error).message);
      }
    },
    [applyRun, game.id, pushState],
  );

  useEffect(() => {
    if (signedIn) void beginRun(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, game.id]);

  useEffect(() => {
    const enqueue = (task: () => Promise<void>) => {
      queueRef.current = queueRef.current.then(task).catch(() => undefined);
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

      const current = runRef.current;
      if (!current) return;

      if (data.type === "gh-timed-start") {
        if (current.status !== "active" || current.required_seconds === null || tickTimerRef.current !== null) return;
        enqueue(async () => {
          try {
            applyRun(await timedBegin(current.run_id));
          } catch (error) {
            toast({ title: "Could not start the timer", description: (error as Error).message, variant: "destructive" });
            return;
          }
          tickTimerRef.current = window.setInterval(() => {
            const active = runRef.current;
            if (!active) return;
            enqueue(async () => {
              try {
                const next = await timedTick(active.run_id);
                applyRun(next);
                post({ type: "gh-timer", playSeconds: next.play_seconds });
              } catch {
                // a missed heartbeat only slows the server clock, it never speeds it up
              }
            });
          }, 5000);
        });
        return;
      }

      if (data.type === "gh-life-lost") {
        stopTicking();
        enqueue(async () => {
          try {
            const next = await loseGameLife(current.run_id);
            applyRun(next);
            if (next.lives <= 0 && next.status === "active") {
              void refreshBalance();
              setBuyOpen(true);
            }
          } catch (error) {
            toast({ title: "Could not update lives", description: (error as Error).message, variant: "destructive" });
          }
        });
      } else if (data.type === "gh-level-complete") {
        stopTicking();
        enqueue(async () => {
          const claimedLevel = Number(data.level);
          try {
            const result = await completeGameLevel(current.run_id, claimedLevel);
            applyRun(result.run);
            post({
              type: "gh-level-result",
              ok: result.ok,
              level: result.run.level,
              lives: result.run.lives,
              status: result.run.status,
              playSeconds: result.run.play_seconds,
              message: result.ok
                ? undefined
                : result.run.status === "flagged"
                  ? "This session failed our fair-play checks. Rewards are disabled for it."
                  : "That level finished too quickly to be verified. Please play it again.",
            });
          } catch (error) {
            post({ type: "gh-level-result", ok: false, message: (error as Error).message });
          }
        });
      } else if (data.type === "gh-open-buy") {
        if (current.status === "active" && current.lives <= 0) {
          void refreshBalance();
          setBuyOpen(true);
        }
      } else if (data.type === "gh-open-claim") {
        if (current.status === "cleared" && !current.claimed) setClaimOpen(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [applyRun, post, pushState, refreshBalance, toast]);

  const handleBuyLife = async () => {
    const current = runRef.current;
    if (!current || busy) return;
    setBusy(true);
    try {
      const result = await buyGameLife(current.run_id);
      applyRun(result.run);
      setBalance(result.balance);
      setBuyOpen(false);
      post({ type: "gh-continue", lives: result.run.lives, playSeconds: result.run.play_seconds });
      toast({ title: "Life added", description: `GH\u20B5${LIFE_PRICE} was taken from your wallet. Keep going!` });
    } catch (error) {
      toast({ title: "Could not buy a life", description: (error as Error).message, variant: "destructive" });
      void refreshBalance();
    } finally {
      setBusy(false);
    }
  };

  const handleGameOver = async () => {
    const current = runRef.current;
    if (!current || busy) return;
    setBusy(true);
    try {
      await endGameRun(current.run_id);
      setBuyOpen(false);
      setClaimOpen(false);
      setClaimedPhone(null);
      await beginRun(true);
    } catch (error) {
      toast({ title: "Could not end the game", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    const current = runRef.current;
    if (!current || busy) return;
    setBusy(true);
    try {
      const result = await claimGameReward(current.run_id, phone);
      applyRun({ ...current, claimed: true, reward_claimed: true });
      setClaimedPhone(result.phone);
      toast({ title: "Reward claimed", description: `Your free MTN ${result.reward_gb ?? rewardGb}GB is on its way to ${result.phone}.` });
    } catch (error) {
      toast({ title: "Could not claim reward", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const insufficient = balance !== null && balance < LIFE_PRICE;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0d0620]">
      <header className="flex items-center gap-2 border-b border-violet-400/15 px-3 py-3">
        <button type="button" onClick={onClose} aria-label="Back to Game Hub" className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-900/70 text-white">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-white">{game.name}</h2>
          <p className="truncate text-xs text-emerald-300">
            {timedMinutes > 0 ? `Play ${timedMinutes} minutes without a miss to win free MTN ${rewardGb}GB` : `Reach level ${target} to win a free MTN ${rewardGb}GB`}
          </p>
        </div>
        {run ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-violet-900/70 px-3 py-2 text-sm font-semibold text-white" aria-label={`${run.lives} lives left`}>
            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" aria-hidden="true" />
            {run.lives}
          </div>
        ) : null}
      </header>

      <div className="flex items-start gap-2 border-b border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
        <p>
          Fair play: every level, life and reward is verified on our servers. Bots, scripts, edited game code or replayed requests are detected, void the reward and can get the account suspended.
        </p>
      </div>

      <div className="relative min-h-0 flex-1">
        {!signedIn ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <Gift className="h-10 w-10 text-amber-300" aria-hidden="true" />
            <p className="text-lg font-bold">Sign in to play for free data</p>
            <p className="text-sm text-violet-200">Rewards, lives and progress are saved to your account. Log in from your dashboard, then open this game again.</p>
          </div>
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <p className="text-lg font-bold">Could not start the game</p>
            <p className="text-sm text-violet-200">{loadError}</p>
            <button type="button" onClick={() => void beginRun(false)} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold">
              Try again
            </button>
          </div>
        ) : (
          <iframe
            key={frameKey}
            ref={iframeRef}
            title={game.name}
            src={gameSrc}
            allow="fullscreen; autoplay"
            className="h-full w-full border-0 bg-black"
          />
        )}

        {buyOpen && run ? (
          <div role="dialog" aria-modal="true" aria-labelledby="buy-life-title" className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-violet-400/30 bg-[#150a30] p-5 text-white shadow-2xl">
              <div className="mb-3 flex items-center gap-2">
                <Heart className="h-6 w-6 fill-rose-500 text-rose-500" aria-hidden="true" />
                <h3 id="buy-life-title" className="text-lg font-bold">Out of lives</h3>
              </div>
              <p className="text-sm text-violet-200">
                {timedMinutes > 0
                  ? `You are ${Math.floor(run.play_seconds / 60)}:${String(Math.floor(run.play_seconds % 60)).padStart(2, "0")} into your ${timedMinutes}-minute run. `
                  : `You are on level ${run.level} of ${target}. `}
                Buy 1 life for GH&#8373;{LIFE_PRICE} from your wallet to continue exactly where you stopped, or end the game and start again.
              </p>
              <div className="my-4 flex items-center justify-between rounded-xl bg-violet-950 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-violet-200">
                  <Wallet className="h-4 w-4" aria-hidden="true" /> Wallet balance
                </span>
                <span className="font-bold">{formatCedis(balance)}</span>
              </div>
              {insufficient ? <p className="mb-3 text-sm text-rose-300">You need at least GH&#8373;{LIFE_PRICE} in your wallet. Top up from your dashboard wallet, then come back.</p> : null}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleBuyLife()}
                  disabled={busy || insufficient}
                  className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? "Please wait" : `Buy 1 life for GH\u20B5${LIFE_PRICE}`}
                </button>
                <button type="button" onClick={() => void handleGameOver()} disabled={busy} className="rounded-xl bg-violet-900/80 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                  Game over
                </button>
                <button type="button" onClick={() => setBuyOpen(false)} className="px-4 py-2 text-xs text-violet-300 underline">
                  Not now
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {claimOpen && run ? (
          <div role="dialog" aria-modal="true" aria-labelledby="claim-title" className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-emerald-400/30 bg-[#0b1f1a] p-5 text-white shadow-2xl">
              <div className="mb-3 flex items-center gap-2">
                <Gift className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                <h3 id="claim-title" className="text-lg font-bold">{claimedPhone ? "Reward claimed" : timedMinutes > 0 ? `You played ${timedMinutes} minutes without a miss` : `You cleared all ${target} levels`}</h3>
              </div>
              {claimedPhone ? (
                <>
                  <p className="text-sm text-emerald-100">Your free MTN {rewardGb}GB is being delivered to {claimedPhone}. You can check it under your orders.</p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button type="button" onClick={() => void handleGameOver()} disabled={busy} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950">
                      Play again
                    </button>
                    <button type="button" onClick={onClose} className="rounded-xl bg-emerald-900/70 px-4 py-3 text-sm font-semibold text-white">
                      Back to Game Hub
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleClaim} className="flex flex-col gap-3">
                  <p className="text-sm text-emerald-100">Enter the MTN number that should receive the free {rewardGb}GB. Each account can claim this reward once per game.</p>
                  <label htmlFor="reward-phone" className="sr-only">MTN number</label>
                  <input
                    id="reward-phone"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/[^0-9+]/g, "").slice(0, 13))}
                    placeholder="0241234567"
                    className="rounded-xl border border-emerald-400/30 bg-emerald-950 px-3 py-3 text-sm text-white placeholder:text-emerald-300/50"
                  />
                  <button type="submit" disabled={busy || phone.length < 10} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950 disabled:opacity-50">
                    {busy ? "Claiming" : `Claim free MTN ${rewardGb}GB`}
                  </button>
                  <button type="button" onClick={() => setClaimOpen(false)} className="px-4 py-1 text-xs text-emerald-200 underline">
                    Later
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
