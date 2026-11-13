import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Play, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  cancelAdminTournament,
  defaultStageName,
  disqualifyTournamentPlayer,
  fetchAdminTournaments,
  fetchTournamentDetail,
  saveAdminTournament,
  stageCountFor,
  startAdminTournament,
  tournamentGameName,
  tournamentGames,
  type AdminTournament,
  type TournamentInput,
} from "@/lib/gameHubTournaments";

const PLAYER_OPTIONS = [2, 4, 8, 16, 32];
const QUERY_KEY = ["gamehub-admin-tournaments"];

type StageDraft = { name: string; games: string[]; wins_needed: string };

function blankStages(maxPlayers: number): StageDraft[] {
  const total = stageCountFor(maxPlayers);
  return Array.from({ length: total }, (_, index) => ({
    name: defaultStageName(index + 1, total),
    games: [tournamentGames[index % tournamentGames.length]?.id ?? "cup-shuffle"],
    wins_needed: "",
  }));
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function TournamentForm({ editing, onDone }: { editing: AdminTournament | null; onDone: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [entryFee, setEntryFee] = useState(String(editing?.entry_fee ?? 5));
  const [prizeGb, setPrizeGb] = useState(String(editing?.prize_gb ?? 5));
  const [maxPlayers, setMaxPlayers] = useState(editing?.max_players ?? 8);
  const [startsAt, setStartsAt] = useState(toLocalInput(editing?.starts_at ?? null));
  const [stages, setStages] = useState<StageDraft[]>(
    editing ? editing.stages.map((s) => ({ name: s.name, games: s.games, wins_needed: s.wins_needed ? String(s.wins_needed) : "" })) : blankStages(maxPlayers),
  );

  useEffect(() => {
    if (!editing) setStages(blankStages(maxPlayers));
  }, [maxPlayers, editing]);

  const locked = Boolean(editing && editing.entries_count > 0);

  const save = useMutation({
    mutationFn: (publish: boolean) => {
      const input: TournamentInput = {
        id: editing?.id,
        title: title.trim(),
        description: description.trim(),
        entry_fee: Number(entryFee) || 0,
        prize_gb: Number(prizeGb),
        max_players: maxPlayers,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        publish,
        stages: stages.map((s) => ({ name: s.name.trim() || "Stage", games: s.games, wins_needed: s.wins_needed ? Number(s.wins_needed) : null })),
      };
      return saveAdminTournament(input);
    },
    onSuccess: (_id, publish) => {
      toast({ title: publish ? "Tournament published" : "Draft saved" });
      onDone();
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });

  const updateStage = (index: number, patch: Partial<StageDraft>) => setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const toggleGame = (index: number, gameId: string) => {
    const current = stages[index].games;
    const next = current.includes(gameId) ? current.filter((g) => g !== gameId) : [...current, gameId].slice(0, 7);
    updateStage(index, { games: next });
  };
  const valid = title.trim().length >= 3 && Number(prizeGb) > 0 && stages.every((s) => s.games.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? "Edit tournament" : "New tournament"}</CardTitle>
        <CardDescription>Players pay the entry fee from their wallet. The winner of the final claims the prize as an MTN data bundle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="tm-title">Title</Label>
          <Input id="tm-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Weekend Champions Cup" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tm-desc">Description</Label>
          <Textarea id="tm-desc" value={description} rows={2} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tm-fee">Entry fee (GH₵, 0 for free)</Label>
            <Input id="tm-fee" type="number" min={0} step="0.5" disabled={locked} value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tm-prize">Winner prize (GB)</Label>
            <Input id="tm-prize" type="number" min={1} step="1" disabled={locked} value={prizeGb} onChange={(e) => setPrizeGb(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tm-players">Players needed (pool size)</Label>
            <select
              id="tm-players"
              value={maxPlayers}
              disabled={locked || Boolean(editing)}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PLAYER_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} players ({stageCountFor(n)} stages)</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tm-start">Planned start (optional)</Label>
            <Input id="tm-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
        </div>
        {locked ? <p className="text-xs text-muted-foreground">Players have joined, so fee, prize and pool size are locked. Stages can still change.</p> : null}

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Stages</h4>
          <p className="text-xs text-muted-foreground">Each match in a stage plays these games in order. A player who wins the required number of games moves on; ties replay another game. Leave "wins needed" empty for a simple majority.</p>
          {stages.map((stage, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                <div className="space-y-1">
                  <Label htmlFor={`tm-stage-name-${index}`}>Stage {index + 1} name</Label>
                  <Input id={`tm-stage-name-${index}`} value={stage.name} maxLength={40} onChange={(e) => updateStage(index, { name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`tm-stage-wins-${index}`}>Wins needed</Label>
                  <Input id={`tm-stage-wins-${index}`} type="number" min={1} max={stage.games.length || 1} value={stage.wins_needed} onChange={(e) => updateStage(index, { wins_needed: e.target.value })} placeholder="Majority" />
                </div>
              </div>
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Games for {stage.name}</legend>
                {tournamentGames.map((game) => {
                  const order = stage.games.indexOf(game.id);
                  const on = order >= 0;
                  return (
                    <label key={game.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/10 font-semibold" : ""}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleGame(index, game.id)} />
                      {on ? <span className="text-primary">{order + 1}.</span> : null} {game.name}
                    </label>
                  );
                })}
              </fieldset>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate(true)} disabled={!valid || save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editing?.status === "open" ? "Save changes" : "Publish tournament"}
          </Button>
          {!editing || editing.status === "draft" ? (
            <Button variant="outline" onClick={() => save.mutate(false)} disabled={!valid || save.isPending}>Save as draft</Button>
          ) : null}
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerManager({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["tm-detail", id], queryFn: () => fetchTournamentDetail(id) });
  const dq = useMutation({
    mutationFn: (userId: string) => disqualifyTournamentPlayer(id, userId),
    onSuccess: () => {
      toast({ title: "Player disqualified" });
      void queryClient.invalidateQueries({ queryKey: ["tm-detail", id] });
    },
    onError: (error: Error) => toast({ title: "Could not disqualify", description: error.message, variant: "destructive" }),
  });
  if (!data) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {data.entries.map((entry) => (
        <li key={entry.user_id} className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
          <span className={entry.status === "disqualified" ? "line-through" : ""}>@{entry.username}</span>
          {entry.status === "joined" && data.tournament.status === "live" ? (
            <button
              type="button"
              className="font-semibold text-destructive"
              onClick={() => {
                if (window.confirm(`Disqualify @${entry.username}? They lose any live match. No refund is given.`)) dq.mutate(entry.user_id);
              }}
            >
              Disqualify
            </button>
          ) : null}
        </li>
      ))}
      {data.entries.length === 0 ? <li className="text-xs text-muted-foreground">No players yet.</li> : null}
    </ul>
  );
}

export default function AdminGameTournaments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formFor, setFormFor] = useState<AdminTournament | "new" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAdminTournaments, refetchInterval: 15000 });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["tm-list"] });
  };

  const start = useMutation({
    mutationFn: startAdminTournament,
    onSuccess: () => {
      toast({ title: "Tournament started", description: "Players were paired at random." });
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not start", description: error.message, variant: "destructive" }),
  });
  const cancel = useMutation({
    mutationFn: cancelAdminTournament,
    onSuccess: () => {
      toast({ title: "Tournament cancelled", description: "All entry fees were refunded." });
      refresh();
    },
    onError: (error: Error) => toast({ title: "Could not cancel", description: error.message, variant: "destructive" }),
  });

  const totals = useMemo(() => items.reduce((sum, t) => sum + (t.status === "cancelled" ? 0 : t.fees_collected), 0), [items]);

  if (formFor) {
    return (
      <TournamentForm
        editing={formFor === "new" ? null : formFor}
        onDone={() => {
          setFormFor(null);
          refresh();
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Game Hub tournaments</CardTitle>
          <CardDescription>Entry fees collected (excluding cancelled): GH₵{totals.toFixed(2)}</CardDescription>
        </div>
        <Button onClick={() => setFormFor("new")}><Plus className="mr-1 h-4 w-4" /> New</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
        {!isLoading && items.length === 0 ? <p className="text-sm text-muted-foreground">No tournaments yet.</p> : null}
        {items.map((t) => (
          <div key={t.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t.status.toUpperCase()} - {t.entries_count}/{t.max_players} players - entry GH₵{t.entry_fee} - prize {t.prize_gb}GB - collected GH₵{t.fees_collected.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t.stages.map((s) => `${s.name}: ${s.games.map(tournamentGameName).join(", ")}`).join("  |  ")}</p>
                {t.winner_name ? <p className="mt-1 text-xs font-medium">Winner @{t.winner_name} ({t.prize_claimed ? "prize claimed" : "prize not claimed yet"})</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {t.status === "draft" || t.status === "open" ? (
                  <Button size="sm" variant="outline" onClick={() => setFormFor(t)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                ) : null}
                {t.status === "open" && t.entries_count >= 2 ? (
                  <Button size="sm" onClick={() => start.mutate(t.id)} disabled={start.isPending}><Play className="mr-1 h-3.5 w-3.5" /> Start now</Button>
                ) : null}
                {t.status === "open" || t.status === "live" ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={cancel.isPending}
                    onClick={() => {
                      if (window.confirm("Cancel this tournament and refund every entry fee?")) cancel.mutate(t.id);
                    }}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel and refund
                  </Button>
                ) : null}
                {t.status !== "draft" ? (
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>{expanded === t.id ? "Hide players" : "Players"}</Button>
                ) : null}
              </div>
            </div>
            {expanded === t.id ? <PlayerManager id={t.id} /> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
