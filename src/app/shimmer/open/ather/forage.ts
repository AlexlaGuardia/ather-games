// BETA M241 (Magii 4204f49 / 933293c, Alex 11-27): WILD FORAGE, the real sources of MOONBERRY and FIREWORT.
//   · MOONBERRY (world/cuisine.md: "Common. Picked from its wild bushes in the open Ather"; CANON_GAPS 09-15 RULED: Moonberry
//     grows on woodland + shore). Every moonberry bush the owner placed (Glade / Wilds published `bush:moonberry-bush`) is
//     pickable, and the Wilds' WOODLAND squares (the zones Twilight Thicket + Wooded Trails) grow a few of their own.
//   · FIREWORT (game/alchemy.md: "wild at the Sadlands' edges"). The Sadlands is a pocket inside the Scald and its oases are
//     placed by Alex (M137); none stand in the world data yet. So Firewort grows on the Scald's EDGE squares, where the badlands
//     meet greener ground: Jin's placement (zone borders = Jin's, shimmer-geography.md boundary), to move onto the Sadlands'
//     oases when Alex places them. This RETIRES the M234 s2 stand-in (a find when pruning a Goldwood, infusions.ts).
//   · E on a spot picks it: its gift goes in the bag, the spot shows picked, and it grows back after FORAGE_REGROW_MS.
//     Saved per keeper (ather.forage.v1: spot id -> when picked), so a reload keeps it picked.
// PURE but for the guarded localStorage load/save. Numbers are dials (Jin's; feel: Alex).
import { keeperKey } from '@/lib/keeper-local'
import { GAME_DAY_MS } from './nodes'
import { MOONBERRY } from './cooking'
import type { Zone } from './forestry'
import { cropId, seedId } from './farming'

export type ForageKind = 'moonberry' | 'firewort'
export interface ForageSpot { id: string; kind: ForageKind; x: number; z: number }
export type Picks = Readonly<Record<string, number>>

/** What one pick puts in the bag. Firewort comes with its seed (it stays plantable in the Farm, farming.ts). */
export const FORAGE_GIVES: Readonly<Record<ForageKind, readonly { id: string; n: number }[]>> = {
  moonberry: [{ id: MOONBERRY, n: 2 }],
  firewort: [{ id: cropId('firewort'), n: 1 }, { id: seedId('firewort'), n: 1 }],
}
/** How long a picked spot takes to grow back (one game day). */
export const FORAGE_REGROW_MS = GAME_DAY_MS
/** How near (m) the keeper must stand to pick. */
export const FORAGE_REACH = 3

export const isPicked = (picks: Picks, id: string, now: number) => picks[id] !== undefined && now < picks[id] + FORAGE_REGROW_MS
/** Pick spot `s`. Null = it is still growing back. */
export function pickSpot(picks: Picks, s: ForageSpot, now: number): { picks: Picks; give: readonly { id: string; n: number }[] } | null {
  if (isPicked(picks, s.id, now)) return null
  return { picks: { ...picks, [s.id]: now }, give: FORAGE_GIVES[s.kind] }
}
/** Drop picks that have grown back (keeps the save small). */
export function prunePicks(picks: Picks, now: number): Picks {
  const out: Record<string, number> = {}
  for (const [k, t] of Object.entries(picks)) if (now < t + FORAGE_REGROW_MS) out[k] = t
  return out
}

// ── where the wild spots are ───────────────────────────────────────────────────────────────────────────────────────────
/** the bush the owner places (scenery.ts BUSHES / scatter-brush.ts) */
export const MOONBERRY_BUSH_K = 'bush:moonberry-bush'
/** Woodland zones (the 09-15 ruling's "woodland"). */
export const WOODLAND: readonly Zone[] = ['thicket', 'trails']
/** Spots per square (each zone square is NODE_M on a side). */
export const MOONBERRY_PER_SQUARE = 3
export const FIREWORT_PER_EDGE = 3
const NODE_M = 200, TILE_M = 1000, HALF = TILE_M / 2
/** how far into the Scald from the shared edge Firewort grows (m) */
export const FIREWORT_BAND = 40
const GREEN: readonly Zone[] = ['meadows', 'thicket', 'springs', 'trails']

