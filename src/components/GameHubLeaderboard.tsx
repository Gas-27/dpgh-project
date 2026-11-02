import { useEffect, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Crosshair, Gift, Trophy } from "lucide-react";
import ShareScoreButtons from "@/components/ShareScoreButtons";
import { buildGameHubShareUrl } from "@/lib/gameHubRoute";
import { buildGameShareUrl, fetchLeaderboard, fetchPublicRewards, type LeaderboardPeriod } from "@/lib/gameHubApi";
import { hubGames } from "@/lib/gameHubGames";

const periods: { id: LeaderboardPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const justBuyGames = hubGames.filter((game) => game.native);

export default function GameHubLeaderboard() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [tab, setTab] = useState<"ranks" | "rewards">("ranks");
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["gamehub-leaderboard", gameId, period],
    queryFn: () => fetchLeaderboard(gameId, period),
    staleTime: 15_000,
  });
  const { data: rewards = [] } = useQuery({
    queryKey: ["gamehub-public-rewards"],
    queryFn: fetchPublicRewards,
    staleTime: 30_000,
  });
  const selectedName = justBuyGames.find((game) => game.id === gameId)?.name ?? "JustBuy games";
  const periodLabel = periods.find((item) => item.id === period)?.label.toLowerCase() ?? "";
  const myRow = rows.find((row) => row.is_you);
  const listRef = useRef<HTMLDivElement>(null);
  const [showPositions, setShowPositions] = useState(false);
  const [pendingScroll, setPendingScroll] = useState(false);

  const positionScopes = [{ id: null as string | null, name: "All games" }, ...justBuyGames.map((game) => ({ id: game.id as string | null, name: game.name }))];
  const positionQueries = useQueries({
    queries: positionScopes.map((scope) => ({
      queryKey: ["gamehub-leaderboard", scope.id, period],
      queryFn: () => fetchLeaderboard(scope.id, period),
      staleTime: 15_000,
      enabled: showPositions,
    })),
  });
  const positionsLoading = positionQueries.some((query) => query.isLoading);

  useEffect(() => {
    if (!pendingScroll || tab !== "ranks" || isLoading) return;
    const container = listRef.current;
    const target = container?.querySelector<HTMLElement>("[data-me='true']");
    if (container && target) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const top = container.scrollTop + (targetRect.top - containerRect.top) - container.clientHeight / 2 + targetRect.height / 2;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    setPendingScroll(false);
  }, [pendingScroll, tab, isLoading, rows]);

  const findMyPosition = () => {
    setTab("ranks");
    setShowPositions(true);
    setPendingScroll(true);
  };

  const shareMessage = myRow
    ? `I'm ranked #${myRow.rank} on ${selectedName} (${periodLabel}) with ${myRow.score.toLocaleString()} points on JustBuy. Think you can beat me?`
    : `Join me on the JustBuy leaderboard for ${selectedName} - play for free data!`;
  const shareUrl = gameId ? buildGameShareUrl(gameId) : buildGameHubShareUrl();

  const pillClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-violet-600 text-white" : "border border-violet-400/25 text-violet-200"}`;

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${active ? "bg-violet-600 text-white" : "text-violet-200"}`;

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-violet-400/25 bg-violet-950/60 p-5">
        <h3 className="flex items-center gap-2 text-xl font-bold text-white"><Trophy className="h-5 w-5 text-amber-300" aria-hidden="true" /> Leaderboard</h3>
        <p className="mt-1 text-sm leading-relaxed text-violet-200/75">Only games played on JustBuy count. Players appear by a short, hidden version of their email.</p>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Time period">
          {periods.map((item) => (
            <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => setPeriod(item.id)} className={pillClass(period === item.id)}>{item.label}</button>
          ))}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Game">
          <button type="button" aria-pressed={gameId === null} onClick={() => setGameId(null)} className={pillClass(gameId === null)}>All games</button>
          {justBuyGames.map((game) => (
            <button key={game.id} type="button" aria-pressed={gameId === game.id} onClick={() => setGameId(game.id)} className={pillClass(gameId === game.id)}>{game.name}</button>
          ))}
        </div>
        <button type="button" onClick={findMyPosition} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-violet-950 hover:bg-amber-300">
          <Crosshair className="h-4 w-4" aria-hidden="true" /> Find my position
        </button>
        {showPositions ? (
          <div className="mt-3 rounded-2xl border border-violet-400/20 bg-violet-900/40 p-3" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-200/80">My rank ({periodLabel})</p>
            <ul className="mt-2 space-y-1.5">
              {positionScopes.map((scope, index) => {
                const query = positionQueries[index];
                const mine = query.data?.find((row) => row.is_you);
                const isCurrent = scope.id === gameId;
                return (
                  <li key={scope.id ?? "all"}>
                    <button
                      type="button"
                      onClick={() => {
                        setGameId(scope.id);
                        setTab("ranks");
                        setPendingScroll(true);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm ${isCurrent ? "bg-violet-600/40" : "hover:bg-violet-800/50"}`}
                    >
                      <span className="text-white">{scope.name}</span>
                      <span className="shrink-0 font-semibold">
                        {query.isLoading ? (
                          <span className="text-violet-200/70">Checking...</span>
                        ) : mine ? (
                          <span className="text-amber-300">#{mine.rank} <span className="text-cyan-300">&middot; {mine.score.toLocaleString()} pts</span>{query.data ? <span className="text-violet-200/70"> of {query.data.length.toLocaleString()}</span> : null}</span>
                        ) : (
                          <span className="text-violet-200/60">Not ranked</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!positionsLoading && positionQueries.every((query) => !query.data?.some((row) => row.is_you)) ? (
              <p className="mt-2 text-xs leading-relaxed text-violet-200/75">You have no score in this period yet. Make sure you are signed in, then play a game to get on the board.</p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex gap-2 rounded-full border border-violet-400/25 bg-violet-950/60 p-1" role="tablist" aria-label="Leaderboard sections">
        <button type="button" role="tab" aria-selected={tab === "ranks"} onClick={() => setTab("ranks")} className={tabClass(tab === "ranks")}>
          <Trophy className="h-4 w-4" aria-hidden="true" /> Rankings{rows.length > 0 ? ` (${rows.length.toLocaleString()})` : ""}
        </button>
        <button type="button" role="tab" aria-selected={tab === "rewards"} onClick={() => setTab("rewards")} className={tabClass(tab === "rewards")}>
          <Gift className="h-4 w-4" aria-hidden="true" /> Wallet rewards
        </button>
      </div>
      {tab === "ranks" ? (
      <div ref={listRef} className="max-h-[55vh] overflow-y-auto overscroll-contain rounded-3xl border border-violet-400/25 bg-violet-950/60" tabIndex={0} aria-label="Ranked players">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-violet-900 text-xs uppercase tracking-wider text-violet-200/80">
              <th scope="col" className="px-4 py-3 font-semibold">Rank</th>
              <th scope="col" className="px-4 py-3 font-semibold">Player</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-violet-200/75">
                  {isLoading ? "Loading rankings..." : isError ? "Could not load rankings. Try again shortly." : "No scores for this period yet. Play a game and be the first on the board!"}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.rank}-${row.player}`} data-me={row.is_you ? "true" : undefined} className={row.is_you ? "bg-violet-600/30" : "border-t border-violet-400/10"}>
                  <td className="px-4 py-3 font-bold text-amber-300">#{row.rank}</td>
                  <td className="px-4 py-3 text-white">{row.player}{row.is_you ? <span className="ml-2 rounded-md bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold uppercase">You</span> : null}</td>
                  <td className="px-4 py-3 text-right font-semibold text-cyan-300">{row.score.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      ) : (
      <div className="rounded-3xl border border-amber-300/25 bg-violet-950/60 p-5">
        <h3 className="flex items-center gap-2 text-lg font-bold text-white"><Gift className="h-5 w-5 text-amber-300" aria-hidden="true" /> Wallet rewards</h3>
        <p className="mt-1 text-sm leading-relaxed text-violet-200/75">Top players get topped up straight into their JustBuy wallet by the admin.</p>
        {rewards.length === 0 ? (
          <p className="mt-4 text-sm text-violet-200/75">No wallet rewards yet. Climb the leaderboard to be the first!</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {rewards.map((reward) => (
              <li key={reward.id} className="rounded-2xl border border-violet-400/15 bg-violet-900/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white"><span className="font-semibold">{reward.player}</span> received <span className="font-bold text-emerald-300">GH&#8373;{reward.amount.toFixed(2)}</span></p>
                  <time className="shrink-0 text-xs text-violet-200/70" dateTime={reward.created_at}>{new Date(reward.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</time>
                </div>
                {reward.note ? <p className="mt-1 text-xs leading-relaxed text-violet-200/80">&ldquo;{reward.note}&rdquo;</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
      <div className="rounded-3xl border border-violet-400/25 bg-violet-950/60 p-4">
        <p className="mb-3 text-sm font-semibold text-white">{myRow ? "Share my rank" : "Invite friends"}</p>
        <ShareScoreButtons title="JustBuy leaderboard" text={shareMessage} url={shareUrl} />
      </div>
    </section>
  );
}
