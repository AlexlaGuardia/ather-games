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

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { ALL_BLOCKS } from '../voxel/registry'
import { layerOf, FALLBACK_LAYER, TOP, SIDE, BOTTOM } from './tex/tiles'
import { FLORA_MATERIALS, FLORA_KIND_COUNT, SCATTER_SLOTS_SHARED } from '../voxel/flora'

const DIR = join(process.cwd(), 'src/app/shimmer/voxel3d')

/**
 * ⚠ RECURSIVE, AND THAT WAS A REAL GAP. The first version used a flat `readdirSync`, so it never
 * looked at `tex/` — the texture-array work from the parallel window, which is precisely the kind
 * of code that allocates GPU resources. An audit that silently skips a subdirectory is worse than
 * no audit, because it reports green over unexamined code.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) walk(full, out)
    else if ((e.endsWith('.ts') || e.endsWith('.tsx')) && !e.endsWith('.test.ts')) out.push(full)
  }
  return out
}

/** Things that own GPU memory or a shader program. Constructing these per-object is the bug. */
const GPU_RESOURCE = /new\s+THREE\.(\w*(?:Geometry|Material|Texture|RenderTarget))\b/g

/** Cheap CPU objects — fine to construct, but not in a per-frame loop. */
const CPU_CHURN = /new\s+THREE\.(Vector2|Vector3|Vector4|Quaternion|Matrix4|Color|Box3|Ray)\b/g

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const files = walk(DIR).map(f => relative(DIR, f))
ok(files.length > 0, 'found render-path files to audit')
ok(files.some(f => f.includes('tex')), 'the audit reaches the texture lane (it did not, at first)')

