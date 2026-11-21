// ── M49 slice 1 (NEW SHAPE): THE DEED GRID, a grid a keeper PLACES THINGS IN. PURE (no three, no react, no storage). ──────
// Canon athernyx 3af1436 (Alex 11-20, amended same day): keepers buy SHIPYARDS (not homes) and shops; a deed is "a grid the
// player can place stuff in", not one to build on. The structure comes BUILT; the keeper furnishes it (hand-held, M45: hold a
// piece from the hotbar, E sets it on a cell, hold E turns it) and picks a colour + material combo for its look. No planning
// table, no assembling buildings from parts. (The old branch m49-s1-wip built on a levelled terrace: wrong shape; only its
// grid-in-1-m-cells and per-town palette-list ideas carry over.)
//
// The grid is in LOCAL cells: (cx, cz), cx 0..w-1 across, cz 0..d-1 front to back, 1 m each, centred on the deed's origin.
// A piece covers ceil(w) x ceil(d) cells of its footprint (swapped on an odd quarter turn), anchored at its lowest cell.

export type DeedKind = 'shipyard' | 'shop' | 'plot'
/** plot = a whole shipyard plot (M49 s4, business/shipyard-plots.ts); its built pieces block cells (placeRefusal's `blocked`) */
export const DEED_GRID: Record<DeedKind, { w: number; d: number }> = { shipyard: { w: 12, d: 8 }, shop: { w: 8, d: 6 }, plot: { w: 100, d: 100 } }
/** a deed holds at most this many placed things (the plot's MAX_PIECES is 60; a yard is smaller) */
export const MAX_DEED_ITEMS = 40

/** one colour + material combo: the trim/fence material and its colour. Build-side placeholders (Jin): a town's style is a
 *  CHOICE of combos (canon), and which combos a town offers is a look call Alex can retune here. */
export interface DeedPalette { id: string; name: string; mat: 'timber' | 'stone' | 'iron' | 'brick'; color: string; accent: string }
export const DEED_PALETTES: readonly DeedPalette[] = [
  { id: 'soot-timber', name: 'Soot timber', mat: 'timber', color: '#5a3d26', accent: '#8a6a48' },
  { id: 'hold-stone', name: 'Hold stone', mat: 'stone', color: '#7d7366', accent: '#a39888' },
  { id: 'forge-iron', name: 'Forge iron', mat: 'iron', color: '#3f3a36', accent: '#b0642c' },
  { id: 'kiln-brick', name: 'Kiln brick', mat: 'brick', color: '#8a4a34', accent: '#d9c7a8' },
]

export interface Placed { id: string; cx: number; cz: number; rot: number }
export interface DeedState { v: 1; palette: number; items: Placed[] }
export const emptyDeed = (): DeedState => ({ v: 1, palette: 0, items: [] })

export interface Footprint { w: number; d: number }

/** the cells a piece of footprint `fp` covers when anchored at (cx, cz) turned `rot` quarters */
export function cellsOf(fp: Footprint, cx: number, cz: number, rot: number): [number, number][] {
  const odd = ((rot % 4) + 4) % 2 === 1
  const cw = Math.max(1, Math.ceil((odd ? fp.d : fp.w) - 1e-6)), cd = Math.max(1, Math.ceil((odd ? fp.w : fp.d) - 1e-6))
  const out: [number, number][] = []
  for (let i = 0; i < cw; i++) for (let j = 0; j < cd; j++) out.push([cx + i, cz + j])
  return out
}

export type PlaceRefusal = 'out' | 'taken' | 'full' | 'built' | null
/** why `id` cannot go at (cx, cz, rot), or null when it can. `fpOf` gives a piece's footprint (furniture.ts › FURNITURE). */
export function placeRefusal(s: DeedState, kind: DeedKind, fpOf: (id: string) => Footprint | null, id: string, cx: number, cz: number, rot: number, ignore = -1, blocked?: (cx: number, cz: number) => boolean): PlaceRefusal {
  const fp = fpOf(id); if (!fp) return 'out'
  if (ignore < 0 && s.items.length >= MAX_DEED_ITEMS) return 'full'
  const g = DEED_GRID[kind], want = cellsOf(fp, cx, cz, rot)
  if (want.some(([x, z]) => x < 0 || z < 0 || x >= g.w || z >= g.d)) return 'out'
  if (blocked && want.some(([x, z]) => blocked(x, z))) return 'built'
  const taken = new Set<string>()
  s.items.forEach((p, k) => { if (k === ignore) return; const f = fpOf(p.id); if (f) for (const [x, z] of cellsOf(f, p.cx, p.cz, p.rot)) taken.add(`${x},${z}`) })
  return want.some(([x, z]) => taken.has(`${x},${z}`)) ? 'taken' : null
}

