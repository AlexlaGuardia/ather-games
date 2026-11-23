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

// M109 s1 FOLLOW: a keeper walks a loop round the plot (straight legs at the 4.2 m/s walk, a stop, a turn back past the
// bench, a sprint leg at 6.5): she leaves home, then stays within 3 m of the keeper after the first catch-up, is never in a
// blocker / the planter / off the plot, never nearer than 1 m (she never blocks), and Stay sends her back to her own roam.
for (const fps of [60, 4]) for (const species of ['fox', 'axolotl'] as const) for (const seed of [3, 11]) {
  const nav: SpiritNav = { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 } }
  const tr = makeTrot(nav, seed, SPIRIT_MODELS[species]!.trot), dt = 1 / fps, tag = `follow ${species} seed ${seed} @${fps}fps`
  const legs = [{ x: -1.5, z: 3.8, v: 0 }, { x: 4.5, z: 4.5, v: 4.2 }, { x: 4.5, z: 4.5, v: 0, wait: 2 }, { x: -4, z: -4, v: 4.2 }, { x: 4.5, z: -5, v: 6.5 }, { x: 4, z: 1.2, v: 4.2 }, { x: -3, z: 1.5, v: 4.2 }]
  const k = { x: legs[0].x, z: legs[0].z, yaw: 0 }
  for (let i = 0; i < 3 * fps; i++) tr.step(dt)   // she is on her own beats first
  tr.follow(() => k)
  let li = 1, wait = 0, t = 0, maxD = 0, minD = 99, bad = '', settled = false, prev = tr.pose(), jump = 0
  while (li < legs.length && t < 60) {
    const L = legs[li]
    if (L.v === 0) { wait += dt; if (wait >= (L.wait ?? 0)) { wait = 0; li++ } }
    else { const dx = L.x - k.x, dz = L.z - k.z, d = Math.hypot(dx, dz), s = Math.min(d, L.v * dt); if (d > 1e-6) { k.x += dx / d * s; k.z += dz / d * s; k.yaw = Math.atan2(-dx, -dz) } if (d <= s + 1e-6) li++ }
    const p = tr.step(dt); t += dt
    const d = Math.hypot(p.x - k.x, p.z - k.z)
    if (!settled && p.mode === 'follow' && d < 3) settled = true
    if (settled) { maxD = Math.max(maxD, d); minD = Math.min(minD, d) }
    if (!bad && ground(p.mode) && (BOXES.some(b => inBox(b, p.x, p.z, 0.05)) || inBox(PLANTER, p.x, p.z, 0.15) || !inBox(PLOT, p.x, p.z))) bad = `${p.mode} at ${p.x.toFixed(2)},${p.z.toFixed(2)} t=${t.toFixed(1)}`
    jump = Math.max(jump, Math.hypot(p.x - prev.x, p.z - prev.z) / dt); prev = p
  }
  ok(settled, `${tag}: reaches the keeper`)
  ok(maxD < 3, `${tag}: stays within 3 m of the walking keeper (max ${maxD.toFixed(2)})`)
  ok(minD > 1.0, `${tag}: never nearer than 1 m (min ${minD.toFixed(2)})`)
  ok(!bad, `${tag}: inside a blocker / the planter / off the plot: ${bad}`)
  ok(jump < 10, `${tag}: no teleport (max ${jump.toFixed(2)} m/s)`)
  // the keeper stands: she settles by them and stays put (no jitter round the slot)
  let moved = 0; prev = tr.pose(); for (let i = 0; i < 5 * fps; i++) { const p = tr.step(dt); if (i > 2 * fps) moved += Math.hypot(p.x - prev.x, p.z - prev.z); prev = p }
  ok(moved < 0.05, `${tag}: stands by a still keeper (${moved.toFixed(3)} m drift over 3 s)`)
  // Stay: back to her own roam (she leaves the follow mode and moves off on her own beats)
  tr.follow(null); const modes = new Set<string>(); let away = 0; const s0 = tr.pose()
  for (let i = 0; i < 60 * fps; i++) { const p = tr.step(dt); modes.add(p.mode); away = Math.max(away, Math.hypot(p.x - s0.x, p.z - s0.z)); if (!bad && ground(p.mode) && (BOXES.some(b => inBox(b, p.x, p.z, 0.05)) || inBox(PLANTER, p.x, p.z, 0.15) || !inBox(PLOT, p.x, p.z))) bad = `after Stay ${p.mode} at ${p.x.toFixed(2)},${p.z.toFixed(2)}` }
  ok(!modes.has('follow') && modes.has('trot') && away > 1, `${tag}: Stay returns her to roaming (${[...modes].join(',')}; moved ${away.toFixed(2)} m)`)
  ok(!bad, `${tag}: ${bad}`)
}
// follow set while she is on her perch: she hops down first, then follows
{ const nav: SpiritNav = { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 } }
  const tr = makeTrot(nav, 5), k = { x: 3.5, z: 3.5, yaw: 0 }; tr.follow(() => k); const seen: string[] = []
  for (let i = 0; i < 6 * 60; i++) { const m = tr.step(1 / 60).mode; if (seen.at(-1) !== m) seen.push(m) }
  const p = tr.pose(); ok(seen.indexOf('hopDown') === seen.indexOf('perch') + 1 && seen.indexOf('hopDown') < seen.indexOf('follow') && p.mode === 'follow' && Math.hypot(p.x - k.x, p.z - k.z) < 3, `follow from the perch: hops down, then follows (${seen.join('>')}, ${Math.hypot(p.x - k.x, p.z - k.z).toFixed(2)} m)`) }

