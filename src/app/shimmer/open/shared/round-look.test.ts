// npx tsx src/app/shimmer/open/shared/round-look.test.ts
// BETA M177: rounds you see are thin and fast. Per gun: faster flight with the same reach, a thinner needle than the old
// 5 cm box, drawn behind the round (its front = the hit point), grown out of the barrel, never sub-pixel far off.
import { RANGE_GUNS, M177_SPEED } from './gunplay'
import { WEAPONS } from '../../engine/weapons'
import { ROUND_LOOK, ROUND_LOOK_BEFORE, roundLook, streakOf, MUZZLE_CLEAR, MIN_ANGLE } from './round-look'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
// the reach each gun had before M177 (m): what the character panel shows, and what a cast's bolt range reads
const REACH: Record<string, number> = { repeater: 72, spitter: 61.2, backbone: 92, roar: 20.9, lance: 129.6, 'charred-rifle': 154 }
const BEFORE: Record<string, number> = { repeater: 40, spitter: 34, backbone: 46, roar: 38, lance: 54, 'charred-rifle': 70 }
for (const g of RANGE_GUNS) {
  ok(g.id in M177_SPEED && g.id in ROUND_LOOK, `${g.id}: has an M177 speed and look`)
  ok(g.projSpeed === M177_SPEED[g.id] && g.projSpeed >= BEFORE[g.id] * 1.7, `${g.id}: flies ${g.projSpeed} m/s (before ${BEFORE[g.id]})`)
  ok(Math.abs(g.projSpeed * g.projLife - REACH[g.id]) < 1e-6, `${g.id}: reach kept ${(g.projSpeed * g.projLife).toFixed(2)} m (was ${REACH[g.id]})`)
  const L = ROUND_LOOK[g.id]
  ok(L.w <= ROUND_LOOK_BEFORE.w * 0.65 && L.w > 0.005, `${g.id}: the needle is thinner (${L.w} m, before ${ROUND_LOOK_BEFORE.w})`)
}
// identity: Lance the finest, the Charred Rifle the heaviest and longest, Roar's pellets the shortest
const by = (k: 'w' | 'len') => RANGE_GUNS.map(g => g.id).sort((a, b) => ROUND_LOOK[a][k] - ROUND_LOOK[b][k])
ok(by('w')[0] === 'lance' && by('w').at(-1) === 'charred-rifle', `widths ${by('w')}`)
ok(by('len')[0] === 'roar' && by('len').at(-1) === 'charred-rifle', `lengths ${by('len')}`)
// the fastest is still the Charred Rifle, then the Lance (each gun's order kept)
const fast = RANGE_GUNS.map(g => g.id).sort((a, b) => M177_SPEED[b] - M177_SPEED[a])
ok(fast[0] === 'charred-rifle' && fast[1] === 'lance' && fast.at(-1) === 'spitter', `speed order ${fast}`)
// play3d's guns are not touched
ok(WEAPONS.find(w => w.id === 'repeater')!.projSpeed === 40 && WEAPONS.find(w => w.id === 'lance')!.projSpeed === 54, 'engine/weapons.ts unchanged')
// streakOf: nothing at the muzzle, grows to full length, thin up close, about a pixel far off
const R = ROUND_LOOK.repeater
ok(streakOf(R, 0.3, 0.7).len === 0, 'nothing drawn inside the muzzle clearance')
ok(Math.abs(streakOf(R, MUZZLE_CLEAR + 0.4, 1).len - 0.4) < 1e-9, 'grows out of the barrel')
ok(streakOf(R, 30, 30).len === R.len, 'full length in flight')
ok(streakOf(R, 2, 1).w === R.w, 'its own width up close')
ok(Math.abs(streakOf(R, 40, 40).w - 40 * MIN_ANGLE) < 1e-9 && streakOf(R, 40, 40).w > R.w, 'never thinner than ~a pixel far off')
ok(roundLook(undefined) === R && roundLook('nope') === R, 'an unknown gun draws as the Repeater')
console.log(`round-look: ${pass} ok, ${fail} failed`)
if (fail) process.exit(1)
