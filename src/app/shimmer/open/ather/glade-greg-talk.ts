// M68 s2: GREG'S TUTORIAL TALK (plan Beat 1). The signed lines (glade-tutorial-lines.ts, by id) walked one bubble at a time,
// in FRONT of his ordinary talk (greg-talk.ts): welcome -> "Moglins?" / "Spirits?" -> both heard -> "The Wilds?". Once the
// Wilds are heard he is back to his usual talk, with the pending bark as its hello until the four are heard (Beat 2 = s4).
//
// ★ PURE. Every commit happens in a PICK, never on render: reaching a branch's LAST line marks it heard (leave there and it
//   still counts); Spirits? hands the grimoire on reaching `.3` (the caller gives it once, glade-tutorial.ts › gift).
//   A keeper who leaves mid-branch replays it from the top next time; the gift guard means nothing is handed twice.
// The keeper's "And then?" / goodbye are greg-talk.ts's ANSWERS (lark placeholders, already awaiting sign-off): no new lines here.
import type { TalkNode } from '../shared/npc-talk'
import { ANSWERS } from './greg-talk'
import { line } from './glade-tutorial-lines'
import { gregScreen, heardWelcome, heardMoglins, heardSpirits, heardWilds, type Tut } from './glade-tutorial'

export type TutBranch = 'welcome' | 'moglins' | 'spirits' | 'wilds' | 'hub'
export interface TutCursor { b: TutBranch; i: number }
/** How many signed lines each branch has (greg.b1.<branch>.1..N). */
export const BRANCH_LINES: Readonly<Record<Exclude<TutBranch, 'hub'>, number>> = { welcome: 4, moglins: 3, spirits: 6, wilds: 5 }
/** The Spirits? line that hands the grimoire over ("This is a grimoire."), 0-based. */
export const GRIMOIRE_AT = 2
const CHOICE: Readonly<Record<'a' | 'b' | 'c', 'moglins' | 'spirits' | 'wilds'>> = { a: 'moglins', b: 'spirits', c: 'wilds' }

/** Where E at Greg starts, or null = his tutorial is done (or a legacy keeper): use his ordinary talk. */
export function tutStart(t: Tut): TutCursor | null {
  if (!t.live) return null
  const s = gregScreen(t)
  return s.kind === 'welcome' ? { b: 'welcome', i: 0 } : s.kind === 'hub' ? { b: 'hub', i: 0 } : null
}

export interface TutActs {
  /** the new tutorial state (save it) */
  set: (t: Tut) => void
  /** move the talk to `c`; null = the tutorial talk is over this time (close it) */
  go: (c: TutCursor | null) => void
  /** Spirits? reached `.3`: hand the grimoire (once; the caller owns the guard). Returns false if it could not (bag full). */
  grimoire: () => boolean
}

const id = (b: Exclude<TutBranch, 'hub'>, i: number) => `greg.b1.${b}.${i + 1}`

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
  const n = BRANCH_LINES[c.b], i = Math.max(0, Math.min(c.i, n - 1)), last = i === n - 1
  if (c.b === 'welcome' && last) return { line: line(id('welcome', i)), options: hubOptions(t, act) }   // .4 offers Moglins? / Spirits?
  if (last) {
    // the branch is over: back to the hub, or (after the Wilds) goodbye: he has sent you to the four
    const opts = c.b === 'wilds'
      ? [{ label: ANSWERS.bye, pick: () => act.go(null) }]
      : [{ label: ANSWERS.more, pick: () => act.go({ b: 'hub', i: 0 }) }]
    return { line: line(id(c.b, i)), options: opts }
  }
  return { line: line(id(c.b, i)), options: [{ label: ANSWERS.more, pick: () => advance(t, { b: c.b, i }, act) }] }
}

/** "And then?" on line `c.i`: commit whatever the NEXT line means, then move to it. */
export function advance(t: Tut, c: TutCursor, act: TutActs): void {
  if (c.b === 'hub') return
  const n = BRANCH_LINES[c.b], next = c.i + 1
  if (next >= n) return
  if (c.b === 'spirits' && next === GRIMOIRE_AT && !act.grimoire()) return   // bag full: stay on the line before (the caller says why)
  if (next === n - 1) {
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
