// DRIFTLING — a newborn spirit-fish adrift in the ocean. Drift the current, eat what is
// smaller, flee what is bigger, and cross discrete evolution tiers up the food chain. The
// wedge: the FIRST creature you eat locks your element branch (Storm / Earth / Water / Mana)
// — from then on the ocean biases toward your branch and your apex is decided. flOw drift,
// Feeding-Frenzy size hierarchy, Deeeep.io tiers, welded to the Rinn ladder (canon skin).
//
// Pure sim (no canvas, no React). The page sets a heading each frame and calls tick(); it
// reads the events for sound + FX and reads world fields to render the ocean. Deterministic
// from a seed (mulberry32) so headless settles and the live run agree.
//
// SIM-FIRST: this file + driftling.test.ts prove the eat/grow/threat/fork math before any
// render. The element↔apex mapping is a parked CANON GAP for /magii (see DESIGN.md) — the
// sim never depends on those names, only on tiers + a branch tag, so a ruling re-skins via
// the LADDER/APEX tables alone.

import { mulberry32, type Rng } from '@/lib/arcade/rng'

// ── the ocean (world coords; the renderer follows the player with a camera) ──────
export const WORLD_H = 1800 // vertical swim band (surface → floor); the ocean is ENDLESS to the RIGHT
export const START_X = 260 // you begin in the shallows (left); the deep is the journey rightward
export const DEPTH_PER_TIER = 1600 // world-x swum right to raise the ambient danger by one tier
export const MATCH_TIME = 180 // seconds per run — a 3-minute time attack: how deep can you get?

// the ambient danger tier at a depth (world-x): shallows = tiny fish, the deep = giants. This is
// what makes the ocean SPATIAL — swim right and everything around you gets bigger.
export function depthTier(x: number): number {
  return Math.max(0, Math.min(APEX_TIER, x / DEPTH_PER_TIER))
}

// ── drift physics (flOw-like: heading nudges, body eases, water drags) ───────────
export const ACCEL = 820 // how hard the body pulls toward the heading (tightened — was floaty/hard to steer)
export const DRAG = 2.6 // velocity bleed per second when coasting (more bite = less overshoot, keeps some glide)
export const BASE_MAXV = 250 // top drift speed at the smallest tier
export const TIER_SLOW = 0.06 // each tier up shaves this fraction off max speed (giants are ponderous)
export const MIN_MAXV_FRAC = 0.45 // never slower than this fraction of BASE_MAXV
// ── the world's soft edges (surface / seafloor / shallow shelf) ──────────────────
// The ocean is endless RIGHT but bounded up/down (surface↔floor) and left (the shallows you came
// from). A cushion ramps up within EDGE_SOFT of a bound so you GLIDE to a stop, never slam an
// invisible wall — the renderer draws all three so you see them coming. Creatures honor them too.
export const EDGE_SOFT = 150 // world-units from a bound where the inward cushion begins
export const EDGE_PUSH = 700 // cushion strength (world u/s²) — enough to stop a top-speed approach inside EDGE_SOFT

// ── the drift current (flOw): the game's namesake. A smooth flow field over the whole ocean
// that carries you AND every creature — shoals ride the same stream together. Gentle enough to
// always out-swim (agency: peak push is a fraction of BASE_MAXV, you can cross any stream), but
// felt: the dominant sensation is vertical meanders you slalom, with a soft rightward mean so
// "going with the flow" carries you deeper (riding a fast rightward band = a skill, not free depth).
export const CURRENT_STRENGTH = 58 // peak vertical push (world u/s); vs BASE_MAXV 250 → always fightable
export const CURRENT_RIGHT_BIAS = 0.28 // baseline rightward carry as a fraction of strength (aids the journey)
export const CURRENT_WAVE_Y = 0.0042 // vertical wavelength of the meander (bigger = tighter streams)
export const CURRENT_WAVE_X = 0.0011 // how the streams shift as you swim deeper (right)
export const CURRENT_EVOLVE = 0.06 // how fast the field slowly churns over time (0 = frozen streams)

