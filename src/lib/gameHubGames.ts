export type GameTag = "Action" | "Strategy" | "Online" | "Puzzle";

export type HubGame = {
  id: string;
  name: string;
  tag: GameTag;
  blurb: string;
  rating: number;
  image: string;
  stripName?: string;
  native?: { src: string; targetLevel: number; timedMinutes?: number; cta?: string };
};

export const tagClasses: Record<GameTag, string> = {
  Action: "bg-rose-500 text-white",
  Strategy: "bg-emerald-500 text-white",
  Online: "bg-amber-500 text-amber-950",
  Puzzle: "bg-indigo-500 text-white",
};

const img = (slug: string) => `/game-previews/${slug}.webp`;

export const hubGames: HubGame[] = [
  { id: "cup-shuffle", name: "Cup Shuffle", tag: "Puzzle", blurb: "Reach level 12 to win free MTN data!", rating: 4.9, image: "/game-previews/cup-shuffle.png", native: { src: "/games/cup-shuffle.html", targetLevel: 12 } },
  { id: "snap-fit", name: "Snap Fit", tag: "Action", blurb: "Reach level 20 to win free MTN data!", rating: 4.9, image: "/game-previews/snap-fit.png", native: { src: "/games/snap-fit.html", targetLevel: 20 } },
  { id: "nail-hit", name: "Nail Hit", tag: "Action", blurb: "Hammer every nail into the spinning log without touching another. Reach stage 12 to win free MTN data!", rating: 4.7, image: "/game-previews/nail-hit.png", native: { src: "/games/nail-hit.html", targetLevel: 12 } },
  { id: "cut-score", name: "Cut & Score", tag: "Action", blurb: "Time your cut and score the perfect shot. Reach level 24 to win free MTN data!", rating: 4.6, image: "/game-previews/cut-score.png", native: { src: "/games/cut-score.html", targetLevel: 24 } },
  { id: "aim-for-it", name: "Aim For It", tag: "Action", blurb: "Master the art of archery and hit bullseyes!", rating: 3.9, image: img("aim-for-it") },
  { id: "timer-challenge", name: "Timer Challenge", tag: "Action", blurb: "Stop the timer at exactly the right moment!", rating: 4.0, image: img("timer-challenge") },
  { id: "snake-game", name: "Snake Game", tag: "Strategy", blurb: "Grow your snake by eating food!", rating: 3.8, image: img("snake-game") },
  { id: "knife-throw", name: "Knife Toss", tag: "Strategy", blurb: "Throw knives at the spinning target!", rating: 3.1, image: img("knife-throw") },
  { id: "connect-four-online", name: "Connect 4", tag: "Online", blurb: "Invite a friend and play Connect Four live!", rating: 3.9, image: img("connect-four-online") },
  { id: "memory-match-online", name: "Memory Match Online", tag: "Online", blurb: "Take turns, keep your lives, last one standing wins!", rating: 4.8, image: img("brain-memory") },
  { id: "piano-tiles-online", name: "Piano Tiles Online", tag: "Online", blurb: "Tap tiles faster than your opponent!", rating: 3.3, image: img("magic-keys") },
  { id: "sliding-tiles-online", name: "Sliding Tiles Online", tag: "Online", blurb: "Solve the puzzle fastest to win!", rating: 3.8, image: img("sliding-puzzle") },
  { id: "rock-paper-scissors-online", name: "Rock Paper Scissors Arena (Online)", tag: "Online", blurb: "Play live against a real opponent in a first-to-target match!", rating: 4.5, image: img("rock-paper-scissors") },
  { id: "triple-tile-match-online", name: "Triple Tile Match (Online)", tag: "Online", blurb: "Race a friend live \u2014 first to the creator-selected level wins!", rating: 3.4, image: img("triple-tile-match") },
  { id: "tennis-online", name: "Tennis Online", tag: "Online", blurb: "Live 1v1 tennis with lives, sets and tournament mode!", rating: 4.1, image: img("tennis-online") },
  { id: "tic-tac-toe-online", name: "Tic-Tac-Toe Online", tag: "Online", blurb: "Play Tic-Tac-Toe online with a friend \u2014 3x3 to 7x7 grids!", rating: 3.4, image: img("tic-tac-toe-online") },
  { id: "tennis", name: "Tennis", tag: "Action", blurb: "Classic tennis against an AI opponent \u2014 serves, rallies, deuce!", rating: 4.6, image: img("tennis") },
  { id: "tic-tac-toe", name: "Tic Tac Toe", tag: "Strategy", blurb: "Classic Tic-Tac-Toe vs CPU \u2014 choose 3x3 to 7x7 grid sizes!", rating: 4.8, image: img("tic-tac-toe") },
  { id: "snake-war", name: "Snake War", tag: "Strategy", blurb: "Slither and grow \u2014 eat food and outsmart opponents!", rating: 3.4, image: img("snake-war") },
  { id: "snake-war-online", name: "Snake War Online", tag: "Online", blurb: "Multiplayer Snake War \u2014 create a room, invite friends, and battle up to 30 players with a countdown timer!", rating: 4.4, image: img("snake-war-online") },
  { id: "endless-runner", name: "Endless Runner", tag: "Action", blurb: "Run, jump and slide through endless worlds while a chaser hunts you down. Buy lives with your wallet coins!", rating: 4.2, image: img("endless-runner") },
  { id: "endless-runner-online", name: "Endless Runner Online", tag: "Online", blurb: "Race friends on the same track with one shared chaser. The last runner standing wins!", rating: 4.8, image: img("endless-runner") },
  { id: "checkers", name: "Checkers", tag: "Strategy", blurb: "Classic checkers (draughts) against a smart AI opponent!", rating: 3.9, image: img("checkers") },
  { id: "checkers-online", name: "Checkers Online", tag: "Online", blurb: "Play checkers live against a real opponent \u2014 invite with a room code!", rating: 4.6, image: img("checkers") },
  { id: "wordscapes", name: "Wordscapes", tag: "Puzzle", blurb: "Swipe letters to build words and fill the crossword grid in each level!", rating: 4.2, image: img("wordscapes") },
  { id: "wordscapes-online", name: "Wordscapes Online", tag: "Online", blurb: "Race a friend to find all the words first \u2014 live multiplayer word puzzle!", rating: 3.6, image: img("wordscapes") },
  { id: "three-mens-morris", name: "Align 3", tag: "Strategy", blurb: "Place 3 pieces then slide them to get three in a row!", rating: 4.4, image: img("three-mens-morris") },
  { id: "three-mens-morris-online", name: "Align 3 (Online)", tag: "Online", blurb: "Challenge a friend online \u2014 place and slide pieces to align three in a row!", rating: 3.2, image: img("three-mens-morris") },
  { id: "ludo", name: "Ludo", tag: "Strategy", blurb: "Classic Ludo for 2-6 players \u2014 vs the computer or pass and play on one phone, with customizable rules!", rating: 3.8, image: img("ludo") },
  { id: "ludo-online", name: "Ludo Online", tag: "Online", blurb: "Create a room code and play Ludo online with 2, 3, 4, 5 or 6 friends!", rating: 4.3, image: img("ludo") },
  { id: "basketball", name: "Basketball", tag: "Action", blurb: "Play 10 minutes without missing a shot to win free MTN data.", rating: 4.5, image: img("basketball"), native: { src: "/games/basketball.html", targetLevel: 1, timedMinutes: 10, cta: "Win free data" } },
  { id: "basketball-online", name: "Basketball (Online)", tag: "Online", blurb: "Share a code and out-shoot a friend online in a timed basketball duel!", rating: 3.9, image: img("basketball") },
  { id: "brain-memory", name: "Memory Match Pro", tag: "Puzzle", blurb: "Test your memory by matching pairs!", rating: 4.1, image: img("brain-memory") },
  { id: "candy-crush", name: "Candy Match Saga", tag: "Puzzle", blurb: "Match colorful candies in this sweet puzzle!", rating: 4.0, image: img("candy-crush") },
  { id: "connect", name: "Connect Four", tag: "Puzzle", blurb: "Connect four in a row to win!", rating: 4.8, image: img("connect") },
  { id: "magic-keys", name: "Magic Keys", tag: "Puzzle", blurb: "Tap the piano keys and play the melody!", rating: 4.6, image: img("magic-keys") },
  { id: "sliding-puzzle", name: "Sliding Puzzle", tag: "Puzzle", blurb: "Slide tiles to complete the picture!", rating: 4.5, image: img("sliding-puzzle") },
  { id: "word-puzzle", name: "Word Search Pro", tag: "Puzzle", blurb: "Find hidden words in the puzzle grid!", rating: 3.7, image: img("word-puzzle") },
  { id: "tetris", name: "Tetris", tag: "Puzzle", blurb: "Stack falling blocks and clear lines!", rating: 4.5, image: img("tetris") },
  { id: "emoji-math", name: "Emoji Math", tag: "Puzzle", blurb: "Solve emoji equations and test your math skills!", rating: 3.8, image: img("emoji-math") },
  { id: "rock-paper-scissors", name: "Rock Paper Scissors Arena", tag: "Strategy", blurb: "Choose your move, build a streak, and beat the CPU!", rating: 4.1, image: img("rock-paper-scissors") },
  { id: "triple-tile-match", name: "Triple Tile Match", tag: "Puzzle", blurb: "Clear animal tiles in groups of three across hundreds of levels!", rating: 3.8, image: img("triple-tile-match") },
  { id: "water-sort-puzzle", name: "Water Sort Puzzle", tag: "Puzzle", blurb: "Sort colorful liquids into matching tubes and beat your best score!", rating: 3.2, image: img("water-sort-puzzle") },
  { id: "asteroid-blast", name: "Asteroid Blast", tag: "Action", blurb: "Destroy asteroids in deep space!", rating: 3.8, image: img("asteroid-blast"), stripName: "Asteroid Blaster" },
  { id: "helicopter-cave", name: "Helicopter Cave", tag: "Action", blurb: "Navigate your helicopter through caves!", rating: 3.6, image: img("helicopter-cave"), stripName: "Cave Chopper" },
  { id: "laser-dash", name: "Laser Dash", tag: "Action", blurb: "Dodge lasers in this neon runner!", rating: 3.1, image: img("laser-dash") },
  { id: "maze-runner-extreme", name: "Maze Runner", tag: "Action", blurb: "Find your way through the maze!", rating: 4.2, image: img("maze-runner-extreme") },
  { id: "paddle-game", name: "Paddle Game", tag: "Action", blurb: "Keep the ball bouncing with your paddle!", rating: 4.1, image: img("paddle-game"), stripName: "Paddle Bounce" },
  { id: "space-invaders", name: "Space Invaders", tag: "Action", blurb: "Defend Earth from alien invaders!", rating: 3.3, image: img("space-invaders") },
  { id: "speed-racer", name: "Speed Racer", tag: "Action", blurb: "Race at high speeds and avoid crashes!", rating: 4.5, image: img("speed-racer") },
];

