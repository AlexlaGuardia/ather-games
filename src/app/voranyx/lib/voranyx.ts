// VORANYX — the Silt arena. You are a Voranyx: a worm of living Ather-light, born a
// blank elementless thread, that grows only by eating and holds its size only by
// eating still. Take your colour from your first Mana Seed, graze the dross and the
// bubbles of the fallen, boost on motes, and don't run your head into anyone's body.
// The void ring closes; the Silt gets crowded. (Canon: world/voranyx.md in /athernyx.)
//
// Pure sim — no canvas, no React. Deterministic from a seed (mulberry32). The page
// drives it with steer()/setBoost()/tick() and renders from the returned state.

import { mulberry32, randInt, type Rng } from '@/lib/arcade/rng'

export type Element = 'mana' | 'storm' | 'earth' | 'water'
export const ELEMENTS: Element[] = ['mana', 'storm', 'earth', 'water']

// ── tuning ──────────────────────────────────────────────────────────────────────
export const ARENA_R0 = 1500 // starting void-ring radius — a big opening Silt to roam
export const ARENA_RMIN = 560 // the ring never closes tighter than this (was 380 — too cramped for a mid-game worm)
export const ARENA_SHRINK = 6.5 // units/sec the void creeps in — slower, so the squeeze is a late-game pressure not a 70s guillotine

export const BASE_MASS = 8 // the blank thread — you can't shrink below this
export const START_MASS = 16
export const SPEED = 96 // units/sec cruising
export const BOOST_SPEED = 172
export const TURN_RATE = 3.4 // rad/sec the heading chases your target

export const BOOST_MAX = 100
export const BOOST_DRAIN = 46 // charge/sec while boosting
export const MOTE_CHARGE = 22 // charge per mote eaten

// metabolism: bigger worms burn faster, so growth has a ceiling you must feed —
// gentle enough that steady eating WINS, harsh enough that idling shrinks you
export const METAB_FLAT = 0.15
export const METAB_PROP = 0.004

export const DROSS_MASS = 1.0
export const SEED_MASS = 3.0
export const BUBBLE_MASS = 1.1

const SEG_SPACING = 6 // trail point spacing (world units)
const FOOD_TARGET = 480 // ambient food the arena tries to keep stocked (dense = growth feels good); scaled up with the bigger arena to keep density

export interface FoodItem {
  x: number
  y: number
  kind: 'dross' | 'seed' | 'mote'
  element?: Element // seeds carry an element (colour)
}

export interface Wyrm {
  id: number
  isPlayer: boolean
  x: number
  y: number
  angle: number // current heading
  target: number // desired heading (player sets via steer)
  mass: number
  element: Element | null // null = blank/elementless (white)
  boost: number // boost charge
  boosting: boolean
  alive: boolean
  trail: number[] // flat [x0,y0,x1,y1,...], head-first
  _acc: number // distance accumulator for trail sampling
  _wander: number // ai wander timer
}

export type GameState = 'playing' | 'over'

export interface World {
  wyrms: Wyrm[]
  food: FoodItem[]
  radius: number // current void-ring radius
  t: number
  nextId: number
  state: GameState
  rng: Rng
}

export interface TickEvents {
  ate: number // food the player ate this frame
  seed: boolean // player ate a seed (colour) this frame
  killed: number // rival wyrms the player felled this frame
  died: boolean // player died this frame
}

// segments a wyrm's mass buys (its visible length)
export function segCount(mass: number): number {
  return Math.max(6, Math.round(mass * 1.6))
}
export function bodyRadius(mass: number): number {
  return 4 + Math.sqrt(mass) * 1.15
}

function spawnWyrm(w: World, isPlayer: boolean): Wyrm {
  const r = w.rng() * (w.radius * 0.7)
  const a = w.rng() * Math.PI * 2
  const x = Math.cos(a) * r
  const y = Math.sin(a) * r
  const ang = w.rng() * Math.PI * 2
  return {
    id: w.nextId++,
    isPlayer,
    x,
    y,
    angle: ang,
    target: ang,
    mass: isPlayer ? START_MASS : START_MASS + randInt(w.rng, -4, 22),
    element: null,
    boost: BOOST_MAX,
    boosting: false,
    alive: true,
    trail: [x, y],
    _acc: 0,
    _wander: 0,
  }
}

