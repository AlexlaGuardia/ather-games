// Icons for the things the world builds out of GEOMETRY instead of faces.
//
// ── ★ WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────
// `item-icon.ts` derives an icon from the block's own texture, and its whole argument is that an
// item must never carry a second opinion about what it looks like. That works for anything the
// mesher builds out of cubes or crossed quads. It has nothing to say about a DEADFALL LOG or a
// MUSHROOM: the world draws both as instanced 3D geometry with a flat tint and no tile texture at
// all, so there is no `paintFor` case to sample and both fell to the honest "nobody drew this" chip.
// They were the last two items on Alex's art queue, and they were never really an art problem.
//
// ★ SO THE ICON RENDERS THE SHIPPED GEOMETRY, and imports it from `flora-mesh.ts` rather than
// rebuilding it. The post-construction calls there are the shape — `rotateZ` is what makes a log lie
// down — so a module that restated `new CylinderGeometry(0.15, 0.13, 1.0, 6)` would draw a standing
// post and be perfectly self-consistent about the wrong thing. One definition, two consumers.
//
// ★ PURE, FOR THE SAME REASON `rasterIcon` IS PURE. No canvas, no WebGL, no DOM — a software
// z-buffer over the real vertices. That is what lets a headless script and a test render exactly
// what the bag renders. A preview that re-derives the projection can be correct while the game is
// wrong, and this file exists downstream of a day that cost.
//
// ⚠ `three` is imported for GEOMETRY MATH ONLY (BufferGeometry, and the primitives behind the
// factories). Nothing here touches a renderer or a GL context, which is why it runs under node.

import * as THREE from 'three'
import { floraLogGeo, floraShroomStemGeo, floraShroomCapGeo, FLORA_COLORS } from '../flora-mesh'
import { MAT } from '../../voxel/depth'

/** One part of a mesh icon: geometry plus the flat tint the world gives it. */
interface Part { geo: THREE.BufferGeometry; color: number }

/**
 * Which materials are drawn as scatter geometry, and out of what.
 *
 * ⚠ KEYED ON MATERIAL, NOT ON ITEM ID. An item id is a name; a material is the thing the mesher
 * actually switches on, so this stays true if an item is ever renamed or a second item starts
 * dropping the same block. `mesh-icon.test.ts` asserts each entry still resolves to real geometry
 * and that nothing here has quietly acquired a tile texture instead.
 *
 * ★ A MUSHROOM IS TWO PARTS BECAUSE THE WORLD DRAWS IT AS TWO — stalk and cap, separate geometry
 * and separate colours. Collapsing it to one would be the icon inventing a simpler object.
 * The cap takes `shroomCaps[0]`; in the world the cap colour varies per instance off the scatter
 * variant, and an icon has no instance, so it takes the first rather than a hand-picked favourite.
 */
const MESH_PARTS: Record<number, () => Part[]> = {
  [MAT.DEADFALL]: () => [{ geo: floraLogGeo(), color: FLORA_COLORS.deadfall }],
  [MAT.MUSHROOM]: () => [
    { geo: floraShroomStemGeo(), color: FLORA_COLORS.shroomStem },
    { geo: floraShroomCapGeo(), color: FLORA_COLORS.shroomCaps[0] },
  ],
}

export const hasMeshIcon = (material: number | undefined): boolean =>
  material !== undefined && material in MESH_PARTS

// ── ★ THE SAME VIEW THE CUBE ICONS USE ─────────────────────────────────────────────────────────
// `rasterIcon` projects a cube seen from the standard isometric three-quarter angle. A mesh icon
// sitting in the same hotbar has to agree, or the bag looks like two different games. Y then X, the
// textbook iso pair, applied to the vertices directly — there is no camera object anywhere here.
const YAW = Math.PI / 4, PITCH = Math.atan(Math.SQRT1_2)   // 45deg, ~35.26deg — true isometric
/** Light from up and over the viewer's left shoulder, matching where the cube's lit face sits. */
const LIGHT = (() => { const v = [-0.4, 0.82, 0.41]; const n = Math.hypot(...v); return v.map(c => c / n) })()
const AMBIENT = 0.55

/**
 * Rasterise mesh parts into a plain RGBA buffer.
 *
 * Flat shading per triangle rather than smooth: this world's vocabulary is faceted (the log is a
 * 6-gon on purpose), and smoothing a 6-sided trunk at 48px turns a readable silhouette into a blur.
 */
