import { useMemo, useState } from "react";
import { BarChart3, Loader2, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminFetchLeaderboard, fetchGameRewardSettings, type AdminLeaderboardRow, type GameRewardSetting, type LeaderboardPeriod } from "@/lib/gameHubApi";
import { hubGames } from "@/lib/gameHubGames";

const periods: { id: LeaderboardPeriod; label: string }[] = [
  { id: "today", label: "Today" }, { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" }, { id: "month", label: "This month" }, { id: "all", label: "All time" },
];
const games = hubGames.filter((game) => game.native);
const money = (value: number) => `GH₵${value.toFixed(2)}`;
type Winner = AdminLeaderboardRow & { gameId: string; gameName: string; rewardGb: number; lifePrice: number };

export default function AdminGameHubWins() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [gameId, setGameId] = useState("all-games");
  const { data: settings = [], isLoading: settingsLoading } = useQuery({ queryKey: ["gamehub-admin-settings"], queryFn: fetchGameRewardSettings, staleTime: 60_000 });
  const { data: winners = [], isLoading, error } = useQuery({
    queryKey: ["gamehub-admin-full-analytics", gameId, period],
    queryFn: async () => {
      const selected = gameId === "all-games" ? games : games.filter((game) => game.id === gameId);
      const grouped = await Promise.all(selected.map(async (game) => {
        const rows = await adminFetchLeaderboard(game.id, period);
        const setting = settings.find((item) => item.game_id === game.id);
        return rows.map((row) => ({ ...row, gameId: game.id, gameName: game.name, rewardGb: setting?.reward_gb ?? 0, lifePrice: setting?.life_price ?? 0 }));
      }));
      return grouped.flat();
    },
    enabled: !settingsLoading,
  });
  const summary = useMemo(() => ({
    winners: winners.length,
    gb: winners.reduce((sum, winner) => sum + winner.rewardGb, 0),
    plays: winners.reduce((sum, winner) => sum + winner.games_played, 0),
    spend: 0,
  }), [winners]);
  const gameRows = useMemo(() => games.map((game) => {
    const rows = winners.filter((winner) => winner.gameId === game.id);
    return { game, winners: rows.length, gb: rows.reduce((sum, row) => sum + row.rewardGb, 0), plays: rows.reduce((sum, row) => sum + row.games_played, 0) };
  }).filter((row) => gameId === "all-games" || row.game.id === gameId), [gameId, winners]);
  const maxWinners = Math.max(1, ...gameRows.map((row) => row.winners));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-cyan-400" aria-hidden="true" /> Game Hub Wins &amp; Performance</CardTitle>
        <CardDescription>Full winner, reward, game activity and paid-play analysis for the selected period.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1"><Label htmlFor="wins-period">Period</Label><Select value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}><SelectTrigger id="wins-period" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{periods.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="wins-game">Game</Label><Select value={gameId} onValueChange={setGameId}><SelectTrigger id="wins-game" className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all-games">All games</SelectItem>{games.map((game) => <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total winners" value={summary.winners.toLocaleString()} />
          <Metric label="Total GB awarded" value={`${summary.gb.toFixed(2)} GB`} accent />
          <Metric label="Games played" value={summary.plays.toLocaleString()} />
          <Metric label="Paid-play spend recorded" value={summary.spend ? money(summary.spend) : "No ledger"} />
        </div>
        <section aria-labelledby="game-performance-title" className="space-y-3">
          <div><h3 id="game-performance-title" className="font-semibold">Games performance</h3><p className="text-sm text-muted-foreground">Winner count and GB awarded per game.</p></div>
          <div className="space-y-4 rounded-lg border p-4">{gameRows.map((row) => <div key={row.game.id} className="grid grid-cols-[minmax(110px,1fr)_2fr_auto] items-center gap-3 text-sm"><span className="truncate font-medium">{row.game.name}</span><div className="h-3 overflow-hidden rounded-full bg-muted" aria-label={`${row.winners} winners`}><div className="h-full rounded-full bg-cyan-400" style={{ width: `${(row.winners / maxWinners) * 100}%` }} /></div><span className="w-28 text-right text-muted-foreground">{row.winners} wins · {row.gb.toFixed(2)} GB</span></div>)}{gameRows.length === 0 ? <p className="text-sm text-muted-foreground">No game records for this period.</p> : null}</div>
        </section>
        <section aria-labelledby="winner-details-title" className="space-y-3">
          <div><h3 id="winner-details-title" className="font-semibold">Every winner</h3><p className="text-sm text-muted-foreground">The game won, GB awarded, score, player type, store and reference.</p></div>
          <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[1200px] text-left text-sm"><thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">Winner</th><th className="px-3 py-2">Game won</th><th className="px-3 py-2">GB awarded</th><th className="px-3 py-2">Player type</th><th className="px-3 py-2">Store</th><th className="px-3 py-2">Top-up reference</th><th className="px-3 py-2 text-right">Score / plays</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={7} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : winners.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No winners for this period.</td></tr> : winners.map((row) => <tr key={`${row.gameId}-${row.user_id}-${row.rank}`} className="border-t"><td className="px-3 py-2 font-medium"><Trophy className="mr-2 inline h-4 w-4 text-amber-500" />{row.email}</td><td className="px-3 py-2">{row.gameName}</td><td className="px-3 py-2 font-semibold text-cyan-400">{row.rewardGb.toFixed(2)} GB</td><td className="px-3 py-2">{row.store_name ? "Agent" : "User / guest"}</td><td className="px-3 py-2">{row.store_name ?? "—"}</td><td className="px-3 py-2 font-mono text-xs">{row.topup_reference ?? "—"}</td><td className="px-3 py-2 text-right">{row.score.toLocaleString()} / {row.games_played}</td></tr>)}</tbody></table></div>
        </section>
        <p className="text-xs text-muted-foreground">Paid-play spend is shown as “No ledger” until game payment transactions are stored in a dedicated admin-readable ledger. This prevents reporting wallet balances as fake game revenue.</p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-bold ${accent ? "text-cyan-400" : ""}`}>{value}</p></div>;
}
