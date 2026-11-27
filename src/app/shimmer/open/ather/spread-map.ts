// ── THE SPREAD MAP (BETA M70 s2; plan docs/tutorial-cluster.md › The first settlement) ──────────────────────────────────────
// Canon: CANON/game/shimmer-quest-glade-tutorial.md › "the spread, as the player sees it" (SIGNED, Alex 11-22); the legend since
// 2026-11-27 (athernyx 4b5b5d1, Alex M235): THREE states, "Unseen · Hollow ground · Clear" (the 11-24 fourth word is retired);
// toasts spread.hud.grow / spread.hud.clear; spread.map.first = Chamomile's line the first time the spread map is uncovered.
// Build (Jin's), M235 s1 (Alex 11-27, reverses M121's "starts clear + chance turns it grey"): the map's unit is a ZONE (zones.ts:
// four old sections fused). Every zone starts INFECTED and DORMANT. It reads
//   · UNSEEN until the keeper steps into any part of it, then the WHOLE zone is uncovered (uncover),
//   · HOLLOW GROUND while infected (not in the ledger's `clean`),
//   · CLEAR once its champion went down (`tend`), until the grey takes it back: ZONE_RULE, a slight seeded chance per game day after
//     a grace, one zone per catch-up at most, never a settlement's zone nor the one the keeper stands in (the page's `exempt`).
// A zone that turns leaves spread.ts's `clean`, which is what darkens its waymarks (M75 s2).
// ★ PURE but for the guarded load/save (garden-tied, GARDEN_KEY_SPECS).
import { gardenKey } from '@/lib/keeper-local'
import { GAME_DAY_MS } from './nodes'
import { line } from './glade-tutorial-lines'

/** THE RETURN (M235 s1, Alex 11-27: "only a slight chance a cleared zone reinfects"; numbers are Jin's). Only a CLEARED zone can
 *  turn: every zone starts infected and dormant, so nothing spreads or returns on ground the keeper has not uncovered. A game day
 *  = 64 real minutes and runs while the keeper is away. Replaces M121's SECTION_RULE (8%/day, 2 grace days, 3 per catch-up). */
export const ZONE_RULE = {
  /** a cleared zone's chance to be taken back, each game day */
  chancePerDay: 0.02,
  /** game days a zone is safe after it was cleared */
  graceDays: 3,
  /** the most zones that can turn in one catch-up, however long the keeper was away (the missed days are then spent) */
  capPerCatchUp: 1,
}
/** M235: the three states in the legend's order and their SIGNED words (athernyx 4b5b5d1: "Unseen · Hollow ground · Clear", word
 *  for word: lines-batch-24b.test.ts), and the one look both maps and the legend draw them with (Unseen = the plain map). */
export const AREA_STATES = ['unseen', 'hollow', 'clear'] as const
export type LegendState = (typeof AREA_STATES)[number]
/** + 'lost' (M235 s2): a zone collapsed into the cloud for the season. Drawn as void, NOT in the legend (no signed word yet). */
export type AreaState = LegendState | 'lost'
export const STATE_WORD: Record<LegendState, string> = { unseen: 'Unseen', hollow: 'Hollow ground', clear: 'Clear' }
export const STATE_LOOK: Record<AreaState, { fill: string; line: string; dash: readonly [number, number] | null }> = {
  unseen: { fill: 'rgba(12,9,24,0.92)', line: 'rgba(12,9,24,0.92)', dash: null },   // the legend's swatch only: ground never stood in lies under the fold-mist
  hollow: { fill: 'rgba(62,64,72,0.48)', line: 'rgba(235,238,242,0.9)', dash: [10, 7] },
  clear: { fill: 'rgba(96,190,70,0.22)', line: 'rgba(150,220,110,0.9)', dash: null },
  lost: { fill: 'rgba(6,4,12,0.94)', line: 'rgba(120,96,160,0.75)', dash: [3, 4] },   // M235 s2: the cloud void (Jin's first look)
}
/** `seen` = zones uncovered (when); `grey` = zones the grey took BACK (when; the grow toast and a guest's view read it); `rule` is
 *  absent until startRule() ran (`day` = the last game day rolled, `since` = when it began here). `zones` = keyed by M235 zone ids
 *  (an older save is keyed by its sections until toZones() ran). */
