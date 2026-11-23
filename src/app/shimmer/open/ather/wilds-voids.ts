// CLOUD VOIDS IN THE WILDS (BETA M41 slices 1+2, option B on docs/looks/wilds-paths.html; canon [RULED] Cloud voids inside the
// Wilds, CANON_GAPS 11-19). The Settle has breaks: where two DIFFERENT zones meet, the crust ends and the uncooled cloud shows
// through, a strip of VOID_HALF*2 metres. Two Settle edges facing over cloud, drawn in a pressed-cloud dark; a fall costs time,
// never gore. EVERY void has a way across: one cooled neck per pair of adjacent regions (the border square nearest the arrival,
// where the mock put it), plus wherever an authored path already crosses a border (a path is never cut). Nothing is named.
//
// ZONES come from the tile index (tiles.json: node (i, j) of tile (tx, ty) is the 200 m square X = tx*5+i-2, Z = ty*5+j-2, centred
// at (X*200, Z*200)). A REGION is a connected run of same-zone squares: a zone that is cut in two by another is two regions, and
// each pair of touching regions gets its own crossing, or a piece of the Wilds would be sealed.
//
// ★ POINTWISE in world coordinates, like relief.ts: weight(x, z) depends on the point alone, so two tiles agree on every vertex
//   they share. It is exactly 0 on everything relief.ts protects (Moonwell Glade, settlement + fair discs, the arrival, the
//   paths' corridors), so carving never changes a protected vertex.
// PURE. No three, no React, no DOM, no fetch.

import { wildsFrontDist, ARRIVAL } from './relief'
import { SETTLEMENT_CLEAR, FAIR_CLEAR, pathDistance, type Network } from './network'
import { voidOverrides, type VoidEdits } from './void-edits'

export const SQ = 200                 // the zone grid's square, metres
export const VOID_HALF = 12           // half the void's width: the keeper cannot stand within this of a border (24 m across)
export const VOID_FADE = 10           // the lip: the land rolls over into the deep across this
export const NECK_HALF = 6            // a crossing's neck is 12 m of level-ish land along the border, then fades back
export const NECK_FADE = 6
/** how far from a protected thing the void stays 0, then fades back over the second number */
export const PROTECT = { glade: [10, 22], settle: [8, 22], arrival: [16, 30], path: [14, 24] } as const
export const FALL_W = 0.55            // a keeper standing where weight >= this has gone over

export interface Crossing { x: number; z: number; a: number; b: number; kind: 'neck' | 'path'; /** the border's direction: 'v' runs along z (a wall of x), 'h' along x */ axis: 'v' | 'h' }
export interface VoidField {
  /** 0..1: how much of the crust is gone here (0 = ground as it was; the carve lerps land to the deep by this) */
  weight(x: number, z: number): number
  /** 1 where the ground is protected from carving (the Glade, a settlement/fair, the arrival, a path's corridor), 0 where free: tests + tools */
  protectedAt(x: number, z: number): boolean
  /** the keeper has gone over: standing here is not possible */
  isVoid(x: number, z: number): boolean
  crossings: Crossing[]
  /** the nearest crossing within r metres, or null */
  crossingNear(x: number, z: number, r: number): Crossing | null
  /** the region (connected same-zone run of squares) at a point, or -1 off the grid */
  regionAt(x: number, z: number): number
  /** region ids, and which zone each is */
  regions: { id: number; zone: string; squares: number }[]
  /** the carved height: land drops by VOID_DEPTH * weight (a pit, never raises ground; shallower on the shore, VOID_SHORE) */
  carve(x: number, z: number, land: number, waterY: number): number
}
export interface IndexLike { tiles: { tx: number; ty: number; nodes: { i: number; j: number; zone?: string }[] }[] }

