/**
 * greg-pair.ts — WHETHER GREG'S BRACELET HAS BEEN IMBUED, and the one exception that follows from it.
 *
 * ── ★★ RULED 2026-09-28 (/magii + Alex, `shimmer-casting-vessels.md` › THE BIRTH LETTER COMES FIRST) ──
 * The birth rune is the FIRST letter of both of Greg's vessels and glows from day one (it is the keeper).
 * Greg hands over the bracelet with the birth letter in and the GEMS for the rest in the keeper's hand;
 * he gives, he does not teach (08-15). The Enchant Temple weaves the gems into the empty seats and teaches
 * the word as it does, so the bracelet leaves the Temple known and lit. That is the first errand.
 *
 * ★ A GEM IN THE SEAT COUNTS AS HOLDING THAT RUNE, INSIDE GREG'S PAIR ONLY. It lights that one word in that
 * one vessel and teaches nothing of the rune beyond it. ⛔ Never general: anywhere else a rune in a word is a
 * rune the keeper holds, or the ALSO NEEDS rack collapses. So the exception is stored as exactly ONE word id,
 * the word the Temple imbued, and `eligibleMoves` waives the rune check for that id and no other.
 *
 * Kept tiny and dependency-free on purpose: `cast.ts` reads it, and `vessels.ts` (which imports cast) writes
 * it, so anything heavier here would close an import cycle.
 */
import { keeperKey } from '@/lib/keeper-local'

export const GREG_IMBUED_KEY = 'ather:shimmer:greg-imbued'

/** the word the Enchant Temple imbued Greg's bracelet for, or null while Greg's gems are still in hand */
export function imbuedWord(): string | null {
  try {
    const raw = localStorage.getItem(keeperKey(GREG_IMBUED_KEY))
    return raw && raw.length < 64 ? raw : null
  } catch { return null }
}

export function markImbued(word: string): void {
  try { localStorage.setItem(keeperKey(GREG_IMBUED_KEY), word) } catch { /* private mode */ }
}

/** a rebirth: a different keeper carries Greg's gems again, and the glove's road starts over */
export function clearImbued(): void {
  try { localStorage.removeItem(keeperKey(GREG_IMBUED_KEY)); localStorage.removeItem(keeperKey(GREG_GLOVE_KEY)) } catch { /* private mode */ }
}

// ── ★ THE GLOVE'S ROAD (RULED 09-28, casting-vessels › HOW GREG'S GLOVE IS EARNED) ──────────────────────
// Greg points back to the Temple → Idony reads the glove and names the Breach (`asked`) → a Breach cache past a
// real round holds the glove's stones (`stones`) → Idony weaves them in and the keeper says the word (`imbued`,
// the glove's word, which the seat-gem exception then covers exactly as it covers the bracelet's).
export const GREG_GLOVE_KEY = 'ather:shimmer:greg-glove'
export interface GloveRoad { asked: boolean; stones: boolean; imbued: string | null }
const NO_ROAD: GloveRoad = { asked: false, stones: false, imbued: null }
export function gloveRoad(): GloveRoad {
  try {
    const raw = localStorage.getItem(keeperKey(GREG_GLOVE_KEY))
    const o = raw ? JSON.parse(raw) : null
    return o && typeof o === 'object' ? { asked: !!o.asked, stones: !!o.stones, imbued: typeof o.imbued === 'string' && o.imbued.length < 64 ? o.imbued : null } : { ...NO_ROAD }
  } catch { return { ...NO_ROAD } }
}
export function saveGloveRoad(r: GloveRoad): void {
  try { localStorage.setItem(keeperKey(GREG_GLOVE_KEY), JSON.stringify(r)) } catch { /* private mode */ }
}
/** every word the seat-gem exception covers: the bracelet's and, once woven, the glove's (Greg's pair only) */
export function seatGemWords(): string[] {
  return [imbuedWord(), gloveRoad().imbued].filter((w): w is string => !!w)
}
