// A tile of THE WILDS — the continent's land in the Ather's state (world/ather.md, RULED 2026-09-07: same land,
// two states). Exported by tools/worldmap/export_wilds.py from the SAME height.npy the driving regions read; no roads,
// no places, no mortal names. x east, z south, origin at the tile's centre.
//
// ★ PURE. No three, no react, no DOM: the page, the tests and one day a server read the same numbers.
// ★ What you see is what you stand on: `heightAt` interpolates the SAME two triangles per cell the mesh draws,
//   split on the (i,j)→(i+1,j+1) diagonal (land.ts / region.ts rule).

import { treeFor, TRUNK, type Zone, type TreeKind } from './forestry'
import { crystalFor, type CrystalKind } from './prospecting'
import type { Box, Shape } from '../terrain-world'

/** Biome ids, matched to export_wilds.py. What a biome is FOR: what you gather there, what a waymark there sends
 *  home. The numbers are the file format; the names are build vocabulary, not canon place names. */
export const BIOME = { water: 0, shore: 1, meadow: 2, woods: 3, rock: 4 } as const
export type BiomeId = (typeof BIOME)[keyof typeof BIOME]
export const BIOME_NAME: Record<BiomeId, string> = { 0: 'water', 1: 'shore', 2: 'meadow', 3: 'woods', 4: 'rock' }

export interface WildsMeta {
  name: string; cell: number; nx: number; nz: number; sizeX: number; sizeZ: number; waterY: number
  source: { x0: number; y0: number; x1: number; y1: number; mPerPx: number }
}

/** A tree: trunk centre + crown size + which of the Ather's four it is (forestry.ts). Deterministic from the tile, so
 *  the page draws, the walker bumps and a prune finds the same one; `id` = tile:index is what a prune is saved under. */
export interface Tree { x: number; z: number; y: number; tall: number; r: number; kind: TreeKind; id: string }
/** A crystal node on the rock (prospecting.ts): where, which, how big, its turn. `id` = tile:c<index> is what a fracture
 *  is saved under. Deterministic from the tile, like a tree. */
export interface Crystal { x: number; z: number; y: number; kind: CrystalKind; s: number; rot: number; id: string }

export interface Wilds {
  meta: WildsMeta
  h: Float32Array
  biomes: Uint8Array
  heightAt(x: number, z: number): number
  biomeAt(x: number, z: number): BiomeId
  /** Woods fraction 0..1 around a point: the canopy, for the sky rig's gloom. */
  canopyAt(x: number, z: number): number
  trees: Tree[]
  crystals: Crystal[]
  shape: Shape
}

const TRUNK_R = 0.35
/** The tile's edge: a wall the walker leans on, never a fall (a fall is the PLOT's edge, and it means home). */
const BORDER = 2, BORDER_H = 400

