// M229 s1: an NPC turns to the keeper in a talk (head first, body after), and back. Run: npx tsx src/app/shimmer/open/shared/npc-face.test.ts
import { readFileSync } from 'node:fs'
import { faceStep, FACE_REST, HEAD_MAX, SEATED_BODY_MAX, HEAD_SPEED, BODY_SPEED, TALK_CLAIM_R, wrapAngle, atRest, setTalkAt, clearTalkAt,
  claimTalk, releaseTalk, talkAt, wantToward, type FaceState } from './npc-face'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const deg = (r: number) => r * 180 / Math.PI
const run = (s: FaceState, want: number | null, secs: number, seated = false, dt = 1 / 60) => {
  let maxStep = 0
  for (let t = 0; t < secs; t += dt) { const n = faceStep(s, want, dt, seated); maxStep = Math.max(maxStep, Math.abs(wrapAngle(n.body - s.body)) + Math.abs(n.head - s.head)); s = n }
  return { s, maxStep }
}

// 1. a keeper off to the side (100 deg): the head gets there first, the body follows, the face ends on the keeper
{
  const want = 100 * Math.PI / 180
  const early = run(FACE_REST, want, 0.25).s
  ok(Math.abs(early.head) > Math.abs(early.body), `head leads at 0.25 s (head ${deg(early.head).toFixed(0)} body ${deg(early.body).toFixed(0)})`)
  ok(Math.abs(early.head) <= HEAD_MAX + 1e-9, 'the head never turns past its neck')
  const done = run(FACE_REST, want, 3)
  ok(Math.abs(deg(wrapAngle(done.s.body + done.s.head - want))) < 5, `faces the keeper after 3 s (off ${deg(wrapAngle(done.s.body + done.s.head - want)).toFixed(1)} deg)`)
  ok(Math.abs(done.s.head) < 0.1, `the head unwinds as the body arrives (head ${deg(done.s.head).toFixed(1)} deg)`)
  ok(done.maxStep <= (HEAD_SPEED + BODY_SPEED) / 60 + 1e-9, 'no snap: never more than the turn speeds allow in a frame')
  // within the done-check's ~15 deg by 1.5 s
  const mid = run(FACE_REST, want, 1.5).s
  ok(Math.abs(deg(wrapAngle(mid.body + mid.head - want))) < 15, `within 15 deg by 1.5 s (${deg(wrapAngle(mid.body + mid.head - want)).toFixed(1)})`)
  // 2. the talk ends: back to rest, smoothly
  const back = run(done.s, null, 4)
  ok(atRest(back.s) || (Math.abs(back.s.body) < 0.01 && Math.abs(back.s.head) < 0.01), `back to rest facing (body ${deg(back.s.body).toFixed(2)} head ${deg(back.s.head).toFixed(2)})`)
  ok(back.maxStep <= (HEAD_SPEED + BODY_SPEED) / 60 + 1e-9, 'no snap on the way back')
  // a long frame (a hitch) is still an ease, not a jump
  const hitch = faceStep(FACE_REST, want, 0.5)
  ok(Math.abs(hitch.body) <= BODY_SPEED * 0.1 + 1e-9 && Math.abs(hitch.head) <= HEAD_SPEED * 0.1 + 1e-9, 'a long frame is clamped')
}
// 3. behind (179 deg) turns the short way; across the seam (-170 to +170) too
{
  const a = run(FACE_REST, 179 * Math.PI / 180, 4).s
  ok(Math.abs(deg(wrapAngle(a.body + a.head - 179 * Math.PI / 180))) < 5, 'a keeper right behind: faced')
  const s0: FaceState = { body: -170 * Math.PI / 180, head: 0 }
  const b = run(s0, 170 * Math.PI / 180, 0.2).s
  ok(b.body < -170 * Math.PI / 180 || b.body > 0, `across the seam it turns the short way (${deg(b.body).toFixed(0)})`)
}
// 4. seated (Greg on his bench): the body turns a little, the head the rest
{
  const want = 100 * Math.PI / 180, s = run(FACE_REST, want, 4, true).s
  ok(Math.abs(s.body) <= SEATED_BODY_MAX + 1e-9, `seated body stays within ${deg(SEATED_BODY_MAX).toFixed(0)} deg`)
  ok(Math.abs(deg(wrapAngle(s.body + s.head - want))) < 15, `seated, the face still finds the keeper (off ${deg(wrapAngle(s.body + s.head - want)).toFixed(1)})`)
}
// 5. who: the figure nearest the bubble, within reach; a newer bubble is not cleared by an older one
{
  const A = {}, B = {}, C = {}
  ok(!claimTalk(A, 0, 0), 'no bubble: nobody')
  const t1 = setTalkAt(10, 10)
  ok(claimTalk(A, 10.2, 10) === true, 'the figure under the bubble claims it')
  ok(claimTalk(B, 11.2, 10) === false, 'a neighbour further away does not')
  ok(claimTalk(A, 10.2, 10) === true, 'and the nearer one keeps it')
  ok(claimTalk(C, 10 + TALK_CLAIM_R + 0.1, 10) === false, 'out of reach: no')
  releaseTalk(A)
  ok(claimTalk(B, 11.2, 10) === true, 'the nearer one gone: the next nearest takes it')
  const t2 = setTalkAt(50, 50)
  clearTalkAt(t1)
  ok(talkAt()?.x === 50, 'an older bubble closing leaves the newer talk up')
  clearTalkAt(t2)
  ok(talkAt() === null && !claimTalk(B, 50, 50), 'the last bubble closing ends the talk')
}
// 6. wantToward: rest facing +z, keeper at +x = a quarter turn left (+); a figure already facing the keeper wants 0
ok(Math.abs(wantToward({ x: 0, z: 0 }, 0, { x: 3, z: 0 }) - Math.PI / 2) < 1e-9, 'keeper at +x from a +z figure: +90 deg')
ok(Math.abs(wantToward({ x: 0, z: 0 }, Math.PI / 2, { x: 3, z: 0 })) < 1e-9, 'already facing: 0')
// 7. wiring: every NPC rig mounts the one hook, and the bubble publishes the talk (no per-NPC hacks)
{
  const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8')
  for (const f of ['./moglin-model.tsx', './moglin-look-model.tsx', './folk-model.tsx', './greg-model.tsx', './friend-model.tsx'])
    ok(/useNpcFace\(/.test(src(f)) && /ref=\{face\.turn\}/.test(src(f)) && /face\.head\(/.test(src(f)), `${f} mounts useNpcFace (turn + head)`)
  ok(/setTalkAt\(/.test(src('./npc-talk.tsx')) && /clearTalkAt\(/.test(src('./npc-talk.tsx')), 'TalkBubble sets and clears the talk point')
}

console.log(`npc-face: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
