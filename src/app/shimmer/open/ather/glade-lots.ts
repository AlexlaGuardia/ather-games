// ── MOONWELL GLADE LOTS (BETA M40 part 2, layout B; world d5a9e927, 11-19). Each of the five's lots is a level PAD (relief.ts
// levels the whole Glade) with its STATION at the back: a code-built BLOCKOUT of the trade, until Alex's M39 blueprints replace
// it. The shapes are build, not canon: what a carpenter's yard or a stonery holds is the trade's plain furniture (canon names
// the trades: characters/moonwell-folk.md). PURE: the scene (glade-lots.tsx) draws these parts and the walker
// (dynamic-solids.ts) stands against the same parts, so what you see is what you bump.
// A part is in its LOT's frame: `ahead` m toward the green from the lot's centre, `side` m to its right; w across, d deep, h tall.
import { onLot, lotAt, GLADE_LOTS, gladeJetty, setLotSpot } from './moonwell-glade'
import type { Box } from '../terrain-world'
import { placeBlueprint, fitsPad, type HouseBlueprint } from './plot-blueprint'
import { findRooms } from './plot-walls'

export interface Part { ahead: number; side: number; w: number; d: number; h: number; y0?: number; color: string; solid?: boolean; turn?: number }
const WOOD = '#9a6a3c', PLANK = '#d2a157', STONE = '#9aa3ad', DARK = '#6d5038', HERB = '#6fa857', CLOTH = '#d9806a', JAR = '#b7d8e6', HEARTH = '#8a4b32'
export const STATIONS: Readonly<Record<string, readonly Part[]>> = {
  // the Glade kitchen at the head: a long table under a canopy, the hearth behind it (where the five eat together)
  fennel: [
    { ahead: 0.5, side: 0, w: 7, d: 1.3, h: 0.85, color: PLANK, solid: true },
    { ahead: 1.6, side: 0, w: 7, d: 0.45, h: 0.48, color: WOOD, solid: true }, { ahead: -0.6, side: 0, w: 7, d: 0.45, h: 0.48, color: WOOD, solid: true },
    { ahead: -2.8, side: 3.6, w: 1.8, d: 1.6, h: 1.3, color: HEARTH, solid: true },
    ...[[-4, 2.2], [4, 2.2], [-4, -1.3], [4, -1.3]].map(([s, a]) => ({ ahead: a, side: s, w: 0.22, d: 0.22, h: 2.9, color: WOOD, solid: true })),
    { ahead: 0.45, side: 0, w: 8.6, d: 4.2, h: 0.18, y0: 2.9, color: CLOTH },
  ],
  // Hazel's carpenter's yard: a sawhorse, the workbench, plank stacks along the back
  hazel: [
    { ahead: 0.8, side: -2, w: 2, d: 0.5, h: 0.9, color: WOOD, solid: true },
    { ahead: -0.6, side: 2.4, w: 3, d: 1, h: 0.9, color: PLANK, solid: true },
    ...[-4.4, -2.2, 0].map((s, k) => ({ ahead: -3, side: s, w: 1.9, d: 1.1, h: 0.4 + k * 0.25, color: PLANK, solid: true })),
  ],
  // Sax's stonery: cut blocks stacked, the cutting slab (the pond's rim is Sax's work too)
  sax: [
    { ahead: 0.4, side: 0, w: 2.2, d: 2.2, h: 0.6, color: STONE, solid: true },
    ...[[-4.2, -2.8, 1.2], [-3, -2.8, 0.8], [-4.2, -1.6, 0.6], [3.6, -2.6, 1.6], [4.6, -2.6, 1], [3.6, -1.4, 0.5]].map(([s, a, h]) => ({ ahead: a, side: s, w: 1, d: 1, h, color: STONE, solid: true })),
  ],
  // Yarrow's apothecary: three raised herb beds, a jar shelf along the back
  yarrow: [
    ...[-3.6, 0, 3.6].map(s => ({ ahead: 0.6, side: s, w: 2.6, d: 1.3, h: 0.45, color: HERB, solid: true })),
    { ahead: -3.1, side: 0, w: 4, d: 0.6, h: 1.9, color: DARK, solid: true },
    ...[-1.4, -0.4, 0.6, 1.6].map(s => ({ ahead: -2.75, side: s, w: 0.35, d: 0.35, h: 0.35, y0: 1.2, color: JAR })),
  ],
  // Mallow's shop: a counter facing the green under an awning, crates beside it
  mallow: [
    { ahead: 1.2, side: 0, w: 4.2, d: 1, h: 1.1, color: PLANK, solid: true },
    ...[[-2.3, 1.7], [2.3, 1.7], [-2.3, -0.6], [2.3, -0.6]].map(([s, a]) => ({ ahead: a, side: s, w: 0.18, d: 0.18, h: 2.6, color: WOOD, solid: true })),
    { ahead: 0.6, side: 0, w: 5.2, d: 3, h: 0.14, y0: 2.6, color: CLOTH },
    ...[[-4.3, -2], [-3.2, -2.5], [4, -2.2]].map(([s, a]) => ({ ahead: a, side: s, w: 0.9, d: 0.9, h: 0.8, color: WOOD, solid: true })),
  ],
}
/** a part in world coords: its centre and yaw (the lot's yaw) */
export function partAt(lot: string, p: Part): { x: number; z: number; yaw: number } {
  const c = onLot(lot, p.ahead, p.side), l = lotAt(lot)!
  return { ...c, yaw: l.yaw + (p.turn ?? 0) }
}
/** the walker's boxes for every solid part: a turned part is sampled along its long side into small square boxes (an AABB
 *  round a turned table would block a whole corner), each as wide as the part is thin */
