// The tile painter, off the main thread.
//
// `tex/tiles.ts` paints every block tile from code at mount — 376 layers at 64px, about a second
// on the main thread on a good day and growing with every painted variant (2026-09-17: +120
// layers in one morning). That second was the first frame of every load. This worker paints the
// same bytes and hands them back as transferables; `tex/atlas.ts` shows flat material colours
// until they land, then swaps the texture data in place. The world never waits on the paint.
//
// ★ ITS OWN ENTRY, NOT A MESSAGE ON THE GENERATION WORKER. That worker's header says the
// generation thread has no business reaching into render code, and this is render code. Built by
// `scripts/build-worker.mjs` alongside it — same hash, same prune, same URL module — and held to
// the same rule: no three, no react, no DOM in the bundle, or the build fails.
//
// Protocol: `{ type: 'tiles', size }` → `{ type: 'tiles', size, data, relief }` (both buffers
// transferred). One request per worker; the host terminates it after the reply.
import { buildTileArray } from '../app/shimmer/voxel3d/tex/tiles'
import { buildReliefArray } from '../app/shimmer/voxel3d/tex/relief'

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; size?: number }
  if (msg.type !== 'tiles') return
  const size = msg.size ?? 64
  const data = buildTileArray(size)
  const relief = buildReliefArray(data, size)
  ;(self as unknown as Worker).postMessage({ type: 'tiles', size, data, relief }, [data.buffer, relief.buffer])
}
