// THE OPEN WORLD'S BAG — one inventory for the keeper across every open-world page (Alex 11-15: "the hotbar and
// inventory to make sure they not only function but the menu look as well"). Slots 0..7 ARE the hotbar (the template
// draws them top-left); 8.. are the bag. What you hold is whatever sits in the selected hotbar slot.
//
// ★ PURE (no React, no DOM except the guarded load/save). The store + hook live in bag.tsx.
//
// Item names here are build vocabulary for things canon already has (the Repeater: engine/weapons.ts; waymarks:
// gates.md). A new item is one row in OPEN_ITEMS.

export interface ItemDef {
  name: string
  /** one short line for the bag's info card */
  blurb: string
  icon: string
  /** how many fit in one slot */
  stack: number
  kind: 'gun' | 'placeable' | 'material' | 'tool'
}
export const OPEN_ITEMS: Record<string, ItemDef> = {
  repeater: { name: 'Repeater', blurb: 'A sidearm. Twelve to a clip, R reloads. Only the Wilds give it work.', icon: '/open/icons/repeater.svg', stack: 1, kind: 'gun' },
  waymark: { name: 'Waymark', blurb: 'Plant it on open ground in the Wilds and the fold map can take you back. Lift it to carry it again.', icon: '/open/icons/waymark.svg', stack: 12, kind: 'placeable' },
}
export const itemDef = (id: string): ItemDef => OPEN_ITEMS[id] ?? { name: id.replace(/_/g, ' '), blurb: '', icon: '', stack: 99, kind: 'material' }

export const HOTBAR = 8, BAG = 24, SLOTS = HOTBAR + BAG
export type Stack = { id: string; n: number }
export interface Inv { v: 1; slots: (Stack | null)[] }

export function newInv(waymarks = 12): Inv {
  const slots: (Stack | null)[] = Array(SLOTS).fill(null)
  slots[0] = { id: 'repeater', n: 1 }
  if (waymarks > 0) slots[1] = { id: 'waymark', n: waymarks }
  return { v: 1, slots }
}
const clone = (inv: Inv): Inv => ({ v: 1, slots: inv.slots.map(s => (s ? { ...s } : null)) })

export const countOf = (inv: Inv, id: string) => inv.slots.reduce((a, s) => a + (s?.id === id ? s.n : 0), 0)

/** Add n of an item: top up matching stacks (hotbar first), then empty slots. Returns the new inv and what did not fit. */
export function give(inv: Inv, id: string, n: number): { inv: Inv; left: number } {
  const out = clone(inv), max = itemDef(id).stack
  let left = n
  for (const s of out.slots) if (left > 0 && s?.id === id && s.n < max) { const t = Math.min(left, max - s.n); s.n += t; left -= t }
  for (let i = 0; i < SLOTS && left > 0; i++) if (!out.slots[i]) { const t = Math.min(left, max); out.slots[i] = { id, n: t }; left -= t }
  return { inv: out, left }
}
/** Take n of an item, from the bag first so the hotbar's stack lasts. Returns null when there is not enough. */
export function take(inv: Inv, id: string, n: number): Inv | null {
  if (countOf(inv, id) < n) return null
  const out = clone(inv)
  let need = n
  for (let i = SLOTS - 1; i >= 0 && need > 0; i--) {
    const s = out.slots[i]; if (s?.id !== id) continue
    const t = Math.min(need, s.n); s.n -= t; need -= t
    if (s.n === 0) out.slots[i] = null
  }
  return out
}
/** Drop the stack at `from` onto `to`: merge into a matching stack (overflow stays behind), else swap. */
export function move(inv: Inv, from: number, to: number): Inv {
  if (from === to || !inv.slots[from]) return inv
  const out = clone(inv), a = out.slots[from]!, b = out.slots[to]
  if (b && b.id === a.id) {
    const max = itemDef(a.id).stack, t = Math.min(a.n, max - b.n)
    b.n += t; a.n -= t
    if (a.n === 0) out.slots[from] = null
  } else { out.slots[to] = a; out.slots[from] = b }
  return out
}
/** Split half a stack (rounded down) into the first empty slot of the same section, else any empty slot. */
export function split(inv: Inv, at: number): Inv {
  const s = inv.slots[at]; if (!s || s.n < 2) return inv
  const out = clone(inv), half = Math.floor(s.n / 2)
  const sameSection = at < HOTBAR ? [...Array(HOTBAR).keys()] : [...Array(BAG).keys()].map(k => k + HOTBAR)
  const to = [...sameSection, ...Array(SLOTS).keys()].find(i => !out.slots[i])
  if (to === undefined) return inv
  out.slots[at]!.n -= half; out.slots[to] = { id: s.id, n: half }
  return out
}
/** Shift-click: send a stack across, hotbar ↔ bag (merging first). Unchanged if there is no room. */
export function quickMove(inv: Inv, at: number): Inv {
  const s = inv.slots[at]; if (!s) return inv
  const range = at < HOTBAR ? [...Array(BAG).keys()].map(k => k + HOTBAR) : [...Array(HOTBAR).keys()]
  let out = clone(inv)
  for (const i of range) if (out.slots[i]?.id === s.id) { out = move(out, at, i); if (!out.slots[at]) return out }
  const empty = range.find(i => !out.slots[i])
  return empty === undefined ? out : move(out, at, empty)
}

export const INV_KEY = 'open.inv.v1'
/** Load the keeper's bag, or a fresh one. `waymarksLeft` seeds a fresh bag for a keeper who already planted some. */
export function loadInv(waymarksLeft = 12): Inv {
  try {
    const v = JSON.parse(localStorage.getItem(INV_KEY) ?? 'null')
    if (v?.v === 1 && Array.isArray(v.slots) && v.slots.length === SLOTS) return v
  } catch { /* private window */ }
  return newInv(waymarksLeft)
}
export function saveInv(inv: Inv) { try { localStorage.setItem(INV_KEY, JSON.stringify(inv)) } catch { /* private window */ } }
