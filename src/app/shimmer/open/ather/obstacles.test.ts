// npx tsx src/app/shimmer/open/ather/obstacles.test.ts
// M117 s3: the shared obstacle query + Hollows respecting buildings (steer round, shots stop on walls, cover can't be cheesed).
import { bodyBlocked, segmentHit, lineOfSight, steer, bodyRadius, plotFootprints, routeAround, clearSpot, footBlocked, footDist, centreIn, centreClear, type Structures } from './obstacles'
import { makeTrot, type Toy } from './spirit-trot'
import { FURNITURE } from './furniture'
import { GROWN } from '../../sprites/creature-size'
import { newCombat, spawnHollow, stepCombat, FLOATER, SHAMBLER, type Terrain } from './combat'
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
  ok(h2.hp < SHAMBLER.hp, `a Hollow just in front of the wall is still hit (hp ${h2.hp})`)
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

// ── M117 s1: the plot's footprints, by body size; spirits steer round planters + pieces ────────────────────────────────────
{
  const rA = bodyRadius(GROWN.axolotl), rF = bodyRadius(GROWN.fox)
  ok(Math.abs(rA - 0.45) < 1e-9, `the grown Manalotl (0.90 m long) has a 0.45 m body radius (${rA})`)
  ok(rF > 0.3 && rF < rA, `the Vulnyx (no canon length, 0.70 tall) is a smaller body (${rF})`)
  ok(bodyRadius({ height: 0.1 }) === 0.15, 'a tiny body keeps a 0.15 m floor')
  const F = plotFootprints([
    { id: 'pl', item: 'spirit_planter', x: 0, z: 0 }, { id: 'sl', item: 'goldwood_slab', x: 5, z: 5 },
    { id: 'hu', item: 'goldwood_hurdle', x: 3, z: 0, q: 1 }, { id: 'rr', item: 'running_ring', x: -4, z: 0 }, { id: 'gp', item: 'guard_posts', x: 0, z: 4 },
    { id: 'bx', item: 'planter_box', x: 0, z: -3, q: 1 }, { id: 'st', item: 'goldwood_stool', x: 3, z: -3 }])
  ok(!F.some(f => f.id === 'sl'), 'a floor slab is ground, not a footprint')
  ok(F.some(f => f.id === 'st'), 'a non-solid piece (a stool) is in her way too: she cannot step onto it')
  const fp = (id: string) => F.find(f => f.id === id)!
  ok(Math.abs(fp('pl').rect.x1 - 0.45) < 1e-9 && fp('pl').parts.length === 1, 'a planter: its 0.9 m rect, parts = the rect')
  ok(Math.abs((fp('bx').rect.x1 - fp('bx').rect.x0) - FURNITURE.planter_box.d) < 1e-9, 'a quarter-turned planter box swaps its width and depth')
  ok(fp('hu').parts.length === 2 && fp('rr').parts.length === 16 && fp('gp').parts.length === 2, 'training pieces: hurdle 2 end posts, ring 16 posts, guard 2 posts')
  // by body size: the Manalotl clears the planter's face by her radius; the corner is round (distance, not a padded square)
  ok(footBlocked(F, 0.45 + 0.4, 0, rA) && !footBlocked(F, 0.45 + 0.5, 0, rA), 'the Manalotl stands clear of a planter face by 0.45 m, not 0.22')
  ok(!footBlocked(F, 0.45 + 0.4, 0, 0.3), 'a smaller body may stand nearer')
  ok(!footBlocked(F, 0.45 + 0.33, 0.45 + 0.33, rA), 'a planter corner is rounded by her radius')
  // the piece she plays at keeps only its parts: the guard gap and the ring's inside are hers, a post never
  ok(footBlocked(F, 0.4, 4, rA) && !footBlocked(F, 0.4, 4, rA, 'gp') && footBlocked(F, 0.6, 4, rA, 'gp'), 'guard posts: the gap is open while she plays them, a post is not')
  ok(!footBlocked(F, -4 + 1.15, 0, rF, 'rr') && footBlocked(F, -4 + 1.15, 0, rF), 'the ring: its lap line is open only while she plays it')
  ok(centreIn(F, 0.1, 0.1) === 'pl' && centreIn(F, 0.4, 4) === null && centreIn(F, 0.6, 4) === 'gp', 'centreIn: a planter counts whole, a training piece its parts')
}
{ // steer never ends inside a footprint: a body walks to 40 random goals through a garden of pieces, every step checked
  const r = bodyRadius(GROWN.axolotl), R0 = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647) })()
  const F = plotFootprints([{ id: 'a', item: 'spirit_planter', x: 0, z: 0 }, { id: 'b', item: 'spirit_planter', x: 2.2, z: 0.5 }, { id: 'c', item: 'planter_box', x: -1, z: 2.5 },
    { id: 'd', item: 'goldwood_bench', x: 1, z: -2.5 }, { id: 'e', item: 'push_stone', x: -2.5, z: -1 }, { id: 'f', item: 'goldwood_hurdle', x: 3.5, z: 3 }])
  const free = (x: number, z: number) => Math.abs(x) < 7 && Math.abs(z) < 7 && !footBlocked(F, x, z, r)
  let x = -5, z = -5, worst = Infinity, inside = 0, reached = 0, steps = 0
  for (let g = 0; g < 40; g++) {
    let gx = 0, gz = 0; do { gx = R0() * 12 - 6; gz = R0() * 12 - 6 } while (!free(gx, gz))
    const m = {}
    for (let i = 0; i < 400; i++) {
      if (Math.hypot(gx - x, gz - z) < 0.2) { reached++; break }
      const v = steer(free, x, z, gx - x, gz - z, 0.8, m, 0.05); if (!v) break
      const nx = x + v.x * 0.05, nz = z + v.z * 0.05
      if (free(nx, nz)) { x = nx; z = nz }   // the mover only takes a free step (as every caller does)
      steps++; if (centreIn(F, x, z)) inside++; worst = Math.min(worst, centreClear(F, x, z))
    }
  }
  ok(inside === 0 && worst >= r - 1e-9, `steer: ${steps} steps, body centre never inside a footprint (closest ${worst.toFixed(3)} m >= radius ${r})`)
  ok(reached >= 25, `steer: she reaches most goals round the pieces (${reached}/40)`)
}
{ // the trot: 2 min of roam + party play in a garden of planters + training pieces; her centre is never in a footprint, and
  // she still reaches and plays an allowed training piece (its approach point outside its parts)
  const pcs = [{ id: 'home', item: 'spirit_planter', x: 0, z: 0 }, { id: 'p2', item: 'spirit_planter', x: 2.4, z: 0.6 }, { id: 'bx', item: 'planter_box', x: -1.5, z: 2.6 },
    { id: 'hu', item: 'goldwood_hurdle', x: -2.2, z: -1.6 }, { id: 'ps', item: 'push_stone', x: 1.6, z: -2.4 }, { id: 'rr', item: 'running_ring', x: 4.5, z: 4.5 }, { id: 'gp', item: 'guard_posts', x: -4, z: 2 }]
  const allPlayed = new Set<string>()
  for (const [sp, seed] of [['axolotl', 3], ['fox', 9], ['axolotl', 17], ['fox', 23]] as const) {
    const r = bodyRadius(GROWN[sp]), F = plotFootprints(pcs), rMin = Math.max(0.9, 0.45 + r + 0.08)
    const toys: Toy[] = pcs.filter(p => FURNITURE[p.item].train).map(p => { const f = FURNITURE[p.item], kind = f.play ?? 'leap'
      return { id: p.id, x: p.x, z: p.z, ax: 0, az: 1, stat: f.train!, kind, size: kind === 'shove' ? f.d / 2 : kind === 'guard' ? f.w / 2 - 0.3 : kind === 'laps' ? f.w / 2 - 0.15 : undefined } })
    const tr = makeTrot({ home: { x: 0, z: 0 }, rMin, rMax: rMin + 0.6, roam: { maxLeg: 4.5, away: 3 }, toys: () => toys,
      blocked: (x, z, toy) => Math.abs(x) > 8 || Math.abs(z) > 8 || footBlocked(F, x, z, r, toy) }, seed)
    const k = { x: 0.5, z: 3.5, yaw: 0 }; tr.near(() => k)
    let inside = '', worst = Infinity, played = new Set<string>()
    tr.onPlayed(id => played.add(id))
    for (let i = 0; i < 120 * 30; i++) { const p = tr.step(1 / 30), c = centreIn(F, p.x, p.z); if (c && !inside) inside = `${c} at ${p.x.toFixed(2)},${p.z.toFixed(2)} (${p.mode})`; worst = Math.min(worst, centreClear(F, p.x, p.z)) }
    ok(!inside, `trot ${sp} seed ${seed}: 2 min, centre never inside a planter / piece (closest ${worst.toFixed(3)} m) ${inside}`)
    for (const x of played) allPlayed.add(x); ok(played.size > 0, `trot ${sp} seed ${seed}: she still reaches and plays a training piece (${[...played].join(',')})`)
  }
  ok(allPlayed.has('rr') && allPlayed.has('ps') && allPlayed.has('hu'), `the ring (inside its posts), the stone and the hurdle are all still played (${[...allPlayed].join(',')})`)
}

