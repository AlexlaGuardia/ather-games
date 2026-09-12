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
import { PIECES, basePieceId, pieceDef, visualRotation, type PieceDef, type Placement, type Rotation } from '../voxel/pieces'

/** Provisional colours — wood-toned so a shed reads as a shed. Not a look call. */
const TINT: Record<string, number> = {
  doorway: 0x8a6a34,
  window: 0x9d8552,
  roof_slope: 0x7a4a3a,
  roof_cap: 0x6b3f31,
  stair: 0x8d8a94,
  beam: 0x6f5a3f,
  bench: 0x8a7145,
  post: 0x6b4a2c,
  // ⚠ THESE SIX HAD NO TINT AND ALL RENDERED AS THE SAME FLAT `0x999999` FALLBACK — found
  // 2026-08-30 by the new arm-coverage guard, not by anyone looking. A grey placeholder reads as
  // unfinished art rather than as a piece, and six of them read as the SAME unfinished art.
  // ★ `hook` and `bracket` are deliberately iron: canon's *"metal on a structure means a hold"*
  // makes forged metal the single strongest signal the build owns, and a cage-hook is where the eye
  // is supposed to find it. The other four are placeholder-honest wood and stone.
  // ⏳ Colours are a look call and Alex's to overrule; what is not negotiable is that they DIFFER.
  shutter: 0x7d6440,
  arch: 0x8d8a94,
  door: 0x7a5c30,
  gate: 0x6d5433,
  bracket: 0x4a4a52,
  hook: 0x4a4a52,
  fence: 0x8a6a34,
  half_slab: 0xa8834d,
}

/**
 * Geometry per piece. Dimensionally correct against the footprint in `pieces.ts` so the ghost tells
 * the truth about what you are about to occupy — a placeholder that lies about size is worse than a
 * cube, because it teaches the wrong thing about placement.
 */
/**
 * The geometry and tint the world gives a piece — exported for the hotbar icon (`tex/mesh-icon.ts`),
 * so the icon of a stair is the very stair the world instances, never a second opinion about it.
 * Variants resolve to their base shape here for the same reason the renderer does below: a stone
 * brick stair is drawn as `stair` today, so its icon is too. Callers own disposing the buffer.
 */
export const pieceGeometry = (def: PieceDef): THREE.BufferGeometry => buildGeometry(def)
export const pieceTint = (def: PieceDef): number => TINT[basePieceId(def.id)] ?? 0x999999

/**
 * ── ★★ WHERE A ROTATED PIECE'S MESH GOES, SO THAT IT LANDS IN THE CELLS IT OCCUPIES ──────────
 * (found 2026-09-12; shipping since auto-facing on 08-08)
 *
 * Geometry is authored with its origin at the cell's MIN CORNER (`buildGeometry` translates by
 * +0.5), and an instance rotates about that origin. Rotating a min-corner-origin box by −90° swings
 * its whole body to −x: a beam at rot 1 drew one cell WEST of the cell it collided and lit in, rot 2
 * one cell west and north, rot 3 one cell north. `cellsOf` keeps every footprint in the +x/+z
 * quadrant of the origin at every rotation, so the two disagreed for three rotations out of four.
 * With auto-facing that is most placements. Measured with the live renderer: beam rot 1 mesh
 * x∈[9.37,9.63] against occupancy x∈[10,11].
 *
 * Every symptom traced back here: the ghost "previewing a block away from the highlighted block"
 * (08-08, answered by hiding the wireframe), the wall panel "behind" the beam (the panel is
 * centre-origin and was in the RIGHT cell), the light shadow beside the post instead of under it.
 *
 * This is the translation that puts the rotated body back over `cellsOf`: the rotated footprint's
 * min corner relative to the rotated origin corner. Applied to instances AND the ghost from the
 * same function, so they cannot disagree again. Taken from the VISUAL rotation so an open door
 * swings inside its own cell, as `PieceDef.openable` promises.
 */
