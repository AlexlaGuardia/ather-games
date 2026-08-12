// Print a vertical CROSS-SECTION of one tree, per species, at min and max height.
//
// Run: npx tsx scripts/tree-profile.mts [species...]        (default: every species)
//
// ── ★ WHY THIS EXISTS (2026-08-12) ─────────────────────────────────────────────────────────────
// Alex: "the trees still look like the old umbrellas." I fixed the canopy, took a headless
// screenshot, saw a clear improvement and very nearly stopped there. Printing the actual voxels
// instead showed two things the screenshot could not:
//
//   1. the crown was 77 sparse, visibly LOPSIDED voxels — the outer-shell nibble was eating the
//      crown's BODY, not fraying its rim. At screenshot distance that reads as "nicely ragged".
//   2. the droop strands I had just added were leaving SINGLE LEAVES FLOATING two blocks under a
//      nibbled hole. A defect I introduced, in the same commit, invisible at 30 blocks.
//
// A canopy is a few hundred voxels. Rendering it, lighting it, and photographing it to find out
// what shape it is, is the impressive indirect answer; `console.log` is the cheap direct one.
// **Run this before and after any change to `trees.ts`.** It costs a second and it is ground truth.
//
// ⚠ It draws the slice through the trunk's own z, so a `forking` species (starwillow) shows its
// stem and whichever limb happens to lie in that plane — not the full silhouette. Blob species,
// which are 84% of the forest by weight, read exactly.

import { Section, AIR } from '../src/app/shimmer/voxel/section'
import { SPECIES, growTree, isLeafMat, type TreeStart } from '../src/app/shimmer/voxel/trees'

const S = 32
const GROUND = 3
const secs = [new Section(S), new Section(S)]
// `growTree` takes the column-writer context; it is not exported, and it does not need to be — the
// shape is four fields and inventing a stack here keeps the generator's own surface small.
const ctx = { sections: secs, ox: 0, oy0: 0, oz: 0, size: S, yTop: 2 * S }

const want = process.argv.slice(2)
const picked = want.length ? SPECIES.filter(s => want.includes(s.id)) : SPECIES
if (!picked.length) {
  console.error(`no such species. known: ${SPECIES.map(s => s.id).join(', ')}`)
  process.exit(1)
}

const at = (x: number, y: number, z: number): number => {
  const si = (y / S) | 0
  return secs[si].get(x, y - si * S, z)
}

for (const sp of picked) {
  for (const height of [sp.minHeight, sp.maxHeight]) {
    for (const s of secs) s.data.fill(0)
    const st: TreeStart = { x: 16, z: 16, species: sp, height, seed: 0xbeef + height }
    growTree(ctx as never, st, GROUND)

    let leaves = 0, logs = 0, top = 0
    for (let y = 0; y < 2 * S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const m = at(x, y, z)
      if (m === AIR) continue
      if (isLeafMat(m)) leaves++; else logs++
      if (y > top) top = y
    }
    // Crown height vs total height is the umbrella number: a broadleaf wants roughly half, and the
    // parasol this script was written to diagnose was sitting at one third.
    let crownLo = 2 * S
    for (let y = 0; y < 2 * S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++)
      if (isLeafMat(at(x, y, z)) && y < crownLo) crownLo = y
    const total = top - GROUND
    const crown = top - crownLo + 1

    const squash = sp.squash === undefined ? 'n/a' : String(sp.squash)
    console.log(`\n── ${sp.id}  h=${height}  r=${sp.radius}  ${sp.foliage}/${sp.trunk}  squash=${squash} ──`)
    console.log(`   ${leaves} leaf + ${logs} log voxels · tree ${total} tall · crown ${crown} ` +
                `(${Math.round(crown / total * 100)}% of height)`)
    for (let y = top; y >= GROUND; y--) {
      let row = ''
      for (let x = 16 - 7; x <= 16 + 7; x++) {
        const m = at(x, y, 16)
        row += m === AIR ? ' ·' : isLeafMat(m) ? ' #' : ' ▓'
      }
      console.log(`  y${String(y).padStart(2)} |${row}`)
    }
  }
}
