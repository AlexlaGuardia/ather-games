// VAULT (canon: CANON/game/vault.md — a mote of Ather-light crosses the greying) — a one-button
// auto-runner. The mote runs the failing ground on its own, faster the farther it carries the light;
// the only input is the VAULT (jump), and it's VARIABLE (tap = short hop, hold = float higher). You read
// the terrain rushing at you — the void's tears (gaps) to leap, surviving ledges to land on, grey
// void-spawn to unmake (stomp), rooted corruption (spikes) to hop — and shape each arc. Score = the
// crossing (distance) + loose Ather-light (motes) + the unmaking-combo. Deterministic (mulberry32) for
// the Daily + a headless oracle. Forward motion is the defiance: you cannot hold the light still.
//
// Pure sim (no canvas, no React). The page calls pressJump/releaseJump on the button and tick() each
// frame; it reads `events` for sound/FX and the world fields (segs/foes/spikes/motes/runner) to render.
// Entity names stay generic (foe/spike/mote) — the Vault skin is render-only (canon re-skin: foe = grey
// void-spawn, spike = rooted grey corruption, mote = loose Ather-light, runner = the mote of light).
//
// Wedge vs Atherdash (flat rhythm hop) / Updraft (the climb): real platformer geometry — variable
// jump ARC + elevation (land on ledges) + STOMP bounce-combo. None of the others have those.
// Vault is Updraft's sibling: Updraft = the climb, Vault = the crossing.

import { mulberry32, type Rng } from '@/lib/arcade/rng'

// ── view (landscape; the renderer scales the virtual field) ───────────────────────
export const VW = 480
export const VH = 270
export const RUNNER_SX = 130 // the runner's FIXED screen-x; the world scrolls past it
export const RUNNER_W = 16
export const RUNNER_H = 20
export const DEATH_Y = VH + 50 // fall past this (into a gap) → death

// ── platform heights (smaller y = higher ledge) ───────────────────────────────────
export const TOP_BASE = 212 // default ground surface
export const TOP_MIN = 96 // highest a ledge can sit
export const TOP_MAX = 224 // lowest a ledge can sit
export const STEP_UP = 14 // a flush height change up to this is a free step; bigger only across gaps

// ── jump / gravity (variable jump: low grav while rising+held, snappy fall) ────────
export const JUMP_V0 = 560 // launch velocity (up)
export const GRAV_RISE_HOLD = 900 // floaty while you HOLD on the way up
export const GRAV_RISE_FREE = 1550 // released early on the way up → comes down sooner (short hop)
export const GRAV_FALL = 1950 // snappy on the way down
export const CUT_V = 170 // release while rising clamps upward speed to this → the short hop
export const COYOTE = 0.09 // s — jump just after leaving a ledge still fires
export const BUFFER = 0.12 // s — press just before landing still fires on touchdown
export const STOMP_BOUNCE = 440 // up-velocity granted by a stomp (the automatic re-launch)
export const AIR_JUMP_V0 = 520 // a stomp also banks ONE air-jump (double-jump) — tap mid-air to keep momentum
export const AIR_JUMPS_PER_STOMP = 1 // how many air-jumps an unmaking grants (resets on landing)
export const FACE_TOL = 6 // landing slack at a ledge top before it counts as hitting the face

// ── run speed + difficulty ramp ───────────────────────────────────────────────────
export const BASE_SPEED = 150 // px/s at the start (gentle)
export const SPEED_RANGE = 165 // added across the ramp → ~315 px/s at full intensity
export const RAMP_DIST = 6500 // world units to reach full intensity
export const FULL_AIRTIME = 1.0 // ~s a max jump stays airborne — used to keep gaps clearable
export function diffAt(dist: number): number {
  const d = Math.min(1, Math.max(0, dist) / RAMP_DIST)
  return d * d * 0.5 + d * 0.5 // eased: gentle open, steepens
}
export function speedAt(dist: number): number { return BASE_SPEED + SPEED_RANGE * diffAt(dist) }

// ── generation tuning ─────────────────────────────────────────────────────────────
export const RUNWAY = 900 // world units of flat, hazard-free start (the nursery)
export const GEN_AHEAD = VW + 360 // generate terrain this far ahead of the runner
export const GEN_BEHIND = 200 // cull terrain this far behind
export const SEG_MIN = 130
export const SEG_MAX = 340
export const GAP_MIN = 70

