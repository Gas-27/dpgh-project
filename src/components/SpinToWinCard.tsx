import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type SpinConfig = {
  enabled: boolean;
  placement_targets?: string[];
  eligibility_mode?: "unrestricted" | "order_count" | "order_amount";
  eligibility_period?: "day" | "week";
  minimum_order_count?: number;
  minimum_order_amount?: number;
  auto_disable_enabled?: boolean;
  auto_disable_order_limit?: number;
  display_spin_orders?: number;
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
    supabase.from("spin_config").select("enabled,placement_targets,eligibility_mode,eligibility_period,minimum_order_count,minimum_order_amount,auto_disable_enabled,auto_disable_order_limit,display_spin_orders").maybeSingle().then(({ data }) => {
      if (active && data) setConfig(data as SpinConfig);
    });
    return () => { active = false; };
  }, []);

  if (!config?.enabled || !(config.placement_targets ?? ["all"]).some((item) => targetAliases[target].includes(item))) return null;

  const period = config.eligibility_period === "week" ? "this week" : "today";
  const requirement = config.eligibility_mode === "order_count" && (config.minimum_order_count ?? 0) > 0
    ? `Complete ${config.minimum_order_count} order${config.minimum_order_count === 1 ? "" : "s"} ${period} before you spin.`
    : config.eligibility_mode === "order_amount" && (config.minimum_order_amount ?? 0) > 0
      ? `Buy at least GHC ${Number(config.minimum_order_amount).toFixed(2)} in data ${period} before you spin.`
      : "No purchase requirement. Spin for a chance to win free data.";
  const claimed = config.display_spin_orders ?? 0;
  const limit = config.auto_disable_order_limit ?? 50;
  const showCounter = config.auto_disable_enabled;

  return (
    <section className="flex flex-col items-center gap-1 py-3">
      <Button type="button" onClick={() => { window.location.href = "/packages?spin=true" }} className="h-10 rounded-full bg-gradient-to-r from-pink-600 to-orange-500 px-6 font-bold text-foreground shadow-lg hover:from-pink-700 hover:to-orange-600">
        <Gift className="mr-2 h-4 w-4" />Win Free Data ({config.eligibility_mode === "unrestricted" ? "Free" : "Eligibility Required"})
      </Button>
      {showCounter && <p className="text-xs text-muted-foreground">{claimed} / {limit} prizes claimed</p>}
      <div className="mt-2 max-w-md rounded-lg border border-primary/20 bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Spin to Win rules</p>
        <p>{requirement}</p>
        {showCounter && <p>Promotion closes after {limit} prizes are claimed.</p>}
      </div>
    </section>
  );
}
