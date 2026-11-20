// ── M49 slice 1: DEED PLOTS, the Nyx side's flat grid plots. PURE (no three, no react). ───────────────────────────────────
// Alex RULED 11-20 (eb123a9): keepers build Nyx-side only on ground held BY DEED (the shipyard + their shops); a deed is a GRID
// to place parts in (no planning table Nyx-side); metal is fine Nyx-side; a town's style = a CHOICE of colour + material combos
// (a per-town palette LIST), not a fixed mould; the same building parts + renderer as the Ather side (plot-walls / BlueprintStack).
// A deed's grid is in the SAME 1 m cells as the plot walls. Slice 1 stands one blueprint building on one deed (no grid UI, no item).
import type { HouseBlueprint } from '../ather/plot-blueprint'
import type { Walls, WallMat } from '../ather/plot-walls'
import { runKeys } from '../ather/plot-walls'

export type DeedKind = 'shipyard' | 'shop'
/** HUB DEFAULTS (build calls, Alex can change): grid size in 1 m cells, w across the front x d deep. */
export const DEED_GRID: Record<DeedKind, { w: number; d: number }> = { shipyard: { w: 12, d: 8 }, shop: { w: 8, d: 6 } }

/** one colour + material combo: the wall material (stucco takes a tint) */
export interface DeedPalette { mat: WallMat; tint?: string }
/** HUB DEFAULTS: three combos per town, drawn from the regional styles (Citadel stone, Gale Haven commercial, Veradyn living).
 *  Rune Hold has no ruled regional style: its three are a plain stone/brick set (a call for Alex). The ONLY wall materials the
 *  parts system has today are wood, brick and stucco (no metal wall yet), so these are what the renderer can draw. */
export const TOWN_PALETTES: Record<string, DeedPalette[]> = {
  citadel: [{ mat: 'stucco', tint: '#dcd3c2' }, { mat: 'stucco', tint: '#5b5560' }, { mat: 'brick' }],
  'gale-haven': [{ mat: 'brick' }, { mat: 'stucco', tint: '#b5543c' }, { mat: 'stucco', tint: '#7fa6c4' }],
  veradyn: [{ mat: 'shimmeroak' }, { mat: 'stucco', tint: '#8fae7a' }, { mat: 'dawnwood' }],
  'rune-hold': [{ mat: 'stucco', tint: '#dcd3c2' }, { mat: 'brick' }, { mat: 'stucco', tint: '#5b5560' }],
}

export interface Deed {
  id: string; town: string; kind: DeedKind
  /** the grid in cells (1 m) */ w: number; d: number
  /** the grid's centre and heading: yaw as placeBlueprint reads it (the front faces (-sin yaw, -cos yaw)) */
  x: number; z: number; yaw: number
  /** the town's palette list and the one chosen */ palettes: DeedPalette[]; palette: number
  /** the levelled ground: the platform's top, and where its foot stands (a terrace built up to one level) */
  level: number; base: number
}

export function makeDeed(id: string, town: string, kind: DeedKind, at: { x: number; z: number; yaw: number; level: number; base: number }, palette = 0): Deed {
  const g = DEED_GRID[kind], palettes = TOWN_PALETTES[town] ?? TOWN_PALETTES['rune-hold']
  return { id, town, kind, w: g.w, d: g.d, ...at, palettes, palette: Math.min(Math.max(0, palette), palettes.length - 1) }
}

/** the blueprint standing on a deed: a one-storey building one cell in from the grid's edge, a 2-wide door in the middle of the
 *  front (local z = 0), a window each side, a gable roof, in the chosen palette. The same data shape as a drawn blueprint. */
export function deedBlueprint(d: Deed): HouseBlueprint {
  const w = d.w - 2, dd = d.d - 2, pal = d.palettes[d.palette], walls: Record<string, Walls[string]> = {}
  const mat = pal.mat, tint = pal.tint && mat === 'stucco' ? { tint: pal.tint } : {}
  const put = (k: string, kind?: 'door' | 'window') => { walls[k] = { mat, ...tint, ...(kind ? { kind } : {}) } }
  for (const k of [...runKeys({ i: 0, j: 0 }, { i: w, j: 0 }), ...runKeys({ i: 0, j: dd }, { i: w, j: dd }), ...runKeys({ i: 0, j: 0 }, { i: 0, j: dd }), ...runKeys({ i: w, j: 0 }, { i: w, j: dd })]) put(k)
  const c = Math.floor(w / 2) - 1
  put(`h,${c},0`, 'door'); put(`h,${c + 1},0`, 'door')
  put(`v,0,${Math.floor(dd / 2)}`, 'window'); put(`v,${w},${Math.floor(dd / 2)}`, 'window')
  return { v: 1, id: `deed-${d.id}`, name: `${d.town} ${d.kind}`, w, d: dd, walls, floors: {}, roof: 'gable', saved: 0 }
}

/** the pad as placeBlueprint wants it (the building is centred on the grid, so its front is the grid's front less the margin) */
export const deedPad = (d: Deed) => ({ x: d.x, z: d.z, yaw: d.yaw, y: d.level })

/** The levelled ground at x, z: the grid (+ half a cell) at `level`; outside it a 0.5-slope skirt down to the foot (a walkable
 *  bank all round). -Infinity beyond (the land is its own). Same idea as foot-solids › stationGround. */
export function deedGround(d: Deed, x: number, z: number): number {
  const dx = x - d.x, dz = z - d.z, s = Math.sin(d.yaw), c = Math.cos(d.yaw)
  const a = dx * c - dz * s, b = -(dx * s + dz * c)   // a: metres to the pad's right, b: metres toward its front
  const ox = Math.max(0, Math.abs(a) - d.w / 2 - 0.5), oz = Math.max(0, Math.abs(b) - d.d / 2 - 0.5)
  const out = Math.hypot(ox, oz)
  if (out === 0) return d.level
  const h = d.level - d.base
  return out <= h / 0.5 ? d.level - out * 0.5 : -Infinity
}
/** furthest the skirt reaches from the grid's centre (a cheap gate before the ground / solids are asked) */
export const deedReach = (d: Deed) => Math.hypot(d.w, d.d) / 2 + 1 + (d.level - d.base) / 0.5
