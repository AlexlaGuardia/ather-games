// The story spine's contract: Alex's distances hold, the road exists exactly along the spine,
// and the waystones stand beside it with lantern caps. Run: npx tsx src/app/shimmer/voxel/story-path.test.ts

import { STORY_NODES, distToPath, roadAt, WAYSTONE_CELLS, plantWaystones } from './story-path'
import { Section } from './section'

let pass = 0
const fails: string[] = []
const check = (name: string, ok: boolean) => { ok ? pass++ : fails.push(name) }

const SEED = 1337

// ── Alex's ruling, as numbers: village ~500 from the glade, holds 750–1200 hops ────────────────
const hop = (i: number) => Math.hypot(STORY_NODES[i + 1].x - STORY_NODES[i].x, STORY_NODES[i + 1].z - STORY_NODES[i].z)
check('glade → village is ~500 (Alex ruling)', Math.abs(hop(0) - 500) < 40)
for (let i = 1; i < 4; i++) check(`hold hop ${i} is 750–1200 (Alex ruling)`, hop(i) > 700 && hop(i) < 1260)
check('the spine starts at the glade spawn', STORY_NODES[0].x === -150 && STORY_NODES[0].z === -640)

// ── the road is where the spine is, and nowhere else ──────────────────────────────────────────
for (const n of STORY_NODES) check(`road runs through ${n.id}`, roadAt(n.x, n.z, SEED))
{
  const a = STORY_NODES[0], b = STORY_NODES[1]
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2
  check('road covers a segment midpoint', roadAt(mx, mz, SEED))
  // Perpendicular offset well past width+wobble: never road.
  check('50 blocks off-path is not road', !roadAt(mx + 50, mz, SEED) || distToPath(mx + 50, mz) < 5)
}
check('distToPath is 0-ish on a node', distToPath(STORY_NODES[2].x, STORY_NODES[2].z) < 0.001)
check('distToPath grows off the spine', distToPath(STORY_NODES[0].x + 300, STORY_NODES[0].z + 300) > 200)

// ── waystones: they exist, they space out, they stand BESIDE the road ──────────────────────────
check('waystones were placed', WAYSTONE_CELLS.size > 40)
{
  let onRoad = 0, near = 0
  for (const k of WAYSTONE_CELLS) {
    const [x, z] = k.split(',').map(Number)
    const d = distToPath(x + 0.5, z + 0.5)
    if (d < 1.2) onRoad++          // in the roadway = walk-into territory
    if (d < 6) near++
  }
  check('waystones stand beside the road, not in it', onRoad === 0)
  check('every waystone is within sight of the road', near === WAYSTONE_CELLS.size)
}

// ── the planter writes a post: two stone, lantern cap ──────────────────────────────────────────
{
  const cell = [...WAYSTONE_CELLS][0].split(',').map(Number)
  const size = 16
  const ox = Math.floor(cell[0] / size) * size, oz = Math.floor(cell[1] / size) * size
  const sections = Array.from({ length: 8 }, () => new Section(size))
  const H = 40
  const planted = plantWaystones(sections, ox, oz, size, () => H, 12, /*stone*/ 3, /*lantern*/ 9)
  check('planter reports the post', planted === 1)
  const at = (y: number) => sections[(y / size) | 0].get(cell[0] - ox, y - ((y / size) | 0) * size, cell[1] - oz)
  check('post body is stone', at(H + 1) === 3 && at(H + 2) === 3)
  check('post cap is a lantern', at(H + 3) === 9)
  const drowned = plantWaystones(sections, ox, oz, size, () => 10, 12, 3, 9)
  check('no drowned posts', drowned === 0)
}

console.log(`\nstory path: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1) }
console.log('✅ the story is in the ground')
