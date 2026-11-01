import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = { packageId: string; initialCount?: number };

export default function ProductViewBadge({ packageId, initialCount = 0 }: Props) {
  const [count, setCount] = useState(Number(initialCount) || 0);

  useEffect(() => {
    let active = true;
    (supabase as any).rpc("increment_data_package_view", { p_package_id: packageId }).then(({ data, error }: { data: unknown; error: unknown }) => {
      if (active && !error && typeof data === "number") setCount(data);
    });
    return () => { active = false; };
  }, [packageId]);

  return <span className="inline-flex items-center gap-1 text-xs text-white/70" aria-label={`${count} product views`}><Eye className="h-3.5 w-3.5" aria-hidden="true" />{count.toLocaleString()} views</span>;
}
