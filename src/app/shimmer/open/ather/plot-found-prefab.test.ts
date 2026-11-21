// plot-found-prefab.test (BETA M55 leftover, 11-21): a PREFAB room (Works.rooms) stands on a foundation of its own, like a drawn
// house. npx tsx src/app/shimmer/open/ather/plot-found-prefab.test.ts
import { liftOf, floorAt, plinthBoxes, doorSteps, setHouseFound, houseFoundDelta, roomLift, plinthPerM2, type Founded, type PrefabRoom } from './plot-found'
import { footprint, wallsOf, doorOf, benchOf, workPickables, ROOMS, DOOR_W, WALL_H, type Room, type Works } from './rooms'
import { GROUND_Y } from './plot'
import { terrainWorld } from '../terrain-world'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })
const G = GROUND_Y

const farm: Room = { id: 'farm-1', kind: 'farm', x: 20, z: 20, q: 0, placedAt: 0, doneAt: 0 }   // 8 x 6, door on the south... front = local -z = north at q 0
const f = footprint('farm', 20, 20, 0), m2 = (f.x1 - f.x0) * (f.z1 - f.z0)

// nothing set: the ground, as before
{
  const w: Founded = { rooms: [farm] }
  ok(floorAt(w, G, 20, 20) === G && plinthBoxes(w, G).length === 0 && doorSteps(w, G).length === 0 && roomLift(w, farm) === 0, 'no foundation: the room stands on the ground (no plinth, no steps)')
  const hs = liftOf(w).houses.filter(h => h.room)
  ok(hs.length === 1 && hs[0].room === 'farm-1' && hs[0].h === 0 && hs[0].m2 === m2, `the prefab room is a house of its own (${m2} m²)`)
  ok(liftOf(w).houseAt(20, 20)?.room === 'farm-1' && liftOf(w).houseAt(f.x1 + 3, 20)?.room === 'farm-1' && liftOf(w).houseAt(f.x1 + 7, 20) === null, 'the picker finds it from inside and from a few metres off, not from far away')
}

for (const h of [0.6, 1.2] as const) {
  const base: Founded = { rooms: [farm] }, house = liftOf(base).houseAt(20, 20)!
  const w = setHouseFound(base, house, h)
  ok(w.rooms![0].found === h && base.rooms![0].found === undefined, `${h}: setting it writes the room's own height (and leaves the old works alone)`)
  ok(houseFoundDelta(house, 0, h) === m2 * plinthPerM2(h), `${h}: it costs ${m2 * plinthPerM2(h)} Stone Brick (its footprint)`)
  ok(floorAt(w, G, 20, 20) === G + h && floorAt(w, G, f.x0 + 0.05, f.z0 + 0.05) === G + h && floorAt(w, G, f.x1 + 2, 20) === G, `${h}: inside rides up, outside stays the ground`)
  ok(roomLift(w, w.rooms![0]) === h, `${h}: roomLift = the room's height`)
  const wb = wallsOf(w.rooms![0] as Room, roomLift(w, w.rooms![0]))
  ok(wb.every(b => Math.abs(b.y1 - (G + h + WALL_H)) < 1e-9), `${h}: its walls stand a full wall above the plinth`)
  const pb = plinthBoxes(w, G)
  ok(pb.length === 1 && Math.abs(pb[0].y1 - (G + h)) < 1e-9 && pb[0].x0 < f.x0 && pb[0].x1 > f.x1, `${h}: one plinth block under the whole footprint and its walls`)
  const st = doorSteps(w, G), n = Math.ceil(h / 0.45) - 1, d = doorOf(farm)
  ok(st.length === n, `${h}: ${n} step(s) at the door (${st.length})`)
  ok(st.every(b => b.z1 <= f.z0 + 1e-9 && b.x0 >= d.x - DOOR_W / 2 - 1e-9 && b.x1 <= d.x + DOOR_W / 2 + 1e-9), `${h}: the steps are outside the front wall, as wide as the door`)
  const tops = st.map(b => b.y1).sort((a, b) => b - a), rises = [G + h, ...tops, G].map((y, k, a) => (k ? a[k - 1] - y : 0)).slice(1)
  ok(rises.every(r => r > 0 && r <= 0.5 + 1e-9), `${h}: every rise is under the 0.5 m step rule (${rises.map(r => r.toFixed(2))})`)
  // the walker: from outside the door, walk in (south: front faces -z at q 0, so the keeper walks +z into the room) to the bench
  const solids = [...pb, ...st, ...wb]
  const world = terrainWorld({ ground: () => G, solids: () => solids, water: () => [] })
  const lc = createLoco(d.x, G, d.z - 3)
  for (let t = 0; t < 30; t++) tickLocomotion(lc, input(), world)
  for (let t = 0; t < 60 * 4; t++) tickLocomotion(lc, input({ mvZ: 1, fwdZ: 1, rightX: -1 }), world)
  const b = benchOf(farm)
  ok(Math.abs(lc.py - (G + h)) < 0.1 && lc.pz > f.z0 + 1 && lc.pz < f.z1, `${h}: a keeper walks up the steps through the door onto the raised floor (feet ${lc.py.toFixed(2)}, z ${lc.pz.toFixed(2)}, bench z ${b.z.toFixed(1)})`)
  // E reaches the bench at its raised height
  const pk = workPickables({ v: 1, rooms: [w.rooms![0] as Room], chests: [], pieces: [] } as Works, () => G, 0).find(p => p.item.kind === 'bench')
  ok(!!pk && pk.y1 >= G + h + 1.1, `${h}: the bench's aim capsule rides up with it`)
}

// the old plot-wide value: a room with no value of its own takes it (slice 1 saves); its own value wins
{
  const w: Founded = { found: 0.6, rooms: [farm, { ...farm, id: 'cook-1', kind: 'cooking', x: 40, found: 0 } as PrefabRoom] }
  ok(floorAt(w, G, 20, 20) === G + 0.6 && floorAt(w, G, 40, 20) === G, 'no value of its own = the old plot-wide setting; its own value (even None) wins')
}

// two prefab rooms are two houses: setting one leaves the other
{
  const two: Founded = { rooms: [farm, { ...farm, id: 'cook-1', kind: 'cooking', x: 40 } as PrefabRoom] }
  const w = setHouseFound(two, liftOf(two).houseAt(40, 20)!, 1.2)
  ok(floorAt(w, G, 40, 20) === G + 1.2 && floorAt(w, G, 20, 20) === G, 'each prefab room has its own foundation')
}

// every quarter turn: the steps go out of the front wall
for (const q of [0, 1, 2, 3]) {
  const r: PrefabRoom = { id: 'r', kind: 'carpentry', x: 10, z: 10, q, found: 0.6 }, w: Founded = { rooms: [r] }
  const st = doorSteps(w, G), d = doorOf(r as Room), fp = footprint('carpentry', 10, 10, q)
  const cx = (st[0].x0 + st[0].x1) / 2, cz = (st[0].z0 + st[0].z1) / 2
  const outside = cx < fp.x0 || cx > fp.x1 || cz < fp.z0 || cz > fp.z1
  ok(st.length === 1 && outside && Math.hypot(cx - d.x, cz - d.z) < 0.6, `q ${q}: the step stands outside the door (${cx.toFixed(2)}, ${cz.toFixed(2)} vs door ${d.x}, ${d.z})`)
}
void ROOMS

console.log(`plot-found-prefab: ${pass} pass, ${fails.length} fail`)
for (const x of fails) console.log('  ✗ ' + x)
if (fails.length) process.exit(1)
