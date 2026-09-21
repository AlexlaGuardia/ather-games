// Shelf fungi — the plant that stands on a trunk (2026-09-21). Run: npx tsx src/app/shimmer/voxel/shelf.test.ts
//
// ★ WHY THIS EXISTS: the shelf is the first plant the ground probe cannot see. Every other guard
// in this tree asks "what stands on the cell above the ground"; a bracket at ground+3 answers
// none of them, so a shelf that never generated, generated inside a trunk, or generated at a
// neighbour's ankle (where the probe WOULD see it and draw it as a puff) would pass every suite
// we had. This asks the generator directly, then asks the renderer's own reader (`shelf-scan`)
// the same question on a real column, and compares the two.
//
// ⚠ THE ANKLE GUARD IS PROVED FROM BOTH SIDES. It is not enough that no placed bracket sits at a
// neighbour's h+1 — a sample in which no stack ever REACHED that cell would say the same with the
// guard deleted. §3 counts the cells the guard refused and requires that number to be non-zero,
// so the guard is shown to have had something to refuse.
import { inWorld } from '../voxel3d/obtainable'
import { FLORA, forageKind, FORAGE_MATS, TRUNK_FORAGE_MATS, FLORA_MATERIALS, FLORA_KIND_COUNT } from './flora'
import { MAT, isForage, isPlant, isSolid } from './depth'
import { BLOCKS } from './registry'
import { ITEMS } from '../sprites/items'
import { Section, AIR } from './section'
import { growTree, shelfStackFor, treeStartsAt, isLogMat, SPECIES, SHELF_TREE_CHANCE, SHELF_MIN_STEM, DEFAULT_TREES, type TreeStart } from './trees'
import { makeColumn, SECTION } from './column'
import { scanShelves, SHELF_FACES } from '../voxel3d/shelf-scan'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }
const SEED = 1337

// ── 1. the material, the kind, the row, the drop ───────────────────────────────────────────────
ok(isForage(MAT.SHELF_FUNGUS) && isPlant(MAT.SHELF_FUNGUS), 'the shelf is a forage and a plant (the mesher skips it, the walk passes through it)')
ok(!isSolid(MAT.SHELF_FUNGUS), 'not walk-into solid')
ok(forageKind(MAT.SHELF_FUNGUS) === FLORA.SHELF, 'its draw kind is its own')
ok(TRUNK_FORAGE_MATS.includes(MAT.SHELF_FUNGUS) && FORAGE_MATS.includes(MAT.SHELF_FUNGUS), 'counted through the forage')
ok(FLORA_MATERIALS.has(MAT.SHELF_FUNGUS), 'in the flora material set (the atlas exemption)')
ok(FLORA_KIND_COUNT === FLORA_MATERIALS.size, `kind count and material set still agree (${FLORA_KIND_COUNT} vs ${FLORA_MATERIALS.size})`)
const row = BLOCKS.find(b => b.material === MAT.SHELF_FUNGUS)
ok(row?.drops?.[0]?.itemId === 'shelf_slices' && (row?.drops?.[0]?.count ?? 0) >= 2, 'a bracket drops shelf slices — canon names the harvest')
ok(row?.placeable === false, 'not placeable: no bed can grow a trunk')
ok(inWorld('shelf_slices'), 'shelf slices are obtainable in the voxel world (derived from the row)')
ok(ITEMS.some(i => i.id === 'shelf_slices'), 'shelf_slices has an ItemDef')

