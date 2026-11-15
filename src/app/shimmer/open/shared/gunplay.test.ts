// The test lane's guns, by numbers. Run: npx tsx src/app/shimmer/open/shared/gunplay.test.ts
import { RANGE_GUNS, gunForSlate, holdGun, stepGun, stepRounds, reloadGun, PLATE, type Round, type Target } from './gunplay'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
let seed = 1
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const eye = { x: 0, y: 1.6, z: 0 }, aim = { x: 0, y: 0, z: -1 }
const DT = 1 / 60

// one rack per Slate, every Slate stocked, names are canon's anchors
ok(['SIDEARM', 'SHORTBARREL', 'LONGBARREL', 'BREACHER', 'REACHER'].every(s => !!gunForSlate(s)), 'a Slate has no gun on its rack')
ok(RANGE_GUNS.map(g => g.name).join() === 'REPEATER,SPITTER,BACKBONE,ROAR,LANCE', `rack names drifted: ${RANGE_GUNS.map(g => g.name)}`)
ok(new Set(RANGE_GUNS.map(g => g.color)).size === 5, 'two racks share a colour')

const run = (id: string, frames: number, down: (i: number) => boolean) => {
  const g = holdGun(RANGE_GUNS.find(w => w.id === id)!), out: Round[] = []
  let shots = 0
  for (let i = 0; i < frames; i++) shots += stepGun(g, DT, down(i), eye, aim, rand, out).length
  return { g, out, shots }
}
// semi-auto: holding the trigger fires ONE round
// ★ holding the trigger fires on every gun (Alex 11-15): a semi-auto held re-fires at its fireCd
const rp = run('repeater', 60, () => true)
ok(rp.shots >= 5 && rp.shots <= 7, `the Repeater held for 1 s fires ${rp.shots} (expected ~6 at fireCd 0.16)`)
// and a burst gun held fires burst after burst: 2 s of Backbone = bursts of 3, fireCd apart
const bh = run('backbone', 120, () => true)
ok(bh.shots % 3 === 0 && bh.shots >= 9, `the Backbone held for 2 s fires ${bh.shots} (whole bursts, several of them)`)
// aiming down the sights tightens the cone: the same 200 rounds land closer to the aim line
{
  const spreadOf = (ads: boolean) => {
    const g = holdGun(RANGE_GUNS.find(w => w.id === 'lance')!), out: Round[] = []
    let sum = 0
    for (let i = 0; i < 200; i++) { g.sinceShot = 99; g.ammo = 8; g.bloom = 0; out.length = 0; stepGun(g, DT, true, eye, aim, rand, out, ads); g.wasDown = false; sum += Math.hypot(out[0].vx, out[0].vy) / Math.abs(out[0].vz) }
    return sum / 200
  }
  const hip = spreadOf(false), ads = spreadOf(true)
  ok(ads < hip / 5, `ADS does not tighten the Lance's cone (hip ${hip.toFixed(4)}, ads ${ads.toFixed(4)})`)
}
// auto: holding fires many
const sp = run('spitter', 60, () => true)
ok(sp.shots >= 8, `the Spitter held for 1 s fires ${sp.shots} (auto)`)
// the Backbone's burst: one press = three rounds, and the burst finishes even if the trigger is released
const bb = run('backbone', 40, i => i === 0)
ok(bb.shots === 3, `one Backbone press fires ${bb.shots}, not a 3-round burst`)
// the Roar: one round, nine pellets
const ro = run('roar', 2, i => i === 0)
ok(ro.shots === 1 && ro.out.length === 9, `the Roar fired ${ro.shots} rounds / ${ro.out.length} pellets`)
// an empty clip reloads itself and comes back full
{
  const g = holdGun(RANGE_GUNS[0]), out: Round[] = []
  for (let i = 0; i < 1200 && g.ammo > 0; i++) stepGun(g, DT, i % 20 < 10, eye, aim, rand, out)
  ok(g.ammo === 0 && g.reloading > 0, 'running dry did not start the reload')
  for (let i = 0; i < 120; i++) stepGun(g, DT, false, eye, aim, rand, out)
  ok(g.ammo === g.gun.clip, 'the reload did not refill the clip')
  g.ammo = 3; reloadGun(g)
  ok(g.reloading > 0, 'R on a part clip does nothing')
}

// plates: a round straight down the lane hits the body; aimed up it hits the head; behind the plate it does not
const plate = (z: number): Target => ({ id: 0, x: 0, y: 0, z, yaw: 0, swing: 0, swingV: 0, hits: 0, flash: 0, lastZone: null })
const fly = (y: number, t: Target, x = 0) => {
  const r: Round[] = [{ x, y, z: 0, vx: 0, vy: 0, vz: -40, life: 2, age: 0, dmg: 10, crit: 16, shove: 0.1, gun: 'repeater' }]
  for (let i = 0; i < 120 && r.length; i++) { const h = stepRounds(r, DT, [t], () => false, { x: 0, z: 0 }); if (h.hits.length) return h.hits[0] }
  return null
}
const body = fly(PLATE.cy, plate(-10)), head = fly(PLATE.headY, plate(-10)), miss = fly(PLATE.cy, plate(-10), 1.2)
ok(body?.zone === 'body' && body.dmg === 10, 'a centre round did not hit the body for body damage')
ok(head?.zone === 'head' && head.dmg === 16, 'a high round did not hit the head for crit damage')
ok(miss === null, 'a round 1.2 m wide hit the plate')
ok(!!body && Math.abs(body.range - 10) < 0.5, `the hit read ${body?.range.toFixed(1)} m, not 10`)
// a fast round cannot tunnel through a plate between ticks (Lance at 54 m/s = 0.9 m a tick)
{
  const t = plate(-10.4), r: Round[] = [{ x: 0, y: PLATE.cy, z: 0, vx: 0, vy: 0, vz: -54, life: 2, age: 0, dmg: 22, crit: 34, shove: 0.1, gun: 'lance' }]
  let hit = false
  for (let i = 0; i < 60 && r.length; i++) if (stepRounds(r, DT, [t], () => false, { x: 0, z: 0 }).hits.length) hit = true
  ok(hit, 'a Lance round tunnelled through the plate')
}
// a round dies on the world and reports an impact
{
  const r: Round[] = [{ x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: -40, life: 2, age: 0, dmg: 10, crit: 16, shove: 0.1, gun: 'repeater' }]
  let impacts = 0
  for (let i = 0; i < 60 && r.length; i++) impacts += stepRounds(r, DT, [], (_x, _y, z) => z < -5, { x: 0, z: 0 }).impacts.length
  ok(impacts === 1 && r.length === 0, 'a round into a wall did not stop there with one impact')
}
// a shoved plate swings back and settles
{
  const t = plate(-10); fly(PLATE.cy, t)
  let peak = 0
  for (let i = 0; i < 180; i++) { stepRounds([], DT, [t], () => false, { x: 0, z: 0 }); peak = Math.max(peak, t.swing) }
  ok(peak > 0.02 && Math.abs(t.swing) < 0.01, `the plate did not swing and settle (peak ${peak.toFixed(3)}, now ${t.swing.toFixed(3)})`)
}

console.log(`gunplay: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
