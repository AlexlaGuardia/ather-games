// gate-open: a gate opens two ends, stepping into one comes out the other, it is billed per second, and it closes at areaSecs or when the pool is dry.
import { castForMove } from '../../play3d/cast'
import { press, freshClock, castsHere } from './casting'
import { openGate, gateTick } from './gate-open'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('FAIL ' + m) } }

const spec = castForMove('gate'), ground = () => 0
ok(spec.archetype === 'gate' && castsHere(spec), 'gate is carried out here')
ok(press('tactical', 'gate', freshClock(spec), 0, 100).ok, 'press: a gate casts')
let g = openGate(spec, { x: 0, y: 0, z: 0 }, 0, ground, 0)   // yaw 0 faces -z
ok(Math.abs(g.far.z + spec.castRange) < 1e-9 && Math.abs(g.far.x) < 1e-9, 'far end castRange out along the facing')
ok(g.near.x === 0 && g.near.z === 0, 'near end at the keeper')

// standing in the near end as it is struck does not carry you
let mana = 100, t = 0, r = gateTick(g, { x: 0, y: 0, z: 0 }, 0.1, mana, t += 100)
ok(!r.warpTo, 'struck standing in the near end: no instant carry'); g = r.gate!; mana = r.mana
ok(Math.abs((100 - mana) - spec.sustainDrain * 0.1) < 1e-9, 'billed per second (sustainDrain x dt)')
// step out, then into the far end: out the other (the near end)
r = gateTick(g, { x: 0, y: 0, z: -4 }, 0.1, mana, t += 100); g = r.gate!; mana = r.mana
ok(!r.warpTo, 'between the ends: nothing')
r = gateTick(g, { x: 0.2, y: 0, z: g.far.z }, 0.1, mana, t += 100); g = r.gate!; mana = r.mana
ok(r.warpTo === g.near, 'into the far end: out at the near end')
r = gateTick(g, { x: 0, y: 0, z: 0 }, 0.1, mana, t += 100); g = r.gate!; mana = r.mana
ok(!r.warpTo, 'arriving inside the near end does not bounce straight back')
r = gateTick(g, { x: 0, y: 0, z: -4 }, 0.1, mana, t += 100); g = r.gate!; mana = r.mana
r = gateTick(g, { x: 0, y: 0, z: 0 }, 0.1, mana, t += 100); g = r.gate!; mana = r.mana
ok(r.warpTo === g.far, 'stepped out and back into the near end: out at the far end')
ok(!gateTick(g, { x: 0, y: 5, z: g.far.z }, 0.1, mana, t).warpTo, 'high above an end is not in it')

// closes at areaSecs
const g2 = openGate(spec, { x: 0, y: 0, z: 0 }, 0, ground, 0)
ok(gateTick(g2, { x: 3, y: 0, z: 3 }, 0.016, 100, spec.areaSecs * 1000 - 1).closed === null, 'open just before areaSecs')
const late = gateTick(g2, { x: 3, y: 0, z: 3 }, 0.016, 100, spec.areaSecs * 1000)
ok(late.closed === 'timeout' && late.gate === null, 'closes at areaSecs')
// closes when the pool cannot pay
const dry = gateTick(g2, { x: 3, y: 0, z: 3 }, 0.5, 1, 100)
ok(dry.closed === 'spent' && dry.gate === null && dry.mana === 1, 'closes when out of mana, billing nothing')
// total billed over a full run never exceeds sustainDrain x areaSecs
let gg: typeof g | null = g2, m = 1000, n = 0
for (; gg && n < 5000; n++) { const x = gateTick(gg, { x: 3, y: 0, z: 3 }, 0.1, m, n * 100); gg = x.gate; m = x.mana }
ok(Math.abs((1000 - m) - spec.sustainDrain * spec.areaSecs) < spec.sustainDrain * 0.2, 'a full run bills about sustainDrain x areaSecs')

console.log(`gate-open: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