// the water's velocity at a world point + time. Pure (no rng) → deterministic; headless + live agree.
// Returns [cx, cy] in world u/s. Reads clean at any (x,y,t); the caller advects a body by it × dt.
export function current(x: number, y: number, t: number): [number, number] {
  const phase = y * CURRENT_WAVE_Y + x * CURRENT_WAVE_X + t * CURRENT_EVOLVE
  const meander = Math.sin(phase) // -1..1: the vertical sway that forms the streams
  const pulse = 0.5 + 0.5 * Math.cos(x * CURRENT_WAVE_X * 1.7 - t * CURRENT_EVOLVE * 0.8) // 0..1 slow horizontal breathing
  const cx = CURRENT_STRENGTH * (CURRENT_RIGHT_BIAS + (1 - CURRENT_RIGHT_BIAS) * pulse * (0.35 + 0.35 * meander))
  const cy = CURRENT_STRENGTH * 0.82 * meander
  return [cx, cy]
}

// ── eating ───────────────────────────────────────────────────────────────────────
// size compare against the player's body. A creature meaningfully smaller is prey;
// meaningfully bigger is a threat; roughly equal just bumps (neither can swallow).
export const EQUAL_BAND = 0.15 // ±15% of player size = a bump, no eat
export const EAT_REACH = 0.7 // bodies must really overlap (fraction of summed radii) to resolve
export const FOOD_PER_SIZE = 0.45 // mass gained = eaten creature's size × this (lower = a longer climb; was 0.95, growth read WAY too fast)

// ── the ladder (PROPOSED canon skin — drawn from rinn.md; pending /magii bless) ──
// Player evolution STATIONS. `size` is the body radius at that tier; `evolveAt` is the
// absolute mass needed to leave it. Tier 0 ("mote") is a prey floor the player outsizes
// from birth and never occupies. Swap names/sizes here only — the logic reads indices.
export interface Tier {
  key: string // placeholder ladder id (canon name lands here after the /magii ruling)
  size: number // body radius at this tier
  evolveAt: number // absolute mass to evolve OUT of this tier (Infinity at apex)
}
export const LADDER: Tier[] = [
  { key: 'mote', size: 6, evolveAt: 0 }, // prey-only floor (player never sits here)
  { key: 'driftling', size: 10, evolveAt: 18 }, // ← START tier (first payoff still comes fairly soon)
  { key: 'silvergill', size: 15, evolveAt: 52 },
  { key: 'coppermouth', size: 22, evolveAt: 110 },
  { key: 'shimmerscale', size: 31, evolveAt: 200 },
  { key: 'glassfin', size: 42, evolveAt: 330 },
  { key: 'silenthunter', size: 55, evolveAt: 510 },
  { key: 'driftwhale', size: 72, evolveAt: 760 },
  { key: 'apex', size: 94, evolveAt: Infinity },
]
export const START_TIER = 1
export const APEX_TIER = LADDER.length - 1

// ── elements (shared catalog — colours match the atherdash lanes / Mana'nana orbs) ─
export type ElementId = 'water' | 'storm' | 'earth' | 'mana'
export const ELEMENTS: { id: ElementId; name: string; color: string }[] = [
  { id: 'water', name: 'Water', color: '#37a3e6' },
  { id: 'storm', name: 'Storm', color: '#f0a526' },
  { id: 'earth', name: 'Earth', color: '#48b56f' },
  { id: 'mana', name: 'Mana', color: '#9b5ad2' },
]

// element → apex (PLACEHOLDER from DESIGN.md; the real mapping is a /magii canon call).
// Swappable: a ruling re-skins by editing this table, no logic touched.
export const APEX_BY_ELEMENT: Record<ElementId, string> = {
  mana: 'Prismstrike',
  earth: 'Coilguard',
  water: 'Frilldrift',
  storm: 'Duskpuff',
}

