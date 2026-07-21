// Per-zone authored SEGS — the world-lane half of high/low branching (Shimmer swarm, 2026-07-21).
// A seg is an elevated walkable platform (rect footprint at one tier-height `y`) that stacks OVER the
// base terrain in `heights[z][x]`, so a high road and a low road can share plan cells and both be
// walkable. hub owns the resolution math + the Seg type (engine/segs-collision.ts); WORLD authors the
// Seg[] and exposes getSegLayer(zoneId) so play3d can swap its EMPTY_SEGS for real branching.
//
// Mirrors heightmaps.ts exactly: SAVED (authored in-editor → save-segs → segs.json) wins; a small
// DEMO fallback shows a walkable high road until a zone is authored; anything else → no segs (flat).
import { buildSegLayer, EMPTY_SEGS, type Seg, type SegLayer } from '../engine/segs-collision'
import SAVED from './segs.json'

const SAVED_SEGS = SAVED as Record<string, Seg[]>

// DEMO — a bridge high road (tier 3) reaching EAST off the Moonwell pyramid out over flat ground, so
// you can climb the pyramid and walk the bridge with the LOW road passing underneath the same cells.
// Only shown until real segs are authored + saved for a zone. (Alex: retune/replace in the editor.)
const DEMO: Record<string, Seg[]> = {
  'moonwell-glade': [
    // starts on the pyramid's height-2 ring (col7, step up 1 → onto the bridge), extends over ground-0.
    { id: 'demo-bridge', x: 7, z: 8, w: 8, d: 3, y: 3 },
  ],
}

/** The authored segs for a zone (SAVED wins, else DEMO, else none). A fresh COPY — callers may hold it. */
export function getZoneSegs(zoneId: string): Seg[] {
  const s = SAVED_SEGS[zoneId] ?? DEMO[zoneId] ?? []
  return s.map((seg) => ({ ...seg }))
}

/** The cell-indexed SegLayer play3d hands to CollisionCtx. EMPTY_SEGS when a zone has no segs, so
 *  the flat-world path stays byte-identical (hub's parity guarantee holds). */
export function getSegLayer(zoneId: string): SegLayer {
  const segs = getZoneSegs(zoneId)
  return segs.length ? buildSegLayer(segs) : EMPTY_SEGS
}
