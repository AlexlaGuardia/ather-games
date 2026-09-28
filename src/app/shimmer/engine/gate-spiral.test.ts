/**
 * GATE IN A FIGHT — a bare spiral, inside one fight only (RULED 2026-09-28, moves.md).
 * Run: `npx tsx src/app/shimmer/engine/gate-spiral.test.ts`
 */
import { readFileSync } from 'node:fs'
import { openSpiral, stepSpiral, SPIRAL_REACH_Y, type GateSpiral } from './gate-spiral'
import { castForMove, isBuilt } from '../play3d/cast'
import { resolveCast } from './cast-dispatch'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const spec = castForMove('gate')
ok(isBuilt('gate') && spec.archetype === 'gate', '★★ Gate is built, on its own archetype (not a blink with extra words)')
ok(spec.castRange > 0 && spec.areaSize > 0 && spec.areaSecs > 0 && spec.sustainDrain > 0, 'it has a reach, an end size, a ceiling and a bill')

const near = { x: 0, y: 10, z: 0 }, far = { x: 12, y: 10, z: 0 }
const g0 = openSpiral('gate', near, far, spec, 0)
let g: GateSpiral | null = g0
const MANA = 100

// A. the caster stands in the near end as it is struck: no instant trip
let st = stepSpiral(g, 0, 10, 0, 0.1, MANA, 100)
ok(!st.warpTo && !!st.spiral, '★ struck under your feet, the near end does not carry you at once')
// step out, step back in: through to the far end
st = stepSpiral(st.spiral!, 3, 10, 0, 0.1, MANA, 200)
st = stepSpiral(st.spiral!, 0.5, 10, 0, 0.1, MANA, 300)
ok(st.warpTo?.x === far.x, '★★ step out and back into the near end: through to the far end')
// arriving in the far end does not bounce you back
st = stepSpiral(st.spiral!, 12, 10, 0, 0.1, MANA, 400)
ok(!st.warpTo, '★ arriving inside the far end does not send you straight back (no ping-pong)')
// a door, both ways
st = stepSpiral(st.spiral!, 9, 10, 0, 0.1, MANA, 500)
st = stepSpiral(st.spiral!, 12, 10, 0.3, 0.1, MANA, 600)
ok(st.warpTo?.x === near.x, '★★ a door, walkable both ways while it stands')
// height: an end is on the fight's ground, not a column to the sky
g = openSpiral('gate', near, far, spec, 0); g = { ...g, armed: [true, true] }
ok(!stepSpiral(g, 0, 10 + SPIRAL_REACH_Y + 1, 0, 0.1, MANA, 10).warpTo, 'a body far above an end does not go through it')

// B. it bills by the second, and closes the moment the pool cannot pay
g = openSpiral('gate', near, far, spec, 0)
st = stepSpiral(g, 5, 10, 0, 0.5, MANA, 500)
ok(Math.abs(st.drain - spec.sustainDrain * 0.5) < 1e-9, 'the bill is sustainDrain × dt')
st = stepSpiral(g, 5, 10, 0, 0.5, spec.sustainDrain * 0.5 - 0.01, 500)
ok(!st.spiral && st.closed === 'spent' && st.drain === 0, '★★ it closes when the caster stops spending (spent, no charge on the closing frame)')

// C. never outlasts the fight: a hard ceiling
st = stepSpiral(g, 5, 10, 0, 0.1, MANA, spec.areaSecs * 1000)
ok(!st.spiral && st.closed === 'timeout', `★ it closes at its ceiling (${spec.areaSecs}s) whatever the pool says`)
// a full pool pays roughly the ceiling, not forever
ok(spec.manaCost + spec.sustainDrain * spec.areaSecs <= 100, 'a full novice pool can hold it to its ceiling, not past it')

// D. the dispatcher places it (pay, cooldown at the press), and a world that cannot run it says so
const env = (supports: string[]) => ({ now: 1000, hp: 100, hpMax: 100, mana: 100, cooldownUntil: [0, 0, 0, 0], stanceMoveId: null, supports: new Set(supports) as never })
const out = resolveCast(3, [null, null, null, 'gate'], env(['gate']))
ok(out.kind === 'applied' && out.placed?.archetype === 'gate' && out.manaCost === spec.manaCost, 'the dispatcher hands the spec to the host, paid')
const no = resolveCast(3, [null, null, null, 'gate'], env(['projectile']))
ok(no.kind === 'refused' && no.reason === 'unsupported', 'a world without the archetype refuses out loud')

// E. the hosts: both worlds run it (play3d since 09-28's body-move path, `play3d/body-cast.test.ts`)
const vw = readFileSync('src/app/shimmer/voxel3d/VoxelWorld.tsx', 'utf8')
ok(/'channel', 'gate'\]/.test(vw), 'the voxel world declares it supports gate')
ok(vw.includes('stepSpiral(sp, lc.px, lc.py, lc.pz, dt, mp.cur') && vw.includes('mp.cur = Math.max(0, mp.cur - st.drain)'), '★ the frame loop bills the pool and steps the body through')
ok(vw.indexOf("the far end must be in sight") > 0 && vw.indexOf('m.cur += out.manaCost') > 0, '★ both ends in sight: a blind strike refunds and says why')
const p3 = readFileSync('src/app/shimmer/play3d/Shimmer3D.tsx', 'utf8')
ok(p3.includes("case 'gate': {") && p3.includes('openSpiral(r.gate.moveId'), 'play3d runs the Gate too')
ok(p3.includes('— not in this world yet`)'), 'what play3d still cannot run (channel) refuses out loud')

console.log(`gate-spiral: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
