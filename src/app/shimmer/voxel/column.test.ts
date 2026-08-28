// Column oracle. Run: npx tsx src/app/shimmer/voxel/column.test.ts
//
// This layer's bugs are the invisible-geometry class: a glass pane between every pair of sections,
// a wall at every column edge, or a skip that drops a face nobody notices until they walk into it.
// All three look like "the renderer is broken" and none of them show in a material census.

import { AIR } from './section'
import { MAT } from './depth'
import { SEAM } from './seams'
import { Column, Stage, SECTION, makeColumn, generateColumn, meshColumn, refreshUniform, DEFAULT_COLUMN } from './column'
import { createMeshScratch } from './greedy'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const C = DEFAULT_COLUMN
const scratch = createMeshScratch(SECTION)

// ── 1. staged generation is resumable and lands in the same place ────────────────────────────
// Without a persisted stage, "resume" and "run again" are indistinguishable and ore gets placed
// twice. This is the assertion that keeps that true.
{
  const whole = makeColumn(512, 768, SEED)
  const stepped = new Column(512, 768, C)
  for (const s of [Stage.Terrain, Stage.PreSeams, Stage.Carved, Stage.PostSeams, Stage.Ready]) generateColumn(stepped, SEED, C, s)
  let diff = 0
  for (let i = 0; i < whole.sections.length; i++)
    for (let k = 0; k < whole.sections[i].data.length; k++)
      if (whole.sections[i].data[k] !== stepped.sections[i].data[k]) diff++
  ok(diff === 0, `stage-by-stage generation equals one-shot generation (${diff} voxels differ)`)
  ok(stepped.stage === Stage.Ready, 'the column reports Ready')

  // Re-running a completed stage must be a no-op, not a second application.
  const before = whole.sections.map(s => Uint16Array.from(s.data))
  generateColumn(whole, SEED, C, Stage.Ready)
  let redo = 0
  for (let i = 0; i < before.length; i++) for (let k = 0; k < before[i].length; k++)
    if (before[i][k] !== whole.sections[i].data[k]) redo++
  ok(redo === 0, `re-running a Ready column changes nothing (${redo} voxels differ)`)
}

// ── 2. order independence — the property the pull model buys ─────────────────────────────────
{
  const a = makeColumn(512, 768, SEED)
  makeColumn(-9999, 4444, SEED); makeColumn(64, 64, SEED)
  const b = makeColumn(512, 768, SEED)
  let diff = 0
  for (let i = 0; i < a.sections.length; i++) for (let k = 0; k < a.sections[i].data.length; k++)
    if (a.sections[i].data[k] !== b.sections[i].data[k]) diff++
  ok(diff === 0, 'a column generates identically regardless of what was generated before it')
}

// ── 3. the column is a real world, not an empty one ──────────────────────────────────────────
{
  const col = makeColumn(512, 768, SEED)
  const seen = new Set<number>()
  for (const s of col.sections) for (const v of s.data) seen.add(v)
  ok(seen.has(MAT.PACKED_CLOUD), 'the column has a cloud floor')
  ok(seen.has(MAT.STONE) || seen.has(MAT.DEEP_STONE), 'the column has rock')
  ok(seen.has(AIR), 'the column has sky')
  ok(seen.has(SEAM.RAW_MANA), 'the column has ore')
  let bad = 0
  for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
    const h = col.heightAt(x, z)
    if (h < 1 || h >= C.worldHeight) bad++
    if (col.get(x, 0, z) !== MAT.PACKED_CLOUD) bad++
  }
  ok(bad === 0, 'cached surface heights are sane and the cloud floor survives the pipeline')
}

