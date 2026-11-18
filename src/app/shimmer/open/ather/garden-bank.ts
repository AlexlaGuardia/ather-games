// THE GARDEN BANK — one store for every keeper on the account, grown by the chests on the plot (2026-11-17, play /
// Jin 2 95f19652). Alex's call (11-17, via hub): storage is THE VOXEL MODEL: a bank shared by the garden (garden-owned per
// the roster ruling, GARDEN_KEY_SPECS), and each chest placed adds slots to the pool.
//
// The voxel world's rules (voxel3d/bank.ts, 09-16), carried across in the open world's own units:
//  ★ ONE POOL, NOT TEN BOXES. Every chest is a door into the same store, so nobody hunts for which box holds the logs.
//  ★ THE CAP IS IN SLOTS, A SLOT IS A STACK, and a chest adds what it would hold alone: CHEST_SLOTS (48, two bagfuls).
//  ★ A TAB IS A VIEW, NOT A POCKET. One cap, lenses by the skill an item comes from (inventory.ts › ITEM_GROUP).
//  ★ OVER-CAP IS TOLERATED, NEVER CORRECTED: if the cap ever drops below what is stored (a chest picked up, later),
//    deposits stop until it drains. Nothing here ever deletes a stack to fit a number.
//
// Open-world difference, on purpose: the pool is a LIST of stacks, not a fixed-length grid. The panel draws it sorted by
// tab anyway, so slot positions carried no meaning, and a list cannot hold a gap that needs fitting when the cap moves.
//
// ★ A NEW KEEPER HAS A BANK FROM THE FIRST MINUTE: the plot comes with one chest standing by the planning table
// (rooms.ts › STARTER_CHEST). The voxel rule "zero chests, zero bank" would leave a full bag in the first hour with
// nowhere to go, which is the risk hub named when it put the bank first.
//
// ★ PURE: no React, no DOM except the guarded load/save.
import { gardenKey } from '@/lib/keeper-local'
import { CHEST_SLOTS } from '../../voxel3d/chest'
import { HOTBAR, SLOTS, ITEM_GROUP, itemDef, give, type Inv, type Stack, type ItemGroup } from '../shared/inventory'

export { CHEST_SLOTS }
/** Chests a plot can hold, the starter one included (Alex 09-16: "a limit of about 10 chest"). */
export const MAX_CHESTS = 10
/** Slots for this many chests standing (the starter chest counts). */
export const bankCap = (chests: number) => Math.max(0, chests) * CHEST_SLOTS

export interface Bank { v: 1; stacks: Stack[] }
export const freshBank = (): Bank => ({ v: 1, stacks: [] })
export const bankUsed = (b: Bank) => b.stacks.length
/** Free slots; negative when over the cap (refuse deposits, never trim). */
export const bankFree = (b: Bank, cap: number) => cap - bankUsed(b)
export const bankCount = (b: Bank, id: string) => b.stacks.reduce((a, s) => a + (s.id === id ? s.n : 0), 0)

/** Put n of an item into the pool: top up its stacks first, then new stacks while there are free slots. */
export function putIn(b: Bank, cap: number, id: string, n: number): { bank: Bank; left: number } {
  const stacks = b.stacks.map(s => ({ ...s })), max = itemDef(id).stack
  let left = n
  for (const s of stacks) if (left > 0 && s.id === id && s.n < max) { const t = Math.min(left, max - s.n); s.n += t; left -= t }
  while (left > 0 && stacks.length < cap) { const t = Math.min(left, max); stacks.push({ id, n: t }); left -= t }
  return { bank: { v: 1, stacks }, left }
}

/** Bag slot → bank. Whatever does not fit stays in the bag slot. */
export function deposit(inv: Inv, at: number, b: Bank, cap: number): { inv: Inv; bank: Bank; moved: number } {
  const s = inv.slots[at]
  if (!s) return { inv, bank: b, moved: 0 }
  const r = putIn(b, cap, s.id, s.n), moved = s.n - r.left
  if (!moved) return { inv, bank: b, moved: 0 }
  const slots = inv.slots.map((x, i) => (i !== at ? x : r.left > 0 ? { id: s.id, n: r.left } : null))
  return { inv: { ...inv, slots }, bank: r.bank, moved }
}

/** Empty the bag (not the hotbar: what you hold stays in your hands) into the bank, as far as it fits. */
export function depositBag(inv: Inv, b: Bank, cap: number): { inv: Inv; bank: Bank; moved: number } {
  let out = { inv, bank: b, moved: 0 }
  for (let at = HOTBAR; at < SLOTS; at++) { const r = deposit(out.inv, at, out.bank, cap); out = { inv: r.inv, bank: r.bank, moved: out.moved + r.moved } }
  return out
}

