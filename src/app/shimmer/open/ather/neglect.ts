// ── NEGLECT HAS TEETH (BETA M235 s2, Alex 11-27) ─────────────────────────────────────────────────────────────────────────────
// On top of s1's slight seeded return (spread-map.ts ZONE_RULE): an INFECTED zone the keeper has uncovered and left alone presses
// on the CLEARED zones beside it. After NEGLECT_RULE.pressDays of that, ONE of them comes under THREAT (the map pulses it, Morel
// pings). The keeper has warnDays to answer: down the champion of the zone pressing on it (it turns clear). Not answered in time =
// the zone is LOST for the rest of the season, with all it had (its settlement, nodes, waymarks).
// Canon (Magii 15b0e8a, CANON/game/ather-story.md §2.1): the drained ground can no longer hold the Settle, so the zone collapses
// into the cloud below = cloud void; the black light is its grey matter venting as it falls. The Core breathes it back next
// season: a lost zone keeps the season it fell in and comes back (Hollow ground) the first read in a later season.
// Build (Jin's numbers, Alex tunes on feel): at most one threat at a time; never the zone the keeper stands in (it does not
// collapse under their feet either: the loss waits); never the Glade's zone; a zone holding the keeper's waymark home or a
// settlement is safe the save's first week. Old saves / a long absence: a load WARNS (re-arms a full window), it never executes.
// ★ PURE. No React, no DOM, no words (the page says the lines).
import { GAME_DAY_MS } from './nodes'
import type { SpreadMap, Threat } from './spread-map'

export const NEGLECT_RULE = {
  /** game days an uncovered infected zone must have sat beside a cleared one before it threatens it */
  pressDays: 3,
  /** game days the keeper has to answer a threat */
  warnDays: 2,
  /** game days (from the save's rule start) a zone with the keeper's waymark home or a settlement cannot be threatened */
  homeGraceDays: 7,
}
const DAY = GAME_DAY_MS
/** ★ PLACEHOLDER words (functional, NOT final copy): @lark writes them. Morel says the warning; the rest are HUD lines. */
export const NEGLECT_LINES = {
  warn: 'The grey is pressing on {PLACE}. Clear the ground beside it before it gives way.',
  answered: '{PLACE} holds.',
  lost: '{PLACE} gave way and fell into the cloud.',
  back: 'Lost ground has come back.',
}

/** 4-neighbours of a continent zone id `z{gi},{gj}` that exist (a per-tile id `z{tile}:{i},{j}` keeps to its tile) */
export function zoneNeighbours(id: string, has: (id: string) => boolean): string[] {
  const c = id.lastIndexOf(':'), pre = c >= 0 ? id.slice(0, c + 1) : 'z', body = id.slice(c >= 0 ? c + 1 : 1)
  const [i, j] = body.replace(/^z/, '').split(',').map(Number)
  if (!Number.isFinite(i) || !Number.isFinite(j)) return []
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => `${pre}${i + a},${j + b}`).filter(has)
}
/** when a seen zone last turned Hollow ground: retaken (grey) or, never cleared, when it was uncovered */
export const hollowSince = (m: SpreadMap, id: string): number | undefined => m.grey[id] ?? m.seen[id]

export interface NeglectCtx {
  now: number
  /** the season now (network.ts); a lost zone of an earlier season comes back */
  season: number
  /** the cleared zones (spread.ts ledger) */
  clean: readonly string[]
  neighbours: (id: string) => readonly string[]
  /** the zone(s) the keeper stands in: never picked, never collapsed under them */
  standing: ReadonlySet<string>
  /** never threatened (the Glade's zone) */
  never: ReadonlySet<string>
  /** the keeper's waymark home + settlements: safe for the first homeGraceDays of the save */
  home: ReadonlySet<string>
  /** a page load / first read after an absence: warn, never execute */
  onLoad: boolean
}
export type NeglectEvent = { kind: 'warn'; id: string; by: string } | { kind: 'answered'; id: string } | { kind: 'lost'; id: string } | { kind: 'back'; ids: string[] }

export function neglect(m0: SpreadMap, c: NeglectCtx): { m: SpreadMap; clean: string[]; events: NeglectEvent[] } {
  const events: NeglectEvent[] = []
  let m = m0
  // 1. the Core breathes last season's lost zones back
  if (m.lost) {
    const back = Object.keys(m.lost).filter(id => m.lost![id].season !== c.season).sort()
    if (back.length) {
      const lost = { ...m.lost }; for (const id of back) delete lost[id]
      const { lost: _drop, ...rest } = m; void _drop
      m = Object.keys(lost).length ? { ...rest, lost } : rest
      events.push({ kind: 'back', ids: back })
    }
  }
  const lost = m.lost ?? {}
  let clean = c.clean.filter(id => !lost[id])
  // 2. the threat in hand
  const th = m.threat
  if (th) {
    const drop = (): SpreadMap => { const { threat: _t, ...rest } = m; void _t; return rest }
    if (lost[th.id] || !clean.includes(th.id)) m = drop()   // already gone grey (s1's return) or lost: nothing left to threaten
    else if (clean.includes(th.by) || lost[th.by]) { m = { ...drop(), calm: c.now }; events.push({ kind: 'answered', id: th.id }) }
    else if (c.now >= th.until) {
      if (c.onLoad) { m = { ...m, threat: { ...th, at: c.now, until: c.now + NEGLECT_RULE.warnDays * DAY } }; events.push({ kind: 'warn', id: th.id, by: th.by }) }
      else if (!c.standing.has(th.id)) {
        m = { ...drop(), lost: { ...lost, [th.id]: { at: c.now, season: c.season } }, calm: c.now }
        clean = clean.filter(id => id !== th.id)
        events.push({ kind: 'lost', id: th.id })
      }
    }
    if (m.threat) return { m, clean, events }
  }
  // 3. a new threat (at most one), not inside the calm after an answer or a loss
  if (c.now < (m.calm ?? -Infinity) + NEGLECT_RULE.pressDays * DAY) return { m, clean, events }
  const since = m.rule?.since ?? c.now, early = c.now - since < NEGLECT_RULE.homeGraceDays * DAY
  const cleanSet = new Set(clean)
  let best: { id: string; by: string; press: number } | null = null
  for (const id of [...clean].sort()) {
    if (m.seen[id] === undefined || c.standing.has(id) || c.never.has(id) || (early && c.home.has(id))) continue
    for (const by of c.neighbours(id)) {
      if (cleanSet.has(by) || lost[by]) continue
      const h = hollowSince(m, by); if (h === undefined) continue   // unseen ground is dormant (s1)
      const press = Math.max(h, m.seen[id])
      if (c.now - press < NEGLECT_RULE.pressDays * DAY) continue
      if (!best || press < best.press || (press === best.press && (id < best.id || (id === best.id && by < best.by)))) best = { id, by, press }
    }
  }
  if (best) {
    const threat: Threat = { id: best.id, by: best.by, at: c.now, until: c.now + NEGLECT_RULE.warnDays * DAY }
    m = { ...m, threat }
    events.push({ kind: 'warn', id: best.id, by: best.by })
  }
  return { m, clean, events }
}
/** the zones lost now (the page's void, map and champion filter) */
export const lostSet = (m: SpreadMap): Set<string> => new Set(Object.keys(m.lost ?? {}))
