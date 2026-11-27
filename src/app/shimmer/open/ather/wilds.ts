// A tile of THE WILDS — the continent's land in the Ather's state (world/ather.md, RULED 2026-09-07: same land,
// two states). Exported by tools/worldmap/export_wilds.py from the SAME height.npy the driving regions read; no roads,
// no places, no mortal names. x east, z south, origin at the tile's centre.
//
// ★ PURE. No three, no react, no DOM: the page, the tests and one day a server read the same numbers.
// ★ What you see is what you stand on: `heightAt` interpolates the SAME two triangles per cell the mesh draws,
//   split on the (i,j)→(i+1,j+1) diagonal (land.ts / region.ts rule).

import { meteredFetch } from '../shared/load-progress'   // M187
import { treeFor, TRUNK, type Zone, type TreeKind } from './forestry'
import { crystalFor, idRoll, stoneChain, type CrystalKind } from './prospecting'
import type { Box, Shape } from '../terrain-world'
import { VOIDED_W, type VoidField } from './wilds-voids'
import { relieve, outcropsIn, outcropRoll } from './relief'
import { addEdits, ponds as pondsOf, fallSheets, fallLines, type TileEdits, type WaterMap, type PondCell, type FallMap, type Sheet } from './wilds-edits'
import type { RoadField } from './network'
import { NZ_CELL, NZ_NONE, nzCell, nzKey, zoneOf, slotLive, SLOTS_MAX, type NodeZones } from './node-zones'   // BETA M86

/** Biome ids, matched to export_wilds.py. What a biome is FOR: what you gather there, what a waymark there sends
 *  home. The numbers are the file format; the names are build vocabulary, not canon place names. */
export const BIOME = { water: 0, shore: 1, meadow: 2, woods: 3, rock: 4 } as const
/** Share of the standing M16 outcrops that carry one crystal node (relief.ts outcrops; ~0.45 per 60 m square stand). */
export const OUTCROP_CRYSTAL_P = 0.5
export type BiomeId = (typeof BIOME)[keyof typeof BIOME]
export const BIOME_NAME: Record<BiomeId, string> = { 0: 'water', 1: 'shore', 2: 'meadow', 3: 'woods', 4: 'rock' }

export interface WildsMeta {
  name: string; cell: number; nx: number; nz: number; sizeX: number; sizeZ: number; waterY: number
  source: { x0: number; y0: number; x1: number; y1: number; mPerPx: number }
}

/** A tree: trunk centre + crown size + which of the Ather's four it is (forestry.ts). Deterministic from the tile, so
 *  the page draws, the walker bumps and a prune finds the same one; `id` = tile:index is what a prune is saved under. */
export interface Tree { x: number; z: number; y: number; tall: number; r: number; kind: TreeKind; id: string; /** M153 s1b, a Glade node: its own reset (ms) instead of the dial's */ waitMs?: number }
/** A crystal node on the rock (prospecting.ts): where, which, how big, its turn. `id` = tile:c<index> is what a fracture
 *  is saved under. Deterministic from the tile, like a tree. */
export interface Crystal { x: number; z: number; y: number; kind: CrystalKind; s: number; rot: number; id: string; waitMs?: number }

export interface Wilds {
  meta: WildsMeta
  /** M62 s2: the owner's painted water, wet cells (tile-local grid + level) and their swim boxes; absent = none */
  ponds?: PondCell[]
  pondBoxes?: Box[]
  /** M62 s3: waterfalls (wilds-edits fallSheets), tile-local */
  sheets?: Sheet[]
  h: Float32Array
  biomes: Uint8Array
  heightAt(x: number, z: number): number
  biomeAt(x: number, z: number): BiomeId
  /** Woods fraction 0..1 around a point: the canopy, for the sky rig's gloom. */
  canopyAt(x: number, z: number): number
  trees: Tree[]
  crystals: Crystal[]
  shape: Shape
  /** M41: per cell, 1 where the crust is gone (a cloud void: drawn dark, no tree or crystal). Absent when the tile has no voids. */
  voided?: Uint8Array
  /** void v2: per VERTEX (nx * nz), how far the pit carve lowered the land here (0 off the void). wilds-scene darkens the cliff by it. */
  voidDrop?: Float32Array
}