// ── 2. the stack is a pure function of the tree, and shaped as canon says ──────────────────────
{
  const starts: TreeStart[] = []
  for (let cz = -40; cz < 40; cz++) for (let cx = -40; cx < 40; cx++) starts.push(...treeStartsAt(SEED, cx, cz, SECTION, DEFAULT_TREES))
  ok(starts.length > 500, `a sample of trees to ask (${starts.length})`)
  let withStack = 0, eligible = 0, bad = 0
  for (const st of starts) {
    const top = st.species.trunk === 'straight' ? st.height : Math.floor(st.height * 0.55)
    const a = shelfStackFor(st), b = shelfStackFor({ ...st })
    if (JSON.stringify(a) !== JSON.stringify(b)) bad++
    if (top < SHELF_MIN_STEM) { if (a) bad++; continue }
    eligible++
    if (!a) continue
    withStack++
    if (!(a.n === 2 || a.n === 3)) bad++
    if (a.i0 < 1 || a.i0 + a.n - 1 > top - 2) bad++
    if (!SHELF_FACES.some(([dx, dz]) => dx === a.dx && dz === a.dz)) bad++
  }
  ok(bad === 0, `every stack is deterministic, 2-3 brackets, on i ∈ [1, top−2], on one of four faces (${bad} bad)`)
  const rate = withStack / eligible
  // ⚠ LITERAL BOUNDS, NOT `SHELF_TREE_CHANCE × k` — a bound that reads the constant it tests moves
  // with it, and a doubled chance passed the first cut of this line. One in five is the call;
  // a forest where every third trunk wears brackets is a different forest.
  ok(rate > 0.14 && rate < 0.27, `about one tall trunk in five carries a stack (${(100 * rate).toFixed(1)}% of ${eligible}; ${SHELF_TREE_CHANCE} asked)`)
  ok(eligible < starts.length, `short stems (< ${SHELF_MIN_STEM}) exist in the sample and carry none (${starts.length - eligible} short)`)
}

// ── 3. grown on a scratch: beside the log, at height, never at a neighbour's ankle ─────────────
{
  const S = 32, GROUND = 20
  let trees = 0, brackets = 0, expected = 0, notBesideLog = 0, ankle = 0, refused = 0, floating = 0, overwrote = 0
  const sp = SPECIES.find(s => s.trunk === 'straight')!
  for (let k = 0; k < 400; k++) {
    const st: TreeStart = { x: 16, z: 16, species: sp, height: sp.maxHeight, seed: (k * 2654435761 + 11) | 0 }
    const stack = shelfStackFor(st)
    if (!stack) continue
    trees++
    // A slope: the neighbour on the stack's side stands two blocks higher than the tree's ground,
    // so a low bracket lands at that neighbour's h+1 — the cell the guard must refuse.
    const surfaceAt = (x: number, z: number) => (x === 16 + stack.dx && z === 16 + stack.dz) ? GROUND + 2 : GROUND
    const sections = [new Section(S), new Section(S), new Section(S)]
    const c = { sections, ox: 0, oy0: 0, oz: 0, size: S, yTop: 3 * S }
    // Something already stands in the stack's TOP cell (a neighbour's trunk, say): the fungus must
    // yield to it, never overwrite it. Positive control for the read-first rule.
    const topY = GROUND + 1 + stack.i0 + stack.n - 1
    sections[(topY / S) | 0].set(16 + stack.dx, topY % S, 16 + stack.dz, MAT.STONE)
    growTree(c, st, GROUND, surfaceAt)
    if (sections[(topY / S) | 0].get(16 + stack.dx, topY % S, 16 + stack.dz) !== MAT.STONE) overwrote++
    for (let kk = 0; kk < stack.n; kk++) {
      const y = GROUND + 1 + stack.i0 + kk
      if (y <= GROUND + 3) refused++
      else if (y !== topY) expected++         // not at the raised neighbour's ankle, not the stoned cell
    }
    for (let si = 0; si < 3; si++) for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      if (sections[si].get(x, y, z) !== MAT.SHELF_FUNGUS) continue
      brackets++
      const wy = si * S + y
      const at = (dx: number, dz: number) => (x + dx < 0 || x + dx >= S || z + dz < 0 || z + dz >= S) ? AIR : sections[si].get(x + dx, y, z + dz)
      if (!SHELF_FACES.some(([dx, dz]) => isLogMat(at(dx, dz)))) notBesideLog++
      if (wy <= surfaceAt(x, z) + 1) ankle++
      if (wy <= GROUND + 1) floating++
    }
    // Without the neighbour reader a tree carries none — a sapling's tree is bare.
    const bare = [new Section(S), new Section(S), new Section(S)]
    growTree({ sections: bare, ox: 0, oy0: 0, oz: 0, size: S, yTop: 3 * S }, st, GROUND)
    if (bare.some(sec => sec.data.includes(MAT.SHELF_FUNGUS))) floating += 1000
  }
  ok(trees > 40, `enough stacked trees grown to measure (${trees})`)
  ok(brackets > 0 && brackets === expected, `exactly the brackets the stacks describe were placed, less the refused and the stoned (${brackets} placed, ${expected} expected, on ${trees} trees)`)
  ok(notBesideLog === 0, `every bracket has a log on one of its four faces (${notBesideLog} did not)`)
  ok(refused > 0, `the ankle guard had something to refuse in this sample (${refused} cells at the raised neighbour's h+1) — else the next line is vacuous`)
  ok(ankle === 0, `and refused it: no bracket at a neighbour's h+1 (${ankle})`)
  ok(floating === 0, `none at the tree's own root, none without a neighbour reader (${floating})`)
  ok(overwrote === 0, `a fungus never overwrites what already stands in its cell (${overwrote} did)`)
}

