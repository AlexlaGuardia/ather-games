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
}
export type TrotMode = 'perch' | 'hopDown' | 'hopUp' | 'trot' | 'check' | 'look' | 'sit'
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
  speed: 1.15,      // m/s at full trot (she is a third of a keeper tall: this reads as a brisk little run)
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
}

const TAU = Math.PI * 2
const wrap = (a: number) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const ease = (t: number) => t * t * (3 - 2 * t)

/** A seeded little rng so two spirits on two planters do not move in lockstep. */
function rng(seed: number) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6 } }

export type Trot = { step: (dt: number) => TrotPose; pose: () => TrotPose; beats: () => number }

export function makeTrot(nav: SpiritNav, seed = 1): Trot {
  const R = rng(seed), { home } = nav
  const rand = (a: number, b: number) => lerp(a, b, R())
  const at = (a: number, r: number) => ({ x: home.x + Math.cos(a) * r, z: home.z + Math.sin(a) * r })
  // polar position on the ring (the run param space)
  let ang = R() * TAU, rad = nav.rMin + 0.1
  let mode: TrotMode = nav.perch ? 'perch' : 'look', t = 0, dur = nav.perch ? rand(1.0, 1.6) : 1
  let yaw = R() * TAU, yawPrev = yaw, lookYaw = 0, lookAt = 0, lookFrom = 0, lookT = 0, lookHold = 0.6
  let hopPh = 0, sinceLand = 9, runs = 0, beats = 0, sitK = 0, homing = false
  // the current run: polar from (a0,r0) to (a1,r1), length len
  let a0 = 0, a1 = 0, r0 = 0, r1 = 0, len = 1, s = 0
  // a hop between the perch and the ring point (ang, rad)
  let pos = nav.perch ? { x: home.x, z: home.z } : at(ang, rad), y = nav.perch?.y ?? 0, lift = 0

  const arcLen = (A0: number, A1: number, R0: number, R1: number) => { let L = 0, p = at(A0, R0); for (let i = 1; i <= 12; i++) { const q = at(lerp(A0, A1, i / 12), lerp(R0, R1, i / 12)); L += Math.hypot(q.x - p.x, q.z - p.z); p = q } return L }
  const arcFree = (A0: number, A1: number, R0: number, R1: number) => { const L = arcLen(A0, A1, R0, R1), n = Math.max(2, Math.ceil(L / 0.1)); for (let i = 1; i <= n; i++) { const q = at(lerp(A0, A1, i / n), lerp(R0, R1, i / n)); if (nav.blocked(q.x, q.z)) return false } return true }

  /** pick a run along the ring from where she is; false = nowhere free to go */
  function planRun(toR?: number): boolean {
    const dir = R() < 0.5 ? 1 : -1
    for (let k = 0; k < 10; k++) {
      const d = (k % 2 ? -dir : dir) * rand(0.6, 2.0) * (k < 6 ? 1 : 0.5), r = toR ?? rand(nav.rMin, nav.rMax)
      if (!arcFree(ang, ang + d, rad, r)) continue
      a0 = ang; a1 = ang + d; r0 = rad; r1 = r; len = arcLen(a0, a1, r0, r1); s = 0; return true
    }
    return false
  }
  /** a ring point she can hop down to from the perch */
  function landing(): boolean {
    for (let k = 0; k < 12; k++) { const a = R() * TAU, p = at(a, nav.rMin); if (!nav.blocked(p.x, p.z)) { ang = a; rad = nav.rMin; return true } }
    return false
  }
  function go(m: TrotMode, d: number) { mode = m; t = 0; dur = d; if (m === 'look') { lookT = 0; lookFrom = lookYaw; lookAt = rand(-0.7, 0.7) } }
  function next() {
    // after a run: chain another (a quick stop-check first), or a beat. Never more than two runs without a real beat.
    const r = R()
    if (runs >= 2 || (runs >= 1 && r < 0.55)) {
      runs = 0; beats++
      const b = R()
      if (nav.perch && b < 0.18 && planRun(nav.rMin)) { homing = true; return go('trot', 0) }
      return b < 0.62 ? go('look', rand(1.1, 2.2)) : go('sit', rand(2.2, 3.6))
    }
    go('check', rand(0.18, 0.45))
  }

  function step(dt: number): TrotPose {
    dt = Math.min(dt, 0.25); t += dt; sinceLand += dt   // a slow frame still covers real time (a phone at 4 fps trots at speed)
    let speed = 0, heading = yaw, wantSit = 0
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
      if (k >= 1) { y = y1; sinceLand = 0; lift = 0; if (mode === 'hopDown') { if (planRun()) go('trot', 0); else go('look', 1.5) } else go('perch', rand(2.5, 4.5)) }
    } else if (mode === 'trot') {
      // ease in over the first 0.12 s, slow over the last 0.22 m: a quick start, a light stop
      const v = TROT.speed * clamp(Math.min(t / 0.12, (len - s) / 0.22 + 0.25), 0.15, 1)
      s = Math.min(len, s + v * dt); const k = s / len
      ang = lerp(a0, a1, k); rad = lerp(r0, r1, k)
      const np = at(ang, rad), dx = np.x - pos.x, dz = np.z - pos.z
      if (dx * dx + dz * dz > 1e-8) heading = Math.atan2(dx, dz)
      pos = np; speed = v
      if (s >= len) {
        ang = wrap(ang); runs++
        if (homing) { homing = false; go('hopUp', TROT.hopArc) } else next()
      }
    } else if (mode === 'check') {
      if (t > dur) { if (planRun()) go('trot', 0); else go('look', 1.2) }
    } else if (mode === 'look') {
      // snappy glances: hold, flick to a new angle in ~0.15 s, hold
      lookT += dt
      if (lookT > lookHold) { lookT = 0; lookHold = rand(0.45, 0.9); lookFrom = lookYaw; lookAt = clamp(-Math.sign(lookAt || 1) * rand(0.3, 0.8), -0.85, 0.85) }
      lookYaw = lerp(lookFrom, lookAt, ease(clamp(lookT / 0.15, 0, 1)))
      if (t > dur) { lookYaw = 0; if (planRun()) go('trot', 0); else t = 0 }
    } else if (mode === 'sit') {
      wantSit = 1
      if (t > dur) { if (planRun()) go('trot', 0); else t = 0 }
    }
    if (mode !== 'look') lookYaw *= Math.exp(-dt * 8)
    sitK = lerp(sitK, wantSit && (mode === 'sit' || mode === 'perch') ? 1 : 0, 1 - Math.exp(-dt * 7))

    // the hop-trot: phase advances with distance, so it slows and stops with her feet
    let hy = 0, air = 0
    if (mode === 'trot') {
      const before = hopPh; hopPh += (speed * dt) / TROT.stride
      if (Math.floor(hopPh) !== Math.floor(before)) sinceLand = 0
      air = Math.sin(Math.PI * (hopPh % 1)); hy = TROT.hopH * air * clamp(speed / TROT.speed, 0, 1) ** 0.5
      lift = Math.cos(Math.PI * (hopPh % 1)) * clamp(speed / TROT.speed, 0, 1)
      y = hy
    } else if (mode !== 'hopDown' && mode !== 'hopUp') { lift *= Math.exp(-dt * 6); y = mode === 'perch' ? nav.perch!.y : 0 }

    const target = heading
    yawPrev = yaw; yaw = yaw + wrap(target - yaw) * (1 - Math.exp(-dt * TROT.turnK))
    const yawRate = wrap(yaw - yawPrev) / Math.max(dt, 1e-3)
    const sq = Math.exp(-sinceLand * TROT.squashK) * (mode === 'trot' || sinceLand < 0.3 ? 1 : 0)
    const sy = (1 + TROT.stretch * air - TROT.squash * sq) * lerp(1, TROT.sitY, sitK)
    cur = {
      x: pos.x, z: pos.z, y, yaw: yaw + lookYaw,
      roll: clamp(-yawRate * TROT.lean, -TROT.leanMax, TROT.leanMax) * (speed > 0 ? 1 : 0.3),
      pitch: (speed > 0 ? 0.05 + 0.06 * sq : 0) + TROT.sitPitch * sitK,
      sx: 1 / Math.sqrt(Math.max(0.5, sy)), sy, swing: clamp(speed / TROT.speed, 0, 1), lift, mode,
    }
    return cur
  }
  let cur: TrotPose = { x: pos.x, z: pos.z, y, yaw, roll: 0, pitch: 0, sx: 1, sy: 1, swing: 0, lift: 0, mode }
  return { step, pose: () => cur, beats: () => beats }
}