// ── 4. ★ NO GLASS PANES BETWEEN SECTIONS ─────────────────────────────────────────────────────
// The failure this test exists for: meshing each section against "outside is air" puts a floor and
// a ceiling between every pair, i.e. sixteen invisible panes through every column. Deep underground
// a column is solid rock, so a correct mesher emits NOTHING there.
{
  // ⚠ Searched across many columns on purpose. A single column often has NO uniformly-solid section
  // at all — ore spans y16..156 at 26 attempts per chunk and carvers cut through, so deep rock is
  // rarely one material. Asserting on one column failed here and the code was right.
  let checked = 0, panes = 0
  for (let c = 0; c < 24 && checked < 6; c++) {
    const col = makeColumn((c * 197) % 2000, (c * 331) % 2000, SEED)
    const byIndex = new Map(meshColumn(col, {}, scratch).map(m => [m.index, m]))
    for (let i = 1; i < col.sections.length - 1; i++) {
      const u = col.uniform[i]
      if (u === -1 || u === AIR) continue
      if (col.uniform[i - 1] !== u || col.uniform[i + 1] !== u) continue
      checked++
      // Uniform, matching vertical neighbours, but NO horizontal neighbours supplied — so the only
      // faces allowed are the four side walls. A top or bottom face here is a pane.
      const m = byIndex.get(i)
      if (!m) continue
      for (let q = 0; q < m.mesh.quads; q++) if (m.mesh.normals[q * 12 + 1] !== 0) panes++
    }
  }
  ok(checked > 0, `found solid sections with solid vertical neighbours to check (${checked})`)
  ok(panes === 0, `★ no horizontal face is emitted between stacked solid sections (${panes} panes)`)
}

// ── 5. ★ neighbour columns close the seam ────────────────────────────────────────────────────
// Without neighbours a column is walled at its edges — correct for the edge of loaded world, wrong
// between two loaded columns. Supplying them must strictly REDUCE geometry.
{
  const mid = makeColumn(512, 768, SEED)
  const negX = makeColumn(512 - SECTION, 768, SEED)
  const posX = makeColumn(512 + SECTION, 768, SEED)
  const negZ = makeColumn(512, 768 - SECTION, SEED)
  const posZ = makeColumn(512, 768 + SECTION, SEED)

  // ★ ABSENT NEIGHBOUR = OPAQUE, so meshing ALONE draws NO frontier walls. The relationship is the
  // reverse of what it was: supplying neighbours can only ADD the genuine faces at a real cliff
  // edge, never remove a wall — because the wall is no longer drawn in the first place.
  const alone = meshColumn(mid, {}, scratch).reduce((a, m) => a + m.mesh.quads, 0)
  const joined = meshColumn(mid, { negX, posX, negZ, posZ }, scratch).reduce((a, m) => a + m.mesh.quads, 0)
  ok(alone > 0, 'a lone column still has its own surface geometry')
  ok(joined >= alone, `★ neighbours never ADD a frontier wall (alone ${alone} ≤ joined ${joined})`)

  // The decisive one, and the first version of it was WRONG: counting every deep vertical face
  // counts CAVE walls, which are legitimate geometry. A frontier wall is specifically a face lying
  // ON the column's outer boundary plane — local x=0/16 or z=0/16. That is the grey cliff.
  const frontierFaces = (nb: Parameters<typeof meshColumn>[1]) => meshColumn(mid, nb, scratch)
    .reduce((a, m) => { let c = 0
      for (let q = 0; q < m.mesh.quads; q++) {
        const o = q * 12
        if (m.mesh.normals[o + 1] !== 0) continue                    // horizontal face, not a wall
        if (m.mesh.positions[o + 1] + m.wy > 140) continue           // near the surface, may be real
        const xs = [m.mesh.positions[o], m.mesh.positions[o + 3], m.mesh.positions[o + 6], m.mesh.positions[o + 9]]
        const zs = [m.mesh.positions[o + 2], m.mesh.positions[o + 5], m.mesh.positions[o + 8], m.mesh.positions[o + 11]]
        const onX = xs.every(v => v === 0) || xs.every(v => v === SECTION)
        const onZ = zs.every(v => v === 0) || zs.every(v => v === SECTION)
        if (onX || onZ) c++
      }
      return a + c }, 0)
  ok(frontierFaces({}) === 0, `★ a lone column draws NO wall on its outer boundary (${frontierFaces({})} faces) — this is the grey-cliff bug`)
}

// ── 6. the uniform skip must not eat real geometry ───────────────────────────────────────────
// Compare a meshing run against one with the skip defeated (uniform table cleared). The visible
// result must be identical — a skip that drops a face is a hole you only find by walking into it.
{
  const col = makeColumn(512, 768, SEED)
  const negX = makeColumn(512 - SECTION, 768, SEED)
  const posX = makeColumn(512 + SECTION, 768, SEED)
  const nb = { negX, posX }

  const withSkip = meshColumn(col, nb, scratch).reduce((a, m) => a + m.mesh.quads, 0)
  const saved = Int32Array.from(col.uniform)
  col.uniform.fill(-1)                      // defeat the skip: every section is meshed the long way
  const noSkip = meshColumn(col, nb, scratch).reduce((a, m) => a + m.mesh.quads, 0)
  col.uniform.set(saved)
  ok(withSkip === noSkip, `★ the uniform skip is output-identical (${withSkip} vs ${noSkip} quads)`)
  ok(saved.some(v => v !== -1), 'some sections really are uniform, so the skip was exercised')
}

