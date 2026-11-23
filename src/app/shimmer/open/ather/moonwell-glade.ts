// ── MOONWELL GLADE, the Wilds' front door (BETA M30; canon RULED 11-18, athernyx 44bc0c1) ─────────────────────────────
// Alex 11-19: "put the moonwell folk at the wilds start too this will give us somewhere to test once we start working on
// the moglin relationship mechanics". Canon: the Glade sits at the Wilds' edge, passed on every trip out; Gregory lives
// there (not on the keeper's plot) and sells plot ground at his door; the five Moonwell folk (characters/moonwell-folk.md)
// are the FIRST SETTLEMENT a keeper meets. So the Glade is a FIXED settlement (never re-rolled by the season) in the same
// system the generated ones use (settlement-folk.ts): drawn as the chibi, E talks, trust by bringing their wants.
//   · everything is laid out around play's MOONWELL (moonwell.ts, the pool): move that one constant and the Glade follows.
//   · the five do not leave with a keeper (hub 11-19: block recruiting here for now; the test bed must not empty itself).
//   · Fennel stands at the keeper's Rinnshop while the first-rinstick quest is open (fennel.tsx), so the Glade hides her then.
// Pure; moonwell-glade.test.ts.
import { MOONWELL, GLADE_GREEN, shoreToward } from './moonwell'
import type { Settlement } from './network'
import type { Folk } from './settlement-folk'
import { DREAMS } from './folk-lines'
import { loadQuest } from './rinsticks'
import { loadWorks, raised } from './rooms'

export const GLADE_ID = 'moonwell'
export const GLADE_NAME = 'Moonwell Glade'
/** The Glade as a settlement: centred on the GREEN (M40 layout B). Meadow ground (canon: "the tended heart"). */
export const GLADE: Settlement = { id: GLADE_ID, name: GLADE_NAME, x: GLADE_GREEN.x, z: GLADE_GREEN.z, biome: 'meadow' }

/** Canon's own trade words, for player copy (the profession enum is ours; hub 11-19). */
export const GLADE_TRADE: Readonly<Record<string, string>> = { hazel: 'carpenter', sax: 'stonemason', yarrow: 'bait-maker', fennel: 'cook', mallow: 'shopkeeper' }

/** Mallow's list CHANGES (canon); the cadence and what is on it are Jin's: one pick a week from this pool. */
export const MALLOW_POOL: readonly { id: string; n: number }[] = [
  { id: 'mast', n: 6 }, { id: 'goldwood_log', n: 6 }, { id: 'blankstone', n: 4 }, { id: 'shimmerscale', n: 3 }, { id: 'raw_mana_shard', n: 3 }, { id: 'goldwood_bark', n: 4 },
]
const WEEK = 7 * 86_400_000
export const mallowWants = (now = Date.now()) => [MALLOW_POOL[Math.floor(now / WEEK) % MALLOW_POOL.length]]

/** The five (canon names + trades; grades, dreams and want quantities are Jin's/lark's). Grades are Moonwell's own:
 *  settled masters, so steadier than a fresh settlement's roll. */
export function gladeFolk(now = Date.now()): Folk[] {
  const f = (k: string, name: string, profession: Folk['profession'], wants: Folk['wants'], dream: string, g: [number, number, number]): Folk => ({
    id: `${GLADE_ID}:${k}`, name, home: GLADE_ID, profession, employed: true, wants, dream,
    grades: { craft: g[0] as 1, yield: g[1] as 1, trade: g[2] as 1 },
  })
  const away = gladeAway()
  return [
    f('hazel', 'Hazel', 'carpenter', [{ id: 'goldwood_plank', n: 6 }, { id: 'amber_sap', n: 2 }], DREAMS.carpenter[0], [4, 3, 3]),
    f('sax', 'Sax', 'stonemason', [{ id: 'blankstone', n: 6 }, { id: 'raw_mana_shard', n: 2 }], DREAMS.stonemason[0], [3, 4, 2]),
    // re-ruled 11-21: the Rinnshop's bait-maker (wants = bait makings, lark's 'Scraps, meal, Mast'; the quantities are Jin's)
    f('yarrow', 'Yarrow', 'rinnshop', [{ id: 'mast', n: 6 }, { id: 'shimmerscale', n: 2 }], DREAMS.rinnshop[0], [4, 2, 4]),
    f('fennel', 'Fennel', 'cook', [{ id: 'shimmerscale', n: 3 }, { id: 'mast', n: 4 }], DREAMS.cook[0], [3, 3, 3]),
    f('mallow', 'Mallow', 'shopkeeper', mallowWants(now), MALLOW_DREAM, [2, 3, 5]),
  ].filter(x => !away.has(x.id))
}
/** @lark line, SIGNED by Alex 11-19: Mallow has no DREAMS pool (a shopkeeper is not a village trade). */
export const MALLOW_DREAM = 'What does the world want today? Ask me again tomorrow. It will be something else.'
/** @lark line, SIGNED by Alex 11-19: a Moonwell Moglin asked to come to a keeper's garden. */
export const GLADE_STAYS = 'This is my home. Greg kept it when everything else was lost. But come back often.'

