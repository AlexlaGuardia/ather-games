// Piece oracle. Run: npx tsx src/app/shimmer/voxel/pieces.test.ts
//
// Placement fails in ways that only show up once someone has built something: a rotation that drifts
// the origin so a wall walks sideways as you turn it, a doorway you cannot walk through, a piece
// that overwrote the wall you put up a minute ago. All cheap to assert, all miserable to discover.

import { AIR } from './section'
import { MAT } from './depth'
import {
  PIECES, ALL_PIECES, PIECE_MATERIALS, basePieceId, pieceMaterial,
  STRUCTURE, pieceDef, rotatedSize, rotateCell, cellsOf, canPlace, canAfford, placementAt,
  visualRotation, toggleOpen,
  type Placement, type Rotation, type PieceDef,
} from './pieces'
import { blockDef, materialForItem, ALL_BLOCKS } from './registry'
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
  // Fourteen since 2026-08-27 — the sub-cube detail pass (shutter, arch, bracket, hook) and the
  // door pass (door, gate; the shutter became openable rather than gaining a `trapdoor` twin). Alex
  // reopened STRUCTURE-LAYER §9's "six and stop" now the loop is proven. The count stays asserted
  // so growth is always a DECISION that edits this line, never a drift.
  // FIFTEEN since 2026-08-30 — the BENCH (Alex: "benches as a craftable object.. to make a real
  // mini arena"). It earns its place by being the first piece whose reason is a ROOM rather than a
  // wall: a keeper crafts a run of them into a sparring ring, which is Gregory's free training game
  // built — *"no crown in it and no audience that was not also a player"* — and the deliberate
  // counter-image of the Snagbarrows' ring. ⚠ It is the KEEPER's and never a hold's: canon fixes the
  // collar-culture's built vocabulary as an exhaustive list against "anything architectural", and
  // benching a hold's audience would say those people built seating for guests.
  ok(PIECES.length === 15, `the catalogue is fifteen pieces, deliberately (${PIECES.length})`)
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
  // ⚠⚠ THIS SWEEP USED TO READ `[...Array(64).keys()].map(blockDef)` AND WAS ALREADY HALF-BLIND
  // (fixed 2026-08-27). Materials run past 64 — `dawnwood_plank` is MAT 75, i.e. the guard could
  // not see the block whose drop it was checking for. It passed anyway, because planks are also
  // RECIPE_OUTPUTS, so the blindness was masked by the OTHER half of the union and nothing looked
  // wrong. A hardcoded ceiling over a table that grows is the instrument-cannot-see-its-subject
  // shape from PATTERNS; `ALL_BLOCKS` is exported precisely so an audit reads the real table.
  const droppable = new Set<string>()
  for (const b of ALL_BLOCKS) for (const d of b.drops) droppable.add(d.itemId)
  const obtainable = new Set([...droppable, ...RECIPE_OUTPUTS])
  // ★ OVER `ALL_PIECES`, NOT `PIECES` — the derived material variants must face the same guard as
  // the hand-written eight. A derivation that mints 48 new costs and skips the check that exists to
  // catch an uncraftable piece is the guard-that-exempts shape, and it would have exempted exactly
  // the rows nobody hand-reviewed.
  const missing = ALL_PIECES.flatMap(p => p.cost.map(c => c.itemId)).filter(i => !obtainable.has(i))
  ok(missing.length === 0, `every piece cost is obtainable (missing: ${[...new Set(missing)].join(',')})`)
}

