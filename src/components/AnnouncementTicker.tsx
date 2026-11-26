import { Megaphone, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  message: string;
  expanded?: boolean;
  onClick?: () => void;
}

export default function AnnouncementTicker({ message, expanded, onClick }: Props) {
  const item = (
    <span className="flex shrink-0 items-center gap-3 px-6 text-sm font-semibold text-foreground">
      <Megaphone className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
      {message}
    </span>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={`Announcement: ${message}`}
      className="flex w-full items-center overflow-hidden rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-3 text-left transition-colors hover:bg-cyan-500/15"
    >
      <div className="min-w-0 flex-1 overflow-hidden" aria-hidden="true">
        <div className="ticker-track">
          {item}
          {item}
          {item}
          {item}
        </div>
      </div>
      {onClick && (
        <span className="shrink-0 px-3 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      )}
    </button>
  );
}
