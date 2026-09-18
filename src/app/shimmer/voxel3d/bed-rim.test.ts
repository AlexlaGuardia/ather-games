// bed-rim oracle — the frame is drawn only where a bed ends (2026-09-18).
// Run: npx tsx src/app/shimmer/voxel3d/bed-rim.test.ts
import { rimMask, EDGE_N, EDGE_E, EDGE_S, EDGE_W } from './bed-rim'
import { MAT } from '../voxel/depth'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { c ? pass++ : fails.push(m) }

const G = MAT.GARDEN_BED_GOLDWOOD, D = MAT.GARDEN_BED_DAWNWOOD
const world = (cells: Record<string, number>) => (x: number, y: number, z: number) => cells[`${x},${y},${z}`] ?? 0

// a lone bed: four rails, four posts
{
  const m = rimMask(world({ '0,0,0': G }), 0, 0, 0)
  ok(m.rails === (EDGE_N | EDGE_E | EDGE_S | EDGE_W), 'a lone bed is framed on all four sides')
  ok(m.posts === 0b1111, 'and posted on all four corners')
}
// two beds in a row along x: no rail on the shared edge, no post at the shared corners
{
  const r = world({ '0,0,0': G, '1,0,0': G })
  const a = rimMask(r, 0, 0, 0), b = rimMask(r, 1, 0, 0)
  ok(!(a.rails & EDGE_E) && !(b.rails & EDGE_W), '★ the shared edge carries no rail — two beds are one bed')
  ok((a.rails & (EDGE_N | EDGE_S | EDGE_W)) === (EDGE_N | EDGE_S | EDGE_W), 'the left bed keeps its three outer rails')
  ok(a.posts === (0b1000 | 0b0100), 'the left bed posts only its two OUTER corners (NW, SW)')
  ok(b.posts === (0b0001 | 0b0010), 'the right bed posts only NE, SE')
}
// a 3×6 rectangle: interior cells carry nothing; the perimeter carries exactly 2·(3+6) rails
{
  const cells: Record<string, number> = {}
  for (let x = 0; x < 6; x++) for (let z = 0; z < 3; z++) cells[`${x},0,${z}`] = G
  const r = world(cells)
  let rails = 0, posts = 0
  for (let x = 0; x < 6; x++) for (let z = 0; z < 3; z++) {
    const m = rimMask(r, x, 0, z)
    rails += (m.rails & 1) + ((m.rails >> 1) & 1) + ((m.rails >> 2) & 1) + ((m.rails >> 3) & 1)
    posts += (m.posts & 1) + ((m.posts >> 1) & 1) + ((m.posts >> 2) & 1) + ((m.posts >> 3) & 1)
  }
  ok(rimMask(r, 2, 0, 1).rails === 0 && rimMask(r, 2, 0, 1).posts === 0, 'an interior cell of a 3×6 draws nothing')
  ok(rails === 2 * (3 + 6), `★ a 3×6 bed is one rectangle: ${rails} rails around it (18)`)
  ok(posts === 4, `and four corner posts (${posts})`)
}
// different woods do NOT merge; a non-bed neighbour (dirt, air) is an edge
{
  const r = world({ '0,0,0': G, '1,0,0': D, '0,0,1': MAT.TOPSOIL })
  ok(!!(rimMask(r, 0, 0, 0).rails & EDGE_E), 'a dawnwood bed beside a goldwood bed keeps the seam — different timbers')
  ok(!!(rimMask(r, 0, 0, 0).rails & EDGE_S), 'topsoil beside a bed is an edge')
}
// a bed one level up is not a neighbour
{
  const r = world({ '0,0,0': G, '1,1,0': G })
  ok(!!(rimMask(r, 0, 0, 0).rails & EDGE_E), 'a bed a step higher does not join — the rim follows the level')
}

if (fails.length) { console.log(fails.map(f => `  ✗ ${f}`).join('\n')); console.log(`❌ bed-rim ${fails.length} failed, ${pass} passed`); process.exit(1) }
console.log(`✅ bed-rim ${pass}/0`)
