import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Share2, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildGameShareUrl, maskEmail, shareText, submitScore } from "@/lib/gameHubApi";
import { getGameUrl, type HubGame } from "@/lib/gameHubGames";

type GameHubPlayerProps = {
  game: HubGame;
  userEmail: string | null;
  signedIn: boolean;
  onClose: () => void;
};

export default function GameHubPlayer({ game, userEmail, signedIn, onClose }: GameHubPlayerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scoreInput, setScoreInput] = useState("");
  const [saving, setSaving] = useState(false);
  const gameUrl = getGameUrl(game.id);

  const saveScore = async (value: number) => {
    if (!signedIn) {
      toast({ title: "Sign in to save your score", description: "Your score is saved to your account and shown on the leaderboard.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      toast({ title: "Enter a valid score", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const best = await submitScore(game.id, value);
      await queryClient.invalidateQueries({ queryKey: ["gamehub-leaderboard"] });
      toast({ title: "Score saved", description: `Your best on ${game.name} is ${best.toLocaleString()}.` });
      setScoreInput("");
    } catch (error) {
      toast({ title: "Could not save score", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("gamehubgh.com")) return;
      const data = event.data as { type?: string; score?: number } | null;
      if (data?.type === "gamehub-score" && typeof data.score === "number") void saveScore(data.score);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, signedIn]);

  const handleShare = async () => {
    try {
      const result = await shareText(`Play ${game.name} on Gamehub`, `Come play ${game.name} with me on Gamehub - skill only, no betting!`, buildGameShareUrl(game.id));
      if (result === "copied") toast({ title: "Link copied", description: "Paste it anywhere to invite a friend." });
    } catch {
      toast({ title: "Could not share", variant: "destructive" });
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0d0620]">
      <header className="flex items-center gap-2 border-b border-violet-400/15 px-3 py-3">
        <button type="button" onClick={onClose} aria-label="Back to Game Hub" className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-900/70 text-white">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-base font-bold text-white">{game.name}</h2>
        <button type="button" onClick={handleShare} aria-label={`Share ${game.name}`} className="flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-sm font-semibold text-white">
          <Share2 className="h-4 w-4" aria-hidden="true" /> Share
        </button>
        <a href={gameUrl} target="_blank" rel="noopener noreferrer" aria-label="Open game in a new tab" className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-900/70 text-white">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </header>
      <iframe title={game.name} src={gameUrl} allow="fullscreen; autoplay; clipboard-write" className="min-h-0 w-full flex-1 border-0 bg-black" />
      <form
        className="flex items-center gap-2 border-t border-violet-400/15 bg-violet-950/80 px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void saveScore(Number(scoreInput));
        }}
      >
        <Trophy className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
        <label htmlFor="gamehub-score" className="sr-only">Your score</label>
        <input
          id="gamehub-score"
          inputMode="numeric"
          value={scoreInput}
          onChange={(event) => setScoreInput(event.target.value.replace(/[^0-9]/g, ""))}
          placeholder={signedIn ? `Your score (as ${maskEmail(userEmail)})` : "Sign in to save your score"}
          disabled={!signedIn}
          className="min-w-0 flex-1 rounded-xl border border-violet-400/25 bg-violet-950 px-3 py-2 text-sm text-white placeholder:text-violet-300/60"
        />
        <button type="submit" disabled={saving || !scoreInput} className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Saving" : "Save score"}
        </button>
      </form>
    </div>
  );
}
