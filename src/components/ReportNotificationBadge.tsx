import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Props = { onViewReport?: () => void };
type Reply = { id: string; subject?: string; response: string; count: number };

const db = supabase as any;

export default function ReportNotificationBadge({ onViewReport }: Props) {
  const { user } = useAuth();
  const [reply, setReply] = useState<Reply | null>(null);

  // Runs once per dashboard open (per signed-in user); no realtime or visibility re-popups.
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const load = async () => {
      const { data: unreadReports } = await db
        .from("reports")
        .select("id,subject")
        .eq("reporter_id", user.id)
        .gt("unread_for_reporter", 0)
        .order("updated_at", { ascending: false });
      const latest = unreadReports?.[0];
      if (!active || !latest) return;
      const { data: adminMessages } = await db
        .from("report_messages")
        .select("body,author_id")
        .eq("report_id", latest.id)
        .neq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!active) return;
      setReply({
        id: latest.id,
        subject: latest.subject,
        response: adminMessages?.[0]?.body || "Open your report to read the response.",
        count: unreadReports.length,
      });
    };
    void load();
    return () => { active = false; };
  }, [user?.id]);

  if (!reply) return null;

  const dismiss = async () => {
    const id = reply.id;
    setReply(null);
    await db.rpc("mark_report_read", { p_report_id: id });
  };

  const viewReport = () => {
    const id = reply.id;
    sessionStorage.setItem("open_report_id", id);
    setReply(null);
    onViewReport?.();
    window.dispatchEvent(new CustomEvent("open-report", { detail: { id } }));
  };

  return (
    <div
      className="fixed right-4 top-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-primary/30 bg-card p-4 text-card-foreground shadow-2xl"
      role="alertdialog"
      aria-live="assertive"
      aria-label="Admin responded to your report"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <BellRing className="h-4 w-4 text-primary" />
          Admin responded to your report
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss response notification" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={viewReport} className="mt-2 block w-full text-left">
        <p className="text-sm font-medium">{reply.subject || "Support report"}</p>
        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{reply.response}</p>
      </button>
      {reply.count > 1 && <p className="mt-1 text-xs text-muted-foreground">+{reply.count - 1} more report{reply.count > 2 ? "s" : ""} with replies</p>}
      <button type="button" onClick={viewReport} className="mt-3 text-sm font-semibold text-primary hover:underline">
        View full report
      </button>
    </div>
  );
}
