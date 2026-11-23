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
  /** M110 s1: the training pieces on the plot (re-read at each pick). A PARTY spirit may choose one as a beat on her own. */
  toys?: () => Toy[]
}
/** M110 s1: a training piece: where it stands, `ax/az` = the unit axis she plays ACROSS it (a hurdle: over the rail), its stat */
export type Toy = { id: string; x: number; z: number; ax: number; az: number; stat: string
  /** M110 s2: HOW she plays at it (default 'leap'): leap = bounds across it (AGI hurdle); shove = lunges into it from one side,
   *  leans in, backs off facing it (PWR); guard = a low wide sidestep across the gap between its posts, facing out (GRD);
   *  laps = runs rings round it (VIG). `size` = the piece's play measure (shove: half its depth; guard: half the sidestep;
   *  laps: the ring's radius). */
  kind?: PlayKind; size?: number }
export type PlayKind = 'leap' | 'shove' | 'guard' | 'laps'
export type TrotMode = 'perch' | 'hopDown' | 'hopUp' | 'trot' | 'check' | 'look' | 'sit' | 'sniff' | 'tilt' | 'follow' | 'happy' | 'play'
export type TrotPose = {
  x: number; z: number      // world
  y: number                 // lift above the ground under her (hop, perch)
  yaw: number               // world yaw; the model faces +z at yaw 0
  roll: number; pitch: number
  sx: number; sy: number    // squash/stretch (sx = x and z)
  swing: number             // 0..1 how hard the tail/ears swing (running)
  lift: number              // vertical velocity-ish, -1..1 (the tail lags it)
  mode: TrotMode
  tilt: number              // -1..1 head tilt (M102 Manalotl): spirit-model bends the head by it, or tips the body
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
  // M102 (Manalotl wire-in): the beats became dials too, so each species carries its own manner (spirit-models.ts).
  chain: 0.62,      // chance a run ends in a real beat (else a quick alert stop and another run)
  checkS: [0.3, 0.75] as [number, number],
  beat: { look: 0.6, sniff: 0.22, sit: 0.18, tilt: 0 },   // beat weights
  lookS: [1.2, 2.4] as [number, number], sniffS: [0.8, 1.5] as [number, number], sitS: [1.8, 3.2] as [number, number], tiltS: [1.8, 3.0] as [number, number],
  glance: 0.15,     // s to flick to a new look angle (snappy)
  glanceHold: [0.45, 0.9] as [number, number], glanceMax: 0.85,
  tiltK: 4,         // head-tilt ease /s
  lookTilt: 0,      // how much tilt a look-round carries
  // M109 s2 FED: the happy beat after the keeper feeds her (cheer()): a few little hops on the spot, facing the keeper, a
  // wiggle. Pure joy, no reward loop: it changes nothing about how she roams or follows afterwards.
  happyHops: 4, happyHop: 0.3, happyH: 0.12, happyWig: 0.14,
  // M110 s1: how much each training stat's pieces draw her (x PLAY.chance when she picks a run). The garden spirit carries no
  // temperament yet (spirit-sheet.ts), so the lean is the species' MANNER: 1 = no lean. Jin's.
  toyLean: { pwr: 1, grd: 1, agi: 1, vig: 1 } as Record<string, number>,
  playV: 1.3, playH: 0.2,   // M110 s1: m/s across a training piece, and the bound's height over it
}
export type TrotDials = typeof TROT

