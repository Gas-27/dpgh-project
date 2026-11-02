import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminFetchLeaderboard, adminRewardWallet, type AdminLeaderboardRow, type AdminWalletOption, type LeaderboardPeriod } from "@/lib/gameHubApi";
import { hubGames } from "@/lib/gameHubGames";

const periods: { id: LeaderboardPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const justBuyGames = hubGames.filter((game) => game.native);
const ALL_GAMES = "all-games";
const money = (value: number) => `GH\u20B5${value.toFixed(2)}`;

function RewardDialog({ row, onClose }: { row: AdminLeaderboardRow | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [walletType, setWalletType] = useState<AdminWalletOption["type"] | "">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState(() => crypto.randomUUID());

  const selectedType = walletType || row?.wallets[0]?.type || "";
  const parsedAmount = Number(amount);
  const valid = Boolean(row && selectedType) && Number.isFinite(parsedAmount) && parsedAmount >= 0.5 && parsedAmount <= 5000;

  const reward = useMutation({
    mutationFn: () => {
      if (!row || !selectedType) throw new Error("Choose a wallet");
      return adminRewardWallet({
        userId: row.user_id,
        walletType: selectedType,
        amount: parsedAmount,
        note: note.trim() || "JustBuy Games leaderboard reward",
        reference,
      });
    },
    onSuccess: (result) => {
      toast({ title: "Wallet rewarded", description: `${row?.email} received ${money(parsedAmount)}. New balance ${money(Number(result.balance_after))}.` });
      void queryClient.invalidateQueries({ queryKey: ["gamehub-admin-leaderboard"] });
      setAmount("");
      setNote("");
      setWalletType("");
      setReference(crypto.randomUUID());
      onClose();
    },
    onError: (error: Error) => toast({ title: "Could not reward wallet", description: error.message, variant: "destructive" }),
  });

  return (
    <Dialog open={row !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reward wallet</DialogTitle>
          <DialogDescription>{row ? `Credit ${row.email} (rank #${row.rank}). The credit is recorded in the wallet ledger.` : ""}</DialogDescription>
        </DialogHeader>
        {row && row.wallets.length === 0 ? (
          <p className="text-sm text-destructive">This player has no wallet yet, so they cannot be rewarded.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="reward-wallet">Wallet</Label>
              <Select value={selectedType} onValueChange={(value) => setWalletType(value as AdminWalletOption["type"])}>
                <SelectTrigger id="reward-wallet"><SelectValue placeholder="Choose a wallet" /></SelectTrigger>
                <SelectContent>
                  {row?.wallets.map((wallet) => (
                    <SelectItem key={wallet.type} value={wallet.type}>{wallet.label} - {money(wallet.balance)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reward-amount">Amount (GH&#8373;)</Label>
              <Input id="reward-amount" type="number" inputMode="decimal" min={0.5} max={5000} step={0.5} value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reward-note">Note (optional)</Label>
              <Input id="reward-note" maxLength={200} placeholder="Weekly leaderboard winner" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!valid || reward.isPending} onClick={() => reward.mutate()}>
            {reward.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Gift className="mr-2 h-4 w-4" aria-hidden="true" />}
            Send reward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminGameLeaderboard() {
  const [gameId, setGameId] = useState<string>(ALL_GAMES);
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [target, setTarget] = useState<AdminLeaderboardRow | null>(null);

  const { data: rows = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["gamehub-admin-leaderboard", gameId, period],
    queryFn: () => adminFetchLeaderboard(gameId === ALL_GAMES ? null : gameId, period),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" /> JustBuy Games leaderboard</CardTitle>
        <CardDescription>
          Full player details for the games hosted on JustBuy. Use Reward to credit a player&apos;s wallet directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="lb-period">Period</Label>
            <Select value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}>
              <SelectTrigger id="lb-period" className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {periods.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lb-game">Game</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger id="lb-game" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GAMES}>All games</SelectItem>
                {justBuyGames.map((game) => <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Refresh
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Rank</th>
                <th scope="col" className="px-3 py-2 font-semibold">Email</th>
                <th scope="col" className="px-3 py-2 font-semibold">Top-up ref</th>
                <th scope="col" className="px-3 py-2 font-semibold">Store</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Score</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Plays</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    {isLoading ? "Loading..." : "No scores for this period."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.user_id} className="border-t">
                    <td className="px-3 py-2 font-bold">#{row.rank}</td>
                    <td className="px-3 py-2 break-all">{row.email}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.topup_reference ?? "-"}</td>
                    <td className="px-3 py-2">{row.store_name ?? "-"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{row.score.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{row.games_played}</td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" size="sm" onClick={() => setTarget(row)}>
                        <Gift className="mr-1 h-4 w-4" aria-hidden="true" /> Reward
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <RewardDialog key={target?.user_id ?? "none"} row={target} onClose={() => setTarget(null)} />
    </Card>
  );
}
