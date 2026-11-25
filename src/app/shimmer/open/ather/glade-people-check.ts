// ── BETA M153 s1c-1: MAY THESE PEOPLE STAND THERE? ──
// Publish asks this of everyone in the Glade, moved or not (a hill, a pond or a fence can trap somebody who never moved): not in the
// void, not in the water as drawn, not inside a solid piece or house, and reachable on foot from the newborn spot by the WALKER's own
// rules (terrain-world: its body, its half-metre step, its slope; no jump, no climb). Pure; glade-people-check.test.ts (the live layer).
import { terrainWorld, type Shape } from '../terrain-world'
import { plotShape, mistWalls } from './plot'
import { mateWalls } from './cluster'
import { GLADE_FRAME, GLADE_OWNED } from './glade-cluster'
import { withPieces } from './dynamic-solids'
import { withZoneParts, zoneParts, zonePartBoxes } from './zone-parts'
import { sceneryBoxes, sceneryPlaced } from './scenery'
import { gladeLayerGround, gladeWet, type GladeLayer } from './glade-layer'

export interface Standing { who: string; name: string; x: number; z: number }
/** the Glade as the walker has it under this layer (page.tsx gladeShape, the same pieces) */
export function gladeShapeOf(layer: GladeLayer): Shape {
  const ground = gladeLayerGround(layer.edits)
  return withZoneParts(withPieces({ ...plotShape(GLADE_OWNED, [...mistWalls(GLADE_OWNED), ...mateWalls(GLADE_FRAME)]), ground }, () => null, true),
    [...zonePartBoxes(zoneParts(layer.zones ?? [], ground)), ...sceneryBoxes(sceneryPlaced(layer.props ?? [], ground))])
}

/** how near the walk must end (E reaches 3 m) */
export const WALK_REACH = 2.2
const CELL = 1, SUB = 0.5, STEP = 0.5, DROP = 1.4, CAP = 60000
type P = { x: number; z: number }
/** Can a body walk from a to within WALK_REACH of b? */
export function walkReach(shape: Shape): (a: P, b: P) => boolean {
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
  const search = (a: P, b: P, back: boolean, cap: number): 'met' | 'closed' | 'cap' => {
    const y0 = w.floorAt(a.x, a.z, shape.ground(a.x, a.z), STEP); if (y0 === null) return 'closed'
    const h = (i: number, j: number) => Math.abs(a.x + i - b.x) + Math.abs(a.z + j - b.z)
    // a binary heap on distance to go (greedy): finds a way, not the shortest
    const heap: { f: number; i: number; j: number; y: number }[] = [], seen = new Set(['0,0'])
    const push = (n: { f: number; i: number; j: number; y: number }) => { let c = heap.push(n) - 1; while (c) { const p = (c - 1) >> 1; if (heap[p].f <= n.f) break; heap[c] = heap[p]; c = p } heap[c] = n }
    const pop = () => { const top = heap[0], n = heap.pop()!; if (heap.length) { let c = 0; for (;;) { let k = 2 * c + 1; if (k >= heap.length) break; if (k + 1 < heap.length && heap[k + 1].f < heap[k].f) k++; if (heap[k].f >= n.f) break; heap[c] = heap[k]; c = k } heap[c] = n } return top }
    push({ f: h(0, 0), i: 0, j: 0, y: y0 })
    while (heap.length) {
      if (seen.size > cap) return 'cap'
      const n = pop(), x = a.x + n.i, z = a.z + n.j
      if (Math.hypot(x - b.x, z - b.z) <= WALK_REACH && Math.abs(n.y - shape.ground(b.x, b.z)) < 2) return 'met'
      for (const [dx, dz] of DIRS) {
        const i = n.i + dx, j = n.j + dz, id = `${i},${j}`; if (seen.has(id)) continue
        const y = move(x, z, n.y, dx, dz, back); if (y === null) continue
        seen.add(id); push({ f: h(i, j), i, j, y })
      }
    }
    return 'closed'
  }
  // from the person's side first: a pocket they are shut in fills at once (the long way round would walk the whole Glade to say no)
  return (a, b) => search(b, a, true, 6000) !== 'closed' && search(a, b, false, CAP) === 'met'
}

/** What is wrong, one line each, ready to read; [] = publish. `people` = glade-cluster gladePeople() (the newborn spot among them). */
export function peopleProblems(layer: GladeLayer, people: readonly Standing[]): string[] {
  const shape = gladeShapeOf(layer), w = terrainWorld(shape), wet = gladeWet(layer), out: string[] = [], good: Standing[] = []
  for (const p of people) {
    const g = shape.ground(p.x, p.z)
    if (!Number.isFinite(g) || [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].some(([dx, dz]) => !Number.isFinite(shape.ground(p.x + dx, p.z + dz)))) out.push(`${p.name} is in the void`)
    else if (wet(p.x, p.z)) out.push(`${p.name} is in the water`)
    // the body stands on what is under its feet (a slope, a doorstep); anything else in it is a solid piece
    else { const f = w.floorAt(p.x, p.z, g, STEP); if (f === null || !w.bodyFree(p.x, p.z, f)) out.push(`${p.name} is inside something solid`); else good.push(p) }
  }
  const nb = good.find(p => p.who === 'newborn')
  if (nb) { const reach = walkReach(shape); for (const p of good) if (p !== nb && !reach(nb, p)) out.push(`${p.name} cannot be reached on foot from the newborn spot`) }
  return out
}
