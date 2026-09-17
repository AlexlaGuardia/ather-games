// The falling leaves' mesh — one dynamic geometry on the CANOPY'S OWN MATERIAL.
//
// ★ NOT AN InstancedMesh, on purpose. `tex/leaf-material.ts` computes the light-field position
// from `transformed` at `<begin_vertex>`, which is BEFORE three applies `instanceMatrix`
// (`<project_vertex>`); every instance would sample the light at the mesh origin and a leaf
// falling through a lantern's glow would read the glade's. A plain geometry whose positions are
// written per frame is 256 leaves × 2 quads × 4 verts = 2k vertices — the same order as one
// small canopy — and it carries exactly the attributes the material already reads (color = the
// species tint, aLayer = the species tile, uv), so a falling leaf is the leaf it was, tumbling.
import * as THREE from 'three'
import type { LeafFallState } from './leaf-fall'
import { LEAF_FALL } from './leaf-fall'
import { layerOf, SIDE } from './tex/tiles'
import { MATERIAL_COLOR } from './attrs'

export interface LeafFallRenderer {
  mesh: THREE.Mesh
  /** Write this frame's leaves into the buffer. Cheap enough to run every frame there is one. */
  sync(st: LeafFallState): void
}

/** Half-size of a falling leaf's card. A little under the block so it reads as loose. */
const HALF = 0.42
/** A leaf that has just come off its block is shaded like a canopy rim, not its dark interior. */
const SHADE = 0.9

export function createLeafFallRenderer(material: THREE.Material, cap = LEAF_FALL.cap): LeafFallRenderer {
  const quads = cap * 2, verts = quads * 4
  const pos = new Float32Array(verts * 3)
  const nrm = new Float32Array(verts * 3)
  const col = new Float32Array(verts * 3)
  const uv = new Float32Array(verts * 2)
  const layer = new Float32Array(verts)
  const idx = new Uint32Array(quads * 6)
  for (let q = 0; q < quads; q++) {
    const v = q * 4, i = q * 6
    idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3
    // uv: (0,0) (1,0) (1,1) (0,1) — the tile the material slides to the species.
    uv[(v) * 2] = 0; uv[(v) * 2 + 1] = 0
    uv[(v + 1) * 2] = 1; uv[(v + 1) * 2 + 1] = 0
    uv[(v + 2) * 2] = 1; uv[(v + 2) * 2 + 1] = 1
    uv[(v + 3) * 2] = 0; uv[(v + 3) * 2 + 1] = 1
  }
  const g = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(pos, 3); posAttr.setUsage(THREE.DynamicDrawUsage)
  const nrmAttr = new THREE.BufferAttribute(nrm, 3); nrmAttr.setUsage(THREE.DynamicDrawUsage)
  const colAttr = new THREE.BufferAttribute(col, 3); colAttr.setUsage(THREE.DynamicDrawUsage)
  const layAttr = new THREE.BufferAttribute(layer, 1); layAttr.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('position', posAttr)
  g.setAttribute('normal', nrmAttr)
  g.setAttribute('color', colAttr)
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('aLayer', layAttr)
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  g.setDrawRange(0, 0)
  const mesh = new THREE.Mesh(g, material)
  mesh.frustumCulled = false   // the buffer's bounds are the whole world; culling would need a recompute per frame
  mesh.visible = false
  mesh.name = 'leaf-fall'

  const tint = new Map<number, [number, number, number]>()
  const tintOf = (m: number): [number, number, number] => {
    let t = tint.get(m)
    if (!t) {
      const c = MATERIAL_COLOR[m] ?? 0x5aa845
      t = [((c >> 16) & 255) / 255 * SHADE, ((c >> 8) & 255) / 255 * SHADE, (c & 255) / 255 * SHADE]
      tint.set(m, t)
    }
    return t
  }

  const sync = (st: LeafFallState) => {
    const n = Math.min(st.leaves.length, cap)
    if (n === 0) { mesh.visible = false; g.setDrawRange(0, 0); return }
    for (let i = 0; i < n; i++) {
      const l = st.leaves[i]
      const t = tintOf(l.material)
      const L = layerOf(l.material, SIDE)
      // Two vertical cards crossed at the leaf's centre, turned by the tumble phase, with a tilt
      // that rocks with the spin so the cross does not read as a fixed X sliding down.
      const tilt = Math.sin(l.phase * 0.5) * 0.35
      for (let k = 0; k < 2; k++) {
        const a = l.phase + k * Math.PI / 2
        const dx = Math.cos(a) * HALF, dz = Math.sin(a) * HALF
        const q = (i * 2 + k) * 4
        const ty = Math.sin(a) * tilt * HALF   // one end of the card lifts, the other dips
        const corners: [number, number, number][] = [
          [l.x - dx, l.y - HALF - ty, l.z - dz],
          [l.x + dx, l.y - HALF + ty, l.z + dz],
          [l.x + dx, l.y + HALF + ty, l.z + dz],
          [l.x - dx, l.y + HALF - ty, l.z - dz],
        ]
        const nx = -Math.sin(a), nz = Math.cos(a)
        for (let c = 0; c < 4; c++) {
          const v = q + c
          pos[v * 3] = corners[c][0]; pos[v * 3 + 1] = corners[c][1]; pos[v * 3 + 2] = corners[c][2]
          nrm[v * 3] = nx; nrm[v * 3 + 1] = 0; nrm[v * 3 + 2] = nz
          col[v * 3] = t[0]; col[v * 3 + 1] = t[1]; col[v * 3 + 2] = t[2]
          layer[v] = L
        }
      }
    }
    posAttr.needsUpdate = true; nrmAttr.needsUpdate = true; colAttr.needsUpdate = true; layAttr.needsUpdate = true
    g.setDrawRange(0, n * 2 * 6)
    mesh.visible = true
  }
  return { mesh, sync }
}
