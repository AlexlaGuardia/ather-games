// The spirit trot planner (spirit-trot.ts), M107. Run: npx tsx src/app/shimmer/open/ather/spirit-trot.test.ts
// A stand-in garden: a 20 x 14 m plot with the planter at (0,0), a bench and a box near it and a "room" further out. The
// blockers are checked HERE from their own rectangles (not through the nav under test), every step, at 60 fps and at 4 fps.
import { makeTrot, type SpiritNav } from './spirit-trot'
import { SPIRIT_MODELS } from './spirit-models'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const home = { x: 0, z: 0 }, PAD = 0.22
const PLOT = { x0: -6, x1: 14, z0: -7, z1: 7 }
const BOXES = [
  { x0: 1.6, x1: 3.2, z0: -0.25, z1: 0.25 },   // a bench 2.4 m east
  { x0: -0.6, x1: 0.6, z0: 2.4, z1: 3.0 },     // a planter box north
  { x0: 6, x1: 10, z0: -3, z1: 3 },            // a room
]
const PLANTER = { x0: -0.45, x1: 0.45, z0: -0.45, z1: 0.45 }
const inBox = (b: typeof PLOT, x: number, z: number, p = 0) => x > b.x0 - p && x < b.x1 + p && z > b.z0 - p && z < b.z1 + p
const blocked = (x: number, z: number) => !inBox(PLOT, x, z, -PAD) || BOXES.some(b => inBox(b, x, z, PAD))
const ground = (m: string) => !['perch', 'hopDown', 'hopUp'].includes(m)

for (const fps of [60, 4]) for (const seed of [1, 7, 42, 99]) {
  // s2: roam
  const nav: SpiritNav = { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 } }
  const tr = makeTrot(nav, seed), dt = 1 / fps
  let far15 = 0, farAll = 0, bad = '', modes = new Set<string>(), offRing = false, prev = tr.pose(), jump = 0
  for (let i = 0; i < 180 * fps; i++) {
    const p = tr.step(dt), r = Math.hypot(p.x, p.z)
    modes.add(p.mode)
    if (i * dt <= 15) far15 = Math.max(far15, r)
    farAll = Math.max(farAll, r)
    if (ground(p.mode) && r > 1.6) offRing = true
    if (!bad && ground(p.mode) && (BOXES.some(b => inBox(b, p.x, p.z, 0.05)) || inBox(PLANTER, p.x, p.z, 0.15) || !inBox(PLOT, p.x, p.z))) bad = `${p.mode} at ${p.x.toFixed(2)},${p.z.toFixed(2)} t=${(i * dt).toFixed(1)}`
    jump = Math.max(jump, Math.hypot(p.x - prev.x, p.z - prev.z) / dt); prev = p
  }
  const tag = `roam seed ${seed} @${fps}fps`
  ok(!bad, `${tag}: inside a blocker / the planter / off the plot: ${bad}`)
  ok(offRing && far15 > 3, `${tag}: leaves the ring and reaches > 3 m within 15 s (got ${far15.toFixed(2)} m)`)
  ok(tr.homes() >= 1, `${tag}: comes home and hops up at least once in 3 min (homes ${tr.homes()})`)
  ok(['look', 'sit', 'sniff', 'check'].every(m => modes.has(m)), `${tag}: every idle beat shows (${[...modes].join(',')})`)
  ok(jump < 4, `${tag}: no teleport (max ${jump.toFixed(2)} m/s)`)
  // s1 shape (no roam): stays on the ring
  const t1 = makeTrot({ home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked }, seed)
  let rMax1 = 0, rMin1 = 9
  for (let i = 0; i < 60 * fps; i++) { const p = t1.step(dt); if (ground(p.mode)) { const r = Math.hypot(p.x, p.z); rMax1 = Math.max(rMax1, r); rMin1 = Math.min(rMin1, r) } }
  ok(rMax1 <= 1.55 && rMin1 >= 0.8, `ring seed ${seed} @${fps}fps: no roam = stays on the ring (${rMin1.toFixed(2)}..${rMax1.toFixed(2)})`)
}

// M102 Manalotl wire-in: per-species dials. Same garden, same blockers; the Manalotl ambles (slower), tilts her head,
// still never stands in a blocker, and still gets out and home. The Vulnyx never tilts (her dials carry no tilt beat).
for (const fps of [60, 4]) for (const seed of [1, 7, 42, 99]) {
  const nav: SpiritNav = { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 } }
  const dt = 1 / fps, tag = `manalotl seed ${seed} @${fps}fps`
  const speeds = (dials: object | undefined) => {
    // 5 min: she is a third the speed, so a homecoming takes longer than the Vulnyx's 3 min
    const tr = makeTrot(nav, seed, dials); let prev = tr.pose(), d = 0, n = 0, bad = '', far = 0, jump = 0, tiltMax = 0
    const modes = new Set<string>()
    for (let i = 0; i < 300 * fps; i++) {
      const p = tr.step(dt), v = Math.hypot(p.x - prev.x, p.z - prev.z) / dt
      modes.add(p.mode); tiltMax = Math.max(tiltMax, Math.abs(p.tilt)); far = Math.max(far, Math.hypot(p.x, p.z))
      if (p.mode === 'trot' && prev.mode === 'trot') { d += v; n++ }
      if (!bad && ground(p.mode) && (BOXES.some(b => inBox(b, p.x, p.z, 0.05)) || inBox(PLANTER, p.x, p.z, 0.15) || !inBox(PLOT, p.x, p.z))) bad = `${p.mode} at ${p.x.toFixed(2)},${p.z.toFixed(2)} t=${(i * dt).toFixed(1)}`
      jump = Math.max(jump, v); prev = p
    }
    return { mean: d / Math.max(1, n), bad, far, jump, tiltMax, modes, homes: tr.homes() }
  }
  const m = speeds(SPIRIT_MODELS.axolotl!.trot), v = speeds(SPIRIT_MODELS.fox!.trot)
  ok(!m.bad, `${tag}: inside a blocker / the planter / off the plot: ${m.bad}`)
  ok(m.mean < 0.65 && m.mean < v.mean * 0.5, `${tag}: ambles, under half the Vulnyx's trot speed (${m.mean.toFixed(2)} vs ${v.mean.toFixed(2)} m/s)`)
  ok(m.far > 3, `${tag}: still roams past 3 m in 5 min (${m.far.toFixed(2)})`)
  ok(m.homes >= 1, `${tag}: comes home and hops up (homes ${m.homes})`)
  ok(m.modes.has('tilt') && m.tiltMax > 0.8, `${tag}: head-tilt beat shows (tilt max ${m.tiltMax.toFixed(2)}; ${[...m.modes].join(',')})`)
  ok(m.jump < 1.5, `${tag}: no teleport (max ${m.jump.toFixed(2)} m/s)`)
  ok(!v.modes.has('tilt') && v.tiltMax === 0, `vulnyx seed ${seed} @${fps}fps: never tilts (${v.tiltMax})`)
}

if (fails.length) { console.error(`spirit-trot: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`spirit-trot: ${pass}/0`)
