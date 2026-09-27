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
 *   · it arrives WITH its letters grown in — every vessel does since THE LETTERS GROW IN (ruled 09-27)
 *   · the cutter charges `FINISH_FEE` Marks for the work, less `STONE_CREDIT` per held stone of the word
 *     (part-payment, `cutterPrice`)
 *   · pieces survive runs and survive a new world (the ledger, not the character), like the trials
 * ⚠ TBD-CANON: a season vessel's own name and look. Until a season is authored, a finished one is drawn
 * and named as its tier's material (`TIER_MATERIAL`), and no copy here names a season.
 */
import { keeperKey } from '@/lib/keeper-local'
import { grantVessel, ownedCount, cutterPrice, MAX_PER_KIND, type VesselGrant, type VesselTier } from './vessels'
import { takeStones, type Letters, type Vessel } from './gems'

export const PIECES_KEY = 'ather:shimmer:vessel-pieces'
/** Rounds since the last piece, across runs — the Breach's pity counter (`hold.ts` › `pityRounds`, Alex 09-27). */
export const DRY_KEY = 'ather:shimmer:vessel-dry'
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
export function loadDry(): number {
  try {
    const n = Number(localStorage.getItem(keeperKey(DRY_KEY)) ?? 0)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch { return 0 }
}
export function saveDry(n: number): void {
  try { localStorage.setItem(keeperKey(DRY_KEY), String(Math.max(0, Math.floor(n)))) } catch { /* private mode */ }
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

export interface PieceFinish extends VesselGrant { marks: number; letters?: Letters }
/**
 * The cutter joins three pieces into a vessel of `kind` for `word`, its letters grown in. Refusals first (the
 * cheapest to fix last): not enough pieces, the cap, the fee. Spends pieces on success; the caller spends
 * Marks and saves `letters` (the stones taken as part-payment) when present.
 */
export function finishVessel(kind: Vessel, word: string, marks: number, birth: string | null, l: Letters | null = null): PieceFinish {
  if (loadPieces() < PIECES_PER_VESSEL) {
    return { ok: false, marks, why: 'not-given', say: `The cutter needs ${PIECES_PER_VESSEL} pieces to make one whole. You carry ${loadPieces()}.` }
  }
  if (ownedCount(kind) >= MAX_PER_KIND) {
    return { ok: false, marks, why: 'at-cap', say: `Three ${kind}s is what a keeper can carry, and Greg's underneath. Stow one before the cutter makes another.` }
  }
  const { price, stones } = cutterPrice(FINISH_FEE, word, l, birth)
  if (marks < price) {
    return { ok: false, marks, why: 'too-dear', say: `${price} Marks for the cutter's work. Come back with them.` }
  }
  const g = grantVessel(kind, PIECE_TIER, word, 'found')
  if (!g.ok) return { ...g, marks }
  savePieces(loadPieces() - PIECES_PER_VESSEL)
  const letters = l && stones.length ? takeStones(l, stones).letters : undefined
  const paid = stones.length ? ` ${stones.length} of your stones went toward it.` : ''
  return { ...g, marks: marks - price, letters, say: `The cutter joins the three pieces. ${g.say}${paid}` }
}
