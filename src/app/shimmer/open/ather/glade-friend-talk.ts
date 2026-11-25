// M68 s3a: THE FRIENDS' TALK (plan Beat 1 › the gardens table). Otto, Tess and Bonn, walked like Greg's tutorial talk
// (glade-greg-talk.ts): once Greg has sent you (.wilds), a friend's FIRST talk is greet, gift and on to their Moglin, handing the
// gift on reaching gift .1 and counting the friend HEARD on reaching the last line. Any other talk = their bark.
// Fennel is s3b (she starts the rinstick quest and keeps the jar: her own script).
// M155 (Alex 11-25, lines SIGNED c9b349a): the guided tour. The friends' scripts are the batch's, and the four Moglins a friend
// sends you to (Hazel, Sax, Yarrow, Mallow) talk here too while their stop is due; any other time their own folk talk.
//
// ★ PURE. Commits happen in a PICK, never on render. Leaving mid-script replays it next time; the caller's gift guard
//   (glade-tutorial.ts › gift) means nothing is handed twice. A full bag refuses the step and records nothing.
// ★ A line is said only where it is true: the node beside a friend only when one is PLACED there (Place mode), a pointer ("Otto has
//   the next garden") only while that stop is still ahead (a keeper may walk up to anyone early).
// Answer labels: ANSWERS.more is greg-talk's (lark placeholder); the goodbyes are lark's SIGNED bye.otto/.tess/.bonn (7a25a8e) and,
// for a Moglin, the folk talk's own (folk-talk.ts ASK.bye).
import type { TalkNode } from '../shared/npc-talk'
import { ANSWERS } from './greg-talk'
import { ASK } from './folk-talk'
import { GLADE_LINES, line } from './glade-tutorial-lines'
import { GIFT_OF, GUIDES, guideDue, hearFriend, meetGuide, stopDone, type Friend, type Gift, type Guide, type Stop, type Tut } from './glade-tutorial'

export type GardenFriend = Exclude<Friend, 'fennel'>
export const GARDEN_FRIENDS: readonly GardenFriend[] = ['otto', 'tess', 'bonn']
export type Talker = GardenFriend | Guide
export const isGuideId = (f: string): f is Guide => (GUIDES as readonly string[]).includes(f)
export const FRIEND_NAME: Readonly<Record<Talker, string>> = { otto: 'Otto', tess: 'Tess', bonn: 'Bonn', hazel: 'Hazel', sax: 'Sax', yarrow: 'Yarrow', mallow: 'Mallow' }
/** lark, SIGNED by Alex, athernyx 7a25a8e (CANON/game/shimmer-lines-idris-and-goodbyes.md bye.otto/.tess/.bonn) */
export const FRIEND_BYE: Readonly<Record<GardenFriend, string>> = { otto: 'Later, Otto.', tess: 'Bye for now, Tess.', bonn: 'See you around, Bonn.' }
export const friendBye = (f: Talker) => (isGuideId(f) ? ASK.bye : FRIEND_BYE[f])
export const guideTalks = guideDue

/** How near a placed tutorial node must stand for its friend to call it "beside" them (m). Dial. */
export const BESIDE = 12
const near = (a: readonly { x: number; z: number }[], at: { x: number; z: number }) => a.some(n => Math.hypot(n.x - at.x, n.z - at.z) < BESIDE)
/** Bonn's tree / Otto's stone: is one placed beside them? */
export const nodeBeside = (f: Talker, at: { x: number; z: number }, n: { trees: readonly { x: number; z: number }[]; crystals: readonly { x: number; z: number }[] }) =>
  f === 'bonn' ? near(n.trees, at) : f === 'otto' ? near(n.crystals, at) : false

