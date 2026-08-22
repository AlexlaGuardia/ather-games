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
import { materialAt, MAT, isPlant, isSapling, isSolid, SOLID_EXCEPT, PLANT_MIN, PLANT_MAX } from './depth'
import { isLeafMat } from './trees'
import { AIR } from './section'
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
// ── ★ THE SAMPLE SITE MOVED OFF THE `garden` ANCHOR (2026-08-15, the bubble wiring) ─────────────
// It used to be `garden` (0,0), and every assert below passed there for months. That anchor IS the
// Home Plot (canon `shimmer-geography.md`: *"Home Plot (`garden`) — the player's own plot"*), and
// the plot is now its own coordinate space inside a cloud bubble: the Wilds no longer generates
// ground there at all, by design. So the old site stopped growing plants because it stopped being
// ground — the test was correct and its LOCATION had expired.
//
// ⚠ Every assert here is about plants, not about a place, so the fix is to sample somewhere that is
// still country. The glade is the right one: `tended: 1` like the garden was, it is where the
// keeper wakes up, and at 657 blocks out it is comfortably clear of the shell.
const garden = ZONE_ANCHORS.find(a => a.id === 'moonwell-glade')!

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
  // Only the IDENTITY drop reverses — a bonus drop is loot, not a block you can place.
  const seen = new Map<string, number>()
  let clash = 0
  for (const b of BLOCKS) {
    if (!b.placeable || !b.drops[0] || b.drops[0].chance !== undefined) continue
    const d = b.drops[0]
    if (seen.has(d.itemId) && seen.get(d.itemId) !== b.material) clash++
    seen.set(d.itemId, b.material)
  }
  ok(clash === 0, `★ no two placeable blocks share an identity drop (${clash} clashes)`)
  // ★ A Mana Seed pays out a SPIRIT. It must never be placeable as the grass it came from.
  ok(materialForItem('mana_seed') === undefined, '★ a bonus drop is loot, never a placeable block')
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
  let found = 0, floating = 0, buried = 0, drowned = 0, shaded = 0
  for (let cz = 0; cz < 4; cz++) for (let cx = 0; cx < 4; cx++) {
    const col = makeColumn(gx + cx * SECTION, gz + cz * SECTION, SEED)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      for (let y = 1; y < 250; y++) {
        if (!isPlant(col.get(x, y, z))) continue
        found++
        const below = col.get(x, y - 1, z)
        if (below === AIR) floating++
        if (below === MAT.WATER) drowned++
        // ⚠ FOLIAGE ABOVE A PLANT IS LEGAL; TERRAIN ABOVE ONE IS NOT. See the note on `buried`.
        const up = col.get(x, y + 1, z)
        if (up !== AIR && !isLeafMat(up)) buried++
        if (isLeafMat(up)) shaded++
      }
    }
  }
  ok(found > 200, `the garden really grows plant voxels (${found})`)
  ok(floating === 0, 'no plant floats in the air')
  ok(drowned === 0, 'no plant grows out of water')
  // ── ★ THIS ASSERT WAS RELAXED ON 2026-08-13 AND THE REASON MATTERS ────────────────────────
  // It read `col.get(x, y + 1, z) !== AIR`, i.e. NOTHING may sit above ground cover. That was true
  // and unremarkable while every canopy floated well clear of the floor. The lobed crown hangs
  // satellite lobes BELOW the main one — deliberately, it is the whole fix for "trees look like a
  // pole with a ball on it" — so foliage now reaches down to grass height and 2 of 658 plants ended
  // up under a leaf.
  //
  // ⚠ I am the author of the change that broke this, so the relaxation deserves suspicion. The
  // defence is that a leaf over a tuft is a tuft in dappled shade, which is a thing forests do,
  // while a STONE over a tuft is ground cover buried by terrain — the failure the assert was
  // actually written to catch. So the hazard is asserted at zero and the harmless case is measured
  // and BOUNDED, rather than the whole check being deleted. If canopies ever drape so low that
  // this rate climbs, this goes red and someone gets to re-litigate it.
  ok(buried === 0, `★ no plant is buried under terrain (${buried})`)
  ok(shaded / found < 0.05, `foliage over ground cover stays incidental (${shaded}/${found})`)
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

// ── ★★★ PASSABILITY IS DERIVED, AND THIS IS WHAT KEEPS IT DERIVED ─────────────────────────────
// `SOLID_EXCEPT` used to write every passable id out by hand under a comment warning that it is a
// membership test, not a range, so `isPlant` gaining a span does NOT reach it. That comment was
// correct and it was load-bearing three separate times — herbs (08-18), scatter (08-19), and the
// seven wild crops were about to make it four. The Set is built by ASKING `isPlant`/`isSapling`
// now, so a new span reaches passability by construction.
//
// ⚠ THE FAILURE THIS PREVENTS IS SPECIFIC AND SILENT: a plant you can SEE THROUGH and WALK INTO.
// Nothing throws, nothing renders wrong, and the only report is a player saying the world feels
// sticky — on a RIVER or a SHORE it is a chest-high invisible fence along the waterline.
//
// ★ ASSERTED AS A BICONDITIONAL over every base id, not as a list of the ids we happen to have.
// A one-way check ("every plant is passable") would pass a Set that had quietly gained a solid
// block, and that is the other direction of the same bug: a wall you can walk through.
{
  let wrong = 0, checked = 0
  for (let m = 0; m <= 0xFF; m++) {
    const shouldPass = isPlant(m) || isSapling(m)
    if (!shouldPass) continue
    checked++
    if (isSolid(m)) { wrong++; if (wrong <= 3) console.log(`    ✗ ${m} is a plant and SOLID — invisible wall`) }
  }
  ok(checked >= 18, `the sweep actually found the plant spans (${checked} ids)`)
  ok(wrong === 0, `★ every id answering isPlant/isSapling is passable (${wrong} invisible walls in ${checked})`)
  // And the other direction: nothing that is NOT ground cover may have slipped into the Set.
  const strays = [...SOLID_EXCEPT].filter(m => m !== AIR && m !== MAT.WATER && !isPlant(m) && !isSapling(m))
  ok(strays.length === 0, `★ nothing but plants, saplings, air and water is passable (strays: ${strays.join(',')})`)
  // The seven wild crops specifically — the span that was about to be the fourth hand-edit.
  const crops = [MAT.MOONVINE, MAT.STARBEAN, MAT.CRYSTALCAP, MAT.DREAMROOT, MAT.SHIMMERBLOOM, MAT.ATHERWHEAT, MAT.DAWNCAP]
  ok(crops.every(m => !isSolid(m) && isPlant(m)),
    '★ the seven wild crops are passable and cross-quad WITHOUT being named in any passability list')
}

console.log(`\nplants: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
