import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_PAUSE_MESSAGE,
  WITHDRAWAL_ROLES,
  emptyControls,
  fetchWithdrawalControls,
  saveWithdrawalControls,
  type WithdrawalControls,
  type WithdrawalRole,
} from "@/lib/withdrawalControls";

const QUERY_KEY = ["withdrawal-controls"];

export default function AdminWithdrawalControls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchWithdrawalControls });
  const [draft, setDraft] = useState<WithdrawalControls>(emptyControls());

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => saveWithdrawalControls(draft),
    onSuccess: () => {
      toast({ title: "Withdrawal settings saved" });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err: Error) => toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  const update = (role: WithdrawalRole, patch: Partial<WithdrawalControls[WithdrawalRole]>) =>
    setDraft((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));

  const setAll = (paused: boolean) =>
    setDraft((prev) => ({
      agent: { ...prev.agent, paused },
      subagent: { ...prev.subagent, paused },
      sub_subagent: { ...prev.sub_subagent, paused },
    }));

  const allPaused = WITHDRAWAL_ROLES.every(({ role }) => draft[role].paused);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdrawal controls</CardTitle>
        <CardDescription>
          Pause withdrawals for a group. While paused, no payout can be created and the message you write is shown when they try to withdraw.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
        {error ? (
          <p className="text-sm text-destructive">
            Could not load settings: {(error as Error).message}. Run the latest database migration first.
          </p>
        ) : null}

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-semibold">Pause everyone</p>
            <p className="text-xs text-muted-foreground">Agents, subagents and sub-subagents</p>
          </div>
          <Switch checked={allPaused} onCheckedChange={setAll} aria-label="Pause withdrawals for everyone" />
        </div>

        {WITHDRAWAL_ROLES.map(({ role, label }) => (
          <div key={role} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className={`text-xs ${draft[role].paused ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                  {draft[role].paused ? "Withdrawals are paused" : "Withdrawals are allowed"}
                </p>
              </div>
              <Switch checked={draft[role].paused} onCheckedChange={(paused) => update(role, { paused })} aria-label={`Pause withdrawals for ${label}`} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`wd-msg-${role}`}>Message {label.toLowerCase()} will see</Label>
              <Textarea
                id={`wd-msg-${role}`}
                rows={2}
                maxLength={500}
                value={draft[role].message}
                onChange={(e) => update(role, { message: e.target.value })}
                placeholder={DEFAULT_PAUSE_MESSAGE}
              />
            </div>
          </div>
        ))}

        <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save withdrawal settings
        </Button>
      </CardContent>
    </Card>
  );
}
