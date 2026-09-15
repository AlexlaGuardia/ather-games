// Station rendering — the modelled blocks, standing in the world.
//
// ★ HOST SIDE. This file may import three; `voxel/` may not.
//
// ★ ONE InstancedMesh PER MATERIAL, NON-NEGOTIABLE (piece-mesh's rule): a village has hundreds of
// benches and cauldrons, and anything per-cell is the WebGL-context-loss bug. Eleven draws total.
//
// ★ THE RENDERER OWNS CELL TRUTH THE WAY FLORA DOES. It scans a column for modelled materials on
// demand, caches the cells per column, and is invalidated on edit and adoption by the same two
// calls that invalidate flora — so a placed cauldron appears on the next sync and a mined one goes
// with its cell. A sync assembles instance matrices from the cache; the per-frame cost is nothing.
//
// ★ TEXTURED BY THE BLOCK'S OWN TILES, LIT LIKE THE BLOCK IT REPLACES. The material is the piece
// renderer's (`createPieceMaterial`): the tile array, the cartoon stack and the light field, so a
// mortar on a lit floor reads exactly as the mortar cube did. Layers ride PER VERTEX here (a model's
// parts wear different tiles), not per instance as a piece's do — the shader reads the attribute
// either way, which is why one program serves both.
import * as THREE from 'three'
import { MODELLED_MATS } from '../voxel/depth'
import { modelOf, type StationModel } from './station-models'
import { createPieceMaterial, type PieceMaterial } from './piece-mesh'
import { layerOf, TOP, SIDE } from './tex/tiles'
import { EMISSIVE } from './attrs'
import type { TileArray } from './tex/atlas'
import type { LightUniforms } from './light-glsl'

const SECTION = 16
const MAX_PER_MAT = 4096

export interface StationRenderer {
  group: THREE.Group
  /** Forget a column's cells (its voxels changed). Cheap; the next sync rescans it. */
  invalidate(key: string): void
  invalidateAll(): void
  /**
   * Rebuild instances for every loaded column. `read(x, y, z)` is the host's live voxel read;
   * `height` is the column's top so the scan stops where the world does.
   */
  sync(columns: { key: string; x0: number; z0: number; ySpan: number }[], read: (x: number, y: number, z: number) => number): void
  setCartoon(v: Record<string, number>): void
  /** For the readout: instances drawn per material. */
  counts(): Record<number, number>
  dispose(): void
}

/** Merge a model's boxes into one geometry carrying per-vertex tile layers. */
export function buildStationGeometry(mat: number, model: StationModel): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const p of model.parts) {
    const [w, h, d, x, y, z] = p.box
    const g = new THREE.BoxGeometry(w, h, d)
    // ★ AUTHORED ABOUT THE CELL CENTRE, BUILT ABOUT ITS MIN CORNER (measured on the shelf 09-15): the
    // piece program samples a face's tile by LOCAL position, so the tile's centre lands at local 0.5.
    // A model box centred at 0 would wear the tile's EDGE columns — the still's bulb came out clay
    // with two pale slivers, the hearth's flame a black post. Shifting the geometry by half a cell
    // puts a centred box on the tile's centre, which is what every modeller assumes.
    g.translate(x + 0.5, y, z + 0.5)
    const n = g.attributes.position.count
    const top = new Float32Array(n).fill(layerOf(p.top ?? mat, TOP))
    const side = new Float32Array(n).fill(layerOf(p.side ?? mat, SIDE))
    // The part glows as the block it wears did (× the tile's alpha in the shader), unless told otherwise.
    const glow = new Float32Array(n).fill(p.glow ?? (EMISSIVE[p.side ?? mat] ?? 0))
    g.setAttribute('aLayerTop', new THREE.BufferAttribute(top, 1))
    g.setAttribute('aLayerSide', new THREE.BufferAttribute(side, 1))
    g.setAttribute('aEmissive', new THREE.BufferAttribute(glow, 1))
    parts.push(g)
  }
  return mergeGeometries(parts)
}

