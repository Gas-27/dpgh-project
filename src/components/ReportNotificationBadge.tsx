import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function ReportNotificationBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { count: unread } = await (supabase as any).from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", user.id).eq("unread_for_reporter", true);
      if (active) setCount(unread || 0);
    };
    load();
    const timer = window.setInterval(load, 15000);
    const channel = supabase.channel(`report-notifications-${user.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "reports", filter: `reporter_id=eq.${user.id}` }, load).subscribe();
    return () => { active = false; window.clearInterval(timer); supabase.removeChannel(channel); };
  }, [user?.id]);
  if (!count) return null;
  return <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground shadow-lg" role="status" aria-live="polite"><BellRing className="h-4 w-4" />{count} report {count === 1 ? "reply" : "replies"}</div>;
}
