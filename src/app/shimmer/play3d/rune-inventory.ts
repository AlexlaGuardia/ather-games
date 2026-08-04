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
// HOW a second rune is acquired is an [OPEN] canon gap (CANON_GAPS.md — can a Knowledge Scroll
// teach a move? was ruled; rune acquisition itself is not). So this module deliberately ships NO
// acquisition rules: it stores what you hold and exposes a grant used only by the owner dev tool.
// Nothing in the game grants a second rune yet. When Magii rules acquisition, the granter is here.

/** legacy single-rune key — still the source of truth for the BIRTH rune (BirthScreen writes it) */
export const BIRTH_KEY = 'ather:shimmer:birthRune'
/** the inventory: every rune held, birth rune first */
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
    const birth = localStorage.getItem(BIRTH_KEY)
    const raw = localStorage.getItem(RUNES_KEY)
    const extra: string[] = raw ? JSON.parse(raw) : []
    return normalize(birth, Array.isArray(extra) ? extra.filter((r) => typeof r === 'string') : [])
  } catch {
    return EMPTY_INVENTORY  // private mode / corrupt JSON — a keeper with no runes, not a crash
  }
}

export function saveRuneInventory(inv: RuneInventory): void {
  try {
    if (inv.birth) localStorage.setItem(BIRTH_KEY, inv.birth)
    localStorage.setItem(RUNES_KEY, JSON.stringify(inv.owned))
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