const TRUNK_R = 0.35
/** a tree's size by kind: a dawnwood is an old giant, a starwillow a slim weeping one */
const bigOf = (k: TreeKind) => (k === 'dawnwood' ? 1.55 : k === 'shimmeroak' ? 1.2 : k === 'starwillow' ? 0.95 : 1)
/** The tile's edge: a wall the walker leans on, never a fall (a fall is the PLOT's edge, and it means home). */
const BORDER = 2, BORDER_H = 400

const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 2246822519) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** `zoneAt(i, j)`: the zone of the tile's 200 m node (i, j) (tiles.json, zone_wilds.py); absent = every node meadows. */
/** `clear(x, z)` in WORLD coords (tile-local + the tile's centre): no tree stands there (the path network: paths,
 *  settlements, the fair's ground). Ids are counted as if it stood, so a prune saved before the paths still finds its
 *  tree, and crystals still dodge it, so no crystal moved either. */
type ParseArgs = [meta: WildsMeta, dm: Int16Array, biomes: Uint8Array, zoneAt?: (i: number, j: number) => Zone, clear?: (x: number, z: number) => boolean, relief?: boolean, roads?: RoadField | null, voids?: VoidField | null, edits?: TileEdits | null, water?: WaterMap | null, falls?: FallMap | null, nodeZones?: NodeZones | null]
export function parseWilds(...a: ParseArgs): Wilds {
  const g = parseSteps(...a)
  for (;;) { const r = g.next(); if (r.done) return r.value }
}
/** Yield to the browser's task queue without setTimeout's 4 ms nesting clamp (a MessageChannel round trip). */
const yieldTask = () => new Promise<void>(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => { ch.port1.close(); res() }; ch.port2.postMessage(0) })
/** ★ M44 part 3: the SAME parse, cut into slices of ~`budgetMs` of main thread, so a tile streaming in while the keeper walks
 *  never holds a frame (the parse was one 175-285 ms task per tile, three per crossing). Output is identical to parseWilds by
 *  construction: both drain the one generator below, this one just lets frames run between its rows. */
