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

// M109 s4 THE PARTY KEEPS NEAR: a bigger garden (40 x 30 m, the same bench/box near the planter, a room and a long hedge
// across the middle with a gap). The keeper walks ~26 m off and stands: an in-party spirit (near) drifts back within
// NEAR.r inside 25 s and then keeps loosely round them (mostly within r, with her own beats, not glued at Follow's slot);
// the same spirit NOT in the party never tracks the keeper. A keeper walking a slow loop keeps her within reach. Every
// step free of every blocker, at 60 and 4 fps, both species.
{
  const BIG = { x0: -8, x1: 32, z0: -15, z1: 15 }
  const BB = [...BOXES.slice(0, 2), { x0: 18, x1: 22, z0: 6, z1: 10 }, { x0: 12, x1: 12.6, z0: -15, z1: 2 }]   // room + hedge (gap z 2..15)
  const blockedB = (x: number, z: number) => !inBox(BIG, x, z, -PAD) || BB.some(b => inBox(b, x, z, PAD))
  const badB = (p: { x: number; z: number; mode: string }) => ground(p.mode) && (BB.some(b => inBox(b, p.x, p.z, 0.05)) || inBox(PLANTER, p.x, p.z, 0.15) || !inBox(BIG, p.x, p.z))
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]
  for (const sp of ['fox', 'axolotl'] as const) for (const fps of [60, 4]) for (const seed of [3, 17]) {
    const D = { ...(SPIRIT_MODELS[sp]?.trot ?? {}) }, dt = 1 / fps, tag = `near ${sp} ${fps}fps seed ${seed}`
    const mk = () => makeTrot({ home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked: blockedB, roam: { maxLeg: 4.5, away: 3 } }, seed, D)
    const party = mk(), other = mk(), k = { x: 0, z: 3, yaw: 0 }
    party.near(() => k)
    ok(party.nearing() && !other.nearing(), `${tag}: nearing() reads the party`)
    // 20 s with the keeper by the planter, then he walks to (24, -6) at 4 m/s (behind the hedge: she must go round by the gap)
    const A = { x: 0, z: 3 }, B = { x: 24, z: -6 }, walk = Math.hypot(B.x - A.x, B.z - A.z) / 4
    let bad = '', backAt = -1, tt = 0
    const dP: number[] = [], dO: number[] = [], modes = new Set<string>()
    for (let i = 0; i < (20 + walk + 120) * fps; i++) {   // M107 ship: she pauses about half the time now (was 90 s)
      tt = i * dt
      const w = clamp01((tt - 20) / walk); k.x = A.x + (B.x - A.x) * w; k.z = A.z + (B.z - A.z) * w
      const p = party.step(dt), o = other.step(dt)
      if (!bad && badB(p)) bad = `party ${p.mode} at ${p.x.toFixed(2)},${p.z.toFixed(2)} t=${tt.toFixed(1)}`
      if (!bad && badB(o)) bad = `other ${o.mode} at ${o.x.toFixed(2)},${o.z.toFixed(2)} t=${tt.toFixed(1)}`
      const stopAt = 20 + walk, d = Math.hypot(p.x - k.x, p.z - k.z), d2 = Math.hypot(o.x - k.x, o.z - k.z)
      if (tt >= stopAt && backAt < 0 && d < 8) backAt = tt - stopAt
      if (tt >= stopAt + 30) { dP.push(d); dO.push(d2); modes.add(p.mode) }
      if (tt >= stopAt + 30 && d < 0.9 && !bad) bad = `party ran through the keeper's feet (${d.toFixed(2)} m) t=${tt.toFixed(1)}`
    }
    ok(!bad, `${tag}: never in a blocker (${bad})`)
    // the way back is round the hedge (~35 m): the Vulnyx drifts at 1.7 x 1.3 m/s, the Manalotl ambles at 0.62 x 1.3 (her dial)
    const lim = sp === 'fox' ? 25 : 60
    ok(backAt >= 0 && backAt < lim, `${tag}: the party spirit is back within NEAR.r inside ${lim} s of the keeper stopping (${backAt.toFixed(1)} s)`)
    const within = dP.filter(d => d < 8 * 1.25).length / dP.length
    ok(within > 0.9, `${tag}: then keeps near (within r*slack ${(within * 100).toFixed(0)}% of the time)`)
    ok(med(dP) > 2, `${tag}: loose company, not glued at Follow's slot (median ${med(dP).toFixed(2)} m)`)
    ok(['look', 'trot'].every(m => modes.has(m)) && (modes.has('sit') || modes.has('sniff') || modes.has('tilt')), `${tag}: her own beats while near (${[...modes].join(',')})`)
    ok(Math.min(...dO) > 8, `${tag}: the non-party spirit never tracks the keeper (nearest ${Math.min(...dO).toFixed(2)} m)`)
    // let her out of the party: she roams by home again (home ~25 m off: she ends up nearer home than the keeper)
    party.near(null)
    let homeBy = 99
    for (let i = 0; i < 600 * fps; i++) { const q = party.step(dt); homeBy = Math.min(homeBy, Math.hypot(q.x, q.z)) }
    ok(!party.nearing() && homeBy < 3, `${tag}: let roam: back to her own roam round home (came within ${homeBy.toFixed(1)} m of home in 10 min; M107 ship: half her time is pauses now, was 5 min)`)
  }
  // a keeper walking a slow loop (1.2 m/s, radius 6 round (6,-4)): she never falls more than 2r behind once caught up
  for (const fps of [60, 4]) {
    const dt = 1 / fps, tr = makeTrot({ home, rMin: 0.9, rMax: 1.5, blocked: blockedB, roam: { maxLeg: 4.5, away: 3 } }, 5), k = { x: 0, z: 0, yaw: 0 }
    tr.near(() => k)
    let worst = 0, bad = ''
    for (let i = 0; i < 120 * fps; i++) {
      const a = i * dt * 1.2 / 6; k.x = 6 + Math.cos(a) * 6 - 6; k.z = -4 + Math.sin(a) * 6
      const p = tr.step(dt)
      if (!bad && badB(p)) bad = `${p.mode} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`
      if (i * dt > 15) worst = Math.max(worst, Math.hypot(p.x - k.x, p.z - k.z))
    }
    ok(!bad, `near loop ${fps}fps: never in a blocker (${bad})`)
    ok(worst < 16, `near loop ${fps}fps: keeps within 2r of a moving keeper (worst ${worst.toFixed(2)} m)`)
  }
}
function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }

