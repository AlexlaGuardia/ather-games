// ── BETA M105: THE BUILDER'S POI + ROADS OVERLAY (pure; drawn by TerrainEditor's tile view, BuilderOverview and BuilderFly) ──
// Alex 11-23: "a toggle to see an overlay of where all the POIs and roads will be so i can toggle it on and see if it matches up
// and then untoggle to clear the clutter". READ-ONLY: every marker and line is read from the SAME data the game reads, so it
// shows where things WILL be; nothing here places anything, and no name is invented (labels are the data's own names, or the
// kind of thing it is when the data has no name).
//   · the Wilds: the season's network (network.ts: settlements, the Thistledown Fair, the paths), Greg's arrival waymark
//     (relief.ts ARRIVAL = waymarks.ts GREG_WAYMARK), and the void field's crossings (wilds-voids.ts: cooled necks + path crossings).
//   · Moonwell Glade: the Moonwell, the gate out, the four gardens, Greg's bench, the newborn's spot, the five's lots, the friends'
//     Moglins (glade-cluster.ts / moonwell-glade.ts), and the cluster's paths (GLADE_FRAME.paths).
//   · the Nyx continent: the region's places (the stops = pitstops.ts isPitstop), every shop door (business/doors.ts) and the
//     drivable network + ferries (region.ts; a road point is [x, z, y]).
// Run the test: npx tsx src/app/shimmer/dev/editors/builder-pois.test.ts
import { FAIR_NAME, type Network } from '../../open/ather/network'
import { ARRIVAL } from '../../open/ather/relief'
import type { Crossing } from '../../open/ather/wilds-voids'
import { MOONWELL } from '../../open/ather/moonwell'
import { GLADE_GARDENS, GLADE_FRAME, GLADE_GATE, gardenAt, gladeClusterFolk, gladeNewbornSpot, gregInGlade } from '../../open/ather/glade-cluster'
import { GLADE_LOTS, lotAt } from '../../open/ather/moonwell-glade'
import type { RegionMeta } from '../../open/region'
import { isPitstop } from '../../open/continent/pitstops'

export type PoiKind = 'settlement' | 'fair' | 'arrival' | 'neck' | 'crossing' | 'moonwell' | 'gate' | 'garden' | 'folk' | 'lot' | 'stop' | 'place' | 'shop'
export interface Poi { kind: PoiKind; name: string; x: number; z: number }
export interface OvRoad { kind: string; pts: [number, number][] }
export interface Overlay { pois: Poi[]; roads: OvRoad[] }
export const EMPTY_OVERLAY: Overlay = { pois: [], roads: [] }

/** marker colour per kind (one legend for the three views) */
export const POI_COLOR: Record<PoiKind, string> = {
  settlement: '#fbbf24', fair: '#f472b6', arrival: '#a78bfa', neck: '#67e8f9', crossing: '#22d3ee', moonwell: '#60a5fa', gate: '#f87171',
  garden: '#86efac', folk: '#fde68a', lot: '#fcd34d', stop: '#fb923c', place: '#fde68a', shop: '#c4b5fd',
}
/** kinds that get a label in the overview (the rest are dots there: the overview is ~32 px a tile) */
export const OVERVIEW_LABEL: ReadonlySet<PoiKind> = new Set(['settlement', 'fair', 'arrival', 'moonwell', 'gate', 'garden', 'stop', 'place'])
export const ROAD_COLOR = '#fef3c7'

/** the Wilds: the network (null = no network baked: no settlements, fair or paths) + the void field's crossings */
export function wildsOverlay(net: Network | null, crossings: readonly Crossing[] | null): Overlay {
  const pois: Poi[] = []
  if (net) {
    for (const s of net.settlements) pois.push({ kind: 'settlement', name: s.name, x: s.x, z: s.z })
    if (net.fair) pois.push({ kind: 'fair', name: FAIR_NAME, x: net.fair.x, z: net.fair.z })
  }
  pois.push({ kind: 'arrival', name: 'arrival (Greg\'s waymark)', x: ARRIVAL.x, z: ARRIVAL.z })
  for (const c of crossings ?? []) pois.push({ kind: c.kind === 'neck' ? 'neck' : 'crossing', name: c.kind === 'neck' ? 'cooled neck' : 'path crossing', x: c.x, z: c.z })
  const roads: OvRoad[] = (net?.paths ?? []).map(p => ({ kind: 'path', pts: p.pts.map(q => [q[0], q[1]] as [number, number]) }))
  return { pois, roads }
}

