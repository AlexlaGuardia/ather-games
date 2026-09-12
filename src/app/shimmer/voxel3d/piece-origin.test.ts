// ── A PIECE DRAWS IN THE CELLS IT OCCUPIES, AT EVERY ROTATION — a runtime oracle ───────────────
// Run: npx tsx src/app/shimmer/voxel3d/piece-origin.test.ts
//
// Found 2026-09-12 from two photographs: a post's shadow one cell beside the post. Geometry is
// min-corner-origin; instances rotated about that corner; `cellsOf` keeps the footprint in the
// +x/+z quadrant. For rot 1/2/3 the mesh drew one cell away from the cell it collided and lit in,
// and had done since auto-facing shipped on 08-08. The ghost carried the same offset, which is
// what the 08-08 "previews a block away" report was.
//
// The renderer is three.js objects with no GL, so this runs the SHIPPED instance matrices against
// the SHIPPED geometry and compares the world-space bounds to `cellsOf`. Every piece, every
// rotation, and the ghost.
import * as THREE from 'three'
import { createPieceRenderer, pivotOffset } from './piece-mesh'
import { PIECES, cellsOf, pieceDef, type Placement, type Rotation } from '../voxel/pieces'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
// ⚠ 0.1, not 1e-6: the bracket and the hook are authored to sink 0.05–0.06 into the wall behind
// them so they read as fastened. A cell-sized miss is the bug this file exists for; a hair of
// deliberate overlap is not.
const EPS = 0.1

/** The world-space XZ box the cells cover. */
const cellBox = (p: Placement) => {
  const cells = cellsOf(p, pieceDef(p.pieceId)!)
  const xs = cells.map(c => c.x), zs = cells.map(c => c.z)
  return { x0: Math.min(...xs), x1: Math.max(...xs) + 1, z0: Math.min(...zs), z1: Math.max(...zs) + 1 }
}
const boundsOf = (geo: THREE.BufferGeometry, m: THREE.Matrix4) => {
  const g = geo.clone(); g.applyMatrix4(m); g.computeBoundingBox()
  const b = g.boundingBox!; g.dispose()
  return b
}
const inside = (b: THREE.Box3, c: { x0: number; x1: number; z0: number; z1: number }) =>
  b.min.x >= c.x0 - EPS && b.max.x <= c.x1 + EPS && b.min.z >= c.z0 - EPS && b.max.z <= c.z1 + EPS

console.log('\n── 1. ★★ every base piece, every rotation: the instance sits inside its own footprint ──')
{
  const r = createPieceRenderer()
  let checked = 0
  for (const def of PIECES) for (const rot of [0, 1, 2, 3] as Rotation[]) {
    const p: Placement = { pieceId: def.id, x: 10, y: 0, z: 10, rot }
    r.sync([p])
    const inst = r.group.children.find(c => (c as THREE.InstancedMesh).isInstancedMesh && (c as THREE.InstancedMesh).count === 1) as THREE.InstancedMesh | undefined
    if (!inst) { fails.push(`BLIND: no instance drawn for ${def.id} rot ${rot}`); continue }
    const m = new THREE.Matrix4(); inst.getMatrixAt(0, m)
    const b = boundsOf(inst.geometry, m), c = cellBox(p)
    ok(inside(b, c), `${def.id} rot ${rot}: mesh x[${b.min.x.toFixed(2)},${b.max.x.toFixed(2)}] z[${b.min.z.toFixed(2)},${b.max.z.toFixed(2)}] outside cells x[${c.x0},${c.x1}] z[${c.z0},${c.z1}]`)
    checked++
  }
  ok(checked === PIECES.length * 4, `BLIND CHECK: ${checked} placements measured`)
  r.dispose()
}

console.log('\n── 2. ★ the ghost gets the same correction ──')
{
  const r = createPieceRenderer()
  for (const id of ['beam', 'doorway', 'stair']) for (const rot of [0, 1, 2, 3] as Rotation[]) {
    r.setGhost(id, 10, 0, 10, rot, true)
    r.ghost.updateMatrix()
    const b = boundsOf(r.ghost.geometry, r.ghost.matrix), c = cellBox({ pieceId: id, x: 10, y: 0, z: 10, rot })
    ok(inside(b, c), `ghost ${id} rot ${rot} drawn outside its footprint (x[${b.min.x.toFixed(2)},${b.max.x.toFixed(2)}] z[${b.min.z.toFixed(2)},${b.max.z.toFixed(2)}])`)
  }
  r.dispose()
}

console.log('\n── 3. an open door swings inside its own cell ──')
{
  const r = createPieceRenderer()
  const shut: Placement = { pieceId: 'door', x: 10, y: 0, z: 10, rot: 0 }
  const open: Placement = { ...shut, open: true }
  for (const p of [shut, open]) {
    r.sync([p])
    const inst = r.group.children.find(c => (c as THREE.InstancedMesh).isInstancedMesh && (c as THREE.InstancedMesh).count === 1) as THREE.InstancedMesh
    const m = new THREE.Matrix4(); inst.getMatrixAt(0, m)
    ok(inside(boundsOf(inst.geometry, m), cellBox(p)), `door ${p.open ? 'open' : 'shut'} is inside its cell`)
  }
  r.dispose()
}

console.log('\n── 4. the correction is the footprint corner, stated ──')
{
  const d = pieceDef('doorway')!   // 1×3×1
  ok(pivotOffset(d, 0).x === 0 && pivotOffset(d, 0).z === 0, 'rot 0 needs none')
  ok(pivotOffset(d, 1).x === d.d && pivotOffset(d, 1).z === 0, 'rot 1 moves by depth in x')
  ok(pivotOffset(d, 2).x === d.w && pivotOffset(d, 2).z === d.d, 'rot 2 moves by width in x and depth in z')
  ok(pivotOffset(d, 3).x === 0 && pivotOffset(d, 3).z === d.w, 'rot 3 moves by width in z')
}

console.log(`\npiece-origin: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
