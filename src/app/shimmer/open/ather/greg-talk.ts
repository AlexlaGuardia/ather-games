// ── GREG'S CONVERSATION (BETA M13, Alex 11-18): talk first, one screen per answer ───────────────────────────────────────────
// Before: E at Greg opened ONE panel with the errand, his lines, the ground grid and its prices all at once. Now E starts a
// conversation (shared/npc-talk.tsx): his line in a bubble, the keeper's answers below. "About my ground" opens the ground
// screen alone; the errand is talk; "Goodbye" leaves.
// Greg's lines are lark's, signed (business/errand-lines.ts). ★ PLACEHOLDERS for @lark: GREG_HELLO (no signed idle line exists
// yet) and the keeper's answer labels (ANSWERS). Swap them when lark's pass is signed; do not write new Greg lines here.
import { gregSendOff, gregRepeat } from '../business/errand-lines'
import type { TalkNode } from '../shared/npc-talk'
import type { GregErrand } from './panels'
import { TOUR_ASK } from './greg-tour'

export const GREG_HELLO = 'Now then, Keeper. Blue says hello.'   // @lark draft 11-18, awaiting Alex sign-off: Greg's idle greeting
export const ANSWERS = { more: 'And then?', take: 'Take the gems', ground: 'My ground', bye: 'See you, Greg.' }   // @lark draft 11-18, awaiting Alex sign-off (checks import these, never retype them)

export interface GregTalkActs { ground: () => void; bye: () => void; goto: (step: number) => void
  /** BETA M32: 'Tell me about the Ather' starts his walking tour (greg-tour.ts). Absent = no tour answer. */
  tour?: () => void }

/** The node at `step` of Greg's talk. Step 0 is where every conversation starts; steps 1+ walk the send-off lines. */
export function gregTalk(errand: GregErrand, step: number, act: GregTalkActs): TalkNode {
  const ground = { label: ANSWERS.ground, pick: act.ground }, bye = { label: ANSWERS.bye, pick: act.bye }
  // M32: the tour answer sits after the ground one (the checks pick 'ground' as the first answer; keep it there)
  const tour = act.tour ? [{ label: TOUR_ASK, pick: act.tour }] : []
  if (errand.stage === 'greg') {   // the first errand's hand-over: his signed send-off, one line a bubble, then the gems
    const lines = gregSendOff(errand.seatName, errand.where, errand.citadel), i = Math.min(step, lines.length - 1)
    const last = i === lines.length - 1
    return {
      line: lines[i],
      options: last
        ? [{ label: ANSWERS.take, pick: () => { errand.onTake(); act.bye() } }]
        : [{ label: ANSWERS.more, pick: () => act.goto(i + 1) }, ...(i === 0 ? [ground, ...tour, bye] : [])],
    }
  }
  // before the bracelet is lit his signed bark points the way (trigger greg:bark:errand); otherwise a plain hello
  const line = (errand.stage === 'smith' || errand.stage === 'temple') && errand.where ? gregRepeat(errand.where) : GREG_HELLO
  return { line, options: [ground, ...tour, bye] }
}
