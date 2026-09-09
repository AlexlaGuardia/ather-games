// Shader-wiring guard for tex/atlas.ts. Run: npx tsx src/app/shimmer/voxel3d/tex/atlas-wiring.test.ts
//
// ── ★★★ THIS EXISTS BECAUSE EVERY FAILURE IN AN INJECTED SHADER IS SILENT ──────────────────────
// `atlas.ts` builds its material by string-injecting into three's stock Lambert program. Nothing in
// that pipeline fails loudly:
//   · A uniform DECLARED in the GLSL but never registered in `shader.uniforms` reads as ZERO. So a
//     forgotten `shader.uniforms.uReliefAmt` gives a world with relief permanently switched off,
//     compiling perfectly, with no console output — indistinguishable from a relief map too weak
//     to see, which is the reading that gets ACTED ON by turning a dial that does nothing.
//   · An anchor string three has RENAMED makes `mustReplace` throw, which is the good case, and it
//     throws at the first frame rather than in a sweep — so a version bump breaks the game for
//     whoever runs it next, not for whoever did the bump.
//   · A backtick inside the GLSL ends the template literal. SHIMMER_SESSION records this happening
//     twice, caught both times by tsc — which is LUCK: a stray backtick that leaves valid
//     TypeScript ships broken GLSL, and a program that fails to link renders NOTHING with no error.
//     It happened a third time writing the relief block, so the warning-comment is not sufficient.
//
// ⚠ WHAT THIS CANNOT SEE, stated so a green here is not over-read: it does not know whether the
// relief LOOKS right. Whether the tangent frame points the sun the correct way, whether 0.6 is the
// right strength, whether a corner ends up dark twice under render-light — none of that is here.
// This asserts the wiring is connected. `relief.test.ts` asserts the map is correct. The look is
// Alex's, at the keyboard.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '../../../../..')
const atlas = readFileSync(join(ROOT, 'src/app/shimmer/voxel3d/tex/atlas.ts'), 'utf8')
const bridge = readFileSync(join(ROOT, 'src/app/shimmer/voxel3d/mesh-bridge.ts'), 'utf8')
// ★ THE AUTHORITY IS THREE'S OWN SHADER SOURCE, not a remembered chunk list. The whole point of the
// anchor checks is that three renames these between versions; asserting against a list in this file
// would be asserting against the same memory that wrote the injection.
const lambert = readFileSync(
  join(ROOT, 'node_modules/three/src/renderers/shaders/ShaderLib/meshlambert.glsl.js'), 'utf8')

const fails: string[] = []
let pass = 0
const check = (ok: boolean, what: string) => { if (ok) pass++; else fails.push(what) }

/**
 * The GLSL template literals in atlas.ts.
 *
 * ⚠⚠ NAIVELY PAIRING BACKTICKS IS WRONG HERE, AND THE FIRST VERSION OF THIS FILE DID IT. This
 * codebase quotes identifiers in prose the way this sentence quotes `mustReplace` — so the file's
 * JS comments are full of backticks, and pairing them in document order straddles comment and
 * literal, yielding blocks that are half prose and half nothing. Every extraction-based check then
 * reported the wired features as MISSING: seven red asserts about correct code.
 *
 * ★ THAT IS THIS FILE'S OWN SUBJECT ARRIVING THROUGH ITS OWN DOOR — a marker created by documenting
 * a marker — and it is the reason the assert above demands a minimum block count. An extraction
 * that silently finds nothing makes every check below vacuous, and vacuous checks pass.
 *
 * So: scan with a state machine that only treats a backtick as a delimiter when it is not inside a
 * line comment, and only skips a line comment when not already inside a literal.
 */