// ── spawning ──────────────────────────────────────────────────────────────────────
export const TARGET_CREATURES = 48 // how full the visible ocean stays (room for shoals + lone hunters)
export const SPAWN_PER_TICK = 3 // gentle top-up so the field doesn't pop in all at once
// the viewport is ~420×620 (corner ~373px from the player). Top-ups appear just beyond that
// edge so they drift INTO view rather than popping in; the initial seed (makeWorld) scatters
// across the visible disc so you start surrounded, not staring at an empty sea.
export const SPAWN_RING = 430 // ongoing spawns appear here (just off-screen, drift in)
export const SEED_MIN = 130 // initial-seed inner radius (clear of the instant-eat zone)
export const SEED_MAX = 600 // initial-seed outer radius (fills view + a margin)
export const DESPAWN_R = 780 // drift this far from the player and you're recycled
export const BRANCH_BIAS = 0.5 // P(a spawn carries your branch element) once the fork locks
export const CREATURE_DRIFT = 34 // base wander speed of ocean life
export const THREAT_HOMING = 11 // bigger creatures lean toward you; prey lean away (gentle — flee-able)

// ── schools (boids): the small fish shoal together and scatter from you or a predator ──
export const SCHOOL_MIN = 6
export const SCHOOL_MAX = 11
export const SCHOOL_CHANCE = 0.5 // a field top-up spawns a whole school (vs a lone fish) this often
export const SCHOOL_PERCEPT = 130 // neighbour radius for flocking
export const SCHOOL_SEP = 32 // hold at least this much space between shoal-mates
export const W_COHESION = 0.9 // steer toward the shoal's centre
export const W_ALIGN = 1.5 // match the shoal's heading
export const W_SEPARATION = 2.6 // don't crowd
export const SCATTER_R = 150 // schoolers bolt when you or a bigger fish come within this
export const SCATTER_FORCE = 300

export interface Creature {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  tier: number // ladder index → size + skin
  size: number // = LADDER[tier].size (cached)
  element: ElementId
  wanderT: number // seconds until the drift heading re-rolls
  school: number // 0 = a lone fish; >0 = a shoal id (flocks + scatters)
}

export type DriftState = 'ready' | 'playing' | 'dead'

export interface World {
  x: number
  y: number
  vx: number
  vy: number
  hx: number // current heading (unit-ish; 0,0 = coast)
  hy: number
  mass: number
  tier: number
  size: number // = LADDER[tier].size (cached)
  branch: ElementId | null // null until the first eat locks it
  creatures: Creature[]
  eaten: number // creatures consumed (run stat)
  score: number
  t: number // seconds elapsed this run (the 3-min match clock)
  maxX: number // deepest (rightmost) point reached → the headline score
  endReason: 'eaten' | 'time' | null // how the run ended
  state: DriftState
  spawnPaused: boolean // tests flip this to freeze the field
  nextId: number
  rng: Rng
}

export interface TickEvents {
  ate: boolean // consumed something this tick
  grew: boolean // crossed a tier (evolved)
  forkLocked: ElementId | null // the first eat just locked the branch
  bumped: boolean // touched an equal — neither ate
  eaten: boolean // a bigger creature got you → run ends
  timeup: boolean // the 3-min clock ran out → run ends
}

const noEvents = (): TickEvents => ({ ate: false, grew: false, forkLocked: null, bumped: false, eaten: false, timeup: false })

// the run's score is HOW DEEP you got (rightmost point), + a growth bonus. Depth is the headline.
function depthScore(w: World): number {
  return Math.floor(w.maxX / 10) + w.tier * 15
}

function maxSpeed(tier: number): number {
  return BASE_MAXV * Math.max(MIN_MAXV_FRAC, 1 - tier * TIER_SLOW)
}

function pickElement(w: World): ElementId {
  if (w.branch && w.rng() < BRANCH_BIAS) return w.branch
  return ELEMENTS[Math.floor(w.rng() * ELEMENTS.length)].id
}

