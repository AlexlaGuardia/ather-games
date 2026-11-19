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
import { MOONWELL } from './moonwell'
import type { Settlement } from './network'
import type { Folk } from './settlement-folk'
import { DREAMS } from './folk-lines'
import { GREG_WAYMARK } from './waymarks'
import { loadQuest } from './rinsticks'

export const GLADE_ID = 'moonwell'
export const GLADE_NAME = 'Moonwell Glade'
/** The Glade as a settlement: centred on the pool. Meadow ground (canon: "the tended heart"). */
export const GLADE: Settlement = { id: GLADE_ID, name: GLADE_NAME, x: MOONWELL.x, z: MOONWELL.z, biome: 'meadow' }

/** Canon's own trade words, for player copy (the profession enum is ours; hub 11-19). */
export const GLADE_TRADE: Readonly<Record<string, string>> = { hazel: 'carpenter', sax: 'the stonery', yarrow: 'apothecary', fennel: 'cook', mallow: 'shopkeeper' }

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
    f('yarrow', 'Yarrow', 'alchemist', [{ id: 'goldwood_bark', n: 4 }, { id: 'raw_mana_shard', n: 3 }], DREAMS.alchemist[0], [4, 2, 4]),
    f('fennel', 'Fennel', 'cook', [{ id: 'shimmerscale', n: 3 }, { id: 'mast', n: 4 }], DREAMS.cook[0], [3, 3, 3]),
    f('mallow', 'Mallow', 'shopkeeper', mallowWants(now), MALLOW_DREAM, [2, 3, 5]),
  ].filter(x => !away.has(x.id))
}
/** @lark placeholder (11-19), awaiting a real line + Alex sign-off: Mallow has no DREAMS pool (a shopkeeper is not a village trade). */
export const MALLOW_DREAM = 'What does the world want today? Ask me again tomorrow. It will be something else.'
/** @lark placeholder (11-19), awaiting a real line + Alex sign-off: a Moonwell Moglin asked to come to a keeper's garden. */
export const GLADE_STAYS = 'This is my home. Greg kept it when everything else was lost. But come back often.'

/** Who is away from the Glade right now: Fennel, while the first-rinstick quest has her at the keeper's Rinnshop
 *  (rinquest: state 'active', the same test as fennelHere). Read at the call (a quest that starts is seen on the next Wilds visit). */
export function gladeAway(): Set<string> {
  try { return loadQuest().state === 'active' ? new Set([`${GLADE_ID}:fennel`]) : new Set() } catch { return new Set() }
}

/** Where the five stand: a ring round the pool at FOLK_RING m, fanned across the side AWAY from the arrival waymark, so a
 *  keeper stepping off the waymark sees the household across the water, each facing the pool. Placement is Jin's. */
export const FOLK_RING = MOONWELL.r + 3.6
export function gladeSpots(ids: readonly string[]): { id: string; x: number; z: number; yaw: number }[] {
  const away = Math.atan2(MOONWELL.x - GREG_WAYMARK.x, MOONWELL.z - GREG_WAYMARK.z)   // bearing waymark -> pool
  return ids.map((id, k) => {
    const a = away + (-1.1 + ((k + 0.5) / Math.max(1, ids.length)) * 2.2)
    const x = MOONWELL.x + Math.sin(a) * FOLK_RING, z = MOONWELL.z + Math.cos(a) * FOLK_RING
    return { id, x, z, yaw: Math.atan2(MOONWELL.x - x, MOONWELL.z - z) }   // facing the pool
  })
}

export const isGlade = (homeOrId: string) => homeOrId === GLADE_ID || homeOrId.startsWith(`${GLADE_ID}:`)

/** Where Greg sits, his door, and the five stand: a ring round the pool, the side away from the arrival waymark (so the
 *  keeper arrives facing the household). Metres from the pool's centre. Placement is Jin's (canon). */
export const GLADE_LAYOUT = {
  greg: { dx: 7.5, dz: 4.5 },        // on his bench outside his home
  home: { dx: 10.5, dz: 6.5 },       // Greg's house: the "grown structure" beside the pool
}
export const gladeAt = (o: { dx: number; dz: number }) => ({ x: MOONWELL.x + o.dx, z: MOONWELL.z + o.dz })
/** Where Greg sits (M30 part 2: he left the keeper's plot; plot ground is bought at his door here), turned to face the pool. */
export function gregSpot(): { x: number; z: number; yaw: number } {
  const p = gladeAt(GLADE_LAYOUT.greg)
  return { ...p, yaw: Math.atan2(MOONWELL.x - p.x, MOONWELL.z - p.z) }
}
