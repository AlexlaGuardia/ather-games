// The garden bed's timber rim — drawn only where a bed ends.
//
// ── ★ WHY (2026-09-18, Alex: "could they merge as fences do.. a 3x6 garden bed doesnt look like a
//    grid but a rectangle giant bed") ──────────────────────────────────────────────────────────
// A bed was a cube whose TOP tile carried a painted frame, so six beds in a row were six framed
// squares — a grid, never a bed. `tiles.ts` wrote the fix down the day the frame was painted: *"the
// border is edge geometry emitted only on the outside of a run."* This is that geometry. The top
// tile is now bare turned earth; a timber RAIL sits along every edge whose neighbour is not a bed of
// the same wood, and a POST stands on every outer corner. Two beds touching share no rail between
// them, so a 3×6 is one rectangle of soil inside one frame.
//
// ★ SAME WOOD ONLY. A goldwood bed beside a dawnwood bed keeps its own frame — the seam between two
// timbers is a real thing to see, and it is also what makes the rule statable in one line.
//
// ★ HOST SIDE (three), shaped after `station-mesh.ts`: one InstancedMesh per (wood × part), cells
// cached per column and invalidated by the same calls that invalidate flora and stations. The MASK
// is never cached — it is four live reads per bed at sync time, so a bed placed at a column's edge
// re-rails its neighbour across the seam without the neighbour column being invalidated.
//
// The pure half (`rimMask`) is exported for the oracle; it reads no three and no host state.
import * as THREE from 'three'
import { createPieceMaterial, type PieceMaterial } from './piece-mesh'
import { layerOf, SIDE, BOTTOM } from './tex/tiles'
import { isGardenBed, GARDEN_BEDS } from './garden'
import type { TileArray } from './tex/atlas'
import type { LightUniforms } from './light-glsl'

const SECTION = 16
/** Rails per wood — 20 beds × 4 edges is 80; the plot cap is 20. Generous, still one draw. */
const MAX_PER_KIND = 2048

/** Edge bits, from above: −z, +x, +z, −x. Corner bits: the corner between edge i and edge i+1. */
export const EDGE_N = 1, EDGE_E = 2, EDGE_S = 4, EDGE_W = 8
export interface RimMask { rails: number; posts: number }

/** The four horizontal neighbours, in edge order. */
const DIRS: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]]

/**
 * Which edges of the bed at (x,y,z) need a rail, and which corners a post.
 * A rail where the neighbour is anything but a bed of the SAME material; a post at a corner whose
 * two edges are both rails (an outer corner — where the frame turns).
 */
export function rimMask(read: (x: number, y: number, z: number) => number, x: number, y: number, z: number): RimMask {
  const mat = read(x, y, z)
  let rails = 0
  for (let i = 0; i < 4; i++) {
    const [dx, dz] = DIRS[i]
    if (read(x + dx, y, z + dz) !== mat) rails |= 1 << i
  }
  let posts = 0
  for (let i = 0; i < 4; i++) {
    const a = 1 << i, b = 1 << ((i + 1) & 3)
    if ((rails & a) && (rails & b)) posts |= 1 << i
  }
  return { rails, posts }
}

/** Rail: the −z edge, the full cell long, rising 0.1 over the top face and sunk 0.1 into it. */
const RAIL = { w: 1.0, h: 0.2, d: 0.14 }
/** Post: the corner at (0,0), a hair taller than the rail so the frame's corners read from a distance. */
const POST = { w: 0.2, h: 0.28, d: 0.2 }

/**
 * One box, built about the cell's min corner. Sides wear the bed's SIDE tile (its plank frame); the
 * TOP wears the bed's BOTTOM tile — dark wood grit. ⚠ NOT the side tile on top: `tiles.ts` tunes a
 * top tile dark because the lighting lifts a top face ~3.6×, and the plank tile painted at full
 * wood brightness came out as a pale grey band on the first prod shot (09-18).
 */
function boxFor(mat: number, w: number, h: number, d: number, cx: number, cy: number, cz: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(cx, cy, cz)
  const n = g.attributes.position.count
  const side = layerOf(mat, SIDE)
  g.setAttribute('aLayerTop', new THREE.BufferAttribute(new Float32Array(n).fill(layerOf(mat, BOTTOM)), 1))
  g.setAttribute('aLayerSide', new THREE.BufferAttribute(new Float32Array(n).fill(side), 1))
  g.setAttribute('aEmissive', new THREE.BufferAttribute(new Float32Array(n).fill(0), 1))
  return g
}

