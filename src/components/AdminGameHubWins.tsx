import { useState } from "react";
import { BarChart3, Loader2, RefreshCw, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminFetchGameHubAnalytics, type AnalyticsGame, type AnalyticsSpend, type LeaderboardPeriod } from "@/lib/gameHubApi";
import { hubGames } from "@/lib/gameHubGames";

const periods: { id: LeaderboardPeriod; label: string }[] = [
  { id: "today", label: "Today" }, { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" }, { id: "month", label: "This month" }, { id: "all", label: "All time" },
];
const games = hubGames.filter((game) => game.native);
const gameName = (id: string, fallback?: string) => hubGames.find((game) => game.id === id)?.name ?? fallback ?? id;
const money = (value: number) => `GH₵${Number(value || 0).toFixed(2)}`;
const gb = (value: number) => `${Number(value || 0).toFixed(2)} GB`;
const spendLabel: Record<AnalyticsSpend["spend_type"], string> = { life: "Extra life", item: "Wallet item", chance: "Store chance pack" };
const REFRESH_MS = 15_000;

export default function AdminGameHubWins() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [gameId, setGameId] = useState("all-games");
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["gamehub-admin-analytics", gameId, period],
    queryFn: () => adminFetchGameHubAnalytics(gameId === "all-games" ? null : gameId, period),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const totals = data?.totals;
  const gameRows: AnalyticsGame[] = data?.games ?? [];
  const winners = data?.winners ?? [];
  const spend = data?.spend ?? [];
  const maxSpend = Math.max(1, ...gameRows.map((row) => row.spend_total));
  const maxWinners = Math.max(1, ...gameRows.map((row) => row.winners));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-cyan-400" aria-hidden="true" /> Game Hub Wins &amp; Performance</CardTitle>
            <CardDescription>Real reward claims, GB won, every paid spend and play activity for the selected period.</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
            <span className="relative flex h-2 w-2" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            <span>Live · updates every {REFRESH_MS / 1000}s{dataUpdatedAt ? ` · last ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1"><Label htmlFor="wins-period">Period</Label><Select value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}><SelectTrigger id="wins-period" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{periods.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="wins-game">Game</Label><Select value={gameId} onValueChange={setGameId}><SelectTrigger id="wins-game" className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all-games">All games</SelectItem>{games.map((game) => <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>)}</SelectContent></Select></div>
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {(error as Error).message}. If this mentions a missing function, run migration 20261108150000_gamehub_admin_analytics.sql.
          </p>
        ) : null}

        {isLoading || !totals ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" aria-label="Loading analytics" /></div>
        ) : (
          <>
            <section aria-labelledby="wins-metrics" className="space-y-3">
              <h3 id="wins-metrics" className="sr-only">Win metrics</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Total winners (claimed rewards)" value={totals.winners.toLocaleString()} />
                <Metric label="Total GB won" value={gb(totals.gb_total)} accent />
                <Metric label="GB delivered" value={gb(totals.gb_delivered)} hint="Order completed" />
                <Metric label="GB awaiting delivery" value={gb(totals.gb_pending)} hint="Order not completed yet" />
                <Metric label="Games played" value={totals.plays.toLocaleString()} />
                <Metric label="Players" value={totals.players.toLocaleString()} />
                <Metric label="Cleared, reward not claimed" value={totals.pending_claims.toLocaleString()} />
                <Metric label="Wallet rewards paid out" value={money(totals.wallet_rewards_paid)} hint="Leaderboard cash rewards" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Total spent in Game Hub" value={money(totals.spend_total)} accent />
                <Metric label="Extra lives" value={money(totals.spend_lives)} />
                <Metric label="Wallet items" value={money(totals.spend_items)} />
                <Metric label="Store chance packs" value={money(totals.spend_chances)} />
                <Metric label="Paid purchases" value={totals.purchases.toLocaleString()} />
                <Metric label="Paying players" value={totals.paying_players.toLocaleString()} />
                <Metric label="Average per paying player" value={money(totals.paying_players ? totals.spend_total / totals.paying_players : 0)} />
              </div>
            </section>

            <section aria-labelledby="game-performance-title" className="space-y-3">
              <div><h3 id="game-performance-title" className="font-semibold">Games performance</h3><p className="text-sm text-muted-foreground">Winners, GB won, plays and money spent per game.</p></div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">Game</th><th className="px-3 py-2">Winners</th><th className="px-3 py-2">GB won</th><th className="px-3 py-2">Plays</th><th className="px-3 py-2">Players</th><th className="px-3 py-2">Lives</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Chances</th><th className="px-3 py-2">Total spent</th><th className="px-3 py-2">Buys</th></tr></thead>
                  <tbody>
                    {gameRows.length === 0 ? <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No game activity for this period.</td></tr> : gameRows.map((row) => (
                      <tr key={row.game_id} className="border-t">
                        <td className="px-3 py-2 font-medium">{gameName(row.game_id, row.title)}</td>
                        <td className="px-3 py-2"><Bar value={row.winners} max={maxWinners} label={`${row.winners}`} /></td>
                        <td className="px-3 py-2 font-semibold text-cyan-400">{gb(row.gb)}</td>
                        <td className="px-3 py-2">{row.plays.toLocaleString()}</td>
                        <td className="px-3 py-2">{row.players.toLocaleString()}</td>
                        <td className="px-3 py-2">{money(row.spend_lives)}</td>
                        <td className="px-3 py-2">{money(row.spend_items)}</td>
                        <td className="px-3 py-2">{money(row.spend_chances)}</td>
                        <td className="px-3 py-2"><Bar value={row.spend_total} max={maxSpend} label={money(row.spend_total)} /></td>
                        <td className="px-3 py-2">{row.purchases} <span className="text-xs text-muted-foreground">({row.paying_players} players)</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="winner-details-title" className="space-y-3">
              <div><h3 id="winner-details-title" className="font-semibold">Every winner ({winners.length})</h3><p className="text-sm text-muted-foreground">Each claimed reward with the exact GB from its MTN order, delivery status, store and reference.</p></div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">Winner</th><th className="px-3 py-2">Game won</th><th className="px-3 py-2">GB won</th><th className="px-3 py-2">Number</th><th className="px-3 py-2">Delivery</th><th className="px-3 py-2">Player type</th><th className="px-3 py-2">Store</th><th className="px-3 py-2">Top-up reference</th><th className="px-3 py-2">When</th></tr></thead>
                  <tbody>
                    {winners.length === 0 ? <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No claimed rewards for this period.</td></tr> : winners.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2 font-medium"><Trophy className="mr-2 inline h-4 w-4 text-amber-500" aria-hidden="true" />{row.email ?? "Unknown"}</td>
                        <td className="px-3 py-2">{gameName(row.game_id)}</td>
                        <td className="px-3 py-2 font-semibold text-cyan-400">{gb(row.gb)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.phone}</td>
                        <td className="px-3 py-2 capitalize">{(row.order_status ?? "no order").replace(/_/g, " ")}</td>
                        <td className="px-3 py-2">{row.store_name ? "Agent" : "User / guest"}</td>
                        <td className="px-3 py-2">{row.store_name ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.topup_reference ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="spend-details-title" className="space-y-3">
              <div><h3 id="spend-details-title" className="font-semibold">Money spent in Game Hub ({spend.length})</h3><p className="text-sm text-muted-foreground">Every extra life, wallet item and store chance pack, recorded against the game it was bought in.</p></div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">Player</th><th className="px-3 py-2">Game</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Detail</th><th className="px-3 py-2">When</th></tr></thead>
                  <tbody>
                    {spend.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No paid purchases for this period.</td></tr> : spend.map((row, index) => (
                      <tr key={`${row.created_at}-${index}`} className="border-t">
                        <td className="px-3 py-2 font-medium">{row.email ?? "Unknown"}</td>
                        <td className="px-3 py-2">{gameName(row.game_id)}</td>
                        <td className="px-3 py-2">{spendLabel[row.spend_type]}</td>
                        <td className="px-3 py-2 font-semibold">{money(row.amount)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.note ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
        <p className="text-xs text-muted-foreground">Winners are players who claimed a reward; GB comes from the actual MTN order. Spend comes from the wallet ledger (lives, items) and paid store chance orders. Days run on UTC. Showing up to 1,000 rows per table.</p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, accent = false, hint }: { label: string; value: string; accent?: boolean; hint?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-cyan-400" : ""}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}
