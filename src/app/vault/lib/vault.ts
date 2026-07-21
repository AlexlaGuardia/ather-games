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
export const RUNNER_W = 22 // the mote of light — bigger so its size can read as its fuel (2026-07-07)
export const RUNNER_H = 27
export const DEATH_Y = VH + 50 // fall past this (into a gap) → death

// ── platform heights (smaller y = higher ledge) ───────────────────────────────────
export const TOP_BASE = 212 // default ground surface
export const TOP_MIN = 96 // highest a ledge can sit
export const TOP_MAX = 224 // lowest a ledge can sit
export const STEP_UP = 14 // a flush height change up to this is a free step; bigger only across gaps
// authored levels may stack routes ABOVE the normal frame (canon: layers of the greying you climb through);
// the camera follows the light up into them, the player only ever seeing a screen-tall sliver. Procedural
// (Endless/Daily) stays flat in [TOP_MIN, TOP_MAX] → its content never rises past the frame → camera stays put.
export const WORLD_CEIL = -260 // highest y a platform/mote can be authored (≈ 1.3 screens of headroom above y=0)

// ── jump / gravity (variable jump: low grav while rising+held, snappy fall) ────────
export const JUMP_V0 = 580 // launch velocity (up) — a touch more pop (Alex: wider arc, 2026-07-11)
export const GRAV_RISE_HOLD = 850 // floatier on the way up → the arc carries wider
export const GRAV_RISE_FREE = 1550 // released early on the way up → comes down sooner (short hop)
export const GRAV_FALL = 1700 // a little more hang on the way down (was 1950) — momentum without floatiness
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
  ledges?: boolean   // BLOCKOUT (2026-07-21): overlay a high-road of broken structure-ledges (the high/low pathing)
}

// endless / daily = the crossing without end (original single-ramp feel preserved)
export const ENDLESS_CFG: MovementCfg = {
  id: 'endless', name: 'The Crossing', blurb: 'the crossing without end',
  goalDist: 0, diffBase: 0, diffSpan: 1, gaps: true, foes: true, spikes: true, hazMul: 1, runway: RUNWAY,
}
// Endless-mode play with the high-road blockout on (Daily still uses ENDLESS_CFG so its leaderboard is untouched)
export const ENDLESS_LEDGES_CFG: MovementCfg = { ...ENDLESS_CFG, ledges: true }

// ── AREAS × LEVELS (the descent as a level ladder) ──────────────────────────────────
// An AREA is a *look* + a hazard set + a difficulty BAND (canon: one named stretch of the greying, the 6
// blessed movements). Each area holds LEVELS_PER_AREA discrete levels you beat in order (linear unlock) to
// advance. Levels are PROCEDURAL — a level is a short seeded run whose difficulty steps from the area's
// floor→ceil across its levels, and whose LENGTH grows over the whole ladder (~35s early → ~90s late). So
// "100 levels/area" is just a number, not 100 hand-built maps. `accent` is the area's tint (rich per-area
// theming comes later — Alex: don't go crazy on maps until the enemies/obstacles get their glow-up).
export interface AreaCfg {
  id: string
  name: string       // canon-blessed (game/vault.md)
  blurb: string
  accent: string     // the look tint (a descent bright→grey); full theming is future work
  diffFloor: number  // difficulty of level 1
  diffCeil: number   // difficulty of the last level
  gaps: boolean
  foes: boolean
  spikes: boolean
  hazMul: number     // hazard density for the area
}
export const AREAS: AreaCfg[] = [
  { id: 'a1', name: 'First Light',            blurb: 'the light, new — leap the first tears',     accent: '#ffd36b', diffFloor: 0.00, diffCeil: 0.16, gaps: true, foes: false, spikes: false, hazMul: 0    },
  { id: 'a2', name: 'The Tears Widen',        blurb: 'the ground breaks; read it ahead',          accent: '#7fe0ff', diffFloor: 0.12, diffCeil: 0.30, gaps: true, foes: false, spikes: false, hazMul: 0    },
  { id: 'a3', name: 'The Grey Wakes',         blurb: 'the grey rises — unmake it, chain it',       accent: '#8fd0d8', diffFloor: 0.16, diffCeil: 0.34, gaps: true, foes: true,  spikes: false, hazMul: 0.32 },
  { id: 'a4', name: 'The Rooted Grey',        blurb: 'grey that has taken root — that, you leap',  accent: '#8fb0b0', diffFloor: 0.24, diffCeil: 0.42, gaps: true, foes: true,  spikes: true,  hazMul: 0.42 },
  { id: 'a5', name: 'The Dying Gains Ground', blurb: 'faster, more broken — the Dying presses',    accent: '#9a94a8', diffFloor: 0.30, diffCeil: 0.50, gaps: true, foes: true,  spikes: true,  hazMul: 0.55 },
  { id: 'a6', name: 'The Grey Heart',         blurb: 'the deepest the tale is told',               accent: '#8a8a94', diffFloor: 0.38, diffCeil: 0.58, gaps: true, foes: true,  spikes: true,  hazMul: 0.68 },
]
export const LEVELS_PER_AREA = 10 // 10 for now; the goal is ~100 — bumping this is the only change needed

