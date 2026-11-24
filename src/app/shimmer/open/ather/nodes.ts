// INFECTED NODES — where the Hollows well up in the Wilds (Alex 11-14: "infected nodes" with a 3-bar Hollow champion;
// kill it and the node clears "for now"). The Hollows themselves are canon (CANON_GAPS › THE ATHER REVAMP, RULED
// 11-14: the Hollow King's leak gives drained seeds a body; grey matter is what a dispersed Hollow drops). WHERE they
// well up, how often, and how a node is fought are build (Jin's): nothing here is a canon place.
//
// THE NODE MAP (11-15): one node per land SUBSECTION of a SUB×SUB grid on each tile (placeNodes); spread between
// same-biome neighbours lives in spread.ts. A cleared node stays clean until the spread brings the grey back.
//
// ★ PURE. No three, no react; localStorage only behind the load/save helpers.

import { BIOME, walkableIn, type BiomeId, type Wilds } from './wilds'

export interface WildsNode {
  id: string; tile: string; biome: BiomeId; x: number; z: number; i: number; j: number
  /** continent-wide subsection coords (tile·SUB + i/j). Set = neighbours ACROSS a tile seam count (the streamed Wilds);
   *  unset = within the tile only. */
  gi?: number; gj?: number
  /** M128: infected ground with no champion of its own (a lost settlement): nothing wakes here */
  quiet?: boolean
}

/** One game day = 64 real minutes (GBOARD › THE ATHER SIDE). The clock runs while you are away. */
export const GAME_DAY_MS = 64 * 60 * 1000
/** The champion wakes when the keeper comes this close; strays thicken inside STRAY_R. */
export const WAKE_R = 26, STRAY_R = 120
/** Nodes never well up this close to a safe point (Greg's waymark; its stray-free ring is 30 m). */
export const NODE_CLEAR_OF = 80
/** THE NODE MAP (Alex 11-14: "biome → section → subsection, one node each"). A tile is cut into SUB×SUB subsections;
 *  each one that is mostly land holds a node and belongs to its dominant biome. Spread runs between neighbouring
 *  subsections of the SAME biome (spread.ts). Sections (a biome's connected run of subsections) are implied by that
 *  adjacency; nothing needs them as data yet. */
export const SUB = 5

const LAND: BiomeId[] = [BIOME.meadow, BIOME.woods, BIOME.rock, BIOME.shore]

export function placeNodes(W: Wilds, tile: string, safe: { x: number; z: number }): WildsNode[] {
  const sx = W.meta.sizeX, sz = W.meta.sizeZ, cw = sx / SUB, ch = sz / SUB
  const out: WildsNode[] = []
  for (let j = 0; j < SUB; j++) for (let i = 0; i < SUB; i++) {
    const x0 = -sx / 2 + i * cw, z0 = -sz / 2 + j * ch
    // the subsection's biome: the most common LAND biome; skip a mostly-water square
    const tally = new Map<BiomeId, number>(); let n = 0, land = 0
    for (let z = z0 + 5; z < z0 + ch; z += 10) for (let x = x0 + 5; x < x0 + cw; x += 10) {
      n++; const b = W.biomeAt(x, z); if (LAND.includes(b)) { land++; tally.set(b, (tally.get(b) ?? 0) + 1) }
    }
    if (land / n < 0.35) continue
    const biome = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
    // its node: the walkable, level spot deepest in that biome, kept off the cell's edge and clear of the safe point
    let best: { x: number; z: number; s: number } | null = null
    for (let z = z0 + 20; z <= z0 + ch - 20; z += 10) for (let x = x0 + 20; x <= x0 + cw - 20; x += 10) {
      if (W.biomeAt(x, z) !== biome || !walkableIn(W, x, z, 1.2)) continue
      if (Math.hypot(x - safe.x, z - safe.z) < NODE_CLEAR_OF) continue
      const slope = Math.hypot(W.heightAt(x + 4, z) - W.heightAt(x - 4, z), W.heightAt(x, z + 4) - W.heightAt(x, z - 4)) / 16
      if (slope > 0.3) continue
      let sc = 0
      for (let dz = -20; dz <= 20; dz += 10) for (let dx = -20; dx <= 20; dx += 10) if (W.biomeAt(x + dx, z + dz) === biome) sc++
      sc -= slope * 4 + Math.hypot(x - (x0 + cw / 2), z - (z0 + ch / 2)) / 200   // prefer the middle on a tie
      if (!best || sc > best.s) best = { x, z, s: sc }
    }
    if (best) out.push({ id: `${tile}:${i},${j}`, tile, biome, x: best.x, z: best.z, i, j })
  }
  return out
}

/** Neighbours a node can spread to: the four grid neighbours that share its biome. */
export function nodeAdjacency(nodes: WildsNode[]): Map<string, string[]> {
  // continent coords when every node has them (the grey crosses tile seams, Alex 11-15: one continent, not 67
  // squares); else the tile's own grid
  const global = nodes.length > 0 && nodes.every(n => n.gi !== undefined && n.gj !== undefined)
  const I = (n: WildsNode) => (global ? n.gi! : n.i), J = (n: WildsNode) => (global ? n.gj! : n.j)
  const at = new Map(nodes.map(n => [`${I(n)},${J(n)}`, n]))
  return new Map(nodes.map(n => [n.id, [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([di, dj]) => at.get(`${I(n) + di},${J(n) + dj}`)).filter((m): m is WildsNode => !!m && m.biome === n.biome).map(m => m.id)]))
}

/** Which node's ground is this? The NEAREST node: a node owns the country round it, so clearing one quiets that whole
 *  stretch. (First cut keyed on biome, and Alex 11-15 still met Hollows "in the meadows" after the meadow kill: they
 *  were in woods pockets 90 m off the meadow node, owned by the woods node 340 m away. An area is what a player means.)
 *  When the section/subsection tiers land, more nodes make these areas finer. */
export function ownerOf(nodes: WildsNode[], x: number, z: number): WildsNode | undefined {
  let best: WildsNode | undefined, bd = Infinity
  for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n } }
  return best
}

/** Each node's country as a polygon in tile-local metres: the tile square clipped by the half-planes "nearer this node
 *  than that one" (an exact Voronoi cell, the same rule as ownerOf). For the fold map's borders. */
export type Poly = { x: number; z: number }[]
export function nodeRegions(nodes: WildsNode[], sizeX: number, sizeZ: number): { id: string; poly: Poly }[] {
  const hx = sizeX / 2, hz = sizeZ / 2
  return nodes.map(n => {
    let poly: Poly = [{ x: -hx, z: -hz }, { x: hx, z: -hz }, { x: hx, z: hz }, { x: -hx, z: hz }]
    for (const o of nodes) {
      if (o === n) continue
      // keep points p with (p - mid) · (o - n) <= 0
      const mx = (n.x + o.x) / 2, mz = (n.z + o.z) / 2, dx = o.x - n.x, dz = o.z - n.z
      const side = (p: { x: number; z: number }) => (p.x - mx) * dx + (p.z - mz) * dz
      const out: Poly = []
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length], sa = side(a), sb = side(b)
        if (sa <= 0) out.push(a)
        if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }) }
      }
      poly = out
    }
    return { id: n.id, poly }
  })
}
export const polyArea = (p: Poly) => Math.abs(p.reduce((s, a, k) => { const b = p[(k + 1) % p.length]; return s + a.x * b.z - b.x * a.z }, 0)) / 2