// ── movements (canon: game/vault.md — the crossing told as a DESCENT into the greying) ─────────────
// The crossing is eternal (no arrival). Story mode is the myth told in movements: named stretches of the
// greying going edge→heart, each a difficulty band + which hazards exist. The ramp IS the descent — a
// later movement floors harder AND adds a hazard. Finishing the last hands seamlessly into ENDLESS (goalDist
// 0). NAMES are working/world-facing → routed to Magii to bless before final (CANON_GAPS logged).
export interface MovementCfg {
  id: string
  name: string       // world-facing (Magii to ratify)
  blurb: string      // one line for the roadmap
  goalDist: number   // cross this far → the movement is done. 0 = endless (the crossing without end)
  diffBase: number   // difficulty floor 0..1 — how deep into the greying this movement sits
  diffSpan: number   // how much difficulty rises across the movement (the local descent)
  gaps: boolean      // the void's tears
  foes: boolean      // grey void-spawn (stomp/unmake)
  spikes: boolean    // rooted grey corruption (leap-only)
  hazMul: number     // hazard-DENSITY scalar (1 = endless density) — low = a gentle teaching movement
  runway: number     // flat hazard-free lead-in
}

// endless / daily = the crossing without end (original single-ramp feel preserved)
export const ENDLESS_CFG: MovementCfg = {
  id: 'endless', name: 'The Crossing', blurb: 'the crossing without end',
  goalDist: 0, diffBase: 0, diffSpan: 1, gaps: true, foes: true, spikes: true, hazMul: 1, runway: RUNWAY,
}

// the told movements — a descent. Each teaches one new thing; the floor deepens each time.
// Difficulty band is a FAIR, completable descent (peaks ~0.6 on the last told movement); Endless ramps the
// crossing on past 0.6→1.0 — canon-true (the tale only tells so deep; past it, the crossing without end is
// harder than any teller says). Bands are monotonic; foe-bearing movements sit a touch gentler because the
// unmaking (stomp/chain) is a learned skill. Tuned against the movements oracle + Alex's device feel.
export const MOVEMENTS: MovementCfg[] = [
  { id: 'm1', name: 'First Light',      blurb: 'the light, new — leap the first tears',        goalDist: 2200, diffBase: 0.00, diffSpan: 0.15, gaps: true,  foes: false, spikes: false, hazMul: 0,    runway: 700 },
  { id: 'm2', name: 'The Tears Widen',  blurb: 'the ground breaks; read it ahead',            goalDist: 2600, diffBase: 0.12, diffSpan: 0.16, gaps: true,  foes: false, spikes: false, hazMul: 0,    runway: 420 },
  { id: 'm3', name: 'Void-spawn',       blurb: 'grey things rise — unmake them, chain it',    goalDist: 2600, diffBase: 0.16, diffSpan: 0.16, gaps: true,  foes: true,  spikes: false, hazMul: 0.45, runway: 420 },
  { id: 'm4', name: 'Rooted Grey',      blurb: 'some grey has taken root — that, you leap',    goalDist: 2800, diffBase: 0.24, diffSpan: 0.16, gaps: true,  foes: true,  spikes: true,  hazMul: 0.6,  runway: 380 },
  { id: 'm5', name: 'The Dying Gains',  blurb: 'faster, more broken — the grey presses',       goalDist: 3000, diffBase: 0.32, diffSpan: 0.18, gaps: true,  foes: true,  spikes: true,  hazMul: 0.8,  runway: 340 },
  { id: 'm6', name: 'The Heart',        blurb: 'the deepest the tale is told; carry on',       goalDist: 3200, diffBase: 0.40, diffSpan: 0.20, gaps: true,  foes: true,  spikes: true,  hazMul: 1.0,  runway: 320 },
]
export function movementById(id: string): MovementCfg | undefined { return MOVEMENTS.find(m => m.id === id) }

// ── entities ──────────────────────────────────────────────────────────────────────
export interface Seg { x0: number; x1: number; top: number }
export interface Foe { x: number; y: number; dead: boolean } // stompable; y = its feet (on a seg top)
export interface Spike { x: number; y: number } // never stompable; contact = death
export interface Mote { x: number; y: number; got: boolean }
export const FOE_W = 18
export const FOE_H = 16
export const SPIKE_W = 16
export const SPIKE_H = 14
export const MOTE_R = 7
export const MOTE_PTS = 25
export const STOMP_BASE = 30 // stomp score = STOMP_BASE * current combo

export type BoundEvent =
  | { type: 'jump'; air?: boolean } // air = a stomp-granted double-jump (vs a ground/coyote jump)
  | { type: 'land' }
  | { type: 'stomp'; combo: number }
  | { type: 'collect' }
  | { type: 'death'; cause: 'gap' | 'foe' | 'spike' }
  | { type: 'won' } // a Story movement's goal distance was crossed (the light carries on)

