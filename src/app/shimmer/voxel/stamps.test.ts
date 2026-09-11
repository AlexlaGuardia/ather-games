// ★ THE STAMP MATH, GUARDED. Run: npx tsx src/app/shimmer/voxel/stamps.test.ts
//
// What a stamp promises (stamps.ts header): the rotated box is where the cells land; the floor is
// the pad's highest point + 1 − sink; the box is cleared above ground and never below; a plinth
// fills under the bottom layer; a piece rotated with the blueprint covers exactly the rotated
// cells; and a building split across column seams is the same building the whole column sees.
import { Section, AIR } from './section'
import { MAT } from './depth'
import { makeBlueprint, blueprintCells, type BlueprintDef } from './blueprints'
import { PIECES, cellsOf, pieceDef, type Placement, type Rotation } from './pieces'
import {
  placeStamps, stampFloor, stampBox, stampWorldCells, stampGenPieces, stampGenPiecesForCol,
  stampTouches, stampPadSpan, rotatePiece, rotateLocal, type Stamp,
} from './stamps'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const SIZE = 16

// A 3-wide, 2-tall, 5-deep L: walls along x=0 and z=0, one lantern on top at the corner.
const L: BlueprintDef = makeBlueprint('l', 'L', [
  ...Array.from({ length: 5 }, (_, z) => ({ x: 0, y: 0, z, m: MAT.CUT_STONE })),
  ...Array.from({ length: 3 }, (_, x) => ({ x, y: 0, z: 0, m: MAT.CUT_STONE })),
  { x: 0, y: 1, z: 0, m: MAT.MANA_LANTERN },
], [{ pieceId: 'doorway', x: 2, y: 0, z: 2, rot: 0 }])
ok(L.w === 3 && L.h === 3 && L.d === 5, `fixture bounds 3x3x5 (got ${L.w}x${L.h}x${L.d})`)

// Sections tall enough for a floor near 128, like the world.
const sections = () => Array.from({ length: 16 }, () => new Section(SIZE))
const get = (secs: Section[], wx: number, wy: number, wz: number, ox: number, oz: number) => {
  const si = (wy / SIZE) | 0
  return secs[si].get(wx - ox, wy - si * SIZE, wz - oz)
}
const flat = (h: number) => (_x: number, _z: number) => h

// ── rotation of the box and of cells ───────────────────────────────────────────────────────────
{
  for (const rot of [0, 1, 2, 3] as Rotation[]) {
    const s: Stamp = { id: 't', bp: L, x: 10, z: 20, rot }
    const box = stampBox(s)
    ok((rot & 1) ? box.w === 5 && box.d === 3 : box.w === 3 && box.d === 5, `rot ${rot}: box swaps w/d on odd rotations`)
    const cells = stampWorldCells(s, 100)
    ok(cells.every(c => c.x >= 10 && c.x < 10 + box.w && c.z >= 20 && c.z < 20 + box.d && c.y >= 100 && c.y < 103),
      `rot ${rot}: every world cell lands inside the rotated box`)
    ok(cells.length === blueprintCells(L).length, `rot ${rot}: rotation loses no cell`)
    const uniq = new Set(cells.map(c => `${c.x},${c.y},${c.z}`))
    ok(uniq.size === cells.length, `rot ${rot}: rotation maps no two cells onto one`)
  }
  // rotateLocal is a bijection on the box for every rotation.
  for (const rot of [1, 2, 3] as Rotation[]) {
    const seen = new Set<string>()
    for (let z = 0; z < L.d; z++) for (let x = 0; x < L.w; x++) { const r = rotateLocal(x, z, L, rot); seen.add(`${r.x},${r.z}`) }
    ok(seen.size === L.w * L.d, `rotateLocal rot ${rot} is a bijection on the box`)
  }
}

