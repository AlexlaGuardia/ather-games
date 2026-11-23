// M68 s3b: FENNEL IN THE GLADE (plan Beat 1 › the gardens table; CANON/game/shimmer-quest-glade-tutorial.md › fennel, rev1).
// Fennel lives at her lot in Greg's garden (a Glade Moglin, folk talk). Once Greg has sent you (.wilds), her FIRST talk is
// greet .1-.2, then (no rinstick yet) gift .1-.3, which STARTS the signed first-rinstick quest at its step 2 (the Moonwell
// wait; rinquest.ts › startAtGlade), or (a stick already) done .1, which skips it; then gift .4-.5: the day's bait jar.
// Any later talk = the jar: bait.ready hands the day's bait (claimJar, once per in-game day), bait.empty otherwise; either
// way 'Something else.' opens her ordinary Moglin talk (card, wants). Before Greg sends a live keeper: her Moglin talk only.
// Hub GO (#16510): she stays in the Glade unless the quest is open AND a raised Rinnshop stands (moonwell-glade › gladeAway);
// the Rinnshop Fennel keeps the bench / first-catch steps (use-rinquest › fennelTalk).
//
// ★ PURE. Commits happen in a PICK, never on render; the first talk is decided ONCE at open (being heard on the last line
//   must not swap the script under the bubble). Every grant is guarded by the tutorial's gift list, so leaving mid-script
//   and replaying it hands nothing twice. A full bag refuses the jar and records nothing.
// Answer labels FENNEL_THANKS / FENNEL_MORE = SIGNED (athernyx ef704e7 item 3); fennelBye = lark's bye.fennel.
import type { TalkNode } from '../shared/npc-talk'
import { ANSWERS } from './greg-talk'
import { line } from './glade-tutorial-lines'
import { gift, hearFriend, claimJar, jarFull, type Tut } from './glade-tutorial'

export const FENNEL_THANKS = "Thanks. I'll bring something good back."   // SIGNED (Alex, athernyx ef704e7) batch item 3
export const FENNEL_MORE = 'How are you, Fennel?'   // SIGNED (Alex, athernyx ef704e7) batch item 3
export const fennelBye = 'Save me a seat, Fennel.'  // lark bye.fennel, SIGNED by Alex (athernyx 7a25a8e) (the Rinnshop talk uses it too)

export type FennelMode = 'folk' | 'first' | 'jar'
/** `stick` and `full` are read at open, with the mode: what the talk walks never changes under the bubble. */
export interface FennelCursor { mode: FennelMode; stick: boolean; full: boolean; day: number; i: number }

export function fennelStart(t: Tut, stick: boolean, day: number): FennelCursor {
  const mode: FennelMode = t.live && !t.greg.wilds ? 'folk' : t.live && !t.heard.includes('fennel') ? 'first' : 'jar'
  return { mode, stick, full: jarFull(t, day), day, i: 0 }
}
/** The line ids the talk walks ('folk' walks none: the caller opens her Moglin talk). */
export function fennelScript(c: FennelCursor): string[] {
  if (c.mode === 'first') return ['fennel.b1.greet.1', 'fennel.b1.greet.2',
    ...(c.stick ? ['fennel.b1.done.1'] : ['fennel.b1.gift.1', 'fennel.b1.gift.2', 'fennel.b1.gift.3']),
    'fennel.b1.gift.4', 'fennel.b1.gift.5']
  if (c.mode === 'jar') return [c.full ? 'fennel.bait.ready' : 'fennel.bait.empty']
  return []
}
/** The line that settles the quest (gift .3 starts it; done .1 counts it as already done). */
export const questAt = (c: FennelCursor) => fennelScript(c).indexOf(c.stick ? 'fennel.b1.done.1' : 'fennel.b1.gift.3')
/** The line Fennel sets the jar in your hands (gift .4). */
export const baitAt = (c: FennelCursor) => fennelScript(c).indexOf('fennel.b1.gift.4')

export interface FennelActs {
  set: (t: Tut) => void
  /** move to line `i`; null = the talk is over (close it) */
  go: (i: number | null) => void
  /** start the first-rinstick quest at the Moonwell wait (no-op if it already runs past that, or is done) */
  startQuest: () => void
  /** put `n` bait in the bag. false = could not (bag full): stay, record nothing */
  giveBait: (n: number) => boolean
  /** open her ordinary Moglin talk */
  folk: () => void
}

export function fennelNode(t: Tut, c: FennelCursor, act: FennelActs): TalkNode {
  const s = fennelScript(c), k = Math.max(0, Math.min(c.i, s.length - 1))
  if (c.mode === 'jar') {
    if (c.full) return { line: line(s[0]), options: [{ label: FENNEL_THANKS, pick: () => { if (takeJar(t, c, act)) act.go(null) } }, { label: FENNEL_MORE, pick: act.folk }] }
    return { line: line(s[0]), options: [{ label: FENNEL_MORE, pick: act.folk }, { label: fennelBye, pick: () => act.go(null) }] }
  }
  if (k === s.length - 1) return { line: line(s[k]), options: [{ label: fennelBye, pick: () => act.go(null) }] }
  return { line: line(s[k]), options: [{ label: ANSWERS.more, pick: () => advanceFennel(t, { ...c, i: k }, act) }] }
}

/** The day's jar, once per in-game day. */
function takeJar(t: Tut, c: FennelCursor, act: FennelActs): boolean {
  const r = claimJar(t, c.day)
  if (r.bait > 0 && !act.giveBait(r.bait)) return false
  if (r.t !== t) act.set(r.t)
  return true
}

/** "And then?" on line `i`: commit what the NEXT line means, then move to it. */
export function advanceFennel(t: Tut, c: FennelCursor, act: FennelActs): void {
  const s = fennelScript(c), next = c.i + 1
  if (c.mode !== 'first' || next >= s.length) return
  let u = t
  if (next === questAt(c)) { const g = gift(u, 'rinquest'); if (g.fresh) { if (!c.stick) act.startQuest(); u = g.t } }
  if (next === baitAt(c) && !u.gifts.includes('bait')) {
    const r = claimJar(u, c.day)
    if (r.bait > 0 && !act.giveBait(r.bait)) { if (u !== t) act.set(u); return }
    u = gift(r.t, 'bait').t
  }
  if (next === s.length - 1) u = hearFriend(u, 'fennel')
  if (u !== t) act.set(u)
  act.go(next)
}
