// loadout.ts — the loadout a keeper CHOSE, persisted.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────
// `cast.ts` already owns the chain (owned runes → known moves → a slot → an archetype) and hands
// out `defaultLoadout(owned)`: the first eligible move per slot, preferring ones the sim can run.
// That is a sensible STARTING loadout and it was the only one — `Shimmer3D` recomputed it on every
// load, so a keeper could receive a loadout but never pick one. This module is the missing half.
//
// It stores choices only. Every rule about what may go in a slot stays in `cast.ts` (`canSlot`),
// so there is one definition of legality and this file cannot drift from it.

import { CAST_SLOTS, canSlot, defaultLoadout } from './cast'
import type { Book } from './scroll-market'
import { keeperKey } from '@/lib/keeper-local'

export const LOADOUT_KEY = 'ather:shimmer:loadout'

/** One move id per slot, positionally matching `CAST_SLOTS`. `null` = deliberately empty. */
export type Loadout = (string | null)[]

/**
 * ── ★★★ THE SHAPE A SAVED LOADOUT USED TO HAVE ────────────────────────────────────────────────
 * `CAST_SLOTS` is about to collapse from four slots to two (Alex, 2026-08-23: the castable set is
 * exactly Tactical + Signature, because `moves.md:85` makes Signature the Ultimate band, passives
 * are not cast and combos are pair-casting). Every loadout already on a keeper's machine was
 * written against THIS list, and a stored loadout is POSITIONAL — index 0 means whatever
 * `CAST_SLOTS[0]` meant on the day it was saved.
 *
 * ⚠ WITHOUT A MIGRATION THE FAILURE IS NOT "falls back to a default" — IT IS AN EMPTY CAST BAR.
 * That is worth spelling out because the ruling predicted the gentler version. `loadLoadout`
 * returns the default only when NO save exists; a save that exists is mapped slot by slot. So a
 * four-entry save read through a two-entry `CAST_SLOTS` hands slot 0 the old PASSIVE id and slot 1
 * the first TACTICAL id, `canSlot` rejects both on tier, and the keeper loads in with both slots
 * null. They do not get a starter kit. They get nothing, and nothing about it looks like an error.
 */
export const LEGACY_CAST_SLOTS: readonly string[] = ['passive', 'tactical', 'tactical', 'ultimate'] as const

/**
 * Re-seat a save written against `LEGACY_CAST_SLOTS` into `target`, BY TIER rather than by index.
 *
 * ★ THE MAPPING IS DERIVED, NOT TABULATED. The obvious implementation is a hand-written index map
 * (`new[0] = old[1]; new[1] = old[3]`), and it is the wrong shape for the same reason this repo
 * keeps filing bugs about hand-kept mirrors: it silently stops being right the day either list
 * moves, and it agrees with itself while it does. Reading both lists and matching kinds means the
 * day someone adds a second tactical back, this function is already correct.
 *
 * The passive entry is DROPPED rather than rehomed, and that is the ruling rather than data loss:
 * the passive becomes innate and always-on, so the move is not taken away from the keeper, it
 * stops needing a slot to live in.
 *
 * `target` is REQUIRED. An `= CAST_SLOTS` default would let every un-updated call site keep the
 * old answer silently, which is the exact trap `cast.ts` documents on `eligibleMoves`' book
 * parameter. Required means the compiler walks the call sites.
 */
export function migrateLegacyLoadout(saved: (string | null)[], target: readonly string[]): (string | null)[] {
  const pool = LEGACY_CAST_SLOTS.map((kind, i) => ({ kind, id: saved[i] ?? null, taken: false }))
  return target.map((kind) => {
    const hit = pool.find((e) => !e.taken && e.kind === kind && e.id !== null)
    if (!hit) return null
    hit.taken = true
    return hit.id
  })
}

/**
 * Is this stored array from before the collapse?
 *
 * Length is the discriminator and it is a sound one HERE, though it would not be in general:
 * `saveLoadout` slices to exactly `CAST_SLOTS.length` on every write, so a save is always exactly
 * as long as the slot list of the day it was written. Four means the four-slot era.
 *
 * ⚠ While `CAST_SLOTS` is still four this returns true for CURRENT saves too — deliberately. The
 * migration is identity in that case (four kinds re-seated into the same four kinds), so this
 * lands as a no-op today and becomes load-bearing the moment the collapse ships. A safety net that
 * arrives with the fall is a safety net nobody got to test.
 */
export function isLegacyLoadout(saved: unknown[]): boolean {
  return saved.length === LEGACY_CAST_SLOTS.length
}

