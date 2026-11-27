// node test: npx tsx src/app/shimmer/open/shared/mp-state.test.ts (BETA M248: others jump in multiplayer)
import { pickState, encodeState, decodeState, stepRemoteY, hintOf, applyPoseHint, MP_STATES, MP_STATE_MARK, LAND_MS, PUNCH_MS, type BodyNow, type MpState } from './mp-state'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const B: BodyNow = { airborne: false, vy: 0, landAgoMs: Infinity, climbing: false, sliding: false, crouching: false, punchAgoMs: Infinity, aiming: false, speed: 0, runAt: 5.2 }

// ── picking the state ──
ok(pickState(B) === 'ground', 'standing: ground')
ok(pickState({ ...B, airborne: true, vy: 5 }) === 'jump', 'in the air rising: jump')
ok(pickState({ ...B, airborne: true, vy: -3 }) === 'fall', 'in the air dropping: fall')
ok(pickState({ ...B, airborne: true, vy: 5, punchAgoMs: 10, speed: 9 }) === 'jump', 'the air outranks a punch and a run')
ok(pickState({ ...B, landAgoMs: 50 }) === 'land' && pickState({ ...B, landAgoMs: LAND_MS + 1 }) === 'ground', 'just touched down: land, then ground')
ok(pickState({ ...B, punchAgoMs: 100, speed: 9 }) === 'punch' && pickState({ ...B, punchAgoMs: PUNCH_MS + 1 }) === 'ground', 'a punch shows for PUNCH_MS, over a run')
ok(pickState({ ...B, speed: 6 }) === 'sprint' && pickState({ ...B, speed: 4 }) === 'ground', 'at run speed: sprint; a walk is ground (the gait shows it)')
ok(pickState({ ...B, sliding: true, crouching: true, speed: 8 }) === 'slide', 'a slide outranks crouch and sprint')
ok(pickState({ ...B, crouching: true }) === 'crouch', 'crouch')
ok(pickState({ ...B, aiming: true }) === 'aim', 'aim')
ok(pickState({ ...B, climbing: true, airborne: true, vy: 2 }) === 'climb', 'climbing')

// ── the wire ──
for (const s of Object.keys(MP_STATES) as MpState[]) ok(decodeState(encodeState(s)) === s, `round trip ${s}`)
ok(decodeState(0) === null, 'OLD client (direction 0): null = no state, ground-snap')
ok(decodeState(5) === null, 'a 2D client facing (0-7): null')
ok(decodeState(undefined) === null && decodeState('258') === null && decodeState(258.5) === null && decodeState(NaN) === null, 'junk: null')
ok(decodeState(MP_STATE_MARK + 200) === 'ground', 'a newer client\'s unknown state: ground')
ok(decodeState(MP_STATE_MARK * 2) === null, 'past the code range: null')
ok(encodeState('ground') >= MP_STATE_MARK, 'every code sits above the 2D facings')

// ── remote y: a jump keeps its arc and lands; an old client stands on our ground ──
{ // sample a 1.2 m hop at 12 Hz (vy0 5.4, g 12), draw at 60 fps
  const g = 12, vy0 = 5.4, T = 2 * vy0 / g
  const real = (t: number) => (t > 0 && t < T ? vy0 * t - g * t * t / 2 : 0)
  let drawn = 0, target = 0, peak = 0, st: MpState = 'ground'
  for (let f = 0; f < 120; f++) {
    const t = f / 60
    if (f % 5 === 0) { target = real(t); st = t > 0 && t < T ? (vy0 - g * t > 0.3 ? 'jump' : 'fall') : t < T + 0.2 ? 'land' : 'ground' }
    drawn = stepRemoteY(drawn, target, st, 0, 1 / 60); peak = Math.max(peak, drawn)
  }
  const top = vy0 * vy0 / (2 * g)
  ok(peak > top * 0.8, `the drawn arc keeps its height (peak ${peak.toFixed(2)} of ${top.toFixed(2)} m)`)
  ok(Math.abs(drawn) < 0.02, `and lands (${drawn.toFixed(3)})`)
}
ok(stepRemoteY(0.3, 7, null, 2.5, 1 / 60) === 2.5, 'old client: snapped to our ground, whatever y it sent')
ok(stepRemoteY(0.3, 0, null, 2.5, 1 / 60) === 2.5, 'old client with a missing y (0): ground-snapped')
ok(Math.abs(stepRemoteY(1, 1, null, null, 1 / 60) - 1) < 1e-9, 'old client, no ground known: its own y')
ok(stepRemoteY(NaN, 3, 'ground', 1, 1 / 60) === 3, 'first frame (nothing drawn): straight to the target')
ok(stepRemoteY(1, NaN, 'jump', 2, 1 / 60) > 1, 'a missing y on a new client eases to our ground')
{ const air = stepRemoteY(0, 1, 'jump', 0, 1 / 60), gr = stepRemoteY(0, 1, 'ground', 0, 1 / 60)
  ok(air > gr * 1.5, `the air follows tighter than the ground (${air.toFixed(3)} vs ${gr.toFixed(3)})`) }

// ── pose hints ──
ok(hintOf(null).tuck === 0 && hintOf('ground').squash === 1, 'no state / ground: no hint')
ok(hintOf('jump').tuck > 0 && hintOf('fall').armsUp > 0 && hintOf('punch').punch > 0 && hintOf('slide').squash < 1 && hintOf('sprint').lean > 0, 'each state has its hint')
{ const mk = () => { const o: Record<string, { position: { x: number; y: number; z: number } }> = {}
    for (const n of ['foot-l', 'foot-r', 'hand-l', 'hand-r']) o[n] = { position: { x: 0, y: 0, z: 0 } }
    return { o, body: { getObjectByName: (n: string) => o[n] } } }
  const a = mk(); applyPoseHint(a.body, hintOf('jump'))
  ok(a.o['foot-l'].position.y > 0.1 && a.o['hand-r'].position.y > 0.1, 'jump: feet tuck, hands up')
  const p = mk(); applyPoseHint(p.body, hintOf('punch'))
  ok(p.o['hand-r'].position.z > 0.3 && p.o['hand-l'].position.z === 0, 'punch: the right hand goes out, the left stays')
  const n = mk(); applyPoseHint(n.body, hintOf('ground'))
  ok(n.o['foot-l'].position.y === 0 && n.o['hand-r'].position.z === 0, 'ground: limbs untouched') }

console.log(fails ? `FAIL (${fails})` : 'ALL PASS'); process.exit(fails ? 1 : 0)