for (const file of files) {
  const raw = readFileSync(join(DIR, file), 'utf-8')
  // ⚠ BLANK comments rather than DELETING them. The first version stripped them outright, which
  // shifted every offset — so the audit reported line 270 for a problem on line 284. A tool that
  // points at the wrong line is worse than no tool. Replacing comment bodies with spaces of equal
  // length keeps every offset identical to the real file while still hiding prose from the scan
  // (this file's own header names the very constructors it bans).
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank)
  const lines = src.split('\n')

  // ── 1. every GPU resource must be constructed somewhere that runs once ──────────────────────
  // Accepted homes: a useMemo/useState initialiser, a module-level const, a factory function whose
  // result is memoised, or an explicit cache keyed by something bounded.
  for (const m of src.matchAll(GPU_RESOURCE)) {
    const idx = m.index ?? 0
    const lineNo = src.slice(0, idx).split('\n').length
    const line = lines[lineNo - 1] ?? ''
    const context = lines.slice(Math.max(0, lineNo - 4), lineNo).join('\n')

    // ── ★ CONTAINMENT, NOT PROXIMITY (2026-08-12) ─────────────────────────────────────────────
    // This asked whether the words `useMemo(` appeared within the previous four lines, which is a
    // guess about distance standing in for the question actually being asked: *are we inside the
    // memo?* It broke the moment a memo returned an object with more than three entries — the
    // Hollow material table (`warden`/`stalker`/`caster`) had its FIRST entry pass and the other
    // two reported as unmemoised GPU allocations. Two false alarms on correct code.
    //
    // That is worse than a missed check. This audit's own header tells the reader not to widen the
    // allowlist when it fails, so a false positive here spends the one thing a lint has — being
    // believed — and the next real finding arrives looking exactly like the noise.
    //
    // So: walk back to the nearest `useMemo(` and count parens forward. If the call has not closed
    // by the time we reach the construction, we are lexically inside it. Same reasoning the factory
    // check below already uses — ask which construct encloses this, do not measure how far away it
    // is. (Parens inside strings or comments could fool the count; for a lint over our own source
    // that trade is fine, and it is strictly better than a line window.)
    const insideMemo = (): boolean => {
      const open = src.lastIndexOf('useMemo(', idx)
      if (open < 0) return false
      let depth = 0
      for (let i = open + 'useMemo'.length; i < idx; i++) {
        const c = src[i]
        if (c === '(') depth++
        else if (c === ')') { depth--; if (depth === 0) return false }
      }
      return depth > 0
    }
    const memoised = insideMemo() || /useMemo\(/.test(context) || /useMemo\(/.test(line)
    // A cache write: `xs.set(key, new THREE.Something(...))` or `x = new THREE...` right before a `.set(`
    const cached = /\.set\(/.test(context) || /\.set\(/.test(lines.slice(lineNo - 1, lineNo + 2).join('\n'))
    // ★ A FACTORY IS LEGITIMATE — the rule moves to its CALL SITES, it is not waived.
    // `createVoxelMaterial()` and `toGeometry()` must construct a resource; that is their job. What
    // matters is that a factory is not CALLED per object. So: allow the construction here, and
    // separately assert every call site is one-shot (see § 1b).
    //
    // ⚠ Find the ENCLOSING function rather than scanning a fixed window. The first version looked
    // back 600 characters, which flagged `createPieceRenderer`'s ghost material simply because that
    // factory is long. Widening the window would have been guessing; taking the nearest preceding
    // `export function` is actually asking which function we are inside. `make`/`create`/`build`/`to`
    // are all the same shape — the verb is not the point.
    // Export is NOT part of what makes something a factory — a local helper that builds and returns
    // a resource is if anything MORE bounded than an exported one. What matters is the shape: a
    // function whose job is to construct and hand back.
    const before = src.slice(0, idx)
    const lastFn = Math.max(before.lastIndexOf('\nexport function '), before.lastIndexOf('\nfunction '))
    const enclosing = lastFn < 0 ? '' : before.slice(lastFn, lastFn + 120)
    const inFactory = /function\s+(create|make|build|to)[A-Z]/.test(enclosing)

    ok(memoised || cached || inFactory,
      `${file}:${lineNo} constructs THREE.${m[1]} outside a useMemo/cache/factory — a GPU resource per object is the context-loss bug (${line.trim().slice(0, 80)})`)
  }

  // ── 1b. a MATERIAL factory must never be called per object ─────────────────────────────────
  // Geometry factories are called per mesh by necessity (each chunk has its own vertices, and the
  // caller disposes them). Material factories must not be: a material is a shader program, and one
  // per object is precisely what got the page blocked from WebGL.
  // Materials AND textures: both are expensive GPU objects whose factories must be called once.
  // (Geometry factories are exempt — each chunk genuinely owns its vertices and the caller disposes.)
  for (const m of src.matchAll(/\b((?:create|make|build)\w*(?:Material|Texture|Array))\s*\(/g)) {
    const lineNo = src.slice(0, m.index ?? 0).split('\n').length
    const context = lines.slice(Math.max(0, lineNo - 3), lineNo).join('\n')
    const near = lines.slice(Math.max(0, lineNo - 6), lineNo + 1).join('\n')
    const oneShot = /useMemo\(/.test(near) || /^\s*(export\s+)?(const|function)\s/.test(lines[lineNo - 1] ?? '')
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
  // Two constructions since tier-1 water: the opaque chunk material and the ONE shared water
  // material (the world's single transparent pass). Both live in exported factories; the checks
  // below pin that VoxelWorld holds each as a shared instance (useMemo) and releases both. What
  // this bound still catches is the real killer: a third construction sneaking in per-chunk or
  // per-object.
  ok((bridge.match(/new THREE\.MeshLambertMaterial/g) ?? []).length === 2,
     'materials are constructed in exactly two places: the chunk pass and the water pass')
  ok(/const waterMaterial = useMemo\(/.test(vw), 'the water material is a shared instance, not per-mesh')
  ok(/waterMaterial\.dispose\(\)/.test(vw), 'the shared water material is released on unmount')

  // ── ★★ THE CEILING, AND THE HALF OF IT THAT IS EASY TO LOSE (2026-08-21) ────────────────────
  // Water had no `side` at all, so it inherited FrontSide and a surface quad — whose front face
  // points UP — was simply not drawn from below. Underwater there was no ceiling to swim toward.
  // DoubleSide fixes that and, on its own, ALSO un-culls the rims, which puts translucent panels
  // back inside every body of water: the exact "walls of water" removed the day before. The two
  // lines are one mechanism, so they are asserted together — deleting the discard while keeping
  // DoubleSide is a silent regression of the older fix, and it looks like a cleanup.
  ok(/side: THREE\.DoubleSide/.test(bridge.slice(bridge.indexOf('createWaterMaterial'))),
     'the water sheet is visible from below (DoubleSide)')
  ok(/if \(!gl_FrontFacing && vVoxNormal\.y < 0\.5\) discard;/.test(bridge),
     'and only the SHEET is — rims keep front-only culling, or the walls of water come back')
  // The underside must not re-apply the depth ramp: vDepth measures the column BENEATH the sheet,
  // which is not between you and it once you are under. Without this a deep basin's ceiling lands
  // near-opaque and reads as a painted lid with no sky behind it.
  ok(/if \(!gl_FrontFacing\) \{\s*\n\s*diffuseColor\.a = /.test(bridge),
     'the underside keeps base translucency instead of depth-attenuating twice')
}

// ── ★ EVERY MATERIAL IN THE ATLAS HAS A PAINTER (2026-08-13, the sawmill) ───────────────────────
// `paintFor`'s switch DEFAULTS TO THE ORE ARTIST, so a material listed in TILE_MATERIALS with no
// painter of its own ships as a magenta crystal in host rock. That has happened twice — every tree
// once rendered as crystal, and the ground-cover icons — and tiles.ts says the second was "caught
// by looking at `scripts/icon-sheet.mts`, not by any test". FOUR ⚠ comments in that file now warn
// about it, which is what a missing test looks like written down four times. This is the test.
//
// THE MODEL, stated because getting it wrong makes this cry wolf: a material is covered if it has a
// `case`, OR it is wood/leaf/sapling (the default branch dispatches those on LOG_SET/LEAF_SET/
// SAPLING_SET), OR it is an actual ORE — for which `writeOre` is the correct painter, not a fallback.
// So only a bare `MAT.` entry with no case is an orphan. That is precisely the shape a new station,
// block or fitting arrives in.
//
// ⚠ TWO EARLIER VERSIONS OF THIS CHECK WERE GREEN AND WRONG. The first matched only `MAT.` while the
// list also carries `ORE.` and `WOOD.`, so it audited 20 of 35 and reported a clean sweep. The second
// demanded a `case` for everything and flagged all 15 ore and wood entries, which are correct as they
// are. A parser-based oracle needs BOTH a count guard (am I seeing the whole list) and a model of
// what legitimately differs — without the first it under-reports, without the second it cries wolf.
{
  const src = readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/tex/tiles.ts'), 'utf8')
  const listed = /export const TILE_MATERIALS: number\[\] = \[([\s\S]*?)\n\]/.exec(src)
  const painterAt = src.indexOf('export function paintFor')
  if (!listed || painterAt < 0) {
    fails.push('render-audit cannot find TILE_MATERIALS or paintFor — this check has gone blind, fix it')
  } else {
    const entries = [...listed[1].matchAll(/(MAT|ORE|WOOD)\.([A-Z0-9_]+)/g)].map(m => ({ ns: m[1], name: m[2] }))
    const cased = new Set([...src.slice(painterAt).matchAll(/case (?:MAT|ORE|WOOD)\.([A-Z0-9_]+)/g)].map(m => m[1]))

    // The count guard. The atlas has been ~35 materials for months; if this parse ever collapses,
    // the regex has drifted and every assert below is auditing a subset it silently chose.
    if (entries.length < 30) {
      fails.push(`TILE_MATERIALS parsed as only ${entries.length} materials — the regex has drifted and this check is no longer auditing the atlas`)
    } else pass++

    const orphans = entries
      .filter(e => e.ns === 'MAT' && !e.name.startsWith('SAPLING_') && !cased.has(e.name))
      .map(e => e.name)
    if (orphans.length) {
      fails.push(`in TILE_MATERIALS but NO case in paintFor — ships as a magenta ore block: ${orphans.join(', ')}`)
    } else pass++
  }
}

// ── ★★★ THE OTHER DOOR: A MATERIAL THAT SHOULD BE IN THE ATLAS AND IS NOT (2026-08-22) ─────────
//
// The check above watches "listed in TILE_MATERIALS but no painter". NOTHING watched "should be
// listed and isn't", and that is where three blocks were quietly shipping as the magenta
// checkerboard on the day this was written:
//
//   · the GARDEN BED, added 08-22 — never seen, because the same day's craft-surface bug meant
//     nobody could craft one. Two bugs hiding each other.
//   · the FOUR SAPLINGS, added 08-13 and untextured for nine days. `paintFor`'s default branch has
//     dispatched SAPLING_SET to paintLeaves the whole time — but paintFor only ever runs for
//     materials in TILE_MATERIALS, so the branch was dead code. Confirmed in-world by Alex.
//   · CONJURED MATTER, added 08-14, whose own design note says a temporary wall has to LOOK
//     temporary or it reads as a bug every time.
//
// ⚠ A GUARD WITH ONE DOOR IS AN EXEMPTION NOBODY WROTE DOWN. `attrs.ts` even carried a comment
// claiming its four sapling colour lines were what stopped a sapling rendering as the checker. They
// were not, and could not be — the colour is a MULTIPLIER over the tile, and there was no tile.
// Prose cannot check anything.
{
  // ⚠ THE ONE LEGITIMATE EXEMPTION, AND IT IS DERIVED. Ground cover is a different PIPELINE — the
  // instanced flora renderer with its own textures — so a flora material correctly has no atlas
  // slot. Imported from `flora.ts` rather than restated here, and counted below, because an
  // exemption that a reader has to trust is the shape of Friday's bug.
  const orphans = new Map<number, string>()
  for (const b of ALL_BLOCKS) {
    if (FLORA_MATERIALS.has(b.material) || orphans.has(b.material)) continue
    if ([TOP, SIDE, BOTTOM].every(f => layerOf(b.material, f) !== FALLBACK_LAYER)) continue
    orphans.set(b.material, b.name)
  }
  if (orphans.size) {
    fails.push('registry block with NO atlas slot — samples the magenta checker in world: '
      + [...orphans.entries()].map(([m, n]) => `${n} (mat ${m})`).join(', '))
  } else pass++

  // The blindness guard, same reasoning as the count guard above: if the registry walk ever stops
  // seeing blocks, the assert passes by looking at nothing.
  if (ALL_BLOCKS.length < 60) {
    fails.push(`registry parsed as only ${ALL_BLOCKS.length} blocks — this atlas check has gone blind`)
  } else pass++

  // ...and the exemption must not be silently widening. FLORA_MATERIALS is a list of literals
  // because the kind→material mapping lives in `plantMaterialAt`'s branches; FLORA_KIND_COUNT
  // counts the same thing off the enums. Two derivations compared, so adding a flora kind fails
  // HERE — on the event — rather than later, as something rendering wrong.
  if (FLORA_MATERIALS.size !== FLORA_KIND_COUNT) {
    fails.push(`the flora exemption lists ${FLORA_MATERIALS.size} materials but the kind enums imply `
      + `${FLORA_KIND_COUNT} — a flora kind was added without a line in FLORA_MATERIALS, so the `
      + `atlas exemption above is now wider than anyone decided`)
  } else pass++

  // The two kind enums must keep sharing their scatter slots — if one grows alone the count above
  // is comparing two things that have stopped describing the same space.
  if (!SCATTER_SLOTS_SHARED) {
    fails.push('FLORA and SCATTER no longer share ROCK/DEADFALL/MUSHROOM — FLORA_KIND_COUNT is '
      + 'counting a slot space that has split in two')
  } else pass++

  // And it must actually EXEMPT something, or the whole check passes by exempting nothing and the
  // orphan list would be full of grass.
  if (FLORA_MATERIALS.size === 0) fails.push('the flora exemption is empty — it is not exempting anything')
  else pass++
}

console.log(`\nrender-path audit: ${pass} checks passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) {
  console.log('\n★ Do NOT widen the allowlist to silence this. Share the resource, or cache it by a')
  console.log('  bounded key. A GPU resource per object is what gets a page BLOCKED from WebGL.')
  process.exit(1)
}
console.log('✅ the render path allocates nothing per object')
