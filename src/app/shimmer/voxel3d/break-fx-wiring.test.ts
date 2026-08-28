// Block-break chips — the WIRING. Run: npx tsx src/app/shimmer/voxel3d/break-fx-wiring.test.ts
//
// ── ★★★ WHY THIS FILE EXISTS AND THE 55 ASSERTS NEXT DOOR COULD NOT COVER IT ──────────────────
// `break-fx.test.ts` (26) and `break-fx-spec.test.ts` (29) prove the pass and the recipes. Both
// call the module DIRECTLY. The game reaches it through `VoxelWorld.tsx`, and every way this
// feature can be dead in the shipped world lives in that gap:
//
//   · `swingChips` returns a rate times `dt` — under one per frame for every recipe in the file.
//     A caller that rounds instead of carrying emits ZERO chips forever while the burst still
//     works. Green suites, working burst, missing swing: it reads as a tuning choice.
//   · The face normal comes from the raycast. A caller that hands `0,0,0` gets chips born at the
//     cell centre, which is the difference the module's own header calls out between "the block is
//     being hit" and "something happened near the block".
//   · A burst fired AFTER `setVoxel(…, AIR)` asks an air cell what it was and gets no bucket. The
//     effect vanishes and nothing throws.
//   · Felling reads one material for a whole tree, and the canopy comes down painted in bark.
//
// This is the `court-wiring.test.ts` shape and the 2026-08-22 bridge lesson: a module and its
// consumer separated by a gap, both halves internally consistent about different things.
//
// ⚠⚠ AND A TEXTUAL READER IS A STANDING CLAIM ABOUT A FILE IT DOES NOT OWN. Every anchor goes
// through `once()`, which FAILS on a missing or ambiguous needle rather than reporting a clean run
// over a file it could no longer find. *"I found no drift"* and *"I could not look"* must not
// share an exit code.

import { readFileSync } from 'node:fs'
import { codeOnly, blockAt } from '../testing/guard'
import { bucketOf, swingChips, ALL_BUCKETS } from './break-fx-spec'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const raw = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
const src = codeOnly(raw)   // comments AND string bodies gone — this asks what the file DOES

/**
 * Assert a needle appears in the host exactly `n` times.
 *
 * ★ THE COUNT IS THE POINT, NOT THE PRESENCE. *"Does the file call burst"* is satisfied by one
 * correct call standing beside a wrong one, and the wrong one is the whole defect.
 */
const once = (needle: string, n: number, what: string) => {
  const got = src.split(needle).length - 1
  ok(got === n, `${what}: expected ${n}x "${needle}", found ${got}`)
  return got === n
}

/** Index of a needle that must appear exactly once, or -1 with the failure already filed. */
const at = (needle: string, what: string): number => {
  const got = src.split(needle).length - 1
  if (got !== 1) { fails.push(`${what}: expected 1x "${needle}", found ${got}`); return -1 }
  pass++
  return src.indexOf(needle)
}

// ── 0. THE READER CAN SEE ITS SUBJECT AT ALL ─────────────────────────────────────────────────
// Without this every assert below measures an empty string and reports green.
{
  ok(raw.length > 10_000, `VoxelWorld.tsx read (${raw.length} bytes)`)
  ok(src !== raw, 'the comment stripper blanked something')
  ok((raw.split('//').length - 1) > (src.split('//').length - 1), 'specifically, the comments')
  // The prose above the call sites names both of these. If a comment could satisfy an assert here,
  // documenting the wiring would be indistinguishable from doing it.
  ok(!src.includes('mid-swing'), 'prose is gone from the code view')
  ok(!src.includes('painted in bark'), 'prose is gone from the code view (second sample)')
}

// ── 1. THE PASS IS BUILT ONCE, TICKED, DRAWN, AND DISPOSED ───────────────────────────────────
// Four lines, and each one alone is a silent failure: an unticked pass renders a frozen spray,
// an unrendered one is invisible, an undisposed one leaks a shader program per remount.
{
  once('createBreakFx(SEED)', 1, 'built once, from the world seed')
  once('useMemo(() => createBreakFx', 1, 'inside a useMemo — a GPU resource per render is the context-loss bug')
  once('breakFx.tick(dt)', 1, 'ticked, with the clamped dt')
  once('object={breakFx.points}', 1, 'its points are in the scene graph')
  once('breakFx.dispose()', 1, 'disposed with the other passes')
  // ⚠ THE DEP ARRAY IS NOT COSMETIC. The dispose effect lists every pass it tears down; a pass
  // missing from it is disposed against a stale closure on the next dependency change.
  const dep = at('greg, steam, breakFx, seam, mist, flora]', 'breakFx is in the dispose dep array')
  ok(dep > 0, 'dispose dep array names breakFx between steam and seam')
}