export type BoundState = 'ready' | 'playing' | 'dead' | 'won'

export interface World {
  rng: Rng
  cfg: MovementCfg // the movement being crossed (ENDLESS_CFG for endless/daily)
  state: BoundState
  dist: number // world-x travelled (the runner's world position)
  // runner vertical state (its x is always `dist`; screen-x is RUNNER_SX)
  y: number // feet position
  vy: number
  grounded: boolean
  coyote: number // s of coyote time left
  buffer: number // s of jump-buffer left
  jumping: boolean // in a jump arc (vs just falling off a ledge)
  held: boolean // jump button currently down (drives variable height)
  combo: number // consecutive aerial stomps without landing
  airJumps: number // banked air-jumps (a stomp grants one; tap mid-air to spend; resets on landing)
  score: number
  motesGot: number
  stompScore: number
  // world
  segs: Seg[]
  foes: Foe[]
  spikes: Spike[]
  motes: Mote[]
  genX: number // world-x generated up to
  lastTop: number // top of the last generated segment (gen continuity)
  events: BoundEvent[]
}

export function makeWorld(seed: number, cfg: MovementCfg = ENDLESS_CFG): World {
  const rng = mulberry32(seed >>> 0)
  const w: World = {
    rng, cfg, state: 'ready', dist: 0,
    y: TOP_BASE, vy: 0, grounded: true, coyote: 0, buffer: 0, jumping: false, held: false,
    combo: 0, airJumps: 0, score: 0, motesGot: 0, stompScore: 0,
    segs: [], foes: [], spikes: [], motes: [],
    genX: 0, lastTop: TOP_BASE, events: [],
  }
  // the nursery: a flat hazard-free runway so the player gets going (Seedfall/Driftling lesson)
  w.segs.push({ x0: -RUNNER_SX, x1: cfg.runway, top: TOP_BASE })
  w.genX = cfg.runway
  generate(w)
  return w
}

// difficulty at a world-x. Endless (goalDist 0) keeps the original single ramp; a movement instead runs
// its own local ramp from diffBase→diffBase+diffSpan across [0, goalDist] — the descent made numeric.
export function diffOf(w: World, x: number): number {
  const c = w.cfg
  if (c.goalDist <= 0) return diffAt(x)
  const p = Math.min(1, Math.max(0, x) / c.goalDist)
  const eased = p * p * 0.5 + p * 0.5
  return Math.min(1, c.diffBase + c.diffSpan * eased)
}
export function speedOf(w: World, x: number): number { return BASE_SPEED + SPEED_RANGE * diffOf(w, x) }

// ── input ─────────────────────────────────────────────────────────────────────────
export function pressJump(w: World): void {
  if (w.state === 'ready') w.state = 'playing'
  if (w.state !== 'playing') return
  w.held = true
  w.buffer = BUFFER // remember the press; tick() consumes it when a jump is legal
}
export function releaseJump(w: World): void {
  w.held = false
  if (w.state === 'playing' && w.jumping && w.vy < -CUT_V) w.vy = -CUT_V // cut the rise → short hop
}

