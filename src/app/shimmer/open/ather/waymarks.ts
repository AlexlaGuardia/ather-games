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

export interface Waymark { id: string; tile: string; x: number; y: number; z: number; biome: BiomeId; made: number }

export const PER_BIOME = 4
export const MIN_SPACING = 60          // metres between two waymarks on one tile
/** GREGORY'S waymark: a place he walked to and bound, given so a new keeper has somewhere to step through to.
 *  It does not count against the keeper's caps. */
export const GREG_WAYMARK: Waymark = { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: BIOME.meadow, made: 0 }
export const MAX_WAYMARKS = 12

export type PlantVerdict = { ok: true } | { ok: false; why: string }

export function canPlant(list: readonly Waymark[], at: { tile: string; x: number; z: number; biome: BiomeId; grounded: boolean; swimming: boolean }): PlantVerdict {
  if (!at.grounded || at.swimming) return { ok: false, why: 'A waymark binds ground. Stand on it.' }
  if (at.biome === BIOME.water) return { ok: false, why: 'Water will not hold a binding.' }
  if (list.length >= MAX_WAYMARKS) return { ok: false, why: `You hold ${MAX_WAYMARKS} waymarks, as many as the fold will carry. Lift one first.` }
  const same = list.filter(w => w.biome === at.biome)
  if (same.length >= PER_BIOME) return { ok: false, why: `You already hold ${PER_BIOME} waymarks in the ${BIOME_NAME[at.biome]}. Find other country.` }
  const near = [GREG_WAYMARK, ...list].find(w => w.tile === at.tile && Math.hypot(w.x - at.x, w.z - at.z) < MIN_SPACING)
  if (near) return { ok: false, why: `Too close to your other waymark (${Math.round(Math.hypot(near.x - at.x, near.z - at.z))} m). Walk on.` }
  return { ok: true }
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
export function loadWaymarks(): Waymark[] {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter(w => w && typeof w.x === 'number' && typeof w.z === 'number') : []
  } catch { return [] }
}
export function saveWaymarks(list: readonly Waymark[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private window: the session keeps them */ }
}
