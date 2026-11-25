// M68 s2: GREG'S TUTORIAL TALK (plan Beat 1). The signed lines (glade-tutorial-lines.ts, by id) walked one bubble at a time,
// in FRONT of his ordinary talk (greg-talk.ts): welcome -> "Moglins?" / "Spirits?" -> both heard -> "The Wilds?". Once the
// Wilds are heard he is back to his usual talk, with the pending bark as its hello until the tour is walked (M155; Beat 2 = s4).
//
// ★ PURE. Every commit happens in a PICK, never on render: reaching a branch's LAST line marks it heard (leave there and it
//   still counts); Spirits? hands the grimoire on reaching `.3` (the caller gives it once, glade-tutorial.ts › gift).
//   A keeper who leaves mid-branch replays it from the top next time; the gift guard means nothing is handed twice.
// The keeper's "And then?" / goodbye are greg-talk.ts's ANSWERS (lark placeholders, already awaiting sign-off): no new lines here.
import type { TalkNode } from '../shared/npc-talk'
import { ANSWERS } from './greg-talk'
import { line } from './glade-tutorial-lines'
import { answerGate, firstStepsOn, gregScreen, heardWelcome, heardMoglins, heardSpirits, heardWilds, type Tut } from './glade-tutorial'

/** M146: Beat 2 (greg.b2): the gate favour, its two answers */
export type TutBranch = 'welcome' | 'moglins' | 'spirits' | 'wilds' | 'hub' | 'ask' | 'go' | 'wait'
type Beat1 = 'welcome' | 'moglins' | 'spirits' | 'wilds'
export const ASK_LINES = 6
export interface TutCursor { b: TutBranch; i: number }
/** How many signed lines each branch has (greg.b1.<branch>.1..N). */
export const BRANCH_LINES: Readonly<Record<Beat1, number>> = { welcome: 4, moglins: 3, spirits: 6, wilds: 4 }
/** The Spirits? line that hands the grimoire over ("This is a grimoire."), 0-based. */
export const GRIMOIRE_AT = 2
/** M155: the Wilds? line whose scene lights Bonn's marker, 0-based: reaching it sends the keeper (Greg's bark covers the last line) */
export const SENT_AT = 2
const CHOICE: Readonly<Record<'a' | 'b' | 'c', 'moglins' | 'spirits' | 'wilds'>> = { a: 'moglins', b: 'spirits', c: 'wilds' }

/** Where E at Greg starts, or null = his tutorial is done (or a legacy keeper): use his ordinary talk. */
export function tutStart(t: Tut): TutCursor | null {
  if (!t.live) return null
  const s = gregScreen(t)
  // M146: the gate favour, once the tour is walked (never to a keeper past First Steps, nor one already at the settlement's work)
  if (s.kind === 'ask') return firstStepsOn(t) && t.m70 === 'none' ? { b: 'ask', i: 0 } : null
  return s.kind === 'welcome' ? { b: 'welcome', i: 0 } : s.kind === 'hub' ? { b: 'hub', i: 0 } : null
}

/** M146: his hello while First Steps is on: the pending bark until the tour is walked, then the gate bark. undefined = his own. */
export function firstStepsHello(t: Tut): string | undefined {
  if (!t.live) return undefined
  if (t.greg.wilds && gregScreen(t).kind === 'pending') return line('greg.b1.bark.pending')
  return firstStepsOn(t) && (t.b2 === 'accepted' || t.m70 !== 'none') ? line('greg.b2.bark.open') : undefined
}

export interface TutActs {
  /** the new tutorial state (save it) */
  set: (t: Tut) => void
  /** move the talk to `c`; null = the tutorial talk is over this time (close it) */
  go: (c: TutCursor | null) => void
  /** Spirits? reached `.3`: hand the grimoire (once; the caller owns the guard). Returns false if it could not (bag full). */
  grimoire: () => boolean
}

const id = (b: Beat1, i: number) => `greg.b1.${b}.${i + 1}`

/** The hub's choices as talk options (and goodbye, so a keeper is never trapped in it). */
function hubOptions(t: Tut, act: TutActs) {
  const s = gregScreen(t)
  const ch = s.kind === 'hub' ? s.choices : []
  return [
    ...ch.map(c => ({ label: line(`greg.b1.choice.${c}`), pick: () => act.go({ b: CHOICE[c], i: 0 }) })),
    { label: ANSWERS.bye, pick: () => act.go(null) },
  ]
}

