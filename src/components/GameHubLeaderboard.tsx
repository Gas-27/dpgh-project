import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import ShareScoreButtons from "@/components/ShareScoreButtons";
import { buildGameHubShareUrl } from "@/lib/gameHubRoute";
import { buildGameShareUrl, fetchLeaderboard, type LeaderboardPeriod } from "@/lib/gameHubApi";
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
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["gamehub-leaderboard", gameId, period],
    queryFn: () => fetchLeaderboard(gameId, period),
    staleTime: 15_000,
  });
  const selectedName = justBuyGames.find((game) => game.id === gameId)?.name ?? "JustBuy games";
  const periodLabel = periods.find((item) => item.id === period)?.label.toLowerCase() ?? "";
  const myRow = rows.find((row) => row.is_you);

  const shareMessage = myRow
    ? `I'm ranked #${myRow.rank} on ${selectedName} (${periodLabel}) with ${myRow.score.toLocaleString()} points on JustBuy. Think you can beat me?`
    : `Join me on the JustBuy leaderboard for ${selectedName} - play for free data!`;
  const shareUrl = gameId ? buildGameShareUrl(gameId) : buildGameHubShareUrl();

  const pillClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-violet-600 text-white" : "border border-violet-400/25 text-violet-200"}`;

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
      </div>
      <div className="overflow-hidden rounded-3xl border border-violet-400/25 bg-violet-950/60">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-violet-900/60 text-xs uppercase tracking-wider text-violet-200/80">
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
                <tr key={`${row.rank}-${row.player}`} className={row.is_you ? "bg-violet-600/30" : "border-t border-violet-400/10"}>
                  <td className="px-4 py-3 font-bold text-amber-300">#{row.rank}</td>
                  <td className="px-4 py-3 text-white">{row.player}{row.is_you ? <span className="ml-2 rounded-md bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold uppercase">You</span> : null}</td>
                  <td className="px-4 py-3 text-right font-semibold text-cyan-300">{row.score.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="rounded-3xl border border-violet-400/25 bg-violet-950/60 p-4">
        <p className="mb-3 text-sm font-semibold text-white">{myRow ? "Share my rank" : "Invite friends"}</p>
        <ShareScoreButtons title="JustBuy leaderboard" text={shareMessage} url={shareUrl} />
      </div>
    </section>
  );
}
