// The epoch stamp — how a world-level reset actually reaches players.
//
// ── ★ WHY A STAMP AND NOT A DELETE SCRIPT ────────────────────────────────────────────────────
// A Shimmer character does NOT live on the server. `accounts.db` holds a *mirror* of the save, but
// the things that decide who you are — your birth rune, whether you have been born at all — are
// localStorage keys in whichever browser you last played in (`Shimmer3D.tsx` reads them
// synchronously at mount, before any cloud pull resolves). So "reset all accounts" cannot be done
// by clearing a table: there is no server-side switch that reaches a key sitting in Chrome.
//
// The stamp inverts it. Each browser records which epoch it was last seeded for. Bump the constant
// and every browser that shows up — signed in or anonymous, this box or a phone — notices it is
// behind and clears its own character on the next load. One number, no per-user work, and it
// applies to accounts that have not logged in yet rather than only the ones that exist today.
//
// ── ★ WHAT IT DELIBERATELY DOES NOT TOUCH ────────────────────────────────────────────────────
// Only the Shimmer *character* is reset. Marks (`ather:save:wallet`), arcade high scores
// (`ather:best:*`), the card-game save and multiplayer identity all survive, because "start the
// world over" is not "delete everything the player has ever done on the site". Widening this list
// is a decision, not a tidy-up — an arcade score wiped by a Shimmer reset is a bug report.
//
// Voxel-world edits (IndexedDB `shimmer-voxel`) also survive: they are terrain you built, not a
// character, and `clearWorld(seed)` already exists as an explicit, deliberate action.

/**
 * Bump this to reset every existing character.
 *
 * 1 → 2 (2026-08-07, Alex): the world model moved to voxels and the birth ritual now leads into
 * the voxel dimension rather than the tile map. Every character predates that, so every character
 * is re-born.
 */
export const ATHER_EPOCH = 2

const EPOCH_KEY = 'ather:epoch'

/**
 * Keys that make up a Shimmer character. Cleared together on an epoch bump.
 *
 * ⚠ `ather:shimmer:birthRune` MUST be in this list. Clearing the save alone leaves the birth gate
 * satisfied forever — its presence is what marks a browser "already born" — so a save-only reset
 * drops the player straight back into the world with no ritual, which is the exact bug this whole
 * mechanism exists to avoid.
 */
import { SAVE_KEY_PREFIX, ANON_SAVE_KEY } from './save-slot'

const CHARACTER_KEYS = [
  ANON_SAVE_KEY,
  'ather:shimmer:birthRune',
  'ather:shimmer:birthPending',
  'ather:shimmer:runes',
]

/**
 * Clear this browser's character if it predates the current epoch. Safe to call on every mount —
 * it is a single string compare after the first run.
 *
 * Returns true when a reset actually happened, so a caller can tell "fresh player" from "player we
 * just reset" if it ever needs to say something different.
 *
 * ⚠ Call this BEFORE reading any character key. A gate that reads first and resets second sees the
 * stale value and makes its decision on it.
 */
/** The latch play3d already uses to mean "this keeper still owes me a birth ritual". */
const BIRTH_PENDING_KEY = 'ather:shimmer:birthPending'

export function resetIfStale(): boolean {
  if (typeof window === 'undefined') return false   // SSR — no storage to reset
  try {
    const seen = Number(localStorage.getItem(EPOCH_KEY) ?? '0')
    if (seen === ATHER_EPOCH) return false
    // A brand-new browser has no epoch and no character. Stamping it without a "reset" claim keeps
    // the return value honest for callers.
    // ★ EVERY SLOT, NOT JUST THE BARE ONE (#682, 2026-08-23). The shimmer save used to be a single
    // key; it is now one slot per account (`ather:save:shimmer:<user_id>`, see `lib/save-slot.ts`).
    // A reset that removed only the literal would clear the anonymous keeper and leave every
    // signed-in character behind — a pre-epoch save surviving the wipe is the precise failure this
    // whole mechanism exists to prevent, and it would come back wearing a different account's name.
    const keys = new Set(CHARACTER_KEYS)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(SAVE_KEY_PREFIX)) keys.add(k)
    }
    const hadCharacter = [...keys].some(k => localStorage.getItem(k) !== null)
    for (const k of keys) localStorage.removeItem(k)
    localStorage.setItem(EPOCH_KEY, String(ATHER_EPOCH))
    // ★ ARM THE BIRTH LATCH IN STORAGE, NOT IN MEMORY. play3d decides "new keeper" from
    // save-absence, but its starter kit persists a save as the game mounts — so a reset player can
    // already have one by the time the check runs and gets dropped into the world unborn. A
    // module-level "we just reset" flag does NOT solve this: Shimmer3D is a separately code-split
    // chunk and gets its own module instance, so the flag never reaches it (measured 2026-08-07 —
    // the reset ran, the character cleared, and the ritual still never opened). The latch is a
    // localStorage key both chunks genuinely share.
    if (hadCharacter) localStorage.setItem(BIRTH_PENDING_KEY, '1')
    return hadCharacter
  } catch {
    return false   // private mode: nothing persisted, so nothing to reset
  }
}
