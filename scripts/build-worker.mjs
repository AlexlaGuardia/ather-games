// Bundle the voxel generation worker to public/ with esbuild.
//
// ★ WHY THIS EXISTS INSTEAD OF LETTING THE FRAMEWORK DO IT.
// Turbopack (Next 16) resolves `new Worker(new URL('./x.worker.ts', import.meta.url))` as a STATIC
// ASSET REFERENCE, not a worker entry point. It copies the file verbatim to
// `.next/static/media/<name>.<hash>.ts` — raw, uncompiled TypeScript with bare `import` statements.
// The browser fetches it, cannot parse it, and the Worker then constructs, accepts postMessage and
// never replies, with NOTHING in the console. Verified by inspecting the emitted asset. Moving the
// entry out of `src/app/` does not change it; the behaviour is Turbopack's `new URL` handling.
//
// So the worker is built explicitly and served from /public as a plain URL. That removes the
// bundler from the equation entirely: no `new URL` magic, no framework-specific worker support, and
// the same output whether the app is built with Turbopack, webpack, or something later.
//
// Bundled as IIFE, not ESM, deliberately — a classic worker has the widest support and there is
// then no `{ type: 'module' }` to get wrong. The app loads it with `new Worker('/voxel-gen.worker.js')`.

// ── ⚠⚠ A DELETED HASHED ARTIFACT IS A LIVE 404 WITH NO ERROR SURFACE (2026-08-20) ──────────────
// The existing rule is "the hashed artifact and worker-url.ts travel in ONE commit", and it is
// usually explained as a staleness problem — ship the pair apart and the world generates from old
// code. That undersells the failure by a long way, and the sharper statement is this:
//
// A commit that rebuilds the worker DELETES the previous hash from /public. If that commit ships
// while the deployed bundle still asks for the OLD hash, the browser requests a file that no longer
// exists and gets a 404. The Worker then constructs, accepts postMessage and never replies — so
// there is no thrown error, no failed import, nothing in the console, and the app itself is
// perfectly healthy. The symptom is simply that no terrain ever arrives.
//
// Verified the shape of it 2026-08-20: after a worker rebuild, `/voxel-gen.worker.4a6ba0b5ca.js`
// returned 404 on :3200 while the app served 200. It was harmless only because the deploy had
// already rebuilt the bundle to ask for the new hash. Had it not, the site would have looked fine
// and generated nothing.
//
// ★ SO THE CHECK IS: after any build, confirm the hash the DEPLOYED bundle asks for is a file that
// still exists — not merely that the two files in your working tree agree. `curl -o /dev/null -w
// '%{http_code}' <origin>/voxel-gen.worker.<hash>.js` answers it in one line, and it is the same
// shape as md5-ing the served worker against the local build: ask the thing that is running, not
// the thing you have.

// ★ THE OUTPUT IS CONTENT-HASHED, AND THAT IS NOT TIDINESS — IT COST HOURS.
// The first version emitted a fixed `public/voxel-gen.worker.js`. Files in /public are served with
// aggressive caching and that name never changes, so the browser pinned the FIRST build and kept
// serving it through every subsequent deploy. The worker answered `request` (which existed in that
// first build) and ignored `init` (whose ack was added later), which reads exactly like a worker
// that half-works. I concluded the worker was broken and reported that twice; it never was. Proven
// by loading the same file with `?v=<now>` — cache-busted returned `ready`, plain returned nothing.
// A hashed filename makes a stale worker impossible rather than unlikely.

import { build } from 'esbuild'
import { createHash } from 'crypto'
import { writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs'

const result = await build({
  entryPoints: ['src/workers/voxel-gen.worker.ts'],
  outfile: 'public/voxel-gen.worker.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: false,
  // The voxel core is pure — no react, no three, no DOM — so nothing here should ever pull one in.
  // If that changes, this build fails loudly rather than shipping a broken worker.
  external: [],
  logLevel: 'info',
  metafile: true,
})

const out = result.metafile.outputs['public/voxel-gen.worker.js']
const inputs = Object.keys(out?.inputs ?? {})
const banned = inputs.filter(f => /node_modules\/(react|three|@react-three)\//.test(f))
if (banned.length) {
  console.error('\n✗ the worker bundle pulled in host-only dependencies:\n  ' + banned.join('\n  '))
  console.error('  The voxel core must stay pure — see purity.test.ts and VOXEL-WORLD-MODEL § 6 rule 4.')
  process.exit(1)
}
// ── content-hash the output and publish the URL as a module ────────────────────────────────
const code = readFileSync('public/voxel-gen.worker.js')
const hash = createHash('sha256').update(code).digest('hex').slice(0, 10)
const name = `voxel-gen.worker.${hash}.js`

// Drop previous builds so /public does not accumulate a worker per deploy.
for (const f of readdirSync('public')) {
  if (/^voxel-gen\.worker\.[0-9a-f]{10}\.js$/.test(f) && f !== name) unlinkSync(`public/${f}`)
}
writeFileSync(`public/${name}`, code)
unlinkSync('public/voxel-gen.worker.js')

// Generated, not hand-written: the app imports this so the URL and the bundle can never disagree.
writeFileSync('src/workers/worker-url.ts',
  `// GENERATED by scripts/build-worker.mjs — do not edit.\n` +
  `// Content-hashed so a deployed worker can never be served from a stale cache entry.\n` +
  `export const VOXEL_WORKER_URL = '/${name}'\n`)

console.log(`\n✅ worker bundled: ${(out.bytes / 1024).toFixed(1)}KB from ${inputs.length} modules, no host deps`)
console.log(`   → public/${name}  (hash pinned in src/workers/worker-url.ts)`)
