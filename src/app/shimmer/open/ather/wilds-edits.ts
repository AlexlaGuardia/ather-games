// ── THE WILDS EDIT LAYER (BETA M62, Alex 11-21: a terrain editor in the dev tools that edits the REAL Wilds) ──
// Engine first built for M38 (365fa301, an in-game B editor Alex killed); M62 keeps the layer and moves the sculpting into an
// owner page, /shimmer/dev?mode=terrain (dev/editors/TerrainEditor.tsx).
// The exported 1 km tiles (.bin) are never rewritten. Edits are a sparse HEIGHT DELTA per grid vertex, in decimetres, stored in
// world/wilds-edits.json ({ v: 1, tiles: { <tile>: { <vertex k = j*nx+i>: dm } } }), read at RUNTIME (GET /shimmer/open/wilds-edits)
// and saved by the owner (POST /shimmer/save-wilds-edit, owner-gated by the save-* prefix). parseWilds adds a tile's deltas to
// its heights AFTER relief and the void carve, so what you stand on, the mesh, trees, crystals and Hollows all take the edited
// ground, while the RAW heights (which decide tree and crystal ids) never move. A re-export keeps the edits: they are deltas.
//
// ★ The brush math and the undo history below are PURE (no React, no three, no fetch): node tests drive them (wilds-edits.test.ts).

export type TileEdits = Record<string, number>          // vertex k -> delta (dm)
export type Edits = Record<string, TileEdits>           // tile name -> its edits
export const EDIT_MAX_DM = 600                           // +-60 m: a brush can make a cliff, not a mountain range
export type Brush = 'raise' | 'lower' | 'flatten' | 'smooth'
export const BRUSHES: Brush[] = ['raise', 'lower', 'flatten', 'smooth']

/** A tile as the brush sees it: its centre in world coords and its grid. */
export interface BrushTile { name: string; ox: number; oz: number; nx: number; nz: number; cell: number; sizeX: number; sizeZ: number }
export interface Stroke { kind: Brush; x: number; z: number; r: number; s: number; /** flatten: the height under the stroke's start */ target?: number }

const clampDm = (v: number) => Math.max(-EDIT_MAX_DM, Math.min(EDIT_MAX_DM, Math.round(v)))
/** 1 at the centre, 0 at the rim, smooth both ends */
export const falloff = (d: number, r: number) => { const t = Math.max(0, 1 - d / r); return t * t * (3 - 2 * t) }

/** One application of a brush. Reads the CURRENT edited ground (`heightAt`, world coords) and the current edits; returns the
 *  NEW delta of every vertex it touched, per tile (a vertex on a shared tile edge is touched in both tiles, so seams agree).
 *  `s` = metres at the centre per application (raise / lower); flatten and smooth move halfway toward their goal, scaled by
 *  min(1, s) so a light strength is a light touch there too. */
export function applyBrush(heightAt: (x: number, z: number) => number, tiles: BrushTile[], cur: Edits, st: Stroke): Record<string, TileEdits> {
  const out: Record<string, TileEdits> = {}
  const pull = 0.5 * Math.min(1, st.s)
  for (const t of tiles) {
    const hx = t.sizeX / 2, hz = t.sizeZ / 2
    const i0 = Math.max(0, Math.floor((st.x - st.r - t.ox + hx) / t.cell)), i1 = Math.min(t.nx - 1, Math.ceil((st.x + st.r - t.ox + hx) / t.cell))
    const j0 = Math.max(0, Math.floor((st.z - st.r - t.oz + hz) / t.cell)), j1 = Math.min(t.nz - 1, Math.ceil((st.z + st.r - t.oz + hz) / t.cell))
    if (i0 > i1 || j0 > j1) continue
    const mine = cur[t.name] ?? {}
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = t.ox - hx + i * t.cell, z = t.oz - hz + j * t.cell
      const f = falloff(Math.hypot(x - st.x, z - st.z), st.r); if (f <= 0) continue
      const k = String(j * t.nx + i), was = mine[k] ?? 0, h = heightAt(x, z)
      if (!Number.isFinite(h)) continue
      let dm = was
      if (st.kind === 'raise') dm = was + f * st.s * 10
      else if (st.kind === 'lower') dm = was - f * st.s * 10
      else if (st.kind === 'flatten') dm = was + f * ((st.target ?? h) - h) * 10 * pull
      else {   // smooth: toward the mean of the four grid neighbours
        const c = t.cell, n = [heightAt(x + c, z), heightAt(x - c, z), heightAt(x, z + c), heightAt(x, z - c)].filter(Number.isFinite)
        if (!n.length) continue
        dm = was + f * (n.reduce((a, b) => a + b, 0) / n.length - h) * 10 * pull
      }
      ;(out[t.name] ??= {})[k] = clampDm(dm)
    }
  }
  return out
}

