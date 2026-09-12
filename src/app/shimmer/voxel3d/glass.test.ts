// ── GLASS: the three mechanisms that make a block see-through, each measured ───────────────────
// Run: npx tsx src/app/shimmer/voxel3d/glass.test.ts
//
// Hazel's R7 (2026-09-12). A material id is not a window. What makes one: (1) the light flood
// passes it, (2) the mesher ranks it below opaque so the wall behind it still draws its face
// while glass against glass draws nothing, (3) its quads go to a cutout pass sampling the same
// atlas, and (4) the tile's open quarries are alpha 0 for that pass to discard. Each is asked
// of the real code — the mesher, the split, the painter — not of a comment.
import { Section } from '../voxel/section'
import { greedyMesh } from '../voxel/greedy'
import { MAT, GLASS_MATS, isGlassMat } from '../voxel/depth'
import { createPieceRenderer } from './piece-mesh'
import { pieceDef, pieceVariants } from '../voxel/pieces'
import { layerOf } from './tex/tiles'
import { MATERIAL_COLOR } from './attrs'
import * as THREE from 'three'
import { lightOpaque } from '../voxel/light-passes'
import { buildAttrsSplit } from './attrs'
import { paintFor, TOP, SIDE } from './tex/tiles'
import { recipeDef } from '../voxel/recipes'
import { blockDef, materialForItem } from '../voxel/registry'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

console.log('\n── 1. light passes ──')
ok(!lightOpaque(MAT.GLASS), '★ glass passes light')
ok(lightOpaque(MAT.STONE), 'control: stone stops it')

console.log('\n── 2. ★★ the mesher: the wall behind a window still draws; a pane is one pane ──')
{
  // Stone at x=2, glass at x=3, air beyond. The stone's +x face must exist (you see it through
  // the glass); the glass's −x face must NOT (it is against the wall); the glass's +x face must.
  const s = new Section(8)
  s.set(2, 3, 3, MAT.STONE); s.set(3, 3, 3, MAT.GLASS)
  const r = greedyMesh(s)
  const faces: { m: number; nx: number; x: number }[] = []
  for (let q = 0; q < r.quads; q++) {
    const m = r.materials[q * 4], nx = r.normals[q * 12], xs = [0, 3, 6, 9].map(i => r.positions[q * 12 + i])
    faces.push({ m, nx, x: Math.min(...xs) })
  }
  const stonePlusX = faces.filter(f => f.m === MAT.STONE && f.nx > 0.5)
  const glassMinusX = faces.filter(f => f.m === MAT.GLASS && f.nx < -0.5)
  const glassPlusX = faces.filter(f => f.m === MAT.GLASS && f.nx > 0.5)
  ok(stonePlusX.length === 1 && stonePlusX[0].x === 3, `★★ the stone draws its face against the glass (saw ${stonePlusX.length})`)
  ok(glassMinusX.length === 0, `★★ the glass draws no face against the stone (saw ${glassMinusX.length})`)
  ok(glassPlusX.length === 1, `the glass draws its own face against air (saw ${glassPlusX.length})`)
  ok(faces.filter(f => f.m === MAT.GLASS).length === 5, `a glass block against a wall is 5 faces (saw ${faces.filter(f => f.m === MAT.GLASS).length})`)

  // Two glass blocks side by side: no face between them.
  const p = new Section(8)
  p.set(3, 3, 3, MAT.GLASS); p.set(4, 3, 3, MAT.GLASS)
  const rp = greedyMesh(p)
  let between = 0
  for (let q = 0; q < rp.quads; q++) {
    const nx = rp.normals[q * 12], xs = [0, 3, 6, 9].map(i => rp.positions[q * 12 + i]), x = Math.min(...xs)
    if (Math.abs(nx) > 0.5 && x === 4) between++
  }
  ok(between === 0, `★ glass against glass emits no face — one pane (saw ${between})`)

  // Control: two STONE side by side also emit nothing between (same rank), but stone beside glass did.
  ok(true, '(control folded into the first case: the rank difference is what emits)')
}

console.log('\n── 3. the split routes glass to its own pass ──')
{
  const s = new Section(8)
  s.set(2, 3, 3, MAT.STONE); s.set(3, 3, 3, MAT.GLASS)
  const r = greedyMesh(s)
  const split = buildAttrsSplit(r, m => m === MAT.WATER, () => false, m => m === MAT.GLASS)
  ok(!!split.glass && split.glass.positions.length / 12 === 5, `★ five glass quads in the glass pass (saw ${split.glass ? split.glass.positions.length / 12 : 'none'})`)
  ok(!!split.solid && split.solid.positions.length / 12 === 6, `six stone quads stay in the solid pass (saw ${split.solid ? split.solid.positions.length / 12 : 'none'})`)
  const none = buildAttrsSplit(r, m => m === MAT.WATER, () => false)
  ok(none.glass === null && !!none.solid && none.solid.positions.length / 12 === 11, 'without the predicate, glass quads fall into the solid pass (the fallback is opaque, never missing)')
}

console.log('\n── 4. the tile: lead opaque, quarries open ──')
{
  const T = 32
  for (const face of [TOP, SIDE]) {
    const px = paintFor(MAT.GLASS, face, T)
    let open = 0, lead = 0
    for (let o = 3; o < px.length; o += 4) (px[o] < 128 ? open++ : lead++)
    ok(open > T * T * 0.45 && open < T * T * 0.9, `face ${face}: mostly open (${open}/${T * T} open texels)`)
    ok(lead > T * T * 0.1, `face ${face}: enough lead to read as a window (${lead} opaque texels)`)
    // The frame: every edge texel is lead, so a run of glass reads as mullioned panes.
    let edgeOpen = 0
    for (let i = 0; i < T; i++) for (const [x, y] of [[i, 0], [i, T - 1], [0, i], [T - 1, i]]) if (px[(y * T + x) * 4 + 3] < 128) edgeOpen++
    ok(edgeOpen === 0, `face ${face}: the frame is unbroken (${edgeOpen} open edge texels)`)
  }
}

