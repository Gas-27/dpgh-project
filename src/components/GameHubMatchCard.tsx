import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchMatch, friendlyChatError, playMove, respondToMatch, type TttMatch } from "@/lib/gameHubSocial";

type Props = { matchId: string; meId: string; peerName: string };

function statusLine(match: TttMatch, meId: string, peerName: string): string {
  if (match.status === "declined") return "Challenge declined";
  if (match.status === "pending") return match.playerO === meId ? `${peerName} challenged you` : `Waiting for ${peerName} to accept`;
  if (match.status === "finished") {
    if (match.isDraw) return "It is a draw";
    return match.winner === meId ? "You won!" : `${peerName} won`;
  }
  return match.turn === meId ? "Your turn" : `${peerName}'s turn`;
}

export default function GameHubMatchCard({ matchId, meId, peerName }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["gamehub-match", matchId];
  const { data: match, isLoading } = useQuery({ queryKey, queryFn: () => fetchMatch(matchId), staleTime: 5_000 });

  const onSuccess = (next: TttMatch) => queryClient.setQueryData(queryKey, next);
  const onError = (error: unknown) => toast({ title: friendlyChatError(error), variant: "destructive" });

  const respond = useMutation({ mutationFn: (accept: boolean) => respondToMatch(matchId, accept), onSuccess, onError });
  const move = useMutation({ mutationFn: (cell: number) => playMove(matchId, cell), onSuccess, onError });

  if (isLoading) return <p className="text-xs text-violet-200/70">Loading match...</p>;
  if (!match) return <p className="text-xs text-violet-200/70">This match is no longer available.</p>;

  const myMark = match.playerX === meId ? "X" : "O";
  const canMove = match.status === "active" && match.turn === meId && !move.isPending;
  const incomingChallenge = match.status === "pending" && match.playerO === meId;

  return (
    <div className="w-56 space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <Swords className="h-4 w-4 text-amber-300" aria-hidden="true" /> Tic-Tac-Toe
      </p>
      <p className="text-xs text-violet-100/85" aria-live="polite">
        {statusLine(match, meId, peerName)}
        {match.status === "active" ? ` (you are ${myMark})` : ""}
      </p>
      {match.status === "pending" || match.status === "declined" ? null : (
        <div className="grid grid-cols-3 gap-1.5">
          {match.board.split("").map((cell, index) => (
            <button
              key={index}
              type="button"
              disabled={!canMove || cell !== "."}
              onClick={() => move.mutate(index)}
              aria-label={`Square ${index + 1}${cell === "." ? ", empty" : `, ${cell}`}`}
              className={`flex h-14 items-center justify-center rounded-lg border border-violet-300/25 bg-violet-950/80 text-2xl font-bold disabled:cursor-default ${
                cell === "X" ? "text-cyan-300" : cell === "O" ? "text-amber-300" : "text-transparent enabled:hover:bg-violet-800/70"
              }`}
            >
              {cell === "." ? "-" : cell}
            </button>
          ))}
        </div>
      )}
      {incomingChallenge ? (
        <div className="flex gap-2">
          <button type="button" disabled={respond.isPending} onClick={() => respond.mutate(true)} className="flex-1 rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-60">
            Accept
          </button>
          <button type="button" disabled={respond.isPending} onClick={() => respond.mutate(false)} className="flex-1 rounded-lg border border-violet-300/30 px-3 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-800/60 disabled:opacity-60">
            Decline
          </button>
        </div>
      ) : null}
    </div>
  );
}