// ── per-frame ───────────────────────────────────────────────────────────────────
export function tick(w: World, dt: number): void {
  w.events.length = 0
  if (w.state !== 'playing') return
  // clamp dt so a stutter can't tunnel the runner through terrain
  dt = Math.min(dt, 1 / 30)

  const speed = speedOf(w, w.dist)
  const prevDist = w.dist
  w.dist += speed * dt
  // Story movement complete: crossed the goal distance → the light carries on out of sight (won).
  // Only once the runner is safely grounded, so a win never lands mid-leap over a tear.
  if (w.cfg.goalDist > 0 && w.dist >= w.cfg.goalDist && w.grounded) {
    w.score = Math.floor(w.dist / 10) + w.motesGot * MOTE_PTS + w.stompScore
    w.state = 'won'
    w.events.push({ type: 'won' })
    return
  }
  if (w.coyote > 0) w.coyote = Math.max(0, w.coyote - dt)
  if (w.buffer > 0) w.buffer = Math.max(0, w.buffer - dt)

  // start a jump if one is buffered and we're on (or just off) the ground, OR a stomp banked an
  // air-jump (the double-jump that carries the momentum on across enemies)
  if (w.buffer > 0 && (w.grounded || w.coyote > 0 || w.airJumps > 0)) {
    const air = !w.grounded && w.coyote <= 0 // not grounded and not in coyote → spending an air-jump
    w.vy = air ? -AIR_JUMP_V0 : -JUMP_V0
    w.grounded = false
    w.jumping = true
    w.coyote = 0
    w.buffer = 0
    if (air) w.airJumps--
    w.events.push({ type: 'jump', air })
  }

  // integrate vertical motion (variable gravity)
  if (!w.grounded) {
    const g = w.vy < 0 ? (w.held ? GRAV_RISE_HOLD : GRAV_RISE_FREE) : GRAV_FALL
    w.vy += g * dt
    w.y += w.vy * dt
  }

  // terrain under the runner (its world-x is w.dist)
  const segHere = segAt(w, w.dist)
  const segPrev = segAt(w, prevDist)

  // entering a ledge that's reached ACROSS A GAP while below its lip → smacked the face (didn't clear
  // it) = death. Only gap-separated ledges count; a flush-connected step-up is free (handled below).
  if (segHere && segHere !== segPrev) {
    const gapBefore = !segPrev || segHere.x0 > segPrev.x1 + 1
    if (gapBefore && w.y > segHere.top + FACE_TOL) return die(w, 'gap')
  }

  if (w.grounded) {
    if (segHere) {
      // follow the ground; a small up-step is free, a drop means we walk off and fall
      if (segHere.top <= w.y + STEP_UP) { w.y = segHere.top }
      else { w.grounded = false; w.coyote = COYOTE } // edge of a drop → start falling
    } else {
      w.grounded = false; w.coyote = COYOTE // ran out over a gap
    }
  }

  // landing: descending onto a segment top
  if (!w.grounded && w.vy >= 0 && segHere && w.y >= segHere.top && w.y <= segHere.top + Math.max(FACE_TOL, 24)) {
    w.y = segHere.top
    w.vy = 0
    w.grounded = true
    w.jumping = false
    if (w.combo > 0) w.combo = 0 // a touchdown ends the bounce-chain
    w.airJumps = 0 // landing clears any banked air-jump (the double-jump only carries while aloft)
    w.events.push({ type: 'land' })
  }

  // fell into a gap
  if (w.y > DEATH_Y) return die(w, 'gap')

  // entity collisions (runner box centered on screen-x; in world-x it's at w.dist)
  const rTop = w.y - RUNNER_H
  for (const f of w.foes) {
    if (f.dead) continue
    if (!overlap(w.dist, w.y, RUNNER_W, RUNNER_H, f.x, f.y, FOE_W, FOE_H)) continue
    // stomp if we're descending and our feet are at/above the foe's upper half
    if (w.vy > 0 && rTop < f.y - FOE_H * 0.5) {
      f.dead = true
      w.combo++
      w.vy = -STOMP_BOUNCE
      w.grounded = false
      w.jumping = true
      w.airJumps = AIR_JUMPS_PER_STOMP // unmaking a foe banks a double-jump — tap to keep the momentum
      const gain = STOMP_BASE * w.combo
      w.stompScore += gain
      w.events.push({ type: 'stomp', combo: w.combo })
    } else {
      return die(w, 'foe')
    }
  }
  for (const s of w.spikes) {
    if (overlap(w.dist, w.y, RUNNER_W, RUNNER_H, s.x, s.y, SPIKE_W, SPIKE_H)) return die(w, 'spike')
  }
  for (const m of w.motes) {
    if (m.got) continue
    if (overlap(w.dist, w.y, RUNNER_W, RUNNER_H, m.x, m.y, MOTE_R * 2, MOTE_R * 2)) {
      m.got = true
      w.motesGot++
      w.events.push({ type: 'collect' })
    }
  }

  // score + keep the course generated/culled
  w.score = Math.floor(w.dist / 10) + w.motesGot * MOTE_PTS + w.stompScore
  generate(w)
}

function die(w: World, cause: 'gap' | 'foe' | 'spike'): void {
  w.state = 'dead'
  w.events.push({ type: 'death', cause })
}

// ── helpers ─────────────────────────────────────────────────────────────────────
function segAt(w: World, x: number): Seg | undefined {
  for (const s of w.segs) if (x >= s.x0 && x <= s.x1) return s
  return undefined
}
// AABB overlap: a is the runner (a feet at ay, height ah, width aw, centered on ax);
// b is an entity (b feet at by, height bh, width bw, centered on bx).
function overlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return Math.abs(ax - bx) < (aw + bw) * 0.5 && (ay - ah) < by && (by - bh) < ay
}