/** Fold a brush result into the edits (a vertex back to 0 is dropped: the file stays sparse). Returns the tiles changed. */
export function mergeEdits(cur: Edits, d: Record<string, TileEdits>): string[] {
  const changed: string[] = []
  for (const [name, verts] of Object.entries(d)) {
    const m = (cur[name] ??= {})
    for (const [k, v] of Object.entries(verts)) { if (v === 0) delete m[k]; else m[k] = v }
    if (!Object.keys(m).length) delete cur[name]
    changed.push(name)
  }
  return changed
}

/** Add a tile's edits to its parsed heights in place (parseWilds, after relief + carve). Junk keys are skipped. */
export function addEdits(h: Float32Array, edits: TileEdits | null | undefined): void {
  if (!edits) return
  for (const key in edits) { const k = +key, v = edits[key]; if (Number.isInteger(k) && k >= 0 && k < h.length && Number.isFinite(v)) h[k] += v / 10 }
}

// ── UNDO: one entry per STROKE (press to release), holding the touched tiles' maps from before it ──
type Snap = Record<string, TileEdits | null>   // null = the tile had no edits
const snap = (cur: Edits, names: Iterable<string>): Snap => { const s: Snap = {}; for (const n of names) s[n] = cur[n] ? { ...cur[n] } : null; return s }
const restore = (cur: Edits, s: Snap) => { for (const [n, m] of Object.entries(s)) { if (m && Object.keys(m).length) cur[n] = { ...m }; else delete cur[n] } }
export class EditHistory {
  private past: Snap[] = []
  private future: Snap[] = []
  private open: Snap | null = null
  constructor(private limit = 100) {}
  /** before a stroke's first application: remember these tiles as they are */
  begin(cur: Edits, names: Iterable<string>) { this.open = snap(cur, names) }
  /** a stroke that reaches a tile begin() did not list (the brush crossed onto a neighbour) */
  touch(cur: Edits, name: string) { if (this.open && !(name in this.open)) this.open[name] = cur[name] ? { ...cur[name] } : null }
  /** on release: the stroke becomes one undo step; any redo is gone */
  commit() { if (!this.open) return; this.past.push(this.open); if (this.past.length > this.limit) this.past.shift(); this.future = []; this.open = null }
  get canUndo() { return this.past.length > 0 }
  get canRedo() { return this.future.length > 0 }
  /** returns the tiles it changed */
  /** returns only the tiles whose map actually changed (begin() may list every loaded tile; the rest stay clean for the save) */
  undo(cur: Edits): string[] { return this.step(cur, this.past, this.future) }
  redo(cur: Edits): string[] { return this.step(cur, this.future, this.past) }
  private step(cur: Edits, from: Snap[], to: Snap[]): string[] {
    const s = from.pop(); if (!s) return []
    const was = snap(cur, Object.keys(s)); to.push(was); restore(cur, s)
    return Object.keys(s).filter(n => JSON.stringify(was[n] ?? null) !== JSON.stringify(cur[n] ?? null))
  }
}

// ── WATER (BETA M62 slice 2, Alex 11-21: 'water = paint a level') ──
// Per tile, a sparse map of grid CELL (k = j*(nx-1)+i, the 4 m square between four vertices) -> that cell's water LEVEL, absolute,
// in decimetres. A cell holds water where its level stands above its lowest corner: carve a bowl, paint water = a lake; painted
// cells the ground stands above stay dry (the level is kept, so lowering the ground later floods them). Every cell keeps its OWN
// level, so two ponds at different heights sit side by side, and a wet cell whose neighbour is wet LOWER is a drop: slice 3's
// waterfalls read exactly that (waterDrops).
export type WaterMap = Record<string, number>           // cell k -> level (dm, absolute)
export const WATER_PREFIX = 'water/'                     // in the EDITOR's combined store: 'water/<tile>' beside '<tile>' (heights)
export const LEVEL_MAX_DM = 4000                         // +-400 m

