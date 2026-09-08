// Render-light oracle. Run: npx tsx src/app/shimmer/voxel/render-light.test.ts
//
// Every failure this module can have is SILENT and most of them are silent in the direction that
// looks fine: light that leaks reads as a slightly bright cave, light that dies reads as atmosphere,
// and a border that does not spill reads as a shadow. None of them throw and none of them are
// visible in a screenshot taken from the wrong place. So the fixture is SYNTHETIC and hand-built —
// a flat world with a shaft, a sealed pocket, an overhang and a lantern in known positions — because
// an assert about a cave is worthless if the fixture might not contain one. That is the boulder
// oracle's scar (three surviving mutations against a fixture with no collision in it), and §1 is a
// precondition rather than a nicety.
import {
  computeRenderLight, beginRenderLight, stepRenderLight,
  packForTexture, unpackSky, unpackBlk,
  newBorders, li, MAX_LIGHT, SPAN, HEIGHT, OPPOSITE,
  FACE_XM, FACE_XP,
} from './render-light'
import { MAT } from './depth'
import { AIR } from './section'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── the fixture ───────────────────────────────────────────────────────────────────────────────
// Ground at y=100 across the whole column. Then, in column-local coordinates:
//   · a SHAFT at (2,2) open from the surface to y=60      — sky must fall down it at full strength
//   · a SEALED pocket of air at (8,8,y=70)                — must stay pitch dark
//   · a SIDE TUNNEL off the shaft at y=61, running +x     — sky must decay along it, not fall free
//   · a LANTERN at (12,12,y=80) in a sealed pocket        — block light with no sky anywhere near
// ⚠ WORLD COORDINATES, NOT COLUMN-LOCAL, AND THE FIRST VERSION USED LOCAL. A fixture built modulo
// SPAN gives every column identical geometry, so the neighbour in §6 arrives already lit by its own
// copy of the shaft and incoming light raises nothing — the assert passed on a tautology and its
// non-vacuity guard caught it. The shaft is now in column 0 ONLY and the tunnel crosses the border,
// so the neighbour is genuinely dark until light is handed to it.
const H0 = 100
const solidAt = (x: number, y: number, z: number): boolean => {
  if (y > H0) return false
  if (x === 2 && z === 2 && y >= 60) return false                   // the shaft — column 0 only
  if (y === 61 && z === 2 && x >= 2 && x <= 40) return false        // the tunnel, ACROSS the border
  if (x === 9 && z === 2 && y >= 50 && y < 61) return false         // a PIT under the tunnel's end
  if (x === 8 && z === 8 && y === 70) return false                  // the sealed pocket
  if (x === 12 && z === 12 && y >= 79 && y <= 81) return false      // the lantern's pocket
  return true
}
const matAt = (x: number, y: number, z: number): number => {
  if (x === 12 && z === 12 && y === 80) return MAT.MANA_LANTERN
  return solidAt(x, y, z) ? MAT.STONE : AIR
}
const heightAt = () => H0

const R = computeRenderLight(0, 0, matAt, heightAt, null)
const sky = (lx: number, y: number, lz: number) => R.sky[li(lx, y, lz)]
const blk = (lx: number, y: number, lz: number) => R.blk[li(lx, y, lz)]

// ── §1 the fixture contains what the asserts are about ────────────────────────────────────────
ok(!solidAt(2, 80, 2), '§1 the shaft is open at y=80')
ok(!solidAt(9, 61, 2), '§1 the tunnel reaches x=9')
ok(!solidAt(20, 61, 2), '§1 ★ and crosses into the NEXT column (x=20) — what §6 is about')
ok(solidAt(8, 71, 8) && !solidAt(8, 70, 8), '§1 the sealed pocket is sealed and is air')
ok(matAt(12, 80, 12) === MAT.MANA_LANTERN, '§1 the lantern is in the fixture')

// ── §2 sky: free above, full down an open shaft, zero in sealed rock ─────────────────────────
ok(sky(0, H0 + 1, 0) === MAX_LIGHT, '§2 open sky above the surface is 15')
ok(sky(0, H0 - 1, 0) === 0, '§2 solid ground one below the surface is 0')
ok(sky(2, 80, 2) === MAX_LIGHT, `§2 ★ sky FALLS FREE down an open shaft — 15 at y=80 (got ${sky(2, 80, 2)})`)
ok(sky(2, 60, 2) === MAX_LIGHT, `§2 ★ and all the way to its floor, 40 blocks down (got ${sky(2, 60, 2)})`)
ok(sky(8, 70, 8) === 0, `§2 ★★ a SEALED pocket is pitch dark (got ${sky(8, 70, 8)}) — the whole feature`)