// deterministic per-level seed → a level is the SAME layout every attempt (learnable + retryable)
export function levelSeed(a: number, i: number): number {
  return (Math.imul(a + 1, 73856093) ^ Math.imul(i + 1, 19349663) ^ 0x9e3779b9) >>> 0
}

// the slot key for a hand-authored level in the ladder (matches MovementCfg.id): 'a3-l7'.
// The map editor publishes authored levels under this key; the game plays the authored
// layout for a slot when one exists, else falls back to the procedural stream.
export function authoredKey(a: number, i: number): string { return `${AREAS[a].id}-l${i + 1}` }

// concrete run-config for area a, level i (both 0-based). Difficulty steps floor→ceil across the area;
// length grows across the whole ladder (early ~35s → late ~90s).
export function levelCfg(a: number, i: number): MovementCfg {
  const area = AREAS[a]
  const t = LEVELS_PER_AREA > 1 ? i / (LEVELS_PER_AREA - 1) : 0
  const diffBase = area.diffFloor + (area.diffCeil - area.diffFloor) * t
  const globalIdx = a * LEVELS_PER_AREA + i
  const p = globalIdx / Math.max(1, AREAS.length * LEVELS_PER_AREA - 1)
  const targetSec = 35 + 48 * p // ~35s at the start of the ladder → ~83s at the end
  const goalDist = Math.round(targetSec * (BASE_SPEED + SPEED_RANGE * diffBase))
  return {
    id: `${area.id}-l${i + 1}`,
    name: `${area.name} · ${i + 1}`,
    blurb: area.blurb,
    goalDist,
    diffBase,
    diffSpan: 0.1, // a gentle rise within the single level
    gaps: area.gaps, foes: area.foes, spikes: area.spikes,
    hazMul: area.hazMul,
    runway: a === 0 && i === 0 ? 420 : 260, // short lead-in — no more long flat opening run
  }
}

// ── progress (per-area cleared-level count, linear unlock) ───────────────────────────
const PROG_KEY = 'vault.progress.v2'
export function loadProgress(): number[] {
  const empty = AREAS.map(() => 0)
  if (typeof window === 'undefined') return empty
  try {
    const raw = JSON.parse(localStorage.getItem(PROG_KEY) || '[]')
    return AREAS.map((_, a) => Math.max(0, Math.min(LEVELS_PER_AREA, Number(raw?.[a]) || 0)))
  } catch { return empty }
}
export function saveProgress(prog: number[]): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(PROG_KEY, JSON.stringify(prog)) } catch { /* ignore */ }
}
export function areaUnlocked(prog: number[], a: number): boolean { return a === 0 || prog[a - 1] >= LEVELS_PER_AREA }
export function levelUnlocked(prog: number[], a: number, i: number): boolean { return areaUnlocked(prog, a) && i <= (prog[a] ?? 0) }
export function areaDone(prog: number[], a: number): boolean { return (prog[a] ?? 0) >= LEVELS_PER_AREA }
export function allAreasDone(prog: number[]): boolean { return AREAS.every((_, a) => areaDone(prog, a)) }

