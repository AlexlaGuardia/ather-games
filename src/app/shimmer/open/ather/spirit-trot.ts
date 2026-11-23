// M107 (sprites, 2026-11-23): THE SPIRIT TROT. Alex 11-23 on the 3D Vulnyx: "can it walk around?". The spirit glbs carry
// no rig (one 'body' mesh + 'eyes', no skin, no clips), so the walk is PROCEDURAL and lives here, model-agnostic: this file
// is pure (no three, no React), it plans where the spirit goes and returns a POSE each frame; spirit-model.tsx applies the
// pose to whichever spirit mesh it draws. Brief (the Vulnyx): clever, quick, light on her feet, trickster energy, never robotic.
//
// Motion: a bouncy hop-trot (hop height + cadence tied to distance travelled, a stretch in the air and a squash on each
// landing), a lean into turns from the yaw rate, a smoothed face-the-way-you-go yaw, and idle beats between runs: a quick
// stop-check, a look round (snappy glances, not a sweep), a sit (lower crouch, nose up), and a hop back up onto the perch.
//
// WHERE: `SpiritNav` = a HOME point, a ring between rMin and rMax round it, and a `blocked(x, z)` test (furniture, rooms,
// off the plot). Runs follow polar arcs round home, so with rMin past the home's own footprint a run can never cut through it.
// s1 (owner-only ?spirits=3d) = home is her own planter, ring 0.9..1.5 m. s2 (Magii RULED 11-23: a bloomed spirit walks the
// whole garden) = the same planner with a bigger ring / a nav area; nothing here knows it is a planter.

export type SpiritNav = {
  /** world xz of home (the planter's centre) */
  home: { x: number; z: number }
  /** runs stay on the ring rMin..rMax metres from home */
  rMin: number; rMax: number
  /** true = the spirit may not stand here (a box, a wall, off the plot) */
  blocked: (x: number, z: number) => boolean
  /** a perch at home she can sit on and hop down from / up onto (the planter's soil), y above the ground */
  perch?: { y: number }
  /** M107 s2 (Magii RULED 11-23, athernyx 8b45c92: a bloomed spirit walks the whole garden): straight darting runs to spots
   *  anywhere `blocked` allows, each leg up to maxLeg metres; `away` = how far from home the first spot out must be. The ring
   *  stays as the home beat. Without `roam` she only circles home (s1). */
  roam?: { maxLeg: number; away: number }
}
export type TrotMode = 'perch' | 'hopDown' | 'hopUp' | 'trot' | 'check' | 'look' | 'sit' | 'sniff'
export type TrotPose = {
  x: number; z: number      // world
  y: number                 // lift above the ground under her (hop, perch)
  yaw: number               // world yaw; the model faces +z at yaw 0
  roll: number; pitch: number
  sx: number; sy: number    // squash/stretch (sx = x and z)
  swing: number             // 0..1 how hard the tail/ears swing (running)
  lift: number              // vertical velocity-ish, -1..1 (the tail lags it)
  mode: TrotMode
}

// ── the dials (tuned for a 0.55 m fox spirit; quick and light) ─────────────────────────────────────────────────────
export const TROT = {
  speed: 1.15,      // m/s at full trot round home (she is a third of a keeper tall: this reads as a brisk little run)
  dash: 1.7,        // m/s on a straight roam leg: the Vulnyx darts (clever, quick, light on her feet)
  stride: 0.27,     // metres per hop: ~4.3 hops/s at full speed
  hopH: 0.05,       // hop height (m)
  stretch: 0.07,    // air stretch (scale y)
  squash: 0.15,     // landing squash (scale y), decays fast
  squashK: 22,      // squash decay /s
  lean: 0.075,      // roll per rad/s of yaw rate
  leanMax: 0.26,
  turnK: 11,        // yaw smoothing /s (snappy, not instant)
  hopArc: 0.42,     // s for a hop down/up the perch
  hopArcH: 0.2,     // m above the higher end of that hop
  sitY: 0.88, sitPitch: -0.2,
  sniffPitch: 0.32, // nose to the ground
}

const TAU = Math.PI * 2
const wrap = (a: number) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const ease = (t: number) => t * t * (3 - 2 * t)

/** A seeded little rng so two spirits on two planters do not move in lockstep. */
function rng(seed: number) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6 } }

export type Trot = { step: (dt: number) => TrotPose; pose: () => TrotPose; beats: () => number; homes: () => number }