/** The whole first talk, in the batch's order. */
const SCRIPT: Readonly<Record<Talker, readonly string[]>> = {
  bonn: ['bonn.b1.greet.1', 'bonn.b1.greet.2', 'bonn.b1.stay.1', 'bonn.b1.gift.1', 'bonn.b1.try.1', 'bonn.b1.gift.2', 'bonn.b1.rooms.1', 'bonn.b1.rooms.2'],
  otto: ['otto.b1.greet.1', 'otto.b1.greet.2', 'otto.b1.gift.1', 'otto.b1.gift.2', 'otto.b1.gift.3', 'otto.b1.gift.4'],
  tess: ['tess.b1.greet.1', 'tess.b1.greet.2', 'tess.b1.gift.1', 'tess.b1.gift.2', 'tess.b1.gift.3', 'tess.b1.gift.4'],
  hazel: ['hazel.b1.greet.1', 'hazel.b1.room.1', 'hazel.b1.point.1'],
  sax: ['sax.b1.greet.1', 'sax.b1.room.1', 'sax.b1.point.1'],
  yarrow: ['yarrow.b1.greet.1', 'yarrow.b1.room.1', 'yarrow.b1.point.1'],
  mallow: ['mallow.b1.greet.1', 'mallow.b1.room.1', 'mallow.b1.point.1'],
}
/** said only with the node placed beside them */
const NODE_LINES: readonly string[] = ['bonn.b1.try.1', 'otto.b1.gift.2']
/** a pointer, and the stop it points at */
const POINTS: Readonly<Record<string, Stop>> = { 'hazel.b1.point.1': 'otto', 'sax.b1.point.1': 'tess', 'yarrow.b1.point.1': 'mallow', 'mallow.b1.point.1': 'fennel' }
/** the signed scene box above a line */
export const SCENE_OF: Readonly<Record<string, string>> = { 'bonn.b1.gift.1': 'bonn.b1.gift.scene', 'bonn.b1.try.1': 'bonn.b1.try.scene', 'otto.b1.gift.1': 'otto.b1.gift.scene', 'otto.b1.gift.2': 'otto.b1.try.scene' }

/** Decided ONCE when the talk opens (hearing them on the last line must not swap the script under the bubble): true = the first talk
 *  after Greg sent you, false = the bark (before Greg sends you, after, legacy). A guide is only opened when due (guideTalks). */
export const firstTalk = (t: Tut, f: Talker) => (isGuideId(f) ? guideDue(t, f) : t.live && t.greg.wilds && !t.heard.includes(f))
export interface FriendCursor { f: Talker; first: boolean; i: number; script: readonly string[] }
export function friendStart(t: Tut, f: Talker, beside = false): FriendCursor {
  const first = firstTalk(t, f)
  const script = first ? SCRIPT[f].filter(l => (beside || !NODE_LINES.includes(l)) && !(POINTS[l] && stopDone(t, POINTS[l])))
    : isGuideId(f) ? SCRIPT[f].slice(1, 2) : [`${f}.b1.bark`]
  return { f, first, i: 0, script }
}
/** The line ids the talk walks. */
export const friendScript = (c: FriendCursor): readonly string[] => c.script
/** The script's line that hands the gift over (gift .1); -1 = none (a guide gives nothing). */
export const giftAt = (c: FriendCursor) => (c.first ? c.script.indexOf(`${c.f}.b1.gift.1`) : -1)

export interface FriendActs {
  set: (t: Tut) => void
  /** move to line `i`; null = the talk is over (close it) */
  go: (i: number | null) => void
  /** the gift line reached: hand `g` (the caller owns the once-guard). false = could not (bag full): stay. */
  give: (g: Gift) => boolean
}

export function friendNode(t: Tut, c: FriendCursor, act: FriendActs): TalkNode {
  const s = c.script, k = Math.max(0, Math.min(c.i, s.length - 1)), scene = SCENE_OF[s[k]]
  const said = { line: line(s[k]), ...(c.first && scene && GLADE_LINES[scene] ? { scene: line(scene) } : {}) }
  if (k === s.length - 1) return { ...said, options: [{ label: friendBye(c.f), pick: () => act.go(null) }] }
  return { ...said, options: [{ label: ANSWERS.more, pick: () => advanceFriend(t, { ...c, i: k }, act) }] }
}

/** "And then?" on line `i`: commit what the NEXT line means, then move to it. */
export function advanceFriend(t: Tut, c: FriendCursor, act: FriendActs): void {
  const s = c.script, next = c.i + 1
  if (next >= s.length) return
  if (next === giftAt(c) && !act.give(GIFT_OF[c.f as GardenFriend])) return
  if (c.first && next === s.length - 1) { const h = isGuideId(c.f) ? meetGuide(t, c.f) : hearFriend(t, c.f); if (h !== t) act.set(h) }
  act.go(next)
}
