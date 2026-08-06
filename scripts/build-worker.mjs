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

import { build } from 'esbuild'

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
console.log(`\n✅ worker bundled: ${(out.bytes / 1024).toFixed(1)}KB from ${inputs.length} modules, no host deps`)
