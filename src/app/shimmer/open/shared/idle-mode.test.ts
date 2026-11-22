// M91 s1: follower room + idle mode (idle-mode.ts). Run: npx tsx src/app/shimmer/open/shared/idle-mode.test.ts
import { followStep, FOLLOW, idleCamStep, idleCamFresh, IDLE_AFTER, idleFollowStart, idleFollowStep, tickIdleCam, noteInput, noteCombat, _resetIdle, type FollowState, type View } from './idle-mode'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const gap = (s: FollowState, px: number, pz: number) => Math.hypot(s.x - px, s.z - pz)
const run = (s: FollowState, px: number, pz: number, secs: number) => { for (let i = 0; i < secs * 60; i++) s = followStep(s, px, pz, 1 / 60); return s }

// follow: a 1 m step does not move it; it holds still
let f: FollowState = { x: 0, z: 4.5, speed: 0, moving: false }
let g = run(f, 0, -1, 3)   // keeper steps 1 m away -> gap 5.5 < 6
ok(g.x === 0 && g.z === 4.5, `moved on a 1 m step (${g.x},${g.z})`)
// past ~6 m it starts, and settles inside 3-6
g = run(f, 0, -2.5, 0.5)   // gap 7
ok(g.moving && g.z < 4.5, 'did not start when the gap passed 6 m')
g = run(f, 0, -2.5, 15)
ok(gap(g, 0, -2.5) >= 3 && gap(g, 0, -2.5) <= 6 && !g.moving, `did not settle in 3-6 m (${gap(g, 0, -2.5).toFixed(2)})`)
// a keeper striding away: gap never grows past ~9 and never collapses under 3
let w: FollowState = { x: 0, z: 4.5, speed: 0, moving: false }, mx = 0, mn = 99
for (let i = 0; i < 60 * 20; i++) { const pz = -i / 60 * 5; w = followStep(w, 0, pz, 1 / 60); const d = gap(w, 0, pz); mx = Math.max(mx, d); mn = Math.min(mn, d) }
ok(mn >= 3 && mx < 9, `gap range while walking ${mn.toFixed(1)}..${mx.toFixed(1)}`)

// camera idle
const view: View = { yaw: 1.234, pitch: -0.11 }
let st = idleCamFresh(), seq = 0, applied: View | null = null
const tick = (secs: number, blocked = false, s = seq) => { for (let i = 0; i < secs * 60; i++) { const r = idleCamStep(st, 1 / 60, s, blocked, view, rand); st = r.state; applied = r.apply; if (r.apply) { view.yaw = r.apply.yaw; view.pitch = r.apply.pitch } } }
tick(IDLE_AFTER - 1)
ok(!st.idle, 'idle too early')
tick(2)
ok(st.idle, '25 s of nothing did not start idle')
tick(8)
ok(Math.abs(view.yaw - 1.234) > 0.01 || Math.abs(view.pitch + 0.11) > 0.01, 'camera did not look around')
ok(view.pitch >= -0.31 && view.pitch <= 0.21, 'look-around pitch out of range')
seq++; tick(1 / 60)   // input: one frame
ok(!st.idle && view.yaw === 1.234 && view.pitch === -0.11, `view not restored exactly (${view.yaw},${view.pitch})`)
// blocked (combat / menu / driving) never idles, and breaks an idle at once
st = idleCamFresh(seq); tick(60, true)
ok(!st.idle, 'idled while blocked')
tick(IDLE_AFTER + 1); ok(st.idle, 'did not idle after the block')
view.yaw = st.base.yaw + 0.5; tick(1 / 60, true)
ok(!st.idle && view.yaw === 1.234, 'a block did not hand the view back')

// the store: noteInput ends it, combat blocks it for a while
_resetIdle(); const lk: View = { yaw: 0.5, pitch: 0 }
for (let i = 0; i < 60 * 27; i++) tickIdleCam(1 / 60, lk, false, rand)
ok(tickIdleCam(1 / 60, lk, false, rand), 'store: no idle after 27 s')
noteInput(); tickIdleCam(1 / 60, lk, false, rand)
ok(!tickIdleCam(1 / 60, lk, false, rand) && lk.yaw === 0.5 && lk.pitch === 0, 'store: input did not restore')
noteCombat(); let any = false
for (let i = 0; i < 60 * 40; i++) any = tickIdleCam(1 / 60, lk, false, rand) || any
ok(any === true, 'store: idle never resumed after combat cooled (8 s)')
_resetIdle(); noteCombat(); any = false
for (let i = 0; i < 60 * 7; i++) any = tickIdleCam(1 / 60, lk, false, rand) || any
ok(!any, 'store: idled during combat')

// follower idle: wander -> sit -> nap, staying within the ring around the keeper
let fi = idleFollowStart(4, 0); const seen = new Set<string>(); let far = 0
for (let i = 0; i < 60 * 240; i++) { fi = idleFollowStep(fi, 0, 0, 1 / 60, rand); seen.add(fi.phase); far = Math.max(far, Math.hypot(fi.x, fi.z)) }
ok(seen.has('wander') && seen.has('sit') && seen.has('nap'), `idle follower phases: ${[...seen]}`)
ok(far < 7, `idle follower strayed ${far.toFixed(1)} m`)

console.log(fails.length ? `FAIL ${fails.length}\n- ${fails.join('\n- ')}` : `idle-mode: ${pass} checks pass`)
process.exit(fails.length ? 1 : 0)