/** Bank stack k → bag. Whatever the bag cannot take stays in the bank. */
export function withdraw(b: Bank, k: number, inv: Inv): { inv: Inv; bank: Bank; moved: number } {
  const s = b.stacks[k]
  if (!s) return { inv, bank: b, moved: 0 }
  const r = give(inv, s.id, s.n), moved = s.n - r.left
  if (!moved) return { inv, bank: b, moved: 0 }
  const stacks = b.stacks.flatMap((x, i) => (i !== k ? [x] : r.left > 0 ? [{ id: s.id, n: r.left }] : []))
  return { inv: r.inv, bank: { v: 1, stacks }, moved }
}

/** Take n of an item out of the pool (spent, not moved to the bag): the smallest stacks first, so the pool stays tidy.
 *  Null when the pool holds fewer than n; the input is never mutated. */
export function bankTake(b: Bank, id: string, n: number): Bank | null {
  if (n <= 0) return b
  if (bankCount(b, id) < n) return null
  const order = b.stacks.map((s, i) => i).filter(i => b.stacks[i].id === id).sort((x, y) => b.stacks[x].n - b.stacks[y].n)
  const left = b.stacks.map(s => s.n)
  let need = n
  for (const i of order) { const t = Math.min(need, left[i]); left[i] -= t; need -= t; if (!need) break }
  return { v: 1, stacks: b.stacks.flatMap((s, i) => (left[i] > 0 ? [{ id: s.id, n: left[i] }] : [])) }
}

// ── the tabs: lenses on the one pool ──────────────────────────────────────────────────────────────────────────
export type BankTab = 'all' | ItemGroup | 'gear'
export const BANK_TABS: readonly { id: BankTab; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'forestry', label: 'Forestry' }, { id: 'rinning', label: 'Rinning' },
  { id: 'prospecting', label: 'Prospecting' }, { id: 'cooking', label: 'Food' }, { id: 'alchemy', label: 'Potions' }, { id: 'farming', label: 'Farm' }, { id: 'decor', label: 'Decor' }, { id: 'gear', label: 'Gear' },
]
const RANK: Record<Exclude<BankTab, 'all'>, number> = { forestry: 0, rinning: 1, prospecting: 2, cooking: 3, alchemy: 4, farming: 5, decor: 6, gear: 7 }
export const bankGroup = (id: string): Exclude<BankTab, 'all'> => ITEM_GROUP[id] ?? 'gear'

/** Every query word must appear in the item's name or id (voxel bank's search rule). A live query ignores the tab. */
export function bankMatches(id: string, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/_/g, ' ')
  if (!q) return true
  const hay = `${itemDef(id).name.toLowerCase()} ${id.replace(/_/g, ' ')}`
  return q.split(/\s+/).every(t => hay.includes(t))
}
/** Which stacks a tab draws (indices into b.stacks), sorted by skill, then name, then index so nothing jumps around. */
export function bankView(b: Bank, tab: BankTab, query = ''): number[] {
  const searching = query.trim().length > 0
  const out = b.stacks.map((_, i) => i).filter(i => (searching ? bankMatches(b.stacks[i].id, query) : tab === 'all' || bankGroup(b.stacks[i].id) === tab))
  const name = (i: number) => itemDef(b.stacks[i].id).name.toLowerCase()
  return out.sort((x, y) => RANK[bankGroup(b.stacks[x].id)] - RANK[bankGroup(b.stacks[y].id)] || name(x).localeCompare(name(y)) || x - y)
}

// ── save: garden-tied, registered in GARDEN_KEY_SPECS ─────────────────────────────────────────────────────────
export const BANK_KEY = 'open.bank.v1'
/** Off disk: keep every plausible stack (a console can write here), never trim to a cap. */
export function adoptBank(v: unknown): Bank {
  const raw = (v as { v?: number; stacks?: unknown })?.stacks
  if ((v as { v?: number })?.v !== 1 || !Array.isArray(raw)) return freshBank()
  return { v: 1, stacks: raw.filter((s): s is Stack => !!s && typeof s.id === 'string' && Number.isFinite(s.n) && s.n >= 1).map(s => ({ id: s.id, n: Math.floor(s.n) })) }
}
export function loadBank(): Bank {
  try { return adoptBank(JSON.parse(localStorage.getItem(gardenKey(BANK_KEY)) ?? 'null')) } catch { return freshBank() }
}
export function saveBank(b: Bank) { try { localStorage.setItem(gardenKey(BANK_KEY), JSON.stringify(b)) } catch { /* private window */ } }
