// THE ATHER TRADING CO.'S CITADEL OFFICE: the clerk's lines (SIGNED by Alex 2026-11-18, athernyx c953f92,
// CANON/game/co-citadel-office-script.md; drafted by @lark, F3 kept, B4 = "Delivered. Here's your pay.").
// ★ Every CLERK line below is copied from the signed script, never edited here. The clerk is nameless, never says "Keeper",
//   never speaks of the Ather or spirits. Change a line = a new lark draft + Alex's sign-off, then copy it in.
// Build (play, 11-18): the clerk TALKS FIRST like the continent's other counters (BETA M13, shared/npc-talk.tsx).
//   · first visit (garden flag CO_SEEN_KEY): the four greeting lines, one bubble each, then the board
//   · later visits: a flavour line (F1..F3, cycled) as the hello; answers: the board, or goodbye
//   · the board panel speaks B1 / B3 / B6; taking one B2; refusals B7 (already holding) / B8 (will not fit)
//   · delivery happens at the drop town, not this counter, so B4 / B5 (alternating) open the delivery message
//   · leaving the counter: B9, or B10 while a contract is held
// The keeper's answer labels (CO_ASK) are NOT the signed script: they are build placeholders for @lark.
import type { TalkNode } from '../shared/npc-talk'
import { gardenKey } from '@/lib/keeper-local'

export const CO_SIGN = 'ATHER TRADING CO.'
export const CO_SIGN_SMALL = 'Haul contracts posted within. Goods paid in Marks.'
export const CO_GREETING = [
  'Ather Trading Co. We post haul contracts.',
  'Pick one off the board. Carry the goods where it says.',
  "Hand it in at the far end and you're paid in Marks.",
  'One at a time. Goods only. Take your time.',
] as const
export const CO_BARK = {
  board: "Board's up. Have a look.",                                // B1
  taken: "That one's yours. Mind the load.",                       // B2
  holding: "You've still got one out. Finish it first.",           // B3
  paid: "Delivered. Here's your pay.",                              // B4
  paid2: 'Good. The Co. likes a clean haul.',                       // B5
  empty: 'Nothing posted. Come back later.',                        // B6
  second: "One at a time. That's the rule.",                        // B7
  tooBig: 'Won\'t fit. Find a lighter one, or a bigger load.',      // B8
  bye: 'Safe roads.',                                               // B9
  byeHolding: "It won't deliver itself.",                           // B10
} as const
export const CO_FLAVOUR = [
  "Hear that? That's the Exchange next door. It never quite stops.",
  'This is only the Citadel office. The house itself is at Lingston.',
  "Wend minds the counter at Lingston — and Benji's name is on the door. Mine isn't.",
] as const

/** The keeper's answers. PLACEHOLDERS for @lark (not part of the signed script). */
export const CO_ASK = { next: '…', board: 'The board.', bye: 'Goodbye.' } as const

/** What the board panel's clerk line says right now. */
export const boardLine = (holding: boolean, posted: number) => (holding ? CO_BARK.holding : posted === 0 ? CO_BARK.empty : CO_BARK.board)
/** Why a take was refused, in the clerk's words (trade.ts accept: holding one, or too many crates for the load). */
export const refusalLine = (holding: boolean) => (holding ? CO_BARK.second : CO_BARK.tooBig)
/** The delivery message's opening: B4 and B5 alternate by the count of runs delivered (ledger.deeds). */
export const paidLine = (deeds: number) => (deeds % 2 === 1 ? CO_BARK.paid : CO_BARK.paid2)
/** The goodbye toast. */
export const byeLine = (holding: boolean) => (holding ? CO_BARK.byeHolding : CO_BARK.bye)

export interface CoActs { board: () => void; bye: () => void; next: () => void }
/** The clerk's talk. `greet` = the step of the first-visit greeting (null once it has been heard); `visit` picks the
 *  flavour line on later visits (cycled, so a keeper hears all three). */
export function coTalk(greet: number | null, visit: number, a: CoActs): TalkNode {
  if (greet !== null && greet < CO_GREETING.length) {
    const last = greet === CO_GREETING.length - 1
    return { line: CO_GREETING[greet], options: [last ? { label: CO_ASK.board, pick: a.board } : { label: CO_ASK.next, pick: a.next }] }
  }
  return {
    line: CO_FLAVOUR[((visit % CO_FLAVOUR.length) + CO_FLAVOUR.length) % CO_FLAVOUR.length],
    options: [{ label: CO_ASK.board, pick: a.board }, { label: CO_ASK.bye, pick: a.bye }],
  }
}

// ── the garden's flag: the greeting was heard (and a visit count for the flavour cycle) ─────────────────────────
export const CO_SEEN_KEY = 'open.co-office.v1'
export interface CoSeen { v: 1; greeted: boolean; visits: number }
export const adoptCoSeen = (raw: unknown): CoSeen => {
  const v = raw as Partial<CoSeen> | null
  return v?.v === 1 ? { v: 1, greeted: v.greeted === true, visits: Number.isFinite(v.visits) ? Math.max(0, Math.floor(v.visits as number)) : 0 } : { v: 1, greeted: false, visits: 0 }
}
export function loadCoSeen(): CoSeen { try { return adoptCoSeen(JSON.parse(localStorage.getItem(gardenKey(CO_SEEN_KEY)) ?? 'null')) } catch { return adoptCoSeen(null) } }
export function saveCoSeen(s: CoSeen) { try { localStorage.setItem(gardenKey(CO_SEEN_KEY), JSON.stringify(s)) } catch { /* private window */ } }
