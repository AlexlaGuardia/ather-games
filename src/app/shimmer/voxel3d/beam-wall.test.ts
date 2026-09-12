// ── THE BEAM WALL, AND THE VARIANTS THAT NEVER DREW — a runtime oracle over the piece renderer ──
// Run: npx tsx src/app/shimmer/voxel3d/beam-wall.test.ts
//
// Alex, 2026-09-12: "make a beam connect to adjacent beams to make a wall that's only half as thick
// as a regular block." Connection is derived at `sync` (the fence's model), so the thing to test is
// what one sync DRAWS for a given placement list — and `createPieceRenderer` is three.js objects
// with no GL context, so it runs under node exactly as it runs in the page.
//
// ★ AND THE BUG IT SURFACED: `sync` and `setGhost` looked meshes up by RAW id, and the renderer only
// builds one mesh per BASE shape. Every material variant placed since 08-27 wrote occupancy and drew
// nothing. Section 2 is that regression, pinned.
import { createPieceRenderer } from './piece-mesh'
import { type Placement, PIECES, pieceVariants } from '../voxel/pieces'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const at = (pieceId: string, x: number, z: number, y = 0): Placement => ({ pieceId, x, y, z, rot: 0 })
const draw = (ps: Placement[], solid?: (x: number, y: number, z: number) => boolean) => {
  const r = createPieceRenderer()
  r.setWorldSolid(solid ?? null)
  r.sync(ps)
  const s = r.stats()
  r.dispose()
  return s
}

console.log('\n── 1. ★★ beams that touch become a wall; a beam alone stays a beam ──')
{
  const lone = draw([at('beam', 0, 0)])
  ok(lone.pieces.beam === 1 && lone.wallPanels === 0 && lone.wallCores === 0, `a lone beam draws no panel and no core (${JSON.stringify(lone)})`)

  const pair = draw([at('beam', 0, 0), at('beam', 1, 0)])
  ok(pair.wallPanels === 2, `two beams side by side each emit their half-panel (saw ${pair.wallPanels})`)
  ok(pair.wallCores === 2, `...and both draw the 0.5 core (saw ${pair.wallCores})`)

  const run = draw([at('beam', 0, 0), at('beam', 1, 0), at('beam', 2, 0)])
  ok(run.wallPanels === 4 && run.wallCores === 3, `a run of three: 4 panels (2 joints × 2 halves), 3 cores (saw ${run.wallPanels}/${run.wallCores})`)

  const corner = draw([at('beam', 0, 0), at('beam', 1, 0), at('beam', 1, 1)])
  ok(corner.wallPanels === 4 && corner.wallCores === 3, `an L: the corner beam carries two panels and one core (saw ${corner.wallPanels}/${corner.wallCores})`)

  const diagonal = draw([at('beam', 0, 0), at('beam', 1, 1)])
  ok(diagonal.wallPanels === 0, 'diagonal beams do not connect — a wall is orthogonal')

  const stacked = draw([at('beam', 0, 0), at('beam', 0, 0, 1)])
  ok(stacked.wallPanels === 0, 'a beam above a beam is a taller upright, not a joint — panels are full height already')

  const apart = draw([at('beam', 0, 0), at('beam', 1, 0, 1)])
  ok(apart.wallPanels === 0, 'a beam one up and one over is not adjacent')
}

console.log('\n── 2. ★★ THE REGRESSION: a material variant draws, and ghosts, as its base shape ──')
{
  const stoneStair = pieceVariants('stair').find(v => v.id !== 'stair')!
  const s = draw([at(stoneStair.id, 0, 0)])
  ok(s.pieces.stair === 1, `★★ ${stoneStair.id} draws on the stair mesh (saw ${JSON.stringify(s.pieces)}) — it drew NOTHING before 09-12`)
  const stoneBeam = pieceVariants('beam').find(v => v.id !== 'beam')!
  const mixed = draw([at('beam', 0, 0), at(stoneBeam.id, 1, 0)])
  ok(mixed.wallPanels === 2, `a stone beam joins a wood beam into one wall (saw ${mixed.wallPanels})`)
  const stoneFence = pieceVariants('fence').find(v => v.id !== 'fence')!
  const fences = draw([at('fence', 0, 0), at(stoneFence.id, 1, 0)])
  ok(fences.fenceArms === 2, `a stone fence joins a wood fence (saw ${fences.fenceArms}) — it stood alone before 09-12`)

  const r = createPieceRenderer()
  r.setGhost(stoneStair.id, 0, 0, 0, 0, true)
  ok(r.ghost.visible, `★★ the ghost shows for ${stoneStair.id} — it hid before 09-12`)
  r.setGhost('nope', 0, 0, 0, 0, true)
  ok(!r.ghost.visible, 'and an unknown id still hides it rather than throwing')
  r.dispose()
}

console.log('\n── 3. ★★ the wall meets the world ──')
// Shipped, reversed, restored on 2026-09-12. The reversal was judged from a render in which the
// pole sat one cell from its panel (the pivot bug); with the pole honest, Alex asked for the world
// link back. A run of beams meets a block wall or a doorway flush.
{
  const solidAt = (sx: number, sz: number) => (x: number, y: number, z: number) => y === 0 && x === sx && z === sz
  const abut = draw([at('beam', 0, 0)], solidAt(1, 0))
  ok(abut.wallPanels === 1 && abut.wallCores === 1, `★★ a beam beside a solid block grows a panel to meet it flush (saw ${abut.wallPanels}/${abut.wallCores})`)
  const under = draw([at('beam', 0, 0)], (x, y) => y === -1)
  ok(under.wallPanels === 0, 'the ground under a beam is not a neighbour — only the four sides count')
  const boxed = draw([at('beam', 0, 0)], () => true)
  ok(boxed.wallPanels === 4 && boxed.wallCores === 1, 'solid on all four sides: four panels, one core')
  const fence = draw([at('fence', 0, 0)], solidAt(1, 0))
  ok(fence.fenceArms === 1, 'the fence reaches for the world the same way')
}

console.log('\n── 4. every base shape still has exactly one mesh ──')
{
  const r = createPieceRenderer()
  r.sync(PIECES.map((p, i) => at(p.id, i, 0)))
  const s = r.stats()
  ok(PIECES.every(p => s.pieces[p.id] === 1), `each of ${PIECES.length} bases drew once (${JSON.stringify(s.pieces)})`)
  r.dispose()
}

console.log(`\nbeam-wall: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
