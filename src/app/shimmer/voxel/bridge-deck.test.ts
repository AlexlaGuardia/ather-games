// Run: npx tsx src/app/shimmer/voxel/bridge-deck.test.ts
//
// ★ THE POINT OF THIS FILE IS THE SWEEP AT THE BOTTOM: the world may not hand out anything you
// are supposed to CRAFT.
//
// The bridges generated `MAT.PLANKS` from 2026-08-08. On 2026-08-13 that id stopped being "a
// plank block" and became PLANKING — the crafted wooden wall, the third rung of Alex's building
// grammar ("you build with what you MADE, not what you dug"). Nobody moved the bridges, so for
// two days the world went on stamping the crafted material into the ground along the one road
// every player walks. Measured on the default seed: 1902 free planking, ~951 logs, ~127 goldwoods,
// breakable by hand with no tool.
//
// Every function involved was correct the whole time. The registry row was right, the recipe was
// right, the worldgen was right about where a bridge goes. The hole only exists in the JOIN — and
// a join is exactly what no unit test was looking at. Hence the sweep: it asks the generator what
// it emits and asks the recipe table what it sells, and fails if those two sets ever touch again.

import { materialAt, MAT } from './depth'
import { columnHeight, waterSurfaceAt } from './height'
import { Column, generateColumn, SECTION } from './column'
import { STORY_NODES, roadAt, WAYSTONE_CELLS } from './story-path'
import { BLOCKS, ALL_BLOCKS, blockDef, materialForItem, canBreak } from './registry'
import { RECIPE_OUTPUTS } from './recipes'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const SEED = 1

/** Every column within the road corridor, walked once. The bridges live here and nowhere else. */
function* corridor(band = 6): Generator<[number, number]> {
  const seen = new Set<string>()
  for (let i = 0; i < STORY_NODES.length - 1; i++) {
    const a = STORY_NODES[i], b = STORY_NODES[i + 1]
    const dx = b.x - a.x, dz = b.z - a.z
    const steps = Math.ceil(Math.hypot(dx, dz))
    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(a.x + (dx * s) / steps)
      const cz = Math.round(a.z + (dz * s) / steps)
      for (let ox = -band; ox <= band; ox++) for (let oz = -band; oz <= band; oz++) {
        const x = cx + ox, z = cz + oz
        const key = `${x},${z}`
        if (seen.has(key)) continue
        seen.add(key)
        yield [x, z]
      }
    }
  }
}

// ── the deck block itself ─────────────────────────────────────────────────────
console.log('bridge deck')
{
  const deck = blockDef(MAT.DECK)
  check('MAT.DECK is registered', !!deck)
  check('the deck pays NOTHING', deck!.drops.length === 0,
    'a drop of any kind re-opens the hole this material exists to close')
  check('the deck is not placeable', deck!.placeable === false)

  // ★ THE CLAIM THE COMMENT MAKES, ASSERTED: it breaks, it just does not pay. `hardness: Infinity`
  // would close the hole harder and was rejected — an identical-looking plank that breaks when you
  // placed it and refuses when the world did reads as a bug, and registry.ts's own `breakSeconds`
  // note says a block that was never going to break is the worst version of the mechanic.
  check('the deck still breaks by hand', canBreak(MAT.DECK, 0, null),
    'if this ever fails, someone gave the deck a hardness and turned a design choice into a wall')

  // `BY_ITEM` only reverses placeable blocks that drop something, so a deck voxel must be
  // unreachable from every direction: no drop to carry, and no item that resolves back to it.
  check('no item resolves to a deck voxel', materialForItem('deck') === undefined)
  const reversible = ALL_BLOCKS.filter(b => materialForItem(b.drops[0]?.itemId ?? '') === MAT.DECK)
  check('nothing at all reverses into DECK', reversible.length === 0,
    reversible.map(b => b.name).join(', '))
}

// ── the bridges, as the generator actually builds them ────────────────────────
console.log('\nthe spine')
{
  let deckCells = 0, plankCells = 0, bridgeCols = 0
  for (const [x, z] of corridor()) {
    if (!roadAt(x, z, SEED)) continue
    const h = columnHeight(x, z, SEED)
    const table = Math.floor(waterSurfaceAt(x, z, SEED))
    let onBridge = false
    for (let y = Math.max(1, Math.floor(h) - 2); y <= table + 2; y++) {
      const m = materialAt(x, y, z, SEED, h)
      if (m === MAT.DECK) { deckCells++; onBridge = true }
      if (m === MAT.PLANKS) plankCells++
    }
    if (onBridge) bridgeCols++
  }

  // The bridges must still EXIST — the fix was never "delete the crossings". If this number goes
  // to zero the road fords every river and the whole 2026-08-08 bridge pass is silently undone.
  check('the spine still has bridges', bridgeCols > 0, `${bridgeCols} bridge columns`)
  check('bridges are built of deck', deckCells > 0, `${deckCells} deck voxels`)

  // ★ THE REGRESSION ASSERT. This is the measurement from the top of the file, driven to zero.
  check('the world generates ZERO planking', plankCells === 0,
    `${plankCells} crafted-wall voxels on the road — this was 1902 before 2026-08-15`)
}

