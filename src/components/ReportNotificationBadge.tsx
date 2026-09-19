import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function ReportNotificationBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [reply, setReply] = useState<{ id: string; subject?: string; message?: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { data: unreadReports, count: unread } = await (supabase as any).from("reports").select("id,subject,message", { count: "exact" }).eq("reporter_id", user.id).eq("unread_for_reporter", true).order("updated_at", { ascending: false });
      if (active) { setCount(unread || 0); if (unreadReports?.[0]) setReply(unreadReports[0]); }
    };
    load();
    const timer = window.setInterval(load, 15000);
    const channel = supabase.channel(`report-notifications-${user.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "reports", filter: `reporter_id=eq.${user.id}` }, load).subscribe();
    return () => { active = false; window.clearInterval(timer); supabase.removeChannel(channel); };
  }, [user?.id]);
  if (!count || !reply) return null;
  const dismiss = async () => { await (supabase as any).rpc("mark_report_read", { p_report_id: reply.id }); setReply(null); setCount((value) => Math.max(0, value - 1)); };
  return <div className="fixed right-4 top-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-primary/30 bg-card p-4 text-card-foreground shadow-2xl" role="alertdialog" aria-live="assertive"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4 text-primary" />Your message has been responded to by admin</div><button type="button" onClick={dismiss} aria-label="Dismiss response notification" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div><p className="mt-2 text-sm text-muted-foreground">{reply.subject || "Support report"}</p><p className="mt-1 line-clamp-3 text-sm">{reply.message || "Open your support reports to view the response."}</p><button type="button" onClick={dismiss} className="mt-3 text-sm font-semibold text-primary hover:underline">Open support reports</button></div>;
}