const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }
const sqOf = (v: number) => Math.round(v / SQ)
const key = (X: number, Z: number) => X * 100003 + Z
/** v1 (kept for callers): the deep floor sat just above the water plane. v2 carves a real pit instead (VOID_DEPTH) */
export const VOID_FLOOR_ABOVE_WATER = 0.6
/** ★ VOID v2 (Alex 11-23 06:4x: "carve out the area ... use the void as a floor ... fall inside and disappear"): the pit floor
 *  sits this far below the land it was cut from, wherever that land stands, so from the rim you look DOWN into it. The lip is
 *  VOID_FADE wide, so the wall is a cliff (steepest ~1.5 * VOID_DEPTH / VOID_FADE, far past MAX_WALK_GRADIENT): you can walk off
 *  it, never up it. Land within VOID_SHORE of the water plane carves shallower, down to nothing at the water line, so a lake's
 *  bed is not dug out under its water (the water plane is masked over the pit instead: wilds-scene). */
export const VOID_DEPTH = 32
export const VOID_SHORE = 6
/** a keeper whose feet reach this weight is on the cliff (past the rolled-over lip, ~1.3 m down): the fall starts (void-fall.ts) */
export const FALL_LIP = 0.12
/** a mesh cell is drawn and mapped as void floor where its centre weight is at least this (the deep, ~the old footprint) */
export const VOIDED_W = 0.85

/** The zone grid off the tile index (absent nodes = no land there = no void to a neighbour). */
export function zoneGrid(index: IndexLike): Map<number, string> {
  const g = new Map<number, string>()
  for (const t of index.tiles) for (const n of t.nodes) g.set(key(t.tx * 5 + n.i - 2, t.ty * 5 + n.j - 2), n.zone ?? 'meadows')
  return g
}

interface Seg { v: boolean; line: number; lo: number; hi: number; a: number; b: number }   // v: a wall at x=line, spanning z lo..hi