// ── 3b. a forking species stacks on the STEM below the fork ───────────────────────────────────
{
  const S = 32, GROUND = 20
  const sp = SPECIES.find(s => s.trunk === 'forking')
  ok(!!sp, 'a forking species exists to test')
  let trees = 0, brackets = 0, aboveFork = 0
  for (let k = 0; k < 400 && sp; k++) {
    const st: TreeStart = { x: 16, z: 16, species: sp, height: sp.maxHeight, seed: (k * 40503 + 7) | 0 }
    const stack = shelfStackFor(st)
    if (!stack) continue
    trees++
    const sections = [new Section(S), new Section(S), new Section(S)]
    growTree({ sections, ox: 0, oy0: 0, oz: 0, size: S, yTop: 3 * S }, st, GROUND, () => GROUND)
    const forkY = GROUND + 1 + Math.floor(st.height * 0.55)
    for (let si = 0; si < 3; si++) for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      if (sections[si].get(x, y, z) !== MAT.SHELF_FUNGUS) continue
      brackets++
      if (si * S + y >= forkY - 1) aboveFork++
    }
  }
  ok(trees > 20 && brackets >= trees * 2, `forking trunks carry stacks on the stem too (${brackets} brackets on ${trees} trees)`)
  ok(aboveFork === 0, `and never at or above the fork (${aboveFork})`)
}

// ── 4. real columns: the renderer's reader agrees with a brute-force scan, and finds a trunk ───
{
  let cells = 0, cols = 0, disagree = 0, faceless = 0
  const grid = new Map<string, ReturnType<typeof makeColumn>>()
  const col = (cx: number, cz: number) => {
    const k = `${cx},${cz}`
    let c = grid.get(k)
    if (!c) { c = makeColumn(cx * SECTION, cz * SECTION, SEED); grid.set(k, c) }
    return c
  }
  const voxel = (x: number, y: number, z: number) => {
    const cx = Math.floor(x / SECTION), cz = Math.floor(z / SECTION)
    return col(cx, cz).get(x - cx * SECTION, y, z - cz * SECTION)
  }
  // A woodland stretch — the forest mask is where the trunks are.
  for (let cz = 20; cz < 26; cz++) for (let cx = 20; cx < 26; cx++) {
    const c = col(cx, cz)
    cols++
    const found = scanShelves(c, cx * SECTION, cz * SECTION, voxel)
    // Brute force, the other way round: every cell, ask the column.
    const brute: string[] = []
    const H = c.sections.length * SECTION
    for (let y = 0; y < H; y++) for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++)
      if (c.get(x, y, z) === MAT.SHELF_FUNGUS) brute.push(`${cx * SECTION + x},${y},${cz * SECTION + z}`)
    const got = found.map(f => `${f.x},${f.y},${f.z}`).sort().join('|')
    if (got !== brute.sort().join('|')) disagree++
    for (const f of found) {
      cells++
      const [dx, dz] = SHELF_FACES[f.face]
      if (!isLogMat(voxel(f.x + dx, f.y, f.z + dz))) faceless++
    }
  }
  ok(cells > 0, `shelf fungi generate on real woodland columns (${cells} in ${cols} columns)`)
  ok(disagree === 0, `the reader finds exactly the cells a brute-force scan finds (${disagree} columns disagree)`)
  ok(faceless === 0, `every bracket's reported face points at a log — across the column border too (${faceless} did not)`)
}

console.log(`\nshelf: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
console.log(fails.length ? '❌ the shelf fungi are not where canon put them' : '✅ the shelf fungi hang on the trunks, and the renderer can find them')
if (fails.length) process.exit(1)
