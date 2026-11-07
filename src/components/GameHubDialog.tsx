import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ExternalLink,
  Flame,
  Gamepad2,
  LayoutGrid,
  MessageCircle,
  Play,
  Puzzle,
  Share2,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GameHubChat from "@/components/GameHubChat";
import GameHubAnnouncements from "@/components/GameHubAnnouncements";
import GameHubJoinCard from "@/components/GameHubJoinCard";
import GameHubLeaderboard from "@/components/GameHubLeaderboard";
import GameHubPlayer from "@/components/GameHubPlayer";
import GameHubArcheryPlayer from "@/components/GameHubArcheryPlayer";
import GameHubRewardPlayer from "@/components/GameHubRewardPlayer";
import { useGameHubUser } from "@/hooks/useGameHubUser";
import { useToast } from "@/hooks/use-toast";
import { buildGameShareUrl, fetchGameRewardSettings, fetchGameVideos, maskEmail, shareText, type GameVideo } from "@/lib/gameHubApi";
import { leaveGameHubUrl, markGameHubLanding, parseGameHubPath, syncGameHubUrl } from "@/lib/gameHubRoute";
import { useConversations, useGameHubRealtime } from "@/lib/gameHubSocial";
import { findHubGame, getGameBlurb, getGameHubDirectUrl, hotGames, hubGames, stripGames, tagClasses, type GameRuleSummary, type HubGame } from "@/lib/gameHubGames";

type RuleMap = Record<string, GameRuleSummary>;

export const OPEN_GAMEHUB_EVENT = "open-gamehub";
const GAMEHUB_URL = "https://gamehubgh.com";

type Slide = { key: string; label: string; title: string; text: string; image: string; video?: string; game?: HubGame };

const defaultSlides: Slide[] = [
  { key: "sliding", label: "Skill game", title: "Sliding Puzzle", text: "Play games, win free data, and share the fun with friends.", image: "/game-previews/sliding-puzzle.webp", game: findHubGame("sliding-tiles-online") },
  { key: "connect", label: "Online", title: "Connect 4", text: "Invite a friend and play live, one-on-one.", image: "/game-previews/connect-four-online.webp", game: findHubGame("connect-four-online") },
];

