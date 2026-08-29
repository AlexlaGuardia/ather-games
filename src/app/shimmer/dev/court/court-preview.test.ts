/**
 * The court preview must lay what the WORLD lays — asserted against the host, not against a list.
 *
 * ★★ WHY A SOURCE-LEVEL GUARD AND NOT A RENDER TEST. `dev/ring`'s header states this repo's rule and
 * its history counts seven times a preview that RE-DERIVED was perfectly correct while the game was
 * wrong. The failure is never that the preview looks broken; it is that the preview looks fine and
 * is a building the world does not build. So what needs asserting is not the picture — it is that
 * both files ask the SAME functions for their cells.
 *
 * ⚠⚠ AND IT COMPARES THE TWO DERIVATIONS RATHER THAN A HARD-CODED SET. PATTERNS 2026-08-22: "a
 * hand-kept mirror of a private value — agreement between a copy and its original is not evidence
 * about either", and the fix recorded there is to compare the DERIVATIONS, so the guard fails when
 * the two stop listing the same sources (the event) rather than when someone notices a wrong picture
 * (the symptom). A literal list would go stale the first time hub adds a court pass, and it would go
 * stale QUIETLY — the preview would keep rendering a court that was complete last week.
 *
 * ⚠ THIS FILE WAS FIRST WRITTEN AGAINST VITEST AND THAT WAS A REAL MISS, NOT A STYLE SLIP. There is
 * no vitest in this repo — `npx vitest` only ran because npx fetched it transiently, and the suite
 * would have been INVISIBLE to `npm run sweep` while looking green in my own shell. A guard nothing
 * executes is worse than no guard: it answers "is this covered" with yes. It also put an eighth
 * error into a 7-error tsc baseline, and I had already told Alex the baseline held.
 *
 * Run: `npx tsx src/app/shimmer/dev/court/court-preview.test.ts` (repo convention — there is no vitest).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

const read = (p: string) => readFileSync(join(process.cwd(), 'src/app/shimmer', p), 'utf8')
const HOST = read('voxel3d/VoxelWorld.tsx')
const PAGE = read('dev/court/page.tsx')
const CROSSINGS = read('voxel3d/crossings.ts')

/** Every court cell-producer the file actually CALLS — `name(` — not merely imports. */
const called = (src: string, names: string[]) =>
  new Set(names.filter(n => new RegExp(`\\b${n}\\s*\\(`).test(src)))

// The vocabulary is read off `crossings.ts`'s own exports, so a new pass joins this guard by being
// exported rather than by someone remembering to add it here.
const CELL_FNS = [...CROSSINGS.matchAll(/export function (\w*(?:Cells))\b/g)].map(m => m[1])

/**
 * The CLEAR passes are removals, not placements — the host feeds them to `setVoxel(..., AIR)` to
 * take an older court back out of the world. A preview has nothing to erase, so it correctly does
 * not call them.
 *
 * ⚠⚠ AND THE EXEMPTION IS WRITTEN TO EXPIRE, WHICH IS THE ONLY KIND WORTH HAVING. PATTERNS
 * 2026-08-22: "an exemption is not a neutral omission — it is a silent promise that someone is
 * watching that corner", and the guard that shipped the unclimbable rinning ladder was a hand-kept
 * skip list that outlived its reason by two days. So this does not merely skip the name: it asserts
 * the PREMISE that justifies the skip — that crossings.ts still documents each of these as a sweep.
 * The day one of them starts laying stone, the premise assert goes red instead of the preview
 * quietly rendering a building with a piece missing.
 */
const isClearPass = (n: string) => /Clear/.test(n)
const LAY_FNS = CELL_FNS.filter(n => !isClearPass(n))
const CLEAR_FNS = CELL_FNS.filter(isClearPass)

// ── 1. the vocabulary itself ──────────────────────────────────────────────────────────────────
// ⚠ AN EMPTY VOCABULARY WOULD MAKE EVERY ASSERT BELOW PASS VACUOUSLY — the "empty measurement window
// can only ever return one answer" trap (PATTERNS 08-22). If the naming convention moves, fail here.
ok(CELL_FNS.length >= 4, `the cell-producer vocabulary is findable — got ${CELL_FNS.length}`)
ok(CELL_FNS.includes('gateTowerCells'), 'the tower is part of the vocabulary being compared')
ok(LAY_FNS.length >= 3, `something is actually LAID, not all swept — ${LAY_FNS.length} laying passes`)

