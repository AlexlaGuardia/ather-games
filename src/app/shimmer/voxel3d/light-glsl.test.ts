// The GLSL snippet is a STRING, and TypeScript is the only thing checking it.
// Run: npx tsx src/app/shimmer/voxel3d/light-glsl.test.ts
//
// ── ⚠⚠⚠ A BACKTICK IN A COMMENT ENDS THE TEMPLATE LITERAL, AND I DID IT THREE TIMES ────────────
// Quoting an identifier in prose is a habit, `LIGHT_DECL_GLSL` is a template literal, and the two
// meet badly. All three times tsc caught it — which is LUCK, not protection: a stray backtick that
// happens to leave valid TypeScript behind ships broken GLSL, and a program that fails to LINK
// renders nothing at all with no error in the console. The second time I wrote a warning onto the
// string itself. The third time I walked past my own warning inside the hour.
//
// So the guard is structural rather than a reminder. It also asserts the two entry points exist and
// that every uniform the snippet READS is one the snippet DECLARES — a typo in a uniform name is
// the other silent GLSL failure, and it compiles.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIGHT_DECL_GLSL, lightApply, lightApplyHere, createLightUniforms } from './light-glsl'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── §1 the thing that keeps happening ────────────────────────────────────────────────────────
ok(!LIGHT_DECL_GLSL.includes('`'),
  `§1 ★★★ NO BACKTICK anywhere in the GLSL — it would have ended the literal (found ${
    (LIGHT_DECL_GLSL.match(/`/g) ?? []).length})`)
ok(LIGHT_DECL_GLSL.includes('precision highp sampler3D'),
  '§1 ★★ the 3D sampler has an explicit precision — GLSL ES 3.0 gives it no default and the program FAILS TO LINK without one, which renders nothing with no console error')

// ── §2 both entry points exist, and the call-site builders name them ─────────────────────────
for (const fn of ['shimmerLightCell', 'shimmerLight', 'shimmerLightHere']) {
  ok(LIGHT_DECL_GLSL.includes(`vec3 ${fn}(`), `§2 ${fn} is defined`)
}
ok(lightApply('c', 'a', 'w', 'n').includes('shimmerLight(c, a, w, n)'), '§2 lightApply calls the face form')
ok(lightApplyHere('c', 'a', 'w').includes('shimmerLightHere(c, a, w)'), '§2 lightApplyHere calls the cell form')
// ⚠ The two must not collapse into one. A cross-quad stepping along its normal lights differently
// from the front and the back, because DoubleSide flips it halfway through the surface.
ok(!lightApplyHere('c', 'a', 'w').includes('shimmerLight(c'),
  '§2 ★★ and the cell form is NOT the face form — a cross-quad must not step along its normal')

// ── §3 every uniform read is a uniform declared ──────────────────────────────────────────────
// ★ A typo in a uniform name COMPILES. three creates the uniform, nothing writes it, and the
// value is silently 0 — for uLightMix that is the whole feature off, forever, looking exactly
// like a feature that has not warmed up yet.
{
  const declared = new Set([...LIGHT_DECL_GLSL.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map(m => m[1]))
  const used = new Set([...LIGHT_DECL_GLSL.matchAll(/\b(u[A-Z]\w*)\b/g)].map(m => m[1]))
  const undeclared = [...used].filter(u => !declared.has(u))
  ok(undeclared.length === 0, `§3 ★★ every uniform the GLSL reads is declared in it (${undeclared.join(', ') || 'none'})`)
  ok(declared.size >= 8, `§3 the scan found ${declared.size} uniforms — under 8 means it has lost its subject`)

  // And every declared uniform is one the host actually creates, or it is dead and reads 0.
  const host = new Set(Object.keys(createLightUniforms()))
  const missing = [...declared].filter(d => !host.has(d))
  ok(missing.length === 0,
    `§3 ★★★ and every one of them is created by createLightUniforms — a name the host does not ` +
    `write is silently 0, which for uLightMix is the entire feature off (${missing.join(', ') || 'none'})`)
}

// ── §4 every program that draws world geometry samples the field ─────────────────────────────
// ★★★ THE FIRST RENDER-LIGHT DEPLOY SHIPPED WITH TWO PROGRAMS LEFT OUT, and nothing could see it.
// Blocks sampled the field, leaves and water did not, so a flooded cave rendered at noon while the
// rock around it was black, and the UNDERSIDE of a closed canopy was as bright as its top over the
// darkest ground in the world. Every assert in the tree stayed green because each one was about a
// module that was working. ⚠ This is the producer/consumer shape: a guard on the field says nothing
// about who reads it.
//
// ⚠⚠ AND THE FIRST VERSION OF THIS SECTION WAS TOO COARSE IN BOTH DIRECTIONS, caught by mutating
// it rather than by reading it. It asked "does this FILE call lightApply" — and `mesh-bridge.ts`
// holds TWO materials, so deleting water's call left the block material's call satisfying the
// check. And it asked "does the water LINE mention lightUniforms" — which the useMemo dependency
// array on that same line answers, whatever the call does. Both mutations passed clean. Each
// surface now names the exact call it must make, and the call site is read by BALANCED PARENS so a
// dep array cannot stand in for an argument.
{
  const here = new URL('.', import.meta.url).pathname
  /** The argument list of `head`, scanned with balanced parens — not a `[^)]*` regex, which cannot
   *  cross the `)` in a nested call and goes red against correct code. */
  const argsOf = (src: string, head: string): string | null => {
    const i = src.indexOf(head)
    if (i < 0) return null
    let depth = 0
    for (let j = i + head.length - 1; j < src.length; j++) {
      if (src[j] === '(') depth++
      else if (src[j] === ')') { if (--depth === 0) return src.slice(i + head.length, j) }
    }
    return null
  }

  const surfaces: [string, string, string][] = [
    ['blocks (flat)', 'mesh-bridge.ts', "lightApply('finalCol'"],
    ['blocks (textured)', join('tex', 'atlas.ts'), "lightApply('finalCol'"],
    ['water', 'mesh-bridge.ts', "lightApply('waterCol'"],
    ['leaves', 'VoxelWorld.tsx', "lightApplyHere('leafCol'"],
  ]
  for (const [what, file, call] of surfaces) {
    let raw = ''
    try { raw = readFileSync(join(here, file), 'utf8') } catch { /* reported below */ }
    // ⚠⚠ IMPORT LINES ARE STRIPPED, and skipping that let a mutation through. Deleting the
    // `LIGHT_DECL_GLSL` interpolation from a shader still leaves the IMPORT of that name in the
    // file, so a bare `includes` is answered by the line that merely names the thing. Same shape as
    // the adoption counter that read 24 because a guard's asserts mentioned the classes.
    const src = raw.split('\n').filter(l => !/^\s*import\s/.test(l)).join('\n')
    // ⚠ BLIND CHECK FIRST. A path that stops resolving would make every assert below pass by
    // finding nothing, which is this file's own subject.
    ok(src.length > 500, `§4 ★★ ${file} was READ (${src.length} bytes) — an unreadable file passes every check below`)
    ok(src.includes('LIGHT_DECL_GLSL'),
      `§4 ★★★ ${what} declares the light uniforms — and the import of that name does not count`)
    ok(src.includes(call),
      `§4 ★★★ ${what} actually SAMPLES the field — and it is named per surface, because two ` +
      `materials share mesh-bridge.ts and a file-wide check is satisfied by the other one`)
  }

  // And the host hands every one of them the SAME uniform objects, or the ring centre is written
  // to one program and not the others and half the world lights a column behind.
  const host = readFileSync(join(here, 'VoxelWorld.tsx'), 'utf8')
  for (const [what, head] of [
    ['blocks (flat)', 'createVoxelMaterial('],
    ['blocks (textured)', 'createTexturedVoxelMaterial('],
    ['water', 'createWaterMaterial('],
  ] as const) {
    const args = argsOf(host.slice(host.indexOf('useMemo')), head)
    ok(args !== null, `§4 the host still constructs ${what} — otherwise this row is pointed at nothing`)
    ok(!!args && args.includes('lightUniforms'),
      `§4 ★★ the host passes its one uniform set to ${what} (args: ${args?.trim() ?? 'NOT FOUND'})`)
  }
  ok(/Object\.assign\(shader\.uniforms, lightUniforms\)/.test(host),
    '§4 ★ the leaf program is given them too — it is built inline rather than by a factory')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the shader string is checkable after all — ${pass} passed`)