// choose a creature tier by the DEPTH it spawns at (not by how big the player is). Every stretch
// of ocean has its own size band — small fish in the shallows, giants in the deep — with prey to
// chase and something bigger lurking at every depth. This is the spatial food chain.
export function pickTier(w: World, atX: number): number {
  const local = depthTier(atX) // the ocean's ambient tier HERE
  const r = w.rng()
  let delta: number
  if (r < 0.56) delta = w.rng() < 0.5 ? -2 : -1 // prey — the small fish of this depth
  else if (r < 0.8) delta = 0 // a peer (bump)
  else delta = w.rng() < 0.7 ? 1 : 2 // something bigger, lurking (deep water = these are large)
  return Math.max(0, Math.min(APEX_TIER, Math.round(local + delta)))
}

function spawnOne(w: World, minDist = SPAWN_RING, maxDist = SPAWN_RING + 140) {
  const ang = w.rng() * Math.PI * 2
  const dist = minDist + w.rng() * (maxDist - minDist)
  const x = Math.max(0, w.x + Math.cos(ang) * dist) // never spawn behind the shallow edge
  const y = Math.max(0, Math.min(WORLD_H, w.y + Math.sin(ang) * dist)) // stay in the vertical band
  const tier = pickTier(w, x) // sized by the depth it appears at
  const dvAng = w.rng() * Math.PI * 2
  const dv = w.rng() * CREATURE_DRIFT
  w.creatures.push({
    id: w.nextId++,
    x, y,
    vx: Math.cos(dvAng) * dv,
    vy: Math.sin(dvAng) * dv,
    tier,
    size: LADDER[tier].size,
    element: pickElement(w),
    wanderT: 1 + w.rng() * 3,
    school: 0,
  })
}

// spawn a whole SHOAL of small fish: a cluster of one colour + tier, sharing a heading, that flocks
function spawnSchool(w: World) {
  const ang = w.rng() * Math.PI * 2
  const dist = SPAWN_RING + w.rng() * 160
  const cx = Math.max(60, w.x + Math.cos(ang) * dist)
  const cy = Math.max(0, Math.min(WORLD_H, w.y + Math.sin(ang) * dist))
  const tier = Math.max(0, Math.min(APEX_TIER, Math.round(depthTier(cx) - 1))) // the small fish of this depth
  const element = pickElement(w)
  const sid = w.nextId++ // reserve a shoal id
  const n = SCHOOL_MIN + Math.floor(w.rng() * (SCHOOL_MAX - SCHOOL_MIN + 1))
  const hAng = w.rng() * Math.PI * 2 // the shoal's shared travel heading
  for (let i = 0; i < n; i++) {
    w.creatures.push({
      id: w.nextId++,
      x: Math.max(0, cx + (w.rng() - 0.5) * 70),
      y: Math.max(0, Math.min(WORLD_H, cy + (w.rng() - 0.5) * 70)),
      vx: Math.cos(hAng) * CREATURE_DRIFT,
      vy: Math.sin(hAng) * CREATURE_DRIFT,
      tier, size: LADDER[tier].size,
      element, // a shoal is one colour
      wanderT: 1 + w.rng() * 3,
      school: sid,
    })
  }
}