// ── M109 s1 FOLLOW (canon RULED 8b45c92: a keeper's spirits may walk with them anywhere in the Ather): she trails the keeper
// at a short distance with her own trot. Not a species manner, so not a dial: every spirit keeps the same slot. ─────────
export const FOLLOW = {
  slot: 1.7,        // m from the keeper she settles at (behind/beside: wherever she already is round them)
  far: 2.1,         // past this she sets off again
  keep: 1.2,        // never nearer than this (she never blocks the keeper's way): closer and she steps back out
  vMax: 9,          // m/s cap on the catch-up gait (the keeper sprints 6.5)
  catchK: 2.4,      // extra m/s per metre she is behind the slot
  settle: 0.12,     // m from the slot that counts as there
  sitAfter: 4,      // s standing by before she sits
}
// ── M109 s4 THE PARTY KEEPS NEAR (Magii RULED 0aee8bd/9b4dfe8: the party = up to 8 the keeper has asked along; they keep
// near the keeper in the garden; every other bloomed spirit roams the garden by temperament). Loose company, NOT Follow: she
// keeps her own runs and beats (look / sniff / sit), only her runs are picked round the keeper instead of round her planter,
// and when the keeper walks off she drifts back on a longer, quicker leg. ────────────────────────────────────────────────
export const NEAR = {
  r: 8,             // m: the loose radius round the keeper she wanders within (the check asserts against it)
  keep: 1.6,        // m: a run never ends nearer the keeper than this (that close is Follow's job)
  leg: 6,           // m: the longest drift-back leg (she re-reads where the keeper is after each)
  driftK: 1.3,      // x her dash on a drift-back leg (she hurries a little, never Follow's catch-up)
  slack: 1.25,      // past r * slack a beat is cut short (after beatMin) and she sets off back
  beatMin: 0.5,     // s of a beat she always keeps (no twitchy stop-start)
  pass: 1,          // m: a run never passes nearer the keeper than this
}
// ── M110 s1 PLAY AT A TRAINING PIECE (canon RULED 3a77c87: party spirits use it AS THEY PLEASE; play, never drill). When a party
// spirit picks her next run she MAY choose a piece near the keeper instead (a weighted chance, never forced; a rest after each
// play so it stays one beat among her others), runs to one side of it and bounds back and forth across it for a few seconds.
// A finished play calls onPlayed (spirit-stats.ts adds the gain). Walked off, called, fed or asked to follow = the play just
// stops, no gain and nothing lost. ────────────────────────────────────────────────────────────────────────────────────────
export const PLAY = {
  chance: 0.4,      // chance a run picked in the party goes to a piece (x the species' toyLean), when one is in reach
  rest: 20,         // s after a play before she picks a piece again
  reach: 12,        // m: pieces further from her than this are not considered
  side: 0.75,       // m either side of the piece's centre she bounds between
  playS: [3.5, 5.5] as [number, number],   // s of play (she finishes the bound she is on)
  pause: 0.22,      // s she turns at each end
  // M110 s2 the other three plays (x her playV, so the Manalotl stays a slow flow and the Vulnyx quick). Jin's.
  shoveIn: 0.9, shoveOut: 0.4, shoveBack: 0.5, push: 0.5,   // lunge speed, back-off speed (facing it), m she backs off, s leaning in
  guardV: 0.55, guardHold: 0.35, crouch: 0.86,              // sidestep speed, s held at each post, her height while braced
  lapV: 1.15,                                                // speed round the ring (she ends at a lap's end once playS has run)
}
/** distance from point k to the segment a-b */
function segDist(a: { x: number; z: number }, b: { x: number; z: number }, k: { x: number; z: number }) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz, t = L2 > 0 ? Math.max(0, Math.min(1, ((k.x - a.x) * dx + (k.z - a.z) * dz) / L2)) : 0
  return Math.hypot(a.x + dx * t - k.x, a.z + dz * t - k.z)
}
/** where the keeper is (world xz; yaw 0 looks down -z) */
export type FollowTarget = () => { x: number; z: number; yaw: number }

const TAU = Math.PI * 2
const wrap = (a: number) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const ease = (t: number) => t * t * (3 - 2 * t)

/** A seeded little rng so two spirits on two planters do not move in lockstep. */
function rng(seed: number) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6 } }

export type Trot = { step: (dt: number) => TrotPose; pose: () => TrotPose; beats: () => number; homes: () => number
  /** M109: walk with the keeper (a target), or null = back to her own roam */
  follow: (to: FollowTarget | null) => void
  /** M109 s2: she was fed: the happy beat (facing `to`, the keeper), then back to what she was doing (perch / follow / roam) */
  cheer: (to: FollowTarget | null) => void; cheers: () => number
  /** M109 s3: called home from the grimoire: she walks to `to` (the keeper) on her own legs, settles by them, sits a moment,
   *  then is free again (her own roam, or back to following if she was) */
  call: (to: FollowTarget) => void; calling: () => boolean
  /** M109 s4: in the party: she keeps near `to` (the keeper) in loose company, or null = her own roam round home */
  near: (to: FollowTarget | null) => void; nearing: () => boolean
  /** M110 s1: called when a play at a training piece FINISHES (toy id, its stat); plays() = how many so far, playing() = the toy id */
  onPlayed: (f: ((id: string, stat: string) => void) | null) => void; plays: () => number; playing: () => string | null
  /** M110 s2: how braced she is (0..1): the shove's lean into the stone, the guard's crouch */
  braced: () => number }