function scatterFood(w: World, n: number) {
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(w.rng()) * (w.radius * 0.95)
    const a = w.rng() * Math.PI * 2
    const roll = w.rng()
    const kind: FoodItem['kind'] = roll < 0.12 ? 'seed' : roll < 0.24 ? 'mote' : 'dross'
    const item: FoodItem = { x: Math.cos(a) * r, y: Math.sin(a) * r, kind }
    if (kind === 'seed') item.element = ELEMENTS[randInt(w.rng, 0, 3)]
    w.food.push(item)
  }
}

export function makeWorld(seed: number, aiCount = 6): World {
  const w: World = {
    wyrms: [],
    food: [],
    radius: ARENA_R0,
    t: 0,
    nextId: 0,
    state: 'playing',
    rng: mulberry32(seed >>> 0),
  }
  w.wyrms.push(spawnWyrm(w, true))
  for (let i = 0; i < aiCount; i++) w.wyrms.push(spawnWyrm(w, false))
  scatterFood(w, FOOD_TARGET)
  return w
}

export function player(w: World): Wyrm | undefined {
  return w.wyrms.find((x) => x.isPlayer)
}

// point the player's worm toward a world heading (radians)
export function steer(w: World, angle: number) {
  const p = player(w)
  if (p && p.alive) p.target = angle
}
export function setBoost(w: World, on: boolean) {
  const p = player(w)
  if (p && p.alive) p.boosting = on
}

function turnToward(a: number, target: number, maxStep: number): number {
  let d = target - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  if (d > maxStep) d = maxStep
  if (d < -maxStep) d = -maxStep
  return a + d
}

// burst a fallen wyrm into bubbles along its body (food for the survivors)
function burst(w: World, victim: Wyrm) {
  const step = 4
  for (let i = 0; i < victim.trail.length; i += 2 * step) {
    if (w.rng() < 0.6) w.food.push({ x: victim.trail[i] + (w.rng() - 0.5) * 8, y: victim.trail[i + 1] + (w.rng() - 0.5) * 8, kind: 'dross' })
  }
  // a couple of motes + a seed in its colour, as a reward
  w.food.push({ x: victim.x, y: victim.y, kind: 'mote' })
  if (victim.element) w.food.push({ x: victim.x + 6, y: victim.y, kind: 'seed', element: victim.element })
}

// nearest food to a point (for AI); returns index or -1
function nearestFood(w: World, x: number, y: number, maxD: number): number {
  let best = -1
  let bd = maxD * maxD
  for (let i = 0; i < w.food.length; i++) {
    const dx = w.food[i].x - x
    const dy = w.food[i].y - y
    const d = dx * dx + dy * dy
    if (d < bd) { bd = d; best = i }
  }
  return best
}

function aiThink(w: World, s: Wyrm, dt: number) {
  // seek nearest food; veer from the void edge; occasional wander
  s._wander -= dt
  const distC = Math.hypot(s.x, s.y)
  if (distC > w.radius - 60) {
    // steer back toward center, hard
    s.target = Math.atan2(-s.y, -s.x)
    s.boosting = s.boost > 20 && distC > w.radius - 30
    return
  }
  const fi = nearestFood(w, s.x, s.y, 260)
  if (fi >= 0) {
    s.target = Math.atan2(w.food[fi].y - s.y, w.food[fi].x - s.x)
    s.boosting = w.food[fi].kind === 'seed' && s.boost > 40 && w.rng() < 0.02
  } else if (s._wander <= 0) {
    s.target = s.angle + (w.rng() - 0.5) * 1.4
    s._wander = 0.6 + w.rng() * 1.2
    s.boosting = false
  }
}

function eatFoodNear(w: World, s: Wyrm): { ate: number; seed: boolean; motes: number } {
  const r = bodyRadius(s.mass) + 9
  const r2 = r * r
  let ate = 0
  let seed = false
  let motes = 0
  for (let i = w.food.length - 1; i >= 0; i--) {
    const f = w.food[i]
    const dx = f.x - s.x
    const dy = f.y - s.y
    if (dx * dx + dy * dy > r2) continue
    if (f.kind === 'mote') {
      s.boost = Math.min(BOOST_MAX, s.boost + MOTE_CHARGE)
      motes++
    } else if (f.kind === 'seed') {
      s.mass += SEED_MASS
      if (!s.element && f.element) s.element = f.element // first seed paints you
      seed = true
      ate++
    } else {
      s.mass += DROSS_MASS
      ate++
    }
    w.food[i] = w.food[w.food.length - 1]
    w.food.pop()
  }
  return { ate, seed, motes }
}

