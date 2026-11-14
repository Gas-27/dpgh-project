import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Gift, Loader2, Swords, Trophy, Users, Wallet } from "lucide-react";
import TournamentBracket from "@/components/TournamentBracket";
import TournamentGamePlayer from "@/components/TournamentGamePlayer";
import TournamentLiveView from "@/components/TournamentLiveView";
import { walletHintFromPath } from "@/components/GameHubRewardPlayer";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getFriendlyBlockedMessage } from "@/lib/blockedMessages";
import {
  claimTournamentPrize,
  fetchMyTournamentGame,
  fetchTournamentDetail,
  fetchTournaments,
  joinTournament,
  leaveTournament,
  tournamentGameName,
  type TournamentMatch,
  type TournamentStatus,
} from "@/lib/gameHubTournaments";

const statusStyle: Record<TournamentStatus, string> = {
  draft: "bg-slate-500/20 text-slate-200",
  open: "bg-emerald-500/20 text-emerald-300",
  live: "bg-rose-500/20 text-rose-300",
  finished: "bg-violet-500/20 text-violet-200",
  cancelled: "bg-slate-500/20 text-slate-300",
};
const statusText: Record<TournamentStatus, string> = { draft: "Draft", open: "Open", live: "Live", finished: "Finished", cancelled: "Cancelled" };

const money = (value: number) => (value > 0 ? `GH₵${value.toFixed(2)}` : "Free");

function errorText(error: unknown): string {
  return getFriendlyBlockedMessage(error) ?? (error as Error).message;
}

