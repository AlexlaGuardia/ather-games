// M49 s5: the shipyard GARAGES. The pure garage rules (garage-bays.ts) + the REAL courser (courser.ts) driven on the REAL
// continent onto a plot: up the courser ramp, through the gate, into a bay; stopped by the fence and the retaining wall;
// a shut (unowned) gate keeps it out. npx tsx this file.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { createCourser, tickCourser, type Courser } from '../courser'
import { carPush } from '../foot-extras'
import { SHIPYARD_PLOTS, SHIPYARD_TIERS, plotLayout, plotGround, plotCarBoxes, plotToWorld, plotToLocal, bayAt, bayPose, bayRects, PLOT, PLOT_GATE_W, LANDING_D, CAR_RISE, type PlotLayout } from './shipyard-plots'
import { emptyGarage, sanitizeGarage, garageStep, takeOutRefusal, freeBays, applyGarageEvent } from './garage-bays'

let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }

// ── 1 · the rules ──
{
  const g0 = emptyGarage(4)
  ok(g0.bays.length === 4 && freeBays(g0).length === 4, 'a 4-bay garage starts empty')
  let r = garageStep(g0, 'darter', 2, false)
  ok(!r.ev && r.g === g0, 'rolling through a bay parks nothing (not stopped)')
  r = garageStep(g0, 'darter', 2, true)
  ok(r.ev?.kind === 'parked' && r.ev.bay === 2 && r.g.bays[2] === 'darter', 'stopping in a free bay parks it there')
  const parked = r.g
  ok(!garageStep(parked, 'darter', 2, true).ev, 'staying put is no event')
  ok(!garageStep(parked, 'darter', 2, false).ev, 'creeping inside the bay keeps it parked')
  r = garageStep(parked, 'darter', -1, false)
  ok(r.ev?.kind === 'left' && r.g.bays[2] === null, 'driving out frees the bay')
  r = garageStep(parked, 'darter', 0, true)
  ok(r.ev?.kind === 'left' && r.g.bays[2] === null && r.g.bays[0] === null, 'moving to another bay: first it leaves the old one')
  ok(garageStep(r.g, 'darter', 0, true).g.bays[0] === 'darter', '...then parks in the new one (one bay per courser)')
  // capacity: a courser only parks in a bay the garage HAS
  ok(!garageStep(emptyGarage(4), 'darter', 4, true).ev, 'no bay 5 in a 4-bay garage')
  // a bay holding another courser while the driven one stands in it (a garage-panel swap made in the bay): the driven one takes it
  const two = { v: 1 as const, bays: ['hauler', null, null, null] }
  r = garageStep(two, 'darter', 0, true)
  ok(r.g.bays[0] === 'darter', 'the driven courser in a bay is what the bay holds')
  // sanitizing a save
  const s = sanitizeGarage({ v: 1, bays: ['darter', 'ghost', 'darter', 'hauler', 'hauler', 'scrambler'] }, 4, ['darter', 'hauler', 'scrambler'])
  ok(JSON.stringify(s.bays) === JSON.stringify(['darter', null, null, 'hauler']), `a save is cut to the tier, unknown + repeated ids dropped (${JSON.stringify(s.bays)})`)
  ok(sanitizeGarage('junk', 8, []).bays.length === 8 && sanitizeGarage(null, 12, []).bays.every(b => b === null), 'junk loads as an empty garage of the right size')
  // taking one out
  const g = { v: 1 as const, bays: ['darter', 'hauler', null, null] }
  ok(takeOutRefusal(g, 1, 'darter', true) === null, 'the Hauler comes out when the Darter is parked here')
  ok(takeOutRefusal(g, 1, 'darter', false) === 'loose', '...not while the Darter is out on the road')
  ok(takeOutRefusal(g, 2, 'darter', true) === 'empty' && takeOutRefusal(g, 0, 'darter', true) === 'driving', 'an empty bay / the one you drive: nothing to take out')
}

