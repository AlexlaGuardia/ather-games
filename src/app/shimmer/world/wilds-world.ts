// wilds-world.ts — THE WILDS AS ONE PLACE (phase 3: the seams between regions).
//
// ── WHAT PHASE 3 IS ACTUALLY FIXING ───────────────────────────────────────────
// Phase 1 generated a region. Phase 2 bounded what renders. Each region was still its own
// ZONE, which means the border between two patches of open grassland was a DOOR — walk into
// the grass, take a load, arrive somewhere else. That is the right treatment for the Outfields
// seam (leaving the tended world is an event) and the wrong one for a border the fiction does
// not draw at all. Canon calls the Wilds *"the persistent, walkable, open-world overland"*;
// an overland you warp across is not one.
//
// ── THE MOVE: A REGION FILE IS AN AUTHORING UNIT, NOT A RUNTIME UNIT ──────────
// 400x400 is the size Alex can hold in the MapEditor. It is not a thing the player should be
// able to feel. So the files stay exactly as they are — one JSON per region, own nodes, own
// burrows, own gates, all in LOCAL coordinates — and this module presents them to the game as
// a single zone in WORLD coordinates. Region (rx,ry) local (lx,ly) is world (rx*400+lx, ...).
// Everything downstream (collision, warps, chunking, the camera) keeps working in one flat
// grid and never learns that regions exist.
//
// ── ★ THE PROPERTY THAT HAD TO SURVIVE ────────────────────────────────────────
// Phase 2's whole point was "mounted chunks are bounded by the RADIUS, not by the world".
// Handing the renderer a world-sized grid would have quietly given that back: a 36-region
// Wilds is 5.76M cells, and MEASURED it is ~132MB of heap to hold the grid plus the working
// copy the engine makes. That survives a desktop and kills a phone tab, and the phone is a
// primary device here. So the same property is repeated one layer down: **the grid is
// world-sized in INDEX space but only holds real rows for the regions the load window
// reaches.** Everything else is one shared frozen cloud row. Measured, a region decodes and
// blits in ~3ms, so crossing a border costs a few ms, once.
//
// ── THE CEILING, STATED RATHER THAN DISCOVERED LATER ──────────────────────────
// Sparsity here is per-ROW, and a materialized row is as wide as the WORLD. So the cost is
// (row bands loaded x world width), NOT region count: at most 3 bands are ever live (a 512-tile
// load window straddles up to two 400-tile borders), which at the stated 30-region target
// (2400 wide) is ~2.9M live cells ≈ 23MB and stays there however far you walk. Widen the world
// past ~10 regions and this stops paying, because a row costs the full width whether or not any
// of it is near you — at which point rows need column banding or a typed-array backing. The
// oracle asserts the 30-region number so a future widening trips a test instead of a phone.
//
// Unloaded country reading as CLOUD is not a placeholder — it is the honest answer. Cloud is
// solid, so a player can never walk into country that has not arrived. The load window is
// deliberately wider than the view window (below), so that wall is always past the fog.
//
// ── WHY THE SHARED ROW IS FROZEN ──────────────────────────────────────────────
// One row object is shared by every unloaded row in the world. A stray write into it would
// paint one tile into thousands of places at once — invisible, world-wide, and nearly
// impossible to trace back. Frozen, that same mistake throws on the line that made it. Write
// paths go through `materializeRows` first, which is the only correct way to touch a sparse
// grid anyway.
//
// Pure: no THREE, no React, no I/O. Region bytes arrive through a `load` callback so this
// whole file can be proved headless.

import { CHUNK, DEFAULT_RADIUS } from './chunk-stream'

/** Tiles per region edge — the authoring unit, and the stride of the world grid. */
export const WILDS_REGION = 400

/** The one zone id the whole Wilds answers to. Regions are not zones any more. */
export const WILDS_ZONE_ID = 'wilds'

