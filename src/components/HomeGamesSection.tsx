import { Link } from "react-router-dom";
import { ArrowRight, Gamepad2, Gift, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hubGames, tagClasses } from "@/lib/gameHubGames";
import { openGameHubIfAvailable } from "@/lib/tabControls";

const featuredIds = ["cup-shuffle", "snap-fit", "nail-hit", "cut-score", "basketball", "ludo-online"];
const featured = featuredIds
  .map((id) => hubGames.find((game) => game.id === id))
  .filter((game): game is NonNullable<typeof game> => Boolean(game));

export default function HomeGamesSection() {
  return (
    <section id="games" aria-labelledby="home-games-heading" className="container max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" />
            GameHub
          </p>
          <h2 id="home-games-heading" className="mt-3 font-display text-2xl md:text-3xl font-bold text-foreground text-balance">
            Play free games. Win free MTN data.
          </h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-xl text-pretty leading-relaxed">
            Over 40 games in one place, with no sign-up needed to play. Reach the target level in our reward games and
            win free data, then keep playing the full library on gamehubgh.com.
          </p>
        </div>
        <Button variant="hero" size="lg" onClick={() => void openGameHubIfAvailable()} className="shrink-0">
          <Gift className="mr-2 h-4 w-4" aria-hidden="true" />
          Play games now
        </Button>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {featured.map((game) => (
          <li key={game.id}>
            <button
              type="button"
              onClick={() => void openGameHubIfAvailable()}
              className="group block w-full overflow-hidden rounded-xl border border-border glass text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Play ${game.name}`}
            >
              <div className="relative aspect-square overflow-hidden bg-secondary">
                <img
                  src={game.image}
                  alt={`${game.name} game preview`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tagClasses[game.tag]}`}>
                  {game.tag}
                </span>
              </div>
              <div className="p-2.5">
                <h3 className="truncate text-sm font-semibold text-foreground">{game.name}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-primary text-primary" aria-hidden="true" />
                  {game.rating.toFixed(1)}
                  {game.native ? <span className="ml-1 text-primary">Win data</span> : null}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 text-center">
        <Link to="/games" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Learn how GameHub rewards work
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
