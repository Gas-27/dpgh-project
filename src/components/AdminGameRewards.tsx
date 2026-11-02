import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { adminSetGameReward, fetchGameRewardSettings, type GameRewardSetting } from "@/lib/gameHubApi";

const QUERY_KEY = ["gamehub-reward-settings"];

function RewardRow({ setting }: { setting: GameRewardSetting }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [gb, setGb] = useState(String(setting.reward_gb));
  const [enabled, setEnabled] = useState(setting.enabled);

  useEffect(() => {
    setGb(String(setting.reward_gb));
    setEnabled(setting.enabled);
  }, [setting.reward_gb, setting.enabled]);

  const parsed = Number(gb);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 100;
  const dirty = parsed !== setting.reward_gb || enabled !== setting.enabled;

  const save = useMutation({
    mutationFn: () => adminSetGameReward(setting.game_id, parsed, enabled),
    onSuccess: () => {
      toast({ title: "Reward updated", description: `${setting.title} now rewards ${parsed}GB${enabled ? "" : " (claims switched off)"}.` });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{setting.title}</p>
        <p className="text-xs text-muted-foreground">Applies to new runs. A player who already cleared a game keeps the GB they earned.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`gb-${setting.game_id}`}>MTN GB reward</Label>
          <Input
            id={`gb-${setting.game_id}`}
            type="number"
            inputMode="decimal"
            min={1}
            max={100}
            step={1}
            value={gb}
            onChange={(event) => setGb(event.target.value)}
            className="w-28"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id={`on-${setting.game_id}`} checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor={`on-${setting.game_id}`}>Claims on</Label>
        </div>
        <Button type="button" disabled={!valid || !dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
          Save
        </Button>
      </div>
    </div>
  );
}

export default function AdminGameRewards() {
  const { data: settings = [], isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchGameRewardSettings });

  return (
    <Card>
      <CardHeader>
        <CardTitle>JustBuy Games rewards</CardTitle>
        <CardDescription>
          Set how many GB of MTN data each game gives when a player completes it, or switch a game&apos;s claims off. Players claim by entering their MTN number once the server has verified their run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}
        {settings.map((setting) => <RewardRow key={setting.game_id} setting={setting} />)}
      </CardContent>
    </Card>
  );
}