export interface BedRims {
  group: THREE.Group
  invalidate(key: string): void
  invalidateAll(): void
  sync(columns: { key: string; x0: number; z0: number; ySpan: number }[], read: (x: number, y: number, z: number) => number): void
  setCartoon(v: Record<string, number>): void
  /** For the readout: rails and posts drawn. */
  counts(): { rails: number; posts: number }
  dispose(): void
}

export function createBedRims(tiles: TileArray, light?: LightUniforms): BedRims {
  const group = new THREE.Group()
  const material: PieceMaterial = createPieceMaterial(tiles, { emissive: true }, light)
  const rails = new Map<number, THREE.InstancedMesh>()
  const posts = new Map<number, THREE.InstancedMesh>()
  for (const mat of GARDEN_BEDS) {
    const r = new THREE.InstancedMesh(boxFor(mat, RAIL.w, RAIL.h, RAIL.d, 0.5, 1.0, RAIL.d / 2), material, MAX_PER_KIND)
    const p = new THREE.InstancedMesh(boxFor(mat, POST.w, POST.h, POST.d, POST.w / 2, 1.0 + (POST.h - RAIL.h) / 2, POST.d / 2), material, MAX_PER_KIND)
    for (const m of [r, p]) { m.count = 0; m.frustumCulled = false; group.add(m) }
    rails.set(mat, r); posts.set(mat, p)
  }

  // Per-column cache: the bed cells in it, as [x, y, z]. The mask is read live at sync.
  const cache = new Map<string, number[]>()
  const scan = (c: { key: string; x0: number; z0: number; ySpan: number }, read: (x: number, y: number, z: number) => number): number[] => {
    const hit = cache.get(c.key)
    if (hit) return hit
    const out: number[] = []
    for (let y = 0; y < c.ySpan; y++) for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      if (isGardenBed(read(c.x0 + x, y, c.z0 + z))) out.push(c.x0 + x, y, c.z0 + z)
    }
    cache.set(c.key, out)
    return out
  }

  // The four edge placements: rotate the −z-edge geometry about the cell's centre. Rotation about +y
  // by a takes local (0.5, ·, 0) → the −x edge at +90°, the +x edge at −90°, the +z edge at 180°.
  const EDGE_TURN = [0, -Math.PI / 2, Math.PI, Math.PI / 2]
  const m4 = new THREE.Matrix4()
  const toCentre = new THREE.Matrix4().makeTranslation(-0.5, 0, -0.5)
  const rot = new THREE.Matrix4()
  const cell = new THREE.Matrix4()
  const placeAt = (x: number, y: number, z: number, turn: number): THREE.Matrix4 => {
    cell.makeTranslation(x + 0.5, y, z + 0.5)
    rot.makeRotationY(turn)
    return m4.copy(cell).multiply(rot).multiply(toCentre)
  }
  let last = { rails: 0, posts: 0 }

  return {
    group,
    invalidate: (key) => { cache.delete(key) },
    invalidateAll: () => { cache.clear() },
    sync: (columns, read) => {
      const nr = new Map<number, number>(), np = new Map<number, number>()
      for (const c of columns) {
        const cells = scan(c, read)
        for (let i = 0; i < cells.length; i += 3) {
          const x = cells[i], y = cells[i + 1], z = cells[i + 2]
          const mat = read(x, y, z)
          const r = rails.get(mat), p = posts.get(mat)
          if (!r || !p) continue
          const mask = rimMask(read, x, y, z)
          for (let e = 0; e < 4; e++) {
            if (mask.rails & (1 << e)) {
              const n = nr.get(mat) ?? 0
              if (n < MAX_PER_KIND) { r.setMatrixAt(n, placeAt(x, y, z, EDGE_TURN[e])); nr.set(mat, n + 1) }
            }
            // The post for corner e stands where edge e meets edge e+1: the −z/+x corner for e=0,
            // which is the post geometry (built at (0,0)) turned by −90°, i.e. one edge-turn on.
            if (mask.posts & (1 << e)) {
              const n = np.get(mat) ?? 0
              if (n < MAX_PER_KIND) { p.setMatrixAt(n, placeAt(x, y, z, EDGE_TURN[(e + 1) & 3])); np.set(mat, n + 1) }
            }
          }
        }
      }
      let tr = 0, tp = 0
      for (const [mat, r] of rails) { r.count = nr.get(mat) ?? 0; r.instanceMatrix.needsUpdate = true; tr += r.count }
      for (const [mat, p] of posts) { p.count = np.get(mat) ?? 0; p.instanceMatrix.needsUpdate = true; tp += p.count }
      last = { rails: tr, posts: tp }
    },
    setCartoon: (v) => material.setCartoon(v),
    counts: () => ({ ...last }),
    dispose: () => {
      for (const m of [...rails.values(), ...posts.values()]) m.geometry.dispose()
      material.dispose()
    },
  }
}
