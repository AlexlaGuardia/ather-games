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
import { PIECES, basePieceId, type PieceDef } from '../voxel/pieces'

/** Provisional colours — wood-toned so a shed reads as a shed. Not a look call. */
const TINT: Record<string, number> = {
  doorway: 0x8a6a34,
  window: 0x9d8552,
  roof_slope: 0x7a4a3a,
  roof_cap: 0x6b3f31,
  stair: 0x8d8a94,
  beam: 0x6f5a3f,
  fence: 0x8a6a34,
  half_slab: 0xa8834d,
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

  // ⚠⚠ KEYED ON THE BASE SHAPE, NOT ON `def.id` (2026-08-27). A piece now comes in seven
  // materials, so `stair_stonebrick` is a real id that must draw a STAIR — switching on the raw id
  // sends all 72 variants to the default arm, where they render as the beam's little post. Nothing
  // would have thrown: it is the sapling-icon bug exactly, where widening a union left a consumer
  // stale and quiet, and both halves stayed internally consistent about different things.
  //
  // `basePieceId` is the shipped answer to "what shape is this", built from the piece table rather
  // than by splitting the id (`half_slab` contains an underscore). Never re-derive it here.
  switch (basePieceId(def.id)) {
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
    case 'fence': {
      // A single centre post — the ARMS are their own instanced mesh, derived per connected side
      // at sync time (MC's trick: connection is a question you ask neighbours, never a thing you
      // store). A lone post is also the honest ghost: that IS what an unconnected fence is.
      box(0.18, 1, 0.18, 0, 0.5, 0)
      break
    }
    case 'half_slab': {
      // Exactly the collision it claims: the cell's lower half, and nothing else. The one piece
      // whose placeholder MUST be dimensionally honest, because its mechanic IS its shape.
      box(1, 0.5, 1, 0, 0.25, 0)
      break
    }
    // ── the sub-cube detail, added 2026-08-27 ───────────────────────────────────────────────
    case 'shutter': {
      // A thin panel on the face. Thinner than a slab on purpose — that thinness IS the reason
      // builders reach for a trapdoor over a slab, and a "thin" panel drawn at 0.5 is a slab
      // standing up. ⚠ It SHUTS as of the door pass, so this is the closed leaf; the open state is
      // the same geometry swung by `visualRotation`, never a second model.
      box(0.9, 0.9, 0.12, 0, 0.5, -0.44)
      break
    }
    case 'door': {
      // A leaf hung against one edge of its cell. ★ THE HINGE SIDE IS OFF-CENTRE ON PURPOSE — a
      // panel modelled through the middle of the cell rotates about its own centre and reads as a
      // slab spinning in place. Hung at the edge, the same 90° turn reads as a door swinging, and
      // that difference is the entire visual payload of the feature.
      box(0.94, 2, 0.14, 0, 1, -0.43)
      box(0.10, 0.10, 0.10, 0.32, 1.05, -0.32)   // the pull
      break
    }
    case 'gate': {
      // The fence's door: the same rail language as `fence` so a run of fence and its gate read as
      // one thing, hung at the edge like the door so it swings rather than spins.
      box(0.9, 0.14, 0.12, 0, 0.78, -0.43)
      box(0.9, 0.14, 0.12, 0, 0.42, -0.43)
      box(0.14, 0.86, 0.12, -0.38, 0.6, -0.43)
      box(0.14, 0.86, 0.12, 0.38, 0.6, -0.43)
      break
    }
    case 'arch': {
      // Two springings and a stepped head. The steps are what read as a curve at block scale —
      // a true arc modelled at this size averages to a smudge, the same reason the collar badge
      // had to be redrawn to a small-size budget.
      box(0.9, 3, 0.9, -1, 1.5, 0)
      box(0.9, 3, 0.9, 1, 1.5, 0)
      box(0.9, 0.5, 0.9, 0, 2.75, 0)
      box(0.5, 0.4, 0.9, -0.62, 2.3, 0)
      box(0.5, 0.4, 0.9, 0.62, 2.3, 0)
      break
    }
    case 'bracket': {
      // A corbel: proud of the wall, tapering out. It exists to catch a highlight on its top face
      // and throw a shadow under itself, which is the entire mechanism of "outcrop the corner".
      box(0.34, 0.22, 0.7, 0, 0.72, -0.2)
      box(0.34, 0.3, 0.34, 0, 0.4, -0.38)
      break
    }
    case 'hook': {
      // An arm off the wall with a drop at its end — what a lantern hangs from. Slender, because
      // its whole job is to put the light SOURCE away from the masonry.
      box(0.12, 0.12, 0.62, 0, 0.86, -0.24)
      box(0.12, 0.34, 0.12, 0, 0.7, -0.5)
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

/**
 * One fence ARM: two half-length rails from the cell centre to the +x edge, authored around the
 * LOCAL ORIGIN (not the min-corner convention) so an instance rotates about the post it belongs
 * to. Emitted per connected side at sync — two draw calls (posts + arms) cover every fence
 * configuration that can exist.
 */
function buildFenceArm(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const y of [0.8, 0.42]) {
    const g = new THREE.BoxGeometry(0.5, 0.12, 0.1)
    g.translate(0.25, y, 0)
    parts.push(g)
  }
  const merged = buildMergedGeometry(parts)
  for (const p of parts) p.dispose()
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
  /** Host-injected "is this voxel solid?" — fence arms reach for terrain and walls through it.
   *  Optional: without it fences still connect to each other, just not to the world. */
  setWorldSolid: (fn: ((x: number, y: number, z: number) => boolean) | null) => void
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

  // The fence arms: one extra instanced mesh, same law as everything else. 4096 arms = a
  // thousand fully-connected fences; the cap is a backstop, not a plan.
  const armGeo = buildFenceArm()
  const armMat = new THREE.MeshLambertMaterial({ color: TINT.fence })
  const armMesh = new THREE.InstancedMesh(armGeo, armMat, MAX_PER_TYPE)
  armMesh.count = 0
  armMesh.frustumCulled = false
  group.add(armMesh)
  let worldSolid: ((x: number, y: number, z: number) => boolean) | null = null

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

  const Y = new THREE.Vector3(0, 1, 0)
  // Arm yaw per direction: the arm points +x at 0. (1,0)→0 · (0,1)→-π/2 · (-1,0)→π · (0,-1)→π/2.
  const ARM_DIRS: [number, number, number][] = [[1, 0, 0], [0, 1, -Math.PI / 2], [-1, 0, Math.PI], [0, -1, Math.PI / 2]]

  const sync: PieceRenderer['sync'] = (placements) => {
    const counts = new Map<string, number>()
    const fenceCells = new Set<string>()
    for (const p of placements) if (p.pieceId === 'fence') fenceCells.add(`${p.x},${p.y},${p.z}`)
    let arms = 0
    for (const p of placements) {
      const inst = meshes.get(p.pieceId)
      if (!inst) continue
      const i = counts.get(p.pieceId) ?? 0
      if (i >= MAX_PER_TYPE) continue
      q.setFromAxisAngle(Y, -(p.rot * Math.PI) / 2)
      v.set(p.x, p.y, p.z)
      inst.setMatrixAt(i, m4.compose(v, q, one))
      counts.set(p.pieceId, i + 1)
      // ── fence arms: derived, never stored (MC's connection model) ──
      // A side grows an arm toward a sibling fence or any solid voxel — walls and hillsides
      // included. Both fences of a pair emit their own half-arm, which is what makes the joint.
      if (p.pieceId === 'fence') {
        for (const [dx, dz, yaw] of ARM_DIRS) {
          if (arms >= MAX_PER_TYPE) break
          const nx = p.x + dx, nz = p.z + dz
          const link = fenceCells.has(`${nx},${p.y},${nz}`) || (worldSolid?.(nx, p.y, nz) ?? false)
          if (!link) continue
          q.setFromAxisAngle(Y, yaw)
          v.set(p.x + 0.5, p.y, p.z + 0.5)   // arms rotate about the POST, so centre-origin
          armMesh.setMatrixAt(arms++, m4.compose(v, q, one))
        }
      }
    }
    armMesh.count = arms
    armMesh.instanceMatrix.needsUpdate = true
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
    setWorldSolid: (fn) => { worldSolid = fn },
    dispose: () => {
      for (const g of geoms.values()) g.dispose()
      for (const m of mats.values()) m.dispose()
      armGeo.dispose(); armMat.dispose()
      ghostMat.dispose()
    },
  }
}
