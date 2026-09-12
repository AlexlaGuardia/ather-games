// ── A PIECE WEARS ITS MATERIAL'S BLOCK — the textured piece renderer, measured ──────────────────
// Run: npx tsx src/app/shimmer/voxel3d/piece-texture.test.ts
//
// Alex, 2026-09-12: "work on the beams textures.. a version for each of the solid blocks we
// already have." Two halves: the material axis grew to every masonry block (pieces.ts), and the
// renderer samples the world's tile array per instance instead of a flat tint per shape. This
// runs the real renderer under node with a stub tile array (the texture is only touched at
// shader compile, which node never reaches) and reads the per-instance layers back.
import * as THREE from 'three'
import { createPieceRenderer, pieceBlock, pieceLayers, pieceTint } from './piece-mesh'
import { PIECES, ALL_PIECES, PIECE_MATERIALS, pieceVariants, pieceMaterial, type Placement } from '../voxel/pieces'
import { materialForItem, blockDef } from '../voxel/registry'
import { layerOf, TOP, SIDE } from './tex/tiles'
import { hasTileArt } from './tex/item-icon'
import { MATERIAL_COLOR } from './attrs'
import { MAT } from '../voxel/depth'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const at = (pieceId: string, x: number, z: number): Placement => ({ pieceId, x, y: 0, z, rot: 0 })
const stubTiles = { texture: null as unknown as THREE.DataArrayTexture } as unknown as Parameters<typeof createPieceRenderer>[0]

console.log('\n── 1. ★★ every piece material is a block with tile art ──')
ok(PIECE_MATERIALS.length === 12, `BLIND CHECK: 12 materials on the axis (saw ${PIECE_MATERIALS.length})`)
for (const m of PIECE_MATERIALS) {
  const mat = materialForItem(m.itemId)
  ok(mat !== undefined && hasTileArt(mat), `${m.key}: ${m.itemId} places as a block with tile art`)
  ok(mat !== undefined && blockDef(mat)?.placeable === true, `${m.key}: the block is placeable — a solid the keeper already builds with`)
}
ok(new Set(PIECE_MATERIALS.map(m => materialForItem(m.itemId))).size === PIECE_MATERIALS.length, 'no two materials share a block')

console.log('\n── 2. every one of the 192 pieces resolves to atlas layers ──')
{
  let bad = 0
  for (const def of ALL_PIECES) { const l = pieceLayers(def.id); if (l.top < 0 || l.side < 0) bad++ }
  ok(bad === 0, `★ ${ALL_PIECES.length - bad}/${ALL_PIECES.length} pieces have layers`)
  ok(pieceBlock('stair') === MAT.CUT_STONE, 'a base piece wears the block of its own cost (stair → cut stone)')
  ok(pieceBlock('beam') === MAT.PLANKS_GOLDWOOD, 'beam → goldwood planks')
  ok(pieceBlock('beam_plaster') === MAT.PLASTER, 'beam_plaster → plaster')
  ok(pieceBlock('nope') === undefined, 'an unknown piece has no block, not a throw')
}

