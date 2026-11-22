// M68 s3a: THE FRIENDS' TALK (plan Beat 1 › the gardens table). Otto, Tess and Bonn, walked like Greg's tutorial talk
// (glade-greg-talk.ts): once Greg has sent you (.wilds), a friend's FIRST talk is greet .1-.2 then gift .1-.3, handing the
// gift on reaching gift .1 and counting the friend HEARD on reaching the last line. Any other talk = their bark.
// Fennel is s3b (she starts the rinstick quest and keeps the jar: her own script).
//
// ★ PURE. Commits happen in a PICK, never on render. Leaving mid-script replays it next time; the caller's gift guard
//   (glade-tutorial.ts › gift) means nothing is handed twice. A full bag refuses the step and records nothing.
// Answer labels: ANSWERS.more is greg-talk's (lark placeholder); the goodbye is a placeholder in the Fennel pattern (use-rinquest).
import type { TalkNode } from '../shared/npc-talk'
import { ANSWERS } from './greg-talk'
import { line } from './glade-tutorial-lines'
import { GIFT_OF, hearFriend, type Friend, type Gift, type Tut } from './glade-tutorial'

export type GardenFriend = Exclude<Friend, 'fennel'>
export const GARDEN_FRIENDS: readonly GardenFriend[] = ['otto', 'tess', 'bonn']
export const FRIEND_NAME: Readonly<Record<GardenFriend, string>> = { otto: 'Otto', tess: 'Tess', bonn: 'Bonn' }
/** The script's line that hands the gift over (gift .1), 0-based. */
export const GIFT_AT = 2
export const friendBye = (f: GardenFriend) => `Goodbye, ${FRIEND_NAME[f]}.`   // placeholder for @lark

/** Decided ONCE when the talk opens (hearing the friend on the last line must not swap the script under the bubble):
 *  true = greet + gift (the first talk after Greg sent you), false = the bark (before Greg sends you, after, legacy). */
export const firstTalk = (t: Tut, f: GardenFriend) => t.live && t.greg.wilds && !t.heard.includes(f)
export interface FriendCursor { f: GardenFriend; first: boolean; i: number }
export const friendStart = (t: Tut, f: GardenFriend): FriendCursor => ({ f, first: firstTalk(t, f), i: 0 })
/** The line ids the talk walks. */
export const friendScript = (c: FriendCursor): string[] => c.first
  ? [`${c.f}.b1.greet.1`, `${c.f}.b1.greet.2`, `${c.f}.b1.gift.1`, `${c.f}.b1.gift.2`, `${c.f}.b1.gift.3`]
  : [`${c.f}.b1.bark`]

export interface FriendActs {
  set: (t: Tut) => void
  /** move to line `i`; null = the talk is over (close it) */
  go: (i: number | null) => void
  /** the gift line reached: hand `g` (the caller owns the once-guard). false = could not (bag full): stay. */
  give: (g: Gift) => boolean
}

export function friendNode(t: Tut, c: FriendCursor, act: FriendActs): TalkNode {
  const s = friendScript(c), k = Math.max(0, Math.min(c.i, s.length - 1))
  if (k === s.length - 1) return { line: line(s[k]), options: [{ label: friendBye(c.f), pick: () => act.go(null) }] }
  return { line: line(s[k]), options: [{ label: ANSWERS.more, pick: () => advanceFriend(t, { ...c, i: k }, act) }] }
}

/** "And then?" on line `i`: commit what the NEXT line means, then move to it. */
export function advanceFriend(t: Tut, c: FriendCursor, act: FriendActs): void {
  const s = friendScript(c), next = c.i + 1
  if (next >= s.length) return
  if (c.first && next === GIFT_AT && !act.give(GIFT_OF[c.f])) return
  if (c.first && next === s.length - 1) { const h = hearFriend(t, c.f); if (h !== t) act.set(h) }
  act.go(next)
}
