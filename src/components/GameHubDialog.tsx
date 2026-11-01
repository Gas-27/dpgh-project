import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Coins,
  ExternalLink,
  Flame,
  Gamepad2,
  Grid3x3,
  Layers,
  Mountain,
  Play,
  Puzzle,
  Rocket,
  Star,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const OPEN_GAMEHUB_EVENT = "open-gamehub";
const GAMEHUB_URL = "https://gamehubgh.com";

type Game = { name: string; tag: string; blurb: string; rating: number; icon: LucideIcon; gradient: string; tagClass: string };

const games: Game[] = [
  { name: "Connect 4", tag: "Online", blurb: "Invite a friend and play Connect Four live!", rating: 5.0, icon: Users, gradient: "from-sky-500/40 via-blue-700/40 to-indigo-900/60", tagClass: "bg-amber-500 text-amber-950" },
  { name: "Tetris", tag: "Puzzle", blurb: "Stack falling blocks and clear lines!", rating: 4.3, icon: Layers, gradient: "from-fuchsia-500/40 via-purple-700/40 to-violet-900/60", tagClass: "bg-sky-500 text-sky-950" },
  { name: "Helicopter Cave", tag: "Action", blurb: "Navigate your helicopter through caves!", rating: 3.1, icon: Mountain, gradient: "from-orange-500/30 via-stone-700/50 to-stone-900/70", tagClass: "bg-rose-500 text-rose-950" },
  { name: "Asteroids", tag: "Action", blurb: "Blast rocks, dodge debris and survive the field.", rating: 4.6, icon: Rocket, gradient: "from-indigo-500/40 via-violet-800/40 to-slate-900/70", tagClass: "bg-rose-500 text-rose-950" },
  { name: "Laser Dash", tag: "Action", blurb: "Weave through lasers at lightning speed.", rating: 4.4, icon: Zap, gradient: "from-cyan-400/40 via-blue-700/40 to-purple-900/60", tagClass: "bg-rose-500 text-rose-950" },
  { name: "Sliding Puzzle", tag: "Puzzle", blurb: "Slide the tiles into place for the highest score.", rating: 4.7, icon: Grid3x3, gradient: "from-emerald-400/30 via-teal-700/40 to-slate-900/70", tagClass: "bg-sky-500 text-sky-950" },
];

const slides = [
  { label: "Sliding Tiles", title: "Sliding Puzzle", text: "Get the highest score and get real money", icon: Grid3x3, gradient: "from-indigo-600 via-violet-700 to-fuchsia-700" },
  { label: "Online", title: "Connect 4", text: "Invite a friend and play live, one-on-one", icon: Users, gradient: "from-sky-600 via-blue-700 to-indigo-800" },
];

const leaderboardColumns = ["Rank", "Player", "Score"];

function openGameHub() {
  window.open(GAMEHUB_URL, "_blank", "noopener,noreferrer");
}

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

function FeaturedCarousel() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 5000);
    return () => window.clearInterval(timer);
  }, []);
  const slide = slides[index];
  const SlideIcon = slide.icon;

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-violet-400/30 bg-gradient-to-br ${slide.gradient} p-5`}>
      <SlideIcon className="absolute -right-4 -top-4 h-36 w-36 text-white/15" aria-hidden="true" />
      <div className="relative flex min-h-[160px] flex-col justify-end">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">{slide.label}</p>
        <h3 className="mt-1 text-2xl font-bold text-white">{slide.title}</h3>
        <p className="mt-1 max-w-[60%] text-sm leading-relaxed text-white/80">{slide.text}</p>
        <button
          type="button"
          onClick={openGameHub}
          className="absolute bottom-0 right-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white"
        >
          <Play className="h-4 w-4" aria-hidden="true" /> Play now
        </button>
      </div>
      <div className="relative mt-4 flex justify-center gap-2">
        {slides.map((item, dot) => (
          <button
            key={item.title}
            type="button"
            aria-label={`Show ${item.title}`}
            onClick={() => setIndex(dot)}
            className={`h-1.5 rounded-full transition-all ${dot === index ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
          />
        ))}
      </div>
    </div>
  );
}

