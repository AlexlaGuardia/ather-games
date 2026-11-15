// THE MESSAGE LINE — what the HUD says, under the hotbar (Alex 11-15: "under the hot bar is a good area for text to
// appear or chat display as needed like entering a new zone or the name on a highlighted item when scrolling").
//
// Any page or system calls `hudSay(text, kind)`; the template (game-hud.tsx) draws the lines. One store, so a fight,
// a menu, a zone change and (one day) chat all speak in the same place and the same voice.
//   zone — a place you just entered: the display face, larger, longer
//   item — the slot you just selected: REPLACES the last item line (scrolling the bar must not stack names)
//   info — a toast: something happened (ground bought, a waymark bound)
//   chat — a line from a person (multiplayer, later)
//
// ★ PURE (no React here): the hook lives in game-hud.tsx. Node tests drive this file directly.

export type SayKind = 'zone' | 'item' | 'info' | 'chat'
export interface Line { id: number; text: string; kind: SayKind; at: number; ttl: number }

export const TTL: Record<SayKind, number> = { zone: 4.5, item: 1.8, info: 4, chat: 10 }
export const MAX_LINES = 5

let lines: Line[] = []
let nextId = 1
const subs = new Set<() => void>()
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000

export function hudSay(text: string, kind: SayKind = 'info', ttl = TTL[kind], at = now()) {
  if (!text) return
  // an item line replaces the last one; the same text twice in a row refreshes instead of stacking
  let next = kind === 'item' ? lines.filter(l => l.kind !== 'item') : lines.filter(l => !(l.text === text && l.kind === kind))
  next = [...next, { id: nextId++, text, kind, at, ttl }]
  lines = next.slice(-MAX_LINES)
  subs.forEach(f => f())
}
/** Lines still showing at time t (seconds). */
export const linesAt = (t = now()) => lines.filter(l => t - l.at < l.ttl)
export function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } }
/** Tests only. */
export function _resetSay() { lines = []; nextId = 1 }
