// ── THE SPREAD MAP (BETA M70 s2; plan docs/tutorial-cluster.md › The first settlement) ──────────────────────────────────────
// Canon: CANON/game/shimmer-quest-glade-tutorial.md › "the spread, as the player sees it" (SIGNED, Alex 11-22): three states on
// the map, legend "Unseen · Clear · Hollow ground"; toasts spread.hud.grow / spread.hud.clear; spread.map.first = Chamomile's
// line the first time the spread map is uncovered.
// Build (Jin's): a SECTION is a node's region (nodes.ts nodeRegions). It reads
//   · UNSEEN until the keeper stands in it (uncover),
//   · CLEAR from then on, until the grey takes it,
//   · HOLLOW GROUND once the grey took it (`grey`), until its champion goes down (`tend`).
// M121 (Alex 11-24): how the grey takes a section is CHANCE. Every game day each discovered section rolls
// SECTION_RULE.chancePerDay on a hash of (save seed, day, section). This REPLACES two rules: M70 s2's neglect timer (an
// untended section turned for certain after GROW_DAYS; those 2 days live on as the grace period) and spread.ts's two older
// uncapped rolls over cleared nodes (neighbour creep + well-up), so one rule with one cap decides every section that turns.
// The FIRST section (Greg's stone, the first settlement) starts grey on a fresh save only, for Lamps Out.
// A section that turns is also infected in spread.ts (the node leaves `clean`), which is what darkens its waymarks (M75 s2).
// ★ PURE but for the guarded load/save (garden-tied, GARDEN_KEY_SPECS).
import { gardenKey } from '@/lib/keeper-local'
import { GAME_DAY_MS } from './nodes'
import { line } from './glade-tutorial-lines'

/** The dials (M121), all of them. A game day = 64 real minutes and runs while the keeper is away. */
export const SECTION_RULE = {
  /** a discovered clear section's chance to turn grey, each game day */
  chancePerDay: 0.08,
  /** game days a section is safe after it was first uncovered or last cleared */
  graceDays: 2,
  /** the most sections that can turn in one catch-up, however long the keeper was away (the missed days are then spent) */
  capPerCatchUp: 3,
  /** the spread stops while this share of the discovered sections is already grey */
  maxShare: 0.5,
}
/** M70 s2's neglect age: only read to migrate a pre-M121 save to the states it showed */
export const PRE_M121_GROW_MS = 2 * GAME_DAY_MS
export type AreaState = 'unseen' | 'clear' | 'hollow'
/** `rule` is absent on a pre-M121 save until startRule() ran. `day` = the last game day rolled; `since` = when the rule began here
 *  (the grace clock of a section cleared before it was on the map). */
export interface SpreadMap { v: 1; seen: Record<string, number>; first: boolean; grey: Record<string, number>; rule?: { seed: number; day: number; since: number } }
export const freshMap = (): SpreadMap => ({ v: 1, seen: {}, first: false, grey: {} })
export const dayOf = (t: number) => Math.floor(t / GAME_DAY_MS)

export function areaState(m: SpreadMap, id: string, infected: boolean): AreaState {
  if (m.seen[id] === undefined) return 'unseen'
  return infected && m.grey[id] !== undefined ? 'hollow' : 'clear'
}
/** the keeper stood in it: uncovered (never re-stamps: walking through does not tend ground) */
export const uncover = (m: SpreadMap, id: string, now: number): SpreadMap => (id in m.seen ? m : { ...m, seen: { ...m.seen, [id]: now } })
/** its champion went down: clear, and its grace period starts again */
export function tend(m: SpreadMap, id: string, now: number): SpreadMap {
  const grey = { ...m.grey }; delete grey[id]
  return { ...m, grey, seen: { ...m.seen, [id]: now } }
}

/** Start the M121 rule on a save, once. A FRESH save gets the first section grey; any older save keeps every section's state
 *  exactly as it showed under the old rule (hollow = seen, infected and untended 2 days), and no missed day is rolled. */
export function startRule(m: SpreadMap, o: { fresh: boolean; firstId: string | null; infected: (id: string) => boolean; now: number; seed: number }): SpreadMap {
  if (m.rule) return m
  const grey: Record<string, number> = {}
  if (o.fresh) { if (o.firstId) grey[o.firstId] = o.now }
  else for (const [id, t] of Object.entries(m.seen)) if (o.infected(id) && o.now - t >= PRE_M121_GROW_MS) grey[id] = o.now
  return { ...m, grey, rule: { seed: o.seed >>> 0, day: dayOf(o.now), since: o.now } }
}

/** [0,1): the same for the same save seed, day and section */
export function sectionRoll(seed: number, day: number, id: string): number {
  let h = (Math.imul(seed, 374761393) ^ Math.imul(day, 668265263) ^ 0x5bd1e995) | 0
  for (let c = 0; c < id.length; c++) h = Math.imul(h ^ id.charCodeAt(c), 2654435761)
  h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** Roll every game day since the last one, up to `now`. Discovered = on the map, or cleared before the map existed. `exempt` =
 *  sections the spread may not reach. Returns the new map, the new clean list, and the sections that turned, oldest first. */
export function rollSections(m: SpreadMap, clean: readonly string[], exempt: ReadonlySet<string>, now: number): { m: SpreadMap; clean: string[]; turned: string[] } {
  const r = m.rule, to = dayOf(now)
  if (!r || to <= r.day) return { m, clean: [...clean], turned: [] }
  const known = [...new Set([...Object.keys(m.seen), ...clean])].sort()
  const open = known.filter(id => m.grey[id] === undefined && !exempt.has(id))
  const room = Math.min(SECTION_RULE.capPerCatchUp, Math.max(0, Math.floor(SECTION_RULE.maxShare * known.length) - known.filter(id => m.grey[id] !== undefined).length))
  const grey = { ...m.grey }, turned: string[] = []
  for (let d = r.day + 1; d <= to && turned.length < room && turned.length < open.length; d++) {
    const t = d * GAME_DAY_MS
    const hits = open.filter(id => grey[id] === undefined && t - (m.seen[id] ?? r.since) >= SECTION_RULE.graceDays * GAME_DAY_MS)
      .map(id => ({ id, v: sectionRoll(r.seed, d, id) })).filter(h => h.v < SECTION_RULE.chancePerDay)
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
export const LEGEND = (): string[] => line('spread.map.legend').split(' · ')
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
  return { v: 1, seen, first: o.first === true, grey, ...(rule ? { rule } : {}) }
}
export function loadMap(): SpreadMap { try { return parseMap(JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null')) } catch { return freshMap() } }
export function saveMap(m: SpreadMap): void { try { localStorage.setItem(gardenKey(KEY), JSON.stringify(m)) } catch { /* private window */ } }
