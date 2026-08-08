// Piece oracle. Run: npx tsx src/app/shimmer/voxel/pieces.test.ts
//
// Placement fails in ways that only show up once someone has built something: a rotation that drifts
// the origin so a wall walks sideways as you turn it, a doorway you cannot walk through, a piece
// that overwrote the wall you put up a minute ago. All cheap to assert, all miserable to discover.

import { AIR } from './section'
import { MAT } from './depth'
import {
  PIECES, STRUCTURE, pieceDef, rotatedSize, rotateCell, cellsOf, canPlace, canAfford, placementAt,
  type Placement, type Rotation,
} from './pieces'
import { blockDef, materialForItem } from './registry'
import { RECIPE_OUTPUTS } from './recipes'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const air = () => AIR
const solid = () => MAT.STONE

// ── 1. the catalogue is counted, and floors/walls are NOT in it ──────────────────────────────
{
  // Was pinned at six until the loop proved out. Seven with the fence (2026-08-08, the pieces
  // pass), eight with the half slab (same day — it shipped WITH its fractional collision, never
  // before it). The count stays asserted so catalogue growth is always a DECISION that edits
  // this line, never a drift.
  ok(PIECES.length === 8, `the catalogue is eight pieces, deliberately (${PIECES.length})`)
  const ids = PIECES.map(p => p.id)
  ok(!ids.includes('wall') && !ids.includes('floor'),
     '★ walls and floors are BLOCKS, not pieces — that split is the whole design')
  ok(new Set(ids).size === ids.length, 'piece ids are unique')
  ok(PIECES.every(p => p.cost.length > 0), 'every piece costs something')
}

// ── 2. costs use ids the player can actually OBTAIN ──────────────────────────────────────────
// A cost naming an item nothing yields is a piece nobody can ever build.
//
// ⚠ WIDENED 2026-08-07: this used to check block drops alone, which was right while every material
// came straight off a block. Logs now drop LOGS and planks are refined (`recipes.ts`), so raw drops
// are no longer the whole vocabulary — obtainable = what you mine, plus what you can make from it.
// The narrow version failed the moment refining landed, which is the test doing its job; widening
// it to "obtainable" rather than deleting it keeps the invariant that matters. The same sweep lives
// in recipes.test.ts and covers the tool ladder too.
{
  const droppable = new Set<string>()
  for (const b of [...Array(64).keys()].map(blockDef).filter(Boolean))
    for (const d of b!.drops) droppable.add(d.itemId)
  const obtainable = new Set([...droppable, ...RECIPE_OUTPUTS])
  const missing = PIECES.flatMap(p => p.cost.map(c => c.itemId)).filter(i => !obtainable.has(i))
  ok(missing.length === 0, `every piece cost is obtainable (missing: ${[...new Set(missing)].join(',')})`)
}

// ── 3. ★ rotation must not drift the origin ──────────────────────────────────────────────────
// The classic bug: rotating a piece moves it a block sideways, so turning it in the ghost makes it
// crawl across the ground. Four rotations must return to where they started.
{
  const def = pieceDef('doorway')!
  let drift = 0
  for (const rot of [0, 1, 2, 3] as Rotation[]) {
    const cells = cellsOf({ pieceId: 'doorway', x: 10, y: 20, z: 30, rot }, def)
    ok(cells.length === def.w * def.h * def.d, `rotation ${rot} occupies the same cell COUNT`)
    // A 1-wide piece must not move at all under rotation.
    for (const c of cells) if (c.x !== 10 || c.z !== 30) drift++
  }
  ok(drift === 0, '★ a 1x1 footprint does not drift under any rotation')

  // And a non-square footprint swaps extents rather than growing.
  const wide = { id: 't', name: 't', w: 3, h: 1, d: 1, cost: [] }
  ok(rotatedSize(wide, 0).w === 3 && rotatedSize(wide, 0).d === 1, 'rot 0 keeps w x d')
  ok(rotatedSize(wide, 1).w === 1 && rotatedSize(wide, 1).d === 3, 'rot 1 swaps them')
  ok(rotatedSize(wide, 2).w === 3, 'rot 2 is back to w x d')
  // Every rotation of a 3x1 covers 3 distinct cells — no overlap, no loss.
  for (const rot of [0, 1, 2, 3] as Rotation[]) {
    const cells = cellsOf({ pieceId: 't', x: 0, y: 0, z: 0, rot }, wide)
    ok(new Set(cells.map(c => `${c.x},${c.y},${c.z}`)).size === 3,
       `rotation ${rot} of a 3-wide piece covers 3 distinct cells`)
  }
  // rotateCell is a bijection on the footprint — the real guarantee behind all of the above.
  let bij = 0
  for (const rot of [0, 1, 2, 3] as Rotation[]) {
    const seen = new Set<string>()
    for (let z = 0; z < wide.d; z++) for (let x = 0; x < wide.w; x++) {
      const r = rotateCell(x, z, wide, rot)
      seen.add(`${r.x},${r.z}`)
    }
    if (seen.size !== wide.w * wide.d) bij++
  }
  ok(bij === 0, 'rotateCell is a bijection at every rotation — no cell is lost or doubled')
}

