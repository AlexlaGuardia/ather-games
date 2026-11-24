// WAYMARKS — the keeper's reach into the Wilds.
//
// Canon (shimmer-geography.md › THE HOME PLOT'S TRAVEL LAYER, RULED 2026-08-15): a waymark is mana BOUND TO A
// PLACE (Enchant's Waymark), "a destination already walked to and bound". A passage from the plot to the Wilds runs
// off a waymark. It holds itself; its maker need not be there. "Scarcity was never the claim; REACH is — a keeper's
// passages go where a keeper has been." The number, pricing, how it renders, and whether a keeper may CRAFT one
// before developing Enchant are Jin's build.
//
// THE BUILD (Alex 11-14, Jin): waymarks are crafted and planted by hand, as many as the rules allow.
//   · Planted only where you STAND, on ground (never in water, never mid-air): reach = where you have been.
//   · Capped PER BIOME, not in total, so the cap pushes the keeper outward to new country rather than stacking.
//   · A minimum spacing, so two waymarks are two places.
//   · A total cap "within reason" (Alex 11-14). Each waymark is a stop on the gate's fold map; there are no sockets.
// Each planted waymark adds its biome to the fold network; later, garden Moglins gather from that biome
// (world/gates.md, RULED 11-14: help, never labour, pacing is Jin's).
//
// ★ PURE. The page persists the list (localStorage trial ledger); these functions decide.

import { BIOME, BIOME_NAME, type BiomeId } from './wilds'
import { gardenKey } from '@/lib/keeper-local'
import { infectId } from './infect-id'

/** `settlement`: the free-Moglin settlement it is bound in (Alex 11-18: waymarks only bind where folk live). Older waymarks
 *  planted before that rule have none and keep working until lifted. */
export interface Waymark { id: string; tile: string; x: number; y: number; z: number; biome: BiomeId; made: number; settlement?: string
  /** M75: the cleared Wilds node it is bound on (a waymark planted on kept ground outside a settlement). Older saves have none. */
  node?: string }

export const PER_BIOME = 4
export const MIN_SPACING = 60          // metres between two waymarks on one tile
/** GREGORY'S waymark: a place he walked to and bound, given so a new keeper has somewhere to step through to.
 *  It does not count against the keeper's caps. */
export const GREG_WAYMARK: Waymark = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: BIOME.meadow, made: 0 }
export const MAX_WAYMARKS = 12

/** ★ SIGNED by Alex 2026-11-24 (athernyx c1d5903): shimmer-lines-batch-2026-11-24b.md › B1 + B2, MAIN word for word
 *  (lines-batch-24b.test.ts): the three refusals when planting, and the fold map's hint. */
export const PLANT_WHY = {
  grey: 'The grey still holds this ground. Clear it, then plant here.',
  notKept: "Plant a waymark on ground you cleared, or in a settlement that's kept.",
  unfolded: 'A waymark leads home, and you have no garden yet. Greg can fold you one.',
  // ★ SIGNED by Alex 2026-11-24 (athernyx 98e7f1c): shimmer-lines-batch-2026-11-24f.md › A, MAIN (lines-batch-24f.test.ts)
  ground: 'Stand on solid ground to plant a waymark.',
  water: 'Water will not hold a waymark.',
  settlement: 'Your waymark already stands in this settlement. One is enough.',
  cap: (max: number) => `You hold ${max} waymarks, the most the fold will carry. Lift one to plant here.`,
  biome: (n: number, biome: string) => `You already hold ${n} waymarks in the ${biome}. Plant the next in other country.`,
  near: (m: number) => `Too close to your other waymark (${m} m). Walk a little further.`,
} as const
/** SIGNED 11-24f › A: what the keeper reads planting or lifting one */
export const WAY_TEXT = {
  planted: (place: string) => `Waymark planted in ${place}. It is a stop on the fold map now.`,
  lifted: 'Waymark lifted. It is back in your bag.',
  liftedFull: 'Waymark lifted. Your bag is full, so it went back to the fold.',
  none: 'No Waymark Stone in your bag. Lift one you planted, or buy more reach from Greg.',
} as const
export const PLANT_HINT = 'Plant one on ground you cleared, or inside a settlement.'
export type PlantVerdict = { ok: true } | { ok: false; why: string }