// ── §3 the fall rule: dimmed light does NOT fall free ────────────────────────────────────────
// Down the side tunnel the level decays one per step, so by lx=9 it is well under 15. If the
// `lvl === MAX_LIGHT` half of the fall rule were dropped, every cave with a crack over it would
// light its floor like open ground.
const t3 = sky(3, 61, 2), t9 = sky(9, 61, 2)
ok(t3 > t9, `§3 sky decays along a side tunnel (${t3} at lx=3 -> ${t9} at lx=9)`)
ok(t9 < MAX_LIGHT, `§3 ★ and never stays at full strength away from the shaft (got ${t9})`)
ok(t9 > 0, `§3 ...but does reach x=9 (${t9}) — without this the assert above passes on darkness`)

// ★★ AND THE PIT IS WHERE THE FALL RULE IS ACTUALLY TESTABLE. The mutation that lets ALREADY-DIMMED
// light fall free only affects DOWNWARD travel, and the first fixture had solid rock under every
// dimmed cell — so it survived a sweep against a suite that could not reach it. The sample did not
// contain the phenomenon, which is this repo's most-repeated way to be green and wrong. A pit under
// the tunnel's far end gives dimmed light somewhere to fall.
ok(!solidAt(9, 55, 2), '§3 the pit under the tunnel is open — without it the fall rule is untestable')
const pitTop = sky(9, 60, 2), pitLow = sky(9, 51, 2)
ok(pitTop < MAX_LIGHT, `§3 ★★ dimmed light does NOT recover to full strength when it falls (${pitTop})`)
ok(pitTop > pitLow, `§3 ★★ it keeps decaying down the pit (${pitTop} at y=60 -> ${pitLow} at y=51)`)

// ── §4 solids are never lit; water is not a solid ────────────────────────────────────────────
let litSolid = 0
for (let y = 0; y <= H0; y++) for (let lz = 0; lz < SPAN; lz++) for (let lx = 0; lx < SPAN; lx++) {
  // ★ AN EMITTER IS EXEMPT AND THAT IS NOT A LOOPHOLE. A Mana Lantern is a solid block that is
  // itself a light source; solidity forbids light ENTERING a cell, not a cell being a source.
  if (matAt(lx, y, lz) === MAT.MANA_LANTERN) continue
  if (solidAt(lx, y, lz) && (sky(lx, y, lz) > 0 || blk(lx, y, lz) > 0)) litSolid++
}
ok(litSolid === 0, `§4 ★ no solid cell is ever lit (${litSolid})`)
{
  // ⚠ WATER MUST NOT BLOCK LIGHT. A lake going black underneath is the most visible possible
  // version of this bug, and `isSolid` alone would not catch it — water is already non-solid, so
  // the guard is against someone "simplifying" the material test into an `!== AIR`.
  const wet = (x: number, y: number, z: number) => (y <= H0 && y > H0 - 4 ? MAT.WATER : matAt(x, y, z))
  const W = computeRenderLight(0, 0, wet, heightAt, null)
  ok(W.sky[li(5, H0 - 1, 5)] > 0, `§4 ★★ light reaches through WATER (got ${W.sky[li(5, H0 - 1, 5)]})`)
}

// ── §5 block light: an emitter with no sky near it ───────────────────────────────────────────
ok(sky(12, 80, 12) === 0, '§5 the lantern pocket has no sky at all — so §5 is about block light only')
ok(blk(12, 80, 12) === 14, `§5 the Mana Lantern emits at its registry value, 14 (got ${blk(12, 80, 12)})`)
ok(blk(12, 79, 12) === 13, `§5 ★ block light decays one per step and NEVER falls free (got ${blk(12, 79, 12)})`)

