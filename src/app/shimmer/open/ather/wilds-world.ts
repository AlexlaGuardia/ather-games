// THE WILDS, STREAMED (Alex 11-15: "stream the wilds") — the whole continent in its Ather state, 1 km tiles that
// meet exactly (tools/worldmap/export_wilds_all.py), loaded round the keeper as they walk.
//
// ONE SPACE: tile (tx, ty) is centred at (tx·TILE_M, ty·TILE_M) in the anchor tile's frame (first-wilds = (0,0)).
// So `first-wilds` local coords ARE world coords, every saved position on it stays valid, and the fog's continent
// grid lines up by adding the anchor's centre (tileCentreWorld), exactly as before.
//
// What the world answers for everyone (walker, combat, HUD, compass): heightAt / biomeAt / canopyAt / walkable /
// shape. A tile still loading is FENCED (a wall over its square) so nobody walks into a hole; a tile that is not in
// the index is open sea (the exporter skips tiles with almost no land).
//
// ★ PURE apart from `load` (fetch). Tiles are the existing `Wilds` objects, parsed the same way.

import type { Box, Shape } from '../terrain-world'
import { parseWilds, loadWilds, BIOME, type BiomeId, type Wilds, type Tree, type Crystal } from './wilds'
import type { Zone } from './forestry'

export const TILE_M = 1000
export const SEA_FLOOR = -20
export interface TileIndexEntry { name: string; tx: number; ty: number; land: number; nodes: { id: string; biome: BiomeId; x: number; z: number; i: number; j: number; zone?: Zone }[] }
export interface TileIndex { v: 1; tileM: number; tiles: TileIndexEntry[] }

const key = (tx: number, ty: number) => `${tx},${ty}`
export const tileOf = (x: number, z: number) => ({ tx: Math.floor((x + TILE_M / 2) / TILE_M), ty: Math.floor((z + TILE_M / 2) / TILE_M) })
export const tileCentre = (tx: number, ty: number) => ({ x: tx * TILE_M, z: ty * TILE_M })

export interface WildsWorld {
  index: TileIndex
  byName: Map<string, TileIndexEntry>
  loaded: Map<string, Wilds>
  /** the entry at a tile coordinate, or undefined (= sea) */
  at(tx: number, ty: number): TileIndexEntry | undefined
  offsetOf(name: string): { x: number; z: number }
  heightAt(x: number, z: number): number
  biomeAt(x: number, z: number): BiomeId
  canopyAt(x: number, z: number): number
  walkable(x: number, z: number, r?: number): boolean
  /** trees of the loaded tiles, in world coords (for the scene; physics reads `shape`) */
  treesNear(x: number, z: number, r: number): Tree[]
  /** crystal nodes within a square of half-side r, in world coordinates */
  crystalsNear(x: number, z: number, r: number): Crystal[]
  shape: Shape
  /** the tile under a point, if loaded */
  tileAtPoint(x: number, z: number): { W: Wilds; ox: number; oz: number } | null
  /** bumped whenever a tile streams in or out */
  rev: number
  /** no tree stands where this says (the path network, network.ts › clearing); set before the first stream */
  clear?: (x: number, z: number) => boolean
}