const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 2246822519) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** `zoneAt(i, j)`: the zone of the tile's 200 m node (i, j) (tiles.json, zone_wilds.py); absent = every node meadows. */
export function parseWilds(meta: WildsMeta, dm: Int16Array, biomes: Uint8Array, zoneAt: (i: number, j: number) => Zone = () => 'meadows'): Wilds {
  const { nx, nz, cell, sizeX, sizeZ } = meta
  if (dm.length !== nx * nz) throw new Error(`wilds ${meta.name}: ${dm.length} heights, want ${nx * nz}`)
  if (biomes.length !== (nx - 1) * (nz - 1)) throw new Error(`wilds ${meta.name}: ${biomes.length} biome cells, want ${(nx - 1) * (nz - 1)}`)
  const h = new Float32Array(dm.length)
  for (let k = 0; k < dm.length; k++) h[k] = dm[k] / 10
  const hx = sizeX / 2, hz = sizeZ / 2

  const heightAt = (x: number, z: number): number => {
    const fx = Math.min(nx - 1 - 1e-6, Math.max(0, (x + hx) / cell)), fz = Math.min(nz - 1 - 1e-6, Math.max(0, (z + hz) / cell))
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j
    const h00 = h[j * nx + i], h10 = h[j * nx + i + 1], h01 = h[(j + 1) * nx + i], h11 = h[(j + 1) * nx + i + 1]
    return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v
  }
  const cellOf = (x: number, z: number) => {
    const i = Math.min(nx - 2, Math.max(0, Math.floor((x + hx) / cell))), j = Math.min(nz - 2, Math.max(0, Math.floor((z + hz) / cell)))
    return j * (nx - 1) + i
  }
  const biomeAt = (x: number, z: number) => biomes[cellOf(x, z)] as BiomeId

  // Canopy: woods share of a 5×5-cell window, precomputed (the sky rig asks every few frames).
  const cw = nx - 1, ch = nz - 1, canopy = new Float32Array(cw * ch)
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    let n = 0, w = 0
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const a = i + di, b = j + dj
      if (a < 0 || b < 0 || a >= cw || b >= ch) continue
      n++; if (biomes[b * cw + a] === BIOME.woods) w++
    }
    canopy[j * cw + i] = w / n
  }
  const canopyAt = (x: number, z: number) => canopy[cellOf(x, z)]

  // Trees: by ZONE (forestry.ts › treeFor: which of the four, and how thick), none on ground too steep to root or under
  // the water line. Sizes by kind: a dawnwood is an old giant, a starwillow a slim weeping one.
  const trees: Tree[] = []
  const NODE_M = 200
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const b = biomes[j * cw + i]
    const cx = -hx + (i + 0.5) * cell, cz = -hz + (j + 0.5) * cell
    const zone = zoneAt(Math.min(4, Math.floor((cx + hx) / NODE_M)), Math.min(4, Math.floor((cz + hz) / NODE_M)))
    const t = treeFor(zone, b, canopy[j * cw + i], hash(i, j, 6))
    if (!t || hash(i, j, 1) >= t.p) continue
    const x = -hx + (i + 0.2 + hash(i, j, 2) * 0.6) * cell, z = -hz + (j + 0.2 + hash(i, j, 3) * 0.6) * cell
    const y = heightAt(x, z)
    const s = Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2
    if (s > 0.6 || y < meta.waterY + 1) continue
    const big = t.kind === 'dawnwood' ? 1.55 : t.kind === 'shimmeroak' ? 1.2 : t.kind === 'starwillow' ? 0.95 : 1
    trees.push({ x, z, y, tall: (5 + hash(i, j, 4) * 5) * big, r: (1.6 + hash(i, j, 5) * 1.2) * big, kind: t.kind, id: `${meta.name}:${trees.length}` })
  }

  // Crystals: by ZONE on the crag (prospecting.ts › crystalFor), never under the water line or on a cliff face, never
  // inside a trunk. Their own hash salts, so adding them moved no tree.
  const crystals: Crystal[] = []
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const b = biomes[j * cw + i]
    const cx = -hx + (i + 0.5) * cell, cz = -hz + (j + 0.5) * cell
    const zone = zoneAt(Math.min(4, Math.floor((cx + hx) / NODE_M)), Math.min(4, Math.floor((cz + hz) / NODE_M)))
    const c = crystalFor(zone, b, hash(i, j, 9))
    if (!c || hash(i, j, 7) >= c.p) continue
    const x = -hx + (i + 0.25 + hash(i, j, 8) * 0.5) * cell, z = -hz + (j + 0.25 + hash(i, j, 10) * 0.5) * cell
    const y = heightAt(x, z)
    const s = Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2
    if (s > 0.9 || y < meta.waterY + 0.4) continue
    if (trees.some(t => Math.abs(t.x - x) < 2.5 && Math.abs(t.z - z) < 2.5)) continue
    crystals.push({ x, z, y, kind: c.kind, s: 0.8 + hash(i, j, 11) * 0.5, rot: hash(i, j, 12) * Math.PI * 2, id: `${meta.name}:c${crystals.length}` })
  }

  // Trunk boxes in a cell grid for `solids` (the walker asks a small box many times a frame).
  const G = 16, gw = Math.ceil(sizeX / G), gh = Math.ceil(sizeZ / G)
  const grid: Box[][] = Array.from({ length: gw * gh }, () => [])
  for (const t of trees) {
    const R = TRUNK[t.kind] ?? TRUNK_R
    const b: Box = { x0: t.x - R, x1: t.x + R, z0: t.z - R, z1: t.z + R, y0: t.y - 1, y1: t.y + 3.2 }
    const gi = Math.min(gw - 1, Math.max(0, Math.floor((t.x + hx) / G))), gj = Math.min(gh - 1, Math.max(0, Math.floor((t.z + hz) / G)))
    grid[gj * gw + gi].push(b)
  }
  const border: Box[] = [
    { x0: -hx - BORDER, x1: -hx + 0.5, z0: -hz - BORDER, z1: hz + BORDER, y0: -BORDER_H, y1: BORDER_H },
    { x0: hx - 0.5, x1: hx + BORDER, z0: -hz - BORDER, z1: hz + BORDER, y0: -BORDER_H, y1: BORDER_H },
    { x0: -hx - BORDER, x1: hx + BORDER, z0: -hz - BORDER, z1: -hz + 0.5, y0: -BORDER_H, y1: BORDER_H },
    { x0: -hx - BORDER, x1: hx + BORDER, z0: hz - 0.5, z1: hz + BORDER, y0: -BORDER_H, y1: BORDER_H },
  ]
  const water: Box[] = [{ x0: -hx, x1: hx, z0: -hz, z1: hz, y0: -60, y1: meta.waterY }]

  const shape: Shape = {
    ground: heightAt,
    solids(x0, _y0, z0, x1, _y1, z1) {
      const out: Box[] = []
      const i0 = Math.max(0, Math.floor((x0 + hx) / G) - 1), i1 = Math.min(gw - 1, Math.floor((x1 + hx) / G) + 1)
      const j0 = Math.max(0, Math.floor((z0 + hz) / G) - 1), j1 = Math.min(gh - 1, Math.floor((z1 + hz) / G) + 1)
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const b of grid[j * gw + i]) out.push(b)
      for (const b of border) if (b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0) out.push(b)
      return out
    },
    water: () => water,
  }
  return { meta, h, biomes, heightAt, biomeAt, canopyAt, trees, crystals, shape }
}