export interface SpreadMap { v: 1; seen: Record<string, number>; first: boolean; grey: Record<string, number>; rule?: { seed: number; day: number; since: number }; zones?: 1
  /** M235 s2 (neglect.ts): the one zone under threat now, the zones lost this season, and the last answer (no new threat before calm + press) */
  threat?: Threat; lost?: Record<string, Lost>; calm?: number }
export interface Threat { id: string; by: string; at: number; until: number }
export interface Lost { at: number; season: number }
export const freshMap = (): SpreadMap => ({ v: 1, seen: {}, first: false, grey: {}, zones: 1 })
export const dayOf = (t: number) => Math.floor(t / GAME_DAY_MS)

/** M235: a zone the keeper has stood in is Hollow ground until its champion goes down, then Clear (until the grey takes it back) */
export function areaState(m: SpreadMap, id: string, infected: boolean): AreaState {
  if (m.lost?.[id]) return 'lost'
  if (m.seen[id] === undefined) return 'unseen'
  return infected ? 'hollow' : 'clear'
}
/** the keeper stood in it: uncovered whole (never re-stamps: walking through does not tend ground) */
export const uncover = (m: SpreadMap, id: string, now: number): SpreadMap => (id in m.seen ? m : { ...m, seen: { ...m.seen, [id]: now } })
/** its champion went down: clear, and its grace period starts again */
export function tend(m: SpreadMap, id: string, now: number): SpreadMap {
  const grey = { ...m.grey }; delete grey[id]
  return { ...m, grey, seen: { ...m.seen, [id]: now } }
}

/** Start the return rule on a save, once (seeded per save, so a save's rolls are reproducible). No missed day is rolled. */
export function startRule(m: SpreadMap, o: { now: number; seed: number }): SpreadMap {
  if (m.rule) return m
  return { ...m, rule: { seed: o.seed >>> 0, day: dayOf(o.now), since: o.now } }
}
/** M235: an OLD save (keyed by section) onto zones. A zone is uncovered if any of its sections was (the earliest time), and clear
 *  only if EVERY one of its sections was clear. Old greys are not carried (a zone not clear is infected anyway). Runs once. */
export function toZones(m: SpreadMap, clean: readonly string[], fused: { zoneOf: ReadonlyMap<string, string>; members: ReadonlyMap<string, readonly string[]> }): { m: SpreadMap; clean: string[] } {
  const oldClean = clean.some(id => fused.zoneOf.has(id))   // a ledger can outlive its map key (a save from before the map)
  if (m.zones && !oldClean) return { m, clean: [...clean] }
  let out = [...clean]
  if (oldClean) { const was = new Set(clean); out = []; for (const [z, ids] of fused.members) if (ids.length && ids.every(id => was.has(id))) out.push(z); out.sort() }
  if (m.zones) return { m, clean: out }
  const seen: Record<string, number> = {}
  for (const [id, t] of Object.entries(m.seen)) { const z = fused.zoneOf.get(id); if (z) seen[z] = Math.min(seen[z] ?? Infinity, t) }
  return { m: { ...m, seen, grey: {}, zones: 1 }, clean: out }
}

