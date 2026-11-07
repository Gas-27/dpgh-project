import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { fetchActiveAnnouncements } from "@/lib/gameHubApi";

const SEEN_KEY = "gamehub-seen-announcements";

function readSeen(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export default function GameHubAnnouncements({ open }: { open: boolean }) {
  const [seen, setSeen] = useState<string[]>(() => readSeen());
  const { data = [] } = useQuery({
    queryKey: ["gamehub-announcements"],
    queryFn: fetchActiveAnnouncements,
    enabled: open,
    staleTime: 30_000,
  });

  const unseen = useMemo(() => data.filter((item) => !seen.includes(item.id)), [data, seen]);
  const current = unseen[0];
  if (!open || !current) return null;

  const dismiss = () => {
    const next = [...seen, current.id].slice(-50);
    setSeen(next);
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable; the popup simply shows again next time
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="alertdialog" aria-modal="true" aria-labelledby="gh-announcement-title">
      <div className="w-full max-w-sm space-y-3 rounded-2xl border border-amber-300/30 bg-[#150a2e] p-5 text-white shadow-2xl">
        <div className="flex items-center gap-2 text-amber-300">
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wide">Game Hub notice{unseen.length > 1 ? ` (${unseen.length})` : ""}</span>
        </div>
        <h2 id="gh-announcement-title" className="text-lg font-bold text-balance">{current.title}</h2>
        <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-violet-100/90">{current.body}</p>
        <button type="button" onClick={dismiss} className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500">
          {unseen.length > 1 ? "Next" : "Got it"}
        </button>
      </div>
    </div>
  );
}