export function makeWorld(index: TileIndex): WildsWorld {
  const byXY = new Map(index.tiles.map(t => [key(t.tx, t.ty), t]))
  const byName = new Map(index.tiles.map(t => [t.name, t]))
  const loaded = new Map<string, Wilds>()
  const at = (tx: number, ty: number) => byXY.get(key(tx, ty))
  const offsetOf = (name: string) => { const t = byName.get(name)!; return tileCentre(t.tx, t.ty) }
  const tileAtPoint = (x: number, z: number) => {
    const { tx, ty } = tileOf(x, z), t = at(tx, ty)
    if (!t) return null
    const W = loaded.get(t.name); if (!W) return null
    return { W, ox: tx * TILE_M, oz: ty * TILE_M }
  }
  const heightAt = (x: number, z: number) => {
    const { tx, ty } = tileOf(x, z), t = at(tx, ty)
    if (!t) return SEA_FLOOR
    const W = loaded.get(t.name)
    return W ? W.heightAt(x - tx * TILE_M, z - ty * TILE_M) : -Infinity
  }
  const biomeAt = (x: number, z: number): BiomeId => { const p = tileAtPoint(x, z); return p ? p.W.biomeAt(x - p.ox, z - p.oz) : BIOME.water }
  const canopyAt = (x: number, z: number) => { const p = tileAtPoint(x, z); return p ? p.W.canopyAt(x - p.ox, z - p.oz) : 0 }

  // the tiles a box touches
  const tilesIn = (x0: number, z0: number, x1: number, z1: number) => {
    const a = tileOf(x0, z0), b = tileOf(x1, z1), out: { tx: number; ty: number }[] = []
    for (let ty = a.ty; ty <= b.ty; ty++) for (let tx = a.tx; tx <= b.tx; tx++) out.push({ tx, ty })
    return out
  }
  const isBorder = (bx: Box) => bx.y1 - bx.y0 > 700   // a tile's own edge walls (wilds.ts BORDER_H): interior seams must not have them
  const shape: Shape = {
    ground: heightAt,
    solids(x0, y0, z0, x1, y1, z1) {
      const out: Box[] = []
      for (const { tx, ty } of tilesIn(x0, z0, x1, z1)) {
        const t = at(tx, ty)
        if (!t) continue
        const W = loaded.get(t.name), ox = tx * TILE_M, oz = ty * TILE_M
        if (!W) {   // in the index but still streaming: fence the whole square
          out.push({ x0: ox - TILE_M / 2, x1: ox + TILE_M / 2, z0: oz - TILE_M / 2, z1: oz + TILE_M / 2, y0: -400, y1: 400 })
          continue
        }
        for (const bx of W.shape.solids(x0 - ox, y0, z0 - oz, x1 - ox, y1, z1 - oz)) if (!isBorder(bx)) out.push({ ...bx, x0: bx.x0 + ox, x1: bx.x1 + ox, z0: bx.z0 + oz, z1: bx.z1 + oz })
      }
      return out
    },
    water(x0, _y0, z0, x1, _y1, z1) {
      const out: Box[] = []
      for (const { tx, ty } of tilesIn(x0, z0, x1, z1)) {
        const ox = tx * TILE_M, oz = ty * TILE_M, t = at(tx, ty)
        const wy = t ? (loaded.get(t.name)?.meta.waterY ?? 0) : 0
        out.push({ x0: ox - TILE_M / 2, x1: ox + TILE_M / 2, z0: oz - TILE_M / 2, z1: oz + TILE_M / 2, y0: SEA_FLOOR - 40, y1: wy })
      }
      return out
    },
  }
  const walkable = (x: number, z: number, r = 0.3) => {
    if (!Number.isFinite(heightAt(x, z)) || biomeAt(x, z) === BIOME.water) return false
    return !shape.solids(x - r, -1e3, z - r, x + r, 1e3, z + r).some(b => b.x0 <= x + r && b.x1 >= x - r && b.z0 <= z + r && b.z1 >= z - r)
  }
  const treesNear = (x: number, z: number, r: number) => {
    const out: Tree[] = []
    for (const { tx, ty } of tilesIn(x - r, z - r, x + r, z + r)) {
      const t = at(tx, ty), W = t && loaded.get(t.name); if (!W) continue
      for (const tr of W.trees) { const wx = tr.x + tx * TILE_M, wz = tr.z + ty * TILE_M; if (Math.abs(wx - x) < r && Math.abs(wz - z) < r) out.push({ ...tr, x: wx, z: wz }) }
    }
    return out
  }
  const crystalsNear = (x: number, z: number, r: number) => {
    const out: Crystal[] = []
    for (const { tx, ty } of tilesIn(x - r, z - r, x + r, z + r)) {
      const t = at(tx, ty), W = t && loaded.get(t.name); if (!W) continue
      for (const tr of W.crystals) { const wx = tr.x + tx * TILE_M, wz = tr.z + ty * TILE_M; if (Math.abs(wx - x) < r && Math.abs(wz - z) < r) out.push({ ...tr, x: wx, z: wz }) }
    }
    return out
  }
  return { index, byName, loaded, at, offsetOf, heightAt, biomeAt, canopyAt, walkable, treesNear, crystalsNear, shape, tileAtPoint, rev: 0 }
}

/** Which tiles should be loaded for a keeper at (x, z): their tile and its eight neighbours that exist. */
export function wanted(w: WildsWorld, x: number, z: number, ring = 1): string[] {
  const { tx, ty } = tileOf(x, z), out: string[] = []
  for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) { const t = w.at(tx + dx, ty + dy); if (t) out.push(t.name) }
  return out
}

/** Stream: load what is wanted, drop what is two rings away. Returns true if anything changed. */
/** A tile's zones off the index (zone_wilds.py stamped them): node (i, j) → zone; no node there = meadows. */
export function zonesOf(w: WildsWorld, name: string): (i: number, j: number) => Zone {
  const t = w.byName.get(name), m = new Map<string, Zone>()
  for (const n of t?.nodes ?? []) if (n.zone) m.set(`${n.i},${n.j}`, n.zone)
  return (i, j) => m.get(`${i},${j}`) ?? 'meadows'
}

export async function stream(w: WildsWorld, x: number, z: number, load: (name: string) => Promise<Wilds> = n => loadWilds(n, '/open/wilds', zonesOf(w, n), w.clear)): Promise<boolean> {
  const want = new Set(wanted(w, x, z)), keep = new Set(wanted(w, x, z, 2))
  let changed = false
  for (const name of [...w.loaded.keys()]) if (!keep.has(name)) { w.loaded.delete(name); changed = true }
  await Promise.all([...want].filter(n => !w.loaded.has(n)).map(async n => { try { w.loaded.set(n, await load(n)); changed = true } catch { /* retried next tick */ } }))
  if (changed) w.rev++
  return changed
}

export async function loadIndex(base = '/open/wilds'): Promise<TileIndex> {
  const r = await fetch(`${base}/tiles.json`); if (!r.ok) throw new Error(`wilds index ${r.status}`)
  return r.json()
}
export { parseWilds }
