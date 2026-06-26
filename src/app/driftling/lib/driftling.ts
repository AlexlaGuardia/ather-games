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
export const WORLD_W = 2400
export const WORLD_H = 1800

// ── drift physics (flOw-like: heading nudges, body eases, water drags) ───────────
export const ACCEL = 540 // how hard the body pulls toward the heading
export const DRAG = 1.5 // velocity bleed per second when coasting (languid settle)
export const BASE_MAXV = 240 // top drift speed at the smallest tier
export const TIER_SLOW = 0.06 // each tier up shaves this fraction off max speed (giants are ponderous)
export const MIN_MAXV_FRAC = 0.45 // never slower than this fraction of BASE_MAXV

// ── eating ───────────────────────────────────────────────────────────────────────
// size compare against the player's body. A creature meaningfully smaller is prey;
// meaningfully bigger is a threat; roughly equal just bumps (neither can swallow).
export const EQUAL_BAND = 0.15 // ±15% of player size = a bump, no eat
export const EAT_REACH = 0.7 // bodies must really overlap (fraction of summed radii) to resolve
export const FOOD_PER_SIZE = 1.3 // mass gained = eaten creature's size × this (payoff comes in a few bites)

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
  { key: 'driftling', size: 10, evolveAt: 14 }, // ← START tier (quick first payoff)
  { key: 'silvergill', size: 15, evolveAt: 34 },
  { key: 'coppermouth', size: 22, evolveAt: 64 },
  { key: 'shimmerscale', size: 31, evolveAt: 108 },
  { key: 'glassfin', size: 42, evolveAt: 168 },
  { key: 'silenthunter', size: 55, evolveAt: 250 },
  { key: 'driftwhale', size: 72, evolveAt: 360 },
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
export const TARGET_CREATURES = 32 // how full the visible ocean stays
export const SPAWN_PER_TICK = 2 // gentle top-up so the field doesn't pop in all at once
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
}

const noEvents = (): TickEvents => ({ ate: false, grew: false, forkLocked: null, bumped: false, eaten: false })

function maxSpeed(tier: number): number {
  return BASE_MAXV * Math.max(MIN_MAXV_FRAC, 1 - tier * TIER_SLOW)
}

function pickElement(w: World): ElementId {
  if (w.branch && w.rng() < BRANCH_BIAS) return w.branch
  return ELEMENTS[Math.floor(w.rng() * ELEMENTS.length)].id
}

// choose a creature tier relative to the player's. Threat exposure RAMPS with how far you
// have climbed: the bottom of the ladder is a sheltered nursery (mostly prey + peers, big
// fish rare), the deep end is a gauntlet. Always leaves prey to chase at every station.
export function pickTier(w: World): number {
  const climb = (w.tier - START_TIER) / (APEX_TIER - START_TIER) // 0 at start → 1 at apex
  const pThreat = 0.08 + climb * 0.34 // 8% big-fish near the surface → ~40% in the deep
  const pPrey = 0.6 - climb * 0.22 // lots of prey early, thinning as you grow
  const r = w.rng()
  let delta: number
  if (r < pPrey) delta = w.rng() < 0.45 ? -2 : -1 // prey (some easy, some near-tier)
  else if (r < 1 - pThreat) delta = 0 // a peer (bump)
  else delta = w.rng() < 0.72 ? 1 : 2 // a threat (mostly one tier up, rarely two)
  return Math.max(0, Math.min(APEX_TIER, w.tier + delta))
}

function spawnOne(w: World, minDist = SPAWN_RING, maxDist = SPAWN_RING + 140) {
  const ang = w.rng() * Math.PI * 2
  const dist = minDist + w.rng() * (maxDist - minDist)
  const tier = pickTier(w)
  const dvAng = w.rng() * Math.PI * 2
  const dv = w.rng() * CREATURE_DRIFT
  w.creatures.push({
    id: w.nextId++,
    x: w.x + Math.cos(ang) * dist,
    y: w.y + Math.sin(ang) * dist,
    vx: Math.cos(dvAng) * dv,
    vy: Math.sin(dvAng) * dv,
    tier,
    size: LADDER[tier].size,
    element: pickElement(w),
    wanderT: 1 + w.rng() * 3,
  })
}

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed >>> 0)
  const w: World = {
    x: WORLD_W / 2,
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
  const c: Creature = { id: w.nextId++, x, y, vx: 0, vy: 0, tier, size: LADDER[tier].size, element, wanderT: 2 }
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
  w.x += w.vx * dt
  w.y += w.vy * dt
  // soft world bounds — nudge back, don't hard-stop the drift
  if (w.x < 0) { w.x = 0; w.vx = Math.abs(w.vx) * 0.3 }
  if (w.x > WORLD_W) { w.x = WORLD_W; w.vx = -Math.abs(w.vx) * 0.3 }
  if (w.y < 0) { w.y = 0; w.vy = Math.abs(w.vy) * 0.3 }
  if (w.y > WORLD_H) { w.y = WORLD_H; w.vy = -Math.abs(w.vy) * 0.3 }

  // ── ocean life: gentle wander + a lean toward/away from the player ─────────────
  for (const c of w.creatures) {
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
      // bigger → it eats you, run ends
      w.state = 'dead'
      ev.eaten = true
      w.score = Math.floor(w.mass) + w.tier * 25
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
      spawnOne(w)
      added++
    }
  }

  w.score = Math.floor(w.mass) + w.tier * 25
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