// ── §6 borders: spill out, seed in, and it settles ───────────────────────────────────────────
{
  let spilled = 0
  for (const v of R.spill.sky) if (v > 0) spilled++
  ok(spilled > 0, `§6 ★ light that tried to leave the footprint was recorded (${spilled} border cells)`)

  // Feed this column's spill to a neighbour ON THE FACE IT ARRIVES. A second pass with the same
  // incoming must change nothing — light only ever increases and is capped, so it settles.
  const inc = newBorders()
  for (let y = 0; y < HEIGHT; y++) for (let s = 0; s < SPAN; s++) {
    const from = (FACE_XP * HEIGHT + y) * SPAN + s
    const to = (OPPOSITE[FACE_XP] * HEIGHT + y) * SPAN + s
    inc.sky[to] = R.spill.sky[from]; inc.blk[to] = R.spill.blk[from]
  }
  const A = computeRenderLight(SPAN, 0, matAt, heightAt, inc)
  const B = computeRenderLight(SPAN, 0, matAt, heightAt, inc)
  let differ = 0
  for (let i = 0; i < A.sky.length; i++) if (A.sky[i] !== B.sky[i] || A.blk[i] !== B.blk[i]) differ++
  ok(differ === 0, `§6 ★ the pass is deterministic given the same incoming (${differ} cells differ)`)

  // MONOTONIC: incoming light may only RAISE a cell, never lower one. That is what makes the
  // host's dirty-queue terminate instead of oscillating, and it cannot be asserted from inside a
  // single pass — it needs the with/without pair.
  const none = computeRenderLight(SPAN, 0, matAt, heightAt, null)
  let raised = 0, lowered = 0
  for (let i = 0; i < A.sky.length; i++) {
    if (A.sky[i] > none.sky[i]) raised++
    if (A.sky[i] < none.sky[i]) lowered++
  }
  ok(lowered === 0, `§6 ★★ incoming light never LOWERS a cell — the convergence argument (${lowered})`)
  ok(raised > 0, `§6 ★★ and it does raise some (${raised}) — without this the assert above is vacuous`)
}

// ── §7 the cost stays a shell, not a volume ──────────────────────────────────────────────────
{
  const frac = R.visited / (SPAN * HEIGHT * SPAN)
  ok(frac < 0.75, `§7 the flood touches a shell rather than the volume (${(100 * frac).toFixed(1)}% of cells)`)
}

// ── §7 the sliced pass and the one-shot pass are the same field ──────────────────────────────
// ★★ THIS IS THE ASSERT THE HOST RESTS ON. `computeRenderLight` is `stepRenderLight(w, Infinity)`,
// so the two paths share their code — but sharing code is not the same claim as producing the same
// ANSWER, because the sliced path carries state across calls and every cursor is a chance to resume
// in the wrong place. A phase that restarts its cursor, or a `head` that rewinds, gives a field that
// is merely DIMMER: no throw, no red, a cave that reads as atmosphere. Byte equality or nothing.
{
  const w = beginRenderLight(0, 0, matAt, heightAt, null)
  let steps = 0
  // A budget of zero still does one check-interval of work, so this terminates; the cap is a
  // runaway guard, not a timeout — if it is ever hit the loop is not advancing and that is the bug.
  while (!stepRenderLight(w, 0) && steps < 100000) steps++
  ok(steps > 1, `§7 the pass really was sliced — ${steps} resumptions, not one call in disguise`)
  // ⚠ THE NULL CHECK GATES THE COMPARE INSTEAD OF PREFACING IT. A `w.field!` deref on a job that
  // never finished THROWS, and a throw is neither a pass nor a fail — it aborts the run before §8
  // exists, so a mutation that stalls the cursor would be reported as broken test code. This file's
  // own header is about failures that do not look like failures; a crash is one of them.
  ok(w.field !== null, `§7 ★★ a job driven to completion publishes its field (stalled after ${steps})`)
  if (w.field) {
    let differ = 0
    for (let i = 0; i < R.sky.length; i++) {
      if (w.field.sky[i] !== R.sky[i] || w.field.blk[i] !== R.blk[i]) differ++
    }
    ok(differ === 0, `§7 ★★ sliced === one-shot, cell for cell (${differ} of ${R.sky.length} differ)`)
    let bdiffer = 0
    for (let i = 0; i < R.spill.sky.length; i++) {
      if (w.field.spill.sky[i] !== R.spill.sky[i] || w.field.spill.blk[i] !== R.spill.blk[i]) bdiffer++
    }
    ok(bdiffer === 0, `§7 ★ and the SPILL survives slicing too (${bdiffer} border cells differ)`)
  }

  // And the same with an incoming set, because phase 1 has its own cursor and the fixture above
  // never exercises it — a resumption bug there would hide behind a null `incoming`.
  const inc = newBorders()
  for (let y = 0; y < HEIGHT; y++) for (let s = 0; s < SPAN; s++) {
    const from = (FACE_XP * HEIGHT + y) * SPAN + s
    inc.sky[(OPPOSITE[FACE_XP] * HEIGHT + y) * SPAN + s] = R.spill.sky[from]
    inc.blk[(OPPOSITE[FACE_XP] * HEIGHT + y) * SPAN + s] = R.spill.blk[from]
  }
  const oneShot = computeRenderLight(SPAN, 0, matAt, heightAt, inc)
  const w2 = beginRenderLight(SPAN, 0, matAt, heightAt, inc)
  let s2 = 0
  while (!stepRenderLight(w2, 0) && s2 < 100000) s2++
  let d2 = w2.field ? 0 : oneShot.sky.length
  for (let i = 0; w2.field && i < oneShot.sky.length; i++) {
    if (w2.field.sky[i] !== oneShot.sky[i] || w2.field.blk[i] !== oneShot.blk[i]) d2++
  }
  ok(d2 === 0, `§7 ★★ and with an INCOMING set, whose seed phase has its own cursor (${d2} differ)`)
}