/** Moonwell Glade (the closed cluster): every placed thing the Glade's own modules export */
export function gladeOverlay(): Overlay {
  const pois: Poi[] = [
    { kind: 'moonwell', name: 'Moonwell', x: MOONWELL.x, z: MOONWELL.z },
    { kind: 'gate', name: 'gate', x: GLADE_GATE.x, z: GLADE_GATE.z },
  ]
  for (const g of GLADE_GARDENS) { const a = gardenAt(g.id); pois.push({ kind: 'garden', name: `${g.keeper}'s garden`, x: a.x, z: a.z }) }
  const greg = gregInGlade(); pois.push({ kind: 'folk', name: greg.name, x: greg.x, z: greg.z })
  const nb = gladeNewbornSpot(); pois.push({ kind: 'arrival', name: 'newborn spot', x: nb.x, z: nb.z })
  for (const l of GLADE_LOTS) { const p = lotAt(l.id); if (p) pois.push({ kind: 'lot', name: `${l.id}'s lot`, x: p.x, z: p.z }) }
  for (const f of gladeClusterFolk()) pois.push({ kind: 'folk', name: f.name, x: f.x, z: f.z })
  const roads: OvRoad[] = GLADE_FRAME.paths.map(p => ({ kind: 'path', pts: p.pts.map(q => [q[0], q[1]] as [number, number]) }))
  return { pois, roads }
}

/** the Nyx continent: the region's places (a stop when pitstops.ts says so), the shop doors (`doors(townId)`, business/doors.ts),
 *  the drivable network (else the raw routes, region.ts drivable) and the ferry crossings */
export function nyxOverlay(meta: Pick<RegionMeta, 'places' | 'roads' | 'network'>, doors?: (townId: string) => readonly { name: string; at: { x: number; z: number } }[]): Overlay {
  const pois: Poi[] = []
  for (const p of meta.places) pois.push({ kind: isPitstop(p) ? 'stop' : 'place', name: p.name ?? p.kind, x: p.x, z: p.z })
  if (doors) for (const p of meta.places) for (const d of doors(p.id)) pois.push({ kind: 'shop', name: d.name, x: d.at.x, z: d.at.z })
  const edges = meta.network?.edges ?? meta.roads
  const roads: OvRoad[] = edges.map(e => ({ kind: e.kind, pts: e.pts.map(q => [q[0], q[1]] as [number, number]) }))
  for (const f of meta.network?.ferries ?? []) roads.push({ kind: 'ferry', pts: [[f.a[0], f.a[1]], [f.b[0], f.b[1]]] })
  return { pois, roads }
}

/** the POIs inside a box (world coords) */
export const poisIn = (o: Overlay, x0: number, z0: number, x1: number, z1: number) => o.pois.filter(p => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1)
/** the roads that touch a box (any point or segment midpoint inside, padded by `pad` m); kept whole, the view clips them */
export function roadsIn(o: Overlay, x0: number, z0: number, x1: number, z1: number, pad = 0): OvRoad[] {
  const a = x0 - pad, b = z0 - pad, c = x1 + pad, d = z1 + pad
  return o.roads.filter(r => r.pts.some(([x, z]) => x >= a && x <= c && z >= b && z <= d) || r.pts.some((p, k) => k > 0 && segBox(r.pts[k - 1], p, a, b, c, d)))
}
// a segment crossing a box with neither end inside (a long ferry, a straight road over a tile)
function segBox(p: [number, number], q: [number, number], a: number, b: number, c: number, d: number): boolean {
  for (let s = 1; s < 16; s++) { const t = s / 16, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t; if (x >= a && x <= c && z >= b && z <= d) return true }
  return false
}
/** a polyline resampled every `step` m (Fly drapes it on the ground: each point takes the terrain height there) */
export function resample(pts: readonly [number, number][], step: number): [number, number][] {
  if (pts.length < 2) return pts.map(p => [p[0], p[1]])
  const out: [number, number][] = [[pts[0][0], pts[0][1]]]
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1], [bx, bz] = pts[k], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step))
    for (let s = 1; s <= n; s++) out.push([ax + (bx - ax) * s / n, az + (bz - az) * s / n])
  }
  return out
}
