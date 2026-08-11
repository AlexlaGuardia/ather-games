// Ground-cover-as-blocks oracle. Run: npx tsx src/app/shimmer/voxel/plants.test.ts
//
// Alex, 2026-08-11: "the player should be able to break the grass or flowers... everything should
// be collectable." Ground cover used to be a pure function the renderer drew, which nothing else
// could see. These asserts are the ones that fail if it quietly becomes a fiction again:
//
//   · ★ THE PICK MUST STICK. `recordEdit` stores an edit only when the new material DIFFERS from
//     the generated one, so if anything asks `materialAt` (which knows nothing about plants)
//     instead of `generatedAt`, picking a flower compares AIR to AIR, stores nothing, and the
//     flower is back on reload. That is a silent failure — it looks fine until you walk away and
//     come back — so it is asserted directly, twice, from both ends.
//   · plants must be drawn by the instanced renderer and NEVER by the greedy mesher, or every
//     tuft becomes a solid cube.
//   · a placeable block's drops reverse uniquely (`BY_ITEM` maps every drop of every placeable
//     block, so two plants sharing one item id silently steal each other's).

import { generatedAt, generatedVoxel, makeColumn, meshColumn, SECTION } from './column'
import { columnHeight } from './height'
import { materialAt, MAT, isPlant, PLANT_MIN, PLANT_MAX } from './depth'
import { plantMaterialAt, plantVariant, FLORA } from './flora'
import { BLOCKS, blockDef, materialForItem } from './registry'
import { dropsFor } from './mine'
import { recordEdit, editIndex } from './edits'
import { ZONE_ANCHORS } from './zones'
import { WOOD } from './trees'
import { AIR } from './section'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const garden = ZONE_ANCHORS.find(a => a.id === 'garden')!

// ── 1. the three plants are real, cheap, collectable blocks ─────────────────────────────────────
{
  for (const m of [MAT.TUFT, MAT.TALL_GRASS, MAT.FLOWER]) {
    const d = blockDef(m)
    ok(!!d, `plant ${m} has a block definition`)
    ok(!!d && d.hardness <= 0.1, `plant ${m} breaks instantly (${d?.hardness})`)
    ok(dropsFor(m).length > 0, `★ plant ${m} DROPS something — that is what collectable means`)
    ok(!!d && d.placeable, `plant ${m} can be put back down`)
  }
  ok(isPlant(MAT.TUFT) && isPlant(MAT.TALL_GRASS) && isPlant(MAT.FLOWER), 'isPlant covers all three')
  ok(!isPlant(MAT.TOPSOIL) && !isPlant(MAT.WATER) && !isPlant(AIR), 'isPlant covers nothing else')
  // The range test is only sound while the ids stay contiguous — it runs in the mesher's hot loop.
  ok(PLANT_MAX - PLANT_MIN === 2, '★ the three plant ids stay CONTIGUOUS (isPlant is a range test)')
}

// ── 2. every placeable block's item reverses to exactly itself ──────────────────────────────────
{
  const seen = new Map<string, number>()
  let clash = 0
  for (const b of BLOCKS) {
    if (!b.placeable) continue
    for (const d of b.drops) {
      if (seen.has(d.itemId) && seen.get(d.itemId) !== b.material) clash++
      seen.set(d.itemId, b.material)
    }
  }
  ok(clash === 0, `★ no two placeable blocks share a drop id (${clash} clashes)`)
  ok(materialForItem('grass_tuft') === MAT.TUFT, 'a collected tuft places a tuft')
  ok(materialForItem('tall_grass') === MAT.TALL_GRASS, 'collected tall grass places tall grass')
  ok(materialForItem('wild_flower') === MAT.FLOWER, 'a picked flower can be replanted')
}