/** Who is away from the Glade right now: Fennel, while the first-rinstick quest has her at the keeper's Rinnshop
 *  (rinquest: state 'active', the same test as fennelHere) AND a raised Rinnshop stands for her to stand at (fennel.tsx ›
 *  fennelSpot; M68 s3b, hub #16510: a tutorial keeper's quest starts in the Glade, before any Rinnshop). Read at the call. */
export function gladeAway(): Set<string> {
  try { return loadQuest().state === 'active' && loadWorks().rooms.some(r => r.kind === 'rinnshop' && raised(r)) ? new Set([`${GLADE_ID}:fennel`]) : new Set() } catch { return new Set() }
}

// ── M40 LAYOUT B 'THE GREEN' (Alex 11-19, docs/looks/moonwell-glade.html; mock scale 0.25 m a pixel). Metres from the
// green's centre (GLADE_GREEN). The five's LOTS stand in a horseshoe round the green, each a level pad (relief.ts levels the
// whole Glade) with its station at the back and its Moglin at the front, all turned to face the green. Fennel's kitchen is
// the head (north); clockwise Hazel, Sax, Yarrow, Mallow; the waymark sits at the open south end. Placement is Jin's.
export interface GladeLot { id: string; dx: number; dz: number; w: number; d: number }
export const LOT_W = 13.5, LOT_D = 8.5
export const GLADE_LOTS: readonly GladeLot[] = [
  { id: 'fennel', dx: 0, dz: -25.25, w: LOT_W, d: LOT_D },
  { id: 'hazel', dx: 19.25, dz: -15.75, w: LOT_W, d: LOT_D },
  { id: 'sax', dx: 21, dz: 1.75, w: LOT_W, d: LOT_D },
  { id: 'yarrow', dx: 15.5, dz: 19.75, w: LOT_W, d: LOT_D },
  { id: 'mallow', dx: -14.5, dz: 21.25, w: LOT_W, d: LOT_D },
]
/** a lot in world coords: its centre, and `yaw` turned so its FRONT (local -z) faces the green */
export function lotAt(id: string): { id: string; x: number; z: number; yaw: number; w: number; d: number } | null {
  const l = GLADE_LOTS.find(q => q.id === id); if (!l) return null
  const x = GLADE_GREEN.x + l.dx, z = GLADE_GREEN.z + l.dz
  return { id, x, z, yaw: Math.atan2(x - GLADE_GREEN.x, z - GLADE_GREEN.z), w: l.w, d: l.d }
}
/** a point on a lot, in the lot's own frame: `ahead` m toward the green from its centre, `side` m to its right */
export function onLot(id: string, ahead: number, side = 0): { x: number; z: number } {
  const l = lotAt(id)!, fx = -Math.sin(l.yaw), fz = -Math.cos(l.yaw)   // forward = toward the green
  return { x: l.x + fx * ahead - fz * side, z: l.z + fz * ahead + fx * side }
}
/** Where the five stand: at the FRONT of their own lot, facing the green (a keeper on the green sees all five). */
// M39: a lot that stands Alex's BLUEPRINT puts its Moglin at the building's own front door (glade-lots.ts registers the spot:
// the blockout's front-of-lot spot sat inside every 13 x 8 blueprint or in one of its walls).
const spotOverride = new Map<string, { x: number; z: number }>()
export function setLotSpot(lot: string, p: { x: number; z: number } | null) { if (p) spotOverride.set(lot, p); else spotOverride.delete(lot) }
export function gladeSpots(ids: readonly string[]): { id: string; x: number; z: number; yaw: number }[] {
  return ids.map(id => {
    const k = id.split(':').pop() ?? id, p = spotOverride.get(k) ?? (lotAt(k) ? onLot(k, LOT_D / 2 - 1.2) : { x: GLADE_GREEN.x, z: GLADE_GREEN.z })
    return { id, x: p.x, z: p.z, yaw: Math.atan2(GLADE_GREEN.x - p.x, GLADE_GREEN.z - p.z) }
  })
}
/** kept for older callers: the old ring radius (now unused by placement) */
export const FOLK_RING = GLADE_GREEN.r

export const isGlade = (homeOrId: string) => homeOrId === GLADE_ID || homeOrId.startsWith(`${GLADE_ID}:`)