/** M75: what the ground under the keeper is to the spread (combat's nearest-node ownership): a node's ground whose grey was
 *  answered = 'cleared', still grey = 'infected', no node owns it (or the spread is not loaded yet) = null. */
export type WildsGround = 'cleared' | 'infected' | null

/** M75 (Alex 11-22, "keepers place waymarks anywhere in the Wilds"), reconciled with canon, not overriding it:
 *  a waymark exists only once the place is KEPT (shimmer-folds-settlements.md:32; gates.md: "a door onto a place that is not
 *  bound (not walked to, not kept, not owned)" is refused). In the Wilds that is ground the keeper has kept: a settlement
 *  (folk keep it) or ground whose grey they answered (a CLEARED node). Anywhere on that ground, not only inside a settlement.
 *  Each waymark links back to the garden (the fold map's home stop), so a keeper Greg has not folded a garden for yet holds
 *  no waymark to plant (M71 s1: pre-fold "home" is the Glade). `folded` / `ground` are optional so an older caller reads as
 *  folded with no cleared ground (the 11-18 settlement-only rule). */
export function canPlant(list: readonly Waymark[], at: { tile: string; x: number; z: number; biome: BiomeId; grounded: boolean; swimming: boolean; settlement: string | null; ground?: WildsGround; folded?: boolean }): PlantVerdict {
  if (at.folded === false) return { ok: false, why: PLANT_WHY.unfolded }
  if (!at.grounded || at.swimming) return { ok: false, why: PLANT_WHY.ground }
  if (at.biome === BIOME.water) return { ok: false, why: PLANT_WHY.water }
  // ★ ONLY ON KEPT GROUND: a settlement, or ground you cleared (M75). Infected ground still refuses (the place is not kept).
  if (!at.settlement && at.ground !== 'cleared') return { ok: false, why: at.ground === 'infected'
    ? PLANT_WHY.grey
    : PLANT_WHY.notKept }
  if (at.settlement && list.some(w => w.settlement === at.settlement)) return { ok: false, why: PLANT_WHY.settlement }
  if (list.length >= MAX_WAYMARKS) return { ok: false, why: PLANT_WHY.cap(MAX_WAYMARKS) }
  const same = list.filter(w => w.biome === at.biome)
  if (same.length >= PER_BIOME) return { ok: false, why: PLANT_WHY.biome(PER_BIOME, BIOME_NAME[at.biome]) }
  const near = [GREG_WAYMARK, ...list].find(w => w.tile === at.tile && Math.hypot(w.x - at.x, w.z - at.z) < MIN_SPACING)
  if (near) return { ok: false, why: PLANT_WHY.near(Math.round(Math.hypot(near.x - at.x, near.z - at.z))) }
  return { ok: true }
}

/** M75: the spread's word for the ground at a point, from the node that owns it and the set still infected. */
export function groundOf(owner: string | null | undefined, infected: ReadonlySet<string>): WildsGround {
  return owner ? (infected.has(owner) ? 'infected' : 'cleared') : null
}

/** M75 s2 DARK / RELIGHT (Magii RULED-AFK athernyx d3bf5e9; basis shimmer-folds-settlements.md:32, "a waymark exists only on
 *  kept ground"): a waymark bound on a cleared node is LIT while that node stays clean and DARK while the grey holds it again.
 *  Read at call time from the spread's own infected set (the same one canPlant's `ground` comes from), never a stored flag:
 *  a dark waymark stays planted (no refund, no re-buy) and relights the moment its node is cleared again. A settlement is kept
 *  ground, so its waymark is lit unless a weekly infection holds it (M128, infection.ts); always lit: Greg's and older
 *  waymarks bound to no node. */
