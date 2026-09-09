import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type SpinConfig = {
  enabled: boolean;
  placement_targets?: string[];
  eligibility_mode?: "unrestricted" | "order_count" | "order_amount";
  eligibility_period?: "day" | "week";
  minimum_order_count?: number;
  minimum_order_amount?: number;
};

const targetAliases: Record<string, string[]> = {
  packages: ["packages", "all"],
  agent: ["agent", "all"],
  subagent: ["subagent", "all"],
  subsubagent: ["subsubagent", "all"],
};

export function SpinToWinCard({ target }: { target: "packages" | "agent" | "subagent" | "subsubagent" }) {
  const [config, setConfig] = useState<SpinConfig | null>(null);

  useEffect(() => {
    let active = true;
    supabase.from("spin_config").select("enabled,placement_targets,eligibility_mode,eligibility_period,minimum_order_count,minimum_order_amount").maybeSingle().then(({ data }) => {
      if (active && data) setConfig(data as SpinConfig);
    });
    return () => { active = false; };
  }, []);

  if (!config?.enabled || !(config.placement_targets ?? ["all"]).some((item) => targetAliases[target].includes(item))) return null;

  const period = config.eligibility_period === "week" ? "this week" : "today";
  const requirement = config.eligibility_mode === "order_count" && (config.minimum_order_count ?? 0) > 0
    ? `Complete ${config.minimum_order_count} order${config.minimum_order_count === 1 ? "" : "s"} ${period} to unlock your spin.`
    : config.eligibility_mode === "order_amount" && (config.minimum_order_amount ?? 0) > 0
      ? `Buy at least ${Number(config.minimum_order_amount).toFixed(2)} GB worth of data ${period} to unlock your spin.`
      : "Spin the wheel for a chance to win free data.";

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Gift className="h-5 w-5 text-primary" />Spin to Win</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{requirement}</p>
        <Button type="button" onClick={() => { window.location.href = "/packages?spin=true" }} className="shrink-0">Open Spin to Win</Button>
      </CardContent>
    </Card>
  );
}
