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
import { PIECES, basePieceId, pieceDef, type PieceDef, type Placement, type Rotation } from '../voxel/pieces'
import { materialForItem } from '../voxel/registry'
import { layerOf, TOP, SIDE } from './tex/tiles'
import { MATERIAL_COLOR } from './attrs'
import type { TileArray } from './tex/atlas'

/** Provisional colours — wood-toned so a shed reads as a shed. Not a look call. */
const TINT: Record<string, number> = {
  doorway: 0x8a6a34,
  doorway_double: 0x8a6a34,
  doorway_grand: 0x8a6a34,
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
  pane: 0x9fc4d8,
  door_double: 0x7a5c30,
  door_grand: 0x7a5c30,
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
/**
 * ── ★ A PIECE WEARS ITS MATERIAL'S BLOCK (Alex, 2026-09-12: "work on the beams textures.. a
 * version for each of the solid blocks we already have") ─────────────────────────────────────
 * Until today every piece drew in a flat tint keyed on its SHAPE: a stone-brick stair and a
 * goldwood stair were the same brown. Now the block a piece is paid in is the block it looks
 * like — the same atlas layers the world's own cubes sample, so a beam in plaster and a wall of
 * plaster cannot disagree about what plaster is, and a new block gets a beam the day it gets a
 * tile. `pieceBlock` is the one derivation; the layers and the icon tint both come off it.
 */
export function pieceBlock(pieceId: string): number | undefined {
  const def = pieceDef(pieceId)
  if (!def) return undefined
  // The cost IS the material: `pieces.ts` overrides every variant's cost to its material's item,
  // and `palette.test.ts` § 3 asserts it, so there is no second lookup to disagree with this one.
  const item = def.cost[0]?.itemId
  return item ? materialForItem(item) : undefined
}
/**
 * ── ★ A PIECE BREAKS LIKE ITS BLOCK, NOT LIKE A BUTTON (Alex, 2026-09-12: "the pieces just break
 * instantly if left clicked.. can we bring them up to speed with the other blocks") ────────────
 * A placed piece came down on the first frame of a left click — no swing, no chips, no gauge —
 * because its cells are `STRUCTURE`, which has no block definition, so the mine loop had nothing
 * to spend seconds against and the piece path short-circuited straight to `deconstruct`. This is
 * the target the mine loop works on instead: the PLACEMENT ORIGIN (so every cell of one wall
 * accumulates on one bar rather than restarting per cell) wearing the block the piece is paid
 * in (`pieceBlock`), so a stone-brick stair asks for the spike and takes stone-brick seconds, and
 * a thatch roof gives like thatch. `/mine` dials it with everything else. Undefined when the
 * piece has no block, which `piece-break.test` says never happens for a shipped shape.
 */
export function pieceBreakTarget(found: Placement): { x: number; y: number; z: number; material: number } | undefined {
  const material = pieceBlock(found.pieceId)
  return material === undefined ? undefined : { x: found.x, y: found.y, z: found.z, material }
}
/** Atlas layers a piece's faces sample — top for ±y, side for the rest. */
export function pieceLayers(pieceId: string): { top: number; side: number } {
  const m = pieceBlock(pieceId)
  return m === undefined ? { top: -1, side: -1 } : { top: layerOf(m, TOP), side: layerOf(m, SIDE) }
}
/** The icon's flat tint: the material's block colour, falling back to the old per-shape placeholder. */
export const pieceTint = (def: PieceDef): number => {
  const m = pieceBlock(def.id)
  return (m !== undefined ? MATERIAL_COLOR[m] : undefined) ?? TINT[basePieceId(def.id)] ?? 0x999999
}

/**
 * The textured piece program: one Lambert material for every instanced mesh, sampling the world's
 * tile array with the world's own UV rule (`atlas.ts` › the UV derivation — the two in-plane axes
 * of the face, v negated on sides so painted tiles land upright). Two per-INSTANCE attributes
 * carry the layers, so one draw call per shape covers every material.
 * ⚠ Geometry-local position and normal, read BEFORE the instance transform: a tile aligns to the
 * piece's own frame, and rotating the piece rotates its grain with it.
 */
function createPieceMaterial(tiles: TileArray, opts: { cutout?: boolean } = {}): THREE.MeshLambertMaterial {
  // `cutout`: the pane's program — the glass tiles' alpha is coverage, discarded below half, and
  // both faces draw because a pane is looked at from the room and from the yard.
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: opts.cutout ? THREE.DoubleSide : THREE.FrontSide })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTiles = { value: tiles.texture }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aLayerTop;
attribute float aLayerSide;
varying float vLayerTop;
varying float vLayerSide;
varying vec3 vPPos;
varying vec3 vPNorm;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLayerTop = aLayerTop;
vLayerSide = aLayerSide;
vPPos = position;
vPNorm = normal;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2DArray uTiles;
varying float vLayerTop;
varying float vLayerSide;
varying vec3 vPPos;
varying vec3 vPNorm;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 an = abs(vPNorm);
  vec2 tileUv = an.y > 0.5
    ? vPPos.xz
    : (an.x > 0.5 ? vec2(vPPos.z, -vPPos.y) : vec2(vPPos.x, -vPPos.y));
  float layer = an.y > 0.5 ? vLayerTop : vLayerSide;
  if (layer >= 0.0) {
    vec4 tile = texture(uTiles, vec3(tileUv, layer));
${opts.cutout ? '    if (tile.a < 0.5) discard;' : ''}
    diffuseColor.rgb *= tile.rgb;
  }
}`)
  }
  return mat
}

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

/**
 * @param open the OPEN pose of an openable piece (2026-09-13). An open door used to be the shut
 *   geometry rotated 90° as a whole, which only works for one leaf in one cell. Now each openable
 *   shape authors both poses and the renderer keeps a mesh per pose; a double door's two leaves
 *   swing apart, and a leaf never leaves the plane it is hinged to.
 */
function buildGeometry(def: PieceDef, open = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d)
    g.translate(x, y, z)
    parts.push(g)
  }
  /**
   * A door leaf, hinged at one jamb. Local cell coords: cell i is centred at x = i, the wall's
   * plane is z = 0 and the FRONT face is z = −0.5. Shut, the leaf lies along the front at
   * z ≈ −0.43; open, it has swung 90° into the cell (toward +z) about its hinge edge, so it
   * stands along the jamb it hangs from — inside the footprint, which is the promise
   * `piece-origin.test.ts` measures. `x0`/`x1` are the leaf's extent; the hinge is whichever end
   * `hinge` names.
   */
  const leaf = (x0: number, x1: number, h: number, hinge: 'left' | 'right', open: boolean, ledges = true) => {
    const w = x1 - x0, t = 0.1
    if (!open) {
      box(w - 0.06, h - 0.08, t, (x0 + x1) / 2, h / 2, -0.43)
      if (ledges) for (const y of [h * 0.3, h * 0.66]) box(w - 0.14, 0.05, 0.03, (x0 + x1) / 2, y, -0.49)
      box(0.06, 0.06, 0.06, hinge === 'left' ? x1 - 0.15 : x0 + 0.15, h / 2, -0.5)   // the pull, on the free edge
    } else {
      const hx = hinge === 'left' ? x0 + 0.05 : x1 - 0.05          // the hinge line, just inside the jamb
      box(t, h - 0.08, w - 0.06, hx, h / 2, -0.5 + (w - 0.06) / 2 + 0.03)
      if (ledges) for (const y of [h * 0.3, h * 0.66]) box(0.03, 0.05, w - 0.14, hx + (hinge === 'left' ? -0.06 : 0.06), y, -0.5 + (w - 0.06) / 2 + 0.03)
    }
  }
  /** A doorway frame: full-cell posts at the outer columns, a one-cell head over the opening. */
  const frame = (w: number, h: number) => {
    box(0.5, h, 0.5, 0, h / 2, 0)                  // left post — cell 0, full height, 0.5 square
    box(0.5, h, 0.5, w - 1, h / 2, 0)              // right post — cell w-1
    box(w - 2 + 0.5, 1, 0.5, (w - 1) / 2, h - 0.5, 0)   // the head: the top row over the opening, into the posts
    box(w - 2, 0.12, 0.56, (w - 1) / 2, h - 1.06, 0)     // a lintel lip under the head
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
    case 'pane': {
      // A sheet in the wall's plane. Its faces are ±z, so the tile uv is the x/y rule and the
      // glass lattice lands upright; 0.06 thick so it has an edge to catch light without reading
      // as a slab. The tile's own frame (every edge texel is lead) is the muntin between panes.
      box(1, 1, 0.06, 0, 0.5, 0)
      break
    }
    case 'doorway': { frame(3, 3); break }
    case 'doorway_double': { frame(4, 3); break }
    case 'doorway_grand': { frame(5, 4); break }
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
      // standing up. It SHUTS as of the door pass; open, it stands along its left jamb.
      if (!open) box(0.9, 0.9, 0.12, 0, 0.5, -0.44)
      else box(0.12, 0.9, 0.9, -0.44, 0.5, 0)
      break
    }
    case 'door': {
      // A leaf hung against one edge of its cell. ★ THE HINGE SIDE IS OFF-CENTRE ON PURPOSE — a
      // panel modelled through the middle of the cell rotates about its own centre and reads as a
      // slab spinning in place. Hung at the edge, the same 90° turn reads as a door swinging, and
      // that difference is the entire visual payload of the feature.
      leaf(-0.5, 0.5, 2, 'left', open)
      break
    }
    case 'door_double': {
      // Two leaves, hinged at the outer jambs, meeting in the middle; both swing.
      leaf(-0.5, 0.5, 2, 'left', open)
      leaf(0.5, 1.5, 2, 'right', open)
      break
    }
    case 'door_grand': {
      // Two tall leaves, a cell and a half each, for the hall. ⚠ Open, a leaf is 1.5 long and the
      // footprint is 1 deep, so it stands half a cell proud of its cells — into the room's air.
      leaf(-0.5, 1, 3, 'left', open)
      leaf(1, 2.5, 3, 'right', open)
      break
    }
    case 'gate': {
      // The fence's door: the same rail language as `fence` so a run of fence and its gate read as
      // one thing, hung at the edge like the door so it swings rather than spins.
      if (!open) {
        box(0.9, 0.14, 0.12, 0, 0.78, -0.43)
        box(0.9, 0.14, 0.12, 0, 0.42, -0.43)
        box(0.14, 0.86, 0.12, -0.38, 0.6, -0.43)
        box(0.14, 0.86, 0.12, 0.38, 0.6, -0.43)
      } else {
        box(0.12, 0.14, 0.9, -0.43, 0.78, 0)
        box(0.12, 0.14, 0.9, -0.43, 0.42, 0)
        box(0.12, 0.86, 0.14, -0.43, 0.6, -0.38)
        box(0.12, 0.86, 0.14, -0.43, 0.6, 0.38)
      }
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
  /** The atlas layers the i-th instance of a base shape (or 'wall' / 'core' / 'arm') samples. For the guard. */
  layersAt: (mesh: string, i: number) => { top: number; side: number }
  dispose: () => void
}

const MAX_PER_TYPE = 4096

/** The two per-instance layer attributes every textured mesh carries. */
function addLayerAttrs(g: THREE.BufferGeometry): { top: THREE.InstancedBufferAttribute; side: THREE.InstancedBufferAttribute } {
  const top = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PER_TYPE).fill(-1), 1)
  const side = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PER_TYPE).fill(-1), 1)
  top.setUsage(THREE.DynamicDrawUsage); side.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('aLayerTop', top); g.setAttribute('aLayerSide', side)
  return { top, side }
}

/**
 * @param tiles the world's tile array. With it, pieces wear their material's block; without it
 *   (no atlas — a test, a fallback) they draw in the per-shape placeholder tints as before.
 */
export function createPieceRenderer(tiles: TileArray | null = null): PieceRenderer {
  const group = new THREE.Group()
  const geoms = new Map<string, THREE.BufferGeometry>()
  const meshes = new Map<string, THREE.InstancedMesh>()
  const mats = new Map<string, THREE.Material>()
  const layers = new Map<string, { top: THREE.InstancedBufferAttribute; side: THREE.InstancedBufferAttribute }>()
  const textured = tiles ? createPieceMaterial(tiles) : null
  // The glass-family shapes (the pane) draw through a cutout copy of the same program.
  const texturedCutout = tiles ? createPieceMaterial(tiles, { cutout: true }) : null
  const isGlassShape = (def: PieceDef) => !!def.variants && def.variants.length === 1 && def.variants[0] === 'glass'

  for (const def of PIECES) {
    // An openable shape gets a second mesh for its OPEN pose, keyed `<id>:open` — see buildGeometry.
    for (const open of def.openable ? [false, true] : [false]) {
      const g = buildGeometry(def, open)
      const id = open ? `${def.id}:open` : def.id
      layers.set(id, addLayerAttrs(g))
      const m = (isGlassShape(def) ? texturedCutout : textured) ?? new THREE.MeshLambertMaterial({ color: TINT[def.id] ?? 0x999999, side: isGlassShape(def) ? THREE.DoubleSide : THREE.FrontSide })
      const inst = new THREE.InstancedMesh(g, m, MAX_PER_TYPE)
      inst.count = 0
      inst.frustumCulled = false   // instances span the world; the mesh's own bounds are meaningless
      geoms.set(id, g); if (!textured) mats.set(id, m); meshes.set(id, inst)
      group.add(inst)
    }
  }

  // The fence arms: one extra instanced mesh, same law as everything else. 4096 arms = a
  // thousand fully-connected fences; the cap is a backstop, not a plan.
  const armGeo = buildFenceArm()
  const armLayers = addLayerAttrs(armGeo)
  const armMat = textured ?? new THREE.MeshLambertMaterial({ color: TINT.fence })
  const armMesh = new THREE.InstancedMesh(armGeo, armMat, MAX_PER_TYPE)
  armMesh.count = 0
  armMesh.frustumCulled = false
  group.add(armMesh)
  // The beam wall: panels per connected side + a core per connected beam. Two more draw calls.
  // ⚠ Arms, panels and cores are authored about the CELL CENTRE (they rotate about the post), so
  // their tile uv is offset half a cell from the piece's — the shader reads local position, and
  // local (0,0) is the middle. Harmless: a tile is periodic, and half a tile is still the tile.
  const wallGeo = buildWallArm(), wallCoreGeo = buildWallCore()
  const wallLayers = addLayerAttrs(wallGeo), coreLayers = addLayerAttrs(wallCoreGeo)
  const wallMat = textured ?? new THREE.MeshLambertMaterial({ color: TINT.beam })
  const wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, MAX_PER_TYPE)
  const wallCoreMesh = new THREE.InstancedMesh(wallCoreGeo, wallMat, MAX_PER_TYPE)
  for (const m of [wallMesh, wallCoreMesh]) { m.count = 0; m.frustumCulled = false; group.add(m) }
  /** Per-piece layers, memoised: a sync over thousands of placements asks this per instance. */
  const layerCache = new Map<string, { top: number; side: number }>()
  const layersOf = (pieceId: string) => {
    let l = layerCache.get(pieceId)
    if (!l) { l = pieceLayers(pieceId); layerCache.set(pieceId, l) }
    return l
  }
  const setLayers = (at: { top: THREE.InstancedBufferAttribute; side: THREE.InstancedBufferAttribute }, i: number, l: { top: number; side: number }) => {
    at.top.setX(i, l.top); at.side.setX(i, l.side)
  }
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
      const pdef0 = pieceDef(p.pieceId)
      // The pose picks the mesh: an open door is its own geometry, at its STORED rotation.
      const meshKey = pdef0?.openable && p.open ? `${base}:open` : base
      const inst = meshes.get(meshKey)
      if (!inst) continue
      const i = counts.get(meshKey) ?? 0
      if (i >= MAX_PER_TYPE) continue
      // ★ THE STORED ROTATION, ALWAYS (2026-09-13). An open door used to be drawn by rotating the
      // whole piece a quarter-turn (`visualRotation`, retired); the open POSE is its own mesh now,
      // so the drawn rotation and the footprint rotation are one number and cannot disagree.
      const pdef = pdef0!
      const po = pivotOffset(pdef, p.rot)   // ★ see `pivotOffset` — without it a rotated piece draws a cell off
      q.setFromAxisAngle(Y, -(p.rot * Math.PI) / 2)
      v.set(p.x + po.x, p.y, p.z + po.z)
      inst.setMatrixAt(i, m4.compose(v, q, one))
      const pl = layersOf(p.pieceId)
      setLayers(layers.get(meshKey)!, i, pl)
      counts.set(meshKey, i + 1)
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
          setLayers(armLayers, arms, pl)
          armMesh.setMatrixAt(arms++, m4.compose(v, q, one))
        }
      }
      // ── beam walls: the same question, a panel for an answer (see `buildWallArm`) ──
      // A side grows a panel toward a sibling beam OR any solid voxel — the fence's rule — so a
      // run of beams meets a doorway or a block wall flush.
      // ★ THIS RULE WAS SHIPPED, REVERSED, AND RESTORED IN ONE DAY (2026-09-12), and the reason is
      // worth the lines: Alex's first beam against a block showed "a wall behind the beam", and the
      // rule took the blame. The panel was in the RIGHT cell; the beam's own pole was drawn one
      // cell away by the rotation-pivot bug (`pivotOffset`). With the pole honest he asked for the
      // world link back. A rule judged from a wrong render is not a judged rule.
      // A beam with at least one panel draws the core.
      if (base === 'beam') {
        let linked = false
        for (const [dx, dz, yaw] of ARM_DIRS) {
          if (walls >= MAX_PER_TYPE) break
          const nx = p.x + dx, nz = p.z + dz
          const link = beamCells.has(`${nx},${p.y},${nz}`) || (worldSolid?.(nx, p.y, nz) ?? false)
          if (!link) continue
          linked = true
          q.setFromAxisAngle(Y, yaw)
          v.set(p.x + 0.5, p.y, p.z + 0.5)
          setLayers(wallLayers, walls, pl)
          wallMesh.setMatrixAt(walls++, m4.compose(v, q, one))
        }
        if (linked && cores < MAX_PER_TYPE) {
          q.identity()
          v.set(p.x + 0.5, p.y, p.z + 0.5)
          setLayers(coreLayers, cores, pl)
          wallCoreMesh.setMatrixAt(cores++, m4.compose(v, q, one))
        }
      }
    }
    armMesh.count = arms
    armMesh.instanceMatrix.needsUpdate = true
    wallMesh.count = walls; wallMesh.instanceMatrix.needsUpdate = true
    wallCoreMesh.count = cores; wallCoreMesh.instanceMatrix.needsUpdate = true
    for (const at of [armLayers, wallLayers, coreLayers]) { at.top.needsUpdate = true; at.side.needsUpdate = true }
    for (const [id, inst] of meshes) {
      inst.count = counts.get(id) ?? 0
      inst.instanceMatrix.needsUpdate = true
      const at = layers.get(id)!; at.top.needsUpdate = true; at.side.needsUpdate = true
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
    layersAt: (mesh, i) => {
      const at = mesh === 'wall' ? wallLayers : mesh === 'core' ? coreLayers : mesh === 'arm' ? armLayers : layers.get(mesh)
      return at ? { top: at.top.getX(i), side: at.side.getX(i) } : { top: -1, side: -1 }
    },
    stats: () => ({
      pieces: Object.fromEntries([...meshes].map(([id, m]) => [id, m.count]).filter(([, n]) => (n as number) > 0)),
      fenceArms: armMesh.count, wallPanels: wallMesh.count, wallCores: wallCoreMesh.count,
    }),
    dispose: () => {
      for (const g of geoms.values()) g.dispose()
      for (const m of mats.values()) m.dispose()
      armGeo.dispose(); armMat.dispose()
      wallGeo.dispose(); wallCoreGeo.dispose(); wallMat.dispose()
      textured?.dispose()
      texturedCutout?.dispose()
      ghostMat.dispose()
    },
  }
}
