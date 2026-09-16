import { useEffect, useState } from "react";
import TabMaintenanceOverlay from "@/components/TabMaintenanceOverlay";
import { fetchTabControls, isTabUnavailable, type TabControls } from "@/lib/tabControls";

type Props = { active: string; label?: string };

export default function ActiveTabMaintenance({ active, label }: Props) {
  const [controls, setControls] = useState<TabControls>({});
  useEffect(() => {
    let mounted = true;
    fetchTabControls().then((next) => { if (mounted) setControls(next); });
    return () => { mounted = false; };
  }, []);
  const control = controls[active];
  if (!control || !isTabUnavailable(control)) return null;
  return <TabMaintenanceOverlay label={label ?? active} {...control} />;
}
