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
import { generatePlotColumn } from '../app/shimmer/voxel/plot-column'
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
  const msg = e.data as { type: string; cx?: number; cz?: number; seed?: number; keep?: string[]; space?: string }

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
    // ── ★ TWO SPACES (2026-08-15) ──────────────────────────────────────────────────────────────
    // The Home Plot is its own bounded generator measured from its own origin, so the SPACE has to
    // ride the request — it cannot be inferred from the coordinates, which overlap the Wilds by
    // construction (plot 0,0 and Wilds 0,0 are both real and different).
    //
    // ⚠ AND IT MUST RIDE THE CACHE KEY TOO. `cols` is keyed by chunk coords; without the space in
    // the key, walking into the garden at 0,0 would be served the Wilds column the keeper had just
    // been standing in — cached, correct-looking, and completely the wrong world.
    const space: string = msg.space === 'plot' ? 'plot' : 'wilds'
    const k = space === 'wilds' ? key(cx, cz) : `${space}:${key(cx, cz)}`
    if (!cols.has(k)) {
      cols.set(k, space === 'plot'
        // The world lane's adapter, not a second generator here: it mirrors `generateColumn`'s
        // post-conditions (uniform refreshed, stage Ready) so the switch is one line rather than a
        // mode threaded through seven stages the plot needs none of.
        ? generatePlotColumn(new Column(cx * SECTION, cz * SECTION, DEFAULT_COLUMN), seed)
        : makeColumn(cx * SECTION, cz * SECTION, seed))
    }
    // ★ ALWAYS answer with the voxels, cached or fresh. The main thread evicts columns it walks
    // away from and re-requests them on return; a request answered with a bare `done` (the old
    // cached-column path) left that chunk a PERMANENT hole — re-request was blocked by the
    // `requested` set, so nothing ever asked again. Repacking a cached column is ~64KB, trivial.
    const col = cols.get(k)!
    const voxels = packVoxels(col)
    // ★ THE STAGE OVERRIDES TRAVEL WITH THE VOXELS. They are derived during generation (carving,
    // ore, trees, ruins, waystones) and CANNOT be recomputed on the main thread without re-running
    // those stages — and the save's diff is wrong without them: chopping a tree would record
    // nothing and the tree would be back on reload. Sparse, so this is a few KB, not another 131.
    const ov = col.overrides ?? new Map<number, number>()
    const oIdx = new Uint32Array(ov.size), oMat = new Uint16Array(ov.size)
    { let i = 0; for (const [k2, v] of ov) { oIdx[i] = k2; oMat[i] = v; i++ } }
    ;(self as unknown as Worker).postMessage({ type: 'column', cx, cz, voxels, oIdx, oMat },
      [voxels.buffer, oIdx.buffer, oMat.buffer])
    // ★ GENERATION ONLY — meshing stays on the main thread, deliberately.
    // The main thread must own Columns anyway: mining edits a voxel and immediately re-meshes, and
    // shipping a column across the boundary per edit would cost more than it saves. So the worker
    // does the expensive, order-independent half (~109ms/chunk of noise, carving and ore) and hands
    // back packed voxels; the main thread wraps them and meshes (~47ms). Splitting it the other way
    // would put the edit path on the wrong side of the boundary.
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