console.log('\n── 3. ★★ the renderer hands each instance its own layers ──')
{
  const r = createPieceRenderer(stubTiles)
  const stone = pieceVariants('beam').find(v => pieceMaterial(v.id)?.key === 'stonebrick')!
  const plaster = pieceVariants('beam').find(v => pieceMaterial(v.id)?.key === 'plaster')!
  r.sync([at('beam', 0, 0), at(stone.id, 1, 0), at(plaster.id, 5, 5)])
  const l0 = r.layersAt('beam', 0), l1 = r.layersAt('beam', 1), l2 = r.layersAt('beam', 2)
  ok(l0.side === layerOf(MAT.PLANKS_GOLDWOOD, SIDE) && l0.top === layerOf(MAT.PLANKS_GOLDWOOD, TOP), `instance 0 (goldwood) samples the plank layers (${JSON.stringify(l0)})`)
  ok(l1.side === layerOf(MAT.STONE_BRICK, SIDE), `★ instance 1 (stone brick) samples the stone-brick layer (${l1.side} vs ${layerOf(MAT.STONE_BRICK, SIDE)})`)
  ok(l2.side === layerOf(MAT.PLASTER, SIDE), `instance 2 (plaster) samples plaster (${l2.side})`)
  ok(l0.side !== l1.side && l1.side !== l2.side, 'three materials, three different layers, one mesh')
  // The wall the two touching beams make carries EACH beam's material, panel by panel.
  const s = r.stats()
  ok(s.wallPanels === 2 && s.wallCores === 2, `the goldwood and stone beams joined (${s.wallPanels} panels)`)
  const w0 = r.layersAt('wall', 0), w1 = r.layersAt('wall', 1)
  ok(w0.side === l0.side && w1.side === l1.side, `★ each half-panel wears its own beam's block (${w0.side}, ${w1.side})`)
  ok(r.layersAt('core', 0).side === l0.side && r.layersAt('core', 1).side === l1.side, 'and so does each core')
  r.dispose()

  // Fence arms too.
  const f = createPieceRenderer(stubTiles)
  const stoneFence = pieceVariants('fence').find(v => pieceMaterial(v.id)?.key === 'sandstone')!
  f.sync([at(stoneFence.id, 0, 0), at(stoneFence.id, 1, 0)])
  ok(f.layersAt('arm', 0).side === layerOf(MAT.SANDSTONE, SIDE), 'a sandstone fence\'s arms are sandstone')
  f.dispose()
}

console.log('\n── 4. without an atlas, the placeholder tints still draw (the fallback is not blank) ──')
{
  const r = createPieceRenderer(null)
  r.sync([at('beam', 0, 0)])
  ok(r.stats().pieces.beam === 1, 'a beam draws with no tiles')
  const inst = r.group.children.find(c => (c as THREE.InstancedMesh).isInstancedMesh && (c as THREE.InstancedMesh).count === 1) as THREE.InstancedMesh
  ok((inst.material as THREE.MeshLambertMaterial).color.getHex() !== 0xffffff, 'and it is tinted, not white')
  r.dispose()
}

console.log('\n── 5. the icon tint follows the material ──')
{
  const stoneStair = pieceVariants('stair').find(v => pieceMaterial(v.id)?.key === 'stonebrick')!
  const woodStair = pieceVariants('stair').find(v => pieceMaterial(v.id)?.key === 'goldwood')!
  ok(pieceTint(stoneStair) === MATERIAL_COLOR[MAT.STONE_BRICK], 'a stone-brick stair icon is stone-brick coloured')
  ok(pieceTint(woodStair) === MATERIAL_COLOR[MAT.PLANKS_GOLDWOOD], 'a goldwood stair icon is plank coloured')
  ok(pieceTint(stoneStair) !== pieceTint(woodStair), '★ two materials, two icon tints — they were one brown before')
}

console.log('\n── 6. the program samples the atlas with the world\'s own UV rule ──')
{
  const src = readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/piece-mesh.ts'), 'utf8')
  const atlas = readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/tex/atlas.ts'), 'utf8')
  ok(src.includes('uniform sampler2DArray uTiles;'), 'the piece program declares the tile array')
  ok(src.includes("(an.x > 0.5 ? vec2(vPPos.z, -vPPos.y) : vec2(vPPos.x, -vPPos.y))") && atlas.includes("(an.x > 0.5 ? vec2(vVoxPos.z, -vVoxPos.y) : vec2(vVoxPos.x, -vVoxPos.y))"),
    '★ the side-face uv rule is the atlas\'s, v negated — a painted tile lands upright on a piece as on a block')
  ok(src.includes('float layer = an.y > 0.5 ? vLayerTop : vLayerSide;'), 'top faces take the top layer, the rest the side')
  const host = codeOnly(readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx'), 'utf8'))
  ok(host.includes('createPieceRenderer(tiles)'), '★ the host hands the renderer the world\'s tile array')
}

console.log(`\npiece-texture: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