export function makeTrot(nav: SpiritNav, seed = 1, dials?: Partial<TrotDials>): Trot {
  const D: TrotDials = { ...TROT, ...dials, beat: { ...TROT.beat, ...dials?.beat }, toyLean: { ...TROT.toyLean, ...dials?.toyLean } }
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
  let tilt = 0, tiltAt = 0, tiltSwap = 0
  let hopPh = 0, sinceLand = 9, runs = 0, beats = 0, homes = 0, sitK = 0, homing = false, outFirst = !!roam
  // the current run: an ARC round home (polar a0,r0 -> a1,r1) or a straight LINE (p0 -> p1); length len, speed vRun
  let kind: 'arc' | 'line' = 'arc', a0 = 0, a1 = 0, r0 = 0, r1 = 0, p0 = { x: 0, z: 0 }, p1 = { x: 0, z: 0 }, len = 1, s = 0, vRun = D.speed
  let pos = nav.perch ? { x: home.x, z: home.z } : at(ang, rad), y = nav.perch?.y ?? 0, lift = 0
  // M109 follow: the target, the keeper's smoothed speed, whether she is on her way to the slot, how long she has stood by
  let followTo: FollowTarget | null = null, kPrev: { x: number; z: number } | null = null, kV = 0, fGo = false, fIdle = 0
  // M109 s2 the happy beat: who she faces, where she hops from (the perch or the ground), which hop she is on, a cheer that
  // came mid perch-hop (starts when she lands), how many cheers so far (the probe)
  let happyTo: FollowTarget | null = null, happyBase = 0, happyBack = false, happyN = -1, happyY = 0, cheerPending: { to: FollowTarget | null } | null = null, cheers = 0
  // M109 s3 call home: on her way to the keeper (the follow walk), and what she was following before (restored on arrival)
  let calling = false, callPrev: FollowTarget | null = null
  // M109 s4 the party anchor: who she keeps near (null = not in the party)
  let nearTo: FollowTarget | null = null
  // M110 s1 play: the piece she is heading to / playing at, the two ends she bounds between, which end she is going to, the
  // turn pause left, how long since her last play (starts rested), plays so far, who hears a finished play
  let toy: Toy | null = null, toyA = { x: 0, z: 0 }, toyB = { x: 0, z: 0 }, toyEnd = 1, toyPause = 0, toyRest = PLAY.rest, plays = 0, playAir = 0, playPh = 0
  let played: ((id: string, stat: string) => void) | null = null
  // M110 s2: the play's facing (shove / guard), the brace (0..1, shove lean + guard crouch), the lap (centre angle, swept, way round)
  let toyFace = 0, brace = 0, lapA = 0, lapSwept = 0, lapDir = 1
  const dK = (k: { x: number; z: number }) => Math.hypot(pos.x - k.x, pos.z - k.z)

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
      kind = 'arc'; a0 = ang; a1 = ang + d; r0 = rad; r1 = r; len = arcLen(a0, a1, r0, r1); s = 0; vRun = D.speed; return true
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
      if (planLine(to, D.dash * rand(0.85, 1.1))) return true
    }
    return false
  }
  /** M109 s4: a run picked round the keeper: within NEAR.r a wander to another spot round them (never nearer than keep);
   *  past it a drift-back leg (capped at NEAR.leg, quicker) toward a spot on her side of them. Every leg must run free. */
  function planNear(): boolean {
    if (!nearTo) return false
    const k = nearTo(), N = NEAR, dk = dK(k), back = dk > N.r, b = Math.atan2(pos.z - k.z, pos.x - k.x), maxLeg = roam?.maxLeg ?? 4.5
    for (let i = 0; i < 28; i++) {
      const a = back ? b + rand(-1, 1) * (i < 14 ? 0.9 : 2.2) : rand(0, TAU), r = rand(N.keep + 0.5, N.r * (back ? 0.6 : 0.85))
      let to = { x: k.x + Math.cos(a) * r, z: k.z + Math.sin(a) * r }
      const L = Math.hypot(to.x - pos.x, to.z - pos.z), cap = back ? N.leg * (i < 20 ? 1 : 0.5) : maxLeg
      if (!back && L < 0.8) continue
      if (L > cap) to = { x: pos.x + (to.x - pos.x) * cap / L, z: pos.z + (to.z - pos.z) * cap / L }
      if (segDist(pos, to, k) < N.pass && dk >= N.pass) continue   // she runs round the keeper, never through their feet
      if (planLine(to, D.dash * (back ? N.driftK : rand(0.85, 1.1)))) return true
    }
    return back && planRound(k)
  }
  /** M109 s4: no straight leg gets her back (a hedge, a room between): a coarse grid search (0.7 m cells over the box round
   *  her and the keeper) for a way round, then a leg to the furthest point along it she can run to straight. */
  function planRound(k: { x: number; z: number }): boolean {
    const c = 0.7, m = 12, x0 = Math.min(pos.x, k.x) - m, z0 = Math.min(pos.z, k.z) - m
    const W = Math.min(160, Math.ceil((Math.max(pos.x, k.x) + m - x0) / c)), H = Math.min(160, Math.ceil((Math.max(pos.z, k.z) + m - z0) / c))
    const cx = (i: number) => x0 + (i + 0.5) * c, cz = (j: number) => z0 + (j + 0.5) * c
    const ok = new Int8Array(W * H)   // 0 unknown, 1 free, 2 blocked
    const fr = (i: number, j: number) => { const n = j * W + i; if (!ok[n]) ok[n] = free(cx(i), cz(j)) ? 1 : 2; return ok[n] === 1 }
    const si = clamp(Math.floor((pos.x - x0) / c), 0, W - 1), sj = clamp(Math.floor((pos.z - z0) / c), 0, H - 1), r2 = (NEAR.r * 0.6) ** 2
    const from = new Int32Array(W * H).fill(-1), q = [sj * W + si]; from[q[0]] = q[0]
    let goal = -1
    for (let h = 0; h < q.length && goal < 0; h++) {
      const n = q[h], i = n % W, j = (n / W) | 0
      if ((cx(i) - k.x) ** 2 + (cz(j) - k.z) ** 2 < r2 && n !== q[0]) { goal = n; break }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue
        const nn = b * W + a; if (from[nn] >= 0 || !fr(a, b) || (di && dj && !(fr(i + di, j) && fr(i, j + dj)))) continue
        from[nn] = n; q.push(nn)
      }
    }
    if (goal < 0) return false
    const path: { x: number; z: number }[] = []
    for (let n = goal; n !== q[0]; n = from[n]) path.unshift({ x: cx(n % W), z: cz((n / W) | 0) })
    for (let i = path.length - 1; i >= 0; i--) { const p = path[i]; if (Math.hypot(p.x - pos.x, p.z - pos.z) <= NEAR.leg && planLine(p, D.dash * NEAR.driftK)) return true }
    return false
  }
  /** M110 s1: maybe a training piece instead of a plain run: one in reach (of her, and within NEAR.r of the keeper), weighted
   *  by her toyLean, its two ends free and the bound between them clear. A run to the nearer end; the play starts on arrival. */
  function planToy(): boolean {
    if (!nav.toys || !nearTo || toyRest < PLAY.rest) return false
    const k = nearTo(), list = nav.toys().filter(t => Math.hypot(t.x - pos.x, t.z - pos.z) <= PLAY.reach && Math.hypot(t.x - k.x, t.z - k.z) <= NEAR.r)
    if (!list.length) return false
    const w = list.map(t => D.toyLean[t.stat] ?? 1), sum = w.reduce((a, b) => a + b, 0)
    let c = R() * sum, i = 0; while (i < list.length - 1 && c > w[i]) { c -= w[i]; i++ }
    const t = list[i]
    if (R() >= Math.min(0.9, PLAY.chance * w[i])) return false
    const ends = toyEnds(t); if (!ends) return false
    const [A, B] = ends
    if (Math.hypot(A.x - pos.x, A.z - pos.z) < 0.05) { toy = t; toyA = A; toyB = B; return startPlay() }
    if (!planLine(A, D.dash)) return false
    toy = t; toyA = A; toyB = B; return true
  }
  /** M110 s2: where a play at `t` starts (A, the nearer) and its other end (B), or null when the ground it needs is not free */
  function toyEnds(t: Toy): [{ x: number; z: number }, { x: number; z: number }] | null {
    const k = t.kind ?? 'leap', sz = t.size ?? 0.3
    const near2 = (e1: { x: number; z: number }, e2: { x: number; z: number }) => Math.hypot(e1.x - pos.x, e1.z - pos.z) <= Math.hypot(e2.x - pos.x, e2.z - pos.z) ? [e1, e2] as const : [e2, e1] as const
    const along = (u: number, v: number, d: number) => ({ x: t.x + u * d, z: t.z + v * d })
    if (k === 'shove') {   // her side of it: she starts back off it and lunges to touching it (the stone itself is the box she leans on)
      const sd = Math.sign((pos.x - t.x) * t.ax + (pos.z - t.z) * t.az) || 1
      const A = along(t.ax * sd, t.az * sd, sz + 0.12 + PLAY.shoveBack), B = along(t.ax * sd, t.az * sd, sz + 0.12)
      return free(A.x, A.z) ? [A, B] : null
    }
    if (k === 'laps') {   // the nearest point of the ring; the whole ring must be free
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; if (!free(t.x + Math.cos(a) * sz, t.z + Math.sin(a) * sz)) return null }
      const a = Math.atan2(pos.z - t.z, pos.x - t.x), A = { x: t.x + Math.cos(a) * sz, z: t.z + Math.sin(a) * sz }
      return [A, { x: 2 * t.x - A.x, z: 2 * t.z - A.z }]
    }
    // leap = across its depth (local z); guard = across the gap between its posts (local x = (az, -ax))
    const [e1, e2] = k === 'guard' ? [along(t.az, -t.ax, sz), along(-t.az, t.ax, sz)] : [along(t.ax, t.az, PLAY.side), along(-t.ax, -t.az, PLAY.side)]
    const [A, B] = near2(e1, e2)
    return free(B.x, B.z) && lineFree(A, B) ? [A, B] : null
  }
  function startPlay() {
    toyEnd = 1; toyPause = 0; playAir = 0; lapSwept = 0
    if (toy) {
      const c = toy, kd = c.kind ?? 'leap'
      // shove: she faces the stone; guard: she faces OUT, away from the keeper (keeping the gap for him); laps: which way round
      if (kd === 'shove') toyFace = Math.atan2(c.x - pos.x, c.z - pos.z)
      if (kd === 'guard') { const k = nearTo?.() ?? home, sd = Math.sign((c.x - k.x) * c.ax + (c.z - k.z) * c.az) || 1; toyFace = Math.atan2(c.ax * sd, c.az * sd) }
      if (kd === 'laps') { lapA = Math.atan2(pos.z - c.z, pos.x - c.x); lapDir = R() < 0.5 ? 1 : -1 }
    }
    go('play', rand(...PLAY.playS)); return true
  }
  /** a short straight hop between two ring points (a chord that misses the planter): breaks up the circling near home */
  function planChord(): boolean {
    for (let k = 0; k < 10; k++) { const a = ang + (R() < 0.5 ? 1 : -1) * rand(0.5, 1.4); if (planLine(at(a, rand(nav.rMin + 0.1, nav.rMax)), D.speed * rand(1, 1.25))) return true }
    return false
  }
  /** head home: a straight line to the free ring point nearest her bearing, then (homing) hop up */
  function planHome(): boolean {
    const b = Math.atan2(pos.z - home.z, pos.x - home.x)
    for (let k = 0; k < 16; k++) { const a = b + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35; if (planLine(at(a, nav.rMin), D.dash * 0.9)) return true }
    return false
  }
  /** a landing point on the ring to hop down to from the perch */
  function landing(): boolean {
    for (let k = 0; k < 12; k++) { const a = R() * TAU, p = at(a, nav.rMin); if (free(p.x, p.z)) { ang = a; rad = nav.rMin; return true } }
    return false
  }
  function go(m: TrotMode, d: number) { mode = m; t = 0; dur = d; if (m === 'look') { lookT = 0; lookFrom = lookYaw; lookAt = rand(-0.7, 0.7) } else if (m === 'tilt') { tiltAt = R() < 0.5 ? 1 : -1; tiltSwap = rand(0.4, 0.7) * d } }
  /** the next run from a standstill. true = she is off. */
  function move(): boolean {
    toy = null
    if (followTo) { fGo = false; fIdle = 0; go('follow', 0); return true }
    if (nearTo && planToy()) return mode === 'play' ? true : run()   // M110 s1: a training piece, her choice, sometimes
    if (nearTo && planNear()) return run()   // M109 s4: the party picks her runs round the keeper (else the plain roam below)
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
    if (toy && Math.hypot(pos.x - toyA.x, pos.z - toyA.z) < 0.15) { runs = 0; beats++; startPlay(); return }   // M110 s1: at the piece
    toy = null
    if (homing && dHome(pos) <= nav.rMin + 0.25) { homing = false; homes++; return go('hopUp', D.hopArc) }
    homing = false
    if (runs >= 2 || R() < D.chain) {
      runs = 0; beats++
      const b = R()
      if (nav.perch && dHome(pos) <= nav.rMax + 0.25 && b < 0.15 && (!nearTo || dHome(nearTo()) < NEAR.r) && planArc(nav.rMin)) { homing = true; return run() }
      // the beat weights are per species (D.beat): the Vulnyx mostly alert look-rounds, a sniff, now and then a sit; the
      // Manalotl looks long, tilts her head, lies down. Sniff needs the roam (out on the grass), else its share is a sit.
      const W = D.beat, sum = W.look + W.sniff + W.sit + W.tilt, c = b * sum
      return c < W.look ? go('look', rand(...D.lookS)) : c < W.look + W.sniff ? (roam ? go('sniff', rand(...D.sniffS)) : go('sit', rand(...D.sitS)))
        : c < W.look + W.sniff + W.sit ? go('sit', rand(...D.sitS)) : go('tilt', rand(...D.tiltS))
    }
    go('check', rand(...D.checkS))   // an alert stop: a beat of stillness between darts
  }
  const idleThen = () => { if (!move()) t = 0 }

  function step(dt: number): TrotPose {
    dt = Math.min(dt, 0.25); t += dt; sinceLand += dt; toyRest += dt   // a slow frame still covers real time (a phone at 4 fps trots at speed)
    let speed = 0, heading = yaw, wantSit = 0, sniff = 0, happyAir = 0
    if (cheerPending && mode !== 'hopDown' && mode !== 'hopUp') { const c = cheerPending; cheerPending = null; startHappy(c.to) }
    // M109 s4: in the party and the keeper has walked off: a beat (or her perch) is cut short and she sets off back
    if (nearTo && !followTo && t > NEAR.beatMin && (mode === 'check' || mode === 'look' || mode === 'sniff' || mode === 'sit' || mode === 'tilt')) {
      const k = nearTo()
      if (dK(k) > NEAR.r * NEAR.slack) { lookYaw = 0; tiltAt = 0; if (!move()) t = 0 }
    }
    if (mode === 'perch') {
      wantSit = 1
      if (t > dur || followTo || (nearTo && t > NEAR.beatMin && dHome(nearTo()) > NEAR.r)) { if (landing()) go('hopDown', D.hopArc); else t = 0 }
    } else if (mode === 'hopDown' || mode === 'hopUp') {
      const k = clamp(t / dur, 0, 1), top = nav.perch!.y, from = mode === 'hopDown' ? { x: home.x, z: home.z } : at(ang, rad), to = mode === 'hopDown' ? at(ang, rad) : { x: home.x, z: home.z }
      const y0 = mode === 'hopDown' ? top : 0, y1 = mode === 'hopDown' ? 0 : top, py = y
      pos = { x: lerp(from.x, to.x, k), z: lerp(from.z, to.z, k) }
      y = lerp(y0, y1, k) + Math.sin(Math.PI * k) * D.hopArcH
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
      if (lookT > lookHold) { lookT = 0; lookHold = rand(...D.glanceHold); lookFrom = lookYaw; lookAt = clamp(-Math.sign(lookAt || 1) * rand(0.3, 0.8), -D.glanceMax, D.glanceMax) }
      lookYaw = lerp(lookFrom, lookAt, ease(clamp(lookT / D.glance, 0, 1)))
      if (t > dur) { lookYaw = 0; idleThen() }
    } else if (mode === 'sniff') {
      sniff = 1
      if (t > dur) idleThen()
    } else if (mode === 'sit') {
      wantSit = 1
      if (t > dur) idleThen()
    } else if (mode === 'follow' && followTo) {
      // M109: trail the keeper. The slot = FOLLOW.slot from the keeper on the side she is already on (so she trails behind
      // a walking keeper and stands beside a still one), turned round the keeper to the first free spot. Off she goes past
      // `far` (or nearer than `keep`), with a catch-up gait that adds the keeper's own speed; every step must land free.
      const k = followTo(), F = FOLLOW
      if (kPrev) { const kv = Math.hypot(k.x - kPrev.x, k.z - kPrev.z) / Math.max(dt, 1e-3); if (kv < 30) kV = lerp(kV, kv, 1 - Math.exp(-dt * 5)) }
      kPrev = { x: k.x, z: k.z }
      const d = Math.hypot(pos.x - k.x, pos.z - k.z)
      if (!fGo && (d > F.far || d < F.keep)) fGo = true
      if (fGo) {
        const b = d > 0.05 ? Math.atan2(pos.z - k.z, pos.x - k.x) : Math.atan2(Math.cos(k.yaw), Math.sin(k.yaw))
        let goal: { x: number; z: number } | null = null
        for (let i = 0; i < 13 && !goal; i++) { const a = b + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.45, g = { x: k.x + Math.cos(a) * F.slot, z: k.z + Math.sin(a) * F.slot }; if (free(g.x, g.z)) goal = g }
        const tg = goal ?? { x: k.x, z: k.z }, gd = Math.hypot(tg.x - pos.x, tg.z - pos.z)
        if (goal && gd < F.settle) fGo = false
        else {
          const v = clamp(D.speed * 0.8 + kV + Math.max(0, d - F.slot) * F.catchK, D.speed * 0.5, F.vMax), stp = Math.min(gd - (goal ? 0 : F.slot), v * dt)
          const h0 = Math.atan2(tg.x - pos.x, tg.z - pos.z)
          let moved = false
          if (stp > 1e-4) for (let i = 0; i < 9 && !moved; i++) {
            const h = h0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.4, nx = pos.x + Math.sin(h) * stp, nz = pos.z + Math.cos(h) * stp
            if (free(nx, nz) && (i === 0 || Math.hypot(nx - k.x, nz - k.z) >= Math.min(d, F.keep))) { pos = { x: nx, z: nz }; heading = h; speed = v; vRun = v; moved = true }
          }
          if (!moved && !goal) fGo = false
        }
        fIdle = 0
      } else {
        fIdle += dt
        heading = Math.atan2(k.x - pos.x, k.z - pos.z)   // stood by: she watches the keeper
        if (fIdle > F.sitAfter) wantSit = 1
        // M109 s3: called home and arrived: a moment sat by the keeper, then she is free again
        if (calling && fIdle > 0.8) { calling = false; followTo = callPrev; callPrev = null; if (!followTo) { syncPolar(); go('sit', rand(...D.sitS)) } }
      }
    } else if (mode === 'happy') {
      // M109 s2: little hops on the spot, turned to the keeper; a squash on each landing (sinceLand), then back
      if (happyTo) { const k = happyTo(); if (Math.hypot(k.x - pos.x, k.z - pos.z) > 0.05) heading = Math.atan2(k.x - pos.x, k.z - pos.z) }
      const ph = Math.min(t / D.happyHop, D.happyHops), n = Math.floor(ph)
      if (n !== happyN) { if (happyN >= 0) sinceLand = 0; happyN = n }
      happyAir = ph >= D.happyHops ? 0 : Math.sin(Math.PI * (ph % 1))
      happyY = happyBase + D.happyH * happyAir
      if (t > dur) {
        happyY = happyBase
        if (happyBack) go('perch', rand(2.5, 4.5))
        else if (followTo) { fGo = false; fIdle = 0; go('follow', 0) }
        else go('check', rand(...D.checkS))
      }
    } else if (mode === 'play' && toy) {
      // M110 s1/s2: play at the piece, its own way (toy.kind). Every kind ends where it may (an end / a lap's end) once t > dur.
      const k = nearTo?.(), kd = toy.kind ?? 'leap'
      const finish = () => { const done = toy!; toy = null; plays++; toyRest = 0; brace = 0; syncPolar(); played?.(done.id, done.stat); go('check', rand(...D.checkS)) }
      if (followTo || !nearTo || (k && dK(k) > NEAR.r * NEAR.slack)) { toy = null; brace = 0; syncPolar(); if (!move()) go('check', rand(...D.checkS)) }
      else if (kd === 'laps') {
        // rings round it at a steady run, leaning into the turn; ends at the end of a lap once her play time has run
        const r = toy.size ?? 1, w = D.playV * PLAY.lapV / r * dt
        lapA += lapDir * w; lapSwept += w
        pos = { x: toy.x + Math.cos(lapA) * r, z: toy.z + Math.sin(lapA) * r }
        heading = Math.atan2(-Math.sin(lapA) * lapDir, Math.cos(lapA) * lapDir); speed = D.playV * PLAY.lapV
        const before = playPh; playPh += speed * dt / D.stride; if (Math.floor(playPh) !== Math.floor(before)) sinceLand = 0
        playAir = Math.sin(Math.PI * (playPh % 1)) * 0.5
        if (t > dur && lapSwept >= TAU && Math.floor(lapSwept / TAU) > Math.floor((lapSwept - w) / TAU)) finish()   // at a lap's end
      }
      else if (toyPause > 0) {
        toyPause -= dt; playAir = 0
        heading = kd === 'shove' || kd === 'guard' ? toyFace : Math.atan2((toyEnd ? toyB : toyA).x - pos.x, (toyEnd ? toyB : toyA).z - pos.z)
        if (kd === 'shove') brace = toyEnd === 0 ? Math.min(1, brace + dt * 6) : Math.max(0, brace - dt * 3)   // leaning in at the stone
      }
      else {
        const to = toyEnd ? toyB : toyA, from = toyEnd ? toyA : toyB, L = Math.hypot(to.x - from.x, to.z - from.z), d = Math.hypot(to.x - pos.x, to.z - pos.z)
        const v = kd === 'shove' ? D.playV * (toyEnd ? PLAY.shoveIn : PLAY.shoveOut) : kd === 'guard' ? D.playV * PLAY.guardV : D.playV
        const stp = Math.min(d, v * dt)
        if (d > 1e-4) pos = { x: pos.x + (to.x - pos.x) * stp / d, z: pos.z + (to.z - pos.z) * stp / d }
        speed = v; playPh = clamp(1 - (d - stp) / Math.max(L, 0.05), 0, 1)
        if (kd === 'leap') { if (d > 1e-4) heading = Math.atan2(to.x - pos.x, to.z - pos.z); playAir = Math.sin(Math.PI * playPh) }
        else { heading = toyFace; playAir = 0; brace = kd === 'guard' ? Math.min(1, brace + dt * 5) : Math.max(0, brace - dt * 3) }   // shove backs off FACING the stone; guard sidesteps facing out
        if (d - stp < 1e-3) {
          sinceLand = 0; playAir = 0
          if (t > dur && (kd !== 'shove' || toyEnd === 0)) finish()   // a shove ends backed off (at A), never leaning in
          else { toyEnd = 1 - toyEnd; toyPause = kd === 'shove' ? (toyEnd === 0 ? PLAY.push : PLAY.pause) : kd === 'guard' ? PLAY.guardHold : PLAY.pause }
        }
      }
    } else if (mode === 'play') { go('check', rand(...D.checkS))   // a play with no piece (cut elsewhere): back to her roam
    } else if (mode === 'tilt') {
      // the head tilt (Manalotl canon: "eternal smile, wide eyes, head tilt"): over to one side, hold, maybe the other way
      if (tiltSwap > 0 && t > tiltSwap) { tiltSwap = 0; if (R() < 0.5) tiltAt = -tiltAt }
      if (t > dur) { tiltAt = 0; idleThen() }
    }
    // tilt eases (slow, a curious beat, not a twitch); a look can carry a little of it (D.lookTilt) toward the glance side
    const tiltWant = mode === 'tilt' ? tiltAt : mode === 'look' ? clamp(lookYaw / 0.6, -1, 1) * D.lookTilt : 0
    tilt = lerp(tilt, tiltWant, 1 - Math.exp(-dt * D.tiltK))
    if (mode !== 'look') lookYaw *= Math.exp(-dt * 8)
    sitK = lerp(sitK, wantSit && (mode === 'sit' || mode === 'perch' || mode === 'follow') ? 1 : 0, 1 - Math.exp(-dt * 7))

    // the hop-trot: phase advances with distance, so it slows and stops with her feet
    let air = 0
    const run01 = clamp(speed / D.speed, 0, 1)
    if (mode === 'trot' || (mode === 'follow' && speed > 0)) {
      // M109: a catch-up past her dash lengthens the stride (bounds, not a frantic patter); a plain trot never gets there
      const before = hopPh; hopPh += (speed * dt) / (D.stride * (vRun > D.speed ? 1.2 : 1) * Math.max(1, speed / (D.dash * 1.2)))
      if (Math.floor(hopPh) !== Math.floor(before)) sinceLand = 0
      air = Math.sin(Math.PI * (hopPh % 1))
      lift = Math.cos(Math.PI * (hopPh % 1)) * run01
      y = D.hopH * air * run01 ** 0.5
    } else if (mode === 'play') { air = playAir; lift = playAir > 0 ? Math.cos(Math.PI * playPh) : 0; y = (toy?.kind ?? 'leap') === 'leap' ? D.playH * playAir : D.hopH * 0.5 * playAir }
    else if (mode === 'happy') { air = happyAir; lift = Math.cos(Math.PI * (Math.min(t / D.happyHop, D.happyHops) % 1)) * (happyAir > 0 ? 1 : 0); y = happyY }
    else if (mode !== 'hopDown' && mode !== 'hopUp') { lift *= Math.exp(-dt * 6); y = mode === 'perch' ? nav.perch!.y : 0 }

    yawPrev = yaw; yaw = yaw + wrap(heading - yaw) * (1 - Math.exp(-dt * D.turnK))
    const yawRate = wrap(yaw - yawPrev) / Math.max(dt, 1e-3)
    const sq = Math.exp(-sinceLand * D.squashK) * (mode === 'trot' || mode === 'play' || (mode === 'follow' && speed > 0) || sinceLand < 0.3 ? 1 : 0)
    if (mode !== 'play') brace = Math.max(0, brace - dt * 4)
    const sy = (1 + D.stretch * air - D.squash * sq) * lerp(1, D.sitY, sitK) * lerp(1, PLAY.crouch, brace)   // M110 s2: braced = low
    cur = {
      x: pos.x, z: pos.z, y, yaw: yaw + lookYaw + sniff * Math.sin(t * 5) * 0.12,
      roll: clamp(-yawRate * D.lean, -D.leanMax, D.leanMax) * (speed > 0 ? 1 : 0.3) + (mode === 'happy' ? Math.sin(t * Math.PI * 2 / D.happyHop / 2) * D.happyWig : 0),
      pitch: (speed > 0 ? 0.05 + 0.06 * sq : 0) + D.sitPitch * sitK + (mode === 'play' && toy?.kind === 'shove' ? 0.18 * brace : 0) + sniff * (D.sniffPitch + Math.sin(t * 13) * 0.04),
      sx: 1 / Math.sqrt(Math.max(0.5, sy)), sy, swing: run01, lift, mode, tilt,
    }
    return cur
  }
  let cur: TrotPose = { x: pos.x, z: pos.z, y, yaw, roll: 0, pitch: 0, sx: 1, sy: 1, swing: 0, lift: 0, mode, tilt: 0 }
  function follow(to: FollowTarget | null) {
    if (to) toy = null
    calling = false; callPrev = null
    followTo = to; kPrev = null; kV = 0; outFirst = false
    if (to) { homing = false; if (mode !== 'perch' && mode !== 'hopDown' && mode !== 'hopUp') { fGo = false; fIdle = 0; go('follow', 0) } }
    else if (mode === 'follow') { syncPolar(); go('check', rand(...D.checkS)) }   // Stay: back to her own roam from where she stands
  }
  function startHappy(to: FollowTarget | null) {
    happyTo = to; happyBack = mode === 'perch'; happyBase = happyBack ? nav.perch!.y : 0; happyN = -1; happyY = happyBase
    toy = null; if (mode === 'trot' || mode === 'play') syncPolar()   // a run (or a play) cut short: her ring param catches up with where she stands
    cheers++; go('happy', D.happyHop * D.happyHops + 0.15)
  }
  function cheer(to: FollowTarget | null) {
    if (mode === 'hopDown' || mode === 'hopUp') cheerPending = { to }   // mid perch-hop: the joy waits for her feet
    else startHappy(to)
  }
  function call(to: FollowTarget) {
    if (!calling) callPrev = followTo
    toy = null; calling = true; followTo = to; kPrev = null; kV = 0; outFirst = false; homing = false
    if (mode !== 'perch' && mode !== 'hopDown' && mode !== 'hopUp') { fGo = true; fIdle = 0; go('follow', 0) }   // on a perch: she hops down first
  }
  function near(to: FollowTarget | null) { nearTo = to; if (to) outFirst = false }
  return { step, pose: () => cur, beats: () => beats, homes: () => homes, follow, cheer, cheers: () => cheers, call, calling: () => calling, near, nearing: () => !!nearTo,
    onPlayed: f => { played = f }, plays: () => plays, playing: () => (mode === 'play' && toy ? toy.id : null), braced: () => brace }
}
