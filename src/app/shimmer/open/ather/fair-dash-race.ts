// BETA M233 s2: THE DASH RACE, pure (no React, no three): the course, what each section asks of a racer, and one step of a racer
// running it on her own. dash-view.tsx draws it and steps it each frame; the test runs it headless.
// THE COURSE: one straight lane per racer, in SECTIONS that test different things (Alex 11-27), so species + stats + element matter:
//  - run    : her AGI
//  - swim   : her VIG; swimmers (axolotl, frog, turtle, water-bear) glide through, fliers flounder; Water form swims better
//  - climb  : her PWR + AGI; climbers (fox, rabbit) scramble up, the heavy ones (turtle, water-bear) haul; Earth form climbs better
//  - glide  : a GAP. Fliers (owl, hummingbird, bat, firefly) fly it; everyone else goes down into it and back up. Storm form flies better
//  - blocks : three blocks across her lane, broken by her PWR; the heavy ones hit hardest; Earth form hits harder
// Which species is good where is the real animal's (wings fly, swimmers swim, heavy shells break), a game call, not lore.
// PERSONALITY: on the run and climb she may stop to sniff a flower (a calm spirit: GRD over AGI) or trip (a rushing one: AGI over
// VIG), at most MOMENTS times a race. THE CHEER: a burst of speed for CHEER.burst s, CHEER.cooldown s apart; a cheer also ends a stop.
// Stats are compressed (^STAT_EXP): a grown spirit is faster, never a different sport (power = choice, not raw power).
import type { RaceStats } from './fair-dash-rules'

export type SectionKind = 'run' | 'swim' | 'climb' | 'glide' | 'blocks'
export interface Section { kind: SectionKind; len: number; at: number }
/** the season's course, start to finish (metres). Jin's dial. */
const PLAN: readonly [SectionKind, number][] = [['run', 18], ['swim', 22], ['climb', 14], ['glide', 18], ['blocks', 12], ['run', 16]]
export const COURSE: readonly Section[] = PLAN.reduce<Section[]>((a, [kind, len]) => [...a, { kind, len, at: a.length ? a[a.length - 1].at + a[a.length - 1].len : 0 }], [])
export const COURSE_LEN = COURSE[COURSE.length - 1].at + COURSE[COURSE.length - 1].len
/** where the blocks stand inside the blocks section (m from its start), and each block's toughness */
export const BLOCKS = { at: [2.5, 6, 9.5], hp: 150 } as const
/** the climb's rise and the gap's drop, metres (the view's shapes; the sim only needs the kinds) */
export const CLIMB_H = 3.5, GAP_DROP = 2.2

export const FLIERS: readonly string[] = ['owl', 'hummingbird', 'bat', 'firefly']
export const SWIMMERS: readonly string[] = ['axolotl', 'frog', 'turtle', 'water-bear']
export const CLIMBERS: readonly string[] = ['fox', 'rabbit']
export const HEAVY: readonly string[] = ['turtle', 'water-bear']

export const STAT_EXP = 0.3
/** a stat's pull on speed: 1 at the species' typical base (24), concave above */
const pull = (v: number) => Math.pow(Math.max(1, v) / 24, STAT_EXP)
const RUN_V = 4.2
export const CHEER = { burst: 1.6, mult: 1.6, cooldown: 6 } as const
export const MOMENTS = 2
export const STOP = { sniff: 1.4, trip: 0.8 } as const

export interface Racer { species: string; element: string; stats: RaceStats }
export type Doing = SectionKind | 'drop' | 'sniff' | 'trip' | 'done'
export interface RunState {
  d: number          // metres along the course
  t: number          // seconds raced
  doing: Doing
  stop: number       // seconds left in a stop (sniff / trip)
  moments: number
  burst: number      // seconds of cheer burst left
  cool: number       // seconds until the next cheer
  blocks: number[]   // hp left of each block in her lane
  fin: number | null // finish time, s
  split: Partial<Record<SectionKind, number>>   // seconds spent in each kind of section so far (stops included)
}
export const startState = (): RunState => ({ d: 0, t: 0, doing: 'run', stop: 0, moments: 0, burst: 0, cool: 0, blocks: BLOCKS.at.map(() => BLOCKS.hp), fin: null, split: {} })

export const sectionAt = (d: number): Section => COURSE.find(s => d < s.at + s.len) ?? COURSE[COURSE.length - 1]

