// BETA M154 follow-up (keeper merge, 11-27): a built keeper is ~75-150 small meshes (locks, ink hulls, face decals, scarf,
// belt...), one draw call each. mergeKeeper() folds them, AFTER buildKeeper sized everything from the dials, into one mesh per
// material KIND (toon / ink / flat, by side) on each part that moves on its own: the figure root (static), 'head', 'hand-l',
// 'hand-r', 'foot-l', 'foot-r' (the parts poseKeeper moves). Colour moves from the shared per-colour materials into a vertex
// colour, so a figure is ~14 draws whatever its look. The named groups stay (empty or holding their merged mesh), so callers
// that find a part by name (poseKeeper, the gun's hand-r, the gather tether) keep working. Pure performance: no look change.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { KeeperBody } from './keeper-figure'

/** the parts that move on their own (poseKeeper): each keeps its own merged meshes so its motion is untouched */
export const KEEPER_MOVERS = ['head', 'hand-l', 'hand-r', 'foot-l', 'foot-r'] as const

type Mat = THREE.MeshToonMaterial | THREE.MeshBasicMaterial
const VC = new Map<string, Mat>()
/** one shared vertex-colour material per kind: toon (same ramp) or basic, per side */
function vcMaterial(src: Mat): { key: string; mat: Mat } | null {
  if (src.transparent || src.map || src.alphaMap || !src.color) return null
  const toon = (src as THREE.MeshToonMaterial).isMeshToonMaterial, basic = (src as THREE.MeshBasicMaterial).isMeshBasicMaterial
  if (!toon && !basic) return null
  const ramp = toon ? (src as THREE.MeshToonMaterial).gradientMap : null
  const key = `${toon ? 'toon' : 'basic'}|${src.side}|${ramp?.uuid ?? ''}`
  let mat = VC.get(key)
  if (!mat) {
    mat = toon ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp, side: src.side }) : new THREE.MeshBasicMaterial({ vertexColors: true, side: src.side })
    VC.set(key, mat)
  }
  return { key, mat }
}

const M = new THREE.Matrix4(), INV = new THREE.Matrix4()
/** one part's geometry in its mover's space: non-indexed, position + normal + colour only, winding kept front-facing */
function bake(mesh: THREE.Mesh, rel: THREE.Matrix4, color: THREE.Color): THREE.BufferGeometry {
  const src = mesh.geometry as THREE.BufferGeometry
  let g = src.index ? src.toNonIndexed() : src.clone()
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', g.attributes.position.clone())
  if (g.attributes.normal) out.setAttribute('normal', g.attributes.normal.clone())
  else out.computeVertexNormals()
  g = out
  g.applyMatrix4(rel)
  if (rel.determinant() < 0) {   // a mirrored part: swap two corners of every triangle so it still faces out
    for (const a of [g.attributes.position, g.attributes.normal] as THREE.BufferAttribute[]) {
      const arr = a.array as Float32Array
      for (let i = 0; i < a.count; i += 3) for (let c = 0; c < 3; c++) { const t = arr[(i + 1) * 3 + c]; arr[(i + 1) * 3 + c] = arr[(i + 2) * 3 + c]; arr[(i + 2) * 3 + c] = t }
    }
  }
  const n = g.attributes.position.count, col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b }   // linear, as the material's own colour
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

/** Merge a built keeper in place (call it once, right after buildKeeper). Returns the same body. */
export function mergeKeeper(k: KeeperBody): KeeperBody {
  const root = k.group
  root.updateMatrixWorld(true)
  const movers = new Set<THREE.Object3D>(KEEPER_MOVERS.map(n => root.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o && o.parent === root))
  const owner = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (movers.has(p)) return p; return root }
  // bucket every mergeable mesh by (owner, material kind), in build order (so ties draw in the order they were built)
  const buckets = new Map<THREE.Object3D, Map<string, { mat: Mat; parts: THREE.BufferGeometry[] }>>()
  const done: THREE.Mesh[] = []
  root.traverse(o => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material) || (mesh as THREE.SkinnedMesh).isSkinnedMesh || mesh.userData.merged) return
    const src = mesh.material as Mat, vc = vcMaterial(src); if (!vc) return
    const own = owner(mesh)
    INV.copy(own.matrixWorld).invert(); M.multiplyMatrices(INV, mesh.matrixWorld)
    let byKind = buckets.get(own); if (!byKind) buckets.set(own, byKind = new Map())
    let b = byKind.get(vc.key); if (!b) byKind.set(vc.key, b = { mat: vc.mat, parts: [] })
    b.parts.push(bake(mesh, M, src.color)); done.push(mesh)
  })
  for (const mesh of done) mesh.parent?.remove(mesh)
  for (const [own, byKind] of buckets) for (const b of byKind.values()) {
    const geo = mergeGeometries(b.parts, false); for (const p of b.parts) p.dispose()
    if (!geo) continue
    const m = new THREE.Mesh(geo, b.mat); m.name = 'merged'; m.userData.merged = true
    own.add(m)
  }
  root.userData.mergedKeeper = true
  return k
}

/** free the merged geometries (each figure owns its own; the materials are shared caches) */
export function disposeMergedKeeper(group: THREE.Object3D) {
  group.traverse(o => { if (o.userData.merged) (o as THREE.Mesh).geometry.dispose() })
}

/** meshes (draw calls) in a figure */
export const meshCount = (g: THREE.Object3D) => { let n = 0; g.traverse(o => { if ((o as THREE.Mesh).isMesh) n++ }); return n }