/**
 * ── ★ A SAVED EMPTY SLOT IS A CHOICE, NOT A HOLE ──────────────────────────────────────────────
 * The tempting shape is "fill any null slot from the default". It is wrong: a keeper who clears
 * their ultimate to run without one would find it silently refilled on the next load, and the game
 * would be overriding a deliberate decision every time. So the distinction is drawn at the SAVE,
 * not at the slot:
 *
 *   no save at all  → a keeper who has never chosen → `defaultLoadout` (the helpful starting kit)
 *   a save exists   → they have chosen → honour it exactly, nulls included
 *
 * ── ★ AND A SAVE IS VALIDATED, NEVER TRUSTED ──────────────────────────────────────────────────
 * A stored id can become illegal without anything being wrong: canon retires a move, a rune is
 * revoked by the owner tool, or the save predates a registry change. An illegal bind must fail to
 * EMPTY (the slot reads as unbound, which is a state the HUD already renders honestly) rather than
 * bind a move whose spec no longer exists — that would reach the frame loop as a cast that silently
 * does nothing, which is precisely the "cast is broken" report `cast.ts`'s honesty rule was written
 * to prevent.
 */
export function loadLoadout(owned: string[], book: Book): Loadout {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(keeperKey(LOADOUT_KEY))
  } catch {
    return defaultLoadout(owned, book)  // private mode — a keeper who cannot save still gets a kit
  }
  if (!raw) return defaultLoadout(owned, book)

  let saved: unknown
  try {
    saved = JSON.parse(raw)
  } catch {
    return defaultLoadout(owned, book)  // corrupt JSON reads as "never chosen", not as an empty loadout
  }
  if (!Array.isArray(saved)) return defaultLoadout(owned, book)

  // ★ RE-SEAT BEFORE VALIDATING, NEVER AFTER. `canSlot` asks whether a move is legal in a slot
  // NUMBER, so validating first would judge every legacy id against the wrong slot and null it —
  // the migration would then be handed an already-emptied array and faithfully preserve nothing.
  // The order is the whole fix.
  const seated: (string | null)[] = isLegacyLoadout(saved)
    ? migrateLegacyLoadout(saved.map((id) => (typeof id === 'string' ? id : null)), CAST_SLOTS)
    : saved.map((id) => (typeof id === 'string' ? id : null))

  return CAST_SLOTS.map((_, i) => {
    const id = seated[i]
    if (typeof id !== 'string') return null
    return canSlot(owned, i, id, book) ? id : null
  })
}

/**
 * The saved loadout EXACTLY as stored — no validation, no default. Exists for one caller: the book
 * migration, which must seed from what the keeper literally had bound. `loadLoadout` cannot serve
 * it, because validating a bind now requires a book and the book is what we are building.
 *
 * ⚠⚠ THIS DELIBERATELY DOES **NOT** MIGRATE, AND THE NEXT PERSON TO NOTICE WILL WANT TO "FIX" IT.
 * `loadLoadout` re-seats a legacy save because it is answering "what is bound NOW", and under the
 * two-slot ruling a passive is not bound to anything. `keeperBook` is asking a different question
 * — "what has this keeper LEARNED" — and a passive they had equipped is something they learned.
 * Dropping it here would not tidy a stale slot; it would silently revoke a move from their book,
 * on a path with no UI and no error. Same array, two questions, and only one of them wants the
 * migration.
 */
export function rawLoadout(): (string | null)[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(keeperKey(LOADOUT_KEY)) ?? 'null')
    if (!Array.isArray(saved)) return []
    return saved.map((id) => (typeof id === 'string' ? id : null))
  } catch { return [] }
}

export function saveLoadout(slots: Loadout): void {
  try {
    localStorage.setItem(keeperKey(LOADOUT_KEY), JSON.stringify(slots.slice(0, CAST_SLOTS.length)))
  } catch { /* private mode */ }
}

/**
 * Put a move in a slot (or clear it with `null`), returning the new loadout. Refuses an illegal
 * bind by returning the loadout unchanged — the caller cannot produce an invalid state.
 *
 * ★ A move already bound elsewhere MOVES rather than duplicating. Two slots holding one move is
 * never what a keeper meant: it burns a slot and, for anything on a cooldown, presents two buttons
 * that are secretly one. `defaultLoadout` already refuses duplicates for the same reason, so
 * allowing them here would make hand-picking worse than the automatic kit.
 */
export function setSlot(owned: string[], slots: Loadout, slot: number, moveId: string | null, book: Book): Loadout {
  if (slot < 0 || slot >= CAST_SLOTS.length) return slots
  if (moveId !== null && !canSlot(owned, slot, moveId, book)) return slots
  const next = CAST_SLOTS.map((_, i) => (i === slot ? moveId : (slots[i] ?? null)))
  if (moveId !== null) {
    for (let i = 0; i < next.length; i++) if (i !== slot && next[i] === moveId) next[i] = null
  }
  return next
}