function scan(src: string): { literals: string[]; code: string } {
  const literals: string[] = []
  let code = '', i = 0, inLiteral = false, start = 0
  while (i < src.length) {
    if (!inLiteral && src[i] === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      i = nl < 0 ? src.length : nl + 1
      continue
    }
    if (!inLiteral && src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end < 0 ? src.length : end + 2
      continue
    }
    if (src[i] === '\\') { i += 2; continue }
    if (src[i] === '`') {
      if (inLiteral) { literals.push(src.slice(start, i)); inLiteral = false; code += '@LIT@' }
      else { inLiteral = true; start = i + 1 }
      i++
      continue
    }
    if (!inLiteral) code += src[i]
    i++
  }
  return { literals, code }
}
const scanned = scan(atlas)
const glslBlocks = scanned.literals.filter(b => /#include|void\s+\w+\s*\(/.test(b))

/**
 * ⚠⚠ CHECKS THAT ASK "DOES THIS STRING APPEAR" MUST ASK IT OF CODE, NOT OF THE FILE. Commenting a
 * line OUT leaves the line's text in the file, so `shader.uniforms.uReliefAmt =` still matches a
 * whole-file regex — and a mutation sweep found exactly that: disabling the uniform registration
 * and disabling the aAo attribute BOTH survived a guard written to catch them. The guard was not
 * wrong about what to look for; it was looking in a document that includes the disabled version.
 */
const atlasCode = scanned.code
const bridgeCode = scan(bridge).code
check(glslBlocks.length >= 4,
  `expected at least 4 GLSL blocks in atlas.ts, found ${glslBlocks.length} — if the injection was ` +
  `restructured this whole file is looking at the wrong thing and every check below is vacuous`)

// ── ① BACKTICK BALANCE ─────────────────────────────────────────────────────────────────────────
// tsc catches the unbalanced case. This catches the BALANCED one — two stray backticks in prose,
// which closes and reopens the literal, leaves valid TypeScript, and silently deletes the GLSL
// between them. That is the version SHIMMER_SESSION warns about and the one nothing else sees.
{
  // Every backtick in the file must be a literal delimiter, i.e. the count is even AND no GLSL
  // block contains a line that looks like prose interrupted by a delimiter.
  const ticks = (atlas.match(/`/g) ?? []).length
  check(ticks % 2 === 0, `atlas.ts has an odd number of backticks (${ticks})`)
  // ★★★ AND THE OBVIOUS CHECK CANNOT SEE THIS BUG, WHICH IS THE WHOLE POINT OF THE BUG.
  // "does any GLSL comment contain a backtick" reads the EXTRACTED blocks — but the stray backtick
  // is what ended the block, so the offending line is not in any block to be found. A mutation
  // putting a balanced backtick pair inside a GLSL comment sailed straight past that check. The
  // scanner and the defect are the same mechanism, so the scanner can never be the witness.
  //
  // What IS visible is the WRECKAGE: a literal that was cut short ends in the middle of a comment
  // line, and the literal count stops matching the number of injection sites. Neither of those is
  // about backticks at all, which is exactly why they survive a bug made of backticks.
  for (const b of glslBlocks) {
    const lines = b.split('\n')
    const last = lines[lines.length - 1]
    check(!/^\s*\/\//.test(last),
      `a GLSL block ENDS in the middle of a comment line, which means a stray backtick closed the ` +
      `template literal early and silently deleted the GLSL after it:\n      ...${last.trim()}`)
  }
  // ★ AND THE CALL SHAPE ITSELF. Every injection is `mustReplace(shaderX, 'anchor', <literal>,
  // 'where')`. Literals are replaced by a sentinel in the scanned code, so a stray backtick that
  // splits one shows up as a call whose third argument is no longer a single literal — the wreckage
  // again, seen from the other side, and it does not depend on the block filter.
  const calls = [...atlasCode.matchAll(/mustReplace\(\s*(\w+)\.(\w+),\s*('[^']*'),\s*([^,]*),/g)]
  check(calls.length >= 6, `expected at least 6 mustReplace call sites, parsed ${calls.length}`)
  for (const [, , , anchor, third] of calls) {
    check(third.trim() === '@LIT@',
      `mustReplace at ${anchor} is not being handed one whole template literal (got "${third.trim()}") ` +
      `— a backtick in prose has split the shader string`)
  }
}

// ── ② EVERY DECLARED UNIFORM IS REGISTERED ────────────────────────────────────────────────────
// The zero-reading failure. A uniform the GLSL declares and the host never assigns is not an error
// anywhere: it is 0, so the feature it gates is off and the dial for it does nothing.
{
  const declared = new Set<string>()
  for (const b of glslBlocks) {
    for (const m of b.matchAll(/^\s*uniform\s+\w+\s+(u\w+)\s*;/gm)) declared.add(m[1])
  }
  check(declared.size > 0, 'found no uniform declarations at all — the extraction is broken')
  for (const u of [...declared].sort()) {
    // Either assigned by name, or merged in wholesale from the shared light uniforms.
    const assigned = new RegExp(`shader\\.uniforms\\.${u}\\s*=`).test(atlasCode)
    const merged = /Object\.assign\(shader\.uniforms,\s*light\)/.test(atlasCode)
    const fromLight = merged && /uLight|uSky|uBlock/.test(u)
    check(assigned || fromLight,
      `GLSL declares uniform ${u} but the host never registers it — it reads as 0 and whatever it ` +
      `gates is silently off`)
  }
  // And the three this session added, named outright: a generic sweep passes if the extraction
  // silently finds nothing, so the features that must be wired are also asserted by name.
  for (const u of ['uAo', 'uRelief', 'uReliefAmt']) {
    check(declared.has(u), `uniform ${u} is not declared in any GLSL block — the feature is not wired`)
  }
}

// ── ③ EVERY VERTEX ATTRIBUTE THE SHADER READS IS ONE THE GEOMETRY CARRIES ─────────────────────
// `aAo` is the live case: the mesher computes AO, and if `toGeometry` does not set the buffer the
// shader reads an undefined attribute. That is a link error on some drivers and garbage on others,
// and this codebase has already shipped one attribute whose producer and consumer disagreed.
{
  const attrs = new Set<string>()
  for (const b of glslBlocks) {
    for (const m of b.matchAll(/^\s*attribute\s+\w+\s+(a\w+)\s*;/gm)) attrs.add(m[1])
  }
  check(attrs.has('aAo'), 'the vertex shader does not declare aAo — the AO term is discarded again')
  for (const a of [...attrs].sort()) {
    check(new RegExp(`setAttribute\\('${a}'`).test(bridgeCode),
      `the shader reads attribute ${a} but mesh-bridge.ts's toGeometry never sets it`)
  }
}

// ── ④ EVERY INJECTION ANCHOR EXISTS IN THREE'S ACTUAL SHADER ──────────────────────────────────
// Upgrades `mustReplace`'s first-frame throw into a sweep failure, so a three bump breaks for the
// person who did the bump.
{
  const anchors = [...atlas.matchAll(/mustReplace\(\s*\n?\s*shader\.(vertex|fragment)Shader,\s*\n?\s*'([^']+)'/g)]
  check(anchors.length >= 4, `found only ${anchors.length} injection anchors — extraction may be stale`)
  for (const [, , anchor] of anchors) {
    check(lambert.includes(anchor),
      `atlas.ts injects at "${anchor}" but three ${'0.183'} 's meshlambert.glsl.js has no such chunk — ` +
      `update the injection rather than shipping a silently untextured world`)
  }
}

// ── ⑤ ★★ THE RELIEF IS PERTURBED BEFORE THE LIGHTING READS IT ─────────────────────────────────
// The assert that would otherwise be a comment saying "I checked the chunk order once". Reads the
// order out of three's own file: the block that WRITES the perturbed normal must sit before the
// chunk that lights with it, or the relief map costs a texture fetch and changes nothing — which
// looks exactly like a strength dial set too low.
{
  const at = (chunk: string) => lambert.indexOf(`#include <${chunk}>`)
  const normalMaps = at('normal_fragment_maps')
  const lit = at('lights_lambert_fragment')
  const colour = at('color_fragment')
  check(normalMaps > 0 && lit > 0 && colour > 0, 'three no longer provides one of the three chunks this relies on')
  check(normalMaps < lit,
    'normal_fragment_maps no longer precedes lights_lambert_fragment in three — the relief is now ' +
    'applied AFTER lighting and does nothing at all')
  check(colour < normalMaps,
    'color_fragment no longer precedes normal_fragment_maps — gTileUv would be read before it is set, ' +
    'so the relief map would be sampled at (0,0) for every fragment in the world')
  // And the handoff itself: gTileUv must be written in the colour block and read in the relief one.
  const colourBlock = glslBlocks.find(b => b.includes('#include <color_fragment>'))
  const reliefBlock = glslBlocks.find(b => b.includes('#include <normal_fragment_maps>'))
  check(!!colourBlock && /gTileUv\s*=/.test(colourBlock), 'the colour block never assigns gTileUv')
  check(!!reliefBlock && /texture\(uRelief,\s*vec3\(gTileUv/.test(reliefBlock),
    'the relief block does not sample uRelief at gTileUv — it is reading some other coordinate')
}

// ── ⑥ ★★ THE LIGHT FIELD STILL GETS THE GEOMETRIC NORMAL, NOT THE BUMPED ONE ──────────────────
// `shimmerLight` steps half a block ALONG the normal to find the air cell in front of the face. Hand
// it a perturbed normal and any textured surface samples a neighbouring column's light — a bug that
// appears only where relief is strong, i.e. exactly where the art is most detailed.
{
  // ⚠ Reads the LITERALS, not the stripped code: this call sits inside a `${...}` interpolation in
  // the shader string, so it is absent from the code half by construction.
  const shaderText = scanned.literals.join('\n')
  check(/lightApply\('finalCol',\s*'diffuseColor\.rgb',\s*'vWorldPos',\s*'cnrm'\)/.test(shaderText),
    "the block program no longer passes 'cnrm' (the geometric normal) to lightApply — a perturbed " +
    'normal there samples the wrong cell of the light field')
  const reliefBlock = glslBlocks.find(b => b.includes('#include <normal_fragment_maps>')) ?? ''
  check(!/cnrm/.test(reliefBlock), 'the relief block writes to cnrm — it must only write `normal`')
}

console.log(`\natlas wiring: ${pass} checks passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ uniforms registered, attributes produced, anchors real, relief lit and not confused with the light field')