const byId = (ids: string[]) => ids.map((id) => hubGames.find((game) => game.id === id)).filter((game): game is HubGame => Boolean(game));

export const stripGames = byId(["asteroid-blast", "helicopter-cave", "laser-dash", "maze-runner-extreme", "paddle-game", "space-invaders", "speed-racer", "tetris"]);

export const hotGames = byId([
  "connect-four-online",
  "tetris",
  "helicopter-cave",
  "sliding-puzzle",
  "snake-war-online",
  "ludo-online",
  "basketball",
  "endless-runner",
  "tic-tac-toe",
  "candy-crush",
]);

const GAME_SITE = "https://www.gamehubgh.com";
export const GAME_HUB_SITE = GAME_SITE;

const gamePages: Record<string, string> = {
  "aim-for-it": "aim-for-it",
  "timer-challenge": "timer-challenge",
  "snake-game": "snake-game",
  "knife-throw": "Knife Throw Challenge",
  "connect-four-online": "connect-four-online",
  "memory-match-online": "memory-match-online",
  "piano-tiles-online": "piano-tiles-online",
  "sliding-tiles-online": "sliding-tiles-online",
  "rock-paper-scissors-online": "rock-paper-scissors-online",
  "triple-tile-match-online": "triple-tile-match-online",
  "tennis-online": "tennis-online",
  "tic-tac-toe-online": "tic-tac-toe-online",
  "tennis": "tennis",
  "tic-tac-toe": "tic-tac-toe",
  "snake-war": "snake-war",
  "snake-war-online": "snake-war-online",
  "endless-runner": "endless-runner",
  "endless-runner-online": "endless-runner-online",
  "checkers": "checkers",
  "checkers-online": "checkers-online",
  "wordscapes": "wordscapes",
  "wordscapes-online": "wordscapes-online",
  "three-mens-morris": "three-mens-morris",
  "three-mens-morris-online": "three-mens-morris-online",
  "ludo": "ludo",
  "ludo-online": "ludo-online",
  "basketball": "basketball",
  "basketball-online": "basketball-online",
  "brain-memory": "Brain-Memory",
  "candy-crush": "candy-crush",
  "connect": "Connect",
  "magic-keys": "magic-keys",
  "sliding-puzzle": "sliding-puzzle",
  "word-puzzle": "WORD PUZZEL",
  "tetris": "Tetris - GameHub",
  "emoji-math": "emoji-math",
  "rock-paper-scissors": "rock-paper-scissors",
  "triple-tile-match": "triple-tile-match",
  "water-sort-puzzle": "water-sort-puzzle",
  "asteroid-blast": "asteroid-blast",
  "helicopter-cave": "helicopter-cave",
  "laser-dash": "laser-dash",
  "maze-runner-extreme": "maze-runner-extreme",
  "paddle-game": "paddle-game",
  "space-invaders": "space-invaders",
  "speed-racer": "speed-racer",
};