function TournamentDetailView({ id, signedIn, onBack }: { id: string; signedIn: boolean; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [phone, setPhone] = useState("");

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ["tm-detail", id],
    queryFn: () => fetchTournamentDetail(id),
    refetchInterval: (query) => (query.state.data?.tournament.status === "live" || query.state.data?.tournament.status === "open" ? 4000 : false),
  });

  const joined = detail?.tournament.joined ?? false;
  const live = detail?.tournament.status === "live";
  const { data: myGame } = useQuery({
    queryKey: ["tm-my-game", id],
    queryFn: () => fetchMyTournamentGame(id),
    enabled: joined && live,
    refetchInterval: 4000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["tm-detail", id] });
    void queryClient.invalidateQueries({ queryKey: ["tm-list"] });
  };

  const join = useMutation({
    mutationFn: () => joinTournament(id, walletHintFromPath(window.location.pathname)),
    onSuccess: () => {
      toast({ title: "You are in", description: "Your entry fee was taken from your wallet." });
      refresh();
    },
    onError: (e) => toast({ title: "Could not join", description: errorText(e), variant: "destructive" }),
  });
  const leave = useMutation({
    mutationFn: () => leaveTournament(id),
    onSuccess: () => {
      toast({ title: "Entry cancelled", description: "Your entry fee was refunded to your wallet." });
      refresh();
    },
    onError: (e) => toast({ title: "Could not leave", description: errorText(e), variant: "destructive" }),
  });
  const claim = useMutation({
    mutationFn: () => claimTournamentPrize(id, phone),
    onSuccess: (result) => {
      toast({ title: "Prize on its way", description: `${result.reward_gb}GB is being sent to your number.` });
      refresh();
    },
    onError: (e) => toast({ title: "Could not claim", description: errorText(e), variant: "destructive" }),
  });

  if (isLoading) return <p className="flex items-center justify-center gap-2 py-10 text-sm text-violet-200"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading tournament...</p>;
  if (error || !detail) return <p className="py-10 text-center text-sm text-rose-300">{errorText(error ?? new Error("Tournament not found"))}</p>;

  const t = detail.tournament;
  const selected = detail.matches.find((match) => match.id === selectedId) ?? null;
  const watchingMatch = detail.matches.find((match) => match.id === watching) ?? null;
  const me = t.me;
  const isMyMatch = (match: TournamentMatch) => Boolean(me) && (match.p1 === me || match.p2 === me);
  const eliminated =
    joined && live && detail.matches.some((match) => match.status === "finished" && isMyMatch(match) && match.winner !== null && match.winner !== me);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-violet-200">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All tournaments
      </button>

      <header className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-900/60 to-violet-950/80 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-balance">{t.title}</h2>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${statusStyle[t.status]}`}>{statusText[t.status]}</span>
        </div>
        {t.description ? <p className="mt-1 text-sm text-violet-200/80">{t.description}</p> : null}
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/30 p-2">
            <dt className="text-[10px] uppercase text-violet-300/70">Prize</dt>
            <dd className="text-sm font-bold text-amber-300">{t.prize_gb}GB</dd>
          </div>
          <div className="rounded-xl bg-black/30 p-2">
            <dt className="text-[10px] uppercase text-violet-300/70">Entry</dt>
            <dd className="text-sm font-bold">{money(t.entry_fee)}</dd>
          </div>
          <div className="rounded-xl bg-black/30 p-2">
            <dt className="text-[10px] uppercase text-violet-300/70">Players</dt>
            <dd className="text-sm font-bold">{detail.entries.length}/{t.max_players}</dd>
          </div>
        </dl>
        {t.starts_at && t.status === "open" ? <p className="mt-2 text-xs text-violet-300">Planned start: {new Date(t.starts_at).toLocaleString()}</p> : null}

        {t.status === "open" ? (
          <div className="mt-3">
            {!signedIn ? (
              <p className="text-sm text-amber-200">Sign in to join this tournament.</p>
            ) : joined ? (
              <button type="button" onClick={() => leave.mutate()} disabled={leave.isPending} className="w-full rounded-xl border border-violet-400/40 py-2.5 text-sm font-bold disabled:opacity-50">
                {leave.isPending ? "Leaving..." : "Leave and get refunded"}
              </button>
            ) : (
              <button type="button" onClick={() => join.mutate()} disabled={join.isPending || detail.entries.length >= t.max_players} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold disabled:opacity-50">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                {join.isPending ? "Joining..." : t.entry_fee > 0 ? `Join for ${money(t.entry_fee)}` : "Join for free"}
              </button>
            )}
            <p className="mt-2 text-center text-[11px] text-violet-300/70">The bracket starts automatically when all {t.max_players} places are filled, or when the admin starts it.</p>
          </div>
        ) : null}
      </header>

      {myGame && !eliminated ? (
        <button type="button" onClick={() => setPlaying(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 text-left text-black">
          <span>
            <span className="block text-sm font-extrabold">Your match is ready</span>
            <span className="block text-xs">vs @{myGame.opponent.username} - {tournamentGameName(myGame.game_id)}</span>
          </span>
          <Swords className="h-6 w-6 shrink-0" aria-hidden="true" />
        </button>
      ) : null}
      {eliminated ? <p className="rounded-xl bg-violet-950/70 p-3 text-center text-sm text-violet-200">You are out of this tournament. You can still watch every match.</p> : null}

      {t.status === "finished" && t.winner_name ? (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-4 text-center">
          <Trophy className="mx-auto h-8 w-8 text-amber-300" aria-hidden="true" />
          <p className="mt-1 text-sm text-violet-200">Champion</p>
          <p className="text-lg font-extrabold text-amber-300">@{t.winner_name}</p>
          {t.can_claim ? (
            <div className="mt-3 space-y-2 text-left">
              <label htmlFor="tm-claim-phone" className="text-xs font-semibold text-violet-200">MTN number to receive {t.prize_gb}GB</label>
              <Input id="tm-claim-phone" inputMode="tel" placeholder="0241234567" value={phone} onChange={(event) => setPhone(event.target.value)} className="border-violet-400/30 bg-black/30 text-white" />
              <button type="button" onClick={() => claim.mutate()} disabled={claim.isPending || phone.trim().length < 10} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-extrabold text-black disabled:opacity-50">
                <Gift className="h-4 w-4" aria-hidden="true" /> {claim.isPending ? "Claiming..." : "Claim my prize"}
              </button>
            </div>
          ) : t.prize_claimed ? (
            <p className="mt-1 text-xs text-violet-300">Prize claimed.</p>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="tm-bracket-title" className="space-y-2">
        <h3 id="tm-bracket-title" className="text-sm font-bold">Bracket</h3>
        <TournamentBracket detail={detail} selectedId={selectedId} onSelect={(match) => setSelectedId(match.id === selectedId ? null : match.id)} />
      </section>

      {selected ? (
        <section className="space-y-2 rounded-2xl border border-violet-400/20 bg-violet-950/60 p-3" aria-label="Selected match">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">@{selected.p1_name ?? "TBD"} vs @{selected.p2_name ?? "TBD"}</p>
            <span className="text-xs text-violet-300">First to {selected.wins_needed}</span>
          </div>
          {selected.games.length === 0 ? (
            <p className="text-xs text-violet-300/80">{selected.status === "finished" ? "This player advanced without a match." : "No games yet. This stage plays: " + selected.game_ids.map(tournamentGameName).join(", ")}</p>
          ) : (
            <ul className="space-y-1.5">
              {selected.games.map((game) => (
                <li key={game.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs">
                  <span className="font-semibold">Game {game.game_no}: {tournamentGameName(game.game_id)}</span>
                  <span className="text-violet-200">
                    {game.status === "open"
                      ? "In progress"
                      : game.winner
                        ? `Won by @${game.winner === selected.p1 ? selected.p1_name : selected.p2_name}`
                        : "Draw, replayed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {selected.status !== "waiting" && selected.p1 && selected.p2 ? (
            <button type="button" onClick={() => setWatching(selected.id)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold">
              <Eye className="h-4 w-4" aria-hidden="true" /> {selected.status === "live" ? "Watch live" : "View match"}
            </button>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="tm-stages-title" className="space-y-2">
        <h3 id="tm-stages-title" className="text-sm font-bold">Stages and games</h3>
        <ul className="space-y-1.5">
          {detail.stages.map((stage) => (
            <li key={stage.stage_no} className="rounded-xl bg-violet-950/60 px-3 py-2 text-xs">
              <p className="font-bold text-amber-300">{stage.name} <span className="font-normal text-violet-300">- first to {stage.wins_needed} wins</span></p>
              <p className="mt-0.5 text-violet-200">{stage.games.map(tournamentGameName).join(" , ")}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tm-players-title" className="space-y-2">
        <h3 id="tm-players-title" className="flex items-center gap-1.5 text-sm font-bold"><Users className="h-4 w-4" aria-hidden="true" /> Players</h3>
        {detail.entries.length === 0 ? <p className="text-xs text-violet-300/80">Nobody has joined yet.</p> : (
          <ul className="flex flex-wrap gap-1.5">
            {detail.entries.map((entry) => (
              <li key={entry.user_id} className={`rounded-full px-2.5 py-1 text-xs ${entry.status === "disqualified" ? "bg-rose-500/20 text-rose-300 line-through" : "bg-violet-900/70"}`}>@{entry.username}</li>
            ))}
          </ul>
        )}
      </section>

      {watchingMatch ? <TournamentLiveView match={watchingMatch} onClose={() => setWatching(null)} /> : null}
      {playing ? <TournamentGamePlayer tournamentId={id} onClose={() => { setPlaying(false); refresh(); }} /> : null}
    </div>
  );
}

export default function GameHubTournaments({ signedIn }: { signedIn: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: tournaments = [], isLoading } = useQuery({ queryKey: ["tm-list"], queryFn: fetchTournaments, refetchInterval: 8000 });

  if (openId) return <TournamentDetailView id={openId} signedIn={signedIn} onBack={() => setOpenId(null)} />;
  if (isLoading) return <p className="flex items-center justify-center gap-2 py-10 text-sm text-violet-200"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading tournaments...</p>;
  if (tournaments.length === 0) {
    return (
      <div className="rounded-2xl border border-violet-400/15 bg-violet-950/40 p-8 text-center">
        <Trophy className="mx-auto h-8 w-8 text-amber-300" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold">No tournaments right now</p>
        <p className="mt-1 text-xs text-violet-300/80">Check back soon. New tournaments with free data prizes are added here.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tournaments.map((t) => (
        <li key={t.id}>
          <button type="button" onClick={() => setOpenId(t.id)} className="w-full rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-900/60 to-violet-950/80 p-4 text-left transition-colors hover:border-amber-300/50">
            <div className="flex items-start justify-between gap-2">
              <p className="text-base font-bold text-balance">{t.title}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${statusStyle[t.status]}`}>{statusText[t.status]}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-violet-200">
              <span className="flex items-center gap-1 font-bold text-amber-300"><Gift className="h-3.5 w-3.5" aria-hidden="true" /> {t.prize_gb}GB prize</span>
              <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" aria-hidden="true" /> {money(t.entry_fee)}</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {t.entries_count}/{t.max_players}</span>
              {t.joined ? <span className="rounded bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Joined</span> : null}
            </div>
            {t.status === "finished" && t.winner_name ? <p className="mt-2 text-xs text-violet-300">Champion: @{t.winner_name}</p> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
