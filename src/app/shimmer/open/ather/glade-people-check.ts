// ── BETA M153 s1c-1: MAY THESE PEOPLE STAND THERE? ──
// Publish asks this of everyone in the Glade, moved or not (a hill, a pond or a fence can trap somebody who never moved): not in the
// void, not in the water as drawn, not inside a solid piece or house, and reachable on foot from the newborn spot by the WALKER's own
// rules (terrain-world: its body, its half-metre step, its slope; no jump, no climb). Pure; glade-people-check.test.ts (the live layer).
import { terrainWorld, type Shape } from '../terrain-world'
import { plotShape, mistWalls } from './plot'
import { mateWalls } from './cluster'
import { GLADE_FRAME, GLADE_GATE, GLADE_OWNED } from './glade-cluster'
import { withPieces } from './dynamic-solids'
import { withZoneParts, zoneParts, zonePartBoxes } from './zone-parts'
import { SCENERY_BY, sceneryBoxes, sceneryPlaced } from './scenery'
import { ROOM_PREFIX, isRoom } from '../../world/builder-props'
import { gladeLayerGround, gladeWet, type GladeLayer } from './glade-layer'
import { BENCH_IN, PAD_FALL, fromRect, inRect, padGround, padLevel, rectPoints, rectsOverlap, roomPads, type Ground, type RoomPad } from './glade-pads'
import { gladePlaces, placeDoor, placeSolids, type GladePlace } from './glade-places'
import { pondDepthIn } from './relief'
import { gladeJetty } from './moonwell-glade'
import type { Box } from '../terrain-world'

export interface Standing { who: string; name: string; x: number; z: number }
/** the Glade as the walker has it under this layer (page.tsx gladeShape, the same pieces) */
export function gladeShapeOf(layer: GladeLayer): Shape {
  const ground = gladeLayerGround(layer.edits)
  return withZoneParts(withPieces({ ...plotShape(GLADE_OWNED, [...mistWalls(GLADE_OWNED), ...mateWalls(GLADE_FRAME)]), ground }, () => null, true),
    solidPieces(layer))
}
/** the owner's solid pieces: the building zones' parts and the scenery that blocks */
const solidPieces = (layer: GladeLayer, rooms = true): Box[] => { const ground = gladeLayerGround(layer.edits); return [...zonePartBoxes(zoneParts(layer.zones ?? [], ground)), ...sceneryBoxes(sceneryPlaced(layer.props ?? [], padGround(layer.props, ground), ground).filter(p => rooms || !isRoom(p)))] }