/** `ov` (M104): the owner's void brush layer (void-edits.ts), erase = crust holds, paint = void; applied pointwise over the generated field */
export function makeVoids(index: IndexLike, net: Network | null, extra: readonly { x: number; z: number }[] = [], ov: VoidEdits | null = null): VoidField {
  const zones = zoneGrid(index)
  const cells: [number, number][] = []
  for (const t of index.tiles) for (const n of t.nodes) cells.push([t.tx * 5 + n.i - 2, t.ty * 5 + n.j - 2])
  // regions: 4-connected same-zone squares
  const region = new Map<number, number>(), regions: { id: number; zone: string; squares: number }[] = []
  cells.sort((p, q) => p[0] - q[0] || p[1] - q[1])
  for (const [X, Z] of cells) {
    if (region.has(key(X, Z))) continue
    const id = regions.length, z = zones.get(key(X, Z))!, stack = [[X, Z]]
    region.set(key(X, Z), id); let n = 0
    while (stack.length) {
      const [x, y] = stack.pop()!; n++
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(x + dx, y + dz)
        if (zones.get(k) === z && !region.has(k)) { region.set(k, id); stack.push([x + dx, y + dz]) }
      }
    }
    regions.push({ id, zone: z, squares: n })
  }
  // borders between different zones (hence different regions): walls between (X,Z)|(X+1,Z) and floors between (X,Z)|(X,Z+1)
  const segsV = new Map<number, Seg>(), segsH = new Map<number, Seg>(), all: Seg[] = []
  for (const [X, Z] of cells) {
    const a = region.get(key(X, Z))!
    const e = region.get(key(X + 1, Z)), s = region.get(key(X, Z + 1))
    if (e !== undefined && zones.get(key(X + 1, Z)) !== zones.get(key(X, Z))) { const g: Seg = { v: true, line: (X + 0.5) * SQ, lo: (Z - 0.5) * SQ, hi: (Z + 0.5) * SQ, a, b: e }; segsV.set(key(X, Z), g); all.push(g) }
    if (s !== undefined && zones.get(key(X, Z + 1)) !== zones.get(key(X, Z))) { const g: Seg = { v: false, line: (Z + 0.5) * SQ, lo: (X - 0.5) * SQ, hi: (X + 0.5) * SQ, a, b: s }; segsH.set(key(X, Z), g); all.push(g) }
  }
  const regionAt = (x: number, z: number) => region.get(key(sqOf(x), sqOf(z))) ?? -1

  // crossings: ONE neck per pair of touching regions, on the border segment nearest the arrival (the mock's rule)
  const crossings: Crossing[] = []
  const best = new Map<string, { s: Seg; d: number }>()
  for (const s of all) {
    const mx = s.v ? s.line : (s.lo + s.hi) / 2, mz = s.v ? (s.lo + s.hi) / 2 : s.line, d = Math.hypot(mx - ARRIVAL.x, mz - ARRIVAL.z)
    const k = `${Math.min(s.a, s.b)}-${Math.max(s.a, s.b)}`, o = best.get(k)
    if (!o || d < o.d) best.set(k, { s, d })
  }
  for (const [, { s }] of [...best].sort((p, q) => p[0] < q[0] ? -1 : 1)) {
    crossings.push({ x: s.v ? s.line : (s.lo + s.hi) / 2, z: s.v ? (s.lo + s.hi) / 2 : s.line, a: Math.min(s.a, s.b), b: Math.max(s.a, s.b), kind: 'neck', axis: s.v ? 'v' : 'h' })
  }
  // an authored path that crosses a border is a way across already (its corridor is protected below): list each place once
  if (net) {
    for (const p of net.paths) {
      let last = -1
      for (let k = 1; k < p.pts.length; k++) {
        const [ax, az] = p.pts[k - 1], [bx, bz] = p.pts[k], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3))
        for (let s = k === 1 ? 0 : 1; s <= m; s++) {
          const x = ax + ((bx - ax) * s) / m, z = az + ((bz - az) * s) / m, r = regionAt(x, z)
          if (r >= 0 && last >= 0 && r !== last) {
            const a = Math.min(r, last), b = Math.max(r, last)
            if (!crossings.some(c => c.a === a && c.b === b && Math.hypot(c.x - x, c.z - z) < 40)) crossings.push({ x, z, a, b, kind: 'path', axis: Math.abs(x / SQ + 0.5 - Math.round(x / SQ + 0.5)) < Math.abs(z / SQ + 0.5 - Math.round(z / SQ + 0.5)) ? 'v' : 'h' })
          }
          if (r >= 0) last = r
        }
      }
    }
  }
  const CB = 100, cbuck = new Map<number, Crossing[]>()
  const ck = (i: number, j: number) => i * 100003 + j
  for (const c of crossings) { const kk = ck(Math.floor(c.x / CB), Math.floor(c.z / CB)); const l = cbuck.get(kk); if (l) l.push(c); else cbuck.set(kk, [c]) }
  const dead = new Set<Crossing>()   // M104: a crossing the owner painted over is no crossing (never a respawn point inside a void)
  const crossingNear = (x: number, z: number, r: number): Crossing | null => {
    let out: Crossing | null = null, bd = r
    const R = Math.ceil(r / CB)
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) for (const c of cbuck.get(ck(Math.floor(x / CB) + i, Math.floor(z / CB) + j)) ?? []) { if (dead.has(c)) continue; const d = Math.hypot(c.x - x, c.z - z); if (d <= bd) { bd = d; out = c } }
    return out
  }

  /** how near the border the point is: 1 in the void's width, fading to 0 across the lip */
  const band = (x: number, z: number): number => {
    let d = Infinity
    const reach = VOID_HALF + VOID_FADE
    // the nearest wall in each direction: lines sit at (k + 0.5) * SQ, so at most one is within `reach` of a point
    const kx = Math.round(x / SQ - 0.5), kz = Math.round(z / SQ - 0.5), X = sqOf(x), Z = sqOf(z)
    if (Math.abs(x - (kx + 0.5) * SQ) < reach) for (let dz = -1; dz <= 1; dz++) {
      const g = segsV.get(key(kx, Z + dz)); if (!g) continue
      d = Math.min(d, Math.hypot(x - g.line, Math.max(g.lo - z, 0, z - g.hi)))
    }
    if (Math.abs(z - (kz + 0.5) * SQ) < reach) for (let dx = -1; dx <= 1; dx++) {
      const g = segsH.get(key(X + dx, kz)); if (!g) continue
      d = Math.min(d, Math.hypot(z - g.line, Math.max(g.lo - x, 0, x - g.hi)))
    }
    return d <= VOID_HALF ? 1 : d >= reach ? 0 : 1 - smooth((d - VOID_HALF) / VOID_FADE)
  }
  const ramp = (d: number, r: readonly [number, number]) => d <= r[0] ? 0 : d >= r[1] ? 1 : smooth((d - r[0]) / (r[1] - r[0]))
  /** 1 = free to carve, 0 = protected (the Glade, a settlement or the fair's ground, the arrival, a path's corridor) */
  const free = (x: number, z: number): number => {
    let f = ramp(wildsFrontDist(x, z), PROTECT.glade)   // M67 s1b-2: the Glade's OLD Wilds footprint (relief.ts)
    if (f > 0) f = Math.min(f, ramp(Math.hypot(x - ARRIVAL.x, z - ARRIVAL.z), PROTECT.arrival))
    for (const e of extra) { if (f <= 0) return 0; f = Math.min(f, ramp(Math.hypot(x - e.x, z - e.z), PROTECT.arrival)) }
    if (f > 0 && net) {
      for (const s of net.settlements) f = Math.min(f, ramp(Math.hypot(x - s.x, z - s.z) - SETTLEMENT_CLEAR, PROTECT.settle))
      if (net.fair) f = Math.min(f, ramp(Math.hypot(x - net.fair.x, z - net.fair.z) - FAIR_CLEAR, PROTECT.settle))
      if (f > 0) f = Math.min(f, ramp(pathDistance(net, x, z, PROTECT.path[1]), PROTECT.path))   // capped: the ramp is flat past its end
    }
    return f
  }
  /** 1 on a crossing's neck: along the border within NECK_HALF, fading over NECK_FADE; across just the void's width */
  const neck = (x: number, z: number): number => {
    let n = 0
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const c of cbuck.get(ck(Math.floor(x / CB) + i, Math.floor(z / CB) + j)) ?? []) {
      if (c.kind === 'path') continue   // a path's own gap is its corridor protection
      const along = c.axis === 'v' ? Math.abs(z - c.z) : Math.abs(x - c.x), across = c.axis === 'v' ? Math.abs(x - c.x) : Math.abs(z - c.z)
      if (across > VOID_HALF + VOID_FADE + 6) continue
      n = Math.max(n, 1 - smooth((along - NECK_HALF) / NECK_FADE))
    }
    return n
  }
  const gen = (x: number, z: number): number => {
    const b = band(x, z); if (b <= 0) return 0
    const f = free(x, z); if (f <= 0) return 0
    return b * f * (1 - neck(x, z))
  }
  // M104: the owner's overrides. ERASE lifts the generated weight (the crust holds); PAINT adds void, but never on protected ground
  const O = voidOverrides(ov)
  const weight = !O ? gen : (x: number, z: number): number => {
    const e = O.erase(x, z), p = O.paint(x, z)
    const g = e >= 1 ? 0 : gen(x, z) * (1 - e)
    return p > g ? Math.max(g, p * free(x, z)) : g
  }
  if (O) for (const c of crossings) if (weight(c.x, c.z) >= FALL_W) dead.add(c)
  const shown = dead.size ? crossings.filter(c => !dead.has(c)) : crossings
  const carve = (x: number, z: number, land: number, waterY: number) => {
    const w = weight(x, z); if (w <= 0 || land <= waterY) return land
    return land - VOID_DEPTH * w * smooth((land - waterY) / VOID_SHORE)
  }
  return { weight, protectedAt: (x, z) => free(x, z) < 1, isVoid: (x, z) => weight(x, z) >= FALL_W, crossings: shown, crossingNear, regionAt, regions, carve }
}
