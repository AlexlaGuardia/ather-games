/**
 * loadouts.ts — MORE THAN ONE LOADOUT: a second focus and bracelet, with their own letters.
 *
 * Canon (`shimmer-skilling.md` § One loadout = one focus + one bracelet, RULED 2026-09-03, Alex verbatim):
 * *"for now we can start with one of each but if the player wants more loadouts they will need to
 * acquire more of both the focus and accessories."* A second loadout needs a second focus, a second
 * bracelet, **and its own gems** — two builds that both want Barrier want two Barrier gems and two
 * vessels. *"That is the demand the Passage was always missing."*
 *
 * ── THE MODEL, AND WHY THE ACTIVE LOADOUT DID NOT MOVE ──
 * The active loadout lives exactly where it always has: its slots under `LOADOUT_KEY`, its pair under
 * `VESSELS_KEY`. Every reader in the tree (`resolveLoadout`, the cast bar, the letters card, `/rune`)
 * keeps reading those two keys and knows nothing about this file. What is NEW is the PARKED list —
 * every other loadout the keeper owns, each carrying its own slots and its own set letters — under
 * `LOADOUTS_KEY`. Swapping exchanges the active pair with a parked one and the host bumps `runeTick`,
 * which is the same re-resolve `/rune` and `/reborn` already ride. Touching one file's persistence
 * instead of three is the whole reason the active loadout stayed put.
 *
 * ── JIN'S CALLS ──
 *   · a pair (focus + bracelet) costs `PAIR_PRICE` Marks at the Passage's vessel shelf, any day —
 *     the vessels are grown, not ridden in; `MAX_LOADOUTS` in all
 *   · a new pair arrives EMPTY: no slots bound, no letters set — the bag is shared, the paper is not
 *   · swapping is free and instant; a cozy game does not tax changing your mind
 *   · vessel tiers and materials are not modelled: a pair is a pair
 *
 * ── VOCABULARY ── ✅ loadout, focus, bracelet, pair, parked, swap. ⛔ slot (the Citadel's), band, socket.
 */
import { keeperKey } from '@/lib/keeper-local'
import { LOADOUT_KEY, rawLoadout, saveLoadout, type Loadout } from './loadout'
import { VESSELS_KEY, loadLetters, saveLetters, type Vessels } from './gems'
import { ALL_BANDS } from './cast'

// ⚠ NOT 'ather:shimmer:loadouts': the registry's spell-check sees the active key as a prefix of that
// and flags this file for spelling another module's key. 'parked' says what it holds anyway.
export const LOADOUTS_KEY = 'ather:shimmer:parked'
export const PAIR_PRICE = 150
export const MAX_LOADOUTS = 3

/** a loadout that is not the active one: its own slots, its own paper */
export interface ParkedLoadout { slots: Loadout; vessels: Vessels }

const EMPTY_VESSELS = (): Vessels => ({ bracelet: [], focus: [] })
export const emptyParked = (): ParkedLoadout => ({ slots: ALL_BANDS.map(() => null), vessels: EMPTY_VESSELS() })

function parseParked(raw: unknown): ParkedLoadout[] {
  if (!Array.isArray(raw)) return []
  const list = (x: unknown) => Array.isArray(x) ? x.filter((r): r is string => typeof r === 'string') : []
  return raw.slice(0, MAX_LOADOUTS - 1).map((p) => {
    const o = (p && typeof p === 'object' ? p : {}) as { slots?: unknown; vessels?: { bracelet?: unknown; focus?: unknown } }
    const sl: unknown[] = Array.isArray(o.slots) ? (o.slots as unknown[]) : []
    const slots: Loadout = ALL_BANDS.map((_, i) => (typeof sl[i] === 'string' ? (sl[i] as string) : null))
    return { slots, vessels: { bracelet: list(o.vessels?.bracelet), focus: list(o.vessels?.focus) } }
  })
}

export function loadParked(): ParkedLoadout[] {
  try {
    const raw = localStorage.getItem(keeperKey(LOADOUTS_KEY))
    return raw ? parseParked(JSON.parse(raw)) : []
  } catch { return [] }
}

export function saveParked(parked: readonly ParkedLoadout[]): void {
  try { localStorage.setItem(keeperKey(LOADOUTS_KEY), JSON.stringify(parked.slice(0, MAX_LOADOUTS - 1))) } catch { /* private mode */ }
}

export function clearParked(): void {
  try { localStorage.removeItem(keeperKey(LOADOUTS_KEY)) } catch { /* private mode */ }
}

/** how many loadouts the keeper owns: the active pair plus every parked one */
export function loadoutCount(): number { return 1 + loadParked().length }

export type PairRefusal = 'too-dear' | 'at-cap'
export interface PairPurchase { ok: boolean; marks: number; why?: PairRefusal; say: string }

/** Buy a focus + bracelet: a new, EMPTY parked loadout. Persists on success; the caller spends the Marks. */
export function buyPair(marks: number): PairPurchase {
  const parked = loadParked()
  if (1 + parked.length >= MAX_LOADOUTS) return { ok: false, marks, why: 'at-cap', say: `Three is what a keeper can carry. Nobody down here will sell you a fourth.` }
  if (marks < PAIR_PRICE) return { ok: false, marks, why: 'too-dear', say: `${PAIR_PRICE} Marks for the pair — grown, not ridden in. Come back with them.` }
  saveParked([...parked, emptyParked()])
  return { ok: true, marks: marks - PAIR_PRICE, say: 'A focus and a bracelet, both empty. Write something on them.' }
}

/**
 * Swap the active loadout with parked loadout `i` (0-based in the parked list). The active slots and
 * pair go into the parked place; the parked ones become active. The bag is untouched — loose letters
 * are the keeper's, not the paper's. Returns false when `i` names nothing.
 *
 * ⚠ Reads the active pair through `loadLetters` with the ACTIVE saved loadout, so a keeper who has
 * never been seeded gets seeded first (the migration door) rather than swapping an empty pair in.
 */
export function swapTo(i: number, birth: string | null, starter?: string): boolean {
  const parked = loadParked()
  const next = parked[i]
  if (!next) return false
  const active = loadLetters(birth, rawLoadout(), starter)
  const activeSlots: Loadout = ALL_BANDS.map((_, k) => rawLoadout()[k] ?? null)
  parked[i] = { slots: activeSlots, vessels: active.vessels }
  saveParked(parked)
  saveLoadout(next.slots)
  saveLetters({ bag: active.bag, vessels: next.vessels })
  return true
}

/** the two keys a swap writes — restated for the guard that checks every keeper key is registered */
export const SWAP_WRITES: readonly string[] = [LOADOUT_KEY, VESSELS_KEY]
