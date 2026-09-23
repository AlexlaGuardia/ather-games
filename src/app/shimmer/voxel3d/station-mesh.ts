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
import { cauldronBodyGeo, cauldronBrewGeo } from './models/cauldron'
import { mortarBodyGeo } from './models/mortar'
import { bowlBodyGeo, bowlPasteGeo } from './models/bowl'
import { stillBaseGeo, stillBulbGeo } from './models/still'
import { benchTopGeo, benchFrameGeo, benchToolsGeo, benchRackGeo } from './models/bench'
import { createPieceMaterial, type PieceMaterial } from './piece-mesh'
import { layerOf, TOP, SIDE } from './tex/tiles'
import { EMISSIVE } from './attrs'
import type { TileArray } from './tex/atlas'
import type { LightUniforms } from './light-glsl'

const SECTION = 16
const MAX_PER_MAT = 4096

/**
 * The BAKED SCULPTS, by the name a `StationModel.sculpt.model` uses — node name → geometry.
 *
 * ★ THE HOST SIDE OWNS THIS AND station-models.ts CANNOT. That file is pure (no three) and a baked
 * module hands back a `BufferGeometry`, so the model table names a sculpt and this map resolves
 * it. Adding a prop is a bake (`npm run bake:props`), an import, and one row here.
 *
 * ⚠ The baked factories are NOT indexed and already call `computeVertexNormals()` — see
 * `mergeGeometries` for why the first of those matters, and `scripts/bake-flora-model.mts` for why
 * normals are derived rather than shipped.
 */
export const SCULPTS: Readonly<Record<string, Readonly<Record<string, () => THREE.BufferGeometry>>>> = {
  cauldron: { Body: cauldronBodyGeo, Brew: cauldronBrewGeo },
  mortar: { Body: mortarBodyGeo },
  bowl: { Body: bowlBodyGeo, Paste: bowlPasteGeo },
  still: { Base: stillBaseGeo, Bulb: stillBulbGeo },
  bench: { Top: benchTopGeo, Frame: benchFrameGeo, Tools: benchToolsGeo, Rack: benchRackGeo },
}

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
  for (const sp of model.sculpt?.parts ?? []) {
    const make = SCULPTS[model.sculpt!.model]?.[sp.node]
    // Loud, not silent: a renamed node in a re-bake would otherwise drop a part of the object and
    // leave a pot with no lid, or no pot — and every guard would stay green about the rest.
    if (!make) throw new Error(`station ${mat}: sculpt '${model.sculpt!.model}' has no node '${sp.node}'`)
    const g = make()
    // Authored about the cell CENTRE like a box, built about its MIN corner like a box — the same
    // half-cell shift, and for the same reason (the piece program samples a face's tile by local
    // position, so the tile's centre must land at local 0.5).
    g.translate(0.5, 0, 0.5)
    const n = g.attributes.position.count
    const top = new Float32Array(n).fill(layerOf(sp.top ?? mat, TOP))
    const side = new Float32Array(n).fill(layerOf(sp.side ?? mat, SIDE))
    const glow = new Float32Array(n).fill(sp.glow ?? (EMISSIVE[sp.side ?? mat] ?? 0))
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
    // ★★ A NON-INDEXED PART GETS AN IDENTITY INDEX, AND SKIPPING THIS DROPS IT SILENTLY.
    // `BoxGeometry` is indexed; a baked sculpt is NOT (the bake de-indexes so every triangle owns
    // its vertices and shades flat). The merged geometry has ONE index, so a part that contributed
    // no entries contributes no TRIANGLES either — its vertices ride along, referenced by nothing.
    // A model that is all sculpt would have drawn nothing at all, with no error anywhere.
    if (ng) for (let i = 0; i < ng.count; i++) index.push(ng.getX(i) + base)
    else for (let i = 0; i < g.attributes.position.count; i++) index.push(i + base)
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
  // ★★ AN ATTRIBUTE ONLY SHIPS IF EVERY PART HAD IT. A box carries `uv`; a baked sculpt does not
  // (nothing gives a lathe a UV map, and the piece program never reads one — it derives the tile
  // uv from local POSITION and normal). Concatenating a present-for-some attribute yields a buffer
  // SHORTER than the vertex count, which three reads as a misaligned attribute: every vertex past
  // the first part's would sample someone else's uv. Dropping it is free and exact, because the
  // program does not read it; padding would only add 2 floats per vertex to be ignored.
  for (const name of names) {
    const chunk = chunks[name]
    if (!chunk) continue
    if (chunk.length !== base * sizes[name]) continue
    out.setAttribute(name, new THREE.Float32BufferAttribute(chunk, sizes[name]))
  }
  if (!out.getAttribute('position') || !out.getAttribute('normal')) {
    throw new Error('station geometry: every part must carry position and normal')
  }
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