export function makeTrot(nav: SpiritNav, seed = 1): Trot {
  const R = rng(seed), { home, roam } = nav
  const rand = (a: number, b: number) => lerp(a, b, R())
  const at = (a: number, r: number) => ({ x: home.x + Math.cos(a) * r, z: home.z + Math.sin(a) * r })
  const dHome = (p: { x: number; z: number }) => Math.hypot(p.x - home.x, p.z - home.z)
  // free ground: not blocked, and clear of home itself (the planter; the nav's blocked leaves her own planter out)
  const free = (x: number, z: number) => Math.hypot(x - home.x, z - home.z) >= nav.rMin - 0.02 && !nav.blocked(x, z)
  // polar position round home (the ring runs' param space), kept in step with pos after every run
  let ang = R() * TAU, rad = nav.rMin + 0.1
  let mode: TrotMode = nav.perch ? 'perch' : 'look', t = 0, dur = nav.perch ? rand(1.0, 1.6) : 1
  let yaw = R() * TAU, yawPrev = yaw, lookYaw = 0, lookAt = 0, lookFrom = 0, lookT = 0, lookHold = 0.6
  let hopPh = 0, sinceLand = 9, runs = 0, beats = 0, homes = 0, sitK = 0, homing = false, outFirst = !!roam
  // the current run: an ARC round home (polar a0,r0 -> a1,r1) or a straight LINE (p0 -> p1); length len, speed vRun
  let kind: 'arc' | 'line' = 'arc', a0 = 0, a1 = 0, r0 = 0, r1 = 0, p0 = { x: 0, z: 0 }, p1 = { x: 0, z: 0 }, len = 1, s = 0, vRun = TROT.speed
  let pos = nav.perch ? { x: home.x, z: home.z } : at(ang, rad), y = nav.perch?.y ?? 0, lift = 0

  const arcLen = (A0: number, A1: number, R0: number, R1: number) => { let L = 0, p = at(A0, R0); for (let i = 1; i <= 12; i++) { const q = at(lerp(A0, A1, i / 12), lerp(R0, R1, i / 12)); L += Math.hypot(q.x - p.x, q.z - p.z); p = q } return L }
  const arcFree = (A0: number, A1: number, R0: number, R1: number) => { const L = arcLen(A0, A1, R0, R1), n = Math.max(2, Math.ceil(L / 0.1)); for (let i = 1; i <= n; i++) { const q = at(lerp(A0, A1, i / n), lerp(R0, R1, i / n)); if (!free(q.x, q.z)) return false } return true }
  const lineFree = (A: { x: number; z: number }, B: { x: number; z: number }) => { const n = Math.max(2, Math.ceil(Math.hypot(B.x - A.x, B.z - A.z) / 0.1)); for (let i = 1; i <= n; i++) if (!free(lerp(A.x, B.x, i / n), lerp(A.z, B.z, i / n))) return false; return true }
  const syncPolar = () => { ang = Math.atan2(pos.z - home.z, pos.x - home.x); rad = dHome(pos) }

  /** a run along the ring from where she is (she must be on it) */
  function planArc(toR?: number): boolean {
    const dir = R() < 0.5 ? 1 : -1
    for (let k = 0; k < 10; k++) {
      const d = (k % 2 ? -dir : dir) * rand(0.6, 2.0) * (k < 6 ? 1 : 0.5), r = toR ?? rand(nav.rMin, nav.rMax)
      if (!arcFree(ang, ang + d, rad, r)) continue
      kind = 'arc'; a0 = ang; a1 = ang + d; r0 = rad; r1 = r; len = arcLen(a0, a1, r0, r1); s = 0; vRun = TROT.speed; return true
    }
    return false
  }
  function planLine(to: { x: number; z: number }, v: number): boolean {
    if (!free(to.x, to.z) || !lineFree(pos, to)) return false
    kind = 'line'; p0 = { ...pos }; p1 = to; len = Math.max(0.05, Math.hypot(to.x - pos.x, to.z - pos.z)); s = 0; vRun = v; return true
  }
  /** a straight dart to a spot: from home it must reach `away`; mostly forward-ish, so the runs chain rather than zig-zag */
  function planDash(away = 0): boolean {
    if (!roam) return false
    for (let k = 0; k < 24; k++) {
      const h = (k < 12 ? yaw + rand(-1.3, 1.3) : rand(0, TAU)), L = rand(Math.min(1.8, roam.maxLeg), roam.maxLeg)
      const to = { x: pos.x + Math.sin(h) * L, z: pos.z + Math.cos(h) * L }
      if (dHome(to) < Math.max(away, nav.rMax + 0.2)) continue
      if (planLine(to, TROT.dash * rand(0.85, 1.1))) return true
    }
    return false
  }
  /** a short straight hop between two ring points (a chord that misses the planter): breaks up the circling near home */
  function planChord(): boolean {
    for (let k = 0; k < 10; k++) { const a = ang + (R() < 0.5 ? 1 : -1) * rand(0.5, 1.4); if (planLine(at(a, rand(nav.rMin + 0.1, nav.rMax)), TROT.speed * rand(1, 1.25))) return true }
    return false
  }
  /** head home: a straight line to the free ring point nearest her bearing, then (homing) hop up */
  function planHome(): boolean {
    const b = Math.atan2(pos.z - home.z, pos.x - home.x)
    for (let k = 0; k < 16; k++) { const a = b + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35; if (planLine(at(a, nav.rMin), TROT.dash * 0.9)) return true }
    return false
  }
  /** a landing point on the ring to hop down to from the perch */
  function landing(): boolean {
    for (let k = 0; k < 12; k++) { const a = R() * TAU, p = at(a, nav.rMin); if (free(p.x, p.z)) { ang = a; rad = nav.rMin; return true } }
    return false
  }
  function go(m: TrotMode, d: number) { mode = m; t = 0; dur = d; if (m === 'look') { lookT = 0; lookFrom = lookYaw; lookAt = rand(-0.7, 0.7) } }
  /** the next run from a standstill. true = she is off. */
  function move(): boolean {
    const near = dHome(pos) <= nav.rMax + 0.25
    if (roam) {
      if (outFirst && planDash(roam.away)) { outFirst = false; return run() }
      if (!near) {
        // the further out she is, the likelier she heads home (to hop up, or for a lap of the ring)
        if (R() < clamp(0.15 + dHome(pos) / 25, 0.15, 0.6) && planHome()) { homing = !!nav.perch && R() < 0.7; return run() }
        if (planDash()) return run()
        if (planHome()) return run()
        return false
      }
      const r = R()
      if (r < 0.45 && planDash(roam.away)) return run()
      if (r < 0.65 && planChord()) return run()
    }
    if (planArc()) return run()
    return planChord() ? run() : false
  }
  function run() { go('trot', 0); return true }
  function afterRun() {
    // after a run: chain another (a quick alert stop first), or a real beat. Never more than two runs without a beat.
    runs++
    if (homing && dHome(pos) <= nav.rMin + 0.25) { homing = false; homes++; return go('hopUp', TROT.hopArc) }
    homing = false
    if (runs >= 2 || R() < 0.62) {
      runs = 0; beats++
      const b = R()
      if (nav.perch && dHome(pos) <= nav.rMax + 0.25 && b < 0.15 && planArc(nav.rMin)) { homing = true; return run() }
      // the Vulnyx: mostly alert look-rounds; a sniff out on the grass; now and then a sit
      return b < 0.6 ? go('look', rand(1.2, 2.4)) : b < 0.82 && roam ? go('sniff', rand(0.8, 1.5)) : go('sit', rand(1.8, 3.2))
    }
    go('check', rand(0.3, 0.75))   // an alert stop: a beat of stillness between darts
  }
  const idleThen = () => { if (!move()) t = 0 }

  function step(dt: number): TrotPose {
    dt = Math.min(dt, 0.25); t += dt; sinceLand += dt   // a slow frame still covers real time (a phone at 4 fps trots at speed)
    let speed = 0, heading = yaw, wantSit = 0, sniff = 0
    if (mode === 'perch') {
      wantSit = 1
      if (t > dur) { if (landing()) go('hopDown', TROT.hopArc); else t = 0 }
    } else if (mode === 'hopDown' || mode === 'hopUp') {
      const k = clamp(t / dur, 0, 1), top = nav.perch!.y, from = mode === 'hopDown' ? { x: home.x, z: home.z } : at(ang, rad), to = mode === 'hopDown' ? at(ang, rad) : { x: home.x, z: home.z }
      const y0 = mode === 'hopDown' ? top : 0, y1 = mode === 'hopDown' ? 0 : top, py = y
      pos = { x: lerp(from.x, to.x, k), z: lerp(from.z, to.z, k) }
      y = lerp(y0, y1, k) + Math.sin(Math.PI * k) * TROT.hopArcH
      lift = clamp((y - py) / Math.max(dt, 1e-3) / 2, -1, 1)
      heading = Math.atan2(to.x - from.x, to.z - from.z)
      if (k >= 1) { y = y1; sinceLand = 0; lift = 0; if (mode === 'hopDown') { if (!move()) go('look', 1.5) } else go('perch', rand(2.5, 4.5)) }
    } else if (mode === 'trot') {
      // ease in over the first 0.12 s, slow over the last 0.22 m: a quick start, a light stop
      const v = vRun * clamp(Math.min(t / 0.12, (len - s) / 0.22 + 0.25), 0.15, 1)
      s = Math.min(len, s + v * dt); const k = s / len
      let np: { x: number; z: number }
      if (kind === 'arc') { ang = lerp(a0, a1, k); rad = lerp(r0, r1, k); np = at(ang, rad) } else np = { x: lerp(p0.x, p1.x, k), z: lerp(p0.z, p1.z, k) }
      const dx = np.x - pos.x, dz = np.z - pos.z
      if (dx * dx + dz * dz > 1e-8) heading = Math.atan2(dx, dz)
      pos = np; speed = v
      if (s >= len) { syncPolar(); afterRun() }
    } else if (mode === 'check') {
      if (t > dur) { if (!move()) go('look', 1.2) }
    } else if (mode === 'look') {
      // snappy glances: hold, flick to a new angle in ~0.15 s, hold
      lookT += dt
      if (lookT > lookHold) { lookT = 0; lookHold = rand(0.45, 0.9); lookFrom = lookYaw; lookAt = clamp(-Math.sign(lookAt || 1) * rand(0.3, 0.8), -0.85, 0.85) }
      lookYaw = lerp(lookFrom, lookAt, ease(clamp(lookT / 0.15, 0, 1)))
      if (t > dur) { lookYaw = 0; idleThen() }
    } else if (mode === 'sniff') {
      sniff = 1
      if (t > dur) idleThen()
    } else if (mode === 'sit') {
      wantSit = 1
      if (t > dur) idleThen()
    }
    if (mode !== 'look') lookYaw *= Math.exp(-dt * 8)
    sitK = lerp(sitK, wantSit && (mode === 'sit' || mode === 'perch') ? 1 : 0, 1 - Math.exp(-dt * 7))

    // the hop-trot: phase advances with distance, so it slows and stops with her feet
    let air = 0
    const run01 = clamp(speed / TROT.speed, 0, 1)
    if (mode === 'trot') {
      const before = hopPh; hopPh += (speed * dt) / (TROT.stride * (vRun > TROT.speed ? 1.2 : 1))
      if (Math.floor(hopPh) !== Math.floor(before)) sinceLand = 0
      air = Math.sin(Math.PI * (hopPh % 1))
      lift = Math.cos(Math.PI * (hopPh % 1)) * run01
      y = TROT.hopH * air * run01 ** 0.5
    } else if (mode !== 'hopDown' && mode !== 'hopUp') { lift *= Math.exp(-dt * 6); y = mode === 'perch' ? nav.perch!.y : 0 }

    yawPrev = yaw; yaw = yaw + wrap(heading - yaw) * (1 - Math.exp(-dt * TROT.turnK))
    const yawRate = wrap(yaw - yawPrev) / Math.max(dt, 1e-3)
    const sq = Math.exp(-sinceLand * TROT.squashK) * (mode === 'trot' || sinceLand < 0.3 ? 1 : 0)
    const sy = (1 + TROT.stretch * air - TROT.squash * sq) * lerp(1, TROT.sitY, sitK)
    cur = {
      x: pos.x, z: pos.z, y, yaw: yaw + lookYaw + sniff * Math.sin(t * 5) * 0.12,
      roll: clamp(-yawRate * TROT.lean, -TROT.leanMax, TROT.leanMax) * (speed > 0 ? 1 : 0.3),
      pitch: (speed > 0 ? 0.05 + 0.06 * sq : 0) + TROT.sitPitch * sitK + sniff * (TROT.sniffPitch + Math.sin(t * 13) * 0.04),
      sx: 1 / Math.sqrt(Math.max(0.5, sy)), sy, swing: run01, lift, mode,
    }
    return cur
  }
  let cur: TrotPose = { x: pos.x, z: pos.z, y, yaw, roll: 0, pitch: 0, sx: 1, sy: 1, swing: 0, lift: 0, mode }
  return { step, pose: () => cur, beats: () => beats, homes: () => homes }
}
