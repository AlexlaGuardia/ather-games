// npx tsx src/app/shimmer/open/ather/obstacles.test.ts
// M117 s3: the shared obstacle query + Hollows respecting buildings (steer round, shots stop on walls, cover can't be cheesed).
import { bodyBlocked, segmentHit, lineOfSight, steer, type Structures } from './obstacles'
import { newCombat, spawnHollow, stepCombat, FLOATER, type Terrain } from './combat'
import { wakeChampion, CHAMP } from './champion'
import type { Box } from '../terrain-world'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const boxesQ = (bs: Box[]): Structures => (x0, z0, x1, z1) => bs.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0)
// a house-sized block between the keeper (z=0) and the Hollows (z<0): x -6..6, z -6..-4, 3 m tall
const HOUSE: Box = { x0: -6, y0: 0, z0: -6, x1: 6, y1: 3, z1: -4 }
const Q = boxesQ([HOUSE])
const inHouse = (x: number, z: number, r = 0) => x > HOUSE.x0 - r && x < HOUSE.x1 + r && z > HOUSE.z0 - r && z < HOUSE.z1 + r
const T: Terrain = { heightAt: () => 0, walkable: () => true, structures: Q }
const T0: Terrain = { heightAt: () => 0, walkable: () => true }

// the query
ok(bodyBlocked(Q, 0, 0, -5, 0.4), 'a body in the house is blocked')
ok(!bodyBlocked(Q, 0, 0, -3, 0.4), 'a body 1 m clear of the wall is free')
ok(bodyBlocked(Q, 0, 0, -3.7, 0.4), 'a body whose radius reaches the wall is blocked')
ok(!bodyBlocked(boxesQ([{ x0: -1, y0: 0, z0: -1, x1: 1, y1: 0.3, z1: 1 }]), 0, 0, 0, 0.4), 'a low slab (0.3 m) is stepped over')
ok(!bodyBlocked(boxesQ([{ x0: -1, y0: 2.5, z0: -1, x1: 1, y1: 3, z1: 1 }]), 0, 0, 0, 0.4), 'a box overhead (a lintel) does not block the body')
const hit = segmentHit(Q, 0, 1, -10, 0, 1, 0)
ok(!!hit && Math.abs(hit.z - -6) < 1e-6 && Math.abs(hit.t - 0.4) < 1e-6, `a line through the house enters it at its far face (${JSON.stringify(hit)})`)
ok(!segmentHit(Q, 0, 4, -10, 0, 4, 0), 'a line over the roof is clear')
ok(!segmentHit(Q, 8, 1, -10, 8, 1, 0), 'a line past its side is clear')
ok(!lineOfSight(Q, 0, 1, -10, 0, 1, 0) && lineOfSight(Q, -8, 1, -10, -8, 1, 0), 'lineOfSight agrees')
{ // steer: straight when clear; blocked, it turns and keeps the side it chose
  const free = (x: number, z: number) => !bodyBlocked(Q, x, 0, z, 0.4)
  const m = {}
  const v0 = steer(free, 0, 5, 0, -1, 1.2, m, 0.05)
  ok(!!v0 && v0.x === 0 && v0.z === -1, 'clear ahead: straight')
  const v1 = steer(free, 0, -3, 0, -1, 1.2, m, 0.05)
  ok(!!v1 && Math.abs(v1.x) > 0.4, `wall ahead: it turns (${JSON.stringify(v1)})`)
  const side = Math.sign(v1!.x), v2 = steer(free, side * 2, -3, 0, -1, 1.2, m, 0.05)
  ok(!!v2 && Math.sign(v2.x) === side, 'and keeps that side along the face')
}

// a shambler with the house between it and the keeper goes ROUND, never inside, and reaches the keeper
{
  const c = newCombat(3), h = spawnHollow(c, T, 0, -14); h.state = 'chase'
  let inside = 0, minD = 99, hpBefore = c.keeper.hp
  for (let i = 0; i < 20 * 25; i++) { stepCombat(c, T, { x: 0, y: 0, z: 0 }, 0.05); if (inHouse(h.x, h.z)) inside++; minD = Math.min(minD, Math.hypot(h.x, h.z)) }
  ok(inside === 0, `the shambler never stood inside the house (${inside} steps)`)
  ok(minD < 3, `it came round to the keeper (closest ${minD.toFixed(2)} m)`)
  ok(c.keeper.hp < hpBefore, 'and it reached them (a lunge landed)')
  // without the structure query it walks straight through: the same run, no structures
  const c0 = newCombat(3), h0 = spawnHollow(c0, T0, 0, -14); h0.state = 'chase'
  let in0 = 0
  for (let i = 0; i < 20 * 10; i++) { stepCombat(c0, T0, { x: 0, y: 0, z: 0 }, 0.05); if (inHouse(h0.x, h0.z)) in0++ }
  ok(in0 > 0, 'control: with no structures it walks through the house (the test can see the difference)')
}

