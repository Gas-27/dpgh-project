import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Gift, Heart, Share2, Wallet, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GameHubProductAd from "@/components/GameHubProductAd";
import PaymentDialog from "@/components/PaymentDialog";
import { fetchStoreChancePackage, savePendingChance, type ChancePackage } from "@/lib/gameHubChances";
import { buildGameHubPath } from "@/lib/gameHubRoute";
import { useGameHubStoreContext } from "@/lib/gameHubStoreContext";
import ShareScoreButtons from "@/components/ShareScoreButtons";
import { useToast } from "@/hooks/use-toast";
import { fetchGameHubAds, pickGameHubAd, type GameHubAd } from "@/lib/gameHubAds";
import {
  buildGameShareUrl,
  buyGameItem,
  buyGameLife,
  cashOutGameRun,
  CLAIM_FEE_AMOUNT,
  claimGameReward,
  isClaimFeeRequired,
  completeGameLevel,
  createChanceOrder,
  consumeGameItem,
  endGameRun,
  fetchGameMarket,
  fetchGameWalletBalance,
  loseGameLife,
  recordShot,
  resetGameStreak,
  startGameRun,
  submitGuestScore,
  timedActivity,
  timedBegin,
  timedPause,
  timedTick,
  reportIntegrity,
  type IntegrityKind,
  type GameRewardSetting,
  type GameRun,
} from "@/lib/gameHubApi";
import type { HubGame } from "@/lib/gameHubGames";
import { newGuestSessionId } from "@/lib/gameHubGuest";

type RewardPlayerProps = {
  game: HubGame;
  signedIn: boolean;
  rule?: GameRewardSetting;
  onClose: () => void;
};

type GameMessage = { source?: string; type?: string; level?: number };

export function walletHintFromPath(pathname: string): string {
  const path = pathname.toLowerCase();
  if (path.includes("subsub")) return "subsubagent";
  if (path.includes("subagent") || path.includes("sub-agent")) return "subagent";
  if (path.includes("agent")) return "agent";
  return "customer";
}

function formatCedis(value: number | null): string {
  return value === null ? "-" : `GH\u20B5${value.toFixed(2)}`;
}

