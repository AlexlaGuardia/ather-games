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

import { ALL_BANDS, canSlot, defaultLoadout } from './cast'
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
 * ── ⚠ THE PASSIVE IS DROPPED HERE, AND THAT IS CORRECT NOW (RULED 2026-08-26, Alex) ────────────
 * This block has said three different things, so read the current one carefully. `target` is the
 * BOUND bands (`ALL_BANDS` = tactical + ultimate); it has no `passive` kind, so the pool's passive
 * entry matches nothing and the old passive id is dropped from the loadout array. That is NOT data
 * loss: since the 2026-08-26 ruling the passive is not stored, equipped or chosen — it is DERIVED
 * from the keeper's runes and always-on (`cast.ts` › `derivePassive`). The stored id was redundant
 * with that derivation, so dropping it takes nothing away; the keeper still runs their passive, it
 * just no longer lives in this array.
 *
 * (History, because the reversals matter: v1 dropped it calling it "innate"; the 2026-08-25 stance
 * socket briefly RE-SEATED it into a `passive` band; the 2026-08-26 ruling removed that band, so it
 * is dropped again — for the derivation reason above, not the innate one. The match-by-KIND design
 * is why none of these three needed a code change: give `target` a passive band and the id re-seats;
 * take the band away and it drops. A hand-written index map would have been wrong in all three.)
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
 * ⚠ THIS IS LIVE NOW. It was inert by construction until 2026-08-25 (four kinds re-seated into the
 * same four kinds is identity); the collapse shipped that day and every pre-collapse save on a real
 * keeper's machine now takes this path for real. The net was landed first and exercised against the
 * shape it would meet, deliberately — a safety net that arrives with the fall is a net nobody tested.
 *
 * ⚠ AND IT MUST KEEP COMPARING AGAINST `LEGACY_CAST_SLOTS.length`, NEVER `ALL_BANDS.length`. They
 * are 4 and 2 today and both are free to move; the day someone "tidies" this into a comparison
 * against the current band list, every current save starts reading as legacy and gets re-seated a
 * second time — which is not a no-op, because re-seating a 2-array through a 4-kind pool matches by
 * position-of-kind and silently reshuffles live binds.
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
    ? migrateLegacyLoadout(saved.map((id) => (typeof id === 'string' ? id : null)), ALL_BANDS)
    : saved.map((id) => (typeof id === 'string' ? id : null))

  return ALL_BANDS.map((_, i) => {
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
 * `loadLoadout` re-seats and VALIDATES because it answers "what is bound NOW". `keeperBook` asks a
 * different question — "what has this keeper LEARNED" — and every id ever stored here is something
 * they learned, whatever band it sits in today. Same array, two questions, and only one of them
 * wants the migration.
 *
 * ⚠ NOTE THE REASON CHANGED ON 2026-08-25 EVEN THOUGH THE CODE DID NOT. This used to argue "under
 * the two-slot ruling a passive is not bound to anything", which stopped being true when the stance
 * socket landed — the passive IS bound now. The function is still right, for a *different* reason:
 * it is the VALIDATION it must skip, not the migration's drop. `loadLoadout` nulls any id that is
 * illegal today (a retired move, a revoked rune), and a book seeded from a validated array would
 * quietly forget every move a keeper learned and later un-equipped.
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
    localStorage.setItem(keeperKey(LOADOUT_KEY), JSON.stringify(slots.slice(0, ALL_BANDS.length)))
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
  if (slot < 0 || slot >= ALL_BANDS.length) return slots
  if (moveId !== null && !canSlot(owned, slot, moveId, book)) return slots
  const next = ALL_BANDS.map((_, i) => (i === slot ? moveId : (slots[i] ?? null)))
  if (moveId !== null) {
    for (let i = 0; i < next.length; i++) if (i !== slot && next[i] === moveId) next[i] = null
  }
  return next
}