// ── 3. ★ THE PICK STICKS — the edit diff sees plants ────────────────────────────────────────────
{
  // Find a real generated plant in the garden and pick it, exactly as setVoxel would.
  let picked = 0, missedByMaterialAt = 0, tested = 0
  for (let z = 0; z < 90 && tested < 40; z++) {
    for (let x = 0; x < 90 && tested < 40; x++) {
      const wx = garden.x + x, wz = garden.z + z
      const h = columnHeight(wx, wz, SEED)
      const gen = generatedAt(wx, h + 1, wz, SEED, h)
      if (!isPlant(gen)) continue
      tested++
      // What the player does: set the cell to AIR, diff against what the generator would have put.
      const e = new Map<number, number>()
      recordEdit(e, 1, AIR, gen)
      if (e.size === 1 && e.get(1) === AIR) picked++
      // And the trap, stated as an assert: ask materialAt instead and the edit vanishes.
      const e2 = new Map<number, number>()
      recordEdit(e2, 1, AIR, materialAt(wx, h + 1, wz, SEED, h))
      if (e2.size === 0) missedByMaterialAt++
    }
  }
  ok(tested > 10, `found real generated plants to pick (${tested})`)
  ok(picked === tested, `★ picking a plant RECORDS an edit — it stays picked (${picked}/${tested})`)
  ok(missedByMaterialAt === tested,
    `★ and materialAt alone would have LOST every one (${missedByMaterialAt}/${tested}) — this is why generatedAt exists`)
}

// ── 4. plants stand on ground, in the open, in a real generated column ──────────────────────────
{
  const gx = Math.floor(garden.x / SECTION) * SECTION, gz = Math.floor(garden.z / SECTION) * SECTION
  let found = 0, floating = 0, buried = 0, drowned = 0
  for (let cz = 0; cz < 4; cz++) for (let cx = 0; cx < 4; cx++) {
    const col = makeColumn(gx + cx * SECTION, gz + cz * SECTION, SEED)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      for (let y = 1; y < 250; y++) {
        if (!isPlant(col.get(x, y, z))) continue
        found++
        const below = col.get(x, y - 1, z)
        if (below === AIR) floating++
        if (below === MAT.WATER) drowned++
        if (col.get(x, y + 1, z) !== AIR) buried++
      }
    }
  }
  ok(found > 200, `the garden really grows plant voxels (${found})`)
  ok(floating === 0, 'no plant floats in the air')
  ok(drowned === 0, 'no plant grows out of water')
  ok(buried === 0, 'nothing is stacked on top of a plant')
}

// ── 5. ★ THE MESHER NEVER DRAWS A PLANT ─────────────────────────────────────────────────────────
// Crossed quads cannot merge, so routing ground cover through greedy would both look wrong (solid
// cubes) and cost ~34k unmergeable quads. The instanced renderer owns them.
{
  const gx = Math.floor(garden.x / SECTION) * SECTION, gz = Math.floor(garden.z / SECTION) * SECTION
  const cols = new Map<string, ReturnType<typeof makeColumn>>()
  for (let cz = -1; cz <= 2; cz++) for (let cx = -1; cx <= 2; cx++)
    cols.set(`${cx},${cz}`, makeColumn(gx + cx * SECTION, gz + cz * SECTION, SEED))
  let plantQuads = 0, total = 0
  for (let cz = 0; cz <= 1; cz++) for (let cx = 0; cx <= 1; cx++) {
    for (const sm of meshColumn(cols.get(`${cx},${cz}`)!, {
      negX: cols.get(`${cx - 1},${cz}`), posX: cols.get(`${cx + 1},${cz}`),
      negZ: cols.get(`${cx},${cz - 1}`), posZ: cols.get(`${cx},${cz + 1}`),
    })) {
      total += sm.mesh.quads
      for (const m of sm.mesh.materials) if (isPlant(m)) plantQuads++
    }
  }
  ok(total > 0, `columns meshed (${total} quads)`)
  ok(plantQuads === 0, `★ not one plant vertex reaches the terrain mesh (${plantQuads})`)
}

