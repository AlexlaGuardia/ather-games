// IS THE TRACKED VOXEL WORKER WHAT THE CURRENT SOURCE BUILDS TO?
//
// ── ★★★ SOURCE AND ARTIFACT DISAGREEING IS SILENT, AND BOTH HALVES STAY INTERNALLY CONSISTENT ──
// `build-worker.mjs`'s own header covers the case where the hashed artifact and `worker-url.ts` ship
// apart. This covers the one nobody was watching: a commit that changes VOXEL SOURCE without running
// a build at all. The tracked worker then predates the source, the page runs the ARTIFACT while every
// node script imports source directly, and the two disagree about the world with nothing said.
//
// ⚠ AND IT SURFACES AS SOMEBODY ELSE'S PROBLEM. The next window to build — for any reason, in any
// lane — regenerates the worker, deletes the old hash, re-points `worker-url.ts`, and deploys from a
// dirty tree carrying a diff it did not author. That happened on 2026-08-24: the hub's build shipped
// the world lane's rebuilt worker, and only `coord build`'s dirty-tree backstop caught it, AFTER the
// deploy. This moves the catch to before the commit, where it costs seconds.
//
// ★ IT BUILDS TO A TEMP FILE AND TOUCHES NOTHING. A guard that regenerates the real artifact would
// CREATE the dirty tree it exists to detect, and would report "fresh" every time by construction —
// the check that cannot fail. Nothing here writes to `public/` or `src/workers/`.
//
// Run: `npm run worker:fresh`   (exit 1 on drift, and it names both hashes)
import { build } from 'esbuild'
import { createHash } from 'crypto'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const URL_MODULE = 'src/workers/worker-url.ts'
const tracked = readFileSync(URL_MODULE, 'utf8')
const trackedHash = tracked.match(/voxel-gen\.worker\.([0-9a-f]{10})\.js/)?.[1]

// ⚠ "I could not look" and "I looked and it is fine" must not share an exit code.
if (!trackedHash) {
  console.error(`✗ BLIND — no hashed worker URL found in ${URL_MODULE}. The generator's format changed,`)
  console.error('  or the file was hand-edited. This check cannot answer, so it is not answering yes.')
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'worker-fresh-'))
const outfile = join(dir, 'probe.js')
let freshHash
try {
  // ★ THE SAME OPTIONS THE REAL BUILD USES. If these drift apart the guard measures a bundle nobody
  // ships — the mirror trap, where a copy and its original agree until one of them is edited.
  await build({
    entryPoints: ['src/workers/voxel-gen.worker.ts'],
    outfile, bundle: true, format: 'iife', platform: 'browser',
    target: 'es2022', minify: true, sourcemap: false, external: [], logLevel: 'silent',
  })
  freshHash = createHash('sha256').update(readFileSync(outfile)).digest('hex').slice(0, 10)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

const artifact = `public/voxel-gen.worker.${trackedHash}.js`
const problems = []
if (!existsSync(artifact))
  problems.push(`${URL_MODULE} points at ${artifact}, which does not exist — the deployed page would 404 the worker, construct it, and never get a reply. No console error, no terrain.`)
if (freshHash !== trackedHash)
  problems.push(`the tracked worker is ${trackedHash} but the current source builds to ${freshHash} — voxel source changed and nothing rebuilt. The next build in ANY lane will regenerate it and deploy from a dirty tree.`)

if (problems.length) {
  console.error('\n✗ the voxel worker artifact is out of date:')
  for (const p of problems) console.error('  · ' + p)
  console.error('\n  Fix: npm run build:worker, then commit the new public/voxel-gen.worker.*.js')
  console.error(`  AND ${URL_MODULE} together — they must travel in one commit.`)
  process.exit(1)
}
console.log(`✅ worker artifact is current — source builds to ${freshHash}, tracked and present.`)
