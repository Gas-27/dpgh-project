import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGameHubUser } from "@/hooks/useGameHubUser";
import { fetchTournaments, type TournamentSummary } from "@/lib/gameHubTournaments";
import { OPEN_GAMEHUB_EVENT } from "@/components/GameHubDialog";

const SEEN_KEY = "gamehub-tournament-start-seen";
const POLL_MS = 15_000;

const readSeen = (): string[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

const markSeen = (id: string) => {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(new Set([...readSeen(), id])).slice(-50)));
  } catch {
    /* storage can be unavailable in private mode; the popup simply may repeat */
  }
};

/** Tells a signed-in player on any page the moment a tournament they joined goes live. */
export default function TournamentStartNotifier() {
  const user = useGameHubUser();
  const [announced, setAnnounced] = useState<TournamentSummary | null>(null);

  const { data: tournaments = [] } = useQuery({
    queryKey: ["gamehub-tournament-start-watch", user?.id],
    queryFn: fetchTournaments,
    enabled: Boolean(user),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (announced) return;
    const seen = readSeen();
    const started = tournaments.find((row) => row.joined && row.status === "live" && !seen.includes(row.id));
    if (started) setAnnounced(started);
  }, [tournaments, announced]);

  const close = () => {
    if (announced) markSeen(announced.id);
    setAnnounced(null);
  };

  const openTournament = () => {
    close();
    window.dispatchEvent(new CustomEvent(OPEN_GAMEHUB_EVENT));
  };

  return (
    <AlertDialog open={Boolean(announced)} onOpenChange={(next) => { if (!next) close(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><Swords className="h-5 w-5 text-primary" aria-hidden="true" /> Your tournament has started</AlertDialogTitle>
          <AlertDialogDescription>
            {announced ? `${announced.title} is now live. You paid to enter, so open Game Hub and join now. You have 5 minutes to enter before you are marked as not playing.` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Later</AlertDialogCancel>
          <AlertDialogAction onClick={openTournament}>Play now</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
