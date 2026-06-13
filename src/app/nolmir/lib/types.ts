// NOLMIR — core data model.
// A crucible is a DOCUMENT and a match is a deterministic sim between documents.
// The sim never knows whether a human or AI authored the enemy side — this is
// the multiplayer-shaped seam (see CANON/game/nolmir.md).
//
// A crucible has TWO floors (the Pyramid Zero structure):
//   ARENA — teams of 3 spawn at gates, the portal is sealed, they thin each
//           other out. Last team standing ascends.
//   GAUNTLET — the host's guard hall. Survivors fight the defenses for the vault.

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  GATE: 2, // arena: team spawns · gauntlet: where the ascended arrive
  VAULT: 3, // gauntlet only — the prize, reaching it = challenger victory
  PORTAL: 4, // arena only — the red hex: sealed until one team stands
} as const
export type TileId = (typeof TILE)[keyof typeof TILE]

export type PieceKind = 'spike' | 'guard' | 'watcher'

export interface Piece {
  kind: PieceKind
  x: number
  y: number
}

export interface FloorDoc {
  w: number
  h: number
  tiles: number[] // w*h, row-major
  pieces: Piece[]
}

export interface CrucibleDoc {
  id: string
  name: string
  arena: FloorDoc
  // mid floors between arena and gauntlet (host lv3+ structure). Floors chain
  // arena -> mids -> gauntlet; every portal is OPEN except the one whose next
  // room holds the vault (canon: multi-floor crucibles, 2026-06-10).
  mids?: FloorDoc[]
  gauntlet: FloorDoc
}

// Up to 4 teams per match (the FPS Crucible structure: teams of 3,
// "only the last team standing may proceed"). Colors match Alex's sketch.
export const TEAM_COLORS = ['#facc15', '#38bdf8', '#4ade80', '#c084fc'] as const
export const TEAM_NAMES = ['Gold', 'Azure', 'Verdant', 'Violet'] as const

export type FighterKind = 'melee' | 'shooter'

export interface Fighter {
  id: number
  team: number
  kind: FighterKind
  // the trinity — every challenger team fields lead/tank/healer.
  // the lead is the cohesion anchor; the team breaks when they fall.
  role?: 'lead' | 'tank' | 'healer'
  profileId?: string // which shared creature this challenger embodies (slice 5)
  x: number
  y: number
  hp: number
  maxHp: number
  atk: number
  range: number // 1 for melee; shooters reach further with line of sight
  speed: number // tiles per tick — a smooth rate, not a step counter
  alive: boolean
  move: number // movement accumulator — steps when it crosses 1
  floor: number // which floor of the chain this fighter stands on
  spawnDist: number // gradient distance at entry to the current floor
  stuck: number // ticks without a step — past a threshold, twitch randomly
  // progress toward the prize, 0..1 across the WHOLE floor chain — drives yield
  depth: number
}

export interface GuardState {
  floor: number
  x: number
  y: number
  homeX: number // post to return to when no prey in range
  homeY: number
  hp: number
  maxHp: number
  atk: number
  alive: boolean
  watcher?: boolean // stationary ranged construct — holds a sightline
  cooldown?: number // watcher fire cooldown (ticks)
  champion?: string // sigil champion's name — rendered amber, slightly grand
  // facing vector — set by the last step or strike; movement is cardinal,
  // but aim rotates free (the sprite is drawn up-facing and rotated)
  fx?: number
  fy?: number
}

export interface TrapState {
  floor: number
  x: number
  y: number
  cooldown: number // ticks until it can fire again
}

// A fired shot, kept briefly so the terrarium can draw the tracer.
export interface Shot {
  floor: number
  x0: number
  y0: number
  x1: number
  y1: number
  team: number // -1 = a guard's shot (future)
  at: number // tick fired
  heal?: boolean // a healer's mend — drawn green, not in team color
}

// Starforge upgrades reach into the sim through these multipliers.
export interface MatchMods {
  guardHpMult: number
  spikeDmgMult: number
  yieldMult: number
  // highest roster tier the beacon can draw (host progress) — default 1
  rosterTier?: number
  heat?: number // forge heat — drives challenger level (slice 5; off by default)
  // the host's three sigil champions — spawned flanking the vault.
  // (Canon: the Three Puppet Guards of Pyramid Zero are this convention,
  // eons later. Every host fields three.)
  champions?: { name: string; hp: number; atk: number }[]
}

export interface MatchResult {
  seed: number
  victory: boolean // a team reached the vault
  winnerTeam: number | null
  deepestTeam: number
  reachedGauntlet: boolean
  fallen: number
  deepest: number // 0..1
  manaYield: number
  ticks: number
  teamNames?: string[] // roster names by team index
}

export interface LedgerEntry extends MatchResult {
  at: number // wall-clock ms when recorded
  teamName: string
  omen?: boolean // past the heat ceiling, rarely, no one comes. never explained.
}

export interface HostState {
  mana: number
  exp: number
  marks?: number // expedition spoils — the workshop's coin, and a sigil feed
  ledger: LedgerEntry[]
  // when the host last held the watch — away matches accrue hourly past this
  lastSeenAt?: number
}