export function pivotOffset(def: PieceDef, rot: Rotation): { x: number; z: number } {
  switch (rot) {
    case 1: return { x: def.d, z: 0 }
    case 2: return { x: def.w, z: def.d }
    case 3: return { x: 0, z: def.w }
    default: return { x: 0, z: 0 }
  }
}

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
      // ★ SOLID, NOT A STAIR OF LEDGES (2026-09-11). The first cut laid five 0.2-deep ledges with
      // air behind each, so a roof row was a comb of brown teeth over a pale wall and the whole
      // building read as a ruin (Alex: "more like ruins than a building"). Each step now runs from
      // the slope face to the BACK of the cell, so the wedge is a mass and a roof is a surface.
      for (let i = 0; i < 5; i++) {
        const depth = 1 - i * 0.2
        box(1, 0.2, depth, 0, 0.1 + i * 0.2, -0.5 + depth / 2)
      }
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
    case 'post': {
      // A square timber the full height of its cell — thicker than a fence post, thinner than a
      // block, so a frame reads as a frame against plank infill. Full-cell occupancy (pieces.ts).
      box(0.44, 1, 0.44, 0, 0.5, 0)
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
      // ⚠ AUTHORED ABOUT THE MIDDLE CELL, SO SHIFTED +1 TO THE MIN-CORNER CONVENTION EVERY OTHER
      // ARM USES (2026-09-12). Before this the arch drew one cell west of the three it occupied —
      // `piece-origin.test.ts` measures every piece against `cellsOf`, and this was the one that
      // was wrong at rot 0 as well.
      box(0.9, 3, 0.9, 0, 1.5, 0)
      box(0.9, 3, 0.9, 2, 1.5, 0)
      box(0.9, 0.5, 0.9, 1, 2.75, 0)
      box(0.5, 0.4, 0.9, 0.38, 2.3, 0)
      box(0.5, 0.4, 0.9, 1.62, 2.3, 0)
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
    // ★ A BENCH: a seat plank on two short legs, sitting in the LOWER half of its cell so a keeper
    // steps up onto it. ⚠ Without this arm it would have fallen to `default` and rendered as the
    // beam's little post — silently, with nothing thrown, which is the exact failure this switch's
    // own header describes. `piece-mesh.test.ts` now asserts every piece has an arm, so the
    // sixteenth cannot repeat it.
    case 'bench': {
      box(0.92, 0.12, 0.46, 0, 0.44, 0)          // the plank
      box(0.10, 0.34, 0.10, -0.36, 0.17, -0.16)  // four short legs
      box(0.10, 0.34, 0.10, 0.36, 0.17, -0.16)
      box(0.10, 0.34, 0.10, -0.36, 0.17, 0.16)
      box(0.10, 0.34, 0.10, 0.36, 0.17, 0.16)
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

/**
 * ── ★ THE WALL IS BEAMS THAT FOUND EACH OTHER (Alex, 2026-09-12: "make a beam connect to
 * adjacent beams to make a wall that's only half as thick as a regular block") ────────────────
 * Same derivation as the fence arms — connection is a question asked of the neighbours at sync,
 * never a thing stored — but the arm is a PANEL: half a cell long, the full cell tall, half a
 * cell thick, centred on the cell. Two beams side by side each emit their half and the joint is a
 * continuous wall 0.5 thick; stacked beams make it taller by being taller. A lone beam stays the
 * upright it always was, which is also the honest ghost. `buildWallCore` is the 0.5 square column
 * a CONNECTED beam draws at its centre, so an end or a corner is a flush post rather than the
 * thinner upright peeking out of a 0.5 panel.
 *
 * Collision is unchanged: a beam occupies its whole cell (`pieces.ts`, the fence's argument). The
 * half thickness is the model's business; the cell's job is to stop things.
 */
function buildWallArm(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(0.5, 1, 0.5)
  g.translate(0.25, 0.5, 0)
  const merged = buildMergedGeometry([g])
  g.dispose()
  merged.computeVertexNormals()
  return merged
}
function buildWallCore(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(0.5, 1, 0.5)
  g.translate(0, 0.5, 0)
  const merged = buildMergedGeometry([g])
  g.dispose()
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
  /**
   * ⚠ TAKES `Placement`, NOT A RESTATEMENT OF IT (fixed 2026-08-27). This read
   * `{ pieceId, x, y, z, rot }` — a structural copy of a type it does not own, which is the
   * hand-kept mirror from PATTERNS applied to a TYPE rather than to data. It agreed with
   * `Placement` for as long as `Placement` did not change, and the moment `open?` was added the
   * renderer's signature silently DROPPED it: an open door would have arrived here as a closed one
   * with no error anywhere, because a narrower structural type is a legal argument.
   *
   * The compiler only spoke up because `visualRotation` demanded the real thing. Had the door been
   * wired without that call, this would have been a shipped bug found by looking at a door.
   */
  sync: (placements: Placement[]) => void
  ghost: THREE.Mesh
  setGhost: (pieceId: string, x: number, y: number, z: number, rot: number, ok: boolean) => void
  hideGhost: () => void
  /** Host-injected "is this voxel solid?" — fence arms reach for terrain and walls through it.
   *  Optional: without it fences still connect to each other, just not to the world. */
  setWorldSolid: (fn: ((x: number, y: number, z: number) => boolean) | null) => void
  /** What the last `sync` drew — instance counts per base shape and per derived mesh. For the guard. */
  stats: () => { pieces: Record<string, number>; fenceArms: number; wallPanels: number; wallCores: number }
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
  // The beam wall: panels per connected side + a core per connected beam. Two more draw calls.
  const wallGeo = buildWallArm(), wallCoreGeo = buildWallCore()
  const wallMat = new THREE.MeshLambertMaterial({ color: TINT.beam })
  const wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, MAX_PER_TYPE)
  const wallCoreMesh = new THREE.InstancedMesh(wallCoreGeo, wallMat, MAX_PER_TYPE)
  for (const m of [wallMesh, wallCoreMesh]) { m.count = 0; m.frustumCulled = false; group.add(m) }
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
    // ⚠ BY BASE SHAPE, NOT RAW ID (2026-09-12). This read `p.pieceId === 'fence'`, so a stone
    // fence never joined its neighbours — and, worse, `meshes.get(p.pieceId)` below had no entry
    // for ANY material variant: six of every seven pieces placed since 08-27 wrote occupancy and
    // drew nothing, with no ghost either. Found while giving the beam its wall; the switch in
    // `buildGeometry` learned this lesson two weeks ago and the sync loop never did.
    const fenceCells = new Set<string>(), beamCells = new Set<string>()
    for (const p of placements) {
      const base = basePieceId(p.pieceId)
      if (base === 'fence') fenceCells.add(`${p.x},${p.y},${p.z}`)
      if (base === 'beam') beamCells.add(`${p.x},${p.y},${p.z}`)
    }
    let arms = 0, walls = 0, cores = 0
    for (const p of placements) {
      const base = basePieceId(p.pieceId)
      const inst = meshes.get(base)
      if (!inst) continue
      const i = counts.get(base) ?? 0
      if (i >= MAX_PER_TYPE) continue
      // ★ THE VISUAL ROTATION, NOT THE STORED ONE (2026-08-27, the door pass). An open door swings
      // 90° inside its own cell — that turn is the entire visual payload of the feature, and it is
      // the ONLY place the two rotations may differ. `cellsOf` deliberately uses `p.rot` instead,
      // because the footprint must NOT move; see `PieceDef.openable`. Reading `p.rot` here is what
      // makes an opened door look shut, and reading `visualRotation` in `cellsOf` is what makes it
      // swing its collision into rock. They are opposite mistakes on the same pair of values.
      const pdef = pieceDef(p.pieceId)!
      const vr = visualRotation(p, pdef)
      const po = pivotOffset(pdef, vr)   // ★ see `pivotOffset` — without it a rotated piece draws a cell off
      q.setFromAxisAngle(Y, -(vr * Math.PI) / 2)
      v.set(p.x + po.x, p.y, p.z + po.z)
      inst.setMatrixAt(i, m4.compose(v, q, one))
      counts.set(base, i + 1)
      // ── fence arms: derived, never stored (MC's connection model) ──
      // A side grows an arm toward a sibling fence or any solid voxel — walls and hillsides
      // included. Both fences of a pair emit their own half-arm, which is what makes the joint.
      if (base === 'fence') {
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
      // ── beam walls: the same question, a panel for an answer (see `buildWallArm`) ──
      // ⚠ BEAMS ONLY — NOT the fence's "or any solid voxel" (Alex, 2026-09-12, first beam placed:
      // "it also puts a wall with a shadow on the block behind it"). A beam set down against a
      // block, or on a step, grew a panel into that block and read as a bug, because a single beam
      // is a post until a SECOND beam makes it a wall. The spec said adjacent beams; that is the
      // whole rule. A run ending at a block wall stops a quarter-cell short, and that is visible on
      // purpose rather than a stub nobody placed. A beam with at least one panel draws the core.
      if (base === 'beam') {
        let linked = false
        for (const [dx, dz, yaw] of ARM_DIRS) {
          if (walls >= MAX_PER_TYPE) break
          const nx = p.x + dx, nz = p.z + dz
          if (!beamCells.has(`${nx},${p.y},${nz}`)) continue
          linked = true
          q.setFromAxisAngle(Y, yaw)
          v.set(p.x + 0.5, p.y, p.z + 0.5)
          wallMesh.setMatrixAt(walls++, m4.compose(v, q, one))
        }
        if (linked && cores < MAX_PER_TYPE) {
          q.identity()
          v.set(p.x + 0.5, p.y, p.z + 0.5)
          wallCoreMesh.setMatrixAt(cores++, m4.compose(v, q, one))
        }
      }
    }
    armMesh.count = arms
    armMesh.instanceMatrix.needsUpdate = true
    wallMesh.count = walls; wallMesh.instanceMatrix.needsUpdate = true
    wallCoreMesh.count = cores; wallCoreMesh.instanceMatrix.needsUpdate = true
    for (const [id, inst] of meshes) {
      inst.count = counts.get(id) ?? 0
      inst.instanceMatrix.needsUpdate = true
    }
  }

  return {
    group, ghost, sync,
    setGhost: (pieceId, x, y, z, rot, okToPlace) => {
      const g = geoms.get(basePieceId(pieceId))   // by base: a stone stair ghosts as a stair
      if (!g) { ghost.visible = false; return }
      ghost.geometry = g
      ghostMat.color.setHex(okToPlace ? 0x7fd4ff : 0xff6b6b)
      ghost.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(rot * Math.PI) / 2)
      const po = pivotOffset(pieceDef(pieceId)!, rot as Rotation)   // the same correction the instances get
      ghost.position.set(x + po.x, y, z + po.z)
      ghost.visible = true
    },
    hideGhost: () => { ghost.visible = false },
    setWorldSolid: (fn) => { worldSolid = fn },
    stats: () => ({
      pieces: Object.fromEntries([...meshes].map(([id, m]) => [id, m.count]).filter(([, n]) => (n as number) > 0)),
      fenceArms: armMesh.count, wallPanels: wallMesh.count, wallCores: wallCoreMesh.count,
    }),
    dispose: () => {
      for (const g of geoms.values()) g.dispose()
      for (const m of mats.values()) m.dispose()
      armGeo.dispose(); armMat.dispose()
      wallGeo.dispose(); wallCoreGeo.dispose(); wallMat.dispose()
      ghostMat.dispose()
    },
  }
}
