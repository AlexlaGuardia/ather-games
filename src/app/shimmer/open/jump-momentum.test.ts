// M222: a running jump keeps its momentum. Run: npx tsx src/app/shimmer/open/jump-momentum.test.ts
//
// Alex 11-26: "the jump has some kind of reaction where it cancels momentum instead of pushing you forward
// you stop and hop up". The cause was the VAULT: on land, `vaultTarget` read ANY ground higher than the feet
// 0.85 m ahead as a step to mantle onto, so a jump on the gentlest upslope (or a bump in the Wilds) became a
// 0.16 s mantle with the horizontal speed zeroed, landing grounded: a stop and a hop. The vault is for a rise
// you cannot walk or step onto; everything the walker already steps (land you can walk up, a rise <= 0.5) is
// a plain jump that carries the run into the air. Pure: the real tick on synthetic land, no DOM.

import { createLoco, tickLocomotion, RUN_SPEED, type LocoInput } from './shared/locomotion'
import { terrainWorld, type Box, type Shape } from './terrain-world'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const DT = 1 / 60
const input = (o: Partial<LocoInput> = {}): LocoInput => ({
  mvX: 0, mvZ: 0, fwdX: 1, fwdZ: 0, rightX: 0, rightZ: 1, jumpKey: false, crouchKey: false, dt: DT, ...o,
})
const shape = (ground: (x: number, z: number) => number, solids: Box[] = []): Shape =>
  ({ ground, solids: () => solids, water: () => [] })
const hs = (s: { hvx: number; hvz: number }) => Math.hypot(s.hvx, s.hvz)

/** Run +x for `runFor` s, then press Space (held 10 frames) and keep running. Reports the speeds the brief asks for. */
function runningJump(sh: Shape, runFor = 3) {
  const w = terrainWorld(sh)
  const s = createLoco(0, sh.ground(0, 0) + 0.5, 0)
  for (let i = 0; i < 30; i++) tickLocomotion(s, input(), w)          // settle onto the land
  for (let i = 0; i < runFor * 60; i++) tickLocomotion(s, input({ mvX: 1 }), w)
  const run = hs(s), x0 = s.px, y0 = s.py
  let takeoff = -1, mid = -1, minAir = Infinity, vaulted = false, peak = y0, airFrames = 0
  for (let i = 0; i < 40; i++) {
    tickLocomotion(s, input({ mvX: 1, jumpKey: i < 10 }), w)
    if (s.vaulting || s.mantleT > 0) vaulted = true
    if (i === 0) takeoff = hs(s)
    if (s.airborne) { airFrames++; minAir = Math.min(minAir, hs(s)); peak = Math.max(peak, s.py) }
    if (i === 18) mid = hs(s)
  }
  return { run, takeoff, mid, minAir, vaulted, rise: peak - y0, travel: s.px - x0, airFrames }
}

const CASES: [string, Shape][] = [
  ['flat land', shape(() => 5)],
  ['a gentle upslope (1 in 10)', shape(x => 5 + x * 0.1)],
  ['a steady upslope (2 in 5)', shape(x => 5 + x * 0.4)],
  ['a steep walkable slope (9 in 10)', shape(x => 5 + x * 0.9)],
  ['a downslope (1 in 5)', shape(x => 5 - x * 0.2)],
  ['bumpy Wilds land', shape((x, z) => 5 + 0.12 * Math.sin(x * 1.7) + 0.08 * Math.cos(z * 2.3 + x))],
  ['a half-step ahead (0.4 m box)', shape(() => 5, [{ x0: 21.2, y0: 5, z0: -5, x1: 30, y1: 5.4, z1: 5 }])],
]

for (const [name, sh] of CASES) {
  const r = runningJump(sh)
  ok(r.run > RUN_SPEED * 0.95, `${name}: the run itself only reached ${r.run.toFixed(2)} m/s`)
  ok(!r.vaulted, `★ ${name}: the jump turned into a vault/mantle (horizontal speed zeroed: the stop-and-hop)`)
  ok(r.takeoff >= r.run * 0.9, `★ ${name}: take-off ${r.takeoff.toFixed(2)} m/s < 90% of the run ${r.run.toFixed(2)}`)
  ok(r.mid >= r.run * 0.9, `★ ${name}: mid-air ${r.mid.toFixed(2)} m/s < 90% of the run ${r.run.toFixed(2)}`)
  ok(r.minAir >= r.run * 0.9, `${name}: slowest air frame ${r.minAir.toFixed(2)} m/s < 90% of the run`)
  ok(r.airFrames >= 20 && r.rise > 0.9, `${name}: not a real jump (air ${r.airFrames} frames, rise ${r.rise.toFixed(2)} m)`)
  ok(r.travel > r.run * 0.5, `${name}: travelled only ${r.travel.toFixed(2)} m in the 0.67 s jump window`)
  console.log(`${name.padEnd(30)} run ${r.run.toFixed(2)}  take-off ${r.takeoff.toFixed(2)}  mid-air ${r.mid.toFixed(2)}  rise ${r.rise.toFixed(2)}  travel ${r.travel.toFixed(2)}${r.vaulted ? '  VAULTED' : ''}`)
}

// a standing jump still goes straight up
{
  const w = terrainWorld(shape(x => 5 + x * 0.1))
  const s = createLoco(0, 5.5, 0)
  for (let i = 0; i < 30; i++) tickLocomotion(s, input(), w)
  const x0 = s.px, y0 = s.py
  let peak = y0, drift = 0
  for (let i = 0; i < 40; i++) {
    tickLocomotion(s, input({ jumpKey: i < 10 }), w)
    peak = Math.max(peak, s.py); drift = Math.max(drift, Math.abs(s.px - x0), hs(s))
  }
  ok(peak - y0 > 1.0 && drift < 1e-6, `★ a standing jump is not straight up (rise ${(peak - y0).toFixed(2)}, drift ${drift.toFixed(3)})`)
}

// the vault is still the vault: a 1 m rock right ahead, jump into it = mantle onto it, the run carried out
{
  const w = terrainWorld(shape(() => 5, [{ x0: 2, y0: 5, z0: -5, x1: 4, y1: 6, z1: 5 }]))
  const s = createLoco(0, 5.5, 0)
  for (let i = 0; i < 30; i++) tickLocomotion(s, input(), w)
  let vaulted = false
  for (let i = 0; i < 90; i++) { tickLocomotion(s, input({ mvX: 1, jumpKey: s.px > 1.3 }), w); if (s.vaulting) vaulted = true }
  ok(vaulted && (Math.abs(s.py - 6) < 0.05 || s.px > 4), `the 1 m rock no longer vaults (vaulted ${vaulted}, feet ${s.py.toFixed(2)})`)
}

// a cliff lip of land (a 1 m terrace, steep face): still a vault, the face is not land you walk up
{
  const terrace = (x: number) => 5 + Math.min(1, Math.max(0, (x - 2) / 0.05))
  const w = terrainWorld(shape(terrace))
  const s = createLoco(0, 5.5, 0)
  for (let i = 0; i < 30; i++) tickLocomotion(s, input(), w)
  let vaulted = false
  for (let i = 0; i < 90; i++) { tickLocomotion(s, input({ mvX: 1, jumpKey: s.px > 1.3 }), w); if (s.vaulting) vaulted = true }
  ok(vaulted && Math.abs(s.py - 6) < 0.05, `a 1 m land terrace no longer vaults (vaulted ${vaulted}, feet ${s.py.toFixed(2)})`)
}

console.log(`\njump-momentum: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  FAIL ' + f)
if (fails.length) process.exit(1)