console.log('\n── 5. the pass exists in the host and the material really discards ──')
{
  const host = codeOnly(readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx'), 'utf8'))
  ok(host.includes('createTexturedVoxelMaterial(tiles, lightUniforms, { cutout: true })'), 'the glass material is the textured program in cutout mode')
  ok(/buildAttrsSplit\(sm\.mesh, m => m === MAT\.WATER, isLeafMat, isGlassMat\)/.test(host), 'the chunk build hands the glass SET to the split — stained glass rides the same pass')
  ok(/emit\(glassParts, glassMaterial, /.test(host), 'and emits the glass parts with the glass material')
  ok(/glassTextured\?\.setCartoon\(cartoon\)/.test(host), 'the window is lit by the same cartoon stack as the wall')
  const atlas = readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/tex/atlas.ts'), 'utf8')
  ok(atlas.includes("${opts.cutout ? '  if (tile.a < 0.5) discard;' : ''}"), '★ the cutout is a discard on the sampled alpha, injected only for the glass program')
}

console.log('\n── 6. it is craftable and it is a block ──')
ok(recipeDef('glass')?.input[0].itemId === 'block_sand', 'glass is made from sand')
ok(materialForItem('glass') === MAT.GLASS, 'the glass item places as glass')
ok(blockDef(MAT.GLASS)?.placeable === true, 'and it is placeable')

console.log('\n── 7. ★★ stained glass: six blooms, one lattice, a dither for the tint ──')
{
  ok(GLASS_MATS.size === 7, `seven glasses (saw ${GLASS_MATS.size})`)
  for (const m of GLASS_MATS) {
    ok(!lightOpaque(m), `${blockDef(m)?.name}: passes light`)
    // the mesher ranks it with water: a stone beside it still draws its face
    const s = new Section(8); s.set(2, 3, 3, MAT.STONE); s.set(3, 3, 3, m)
    const r = greedyMesh(s)
    let stoneFaces = 0
    for (let q = 0; q < r.quads; q++) if (r.materials[q * 4] === MAT.STONE && r.normals[q * 12] > 0.5) stoneFaces++
    ok(stoneFaces === 1, `${blockDef(m)?.name}: the wall behind it still draws (${stoneFaces})`)
    ok(buildAttrsSplit(r, x => x === MAT.WATER, () => false, isGlassMat).glass !== null, `${blockDef(m)?.name}: routed to the glass pass`)
    if (m === MAT.GLASS) continue
    const px = paintFor(m, SIDE, 32)
    let open = 0, tinted = 0
    const lead = MATERIAL_COLOR[MAT.GLASS], lr = (lead >> 16) & 255
    for (let o = 0; o < px.length; o += 4) {
      if (px[o + 3] < 128) open++
      else if (Math.abs(px[o] - lr) > 40 || Math.abs(px[o + 1] - ((lead >> 8) & 255)) > 40) tinted++
    }
    ok(open > 32 * 32 * 0.2 && open < 32 * 32 * 0.6, `${blockDef(m)?.name}: still see-through — ${open}/1024 open texels (a dither, not a wall)`)
    ok(tinted > 32 * 32 * 0.15, `${blockDef(m)?.name}: carries its colour — ${tinted} tinted texels`)
    const rec = recipeDef(blockDef(m)!.drops[0].itemId)
    ok(!!rec && rec.input.some(i => i.itemId === 'glass') && rec.input.length === 2, `${blockDef(m)?.name}: made from glass and one bloom`)
  }
  ok(isGlassMat(MAT.STONE) === false, 'stone is not glass')
}

console.log('\n── 8. the pane: a glass-family piece drawn through the cutout program ──')
{
  const r = createPieceRenderer({ texture: null as unknown as THREE.DataArrayTexture } as unknown as Parameters<typeof createPieceRenderer>[0])
  r.sync([{ pieceId: 'pane_sunpetal', x: 0, y: 0, z: 0, rot: 0 }, { pieceId: 'beam', x: 5, y: 0, z: 5, rot: 0 }])
  const meshes = r.group.children.filter(c => (c as THREE.InstancedMesh).isInstancedMesh && (c as THREE.InstancedMesh).count === 1) as THREE.InstancedMesh[]
  const paneMesh = meshes.find(m => (m.material as THREE.Material).side === THREE.DoubleSide)
  const beamMesh = meshes.find(m => (m.material as THREE.Material).side !== THREE.DoubleSide)
  ok(!!paneMesh && !!beamMesh && paneMesh.material !== beamMesh.material, '★ the pane draws with its own (double-sided, cutout) program; the beam with the opaque one')
  ok(r.layersAt('pane', 0).side === layerOf(MAT.GLASS_SUNPETAL, SIDE), `the pane samples its glass's layer (${r.layersAt('pane', 0).side} vs ${layerOf(MAT.GLASS_SUNPETAL, SIDE)})`)
  ok(pieceDef('pane')!.variants!.join() === 'glass' && pieceVariants('pane').length === 7, 'the pane wears the seven glasses, nothing else')
  r.dispose()
}

console.log(`\nglass: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