/** how near the walk must end (E reaches 3 m) */
export const WALK_REACH = 2.2
const CELL = 1, SUB = 0.5, STEP = 0.5, DROP = 1.4, CAP = 60000
type P = { x: number; z: number }
/** Can a body walk from a to within WALK_REACH of b (or of any of b's, one search for them all)? */
export function walkReach(shape: Shape, stand: Ground = shape.ground): (a: P, b: P | readonly P[]) => boolean {
  const w = terrainWorld(shape)
  // a metre's move in half-metre strides; the feet's new height, or null = stopped. `back` asks the same move made the other way round.
  const move = (x: number, z: number, y: number, dx: number, dz: number, back: boolean): number | null => {
    for (let k = 1; k <= CELL / SUB; k++) {
      const nx = x + dx * SUB * k, nz = z + dz * SUB * k, f = w.floorAt(nx, nz, y, back ? DROP : STEP)
      if (f === null || !Number.isFinite(f) || !w.bodyFree(nx, nz, f)) return null
      y = f
    }
    return y
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const search = (from: readonly P[], to: readonly P[], back: boolean, cap: number): 'met' | 'closed' | 'cap' => {
    const a = from[0], b = to[0], h = (i: number, j: number) => Math.abs(a.x + i - b.x) + Math.abs(a.z + j - b.z)
    // a binary heap on distance to go (greedy): finds a way, not the shortest
    const heap: { f: number; i: number; j: number; y: number }[] = [], seen = new Set<string>()
    const push = (n: { f: number; i: number; j: number; y: number }) => { let c = heap.push(n) - 1; while (c) { const p = (c - 1) >> 1; if (heap[p].f <= n.f) break; heap[c] = heap[p]; c = p } heap[c] = n }
    const pop = () => { const top = heap[0], n = heap.pop()!; if (heap.length) { let c = 0; for (;;) { let k = 2 * c + 1; if (k >= heap.length) break; if (k + 1 < heap.length && heap[k + 1].f < heap[k].f) k++; if (heap[k].f >= n.f) break; heap[c] = heap[k]; c = k } heap[c] = n } return top }
    for (const p of from) { const y = w.floorAt(p.x, p.z, stand(p.x, p.z), STEP), i = p.x - a.x, j = p.z - a.z; if (y !== null && !seen.has(`${i},${j}`)) { seen.add(`${i},${j}`); push({ f: h(i, j), i, j, y }) } }
    while (heap.length) {
      if (seen.size > cap) return 'cap'
      const n = pop(), x = a.x + n.i, z = a.z + n.j
      if (to.some(q => Math.hypot(x - q.x, z - q.z) <= WALK_REACH && Math.abs(n.y - stand(q.x, q.z)) < 2)) return 'met'
      for (const [dx, dz] of DIRS) {
        const i = n.i + dx, j = n.j + dz, id = `${i},${j}`; if (seen.has(id)) continue
        const y = move(x, z, n.y, dx, dz, back); if (y === null) continue
        seen.add(id); push({ f: h(i, j), i, j, y })
      }
    }
    return 'closed'
  }
  // from the person's side first: a pocket they are shut in fills at once (the long way round would walk the whole Glade to say no)
  return (a, b) => { const bs = 'x' in b ? [b] : b; return search(bs, [a], true, 6000) !== 'closed' && search([a], bs, false, CAP) === 'met' }
}

/** What is wrong, one line each, ready to read; [] = publish. `people` = glade-cluster gladePeople() (the newborn spot among them). */
export function peopleProblems(layer: GladeLayer, people: readonly Standing[]): string[] {
  const shape = gladeShapeOf(layer), stand = padGround(layer.props, shape.ground), w = terrainWorld(shape), wet = gladeWet(layer), out: string[] = [], good: Standing[] = []
  for (const p of people) {
    const g = shape.ground(p.x, p.z)
    if (!Number.isFinite(g) || [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].some(([dx, dz]) => !Number.isFinite(shape.ground(p.x + dx, p.z + dz)))) out.push(`${p.name} is in the void`)
    else if (wet(p.x, p.z)) out.push(`${p.name} is in the water`)
    // the body stands on what is under its feet (a slope, a doorstep); anything else in it is a solid piece
    else { const f = w.floorAt(p.x, p.z, stand(p.x, p.z), STEP); if (f === null || !w.bodyFree(p.x, p.z, f)) out.push(`${p.name} is inside something solid`); else good.push(p) }
  }
  const nb = good.find(p => p.who === 'newborn')
  if (nb) { const reach = walkReach(shape, stand); for (const p of good) if (p !== nb && !reach(nb, p)) out.push(`${p.name} cannot be reached on foot from the newborn spot`) }
  return out
}

/** how clear of the gate a house must be (m) */
export const GATE_CLEAR = 3
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1 && a.y0 < b.y1 && b.y0 < a.y1
/** a door and where a body can step from it in a straight line: the search walks whole metres, so a narrow porch (Hazel's) can fall between
 *  them from the door's own spot */
function doorway(w: ReturnType<typeof terrainWorld>, d: P, f: number): P[] {
  const out = [d]
  for (let k = 0; k < 8; k++) for (let m = 1; m <= 8; m++) {
    const x = d.x + Math.cos(k * Math.PI / 4) * m * 0.25, z = d.z + Math.sin(k * Math.PI / 4) * m * 0.25
    if (!w.bodyFree(x, z, f)) break
    if (m === 2 || m === 5 || m === 8) out.push({ x, z })
  }
  return out
}
/** s1c-3: a garden room's furniture, and where a keeper stands at it (0.35 m clear of the deepest bench) */
const roomSolids = (r: RoomPad, layer: GladeLayer, land: Ground): Box[] => sceneryBoxes(sceneryPlaced((layer.props ?? []).filter(p => p.id === r.id), land).map(p => ({ ...p, low: undefined })))
const roomSpot = (r: RoomPad): P => fromRect(r, 0, r.d / 2 - BENCH_IN - 1.2)
/** s1c-2: may the houses stand there? The same shape of answer as peopleProblems. A house nobody moved is only asked whether its door can
 *  still be reached, and whether a moved one stands in it: the rest is the Glade as built. s1c-3: the garden rooms are asked the same. */
export function placeProblems(layer: GladeLayer, places: readonly GladePlace[] = gladePlaces(), newborn: P | null = null): string[] {
  const shape = gladeShapeOf(layer), land = shape.ground, stand = padGround(layer.props, land), w = terrainWorld(shape), wet = gladeWet(layer), out: string[] = [], pieces = solidPieces(layer, false)
  const j = gladeJetty(), jetty = { x: (j.x0 + j.x1) / 2, z: (j.z0 + j.z1) / 2, yaw: Math.atan2(j.x1 - j.x0, j.z1 - j.z0), w: j.w, d: Math.hypot(j.x1 - j.x0, j.z1 - j.z0) }
  // a newborn spot that is itself wrong is peopleProblems' one line, not six doors
  const nf = newborn && Number.isFinite(land(newborn.x, newborn.z)) ? w.floorAt(newborn.x, newborn.z, stand(newborn.x, newborn.z), STEP) : null
  const reach = newborn && nf !== null && w.bodyFree(newborn.x, newborn.z, nf) && !wet(newborn.x, newborn.z) ? walkReach(shape, stand) : null, said = new Set<string>()
  const all: (GladePlace | (RoomPad & { name: string; moved: true; place: null }))[] = [...places, ...roomPads(layer.props).map(r => ({ ...r, name: SCENERY_BY.get(ROOM_PREFIX + r.room)?.label ?? r.room, moved: true as const, place: null }))]
  const solids = (p: (typeof all)[number]) => (p.place === null ? roomSolids(p, layer, land) : placeSolids(p.place, land))
  for (const p of all) {
    const pts = p.moved ? rectPoints(p) : [], own = p.moved ? solids(p) : [], crate = p.place === 'jars', room = p.place === null
    const no = (why: string) => { out.push(`${p.name} ${why}`) }
    if (p.moved) {
      if (pts.some(q => !Number.isFinite(land(q.x, q.z)))) { no('is in the void'); continue }
      if (pts.some(q => pondDepthIn(q.x, q.z) > 0) || rectsOverlap(p, jetty)) { no('is in the Moonwell'); continue }
      if (pts.some(q => wet(q.x, q.z))) { no('is in the water'); continue }
      const v = padLevel(p, land); if (v.top - v.low > PAD_FALL) { no(`is on a slope (the ground falls ${(v.top - v.low).toFixed(1)} m under it, ${PAD_FALL} at most)`); continue }
      if (inRect(p, GLADE_GATE.x, GLADE_GATE.z, GATE_CLEAR)) { no('is in the gate'); continue }
      const other = all.find(o => o !== p && (!room && o.place !== null && (crate || o.place === 'jars') ? solids(o).some(a => own.some(b => hits(a, b))) : rectsOverlap(p, o)))
      if (other) { const pair = [p.id, other.id].sort().join(); if (!said.has(pair)) { said.add(pair); no(`stands in ${other.name}`) } continue }
      if (own.some(b => pieces.some(q => hits(b, q)))) { no('stands in a solid piece'); continue }
    }
    if (crate && !p.moved) continue   // beside Yarrow's door, which is asked
    const d = p.place === null ? roomSpot(p) : placeDoor(p.place), f = Number.isFinite(land(d.x, d.z)) ? w.floorAt(d.x, d.z, stand(d.x, d.z), STEP) : null
    if (f === null || !w.bodyFree(d.x, d.z, f) || wet(d.x, d.z)) no(room ? 'has a bench nobody can stand at' : crate ? 'has no room in front of it' : 'has a door nobody can stand at')
    else if (reach && newborn && !reach(newborn, doorway(w, d, f))) no(crate || room ? 'cannot be reached on foot from the newborn spot' : 'has a door nobody can reach on foot')
  }
  return out
}