// ── M110 s1 PLAY AT A TRAINING PIECE: a party spirit with a hurdle near the keeper goes to it ON HER OWN within a minute,
// bounds across it (both sides, over the middle, higher than her trot hop), finishes plays with the piece's stat, never more
// often than PLAY.rest allows, never inside a blocker; a non-party spirit never plays; Follow cuts a play (no gain).
{
  const HURDLE = { id: 'h1', x: -3, z: 3.5, ax: 0, az: 1, stat: 'agi' }   // rail runs along x, she plays across it in z (open ground: a piece behind the bench is reached only when a straight leg is clear)
  for (const [sp, dials] of [['fox', SPIRIT_MODELS.fox!.trot], ['axolotl', SPIRIT_MODELS.axolotl!.trot]] as const) for (const fps of [60, 4]) for (const seed of [1, 7, 42]) {
    const nav: SpiritNav = { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 }, toys: () => [HURDLE] }
    const tr = makeTrot(nav, seed, dials), dt = 1 / fps, k = { x: -2, z: 1.5, yaw: 0 }
    tr.near(() => k)
    const got: string[] = []; tr.onPlayed((id, stat) => got.push(`${id}:${stat}`))
    let first = -1, bad = '', yMax = 0, sides = new Set<number>(), lastPlay = -99, gap = 999, wasPlaying = false
    for (let i = 0; i < 240 * fps; i++) {
      const p = tr.step(dt), tt = i * dt
      if (p.mode === 'play') {
        if (first < 0) first = tt
        yMax = Math.max(yMax, p.y); sides.add(Math.sign(p.z - HURDLE.z))
        if (Math.abs(p.x - HURDLE.x) > 0.05) bad ||= `play off the axis x=${p.x.toFixed(2)}`
      }
      if (wasPlaying && p.mode !== 'play') { if (lastPlay > 0) gap = Math.min(gap, tt - lastPlay); lastPlay = tt }
      wasPlaying = p.mode === 'play'
      if (!bad && ground(p.mode) && (BOXES.some(b => inBox(b, p.x, p.z, 0.05)) || !inBox(PLOT, p.x, p.z))) bad = `${p.mode} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`
    }
    const tag = `play ${sp} seed ${seed} @${fps}fps`
    const within = sp === 'fox' ? 60 : 120   // the Manalotl ambles: ~8 s legs, so a quarter as many picks a minute
    ok(first >= 0 && first < within, `${tag}: goes to the hurdle on her own within ${within} s (first play at ${first.toFixed(1)} s)`)
    ok(got.length >= 2 && got.every(g => g === 'h1:agi') && tr.plays() === got.length, `${tag}: finished plays carry the piece's stat (${got.length}: ${got.slice(0, 2).join(',')})`)
    ok(sides.has(1) && sides.has(-1), `${tag}: bounds across it, both sides`)
    ok(yMax > (dials.hopH ?? 0.05) * 1.5, `${tag}: the bound is higher than her trot hop (${yMax.toFixed(3)} m)`)
    ok(gap >= 20 - 0.01 || got.length < 2, `${tag}: never plays again within PLAY.rest (shortest gap ${gap.toFixed(1)} s)`)
    ok(!bad, `${tag}: never in a blocker / off the plot: ${bad}`)
  }
  // not in the party: the hurdle is never chosen
  for (const seed of [1, 7, 42]) {
    const tr = makeTrot({ home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 }, toys: () => [HURDLE] }, seed)
    let played = false; for (let i = 0; i < 180 * 30; i++) if (tr.step(1 / 30).mode === 'play') played = true
    ok(!played && tr.plays() === 0, `play: a non-party spirit never plays (seed ${seed})`)
  }
  // Follow mid-play: the play stops, no gain
  {
    const tr = makeTrot({ home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 }, toys: () => [HURDLE] }, 7), k = { x: -2, z: 1.5, yaw: 0 }
    tr.near(() => k); let n = 0; tr.onPlayed(() => n++)
    let i = 0; for (; i < 120 * 30 && tr.step(1 / 30).mode !== 'play'; i++);
    tr.follow(() => k); let stillPlay = false; for (let j = 0; j < 30 * 10; j++) if (tr.step(1 / 30).mode === 'play') stillPlay = true
    ok(i < 120 * 30 && !stillPlay && n === 0, `play: Follow cuts a play, no gain (playing at ${(i / 30).toFixed(1)} s, gains ${n})`)
  }
  // no piece in reach of the keeper (> NEAR.r): never chosen
  {
    const far = { ...HURDLE, x: 12.5, z: 5.5 }, tr = makeTrot({ home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 }, toys: () => [far] }, 7), k = { x: -3, z: -4, yaw: 0 }
    tr.near(() => k); let played = false; for (let i = 0; i < 120 * 30; i++) if (tr.step(1 / 30).mode === 'play') played = true
    ok(!played, 'play: a piece further than NEAR.r from the keeper is never chosen')
  }
}

