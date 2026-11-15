import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Square, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  cancelAdminSnakeContest,
  endAdminSnakeContest,
  fetchAdminSnakeContests,
  saveAdminSnakeContest,
  type AdminSnakeContest,
} from "@/lib/gameHubSnake";

const QUERY_KEY = ["gamehub-admin-snake"];

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function defaultCloseTime(): string {
  return toLocalInput(new Date(Date.now() + 24 * 3600 * 1000).toISOString());
}

function ContestForm({ editing, onDone }: { editing: AdminSnakeContest | null; onDone: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [entryFee, setEntryFee] = useState(String(editing?.entry_fee ?? 2));
  const [prizeGb, setPrizeGb] = useState(String(editing?.prize_gb ?? 5));
  const [matchMinutes, setMatchMinutes] = useState(String(editing?.match_minutes ?? 4));
  const [minLength, setMinLength] = useState(String(editing?.min_length ?? 0));
  const [maxAttempts, setMaxAttempts] = useState(String(editing?.max_attempts ?? 1));
  const [closesAt, setClosesAt] = useState(editing ? toLocalInput(editing.closes_at) : defaultCloseTime());
  const locked = Boolean(editing && editing.players > 0);

  const save = useMutation({
    mutationFn: (publish: boolean) =>
      saveAdminSnakeContest({
        id: editing?.id,
        title: title.trim(),
        description: description.trim(),
        entry_fee: Number(entryFee) || 0,
        prize_gb: Number(prizeGb),
        match_minutes: Number(matchMinutes),
        min_length: Number(minLength) || 0,
        max_attempts: Number(maxAttempts) || 1,
        closes_at: new Date(closesAt).toISOString(),
        publish,
      }),
    onSuccess: (_id, publish) => {
      toast({ title: publish ? "Contest published" : "Draft saved" });
      onDone();
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });

  const valid = title.trim().length >= 3 && Number(prizeGb) > 0 && Number(matchMinutes) >= 1 && Number(matchMinutes) <= 30 && Boolean(closesAt);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? "Edit Snake War contest" : "New Snake War contest"}</CardTitle>
        <CardDescription>
          Each entry fee buys one timed Snake War match. When the closing time passes, the longest snake wins the prize.
          {locked ? " Players have entered, so fee, prize, timer and entries are locked." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sc-title">Title</Label>
          <Input id="sc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sc-desc">Description</Label>
          <Textarea id="sc-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sc-fee">Entry fee (GH₵)</Label>
            <Input id="sc-fee" type="number" min="0" step="0.5" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} disabled={locked} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sc-prize">Prize (MTN GB)</Label>
            <Input id="sc-prize" type="number" min="1" step="1" value={prizeGb} onChange={(e) => setPrizeGb(e.target.value)} disabled={locked} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sc-minutes">Match timer (minutes)</Label>
            <Input id="sc-minutes" type="number" min="1" max="30" step="1" value={matchMinutes} onChange={(e) => setMatchMinutes(e.target.value)} disabled={locked} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sc-min">Length needed to win</Label>
            <Input id="sc-min" type="number" min="0" step="1" value={minLength} onChange={(e) => setMinLength(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sc-attempts">Entries per player</Label>
            <Input id="sc-attempts" type="number" min="1" max="20" step="1" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} disabled={locked} />
          </div>
          <div className="col-span-2 space-y-2 md:col-span-1">
            <Label htmlFor="sc-closes">Contest closes</Label>
            <Input id="sc-closes" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          A new snake starts at 15 segments. Set the length needed to win to 0 to let the longest snake win no matter what, or raise it so players must reach a target to claim the free data.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => save.mutate(true)} disabled={!valid || save.isPending}>
            {save.isPending ? "Saving..." : editing && editing.status === "open" ? "Save changes" : "Publish contest"}
          </Button>
          {!editing || editing.status === "draft" ? (
            <Button type="button" variant="outline" onClick={() => save.mutate(false)} disabled={!valid || save.isPending}>Save as draft</Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSnakeContests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSnakeContest | null>(null);
  const { data: contests = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAdminSnakeContests, refetchInterval: 15000 });

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const onError = (error: Error) => toast({ title: "Action failed", description: error.message, variant: "destructive" });
  const cancel = useMutation({ mutationFn: cancelAdminSnakeContest, onSuccess: () => { toast({ title: "Contest cancelled", description: "All entry fees were refunded." }); refresh(); }, onError });
  const end = useMutation({ mutationFn: endAdminSnakeContest, onSuccess: () => { toast({ title: "Contest ended" }); refresh(); }, onError });

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">Snake War contests</h3>
          <p className="text-sm text-muted-foreground">Longest snake after the timer wins free MTN data.</p>
        </div>
        {!formOpen ? <Button type="button" onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> New contest</Button> : null}
      </div>

      {formOpen ? <ContestForm key={editing?.id ?? "new"} editing={editing} onDone={closeForm} /> : null}

      {isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading...</p> : null}
      {!isLoading && contests.length === 0 ? <p className="text-sm text-muted-foreground">No Snake War contests yet.</p> : null}

      <div className="grid gap-3">
        {contests.map((contest) => (
          <Card key={contest.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{contest.title}</p>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold uppercase">{contest.status}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Fee GH₵{contest.entry_fee} - Prize {contest.prize_gb}GB - {contest.match_minutes} min match - needs {contest.min_length}+ - closes {new Date(contest.closes_at).toLocaleString()}
              </p>
              <p className="text-sm">
                {contest.players} players - collected GH₵{Number(contest.collected).toFixed(2)}
                {contest.status === "finished" ? ` - winner ${contest.winner_name ? `@${contest.winner_name} (${contest.winner_length})` : "none"}${contest.prize_claimed ? `, claimed${contest.prize_phone ? ` to ${contest.prize_phone}` : ""}` : contest.winner_name ? ", not claimed yet" : ""}` : ""}
              </p>
              {contest.leaders.length > 0 ? (
                <p className="text-xs text-muted-foreground">Top: {contest.leaders.slice(0, 3).map((l) => `@${l.username} ${l.length}`).join(", ")}</p>
              ) : null}
              {contest.status === "draft" || contest.status === "open" ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(contest); setFormOpen(true); }}><Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Edit</Button>
                  {contest.status === "open" ? (
                    <Button type="button" size="sm" variant="outline" disabled={end.isPending} onClick={() => { if (window.confirm("End this contest now? The longest snake so far wins.")) end.mutate(contest.id); }}>
                      <Square className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> End now
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="destructive" disabled={cancel.isPending} onClick={() => { if (window.confirm("Cancel this contest and refund every entry fee?")) cancel.mutate(contest.id); }}>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Cancel and refund
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