/** Solid cloud — what unloaded country reads as. Must match `wilds-gen`'s WILDS_FILL. */
export const WILDS_CLOUD = 34

/**
 * How far past the view window regions are kept loaded.
 *
 * The load window MUST be wider than the view window or the player walks into an invisible
 * wall of not-yet-arrived country while still able to see grass on the other side. One chunk
 * of margin is enough: the view reaches `DEFAULT_RADIUS * CHUNK` tiles, the load reaches one
 * chunk further, and a region is 400 tiles wide so this is normally 1 region, 4 at a corner.
 */
export const WILDS_LOAD_MARGIN = CHUNK

/** Tiles from the player that must be loaded. */
export const wildsLoadRadius = (radius = DEFAULT_RADIUS): number => radius * CHUNK + WILDS_LOAD_MARGIN

// ── region ids ────────────────────────────────────────────────────────────────────────────

const WILDS_ID = /^wilds-(-?\d+)-(-?\d+)$/

/** `wilds-3-1` → {rx:3, ry:1}. Anything else → null (it is not a Wilds region). */
export function parseWildsId(id: string): { rx: number; ry: number } | null {
  const m = WILDS_ID.exec(id)
  return m ? { rx: Number(m[1]), ry: Number(m[2]) } : null
}

export const wildsIdOf = (rx: number, ry: number): string => `wilds-${rx}-${ry}`

// ── geometry ──────────────────────────────────────────────────────────────────────────────

export interface WildsRegionRef { id: string; rx: number; ry: number }

export interface WildsGeometry {
  regions: WildsRegionRef[]
  /** the north-west region on the world grid — world tile (0,0) is this region's local (0,0) */
  originRx: number
  originRy: number
  cols: number
  rows: number
  region: number
}

/**
 * The world grid implied by the region files that exist.
 *
 * Region coordinates may be negative (the world can grow north or west), so the grid is
 * anchored at the north-west-most region rather than at region 0,0. Growing the world in any
 * direction is a re-derive of this, not a migration.
 */
export function wildsGeometry(ids: string[], region = WILDS_REGION): WildsGeometry {
  const regions: WildsRegionRef[] = []
  for (const id of ids) {
    const rc = parseWildsId(id)
    if (rc) regions.push({ id, rx: rc.rx, ry: rc.ry })
  }
  if (!regions.length) return { regions, originRx: 0, originRy: 0, cols: 0, rows: 0, region }
  const originRx = Math.min(...regions.map(r => r.rx))
  const originRy = Math.min(...regions.map(r => r.ry))
  const maxRx = Math.max(...regions.map(r => r.rx))
  const maxRy = Math.max(...regions.map(r => r.ry))
  return {
    regions,
    originRx, originRy,
    cols: (maxRx - originRx + 1) * region,
    rows: (maxRy - originRy + 1) * region,
    region,
  }
}

/** Where a region's north-west corner sits on the world grid. */
export function regionOrigin(geo: WildsGeometry, rx: number, ry: number): { x: number; y: number } {
  return { x: (rx - geo.originRx) * geo.region, y: (ry - geo.originRy) * geo.region }
}

/** A region-local tile in world coordinates. */
export function regionToWorld(geo: WildsGeometry, rx: number, ry: number, lx: number, ly: number): { x: number; y: number } {
  const o = regionOrigin(geo, rx, ry)
  return { x: o.x + lx, y: o.y + ly }
}

/**
 * A world tile back to the region that owns it. Null when it falls outside the world —
 * `Math.floor` so the answer stays correct if a caller ever passes a negative.
 */
export function worldToRegion(geo: WildsGeometry, wx: number, wy: number): { id: string; rx: number; ry: number; lx: number; ly: number } | null {
  if (wx < 0 || wy < 0 || wx >= geo.cols || wy >= geo.rows) return null
  const rx = geo.originRx + Math.floor(wx / geo.region)
  const ry = geo.originRy + Math.floor(wy / geo.region)
  return { id: wildsIdOf(rx, ry), rx, ry, lx: wx - (rx - geo.originRx) * geo.region, ly: wy - (ry - geo.originRy) * geo.region }
}