// M109 s2 FED: cheer() = the happy beat: on the spot (no xz drift), hops off the ground, faces the keeper, then back to what
// she was doing (roam / follow / perch), for both species, at 60 and 4 fps; mid perch-hop it waits for her feet
for (const sp of ['fox', 'axolotl'] as const) for (const fps of [60, 4]) {
  const D = { ...(SPIRIT_MODELS[sp]?.trot ?? {}) }, dt = 1 / fps, tag = `happy ${sp} ${fps}fps`
  const H = (D as { happyH?: number }).happyH ?? 0.12
  for (const where of ['roam', 'follow', 'perch'] as const) {
    const nav: SpiritNav = { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 } }
    const tr = makeTrot(nav, 11, D), k = { x: 2.5, z: 2.2, yaw: 0 }
    if (where === 'follow') tr.follow(() => k)
    // settle into the state: roam = out of the perch and on the ground; follow = following; perch = sat on the perch at start
    if (where !== 'perch') for (let i = 0; i < 20 * fps && !(where === 'follow' ? tr.pose().mode === 'follow' : ground(tr.pose().mode) && tr.pose().mode !== 'trot'); i++) tr.step(dt)
    const before = tr.pose(), c0 = tr.cheers()
    tr.cheer(() => k)
    let maxY = 0, drift = 0, seenHappy = false, facing = 0, after = ''
    for (let i = 0; i < 3 * fps; i++) {
      const p = tr.step(dt)
      if (p.mode === 'happy') { seenHappy = true; maxY = Math.max(maxY, p.y - (where === 'perch' ? 0.53 : 0)); drift = Math.max(drift, Math.hypot(p.x - before.x, p.z - before.z))
        const want = Math.atan2(k.x - p.x, k.z - p.z); facing = Math.abs(Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw))) }
      else if (seenHappy && !after) after = p.mode
    }
    ok(tr.cheers() === c0 + 1 && seenHappy, `${tag} ${where}: fed = one happy beat (${tr.cheers() - c0})`)
    ok(maxY > H * 0.6 && maxY < H * 1.2, `${tag} ${where}: little hops (${maxY.toFixed(3)} m, dial ${H})`)
    ok(drift < 0.01, `${tag} ${where}: on the spot (${drift.toFixed(3)} m)`)
    ok(facing < 0.35, `${tag} ${where}: turned to the keeper by the end (${facing.toFixed(2)} rad)`)
    const back = where === 'perch' ? after === 'perch' : where === 'follow' ? after === 'follow' : after !== '' && after !== 'happy' && after !== 'follow'
    ok(back, `${tag} ${where}: then back to her own (${after})`)
  }
}
{ // a cheer mid perch-hop waits for her to land
  const nav: SpiritNav = { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 } }
  const tr = makeTrot(nav, 3); let i = 0
  for (; i < 30 * 60 && tr.pose().mode !== 'hopDown'; i++) tr.step(1 / 60)
  tr.cheer(null); const seen: string[] = []
  for (let j = 0; j < 4 * 60; j++) { const m = tr.step(1 / 60).mode; if (seen.at(-1) !== m) seen.push(m) }
  ok(seen[0] === 'hopDown' && seen.includes('happy') && tr.cheers() === 1, `happy mid perch-hop: waits for her feet (${seen.join('>')})`)
}

// M109 s3 CALL HOME: from her roam (and from her perch) she walks to a far keeper, never through a blocker, settles by them,
// sits a moment, then is free (calling ends, not following); a call while she follows leaves her following after
for (const sp of ['fox', 'axolotl'] as const) for (const fps of [60, 4]) for (const start of ['roam', 'perch', 'follow'] as const) {
  const D = { ...(SPIRIT_MODELS[sp]?.trot ?? {}) }, dt = 1 / fps, tag = `call ${sp} ${fps}fps ${start}`
  const nav: SpiritNav = { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 } }
  const tr = makeTrot(nav, 21, D), k = { x: -4.5, z: 5.2, yaw: 0 }, f2 = { x: 1, z: -3, yaw: 0 }
  if (start === 'follow') tr.follow(() => f2)
  if (start !== 'perch') for (let i = 0; i < 20 * fps && !(start === 'follow' ? tr.pose().mode === 'follow' : ground(tr.pose().mode)); i++) tr.step(dt)
  tr.call(() => k)
  let nearest = 99, bad = '', arrivedAt = -1, freeAt = -1
  for (let i = 0; i < 60 * fps; i++) {
    const p = tr.step(dt), d = Math.hypot(p.x - k.x, p.z - k.z); nearest = Math.min(nearest, d)
    if (!bad && ground(p.mode) && (BOXES.some(b => inBox(b, p.x, p.z, 0.05)) || inBox(PLANTER, p.x, p.z, 0.15) || !inBox(PLOT, p.x, p.z))) bad = `${p.mode} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`
    if (arrivedAt < 0 && d < 2.2) arrivedAt = i * dt
    if (freeAt < 0 && !tr.calling()) freeAt = i * dt
  }
  ok(nearest < 2.2 && arrivedAt >= 0 && arrivedAt < 25, `${tag}: walks to the keeper (nearest ${nearest.toFixed(2)} m at ${arrivedAt.toFixed(1)} s)`)
  ok(!bad, `${tag}: never through a blocker (${bad})`)
  ok(freeAt > arrivedAt, `${tag}: then free again (${freeAt.toFixed(1)} s)`)
  const m = tr.pose().mode
  ok(start === 'follow' ? m === 'follow' : m !== 'follow' || false, `${tag}: after the call ${start === 'follow' ? 'back to following' : 'her own roam'} (${m})`)
}

if (fails.length) { console.error(`spirit-trot: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`spirit-trot: ${pass}/0`)
