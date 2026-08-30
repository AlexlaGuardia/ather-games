/**
 * THE FIGURES ON THE GREEN STAND ON IT, AND THE PAGE CAN GET DOWN TO THEIR EYE.
 *
 * ★★ WHY THIS EXISTS. `dev/hold`'s own header says *"not one human has seen a single block of it"*,
 * and the reason was in the camera: the orbit's height is `target.y + 10 + dist * 0.45`, a function
 * of the DISTANCE, so the page had no vantage below about sixteen blocks and the default sat 32
 * blocks up. Every judgement of this hold was made from up there — and from up there a figure sunk
 * a block into the ground is invisible. Both defects were the same blind spot, so both are guarded
 * here: that a keeper's eye is REACHABLE, and that what it would then be looking at is standing on
 * the floor rather than buried in it.
 *
 * ⚠⚠ THE SINK WAS REAL AND IT WAS MEASURED, NOT REASONED. Before the fix, against the generator:
 * **91 of 91 seats drawn 0.975 blocks below their bank**, and the keeper capsule's feet typed as a
 * literal `0` against a ground surface of 1. The cause is the one the world lane hit the same
 * afternoon in the bridge abutments — `greenProfileAt` returns the TOP SOLID CELL while a figure
 * needs the STANDING SURFACE, one block apart, both honest, both named like heights.
 *
 * ★★ SO THE NUMERIC HALF ASSERTS THE AFFORDANCE, NOT A MEMBERSHIP. PATTERNS 2026-08-22 records the
 * mirror-image trap: a correct abutment broken to satisfy a check that asked *"is this cell in the
 * set"* when the real question was *how far is the drop*. The question here is never "which row is
 * this seat on" — it is **does the bottom of this capsule touch the top of that bank**, so that is
 * what is measured, in scene units, for every seat the generator emits.
 *
 * ⚠ AND THE `+ 1` IN `standAt` IS ONLY TRUE WHILE A CELL IS A UNIT BOX CENTRED AT `y + 0.5`. That
 * is a premise this file does not own, so it is asserted rather than assumed — the day `Inst` draws
 * cells any other way, this goes red instead of the figures quietly sinking again.
 *
 * Run: `npx tsx src/app/shimmer/dev/hold/hold-preview.test.ts` (repo convention — there is no vitest).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { greenProfileAt } from '../../voxel/green-terrain'
import { holdRows, bowlCentre, DEFAULT_ROWS } from '../../voxel/hold-rows'
import { DOWNBARROW_HEARTS } from '../../voxel/burrowtown'
import { EYE_STAND } from '../../voxel3d/locomotion'
import type { Box } from '../../voxel/jigsaw'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

const PAGE = readFileSync(join(process.cwd(), 'src/app/shimmer/dev/hold/page.tsx'), 'utf8')

// ── 1. THE PREMISE `standAt`'s `+ 1` RESTS ON ────────────────────────────────────────────────
// A cell must still be a unit box whose centre is half a block above its own index. Both halves,
// because either one drifting alone breaks the walking face by a different amount.
ok(/new THREE\.BoxGeometry\(1,\s*1,\s*1\)/.test(PAGE), 'a cell is still a unit box')
ok(/d\.position\.set\(c\.x \+ 0\.5, c\.y \+ 0\.5, c\.z \+ 0\.5\)/.test(PAGE),
  'a cell is still centred half a block above its index (so its face is at y + 1)')

// ── 2. NOTHING PLACES A FIGURE BY HAND ───────────────────────────────────────────────────────
// Both figure placements must route through `standAt`. A literal, or a re-derivation from the row
// dials, is how the sink got here in the first place.
//
// ⚠ ANCHORED AT `position={[`, AND THE MIDDLE TERM IS TAKEN AS "EVERYTHING BETWEEN THE FIRST AND
// LAST COMMA" — a `[^,]+` here matched nothing, because the correct expression CONTAINS commas
// (`standAt(green, s.x, s.z, entryYaw)`) and the broken one did not. A reader that only parses the
// defect it was written against is the shape PATTERNS keeps recording.
const seatLine = /position=\{\[s\.x \+ 0\.5,([\s\S]*?), s\.z \+ 0\.5\]\}/.exec(PAGE)
ok(!!seatLine, 'the audience placement is still readable at all')
ok(!!seatLine && /standAt\(/.test(seatLine[1]), 'the audience asks standAt for its height')
ok(!!seatLine && !/DEFAULT_ROWS\.rise/.test(seatLine[1]),
  'the audience no longer re-derives its bank from the row dials')
ok(/const refAt = useMemo/.test(PAGE) && /standAt\(green, kx, kz, entry\)/.test(PAGE),
  'the reference keeper asks standAt for the floor it stands on')

// ── 3. THE EYE IS THE WALKER'S, AND IT IS NOT A LOW ORBIT ────────────────────────────────────
ok(/EYE_STAND/.test(PAGE), 'eye height comes from the shipped constant')
ok(!/[^.\d]1\.62[^\d]/.test(PAGE), 'EYE_STAND is not re-typed as a literal')
// The orbit branch may keep its dist-coupled height; the eye branch may NOT have one.
const eyeBranch = /if \(eye\) \{([\s\S]*?)\} else \{/.exec(PAGE)
ok(!!eyeBranch, 'the rig still has an eye branch')
ok(!!eyeBranch && !/dist/.test(eyeBranch[1]),
  'the eye camera height is independent of dist (it is a stance, not a closer orbit)')
ok(!!eyeBranch && /camera\.lookAt\(target\.x, eyePos\.y, target\.z\)/.test(eyeBranch[1]),
  'the eye looks LEVEL — same y at the camera and at what it aims through')

// ── 4. `SEAT_HALF` IS THE REAL CENTRE-TO-FOOT OF THE CAPSULE THE PAGE DRAWS ──────────────────
// The structural asserts above only say the placement is `<surface> + SEAT_HALF`. That is correct
// ONLY IF SEAT_HALF is genuinely half the figure's height — otherwise the foot floats or sinks by
// the difference, which is precisely the `0.6`-instead-of-`0.575` half of the original defect.
// three.js: a capsule of radius r and straight length l is `l + 2r` tall, centred on its middle.
const num = (name: string): number | null => {
  const m = new RegExp(`const ${name} = ([\\d.]+)`).exec(PAGE)
  return m ? Number(m[1]) : null
}
const pageR = num('SEAT_R'), pageLen = num('SEAT_LEN')
ok(pageR !== null && pageLen !== null, 'the seat capsule names its own dimensions')
ok(/new THREE\.CapsuleGeometry\(SEAT_R, SEAT_LEN,/.test(PAGE),
  'the drawn capsule uses those names, so this file measures the figure that ships')
ok(/const SEAT_HALF = SEAT_LEN \/ 2 \+ SEAT_R/.test(PAGE),
  'SEAT_HALF is derived from them, not typed')
if (pageR !== null && pageLen !== null) {
  const trueHalf = (pageLen + 2 * pageR) / 2
  ok(Math.abs((pageLen / 2 + pageR) - trueHalf) < 1e-9,
    `SEAT_HALF (${(pageLen / 2 + pageR).toFixed(3)}) is the capsule's true centre-to-foot (${trueHalf.toFixed(3)})`)
  ok(Math.abs(0.6 - trueHalf) > 0.02,
    `the retired literal 0.6 really was wrong by ${(Math.abs(0.6 - trueHalf)).toFixed(3)} blocks — if this ever goes red the structural asserts are all that is left`)
}

// ── 5. THE SINK, MEASURED ON REAL GENERATOR DATA ─────────────────────────────────────────────
// ⚠ THIS DOES NOT RE-STATE THE PAGE'S ARITHMETIC — that would be a mirror of it, and PATTERNS
// 2026-08-22 records what a mirror is worth. It measures the DISTANCE BETWEEN THE TWO FORMS on
// every seat the generator emits, and asserts they are still far enough apart to be worth telling
// apart. The day the dials make them coincide, the structural asserts above stop being
// load-bearing and the next reader needs to know that, rather than inherit a guard that has
// quietly become decoration.
const SEAT_R_T = 0.3, SEAT_LEN_T = 0.55
const SEAT_HALF_T = SEAT_LEN_T / 2 + SEAT_R_T
const surfaceAt = (green: Box, x: number, z: number, entry: number) =>
  greenProfileAt(green, Math.round(x), Math.round(z), entry) + 1

let worstSink = 0, seatsSeen = 0
for (const def of DOWNBARROW_HEARTS) {
  const green: Box = { x0: 0, x1: def.w - 1, z0: 0, z1: def.d - 1 }
  for (const entry of [0, 1.1, -2.4]) {
    const seats = holdRows(green, entry)
    // ⚠ AN EMPTY SET PASSES EVERY LOOP BELOW. Say so out loud rather than let a green run mean
    // "the generator seated nobody" — the empty-measurement-window trap, PATTERNS 2026-08-22.
    ok(seats.length > 0, `${def.id} @${entry}: the green seats somebody`)
    for (const s of seats) {
      seatsSeen++
      const nowCentre = surfaceAt(green, s.x, s.z, entry) + SEAT_HALF_T   // feet on the bank's face
      const thenCentre = s.y + DEFAULT_ROWS.rise + 0.6                    // what the page drew before
      worstSink = Math.max(worstSink, nowCentre - thenCentre)
    }
  }
}
ok(seatsSeen > 0, 'seats were actually measured')
ok(worstSink > 0.5,
  `the retired form buried a seat by up to ${worstSink.toFixed(3)} blocks — the defect this file guards is still distinguishable`)
console.log(`   measured ${seatsSeen} seats across ${DOWNBARROW_HEARTS.length} greens · worst sink under the retired form ${worstSink.toFixed(3)} blocks`)

console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