// ── §8 the queue outgrows its first allocation, and that is not a theoretical case ────────────
// ⚠⚠ The queue was fixed at `n * 2` on the reasoning that a cell is pushed once per channel. This
// fixture disproves it, and the disproof matters because a typed-array write past the end is
// SILENTLY DROPPED — the failure is a dark patch in a lit cave, not an exception.
//
// The scenario is the cheapest one that reaches it: open sky to y=0, so the sky seed alone is
// 255 x 256 = 65,280 pushes against an initial 65,536, and a single lantern at the bottom then
// needs thousands more. Without growth every one of the lantern's flood entries is dropped, its
// light is written into its six neighbours and propagates from none of them.
{
  const N = SPAN * HEIGHT * SPAN
  const openHeight = () => 0
  const lanternAt = (x: number, y: number, z: number): number =>
    (y === 0 && x === 8 && z === 8) ? MAT.MANA_LANTERN : AIR
  const w = beginRenderLight(0, 0, lanternAt, openHeight, null)
  stepRenderLight(w, Infinity)
  ok(w.qn > N, `§8 ★ the pass really does push more than its first allocation (${w.qn} > ${N})`)
  ok(w.q.length > N, `§8 ★★ so the queue GREW — a fixed one would have dropped ${w.qn - N} entries`)
  // Five blocks up from a 14-emitter is 9, and it is only reachable through four propagation steps
  // that all live past the overflow point.
  ok(w.field?.blk[li(8, 5, 8)] === 9,
    `§8 ★★ the lantern's light still propagates past the overflow (got ${w.field?.blk[li(8, 5, 8)]}, want 9)`)
}

// ── §9 the packed field the GPU sees ─────────────────────────────────────────────────────────
// ⚠ A transposed upload is the failure this section exists for, and it does not look like a
// transpose: `li` and the texture's own index are both x-fastest and the same length, so swapping
// them yields light smeared along z — a plausible shader bug that would be hunted in the shader.
{
  const packed = packForTexture(R)
  ok(packed.length === SPAN * HEIGHT * SPAN, '§9 the packed field is one byte per cell')
  const at = (lx: number, y: number, lz: number) => packed[(lz * HEIGHT + y) * SPAN + lx]
  // The shaft is at local (2,2) and the lantern's pocket at (12,12,80). Two cells that differ in
  // BOTH x and z, so a transpose cannot satisfy them both.
  ok(unpackSky(at(2, 80, 2)) === sky(2, 80, 2) && sky(2, 80, 2) > 0,
    `§9 ★★ the shaft's sky survives the repack at its own coordinates (${unpackSky(at(2, 80, 2))} vs ${sky(2, 80, 2)})`)
  ok(unpackBlk(at(12, 80, 12)) === 14,
    `§9 ★★ and the lantern is at (12,80,12), not at (12,80,12) transposed (${unpackBlk(at(12, 80, 12))})`)
  ok(unpackSky(at(12, 80, 12)) === 0 && unpackBlk(at(2, 80, 2)) === 0,
    '§9 ★ the two channels do not bleed into each other — sealed pocket has no sky, shaft has no block light')
  // Exhaustive, because the two orders agree on a great many cells by coincidence and a spot check
  // of the wrong pair would pass a transposed pack.
  let wrong = 0
  for (let lz = 0; lz < SPAN; lz++) for (let y = 0; y < HEIGHT; y++) for (let lx = 0; lx < SPAN; lx++) {
    const b = at(lx, y, lz)
    if (unpackSky(b) !== sky(lx, y, lz) || unpackBlk(b) !== blk(lx, y, lz)) wrong++
  }
  ok(wrong === 0, `§9 ★★★ every one of the ${SPAN * HEIGHT * SPAN} cells round-trips (${wrong} wrong)`)
  // The buffer is reusable — the host keeps one scratch for every upload rather than allocating
  // 64KB per column per pass.
  const reuse = new Uint8Array(SPAN * HEIGHT * SPAN)
  ok(packForTexture(R, reuse) === reuse, '§9 a supplied buffer is filled in place, not replaced')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the dark has somewhere to come from — ${pass} passed`)