/** Paint (level in metres) or dry (level null) every cell whose centre is within r of (x, z), across the given tiles. */
export function paintWater(tiles: BrushTile[], x: number, z: number, r: number, level: number | null): Record<string, WaterMap> {
  const out: Record<string, WaterMap> = {}
  const v = level === null ? 0 : Math.max(-LEVEL_MAX_DM, Math.min(LEVEL_MAX_DM, Math.round(level * 10)))
  for (const t of tiles) {
    const hx = t.sizeX / 2, hz = t.sizeZ / 2, cx = t.nx - 1, cz = t.nz - 1
    const i0 = Math.max(0, Math.floor((x - r - t.ox + hx) / t.cell)), i1 = Math.min(cx - 1, Math.floor((x + r - t.ox + hx) / t.cell))
    const j0 = Math.max(0, Math.floor((z - r - t.oz + hz) / t.cell)), j1 = Math.min(cz - 1, Math.floor((z + r - t.oz + hz) / t.cell))
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = t.ox - hx + (i + 0.5) * t.cell, pz = t.oz - hz + (j + 0.5) * t.cell
      if (Math.hypot(px - x, pz - z) > r) continue
      ;(out[t.name] ??= {})[String(j * cx + i)] = v
    }
  }
  return out
}
/** A dry stroke writes 0 = "remove"; a level of exactly 0.0 m is stored as 0.1 m so it is never mistaken for a removal. */
export function foldWater(cur: Record<string, WaterMap>, d: Record<string, WaterMap>, dry: boolean): string[] {
  const fixed: Record<string, WaterMap> = {}
  for (const [n, m] of Object.entries(d)) { const f: WaterMap = (fixed[n] = {}); for (const [k, v] of Object.entries(m)) f[k] = dry ? 0 : (v === 0 ? 1 : v) }
  return mergeEdits(cur, fixed)
}

export interface PondCell { i: number; j: number; y: number }
export interface PondBox { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }
/** The wet cells of a tile (level above the cell's lowest corner) and the swim boxes over them, tile-local. Runs of wet cells along
 *  a row at one level merge into one box; a box reaches down to the lowest ground under it. */