// ── 4. ★ footprint is not visual bounds — a doorway is walkable ──────────────────────────────
// The occupancy trick only works if "occupied" and "blocks you" are allowed to differ. Otherwise a
// doorway is a wall and a stair is a step you cannot climb.
{
  const door = cellsOf({ pieceId: 'doorway', x: 0, y: 0, z: 0, rot: 0 }, pieceDef('doorway')!)
  const passable = door.filter(c => !c.solid)
  ok(passable.length === 2, `★ a doorway has 2 walkable cells, so you can walk through it (${passable.length})`)
  ok(door.filter(c => c.solid).length === 1, 'and one solid cell — the lintel')
  ok(passable.every(c => c.y < 2), 'the walkable cells are the lower two, not the top')

  const stair = cellsOf({ pieceId: 'stair', x: 0, y: 0, z: 0, rot: 0 }, pieceDef('stair')!)
  ok(stair.every(c => !c.solid), '★ a stair is walkable — you stand ON it, it must not block you')

  const beam = cellsOf({ pieceId: 'beam', x: 0, y: 0, z: 0, rot: 0 }, pieceDef('beam')!)
  ok(beam.every(c => c.solid), 'a beam is solid')
}

// ── 5. ★ a piece never overwrites anything ───────────────────────────────────────────────────
// Refusing rather than overwriting is what stops a misclick eating the wall you just built.
{
  const p: Placement = { pieceId: 'window', x: 0, y: 10, z: 0, rot: 0 }
  const def = pieceDef('window')!
  ok(canPlace(p, def, air), 'a window fits in empty air')
  ok(!canPlace(p, def, solid), '★ a window refuses to overwrite stone')
  // Partially blocked must also refuse — one occupied cell is enough.
  const halfBlocked = (x: number, y: number, z: number) => (y === 11 ? MAT.STONE : AIR)
  ok(!canPlace(p, def, halfBlocked), '★ ONE blocked cell refuses the whole placement')
  // Including another piece.
  const pieceThere = (x: number, y: number, z: number) => (y === 10 ? STRUCTURE : AIR)
  ok(!canPlace(p, def, pieceThere), 'a piece will not overwrite another piece')
}

// ── 6. affordability ─────────────────────────────────────────────────────────────────────────
{
  const def = pieceDef('doorway')!
  ok(canAfford(def, () => 99), 'affordable with plenty')
  ok(!canAfford(def, () => 0), 'not affordable with nothing')
  ok(!canAfford(def, id => (id === 'goldwood_plank' ? 5 : 99)), 'one short is not affordable')
  ok(canAfford(def, id => (id === 'goldwood_plank' ? 6 : 0)), 'exactly enough is affordable')
}

// ── 7. deconstruction can find a piece from any cell it occupies ─────────────────────────────
// A player aims at the middle of a doorway, not at its origin — so lookup has to work from every
// occupied cell, including the walkable ones.
{
  const list: Placement[] = [
    { pieceId: 'doorway', x: 5, y: 10, z: 5, rot: 0 },
    { pieceId: 'beam', x: 20, y: 30, z: 20, rot: 2 },
  ]
  ok(placementAt(list, 5, 10, 5)?.pieceId === 'doorway', 'found from its origin')
  ok(placementAt(list, 5, 11, 5)?.pieceId === 'doorway', '★ found from a middle cell')
  ok(placementAt(list, 5, 12, 5)?.pieceId === 'doorway', 'found from its top cell')
  ok(placementAt(list, 20, 30, 20)?.pieceId === 'beam', 'found the other piece')
  ok(placementAt(list, 0, 0, 0) === undefined, 'empty space has no placement')
  ok(placementAt([], 5, 10, 5) === undefined, 'an empty world has no placement')
}

// ── 8. STRUCTURE does not collide with any other material id ─────────────────────────────────
// A reused id would make pieces indistinguishable from terrain — unbreakable stone, or a door you
// can mine with a spike.
{
  ok(!blockDef(STRUCTURE), 'STRUCTURE is not a mineable block — deconstruction is its own verb')
  ok(materialForItem('doorway') === undefined, 'a piece is not placeable as a block item')
  ok(STRUCTURE > 39, `STRUCTURE (${STRUCTURE}) sits past the wood range, so no id collides`)
}

console.log(`\npieces: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the catalogue places')
