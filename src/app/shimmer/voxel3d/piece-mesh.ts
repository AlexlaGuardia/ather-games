// Piece rendering — placeholder geometry, one instanced mesh per type.
//
// ★ HOST SIDE. This file may import three; `voxel/` may not.
//
// ── ★ PROCEDURAL PLACEHOLDERS, DELIBERATELY, AND THEY ARE NOT THE LOOK ──────────────────────
// The six pieces are a real modelling job (the picaso / headless-Blender lane) and their look is the
// game's face. Waiting on art to build the placement LOOP would be the wrong order — you cannot
// judge snapping, rotation, cost or deconstruction from a description. So each piece gets simple
// geometry that is *dimensionally correct* and obviously provisional: a doorway is a frame with a
// hole, a roof slope actually slopes, a stair is stepped. Swapping in a GLTF later is one line per
// piece, because nothing outside this file knows what a piece looks like.
//
// ── ★ ONE InstancedMesh PER TYPE, NON-NEGOTIABLE ────────────────────────────────────────────
// A mesh-and-material per placed piece is exactly the allocation that got this page BLOCKED from
// creating a WebGL context on 2026-08-06. A village is thousands of pieces. `render-audit.test.ts`
// fails the build on it, but it should never be written.

import * as THREE from 'three'
import { PIECES, type PieceDef } from '../voxel/pieces'

/** Provisional colours — wood-toned so a shed reads as a shed. Not a look call. */
const TINT: Record<string, number> = {
  doorway: 0x8a6a34,
  window: 0x9d8552,
  roof_slope: 0x7a4a3a,
  roof_cap: 0x6b3f31,
  stair: 0x8d8a94,
  beam: 0x6f5a3f,
}

/**
 * Geometry per piece. Dimensionally correct against the footprint in `pieces.ts` so the ghost tells
 * the truth about what you are about to occupy — a placeholder that lies about size is worse than a
 * cube, because it teaches the wrong thing about placement.
 */
function buildGeometry(def: PieceDef): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d)
    g.translate(x, y, z)
    parts.push(g)
  }

  switch (def.id) {
    case 'doorway': {
      // Two jambs and a lintel — a frame with a hole, so the walkable cells are visibly walkable.
      box(0.18, 3, 0.9, -0.41, 1.5, 0)
      box(0.18, 3, 0.9, 0.41, 1.5, 0)
      box(1, 0.22, 0.9, 0, 2.89, 0)
      break
    }
    case 'window': {
      box(1, 0.16, 0.5, 0, 0.08, 0)      // sill
      box(1, 0.16, 0.5, 0, 1.92, 0)      // head
      box(0.14, 2, 0.5, -0.43, 1, 0)     // jambs
      box(0.14, 2, 0.5, 0.43, 1, 0)
      box(0.1, 1.7, 0.12, 0, 1, 0)       // mullion — the detail that reads as "window" at a glance
      break
    }
    case 'roof_slope': {
      // A real wedge, not a box: five steps approximating a 45° slope, which is the whole reason a
      // roof is a piece rather than a block.
      for (let i = 0; i < 5; i++) box(1, 0.2, 0.2, 0, 0.1 + i * 0.2, 0.4 - i * 0.2)
      break
    }
    case 'roof_cap': {
      box(1, 0.26, 0.34, 0, 0.87, 0)
      box(1, 0.2, 0.6, 0, 0.62, 0)
      break
    }
    case 'stair': {
      box(1, 0.34, 1, 0, 0.17, 0)
      box(1, 0.33, 0.66, 0, 0.5, -0.17)
      box(1, 0.33, 0.33, 0, 0.83, -0.33)
      break
    }
    default: {   // beam
      box(0.26, 1, 0.26, 0, 0.5, 0)
      break
    }
  }

  // Merge into ONE geometry per type so an instance is a single draw, not one per sub-box.
  const merged = buildMergedGeometry(parts)
  for (const p of parts) p.dispose()
  // Origin at the cell's min corner, matching how `cellsOf` addresses occupancy — so the ghost sits
  // exactly where the footprint says it will.
  merged.translate(0.5, 0, 0.5)
  merged.computeVertexNormals()
  return merged
}

