// M232: the boop rules. Run: npx tsx src/app/shimmer/open/shared/boop.test.ts
import { readFileSync } from 'node:fs'
import { boopOutcome, hollowOutcome, pickPunchTarget, pushDir, decodeBoop, throwPunch, takePunch, receiveBoop, takeBoop,
  PUNCH_REACH, PUNCH_CD, STILL_SPEED, PUSH_FWD, PUSH_UP } from './boop'
import { createLoco, launchKeeper, GRAVITY } from './locomotion'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// 1. still = pushed, moving or airborne = a tap
ok(boopOutcome(0, false) === 'push', 'standing still is pushed')
ok(boopOutcome(STILL_SPEED + 0.01, false) === 'tap', 'walking is only tapped')
ok(boopOutcome(4.5, false) === 'tap', 'running is only tapped')
ok(boopOutcome(0, true) === 'tap', 'in the air is only tapped')
ok(hollowOutcome('stagger') === 'push' && hollowOutcome('windup') === 'push' && hollowOutcome('recover') === 'push', 'a Hollow caught still is pushed')
ok(hollowOutcome('chase') === 'tap' && hollowOutcome('wander') === 'tap' && hollowOutcome('lunge') === 'tap', 'a Hollow on the move is tapped')

// 2. reach + cone: yaw 0 looks down -z
const me = { x: 0, z: 0, yaw: 0 }
ok(pickPunchTarget(me, [{ id: 'a', x: 0, z: -1.2 }])?.id === 'a', 'in front, in reach: hit')
ok(pickPunchTarget(me, [{ id: 'a', x: 0, z: 1.2 }]) === null, 'behind: missed')
ok(pickPunchTarget(me, [{ id: 'a', x: 0, z: -(PUNCH_REACH + 0.1) }]) === null, 'past reach: missed')
ok(pickPunchTarget(me, [{ id: 'a', x: 1.2, z: -0.1 }]) === null, 'off to the side: missed')
ok(pickPunchTarget(me, [{ id: 'far', x: 0, z: -1.7 }, { id: 'near', x: 0.2, z: -0.9 }])?.id === 'near', 'the nearest of two')
ok(pickPunchTarget({ ...me, y: 0 }, [{ id: 'a', x: 0, z: -1, y: 3 }]) === null, 'a keeper on a roof above is out of reach')
const d = pushDir(me, { x: 0, z: -2 })
ok(Math.abs(d.x) < 1e-9 && Math.abs(d.z + 1) < 1e-9, 'pushed away from the puncher')

// 3. a peer's payload is data: malformed = nothing
ok(decodeBoop({ x: 0.6, z: 0.8 }) !== null && decodeBoop(null) === null && decodeBoop({ x: 'a', z: 1 }) === null && decodeBoop({ x: 50, z: 0 }) === null && decodeBoop({ x: NaN, z: 0 }) === null, 'decodeBoop refuses junk and giant pushes')

// 4. cooldown + a stale punch never lands
ok(throwPunch(10_000) && !throwPunch(10_000 + PUNCH_CD * 1000 - 1) && throwPunch(10_000 + PUNCH_CD * 1000 + 1), 'the punch cooldown')
ok(takePunch(10_000 + PUNCH_CD * 1000 + 50) && !takePunch(10_000 + PUNCH_CD * 1000 + 60), 'a punch is taken once')
throwPunch(20_000); ok(!takePunch(20_400), 'a punch combat never read for 400 ms does not land late')
receiveBoop({ x: 1, z: 0 }); ok(takeBoop()?.x === 1 && takeBoop() === null, 'a boop is taken once')

// 5. "not huge": the push is a small hop (simulate the ballistic flight launchKeeper starts)
{
  const s = createLoco(0, 0, 0); launchKeeper(s, 1, 0, PUSH_FWD, PUSH_UP)
  const tFlight = 2 * PUSH_UP / GRAVITY, far = PUSH_FWD * tFlight + PUSH_FWD / 13   // the hop, then ground friction (13/s) bleeds the rest
  ok(s.hvx === PUSH_FWD && s.vy === PUSH_UP, 'the push hands the walker a small hop')
  ok(far < 1.0 && far > 0.3, `the push carries 0.3 to 1 m (${far.toFixed(2)} m)`)
}

// 6. wiring: the receiver moves itself; the puncher only relays (no write of another keeper's pose)
const walker = readFileSync('src/app/shimmer/open/ather/walker.tsx', 'utf8'), layer = readFileSync('src/app/shimmer/open/ather/boop-layer.tsx', 'utf8')
ok(/takeBoop\(\)[\s\S]{0,200}boopOutcome\(Math\.hypot\(lc\.hvx, lc\.hvz\)[\s\S]{0,120}launchKeeper\(lc, bp\.x, bp\.z, PUSH_FWD, PUSH_UP\)/.test(walker), 'the walker pushes ITSELF only when still')
ok(/net\.relay\(BOOP_KIND, \{ x: d\.x, z: d\.z \}, t\.id\)/.test(layer) && !/\.x \+= |\.tx =/.test(layer), 'the puncher relays to the one keeper it reached')
ok(/punchHollow\(C, T, feet/.test(readFileSync('src/app/shimmer/open/ather/combat-layer.tsx', 'utf8')), 'combat lands a punch on a Hollow')

console.log(`boop: ${pass} ok, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
