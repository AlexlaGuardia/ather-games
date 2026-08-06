// Generation worker — the whole pipeline off the main thread.
//
// ★ WHY: a 64-wide streaming chunk measured ~109ms of generation plus ~47ms of meshing. That is
// nine frames of hitch per chunk arrival on the main thread, every time you walk into new country.
// None of it touches the DOM or the renderer, so none of it belongs there.
//
// ★ THE WORKER OWNS THE COLUMNS, and that is the design decision worth stating. Meshing a column
// needs its four neighbours or you draw a wall at every column edge — so whoever meshes must hold
// the neighbours. Keeping columns here means the main thread never sees a Column at all: it
// receives finished vertex buffers, plus a voxel copy purely for collision. The alternative
// (main thread owns columns, worker meshes) would ship a column across the boundary per mesh.
//
// ⚠ The worker imports the voxel core, which is why the core may not import react/three/DOM. That
// rule is not abstract portability hygiene — it is what lets this file exist at all.
//
// ⚠ AND IT LIVES OUTSIDE `src/app/` FOR A CONCRETE REASON. Inside the App Router directory,
// Turbopack resolved `new Worker(new URL('./gen.worker.ts', import.meta.url))` as a STATIC ASSET
// and copied the file to `.next/static/media/gen.worker.<hash>.ts` — raw, uncompiled TypeScript
// with bare `import` statements. The browser fetched it, could not parse it, and the worker
// constructed, accepted postMessage and never replied, with nothing in the console. Moving the
// entry out of `app/` makes it a normal module in the graph and it gets compiled.
// **Do not move this back under `src/app/`.**

import {
  Column, SECTION, makeColumn, meshColumn, DEFAULT_COLUMN,
} from '../app/shimmer/voxel/column'
import { createMeshScratch } from '../app/shimmer/voxel/greedy'
import { buildAttrs, attrBuffers, type MeshAttrs } from '../app/shimmer/voxel3d/attrs'

const H = DEFAULT_COLUMN.worldHeight
const scratch = createMeshScratch(SECTION)
const cols = new Map<string, Column>()
const meshed = new Set<string>()
let seed = 1337

const key = (cx: number, cz: number) => `${cx},${cz}`

export interface SectionPayload {
  index: number
  wx: number; wy: number; wz: number
  attrs: MeshAttrs
}

/** Flatten a column's sections into one array for the main thread's collision lookups. */
function packVoxels(col: Column): Uint16Array {
  const out = new Uint16Array(SECTION * SECTION * H)
  for (let i = 0; i < col.sections.length; i++) out.set(col.sections[i].data, i * SECTION * SECTION * SECTION)
  return out
}

/** Mesh a column and post its sections. Silently no-ops if the column is not loaded. */
function emitMesh(cx: number, cz: number): void {
  const col = cols.get(key(cx, cz))
  if (!col) return
  const sections = meshColumn(col, {
    negX: cols.get(key(cx - 1, cz)) ?? null,
    posX: cols.get(key(cx + 1, cz)) ?? null,
    negZ: cols.get(key(cx, cz - 1)) ?? null,
    posZ: cols.get(key(cx, cz + 1)) ?? null,
  }, scratch)

  const payload: SectionPayload[] = []
  const transfer: ArrayBuffer[] = []
  for (const sm of sections) {
    const attrs = buildAttrs(sm.mesh)
    payload.push({ index: sm.index, wx: sm.wx, wy: sm.wy, wz: sm.wz, attrs })
    transfer.push(...attrBuffers(attrs))
  }
  meshed.add(key(cx, cz))
  // Transfer, don't clone: these buffers are hundreds of KB and cloning them would put the copy
  // cost back on the boundary we just moved the work across.
  ;(self as unknown as Worker).postMessage({ type: 'mesh', cx, cz, sections: payload }, transfer)
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; cx?: number; cz?: number; seed?: number; keep?: string[] }

  if (msg.type === 'init') {
    seed = msg.seed ?? seed
    cols.clear(); meshed.clear()
    // ★ ACK ON BOOT. The main thread's liveness probe must test whether the WORKER is alive, not
    // whether the app happened to ask it for something — the render loop is what sends requests,
    // and a throttled tab does not run it. Without this ack the probe fired against a perfectly
    // healthy worker and fell back to main-thread generation for no reason.
    ;(self as unknown as Worker).postMessage({ type: 'ready' })
    return
  }

  if (msg.type === 'request') {
    const cx = msg.cx!, cz = msg.cz!
    const k = key(cx, cz)
    if (!cols.has(k)) {
      cols.set(k, makeColumn(cx * SECTION, cz * SECTION, seed))
      // Collision data goes over once, on generation. Transferred, so the copy is free.
      const voxels = packVoxels(cols.get(k)!)
      ;(self as unknown as Worker).postMessage({ type: 'column', cx, cz, voxels }, [voxels.buffer])
    }
    emitMesh(cx, cz)
    // A new column changes what its neighbours' edge faces look like. Re-mesh any that were already
    // meshed, or every column keeps the wall it drew before this one existed.
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      if (meshed.has(key(cx + dx, cz + dz))) emitMesh(cx + dx, cz + dz)
    }
    ;(self as unknown as Worker).postMessage({ type: 'done', cx, cz })
    return
  }

  if (msg.type === 'evict') {
    // The main thread decides what is in range; the worker just forgets. Without this the worker
    // holds every column ever generated and the memory only goes up as you walk.
    const keep = new Set(msg.keep ?? [])
    for (const k of [...cols.keys()]) if (!keep.has(k)) { cols.delete(k); meshed.delete(k) }
    return
  }
}