// ── entities ──────────────────────────────────────────────────────────────────────
export interface Seg { x0: number; x1: number; top: number }
export interface Foe { x: number; y: number; dead: boolean } // stompable; y = its feet (on a seg top)
export interface Spike { x: number; y: number } // never stompable; contact = death
export interface Mote { x: number; y: number; got: boolean }
export const FOE_W = 24
export const FOE_H = 22
export const SPIKE_W = 21
export const SPIKE_H = 19
export const MOTE_R = 9
export const MOTE_PTS = 25
export const STOMP_BASE = 30 // stomp score = STOMP_BASE * current combo

// ── the carried light: hearts (resilience) + fuel (motes feed it; runs dry → the greying takes hearts) ──
export const MAX_HEARTS = 3
export const MAX_FUEL = 100
export const FUEL_DRAIN = 4.0   // fuel/sec spent carrying — full lasts ~25s if you gather nothing (levels are long)
export const MOTE_FUEL = 22     // fuel a gathered mote restores (~4s of carrying)
export const GRAY_TIC = 0.8     // sec per greying tic once the light is dry (the dim pulse)
export const TICS_PER_HEART = 3 // every 3rd greying tic costs a heart (~2.4s grace per heart when starving)
export const HURT_IFRAMES = 1.0 // sec of invulnerability after a hit (a cluster can't drain you at once)

export type BoundEvent =
  | { type: 'jump'; air?: boolean } // air = a stomp-granted double-jump (vs a ground/coyote jump)
  | { type: 'land' }
  | { type: 'stomp'; combo: number }
  | { type: 'collect' } // gathered a mote (score + fuel)
  | { type: 'hurt'; cause: 'foe' | 'spike' | 'grey'; hearts: number } // lost a heart (survived)
  | { type: 'graytic' } // a greying pulse while the light is dry (every 3rd costs a heart)
  | { type: 'death'; cause: 'gap' | 'grey' } // gap = fell into the void; grey = the light gutted out (0 hearts)
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
  // the carried light
  hearts: number // resilience — a hit or a greying tic costs one; 0 → the grey takes the light
  fuel: number // 0..MAX_FUEL — drains as you carry, motes refill; at 0 the greying starts taking hearts
  grayTic: number // accumulated time toward the next greying tic (only while dry)
  grayCount: number // greying tics elapsed since going dry (resets on refuel)
  iframes: number // invuln timer after a hit
  score: number
  motesGot: number
  stompScore: number
  camY: number // render-only vertical camera (eased toward the light when it climbs above the frame; 0 = normal)
  // world
  segs: Seg[]
  foes: Foe[]
  spikes: Spike[]
  motes: Mote[]
  // high-road blockout: broken structure-ledges overlaid above the ground track (own RNG → ground stays deterministic)
  ledges: Seg[]
  ledgeGenX: number
  rngLedge: Rng
  onLedge: Seg | null // the ledge the runner is currently standing on (null = on the ground track or airborne)
  genX: number // world-x generated up to
  lastTop: number // top of the last generated segment (gen continuity)
  authored?: boolean // true = hand-built level (fixed data, no procedural streaming)
  events: BoundEvent[]
}

