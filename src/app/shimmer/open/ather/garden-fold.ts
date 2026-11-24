// ── GREG FOLDS YOUR GARDEN (BETA M71 s1; plan docs/tutorial-cluster.md › Beat 3; Magii 43fef80 Ask 6 + amendment) ─────────────
// Canon (CANON_GAPS › Glade tutorial cluster, Ask 6, RULED-AFK): a newborn keeper has NO garden until Greg folds the first one for
// grey matter (ground bought from Greg with grey matter = shimmer-geography.md:262; Greg opens every garden's first home-gate =
// glossary.md:80). The numbers are Jin's: 100 grey matter buys the first gate + the green + the initial square (the plot's
// STARTING_SQUARES, as today). Waymarks (3 free, then ~500) and the grimoire growth tiers are later slices.
// The beat: after the first settlement's thanks (Tut.m70 === 'thanked', "Go back to Greg at the Glade"), Greg offers the fold.
// Under 100 he refuses and says how much is missing; at 100+ the fold spends EXACTLY 100, records Tut.folded, and the garden's
// gate opens (the page takes the keeper home).
// ★ MIGRATION (hub hard rule): a keeper who already has a garden keeps it, untouched. glade-tutorial.ts › parseTut reads a save
//   without the field as folded, legacyTut is folded, only freshTut (a newborn from M71 on) starts unfolded.
// ★ PURE. Lines: no signed Beat 3 lines exist yet (the tutorial quest file's Gaps #6 lists Beat 3 as its own dispatch), so Greg's
//   lines here are short neutral PLACEHOLDERS for @lark (FOLD_TEXT); the keeper's "Not yet." is the signed greg.b2.choice.wait.
import type { TalkNode } from '../shared/npc-talk'
import { ANSWERS } from './greg-talk'
import { line } from './glade-tutorial-lines'
import type { Tut } from './glade-tutorial'

/** grey matter for the first garden (Alex 11-22 outline: 100) */
export const FOLD_COST = 100

/** Does this keeper have a garden to go home to? */
export const gardenOpen = (t: Tut) => t.folded
/** Greg offers the fold: unfolded, and back from the first settlement (its thanks heard). */
export const foldOffered = (t: Tut) => !t.folded && t.m70 === 'thanked'

/** M71 s2 (Magii 43fef80 #6): after the 3 free (inventory.ts FREE_WAYMARKS) Greg sells waymarks at ~500 grey matter each. */
export const WAYMARK_PRICE = 500
export type BuyResult = { ok: true; grey: number } | { ok: false; why: 'unfolded' | 'grey'; need: number }
/** Buy one waymark: only a keeper with a folded garden (a waymark leads home to it), never under the price, spends exactly it. */
export function tryBuyWaymark(t: Tut, grey: number): BuyResult {
  if (!gardenOpen(t)) return { ok: false, why: 'unfolded', need: 0 }
  const have = Math.max(0, Math.floor(grey))
  if (have < WAYMARK_PRICE) return { ok: false, why: 'grey', need: WAYMARK_PRICE - have }
  return { ok: true, grey: have - WAYMARK_PRICE }
}

export type FoldResult = { ok: true; t: Tut; grey: number } | { ok: false; why: 'folded' | 'offer' | 'grey'; need: number }
/** The fold itself: spends exactly FOLD_COST, never under it, never twice. */
export function tryFold(t: Tut, grey: number): FoldResult {
  if (t.folded) return { ok: false, why: 'folded', need: 0 }
  if (!foldOffered(t)) return { ok: false, why: 'offer', need: 0 }
  const have = Math.max(0, Math.floor(grey))
  if (have < FOLD_COST) return { ok: false, why: 'grey', need: FOLD_COST - have }
  return { ok: true, t: { ...t, folded: true }, grey: have - FOLD_COST }
}

/** @lark PLACEHOLDERS (unsigned, neutral). Swap when Beat 3 is scripted and signed. */
export const FOLD_TEXT = {
  offer: `I can fold you a garden of your own, Keeper. It takes ${FOLD_COST} grey matter.`,
  ask: `Fold my garden (${FOLD_COST} grey matter)`,
  short: (have: number) => `That is not enough yet. You have ${have} grey matter, and it takes ${FOLD_COST}.`,
  done: 'There. Your garden is folded, and its gate is open.',
  go: 'To my garden',
  // M71 s2 waymarks (@lark placeholders)
  buyAsk: `Buy a waymark (${WAYMARK_PRICE} grey matter)`,
  buyShort: (have: number) => `Not yet. You have ${have} grey matter, and a waymark takes ${WAYMARK_PRICE}.`,
  buyDone: 'Here. Bind it where the ground is yours, and it will lead you home.',
} as const

export type FoldStep = 'offer' | 'short' | 'done' | 'buyShort' | 'buyDone'
export interface FoldActs {
  /** M71 s2: commit a waymark buy (garden grey + one waymark into the bag); false = it did not fit, nothing spent */
  buy?: (grey: number) => boolean
  /** the keeper's grey matter now */
  grey: () => number
  /** commit the fold: save the garden's grey and the tutorial (garden first) */
  pay: (t: Tut, grey: number) => void
  go: (s: FoldStep | null) => void
  /** through the garden's gate: home */
  home: () => void
}
/** Greg's fold talk at `step`. */
export function foldNode(t: Tut, step: FoldStep, act: FoldActs): TalkNode {
  const notYet = { label: line('greg.b2.choice.wait'), pick: () => act.go(null) }
  if (step === 'buyShort' || step === 'buyDone') {
    const again = { label: FOLD_TEXT.buyAsk, pick: () => buyPick(t, act) }
    return { line: step === 'buyDone' ? FOLD_TEXT.buyDone : FOLD_TEXT.buyShort(Math.max(0, Math.floor(act.grey()))), options: [again, { label: ANSWERS.bye, pick: () => act.go(null) }] }
  }
  if (step === 'done') return { line: FOLD_TEXT.done, options: [{ label: FOLD_TEXT.go, pick: () => { act.go(null); act.home() } }] }
  const ask = {
    label: FOLD_TEXT.ask, pick: () => {
      const r = tryFold(t, act.grey())
      if (r.ok) { act.pay(r.t, r.grey); act.go('done') } else act.go('short')
    },
  }
  if (step === 'short') return { line: FOLD_TEXT.short(Math.max(0, Math.floor(act.grey()))), options: [ask, { label: ANSWERS.bye, pick: () => act.go(null) }] }
  return { line: FOLD_TEXT.offer, options: [ask, notYet] }
}

/** M71 s2: the 'Buy a waymark' answer (Greg's ordinary talk offers it to a folded keeper; foldNode repeats it). */
export function buyPick(t: Tut, act: FoldActs): void {
  const r = tryBuyWaymark(t, act.grey())
  if (r.ok && act.buy?.(r.grey)) act.go('buyDone'); else if (!r.ok && r.why === 'grey') act.go('buyShort'); else act.go(null)
}
