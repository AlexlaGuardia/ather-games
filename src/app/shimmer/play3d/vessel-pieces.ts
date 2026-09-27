/**
 * vessel-pieces.ts — PIECES OF A SEASON'S VESSEL: found in the Breach's caches, finished by the Passage's cutter.
 *
 * ── ★ CANON (`game/two-lines-two-games.md` › ON A LIVE WORLD › CACHES, ruled 2026-09-26) ─────────────
 * A Breach cache may hold this season's vessel *"whole, or as pieces the keeper carries home to the
 * Passage's cutter, who finishes it."* ⛔ A keeper never assembles one (09-04: vessel-making is a trade a
 * keeper is not in). So a piece is only ever CARRIED; the cutter is the one who joins three into a vessel.
 * Found road, so the vessel comes through `grantVessel(..., 'found')`.
 *
 * ── JIN'S CALLS (Alex 09-27: "a three piece set") ──
 *   · `PIECES_PER_VESSEL` = 3 pieces, any mix — a piece is not yet a bracelet or a glove; the keeper
 *     chooses the kind and the word at the cutter, the same way the shelf cuts to order
 *   · the finished vessel is `PIECE_TIER` 2 — above the shelf's tier 1 (the shelf never sells 2–3)
 *   · it arrives WITH its letters set (the precedent is Greg's gift). The rune-gem's future is an OPEN
 *     canon gap (CANON_GAPS 09-27); this is the one door that already fits either answer
 *   · the cutter charges `FINISH_FEE` Marks for the work
 *   · pieces survive runs and survive a new world (the ledger, not the character), like the trials
 * ⚠ TBD-CANON: a season vessel's own name and look. Until a season is authored, a finished one is drawn
 * and named as its tier's material (`TIER_MATERIAL`), and no copy here names a season.
 */
import { keeperKey } from '@/lib/keeper-local'
import { grantVessel, ownedCount, seatLetters, MAX_PER_KIND, type VesselGrant, type VesselTier } from './vessels'
import { type Vessel } from './gems'

export const PIECES_KEY = 'ather:shimmer:vessel-pieces'
export const PIECES_PER_VESSEL = 3
export const PIECE_TIER: VesselTier = 2
export const FINISH_FEE = 100

export function loadPieces(): number {
  try {
    const n = Number(localStorage.getItem(keeperKey(PIECES_KEY)) ?? 0)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch { return 0 }
}
function savePieces(n: number): void {
  try { localStorage.setItem(keeperKey(PIECES_KEY), String(Math.max(0, n))) } catch { /* private mode */ }
}
/** One piece out of a cache, into the satchel. Returns how many the keeper now carries. */
export function addPiece(): number {
  const n = loadPieces() + 1
  savePieces(n)
  return n
}
/** The line a cache says when it gives a piece. */
export const pieceLine = (n: number): string =>
  n >= PIECES_PER_VESSEL
    ? `A vessel piece — ${n} carried. The Passage's cutter can finish one.`
    : `A vessel piece — ${n} of ${PIECES_PER_VESSEL}`

export interface PieceFinish extends VesselGrant { marks: number }
/**
 * The cutter joins three pieces into a vessel of `kind` for `word`, letters set. Refusals first (the
 * cheapest to fix last): not enough pieces, the cap, the fee. Spends pieces on success; the caller spends Marks.
 */
export function finishVessel(kind: Vessel, word: string, marks: number, birth: string | null): PieceFinish {
  if (loadPieces() < PIECES_PER_VESSEL) {
    return { ok: false, marks, why: 'not-given', say: `The cutter needs ${PIECES_PER_VESSEL} pieces to make one whole. You carry ${loadPieces()}.` }
  }
  if (ownedCount(kind) >= MAX_PER_KIND) {
    return { ok: false, marks, why: 'at-cap', say: `Three ${kind}s is what a keeper can carry, and Greg's underneath. Stow one before the cutter makes another.` }
  }
  if (marks < FINISH_FEE) {
    return { ok: false, marks, why: 'too-dear', say: `${FINISH_FEE} Marks for the cutter's work. Come back with them.` }
  }
  const g = grantVessel(kind, PIECE_TIER, word, 'found', seatLetters({ move: word }, birth))
  if (!g.ok) return { ...g, marks }
  savePieces(loadPieces() - PIECES_PER_VESSEL)
  return { ...g, marks: marks - FINISH_FEE, say: `The cutter joins the three pieces. ${g.say.replace(' Set its letters and it is yours to wear.', ' Its letters are woven in; it is yours to wear.')}` }
}
