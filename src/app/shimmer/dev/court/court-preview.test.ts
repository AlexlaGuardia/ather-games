// The court preview must lay what the WORLD lays — asserted against the host, not against a list.
//
// ★★ WHY A SOURCE-LEVEL GUARD AND NOT A RENDER TEST. `dev/ring`'s header states this repo's rule and
// its history counts seven times a preview that RE-DERIVED was perfectly correct while the game was
// wrong. The failure is never that the preview looks broken; it is that the preview looks fine and
// is a building the world does not build. So what needs asserting is not the picture, it is that
// both files ask the SAME functions for their cells.
//
// ⚠⚠ AND IT COMPARES THE TWO DERIVATIONS RATHER THAN A HARD-CODED SET. PATTERNS 2026-08-22: "a
// hand-kept mirror of a private value — agreement between a copy and its original is not evidence
// about either", and the fix recorded there is to "compare the DERIVATIONS, not the values", so the
// guard fails when the two stop listing the same sources (the event) rather than when someone
// notices a wrong picture (the symptom). A literal list here would go stale the first time hub adds
// a fifth court pass, and it would go stale QUIETLY — the preview would keep rendering a court that
// was complete last week. That is the exact bug this page was built to end.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), 'src/app/shimmer', p), 'utf8')
const HOST = read('voxel3d/VoxelWorld.tsx')
const PAGE = read('dev/court/page.tsx')

/** Every court cell-producer the file actually CALLS — `name(` — not merely imports. */
const called = (src: string, names: string[]) =>
  new Set(names.filter(n => new RegExp(`\\b${n}\\s*\\(`).test(src)))

// The vocabulary is read off `crossings.ts`'s own exports, so a new pass joins this guard by being
// exported rather than by someone remembering to add it here.
const CROSSINGS = read('voxel3d/crossings.ts')
const CELL_FNS = [...CROSSINGS.matchAll(/export function (\w*(?:Cells))\b/g)].map(m => m[1])

/**
 * The CLEAR passes are removals, not placements — the host feeds them to `setVoxel(..., AIR)` to
 * take an older court back out of the world. A preview has nothing to erase, so it correctly does
 * not call them.
 *
 * ⚠⚠ AND THE EXEMPTION IS WRITTEN TO EXPIRE, WHICH IS THE ONLY KIND WORTH HAVING. PATTERNS
 * 2026-08-22: "an exemption is not a neutral omission — it is a silent promise that someone is
 * watching that corner", and the guard that shipped the unclimbable ladder was a hand-kept skip
 * list that outlived its reason by two days. So this does not merely skip the name: it asserts the
 * PREMISE that justifies the skip — that crossings.ts still documents each of these as a sweep. The
 * day one of them starts laying stone, the premise assert goes red instead of the preview quietly
 * rendering a building with a piece missing.
 */
const isClearPass = (n: string) => /Clear/.test(n)
const LAY_FNS = CELL_FNS.filter(n => !isClearPass(n))
const CLEAR_FNS = CELL_FNS.filter(isClearPass)

describe('dev/court lays what the world lays', () => {
  it('finds the cell-producing exports to compare (the vocabulary is not empty)', () => {
    // ⚠ AN EMPTY VOCABULARY WOULD MAKE EVERY ASSERT BELOW PASS VACUOUSLY — the "empty measurement
    // window can only ever return one answer" trap. If the naming convention moves, fail here.
    expect(CELL_FNS.length).toBeGreaterThanOrEqual(4)
    expect(CELL_FNS).toContain('gateTowerCells')
  })

  it('calls every court cell-producer the host calls', () => {
    const host = called(HOST, LAY_FNS)
    const page = called(PAGE, LAY_FNS)
    // Host-only is the failure that matters: the world builds something the preview does not show,
    // so the preview quietly under-reports the building. Named, not counted — PATTERNS 08-22: "a
    // count that goes red without saying why invites the cheapest lie that makes it green."
    const missing = [...host].filter(f => !page.has(f))
    expect(missing, `the world lays these and the preview does not: ${missing.join(', ')}`).toEqual([])
  })

  it('every exempted pass is still a REMOVAL pass, so the exemption expires on its own', () => {
    expect(CLEAR_FNS.length).toBeGreaterThan(0)
    for (const fn of CLEAR_FNS) {
      // The docstring immediately above the declaration is the premise being leaned on.
      const at = CROSSINGS.indexOf(`export function ${fn}`)
      expect(at, `${fn} not found`).toBeGreaterThan(0)
      const doc = CROSSINGS.slice(Math.max(0, at - 1400), at).toLowerCase()
      expect(doc, `${fn} is exempted as a clear pass but no longer documents itself as one`)
        .toMatch(/clear|sweep/)
    }
  })

  it('takes its materials from the host s own helpers, never a local palette', () => {
    // `socketMaterial` decides lamp-vs-stone and `PLATFORM_MAT` the dais. A preview that picked its
    // own colours here would be judging a look nothing ships.
    expect(PAGE).toMatch(/\bsocketMaterial\s*\(/)
    expect(PAGE).toMatch(/\bPLATFORM_MAT\b/)
  })

  it('never names a material by number', () => {
    // ★★ THIS ASSERT EXISTS BECAUSE IT CAUGHT ITS OWN AUTHOR. The first draft of the page tagged the
    // hub and the entire gate tower `m: 4` — a guess — and rendered 480 courses of stone in DIRT
    // BROWN while every other assert stayed green. CUT_STONE is 41. A magic number is how a preview
    // stops being a preview of anything, and it is invisible in review because 4 looks like an id.
    const literals = [...PAGE.matchAll(/\bm:\s*(\d+)/g)].map(m => m[0])
    expect(literals, `name these through MAT.*, not by number: ${literals.join(', ')}`).toEqual([])
  })

  it('draws with the shipped tile art, not a chosen colour', () => {
    // The cubes are textured from `buildTileArray` / `layerOf` — the same pixels the world samples.
    expect(PAGE).toMatch(/\bbuildTileArray\s*\(/)
    expect(PAGE).toMatch(/\blayerOf\s*\(/)
  })

  it('mounts the shipped lighting AND its fog', () => {
    // ★ THE FOG IS THE ASSERT THAT EARNS ITS KEEP. The tower is sized to subtend an angle at the
    // draw ring, and `DAY.fogNear` is 80 — so at the 96-block ring the thing being judged is already
    // in fog. A preview that lit the model cleanly would answer "reads as a landmark" about an
    // object the world hides, which is the flattering direction and therefore the dangerous one.
    expect(PAGE).toMatch(/<VoxelDayNight\s*\/>/)
    expect(PAGE).toMatch(/\bDAY\.fog(Near|Far)\b/)
  })

  it('takes its view from the URL so a shot is reproducible and aimable', () => {
    // ⚠ THE REASON THIS PAGE EXISTS AT ALL: `console.ts` has no tier command, so a headless shot of
    // the WORLD is always DEFAULT_PLOT = tier 0, while Alex plays tier 1 — the instrument could not
    // be pointed at his court and nothing said so. If the URL read is ever dropped, the page becomes
    // click-only and inherits that blindness.
    expect(PAGE).toMatch(/URLSearchParams/)
    for (const k of ['tier', 'dist', 'yaw']) expect(PAGE).toContain(`'${k}'`)
  })
})
