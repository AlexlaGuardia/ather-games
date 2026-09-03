// The keeper's book — which moves they have actually LEARNED, persisted.
//
// The sibling of `loadout.ts`: that file stores which moves a keeper CHOSE to carry, this one
// stores which ones they know at all. `scroll-market.ts` owns every rule about how a move is
// obtained; this is storage and the migration, nothing else.
//
// ── ★ THE MIGRATION RUNS ONCE, ON A KEEPER WHO PREDATES THE IDEA OF LEARNING ────────────────────
// Every save alive today was written under "your runes ARE your moves". The moment `eligibleMoves`
// starts requiring the book, a keeper with no stored book has an EMPTY one — and four dead cast
// keys on the next load, with their bound moves silently gone. That is the worst possible first
// contact with a feature whose whole purpose is to GIVE you moves.
//
// So the absence of a stored book is read as "has never been migrated", not as "knows nothing",
// and `seedBook` fills it from what the keeper demonstrably carries. Same reasoning as
// `loadLoadout`'s no-save-vs-empty-save distinction one file over, and the same trap avoided:
// absence and emptiness are different states and must not share a representation.
//
// ⚠ The seed is written back immediately. If it were derived on every load instead, a keeper who
// later unbound a move would "un-learn" it — the migration would keep re-running against a moving
// input and quietly delete knowledge.

import { seedBook, starterFor, type Book } from './scroll-market'
import { rawLoadout } from './loadout'
import { keeperKey } from '@/lib/keeper-local'

export const BOOK_KEY = 'ather:shimmer:book'

/**
 * Read the book, migrating a pre-book keeper on first call.
 *
 * @param bound   the keeper's currently bound loadout — what they demonstrably carry
 * @param starter a move to guarantee (Gregory's gift). See the note in `seedBook`: a book that
 *                comes out empty leaves a keeper with no way at all to arm a cast key, and the only
 *                fix in the world is a town they may not have found yet.
 */
export function loadBook(bound: readonly (string | null)[], starter?: string): Book {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(keeperKey(BOOK_KEY))
  } catch {
    return seedBook(bound, starter)   // private mode: no persistence, but never an empty book
  }
  if (raw) {
    try {
      const saved: unknown = JSON.parse(raw)
      if (Array.isArray(saved)) return { learned: saved.filter((id): id is string => typeof id === 'string') }
    } catch { /* corrupt → fall through and re-seed, same as loadLoadout treats bad JSON */ }
  }
  const seeded = seedBook(bound, starter)
  saveBook(seeded)
  return seeded
}

export function saveBook(book: Book): void {
  try {
    localStorage.setItem(keeperKey(BOOK_KEY), JSON.stringify(book.learned))
  } catch { /* private mode */ }
}

/**
 * Forget the book, so the next `loadBook` re-seeds it from the (also cleared) loadout and Gregory's
 * gift for the NEW runes. One caller: a rebirth. ⚠ A book that survives a rebirth keeps the old
 * keeper's moves as "learned" — the epoch sweep deliberately lets the book outlive a WORLD
 * (`keeper-local.ts`: `worldTied: false`), but a different BIRTH is a different keeper.
 */
export function clearBook(): void {
  try {
    localStorage.removeItem(keeperKey(BOOK_KEY))
  } catch { /* private mode */ }
}

/**
 * The book for the keeper holding these runes — the one call every consumer should make.
 * Composes the two halves the migration needs (what was literally bound + Gregory's gift, resolved
 * against the keeper's own runes) so no call site has to remember either.
 */
export function keeperBook(ownedRunes: readonly string[]): Book {
  return loadBook(rawLoadout(), starterFor(ownedRunes))
}
