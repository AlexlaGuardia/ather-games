// ── THE WILDS EDIT LAYER (BETA M38 slice 1, Alex 11-19: 'a map editor mode for the wilds where i could manipulate the terrain') ──
// The exported 1 km tiles (.bin) are never rewritten. Edits are a sparse HEIGHT DELTA per grid vertex, in decimetres, stored in
// world/wilds-edits.json ({ v: 1, tiles: { <tile>: { <vertex k = j*nx+i>: dm } } }), read at RUNTIME (GET /shimmer/open/wilds-edits)
// and saved by the owner (POST /shimmer/save-wilds-edit, owner-gated by the save-* prefix). parseWilds adds a tile's deltas to
// its heights AFTER relief, so what you stand on, the mesh, trees, crystals and Hollows all take the edited ground, while the
// RAW heights (which decide tree and crystal ids) never move. A re-export keeps the edits: they are deltas, not heights.
//
// ★ The brush math below is PURE (no React, no three, no fetch): node tests drive it (wilds-edits.test.ts).

export type TileEdits = Record<string, number>          // vertex k -> delta (dm)
export type Edits = Record<string, TileEdits>           // tile name -> its edits
export const EDIT_MAX_DM = 600                           // +-60 m: a brush can make a cliff, not a mountain range
export type Brush = 'raise' | 'lower' | 'flatten' | 'smooth'
export const BRUSHES: Brush[] = ['raise', 'lower', 'flatten', 'smooth']
export const RADII = [3, 6, 10, 16, 24]
export const STRENGTHS = [0.25, 0.5, 1, 2]              // metres per application at the centre (raise / lower)

/** A tile as the brush sees it: its centre in world coords and its grid. */
export interface BrushTile { name: string; ox: number; oz: number; nx: number; nz: number; cell: number; sizeX: number; sizeZ: number }
export interface Stroke { kind: Brush; x: number; z: number; r: number; s: number; /** flatten: the height under the stroke's start */ target?: number }

const clampDm = (v: number) => Math.max(-EDIT_MAX_DM, Math.min(EDIT_MAX_DM, Math.round(v)))
/** 1 at the centre, 0 at the rim, smooth both ends */
export const falloff = (d: number, r: number) => { const t = Math.max(0, 1 - d / r); return t * t * (3 - 2 * t) }

/** One application of a brush. Reads the CURRENT edited ground (`heightAt`, world coords) and the current edits; returns the
 *  NEW delta of every vertex it touched, per tile (a vertex on a shared tile edge is touched in both tiles, so seams agree). */
export function applyBrush(heightAt: (x: number, z: number) => number, tiles: BrushTile[], cur: Edits, st: Stroke): Record<string, TileEdits> {
  const out: Record<string, TileEdits> = {}
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
      else if (st.kind === 'flatten') dm = was + f * ((st.target ?? h) - h) * 10 * 0.5
      else {   // smooth: toward the mean of the four grid neighbours
        const c = t.cell, n = [heightAt(x + c, z), heightAt(x - c, z), heightAt(x, z + c), heightAt(x, z - c)].filter(Number.isFinite)
        if (!n.length) continue
        dm = was + f * (n.reduce((a, b) => a + b, 0) / n.length - h) * 10 * 0.5
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

// ── the page's copy (browser): fetched once before the first stream; the editor mutates it and saves per tile ──
let EDITS: Edits = {}
export const allEdits = () => EDITS
export const editsFor = (name: string): TileEdits | null => EDITS[name] ?? null
export async function loadEdits(): Promise<void> {
  try {
    const r = await fetch('/shimmer/open/wilds-edits', { cache: 'no-store' })
    if (!r.ok) return
    const j = await r.json() as { tiles?: Record<string, unknown> }
    const next: Edits = {}
    for (const [n, d] of Object.entries(j?.tiles ?? {})) { const c = TILE_NAME.test(n) ? cleanTile(d) : null; if (c && Object.keys(c).length) next[n] = c }
    EDITS = next
  } catch { /* no edits = the exported land, exactly */ }
}
/** Owner only (the route 403s anyone else). Saves one tile's whole edit map. */
export async function saveTile(name: string): Promise<boolean> {
  try {
    const r = await fetch('/shimmer/save-wilds-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tile: name, d: EDITS[name] ?? {} }) })
    return r.ok
  } catch { return false }
}