// ── 1b · the bay-2 reload drop (11-22): a park seen by a stale/empty in-memory garage must not wipe the stored bays ──
{
  const stored = { v: 1, bays: ['darter', 'dray', null, null] }
  // the first garage tick after a reload, before the save was read: memory is empty, the Darter stands still in bay 1
  const r = garageStep(emptyGarage(4), 'darter', 0, true)
  ok(r.ev?.kind === 'parked', 'the stale tick does see a park (the hazard is real)')
  const saved = applyGarageEvent(stored, 4, r.ev!)
  ok(saved.bays[1] === 'dray', `the Dray stays in bay 2 after that park is saved (${JSON.stringify(saved.bays)})`)
  ok(saved.bays[0] === 'darter', 'the Darter is in bay 1')
  // a move between bays keeps one bay per courser and leaves the others alone
  const moved = applyGarageEvent(stored, 4, { kind: 'parked', bay: 3, id: 'darter' })
  ok(JSON.stringify(moved.bays) === JSON.stringify([null, 'dray', null, 'darter']), `a park elsewhere moves only that courser (${JSON.stringify(moved.bays)})`)
  // leaving frees only its own bay; a leave for a bay holding another courser frees nothing
  ok(JSON.stringify(applyGarageEvent(stored, 4, { kind: 'left', bay: 0, id: 'darter' }).bays) === JSON.stringify([null, 'dray', null, null]), 'leaving frees its own bay only')
  ok(applyGarageEvent(stored, 4, { kind: 'left', bay: 1, id: 'darter' }).bays[1] === 'dray', 'a stale leave never frees another courser')
  // an id the fleet has not loaded yet is NOT dropped on save (sanitizing is for reading, not for writing)
  ok(applyGarageEvent({ v: 1, bays: [null, 'hauler'] }, 4, { kind: 'parked', bay: 0, id: 'darter' }).bays[1] === 'hauler', 'unknown-yet ids survive a save')
  ok(applyGarageEvent('junk', 4, { kind: 'parked', bay: 2, id: 'darter' }).bays[2] === 'darter', 'a junk save takes the park')
}

// ── 2 · the real courser on the real plots ──
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const H = PLOT / 2, g = PLOT_GATE_W / 2

/** drive toward local waypoints with a plain pursuit (W + steer, the handbrake to stop); returns the car and why it stopped */
function drive(L: PlotLayout, c: Courser, pts: [number, number][], shut = false, secs = 90) {
  const gp = plotGround(L), boxes = plotCarBoxes(L, shut)
  const ground = (x: number, z: number, y?: number) => Math.max(R.groundAt(x, z, y), gp(x, z))
  let k = 0, hits = 0, maxDrop = 0
  const STEP = 1 / 120
  for (let t = 0; t < secs && k < pts.length; t += STEP) {
    const w = plotToWorld(L.frame, pts[k][0], pts[k][1]), dx = w.x - c.x, dz = w.z - c.z, d = Math.hypot(dx, dz)
    const last = k === pts.length - 1
    if (d < (last ? 0.7 : 2.0)) { k++; continue }
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw), fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw)
    const side = (dx * rx + dz * rz) / d, fwd = (dx * fx + dz * fz) / d
    const sp = Math.hypot(c.vx, c.vz), want = last ? Math.min(3, d * 1.2) : 4.5
    const throttle = fwd < 0 ? 0.4 : sp < want ? 0.55 : 0
    const y0 = c.y
    tickCourser(c, { throttle, steer: Math.max(-1, Math.min(1, (fwd < 0 ? Math.sign(side || 1) : side * 2.5))), handbrake: false, dt: STEP, surface: 1 }, (x, z) => ground(x, z, c.y))
    if (carPush(c, boxes)) hits++
    maxDrop = Math.max(maxDrop, y0 - c.y)
  }
  // stop
  for (let t = 0; t < 3; t += STEP) { tickCourser(c, { throttle: 0, steer: 0, handbrake: true, dt: STEP, surface: 1 }, (x, z) => ground(x, z, c.y)); carPush(c, boxes) }
  return { reached: k >= pts.length, k, hits, maxDrop }
}
const yawAlong = (L: PlotLayout, ux: number, uz: number) => { const dx = L.frame.ax[0] * ux + L.frame.az[0] * uz, dz = L.frame.ax[1] * ux + L.frame.az[1] * uz; return Math.atan2(-dx, -dz) }

