// Tree-node oracle. Run: npx tsx src/app/shimmer/voxel/tree-node.test.ts
//
// The node model replaces a hundred block breaks with one act, and the dangerous failures are all
// ECONOMIC — they do not throw, they do not look wrong, they just quietly change what the world
// pays. A tree that pays one log instead of nine leaves every recipe intact and every build
// unaffordable. A drop table that hands you the thing you were meant to refine leaves the refine
// recipe working and pointless. Neither shows up as a bug report; both show up as "the game feels
// grindy now", weeks later.

import { SPECIES, trunkVoxels, DEFAULT_TREES, treeStartsAt, type TreeStart } from './trees'
import { SECTION } from './column'
import { blockDef } from './registry'
import { RECIPES } from './recipes'
import { TREE_NODES, treeId, isStanding, fellTree, fellXP, logItem, saplingItem, speciesMissingNode, treeOwning } from './tree-node'
import { trunkCells } from './trees'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const startFor = (id: string, height: number): TreeStart => ({
  x: 10, z: 20, species: SPECIES.find(s => s.id === id)!, height, seed: 12345,
})
/** A roll sequence that always hits, and one that never does. */
const always = () => 0
const never = () => 0.999999

// ── 1. ★★ THE ECONOMY IS UNCHANGED — a node pays exactly what chopping it paid ────────────────
// This is the assert the whole model rests on. Before today a trunk was felled log voxel by log
// voxel and each one dropped a log; the building grammar Alex shipped is priced against that. If
// the node pays anything else the prices are all wrong and NOTHING in the code looks broken.
{
  let checked = 0, mismatched = 0, worst = ''
  for (const sp of SPECIES) {
    for (let h = sp.minHeight; h <= sp.maxHeight; h++) {
      const start = startFor(sp.id, h)
      const { drops } = fellTree(start, never)
      const logs = drops.find(d => d.itemId === logItem(sp.id))
      checked++
      if (!logs || logs.count !== trunkVoxels(start)) {
        mismatched++
        worst = `${sp.id} h${h}: paid ${logs?.count ?? 0}, trunk is ${trunkVoxels(start)}`
      }
    }
  }
  ok(checked > 20, `the payout check covered every species and height (${checked})`)
  ok(mismatched === 0, `★ a felled tree pays one log per trunk voxel, exactly as chopping did (${worst})`)
  // ⚠ And the forking species is the one that would be underpaid by a naive `height` — starwillow
  // is a stem plus TWO limbs, so it carries more wood than it is tall. Asserted explicitly because
  // "logs === height" passes for three species out of four and looks completely correct.
  const sw = startFor('starwillow', 12)
  ok(trunkVoxels(sw) > sw.height,
    `★ starwillow's two limbs are counted, not just its height (${trunkVoxels(sw)} vs ${sw.height})`)
  const gw = startFor('goldwood', 9)
  ok(trunkVoxels(gw) === gw.height, 'a straight trunk is exactly its height')
}

// ── 2. ★ THE RNG DOES NOT COMPETE WITH THE REFINE STEP ───────────────────────────────────────
// Alex ruled a log's only purpose is refining. A drop table that hands out the refine OUTPUT for
// free is a designed step deleted by accident. The secondaries are deliberately kept at their canon
// chances, so this asserts the weaker claim that actually matters: refining is strictly the better
// route for the same item.
{
  for (const sp of SPECIES) {
    const def = TREE_NODES[sp.id]
    if (!def) continue
    const recipe = RECIPES.find(r =>
      r.input.some(i => i.itemId === logItem(sp.id)) && r.output.itemId === def.secondary.itemId)
    if (!recipe) {
      // dawnwood's crystallized_sap has no refine route at all — nothing to undercut.
      ok(true, `${sp.id}'s secondary has no competing recipe`)
      continue
    }
    const perFelling = def.secondary.chance                     // expected count from one tree
    const perLog = recipe.output.count                          // guaranteed, per log, on demand
    ok(perLog > perFelling,
      `★ refining beats the drop for ${def.secondary.itemId} (${perLog}/log vs ${perFelling} expected/tree)`)
  }
  // The sapling is the opposite case and must stay that way: no recipe, so felling is its ONLY
  // source and the forestry loop has exactly one way to close.
  for (const sp of SPECIES) {
    const made = RECIPES.some(r => r.output.itemId === saplingItem(sp.id))
    ok(!made, `★ a ${sp.id} sapling cannot be crafted — felling is its only source`)
  }
}