{ // M117 s2: routeAround: a walker's planned leg round a house never enters it, ends exactly at the goal, and is straight when clear
  const free = (x: number, z: number) => !bodyBlocked(Q, x, 0, z, 0.35)
  const a = { x: 0, z: -12 }, b = { x: 1, z: 2 }, r = routeAround(free, a, b)!
  let prev = a, ins = 0, tight = 0, L = 0
  for (const q of r) { const m = Math.ceil(Math.hypot(q.x - prev.x, q.z - prev.z) / 0.05); L += Math.hypot(q.x - prev.x, q.z - prev.z)
    for (let u = 1; u <= m; u++) { const x = prev.x + (q.x - prev.x) * u / m, z = prev.z + (q.z - prev.z) * u / m; if (inHouse(x, z)) ins++; if (!free(x, z)) tight++ } prev = q }
  ok(!!r && ins === 0 && tight === 0, `routeAround: the leg round the house never enters it nor brushes it (${ins}, ${tight}; ${r.length} points)`)
  ok(r[r.length - 1] === b && L < 14.2 + 12 + 4, `routeAround: ends at the goal, a short way round (${L.toFixed(1)} m)`)
  ok(routeAround(free, { x: -8, z: -12 }, { x: -8, z: 2 })!.length === 1, 'routeAround: a clear line is one straight leg')
  ok(routeAround(() => false, a, b) === null, 'routeAround: no way at all = null (the caller falls back)')
  const c = clearSpot(free, { x: 0, z: -5 }); ok(free(c.x, c.z) && Math.hypot(c.x, c.z + 5) < 1.6, `clearSpot: a stand point in the house moves to the nearest clear spot (${c.x.toFixed(2)},${c.z.toFixed(2)})`)
}

console.log(`${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