export function makeWorld(seed: number, cfg: MovementCfg = ENDLESS_CFG): World {
  const rng = mulberry32(seed >>> 0)
  const w: World = {
    rng, cfg, state: 'ready', dist: 0,
    y: TOP_BASE, vy: 0, grounded: true, coyote: 0, buffer: 0, jumping: false, held: false,
    combo: 0, airJumps: 0,
    hearts: MAX_HEARTS, fuel: MAX_FUEL, grayTic: 0, grayCount: 0, iframes: 0,
    score: 0, motesGot: 0, stompScore: 0, camY: 0,
    segs: [], foes: [], spikes: [], motes: [],
    ledges: [], ledgeGenX: cfg.runway, rngLedge: mulberry32((seed ^ 0x1ed6e) >>> 0), onLedge: null,
    genX: 0, lastTop: TOP_BASE, events: [],
  }
  // the nursery: a flat hazard-free runway so the player gets going (Seedfall/Driftling lesson)
  w.segs.push({ x0: -RUNNER_SX, x1: cfg.runway, top: TOP_BASE })
  w.genX = cfg.runway
  generate(w)
  return w
}

// ── authored levels (the /vault/dev map editor) ─────────────────────────────────
// A hand-built level is a finite, fixed snapshot of the world entities. The editor
// SEEDS one by baking the procedural stream to a length, then Alex tweaks it; the
// game plays it back with streaming off. `end` is the goal distance (the finish).
export interface AuthoredLevel {
  seed: number    // the seed it was baked from (for reference / re-roll)
  end: number     // finish line in world-x; cross it grounded → won
  areaId?: string // which area's look/movement it belongs to (optional; set when saved to the ladder)
  segs: Seg[]
  foes: Foe[]
  spikes: Spike[]
  motes: Mote[]
}

// bake the procedural generator into a finite editable snapshot covering [0, end].
export function bakeLevel(seed: number, cfg: MovementCfg, end: number): AuthoredLevel {
  const w = makeWorld(seed, cfg)
  w.dist = end // push the frontier so one uncull'd pass fills the whole span
  generate(w, false)
  const clip = (x: number) => x < end
  const segs = w.segs.filter((s) => s.x0 < end).map((s) => ({ x0: s.x0, x1: Math.min(s.x1, end), top: s.top }))
  return {
    seed, end,
    segs,
    foes: w.foes.filter((f) => clip(f.x)).map((f) => ({ x: f.x, y: f.y, dead: false })),
    spikes: w.spikes.filter((s) => clip(s.x)).map((s) => ({ x: s.x, y: s.y })),
    motes: w.motes.filter((m) => clip(m.x)).map((m) => ({ x: m.x, y: m.y, got: false })),
  }
}