// one schooler's flocking: cohere/align/separate with shoal-mates, bolt from you or any bigger fish
function flock(w: World, c: Creature, dt: number) {
  let cxs = 0, cys = 0, hxs = 0, hys = 0, sepx = 0, sepy = 0, n = 0
  let flx = 0, fly = 0 // accumulated flee (from the player + predators)
  const percept2 = SCHOOL_PERCEPT * SCHOOL_PERCEPT
  const scatter2 = SCATTER_R * SCATTER_R
  for (const o of w.creatures) {
    if (o === c) continue
    const ox = o.x - c.x, oy = o.y - c.y
    const d2 = ox * ox + oy * oy
    if (o.school === c.school) {
      if (d2 > percept2) continue
      cxs += o.x; cys += o.y; hxs += o.vx; hys += o.vy; n++
      if (d2 < SCHOOL_SEP * SCHOOL_SEP) { const d = Math.sqrt(d2) || 1; sepx -= ox / d; sepy -= oy / d }
    } else if (o.size > c.size * 1.35 && d2 < scatter2) {
      const d = Math.sqrt(d2) || 1; flx -= (ox / d) * (1 - d / SCATTER_R); fly -= (oy / d) * (1 - d / SCATTER_R) // bolt from a predator
    }
  }
  if (n > 0) {
    const ccx = cxs / n - c.x, ccy = cys / n - c.y, cl = Math.hypot(ccx, ccy) || 1
    const ah = Math.hypot(hxs, hys) || 1
    c.vx += (ccx / cl) * W_COHESION + (hxs / ah) * W_ALIGN + sepx * W_SEPARATION
    c.vy += (ccy / cl) * W_COHESION + (hys / ah) * W_ALIGN + sepy * W_SEPARATION
  } else {
    c.wanderT -= dt
    if (c.wanderT <= 0) { const a = w.rng() * Math.PI * 2; c.vx = Math.cos(a) * CREATURE_DRIFT; c.vy = Math.sin(a) * CREATURE_DRIFT; c.wanderT = 1 + w.rng() * 3 }
  }
  // bolt from the player too, if it could eat this fish
  const pdx = c.x - w.x, pdy = c.y - w.y, pd = Math.hypot(pdx, pdy)
  if (pd < SCATTER_R && w.size > c.size * (1 - EQUAL_BAND)) { flx += (pdx / (pd || 1)) * (1 - pd / SCATTER_R); fly += (pdy / (pd || 1)) * (1 - pd / SCATTER_R) }
  c.vx += flx * SCATTER_FORCE * dt
  c.vy += fly * SCATTER_FORCE * dt
  // cap so a scattering shoal streaks but doesn't teleport
  const sp = Math.hypot(c.vx, c.vy), cap = CREATURE_DRIFT * 2.4
  if (sp > cap) { c.vx = (c.vx / sp) * cap; c.vy = (c.vy / sp) * cap }
  c.x += c.vx * dt; c.y += c.vy * dt
  if (c.y < 0) { c.y = 0 } else if (c.y > WORLD_H) { c.y = WORLD_H }
}

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed >>> 0)
  const w: World = {
    x: START_X, // begin in the shallows (left) — the deep is the journey right
    y: WORLD_H / 2,
    vx: 0,
    vy: 0,
    hx: 0,
    hy: 0,
    mass: 0,
    tier: START_TIER,
    size: LADDER[START_TIER].size,
    branch: null,
    creatures: [],
    eaten: 0,
    score: 0,
    t: 0,
    maxX: START_X,
    endReason: null,
    state: 'ready',
    spawnPaused: false,
    nextId: 1,
    rng,
  }
  // seed the ocean so the first frame already has life IN VIEW around the player
  for (let i = 0; i < TARGET_CREATURES; i++) spawnOne(w, SEED_MIN, SEED_MAX)
  return w
}

// heading points where the player wants to drift (e.g. pointer-minus-player, or WASD).
// magnitude is clamped to 1; (0,0) = coast. First real heading launches the run.
export function setHeading(w: World, dx: number, dy: number) {
  const m = Math.hypot(dx, dy)
  if (m > 1e-4) {
    const c = Math.min(1, m) / m
    w.hx = dx * c
    w.hy = dy * c
    if (w.state === 'ready') w.state = 'playing'
  } else {
    w.hx = 0
    w.hy = 0
  }
}

// test/utility: drop a creature into the field at an exact spot + tier.
export function addCreature(w: World, x: number, y: number, tier: number, element: ElementId): Creature {
  const c: Creature = { id: w.nextId++, x, y, vx: 0, vy: 0, tier, size: LADDER[tier].size, element, wanderT: 2, school: 0 }
  w.creatures.push(c)
  return c
}