/** Browser loader: the three files export_wilds.py writes. */
export async function loadWilds(name: string, base = '/open/wilds', zoneAt?: (i: number, j: number) => Zone): Promise<Wilds> {
  const [meta, bin, bio] = await Promise.all([
    fetch(`${base}/${name}.json`).then(r => { if (!r.ok) throw new Error(`wilds ${name}.json ${r.status}`); return r.json() as Promise<WildsMeta> }),
    fetch(`${base}/${name}.bin`).then(r => { if (!r.ok) throw new Error(`wilds ${name}.bin ${r.status}`); return r.arrayBuffer() }),
    fetch(`${base}/${name}.biome`).then(r => { if (!r.ok) throw new Error(`wilds ${name}.biome ${r.status}`); return r.arrayBuffer() }),
  ])
  return parseWilds(meta, new Int16Array(bin), new Uint8Array(bio), zoneAt)
}

/** The tile's centre in CONTINENT world coordinates (continent.json: origin at the centre, 10 m per source px).
 *  Tile-local (0,0) is this point, so world = local + tileCentre. Shared by the fog and the continent map. */
export function tileCentreWorld(meta: WildsMeta): { x: number; z: number } {
  const s = meta.source, m = s.mPerPx ?? 10
  return { x: ((s.x0 + s.x1) / 2) * m - 11670 / 2, z: ((s.y0 + s.y1) / 2) * m - 7830 / 2 }
}

/** May a body of radius r stand at (x, z): dry land inside the tile, no trunk. `shape.solids` hands back a whole
 *  16 m bucket of trunks, so this filters to the ones that actually overlap. */
export function walkableIn(W: Wilds, x: number, z: number, r = 0.3): boolean {
  if (Math.abs(x) > W.meta.sizeX / 2 - 3 || Math.abs(z) > W.meta.sizeZ / 2 - 3) return false
  if (!Number.isFinite(W.heightAt(x, z)) || W.biomeAt(x, z) === BIOME.water) return false
  return !W.shape.solids(x - r, -1e3, z - r, x + r, 1e3, z + r).some(b => b.x0 <= x + r && b.x1 >= x - r && b.z0 <= z + r && b.z1 >= z - r)
}