// ── 3. the payout itself ─────────────────────────────────────────────────────────────────────
{
  const start = startFor('goldwood', 8)
  const lucky = fellTree(start, always)
  ok(lucky.drops.length === 3, `a lucky felling pays logs + secondary + sapling (${lucky.drops.length})`)
  ok(lucky.drops.some(d => d.itemId === 'goldwood_bark'), 'the secondary is the species\' own')
  ok(lucky.drops.some(d => d.itemId === 'goldwood_sapling'), 'the sapling is the species\' own')
  const unlucky = fellTree(start, never)
  ok(unlucky.drops.length === 1, 'an unlucky felling still pays its wood — a tree is never a waste')
  ok(unlucky.xp === lucky.xp, 'XP is for the act, not the luck')

  // ⚠ Rolls are consumed in a FIXED ORDER whatever hits, so a payout can be reproduced from a seed.
  // A sequence whose second roll is only drawn when the first one misses is unreproducible.
  let n = 0
  fellTree(start, () => { n++; return 0.5 })
  let m = 0
  fellTree(start, () => { m++; return 0.01 })
  ok(n === m, `★ the same number of rolls is drawn whether drops hit or miss (${n} vs ${m})`)
}

// ── 4. XP tracks rarity, on canon's ladder ───────────────────────────────────────────────────
// ⚠ These numbers are a SECOND copy of canon's (world/resources.ts is outside voxel/ and this is
// pure core). So the oracle pins the SHAPE — the ladder — rather than the file, which is the part
// that would actually be wrong if someone retuned one without the other.
{
  // ★★ XP HAD THE SAME CONTINUITY TRAP THE LOG COUNT DID. Canon pays a FLAT 20/50/120/300 per
  // harvest, written for a game where one harvest was one node. Chopping here paid per block, so a
  // goldwood was worth ~136 and a dawnwood ~615. Taking canon's numbers would have cut forestry
  // progression ~85% inside a commit about drop tables, and the only symptom would be "levelling
  // feels slow now" — untraceable, weeks later. So this asserts the OLD yield, not canon's.
  const perBlock = (h: number) => Math.max(4, Math.round(h * 12))
  let worstXp = ''
  let xpWrong = 0
  for (const sp of SPECIES) {
    const hardness = blockDef(sp.log)!.hardness
    for (let h = sp.minHeight; h <= sp.maxHeight; h++) {
      const start = startFor(sp.id, h)
      const expected = trunkCells(start, 0).length * perBlock(hardness)
      if (fellXP(start) !== expected) { xpWrong++; worstXp = `${sp.id} h${h}: ${fellXP(start)} vs ${expected}` }
    }
  }
  ok(xpWrong === 0, `★ felling pays exactly what chopping block-by-block paid (${worstXp})`)
  const canonFlat = [20, 50, 120, 300]
  ok(SPECIES.every((sp, i) => fellXP(startFor(sp.id, sp.maxHeight)) > canonFlat[i]),
    '★ and it is NOT canon\'s flat per-node ladder, which would be an ~85% progression cut')

  const xp = SPECIES.map(s => fellXP(startFor(s.id, s.maxHeight)))
  ok(xp.every((v, i) => i === 0 || v > xp[i - 1]), `★ rarer wood pays more XP (${xp.join(' < ')})`)
  const sap = SPECIES.map(s => TREE_NODES[s.id]?.saplingChance ?? 0)
  ok(sap.every((v, i) => i === 0 || v < sap[i - 1]),
    `★ the rarer the tree, the rarer its sapling (${sap.join(' > ')})`)
  ok(speciesMissingNode().length === 0,
    `every species has a node def (missing ${speciesMissingNode().map(s => s.id).join(',')})`)
}

// ── 5. ★ IDENTITY IS POSITION, AND IT MUST SURVIVE A TUNING PASS ─────────────────────────────
// The felled set is keyed on this. An id derived from anything that retuning can move — the seed,
// the species, the height — resurrects every felled tree in the world the next time somebody
// changes a weight. Position is the one thing about a planted tree that cannot change.
{
  const a = startFor('goldwood', 6)
  const b = { ...a, height: 15, seed: 99, species: SPECIES[3] }
  ok(treeId(a) === treeId(b), '★ an id survives a change of height, seed and species')
  const c = { ...a, x: a.x + 1 }
  ok(treeId(a) !== treeId(c), 'two trees one block apart are different trees')

  // Real world starts, so the uniqueness claim is tested against `in_square` rather than asserted.
  const ids = new Set<string>()
  let total = 0
  for (let cx = 40; cx < 60; cx++) for (let cz = 0; cz < 20; cz++)
    for (const st of treeStartsAt(1337, cx, cz, SECTION, DEFAULT_TREES)) { total++; ids.add(treeId(st)) }
  ok(total > 300, `sampled real trees for the id check (${total})`)
  // ⚠ NOT `ids.size === total`: two trees CAN legitimately roll the same cell in one column, and
  // then they are one felling. What must never happen is trees in DIFFERENT columns colliding,
  // which is what in_square guarantees — so the bound is "almost all distinct", and a broken id
  // (say, one derived from the column) would collapse this to a handful.
  ok(ids.size > total * 0.95, `★ tree ids are unique across columns (${ids.size} of ${total})`)

  const felled: Record<string, true> = {}
  ok(isStanding(felled, a), 'a tree starts standing')
  felled[treeId(a)] = true
  ok(!isStanding(felled, a), 'and stays felled once it is in the set')
  ok(isStanding(felled, c), 'felling one tree does not fell its neighbour')
}