export function ponds(meta: { nx: number; nz: number; cell: number; sizeX: number; sizeZ: number }, h: Float32Array, water: WaterMap | null | undefined): { cells: PondCell[]; boxes: PondBox[] } {
  const cells: PondCell[] = [], boxes: PondBox[] = []
  if (!water) return { cells, boxes }
  const { nx, nz, cell, sizeX, sizeZ } = meta, cx = nx - 1, hx = sizeX / 2, hz = sizeZ / 2
  const wet = new Map<number, { y: number; lo: number }>()
  for (const key in water) {
    const k = +key, v = water[key]
    if (!Number.isInteger(k) || k < 0 || k >= cx * (nz - 1) || !Number.isFinite(v) || v === 0) continue
    const i = k % cx, j = (k - i) / cx, y = v / 10
    const lo = Math.min(h[j * nx + i], h[j * nx + i + 1], h[(j + 1) * nx + i], h[(j + 1) * nx + i + 1])
    if (y > lo) { wet.set(k, { y, lo }); cells.push({ i, j, y }) }
  }
  cells.sort((a, b) => a.j - b.j || a.i - b.i)
  for (let n = 0; n < cells.length;) {
    const a = cells[n]; let m = n, lo = wet.get(a.j * cx + a.i)!.lo
    while (m + 1 < cells.length && cells[m + 1].j === a.j && cells[m + 1].i === cells[m].i + 1 && cells[m + 1].y === a.y) { m++; lo = Math.min(lo, wet.get(a.j * cx + cells[m].i)!.lo) }
    boxes.push({ x0: -hx + a.i * cell, x1: -hx + (cells[m].i + 1) * cell, z0: -hz + a.j * cell, z1: -hz + (a.j + 1) * cell, y0: lo - 0.5, y1: a.y })
    n = m + 1
  }
  return { cells, boxes }
}
/** For slice 3: wet cells whose 4-neighbour is wet and LOWER (the water falls from this cell's edge onto that one). */
export function waterDrops(meta: { nx: number; nz: number }, cells: PondCell[], minDrop = 0.5): { from: PondCell; to: PondCell }[] {
  const cx = meta.nx - 1, at = new Map(cells.map(c => [c.j * cx + c.i, c])), out: { from: PondCell; to: PondCell }[] = []
  for (const c of cells) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const o = at.get((c.j + dj) * cx + c.i + di); if (o && c.i + di >= 0 && c.i + di < cx && c.y - o.y >= minDrop) out.push({ from: c, to: o })
  }
  return out
}
// ── FALLS (BETA M62 slice 3, Alex 11-21) ──
// Two sources of a falling sheet: (1) AUTOMATIC, where a wet cell's edge drops onto LOWER water, next door or across up to
// FALL_REACH dry cells of cliff (fallSheets reads the ponds); (2) a WATERFALL LINE the owner draws along a cliff edge (a spring
// out of the rock), stored per tile as a sparse map so it rides the same store, undo and route as heights and water:
//   '<id>.<n>' -> packed point n (tile-local, 0.5 m), '<id>.w' -> width (dm). A line falls to the LOWER side: onto painted water if
// there is some, else onto the ground. Width = how heavy the curtain is (sheet thickness, spray, foam).
export type FallMap = Record<string, number>
export const FALLS_PREFIX = 'falls/'
export const FALL_REACH = 4                              // cells (16 m) of dry cliff an auto fall may cross to find its water
export interface FallLine { id: number; pts: [number, number][]; w: number }
const PK = 8192, PO = 2048
export const packPt = (x: number, z: number) => (Math.round(x * 2) + PO) * PK + (Math.round(z * 2) + PO)
export const unpackPt = (v: number): [number, number] => [(Math.floor(v / PK) - PO) / 2, ((v % PK) - PO) / 2]
export function fallLines(m: FallMap | null | undefined): FallLine[] {
  if (!m) return []
  const by = new Map<number, FallLine>()
  for (const [k, v] of Object.entries(m)) {
    const [a, b] = k.split('.'), id = +a; if (!Number.isInteger(id) || !Number.isFinite(v)) continue
    const L = by.get(id) ?? { id, pts: [], w: 1 }; by.set(id, L)
    if (b === 'w') L.w = Math.max(0.2, Math.min(8, v / 10))
    else if (Number.isInteger(+b)) L.pts[+b] = unpackPt(v)
  }
  return [...by.values()].map(L => ({ ...L, pts: L.pts.filter(Boolean) })).filter(L => L.pts.length >= 2).sort((a, b) => a.id - b.id)
}
/** The entries that add one line (fold with mergeEdits). Points closer than 1 m are thinned. */
export function addFall(m: FallMap | null | undefined, pts: [number, number][], w: number): FallMap {
  const id = 1 + Math.max(0, ...Object.keys(m ?? {}).map(k => +k.split('.')[0]).filter(Number.isInteger))
  const out: FallMap = {}, keep: [number, number][] = []
  for (const p of pts) if (!keep.length || Math.hypot(p[0] - keep[keep.length - 1][0], p[1] - keep[keep.length - 1][1]) >= 1) keep.push(p)
  if (keep.length < 2) return out
  keep.slice(0, 64).forEach((p, n) => { out[`${id}.${n}`] = packPt(p[0], p[1]) })
  out[`${id}.w`] = Math.round(Math.max(0.2, Math.min(8, w)) * 10)
  return out
}
/** The entries (value 0 = delete) that remove every line with a point within r of (x, z). */
export function removeFallsNear(m: FallMap | null | undefined, x: number, z: number, r: number): FallMap {
  const out: FallMap = {}
  for (const L of fallLines(m)) if (L.pts.some(p => Math.hypot(p[0] - x, p[1] - z) <= r)) for (const k of Object.keys(m!)) if (k.split('.')[0] === String(L.id)) out[k] = 0
  return out
}
export function cleanFalls(d: unknown): FallMap | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null
  const out: FallMap = {}
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (!/^\d{1,4}\.(\d{1,2}|w)$/.test(k) || typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= PK * PK) return null
    if (v !== 0) out[k] = v
  }
  return out
}

/** A falling sheet, tile-local: the lip runs a -> b at `top`, the water falls toward (dx, dz) and lands at `bottom`, `land` metres
 *  out from the lip (0 = straight down). `w` = curtain weight. */
