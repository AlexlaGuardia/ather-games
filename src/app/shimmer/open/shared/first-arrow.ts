'use client'
// ── FIRST-TIME ARROWS (BETA M145, Alex 11-24 + 11-26: "big pointer arrows pointing out new things given") ──────────────────
// ONE reusable arrow, drawn by <GameHud> (shared/game-hud.tsx › FirstArrow): it points at the HUD place the game just put
// something new into, the FIRST time only. A page never draws it; a page only ARMS an arrow at the moment it gives the thing
// (`armArrow('grimoire')`). From there the template finds the target, hides the arrow while a talk box / panel / fight is up,
// and retires it for good when the player uses the thing (selects its slot) or dismisses it (clicks the arrow).
// ★ Saved per keeper (ARROWS_KEY in KEEPER_KEY_SPECS): armed + done ride reloads and keeper swaps; a done arrow never comes
//   back, and a keeper who got the thing before M145 (a veteran) was never armed, so they never see one.
// ★ One at a time: the oldest armed, not-done arrow is the only one shown. No words: the arrow carries the meaning.
import { useSyncExternalStore } from 'react'
import { keeperKey } from '@/lib/keeper-local'

export const ARROWS_KEY = 'open.arrows.v1'

/** Where an arrow points. `slot` = the hotbar slot holding `item` (found live: the bag may shuffle). */
export type ArrowTarget = { kind: 'slot'; item: string }
/** Every first-time arrow the game can arm. Add a row here + one `armArrow(id)` at the give. */
export const ARROWS = {
  grimoire: { kind: 'slot', item: 'grimoire_pedestal' },   // Greg hands the grimoire in Beat 1 (its pedestal lands in the bag)
} as const satisfies Record<string, ArrowTarget>
export type ArrowId = keyof typeof ARROWS

export interface ArrowState { armed: string[]; done: string[] }
export const NO_ARROWS: ArrowState = { armed: [], done: [] }

// ── pure ──
export function parseArrows(v: unknown): ArrowState {
  const o = v as Partial<ArrowState> | null
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
  return o && typeof o === 'object' ? { armed: list(o.armed), done: list(o.done) } : NO_ARROWS
}
/** Arm once: a done arrow (or one already armed) is left alone. */
export function arm(s: ArrowState, id: string): ArrowState {
  return s.done.includes(id) || s.armed.includes(id) ? s : { ...s, armed: [...s.armed, id] }
}
/** Retire for good (used or dismissed). */
export function retire(s: ArrowState, id: string): ArrowState {
  if (s.done.includes(id)) return s
  return { armed: s.armed.filter(a => a !== id), done: [...s.done, id] }
}
/** The one arrow to show: the oldest armed one that is not done (and that the game still knows). */
export function current(s: ArrowState): ArrowId | null {
  return (s.armed.find(a => !s.done.includes(a) && a in ARROWS) as ArrowId | undefined) ?? null
}
/** The hotbar slot the arrow points at, or null (the thing is not on the bar: no arrow, rather than a wrong one). */
export function slotOf(t: ArrowTarget, entries: readonly ({ itemId: string } | null)[]): number | null {
  const i = entries.findIndex(e => e?.itemId === t.item)
  return i < 0 ? null : i
}
/** Shown only when nothing else has the screen: no talk box / panel (input off), no fight. */
export const arrowShows = (o: { input: boolean; fight?: boolean }) => o.input && !o.fight

// ── store (per keeper) ──
let cur: ArrowState | null = null
const subs = new Set<() => void>()
function get(): ArrowState {
  if (typeof window === 'undefined') return NO_ARROWS
  if (!cur) {
    try { cur = parseArrows(JSON.parse(localStorage.getItem(keeperKey(ARROWS_KEY)) ?? 'null')) } catch { cur = NO_ARROWS }
  }
  return cur
}
function put(s: ArrowState) {
  if (s === cur) return
  cur = s
  try { localStorage.setItem(keeperKey(ARROWS_KEY), JSON.stringify(s)) } catch { /* private window: this page only */ }
  subs.forEach(f => f())
}
export const armArrow = (id: ArrowId) => put(arm(get(), id))
export const retireArrow = (id: ArrowId) => put(retire(get(), id))
export const getArrows = get
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useArrows = () => useSyncExternalStore(subscribe, get, () => NO_ARROWS)
/** a keeper swap re-reads the key */
export function resetArrowsCache() { cur = null; subs.forEach(f => f()) }
