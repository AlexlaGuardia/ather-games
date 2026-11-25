// ── WEEKLY SETTLEMENT INFECTIONS, THE ENGINE (BETA M128 s1) ─────────────────────────────────────────────────────────────────
// Canon: CANON_GAPS › Weekly settlement infections + The infection story (RULED, Alex 11-24). One DISCOVERED settlement is
// infected per in-game week, random among those never infected, none while one holds. While it holds: the ground round the homes
// is Hollow ground, its waymark is dark, trade is stopped; homes and folk never grey. Its champion down = saved for good.
// Unanswered it holds; a SECOND in-game week, counted in the keeper's ONLINE time only, loses it: the settlement is gone and its
// ground stays Hollow ground for the season. Seven clues in fixed order, carried across seasons; a lost one's clue goes with its
// folk to the next settlement cleared (the seventh too). The season purge takes everything else.
//
// Clocks (build): the week between infections, and the week one holds before the loss clock starts, run on the open world's own
// day (nodes.ts GAME_DAY_MS on the page's clock), which runs while the keeper is away, like the spread map's. An infection only
// ever STARTS while the keeper plays, so no away time can eat a week of one they never saw. The loss clock counts played ms only.
// ★ PURE but for the guarded load/save (garden-tied, GARDEN_KEY_SPECS: each garden has its own Wilds). No words in here.
import { gardenKey } from '@/lib/keeper-local'
import { GAME_DAY_MS, type WildsNode } from './nodes'
import { GLADE } from './moonwell-glade'
import { SETTLEMENT as FIRST } from './first-settlement'
import { DIGGER_SURE } from './settlement-folk'
import { infectId, INFECT_R } from './infect-id'
import type { Settlement } from './network'

/** THE PACE: one dial (Alex 11-24: an in-game week = 5 days x 64 min = ~5 h 20 m real). */
export const INFECT_WEEK_MS = 5 * GAME_DAY_MS
export const CLUES = 7
/** the `hold` ping fires this far into the first week (Jin sets the wait) */
export const HOLD_PING_AT = 0.5
/** the most one tick may add to the loss clock (a sleeping laptop or a throttled tab is not time played) */
export const ONLINE_TICK_MAX_MS = 15_000

export type Ping = 'start' | 'hold' | 'second' | 'lost'
export interface Active { id: string; at: number; /** played ms since the second week began */ online: number; /** the clue it holds, 0 = none left to hand out */ clue: number; sent: Ping[] }
/** `told` = clues the keeper has been given, in order; `assigned` = clues handed to a settlement so far. assigned > told = carried
 *  by folk who got away (they are told, in order, at the next settlement cleared). */
export interface Infection { v: 1; season: number; /** when the next may start; null = no settlement discovered yet */ next: number | null; active: Active | null; saved: string[]; lost: string[]; told: number; assigned: number; /** M156 s3: clues given at a clear in another keeper's Wilds (said once each, infect-tell.ts) */ given?: number[]; /** M156 s4: a place of their own fell at home with all seven told (read only when the 7th came as a guest) */ opened?: true }
export type InfectEvent = { kind: Ping | 'saved'; id: string; clue: number } | { kind: 'open'; id: string; clue: number }

export const freshInfection = (season: number): Infection => ({ v: 1, season, next: null, active: null, saved: [], lost: [], told: 0, assigned: 0 })
export const spentIds = (s: Infection): string[] => [...s.saved, ...s.lost, ...(s.active ? [s.active.id] : [])]

/** Which settlements an infection may ever pick: the season's GENERATED ones only (never the Glade, Greg's stone / the first
 *  settlement, Gleaner's post, the camp, the fair: none has a generated id), and not the one whose Digger the ship repair
 *  needs (DIGGER_SURE, Bryonydell). */
export const pickable = (s: Settlement): boolean => /^s\d+-\d+$/.test(s.id) && s.id !== GLADE.id && !DIGGER_SURE.includes(s.id) && Math.hypot(s.x - FIRST.x, s.z - FIRST.z) > 200

/** The season purge: the clues carry, everything else goes. A held settlement's clue was never told: it is handed out again. */
export const purge = (s: Infection, season: number): Infection => ({ ...freshInfection(season), told: s.told, assigned: Math.max(s.told, s.assigned - (s.active?.clue ? 1 : 0)), ...(s.given ? { given: s.given } : {}), ...(s.opened ? { opened: true as const } : {}) })
/** M156 s4 (RULED athernyx 4bdec6b, "2a"): the 7th came as a guest = the way down waits for the next settlement cleared at HOME.
 *  Till then infections go on (that settlement has to come), and nothing that needs all seven may start. */