export function stationBoxes(groundY: number): (Box & { _lot?: string })[] {
  const out: (Box & { _lot?: string })[] = []
  for (const l of GLADE_LOTS) for (const p of STATIONS[l.id] ?? []) {
    if (!p.solid) continue
    const long = Math.max(p.w, p.d), thin = Math.max(0.3, Math.min(p.w, p.d)), n = Math.max(1, Math.round(long / thin))
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n - 0.5, along = p.w >= p.d ? { a: 0, s: t * p.w } : { a: t * p.d, s: 0 }
      const c = onLot(l.id, p.ahead + along.a, p.side + along.s), r = thin / 2
      out.push({ x0: c.x - r, x1: c.x + r, z0: c.z - r, z1: c.z + r, y0: groundY + (p.y0 ?? 0) - 0.5, y1: groundY + (p.y0 ?? 0) + p.h, _lot: l.id } as Box & { _lot: string })
    }
  }
  return out
}
/** the jetty's walkable deck boxes (stand on it over the water) */
export function jettyBoxes(waterY: number): Box[] {
  const j = gladeJetty(), out: Box[] = [], L = Math.hypot(j.x1 - j.x0, j.z1 - j.z0), n = Math.ceil(L / 1)
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, x = j.x0 + (j.x1 - j.x0) * t, z = j.z0 + (j.z1 - j.z0) * t
    out.push({ x0: x - j.w / 2, x1: x + j.w / 2, z0: z - j.w / 2, z1: z + j.w / 2, y0: waterY - 2, y1: waterY + 0.35 })
  }
  return out
}

// ── M39 slice 1: a lot with a saved BLUEPRINT (glade-<lot>, Alex's drawing) stands that building INSTEAD of its blockout.
// The view fetches them and registers them here; the walker's boxes follow (version bumps so dynamic-solids rebuilds).
const blueprints = new Map<string, HouseBlueprint>()
let bpVersion = 0
export const gladeBlueprintVersion = () => bpVersion
export const gladeBlueprint = (lot: string) => blueprints.get(lot) ?? null
export function setGladeBlueprint(lot: string, bp: HouseBlueprint | null) {
  if (bp && !fitsPad(bp, (lotAt(lot)?.w ?? 0), (lotAt(lot)?.d ?? 0))) bp = null   // oversize: refused, the blockout stays (never over the green)
  if (bp) blueprints.set(lot, bp); else blueprints.delete(lot)
  setLotSpot(lot, bp ? doorSpot(bp, lotPad(lot, 0)) : null)
  bpVersion++
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('glade-blueprints'))   // the folk re-place
}
/** where a lot's blueprint stands (its pad's centre, facing the green, on the Glade floor) */
export function lotPad(lot: string, y: number) { const l = lotAt(lot)!; return { x: l.x, z: l.z, yaw: l.yaw, y } }
/** every lot's solids: its blueprint's walls if it has one, else its blockout's */
export function gladeLotBoxes(groundY: number): Box[] {
  const out: Box[] = []
  for (const l of GLADE_LOTS) { const bp = blueprints.get(l.id); if (bp) out.push(...placeBlueprint(bp, lotPad(l.id, groundY)).boxes) }
  return [...out, ...stationBoxes(groundY).filter(b => !b._lot || !blueprints.has(b._lot))]
}

/** where a blueprint lot's Moglin stands: 1.2 m out from the building's FRONT-MOST outside door (the door with a room on one
 *  side and open ground on the other, nearest the green), on the open side; no outside door = 1.2 m in front of the footprint */
export function doorSpot(bp: HouseBlueprint, pad: { x: number; z: number; yaw: number; y: number }): { x: number; z: number } {
  const rooms = findRooms(bp.walls), inRoom = (i: number, j: number) => rooms.some(r => r.cells.some(([a, b]) => a === i && b === j))
  const place = placeBlueprint(bp, pad), out: { u: number; v: number }[] = []
  for (const [k, w] of Object.entries(bp.walls)) {
    if (w.kind !== 'door') continue
    const [o, a, b] = k.split(','), i = +a, j = +b
    if (o === 'h') { const r1 = inRoom(i, j - 1), r2 = inRoom(i, j); if (r1 !== r2) out.push({ u: i + 0.5, v: r2 ? j - 1.2 : j + 1.2 }) }
    else { const r1 = inRoom(i - 1, j), r2 = inRoom(i, j); if (r1 !== r2) out.push({ u: r2 ? i - 1.2 : i + 1.2, v: j + 0.5 }) }
  }
  if (!out.length) return place.toWorld(bp.w / 2, -1.2)
  // a two-piece door gives two spots side by side: average them; pick the door nearest the front (smallest v)
  out.sort((p, q) => p.v - q.v)
  const front = out.filter(p => Math.abs(p.v - out[0].v) < 1.5 && Math.abs(p.u - out[0].u) < 1.5)
  const u = front.reduce((t, p) => t + p.u, 0) / front.length, v = front.reduce((t, p) => t + p.v, 0) / front.length
  return place.toWorld(u, v)
}