export function isLit(w: Waymark, infected: ReadonlySet<string>): boolean {
  if (w.settlement) return !infected.has(infectId(w.settlement))   // M128: dark while its settlement is infected, or lost
  if (!w.node) return true
  return !infected.has(w.node)
}
/** ★ SIGNED by Alex 2026-11-24 (athernyx c1d5903): shimmer-lines-batch-2026-11-24b.md › B2: the refusal when a keeper steps toward a dark waymark, and the fold map's word for one. */
export const DARK_WHY = 'The grey took that ground back. Its waymark is dark until you clear it again.'
export const UNLIT_LABEL = 'unlit'
/** Whether the fold may carry the keeper to this waymark now. */
export function canTravel(w: Waymark, infected: ReadonlySet<string>): PlantVerdict {
  return isLit(w, infected) ? { ok: true } : { ok: false, why: DARK_WHY }
}
/** The waymark a fall sets the keeper down at: the last LIT one (Greg's stone when none is lit). */
export function lastLit(list: readonly Waymark[], infected: ReadonlySet<string>): Waymark | undefined {
  for (let k = list.length - 1; k >= 0; k--) if (isLit(list[k], infected)) return list[k]
  return undefined
}

export function plant(list: readonly Waymark[], w: Omit<Waymark, 'id' | 'made'>, now = Date.now()): Waymark[] {
  return [...list, { ...w, id: `wm-${now.toString(36)}-${list.length}`, made: now }]
}

export function lift(list: readonly Waymark[], id: string): Waymark[] {
  return list.filter(w => w.id !== id)
}

/** The biomes the keeper's fold network now reaches: what Moglins will one day gather from. */
export function reachedBiomes(list: readonly Waymark[]): BiomeId[] {
  return [...new Set(list.map(w => w.biome))].sort()
}


// ── the trial ledger (per browser; NOT the account save) ──────────────────────────────────────────────────────
const KEY = 'ather.waymarks.v1'
/** Pure read of the ledger: anything that is not a list of well-formed waymarks reads as none, and a malformed row is
 *  dropped alone. Rows from before M75 (no `node`) and before 11-18 (no `settlement`) load as they were. */
export function parseWaymarks(raw: string | null): Waymark[] {
  try {
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter(w => w && typeof w.id === 'string' && typeof w.tile === 'string' && typeof w.x === 'number' && typeof w.z === 'number') : []
  } catch { return [] }
}
export function loadWaymarks(): Waymark[] {
  try { return parseWaymarks(localStorage.getItem(gardenKey(KEY))) } catch { return [] }
}
export function saveWaymarks(list: readonly Waymark[]): void {
  try { localStorage.setItem(gardenKey(KEY), JSON.stringify(list)) } catch { /* private window: the session keeps them */ }
}

// ── world coordinates (for the continent map's Ather tab; hub reads these read-only) ──────────────────────────
/** Each streamed Wilds tile's centre in continent world coords (= wilds.ts tileCentreWorld(meta); the test keeps
 *  them equal). A static table so a reader need not fetch tile metadata to place a waymark. */
export const TILE_CENTRE: Record<string, { x: number; z: number }> = { 'first-wilds': { x: 2365, z: 785 } }

export interface WorldWaymark { id: string; x: number; z: number; biome: BiomeId; greg: boolean }
/** Gregory's waymark plus the keeper's (from the trial ledger by default), in continent world coords. Waymarks on a
 *  tile with no known centre are left out rather than drawn in the wrong place. */
export function waymarksInWorld(list: readonly Waymark[] = loadWaymarks()): WorldWaymark[] {
  const out: WorldWaymark[] = []
  for (const w of [GREG_WAYMARK, ...list]) {
    const c = TILE_CENTRE[w.tile]; if (!c) continue
    out.push({ id: w.id, x: w.x + c.x, z: w.z + c.z, biome: w.biome, greg: w.id === GREG_WAYMARK.id })
  }
  return out
}