for (const site of SHIPYARD_PLOTS) {
  const L = plotLayout(R, site), t = site.key.split(':')[2] ?? 'kael', cap = SHIPYARD_TIERS[site.key].garage
  const gp = plotGround(L)
  // the courser ramp: from the floor at the gate to the ground at its foot, never steeper than CAR_RISE
  const foot = plotToWorld(L.frame, -g - L.carRamp.L + 0.25, -H - LANDING_D / 2), gap = gp(foot.x, foot.z) - R.heightAt(foot.x, foot.z)
  ok(L.carRamp.L > 0 && gap < 0.4, `${t}: the courser ramp's foot meets the ground (ramp ${L.carRamp.L} m, its foot ${gap.toFixed(2)} m over the ground)`)
  ok(CAR_RISE < 0.6, 'the courser ramp is gentler than a face that scrubs a courser (0.6)')
  ok(bayRects(L).length === cap, `${t}: ${cap} bays`)
  // the drive in: start on the ground short of the ramp's foot, up the ramp, turn in at the gate, across to bay 0, nose in
  const start = plotToWorld(L.frame, -g - L.carRamp.L - 4, -H - LANDING_D / 2)
  const c = createCourser(start.x, start.z, yawAlong(L, 1, 0), (x, z) => Math.max(R.groundAt(x, z), gp(x, z)))
  const b0 = bayRects(L)[0]
  const run = drive(L, c, [[-g - 1, -H - LANDING_D / 2], [0, -H + 4], [0, -H + 10], [b0.lx - b0.hw - 6, b0.lz], [b0.lx - b0.hw + 1, b0.lz], [b0.lx + 0.4, b0.lz]])
  const inBay = bayAt(L, c.x, c.z, c.y)
  ok(run.reached && inBay === 0, `${t}: a courser drives up the ramp, through the gate and into bay 1 (reached ${run.k}/6, in bay ${inBay}, y ${c.y.toFixed(1)} vs floor ${L.floor.toFixed(1)}, wall hits ${run.hits})`)
  ok(Math.abs(c.y - L.floor) < 0.3, `${t}: ...standing on the floor, not under it`)
  // parked, saved, then out again
  const gs = garageStep(emptyGarage(cap), 'darter', inBay, Math.hypot(c.vx, c.vz) < 0.6)
  ok(gs.g.bays[0] === 'darter', `${t}: stopping there parks it`)
  // nose-in, so it BACKS out (S): straight back for a few seconds
  { const gp2 = plotGround(L), bx = plotCarBoxes(L), ground = (x: number, z: number, y?: number) => Math.max(R.groundAt(x, z, y), gp2(x, z))
    for (let s = 0; s < 4; s += 1 / 120) { tickCourser(c, { throttle: -0.5, steer: 0, handbrake: false, dt: 1 / 120, surface: 1 }, (x, z) => ground(x, z, c.y)); carPush(c, bx) } }
  ok(bayAt(L, c.x, c.z, c.y) === -1 && garageStep(gs.g, 'darter', bayAt(L, c.x, c.z, c.y), false).g.bays[0] === null, `${t}: backing out frees bay 1 (lx ${plotToLocal(L.frame, c.x, c.z).lx.toFixed(1)})`)
  // the walls: from the floor straight at the side fence, it stops at it
  const mid = plotToWorld(L.frame, 0, 0), c2 = createCourser(mid.x, mid.z, yawAlong(L, -1, 0), (x, z) => Math.max(R.groundAt(x, z), gp(x, z)))
  drive(L, c2, [[-H - 20, 0]], false, 25)
  ok(plotToLocal(L.frame, c2.x, c2.z).lx > -H, `${t}: the fence stops a courser on the floor (lx ${plotToLocal(L.frame, c2.x, c2.z).lx.toFixed(1)})`)
  // below the terrace, at the retaining wall: a courser does not creep up a 4 m step into the plot
  const below = plotToWorld(L.frame, -H - 12, 10), c3 = createCourser(below.x, below.z, yawAlong(L, 1, 0), (x, z) => Math.max(R.groundAt(x, z), gp(x, z)))
  drive(L, c3, [[0, 10]], false, 25)
  ok(plotToLocal(L.frame, c3.x, c3.z).lx < -H && c3.y < L.floor - 1, `${t}: a courser from below cannot get up onto the terrace (wall + steep face; lx ${plotToLocal(L.frame, c3.x, c3.z).lx.toFixed(1)}, y ${c3.y.toFixed(1)})`)
  // a shut gate (a shipyard not yours): up the ramp, but not in
  const c4 = createCourser(start.x, start.z, yawAlong(L, 1, 0), (x, z) => Math.max(R.groundAt(x, z), gp(x, z)))
  drive(L, c4, [[-g - 1, -H - LANDING_D / 2], [0, -H + 4], [0, -H + 10]], true, 40)
  ok(plotToLocal(L.frame, c4.x, c4.z).lz < -H, `${t}: a shut gate keeps the courser out (lz ${plotToLocal(L.frame, c4.x, c4.z).lz.toFixed(1)})`)
  // the parked pose is in its bay
  for (let k = 0; k < cap; k++) { const p = bayPose(L, k); if (bayAt(L, p.x, p.z) !== k) ok(false, `${t}: bay ${k + 1}'s parked pose is in bay ${k + 1}`) }
  console.log(`  ${t}: courser ramp ${L.carRamp.L} m (rise ${(L.carRamp.L * CAR_RISE).toFixed(1)} m), ${cap} bays, drive-in wall hits ${run.hits}`)
}

console.log(`garage-bays: ${n - fails}/${n} pass`)
if (fails) process.exit(1)
