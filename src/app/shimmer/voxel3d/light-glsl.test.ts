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
import { LIGHT_DECL_GLSL, LIGHT_LOOK, lightApply, lightApplyHere, createLightUniforms } from './light-glsl'

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

  // ★ THE CARTOON-STACK SURFACES SAMPLE THROUGH `cartoon-glsl.ts` (extracted 2026-09-13, when the
  // pieces became the third consumer). Their file names the STACK call and the combined decl;
  // the stack module is then checked ONCE below for the `lightApply('finalCol'` it carries — so a
  // consumer that stops running the stack goes red on its own row, and a stack that stops
  // sampling goes red on the module's row. Water and leaves still call the field directly.
  const surfaces: [string, string, string, string][] = [
    ['blocks (flat)', 'mesh-bridge.ts', 'cartoonStackGlsl(', 'CARTOON_DECL_GLSL'],
    ['blocks (textured)', join('tex', 'atlas.ts'), 'cartoonStackGlsl(', 'CARTOON_DECL_GLSL'],
    ['pieces', 'piece-mesh.ts', 'cartoonStackGlsl(', 'CARTOON_DECL_GLSL'],
    ['the cartoon stack', 'cartoon-glsl.ts', "lightApply('finalCol'", 'LIGHT_DECL_GLSL'],
    ['water', 'mesh-bridge.ts', "lightApply('waterCol'", 'LIGHT_DECL_GLSL'],
    // ⚠ The leaf program left VoxelWorld for `tex/leaf-material.ts` on 09-17 (leaves per wood) and
    // this row kept pointing at the host for a day: three reds that were the guard, not the leaves.
    ['leaves', join('tex', 'leaf-material.ts'), "lightApplyHere('leafCol'", 'LIGHT_DECL_GLSL'],
  ]
  for (const [what, file, call, decl] of surfaces) {
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
    ok(src.includes(decl),
      `§4 ★★★ ${what} declares the light uniforms (${decl}) — and the import of that name does not count`)
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
    ['pieces', 'createPieceRenderer('],
  ] as const) {
    const args = argsOf(host.slice(host.indexOf('useMemo')), head)
    ok(args !== null, `§4 the host still constructs ${what} — otherwise this row is pointed at nothing`)
    ok(!!args && args.includes('lightUniforms'),
      `§4 ★★ the host passes its one uniform set to ${what} (args: ${args?.trim() ?? 'NOT FOUND'})`)
  }
  // The leaf factory takes the same set: the host passes `lightUniforms` in, the factory assigns it.
  const leafSrc = readFileSync(join(here, 'tex', 'leaf-material.ts'), 'utf8')
  ok(/Object\.assign\(shader\.uniforms, lightUniforms\)/.test(leafSrc),
    '§4 ★ the leaf program is given them too — inside its factory (tex/leaf-material.ts)')
  const leafArgs = argsOf(host.slice(host.indexOf('useMemo')), 'createLeafMaterial(')
  ok(!!leafArgs && leafArgs.includes('lightUniforms'),
    `§4 ★★ the host passes its one uniform set to leaves (args: ${leafArgs?.trim() ?? 'NOT FOUND'})`)
}

// ── §5 the lit window (2026-09-14) ─────────────────────────────────────────────────────────────
// A pane's glow is the BLOCK channel of the cell one step AWAY from the viewer, through the pane's
// own colour, gated by the hour. Each clause below is a way the feature could be present in the
// tree and absent from the picture — the first headless shot of it was exactly that (a ring that
// never filled), so the asserts are on the shape of the GLSL and the wiring, not on prose.
{
  const g = LIGHT_DECL_GLSL
  ok(g.includes('vec3 shimmerFieldAt(vec3 cell)'), '§5 the raw field reader exists — one decode, two readers')
  ok(/vec3 shimmerLightCell\(vec3 col, vec3 albedo, vec3 cell\) \{\s*vec3 f = shimmerFieldAt\(cell\);/.test(g),
    '§5 ★ the shading path reads the field THROUGH the shared reader, not a second copy of the decode')
  ok(g.includes('vec3 shimmerPaneGlow(vec3 tint, vec3 wpos, vec3 nrm, bool front)'), '§5 the pane glow entry point exists')
  ok(g.includes('vec3 away = front ? -nrm : nrm;'),
    '§5 ★★ the sampled cell is AWAY from the viewer — front face steps minus the normal, back face plus (a window lit by the yard would be the wrong room)')
  ok(/shimmerFieldAt\(floor\(wpos \+ away\) \+ 0\.5\)/.test(g), '§5 ★ one whole cell along that direction, at the cell centre')
  ok(/float night = clamp\(1\.0 - dot\(uHourLight, W\), 0\.0, 1\.0\);/.test(g),
    '§5 ★★ gated by the HOUR (1 − the rig\'s luminance) — a lantern behind glass at noon must add nothing')
  ok(/return tint \* uPaneGlow \* pow\(f\.y, uBlockCurve\) \* night \* f\.z;/.test(g),
    '§5 ★★★ the shipped formula: tint × gain × block^curve × night × ring weight (a probe left in here rendered every pane magenta)')
  ok(!/PROBE/.test(g), '§5 ★ no debug probe left in the shipped GLSL')
  ok(g.includes('uniform float uPaneGlow;'), '§5 the gain is a declared uniform')
  const u = createLightUniforms()
  ok(u.uPaneGlow.value === LIGHT_LOOK.paneGlow && LIGHT_LOOK.paneGlow > 0,
    `§5 ★ the uniform starts at the dial (${u.uPaneGlow.value} vs ${LIGHT_LOOK.paneGlow}) — 0 would ship a feature that never shows`)
  // The consumer: the pane's CUTOUT program calls it with the tile colour and gl_FrontFacing, and
  // feeds the result to the stack as its emissive; the solid piece program feeds vec3(0.0).
  const pm = readFileSync(join(new URL('.', import.meta.url).pathname, 'piece-mesh.ts'), 'utf8')
  ok(pm.includes("opts.cutout ? '    paneGlow = shimmerPaneGlow(tile.rgb, vPWPos, vPWNorm, gl_FrontFacing);' : ''"),
    '§5 ★★ the cutout (pane) program calls the glow with the TILE colour, the world position/normal and gl_FrontFacing')
  // 2026-09-15: a third variant joined — the station models' EMISSIVE program (`emissive: true`,
  // per-vertex glow × tile alpha, the block program's own rule). The plain solid piece program still
  // emits nothing; the pane still emits its glow. Three arms, each named.
  ok(pm.includes("cartoonStackGlsl('vPWNorm', 'vPWPos', opts.cutout ? 'paneGlow' : opts.emissive ? 'diffuseColor.rgb * vPEmissive * gPieceTileA' : 'vec3(0.0)')"),
    '§5 ★★ the glow is the pane program\'s EMISSIVE (added after the field, so the yard\'s night cannot darken the room\'s lamp); the model program emits its parts\' glow × tile alpha; the plain solid program emits nothing')
  ok(/^vec3 paneGlow = vec3\(0\.0\);$/m.test(pm), '§5 paneGlow is declared before the tile block, so the solid program still compiles')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the shader string is checkable after all — ${pass} passed`)