/** a small seeded hash -> [0, 1) */
function h01(s: string, k: number): number {
  let a = 2166136261 ^ k
  for (let i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619) }
  a ^= a >>> 13; a = Math.imul(a, 0x5bd1e995); a ^= a >>> 15
  return (a >>> 0) / 4294967296
}

export interface IndexTile { name: string; tx: number; ty: number; nodes: readonly { i: number; j: number; zone?: Zone }[] }
/** Every wild spot of these tiles, in WORLD coords (tile centre = tx * 1000, ty * 1000). `all` = the whole index, so a Scald
 *  square on a tile's rim sees its neighbour across the seam. Deterministic: the same index gives the same spots and ids. */
export function wildSpots(tiles: readonly IndexTile[], all: readonly IndexTile[] = tiles): ForageSpot[] {
  const zoneAt = new Map<string, Zone>()
  for (const t of all) for (const n of t.nodes) zoneAt.set(`${t.tx * 5 + n.i},${t.ty * 5 + n.j}`, n.zone ?? 'meadows')
  const out: ForageSpot[] = []
  for (const t of tiles) for (const n of t.nodes) {
    const zone = n.zone ?? 'meadows', x0 = t.tx * TILE_M - HALF + n.i * NODE_M, z0 = t.ty * TILE_M - HALF + n.j * NODE_M, base = `${t.name}:${n.i},${n.j}`
    if (WOODLAND.includes(zone)) for (let k = 0; k < MOONBERRY_PER_SQUARE; k++)
      out.push({ id: `fm:${base}:${k}`, kind: 'moonberry', x: x0 + 20 + h01(base, 2 * k) * (NODE_M - 40), z: z0 + 20 + h01(base, 2 * k + 1) * (NODE_M - 40) })
    if (zone !== 'arid') continue
    // the Scald's edge: each side that meets a green square grows a band of Firewort just inside the Scald
    const gi = t.tx * 5 + n.i, gj = t.ty * 5 + n.j
    const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (const [dx, dz] of sides) {
      const nb = zoneAt.get(`${gi + dx},${gj + dz}`)
      if (!nb || !GREEN.includes(nb)) continue
      const side = `${dx},${dz}`
      for (let k = 0; k < FIREWORT_PER_EDGE; k++) {
        const along = 20 + h01(base + side, 2 * k) * (NODE_M - 40), into = 6 + h01(base + side, 2 * k + 1) * (FIREWORT_BAND - 6)
        const x = dx === 0 ? x0 + along : dx > 0 ? x0 + NODE_M - into : x0 + into
        const z = dz === 0 ? z0 + along : dz > 0 ? z0 + NODE_M - into : z0 + into
        out.push({ id: `ff:${base}:${side}:${k}`, kind: 'firewort', x, z })
      }
    }
  }
  return out
}
/** The owner's placed moonberry bushes of a published layer (Glade or Wilds props), as spots. `tag` keeps the two maps apart. */
export function placedSpots(props: readonly { id: string; k: string; x: number; z: number }[], tag: 'g' | 'w'): ForageSpot[] {
  return props.filter(p => p.k === MOONBERRY_BUSH_K).map(p => ({ id: `p${tag}:${p.id}`, kind: 'moonberry' as const, x: p.x, z: p.z }))
}
/** The nearest spot within reach of (x, z), or null. */
export function nearestSpot(spots: readonly ForageSpot[], x: number, z: number, reach = FORAGE_REACH): ForageSpot | null {
  let best: ForageSpot | null = null, bd = reach
  for (const s of spots) { const d = Math.hypot(s.x - x, s.z - z); if (d <= bd) { bd = d; best = s } }
  return best
}

// ── save: per keeper ───────────────────────────────────────────────────────────────────────────────────────────────────
export const FORAGE_KEY = 'ather.forage.v1'
export function parsePicks(v: unknown): Picks {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, number> = {}
  for (const [k, t] of Object.entries(v as Record<string, unknown>)) if (typeof t === 'number' && Number.isFinite(t) && k.length <= 120) out[k] = t
  return out
}
export function loadPicks(): Picks {
  try { return parsePicks(JSON.parse(localStorage.getItem(keeperKey(FORAGE_KEY)) ?? 'null')) } catch { return {} }
}
export function savePicks(p: Picks): void {
  try { localStorage.setItem(keeperKey(FORAGE_KEY), JSON.stringify(p)) } catch { /* private window */ }
}
