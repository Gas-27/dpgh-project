import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Share2, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildGameShareUrl, fetchLeaderboard, shareText } from "@/lib/gameHubApi";
import { hubGames } from "@/lib/gameHubGames";

export default function GameHubLeaderboard() {
  const { toast } = useToast();
  const [gameId, setGameId] = useState<string | null>(null);
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["gamehub-leaderboard", gameId],
    queryFn: () => fetchLeaderboard(gameId),
    staleTime: 15_000,
  });
  const selectedName = hubGames.find((game) => game.id === gameId)?.name ?? "all Gamehub games";
  const myRow = rows.find((row) => row.is_you);

  const handleShare = async () => {
    const text = myRow
      ? `I'm ranked #${myRow.rank} on ${selectedName} with ${myRow.score.toLocaleString()} points on Gamehub. Think you can beat me?`
      : `Join me on the Gamehub leaderboard for ${selectedName} - skill only, no betting!`;
    try {
      const result = await shareText("Gamehub leaderboard", text, gameId ? buildGameShareUrl(gameId) : `${window.location.origin}/?gamehub=open`);
      if (result === "copied") toast({ title: "Copied to clipboard", description: "Paste it anywhere to challenge a friend." });
    } catch {
      toast({ title: "Could not share", variant: "destructive" });
    }
  };

  const pillClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-violet-600 text-white" : "border border-violet-400/25 text-violet-200"}`;

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-violet-400/25 bg-violet-950/60 p-5">
        <h3 className="flex items-center gap-2 text-xl font-bold text-white"><Trophy className="h-5 w-5 text-amber-300" aria-hidden="true" /> Leaderboard</h3>
        <p className="mt-1 text-sm leading-relaxed text-violet-200/75">Scores are tracked across the whole site. Players appear by a short, hidden version of their email.</p>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setGameId(null)} className={pillClass(gameId === null)}>All games</button>
          {hubGames.map((game) => (
            <button key={game.id} type="button" onClick={() => setGameId(game.id)} className={pillClass(gameId === game.id)}>{game.name}</button>
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
                  {isLoading ? "Loading rankings..." : isError ? "Could not load rankings. Try again shortly." : "No scores yet. Play a game and be the first on the board!"}
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
      <button type="button" onClick={handleShare} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white">
        <Share2 className="h-4 w-4" aria-hidden="true" /> {myRow ? "Share my score" : "Invite friends"}
      </button>
    </section>
  );
}