/** A minimal merge (position / normal / uv / the two layer attrs) — no examples import. */
function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = ['position', 'normal', 'uv', 'aLayerTop', 'aLayerSide', 'aEmissive'] as const
  const out = new THREE.BufferGeometry()
  const chunks: Record<string, number[]> = {}
  const index: number[] = []
  let base = 0
  for (const g of parts) {
    const ng = g.getIndex()
    if (ng) for (let i = 0; i < ng.count; i++) index.push(ng.getX(i) + base)
    for (const name of names) {
      const a = g.getAttribute(name) as THREE.BufferAttribute | undefined
      if (!a) continue
      const arr = chunks[name] ?? (chunks[name] = [])
      for (let i = 0; i < a.array.length; i++) arr.push(a.array[i] as number)
    }
    base += g.attributes.position.count
    g.dispose()
  }
  const sizes: Record<string, number> = { position: 3, normal: 3, uv: 2, aLayerTop: 1, aLayerSide: 1, aEmissive: 1 }
  for (const name of names) if (chunks[name]) out.setAttribute(name, new THREE.Float32BufferAttribute(chunks[name], sizes[name]))
  out.setIndex(index)
  return out
}

export function createStationRenderer(tiles: TileArray, light?: LightUniforms): StationRenderer {
  const group = new THREE.Group()
  const material: PieceMaterial = createPieceMaterial(tiles, { emissive: true }, light)
  const meshes = new Map<number, THREE.InstancedMesh>()
  for (const mat of MODELLED_MATS) {
    const g = buildStationGeometry(mat, modelOf(mat))
    const inst = new THREE.InstancedMesh(g, material, MAX_PER_MAT)
    inst.count = 0
    inst.frustumCulled = false
    meshes.set(mat, inst)
    group.add(inst)
  }

  /** Per-column cache: the modelled cells found in it, as [mat, x, y, z]. */
  const cache = new Map<string, number[]>()
  const m4 = new THREE.Matrix4()
  const last: Record<number, number> = {}

  const scan = (c: { key: string; x0: number; z0: number; ySpan: number }, read: (x: number, y: number, z: number) => number): number[] => {
    const hit = cache.get(c.key)
    if (hit) return hit
    const out: number[] = []
    for (let y = 0; y < c.ySpan; y++) for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const m = read(c.x0 + x, y, c.z0 + z)
      if (m !== 0 && MODELLED_MATS.has(m)) out.push(m, c.x0 + x, y, c.z0 + z)
    }
    cache.set(c.key, out)
    return out
  }

  return {
    group,
    invalidate: (key) => { cache.delete(key) },
    invalidateAll: () => { cache.clear() },
    sync: (columns, read) => {
      const counts = new Map<number, number>()
      for (const c of columns) {
        const cells = scan(c, read)
        for (let i = 0; i < cells.length; i += 4) {
          const mat = cells[i]
          const inst = meshes.get(mat)
          if (!inst) continue
          const n = counts.get(mat) ?? 0
          if (n >= MAX_PER_MAT) continue
          // Geometry is built about the cell's MIN corner (see `buildStationGeometry`), so the instance sits at it.
          m4.makeTranslation(cells[i + 1], cells[i + 2], cells[i + 3])
          inst.setMatrixAt(n, m4)
          counts.set(mat, n + 1)
        }
      }
      for (const [mat, inst] of meshes) {
        const n = counts.get(mat) ?? 0
        inst.count = n
        inst.instanceMatrix.needsUpdate = true
        last[mat] = n
      }
    },
    setCartoon: (v) => material.setCartoon(v),
    counts: () => ({ ...last }),
    dispose: () => {
      for (const inst of meshes.values()) { inst.geometry.dispose() }
      material.dispose()
    },
  }
}
