import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gift, Heart, LogIn, Share2, Wallet, X } from "lucide-react";
import ShareScoreButtons from "@/components/ShareScoreButtons";
import WalletTopupDialog from "@/components/WalletTopupDialog";
import { walletHintFromPath } from "@/components/GameHubRewardPlayer";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  buildGameShareUrl,
  buyGameArrow,
  buyGameLife,
  claimGameReward,
  completeGameLevel,
  endGameRun,
  fetchGameWalletBalance,
  loseGameLife,
  startGameRun,
  type GameRewardSetting,
  type GameRun,
} from "@/lib/gameHubApi";
import type { HubGame } from "@/lib/gameHubGames";

type ArcheryPlayerProps = {
  game: HubGame;
  signedIn: boolean;
  rule?: GameRewardSetting;
  onClose: () => void;
};

type ArcheryRequest = { source?: string; type?: string; id?: number; level?: number };

function formatCedis(value: number | null): string {
  return value === null ? "-" : `GH\u20B5${value.toFixed(2)}`;
}

export default function GameHubArcheryPlayer({ game, signedIn, rule, onClose }: ArcheryPlayerProps) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const runRef = useRef<GameRun | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const hintRef = useRef(walletHintFromPath(typeof window === "undefined" ? "" : window.location.pathname));
  const pendingClaimRef = useRef<number | null>(null);

  const [run, setRun] = useState<GameRun | null>(null);
  const frameKey = 0;
  const [claimOpen, setClaimOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | undefined>();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [claimedPhone, setClaimedPhone] = useState<string | null>(null);

  const target = run?.target ?? rule?.target_level ?? game.native?.targetLevel ?? 10;
  const rewardGb = run?.reward_gb ?? rule?.reward_gb ?? 5;
  const price = run?.life_price ?? rule?.life_price ?? 4;
  const gameSrc = `${game.native?.src ?? ""}?hub=1&k=${frameKey}`;

  // The host rewrites unknown paths to the app shell (HTTP 200), so a missing game file
  // only shows up as the app's own HTML coming back instead of the game page.
  const { data: gameFileState, isLoading: checkingGameFile } = useQuery({
    queryKey: ["archery-game-file", game.native?.src],
    enabled: signedIn,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(game.native?.src ?? "", { cache: "no-store" });
      if (!res.ok) return "missing" as const;
      const html = await res.text();
      return html.includes('id="root"') ? ("missing" as const) : ("ready" as const);
    },
  });

  const applyRun = useCallback((next: GameRun) => {
    runRef.current = next;
    setRun(next);
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const value = await fetchGameWalletBalance(hintRef.current);
      setBalance(value);
      return value;
    } catch {
      setBalance(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
      setUserEmail(data.user?.email ?? undefined);
    });
    void refreshBalance();
  }, [signedIn, refreshBalance]);

  const reply = useCallback((id: number | undefined, payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ source: "justbuy-gamehub", id, ...payload }, "*");
  }, []);

  useEffect(() => {
    if (!signedIn) return;

    const handleError = (id: number | undefined, error: unknown) => {
      const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "Something went wrong");
      reply(id, { error: message });
      if (/insufficient/i.test(message)) {
        void refreshBalance();
        setTopupOpen(true);
      }
    };

    const requireRun = (id: number | undefined): GameRun | null => {
      const current = runRef.current;
      if (!current) reply(id, { error: "The game run is not ready yet. Please try again." });
      return current;
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as ArcheryRequest | null;
      if (!data || data.source !== "archery3d" || typeof data.type !== "string") return;
      if (data.type === "ready") return;

      const { id, type } = data;
      queueRef.current = queueRef.current
        .then(async () => {
          try {
            if (type === "start") {
              const next = await startGameRun(game.id, hintRef.current, false);
              applyRun(next);
              reply(id, { run: next });
              return;
            }
            if (type === "claim") {
              const current = requireRun(id);
              if (!current) return;
              pendingClaimRef.current = id ?? null;
              setClaimedPhone(null);
              setClaimOpen(true);
              return;
            }
            const current = requireRun(id);
            if (!current) return;

            if (type === "stage_clear") {
              const result = await completeGameLevel(current.run_id, Number(data.level));
              applyRun(result.run);
              reply(id, { ok: result.ok, reason: result.reason, run: result.run });
            } else if (type === "buy_arrow") {
              const result = await buyGameArrow(current.run_id);
              applyRun(result.run);
              setBalance(result.balance);
              reply(id, { run: result.run, balance: result.balance });
            } else if (type === "give_up") {
              const next = await loseGameLife(current.run_id);
              applyRun(next);
              reply(id, { run: next });
            } else if (type === "buy_life") {
              const result = await buyGameLife(current.run_id);
              applyRun(result.run);
              setBalance(result.balance);
              reply(id, { run: result.run, balance: result.balance });
            } else if (type === "end") {
              const next = await endGameRun(current.run_id);
              applyRun(next);
              reply(id, { run: next });
            }
          } catch (error) {
            handleError(id, error);
          }
        })
        .catch(() => undefined);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [applyRun, game.id, refreshBalance, reply, signedIn]);

  const finishClaim = useCallback(
    (next?: GameRun) => {
      setClaimOpen(false);
      const id = pendingClaimRef.current;
      pendingClaimRef.current = null;
      if (id !== null) reply(id, { run: next ?? runRef.current });
    },
    [reply],
  );

  const handleClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    const current = runRef.current;
    if (!current || busy) return;
    setBusy(true);
    try {
      const result = await claimGameReward(current.run_id, phone);
      const next = { ...current, claimed: true, reward_claimed: true };
      applyRun(next);
      setClaimedPhone(result.phone);
      toast({ title: "Reward claimed", description: `Your free MTN ${result.reward_gb ?? rewardGb}GB is on its way to ${result.phone}.` });
      const id = pendingClaimRef.current;
      pendingClaimRef.current = null;
      if (id !== null) reply(id, { run: next });
    } catch (error) {
      toast({ title: "Could not claim reward", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const rulesList = [
    `Clear ${target} stages to complete the challenge.`,
    "You start with a limited number of arrows. When you run out, buy 1 extra arrow from your wallet to keep going.",
    `An extra arrow or an extra heart costs GH\u20B5${price} from your wallet.`,
    `Finish the challenge to win free MTN ${rewardGb}GB, sent to the MTN number you enter.`,
    "Everything is checked by our servers, so cheating or speeding up the game disables your reward.",
    "Each account can claim the reward once per game. You must be signed in to play for data.",
  ];
  const shareMessage = `I reached stage ${run?.level ?? 1} on ${game.name} on JustBuy and I'm playing to win free MTN ${rewardGb}GB. Can you beat me?`;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0d0620]">
      <header className="flex items-center gap-2 border-b border-violet-400/15 px-3 py-3">
        <button type="button" onClick={onClose} aria-label="Back to Game Hub" className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-900/70 text-white">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-white">{game.name}</h2>
          <p className="truncate text-xs text-emerald-300">Clear {target} stages to win a free MTN {rewardGb}GB</p>
        </div>
        <button type="button" onClick={() => setRulesOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-3 py-2 text-xs font-bold text-emerald-950">
          <Gift className="h-4 w-4" aria-hidden="true" /> Win free data
        </button>
        <button type="button" onClick={() => setShareOpen(true)} aria-label="Share my score" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-900/70 text-white">
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </button>
        {run && signedIn ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-violet-900/70 px-3 py-2 text-sm font-semibold text-white" aria-label={`${run.lives} lives left`}>
            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" aria-hidden="true" />
            {run.lives}
          </div>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        {!signedIn ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <LogIn className="h-8 w-8 text-violet-300" aria-hidden="true" />
            <p className="text-lg font-bold">Sign in to play Archery 3D</p>
            <p className="max-w-xs text-sm text-violet-200">Free MTN {rewardGb}GB rewards are verified and sent to signed-in accounts. Log in from your dashboard, then come back to play.</p>
            <button type="button" onClick={onClose} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold">
              Back to Game Hub
            </button>
          </div>
        ) : checkingGameFile ? (
          <div className="flex h-full items-center justify-center text-sm text-violet-200" role="status">Loading game...</div>
        ) : gameFileState === "missing" ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <p className="text-lg font-bold">Archery 3D is being set up</p>
            <p className="max-w-xs text-sm text-violet-200">The game files are not published yet. Please check back shortly or try another game.</p>
            <button type="button" onClick={onClose} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold">
              Back to Game Hub
            </button>
          </div>
        ) : (
          <iframe key={frameKey} ref={iframeRef} title={game.name} src={gameSrc} allow="autoplay; fullscreen" className="h-full w-full border-0 bg-black" />
        )}

        {rulesOpen ? (
          <div role="dialog" aria-modal="true" aria-labelledby="archery-rules-title" className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border border-emerald-400/30 bg-[#0b1f1a] p-5 text-white shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id="archery-rules-title" className="flex items-center gap-2 text-lg font-bold"><Gift className="h-5 w-5 text-emerald-300" aria-hidden="true" /> Win free data</h3>
                <button type="button" onClick={() => setRulesOpen(false)} aria-label="Close rules" className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-900/70">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-emerald-100">
                {rulesList.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <button type="button" onClick={() => setRulesOpen(false)} className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950">
                Got it
              </button>
            </div>
          </div>
        ) : null}

        {shareOpen ? (
          <div role="dialog" aria-modal="true" aria-labelledby="archery-share-title" className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border border-violet-400/30 bg-[#150a30] p-5 text-white shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id="archery-share-title" className="text-lg font-bold">Share my score</h3>
                <button type="button" onClick={() => setShareOpen(false)} aria-label="Close share" className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-900/70">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mb-4 text-sm text-violet-200">{shareMessage}</p>
              <ShareScoreButtons title={`${game.name} on JustBuy`} text={shareMessage} url={buildGameShareUrl(game.id)} />
            </div>
          </div>
        ) : null}

        {claimOpen && run ? (
          <div role="dialog" aria-modal="true" aria-labelledby="archery-claim-title" className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-emerald-400/30 bg-[#0b1f1a] p-5 text-white shadow-2xl">
              <div className="mb-3 flex items-center gap-2">
                <Gift className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                <h3 id="archery-claim-title" className="text-lg font-bold">{claimedPhone ? "Reward claimed" : `You cleared all ${target} stages`}</h3>
              </div>
              {claimedPhone ? (
                <>
                  <p className="text-sm text-emerald-100">Your free MTN {rewardGb}GB is being delivered to {claimedPhone}. You can check it under your orders.</p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button type="button" onClick={() => finishClaim()} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950">
                      Continue
                    </button>
                    <button type="button" onClick={onClose} className="rounded-xl bg-emerald-900/70 px-4 py-3 text-sm font-semibold text-white">
                      Back to Game Hub
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleClaim} className="flex flex-col gap-3">
                  <p className="text-sm text-emerald-100">Enter the MTN number that should receive the free {rewardGb}GB. Each account can claim this reward once per game.</p>
                  <label htmlFor="archery-reward-phone" className="sr-only">MTN number</label>
                  <input
                    id="archery-reward-phone"
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
                  <button type="button" onClick={() => finishClaim()} className="px-4 py-1 text-xs text-emerald-200 underline">
                    Later
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : null}

        {topupOpen && !userId ? (
          <div role="dialog" aria-modal="true" aria-labelledby="archery-topup-title" className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-violet-400/30 bg-[#150a30] p-5 text-white shadow-2xl">
              <h3 id="archery-topup-title" className="mb-2 flex items-center gap-2 text-lg font-bold"><Wallet className="h-5 w-5" aria-hidden="true" /> Top up your wallet</h3>
              <p className="text-sm text-violet-200">You need at least {formatCedis(price)} ({formatCedis(balance)} available). Top up from your dashboard wallet, then come back.</p>
              <button type="button" onClick={() => setTopupOpen(false)} className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold">
                OK
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {userId ? (
        <WalletTopupDialog
          open={topupOpen}
          onOpenChange={(next) => {
            setTopupOpen(next);
            if (!next) void refreshBalance();
          }}
          currentBalance={balance ?? 0}
          walletType="normal"
          identityId={userId}
          userEmail={userEmail}
          callbackUrl={`${window.location.origin}/user-dashboard?wallet=success`}
        />
      ) : null}
    </div>
  );
}
