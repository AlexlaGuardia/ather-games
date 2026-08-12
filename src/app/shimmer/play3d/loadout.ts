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

export const LOADOUT_KEY = 'ather:shimmer:loadout'

/** One move id per slot, positionally matching `CAST_SLOTS`. `null` = deliberately empty. */
export type Loadout = (string | null)[]

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
export function loadLoadout(owned: string[]): Loadout {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(LOADOUT_KEY)
  } catch {
    return defaultLoadout(owned)  // private mode — a keeper who cannot save still gets a kit
  }
  if (!raw) return defaultLoadout(owned)

  let saved: unknown
  try {
    saved = JSON.parse(raw)
  } catch {
    return defaultLoadout(owned)  // corrupt JSON reads as "never chosen", not as an empty loadout
  }
  if (!Array.isArray(saved)) return defaultLoadout(owned)

  return CAST_SLOTS.map((_, i) => {
    const id = saved[i]
    if (typeof id !== 'string') return null
    return canSlot(owned, i, id) ? id : null
  })
}

export function saveLoadout(slots: Loadout): void {
  try {
    localStorage.setItem(LOADOUT_KEY, JSON.stringify(slots.slice(0, CAST_SLOTS.length)))
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
export function setSlot(owned: string[], slots: Loadout, slot: number, moveId: string | null): Loadout {
  if (slot < 0 || slot >= CAST_SLOTS.length) return slots
  if (moveId !== null && !canSlot(owned, slot, moveId)) return slots
  const next = CAST_SLOTS.map((_, i) => (i === slot ? moveId : (slots[i] ?? null)))
  if (moveId !== null) {
    for (let i = 0; i < next.length; i++) if (i !== slot && next[i] === moveId) next[i] = null
  }
  return next
}
