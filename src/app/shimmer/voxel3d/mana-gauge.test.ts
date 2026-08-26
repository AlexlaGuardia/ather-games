// Mana-gauge audit. Run: npx tsx src/app/shimmer/voxel3d/mana-gauge.test.ts
//
// ★ WHY A TEST FOR SOMETHING NOT YET WIRED. The gauge is built and the mount lives in
// `VoxelWorld.tsx`, which the hub lane owns — so it will sit unmounted for a while, and an
// unmounted component is precisely the thing that rots before anyone looks at it. The level maths
// is pure and testable now; the wiring is not this file's business.

import { manaFraction, levelOffset } from './mana-gauge'

const fails: string[] = []
let pass = 0
const ok = (cond: boolean, msg: string) => { cond ? pass++ : fails.push(msg) }

// ── ① THE ZERO POOL, WHICH IS A REAL STATE AND NOT A DEFENSIVE FLOURISH ───────────────────────
// `VoxelWorld` mounts the pool as { cur: 0, max: 0 } and fills `max` in a later effect. 0/0 is NaN,
// NaN does not throw, and `translateY(NaNpx)` is silently DISCARDED by the browser — a vessel stuck
// looking full, with nothing anywhere reporting it.
ok(manaFraction(0, 0) === 0, `an unfilled pool gave ${manaFraction(0, 0)}, want 0 — NaN here renders as a frozen full vessel`)
ok(Number.isFinite(levelOffset(manaFraction(0, 0))), 'the offset for an unfilled pool is not finite')
ok(manaFraction(40, 0) === 0, 'a pool with mana but no max must still be 0, not Infinity')

// ── ② THE LEVEL TRAVELS THE RIGHT WAY, and empty is not the same pixel as full ─────────────────
// ⚠ Asserted as a RELATION rather than against pixel numbers. A test restating 64 would be a mirror
// of the constant and would agree with itself if the vessel were ever resized.
const full = levelOffset(1), empty = levelOffset(0), half = levelOffset(0.5)
ok(full === 0, `a brimming vessel offset ${full}, want 0`)
ok(empty > full, 'empty must sit lower than full — the liquid slides DOWN as it drains')
ok(half > full && half < empty, `half (${half}) must lie between full (${full}) and empty (${empty})`)
ok(Math.abs((empty - half) - (half - full)) < 1e-9, 'the level must be linear in the fill, or the vessel lies about how much is left')

// ── ③ OUT OF RANGE CLAMPS INSTEAD OF OVERFLOWING THE VESSEL ───────────────────────────────────
// Regen can overshoot `max` for a frame before it is capped, and a fraction above 1 would lift the
// liquid body clean out of its clip and paint the whole HUD corner violet.
ok(manaFraction(150, 100) === 1, 'an overfull pool must clamp to 1')
ok(manaFraction(-5, 100) === 0, 'a negative pool must clamp to 0')

console.log(`\nmana-gauge audit: ${pass} checks passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the level is linear, clamped, and safe on the zero pool that exists at mount')