/** Concatenate non-indexed box geometries into ONE. Named as a factory because that is what it
 *  is — it constructs and hands back a resource whose caller owns disposal. */
function buildMergedGeometry(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = parts.map(p => p.toNonIndexed())
  let total = 0
  for (const p of nonIndexed) total += p.getAttribute('position').count
  const pos = new Float32Array(total * 3)
  const nrm = new Float32Array(total * 3)
  let off = 0
  for (const p of nonIndexed) {
    const a = p.getAttribute('position') as THREE.BufferAttribute
    const n = p.getAttribute('normal') as THREE.BufferAttribute
    pos.set(a.array as Float32Array, off * 3)
    nrm.set(n.array as Float32Array, off * 3)
    off += a.count
    p.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  return g
}

export interface PieceRenderer {
  group: THREE.Group
  /** Rebuild instances from the current placement list. Cheap enough to call on every edit. */
  sync: (placements: { pieceId: string; x: number; y: number; z: number; rot: number }[]) => void
  ghost: THREE.Mesh
  setGhost: (pieceId: string, x: number, y: number, z: number, rot: number, ok: boolean) => void
  hideGhost: () => void
  dispose: () => void
}

const MAX_PER_TYPE = 4096

export function createPieceRenderer(): PieceRenderer {
  const group = new THREE.Group()
  const geoms = new Map<string, THREE.BufferGeometry>()
  const meshes = new Map<string, THREE.InstancedMesh>()
  const mats = new Map<string, THREE.Material>()

  for (const def of PIECES) {
    const g = buildGeometry(def)
    const m = new THREE.MeshLambertMaterial({ color: TINT[def.id] ?? 0x999999 })
    const inst = new THREE.InstancedMesh(g, m, MAX_PER_TYPE)
    inst.count = 0
    inst.frustumCulled = false   // instances span the world; the mesh's own bounds are meaningless
    geoms.set(def.id, g); mats.set(def.id, m); meshes.set(def.id, inst)
    group.add(inst)
  }

  // The ghost reuses a piece geometry but needs its own transparent material — one material total,
  // recoloured on the fly, never one per preview.
  const ghostMat = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.45, color: 0x7fd4ff })
  const ghost = new THREE.Mesh(geoms.get(PIECES[0].id)!, ghostMat)
  ghost.visible = false
  group.add(ghost)

  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const one = new THREE.Vector3(1, 1, 1)

  const sync: PieceRenderer['sync'] = (placements) => {
    const counts = new Map<string, number>()
    for (const p of placements) {
      const inst = meshes.get(p.pieceId)
      if (!inst) continue
      const i = counts.get(p.pieceId) ?? 0
      if (i >= MAX_PER_TYPE) continue
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(p.rot * Math.PI) / 2)
      v.set(p.x, p.y, p.z)
      inst.setMatrixAt(i, m4.compose(v, q, one))
      counts.set(p.pieceId, i + 1)
    }
    for (const [id, inst] of meshes) {
      inst.count = counts.get(id) ?? 0
      inst.instanceMatrix.needsUpdate = true
    }
  }

  return {
    group, ghost, sync,
    setGhost: (pieceId, x, y, z, rot, okToPlace) => {
      const g = geoms.get(pieceId)
      if (!g) { ghost.visible = false; return }
      ghost.geometry = g
      ghostMat.color.setHex(okToPlace ? 0x7fd4ff : 0xff6b6b)
      ghost.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(rot * Math.PI) / 2)
      ghost.position.set(x, y, z)
      ghost.visible = true
    },
    hideGhost: () => { ghost.visible = false },
    dispose: () => {
      for (const g of geoms.values()) g.dispose()
      for (const m of mats.values()) m.dispose()
      ghostMat.dispose()
    },
  }
}