// ── terrain generation (deterministic; only ever produces clearable courses) ──────
function generate(w: World): void {
  while (w.genX < w.dist + GEN_AHEAD) {
    const d = diffOf(w, w.genX)
    const speed = speedOf(w, w.genX)

    // past the runway, most segments are reached across a gap (where height can change). An ease-in
    // window right after the runway stays gentle (no gaps, no hazards) so the first real obstacle never
    // ambushes a player who just got moving.
    const past = w.genX >= w.cfg.runway
    const eased = w.genX < w.cfg.runway + 280
    const wantGap = past && !eased && w.cfg.gaps && w.rng() < 0.42 + d * 0.3
    let top = w.lastTop
    if (wantGap) {
      // a gap the runner can clear: bounded by the airtime * speed (with margin)
      const maxGap = Math.max(GAP_MIN + 20, speed * FULL_AIRTIME * 0.78)
      const gap = GAP_MIN + w.rng() * (maxGap - GAP_MIN)
      w.genX += gap
      // height can change across the gap (gentle; widens with difficulty)
      const swing = (28 + d * 70) * (w.rng() * 2 - 1)
      top = clamp(w.lastTop + swing, TOP_MIN, TOP_MAX)
    } else if (past && w.rng() < 0.35) {
      // occasional flush step (no gap): only a small, free up/down step
      top = clamp(w.lastTop + (w.rng() * 2 - 1) * STEP_UP, TOP_MIN, TOP_MAX)
    }

    const len = SEG_MIN + w.rng() * (SEG_MAX - SEG_MIN)
    const seg: Seg = { x0: w.genX, x1: w.genX + len, top }
    w.segs.push(seg)
    if (past) populate(w, seg, d)
    w.genX = seg.x1
    w.lastTop = top
  }
  // cull behind
  const cutoff = w.dist - GEN_BEHIND
  if (w.segs.length > 60) w.segs = w.segs.filter(s => s.x1 > cutoff)
  if (w.foes.length > 40) w.foes = w.foes.filter(f => f.x > cutoff && !f.dead)
  if (w.spikes.length > 40) w.spikes = w.spikes.filter(s => s.x > cutoff)
  if (w.motes.length > 40) w.motes = w.motes.filter(m => m.x > cutoff && !m.got)
}

function populate(w: World, seg: Seg, d: number): void {
  const len = seg.x1 - seg.x0
  if (seg.x0 < w.cfg.runway + 280) return // ease-in window: no hazards on the first stretch past the runway
  const canFoe = w.cfg.foes, canSpike = w.cfg.spikes
  // hazards: a foe OR a spike, density ramps from sparse. Kept off the segment EDGES (>= EDGE_MARGIN
  // from x0/x1) so there's always reaction room after a landing and before the next gap. A movement that
  // hasn't introduced a hazard yet (First Light / The Tears Widen) leaves it out entirely.
  const EDGE_MARGIN = 90
  if ((canFoe || canSpike) && len > 2 * EDGE_MARGIN + 30 && w.rng() < (0.18 + d * 0.45) * w.cfg.hazMul) {
    const hx = seg.x0 + EDGE_MARGIN + w.rng() * (len - 2 * EDGE_MARGIN)
    // prefer a foe (stomp-or-hop); spikes (leap-only) stay rarer. Fall back to whichever is enabled.
    const spike = canSpike && (!canFoe || w.rng() >= 0.7)
    if (spike) w.spikes.push({ x: hx, y: seg.top } as Spike)
    else w.foes.push({ x: hx, y: seg.top, dead: false })
  }
  // a mote: sometimes a reward arc above the ledge, sometimes low (free)
  if (w.rng() < 0.5) {
    const mx = seg.x0 + len * (0.2 + w.rng() * 0.6)
    const high = w.rng() < 0.5
    w.motes.push({ x: mx, y: seg.top - (high ? 60 + w.rng() * 30 : 22), got: false })
  }
}

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)) }

// ── best-score persistence (the chase) ────────────────────────────────────────────
const BEST_KEY = 'vault.best'
export function loadBest(): number {
  try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0 } catch { return 0 }
}
export function saveBest(score: number): number {
  const best = Math.max(loadBest(), Math.max(0, Math.floor(score)))
  try { localStorage.setItem(BEST_KEY, String(best)) } catch { /* ignore */ }
  return best
}

// ── Story progress: how many movements have been crossed (the tale told so far) ─────
const STORY_KEY = 'vault.story.done'
export function loadStoryDone(): number {
  try { return Math.min(MOVEMENTS.length, parseInt(localStorage.getItem(STORY_KEY) || '0', 10) || 0) } catch { return 0 }
}
export function saveStoryDone(n: number): number {
  const done = Math.min(MOVEMENTS.length, Math.max(loadStoryDone(), Math.max(0, Math.floor(n))))
  try { localStorage.setItem(STORY_KEY, String(done)) } catch { /* ignore */ }
  return done
}