/** her speed in a section (m/s), before cheer and stops */
export function speedIn(r: Racer, kind: SectionKind): number {
  const { pwr, agi, vig } = r.stats, sp = r.species, el = r.element
  switch (kind) {
    case 'run': return RUN_V * pull(agi) * (HEAVY.includes(sp) ? 0.9 : 1)
    case 'swim': return RUN_V * pull(vig) * (SWIMMERS.includes(sp) ? 1.3 : FLIERS.includes(sp) ? 0.5 : 0.65) * (el === 'water' ? 1.15 : 1)
    case 'climb': return RUN_V * pull((pwr + agi) / 2) * (CLIMBERS.includes(sp) ? 1.25 : HEAVY.includes(sp) ? 0.55 : FLIERS.includes(sp) ? 0.8 : 0.7) * (el === 'earth' ? 1.15 : 1)
    case 'glide': return FLIERS.includes(sp) ? RUN_V * pull(agi) * 1.6 * (el === 'storm' ? 1.15 : 1) : RUN_V * pull(agi) * 0.5
    case 'blocks': return RUN_V * pull(agi) * (HEAVY.includes(sp) ? 0.9 : 1)
  }
}
/** how hard she breaks a block (hp per second) */
export const breakRate = (r: Racer) => 55 * pull(r.stats.pwr) * (HEAVY.includes(r.species) ? 2.6 : 1) * (r.element === 'earth' ? 1.15 : 1)
/** chance per second, on the run and climb, that she stops: [sniff, trip] */
export function momentOdds(r: Racer): [number, number] {
  const { grd, agi, vig } = r.stats
  return [0.05 * Math.min(2, grd / Math.max(1, agi)), 0.035 * Math.min(2, agi / Math.max(1, vig))]
}

/** cheer now? returns the new state (a burst; ends a stop) or the same one when on cooldown / finished */
export function cheer(s: RunState): RunState {
  if (s.cool > 0 || s.fin != null) return s
  return { ...s, burst: CHEER.burst, cool: CHEER.cooldown, stop: 0, doing: s.doing === 'sniff' || s.doing === 'trip' ? sectionAt(s.d).kind : s.doing }
}

/** one step of dt seconds. `rand` = this racer's own roll (seeded by the view, Math.random-free in tests) */
export function step(r: Racer, s0: RunState, dt: number, rand: () => number): RunState {
  if (s0.fin != null) return s0
  const k0 = sectionAt(s0.d).kind
  const s: RunState = { ...s0, blocks: s0.blocks.slice(), t: s0.t + dt, burst: Math.max(0, s0.burst - dt), cool: Math.max(0, s0.cool - dt), split: { ...s0.split, [k0]: (s0.split[k0] ?? 0) + dt } }
  if (s.stop > 0) { s.stop = Math.max(0, s.stop - dt); if (s.stop > 0) return s }
  const sec = sectionAt(s.d)
  // a personality moment (run + climb only)
  if ((sec.kind === 'run' || sec.kind === 'climb') && s.moments < MOMENTS && s.burst <= 0 && s.d > 3) {
    const [sn, tr] = momentOdds(r), roll = rand()
    if (roll < sn * dt) { s.moments++; s.stop = STOP.sniff; s.doing = 'sniff'; return s }
    if (roll < (sn + tr) * dt) { s.moments++; s.stop = STOP.trip; s.doing = 'trip'; return s }
  }
  const mult = s.burst > 0 ? CHEER.mult : 1
  if (sec.kind === 'blocks') {
    const i = s.blocks.findIndex((hp, k) => hp > 0 && s.d >= sec.at + BLOCKS.at[k] - 0.5)
    if (i >= 0) { s.blocks[i] = Math.max(0, s.blocks[i] - breakRate(r) * mult * dt); s.doing = 'blocks'; return s }
    const next = s.blocks.findIndex(hp => hp > 0), wall = next >= 0 ? sec.at + BLOCKS.at[next] - 0.5 : Infinity
    s.d = Math.min(wall, s.d + speedIn(r, 'blocks') * mult * dt)
  } else s.d += speedIn(r, sec.kind) * mult * dt
  s.doing = sec.kind === 'glide' && !FLIERS.includes(r.species) ? 'drop' : sectionAt(s.d).kind
  if (s.d >= COURSE_LEN) { s.fin = s.t - (s.d - COURSE_LEN) / Math.max(0.1, speedIn(r, 'run') * mult); s.d = COURSE_LEN; s.doing = 'done' }
  return s
}

/** a seeded roll per racer (mulberry32) */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** the whole race headless (the test; also how long a section takes a racer): fixed dt, no cheer unless `cheerAt` */
export function runHeadless(r: Racer, seed: number, cheerAt: (s: RunState) => boolean = () => false, dt = 1 / 30): { fin: number; byKind: Record<SectionKind, number> } {
  let s = startState(); const rand = seeded(seed), byKind = { run: 0, swim: 0, climb: 0, glide: 0, blocks: 0 } as Record<SectionKind, number>
  for (let i = 0; i < 100_000 && s.fin == null; i++) { if (cheerAt(s)) s = cheer(s); const k = sectionAt(s.d).kind; s = step(r, s, dt, rand); byKind[k] += dt }
  return { fin: s.fin ?? Infinity, byKind }
}

/** a fair entrant when the ghost pool is thin: a species of the roster at its base stats (seeded, so a heat's fill-ins stay put) */
export function fillIn(species: readonly string[], base: (sp: string) => RaceStats, seed: number, n: number): Racer[] {
  const rand = seeded(seed), out: Racer[] = []
  for (let i = 0; i < n; i++) { const sp = species[Math.floor(rand() * species.length)]; out.push({ species: sp, element: 'base', stats: base(sp) }) }
  return out
}