// ── 7. refreshUniform tells the truth ────────────────────────────────────────────────────────
{
  const col = makeColumn(512, 768, SEED)
  let wrong = 0
  for (let i = 0; i < col.sections.length; i++) {
    const claimed = col.uniform[i]
    const actual = col.sections[i].uniformValue()
    if ((actual ?? -1) !== claimed) wrong++
  }
  ok(wrong === 0, 'the uniform table matches the sections it describes')
  // And it must be refreshed after a mutation, or the skip starts lying.
  col.sections[2].set(0, 0, 0, MAT.STONE)
  refreshUniform(col)
  ok(col.uniform[2] === -1 || col.sections[2].uniformValue() !== null, 'refreshUniform reflects a mutation')
}

// ── 8. sky sections are free ─────────────────────────────────────────────────────────────────
{
  const col = makeColumn(512, 768, SEED)
  const meshes = meshColumn(col, {}, scratch)
  const top = col.sections.length - 1
  ok(col.uniform[top] === AIR, 'the topmost section is pure sky')
  ok(!meshes.some(m => m.index === top), 'a pure-sky section emits no mesh at all')
}

// ── ★★★ THE WORKER SENDS VOXELS, NOT COLUMNS — SO TEST THE COLUMN THE HOST ACTUALLY BUILDS ─────
// This oracle, and every other one, reaches a Column through `generateColumn`. The GAME does not:
// the worker generates, posts raw voxels, and `VoxelWorld` builds a FRESH `Column` and refills it.
// Anything derived that is not rebuilt there is silently absent in the real game while every test
// stays green. That already happened once to the slump mask (its warning is in the adoption code),
// and it happened again to the sloped water surface, which was 100% inert on prod for an hour with
// 166 asserts passing. So the fixture below is the ADOPTED shape, not the generated one.
{
  const SEED = 1337
  const wx = 672, wz = 160          // a river column: known water, outside the plot bubble
  const gen = generateColumn(new Column(wx, wz), SEED)
  // Exactly what the host does: fresh Column, voxels copied in, nothing else carried over.
  const adopted = new Column(wx, wz)
  for (let i = 0; i < gen.sections.length; i++) adopted.sections[i].data.set(gen.sections[i].data)
  refreshUniform(adopted)

  const verticalWater = (col: Column) => {
    let n = 0
    for (const sm of meshColumn(col, {})) {
      const m = sm.mesh
      for (let q = 0; q < m.positions.length / 12; q++) {
        if (m.materials[q * 4] !== MAT.WATER) continue
        if (Math.abs(m.normals[q * 12 + 1]) > 0.5) continue
        n++
      }
    }
    return n
  }
  // A column with NO seed at all is the worst case: it must still suppress walls, because `tops`
  // is derived from cells and needs no seed. Only the SLOPE needs the table.
  const bare = verticalWater(adopted)
  const stamped = (() => { adopted.genSeed = SEED; return verticalWater(adopted) })()
  ok(bare === stamped,
    `an adopted column suppresses water walls with or without a seed (${bare} vs ${stamped}) — the fail-soft half must not depend on the stamp`)

  adopted.genSeed = SEED
  let sunk = 0, flat = 0
  for (const sm of meshColumn(adopted, {})) {
    const m = sm.mesh
    for (let q = 0; q < m.positions.length / 12; q++) {
      if (m.materials[q * 4] !== MAT.WATER || Math.sign(m.normals[q * 12 + 1]) !== 1) continue
      const y = m.positions[q * 12 + 1]
      if (Math.abs(y - Math.round(y)) > 1e-9) sunk++; else flat++
    }
  }
  ok(sunk > 0, `a SEED-STAMPED adopted column gets the sloped sheet (${sunk} sunk, ${flat} flat) — this is the assert that was missing when the feature shipped inert`)
}

console.log(`\ncolumn layer: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ columns assemble and mesh without seams')
