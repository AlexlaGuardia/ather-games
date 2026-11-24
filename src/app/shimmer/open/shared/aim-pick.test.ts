// aim-pick.ts (BETA M60). Run: npx tsx src/app/shimmer/open/shared/aim-pick.test.ts
import { aimPick, lookDir, PICK_REACH, type Pickable } from './aim-pick'
import { spiritPickR } from '../ather/spirit-follow'
import { FOLLOW } from '../ather/spirit-trot'
import { bodyRadius } from '../ather/obstacles'
import { GROWN } from '../../sprites/creature-size'
import type { Species } from '../../spirits/spirit'
import { FORM } from './follow-formation'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const EYE_H = 1.6
const eye = (x = 0, z = 0) => ({ x, y: EYE_H, z })
/** a Moglin-sized post `d` m straight ahead (-z) of the eye at the origin */
const mog = (x: number, z: number, item = 'm'): Pickable<string> => ({ x, z, y0: 0, y1: 0.9, r: 0.35, item })
/** look at a point: yaw/pitch from the eye */
const at = (tx: number, ty: number, tz: number, e = eye()) => { const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z; return lookDir(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))) }

// aimed at its middle from 2 m: pick
ok(aimPick([mog(0, -2)], eye(), at(0, 0.45, -2)) === 'm', 'crosshair on it at 2 m: pick')
// standing 2 m away but looking AWAY (behind you) or BESIDE (90° off): none
ok(aimPick([mog(0, -2)], eye(), at(0, 0.45, 2)) === null, 'behind you at 2 m: none')
ok(aimPick([mog(0, -2)], eye(), at(2, 0.45, 0)) === null, 'beside you (90° off) at 2 m: none')
// looking level over its head at 2 m (the crosshair on the far ground behind it): none
ok(aimPick([mog(0, -2)], eye(), lookDir(0, 0)) === null, 'crosshair over its head (level look): none')
// reach: its near side at 2.9 m = pick; at 3.2 m = none (centre = side + r)
ok(aimPick([mog(0, -(2.9 + 0.35))], eye(), at(0, 0.45, -(2.9 + 0.35))) === 'm', 'aimed, near side at 2.9 m: pick')
ok(aimPick([mog(0, -(3.2 + 0.35))], eye(), at(0, 0.45, -(3.2 + 0.35))) === null, 'aimed, near side at 3.2 m: none')
// two candidates, both in reach: the aimed one wins, whichever is nearer
{
  const a = mog(-0.8, -1.6, 'near-left'), b = mog(1.0, -2.6, 'far-right')
  ok(aimPick([a, b], eye(), at(1.0, 0.45, -2.6)) === 'far-right', 'two in reach, aimed at the FARTHER one: it wins (not the nearest)')
  ok(aimPick([a, b], eye(), at(-0.8, 0.45, -1.6)) === 'near-left', 'two in reach, aimed at the nearer one: it wins')
  ok(aimPick([a, b], eye(), at(0.1, 0.45, -2.1)) === null, 'two in reach, crosshair in the gap between them: none')
}
// slack: just off its edge still picks (the ray rarely lands exactly on a 35 cm post); a hand-width further does not
ok(aimPick([mog(0, -2)], eye(), at(0.45, 0.45, -2)) === 'm', 'crosshair 10 cm past its edge at 2 m: pick (slack)')
ok(aimPick([mog(0, -2)], eye(), at(0.9, 0.45, -2)) === null, 'crosshair 55 cm past its edge at 2 m: none')
// a big thing (a table, r 1) is in reach when its SIDE is, and aimed when the crosshair is anywhere on it
{
  const table: Pickable<string> = { x: 0, z: -3.6, y0: 0, y1: 1, r: 1, item: 'table' }
  ok(aimPick([table], eye(), at(0.7, 0.8, -3.6)) === 'table', 'a table 2.6 m off its side, crosshair on its corner: pick')
}
ok(PICK_REACH === 3, 'reach is 3 m (Alex)')
// third person: the camera 4 m behind the keeper, aiming past them at a Moglin 2 m ahead of the KEEPER: reach from the keeper
{
  const cam = { x: 0, y: 2.6, z: 4 }, m = mog(0, -2)
  ok(aimPick([m], cam, at(0, 0.45, -2, cam), { x: 0, z: 0 }) === 'm', 'third person: 6 m from the camera but 2 m from the keeper: pick')
  ok(aimPick([m], cam, at(0, 0.45, -2, cam)) === null, 'the same shot measured from the camera: out of reach')
}
// M126 s4: a follower (`soft`) never takes E from a thing the crosshair is on in front of it, whichever order they are listed
{
  const fol = (x: number, z: number): Pickable<string> => ({ x, z, y0: -0.1, y1: 0.6, r: 0.45, item: 'follower', soft: true }), npc = mog(0, -1.5, 'npc')
  const shot = at(0, 0.3, -2.6), both = [fol(0, -2.6), npc]
  ok(aimPick(both, eye(), shot) === 'npc' && aimPick([...both].reverse(), eye(), shot) === 'npc', 'a follower behind an NPC, crosshair on both: the NPC')
  ok(aimPick([fol(0, -1.5), mog(0, -2.6, 'npc')], eye(), at(0, 0.3, -2.0)) === 'follower', 'a follower in front: the follower')
  ok(aimPick([fol(0, -2.6), mog(0.46, -1.5, 'npc')], eye(), at(0, 0.2, -2.6)) === 'follower', 'the crosshair on her, an NPC only near it: the follower')
  ok(aimPick([fol(0, -2.6)], eye(), at(0, 0.3, -2.6)) === 'follower', 'a follower alone: picked')
}
// M126 s4: from where a stopped keeper stands, every following spirit's slot (fanned arc + the slack she may stand off it) is in E's reach
for (const sp of Object.keys(GROWN) as Species[]) {
  const r = bodyRadius(GROWN[sp]), far = Math.max(FORM.arcR, FORM.keeperR + Math.max(r, 0.45) + 1) * FORM.fan + FOLLOW.slotOff, pr = spiritPickR(sp, GROWN[sp].height)
  ok(far - pr <= PICK_REACH, `${sp}: stood ${far.toFixed(2)} m off, pick radius ${pr.toFixed(2)}: in reach`)
  ok(aimPick([{ x: 0, z: -far, y0: -0.1, y1: GROWN[sp].height + 0.15, r: pr, item: 's' }], eye(), at(0, GROWN[sp].height * 0.5, -far)) === 's', `${sp}: aimed at, E reaches her`)
  ok(pr >= r, `${sp}: the pick covers her body (${pr.toFixed(2)} >= ${r.toFixed(2)})`)
}
// lookDir: yaw 0 / pitch 0 = -z
{ const d = lookDir(0, 0); ok(Math.abs(d.z + 1) < 1e-9 && Math.abs(d.x) < 1e-9, 'lookDir(0,0) = -z') }

console.log(`aim-pick: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
