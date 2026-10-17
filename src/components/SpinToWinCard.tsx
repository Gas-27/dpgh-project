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

  const limit = config.auto_disable_order_limit ?? 50;

  return (
    <>
      <section className="flex flex-col items-center gap-1 py-3">
        <Button type="button" onClick={() => setOpen(true)} className="h-10 rounded-full bg-gradient-to-r from-pink-600 to-orange-500 px-6 font-bold text-foreground shadow-lg hover:from-pink-700 hover:to-orange-600">
          <Gift className="mr-2 h-4 w-4" />Win Free Data ({config.eligibility_mode === "unrestricted" ? "Free" : "Eligibility Required"})
        </Button>
        {config.auto_disable_enabled && <p className="text-xs text-muted-foreground">{config.display_spin_orders ?? 0} / {limit} prizes claimed</p>}

      </section>
      <SpinWheelPopup open={open} onOpenChange={setOpen} config={config} />
    </>
  );
}

export default SpinToWinCard;
