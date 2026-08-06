// Render-path audit. Run: npx tsx src/app/shimmer/voxel3d/render-audit.test.ts
//
// ★ WHY THIS EXISTS. `mesh-bridge.ts` carries a comment saying "a material per chunk is a shader
// program per chunk, and that is how a voxel renderer dies" — and hours after writing it I shipped
// a material AND a geometry per dropped item. Chrome responded by losing the WebGL context and then
// BLOCKING the page from creating another, which renders as a black canvas with the HUD still drawn
// on top: indistinguishable from a generation failure, and I hunted the wrong layer for it.
//
// A comment did not prevent that. This does. It is a static scan, so it is crude by construction —
// but the failure it guards against is expensive and the shape is easy to spot: a GPU resource
// constructed anywhere that runs more than once.
//
// ⚠ If this fails, do NOT widen the allowlist to make it pass. Share the resource or cache it.

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const DIR = join(process.cwd(), 'src/app/shimmer/voxel3d')

/** Things that own GPU memory or a shader program. Constructing these per-object is the bug. */
const GPU_RESOURCE = /new\s+THREE\.(\w*(?:Geometry|Material|Texture|RenderTarget))\b/g

/** Cheap CPU objects — fine to construct, but not in a per-frame loop. */
const CPU_CHURN = /new\s+THREE\.(Vector2|Vector3|Vector4|Quaternion|Matrix4|Color|Box3|Ray)\b/g

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const files = readdirSync(DIR).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts'))
ok(files.length > 0, 'found render-path files to audit')

for (const file of files) {
  const raw = readFileSync(join(DIR, file), 'utf-8')
  // Strip comments — this file's own prose names the very constructors it bans.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const lines = src.split('\n')

  // ── 1. every GPU resource must be constructed somewhere that runs once ──────────────────────
  // Accepted homes: a useMemo/useState initialiser, a module-level const, a factory function whose
  // result is memoised, or an explicit cache keyed by something bounded.
  for (const m of src.matchAll(GPU_RESOURCE)) {
    const idx = m.index ?? 0
    const lineNo = src.slice(0, idx).split('\n').length
    const line = lines[lineNo - 1] ?? ''
    const context = lines.slice(Math.max(0, lineNo - 4), lineNo).join('\n')

    const memoised = /useMemo\(/.test(context) || /useMemo\(/.test(line)
    // A cache write: `xs.set(key, new THREE.Something(...))` or `x = new THREE...` right before a `.set(`
    const cached = /\.set\(/.test(context) || /\.set\(/.test(lines.slice(lineNo - 1, lineNo + 2).join('\n'))
    // ★ A FACTORY IS LEGITIMATE — the rule moves to its CALL SITES, it is not waived.
    // `createVoxelMaterial()` and `toGeometry()` must construct a resource; that is their job. What
    // matters is that a factory is not CALLED per object. So: allow the construction here, and
    // separately assert every call site is one-shot (see § 1b).
    const inFactory = /export\s+function\s+(create|to)[A-Z]/.test(
      src.slice(Math.max(0, idx - 600), idx))

    ok(memoised || cached || inFactory,
      `${file}:${lineNo} constructs THREE.${m[1]} outside a useMemo/cache/factory — a GPU resource per object is the context-loss bug (${line.trim().slice(0, 80)})`)
  }

  // ── 1b. a MATERIAL factory must never be called per object ─────────────────────────────────
  // Geometry factories are called per mesh by necessity (each chunk has its own vertices, and the
  // caller disposes them). Material factories must not be: a material is a shader program, and one
  // per object is precisely what got the page blocked from WebGL.
  for (const m of src.matchAll(/\b(create\w*Material)\s*\(/g)) {
    const lineNo = src.slice(0, m.index ?? 0).split('\n').length
    const context = lines.slice(Math.max(0, lineNo - 3), lineNo).join('\n')
    const oneShot = /useMemo\(/.test(context) || /^\s*(export\s+)?(const|function)\s/.test(lines[lineNo - 1] ?? '')
    ok(oneShot, `${file}:${lineNo} calls ${m[1]}() outside a useMemo — one shader program per object is the context-loss bug`)
  }

  // ── 2. no CPU churn inside a useFrame body ─────────────────────────────────────────────────
  // Not fatal, but 240 throwaway Vector3 per second is the exact GC pressure the mesher and carver
  // were both rewritten to avoid. Same rule, applied to the frame loop.
  const frameStart = src.indexOf('useFrame(')
  if (frameStart >= 0) {
    // Crude but adequate: from useFrame to the end of the component.
    const body = src.slice(frameStart)
    for (const m of body.matchAll(CPU_CHURN)) {
      const lineNo = src.slice(0, frameStart + (m.index ?? 0)).split('\n').length
      fails.push(`${file}:${lineNo} allocates THREE.${m[1]} inside useFrame — hoist it to a ref (per-frame garbage)`)
    }
    pass++
  }
}

// ── 3. the shared-resource contract is stated where it can be read ────────────────────────────
{
  const vw = readFileSync(join(DIR, 'VoxelWorld.tsx'), 'utf-8')
  ok(/dropGeo/.test(vw) && /dropMats/.test(vw), 'drop rendering shares geometry and caches materials')
  ok(/dropGeo\.dispose\(\)/.test(vw), 'shared drop geometry is released on unmount')
  ok(/material\.dispose\(\)/.test(vw), 'the shared chunk material is released on unmount')
  ok(/webglcontextlost/.test(vw), 'a lost WebGL context is surfaced rather than left as a black screen')
  const bridge = readFileSync(join(DIR, 'mesh-bridge.ts'), 'utf-8')
  ok((bridge.match(/new THREE\.MeshLambertMaterial/g) ?? []).length === 1,
     'the chunk material is constructed in exactly one place')
}

console.log(`\nrender-path audit: ${pass} checks passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) {
  console.log('\n★ Do NOT widen the allowlist to silence this. Share the resource, or cache it by a')
  console.log('  bounded key. A GPU resource per object is what gets a page BLOCKED from WebGL.')
  process.exit(1)
}
console.log('✅ the render path allocates nothing per object')