/** place `id`; returns the new state, or the same state when refused (the caller reads placeRefusal for why) */
export function place(s: DeedState, kind: DeedKind, fpOf: (id: string) => Footprint | null, id: string, cx: number, cz: number, rot: number, blocked?: (cx: number, cz: number) => boolean): DeedState {
  if (placeRefusal(s, kind, fpOf, id, cx, cz, rot, -1, blocked)) return s
  return { ...s, items: [...s.items, { id, cx, cz, rot: ((rot % 4) + 4) % 4 }] }
}

/** the index of the placed thing covering cell (cx, cz), or -1 */
export function itemAt(s: DeedState, fpOf: (id: string) => Footprint | null, cx: number, cz: number): number {
  return s.items.findIndex(p => { const f = fpOf(p.id); return !!f && cellsOf(f, p.cx, p.cz, p.rot).some(([x, z]) => x === cx && z === cz) })
}

/** pick up item k: the state without it, and the id that goes back to the keeper's hand/inventory */
export function pickUp(s: DeedState, k: number): { state: DeedState; id: string | null } {
  if (k < 0 || k >= s.items.length) return { state: s, id: null }
  return { state: { ...s, items: s.items.filter((_, i) => i !== k) }, id: s.items[k].id }
}

export const setPalette = (s: DeedState, i: number): DeedState => ({ ...s, palette: ((i % DEED_PALETTES.length) + DEED_PALETTES.length) % DEED_PALETTES.length })
export const paletteOf = (s: DeedState): DeedPalette => DEED_PALETTES[s.palette] ?? DEED_PALETTES[0]

// ── local cell <-> deed-local metres (x across, z front->back, origin = the grid's centre) ──
export function cellAtLocal(kind: DeedKind, lx: number, lz: number): { cx: number; cz: number } | null {
  const g = DEED_GRID[kind], cx = Math.floor(lx + g.w / 2), cz = Math.floor(lz + g.d / 2)
  return cx < 0 || cz < 0 || cx >= g.w || cz >= g.d ? null : { cx, cz }
}
/** the centre (deed-local metres) of a piece anchored at (cx, cz): the middle of the cells it covers */
export function pieceCentre(kind: DeedKind, fp: Footprint, cx: number, cz: number, rot: number): { lx: number; lz: number } {
  const g = DEED_GRID[kind], cells = cellsOf(fp, cx, cz, rot)
  const mx = cells.reduce((a, [x]) => a + x, 0) / cells.length, mz = cells.reduce((a, [, z]) => a + z, 0) / cells.length
  return { lx: mx + 0.5 - g.w / 2, lz: mz + 0.5 - g.d / 2 }
}

/** a saved deed, validated: anything malformed or off the grid is dropped, never thrown */
export function parseDeed(raw: unknown, kind: DeedKind, fpOf: (id: string) => Footprint | null, blocked?: (cx: number, cz: number) => boolean): DeedState {
  const r = raw as Partial<DeedState> | null
  if (!r || r.v !== 1 || !Array.isArray(r.items)) return emptyDeed()
  let s: DeedState = { ...emptyDeed(), palette: Number.isInteger(r.palette) ? setPalette(emptyDeed(), r.palette as number).palette : 0 }
  for (const p of r.items) {
    if (!p || typeof p.id !== 'string' || !Number.isInteger(p.cx) || !Number.isInteger(p.cz) || !Number.isInteger(p.rot)) continue
    s = place(s, kind, fpOf, p.id, p.cx, p.cz, p.rot, blocked)
  }
  return s
}
