// M149: a kit Part as three.js geometry, and a whole model merged to one geometry per colour. Shared by the rig (fp-gun.tsx), the
// third-person prop on the bench, and the tri counts in the tests, so none can disagree.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Model, Part, PartColor } from './gun-kit'

const outline = (pts: [number, number][]) => pts.map(([x, y]) => new THREE.Vector2(x, y))

/** a part's geometry, already placed in the gun's frame */
export function partGeometry(p: Part): THREE.BufferGeometry {
  let g: THREE.BufferGeometry
  if (p.shape === 'cyl' || p.shape === 'tube') {
    const seg = p.seg ?? 14, ax = p.axis ?? 'z'
    g = new THREE.CylinderGeometry((p.end ?? p.s[0]) / 2, p.s[0] / 2, p.s[2], seg, 1, p.shape === 'tube')   // three's top (+y) = the +axis end
    if (seg <= 8) { const f = g.toNonIndexed(); g.dispose(); f.computeVertexNormals(); g = f }   // a cut crystal, a bolt: flat faces
    if (ax === 'z') g.rotateX(Math.PI / 2); else if (ax === 'x') g.rotateZ(-Math.PI / 2)
  } else if (p.shape === 'poly') {
    const sh = new THREE.Shape(outline(p.pts!)), b = p.bevel ?? 0, depth = Math.max(1e-4, p.s[0] - 2 * b)
    if (p.hole) sh.holes.push(new THREE.Path(outline(p.hole)))
    g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 1, curveSegments: 1, steps: 1 })
    g.translate(0, 0, -depth / 2)
    if (p.axis === 'z') {
      if (p.end != null) { const a = g.attributes.position; for (let i = 0; i < a.count; i++) if (a.getZ(i) < 0) a.setXY(i, a.getX(i) * p.end, a.getY(i) * p.end); g.computeVertexNormals() }
    } else g.rotateY(-Math.PI / 2)   // outline x -> the gun's z, depth -> across
  } else if (p.shape === 'disc') g = new THREE.CircleGeometry(p.s[0] / 2, 24)
  else if (p.shape === 'plate' && p.pts) {
    g = new THREE.ShapeGeometry(new THREE.Shape(outline(p.pts)))
    // the picture fills the outline's box
    g.computeBoundingBox(); const bb = g.boundingBox!, a = g.attributes.position, uv = g.attributes.uv
    for (let i = 0; i < a.count; i++) uv.setXY(i, (a.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (a.getY(i) - bb.min.y) / (bb.max.y - bb.min.y))
  } else if (p.shape === 'plate') g = new THREE.PlaneGeometry(p.s[0], p.s[1])
  else g = new THREE.BoxGeometry(...p.s)
  if (p.rot) g.rotateX(p.rot)
  g.translate(...p.o)
  if (g.index) { const f = g.toNonIndexed(); g.dispose(); g = f }
  return g
}
/** one merged geometry per colour */
export function modelGeometry(m: Model): Map<PartColor, THREE.BufferGeometry> {
  const by = new Map<PartColor, THREE.BufferGeometry[]>()
  for (const p of m.parts) { const l = by.get(p.c) ?? []; l.push(partGeometry(p)); by.set(p.c, l) }
  const out = new Map<PartColor, THREE.BufferGeometry>()
  for (const [c, l] of by) { const g = mergeGeometries(l); if (!g) throw new Error(`gun-kit: ${c} did not merge`); l.forEach(x => x.dispose()); out.set(c, g) }
  return out
}
export const trisOf = (m: Model) => { let n = 0; for (const g of modelGeometry(m).values()) { n += g.attributes.position.count / 3; g.dispose() } return n }

/** the family's colours: dead, cold, unlit (manabox-design.md, the colour law) */
export const KIT_MATS: Record<'iron' | 'slot' | 'bronze' | 'core' | 'stamp' | 'soot' | 'cell' | 'strap', { color: string; roughness: number; metalness: number; flatShading?: boolean }> = {
  iron: { color: '#66696c', roughness: 0.62, metalness: 0.1 }, slot: { color: '#26282a', roughness: 0.9, metalness: 0 },
  bronze: { color: '#a27e3c', roughness: 0.5, metalness: 0.15 }, core: { color: '#b4b9bd', roughness: 0.3, metalness: 0, flatShading: true },
  stamp: { color: '#6f6c64', roughness: 0.8, metalness: 0.05 }, soot: { color: '#46423e', roughness: 0.95, metalness: 0 },
  cell: { color: '#8b8c86', roughness: 0.55, metalness: 0.1 }, strap: { color: '#4a443f', roughness: 0.8, metalness: 0 },
}
