// ── THE SPREAD MAP (BETA M70 s2; plan docs/tutorial-cluster.md › The first settlement) ──────────────────────────────────────
// Canon: CANON/game/shimmer-quest-glade-tutorial.md › "the spread, as the player sees it" (SIGNED, Alex 11-22): three states on
// the map, legend "Unseen · Clear · Hollow ground"; toasts spread.hud.grow / spread.hud.clear; spread.map.first = Chamomile's
// line the first time the spread map is uncovered.
// Build (Jin's): an AREA is a node's region (nodes.ts nodeRegions). It reads
//   · UNSEEN until the keeper stands in it (uncover),
//   · CLEAR from then on while its node is clean, or while its node is infected but tended within GROW_DAYS game days,
//   · HOLLOW GROUND once an infected node has gone GROW_DAYS game days untended (neglect). Tended = first uncovered, or its
//     champion downed (which also cleans the node in spread.ts). The infection itself stays spread.ts's: this layer only says
//     what the keeper has seen and how long ground has been left alone. GROW_DAYS = 2 (128 real minutes): the settlement's
//     own area can never read Hollow ground inside the tutorial's first hour.
// ★ PURE but for the guarded load/save (garden-tied, GARDEN_KEY_SPECS).
import { gardenKey } from '@/lib/keeper-local'
import { GAME_DAY_MS } from './nodes'
import { line } from './glade-tutorial-lines'

export const GROW_DAYS = 2
export const GROW_MS = GROW_DAYS * GAME_DAY_MS
export type AreaState = 'unseen' | 'clear' | 'hollow'
export interface SpreadMap { v: 1; seen: Record<string, number>; first: boolean }
export const freshMap = (): SpreadMap => ({ v: 1, seen: {}, first: false })

export function areaState(m: SpreadMap, id: string, infected: boolean, now: number): AreaState {
  const t = m.seen[id]
  if (t === undefined) return 'unseen'
  if (!infected) return 'clear'
  return now - t >= GROW_MS ? 'hollow' : 'clear'
}
/** the keeper stood in it: uncovered (never re-stamps: walking through does not tend ground) */
export const uncover = (m: SpreadMap, id: string, now: number): SpreadMap => (id in m.seen ? m : { ...m, seen: { ...m.seen, [id]: now } })
/** its champion went down: clear, and the neglect clock starts again */
export const tend = (m: SpreadMap, id: string, now: number): SpreadMap => ({ ...m, seen: { ...m.seen, [id]: now } })
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
  return { v: 1, seen, first: o.first === true }
}
export function loadMap(): SpreadMap { try { return parseMap(JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null')) } catch { return freshMap() } }
export function saveMap(m: SpreadMap): void { try { localStorage.setItem(gardenKey(KEY), JSON.stringify(m)) } catch { /* private window */ } }
