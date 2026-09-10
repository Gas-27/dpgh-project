import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SpinWheelPopup, type SpinWheelPopupProps } from "@/pages/Packages";

type SpinConfig = NonNullable<SpinWheelPopupProps["config"]> & {
  placement_targets?: string[];
};

const targetAliases: Record<string, string[]> = {
  packages: ["packages", "all"],
  agent: ["agent", "all"],
  subagent: ["subagent", "all"],
  subsubagent: ["subsubagent", "all"],
};

export function SpinToWinCard({ target }: { target: "packages" | "agent" | "subagent" | "subsubagent" }) {
  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from("spin_config").select("enabled,default_network,payment_required,payment_amount,segments,chance_2gb,chance_1gb,chance_extra_spin,auto_disable_enabled,auto_disable_order_limit,current_spin_orders,display_spin_orders,placement_targets,eligibility_mode,eligibility_period,minimum_order_count,minimum_order_amount,minimum_order_gb").maybeSingle().then(({ data }) => {
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
      : config.eligibility_mode === "order_gb" && (config.minimum_order_gb ?? 0) > 0
        ? `Order at least ${Number(config.minimum_order_gb)}GB or have a total of ${Number(config.minimum_order_gb)}GB in orders ${period} before you spin.`
        : "No purchase requirement. Spin for a chance to win free data.";
  const limit = config.auto_disable_order_limit ?? 50;

  return (
    <>
      <section className="flex flex-col items-center gap-1 py-3">
        <Button type="button" onClick={() => setOpen(true)} className="h-10 rounded-full bg-gradient-to-r from-pink-600 to-orange-500 px-6 font-bold text-foreground shadow-lg hover:from-pink-700 hover:to-orange-600">
          <Gift className="mr-2 h-4 w-4" />Win Free Data ({config.eligibility_mode === "unrestricted" ? "Free" : "Eligibility Required"})
        </Button>
        {config.auto_disable_enabled && <p className="text-xs text-muted-foreground">{config.display_spin_orders ?? 0} / {limit} prizes claimed</p>}
        <p className="max-w-sm text-center text-[11px] text-muted-foreground">{requirement}{config.auto_disable_enabled ? ` Promotion closes after ${limit} prizes.` : ""}</p>
      </section>
      <SpinWheelPopup open={open} onOpenChange={setOpen} config={config} />
    </>
  );
}

export default SpinToWinCard;