export async function parseWildsSliced(a: ParseArgs, budgetMs = 6): Promise<Wilds> {
  const g = parseSteps(...a)
  for (;;) {
    const t0 = performance.now()
    for (;;) { const r = g.next(); if (r.done) return r.value; if (performance.now() - t0 > budgetMs) break }
    await yieldTask()
  }
}
/** The parse, as a generator that yields after each row of its heavy loops (relief + void carve, voids, trees, crystals). */
function* parseSteps(meta: WildsMeta, dm: Int16Array, biomes: Uint8Array, zoneAt: (i: number, j: number) => Zone = () => 'meadows', clear?: (x: number, z: number) => boolean, relief = true, roads?: RoadField | null, voids?: VoidField | null, edits?: TileEdits | null, waterMap?: WaterMap | null, fallMap?: FallMap | null, nodeZones?: NodeZones | null): Generator<void, Wilds, void> {
  const { nx, nz, cell, sizeX, sizeZ } = meta
  if (dm.length !== nx * nz) throw new Error(`wilds ${meta.name}: ${dm.length} heights, want ${nx * nz}`)
  if (biomes.length !== (nx - 1) * (nz - 1)) throw new Error(`wilds ${meta.name}: ${biomes.length} biome cells, want ${(nx - 1) * (nz - 1)}`)
  const hx = sizeX / 2, hz = sizeZ / 2
  const ox = ((meta as WildsMeta & { tx?: number }).tx ?? 0) * 1000, oz = ((meta as WildsMeta & { ty?: number }).ty ?? 0) * 1000
  // RAW heights (the file) and the RELIEVED ones everyone stands on (relief.ts, BETA M16). The raw copy only decides which
  // trees and crystals count, so their saved ids (prunes, fractures) never move when the relief is tuned.
  const raw = new Float32Array(dm.length), h = new Float32Array(dm.length)
  let voidDrop: Float32Array | undefined
  for (let k = 0; k < dm.length; k++) raw[k] = dm[k] / 10
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i
    h[k] = relief ? relieve(-hx + i * cell + ox, -hz + j * cell + oz, raw[k], meta.waterY, clear, roads) : raw[k]
    if (voids) {   // M41: the crust is gone between zones (v2 11-23: a real pit, wilds-voids VOID_DEPTH)
      const c = voids.carve(-hx + i * cell + ox, -hz + j * cell + oz, h[k], meta.waterY)
      if (c < h[k]) { voidDrop ??= new Float32Array(dm.length); voidDrop[k] = h[k] - c }
      h[k] = c
    }
    if (i === nx - 1) yield
  }
  const carved = voidDrop ? h.slice() : null   // the pit as carved, before the owner's edits (a raised cell is no longer void)
  // BETA M62: the owner's EDIT LAYER (wilds-edits.ts), after relief + carve: everything below (voids, trees, crystals, the walker,
  // Hollows) stands on the edited ground; raw[] is untouched, so tree and crystal ids never move
  addEdits(h, edits)
  // a cell is void where it sits in the deep (centre weight >= VOIDED_W) and no owner edit raised a corner back out of the pit
  // (wilds-scene draws it dark; no tree or crystal stands there)
  let voided: Uint8Array | undefined
  if (voids && carved) {   // no carve anywhere on the tile = no pit = no void cells
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      if (i === 0) yield
      const k = j * nx + i
      const wy = meta.waterY   // a lake in the void is not dug out (VOID_SHORE) but its bed is still void floor, as in v1
      if (!voidDrop![k] && !voidDrop![k + 1] && !voidDrop![k + nx] && !voidDrop![k + nx + 1] && h[k] > wy && h[k + 1] > wy && h[k + nx] > wy && h[k + nx + 1] > wy) continue
      if (h[k] > carved[k] + 0.5 || h[k + 1] > carved[k + 1] + 0.5 || h[k + nx] > carved[k + nx] + 0.5 || h[k + nx + 1] > carved[k + nx + 1] + 0.5) continue
      const w = voids.weight(-hx + (i + 0.5) * cell + ox, -hz + (j + 0.5) * cell + oz)
      if (w >= VOIDED_W) { voided ??= new Uint8Array((nx - 1) * (nz - 1)); voided[j * (nx - 1) + i] = 1 }
    }
  }
  const sampler = (H: Float32Array) => (x: number, z: number): number => {
    const fx = Math.min(nx - 1 - 1e-6, Math.max(0, (x + hx) / cell)), fz = Math.min(nz - 1 - 1e-6, Math.max(0, (z + hz) / cell))
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j
    const h00 = H[j * nx + i], h10 = H[j * nx + i + 1], h01 = H[(j + 1) * nx + i], h11 = H[(j + 1) * nx + i + 1]
    return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v
  }
  const heightAt = sampler(h), rawAt = sampler(raw)
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
  const trees: Tree[] = [], stood: { x: number; z: number }[] = []
  const NODE_M = 200
  const slopeOf = (at: (x: number, z: number) => number, x: number, z: number) => Math.hypot(at(x + 1, z) - at(x - 1, z), at(x, z + 1) - at(x, z - 1)) / 2
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    if (i === 0) yield
    const b = biomes[j * cw + i]
    const cx = -hx + (i + 0.5) * cell, cz = -hz + (j + 0.5) * cell
    const zone = zoneAt(Math.min(4, Math.floor((cx + hx) / NODE_M)), Math.min(4, Math.floor((cz + hz) / NODE_M)))
    const t = treeFor(zone, b, canopy[j * cw + i], hash(i, j, 6))
    if (!t || hash(i, j, 1) >= t.p) continue
    const x = -hx + (i + 0.2 + hash(i, j, 2) * 0.6) * cell, z = -hz + (j + 0.2 + hash(i, j, 3) * 0.6) * cell
    // which trees COUNT is decided on the raw land (ids stable); where they stand is the relieved land
    if (slopeOf(rawAt, x, z) > 0.6 || rawAt(x, z) < meta.waterY + 1) continue
    const y = heightAt(x, z)
    const big = bigOf(t.kind)
    const id = `${meta.name}:${stood.length}`; stood.push({ x, z })
    if (voids && voids.weight(x + ox, z + oz) > 0) continue   // M41: none on the lip of a cloud void
    if (voids && voids.weight(x + ox, z + oz) > 0) continue   // M41: none on the lip of a cloud void
    if (clear?.(x + ox, z + oz)) continue   // (M40 kept them off Moonwell Glade; the Glade left the Wilds in M67 s1b-2)
    if (slopeOf(heightAt, x, z) > 0.9) continue   // an outcrop's flank holds no tree (its id still counted above)
    trees.push({ x, z, y, tall: (5 + hash(i, j, 4) * 5) * big, r: (1.6 + hash(i, j, 5) * 1.2) * big, kind: t.kind, id })
  }

  // Crystals: by ZONE on the crag (prospecting.ts › crystalFor), never under the water line or on a cliff face, never
  // inside a trunk. Their own hash salts, so adding them moved no tree.
  const crystals: Crystal[] = []
  let cn = 0   // crystal ids count on the raw land, like trees (relief.ts never renumbers a saved fracture)
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    if (i === 0) yield
    const b = biomes[j * cw + i]
    const cx = -hx + (i + 0.5) * cell, cz = -hz + (j + 0.5) * cell
    const zone = zoneAt(Math.min(4, Math.floor((cx + hx) / NODE_M)), Math.min(4, Math.floor((cz + hz) / NODE_M)))
    const c = crystalFor(zone, b, hash(i, j, 9))
    if (!c || hash(i, j, 7) >= c.p) continue
    const x = -hx + (i + 0.25 + hash(i, j, 8) * 0.5) * cell, z = -hz + (j + 0.25 + hash(i, j, 10) * 0.5) * cell
    if (slopeOf(rawAt, x, z) > 0.9 || rawAt(x, z) < meta.waterY + 0.4) continue
    if (stood.some(t => Math.abs(t.x - x) < 2.5 && Math.abs(t.z - z) < 2.5)) continue
    const y = heightAt(x, z), id = `${meta.name}:c${cn++}`
    if (voids && voids.weight(x + ox, z + oz) > 0) continue   // M41
    crystals.push({ x, z, y, kind: c.kind, s: 0.8 + hash(i, j, 11) * 0.5, rot: hash(i, j, 12) * Math.PI * 2, id })
  }
  // ★ CRYSTALS ON THE OUTCROPS (Alex 11-18 playtest: "I didn't see any rocky nodes"). The map's rock cells are 6% of the land
  // and NONE lie on Greg's tile or its west/south neighbours, so no crystal stood within ~1 km of the start, while the M16
  // outcrops look like rock and carried nothing. OUTCROP_CRYSTAL_P of the standing outcrops now carry ONE node on the flank,
  // in the tile's own ZONE mix (crystalFor on rock; the Thicket stays stoneless). Ids are the outcrop's GLOBAL lattice
  // square (`o<i>_<j>`), so no rock-cell id moved and a fractured outcrop crystal saves like any other.
  if (relief) for (const o of outcropsIn(-hx + ox, -hz + oz, hx + ox, hz + oz)) {
    const lx = o.x - ox, lz = o.z - oz
    const zone = zoneAt(Math.min(4, Math.max(0, Math.floor((lx + hx) / NODE_M))), Math.min(4, Math.max(0, Math.floor((lz + hz) / NODE_M))))
    const c = crystalFor(zone, BIOME.rock, outcropRoll(o, 301))
    if (!c || outcropRoll(o, 302) >= OUTCROP_CRYSTAL_P) continue
    const a = outcropRoll(o, 303) * Math.PI * 2, d = o.R * 0.55
    const x = lx + Math.cos(a) * d, z = lz + Math.sin(a) * d
    if (Math.abs(x) > hx - 2 || Math.abs(z) > hz - 2) continue
    // the outcrop must really stand here (the path / water / arrival masks flatten some away)
    let ring = 0
    for (let k = 0; k < 6; k++) ring += heightAt(lx + Math.cos(k * Math.PI / 3) * o.R * 1.6, lz + Math.sin(k * Math.PI / 3) * o.R * 1.6) / 6
    if (heightAt(lx, lz) - ring < 1.5 || rawAt(x, z) < meta.waterY + 0.4 || (voids && voids.weight(x + ox, z + oz) > 0)) continue
    crystals.push({ x, z, y: heightAt(x, z), kind: c.kind, s: 0.8 + outcropRoll(o, 304) * 0.5, rot: outcropRoll(o, 305) * Math.PI * 2, id: `${meta.name}:o${o.i}_${o.j}` })
  }

  // ★ M185 s3: STONE IN CHAINS (prospecting.ts › stoneChain). Off each crystal node / seep a string of stones may walk out, so
  // nodes come in groups. Rolled from the node's id (never moves); stone k is `<node id>s<k>`. A stone that would stand in water,
  // on a cliff, on a path, in a trunk, over a void, off the tile or on another node is skipped; the rest of the chain still walks.
  {
    const taken = new Set<string>(), key = (x: number, z: number) => `${Math.floor(x / 1.6)},${Math.floor(z / 1.6)}`
    const near = (x: number, z: number) => { const i = Math.floor(x / 1.6), j = Math.floor(z / 1.6); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (taken.has(`${i + a},${j + b}`)) return true; return false }
    for (const c of crystals) taken.add(key(c.x, c.z))
    const parents = crystals.slice()
    let n = 0
    for (const c of parents) {
      if (++n % 64 === 0) yield
      const roll = idRoll(c.id)
      const fits = (dx: number, dz: number) => {
        const x = c.x + dx, z = c.z + dz
        if (Math.abs(x) > hx - 2 || Math.abs(z) > hz - 2) return false
        if (rawAt(x, z) < meta.waterY + 0.4 || slopeOf(rawAt, x, z) > 0.9 || slopeOf(heightAt, x, z) > 1.1) return false
        if (near(x, z) || trees.some(t => Math.abs(t.x - x) < 1.8 && Math.abs(t.z - z) < 1.8)) return false
        return !((voids && voids.weight(x + ox, z + oz) > 0) || clear?.(x + ox, z + oz))
      }
      for (const { dx, dz, k } of stoneChain(roll, fits)) {
        const x = c.x + dx, z = c.z + dz
        taken.add(key(x, z))
        crystals.push({ x, z, y: heightAt(x, z), kind: 'stone', s: 0.75 + roll(30 + k) * 0.5, rot: roll(40 + k) * Math.PI * 2, id: `${c.id}s${k}` })
      }
    }
  }

  // ★ BETA M86: the owner's NODE ZONES (node-zones.ts), after everything generated stood. Skipped whole when there are none, so
  // a layer without zones parses to exactly today's nodes (node-zones.test.ts holds the digest). NO NODES cells drop what stands
  // in them (their ids simply stop existing); DENSE cells add new nodes in their own id namespace (zt / zc), never renumbering.
  if (nodeZones) yield* zoneNodes(nodeZones)
  function* zoneNodes(Z: NodeZones): Generator<void, void, void> {
    if (!Object.keys(Z).length) return
    const at = (x: number, z: number) => Z[nzKey(nzCell(x + ox), nzCell(z + oz))]
    const keep = <T extends { x: number; z: number }>(a: T[]) => { let w = 0; for (const n of a) if (at(n.x, n.z) !== NZ_NONE) a[w++] = n; a.length = w }
    keep(trees); keep(crystals)
    // spacing: no new node within GAP of any node (a trunk's box is <= 0.7 m, so a thick forest may close its crowns)
    const GAP = 1.8, taken = new Map<string, { x: number; z: number }[]>(), q = (x: number, z: number) => `${Math.floor(x / GAP)},${Math.floor(z / GAP)}`
    const take = (x: number, z: number) => { const k = q(x, z), a = taken.get(k); if (a) a.push({ x, z }); else taken.set(k, [{ x, z }]) }
    const near = (x: number, z: number) => { const i = Math.floor(x / GAP), j = Math.floor(z / GAP); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const p of taken.get(`${i + a},${j + b}`) ?? []) if (Math.hypot(p.x - x, p.z - z) < GAP) return true; return false }
    for (const n of trees) take(n.x, n.z)
    for (const n of crystals) take(n.x, n.z)
    const i0 = nzCell(-hx + ox), i1 = nzCell(hx + ox - 1e-6), j0 = nzCell(-hz + oz), j1 = nzCell(hz + oz - 1e-6)
    for (let cj = j0; cj <= j1; cj++) {
      yield
      for (let ci = i0; ci <= i1; ci++) {
        const zn = zoneOf(Z[nzKey(ci, cj)]); if (!zn || zn.type === 'none') continue
        const forest = zn.type === 'forest'
        for (let k = 0; k < SLOTS_MAX; k++) {
          const s = 500 + k * 16 + (forest ? 0 : 8)
          if (!slotLive(k, zn.perCell, hash(ci, cj, s))) continue
          const x = (ci + 0.1 + hash(ci, cj, s + 1) * 0.8) * NZ_CELL - ox, z = (cj + 0.1 + hash(ci, cj, s + 2) * 0.8) * NZ_CELL - oz
          if (Math.abs(x) > hx - 2 || Math.abs(z) > hz - 2) continue
          const zone = zoneAt(Math.min(4, Math.max(0, Math.floor((x + hx) / NODE_M))), Math.min(4, Math.max(0, Math.floor((z + hz) / NODE_M))))
          if (rawAt(x, z) < meta.waterY + (forest ? 1 : 0.4) || slopeOf(heightAt, x, z) > 0.9 || near(x, z)) continue
          if ((voids && voids.weight(x + ox, z + oz) > 0) || clear?.(x + ox, z + oz) || (voided && voided[cellOf(x, z)])) continue
          const roll = hash(ci, cj, s + 3)
          if (forest) {
            const t = treeFor(zone, BIOME.woods, 1, roll); if (!t) continue
            const big = bigOf(t.kind)
            trees.push({ x, z, y: heightAt(x, z), tall: (5 + hash(ci, cj, s + 4) * 5) * big, r: (1.6 + hash(ci, cj, s + 5) * 1.2) * big, kind: t.kind, id: `${meta.name}:zt${ci}_${cj}_${k}` })
          } else {
            const c = crystalFor(zone, BIOME.rock, roll); if (!c) continue
            crystals.push({ x, z, y: heightAt(x, z), kind: c.kind, s: 0.8 + hash(ci, cj, s + 4) * 0.5, rot: hash(ci, cj, s + 5) * Math.PI * 2, id: `${meta.name}:zc${ci}_${cj}_${k}` })
          }
          take(x, z)
        }
      }
    }
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
  // M62 s2: the owner's painted ponds (wilds-edits water) swim like the sea; their cells draw in wilds-scene (Ponds)
  const pond = pondsOf(meta, h, waterMap)
  const water: Box[] = [{ x0: -hx, x1: hx, z0: -hz, z1: hz, y0: -60, y1: meta.waterY }, ...pond.boxes]

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
  // M62 s3: falling sheets, automatic (a pond edge over lower water) + the owner's waterfall lines; wilds-scene draws them
  const sheets = pond.cells.length || fallMap ? fallSheets(meta, h, heightAt, pond.cells, fallLines(fallMap)) : []
  return { meta, h, biomes, heightAt, biomeAt, canopyAt, trees, crystals, shape, voided, voidDrop, ponds: pond.cells, pondBoxes: pond.boxes, sheets }
}

/** Browser loader: the three files export_wilds.py writes. */
export async function loadWilds(name: string, base = '/open/wilds', zoneAt?: (i: number, j: number) => Zone, clear?: (x: number, z: number) => boolean, roads?: RoadField | null, voids?: VoidField | null, edits?: TileEdits | null, water?: WaterMap | null, falls?: FallMap | null, nodeZones?: NodeZones | null): Promise<Wilds> {
  const [meta, bin, bio] = await Promise.all([
    meteredFetch(`${base}/${name}.json`, 'wilds').then(r => { if (!r.ok) throw new Error(`wilds ${name}.json ${r.status}`); return r.json() as Promise<WildsMeta> }),
    meteredFetch(`${base}/${name}.bin`, 'wilds').then(r => { if (!r.ok) throw new Error(`wilds ${name}.bin ${r.status}`); return r.arrayBuffer() }),
    meteredFetch(`${base}/${name}.biome`, 'wilds').then(r => { if (!r.ok) throw new Error(`wilds ${name}.biome ${r.status}`); return r.arrayBuffer() }),
  ])
  return parseWildsSliced([meta, new Int16Array(bin), new Uint8Array(bio), zoneAt, clear, true, roads, voids, edits, water, falls, nodeZones])
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
