import { Link } from "react-router-dom";
import { Gamepad2, Gift, Trophy, Smartphone, ArrowRight, UserCheck } from "lucide-react";
import SeoPageLayout from "@/components/SeoPageLayout";
import { Button } from "@/components/ui/button";
import { hubGames, tagClasses } from "@/lib/gameHubGames";
import { openGameHubIfAvailable } from "@/lib/tabControls";

const rewardGames = hubGames.filter((game) => game.native);
const moreGames = hubGames.filter((game) => !game.native).slice(0, 12);

const faqs = [
  { question: "Can I play games on JustBuyGH without signing up?", answer: "Yes. You can open GameHub and start playing straight away without creating an account. An account is only needed if you want your free data rewards and progress saved." },
  { question: "How do I win free MTN data by playing games?", answer: "Pick a reward game such as Cup Shuffle, Snap Fit, Nail Hit, Cut & Score or Basketball, then reach the target level shown on the game. Hit the target and the free data reward is credited to your account." },
  { question: "What happens when I lose or get a game over?", answer: "For games hosted on gamehubgh.com, a Continue on GameHub prompt appears right after a game over so you can carry on playing directly on gamehubgh.com for a smoother experience. Reward games on JustBuyGH stay on JustBuyGH." },
  { question: "Are the games free to play in Ghana?", answer: "Yes. Every game on GameHub is free to play. Some reward games let you keep going with lives, and sponsored product ads may show between rounds." },
  { question: "Which games can I play online with friends?", answer: "GameHub has online multiplayer games including Ludo Online, Connect 4, Tic-Tac-Toe Online, Checkers Online, Tennis Online, Snake War Online and Basketball Online. Create a room code and invite a friend." },
  { question: "Do the games work on mobile data and low-end phones?", answer: "Yes. Games run in your browser, load quickly and work on any modern Android or iPhone, so there is nothing to install." },
];

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "GameHub Ghana",
  "url": "https://gamehubgh.com",
  "applicationCategory": "GameApplication",
  "operatingSystem": "Any",
  "description": "Free online games in Ghana with rewards: win free MTN data, play Ludo, Tetris, Connect 4 and more with no sign-up needed to play.",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "GHS" },
  "areaServed": "GH",
};

export default function GamesGhana() {
  return (
    <SeoPageLayout
      title="Play Free Online Games in Ghana & Win Free MTN Data | GameHub"
      description="Play 40+ free online games in Ghana with no sign-up needed to play. Reach the target level to win free MTN data, then continue on gamehubgh.com after a game over."
      canonicalPath="/games"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Games" },
      ]}
      headline="Free Online Games in Ghana: Play and Win Free MTN Data"
      subheadline="Play Cup Shuffle, Snap Fit, Nail Hit, Basketball, Ludo and 40+ more games for free. No sign-up needed to play, and reward games can win you free data."
      faqs={faqs}
      schemas={[webAppSchema]}
    >
      <section aria-labelledby="games-cta-heading" className="text-center space-y-4">
        <h2 id="games-cta-heading" className="font-display text-2xl font-bold text-foreground">
          Jump into GameHub
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="hero" size="lg" onClick={() => void openGameHubIfAvailable()}>
            <Gamepad2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Play games now
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a href="https://gamehubgh.com" target="_blank" rel="noopener noreferrer">
              Open gamehubgh.com
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </section>

      <section aria-labelledby="reward-games-heading">
        <h2 id="reward-games-heading" className="font-display text-2xl font-bold text-foreground mb-2">
          Reward Games: Win Free MTN Data
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          These games are built into JustBuyGH. Reach the target level in each one and your free data reward is credited to your account.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewardGames.map((game) => (
            <li key={game.id} className="glass rounded-xl border border-border overflow-hidden">
              <img src={game.image} alt={`${game.name} game preview`} loading="lazy" className="aspect-video w-full object-cover" />
              <div className="p-4 space-y-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tagClasses[game.tag]}`}>{game.tag}</span>
                <h3 className="font-display text-base font-semibold text-foreground">{game.name}</h3>
                <p className="text-sm text-muted-foreground">{game.blurb}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          How GameHub Works
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: UserCheck, title: "No sign-up to play", body: "Open any game and start playing instantly. Sign in only to save rewards." },
            { icon: Trophy, title: "Hit the target level", body: "Each reward game shows the level you need to reach to win." },
            { icon: Gift, title: "Win free MTN data", body: "Reach the target and the data reward is added to your account." },
            { icon: Smartphone, title: "Continue on GameHub", body: "After a game over on gamehubgh.com games, keep playing right there." },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="glass rounded-xl border border-border p-4 space-y-2">
              <div className="inline-flex rounded-lg bg-primary/10 p-2" aria-hidden="true">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="more-games-heading">
        <h2 id="more-games-heading" className="font-display text-2xl font-bold text-foreground mb-6">
          More Free Games to Play
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {moreGames.map((game) => (
            <li key={game.id} className="glass rounded-xl border border-border overflow-hidden">
              <img src={game.image} alt={`${game.name} game preview`} loading="lazy" className="aspect-square w-full object-cover" />
              <div className="p-3">
                <h3 className="text-sm font-semibold text-foreground truncate">{game.name}</h3>
                <p className="text-xs text-muted-foreground">{game.tag}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-xl border border-border p-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">Related Services</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { to: "/packages", label: "Buy Cheap Data Bundles" },
            { to: "/mtn-data-bundles", label: "MTN Data Bundles Ghana" },
            { to: "/airtime-top-up-ghana", label: "Airtime Top Up Ghana" },
            { to: "/premium-subscription", label: "Premium Subscription" },
          ].map(({ to, label }) => (
            <Link key={to} to={to} className="flex items-center gap-2 text-sm text-primary hover:underline">
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </SeoPageLayout>
  );
}
