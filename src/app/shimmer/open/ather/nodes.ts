// INFECTED NODES — where the Hollows well up in the Wilds (Alex 11-14: "infected nodes" with a 3-bar Hollow champion;
// kill it and the node clears "for now"). The Hollows themselves are canon (CANON_GAPS › THE ATHER REVAMP, RULED
// 11-14: the Hollow King's leak gives drained seeds a body; grey matter is what a dispersed Hollow drops). WHERE they
// well up, how often, and how a node is fought are build (Jin's): nothing here is a canon place.
//
// This slice: one node per BIOME on a tile (the biome tier of Alex's biome → section → subsection map). The spread
// sim (15%/3 game days per infected node, 3%/5 days per clean one, with the cap/grace/waymark brakes) is the next
// slice; until it lands, a cleared node simply stays clear for GRACE and then wells up again.
//
// ★ PURE. No three, no react; localStorage only behind the load/save helpers.

import { BIOME, walkableIn, type BiomeId, type Wilds } from './wilds'

export interface WildsNode { id: string; tile: string; biome: BiomeId; x: number; z: number }

/** One game day = 64 real minutes (GBOARD › THE ATHER SIDE). A cleared node holds for 3 of them. */
export const GAME_DAY_MS = 64 * 60 * 1000
export const GRACE_MS = 3 * GAME_DAY_MS
/** The champion wakes when the keeper comes this close; strays thicken inside STRAY_R. */
export const WAKE_R = 26, STRAY_R = 120
/** Nodes never well up this close to a safe point (Greg's waymark). */
export const NODE_CLEAR_OF = 150

const NODE_BIOMES: BiomeId[] = [BIOME.meadow, BIOME.woods, BIOME.rock, BIOME.shore]

/** One node per land biome the tile holds: the walkable, level spot deepest inside that biome (most same-biome
 *  ground in a 40 m window), kept clear of the safe point and of each other. Deterministic from the tile. */
export function placeNodes(W: Wilds, tile: string, safe: { x: number; z: number }): WildsNode[] {
  const hx = W.meta.sizeX / 2 - 40, hz = W.meta.sizeZ / 2 - 40, step = 20, win = 20
  const out: WildsNode[] = []
  for (const b of NODE_BIOMES) {
    let best: { x: number; z: number; s: number } | null = null
    for (let z = -hz; z <= hz; z += step) for (let x = -hx; x <= hx; x += step) {
      if (W.biomeAt(x, z) !== b || !walkableIn(W, x, z, 1.2)) continue
      if (Math.hypot(x - safe.x, z - safe.z) < NODE_CLEAR_OF) continue
      if (out.some(n => Math.hypot(n.x - x, n.z - z) < 160)) continue
      const slope = Math.hypot(W.heightAt(x + 4, z) - W.heightAt(x - 4, z), W.heightAt(x, z + 4) - W.heightAt(x, z - 4)) / 16
      if (slope > 0.25) continue
      let s = 0
      for (let dz = -win; dz <= win; dz += 10) for (let dx = -win; dx <= win; dx += 10) if (W.biomeAt(x + dx, z + dz) === b) s++
      s -= slope * 4
      if (!best || s > best.s) best = { x, z, s }
    }
    if (best && best.s >= 12) out.push({ id: `${tile}:${b}`, tile, biome: b, x: best.x, z: best.z })
  }
  return out
}

/** Node ledger: id → when it was last cleared (ms epoch). Absent = infected. */
export type NodeLedger = Record<string, number>
const KEY = 'ather.nodes.v1'

export function isInfected(id: string, L: NodeLedger, now: number): boolean {
  const t = L[id]
  return t === undefined || now - t > GRACE_MS
}
export function clearNode(L: NodeLedger, id: string, now: number): NodeLedger { return { ...L, [id]: now } }

export function loadNodes(): NodeLedger {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}
export function saveNodes(L: NodeLedger) { try { localStorage.setItem(KEY, JSON.stringify(L)) } catch { /* private window */ } }
