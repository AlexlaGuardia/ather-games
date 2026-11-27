// ── NPCS LOOK AT YOU WHEN YOU TALK (BETA M229 s1, Alex 11-27: "our npcs are pretty much statues ... look at the player when
// interacted") ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// ONE place for every NPC kind. A talk's bubble (npc-talk.tsx TalkBubble) already sits over whoever speaks, in every talk the
// game has (Glade folk, Fennel, Greg, the friends, settlement Moglins, shop / Exchange attendants, the continent's door folk), so
// the bubble says WHO: `setTalkAt` holds its x/z while it is up. Each NPC rig (use-npc-face.ts, mounted by MoglinModel,
// MoglinLookModel, FolkModel, GregModel, FriendModel) asks whether it is the figure nearest that point; that one turns to the
// keeper: the HEAD first (fast, within its neck's reach), then the BODY eases round under it (slow), so the head comes back to
// centre as the body arrives. When the bubble goes (or the keeper walks off) both ease back to the figure's rest facing, which
// stays the placing code's own rotation: this only ever adds an offset under it. Pure apart from the small store; npc-face.test.ts.

/** how far the bubble may sit from a figure's feet (x/z) and still be theirs: a bubble rides over the head, a seated Greg's head
 *  is a little forward of his seat */
export const TALK_CLAIM_R = 1.6
/** past this the keeper has walked off: the figure turns back even if the talk is still up */
export const TALK_WALKED_OFF = 7
/** the neck's reach either way (rad) */
export const HEAD_MAX = 1.05
/** seated (Greg on his bench) the body turns this far at most; the head does the rest */
export const SEATED_BODY_MAX = 0.8
/** ease rates (1/s): the head leads, the body follows */
export const HEAD_RATE = 7, BODY_RATE = 2.4
/** the most either part turns in one second (rad/s): ease, never snap, even on a long frame */
export const HEAD_SPEED = 4.5, BODY_SPEED = 2.6

export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export interface FaceState { body: number; head: number }
export const FACE_REST: FaceState = { body: 0, head: 0 }

const ease = (from: number, to: number, rate: number, speed: number, dt: number) => {
  const d = wrapAngle(to - from), step = d * Math.min(1, rate * dt), cap = speed * dt
  return from + Math.max(-cap, Math.min(cap, step))
}

/** One frame. `want` = the turn (rad, from the figure's rest facing) that would face the keeper, or null = back to rest.
 *  body + head together is where the face looks. */
export function faceStep(s: FaceState, want: number | null, dt: number, seated = false): FaceState {
  dt = Math.max(0, Math.min(0.1, dt))
  const bodyMax = seated ? SEATED_BODY_MAX : Math.PI
  const bodyTo = want === null ? 0 : Math.max(-bodyMax, Math.min(bodyMax, wrapAngle(want)))
  const body = wrapAngle(ease(s.body, bodyTo, BODY_RATE, BODY_SPEED, dt))
  // the head aims at what is left over once the body is where it is now (so it leads, then unwinds as the body arrives)
  const headTo = want === null ? 0 : Math.max(-HEAD_MAX, Math.min(HEAD_MAX, wrapAngle(want - body)))
  const head = ease(s.head, headTo, HEAD_RATE, HEAD_SPEED, dt)
  return { body, head }
}
export const atRest = (s: FaceState) => Math.abs(s.body) < 1e-3 && Math.abs(s.head) < 1e-3

// ── who is being talked to: the bubble's point, and the figures that claim it ──
let talk: { x: number; z: number; tok: number } | null = null, tokN = 0
/** a bubble went up over (x, z); returns the token its `clearTalkAt` must pass (a newer bubble is never cleared by an older one) */
export function setTalkAt(x: number, z: number): number { talk = { x, z, tok: ++tokN }; claims.clear(); return talk.tok }
export function clearTalkAt(tok: number) { if (talk?.tok === tok) { talk = null; claims.clear() } }
export const talkAt = () => talk

const claims = new Map<object, number>()
/** A figure at (x, z) asks whether the talk is theirs: true for the one nearest the bubble within TALK_CLAIM_R (ties: the first
 *  to ask). Call every frame while it matters; `release` when the figure goes. */
export function claimTalk(who: object, x: number, z: number): boolean {
  if (!talk) { claims.delete(who); return false }
  const d = Math.hypot(x - talk.x, z - talk.z)
  if (d > TALK_CLAIM_R) { claims.delete(who); return false }
  claims.set(who, d)
  for (const [o, e] of claims) if (o !== who && e < d - 1e-6) return false
  return true
}
export const releaseTalk = (who: object) => { claims.delete(who) }

/** the turn from rest (rad) that faces a figure at `me` (rest yaw `restYaw`, the model faces +z) at the keeper */
export const wantToward = (me: { x: number; z: number }, restYaw: number, keeper: { x: number; z: number }) =>
  wrapAngle(Math.atan2(keeper.x - me.x, keeper.z - me.z) - restYaw)