// ── pieces rotate WITH the blueprint: the composed placement covers exactly the rotated cells ──
{
  let checked = 0
  const bp = { w: 6, d: 6 }
  for (const def of PIECES) {
    for (const prot of [0, 1, 2, 3] as Rotation[]) {
      for (const rot of [0, 1, 2, 3] as Rotation[]) {
        const p: Placement = { pieceId: def.id, x: 1, y: 0, z: 2, rot: prot }
        const before = new Set(cellsOf(p, def).map(c => { const r = rotateLocal(c.x, c.z, bp, rot); return `${r.x},${c.y},${r.z}` }))
        const q = rotatePiece(p, bp, rot)
        const after = new Set(cellsOf(q, pieceDef(q.pieceId)!).map(c => `${c.x},${c.y},${c.z}`))
        const same = before.size === after.size && [...before].every(k => after.has(k))
        if (!same) fails.push(`piece ${def.id} rot ${prot} under stamp rot ${rot}: composed placement covers ${[...after].join(' ')} not ${[...before].join(' ')}`)
        else checked++
      }
    }
  }
  ok(checked === PIECES.length * 16, `every piece × piece-rotation × stamp-rotation composes (${checked}/${PIECES.length * 16})`)
  // An open piece stays open through the stamp.
  const g = stampGenPieces({ id: 'o', bp: { ...L, pieces: [{ pieceId: 'door', x: 0, y: 0, z: 1, rot: 0, open: true }] }, x: 0, z: 0, rot: 1 }, 50)
  ok(g.length === 1 && g[0].open === true && g[0].gen === 'stamp:o:0', 'a piece born open is generated open, keyed stamp:<id>:<index>')
}

// ── the floor: highest point of the pad, + 1, − sink ───────────────────────────────────────────
{
  const stepped = (x: number, _z: number) => (x >= 12 ? 129 : 128)
  const s: Stamp = { id: 'f', bp: L, x: 10, z: 20, rot: 0 }
  ok(stampFloor(s, flat(128)) === 129, 'on flat ground the blueprint stands one above the surface')
  ok(stampFloor(s, stepped) === 130, 'on a stepped pad the floor is read at the HIGH side (+1)')
  ok(stampFloor({ ...s, sink: 1 }, stepped) === 129, 'sink 1 lowers the floor into the high side\'s surface block')
  ok(stampPadSpan(s, stepped) === 1 && stampPadSpan(s, flat(5)) === 0, 'padSpan is high minus low over the footprint')
}

// ── placing: cells, the clear above ground, no clear below, the plinth ─────────────────────────
{
  const ox = 0, oz = 16
  const secs = sections()
  // Pre-fill: ground up to the surface, a "tree trunk" inside the box above ground, a stone below.
  const stepped = (x: number, _z: number) => (x >= 12 ? 129 : 128)
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
    const h = stepped(ox + x, oz + z)
    for (let y = 0; y <= h; y++) { const si = (y / SIZE) | 0; secs[si].set(x, y - si * SIZE, z, MAT.TOPSOIL) }
  }
  const put = (wx: number, wy: number, wz: number, m: number) => { const si = (wy / SIZE) | 0; secs[si].set(wx - ox, wy - si * SIZE, wz - oz, m) }
  put(11, 130, 22, MAT.STONE)   // a trunk inside the box, above ground → must be cleared
  put(11, 131, 22, MAT.STONE)
  put(11, 127, 22, MAT.DEEP_STONE) // below ground inside the box → must NOT be touched
  const s: Stamp = { id: 'p', bp: L, x: 10, z: 20, rot: 0 }
  const floor = stampFloor(s, stepped)   // 130
  const n = placeStamps(secs, ox, 0, oz, SIZE, [s], stepped)
  ok(n === 1, 'one stamp touched the column')
  ok(get(secs, 10, floor, 20, ox, oz) === MAT.CUT_STONE, 'a wall cell lands at (x, floor, z)')
  ok(get(secs, 10, floor + 1, 20, ox, oz) === MAT.MANA_LANTERN, 'the lantern lands one above')
  ok(get(secs, 11, 130, 22, ox, oz) === AIR && get(secs, 11, 131, 22, ox, oz) === AIR, 'the box is cleared above ground where the blueprint has no cell')
  ok(get(secs, 11, 127, 22, ox, oz) === MAT.DEEP_STONE, 'nothing below the surface is cleared')
  ok(get(secs, 11, 128, 22, ox, oz) === MAT.TOPSOIL, 'the surface block itself is kept')
  // Plinth: the low side (x<12) has surface 128, floor 130 → y=129 under every bottom cell is filled.
  ok(get(secs, 10, 129, 20, ox, oz) === MAT.CUT_STONE, 'the plinth fills the low side down to the surface with the cell\'s own material')
  ok(get(secs, 12, 129, 20, ox, oz) === MAT.TOPSOIL, 'the high side (surface 129) gets no plinth: it is flush')
  ok(get(secs, 10, 129, 22, ox, oz) === MAT.CUT_STONE, 'plinth under a cell mid-wall too')
  ok(get(secs, 11, 129, 22, ox, oz) === AIR, 'no plinth where the bottom layer has no cell — an interior is not filled')
  // Sink 1: the bottom layer lands IN the surface block on the high side.
  const secs2 = sections()
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) secs2[8].set(x, 0, z, MAT.TOPSOIL)  // surface 128 = section 8 row 0
  placeStamps(secs2, ox, 0, oz, SIZE, [{ ...s, sink: 1 }], flat(128))
  ok(get(secs2, 10, 128, 20, ox, oz) === MAT.CUT_STONE, 'sink 1: the bottom layer replaces the surface block')
  ok(get(secs2, 11, 128, 22, ox, oz) === MAT.TOPSOIL, 'sink 1: a gap in the sunk layer is NOT a hole — the ground stays')
  // Out of range: a stamp that does not touch writes nothing and counts nothing.
  const secs3 = sections()
  ok(placeStamps(secs3, ox, 0, oz, SIZE, [{ ...s, x: 200 }], flat(128)) === 0, 'a stamp elsewhere does not touch the column')
  ok(!stampTouches({ ...s, x: 200 }, ox, oz, SIZE) && stampTouches(s, ox, oz, SIZE), 'stampTouches agrees')
}