// ── 2b. ★ THE MATERIAL VARIANTS (2026-08-27, the building-vocabulary pass) ───────────────────
// One shape in many materials is Minecraft's entire detailing vocabulary, and the catalogue could
// not express it: every hand-written piece pinned ONE material, so a stone hold dressed itself in
// wooden parapets. These asserts are about the DERIVATION, not the values it happens to produce —
// an assert that recomputes the derivation and compares would agree with itself forever.
{
  // A variant must wear a real material, and one its base actually accepts. The cheapest wrong
  // answer that still satisfies "it has a material" is a material from the OTHER family, so the
  // family membership is the half worth asserting.
  let badFamily = 0, badCost = 0, badGeom = 0, orphan = 0
  for (const p of ALL_PIECES) {
    const m = pieceMaterial(p.id)
    if (!m) { if (PIECES.some(b => b.id === p.id)) continue; orphan++; continue }
    const base = PIECES.find(b => b.id === basePieceId(p.id))
    if (!base) { orphan++; continue }
    if (!base.variants?.includes(m.family)) badFamily++
    // The cost must BE the material's item, at the base's count. Two ways to get this wrong and
    // both ship a piece that looks right in a menu: the wrong item, or a drifted count.
    if (p.cost[0]?.itemId !== m.itemId || p.cost[0]?.count !== base.cost[0].count) badCost++
    // ★ GEOMETRY MUST SURVIVE THE COPY. A variant is the same SHAPE in a different material — if
    // w/h/d or the walkable cells drift, a stone doorway stops being walk-through-able and the
    // failure shows up as a player stuck in a gatehouse, nowhere near this file.
    if (p.w !== base.w || p.h !== base.h || p.d !== base.d) badGeom++
    if ((p.passable?.length ?? 0) !== (base.passable?.length ?? 0)) badGeom++
    if (!!p.halfHeight !== !!base.halfHeight) badGeom++
  }
  ok(orphan === 0, `every piece resolves to a hand-written base (${orphan} orphaned)`)
  ok(badFamily === 0, `every variant's material is in a family its base accepts (${badFamily} bad)`)
  ok(badCost === 0, `every variant costs its own material at the base's count (${badCost} bad)`)
  ok(badGeom === 0, `★ a variant is the same shape in another material (${badGeom} drifted)`)

  // ★ THE BASE IS NOT DUPLICATED. `stair` already costs cut_stone, so `stair_cutstone` must not
  // exist beside it — two ids for one object is a save-format problem the day someone places one.
  const dupes = ALL_PIECES.filter(p => {
    const m = pieceMaterial(p.id); const base = PIECES.find(b => b.id === basePieceId(p.id))
    return m && base && p.id !== base.id && m.itemId === base.cost[0]?.itemId
  })
  ok(dupes.length === 0, `no variant duplicates its base's own material (${dupes.map(d => d.id).join(',')})`)

  // ★ NAMED REGRESSION: THE UNDERSCORE TRAP. `half_slab` and `roof_slope` contain underscores, so
  // any reader that recovers a base by splitting the id on `_` reads `half_slab` as the `half`
  // piece in a `slab` material — a confident wrong answer, silently. VARIANT_OF is built from the
  // table for this reason; this assert is what fails if someone "simplifies" it back to a split.
  ok(basePieceId('half_slab') === 'half_slab', '★ half_slab is a base, not `half` in `slab`')
  ok(basePieceId('roof_slope') === 'roof_slope', '★ roof_slope is a base, not `roof` in `slope`')
  ok(basePieceId('half_slab_palebrick') === 'half_slab', '★ an underscored base still resolves under a variant')
  ok(pieceMaterial('half_slab_palebrick')?.key === 'palebrick', 'the variant knows its own material')

  // Every material is reachable by something, or it is a row nobody can build with.
  const used = new Set(ALL_PIECES.map(p => pieceMaterial(p.id)?.key).filter(Boolean))
  const unreachable = PIECE_MATERIALS.filter(m => !used.has(m.key))
  ok(unreachable.length === 0, `every building material is reachable (${unreachable.map(m => m.key).join(',')})`)
}

