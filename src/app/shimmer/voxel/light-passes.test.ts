// The light-passes rule. Run: npx tsx src/app/shimmer/voxel/light-passes.test.ts
//
// Alex, 2026-09-12: "the block under it is still getting that heavy shadow." A piece's cell is
// STRUCTURE, and the flood read it as rock. This pins the rule AND the flood's behaviour with it:
// a post over grass must leave the grass lit. The flood is pure, so it runs here as it runs live.
import { lightOpaque, LIGHT_PASSES } from './light-passes'
import { STRUCTURE, STRUCTURE_HALF } from './pieces'
import { WOOD } from './trees'
import { MAT } from './depth'
import { AIR } from './section'
import { computeLight, type LightBounds } from './light'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

ok(!lightOpaque(AIR), 'air passes')
ok(!lightOpaque(MAT.WATER), 'water passes')
ok(!lightOpaque(WOOD.GOLDWOOD_LEAVES), 'leaves pass')
ok(!lightOpaque(STRUCTURE), '★★ a piece cell passes — a post must not black out its footprint')
ok(!lightOpaque(STRUCTURE_HALF), '★★ a half-height piece cell passes too')
ok(lightOpaque(MAT.STONE), 'stone stops')
ok(LIGHT_PASSES.has(STRUCTURE) && LIGHT_PASSES.has(STRUCTURE_HALF), 'both piece ids are in the set the host reads')

// ── the flood, with a post standing on flat ground ────────────────────────────────────────────
// A 5×8×5 box: ground at y<=2, a STRUCTURE cell at (2,3,2), open sky above. The cell the post
// occupies and the ground face under it must both read as daylight.
{
  const b: LightBounds = { x0: 0, y0: 0, z0: 0, sx: 5, sy: 8, sz: 5 }
  const at = (x: number, y: number, z: number) => (y <= 2 ? MAT.STONE : (x === 2 && y === 3 && z === 2 ? STRUCTURE : AIR))
  const field = computeLight(b, {
    opaque: (x, y, z) => lightOpaque(at(x, y, z)),
    emit: () => 0,
    windBlocks: (x, y, z) => at(x, y, z) !== AIR,
    openToSky: (_x, _z, y) => y > 2,
  })
  const sky = field.sky
  ok(sky(2, 3, 2) === sky(0, 3, 0), `★★ the post's own cell is as bright as open air beside it (${sky(2, 3, 2)} vs ${sky(0, 3, 0)})`)
  ok(sky(2, 3, 2) > 0, 'and it is not zero')
  // The regression, stated as the old behaviour: with the cell opaque, it reads 0.
  const dark = computeLight(b, {
    opaque: (x, y, z) => at(x, y, z) !== AIR,
    emit: () => 0, windBlocks: (x, y, z) => at(x, y, z) !== AIR, openToSky: (_x, _z, y) => y > 2,
  })
  ok(dark.sky(2, 3, 2) === 0, 'control: an OPAQUE cell there reads 0 — that was the heavy shadow')
}

console.log(`light-passes: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
