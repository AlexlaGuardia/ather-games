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
    id: "ward",
    title: "Ward",
    href: "/ward",
    glyph: "△",
    tier: "live",
    kind: "play",
    tagline: "the void rains on the spires · bloom Ather to hold the line — a vector defense",
  },
  {
    id: "updraft",
    title: "Updraft",
    href: "/updraft",
    glyph: "➶",
    tier: "live",
    kind: "play",
    tagline: "a spark of Ather rides the rising light · one tap to climb, mind the void — endless flight",
  },
  {
    id: "seedfall",
    title: "Seedfall",
    href: "/seedfall",
    glyph: "❀",
    tier: "live",
    kind: "play",
    tagline: "guide a Mana Seed down the wind · land it soft to plant — a cozy descent",
  },
  {
    id: "voranyx",
    title: "Voranyx",
    href: "/voranyx",
    glyph: "⌇",
    tier: "live",
    kind: "play",
    tagline: "a worm of Ather-light in the Silt · eat, grow, boost, don't crash — a glowing slither",
  },
  {
    id: "lucernyx",
    title: "Lucernyx",
    href: "/lucernyx",
    glyph: "♦",
    tier: "live",
    kind: "play",
    tagline: "rekindle the grey, don't slay it · jump to convert, light 3 torches — a board of light",
  },
  {
    id: "gravitar",
    title: "Gravitar",
    href: "/gravitar",
    glyph: "⊙",
    tier: "back-room",
    kind: "play",
    tagline: "round the gravity wells, gather the cores · turn + thrust, mind the rocks — a physics-orbit run",
  },
  {
    id: "atherdash",
    title: "Atherdash",
    href: "/atherdash",
    glyph: "⫸",
    tier: "live",
    kind: "play",
    tagline: "dash the elemental lanes ahead of the Dying · read the gate, swap in time — a lane-runner",
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
    tier: "live",
    kind: "world",
    tagline: "the Athernyx franchise — the world, the lore, the spirit tales",
  },
  {
    id: "nolmir",
    title: "Nolmir",
    href: "/nolmir",
    glyph: "◈",
    tier: "live",
    kind: "play",
    tagline: "hold the breach · forge the core — an idle Athernyx story",
  },
];

/** Games the public arcade lists — everything except back-room (owner-only, unlisted). */
export const publicGames = (): GameEntry[] => GAMES.filter((g) => g.tier !== "back-room");
/** Live games only, in registry order — the playable/enterable set used for favorites + defaults. */
export const liveGames = (): GameEntry[] => GAMES.filter((g) => g.tier === "live");
export const gameById = (id: string): GameEntry | undefined => GAMES.find((g) => g.id === id);
export const isBackRoom = (id: string): boolean => gameById(id)?.tier === "back-room";

/** Corner badge for a card: SOON for teasers, ENTER for lore/world surfaces, PLAY for games. */
export const tierLabel = (g: GameEntry): string =>
  g.tier === "coming-soon" ? "SOON" : g.kind === "world" ? "ENTER" : "PLAY";
