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
export function cleanEdits(j: unknown): Edits {
  const next: Edits = {}
  const tiles = (j as { tiles?: Record<string, unknown> } | null)?.tiles
  if (tiles && typeof tiles === 'object') for (const [n, d] of Object.entries(tiles)) { const c = TILE_NAME.test(n) ? cleanTile(d) : null; if (c && Object.keys(c).length) next[n] = c }
  return next
}

// ── the game's copy (browser): fetched once, before the first tile parses (wilds-world stream awaits ensureEdits) ──
let EDITS: Edits = {}
let loading: Promise<void> | null = null
export const editsFor = (name: string): TileEdits | null => EDITS[name] ?? null
export async function fetchEdits(): Promise<Edits> {
  try {
    const r = await fetch('/shimmer/open/wilds-edits', { cache: 'no-store' })
    return r.ok ? cleanEdits(await r.json()) : {}
  } catch { return {} }   // no edits = the exported land, exactly
}
export function ensureEdits(): Promise<void> {
  if (typeof fetch !== 'function' || typeof window === 'undefined') return Promise.resolve()   // node tests: no layer
  return (loading ??= fetchEdits().then(e => { EDITS = e }))
}
/** Owner only (the route 403s anyone else). Saves each named tile's WHOLE edit map (empty = remove the tile) in ONE request, so the
 *  route does one read-modify-write (parallel per-tile POSTs raced: M62 check, 11-21). */
export async function saveTiles(maps: Record<string, TileEdits>): Promise<boolean> {
  try {
    const r = await fetch('/shimmer/save-wilds-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tiles: maps }) })
    return r.ok
  } catch { return false }
}
