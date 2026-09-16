import { useEffect, useState } from "react";
import TabMaintenanceOverlay from "@/components/TabMaintenanceOverlay";
import { fetchTabControls, isTabUnavailable, type TabControls } from "@/lib/tabControls";
import { supabase } from "@/integrations/supabase/client";

type Props = { active: string; label?: string };

export default function ActiveTabMaintenance({ active, label }: Props) {
  const [controls, setControls] = useState<TabControls>({});
  useEffect(() => {
    let mounted = true;
    const load = () => fetchTabControls().then((next) => { if (mounted) setControls(next); });
    load();
    const interval = window.setInterval(load, 15000);
    const channel = supabase.channel("tab-controls-live").on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load).subscribe();
    return () => { mounted = false; window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, []);
  const aliases: Record<string, string[]> = {
    instant: ["instant", "data-airtime", "data_and_airtime", "airtime"],
    data: ["data", "cheap-data", "cheap_data"],
    packages: ["packages", "package"],
    services: ["services", "service"],
    products: ["products", "product"],
  };
  const control = [active, ...(aliases[active] ?? [])].map((key) => controls[key]).find(Boolean);
  if (!control || !isTabUnavailable(control)) return null;
  return <TabMaintenanceOverlay label={label ?? active} {...control} onReturn={() => {
    if (window.history.length > 1) {
      window.history.go(-1);
    } else {
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }} />;
}
