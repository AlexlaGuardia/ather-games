// BETA M243 (sprites, 2026-11-27): THE FAIR BENCH, /shimmer/dev?mode=fair (owner: the /shimmer/dev gate, src/proxy.ts).
// Alex 11-27 13:37: "the three Fair events in one place ... watch and tune all three side by side". The pure half: entrants at
// any species / form / level, the Clash runner that logs every engine tick, the sim's odds for a pair, the Dash heat (and the same
// heat headless), the Smash swing, all SEEDED (same seed = same result). Nothing here reaches the server: the bench calls the
// pure engines only, and noWriteFetch() refuses any write to /api while the bench is open (no prize, no Marks, no board rows,
// no tries spent). Pure; no React.
import { createSpirit, spiritFormName, type Spirit, type Species, type Element } from '../../spirits/spirit'
import { derivePartyStats } from '../../engine/party-stats'
import { createFight, runFight, resolveBonded, bondSeed, type Entrant, type TickLog, type FightEvent } from '../../open/ather/clash-fight'
import { liveBout, type BoutRunner, type BoutSide } from '../../open/ather/clash-bout'
import { EVEN_SEED, EVEN_BOND, clashPool, CLASH_SPECIES } from '../../open/ather/fair-clash'
import { TENT_LEVEL, type ClashTier } from '../../open/ather/fair-clash-rules'
import { startState, step as dashStep, seeded, fillIn, type Racer, type RunState } from '../../open/ather/fair-dash-race'
import { RACE_STATS, type RaceStats } from '../../open/ather/fair-dash-rules'
import { statValue, type StatRec } from '../../open/ather/spirit-stats'
import { MAX_GROWN } from '../../open/ather/spirit-growth'
import { smashSwing } from '../../open/ather/smash-score'   // M246: the bell's score

export const FAIR_SPECIES: readonly Species[] = CLASH_SPECIES
export const FAIR_FORMS: readonly Element[] = ['base', 'mana', 'storm', 'earth', 'water']
export const LEVEL_MIN = 1, LEVEL_MAX = 99
export const SPEEDS = [1, 2, 4] as const
export const DEFAULT_LEVEL = { easy: TENT_LEVEL.easy, average: TENT_LEVEL.average } as const
export type BenchTier = 'easy' | 'average'
export const clampLevel = (n: number) => Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(Number.isFinite(n) ? n : 1)))

export interface Pick { species: Species; element: Element; level: number }
export const pickName = (p: Pick) => spiritFormName(p.species, p.element)

// ── CLASH ──
/** the tent's evened battle Spirit (fair-clash.ts evenSpirit) at ANY level: even seeds, neutral temperament, even bond */
export function devSpirit(p: Pick, name = pickName(p)): Spirit {
  const s = createSpirit(p.species, name, 0, 0)
  s.level = clampLevel(p.level)
  s.seeds = Array.from({ length: 6 }, () => EVEN_SEED)
  s.temperament = 'neutral'
  s.bond = EVEN_BOND
  s.element = p.element
  s.hpFrac = 1
  s.heldItem = undefined
  return s
}
/** the engine's entrant from a battle Spirit, at HER level (the game's fightRunner evens to the tent level instead) */
export function entrantOf(s: Spirit, bonded?: BoutSide['bonded'], known?: readonly string[]): Entrant {
  return { species: s.species, element: (s.element ?? 'base') as Element, level: s.level, stats: derivePartyStats(s), bonded, name: s.name, known }
}
export const devEntrant = (p: Pick) => entrantOf(devSpirit(p))