export default function GameHubRewardPlayer({ game, signedIn, rule, onClose }: RewardPlayerProps) {
  const guest = !signedIn;
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
  const [feeDue, setFeeDue] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [claimedPhone, setClaimedPhone] = useState<string | null>(null);
  const [activeAd, setActiveAd] = useState<GameHubAd | null>(null);
  const adShownRef = useRef(false);
  const adOpenRef = useRef(false);
  const adsRef = useRef<GameHubAd[]>([]);

  const { data: ads } = useQuery({
    queryKey: ["game-hub-ads"],
    queryFn: fetchGameHubAds,
    staleTime: 5 * 60 * 1000,
  });
  adsRef.current = ads ?? [];

  const storeCtx = useGameHubStoreContext();
  const singleGb = rule?.chance_gb_single ?? 1;
  const doubleGb = rule?.chance_gb_double ?? 3;
  const [chancePay, setChancePay] = useState<{ pkg: ChancePackage; chances: 1 | 2; chanceOrderId: string } | null>(null);
  const [chancePhone, setChancePhone] = useState("");

  const { data: chancePackages } = useQuery({
    queryKey: ["gamehub-chance-packages", storeCtx?.kind, storeCtx?.storeId, storeCtx?.ownStoreId, singleGb, doubleGb],
    queryFn: async () => {
      if (!storeCtx) return null;
      const [single, double] = await Promise.all([fetchStoreChancePackage(storeCtx, singleGb), fetchStoreChancePackage(storeCtx, doubleGb)]);
      return { single, double };
    },
    enabled: !guest && !!storeCtx && buyOpen,
    staleTime: 30_000,
  });

  const timedMinutes = game.native?.timedMinutes ?? 0;
  const target = run?.target ?? rule?.target_level ?? game.native?.targetLevel ?? 0;
  const rewardGb = run?.reward_gb ?? rule?.reward_gb ?? 5;
  const LIFE_PRICE = run?.life_price ?? 4;
  const gameSrc = `${game.native?.src ?? ""}?hub=1&k=${frameKey}`;
  const tickTimerRef = useRef<number | null>(null);

  const tickGenerationRef = useRef(0);

  const stopTicking = useCallback(() => {
    tickGenerationRef.current += 1;
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  const queryClient = useQueryClient();
  const guestSessionRef = useRef(newGuestSessionId());
  const guestTimerRef = useRef<{ id: number; startedAt: number } | null>(null);

  const submitGuest = useCallback(
    (score: number) => {
      if (score <= 0) return;
      submitGuestScore(game.id, guestSessionRef.current, score)
        .then(() => queryClient.invalidateQueries({ queryKey: ["gamehub-leaderboard"] }))
        .catch(() => undefined);
    },
    [game.id, queryClient],
  );

  const stopGuestTimer = useCallback(
    (flush: boolean) => {
      const timer = guestTimerRef.current;
      if (!timer) return;
      window.clearInterval(timer.id);
      guestTimerRef.current = null;
      if (flush) submitGuest(Math.floor((Date.now() - timer.startedAt) / 1000));
    },
    [submitGuest],
  );

  useEffect(
    () => () => {
      stopTicking();
      stopGuestTimer(true);
    },
    [stopTicking, stopGuestTimer],
  );

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
      target: current.target,
      lives: current.lives,
      status: current.status,
      playSeconds: current.play_seconds,
      requiredSeconds: current.required_seconds,
      rewardGb: current.reward_gb,
      config: current.config ?? {},
      tier1Level: current.tier1_level ?? null,
      tier1RewardGb: current.tier1_reward_gb ?? null,
      lifePrice: current.life_price,
      guest,
    });
  }, [guest, post]);

  const refreshBalance = useCallback(async () => {
    try {
      setBalance(await fetchGameWalletBalance(hintRef.current));
    } catch {
      setBalance(null);
    }
  }, []);

  // After a failure, a boosted marketplace ad is shown once before the buy-a-life options.
  const openContinueOptions = useCallback(() => {
    if (!guest) void refreshBalance();
    if (adOpenRef.current) return;
    if (!adShownRef.current) {
      const ad = pickGameHubAd(adsRef.current);
      if (ad) {
        adShownRef.current = true;
        adOpenRef.current = true;
        setActiveAd(ad);
        return;
      }
    }
    setBuyOpen(true);
  }, [guest, refreshBalance]);

  const closeAd = useCallback(() => {
    adOpenRef.current = false;
    setActiveAd(null);
    setBuyOpen(true);
  }, []);

  const openAd = useCallback(
    (ad: GameHubAd) => {
      window.open(ad.url, "_blank", "noopener,noreferrer");
      closeAd();
    },
    [closeAd],
  );

  const beginRun = useCallback(
    async (forceNew: boolean) => {
      setLoadError(null);
      frameReadyRef.current = false;
      if (guest) {
        // Guests play without a wallet or paid lives; their score is stored under an anonymous guest ID only.
        stopGuestTimer(false);
        guestSessionRef.current = newGuestSessionId();
        const isBasketball = game.id === "basketball";
        const requiredSeconds = isBasketball ? 5 * 60 : (rule?.required_seconds ?? (timedMinutes > 0 ? timedMinutes * 60 : null));
        applyRun({
          run_id: "guest",
          game_id: game.id,
          level: 1,
          lives: isBasketball ? 2 : 1,
          status: "active",
          target: isBasketball ? 300 : (requiredSeconds ? 1 : (rule?.target_level ?? game.native?.targetLevel ?? 1)),
          lives_bought: 0,
          claimed: false,
          reward_claimed: false,
          life_price: 0,
          reward_gb: rule?.reward_gb ?? 5,
          reward_enabled: rule?.enabled ?? true,
          required_seconds: requiredSeconds,
          play_seconds: 0,
        });
        if (forceNew) setFrameKey((value) => value + 1);
        return;
      }
      try {
        const next = await startGameRun(game.id, hintRef.current, forceNew);
        applyRun(next);
        if (forceNew) setFrameKey((value) => value + 1);
        pushState();
      } catch (error) {
        setLoadError((error as Error).message);
      }
    },
    [applyRun, game.id, game.native?.targetLevel, guest, pushState, stopGuestTimer, rule?.enabled, rule?.required_seconds, rule?.reward_gb, rule?.target_level, timedMinutes],
  );

  useEffect(() => {
    void beginRun(false);
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

      if (guest) {
        const guestTimed = current.required_seconds !== null;
        if (data.type === "gh-timed-start") {
          if (!guestTimed || current.status !== "active" || guestTimerRef.current) return;
          const startedAt = Date.now();
          const id = window.setInterval(() => submitGuest(Math.floor((Date.now() - startedAt) / 1000)), 5000);
          guestTimerRef.current = { id, startedAt };
        } else if (data.type === "gh-life-lost") {
          stopGuestTimer(true);
          const remaining = Math.max(0, current.lives - 1);
          applyRun({ ...current, lives: remaining });
          if (remaining <= 0) openContinueOptions();
        } else if (data.type === "gh-level-complete") {
          stopGuestTimer(true);
          const claimedLevel = Number(data.level);
          const cleared = claimedLevel >= current.target;
          if (!guestTimed && Number.isFinite(claimedLevel)) submitGuest(Math.min(claimedLevel, current.target) * 100);
          const next: GameRun = cleared
            ? { ...current, status: "cleared", level: current.target }
            : { ...current, level: Math.max(current.level, claimedLevel + 1) };
          applyRun(next);
          post({ type: "gh-level-result", ok: true, level: next.level, lives: next.lives, status: next.status, playSeconds: next.play_seconds });
        } else if (data.type === "gh-open-buy") {
          if (current.status === "active" && current.lives <= 0) openContinueOptions();
        } else if (data.type === "gh-open-claim") {
          if (current.status === "cleared") setClaimOpen(true);
        } else if (data.type === "gh-reset-streak") {
          applyRun({ ...current, level: 1 });
          post({ type: "gh-level-result", ok: true, level: 1, lives: current.lives, status: current.status, playSeconds: 0 });
        } else if (data.type === "gh-market-load" || data.type === "gh-market-buy") {
          post({ type: "gh-market", ok: false, guest: true, message: "Sign in to use your wallet in the market.", owned: [], inv: {}, balance: null });
        }
        return;
      }

      if (data.type === "gh-reset-streak") {
        enqueue(async () => {
          try {
            const next = await resetGameStreak(current.run_id);
            applyRun(next);
            post({ type: "gh-level-result", ok: true, level: next.level, lives: next.lives, status: next.status, playSeconds: next.play_seconds });
          } catch (error) {
            post({ type: "gh-level-result", ok: false, message: (error as Error).message });
          }
        });
        return;
      }

      if (data.type === "gh-cash-out") {
        enqueue(async () => {
          try {
            const next = await cashOutGameRun(current.run_id);
            applyRun(next);
            post({ type: "gh-level-result", ok: true, level: next.level, lives: next.lives, status: next.status, playSeconds: next.play_seconds });
            setClaimOpen(true);
          } catch (error) {
            toast({ title: "Could not cash out", description: (error as Error).message, variant: "destructive" });
          }
        });
        return;
      }

      if (data.type === "gh-market-load" || data.type === "gh-market-buy") {
        enqueue(async () => {
          try {
            const msg = data as GameMessage & { itemType?: string; itemKey?: string };
            const market =
              data.type === "gh-market-buy" && msg.itemType && msg.itemKey
                ? await buyGameItem(game.id, msg.itemType, msg.itemKey, hintRef.current)
                : await fetchGameMarket(game.id, hintRef.current);
            post({ type: "gh-market", ok: true, bought: data.type === "gh-market-buy" ? `${msg.itemType}:${msg.itemKey}` : null, ...market });
          } catch (error) {
            post({ type: "gh-market", ok: false, message: (error as Error).message, owned: [], inv: {}, balance: null, failedBuy: data.type === "gh-market-buy" });
          }
        });
        return;
      }

      if (data.type === "gh-consume") {
        const key = (data as GameMessage & { itemKey?: string }).itemKey;
        if (key) void consumeGameItem(game.id, key).catch(() => undefined);
        return;
      }

      if (data.type === "gh-integrity") {
        const kind = (data as GameMessage & { kind?: string }).kind;
        const allowed: IntegrityKind[] = ["automation", "speed_hack", "synthetic_input", "tamper"];
        if (!kind || !allowed.includes(kind as IntegrityKind) || current.status !== "active") return;
        stopTicking();
        enqueue(async () => {
          try {
            const next = await reportIntegrity(current.run_id, kind as IntegrityKind);
            applyRun(next);
            if (next.status === "flagged") {
              post({ type: "gh-level-result", ok: false, status: "flagged", message: "This session failed our fair-play checks. Rewards are disabled for it." });
            }
          } catch {
            // a failed report never helps the player: the server clock keeps its own idle rules
          }
        });
        return;
      }

      if (data.type === "gh-timed-pause") {
        if (current.required_seconds === null) return;
        stopTicking();
        enqueue(async () => {
          try {
            const next = await timedPause(current.run_id);
            applyRun(next);
            post({ type: "gh-timer", playSeconds: next.play_seconds });
          } catch {
            // the server drops uncredited idle time on its own
          }
        });
        return;
      }

      if (data.type === "gh-throw") {
        if (current.required_seconds === null || tickTimerRef.current === null) return;
        enqueue(async () => {
          try {
            await timedActivity(current.run_id);
          } catch {
            // activity only keeps the clock alive; a miss slows the clock, never speeds it up
          }
        });
        return;
      }

      if (data.type === "gh-timed-start") {
        if (current.status !== "active" || current.required_seconds === null || tickTimerRef.current !== null) return;
        const generation = tickGenerationRef.current;
        enqueue(async () => {
          if (generation !== tickGenerationRef.current) return;
          try {
            applyRun(await timedBegin(current.run_id));
          } catch (error) {
            toast({ title: "Could not start the timer", description: (error as Error).message, variant: "destructive" });
            return;
          }
          if (generation !== tickGenerationRef.current || tickTimerRef.current !== null) return;
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

      if (data.type === "gh-shot") {
        enqueue(async () => {
          try {
            await recordShot(current.run_id);
          } catch (error) {
            console.warn("recordShot failed", error);
          }
        });
        return;
      }

      if (data.type === "gh-life-lost") {
        stopTicking();
        enqueue(async () => {
          try {
            const next = await loseGameLife(current.run_id);
            applyRun(next);
            post({ type: "gh-timer", playSeconds: next.play_seconds });
            if (next.lives <= 0 && next.status === "active") openContinueOptions();
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
        if (current.status === "active" && current.lives <= 0) openContinueOptions();
      } else if (data.type === "gh-open-claim") {
        if (current.status === "cleared" && !current.claimed) setClaimOpen(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [applyRun, game.id, guest, openContinueOptions, post, pushState, stopGuestTimer, stopTicking, submitGuest, toast]);

  const handleBuyLife = async () => {
    const current = runRef.current;
    if (!current || busy) return;
    setBusy(true);
    try {
      const result = await buyGameLife(current.run_id);
      applyRun(result.run);
      setBalance(result.balance);
      setBuyOpen(false);
      adShownRef.current = false;
      post({ type: "gh-continue", lives: result.run.lives, playSeconds: result.run.play_seconds });
      toast({ title: "Life added", description: `GH\u20B5${LIFE_PRICE} was taken from your wallet. Keep going!` });
    } catch (error) {
      toast({ title: "Could not buy a life", description: (error as Error).message, variant: "destructive" });
      void refreshBalance();
    } finally {
      setBusy(false);
    }
  };

  const handleBuyChance = async (chances: 1 | 2, pkg: ChancePackage | null | undefined) => {
    const current = runRef.current;
    if (!current || !storeCtx || !pkg || busy) return;
    setBusy(true);
    try {
      const order = await createChanceOrder(current.run_id, chances, storeCtx.kind, storeCtx.storeId);
      const returnTo = buildGameHubPath(game.id);
      savePendingChance({ chanceOrderId: order.chance_order_id, gameId: game.id, returnTo });
      setChancePay({ pkg, chances, chanceOrderId: order.chance_order_id });
    } catch (error) {
      toast({ title: "Could not start the purchase", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleGameOver = async () => {
    const current = runRef.current;
    if (!current || busy) return;
    setBusy(true);
    try {
      if (guest) stopGuestTimer(true);
      else await endGameRun(current.run_id);
      adShownRef.current = false;
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
      const result = await claimGameReward(current.run_id, phone, feeDue);
      applyRun({ ...current, claimed: true, reward_claimed: true });
      setClaimedPhone(result.phone);
      toast({ title: "Reward claimed", description: `Your free MTN ${result.reward_gb ?? rewardGb}GB is on its way to ${result.phone}.` });
    } catch (error) {
      if (isClaimFeeRequired(error)) {
        setFeeDue(true);
      } else {
        toast({ title: "Could not claim reward", description: (error as Error).message, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const insufficient = balance !== null && balance < LIFE_PRICE;

  const requiredMinutes = run?.required_seconds ? Math.round(run.required_seconds / 60) : timedMinutes;
  const isTimed = requiredMinutes > 0;
  const guestRules = [
    isTimed
      ? game.id === "basketball"
        ? `Score 300 points within ${requiredMinutes} minutes. You start with 2 shots and can buy an extra chance after failing.`
        : `Play for ${requiredMinutes} minute${requiredMinutes === 1 ? "" : "s"} without missing a single shot.`
      : `Reach level ${target} to complete the challenge.`,
    "Playing is free and needs no account. There are no lives to buy, so if you miss you simply start again.",
    `Sign in from your dashboard to have your win verified and claim free MTN ${rewardGb}GB.`,
  ];
  const rulesList = guest ? guestRules : [
    isTimed
      ? game.id === "basketball"
        ? `Score 300 points within ${requiredMinutes} minutes using your 2 shots. Buy an extra chance if you fall short.`
        : `Play for ${requiredMinutes} minute${requiredMinutes === 1 ? "" : "s"} without missing a single shot.`
      : `Reach level ${target} to complete the challenge.`,
    game.id === "basketball"
      ? "You start with 2 lives, so you can miss twice. Your third miss pauses the run."
      : "You start with 1 life. When you miss or lose it, the run pauses.",
    `Buy 1 extra chance for GH\u20B5${LIFE_PRICE} from your wallet after a failed attempt to continue, or end the game and start again.`,
    `Finish the challenge to win free MTN ${rewardGb}GB, sent to the MTN number you enter.`,
    "Everything is checked by our servers, so cheating or speeding up the game disables your reward.",
    "Each account can claim the reward once per game. You must be signed in to play for data.",
  ];
  const progressText = isTimed
    ? `${Math.floor((run?.play_seconds ?? 0) / 60)}:${String(Math.floor((run?.play_seconds ?? 0) % 60)).padStart(2, "0")} survived`
    : `level ${run?.level ?? 1}`;
  const shareMessage = `I reached ${progressText} on ${game.name} on JustBuy and I'm playing to win free MTN ${rewardGb}GB. Can you beat me?`;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0d0620]">
      <header className="flex items-center gap-2 border-b border-violet-400/15 px-3 py-3">
        <button type="button" onClick={onClose} aria-label="Back to Game Hub" className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-900/70 text-white">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-white">{game.name}</h2>
          <p className="truncate text-xs text-emerald-300">
            {timedMinutes > 0 ? game.id === "basketball" ? `Play ${timedMinutes} minutes with 2 lives to win free MTN ${rewardGb}GB` : `Play ${timedMinutes} minutes without a miss to win free MTN ${rewardGb}GB` : `Reach level ${target} to win a free MTN ${rewardGb}GB`}
          </p>
        </div>
        <button type="button" onClick={() => setRulesOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-3 py-2 text-xs font-bold text-emerald-950">
          <Gift className="h-4 w-4" aria-hidden="true" /> Win free data
        </button>
        <button type="button" onClick={() => setShareOpen(true)} aria-label="Share my score" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-900/70 text-white">
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </button>
        {run && !guest ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-violet-900/70 px-3 py-2 text-sm font-semibold text-white" aria-label={`${run.lives} lives left`}>
            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" aria-hidden="true" />
            {run.lives}
          </div>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        {loadError ? (
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

        {rulesOpen ? (
          <div role="dialog" aria-modal="true" aria-labelledby="rules-title" className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border border-emerald-400/30 bg-[#0b1f1a] p-5 text-white shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id="rules-title" className="flex items-center gap-2 text-lg font-bold"><Gift className="h-5 w-5 text-emerald-300" aria-hidden="true" /> Win free data</h3>
                <button type="button" onClick={() => setRulesOpen(false)} aria-label="Close rules" className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-900/70">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-emerald-100">
                {rulesList.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => {
                  setRulesOpen(false);
                  if (timedMinutes > 0) post({ type: "gh-start-challenge" });
                }}
                className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950"
              >
                {timedMinutes > 0 ? "Play - Win free data" : "Got it"}
              </button>
            </div>
          </div>
        ) : null}

        {shareOpen ? (
          <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border border-violet-400/30 bg-[#150a30] p-5 text-white shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id="share-title" className="text-lg font-bold">Share my score</h3>
                <button type="button" onClick={() => setShareOpen(false)} aria-label="Close share" className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-900/70">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mb-4 text-sm text-violet-200">{shareMessage}</p>
              <ShareScoreButtons title={`${game.name} on JustBuy`} text={shareMessage} url={buildGameShareUrl(game.id)} />
            </div>
          </div>
        ) : null}

        {activeAd ? <GameHubProductAd ad={activeAd} onOpen={openAd} onClose={closeAd} /> : null}

        {buyOpen && run && guest ? (
          <div role="dialog" aria-modal="true" aria-labelledby="guest-over-title" className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-violet-400/30 bg-[#150a30] p-5 text-white shadow-2xl">
              <h3 id="guest-over-title" className="mb-2 text-lg font-bold">Game over</h3>
              <p className="text-sm text-violet-200">
                {timedMinutes > 0
                  ? `You made it to ${Math.floor(run.play_seconds / 60)}:${String(Math.floor(run.play_seconds % 60)).padStart(2, "0")}. `
                  : `You reached level ${run.level} of ${target}. `}
                Have another go, it&apos;s free.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button type="button" onClick={() => void handleGameOver()} disabled={busy} className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                  Play again
                </button>
                <button type="button" onClick={onClose} className="rounded-xl bg-violet-900/80 px-4 py-3 text-sm font-semibold text-white">
                  Back to Game Hub
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {buyOpen && run && !guest ? (
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
              {storeCtx ? (
                <div className="mt-4 flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">Buy a chance with data from {storeCtx.storeName}</p>
                  {([
                    { chances: 1 as const, gb: singleGb, pkg: chancePackages?.single },
                    { chances: 2 as const, gb: doubleGb, pkg: chancePackages?.double },
                  ]).map(({ chances, gb, pkg }) => (
                    <button
                      key={chances}
                      type="button"
                      onClick={() => void handleBuyChance(chances, pkg)}
                      disabled={busy || !pkg}
                      className="flex items-center justify-between rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-3 text-left text-sm font-bold text-white disabled:opacity-50"
                    >
                      <span>
                        {gb}GB for {chances === 1 ? "1 chance" : "2 chances"}
                      </span>
                      <span>{pkg ? formatCedis(pkg.price) : chancePackages ? "Unavailable" : "..."}</span>
                    </button>
                  ))}
                  <p className="text-xs text-violet-300">You pay like a normal data purchase, then come straight back to this game with your chance added.</p>
                </div>
              ) : null}
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

        {chancePay && storeCtx ? (
          <PaymentDialog
            open
            onOpenChange={(next) => {
              if (!next) setChancePay(null);
            }}
            package={{ id: chancePay.pkg.id, network: "mtn", size_gb: chancePay.pkg.size_gb }}
            network="mtn"
            price={chancePay.pkg.price}
            packageId={chancePay.pkg.id}
            agentStoreId={storeCtx.kind === "agent" ? storeCtx.storeId : undefined}
            subagentStoreId={storeCtx.kind === "subagent" ? storeCtx.storeId : undefined}
            subsubagentStoreId={storeCtx.kind === "subsubagent" ? storeCtx.ownStoreId : undefined}
            storeName={storeCtx.storeName}
            phoneNumber={chancePhone}
            onPhoneNumberChange={setChancePhone}
            returnTo={buildGameHubPath(game.id)}
          />
        ) : null}

        {claimOpen && run ? (
          <div role="dialog" aria-modal="true" aria-labelledby="claim-title" className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-emerald-400/30 bg-[#0b1f1a] p-5 text-white shadow-2xl">
              <div className="mb-3 flex items-center gap-2">
                <Gift className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                <h3 id="claim-title" className="text-lg font-bold">{claimedPhone ? "Reward claimed" : timedMinutes > 0 ? `You played ${timedMinutes} minutes` : `You cleared all ${target} levels`}</h3>
              </div>
              {guest ? (
                <>
                  <p className="text-sm text-emerald-100">Free MTN {rewardGb}GB rewards are verified and sent to signed-in accounts. Log in from your dashboard and beat this game again to claim it.</p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button type="button" onClick={() => void handleGameOver()} disabled={busy} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950">
                      Play again
                    </button>
                    <button type="button" onClick={onClose} className="rounded-xl bg-emerald-900/70 px-4 py-3 text-sm font-semibold text-white">
                      Back to Game Hub
                    </button>
                  </div>
                </>
              ) : claimedPhone ? (
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
                  {feeDue ? (
                    <p role="alert" className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-sm text-amber-100">
                      A claim fee of GH₵{CLAIM_FEE_AMOUNT} applies to this reward. It is taken from your wallet when you claim.
                    </p>
                  ) : null}
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
                    {busy ? "Claiming" : feeDue ? `Pay GH₵${CLAIM_FEE_AMOUNT} and claim MTN ${rewardGb}GB` : `Claim free MTN ${rewardGb}GB`}
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