// ── ★ THE SWEEP: the world may not sell what the bench sells ──────────────────
//
// Generalised from the bug rather than written to it. Sampling the generator (rather than reading
// the worldgen source) means it catches the NEXT crafted block someone stamps into terrain, in a
// file this test has never heard of.
console.log('\nsweep: generated materials vs the recipe table')
{
  // ★ THIS SWEEPS FINISHED COLUMNS, NOT `materialAt`, AND THE DIFFERENCE IS THE WHOLE POINT.
  // The first version of this test asked the depth rule what it emits — and the depth rule is one
  // pass of several. Trees, ore, ruins and the road's WAYSTONES are planted by later stages
  // straight into the sections, exactly as `Column.extra`'s own note says. Sweeping `materialAt`
  // therefore reported that no lantern is generated anywhere, which is false, and it would have
  // been just as blind to the next crafted block planted by a stage rather than a depth branch.
  // `generateColumn` is the real generator; ask IT.
  const emitted = new Set<number>()
  const sweepColumn = (wx: number, wz: number) => {
    const col = generateColumn(new Column(wx, wz), SEED)
    for (let y = 0; y < col.sections.length * SECTION; y++)
      for (let z = 0; z < SECTION; z++)
        for (let x = 0; x < SECTION; x++) emitted.add(col.get(x, y, z) & 0xFF)
  }

  // Columns are 16x16 and generating them is not free, so this samples rather than carpets: the
  // waystone-bearing stretch of the spine, a hold, and ordinary country off the road.
  const waystones = [...WAYSTONE_CELLS].slice(0, 40).map(k => k.split(',').map(Number) as [number, number])
  const seenCols = new Set<string>()
  for (const [wx, wz] of waystones) {
    const cx = Math.floor(wx / SECTION) * SECTION, cz = Math.floor(wz / SECTION) * SECTION
    const key = `${cx},${cz}`
    if (seenCols.has(key)) continue
    seenCols.add(key)
    sweepColumn(cx, cz)
  }
  // Ordinary country near the glade — terrain, ore, trees, flora.
  for (let cx = -176; cx <= -80; cx += SECTION) for (let cz = -704; cz <= -608; cz += SECTION) sweepColumn(cx, cz)
  emitted.delete(MAT.AIR)

  // ★ THE ONE ARGUED EXEMPTION, and it is argued rather than assumed.
  //
  // `MAT.MANA_LANTERN` is generated (the road's waystones, the hold gates) and drops the same
  // `mana_lantern` the bench makes 4 of, so it is the same SHAPE as the bridge bug. It is
  // deliberately not fixed with it, on scale and on kind:
  //   · 56 waystone columns across the whole ~5km spine, against 1902 planking in the crossings
  //     you are forced to walk over. Two orders of magnitude apart.
  //   · A lantern is a LANDMARK you find, not bulk structural material — closer to a chest's
  //     contents than to a wall. Prying up 56 of them across five kilometres is a scavenger hunt,
  //     not an economy.
  // ⚠ It is a real finding either way and it is Alex's call, not mine — flagged, not buried. If he
  // rules that the waystones should pay nothing either, delete this entry and the sweep enforces
  // it with no other change.
  const EXEMPT = new Map<number, string>([
    [MAT.MANA_LANTERN, 'waystones + hold gates: 56 on the spine, a landmark not a material — Alex to rule'],
  ])

  const offenders: string[] = []
  for (const mat of emitted) {
    if (EXEMPT.has(mat)) continue
    const def = blockDef(mat)
    if (!def) continue
    for (const d of def.drops) {
      if (RECIPE_OUTPUTS.has(d.itemId)) offenders.push(`${def.name} drops ${d.itemId}`)
    }
  }
  check('no generated block drops a crafted item', offenders.length === 0, offenders.join(' · '))

  // The exemptions must stay HONEST: an entry that no longer describes a generated block is a
  // stale excuse, and a stale excuse is how a real offender hides behind a comment.
  for (const [mat, why] of EXEMPT) {
    check(`exemption still applies: ${blockDef(mat)?.name ?? mat}`, emitted.has(mat), `${why} (no longer generated?)`)
  }

  // And the sweep must actually be LOOKING at something — a corridor that stopped emitting would
  // make every assert above pass by vacuum.
  check('the sweep saw a real world', emitted.size > 8, `${emitted.size} distinct materials`)
  check('the sweep saw the bridges', emitted.has(MAT.DECK))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