// ── M110 s2 THE OTHER THREE PIECES: a party spirit goes to each ON HER OWN and plays it ITS way, distinct from the hurdle's
// bound: SHOVE (PWR) = lunges in to the stone from one side and backs off facing it, leaning in, never a leap; GUARD (GRD) =
// a low braced sidestep across the gap between the posts, facing out (side-on to her motion); LAPS (VIG) = runs whole rings
// round it at its radius. Each finished play carries the piece's stat; rest between plays; never in a blocker.
{
  const C = { x: -3, z: 3.5 }
  const PIECES = [
    { id: 'ps', ...C, ax: 0, az: 1, stat: 'pwr', kind: 'shove' as const, size: 0.3 },
    { id: 'gp', ...C, ax: 0, az: 1, stat: 'grd', kind: 'guard' as const, size: 0.4 },
    { id: 'rr', ...C, ax: 0, az: 1, stat: 'vig', kind: 'laps' as const, size: 1.15 },
  ]
  const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
  for (const P of PIECES) for (const [sp, dials] of [['fox', SPIRIT_MODELS.fox!.trot], ['axolotl', SPIRIT_MODELS.axolotl!.trot]] as const) for (const fps of [60, 4]) for (const seed of [1, 7, 42]) {
    const tr = makeTrot({ home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 }, toys: () => [P] }, seed, dials), dt = 1 / fps, k = { x: -2, z: 1.5, yaw: 0 }
    tr.near(() => k)
    const got: string[] = []; tr.onPlayed((id, stat) => got.push(`${id}:${stat}`))
    let first = -1, bad = '', yMax = 0, brace = 0, pitch = 0, lastPlay = -99, gap = 999, wasPlaying = false, prev = tr.pose()
    let dMin = 9, dMax = 0, offAxis = 0, sides = new Set<number>(), sideFlip = 0, side = 0, swept = 0, sweptMin = 99, lastA = 0
    const sideOn: number[] = []
    for (let i = 0; i < 240 * fps; i++) {
      const p = tr.step(dt), tt = i * dt, rx = p.x - P.x, rz = p.z - P.z, d = Math.hypot(rx, rz)
      if (p.mode === 'play') {
        if (first < 0) first = tt
        if (!wasPlaying) { side = 0; swept = 0; lastA = Math.atan2(prev.z - P.z, prev.x - P.x) }   // from where she stood when it began
        yMax = Math.max(yMax, p.y); brace = Math.max(brace, tr.braced()); pitch = Math.max(pitch, p.pitch)
        dMin = Math.min(dMin, d); dMax = Math.max(dMax, d)
        if (P.kind === 'shove') { const sd = Math.sign(rz); if (side && sd !== side) sideFlip++; side = sd }
        if (P.kind === 'guard') { offAxis = Math.max(offAxis, Math.abs(rz)); sides.add(Math.sign(rx))
          const mv = Math.hypot(p.x - prev.x, p.z - prev.z); if (mv > 1e-4 && prev.mode === 'play') sideOn.push(Math.abs((Math.sin(p.yaw) * (p.x - prev.x) + Math.cos(p.yaw) * (p.z - prev.z)) / mv)) }
      }
      if (P.kind === 'laps' && (p.mode === 'play' || wasPlaying)) { const a = Math.atan2(rz, rx); swept += Math.abs(wrapA(a - lastA)); lastA = a }   // the step that ends it moved too
      if (wasPlaying && p.mode !== 'play') { if (lastPlay > 0) gap = Math.min(gap, tt - lastPlay); lastPlay = tt; if (P.kind === 'laps' && tr.plays() > 0) sweptMin = Math.min(sweptMin, swept) }
      wasPlaying = p.mode === 'play'; prev = p
      if (!bad && ground(p.mode) && (BOXES.some(b => inBox(b, p.x, p.z, 0.05)) || !inBox(PLOT, p.x, p.z))) bad = `${p.mode} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`
    }
    const tag = `${P.kind} ${sp} seed ${seed} @${fps}fps`, within = sp === 'fox' ? 120 : 200   // M107 ship: was 90 / 150 before the calmer idle mix
    ok(first >= 0 && first < within, `${tag}: goes to it on her own within ${within} s (first play at ${first.toFixed(1)} s)`)
    ok(got.length >= 2 && got.every(g => g === `${P.id}:${P.stat}`) && tr.plays() === got.length, `${tag}: finished plays carry ITS stat ${P.stat} (${got.length}: ${got.slice(0, 2).join(',')})`)
    ok(gap >= 20 - 0.01 || got.length < 2, `${tag}: never plays again within PLAY.rest (shortest gap ${gap.toFixed(1)} s)`)
    ok(!bad, `${tag}: never in a blocker / off the plot: ${bad}`)
    ok(yMax < (dials.playH ?? 0.2) * 0.7, `${tag}: no hurdle bound (peak ${yMax.toFixed(3)} m)`)
    if (P.kind === 'shove') {
      ok(sideFlip === 0 && dMin > P.size + 0.08 && dMin < P.size + 0.2 && dMax < P.size + 0.12 + 0.5 + 0.05, `${tag}: one side only, in to touching it and back off (${dMin.toFixed(2)}..${dMax.toFixed(2)} m, flips ${sideFlip})`)
      ok(brace > 0.6 && pitch > 0.1, `${tag}: leans into it (brace ${brace.toFixed(2)}, pitch ${pitch.toFixed(2)})`)
    }
    if (P.kind === 'guard') {
      const med = sideOn.sort((a, b) => a - b)[Math.floor(sideOn.length / 2)] ?? 1
      ok(offAxis < 0.02 && sides.has(1) && sides.has(-1) && dMax < P.size + 0.02, `${tag}: sidesteps across the gap, post to post (off the line ${offAxis.toFixed(3)}, reach ${dMax.toFixed(2)})`)
      ok(brace > 0.6 && med < 0.3, `${tag}: low and braced, side-on to her steps (brace ${brace.toFixed(2)}, median |fwd.move| ${med.toFixed(2)})`)
    }
    if (P.kind === 'laps') {
      ok(Math.abs(dMin - P.size) < 0.02 && Math.abs(dMax - P.size) < 0.02, `${tag}: runs at the ring's radius (${dMin.toFixed(2)}..${dMax.toFixed(2)})`)
      ok(sweptMin >= Math.PI * 2 - 0.05, `${tag}: a play is at least one whole lap (fewest ${(sweptMin / Math.PI / 2).toFixed(2)} laps)`)
    }
  }
}
// the species manner (the dial table): each leans somewhere, and they differ
{
  const fl = SPIRIT_MODELS.fox!.trot.toyLean!, ml = SPIRIT_MODELS.axolotl!.trot.toyLean!
  ok(['pwr', 'grd', 'agi', 'vig'].every(k => (fl[k] ?? 1) > 0 && (ml[k] ?? 1) > 0), 'manner: every piece stays possible for both (no lean is 0, nothing forbidden)')
  ok(fl.agi > ml.agi && ml.grd > fl.grd, `manner: the Vulnyx leans AGI, the Manalotl leans GRD (fox ${JSON.stringify(fl)}, axolotl ${JSON.stringify(ml)})`)
}