function VisitGameHubBanner() {
  return (
    <a
      href={GAMEHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-4 py-3 text-white shadow-lg shadow-fuchsia-900/30"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"><Gamepad2 className="h-5 w-5" aria-hidden="true" /></span>
        <span className="flex flex-col text-left">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">Direct link</span>
          <span className="text-base font-bold leading-tight">Visit Game Hub</span>
        </span>
      </span>
      <ExternalLink className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </a>
  );
}

function FeaturedCarousel({ videos, rules, onPlay }: { videos: GameVideo[]; rules: RuleMap; onPlay: (game: HubGame) => void }) {
  const [index, setIndex] = useState(0);

  const videoSlides: Slide[] = videos.flatMap((video) => {
    const game = findHubGame(video.game_id);
    if (!game) return [];
    return [{ key: video.game_id, label: game.tag, title: game.name, text: getGameBlurb(game, rules[game.id]), image: game.image, video: video.video_url, game }];
  });
  const slides = videoSlides.length > 0 ? videoSlides : defaultSlides;
  const slide = slides[index % slides.length];

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), slide.video ? 9000 : 5000);
    return () => window.clearInterval(timer);
  }, [slides.length, slide.video]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet-400/30 bg-violet-950">
      {slide.video ? (
        <video key={slide.key} src={slide.video} poster={slide.image} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <img src={slide.image || "/placeholder.svg"} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0620] via-[#0d0620]/55 to-transparent" />
      <div className="relative flex min-h-[220px] flex-col justify-end p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">{slide.label}</p>
        <h3 className="mt-1 text-2xl font-bold text-white">{slide.title}</h3>
        <p className="mt-1 max-w-[55%] text-sm leading-relaxed text-white/85">{slide.text}</p>
        {slide.game ? (
          <button
            type="button"
            onClick={() => onPlay(slide.game as HubGame)}
            className="absolute bottom-10 right-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white"
          >
            <Play className="h-4 w-4" aria-hidden="true" /> Play now
          </button>
        ) : null}
        <div className="mt-4 flex justify-center gap-2">
          {slides.map((item, dot) => (
            <button
              key={item.key}
              type="button"
              aria-label={`Show ${item.title}`}
              onClick={() => setIndex(dot)}
              className={`h-1.5 rounded-full transition-all ${dot === index % slides.length ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function IntroCard({ onBrowse }: { onBrowse: () => void }) {
  const stats = [
    { icon: Gamepad2, value: `${hubGames.length}+`, label: "Games" },
    { icon: Users, value: "Live", label: "Leaderboards" },
    { icon: Trophy, value: "1v1", label: "Multiplayer" },
  ];
  return (
    <section className="rounded-3xl border border-violet-400/25 bg-violet-950/60 p-5">
      <h3 className="text-2xl font-bold leading-tight text-white text-balance">
        Your Ultimate <span className="bg-gradient-to-r from-fuchsia-400 to-violet-300 bg-clip-text text-transparent">Gaming Hub</span>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-violet-200/80">
        Challenge friends, climb the leaderboard, and discover over 30 free games across every genre.
      </p>
      <ul className="mt-4 grid grid-cols-3 gap-2">
        {stats.map(({ icon: Icon, value, label }) => (
          <li key={label} className="flex flex-col items-center rounded-2xl bg-violet-900/50 px-2 py-3 text-center">
            <Icon className="h-5 w-5 text-fuchsia-300" aria-hidden="true" />
            <span className="mt-1 text-lg font-bold text-cyan-300">{value}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-violet-200/70">{label}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onBrowse}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white"
      >
        Browse All Games <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}

function GamesStrip({ onPlay }: { onPlay: (game: HubGame) => void }) {
  return (
    <section aria-label="Quick play" className="rounded-3xl border border-violet-400/25 bg-violet-950/60 p-4">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {stripGames.map((game) => (
          <button key={game.id} type="button" onClick={() => onPlay(game)} className="flex w-24 shrink-0 flex-col items-center gap-2">
            <img src={game.image || "/placeholder.svg"} alt="" loading="lazy" className="h-20 w-24 rounded-2xl border border-violet-300/20 object-cover" />
            <span className="w-full truncate text-center text-sm font-semibold text-white">{game.stripName ?? game.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function GameCard({ game, rules, className = "", onPlay, onShare }: { game: HubGame; rules: RuleMap; className?: string; onPlay: (game: HubGame) => void; onShare: (game: HubGame) => void }) {
  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-950/70 ${className}`}>
      <div className="relative h-28 shrink-0 bg-violet-900/50">
        <img src={game.image || "/placeholder.svg"} alt={`${game.name} preview`} loading="lazy" className="h-full w-full object-cover" />
        <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tagClasses[game.tag]}`}>{game.tag}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h4 className="text-base font-bold leading-snug text-white">{game.name}</h4>
        <p className="text-xs leading-relaxed text-violet-200/75">{getGameBlurb(game, rules[game.id])}</p>
        <p className="mt-auto flex items-center gap-1 pt-2 text-xs text-violet-200/80"><Star className="h-3.5 w-3.5 fill-violet-300/60 text-violet-300/60" aria-hidden="true" /> {game.rating.toFixed(1)}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => onPlay(game)} className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500">{game.native?.cta ?? "Play Now"}</button>
          <button type="button" onClick={() => onShare(game)} aria-label={`Share ${game.name}`} className="flex w-10 items-center justify-center rounded-xl border border-violet-400/30 text-violet-100 hover:bg-violet-800/60">
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

function SectionHeader({ id, icon: Icon, title, count }: { id: string; icon: typeof Flame; title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-violet-400/20 pb-3">
      <h3 id={id} className="flex items-center gap-3 text-xl font-bold text-white">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-900/70"><Icon className="h-5 w-5 text-sky-300" aria-hidden="true" /></span>
        {title}
      </h3>
      <span className="rounded-full border border-violet-400/25 bg-violet-950/70 px-3 py-1 text-xs text-violet-200">{count} games</span>
    </div>
  );
}

type GameActions = { rules: RuleMap; onPlay: (game: HubGame) => void; onShare: (game: HubGame) => void };

const rewardGames = hubGames.filter((game) => game.native);
const hubOnlyGames = hubGames.filter((game) => !game.native);

function RewardGamesSection({ rules, onPlay, onShare }: GameActions) {
  return (
    <section aria-labelledby="gamehub-rewards" className="space-y-3">
      <SectionHeader id="gamehub-rewards" icon={Trophy} title="Play & Win Free Data" count={rewardGames.length} />
      <div className="grid grid-cols-2 gap-3">
        {rewardGames.map((game) => <GameCard key={game.id} game={game} rules={rules} onPlay={onPlay} onShare={onShare} />)}
      </div>
    </section>
  );
}

function GamesTab({ videos, rules, onPlay, onShare }: GameActions & { videos: GameVideo[] }) {
  return (
    <div className="space-y-5">
      <FeaturedCarousel videos={videos} rules={rules} onPlay={onPlay} />
      <RewardGamesSection rules={rules} onPlay={onPlay} onShare={onShare} />
      <IntroCard onBrowse={() => document.getElementById("gamehub-all")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <GamesStrip onPlay={onPlay} />
      <section aria-labelledby="gamehub-hot">
        <SectionHeader id="gamehub-hot" icon={Flame} title="Hot & Popular" count={hotGames.length} />
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {hotGames.map((game) => <GameCard key={game.id} game={game} className="w-44 shrink-0" rules={rules} onPlay={onPlay} onShare={onShare} />)}
        </div>
      </section>
      <section aria-labelledby="gamehub-all">
        <SectionHeader id="gamehub-all" icon={LayoutGrid} title="More Games from Gamehub" count={hubOnlyGames.length} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {hubOnlyGames.map((game) => <GameCard key={game.id} game={game} rules={rules} onPlay={onPlay} onShare={onShare} />)}
        </div>
      </section>
    </div>
  );
}

function VisitGameHubPrompt({ game, onCancel, onContinue }: { game: HubGame; onCancel: () => void; onContinue: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="visit-gamehub-title" className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border border-violet-400/30 bg-[#150a30] p-5 text-white shadow-2xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600"><Gamepad2 className="h-6 w-6" aria-hidden="true" /></span>
        <h3 id="visit-gamehub-title" className="mt-3 text-lg font-bold leading-snug text-balance">Continue gameplay in Gamehub directly</h3>
        <p className="mt-2 text-sm leading-relaxed text-violet-200/85">
          Play {game.name} on Gamehub for the real, uninterrupted gameplay. Tap the button below to go there - you can sign up for free on Gamehub to win free data as well.
        </p>
        <a
          href={getGameHubDirectUrl(game.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white"
        >
          Go to Gamehub <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
        <button type="button" onClick={onContinue} className="mt-2 w-full rounded-xl border border-violet-400/30 px-4 py-3 text-sm font-semibold text-violet-100 hover:bg-violet-800/50">
          Cancel and play here on JustBuy
        </button>
        <button type="button" onClick={onCancel} className="mt-1 w-full px-4 py-2 text-xs text-violet-300/70 hover:text-violet-100">Close</button>
      </div>
    </div>
  );
}

export default function GameHubDialog() {
  const { toast } = useToast();
  const user = useGameHubUser();
  const [open, setOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<HubGame | null>(null);
  const [pendingGame, setPendingGame] = useState<HubGame | null>(null);

  const requestPlay = (game: HubGame) => {
    if (game.native) setActiveGame(game);
    else setPendingGame(game);
  };

  const { data: videos = [] } = useQuery({ queryKey: ["gamehub-videos"], queryFn: fetchGameVideos, enabled: open, staleTime: 60_000 });

  const { data: settings = [] } = useQuery({ queryKey: ["gamehub-rules"], queryFn: fetchGameRewardSettings, enabled: open, staleTime: 15_000, refetchOnWindowFocus: true });
  const rules: RuleMap = Object.fromEntries(settings.map((row) => [row.game_id, row]));

  useGameHubRealtime(user?.id, open);
  const { data: conversations = [] } = useConversations(user?.id, open);
  const unreadCount = conversations.reduce((total, conversation) => total + conversation.unread, 0);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const gameId = (event as CustomEvent<{ gameId?: string } | undefined>).detail?.gameId;
      if (gameId) setActiveGame(findHubGame(gameId) ?? null);
      setOpen(true);
    };
    window.addEventListener(OPEN_GAMEHUB_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_GAMEHUB_EVENT, handleOpen);
  }, []);

  // Direct visits to /gamehub or /gamehub/<game> (and legacy ?gamehub= links) open the popup.
  useEffect(() => {
    const parsed = parseGameHubPath(window.location.pathname);
    if (parsed) {
      markGameHubLanding();
      setOpen(true);
      setActiveGame(parsed.gameId ? findHubGame(parsed.gameId) ?? null : null);
      return;
    }
    const url = new URL(window.location.href);
    const shared = url.searchParams.get("gamehub");
    if (!shared) return;
    setOpen(true);
    setActiveGame(findHubGame(shared) ?? null);
    url.searchParams.delete("gamehub");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  // Browser back/forward moves between the page, the hub and a game.
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseGameHubPath(window.location.pathname);
      if (!parsed) {
        setOpen(false);
        setActiveGame(null);
        setPendingGame(null);
        return;
      }
      setOpen(true);
      setActiveGame(parsed.gameId ? findHubGame(parsed.gameId) ?? null : null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (open) syncGameHubUrl(activeGame?.id ?? null);
  }, [open, activeGame]);

  const handleShare = async (game: HubGame) => {
    try {
      const result = await shareText(`Play ${game.name} on Gamehub`, `Come play ${game.name} with me on Gamehub - skill only, no betting!`, buildGameShareUrl(game.id));
      if (result === "copied") toast({ title: "Link copied", description: "Paste it anywhere to invite a friend." });
    } catch {
      toast({ title: "Could not share", variant: "destructive" });
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setActiveGame(null);
      setPendingGame(null);
      leaveGameHubUrl();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-xl flex-col gap-0 overflow-hidden rounded-none border-violet-400/20 bg-[#0d0620] p-0 text-white sm:h-[90vh] sm:rounded-3xl">
        <div className="border-b border-violet-400/15 px-4 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2 pr-8 text-2xl font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600"><Gamepad2 className="h-5 w-5" aria-hidden="true" /></span>
            <span className="bg-gradient-to-r from-violet-300 to-amber-300 bg-clip-text text-transparent">Gamehub</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-violet-200/70">
            {user ? `Playing as ${maskEmail(user.email)}` : "Sign in to save your scores to the leaderboard."}
          </DialogDescription>
          <div className="mt-3"><VisitGameHubBanner /></div>
        </div>
        <Tabs defaultValue="games" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4 mt-3 grid grid-cols-3 bg-violet-950/80 text-violet-200">
            <TabsTrigger value="games" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"><Gamepad2 className="mr-2 h-4 w-4" aria-hidden="true" /> Games</TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" /> Chat
              {unreadCount > 0 ? <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unreadCount}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"><Puzzle className="mr-2 h-4 w-4" aria-hidden="true" /> Leaderboard</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
            <TabsContent value="games" className="mt-0"><GameHubJoinCard signedIn={Boolean(user)} /><GamesTab videos={videos} rules={rules} onPlay={requestPlay} onShare={handleShare} /></TabsContent>
            <TabsContent value="messages" className="mt-0"><GameHubChat user={user} onPlayGame={requestPlay} /></TabsContent>
            <TabsContent value="leaderboard" className="mt-0"><GameHubLeaderboard /></TabsContent>
          </div>
        </Tabs>
        <GameHubAnnouncements open={open && !activeGame} />
        {activeGame?.native?.bridge === "archery3d" ? (
          <GameHubArcheryPlayer game={activeGame} signedIn={Boolean(user)} rule={settings.find((row) => row.game_id === activeGame.id)} onClose={() => setActiveGame(null)} />
        ) : activeGame?.native ? (
          <GameHubRewardPlayer game={activeGame} signedIn={Boolean(user)} rule={settings.find((row) => row.game_id === activeGame.id)} onClose={() => setActiveGame(null)} />
        ) : activeGame ? (
          <GameHubPlayer game={activeGame} userEmail={user?.email ?? null} signedIn={Boolean(user)} onClose={() => setActiveGame(null)} />
        ) : null}
        {pendingGame ? (
          <VisitGameHubPrompt
            game={pendingGame}
            onCancel={() => setPendingGame(null)}
            onContinue={() => {
              setActiveGame(pendingGame);
              setPendingGame(null);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