/** The node at cursor `c`. */
export function tutNode(t: Tut, c: TutCursor, act: TutActs): TalkNode {
  if (c.b === 'hub') return { line: line('greg.b1.hub.back'), options: hubOptions(t, act) }
  if (c.b === 'go' || c.b === 'wait') return { line: line(`greg.b2.${c.b}`), options: [{ label: ANSWERS.bye, pick: () => act.go(null) }] }
  if (c.b === 'ask') {
    const k = Math.max(0, Math.min(c.i, ASK_LINES - 1))
    const answer = (go: boolean) => ({ label: line(go ? 'greg.b2.choice.go' : 'greg.b2.choice.wait'), pick: () => { act.set(answerGate(t, go)); act.go({ b: go ? 'go' : 'wait', i: 0 }) } })
    return { line: line(`greg.b2.ask.${k + 1}`), options: k === ASK_LINES - 1 ? [answer(true), answer(false)] : [{ label: ANSWERS.more, pick: () => act.go({ b: 'ask', i: k + 1 }) }] }
  }
  const n = BRANCH_LINES[c.b], i = Math.max(0, Math.min(c.i, n - 1)), last = i === n - 1
  if (c.b === 'welcome' && last) return { line: line(id('welcome', i)), options: hubOptions(t, act) }   // .4 offers Moglins? / Spirits?
  if (last) {
    // the branch is over: back to the hub, or (after the Wilds) goodbye: he has sent you to Bonn (M155)
    const opts = c.b === 'wilds'
      ? [{ label: ANSWERS.bye, pick: () => act.go(null) }]
      : [{ label: ANSWERS.more, pick: () => act.go({ b: 'hub', i: 0 }) }]
    return { line: line(id(c.b, i)), options: opts }
  }
  return { line: line(id(c.b, i)), scene: c.b === 'wilds' && i === SENT_AT ? line('greg.b1.wilds.scene') : undefined, options: [{ label: ANSWERS.more, pick: () => advance(t, { b: c.b, i }, act) }] }
}

/** "And then?" on line `c.i`: commit whatever the NEXT line means, then move to it. */
export function advance(t: Tut, c: TutCursor, act: TutActs): void {
  if (c.b === 'hub' || c.b === 'ask' || c.b === 'go' || c.b === 'wait') return
  const n = BRANCH_LINES[c.b], next = c.i + 1
  if (next >= n) return
  if (c.b === 'spirits' && next === GRIMOIRE_AT && !act.grimoire()) return   // bag full: stay on the line before (the caller says why)
  if (next === (c.b === 'wilds' ? SENT_AT : n - 1)) {
    const done = c.b === 'welcome' ? heardWelcome(t) : c.b === 'moglins' ? heardMoglins(t) : c.b === 'spirits' ? heardSpirits(t) : heardWilds(t)
    if (done !== t) act.set(done)
  }
  act.go({ b: c.b, i: next })
}

/** The grimoire gift, decided: `give` = put a Grimoire Pedestal in the bag. A keeper who already owns one (crafted from the
 *  old carpentry recipe, live from 782f98a1 until M68 s2) keeps THAT one as the pedestal and gets no second. */
export function grimoireGift(alreadyGiven: boolean, ownsPedestal: boolean): { record: boolean; give: boolean } {
  if (alreadyGiven) return { record: false, give: false }
  return { record: true, give: !ownsPedestal }
}

/** M123 s1: Greg hands the grimoire (its pedestal) to a keeper who has none, outside Beat 1. Canon (CANON_GAPS 2026-11-22 Q1,
 *  RULED): the TABLET is the grimoire, Greg hands it over; the PEDESTAL is where it rests in the garden. A legacy keeper (no
 *  live tutorial: every gift already marked given) never heard Beat 1, so never got one: his ordinary talk offers it until
 *  the keeper owns one (bag, placed, or banked). A live keeper who has not reached Spirits? yet gets it in Beat 1 instead. */
export function pedestalOwed(t: Tut | null, owns: boolean): boolean {
  if (owns) return false
  return !(t && t.live && !t.greg.spirits)
}