/** a bout's seed in the ring is line*1000 + bout (clash-ring.tsx); the bench's log keys on the bout */
export const boutOf = (seed: number) => seed % 1000
/** the bench's Clash runner: the LIVE engine (clash-bout.ts liveBout, as fightRunner) at each spirit's own level, every tick to `onTick` */
export function devClashRunner(onTick: (bout: number, l: TickLog, names: [string, string]) => void): BoutRunner {
  return {
    name: 'clash-fight-dev',
    run(a, b, o) {
      const ea = entrantOf(a.spirit, a.bonded, a.known), eb = entrantOf(b.spirit, b.bonded, b.known)
      const seed = o.seed ?? 1, bout = boutOf(seed), names: [string, string] = [ea.name ?? '', eb.name ?? '']
      return { ...liveBout(createFight(ea, eb, seed), 1.2, l => onTick(bout, l, names)), bonded: { a: resolveBonded(ea, bondSeed(seed, 0)), b: resolveBonded(eb, bondSeed(seed, 1)) } }
    },
  }
}
/** the opponents: `n` from the tier's pool, no species twice (seeded, as a tent's line-up) */
export function randomFoes(tier: BenchTier, seed: number, n = 3, level = DEFAULT_LEVEL[tier]): Pick[] {
  const pool = clashPool(tier), r = seeded(seed * 7919 + 17), out: Pick[] = [], left = [...pool]
  while (out.length < n && left.length) {
    const f = left.splice(Math.floor(r() * left.length), 1)[0]
    if (!out.some(o => o.species === f.species)) out.push({ species: f.species, element: f.element, level })
  }
  return out
}

/** one line of the event log (a tick's events in words; plain functional labels, for @lark) */
export function logLine(t: number, e: FightEvent, names: [string, string]): string {
  const who = names[e.side], foe = names[1 - e.side]
  const mv = e.moveId ? ` (${e.moveId})` : e.move ? ` (${e.move})` : ''
  const ts = `${t.toFixed(2).padStart(6)}s`
  switch (e.kind) {
    case 'start': return `${ts} ${who} starts${mv}`   // a wind-up / an evade / a guard begins
    case 'hit': return `${ts} ${who} hits ${foe}${mv} -${Math.round(e.dmg ?? 0)}${e.clean ? ' clean' : ''}`
    case 'miss': return `${ts} ${who} misses${mv}`
    case 'evaded': return `${ts} ${foe} evades ${who}${mv}`
    case 'guarded': return `${ts} ${foe} guards ${who}${mv}${e.dmg ? ` -${Math.round(e.dmg)}` : ''}`
    case 'rider': return `${ts} ${who} ${e.rider ?? 'rider'}${mv}`
    case 'cheer': return `${ts} ${who} cheered`
    case 'ko': return `${ts} ${who} down`
    case 'end': return `${ts} end: ${who} wins`
    default: return `${ts} ${who} ${String(e.kind)}${mv}`   // an event kind added later reads as its name
  }
}

/** the sim's odds for a pair (clash-sim.mts's loop): `n` seeded fights, sides swapped every other one, no cheers. a's win share. */
export interface Odds { n: number; aWins: number; meanS: number; timeouts: number }
export function clashOdds(a: Entrant, b: Entrant, n = 200, seed0 = 1, from = 0, acc: Odds = { n: 0, aWins: 0, meanS: 0, timeouts: 0 }): Odds {
  let { aWins, timeouts } = acc, sum = acc.meanS * acc.n
  for (let i = from; i < n; i++) {
    const swap = i % 2 === 1, r = swap ? runFight(b, a, seed0 + i) : runFight(a, b, seed0 + i)
    if ((r.winner === 0) !== swap) aWins++
    if (r.reason === 'time') timeouts++
    sum += r.seconds
  }
  const done = acc.n + Math.max(0, n - from)
  return { n: done, aWins, meanS: done ? sum / done : 0, timeouts }
}