// ── sparse grids ──────────────────────────────────────────────────────────────────────────

const SHARED_ROWS = new Map<string, number[]>()
const IS_SHARED = new WeakSet<number[]>()

/**
 * The one row object every unloaded row in the world points at.
 *
 * Frozen on purpose: see the header. A write here would be a world-wide, invisible corruption;
 * frozen it is a throw on the offending line instead.
 */
export function sharedRow(cols: number, fill: number): number[] {
  const key = `${cols}:${fill}`
  let row = SHARED_ROWS.get(key)
  if (!row) {
    row = Object.freeze(new Array<number>(cols).fill(fill)) as number[]
    SHARED_ROWS.set(key, row)
    IS_SHARED.add(row)
  }
  return row
}

/** Is this row the shared sentinel (i.e. country that has not been loaded)? */
export const isSharedRow = (row: number[] | undefined): boolean => !!row && IS_SHARED.has(row)

/** A world-sized grid holding no real data yet — allocation is O(rows), not O(rows*cols). */
export function sparseGrid(rows: number, cols: number, fill: number): number[][] {
  const row = sharedRow(cols, fill)
  const out = new Array<number[]>(rows)
  for (let y = 0; y < rows; y++) out[y] = row
  return out
}

/**
 * Copy a grid the way the engine's working copy needs to, WITHOUT materializing the world.
 *
 * The engine deep-copies `zone.grid` so paint edits do not mutate the module-level zone. Done
 * naively (`grid.map(row => [...row])`) that allocates every unloaded row and throws the whole
 * sparse property away on the first frame — the exact bug this module exists to avoid. Shared
 * rows are passed through by identity; real rows are copied.
 */
export function cloneSparseGrid(grid: number[][]): number[][] {
  const out = new Array<number[]>(grid.length)
  for (let y = 0; y < grid.length; y++) out[y] = isSharedRow(grid[y]) ? grid[y] : [...grid[y]]
  return out
}

/**
 * Give rows y0..y1 real storage so they can be written to.
 *
 * Every write path into a possibly-sparse grid calls this first. It is a no-op for rows that
 * are already real, so ordinary (non-streaming) zones pay one WeakSet lookup per row and
 * nothing else — which is why the callers can just always call it rather than branching on
 * whether this zone happens to be the Wilds.
 */
export function materializeRows(grid: number[][], y0: number, y1: number): void {
  for (let y = Math.max(0, y0); y <= Math.min(grid.length - 1, y1); y++) {
    if (isSharedRow(grid[y])) grid[y] = [...grid[y]]
  }
}

// ── mounting ──────────────────────────────────────────────────────────────────────────────

/** Which regions the load window touches, given the player's world tile. */
export function regionsInWindow(geo: WildsGeometry, wx: number, wy: number, radiusTiles = wildsLoadRadius()): WildsRegionRef[] {
  const r = geo.region
  const rx0 = geo.originRx + Math.floor((wx - radiusTiles) / r)
  const rx1 = geo.originRx + Math.floor((wx + radiusTiles) / r)
  const ry0 = geo.originRy + Math.floor((wy - radiusTiles) / r)
  const ry1 = geo.originRy + Math.floor((wy + radiusTiles) / r)
  const out: WildsRegionRef[] = []
  for (const reg of geo.regions) {
    if (reg.rx >= rx0 && reg.rx <= rx1 && reg.ry >= ry0 && reg.ry <= ry1) out.push(reg)
  }
  // near-to-far, same reasoning as visibleChunks: the region under the player's feet first.
  const cx = (wx / r) + geo.originRx, cy = (wy / r) + geo.originRy
  out.sort((a, b) => (Math.abs(a.rx - cx) + Math.abs(a.ry - cy)) - (Math.abs(b.rx - cx) + Math.abs(b.ry - cy)))
  return out
}