/** [0,1): the same for the same save seed, day and section */
export function sectionRoll(seed: number, day: number, id: string): number {
  let h = (Math.imul(seed, 374761393) ^ Math.imul(day, 668265263) ^ 0x5bd1e995) | 0
  for (let c = 0; c < id.length; c++) h = Math.imul(h ^ id.charCodeAt(c), 2654435761)
  h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** Roll every game day since the last one, up to `now`. Only CLEARED zones roll (M235: an infected zone is already grey, an unseen
 *  one is dormant). `exempt` = zones the grey may not take back (a settlement's, the one the keeper stands in). Returns the new map,
 *  the new clean list, and the zones that turned, oldest first. */
export function rollSections(m: SpreadMap, clean: readonly string[], exempt: ReadonlySet<string>, now: number): { m: SpreadMap; clean: string[]; turned: string[] } {
  const r = m.rule, to = dayOf(now)
  if (!r || to <= r.day) return { m, clean: [...clean], turned: [] }
  const open = [...new Set(clean)].filter(id => !exempt.has(id)).sort()
  const room = ZONE_RULE.capPerCatchUp, grey = { ...m.grey }, turned: string[] = []
  for (let d = r.day + 1; d <= to && turned.length < room && turned.length < open.length; d++) {
    const t = d * GAME_DAY_MS
    const hits = open.filter(id => !turned.includes(id) && t - (m.seen[id] ?? r.since) >= ZONE_RULE.graceDays * GAME_DAY_MS)
      .map(id => ({ id, v: sectionRoll(r.seed, d, id) })).filter(h => h.v < ZONE_RULE.chancePerDay)
      .sort((a, b) => a.v - b.v)   // over the cap, the lowest rolls turn (never simply the first ids)
    for (const h of hits) if (turned.length < room) { grey[h.id] = t; turned.push(h.id) }
  }
  return { m: { ...m, grey, rule: { ...r, day: to } }, clean: clean.filter(id => !turned.includes(id)), turned }
}
/** spread.map.first fires once: returns the map with the flag set + whether it fires now */
export function firstLook(m: SpreadMap): { m: SpreadMap; fire: boolean } {
  if (m.first || !Object.keys(m.seen).length) return { m, fire: false }
  return { m: { ...m, first: true }, fire: true }
}
/** what worsened / cleared between two reads of the uncovered areas */
export function changes(prev: Readonly<Record<string, AreaState>>, next: Readonly<Record<string, AreaState>>): { grew: string[]; cleared: string[] } {
  const grew: string[] = [], cleared: string[] = []
  for (const [id, s] of Object.entries(next)) {
    const p = prev[id]
    if (p === 'clear' && s === 'hollow') grew.push(id)
    if (p === 'hollow' && s === 'clear') cleared.push(id)
  }
  return { grew, cleared }
}
/** the signed lines */
export const LEGEND = (): string[] => AREA_STATES.map(s => STATE_WORD[s])
export const growLine = (place: string) => line('spread.hud.grow').replace('{PLACE}', place)
export const clearLine = () => line('spread.hud.clear')
export const firstLine = () => line('spread.map.first')

const KEY = 'ather.spreadmap.v1'
export function parseMap(v: unknown): SpreadMap {
  const o = v as Partial<SpreadMap> | null
  if (!o || typeof o !== 'object' || o.v !== 1) return freshMap()
  const seen: Record<string, number> = {}
  if (o.seen && typeof o.seen === 'object') for (const [k, t] of Object.entries(o.seen)) if (Number.isFinite(t)) seen[k] = t as number
  const grey: Record<string, number> = {}
  if (o.grey && typeof o.grey === 'object') for (const [k, t] of Object.entries(o.grey)) if (Number.isFinite(t)) grey[k] = t as number
  const r = o.rule, rule = r && [r.seed, r.day, r.since].every(Number.isFinite) ? { seed: r.seed, day: r.day, since: r.since } : undefined
  const th = o.threat, threat = th && typeof th.id === 'string' && typeof th.by === 'string' && Number.isFinite(th.at) && Number.isFinite(th.until) ? { id: th.id, by: th.by, at: th.at, until: th.until } : undefined
  const lost: Record<string, Lost> = {}
  if (o.lost && typeof o.lost === 'object') for (const [k, l] of Object.entries(o.lost)) if (l && Number.isFinite(l.at) && Number.isFinite(l.season)) lost[k] = { at: l.at, season: l.season }
  return { v: 1, seen, first: o.first === true, grey, ...(rule ? { rule } : {}), ...(o.zones === 1 ? { zones: 1 as const } : {}),
    ...(threat ? { threat } : {}), ...(Object.keys(lost).length ? { lost } : {}), ...(Number.isFinite(o.calm) ? { calm: o.calm } : {}) }
}
export function loadMap(): SpreadMap { try { return parseMap(JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null')) } catch { return freshMap() } }
export function saveMap(m: SpreadMap): void { try { localStorage.setItem(gardenKey(KEY), JSON.stringify(m)) } catch { /* private window */ } }