// ── 2c. ★★ THE THINGS THAT OPEN (2026-08-27, the door pass) ─────────────────────────────────
// The first state any piece has ever had. A placement used to be the same object forever, which is
// the real reason there were no doors — not that nobody modelled one.
{
  const openable = ALL_PIECES.filter(p => p.openable)
  ok(openable.length > 0, 'some pieces open')
  // Base shapes only, so this reads as "three things open" rather than a variant count.
  const bases = PIECES.filter(p => p.openable).map(p => p.id).sort()
  ok(bases.join(',') === 'door,gate,shutter', `door, gate and shutter open (${bases.join(',')})`)

  // ★ THE ONE INVARIANT THAT KEEPS `canPlace` HONEST. `canPlace` runs against the CLOSED footprint,
  // once, at placement time. If opening moved the cells, a door could later swing into terrain that
  // was never checked — and nothing downstream would ever look again. So the cell SET must be
  // identical in both states and only SOLIDITY may differ.
  //
  // ⚠⚠ AND IT IS TESTED AGAINST A SYNTHETIC WIDE PIECE, NOT ONLY THE SHIPPED ONES — because every
  // openable piece today has a 1x1 FOOTPRINT, and rotating a 1x1 about its own origin cannot move
  // it. Written against the catalogue alone this assert was **incapable of failing**: the mutation
  // that makes `cellsOf` use the VISUAL rotation (i.e. the door swings its collision into whatever
  // is beside it) passed all 63 checks. It is the dominated-assert shape from PATTERNS, and asking
  // "is there an input that makes this fire?" is what found it. `WIDE` is that input, and it also
  // guards the future: the day a double gate or a portcullis is added, this is already watching.
  const WIDE: PieceDef = { id: 'test_wide_gate', name: 'Test', w: 3, h: 2, d: 1,
                           cost: [{ itemId: 'goldwood_plank', count: 1 }], openable: true }
  let moved = 0, notFreed = 0, notSolid = 0
  for (const def of [...openable, WIDE]) {
    for (const rot of [0, 1, 2, 3] as Rotation[]) {
      const shut: Placement = { pieceId: def.id, x: 5, y: 9, z: -3, rot }
      const ajar: Placement = { ...shut, open: true }
      const key = (c: { x: number; y: number; z: number }) => `${c.x},${c.y},${c.z}`
      const a = cellsOf(shut, def).map(key).sort().join('|')
      const b = cellsOf(ajar, def).map(key).sort().join('|')
      if (a !== b) moved++
      // Open: nothing blocks. Closed: something must, or it is not a door.
      if (cellsOf(ajar, def).some(c => c.solid)) notFreed++
      if (!cellsOf(shut, def).some(c => c.solid)) notSolid++
    }
  }
  ok(moved === 0, `★★ opening never moves a piece's cells, only their solidity (${moved} moved)`)
  ok(notFreed === 0, `an open piece blocks nothing (${notFreed} still blocking)`)
  ok(notSolid === 0, `★ a CLOSED piece blocks something — otherwise it is a doorway, not a door (${notSolid} inert)`)

  // The swing is a rotation and it must come back. Four toggles of the visual is not the test;
  // the test is that open differs from closed and closed is the stored rot.
  const d = pieceDef('door')!
  const shut: Placement = { pieceId: 'door', x: 0, y: 0, z: 0, rot: 0 }
  ok(visualRotation(shut, d) === 0, 'a closed door is drawn at its stored rotation')
  ok(visualRotation({ ...shut, open: true }, d) === 1, 'an open door is drawn swung 90°')

  // ⚠ A STRAY `open` ON SOMETHING THAT DOES NOT OPEN MUST DO NOTHING. Saves are edited by hand, and
  // a future bug could set the flag anywhere; a fence that silently became passable because of a key
  // it does not understand is a hole in a yard nobody can see.
  const f = pieceDef('fence')!
  ok(visualRotation({ pieceId: 'fence', x: 0, y: 0, z: 0, rot: 2, open: true }, f) === 2,
     '★ a stray `open` does not rotate a piece that cannot open')
  ok(cellsOf({ pieceId: 'fence', x: 0, y: 0, z: 0, rot: 0, open: true }, f).every(c => c.solid),
     '★★ a stray `open` does not make a solid piece passable')
  ok(toggleOpen({ pieceId: 'fence', x: 0, y: 0, z: 0, rot: 0 }, f).open === undefined,
     'toggling something that does not open changes nothing')

  // Save compatibility: every placement ever written lacks the key, and must read as CLOSED.
  ok(cellsOf(shut, d).some(c => c.solid), '★ a placement with no `open` key reads as closed')
  ok(toggleOpen(shut, d).open === true && toggleOpen(toggleOpen(shut, d), d).open === false,
     'toggle round-trips')

  // ★ THE VARIANTS INHERIT IT. `door_stonebrick` is a door; if `openable` were dropped by the
  // derivation the stone doors would be permanent walls and only the goldwood one would work.
  const stoneDoor = pieceDef('door_stonebrick')
  ok(!!stoneDoor?.openable, 'a material variant of a door still opens')
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
