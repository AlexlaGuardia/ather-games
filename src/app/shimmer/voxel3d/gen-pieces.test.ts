// ★ THE GENERATED-PIECE WIRING, GUARDED AT THE SOURCE. Run: npx tsx src/app/shimmer/voxel3d/gen-pieces.test.ts
//
// `applyGenPieces` (VoxelWorld.tsx) is where worldgen-produced pieces — hold parapets, bridge
// railings — actually reach the world. It opens with an early-out:
//
//     const gen = [ ...holdGenPiecesForCol(...), ...bridgeGenPiecesForCol(...) ]
//     if (!gen.length) return
//
// ⚠⚠ EVERY SOURCE MUST BE CONCATENATED **ABOVE** THAT GUARD, AND THE FAILURE IS SILENT AND NEARLY
// TOTAL. The guard was written when the list was hold-only. Bridges cross open country and holds are
// elsewhere, so nearly every bridge column has ZERO hold pieces: a source added BELOW the early-out
// never places on almost every column it applies to, while looking exactly like its generator
// returning nothing. The debugging then happens in the generator's file, which is fine.
//
// ★★ AND NO RUNTIME TEST IN THIS REPO CAN SEE IT. `bridges.test.ts` runs 2103 asserts through
// `bridgeGenPiecesForCol` DIRECTLY; the world reaches it through this callback. That is exactly the
// gate-skipping shape that let a `roadAt` pre-filter discard 44% of a deck and 93% of its rails with
// a 371-assert oracle green — the same evening, one file over. A structural property that only the
// call site can express needs a guard that reads the call site. Same tool as
// `save-map/targets.test.ts`, for the same reason.
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * ⚠⚠⚠ COMMENTS ARE STRIPPED BEFORE ANYTHING IS SCANNED, AND THIS FILE NEEDED THREE ATTEMPTS TO
 * LEARN IT — each one green with the real bug in the file.
 *
 *   1. It searched for the bare text `if (!gen.length) return`, which appears in the COMMENT above
 *      the concat explaining why the concat must sit above it. The guard found the marker in its own
 *      prose and reported both live sources as mis-ordered — a false RED.
 *   2. It scanned a fixed 2000-char window for sources, so moving a source below the early-out also
 *      moved it out of the window: the loop checked only what was still above and passed — a false
 *      GREEN, which is the direction that ships.
 *   3. Bounded to the real function body, it STILL passed, because the warning comment NAMES
 *      `bridgeGenPiecesForCol` — so `head.includes(fn)` was satisfied by the warning about `fn`.
 *
 * ★ Every one of those is the same defect: **a reader that cannot tell code from prose about code.**
 * `purity.test.ts` solved it in this repo already (*"strip comments so prose about React can't trip
 * the scan"*), and `crops.ts` was bitten by it from the other side the same evening. A guard whose
 * subject is source TEXT must strip comments first, or its own documentation becomes a decoy — and
 * the better the documentation, the more convincing the decoy.
 */
const raw = readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx'), 'utf-8')
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

{
  const body = src.slice(src.indexOf('const applyGenPieces'))
  // ⚠⚠ ANCHORED AT LINE START, NOT `indexOf`, AND THIS FILE EARNED THAT THE SAME WAY EVERY OTHER
  // READER IN THE REPO DID. The first cut searched for the bare text `if (!gen.length) return` —
  // which appears IN THE COMMENT ABOVE THE CONCAT, explaining why the concat must sit above it. So
  // the guard found the marker in its own prose, measured a `head` containing only the comment, and
  // reported both live sources as mis-ordered. Documenting a marker created a marker: the same
  // defect as `crops.ts` quoting its own CROP_DEFS declaration, committed hours later by the person
  // who wrote that one up. Prose is not code, and a reader that cannot tell them apart is not a
  // reader. Anchor, and require exactly one match.
  const guardRe = /^\s{4}if \(!gen\.length\) return\s*$/m
  const guardHits = [...body.matchAll(new RegExp(guardRe.source, 'gm'))].length
  ok(guardHits === 1, `the early-out appears exactly once as CODE in applyGenPieces (found ${guardHits})`)
  const guard = body.search(guardRe)
  ok(guard > 0, 'applyGenPieces still has its early-out (if not, this whole file is auditing nothing)')

  // Every `*GenPiecesForCol` source the callback uses must appear before the guard.
  const head = body.slice(0, guard)
  // ⚠⚠ THE WHOLE CALLBACK BODY, BRACE-MATCHED — NOT A FIXED WINDOW, AND THE FIRST CUT OF THIS LINE
  // WAS A GUARD THAT COULD NOT FAIL ON ITS OWN BUG. It scanned `body.slice(0, 2000)` for sources,
  // so moving a source BELOW the early-out also moved it out of the search window: the loop then
  // checked only the sources that were still above, found them above, and reported 7/7 green with
  // the real defect in the file. Caught by mutation-testing the guard rather than by reading it.
  // ★ A window sized to "enough of the function" is a measurement that shrinks exactly when the
  // thing it measures moves — the same family as an empty course-signature window that could only
  // ever report "same". Bound to the actual function, or the guard is decoration.
  const end = (() => {
    const open = body.indexOf('{')
    let d = 0
    for (let i = open; i < body.length; i++) {
      if (body[i] === '{') d++
      else if (body[i] === '}') { d--; if (d === 0) return i }
    }
    return body.length
  })()
  const fnBody = body.slice(0, end)
  ok(fnBody.length > 400 && fnBody.length < 8000,
    `the brace scan found a plausible callback body (${fnBody.length} chars) — if this is wrong the checks below are auditing the wrong text`)
  const sources = [...fnBody.matchAll(/(\w*GenPiecesForCol)\s*\(/g)].map(m => m[1])
  const uniq = [...new Set(sources)]
  ok(uniq.length >= 2, `the callback draws on more than one piece source (${uniq.join(', ') || 'none found'})`)
  for (const fn of uniq) {
    ok(head.includes(fn),
      `★ ${fn} is concatenated BELOW \`if (!gen.length) return\` — it will silently never place on any column whose other sources are empty`)
  }
}

// ⚠ The blindness guard, the lesson from canon-drift's five skippable gates: if the parse ever stops
// finding the callback, the asserts above pass by looking at nothing. Say so instead.
ok(src.includes('const applyGenPieces'), 'applyGenPieces was found in VoxelWorld.tsx at all')
ok(src.includes('bridgeGenPiecesForCol'), 'the bridge railing source is still wired into the host')

console.log(`\ngen-piece wiring: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
