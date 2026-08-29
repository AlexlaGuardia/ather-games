// The ruin-equivalence hash — proof that a change to `jigsaw.ts` regenerated nothing.
//
// ★★★ WHY THIS EXISTS AS A COMMITTED TOOL AND NOT AS A ONE-OFF. `jigsaw.ts`'s header carries a
// standing claim: *"Equivalence was proven by hashing `ruinPlan` over 641 sites before and after:
// `dc703495d76c5250eaf1`, unchanged."* That is exactly right to have done and **nothing in the tree
// could check it** — the hash was produced ad hoc and the site set was never written down. A
// citation nobody can open retires the question instead of answering it, which this codebase has
// paid for before (a doc naming a test file that never existed). So the procedure is a script now.
//
// ⚠⚠ THIS CANNOT VERIFY THE HISTORICAL FIGURE, AND MUST NOT BE READ AS DOING SO. The recorded hash
// depends on which 641 sites were walked, and that was not recorded. What this proves is BEFORE vs
// AFTER for one change, using one site set, held fixed across the two runs. That is the property
// that actually matters — "did my edit move any ruin" — and it is the one the header was asserting.
// The figure below is this script's own baseline, and it is only meaningful against itself.
//
// Run: npx tsx scripts/ruin-hash.mts
import { createHash } from 'node:crypto'
import { siteAt } from '../src/app/shimmer/voxel/sites'
import { ruinPlan } from '../src/app/shimmer/voxel/ruins'

const SEED = 1337
/** The same slab `ruins.test.ts` walks, so the two agree about what "the ruins" are. */
const RANGE = 60

const sites = []
for (let cz = -RANGE; cz <= RANGE; cz++) for (let cx = -RANGE; cx <= RANGE; cx++) {
  const s = siteAt(SEED, cx, cz)
  if (s) sites.push(s)
}

// ⚠ SORTED BY COORDINATE, NOT BY DISCOVERY ORDER. The scan order above is an implementation detail
// of this script; a hash keyed on it would change if anyone reordered the loops and would report a
// regeneration that never happened — a false alarm on the one tool whose job is to rule one out.
sites.sort((a, b) => a.x - b.x || a.z - b.z)

const h = createHash('sha1')
let parts = 0
for (const s of sites) {
  for (const p of ruinPlan(s, SEED)) {
    h.update(`${p.def.id}@${p.x0},${p.z0},${p.x1},${p.z1},${p.floor}`)
    // Doors are part of the assembly's identity: a change that moved one and nothing else would
    // otherwise hash identical, and a bricked-up doorway is precisely this file's cautionary tale.
    for (const d of p.doors) h.update(`|${d.x},${d.z}`)
    h.update(';')
    parts++
  }
}

console.log(`sites   ${sites.length}`)
console.log(`parts   ${parts}`)
console.log(`hash    ${h.digest('hex').slice(0, 20)}`)
console.log(`\n⚠ compare this against the SAME script before and after a jigsaw change.`)
console.log(`  It cannot reproduce the header's historical figure — that site set was never recorded.`)