function IntroCard() {
  const stats = [
    { icon: Gamepad2, value: "30+", label: "Games" },
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
        onClick={openGameHub}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white"
      >
        Browse All Games <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}

function GamesStrip() {
  return (
    <section aria-label="Quick play" className="rounded-3xl border border-violet-400/25 bg-violet-950/60 p-4">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {games.map(({ name, icon: Icon, gradient }) => (
          <button key={name} type="button" onClick={openGameHub} className="flex w-24 shrink-0 flex-col items-center gap-2">
            <span className={`flex h-20 w-24 items-center justify-center rounded-2xl border border-violet-300/20 bg-gradient-to-br ${gradient}`}>
              <Icon className="h-8 w-8 text-white" aria-hidden="true" />
            </span>
            <span className="w-full truncate text-center text-sm font-semibold text-white">{name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TasksRow() {
  return (
    <button
      type="button"
      onClick={openGameHub}
      className="flex w-full items-center justify-between rounded-3xl border border-violet-400/25 bg-violet-950/60 px-5 py-4 text-left"
    >
      <span>
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-fuchsia-300"><Coins className="h-4 w-4" aria-hidden="true" /> Earn coins</span>
        <span className="mt-1 block text-2xl font-bold text-white">Tasks</span>
      </span>
      <ChevronRight className="h-5 w-5 text-violet-200" aria-hidden="true" />
    </button>
  );
}

function HotAndPopular() {
  return (
    <section aria-labelledby="gamehub-hot">
      <div className="flex items-center justify-between gap-3 border-b border-violet-400/20 pb-3">
        <h3 id="gamehub-hot" className="flex items-center gap-3 text-xl font-bold text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-900/70"><Flame className="h-5 w-5 text-sky-300" aria-hidden="true" /></span>
          Hot &amp; Popular
        </h3>
        <span className="rounded-full border border-violet-400/25 bg-violet-950/70 px-3 py-1 text-xs text-violet-200">{games.length} games</span>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {games.map(({ name, tag, blurb, rating, icon: Icon, gradient, tagClass }) => (
          <article key={name} className="flex w-44 shrink-0 flex-col overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-950/70">
            <div className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${gradient}`}>
              <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tagClass}`}>{tag}</span>
              <Icon className="h-10 w-10 text-white/90" aria-hidden="true" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <h4 className="text-base font-bold text-white">{name}</h4>
              <p className="text-xs leading-relaxed text-violet-200/75">{blurb}</p>
              <p className="mt-auto flex items-center gap-1 text-xs text-violet-200/80"><Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden="true" /> {rating.toFixed(1)}</p>
              <button type="button" onClick={openGameHub} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500">Play Now</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GamesTab() {
  return (
    <div className="space-y-4">
      <FeaturedCarousel />
      <IntroCard />
      <GamesStrip />
      <TasksRow />
      <HotAndPopular />
    </div>
  );
}

function LeaderboardTab() {
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-violet-400/25 bg-violet-950/60 p-5">
        <h3 className="flex items-center gap-2 text-xl font-bold text-white"><Trophy className="h-5 w-5 text-amber-300" aria-hidden="true" /> Leaderboard</h3>
        <p className="mt-1 text-sm text-violet-200/75">Top players across every Game Hub game. Climb the ranks to win rewards.</p>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {games.map(({ name }, position) => (
            <span key={name} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${position === 0 ? "bg-violet-600 text-white" : "border border-violet-400/25 text-violet-200"}`}>{name}</span>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-violet-400/25 bg-violet-950/60">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-violet-900/60 text-xs uppercase tracking-wider text-violet-200/80">
              {leaderboardColumns.map((column) => <th key={column} scope="col" className="px-4 py-3 font-semibold">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={leaderboardColumns.length} className="px-4 py-10 text-center text-violet-200/75">
                Live rankings are kept on Game Hub. Open it to see the current top players.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" onClick={openGameHub} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white">
        View live leaderboard <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}

export default function GameHubDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_GAMEHUB_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_GAMEHUB_EVENT, handleOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-xl flex-col gap-0 overflow-hidden rounded-none border-violet-400/20 bg-[#0d0620] p-0 text-white sm:h-[90vh] sm:rounded-3xl">
        <div className="border-b border-violet-400/15 px-4 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2 pr-8 text-2xl font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600"><Gamepad2 className="h-5 w-5" aria-hidden="true" /></span>
            <span className="bg-gradient-to-r from-violet-300 to-amber-300 bg-clip-text text-transparent">Gamehub</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Browse games and the leaderboard, or visit Game Hub directly.</DialogDescription>
          <div className="mt-3"><VisitGameHubBanner /></div>
        </div>
        <Tabs defaultValue="games" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4 mt-3 grid grid-cols-2 bg-violet-950/80 text-violet-200">
            <TabsTrigger value="games" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"><Gamepad2 className="mr-2 h-4 w-4" aria-hidden="true" /> Games</TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"><Puzzle className="mr-2 h-4 w-4" aria-hidden="true" /> Leaderboard</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
            <TabsContent value="games" className="mt-0"><GamesTab /></TabsContent>
            <TabsContent value="leaderboard" className="mt-0"><LeaderboardTab /></TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
