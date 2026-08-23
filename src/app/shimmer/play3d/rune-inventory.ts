// rune-inventory.ts — the runes a keeper OWNS.
//
// ── WHY THIS EXISTS (Alex, 2026-08-03) ────────────────────────────────────────
// "The birth rune sets the tone — the innate passive. It doesn't decide the tactical or the
// special." v2 had collapsed identity into an attack (birthRune → bolt archetype). The correction
// makes the birth rune **rune #1 of an inventory**, not the whole character: you are born with one,
// you develop or acquire more, and your MOVES come from the runes you hold (keeper-moves.ts inverts
// each move's rune requirement to build the book).
//
// So the chain is: owned runes → known moves → a loadout slot → a cast archetype. This module owns
// the first link only.
//
// ── BOUNDARY ──────────────────────────────────────────────────────────────────
// ★ CORRECTED 2026-08-12 — this note used to say rune acquisition was an [OPEN] canon gap. IT IS
// NOT, and had not been for nine days. CANON_GAPS.md carries TWO rulings from 2026-08-03:
//
//   1. THE LANE LAW (rune acquisition). A rune is TRAINED off the birth rune along its own lane —
//      the element ROW (same substance, different behaviour ⇒ breadth ⇒ tacticals) or the state
//      COLUMN (same behaviour, different substance ⇒ scarcity ⇒ the signature). Canon's phrase is
//      "focused practice using your birth rune". A rune is never bought, and never taught: it is
//      identity. Veyra's Breeze and Lazerin's Illuminate are the law's second clause, not exceptions.
//   2. THE SCROLL RULING (move acquisition). A Knowledge Scroll teaches a MOVE, never a RUNE, and
//      the rune you hold is the FILTER on what a scroll can even teach you. The Passage, under
//      Rune Hold, is where that trade happens. It stocks passives and tacticals; ULTIMATES ARE NOT
//      FOR SALE — a signature comes from a teacher, a bond, a debt, a crucible.
//
// So the granter's SHAPE is ruled and this module can be built against. What canon does not state
// is which act of play COUNTS as focused practice (a spar count? a threshold? a place?) — and by
// the boundary test that is Jin's, not Magii's: choosing the trigger cannot contradict the books.
//
// What is still true: nothing in the shipped game grants a second rune. The only caller of
// `grantRune` is a dev tool (play3d's ☰, and voxel3d's owner-gated `/rune`). When the trigger is
// built, it belongs here — and it must respect the lane, or it is not the ruled system.

import { keeperKey } from '@/lib/keeper-local'

/**
 * legacy single-rune key — still the source of truth for the BIRTH rune (BirthScreen writes it).
 *
 * ⚠ THE BASE, NOT THE KEY. Both of these are per-KEEPER, so they are read and written through
 * `keeperKey()` — a second account on this browser used to find the first keeper's rune sitting
 * here, skip the ritual, and spawn holding somebody else's affinity and cast book. `KEEPER_KEYS`
 * lists both and `keeper-local.test.ts` fails if either is renamed out from under it.
 */
export const BIRTH_KEY = 'ather:shimmer:birthRune'
/** the inventory: every rune held, birth rune first. Per keeper — see `BIRTH_KEY`. */
export const RUNES_KEY = 'ather:shimmer:runes'

export interface RuneInventory {
  /** the rune you were born with. Never removable — it is who you are, not what you carry. */
  birth: string | null
  /** every rune held, birth first. `owned[0] === birth` whenever birth is set. */
  owned: string[]
}

export const EMPTY_INVENTORY: RuneInventory = { birth: null, owned: [] }

/** birth rune first, then the rest, de-duped. The one place ordering is decided. */
function normalize(birth: string | null, extra: string[]): RuneInventory {
  const owned = [...new Set([...(birth ? [birth] : []), ...extra])]
  return { birth, owned }
}

/**
 * Read the inventory from localStorage.
 *
 * MIGRATION: a returning keeper has only the legacy birth key. That reads as a one-rune inventory —
 * which is exactly right, since nothing has ever granted a second rune. No save is rewritten on
 * read; `saveRuneInventory` is what persists the richer shape.
 */
export function loadRuneInventory(): RuneInventory {
  try {
    const birth = localStorage.getItem(keeperKey(BIRTH_KEY))
    const raw = localStorage.getItem(keeperKey(RUNES_KEY))
    const extra: string[] = raw ? JSON.parse(raw) : []
    return normalize(birth, Array.isArray(extra) ? extra.filter((r) => typeof r === 'string') : [])
  } catch {
    return EMPTY_INVENTORY  // private mode / corrupt JSON — a keeper with no runes, not a crash
  }
}

export function saveRuneInventory(inv: RuneInventory): void {
  try {
    if (inv.birth) localStorage.setItem(keeperKey(BIRTH_KEY), inv.birth)
    localStorage.setItem(keeperKey(RUNES_KEY), JSON.stringify(inv.owned))
  } catch { /* private mode */ }
}

/** Add a rune to the inventory. Idempotent; never displaces the birth rune from slot 0. */
export function grantRune(inv: RuneInventory, runeId: string): RuneInventory {
  if (inv.owned.includes(runeId)) return inv
  return normalize(inv.birth, [...inv.owned, runeId])
}

/** Drop a developed rune. The birth rune is refused — you cannot un-be born. */
export function revokeRune(inv: RuneInventory, runeId: string): RuneInventory {
  if (runeId === inv.birth) return inv
  return normalize(inv.birth, inv.owned.filter((r) => r !== runeId))
}

/** Set the birth rune (birth screen, or the owner's dev swap). Keeps any developed runes. */
export function setBirthRune(inv: RuneInventory, runeId: string): RuneInventory {
  return normalize(runeId, inv.owned.filter((r) => r !== inv.birth))
}