export const waitsHome = (s: Infection): boolean => s.told >= CLUES && !s.opened && !!s.given?.includes(CLUES)

export interface StepIn {
  season: number; now: number
  /** ms played since the last step (0 when the page was hidden) */
  played: number
  /** discovered, pickable settlement ids */
  known: readonly string[]
  rng: () => number
  /** an infection may start now (the keeper is not standing in a settlement) */
  mayStart?: boolean
  /** the place may be lost now (its champion is not up in a fight) */
  mayLose?: boolean
}
export function step(s0: Infection, i: StepIn): { s: Infection; events: InfectEvent[] } {
  let s = s0.season === i.season ? s0 : purge(s0, i.season)
  const events: InfectEvent[] = []
  const a0 = s.active
  if (a0) {
    let a = a0.at > i.now ? { ...a0, at: i.now } : a0   // the clock went back: the week starts over, never a loss
    const ping = (k: Ping) => { if (!a.sent.includes(k)) { a = { ...a, sent: [...a.sent, k] }; events.push({ kind: k, id: a.id, clue: a.clue }) } }
    ping('start')
    const second = a.at + INFECT_WEEK_MS
    if (i.now >= a.at + INFECT_WEEK_MS * HOLD_PING_AT) ping('hold')
    if (i.now >= second) {
      ping('second')
      const add = Math.min(Math.max(0, i.played), ONLINE_TICK_MAX_MS, i.now - second)
      if (add > 0) a = { ...a, online: a.online + add }
      if (a.online >= INFECT_WEEK_MS && i.mayLose !== false) {
        ping('lost')
        return { s: { ...s, active: null, lost: [...s.lost, a.id], next: nextAfter(a.at, i.now) }, events }
      }
    }
    return { s: a === a0 ? s : { ...s, active: a }, events }
  }
  if (s.next === null) return { s: i.known.length ? { ...s, next: i.now + INFECT_WEEK_MS } : s, events }
  if (s.next > i.now + INFECT_WEEK_MS) s = { ...s, next: i.now + INFECT_WEEK_MS }   // the clock went back
  if (i.now < s.next! || i.mayStart === false || (s.told >= CLUES && !waitsHome(s))) return { s, events }
  const id = pick(s, i.known, i.rng)
  if (!id) return { s, events }
  const b = begin(s, id, i.now)
  return { s: b, events: [{ kind: 'start', id, clue: b.active!.clue }] }
}
export function pick(s: Infection, known: readonly string[], rng: () => number): string | null {
  const spent = spentIds(s), open = [...new Set(known)].filter(k => !spent.includes(k)).sort()
  return open.length ? open[Math.min(open.length - 1, Math.floor(rng() * open.length))] : null
}
export function begin(s: Infection, id: string, now: number): Infection {
  if (s.active || spentIds(s).includes(id)) return s
  const clue = s.assigned < CLUES ? s.assigned + 1 : 0
  return { ...s, assigned: Math.max(s.assigned, clue), active: { id, at: now, online: 0, clue, sent: ['start'] } }
}
/** one per in-game week: the next week's start on this one's own grid */
export const nextAfter = (at: number, now: number): number => at + INFECT_WEEK_MS * Math.max(1, Math.floor((now - at) / INFECT_WEEK_MS) + 1)

/** its champion went down: saved for good; its clue and every carried one are told, in order. `away` = it fell in another keeper's
 *  Wilds: saved all the same, but a 7th told there (it leaves no thing) waits for home like any guest's. */
export function fell(s: Infection, id: string, now: number, away = false): { s: Infection; events: InfectEvent[] } {
  const a = s.active
  if (!a || a.id !== id) return { s, events: [] }
  const told = s.assigned, events: InfectEvent[] = [{ kind: 'saved', id, clue: a.clue }]
  const all = told >= CLUES, waited = waitsHome(s), opens = !away && all && (waited || s.told < CLUES)
  if (opens) events.push({ kind: 'open', id, clue: CLUES })
  const wait = away && all && s.told < CLUES ? { given: [...(s.given ?? []), CLUES] } : {}
  return { s: { ...s, active: null, saved: [...s.saved, id], told, next: nextAfter(a.at, now), ...wait, ...(opens && waited ? { opened: true as const } : {}) }, events }
}

/** M156 s3 (RULED athernyx 4bdec6b): THERE when another keeper's infection fell = this keeper's OWN next clue, never the host's number.
 *  A place of theirs that holds that clue now holds the one after. Their own place, were it the same one, is saved by `fell` instead. */
