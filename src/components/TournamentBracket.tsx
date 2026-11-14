import { Crown, Radio } from "lucide-react";
import type { TournamentDetail, TournamentMatch } from "@/lib/gameHubTournaments";

type Props = {
  detail: TournamentDetail;
  selectedId: string | null;
  onSelect: (match: TournamentMatch) => void;
};

function PlayerRow({ name, wins, isWinner, isMe, finished }: { name: string | null; wins: number; isWinner: boolean; isMe: boolean; finished: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs ${
        isWinner ? "bg-amber-400/15 font-bold text-amber-200" : finished ? "text-violet-300/50" : "text-white"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {isWinner ? <Crown className="h-3 w-3 shrink-0 text-amber-300" aria-hidden="true" /> : null}
        <span className={`truncate ${name ? "" : "italic text-violet-300/40"}`}>{name ? `@${name}` : "To be decided"}</span>
        {isMe ? <span className="shrink-0 rounded bg-violet-500 px-1 text-[9px] font-bold uppercase text-white">You</span> : null}
      </span>
      <span className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">{wins}</span>
    </div>
  );
}

export default function TournamentBracket({ detail, selectedId, onSelect }: Props) {
  const rounds = Array.from(new Set(detail.matches.map((match) => match.round))).sort((a, b) => a - b);
  if (rounds.length === 0) {
    return <p className="rounded-xl border border-violet-400/15 bg-violet-950/40 p-4 text-center text-sm text-violet-200/70">The bracket appears here as soon as the tournament starts.</p>;
  }
  const me = detail.tournament.me;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2" role="region" aria-label="Tournament bracket" tabIndex={0}>
      <div className="flex min-w-max gap-4">
        {rounds.map((round) => {
          const matches = detail.matches.filter((match) => match.round === round);
          const stage = detail.stages.find((s) => s.stage_no === matches[0]?.stage_no);
          return (
            <section key={round} className="flex w-44 shrink-0 flex-col" aria-label={stage?.name ?? `Round ${round}`}>
              <h3 className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-amber-300">{stage?.name ?? `Round ${round}`}</h3>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {matches.map((match) => {
                  const isBye = match.status === "finished" && match.games.length === 0;
                  const selected = selectedId === match.id;
                  return (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => onSelect(match)}
                      className={`overflow-hidden rounded-xl border text-left transition-colors ${
                        selected ? "border-amber-300 bg-violet-900/70" : "border-violet-400/20 bg-violet-950/70 hover:border-violet-300/50"
                      }`}
                    >
                      <PlayerRow name={match.p1_name} wins={match.p1_wins} isWinner={match.winner !== null && match.winner === match.p1} isMe={Boolean(me) && match.p1 === me} finished={match.status === "finished"} />
                      <div className="h-px bg-violet-400/15" />
                      <PlayerRow
                        name={isBye ? "Bye" : match.p2_name}
                        wins={match.p2_wins}
                        isWinner={match.winner !== null && match.winner === match.p2}
                        isMe={Boolean(me) && match.p2 === me}
                        finished={match.status === "finished"}
                      />
                      {match.status === "live" ? (
                        <div className="flex items-center justify-center gap-1 bg-rose-500/20 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                          <Radio className="h-3 w-3" aria-hidden="true" /> Live
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
