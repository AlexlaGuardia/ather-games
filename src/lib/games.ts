// ather.games — central games registry. One flag flips a game's public state.
//   live        → public, listed in the arcade, playable (localStorage saves).
//   coming-soon → public sees a dimmed teaser card; owner plays the real thing.
//   back-room   → owner-only, NOT listed publicly at all. Held for a different
//                 future (e.g. a mobile launch). The public never sees it.

export type GameTier = "live" | "coming-soon" | "back-room";

export interface GameEntry {
  id: string;
  title: string;
  href: string;
  glyph: string;
  tagline: string;
  tier: GameTier;
  kind: "play" | "world";
}

export const GAMES: GameEntry[] = [
  {
    id: "manana",
    title: "Mana'nana",
    href: "/manana",
    glyph: "✿",
    tier: "live",
    kind: "play",
    tagline: "match three mana · cascades pay more — a sweet little puzzle",
  },
  {
    id: "rekindle",
    title: "Rekindle",
    href: "/rekindle",
    glyph: "⎔",
    tier: "live",
    kind: "play",
    tagline: "route the Ather · relight the dark machines — a cozy conduit puzzle",
  },
  {
    id: "shimmer",
    title: "Shimmer",
    href: "/shimmer",
    glyph: "❈",
    tier: "coming-soon",
    kind: "play",
    tagline: "a sandbox of discovery — wild spirits bond through trust, not capture",
  },
  {
    id: "magii",
    title: "Magii",
    href: "/magii",
    glyph: "❖",
    tier: "coming-soon",
    kind: "world",
    tagline: "the Athernyx franchise — the world, the lore, the spirit tales",
  },
  {
    id: "nolmir",
    title: "Nolmir",
    href: "/nolmir",
    glyph: "◈",
    tier: "back-room",
    kind: "play",
    tagline: "hold the breach · forge the core — an idle Athernyx story (held for mobile)",
  },
];

/** Games the public arcade lists — everything except back-room (owner-only, unlisted). */
export const publicGames = (): GameEntry[] => GAMES.filter((g) => g.tier !== "back-room");
export const gameById = (id: string): GameEntry | undefined => GAMES.find((g) => g.id === id);
export const isBackRoom = (id: string): boolean => gameById(id)?.tier === "back-room";
