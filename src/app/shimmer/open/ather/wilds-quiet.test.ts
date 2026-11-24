// npx tsx src/app/shimmer/open/ather/wilds-quiet.test.ts
// Alex 11-15: CLEARED GROUND STAYS QUIET. populate() never spawns on it (549506e2), and the strays on it melt on the kill.
// M120 broke the rest of the promise: a stray now comes as a PACK of 3-5 (s1) or a BROOD of crawlers (s2), and a pack's
// heading roams PACK.roam m at a time with no notion of whose ground it is, so a pack topped up just over the border
// drifted in as one (node-check on prod 11-24: quiet 5 on the cleared node, the assert allows 1; flaky, by where it spawned).
// The rule now: a Hollow that is only WANDERING never steps from drained ground onto cleared ground (a pack's heading,
// a stray's own wander, a floater's drift, a crawler seeking its kind). A Hollow CHASING the keeper still follows them in:
// that is a fight the keeper is in, not the ground filling up.
import { newCombat, spawnHollow, stepCombat, populate, groupPack, type Combat } from './combat'
import { FLAT } from './wilds-sim'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const DT = 1 / 60
// the border is x = 0: west of it is drained (an infected node's ground), east of it is a cleared node's
const drained = (x: number, _z: number) => x < 0
const setup = (seed: number): Combat => { const c = newCombat(seed); c.drained = drained; return c }
const onCleared = (c: Combat) => c.hollows.filter(h => !drained(h.x, h.z)).length

// (1) the prod shape: the keeper stands on cleared ground 60 m in, the top-up runs every 1.5 s (target 11, as near a node),
//     for a minute. Nobody ever stands on the cleared side (every seed).
{
  const keeper = { x: 60, y: 0, z: 0 }
  let worst = 0, spawned = 0
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]) {
    const c = setup(seed)
    for (let t = 0, pop = 0; t < 60; t += DT) {
      if ((pop -= DT) <= 0) { pop = 1.5; populate(c, FLAT, keeper.x, keeper.z, 11, undefined, drained) }
      stepCombat(c, FLAT, keeper, DT)
      worst = Math.max(worst, onCleared(c))
    }
    spawned += c.hollows.length
  }
  ok(spawned > 0, 'the top-up spawned nobody (the test proves nothing)')
  ok(worst === 0, `a wandering stray stood on cleared ground (worst ${worst} at once)`)
}

// (2) a pack right on the border, its heading set over it: it holds at the border, nobody crosses
{
  const c = setup(7)
  const ids = [0, 1, 2, 3].map(i => spawnHollow(c, FLAT, -1.5 - (i % 2) * 1.5, i * 1.5, i === 3 ? 'floater' : 'shambler').id)
  const pk = groupPack(c, ids)
  c.packs![pk].wx = 10; c.packs![pk].wz = 0; c.packs![pk].t = 30
  let worst = 0
  for (let t = 0; t < 30; t += DT) { stepCombat(c, FLAT, { x: 500, y: 0, z: 500 }, DT); worst = Math.max(worst, onCleared(c)) }
  ok(c.hollows.length === 4, 'the pack is still there')
  ok(worst === 0, `a pack heading over the border walked in (${worst} on cleared ground)`)
}

// (2b) a crowd pressed against the border is not SHOVED over it by its own bodies (the anti-stack push)
{
  const c = setup(9)
  const ids = [0, 1, 2, 3, 4, 5].map(i => spawnHollow(c, FLAT, -0.3 - (i % 2) * 0.1, (i % 3) * 0.1, 'shambler').id)
  const pk = groupPack(c, ids)
  let worst = 0
  for (let t = 0; t < 10; t += DT) { c.packs![pk].wx = 10; c.packs![pk].wz = 0; c.packs![pk].t = 30; stepCombat(c, FLAT, { x: 500, y: 0, z: 500 }, DT); worst = Math.max(worst, onCleared(c)) }
  ok(worst === 0, `a crowd at the border was shoved over it (${worst} on cleared ground)`)
}

// (3) a lone stray's own wander, a crawler seeking its kind across the border: neither crosses
{
  const c = setup(11)
  const s = spawnHollow(c, FLAT, -0.5, 0, 'shambler'); s.wx = 8; s.wz = 0; s.t = 30
  const cr = spawnHollow(c, FLAT, -0.5, 20, 'crawler'); spawnHollow(c, FLAT, 6, 20, 'crawler')   // its kind, already on cleared ground
  let worst = 0
  for (let t = 0; t < 20; t += DT) { stepCombat(c, FLAT, { x: 500, y: 0, z: 500 }, DT); worst = Math.max(worst, [s, cr].filter(h => c.hollows.includes(h) && h.x >= 0).length) }
  ok(worst === 0, `a stray or a seeking crawler wandered over the border (${worst})`)
}

// (4) a Hollow already on cleared ground may walk OFF it (never trapped), and a CHASER still follows the keeper in
{
  const c = setup(4)
  const s = spawnHollow(c, FLAT, 1, 0, 'shambler'); s.wx = -10; s.wz = 0; s.t = 30
  for (let t = 0; t < 8; t += DT) stepCombat(c, FLAT, { x: 500, y: 0, z: 500 }, DT)
  ok(s.x < 0, `a stray on cleared ground could not walk off it (x ${s.x.toFixed(2)})`)
  const d = setup(4)
  const h = spawnHollow(d, FLAT, -6, 0, 'shambler')
  for (let t = 0; t < 6; t += DT) stepCombat(d, FLAT, { x: 6, y: 0, z: 0 }, DT)
  ok(h.state !== 'wander' && h.x > 0, `a chaser stopped at the border (x ${h.x.toFixed(2)}, ${h.state})`)
}

// (5) no drained map (the page said nothing, e.g. a test arena): wandering is unchanged, nobody is held
{
  const c = newCombat(7)
  const s = spawnHollow(c, FLAT, -0.5, 0, 'shambler'); s.wx = 8; s.wz = 0; s.t = 30
  for (let t = 0; t < 8; t += DT) stepCombat(c, FLAT, { x: 500, y: 0, z: 500 }, DT)
  ok(s.x > 2, `with no drained map a stray was held (x ${s.x.toFixed(2)})`)
}

console.log(`wilds-quiet: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