export function guestClue(s: Infection): Infection {
  if (s.told >= CLUES) return s
  const n = s.told + 1
  let assigned = Math.max(s.assigned, n), active = s.active
  if (active?.clue === n) { const next = assigned < CLUES ? assigned + 1 : 0; assigned = Math.max(assigned, next); active = { ...active, clue: next } }
  return { ...s, told: n, assigned, active, given: [...(s.given ?? []), n] }
}

export const NO_NODES: WildsNode[] = []
/** The nodes the fight and the ground read: a champion stands at a held settlement; a lost one's ground is `quiet` (no champion). */
export function infectNodes(s: Infection | null, places: readonly Settlement[], spot: (p: Settlement) => { x: number; z: number }, tileOf: (x: number, z: number) => string, biome: WildsNode['biome']): WildsNode[] {
  if (!s || (!s.active && !s.lost.length)) return NO_NODES   // one object: off = nothing downstream re-renders
  const out: WildsNode[] = []
  for (const p of places) {
    const held = s.active?.id === p.id
    if (!held && !s.lost.includes(p.id)) continue
    const at = held ? spot(p) : p
    out.push({ id: infectId(p.id), tile: tileOf(p.x, p.z), biome, x: at.x, z: at.z, i: -1, j: -1, ...(held ? {} : { quiet: true }) })
  }
  return out
}
/** Where the champion stands: the first open spot round the green, clear of the homes, the folk and the knoll. */
export function championSpot(p: Settlement, folk: readonly { x: number; z: number }[], walkable: (x: number, z: number) => boolean): { x: number; z: number } {
  for (const r of [20, 24, 17, 28]) for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r
    if ((p.pads ?? []).some(q => Math.hypot(q[0] - x, q[1] - z) < 10.5) || folk.some(f => Math.hypot(f.x - x, f.z - z) < 4)) continue
    if (walkable(x, z) && walkable(x + 1.5, z) && walkable(x - 1.5, z) && walkable(x, z + 1.5) && walkable(x, z - 1.5)) return { x, z }
  }
  return { x: p.x, z: p.z }
}
/** the infected ground a point stands on (held or lost), if any */
export function infectedGround(s: Infection | null, places: readonly Settlement[], x: number, z: number): string | null {
  if (!s || (!s.active && !s.lost.length)) return null
  for (const p of places) if ((s.active?.id === p.id || s.lost.includes(p.id)) && Math.hypot(p.x - x, p.z - z) < INFECT_R) return infectId(p.id)
  return null
}

const KEY = 'ather.infection.v1'
const strs = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((k): k is string => typeof k === 'string'))] : [])
const int = (v: unknown, max: number) => (Number.isInteger(v) ? Math.max(0, Math.min(max, v as number)) : 0)
export function parseInfection(v: unknown, season: number): Infection {
  const o = v as Partial<Infection> | null
  if (!o || typeof o !== 'object' || o.v !== 1 || !Number.isFinite(o.season)) return freshInfection(season)
  const told = int(o.told, CLUES), assigned = Math.max(told, int(o.assigned, CLUES)), saved = strs(o.saved), lost = strs(o.lost).filter(k => !saved.includes(k))
  const a = o.active, active: Active | null = a && typeof a === 'object' && typeof a.id === 'string' && Number.isFinite(a.at) && !saved.includes(a.id) && !lost.includes(a.id)
    ? { id: a.id, at: a.at, online: Number.isFinite(a.online) ? Math.max(0, a.online) : 0, clue: int(a.clue, CLUES), sent: strs(a.sent) as Ping[] } : null
  const s: Infection = { v: 1, season: o.season!, next: Number.isFinite(o.next) ? o.next! : null, active, saved, lost, told, assigned, ...(Array.isArray(o.given) && o.given.length ? { given: [...new Set(o.given.filter(k => Number.isInteger(k) && k >= 1 && k <= CLUES))] } : {}), ...(o.opened === true ? { opened: true as const } : {}) }
  return s.season === season ? s : purge(s, season)
}
export function loadInfection(season: number): Infection { try { return parseInfection(JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null'), season) } catch { return freshInfection(season) } }
export function saveInfection(s: Infection): void { try { localStorage.setItem(gardenKey(KEY), JSON.stringify(s)) } catch { /* private window */ } }
/** nothing has ever happened here: nothing to write */
export const blank = (s: Infection): boolean => s.next === null && !s.active && !s.saved.length && !s.lost.length && !s.assigned
