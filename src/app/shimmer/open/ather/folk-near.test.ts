// folk-near.ts (hub #15623). Run: npx tsx src/app/shimmer/open/ather/folk-near.test.ts
import { facingWithin, folkInReach, FOLK_REACH, FOLK_TOUCH } from './folk-near'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
// yaw 0 looks down -z (the walker's forward = (-sin yaw, -cos yaw)); yaw PI/2 looks down -x
const M = { x: 0, z: 0 }

ok(facingWithin(M, 0, 2, 0), 'in reach, looking straight at it: prompt')
ok(!facingWithin(M, 0, 2, Math.PI), 'in reach, back turned: no prompt')
ok(!facingWithin(M, 0, FOLK_REACH + 0.2, 0), 'just past reach, facing: no prompt')
ok(facingWithin(M, 0, FOLK_REACH - 0.05, 0), 'just inside reach, facing: prompt')
ok(facingWithin(M, 2, 0, Math.PI / 2), 'yaw PI/2 faces -x: a figure at -x of the keeper is faced')
ok(!facingWithin(M, -2, 0, Math.PI / 2), 'yaw PI/2, figure behind (+x of... the keeper looks away): no prompt')
ok(facingWithin(M, 0, 2, Math.PI / 4), '45° off: still roughly facing')
ok(!facingWithin(M, 0, 2, Math.PI / 2.2), '~82° off: not facing')
ok(facingWithin(M, 0, FOLK_TOUCH - 0.1, Math.PI), 'standing on top of it, any facing: prompt')

// the settlement rule: figures win over the anchor; the anchor only when nobody is home
const anchor = { x: 40, z: 0 }, figs = [{ x: 0, z: 0 }, { x: 10, z: 0 }]
ok(!folkInReach(figs, anchor, 25, 0, 0), 'in the settlement but far from every figure (the old bug: settlementAt said yes): no prompt')
ok(folkInReach(figs, anchor, 10, 2, 0), 'at the second figure, facing it: prompt')
ok(!folkInReach(figs, anchor, 40, 2, 0), 'at the anchor while figures are home: no prompt (talk to a Moglin, not the air)')
ok(folkInReach([], anchor, 40, 2, 0) && folkInReach(undefined, anchor, 40, 2, 0), 'nobody home / not drawn yet: the anchor talks')
ok(!folkInReach([], anchor, 30, 0, 0), 'nobody home, far from the anchor: no prompt')

console.log(`folk-near: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