// a floater's spit at a keeper behind the wall hits the WALL: the keeper's hp is unchanged, an impact is counted
{
  const c = newCombat(5), f = spawnHollow(c, T, 0, -12, 'floater')
  f.state = 'charge'; f.t = 0.01; f.y = FLOATER.hover
  const hp0 = c.keeper.hp
  for (let i = 0; i < 40; i++) stepCombat(c, T, { x: 0, y: 0, z: 0 }, 0.05)
  ok(c.keeper.hp === hp0, `keeper behind the wall untouched (${hp0} -> ${c.keeper.hp})`)
  ok((c.wallHits ?? 0) >= 1, `the spit hit the wall (wallHits ${c.wallHits})`)
  // control: the same spit in the open lands
  const c0 = newCombat(5), f0 = spawnHollow(c0, T0, 0, -12, 'floater'); f0.state = 'charge'; f0.t = 0.01; f0.y = FLOATER.hover
  for (let i = 0; i < 40; i++) stepCombat(c0, T0, { x: 0, y: 0, z: 0 }, 0.05)
  ok(c0.keeper.hp < hp0, 'control: in the open the same spit lands')
}

// no cheese: a floater that cannot see the keeper does not spit into the wall forever: it comes round and spits again
{
  const c = newCombat(7), f = spawnHollow(c, T, 0, -12, 'floater'); f.state = 'chase'; f.t = 0
  let sawAt = -1
  for (let i = 0; i < 20 * 30 && c.keeper.hp === 100; i++) {
    stepCombat(c, T, { x: 0, y: 0, z: 0 }, 0.05)
    if (sawAt < 0 && lineOfSight(Q, f.x, f.y, f.z, 0, 0.9, 0)) sawAt = i
  }
  ok(sawAt >= 0, 'the floater came round to see the keeper')
  ok(c.keeper.hp < 100, `and its spit reached them in the end (hp ${c.keeper.hp})`)
  ok((c.wallHits ?? 0) === 0, `it wasted no spit on the wall while it could not see them (wallHits ${c.wallHits})`)
}

// the keeper's own rounds stop on the wall too (cover cuts both ways: no shooting through a house at them)
{
  const c = newCombat(9), h = spawnHollow(c, T, 0, -8); h.state = 'stagger'; h.t = 99
  c.rounds.push({ x: 0, y: 1, z: -1, vx: 0, vy: 0, vz: -60, life: 1, dmg: 10, crit: 20 })
  const hp0 = h.hp
  for (let i = 0; i < 10; i++) stepCombat(c, T, { x: 0, y: 0, z: 0 }, 0.02)
  ok(h.hp === hp0 && (c.wallHits ?? 0) === 1, `a round into the wall stops there (Hollow hp ${hp0} -> ${h.hp}, wallHits ${c.wallHits})`)
  // a Hollow IN FRONT of the wall is still hit by the same shot
  const c2 = newCombat(9), h2 = spawnHollow(c2, T, 0, -3.5); h2.state = 'stagger'; h2.t = 99
  c2.rounds.push({ x: 0, y: 0.85, z: -1, vx: 0, vy: 0, vz: -150, life: 1, dmg: 10, crit: 20 })
  for (let i = 0; i < 3; i++) stepCombat(c2, T, { x: 0, y: 0, z: 0 }, 0.02)
  ok(h2.hp < 30, `a Hollow just in front of the wall is still hit (hp ${h2.hp})`)
}

// the champion walks round the house too, and its slam is taken by the wall
{
  const c = newCombat(11), node = { id: 'n', x: 0, z: -14 } as unknown as Parameters<typeof wakeChampion>[2]
  const ch = wakeChampion(c, T, node)
  let inside = 0
  for (let i = 0; i < 20 * 30; i++) { stepCombat(c, T, { x: 0, y: 0, z: 0 }, 0.05); if (c.champ && inHouse(c.champ.x, c.champ.z)) inside++ }
  ok(inside === 0, `the champion never stood inside the house (${inside})`)
  ok(Math.abs(ch.x) > 1 && ch.z < HOUSE.z0, `it works its way round, not into the wall (at ${ch.x.toFixed(1)}, ${ch.z.toFixed(1)})`)
  // a slam behind the wall: keeper right behind it, champion right in front: nothing
  const c2 = newCombat(12), ch2 = wakeChampion(c2, T, { id: 'm', x: 0, z: -8 } as never)
  ch2.state = 'windup'; ch2.attack = 'slam'; ch2.t = 0.001; ch2.sink = 0; ch2.z = -7.2
  const hp0 = c2.keeper.hp
  stepCombat(c2, T, { x: 0, y: 0, z: -2.5 }, 0.05)
  ok(c2.keeper.hp === hp0, `the slam does not reach through the wall (${hp0} -> ${c2.keeper.hp}; ring ${CHAMP.slam.r} m, ${(7.2 - 2.5).toFixed(1)} m away)`)
}

console.log(`${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