// build a playable world from an authored level: load its entities, disable streaming,
// finish at `end`. Entities are deep-cloned so play mutations never touch the source.
export function makeAuthoredWorld(level: AuthoredLevel, cfg: MovementCfg = ENDLESS_CFG): World {
  const w = makeWorld(level.seed, { ...cfg, goalDist: level.end })
  w.segs = level.segs.map((s) => ({ ...s }))
  w.foes = level.foes.map((f) => ({ x: f.x, y: f.y, dead: false }))
  w.spikes = level.spikes.map((s) => ({ ...s }))
  w.motes = level.motes.map((m) => ({ x: m.x, y: m.y, got: false }))
  w.genX = level.end
  w.lastTop = level.segs.length ? level.segs[level.segs.length - 1].top : TOP_BASE
  // FINISH PLATFORM: authored levels don't stream, so extend the last ground WELL past the goal.
  // Without this, crossing the finish airborne (or a last segment that ends right at the goal) runs
  // the light off the end into the void — the win only fires while grounded. (Alex bug 2026-07-11.)
  if (w.segs.length) {
    const last = w.segs[w.segs.length - 1]
    last.x1 = Math.max(last.x1, level.end + VW)
  } else {
    w.segs.push({ x0: 0, x1: level.end + VW, top: TOP_BASE })
  }
  w.authored = true
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

  // the carried light: invuln ticks down, fuel drains as you carry it, and once it's dry the greying
  // pulses — every 3rd pulse the grey takes a heart (forgiving: ~2.4s of grace per heart). A gathered
  // mote refuels and eases the greying back off.
  if (w.iframes > 0) w.iframes = Math.max(0, w.iframes - dt)
  w.fuel = Math.max(0, w.fuel - FUEL_DRAIN * dt)
  if (w.fuel <= 0) {
    w.grayTic += dt
    while (w.grayTic >= GRAY_TIC) {
      w.grayTic -= GRAY_TIC
      w.grayCount++
      w.events.push({ type: 'graytic' })
      if (w.grayCount % TICS_PER_HEART === 0) { loseHeart(w, 'grey'); if (w.state !== 'playing') return }
    }
  } else {
    w.grayTic = 0; w.grayCount = 0 // refueled → the greying eases off
  }

  if (w.coyote > 0) w.coyote = Math.max(0, w.coyote - dt)
  if (w.buffer > 0) w.buffer = Math.max(0, w.buffer - dt)

  // start a jump if one is buffered and we're on (or just off) the ground, OR a stomp banked an
  // air-jump (the double-jump that carries the momentum on across enemies)
  if (w.buffer > 0 && (w.grounded || w.coyote > 0 || w.airJumps > 0)) {
    const air = !w.grounded && w.coyote <= 0 // not grounded and not in coyote → spending an air-jump
    w.vy = air ? -AIR_JUMP_V0 : -JUMP_V0
    w.grounded = false
    w.onLedge = null // leaving whatever surface (ground or ledge) we launched from
    w.jumping = true
    w.coyote = 0
    w.buffer = 0
    if (air) w.airJumps--
    w.events.push({ type: 'jump', air })
  }

  // integrate vertical motion (variable gravity). Remember the feet BEFORE the move for swept collision
  // — a fast fall can travel >20px in a frame, so a fixed landing window would tunnel through a platform.
  const prevY = w.y
  if (!w.grounded) {
    const g = w.vy < 0 ? (w.held ? GRAV_RISE_HOLD : GRAV_RISE_FREE) : GRAV_FALL
    w.vy += g * dt
    w.y += w.vy * dt
  }

  // terrain under the runner (its world-x is w.dist)
  const segHere = segAt(w, w.dist)
  const segPrev = segAt(w, prevDist)

  if (w.grounded && w.onLedge) {
    // HIGH ROAD: standing on a structure-ledge — follow it flat until we run off its end, then fall
    // toward whatever's below (the ground, or the void if it's over a gap — that's the high-road risk).
    if (w.dist >= w.onLedge.x0 && w.dist <= w.onLedge.x1) { w.y = w.onLedge.top }
    else { w.onLedge = null; w.grounded = false; w.coyote = COYOTE }
  } else if (w.grounded) {
    if (segHere) {
      // follow the ground; a small up-step is free, a drop means we walk off and fall
      if (segHere.top <= w.y + STEP_UP) { w.y = segHere.top }
      else { w.grounded = false; w.coyote = COYOTE } // edge of a drop → start falling
    } else {
      w.grounded = false; w.coyote = COYOTE // ran out over a gap
    }
  } else {
    // AIRBORNE: land on a high LEDGE first (the highest one the feet crossed this frame), else the ground.
    let onL: Seg | null = null
    if (w.vy >= 0) {
      for (const L of w.ledges) {
        if (w.dist < L.x0 || w.dist > L.x1) continue
        if (prevY <= L.top + FACE_TOL && w.y >= L.top && (!onL || L.top < onL.top)) onL = L
      }
    }
    if (onL) {
      // landed on the high road
      w.y = onL.top; w.vy = 0; w.grounded = true; w.jumping = false; w.onLedge = onL
      if (w.combo > 0) w.combo = 0
      w.airJumps = 0
      w.events.push({ type: 'land' })
    } else if (w.vy >= 0 && segHere && prevY <= segHere.top + FACE_TOL && w.y >= segHere.top) {
      // SWEPT LANDING on the ground (robust to any fall speed) — clears any ledge
      w.y = segHere.top
      w.vy = 0
      w.grounded = true
      w.jumping = false
      w.onLedge = null
      if (w.combo > 0) w.combo = 0 // a touchdown ends the bounce-chain
      w.airJumps = 0 // landing clears any banked air-jump (the double-jump only carries while aloft)
      w.events.push({ type: 'land' })
    } else if (segHere && segHere !== segPrev) {
      // FACE-HIT: entered a gap-separated ledge while already BELOW its lip (came in low, didn't clear it).
      const gapBefore = !segPrev || segHere.x0 > segPrev.x1 + 1
      if (gapBefore && prevY > segHere.top + FACE_TOL) return die(w, 'gap')
    }
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
      w.onLedge = null
      w.jumping = true
      w.airJumps = AIR_JUMPS_PER_STOMP // unmaking a foe banks a double-jump — tap to keep the momentum
      const gain = STOMP_BASE * w.combo
      w.stompScore += gain
      w.events.push({ type: 'stomp', combo: w.combo })
    } else if (w.iframes <= 0) {
      // side-hit: the grey void-spawn chips the light (a heart), not instant death. Brief knockback +
      // the invuln set below. During invuln we pass through harmlessly.
      loseHeart(w, 'foe'); w.iframes = HURT_IFRAMES; w.vy = Math.min(w.vy, -160); w.grounded = false
      if (w.state !== 'playing') return
    }
  }
  for (const s of w.spikes) {
    if (overlap(w.dist, w.y, RUNNER_W, RUNNER_H, s.x, s.y, SPIKE_W, SPIKE_H) && w.iframes <= 0) {
      // rooted grey corruption — a heart, not instant death (forgiving), + knockback/invuln
      loseHeart(w, 'spike'); w.iframes = HURT_IFRAMES; w.vy = Math.min(w.vy, -160); w.grounded = false
      if (w.state !== 'playing') return
    }
  }
  for (const m of w.motes) {
    if (m.got) continue
    if (overlap(w.dist, w.y, RUNNER_W, RUNNER_H, m.x, m.y, MOTE_R * 2, MOTE_R * 2)) {
      m.got = true
      w.motesGot++
      w.fuel = Math.min(MAX_FUEL, w.fuel + MOTE_FUEL) // gathered light feeds the carried light
      if (w.fuel > 0) { w.grayTic = 0; w.grayCount = 0 } // refueled → the greying eases off at once
      w.events.push({ type: 'collect' })
    }
  }

  // score + keep the course generated/culled (authored levels are fixed — no streaming)
  w.score = Math.floor(w.dist / 10) + w.motesGot * MOTE_PTS + w.stompScore
  if (!w.authored) generate(w)
}

