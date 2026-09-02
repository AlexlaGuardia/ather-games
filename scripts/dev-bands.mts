/**
 * REGENERATE THE EDITOR BAND CACHE. Thin CLI — the derivation AND its rendering both live in
 * `src/app/shimmer/dev/templates/band-derive.ts`, so `editor-bands.test.ts` compares the file on
 * disk against the same renderer without having to import this `.mts`.
 *
 * ⚠ THE GENERATED FILE IS A CACHE, NOT A SOURCE. Never hand-edit it — the guard re-derives from
 * scratch, so an edit here is a red suite rather than a silent lie, which is the only reason a
 * cache is allowed to exist at all.
 *
 * Run: `npm run gen:bands`   ·   check-only: `npm run check:bands`
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBands } from '../src/app/shimmer/dev/templates/band-derive.ts'

const OUT = join(process.cwd(), 'src/app/shimmer/dev/templates/editor-bands.generated.ts')

// ⚠ SIDE EFFECTS ONLY WHEN RUN AS A COMMAND. If writing happened at import time, a guard that
// imported this would REWRITE the file it is checking and then find it identical — a check that
// repairs its own subject and reports green (PATTERNS 2026-08-31, roles swapped).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const next = renderBands()
  if (process.argv.includes('--check')) {
    if (readFileSync(OUT, 'utf8') === next) { console.log('editor-bands.generated.ts is current'); process.exit(0) }
    console.error('DRIFT: editor-bands.generated.ts is stale. Run `npm run gen:bands`.')
    process.exit(1)
  }
  writeFileSync(OUT, next)
  console.log(`wrote ${OUT}`)
}