/** M40: each of the five talks about THEIR station (what they make, what they want, your matching room). @lark, SIGNED by
 *  Alex 11-19 (athernyx 40bf1c6, CANON/game/glade-station-lines.md), verbatim. The first talk is `main`, a repeat talk the
 *  `alt`. Alex 11-20: the ROOM is the Stonery, Sax's JOB is stonemason (Sax's two lines say Stonery; the signed
 *  file's own note says the lines follow the UI label). Checks import these, never retype them. */
export const GLADE_STATION_LINES: Readonly<Record<string, { main: string; alt: string }>> = {
  fennel: { main: "Table's long and the hearth is lit. Bring crops, rinn, honey-like things. A Cooking room on your plot gets you your own.", alt: 'Everybody eats here at evening. Your plot could hold a table like this one. Start with the Cooking room.' },
  hazel: { main: 'Planks, goldwood first, then cord and sap. I make tables and chests. Build a Carpentry room and you get your own bench.', alt: 'A crooked stack makes a crooked table. Stack them square. The Carpentry room runs on the same rule.' },
  sax: { main: 'Cooled-cloud stone, and crystal for the good work. I cut paving and low walls. Your plot can have a Stonery.', alt: 'Ground stays where I put it. Build a Stonery and yours will too.' },
  // Yarrow re-ruled 11-21 (bait-maker, never casts, neither brews nor buys brews): lark's bait-maker lines, SIGNED by Alex 11-21
  // (athernyx b2facfe, CANON/game/yarrow-baitmaker-lines-script.md › A), verbatim: first meeting = greet + what Yarrow makes,
  // a repeat = the ruled division of labour. (The 11-19 apothecary pair pointed at an Alchemy room, which no longer exists.)
  yarrow: { main: 'Do not touch the jars. Good. You listen. Yarrow. Bait. Bait, made from your makings. One jar, one cast, then it is gone.', alt: 'I do not cast. Fennel gets you casting. I keep you baited.' },
  mallow: { main: 'Bring me what the list asks. I pay Marks, and the list changes every week. This is where it all closes up.', alt: 'Check the list before you gather. It will not be the same list as last week.' },
}
/** a Glade Moglin's hello: its station line (main on first meeting, alt after), or null for anyone else */
export function gladeHello(folkId: string, heardBefore: boolean): string | null {
  if (!isGlade(folkId)) return null
  const l = GLADE_STATION_LINES[folkId.split(':').pop() ?? '']
  return l ? (heardBefore ? l.alt : l.main) : null
}

/** Greg's home on the pond's north-east shore, his bench between it and the green (facing the green), and the jetty out
 *  from the shore into the pond. Metres from the green's centre. */
export const GLADE_LAYOUT = {
  home: { dx: -23.75, dz: -24.5 },
  greg: { dx: -19.3, dz: -20.6 },     // on his bench, ~5.9 m in front of his door toward the green
}
export const gladeAt = (o: { dx: number; dz: number }) => ({ x: GLADE_GREEN.x + o.dx, z: GLADE_GREEN.z + o.dz })
/** the jetty: from the shore nearest Greg's home, 6 m out over the water toward the pond's centre */
export function gladeJetty(): { x0: number; z0: number; x1: number; z1: number; w: number } {
  const h = gladeAt(GLADE_LAYOUT.home), a = shoreToward(h.x, h.z, 1), dx = MOONWELL.x - a.x, dz = MOONWELL.z - a.z, d = Math.hypot(dx, dz)
  return { x0: a.x, z0: a.z, x1: a.x + (dx / d) * 7, z1: a.z + (dz / d) * 7, w: 2 }
}
/** Where Greg sits (M30 part 2: he left the keeper's plot; plot ground is bought at his door here), turned to face the pool. */
export function gregSpot(): { x: number; z: number; yaw: number } {
  const p = gladeAt(GLADE_LAYOUT.greg)
  return { ...p, yaw: Math.atan2(GLADE_GREEN.x - p.x, GLADE_GREEN.z - p.z) }   // M40: he faces the green
}

/** BORN AT MOONWELL (M31): how far in front of Greg a newborn opens their eyes. */
export const NEWBORN_GAP = 5
/** Where a newborn keeper opens their eyes: NEWBORN_GAP m in front of Greg, on the green side of his bench (dry, open), turned
 *  to FACE him. Read off gregSpot(), never a fixed waymark: M40 moved his pond and left the old waymark spawn 57.7 m away
 *  (11-22 sweep), so a layout move must carry the newborn with him. yaw is the WALKER's: forward = (-sin yaw, -cos yaw). */
export function newbornSpot(): { x: number; z: number; yaw: number } {
  const g = gregSpot(), x = g.x + Math.sin(g.yaw) * NEWBORN_GAP, z = g.z + Math.cos(g.yaw) * NEWBORN_GAP
  return { x, z, yaw: Math.atan2(-(g.x - x), -(g.z - z)) }
}