function die(w: World, cause: 'gap' | 'grey'): void {
  w.state = 'dead'
  w.events.push({ type: 'death', cause })
}

// the grey chips a heart. When the last one goes, the light guts out to grey (death). Grey-tic hits
// bypass invuln (the slow drain); foe/spike hits set invuln at the call site so a cluster can't stack.
function loseHeart(w: World, cause: 'foe' | 'spike' | 'grey'): void {
  w.hearts--
  w.events.push({ type: 'hurt', cause, hearts: w.hearts })
  if (w.hearts <= 0) die(w, 'grey')
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
function generate(w: World, cull = true): void {
  while (w.genX < w.dist + GEN_AHEAD) {
    const d = diffOf(w, w.genX)
    const speed = speedOf(w, w.genX)

    // Height only changes across a GAP. Between gaps a platform is ONE long, flat surface — a flat
    // continuation EXTENDS the current segment instead of butting a new little one against it (that
    // stair-stepped, chopped-up look). An ease-in window right after the runway stays gentle (no gaps).
    const past = w.genX >= w.cfg.runway
    const eased = w.genX < w.cfg.runway + 280
    const wantGap = past && !eased && w.cfg.gaps && w.rng() < 0.42 + d * 0.3
    const last = w.segs[w.segs.length - 1]

    if (!wantGap && last && last.top === w.lastTop) {
      // flat continuation → grow the current platform into one long run (no seam, no choppy step)
      const grow = SEG_MIN + w.rng() * (SEG_MAX - SEG_MIN)
      const x0 = last.x1
      last.x1 += grow
      if (past) populate(w, { x0, x1: last.x1, top: last.top }, d)
      w.genX = last.x1
      continue
    }

    // a NEW platform: reached across a gap (where the height swings), or the very first one
    let top = w.lastTop
    if (wantGap) {
      // a gap the runner can clear: bounded by the airtime * speed (with margin)
      const maxGap = Math.max(GAP_MIN + 20, speed * FULL_AIRTIME * 0.78)
      const gap = GAP_MIN + w.rng() * (maxGap - GAP_MIN)
      w.genX += gap
      // height can change across the gap (gentle; widens with difficulty)
      const swing = (28 + d * 70) * (w.rng() * 2 - 1)
      top = clamp(w.lastTop + swing, TOP_MIN, TOP_MAX)
    }
    const len = SEG_MIN + w.rng() * (SEG_MAX - SEG_MIN)
    const seg: Seg = { x0: w.genX, x1: w.genX + len, top }
    w.segs.push(seg)
    if (past) populate(w, seg, d)
    w.genX = seg.x1
    w.lastTop = top
  }
  if (w.cfg.ledges) generateLedges(w)
  // cull behind
  if (!cull) return
  const cutoff = w.dist - GEN_BEHIND
  if (w.segs.length > 60) w.segs = w.segs.filter(s => s.x1 > cutoff)
  if (w.ledges.length > 40) w.ledges = w.ledges.filter(l => l.x1 > cutoff)
  if (w.foes.length > 40) w.foes = w.foes.filter(f => f.x > cutoff && !f.dead)
  if (w.spikes.length > 40) w.spikes = w.spikes.filter(s => s.x > cutoff)
  if (w.motes.length > 40) w.motes = w.motes.filter(m => m.x > cutoff && !m.got)
}

// ── high-road blockout: broken structure-ledges above the ground track (2026-07-21, feel-first) ──
// A parallel stream, seeded off its OWN rng so the ground layout stays byte-identical (Daily/oracle safe).
// Bursts of 2-4 leapable ledges (each with a mote reward), then a stretch of low-road-only. The high road
// is optional: jump up for the motes, but a missed leap drops you back to the ground (or the void over a gap).
const LEDGE_MIN_TOP = 105
const LEDGE_MAX_TOP = 150
function generateLedges(w: World): void {
  const ahead = w.dist + GEN_AHEAD
  while (w.ledgeGenX < ahead) {
    if (w.ledgeGenX < w.cfg.runway + 150) { w.ledgeGenX = w.cfg.runway + 150; continue } // high road opens soon after the nursery
    if (w.rngLedge() < 0.30) { w.ledgeGenX += 200 + w.rngLedge() * 260; continue }        // a low-road-only stretch (rarer → high road is easy to find)
    const n = 2 + Math.floor(w.rngLedge() * 3) // a burst of 2-4 broken ledges to leap along
    let top = clamp(112 + w.rngLedge() * 30, LEDGE_MIN_TOP, LEDGE_MAX_TOP)
    for (let k = 0; k < n; k++) {
      const len = 92 + w.rngLedge() * 68
      const L: Seg = { x0: w.ledgeGenX, x1: w.ledgeGenX + len, top }
      w.ledges.push(L)
      w.motes.push({ x: L.x0 + len * 0.5, y: top - 20, got: false }) // the high-road reward
      w.ledgeGenX = L.x1 + (52 + w.rngLedge() * 44) // a leapable gap to the next ledge
      top = clamp(top + (w.rngLedge() * 2 - 1) * 20, LEDGE_MIN_TOP, LEDGE_MAX_TOP)
    }
    w.ledgeGenX += 160 + w.rngLedge() * 220 // rejoin the low road for a stretch
  }
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