// ── DASH ──
/** the garden's stat record for a spirit at a level (level = 1 + growths, as fair-smash.ts reads it), no training */
export const recAt = (level: number): StatRec => ({ form: 'base', g: {}, plays: 0, xp: 0, grown: Math.max(0, Math.min(MAX_GROWN, clampLevel(level) - 1)) })
export function raceStats(sp: Species, level: number): RaceStats {
  const rec = recAt(level)
  return Object.fromEntries(RACE_STATS.map(k => [k, Math.round(statValue(sp, rec, k) * 10) / 10])) as RaceStats
}
export interface HeatEntry extends Racer { who: string; name: string; you?: boolean }
/** the heat: hers in the middle lane (as dash-panel.tsx), the others picked, or the panel's own fair entrants (seeded) */
export function devHeat(me: Pick, others: Pick[] | null, seed: number, n = 5): HeatEntry[] {
  const mine: HeatEntry = { who: 'you', you: true, name: pickName(me), species: me.species, element: me.element, stats: raceStats(me.species, me.level) }
  const rest: HeatEntry[] = others
    ? others.slice(0, n - 1).map(p => ({ who: 'picked', name: pickName(p), species: p.species, element: p.element, stats: raceStats(p.species, p.level) }))
    : fillIn(FAIR_SPECIES, sp => raceStats(sp as Species, 1), seed, n - 1).map(r => ({ ...r, who: 'entrant', name: spiritFormName(r.species as Species, null) }))
  const racers = [...rest]; racers.splice(Math.floor(rest.length / 2), 0, mine)
  return racers
}
/** dash-view.tsx's fixed step (its SUB); the view runs the bench's race in these steps, so the headless heat matches it */
export const DASH_SUB = 0.05
/** the same heat headless: the view's loop (rolls seeded(seed + i*7919), fixed DASH_SUB steps, no cheer). Each racer's time (ms). */
export function runHeat(racers: Racer[], seed: number, maxS = 600): { ms: (number | null)[]; winner: number } {
  const rolls = racers.map((_, i) => seeded(seed + i * 7919))
  let S: RunState[] = racers.map(() => startState())
  for (let t = 0; t < maxS && !S.every(s => s.fin != null); t += DASH_SUB) S = S.map((s, i) => dashStep(racers[i], s, DASH_SUB, rolls[i]))
  const ms = S.map(s => (s.fin != null ? Math.round(s.fin * 1000) : null))
  let winner = 0
  ms.forEach((m, i) => { if (m != null && (ms[winner] == null || m < ms[winner]!)) winner = i })
  return { ms, winner }
}

// ── SMASH ──
/** one swing at the bell (M246 smash-score.ts smashSwing: her strongest known move) at her level, the roll seeded */
export const devSmash = (p: Pick, seed: number) => smashSwing(p.species, recAt(p.level), p.element, {}, seeded(seed))

// ── NO WRITES ──
/** a request that would write server rows: any non-GET (or a beacon) to this site's /api */
export function isWrite(url: string, method = 'GET', origin = 'https://ather.games'): boolean {
  let path = url
  try { const u = new URL(url, origin); if (u.origin !== new URL(origin).origin) return false; path = u.pathname } catch { return false }
  return path.startsWith('/api/') && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD'
}
type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
/** wrap fetch: a write to /api answers 403 {error} WITHOUT reaching the server, and is reported; everything else passes */
export function noWriteFetch(real: FetchFn, onBlock: (url: string, method: string) => void, origin?: string): FetchFn {
  return (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')
    if (isWrite(url, method, origin)) { onBlock(url, method); return Promise.resolve(new Response(JSON.stringify({ error: 'dev bench: no writes' }), { status: 403, headers: { 'content-type': 'application/json' } })) }
    return real(input, init)
  }
}
/** install the guard on a window (fetch + sendBeacon) while the bench is open; returns the undo */
export function installNoWrites(w: { fetch: FetchFn; navigator: { sendBeacon?: (u: string | URL, d?: unknown) => boolean }; location: { origin: string } }, onBlock: (url: string, method: string) => void): () => void {
  const f = w.fetch, b = w.navigator.sendBeacon
  w.fetch = noWriteFetch(f.bind(w as never), onBlock, w.location.origin)
  if (b) w.navigator.sendBeacon = (u, d) => { const s = String(u); if (isWrite(s, 'POST', w.location.origin)) { onBlock(s, 'BEACON'); return false } return b.call(w.navigator, u, d as never) }
  return () => { w.fetch = f; if (b) w.navigator.sendBeacon = b }
}
export const tierOf = (level: number): ClashTier => (level >= TENT_LEVEL.average ? 'average' : 'easy')
