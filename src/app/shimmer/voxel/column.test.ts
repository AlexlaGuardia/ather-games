// Column oracle. Run: npx tsx src/app/shimmer/voxel/column.test.ts
//
// This layer's bugs are the invisible-geometry class: a glass pane between every pair of sections,
// a wall at every column edge, or a skip that drops a face nobody notices until they walk into it.
// All three look like "the renderer is broken" and none of them show in a material census.

import { AIR } from './section'
import { MAT } from './depth'
import { ORE } from './ore'
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
  for (const s of [Stage.Terrain, Stage.PreOre, Stage.Carved, Stage.PostOre, Stage.Ready]) generateColumn(stepped, SEED, C, s)
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
  ok(seen.has(MAT.BEDROCK), 'the column has bedrock')
  ok(seen.has(MAT.STONE) || seen.has(MAT.DEEP_STONE), 'the column has rock')
  ok(seen.has(AIR), 'the column has sky')
  ok(seen.has(ORE.RAW_MANA), 'the column has ore')
  let bad = 0
  for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
    const h = col.heightAt(x, z)
    if (h < 1 || h >= C.worldHeight) bad++
    if (col.get(x, 0, z) !== MAT.BEDROCK) bad++
  }
  ok(bad === 0, 'cached surface heights are sane and bedrock survives the pipeline')
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

  const alone = meshColumn(mid, {}, scratch).reduce((a, m) => a + m.mesh.quads, 0)
  const joined = meshColumn(mid, { negX, posX, negZ, posZ }, scratch).reduce((a, m) => a + m.mesh.quads, 0)
  ok(joined < alone, `★ supplying neighbours removes the edge walls (${alone} → ${joined} quads)`)
  ok(joined > 0, 'the column still has geometry once seams are closed')

  // And the reduction must come from the SIDES, not from dropped interior faces.
  const sideQuads = (nb: Parameters<typeof meshColumn>[1]) => meshColumn(mid, nb, scratch)
    .reduce((a, m) => { let c = 0
      for (let q = 0; q < m.mesh.quads; q++) if (m.mesh.normals[q * 12 + 1] === 0) c++
      return a + c }, 0)
  ok(sideQuads({ negX, posX, negZ, posZ }) < sideQuads({}), 'the removed faces are side faces')
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

console.log(`\ncolumn layer: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ columns assemble and mesh without seams')