// ── 2. ★★ THE PIXEL SCALE IS DERIVED, NOT INVENTED ───────────────────────────────────────────
// A chip is sized in BLOCKS and the shader needs pixels. The bug this closes shipped once already:
// point size as a pixel count times an invented constant, chips as large as the blocks they came
// off, and 55 green asserts could not see it — only a screenshot did.
{
  once('breakFx.setPixelScale(', 1, 'the scale is set exactly once')
  ok(/setPixelScale\(size\.height \/ \(2 \* Math\.tan\(/.test(src),
     'and it is height / (2·tan(fov/2)) — the projection, not a constant')
  ok(/\.fov \?\? 75/.test(src), "and the fov falls back to the Canvas's own 75, not a guess")
  // ⚠ AN EFFECT, NOT A FRAME. Recomputing this per frame is a uniform write for a value that
  // changes on resize; doing it ONCE on mount is worse — it freezes the scale at the first
  // viewport and every later resize renders the wrong size.
  ok(/}, \[breakFx, size\.height, camera\]\)/.test(src),
     'and it re-runs when the viewport height or the camera changes')
}

// ── 3. ★★★ THE SWING CARRIES ITS FRACTION — THE SILENT-DEATH ASSERT ──────────────────────────
// `swingChips` returns a rate × dt. Proven below against the real function at 60fps: every bucket
// is under one chip per frame for most of a swing, so `Math.floor` applied to a single frame's
// value is zero, forever, for every recipe in the file.
{
  const dt = 1 / 60
  const underOne = ALL_BUCKETS.filter(b => swingChips(b, 0.5, dt) < 1)
  ok(underOne.length === ALL_BUCKETS.length,
     `every bucket emits <1 chip in one frame at mid-swing (${underOne.length}/${ALL_BUCKETS.length}) — so a carry is mandatory, not a nicety`)

  once('chipCarry.current += swingChips(', 1, 'the fraction is ACCUMULATED, never rounded per frame')
  once('Math.floor(chipCarry.current)', 1, 'and whole chips are taken off the carry')
  once('chipCarry.current -= n', 1, 'and the remainder is kept for the next frame')
  // ★ The ramp takes the PROGRESS FRACTION, not elapsed time — that is what makes a tough block and
  // a soft one look the same at the same point in their break.
  ok(src.includes('swingChips(bucket, r.state.progress / r.state.required, dt)'),
     'swingChips is fed progress/required, not elapsed seconds')
  // The carry resets when the swing moves to another block, the same condition on which
  // `tickBreak` discards progress. Without it a keeper banks chips by flicking between two blocks.
  once('chipTarget.current = tk; chipCarry.current = 0', 1, 'a new target resets the carry')
}

// ── 4. ★★★ THE FACE COMES FROM THE RAYCAST ───────────────────────────────────────────────────
// `px,py,pz` is the empty cell just before the hit, so the difference is a unit vector on exactly
// one axis. Handing 0,0,0 is the cheapest wrong answer that still compiles and still draws chips.
{
  once('breakFx.chip(', 1, 'exactly one mid-swing call site')
  ok(src.includes('breakFx.chip(hit.x, hit.y, hit.z, hit.px - hit.x, hit.py - hit.y, hit.pz - hit.z, hit.material, n)'),
     'chips are born on the struck face, from the raycast normal')
  // ⚠ THE GUARD, NOT THE BRACES. The call must sit under "a swing is in progress" — the two ways
  // `r.state` is null are the two ways there must be no chips (the block gave; the block refused).
  const guard = src.lastIndexOf('if (r.state) {', src.indexOf('breakFx.chip('))
  const broke = src.indexOf('if (r.broken) {')
  ok(guard > 0 && guard < src.indexOf('breakFx.chip('),
     'the chip call sits inside `if (r.state)`')
  ok(guard < broke, 'and that guard opens before the broken branch, not inside it')
}

// ── 5. ★★★ THE BURST READS THE MATERIAL BEFORE THE WRITE ─────────────────────────────────────
// Two call sites: the felled tree and the single block. Both must fire BEFORE their `setVoxel`,
// because a burst against an already-AIR cell finds no bucket and returns — silently, correctly,
// and invisibly.
{
  once('breakFx.burst(', 2, 'exactly two break call sites')

  const fell = at('breakFx.burst(c.x, c.y, c.z, voxel(c.x, c.y, c.z))', 'the fell loop bursts per cell')
  // ⚠ SCOPED TO THE LOOP BODY, NOT TO THE FILE. `setVoxel(c.x, c.y, c.z, AIR)` appears four times
  // in this host — the gate carving its doorway, the court sweeping itself, and the fell loop — so
  // a whole-file index comparison would be asking about whichever one happens to come first. The
  // question is ADJACENCY: does the write that follows this burst clear the cell it just read?
  ok(fell > 0 && src.slice(fell, fell + 200).includes('setVoxel(c.x, c.y, c.z, AIR)'),
     'and the very next write clears the cell it just read — burst BEFORE setVoxel')
  // ★ PER CELL, NOT PER TREE. `hit.material` for the whole trunk paints the canopy in bark; leaves
  // and logs are different buckets with different recipes.
  ok(!/breakFx\.burst\(c\.x, c\.y, c\.z, hit\.material\)/.test(src),
     'the fell loop does not paint the whole tree in the struck material')

  const one = at('breakFx.burst(hit.x, hit.y, hit.z, hit.material)', 'the single block bursts once')
  const oneWrite = at('setVoxel(hit.x, hit.y, hit.z, AIR)', 'the single block writes AIR')
  ok(one > 0 && oneWrite > 0 && one < oneWrite, 'and it too fires before the write')
}

// ── 6. ⛔ THE BURST IS NOT WIRED INTO `setVoxel`, AND THAT IS THE DECISION ────────────────────
// `break-fx.ts`'s header calls `setVoxel` "the single funnel every world write passes through" and
// gives it the best claim to fire a burst. It was refused, and this assert is what stops the next
// reader helpfully "finishing" the job.
//
// The funnel carries far more than destruction: the court laying its platform and sockets, the
// gate carving its doorway, a waymark going down, a pot blooming, a tree GROWING, a placed piece's
// cells. Firing there means the court explodes into stone chips every time a keeper walks into it
// — bounded by the per-frame ceiling, so it would not even stutter. It would just be wrong, on
// load, in the one place the game is trying to look composed.
{
  // ⚠ THE WHOLE BODY, BOUNDED BY ITS OWN CLOSER — not a fixed character window. `codeOnly` blanks
  // comments to SPACES so offsets survive, which means this function's ~100 lines of prose still
  // occupy their width in the code view; a slice sized by eye would have stopped short of the end
  // and reported clean over the half it could not see. `blockAt` ends at the dep array the function
  // actually closes with, and returns at:-1 if it cannot find it — a look that failed is a failure.
  const fn = blockAt(src, 'const setVoxel = useCallback(', '}, [remesh, pieces, voxel, saveDecay])')
  ok(fn.at > 0, 'setVoxel is found, closer and all')
  ok(fn.code.length > 3000, `and the whole body was sliced, not a prefix (${fn.code.length} chars)`)
  ok(!fn.code.includes('breakFx'), 'setVoxel itself never fires chips — destruction is decided by the caller')

  // And the count above (exactly 2) is what keeps a third, well-meant call site from appearing at
  // the funnel later. Restated here as the reason, not as a second check.
  ok(src.split('breakFx.burst(').length - 1 === 2,
     'still exactly two burst call sites, both in the swing')
}

// ── 7. THE SPEC AGREES ABOUT WHAT THE CALL SITES HAND IT ─────────────────────────────────────
// The host passes raw block materials. If `bucketOf` stopped recognising the things a keeper
// actually swings at, both call sites would go quiet with nothing to show for it.
{
  const named = ['MAT.CHEST', 'MAT.WAYMARK']
  ok(named.every(n => src.includes(n)), 'the mine branch still speaks in materials')
  ok(ALL_BUCKETS.length >= 6, `the spec still offers every bucket (${ALL_BUCKETS.length})`)
  ok(bucketOf(0) === null, 'and AIR has no bucket — which is what makes a post-write burst silent')
}

console.log(`break-fx-wiring: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