export function renderParts(parts: Part[], size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  const depth = new Float32Array(size * size).fill(Infinity)

  const cy = Math.cos(YAW), sy = Math.sin(YAW), cp = Math.cos(PITCH), sp = Math.sin(PITCH)
  const view = (x: number, y: number, z: number) => {
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy          // yaw about Y
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp         // pitch about X
    return [x1, y2, z2] as const
  }

  // ── one fit for ALL parts together ────────────────────────────────────────────────────────────
  // ⚠ Fitting each part on its own would scale a mushroom's cap to the same size as its stalk and
  // rebuild the object wrong. The bounds are taken in VIEW space, after projection, so the fit is of
  // what is actually seen rather than of the model's axis-aligned box.
  const tris: { p: (readonly [number, number, number])[]; color: number }[] = []
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const { geo, color } of parts) {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const idx = geo.index
    const count = idx ? idx.count : pos.count
    for (let i = 0; i < count; i += 3) {
      const p = [0, 1, 2].map(k => {
        const v = idx ? idx.getX(i + k) : i + k
        return view(pos.getX(v), pos.getY(v), pos.getZ(v))
      })
      for (const [vx, vy] of p) {
        if (vx < minX) minX = vx; if (vx > maxX) maxX = vx
        if (vy < minY) minY = vy; if (vy > maxY) maxY = vy
      }
      tris.push({ p, color })
    }
  }
  if (!tris.length) return out

  const pad = size * 0.08
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const scale = (size - pad * 2) / span
  const ox = size / 2 - ((minX + maxX) / 2) * scale
  const oy = size / 2 + ((minY + maxY) / 2) * scale        // +Y is up in model space, down in pixels

  for (const { p, color } of tris) {
    const sx = p.map(v => ox + v[0] * scale)
    const sPy = p.map(v => oy - v[1] * scale)
    const sz = p.map(v => v[2])

    // Face normal from the VIEW-space triangle, so shading follows what is seen.
    const ux = sx[1] - sx[0], uy = sPy[1] - sPy[0], uz = sz[1] - sz[0]
    const vx = sx[2] - sx[0], vy = sPy[2] - sPy[0], vz = sz[2] - sz[0]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const nl = Math.hypot(nx, ny, nz) || 1
    nx /= nl; ny /= nl; nz /= nl
    const lambert = Math.abs(nx * LIGHT[0] - ny * LIGHT[1] + nz * LIGHT[2])
    const shade = AMBIENT + (1 - AMBIENT) * lambert

    const r = ((color >> 16) & 255) * shade, g = ((color >> 8) & 255) * shade, b = (color & 255) * shade

    const x0 = Math.max(0, Math.floor(Math.min(...sx))), x1 = Math.min(size - 1, Math.ceil(Math.max(...sx)))
    const y0 = Math.max(0, Math.floor(Math.min(...sPy))), y1 = Math.min(size - 1, Math.ceil(Math.max(...sPy)))
    const area = (sx[1] - sx[0]) * (sPy[2] - sPy[0]) - (sx[2] - sx[0]) * (sPy[1] - sPy[0])
    if (Math.abs(area) < 1e-9) continue                     // edge-on, contributes nothing

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5
        // Barycentric coverage — the same inverse-mapping approach `rasterIcon` uses, and for the
        // same reason: solving each output pixel leaves no seams, where splatting forward does.
        const w0 = ((sx[1] - px) * (sPy[2] - py) - (sx[2] - px) * (sPy[1] - py)) / area
        const w1 = ((sx[2] - px) * (sPy[0] - py) - (sx[0] - px) * (sPy[2] - py)) / area
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue
        const z = w0 * sz[0] + w1 * sz[1] + w2 * sz[2]
        const di = y * size + x
        if (z >= depth[di]) continue                        // nearer wins; +Z is toward the viewer
        depth[di] = z
        const o = di * 4
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255
      }
    }
  }
  return out
}

/** The icon for a material the world draws as geometry, or null if it does not. */
export function meshIcon(material: number | undefined, size: number): Uint8Array | null {
  if (material === undefined) return null
  const make = MESH_PARTS[material]
  if (!make) return null
  const parts = make()
  const px = renderParts(parts, size)
  for (const p of parts) p.geo.dispose()                    // factories hand out fresh buffers
  return px
}