// ── seams: four columns write the same building the one big grid would ─────────────────────────
{
  // The stamp straddles x=16 and z=32 with a piece origin in each quadrant when rotated.
  const bp = makeBlueprint('big', 'big', [
    ...Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0, z: 0, m: MAT.CUT_STONE })),
    ...Array.from({ length: 10 }, (_, i) => ({ x: 0, y: 0, z: i, m: MAT.STONE_BRICK })),
    ...Array.from({ length: 10 }, (_, i) => ({ x: 9, y: 1, z: i, m: MAT.PALE_BRICK })),
  ], [{ pieceId: 'fence', x: 2, y: 1, z: 0, rot: 0 }, { pieceId: 'fence', x: 0, y: 1, z: 8, rot: 0 }, { pieceId: 'bench', x: 9, y: 2, z: 7, rot: 2 }])
  for (const rot of [0, 1, 2, 3] as Rotation[]) {
    const s: Stamp = { id: 'seam', bp, x: 12, z: 28, rot }
    const surf = (x: number, z: number) => 100 + (((x + z) % 3 === 0) ? 1 : 0)   // lumpy but within span 1
    // One 32×32 grid.
    const big = Array.from({ length: 16 }, () => new Section(32))
    placeStamps(big, 0, 0, 16, 32, [s], surf)
    // Four 16×16 columns.
    const quads = [[0, 16], [16, 16], [0, 32], [16, 32]].map(([ox, oz]) => {
      const secs = sections(); placeStamps(secs, ox, 0, oz, SIZE, [s], surf); return { ox, oz, secs }
    })
    let mismatch = 0, solids = 0
    for (let z = 16; z < 48; z++) for (let x = 0; x < 32; x++) for (let y = 95; y < 110; y++) {
      const si = (y / 32) | 0
      const a = big[si].get(x, y - si * 32, z - 16)
      const q = quads.find(q => x >= q.ox && x < q.ox + 16 && z >= q.oz && z < q.oz + 16)!
      const b = get(q.secs, x, y, z, q.ox, q.oz)
      if (a !== b) mismatch++
      if (a !== AIR) solids++
    }
    ok(mismatch === 0 && solids > 30, `rot ${rot}: four columns agree with one grid cell-for-cell (${mismatch} mismatches over ${solids} solids)`)
    // Pieces: the union over the four columns is the stamp's whole piece list, each once.
    const all = quads.flatMap(q => stampGenPiecesForCol([s], q.ox / 16, q.oz / 16, SIZE, surf))
    const keys = all.map(g => g.gen).sort()
    ok(keys.length === 3 && new Set(keys).size === 3, `rot ${rot}: every piece is claimed by exactly one column (${keys.join(',')})`)
    ok(all.every(g => g.y === stampFloor(s, surf) + (g.gen.endsWith(':2') ? 2 : 1)), `rot ${rot}: piece y rides the floor`)
  }
}

console.log(`\nstamps: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
