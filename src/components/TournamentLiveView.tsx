import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { openLiveChannel, tournamentGameName, type LiveFrame, type TournamentMatch } from "@/lib/gameHubTournaments";

const FRAME_STALE_MS = 4000;

export function useLiveFrames(matchGameId: string | null) {
  const [frames, setFrames] = useState<Record<string, LiveFrame>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!matchGameId) return;
    setFrames({});
    const live = openLiveChannel(matchGameId, (frame) => setFrames((prev) => ({ ...prev, [frame.user_id]: frame })));
    const tick = window.setInterval(() => setNow(Date.now()), 2000);
    return () => {
      window.clearInterval(tick);
      live.close();
    };
  }, [matchGameId]);

  return { frames, isFresh: (userId: string) => Boolean(frames[userId]?.image) && now - (frames[userId]?.at ?? 0) < FRAME_STALE_MS };
}

type PaneProps = {
  name: string;
  userId: string | null;
  level: number | null;
  status: string;
  wins: number;
  frame: LiveFrame | undefined;
  fresh: boolean;
};

const statusLabel: Record<string, string> = {
  ready: "Getting ready",
  playing: "Playing now",
  cleared: "Cleared the game",
  over: "Finished",
  forfeit: "Did not play",
};

function Pane({ name, userId, level, status, wins, frame, fresh }: PaneProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-b border-violet-400/20 last:border-b-0">
      <div className="flex items-center justify-between gap-2 bg-violet-950/90 px-3 py-1.5 text-xs text-white">
        <span className="truncate font-bold">@{name}</span>
        <span className="flex shrink-0 items-center gap-2">
          {level !== null ? <span className="text-violet-200">Level {level}</span> : null}
          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-bold tabular-nums text-amber-200">{wins}</span>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
        {fresh && frame?.image && userId ? (
          <img src={frame.image || "/placeholder.svg"} alt={`Live view of ${name}`} className="h-full w-full object-contain" />
        ) : (
          <div className="px-4 text-center text-sm text-violet-200/80">
            <p className="font-semibold">{statusLabel[status] ?? status}</p>
            <p className="mt-1 text-xs text-violet-300/60">{status === "playing" ? "Waiting for the live picture..." : "No live picture right now."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

type Props = { match: TournamentMatch; onClose: () => void };

export default function TournamentLiveView({ match, onClose }: Props) {
  const game = [...match.games].reverse().find((g) => g.status === "open") ?? match.games[match.games.length - 1] ?? null;
  const { frames, isFresh } = useLiveFrames(game?.status === "open" ? game.id : null);
  const attemptFor = (userId: string | null) => game?.attempts.find((attempt) => attempt.user_id === userId);

  return (
    <div role="dialog" aria-modal="true" aria-label="Live match" className="fixed inset-0 z-[70] flex flex-col bg-[#0d0620] text-white">
      <header className="flex items-center justify-between gap-2 border-b border-violet-400/20 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">
            @{match.p1_name ?? "TBD"} <span className="text-violet-300">vs</span> @{match.p2_name ?? "TBD"}
          </p>
          <p className="truncate text-xs text-violet-300">
            {game ? `Game ${game.game_no}: ${tournamentGameName(game.game_id)}` : "No game has started yet"} - first to {match.wins_needed}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close live view" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-900/70">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {[
          { id: match.p1, name: match.p1_name ?? "TBD", wins: match.p1_wins },
          { id: match.p2, name: match.p2_name ?? "TBD", wins: match.p2_wins },
        ].map((player) => (
          <Pane
            key={player.id ?? player.name}
            name={player.name}
            userId={player.id}
            level={attemptFor(player.id)?.level ?? null}
            status={attemptFor(player.id)?.status ?? "ready"}
            wins={player.wins}
            frame={player.id ? frames[player.id] : undefined}
            fresh={player.id ? isFresh(player.id) : false}
          />
        ))}
      </div>
      <p className="border-t border-violet-400/20 px-3 py-1.5 text-center text-[11px] text-violet-300/70">
        Live pictures are for watching only. Scores and winners are decided by the server.
      </p>
    </div>
  );
}