// ── 6. the drops resolve to real items ───────────────────────────────────────────────────────
// A drop table naming an item nothing else knows about is a payout that vanishes into the
// inventory. Logs are checkable against the block registry they used to come from.
{
  for (const sp of SPECIES) {
    const def = blockDef(sp.log)
    ok(def?.drops[0]?.itemId === logItem(sp.id),
      `★ the node pays the same log id the block did (${sp.id}: ${def?.drops[0]?.itemId})`)
    const refine = RECIPES.some(r => r.input.some(i => i.itemId === logItem(sp.id)))
    ok(refine, `★ ${sp.id}'s log has a refine route — Alex's ruling is that this is its only use`)
  }
}

// ── 7. ★ THE CELLS THE FELL VERB REMOVES ARE THE CELLS THE TREE HAS ──────────────────────────
// `trunkVoxels` (what you are PAID) and `trunkCells` (what is TAKEN AWAY) must be the same tree, or
// the player is paid for wood the world keeps — or loses a trunk they were not paid for. They are
// one function now; this pins that they stay one.
{
  let wrong = 0
  for (const sp of SPECIES) for (let h = sp.minHeight; h <= sp.maxHeight; h++) {
    const start = startFor(sp.id, h)
    const cells = trunkCells(start, 40)
    const { drops } = fellTree(start, never)
    if (cells.length !== drops[0].count) wrong++
    // Every cell distinct: a forking walk that revisited a cell would pay twice for one block.
    if (new Set(cells.map(c => `${c.x},${c.y},${c.z}`)).size !== cells.length) wrong++
    // And it stands ON the ground it was given, never in it.
    if (cells.some(c => c.y <= 40)) wrong++
  }
  ok(wrong === 0, `★ payout, removal and ground all agree about the trunk (${wrong} disagreements)`)
}

// ── 8. ★ THE OWNER RESOLVER FINDS THE TREE UNDER THE RETICLE ─────────────────────────────────
// The step between "the player hit a voxel" and "a tree falls". The failure worth guarding is
// narrow and species-specific: starwillow's limbs lean OUT of the column that rolled the trunk, so
// a search that only looks at the local column finds three species and quietly misses the fourth —
// which reads as "sometimes chopping does nothing".
{
  const SEED = 1337
  const ground = () => 40
  let found = 0, missed = 0, leaned = 0, missedLean = 0
  for (let cx = 40; cx < 48; cx++) for (let cz = 0; cz < 8; cz++) {
    for (const st of treeStartsAt(SEED, cx, cz, SECTION, DEFAULT_TREES)) {
      for (const c of trunkCells(st, 40)) {
        const owner = treeOwning(SEED, SECTION, c.x, c.y, c.z, ground)
        const outOfColumn = Math.floor(c.x / SECTION) !== cx || Math.floor(c.z / SECTION) !== cz
        if (outOfColumn) leaned++
        if (owner && owner.start.x === st.x && owner.start.z === st.z) found++
        else { missed++; if (outOfColumn) missedLean++ }
      }
    }
  }
  ok(found > 200, `the resolver was asked about real trunk cells (${found})`)
  ok(leaned > 0, `★ some limbs really do lean out of their own column (${leaned} cells — a test that never leaves the column proves nothing)`)
  ok(missed === 0, `★ every trunk cell resolves to its own tree (${missed} missed, ${missedLean} of them leaning)`)
  ok(treeOwning(SEED, SECTION, 99999, 41, 99999, ground) === null, 'empty ground owns nothing')
  ok(treeOwning(SEED, SECTION, 0, 41, 0, () => null) === null, 'an unloaded column cannot own a cell')
}

console.log(`\ntree-node: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
else console.log('✅ a tree is one thing, and it pays what it always paid')