export interface Sheet { ax: number; az: number; bx: number; bz: number; top: number; bottom: number; dx: number; dz: number; land: number; w: number; auto: boolean }
export function fallSheets(meta: { nx: number; nz: number; cell: number; sizeX: number; sizeZ: number }, h: Float32Array, heightAt: (x: number, z: number) => number, cells: PondCell[], lines: FallLine[], minDrop = 1): Sheet[] {
  const { nx, nz, cell, sizeX, sizeZ } = meta, cx = nx - 1, cz = nz - 1, hx = sizeX / 2, hz = sizeZ / 2
  const at = new Map(cells.map(c => [c.j * cx + c.i, c]))
  const lo = (i: number, j: number) => Math.min(h[j * nx + i], h[j * nx + i + 1], h[(j + 1) * nx + i], h[(j + 1) * nx + i + 1])
  const out: Sheet[] = []
  // (1) automatic: per wet cell and direction, the first wet cell within reach that is lower, across nothing higher than the lip
  type Edge = { top: number; bottom: number; land: number; d: number; i: number; j: number }
  const edges: Edge[] = []
  const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (const c of cells) DIRS.forEach(([di, dj], d) => {
    for (let k = 1; k <= FALL_REACH; k++) {
      const i = c.i + di * k, j = c.j + dj * k
      if (i < 0 || j < 0 || i >= cx || j >= cz) return
      const o = at.get(j * cx + i)
      if (o) { if (c.y - o.y >= minDrop) edges.push({ top: c.y, bottom: o.y, land: (k - 1) * cell, d, i: c.i, j: c.j }); return }
      if (lo(i, j) > c.y - minDrop) return                     // ground in the way: no fall this side
    }
  })
  // merge runs: same direction, same lip line, same top/bottom/land, consecutive along the lip
  const key = (e: Edge) => `${e.d}|${e.top}|${e.bottom}|${e.land}|${e.d < 2 ? e.i : e.j}`
  const groups = new Map<string, Edge[]>()
  for (const e of edges) { const g = groups.get(key(e)) ?? []; g.push(e); groups.set(key(e), g) }
  for (const g of groups.values()) {
    const d = g[0].d, along = (e: Edge) => d < 2 ? e.j : e.i
    g.sort((a, b) => along(a) - along(b))
    for (let n = 0; n < g.length;) {
      let m = n; while (m + 1 < g.length && along(g[m + 1]) === along(g[m]) + 1) m++
      const [di, dj] = DIRS[d], e0 = g[n], e1 = g[m]
      const lipX = (i: number) => -hx + (di > 0 ? i + 1 : i) * cell, lipZ = (j: number) => -hz + (dj > 0 ? j + 1 : j) * cell
      const a = d < 2 ? [lipX(e0.i), -hz + e0.j * cell] : [-hx + e0.i * cell, lipZ(e0.j)]
      const b = d < 2 ? [lipX(e0.i), -hz + (e1.j + 1) * cell] : [-hx + (e1.i + 1) * cell, lipZ(e0.j)]
      out.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], top: e0.top, bottom: e0.bottom, dx: di, dz: dj, land: e0.land, w: 1, auto: true })
      n = m + 1
    }
  }
  // (2) drawn lines: each segment falls to its lower side, onto painted water there if any, else the ground
  const levelAt = (x: number, z: number) => { const i = Math.floor((x + hx) / cell), j = Math.floor((z + hz) / cell); return at.get(j * cx + i)?.y ?? null }
  for (const L of lines) for (let n = 0; n + 1 < L.pts.length; n++) {
    const [ax, az] = L.pts[n], [bx, bz] = L.pts[n + 1], len = Math.hypot(bx - ax, bz - az); if (len < 0.5) continue
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, px = -(bz - az) / len, pz = (bx - ax) / len
    const s = heightAt(mx + px * 5, mz + pz * 5) <= heightAt(mx - px * 5, mz - pz * 5) ? 1 : -1, dx = px * s, dz = pz * s
    const top = Math.max(heightAt(ax, az), heightAt(bx, bz), heightAt(mx, mz)) + 0.1
    let bottom = top, land = 0
    for (let r = 1; r <= 24; r += 1) {                          // walk out from the lip until the drop is found (water or the foot)
      const x = mx + dx * r, z = mz + dz * r, g = heightAt(x, z), wl = levelAt(x, z), y = wl !== null && wl > g ? wl : g
      if (!Number.isFinite(y)) break
      if (y < bottom - 0.01) { bottom = y; land = r; if (wl !== null && wl > g) break }   // water catches the fall: it ends there
      else if (r - land > 3) break
    }
    if (top - bottom >= minDrop) out.push({ ax, az, bx, bz, top, bottom, dx, dz, land: Math.max(0, land - 2), w: L.w, auto: false })
  }
  return out
}