// evolve while mass clears the current tier's threshold (can chain). Updates size.
function evolveCheck(w: World, ev: TickEvents) {
  while (w.tier < APEX_TIER && w.mass >= LADDER[w.tier].evolveAt) {
    w.tier++
    w.size = LADDER[w.tier].size
    ev.grew = true
  }
}

function eat(w: World, c: Creature, ev: TickEvents) {
  w.mass += c.size * FOOD_PER_SIZE
  w.eaten++
  ev.ate = true
  if (!w.branch) {
    w.branch = c.element // the wedge: first eaten element locks the branch
    ev.forkLocked = c.element
  }
  evolveCheck(w, ev)
}

// Advance dt seconds. Returns events for sound/FX. No-op unless playing.
export function tick(w: World, dt: number): TickEvents {
  const ev = noEvents()
  if (w.state !== 'playing') return ev

  // ── the 3-minute clock: run ends when it hits zero (score = how deep you got) ──
  w.t += dt
  if (w.t >= MATCH_TIME) {
    w.maxX = Math.max(w.maxX, w.x)
    w.state = 'dead'; w.endReason = 'time'; ev.timeup = true
    w.score = depthScore(w)
    return ev
  }

  // ── player drift: ease toward heading, bleed with drag, cap by tier ───────────
  w.vx += w.hx * ACCEL * dt
  w.vy += w.hy * ACCEL * dt
  const decay = Math.max(0, 1 - DRAG * dt)
  w.vx *= decay
  w.vy *= decay
  const sp = Math.hypot(w.vx, w.vy)
  const mv = maxSpeed(w.tier)
  if (sp > mv) {
    const k = mv / sp
    w.vx *= k
    w.vy *= k
  }
  // soft edges: a cushion that ramps up near the surface / seafloor / shallow shelf, so you decelerate
  // into the bound and glide to a stop instead of slamming an invisible wall (the render draws them).
  if (w.y < EDGE_SOFT) w.vy += (1 - w.y / EDGE_SOFT) * EDGE_PUSH * dt
  else if (w.y > WORLD_H - EDGE_SOFT) w.vy -= (1 - (WORLD_H - w.y) / EDGE_SOFT) * EDGE_PUSH * dt
  if (w.x < EDGE_SOFT) w.vx += (1 - w.x / EDGE_SOFT) * EDGE_PUSH * dt
  w.x += w.vx * dt
  w.y += w.vy * dt
  // the drift current carries the body along the water (advection, on top of your own swim)
  const [pcx, pcy] = current(w.x, w.y, w.t)
  w.x += pcx * dt
  w.y += pcy * dt
  // hard backstop at the exact bound (the cushion should have caught you first) — stop, don't bounce.
  // NO right wall — the deep is endless; how far right you push IS the score.
  if (w.x < 0) { w.x = 0; if (w.vx < 0) w.vx = 0 }
  if (w.y < 0) { w.y = 0; if (w.vy < 0) w.vy = 0 }
  if (w.y > WORLD_H) { w.y = WORLD_H; if (w.vy > 0) w.vy = 0 }
  if (w.x > w.maxX) w.maxX = w.x // deepest point reached

  // ── ocean life: shoals flock (boids) + scatter; lone fish wander + lean ────────
  for (const c of w.creatures) {
    if (c.school > 0) { flock(w, c, dt); continue }
    c.wanderT -= dt
    if (c.wanderT <= 0) {
      const a = w.rng() * Math.PI * 2
      const dv = w.rng() * CREATURE_DRIFT
      c.vx = Math.cos(a) * dv
      c.vy = Math.sin(a) * dv
      c.wanderT = 1 + w.rng() * 3
    }
    const dx = w.x - c.x
    const dy = w.y - c.y
    const d = Math.hypot(dx, dy) || 1
    // bigger-than-you creatures drift toward you (the hunt); smaller flee (the chase)
    const lean = c.size > w.size * (1 + EQUAL_BAND) ? THREAT_HOMING : c.size < w.size * (1 - EQUAL_BAND) ? -THREAT_HOMING : 0
    c.vx += (dx / d) * lean * dt
    c.vy += (dy / d) * lean * dt
    c.x += c.vx * dt
    c.y += c.vy * dt
  }

  // the current carries every creature too (schoolers included) — the whole ocean drifts as one body
  // of water, so shoals ride a stream together and the field around you moves with the water you feel
  for (const c of w.creatures) {
    const [ccx, ccy] = current(c.x, c.y, w.t)
    c.x += ccx * dt
    c.y += ccy * dt
    // ocean life honors the same surface/floor — a gentle steer-back so nothing swims through a
    // bound the player can't (no more "the fish ignore the walls while you slam them")
    if (c.y < EDGE_SOFT) c.vy += (1 - c.y / EDGE_SOFT) * EDGE_PUSH * 0.3 * dt
    else if (c.y > WORLD_H - EDGE_SOFT) c.vy -= (1 - (WORLD_H - c.y) / EDGE_SOFT) * EDGE_PUSH * 0.3 * dt
    if (c.y < 0) c.y = 0
    else if (c.y > WORLD_H) c.y = WORLD_H
  }

  // ── eat resolution: overlap the player vs each creature ───────────────────────
  for (let i = w.creatures.length - 1; i >= 0; i--) {
    const c = w.creatures[i]
    const reach = (w.size + c.size) * EAT_REACH
    if (Math.hypot(c.x - w.x, c.y - w.y) > reach) continue
    const ratio = c.size / w.size
    if (ratio < 1 - EQUAL_BAND) {
      // smaller → swallow it
      w.creatures.splice(i, 1)
      eat(w, c, ev)
    } else if (ratio > 1 + EQUAL_BAND) {
      // bigger → it eats you, run ends early
      w.state = 'dead'
      ev.eaten = true
      w.endReason = 'eaten'
      w.score = depthScore(w)
      return ev
    } else {
      // roughly equal → a bump, push apart so they don't sit overlapped
      const dx = w.x - c.x
      const dy = w.y - c.y
      const d = Math.hypot(dx, dy) || 1
      const push = (reach - d) * 0.5
      w.x += (dx / d) * push
      w.y += (dy / d) * push
      c.x -= (dx / d) * push
      c.y -= (dy / d) * push
      ev.bumped = true
    }
  }

  // ── recycle drifted-away life + top the ocean back up ─────────────────────────
  if (!w.spawnPaused) {
    for (let i = w.creatures.length - 1; i >= 0; i--) {
      const c = w.creatures[i]
      if (Math.hypot(c.x - w.x, c.y - w.y) > DESPAWN_R) w.creatures.splice(i, 1)
    }
    let added = 0
    while (w.creatures.length < TARGET_CREATURES && added < SPAWN_PER_TICK) {
      if (w.rng() < SCHOOL_CHANCE) { spawnSchool(w); added += 3 } // a shoal fills more of the field at once
      else { spawnOne(w); added++ }
    }
  }

  w.score = depthScore(w)
  return ev
}

// the placeholder apex name the current branch is climbing toward (null pre-fork).
export function apexName(w: World): string | null {
  return w.branch ? APEX_BY_ELEMENT[w.branch] : null
}

// ── best-score persistence (localStorage) — gives the run a chase ─────────────────
const BEST_KEY = 'driftling.best'
export function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0
  } catch {
    return 0 // storage unavailable
  }
}
// store the score if it beats the saved best; returns the (possibly new) best.
export function saveBest(score: number): number {
  const best = Math.max(loadBest(), Math.max(0, Math.floor(score)))
  try {
    localStorage.setItem(BEST_KEY, String(best))
  } catch {
    /* storage unavailable */
  }
  return best
}