export function getGameUrl(gameId: string): string {
  const native = hubGames.find((game) => game.id === gameId)?.native;
  if (native) return native.src;
  const page = gamePages[gameId];
  return page ? `${GAME_SITE}/games/${encodeURIComponent(page)}` : GAME_SITE;
}

export type GameRuleSummary = {
  reward_gb: number;
  enabled: boolean;
  target_level: number | null;
  required_seconds: number | null;
};

const formatGb = (gb: number) => (Number.isInteger(gb) ? String(gb) : String(Number(gb.toFixed(2))));

/** Card text that always matches the rules the admin has currently set for a reward game. */
export function getGameBlurb(game: HubGame, rule?: GameRuleSummary | null): string {
  if (!game.native || !rule) return game.blurb;
  if (!rule.enabled) return `${game.name} rewards are paused right now. You can still play for fun.`;
  const reward = `free MTN ${formatGb(rule.reward_gb)}GB data`;
  if (rule.required_seconds) {
    const minutes = rule.required_seconds / 60;
    const label = Number.isInteger(minutes) ? `${minutes} minute${minutes === 1 ? "" : "s"}` : `${rule.required_seconds} seconds`;
    return `Play ${label} without missing a shot to win ${reward}.`;
  }
  const target = rule.target_level ?? game.native.targetLevel;
  return game.blurb.replace(/\b(level|stage) \d+/i, `$1 ${target}`).replace(/free MTN data/i, reward);
}

export function findHubGame(gameId: string | null | undefined): HubGame | undefined {
  return hubGames.find((game) => game.id === gameId);
}