export function cleanWater(d: unknown, nCells = 250 * 250): WaterMap | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null
  const out: WaterMap = {}
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    const n = Number(k)
    if (!Number.isInteger(n) || n < 0 || n >= nCells || typeof v !== 'number' || !Number.isFinite(v)) return null
    const dm = Math.max(-LEVEL_MAX_DM, Math.min(LEVEL_MAX_DM, Math.round(v))); if (dm !== 0) out[String(n)] = dm
  }
  return out
}

/** Validate a tile's edits off the wire (route + loader): integer vertex keys in range, integer dm within the clamp. */
export function cleanTile(d: unknown, nVerts = 251 * 251): TileEdits | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null
  const out: TileEdits = {}
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    const n = Number(k)
    if (!Number.isInteger(n) || n < 0 || n >= nVerts || typeof v !== 'number' || !Number.isFinite(v)) return null
    const dm = clampDm(v); if (dm !== 0) out[String(n)] = dm
  }
  return out
}
export const TILE_NAME = /^[A-Za-z0-9_-]{1,64}$/
export function cleanEdits(j: unknown): Edits { return cleanMaps((j as { tiles?: unknown } | null)?.tiles, cleanTile) }
export function cleanWaters(j: unknown): Record<string, WaterMap> { return cleanMaps((j as { water?: unknown } | null)?.water, cleanWater) }
export function cleanFallss(j: unknown): Record<string, FallMap> { return cleanMaps((j as { falls?: unknown } | null)?.falls, cleanFalls) }
function cleanMaps(tiles: unknown, clean: (d: unknown) => Record<string, number> | null): Record<string, Record<string, number>> {
  const next: Record<string, Record<string, number>> = {}
  if (tiles && typeof tiles === 'object') for (const [n, d] of Object.entries(tiles as Record<string, unknown>)) { const c = TILE_NAME.test(n) ? clean(d) : null; if (c && Object.keys(c).length) next[n] = c }
  return next
}

// ── the game's copy (browser): fetched once, before the first tile parses (wilds-world stream awaits ensureEdits) ──
let EDITS: Edits = {}
let WATER: Record<string, WaterMap> = {}
let FALLS: Record<string, FallMap> = {}
let loading: Promise<void> | null = null
export const editsFor = (name: string): TileEdits | null => EDITS[name] ?? null
export const waterFor = (name: string): WaterMap | null => WATER[name] ?? null
export const fallsFor = (name: string): FallMap | null => FALLS[name] ?? null
export interface Layer { edits: Edits; water: Record<string, WaterMap>; falls: Record<string, FallMap> }
export async function fetchLayer(): Promise<Layer> {
  try {
    const r = await fetch('/shimmer/open/wilds-edits', { cache: 'no-store' })
    if (!r.ok) return { edits: {}, water: {}, falls: {} }
    const j = await r.json(); return { edits: cleanEdits(j), water: cleanWaters(j), falls: cleanFallss(j) }
  } catch { return { edits: {}, water: {}, falls: {} } }   // no layer = the exported land, exactly
}
export function ensureEdits(): Promise<void> {
  if (typeof fetch !== 'function' || typeof window === 'undefined') return Promise.resolve()   // node tests: no layer
  return (loading ??= fetchLayer().then(l => { EDITS = l.edits; WATER = l.water; FALLS = l.falls }))
}
/** Owner only (the route 403s anyone else). Saves each named tile's WHOLE height map and/or water map (empty = remove it) in ONE
 *  request, so the route does one read-modify-write (parallel per-tile POSTs raced: M62 check, 11-21). */
export async function saveTiles(maps: Record<string, TileEdits>, water: Record<string, WaterMap> = {}, falls: Record<string, FallMap> = {}): Promise<boolean> {
  try {
    const r = await fetch('/shimmer/save-wilds-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tiles: maps, water, falls }) })
    return r.ok
  } catch { return false }
}
