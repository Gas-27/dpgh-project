import { useMemo, useState } from "react";
import { BarChart3, Loader2, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminFetchLeaderboard, type LeaderboardPeriod } from "@/lib/gameHubApi";
import { hubGames } from "@/lib/gameHubGames";

const periods: { id: LeaderboardPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];
const games = hubGames.filter((game) => game.native);
const money = (value: number) => `GH₵${value.toFixed(2)}`;

export default function AdminGameHubWins() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [gameId, setGameId] = useState("all-games");
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["gamehub-admin-wins", gameId, period],
    queryFn: () => adminFetchLeaderboard(gameId === "all-games" ? null : gameId, period),
  });
  const selectedGame = games.find((game) => game.id === gameId);
  const summary = useMemo(() => ({
    winners: rows.length,
    plays: rows.reduce((sum, row) => sum + row.games_played, 0),
    estimatedGb: rows.reduce((sum) => sum + (selectedGame ? 1 : 1), 0),
  }), [rows, selectedGame]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-cyan-400" aria-hidden="true" /> Game Hub Wins &amp; Performance</CardTitle>
        <CardDescription>See winners, data rewards, player type, store details and game performance by period.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1"><Label htmlFor="wins-period">Period</Label><Select value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}><SelectTrigger id="wins-period" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{periods.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="wins-game">Game</Label><Select value={gameId} onValueChange={setGameId}><SelectTrigger id="wins-game" className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all-games">All games</SelectItem>{games.map((game) => <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">People who won</p><p className="mt-1 text-2xl font-bold">{summary.winners}</p></div>
          <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Games played</p><p className="mt-1 text-2xl font-bold">{summary.plays}</p></div>
          <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Data reward per winner</p><p className="mt-1 text-2xl font-bold text-cyan-400">{selectedGame ? "Configured" : "By game"}</p></div>
        </div>
        <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">Game / winner</th><th className="px-3 py-2">Won</th><th className="px-3 py-2">Player type</th><th className="px-3 py-2">Store</th><th className="px-3 py-2">Top-up reference</th><th className="px-3 py-2 text-right">Score</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={6} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No winners for this period.</td></tr> : rows.map((row) => <tr key={`${row.user_id}-${row.rank}`} className="border-t"><td className="px-3 py-2 font-medium"><Trophy className="mr-2 inline h-4 w-4 text-amber-500" />{row.email}</td><td className="px-3 py-2 text-cyan-400">{selectedGame ? selectedGame.name : "Game Hub winner"}</td><td className="px-3 py-2">{row.store_name ? "Agent" : "User / guest"}</td><td className="px-3 py-2">{row.store_name ?? "—"}</td><td className="px-3 py-2 font-mono text-xs">{row.topup_reference ?? "—"}</td><td className="px-3 py-2 text-right font-semibold">{row.score.toLocaleString()}</td></tr>)}</tbody></table></div>
        <p className="text-xs text-muted-foreground">Payment revenue and paid-play transactions should be connected to the game payment ledger when that ledger is available; this view uses the existing admin leaderboard records and filters.</p>
      </CardContent>
    </Card>
  );
}