/** What is currently materialized into a grid. Travels with the working copy, not the zone. */
export interface WildsMount {
  geo: WildsGeometry
  loaded: Set<string>
}

export const newMount = (geo: WildsGeometry): WildsMount => ({ geo, loaded: new Set() })

/**
 * Bring the grid in line with where the player is standing: blit in the regions the load
 * window now reaches, and hand back the ones it no longer does.
 *
 * `load` returns a region's decoded LOCAL grid (or null if its file is missing) — keeping the
 * bytes behind a callback is what lets this be tested with nothing but numbers.
 *
 * Releasing writes the shared row back, so the memory a region cost is actually returned
 * rather than merely stopping growing. ⚠ That also discards anything painted there in the
 * in-game sculpt editor; region edits belong in the MapEditor, which works on the files.
 */
export function syncWilds(
  mount: WildsMount, grid: number[][], wx: number, wy: number,
  load: (id: string) => number[][] | null,
  radiusTiles = wildsLoadRadius(), fill = WILDS_CLOUD,
): { mounted: string[]; released: string[] } {
  const geo = mount.geo
  const want = regionsInWindow(geo, wx, wy, radiusTiles)
  const wantIds = new Set(want.map(r => r.id))
  const mounted: string[] = [], released: string[] = []

  for (const id of [...mount.loaded]) {
    if (wantIds.has(id)) continue
    const rc = parseWildsId(id)
    if (!rc) continue
    mount.loaded.delete(id)
    released.push(id)
    const o = regionOrigin(geo, rc.rx, rc.ry)
    // ★ Regions on the same world ROW BAND share row objects. Collapsing this region's rows
    // straight back to the shared row would blank its east/west neighbour too — which looks
    // exactly like the world falling away behind you as you walk. Only collapse the band when
    // nobody is left standing in it; otherwise clear this region's COLUMNS and leave the row.
    const bandOccupied = [...mount.loaded].some(other => parseWildsId(other)?.ry === rc.ry)
    const row = sharedRow(geo.cols, fill)
    for (let y = 0; y < geo.region; y++) {
      const wyi = o.y + y
      if (wyi < 0 || wyi >= grid.length) continue
      if (!bandOccupied) { grid[wyi] = row; continue }
      if (isSharedRow(grid[wyi])) continue
      const dst = grid[wyi]
      for (let x = o.x; x < o.x + geo.region && x < dst.length; x++) dst[x] = fill
    }
  }

  for (const reg of want) {
    if (mount.loaded.has(reg.id)) continue
    const src = load(reg.id)
    if (!src) continue
    const o = regionOrigin(geo, reg.rx, reg.ry)
    for (let y = 0; y < src.length; y++) {
      const wyi = o.y + y
      if (wyi < 0 || wyi >= grid.length) continue
      // A row shared with other unloaded country cannot be written into — give it storage
      // first. A row that is already real belongs to a neighbouring region and is written
      // through, which is what makes two regions share a row band without fighting.
      if (isSharedRow(grid[wyi])) grid[wyi] = [...grid[wyi]]
      const dst = grid[wyi], s = src[y]
      for (let x = 0; x < s.length; x++) {
        const wxi = o.x + x
        if (wxi >= 0 && wxi < dst.length) dst[wxi] = s[x]
      }
    }
    mount.loaded.add(reg.id)
    mounted.push(reg.id)
  }
  return { mounted, released }
}

/**
 * How many rows actually hold data — the honest memory measure, and the number that must stay
 * flat as the world grows. Tests assert on this rather than on anything hand-counted.
 */
export function materializedRows(grid: number[][]): number {
  let n = 0
  for (const row of grid) if (!isSharedRow(row)) n++
  return n
}
