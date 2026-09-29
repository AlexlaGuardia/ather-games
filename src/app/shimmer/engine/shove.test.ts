/**
 * SYSTEM 9 — a cast that moves a foe (move-jobs pass 2, 2026-09-29).
 * Run: `npx tsx src/app/shimmer/engine/shove.test.ts`
 */
import { addShove, stepShoves, shoveVector, SHOVE_SECS, type Shove } from './shove'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e

// A. directions
const aw = shoveVector('away', 3, 0, 0, 0, 1, 0)
ok(near(aw.x, 1) && near(aw.z, 0), 'away: from the source through the foe')
const to = shoveVector('toward', 3, 4, 0, 0, 1, 0)
ok(near(to.x, -0.6) && near(to.z, -0.8), 'toward: from the foe back to the source')
const asL = shoveVector('aside', 5, 1, 0, 0, 1, 0), asR = shoveVector('aside', 5, -1, 0, 0, 1, 0)
ok(near(Math.abs(asL.z), 1) && near(asL.x, 0) && Math.sign(asL.z) !== Math.sign(asR.z), '★ aside: off the lane, to the side the foe already stands on')
ok(Math.sign(asL.z) === 1, 'a foe left of the lane is thrown further left, never across it')
const out = shoveVector('out', 0, 0, 0, 0, 0, 1)
ok(near(Math.hypot(out.x, out.z), 1), 'a foe on the exact centre still gets a unit vector (the axis)')

// B. a shove slides the whole distance over SHOVE_SECS, then ends
const pos = { x: 0, z: 0 }
let list: Shove[] = addShove([], 'f', 1, 0, 4)
for (let i = 0; i < 60; i++) list = stepShoves(list, 1 / 60, (_id, dx, dz) => { pos.x += dx; pos.z += dz; return true })
ok(near(pos.x, 4, 1e-6) && list.length === 0, `the foe travels exactly the shove distance, then stops (${pos.x.toFixed(3)})`)
ok(SHOVE_SECS > 0.15 && SHOVE_SECS < 0.5, 'a shove is a visible slide, not a teleport and not a float')

// C. a wall ends it where it stopped
let moved = 0
list = addShove([], 'f', 1, 0, 4)
for (let i = 0; i < 60; i++) list = stepShoves(list, 1 / 60, (_id, dx) => { if (moved + dx > 1) return false; moved += dx; return true })
ok(moved <= 1 && list.length === 0, 'a wall stops the slide and the shove is gone')

// D. one per target: a new shove replaces, never adds
list = addShove(addShove([], 'f', 1, 0, 4), 'f', 0, 1, 2)
ok(list.length === 1 && list[0].vx === 0 && list[0].vz > 0, '★ two gusts on one foe never add into a launch')
ok(stepShoves([], 0.016, () => true).length === 0, 'nothing to do returns empty')
const same: Shove[] = []
ok(stepShoves(same, 0.016, () => true) === same, 'an empty list is returned as-is (no churn at 60fps)')

console.log(`shove: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