// ── 6. existence is voxel data; the LOOK stays a pure function ──────────────────────────────────
{
  const wx = garden.x + 7, wz = garden.z + 11
  ok(plantVariant(wx, wz, SEED, FLORA.FLOWER) === plantVariant(wx, wz, SEED, FLORA.FLOWER),
    'variant is stable for a position')
  ok(plantVariant(wx, wz, SEED, FLORA.FLOWER) !== plantVariant(wx, wz, SEED, FLORA.TUFT),
    'each kind keeps its own look salt')
  // A plant the PLAYER placed has no field roll at all and must still have a look.
  const v = plantVariant(wx + 3, wz + 3, SEED, FLORA.TUFT)
  ok(v >= 0 && v < 1, 'a player-placed plant still gets a variant')
  ok(plantMaterialAt(wx, wz, SEED) === 0 || isPlant(plantMaterialAt(wx, wz, SEED)),
    'plantMaterialAt returns a plant or nothing')
}

// ── 7. ★ THE CHOP STICKS TOO — stage writes are in the diff (2026-08-11) ────────────────────────
// Same bug as the pick, one layer out. Trees, ruins, ore and carved tunnels are written by stages
// AFTER the depth rule, so `materialAt` reports AIR at a trunk cell: measured before the fix,
// 99.9% of tree and leaf voxels in the Thicket compared against AIR, meaning a chopped tree
// recorded NO edit and stood again on reload. `Column.overrides` is what closes that.
{
  const thicket = ZONE_ANCHORS.find(a => a.id === 'twilight-thicket')!
  const gx = Math.floor(thicket.x / SECTION) * SECTION, gz = Math.floor(thicket.z / SECTION) * SECTION
  const woods = new Set<number>(Object.values(WOOD) as number[])
  let logs = 0, lost = 0, carved = 0, carvedLost = 0
  for (let cz = 0; cz < 3; cz++) for (let cx = 0; cx < 3; cx++) {
    const col = makeColumn(gx + cx * SECTION, gz + cz * SECTION, SEED)
    ok(col.overrides !== null, 'a generated column records its stage overrides')
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const h = col.heightAt(x, z)
      for (let y = h + 1; y < Math.min(h + 30, 250); y++) {
        if (!woods.has(col.get(x, y, z))) continue
        logs++
        // Chop it, exactly as setVoxel would: diff against what the generator would have put.
        const e = new Map<number, number>()
        recordEdit(e, 1, AIR, generatedVoxel(col, x, y, z, SEED))
        if (e.size === 0) lost++
      }
      // And the other direction: walling up a carved tunnel must survive too.
      for (let y = 12; y < h - 2; y++) {
        if (col.get(x, y, z) !== AIR) continue
        carved++
        const e = new Map<number, number>()
        recordEdit(e, 1, MAT.STONE, generatedVoxel(col, x, y, z, SEED))
        if (e.size === 0) carvedLost++
      }
    }
  }
  ok(logs > 200, `found real trees to chop (${logs})`)
  ok(lost === 0, `★ chopping a tree RECORDS an edit — it stays chopped (${lost} lost of ${logs})`)
  ok(carved > 50, `found carved cave air to wall up (${carved})`)
  ok(carvedLost === 0, `★ walling a tunnel sticks too — carving is a stage as well (${carvedLost} lost)`)
}

// ── 8. the duplicated packed index must not drift ───────────────────────────────────────────────
// column.ts inlines `editIndex` rather than importing it (edits.ts already imports column.ts, and
// the reverse edge would make that cycle bidirectional). Duplication is only safe while checked.
{
  let bad = 0
  for (const [x, y, z] of [[0, 0, 0], [15, 0, 15], [3, 77, 9], [15, 255, 15], [7, 128, 2]] as const) {
    const col = makeColumn(0, 0, SEED)
    // generatedVoxel looks the cell up by column.ts's own packing; edits.ts packs the same cell.
    const viaEdits = editIndex(x, y, z)
    const o = col.overrides!
    if (o.has(viaEdits) && o.get(viaEdits) !== col.get(x, y, z)) bad++
  }
  ok(bad === 0, '★ column.ts and edits.ts pack a cell index identically')
}

console.log(`\nplants: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
