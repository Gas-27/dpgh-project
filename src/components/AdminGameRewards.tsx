import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { adminSetGameRules, fetchGameRewardSettings, type GameRewardSetting } from "@/lib/gameHubApi";

const QUERY_KEY = ["gamehub-reward-settings"];

function RewardRow({ setting }: { setting: GameRewardSetting }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const timed = setting.required_seconds !== null;
  const [gb, setGb] = useState(String(setting.reward_gb));
  const [enabled, setEnabled] = useState(setting.enabled);
  const [level, setLevel] = useState(String(setting.target_level ?? ""));
  const [price, setPrice] = useState(String(setting.life_price));
  const [minutes, setMinutes] = useState(String((setting.required_seconds ?? 0) / 60));

  useEffect(() => {
    setGb(String(setting.reward_gb));
    setEnabled(setting.enabled);
    setLevel(String(setting.target_level ?? ""));
    setPrice(String(setting.life_price));
    setMinutes(String((setting.required_seconds ?? 0) / 60));
  }, [setting]);

  const parsedGb = Number(gb);
  const parsedLevel = Number(level);
  const parsedPrice = Number(price);
  const parsedSeconds = Math.round(Number(minutes) * 60);
  const maxLevel = setting.max_level ?? 1;

  const levelValid = timed || (Number.isInteger(parsedLevel) && parsedLevel >= 1 && parsedLevel <= maxLevel);
  const timeValid = !timed || (parsedSeconds >= 30 && parsedSeconds <= 3600);
  const valid = Number.isFinite(parsedGb) && parsedGb > 0 && parsedGb <= 100 && parsedPrice > 0 && parsedPrice <= 500 && levelValid && timeValid;
  const dirty =
    parsedGb !== setting.reward_gb ||
    enabled !== setting.enabled ||
    parsedPrice !== setting.life_price ||
    (timed ? parsedSeconds !== setting.required_seconds : parsedLevel !== setting.target_level);

  const save = useMutation({
    mutationFn: () =>
      adminSetGameRules({
        gameId: setting.game_id,
        gb: parsedGb,
        enabled,
        targetLevel: timed ? null : parsedLevel,
        lifePrice: parsedPrice,
        requiredSeconds: timed ? parsedSeconds : null,
      }),
    onSuccess: () => {
      toast({ title: "Game rules updated", description: `${setting.title} now rewards ${parsedGb}GB${enabled ? "" : " (claims switched off)"}.` });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="min-w-0">
        <p className="font-medium">{setting.title}</p>
        <p className="text-xs text-muted-foreground">Applies to new runs. A player who already cleared a game keeps the GB they earned.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`gb-${setting.game_id}`}>MTN GB reward</Label>
          <Input id={`gb-${setting.game_id}`} type="number" inputMode="decimal" min={1} max={100} step={1} value={gb} onChange={(event) => setGb(event.target.value)} className="w-28" />
        </div>
        {timed ? (
          <div className="space-y-1">
            <Label htmlFor={`min-${setting.game_id}`}>Minutes to play</Label>
            <Input id={`min-${setting.game_id}`} type="number" inputMode="decimal" min={0.5} max={60} step={0.5} value={minutes} onChange={(event) => setMinutes(event.target.value)} className="w-28" />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor={`lvl-${setting.game_id}`}>Level to win (1-{maxLevel})</Label>
            <Input id={`lvl-${setting.game_id}`} type="number" inputMode="numeric" min={1} max={maxLevel} step={1} value={level} onChange={(event) => setLevel(event.target.value)} className="w-28" />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={`price-${setting.game_id}`}>{setting.game_id === "archery" ? "Extra arrow / heart price (GH\u20B5)" : "Extra life (GH\u20B5)"}</Label>
          <Input id={`price-${setting.game_id}`} type="number" inputMode="decimal" min={0.5} max={500} step={0.5} value={price} onChange={(event) => setPrice(event.target.value)} className="w-28" />
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
        <CardTitle>JustBuy Games rules</CardTitle>
        <CardDescription>
          For each game set the MTN reward, the level (or play time) a player must reach, and the price of an extra life. The reward size must match an active MTN package.
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