// does point (px,py) hit wyrm s's body (excluding the very neck)? returns true/false
function hitsBody(s: Wyrm, px: number, py: number, headR: number): boolean {
  const br = bodyRadius(s.mass)
  const rr = (br + headR) * (br + headR)
  // skip the first few trail points (the neck) so you don't clip yourself / adjacents
  for (let i = 10; i < s.trail.length; i += 2) {
    const dx = s.trail[i] - px
    const dy = s.trail[i + 1] - py
    if (dx * dx + dy * dy <= rr) return true
  }
  return false
}

export function tick(w: World, dt: number): TickEvents {
  const ev: TickEvents = { ate: 0, seed: false, killed: 0, died: false }
  if (w.state === 'over') return ev

  // void ring creeps in
  w.t += dt
  w.radius = Math.max(ARENA_RMIN, w.radius - ARENA_SHRINK * dt)

  for (const s of w.wyrms) {
    if (!s.alive) continue
    if (!s.isPlayer) aiThink(w, s, dt)

    // turn + move
    s.angle = turnToward(s.angle, s.target, TURN_RATE * dt)
    const canBoost = s.boosting && s.boost > 0 && s.mass > BASE_MASS + 2
    const spd = canBoost ? BOOST_SPEED : SPEED
    if (canBoost) s.boost = Math.max(0, s.boost - BOOST_DRAIN * dt)
    s.x += Math.cos(s.angle) * spd * dt
    s.y += Math.sin(s.angle) * spd * dt

    // metabolism — sublimate toward the blank thread unless fed
    s.mass = Math.max(BASE_MASS, s.mass - (METAB_FLAT + s.mass * METAB_PROP) * dt)
    if (s.mass <= BASE_MASS + 0.01) s.element = null // reverted to blank

    // trail sampling
    s._acc += spd * dt
    if (s._acc >= SEG_SPACING) {
      s._acc = 0
      s.trail.unshift(s.x, s.y)
    } else {
      s.trail[0] = s.x
      s.trail[1] = s.y
    }
    const maxLen = segCount(s.mass) * 2
    if (s.trail.length > maxLen) s.trail.length = maxLen

    // eat
    const e = eatFoodNear(w, s)
    if (s.isPlayer) { ev.ate += e.ate; if (e.seed) ev.seed = true }
  }

  // collisions — a head into any other living body kills the head's owner
  const headR = (s: Wyrm) => bodyRadius(s.mass) * 0.8
  for (const s of w.wyrms) {
    if (!s.alive) continue
    // void edge is lethal
    if (Math.hypot(s.x, s.y) > w.radius) {
      s.alive = false
      burst(w, s)
      if (s.isPlayer) ev.died = true
      continue
    }
    for (const o of w.wyrms) {
      if (o === s || !o.alive) continue
      if (hitsBody(o, s.x, s.y, headR(s))) {
        s.alive = false
        burst(w, s)
        if (s.isPlayer) ev.died = true
        else if (o.isPlayer) ev.killed++
        break
      }
    }
  }

  // cull dead, respawn AI to keep the Silt crowded, restock food
  w.wyrms = w.wyrms.filter((s) => s.alive || s.isPlayer)
  const aiAlive = w.wyrms.filter((s) => !s.isPlayer && s.alive).length
  if (aiAlive < 6 && w.rng() < 0.04) w.wyrms.push(spawnWyrm(w, false))
  if (w.food.length < FOOD_TARGET) scatterFood(w, Math.min(6, FOOD_TARGET - w.food.length))

  const p = player(w)
  if (!p || !p.alive) w.state = 'over'
  return ev
}

// length score = mass rounded (the readable "how big did you get")
export function score(w: World): number {
  const p = player(w)
  return p ? Math.round(p.mass) : 0
}

// localStorage best
const HS_KEY = 'voranyx.best'
export function loadBest(): number {
  try { return +(localStorage.getItem(HS_KEY) || 0) || 0 } catch { return 0 }
}
export function saveBest(s: number): number {
  const best = Math.max(s, loadBest())
  try { localStorage.setItem(HS_KEY, String(best)) } catch { /* unavailable */ }
  return best
}