// ── 2. the preview lays everything the host lays ──────────────────────────────────────────────
{
  const host = called(HOST, LAY_FNS)
  const page = called(PAGE, LAY_FNS)
  // Host-only is the failure that matters: the world builds something the preview does not show, so
  // the preview quietly under-reports the building. NAMED, not counted — PATTERNS 08-22: "a count
  // that goes red without saying why invites the cheapest lie that makes it green."
  const missing = [...host].filter(f => !page.has(f))
  ok(host.size > 0, `the host calls at least one laying pass — found ${host.size}`)
  ok(missing.length === 0,
    `★ the world lays these and the preview does not: ${missing.join(', ') || '(none)'}`)
}

// ── 3. the exemption still describes removals ─────────────────────────────────────────────────
ok(CLEAR_FNS.length > 0, 'there is at least one exempted clear pass to check the premise of')
for (const fn of CLEAR_FNS) {
  const at = CROSSINGS.indexOf(`export function ${fn}`)
  const doc = at > 0 ? CROSSINGS.slice(Math.max(0, at - 1400), at).toLowerCase() : ''
  ok(at > 0 && /clear|sweep/.test(doc),
    `★ ${fn} is exempted as a removal pass and crossings.ts still documents it as one`)
}

// ── 4. materials come from the host, never from the page ──────────────────────────────────────
ok(/\bsocketMaterial\s*\(/.test(PAGE), 'the preview asks socketMaterial which stone a frame cell is')
ok(/\bPLATFORM_MAT\b/.test(PAGE), 'the dais uses the host PLATFORM_MAT, not a chosen colour')
{
  // ★★ THIS ASSERT EXISTS BECAUSE IT CAUGHT ITS OWN AUTHOR. The first draft tagged the hub and the
  // entire gate tower `m: 4` — a guess — and rendered 480 courses of stone in DIRT BROWN while every
  // other assert stayed green. CUT_STONE is 41. A magic number is how a preview stops being a preview
  // of anything, and it is invisible in review because `4` looks like an id.
  const literals = [...PAGE.matchAll(/\bm:\s*(\d+)/g)].map(m => m[0])
  ok(literals.length === 0, `★ materials named by number instead of MAT.*: ${literals.join(', ')}`)
}

// ── 5. the shipped look, including the fog ────────────────────────────────────────────────────
ok(/\bbuildTileArray\s*\(/.test(PAGE) && /\blayerOf\s*\(/.test(PAGE),
  'cubes are textured from the shipped tile array, not tinted')
// ★ THE FOG IS THE ASSERT THAT EARNS ITS KEEP. The tower is sized to subtend an angle at the draw
// ring and `DAY.fogNear` is 80, so at the 96-block ring the thing being judged is already in the fog
// eating it. A preview that lit the model cleanly would answer "reads as a landmark" about an object
// the world hides — the flattering direction, and therefore the dangerous one.
ok(/<VoxelDayNight\s*\/>/.test(PAGE), 'the shipped day/night rig is mounted, not a studio light')
ok(/\bDAY\.fog(Near|Far)\b/.test(PAGE), '★ and its fog is in frame, which is the whole landmark question')

// ── 6. the page can be aimed, which is why it exists ──────────────────────────────────────────
// ⚠ `console.ts` has no tier command, so a headless shot of the WORLD is always DEFAULT_PLOT = tier 0
// while Alex plays tier 1 — the instrument could not be pointed at his court and nothing said so. If
// the URL read is dropped the page becomes click-only and inherits exactly that blindness.
ok(/URLSearchParams/.test(PAGE), 'the view is readable from the URL, so a shot is reproducible')
for (const k of ['tier', 'dist', 'yaw']) {
  ok(PAGE.includes(`'${k}'`), `★ ?${k}= is honoured, so the page can be aimed without clicking`)
}
// ⚠⚠ AND YAW IS ANCHORED TO THE GATE, NOT TO WORLD NORTH. Each socket turns to face the court's
// focus, so a world-space yaw of 0 is a DIFFERENT oblique view at every tier — the page's default
// view would not be the front of the thing it exists to judge. Caught by looking at a shot.
ok(/facing\s*\+\s*\(yaw/.test(PAGE),
  '★ yaw=0 means square-on to the gate at every tier, not an accident of world axes')

console.log(`court-preview: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