// M107 ship (Alex 11-23: "more pauses", then out to every keeper): she is CALM. Over 10 min in the stand-in garden, off the
// perch she stands still (a check / look / sniff / sit / tilt) about half the time, and a moving bout (a run of trot, hops
// and all, between two stops) is short. Before this the Vulnyx stood ~37% / the Manalotl ~26% of her ground time.
for (const sp of ['fox', 'axolotl'] as const) for (const fps of [60, 4]) for (const seed of [1, 7, 42, 99]) {
  const nav: SpiritNav = { home, rMin: 0.9, rMax: 1.5, perch: { y: 0.53 }, blocked, roam: { maxLeg: 4.5, away: 3 } }
  const tr = makeTrot(nav, seed, SPIRIT_MODELS[sp]!.trot), dt = 1 / fps, MOVE = new Set(['trot', 'hopDown', 'hopUp'])
  let still = 0, grnd = 0, bout = 0, bouts: number[] = []
  for (let i = 0; i < 600 * fps; i++) {
    const m = tr.step(dt).mode
    if (MOVE.has(m)) bout += dt; else if (bout > 0) { bouts.push(bout); bout = 0 }
    if (m !== 'perch') { grnd += dt; if (!MOVE.has(m)) still += dt }
  }
  const share = still / grnd, mean = bouts.reduce((a, b) => a + b, 0) / Math.max(1, bouts.length), tag = `calm ${sp} seed ${seed} @${fps}fps`
  ok(share >= 0.44 && share <= 0.66, `${tag}: off the perch she is still about half the time (${(share * 100).toFixed(0)}%, want 44..66%)`)
  const boutMax = sp === 'fox' ? 2.6 : 5.5
  ok(mean <= boutMax, `${tag}: short moving bouts (mean ${mean.toFixed(2)} s, want <= ${boutMax})`)
  if (process.env.CALM_PRINT) console.log(tag, (share * 100).toFixed(1), mean.toFixed(2))
}

if (fails.length) { console.error(`spirit-trot: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`spirit-trot: ${pass}/0`)
