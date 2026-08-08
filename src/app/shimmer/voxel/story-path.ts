// The story path — the quest spine as WORLDGEN INPUT.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder. Imports nothing from
// depth.ts (depth imports US — materials the planter needs arrive as arguments, not imports).
//
// ── ★ THE MAP GENERATES FROM THE STORY (Alex's ruling, live, 2026-08-08) ─────────────────────
// "The first POI is Moonwell Glade, then 500 blocks from there is Gloview Village where the three
// Moglins test the player… after those two the path to the strongholds begins, each of them being
// about 750–1200 blocks away." That sentence is this file. The spine is a polyline of story nodes;
// worldgen derives from it: a worn ROAD wears the surface along it (the world itself says "the
// story went this way" — no quest marker needed), WAYSTONES with lantern caps light it every so
// often (the road is TENDED ground — safe to walk at night, because block light vetoes the Hollow
// spawn gate; stray off it and the night is yours to deal with), and holds will generate as
// structures at the nodes (next pass — positions ship now so nothing else guesses them).
//
// Everything off-path stays procedural wild country: the story-follower walks the road, the
// builder ignores it, and neither is railroaded because the road is GEOGRAPHY, not a gate.
//
// ── Boundary ─────────────────────────────────────────────────────────────────────────────────
// WHAT happens at each node is canon (shimmer-quests-mainmap.md; the village-test placement is
// logged in CANON_GAPS for the beat-sheet reconcile). WHERE the nodes sit — distances per Alex's
// ruling, headings a build dial — is Jin's, same license as ZONE_ANCHORS ("positions/extents are
// build — dial freely").

import { value2 } from './noise'
import type { Section } from './section'

export interface StoryNode {
  id: string
  x: number
  z: number
}

/**
 * The spine. Distances are Alex's ruling (500, then 750/1000/1200 — the hop grows as the story
 * hardens); headings bend north-west, deeper into untended country, so path-distance and the
 * greying rim mostly agree about what "further along" means. Node ids echo the RULED hold names.
 */
export const STORY_NODES: StoryNode[] = [
  { id: 'moonwell-glade', x: -150, z: -640 },     // spawn + tutorial (must match the glade anchor)
  { id: 'gloview-village', x: -265, z: -1125 },   // ~500 — the three Moglins' test
  // ★ Hold nodes are SITED, not just spaced (2026-08-08): the first placements dropped Thistle
  // mid-river-channel (its courtyard was a lake) and Vetch on a band edge. These spots were
  // scanned river-free across the whole build zone (|riverField| > 0.11 at centre, corners and
  // gate aprons) while holding Alex's hop ruling: 750 / 1003 / 1098.
  { id: 'thistle-hold', x: -630, z: -1780 },      // ~750 — the stronghold chain begins
  { id: 'vetch-hold', x: -1570, z: -2130 },       // ~1000
  { id: 'brack-hold', x: -2269, z: -2977 },       // ~1100
  { id: 'ather-winds-gate', x: -2437, z: -3341 }, // the sealed door out of act 4
]

/** Road half-width in blocks, before the edge wobble. A path, not a highway. */
const ROAD_HALF = 2.2
/** Edge wobble amplitude — the road is worn by feet, not surveyed. */
const ROAD_WOBBLE = 1.4
/** One waystone per this many blocks of arc, offset to alternating sides of the road. */
const WAYSTONE_EVERY = 64
const WAYSTONE_OFFSET = 3.5

/** Squared distance from a point to the segment ab. */
function segDist2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax, abz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz)))
  const dx = px - (ax + abx * t), dz = pz - (az + abz * t)
  return dx * dx + dz * dz
}

/** Distance from (x,z) to the spine polyline, in blocks. */
export function distToPath(x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < STORY_NODES.length - 1; i++) {
    const a = STORY_NODES[i], b = STORY_NODES[i + 1]
    const d2 = segDist2(x, z, a.x, a.z, b.x, b.z)
    if (d2 < best) best = d2
  }
  return Math.sqrt(best)
}

/**
 * Is this column road bed? The wobble is coordinate-noise, so the same block answers the same
 * forever — the edge meanders, the road does not flicker.
 */
export function roadAt(x: number, z: number, seed: number): boolean {
  const d = distToPath(x, z)
  if (d > ROAD_HALF + ROAD_WOBBLE) return false            // cheap reject before the noise sample
  const w = ROAD_HALF + (value2(x / 23, z / 23, seed ^ 0x60ad) - 0.5) * 2 * ROAD_WOBBLE
  return d <= Math.max(0.8, w)
}

/**
 * Waystone cells, computed once at module load (the spine is static data; no seed involved so
 * the posts sit where the MAP says, not where noise wanders). Key = "x,z" of the post column.
 */
export const WAYSTONE_CELLS: ReadonlySet<string> = (() => {
  const cells = new Set<string>()
  let carry = 0
  let side = 1
  for (let i = 0; i < STORY_NODES.length - 1; i++) {
    const a = STORY_NODES[i], b = STORY_NODES[i + 1]
    const dx = b.x - a.x, dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    const ux = dx / len, uz = dz / len
    for (let t = carry === 0 ? WAYSTONE_EVERY : carry; t < len; t += WAYSTONE_EVERY) {
      // Perpendicular offset, alternating sides — a post IN the road is a post you walk into.
      const off = WAYSTONE_OFFSET * side
      side = -side
      cells.add(`${Math.floor(a.x + ux * t - uz * off)},${Math.floor(a.z + uz * t + ux * off)}`)
    }
    carry = 0   // node-to-node drift of a few blocks is fine; posts are mood, not measurement
  }
  return cells
})()

/**
 * Plant waystones into a chunk: a two-block stone post capped with a lantern, standing beside the
 * road. Same contract as plantTrees — runs on FINISHED ground, writes sections directly. The
 * lantern cap is the point: registry `emit` makes light.ts flood block light around each post, so
 * the road holds the grey off (the spawn gate's absolute veto) without a single scripted rule.
 * Materials arrive as arguments to keep this file import-clean of depth.ts.
 */
export function plantWaystones(
  sections: (Section | null)[], ox: number, oz: number, size: number,
  surfaceAt: (x: number, z: number) => number, seaLevel: number,
  stoneMat: number, lanternMat: number,
): number {
  const yTop = sections.length * size
  let planted = 0
  for (let lz = 0; lz < size; lz++) {
    for (let lx = 0; lx < size; lx++) {
      const wx = ox + lx, wz = oz + lz
      if (!WAYSTONE_CELLS.has(`${wx},${wz}`)) continue
      const h = surfaceAt(wx, wz)
      if (h <= seaLevel || h + 3 >= yTop) continue        // no drowned or decapitated posts
      for (let y = h + 1; y <= h + 3; y++) {
        const s = sections[(y / size) | 0]
        if (s) s.set(lx, y - ((y / size) | 0) * size, lz, y === h + 3 ? lanternMat : stoneMat)
      }
      planted++
    }
  }
  return planted
}
