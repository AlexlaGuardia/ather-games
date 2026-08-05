// chunk-stream.ts — which chunks are mounted, and how far you can see.
//
// ── WHY ────────────────────────────────────────────────────────────────────────
// The renderer mounts EVERY chunk of the current map. That was fine while a map was 400x400
// (49 chunks) and the engine's own comment always said so: *"preload mounts every chunk (fine —
// the data is tiny); a streaming realm later just mounts a radius instead."* The Wilds is the
// realm that forces the later: ~30 regions is ~1,470 chunk groups and thousands of instanced
// meshes, which no browser will draw.
//
// ── THE PROPERTY THAT MATTERS ──────────────────────────────────────────────────
// Mounted chunk count becomes **bounded by the radius, not by the world**. A (2r+1)² window
// means the same handful of chunks whether the world is one region or ten thousand. That is the
// whole point: it makes world size stop being a rendering problem.
//
// ── ★ STREAMING AND VIEW DISTANCE ARE THE SAME SETTING ────────────────────────
// Unmounting a chunk the player can still see just shows them the world ending in mid-air. So a
// radius is only honest if sight is limited to match it — the comment above assumed a fog that
// was never actually configured (camera far = 500, no `scene.fog` anywhere). They ship together
// here: `viewFar()` derives the distance from the radius, and `fogNear()` starts the haze early
// enough that geometry fades rather than pops.
//
// ── MEMO SAFETY (the reason this takes a CHUNK coord, not a position) ─────────
// `ZoneGeometry` is memoized precisely so a walking player does not rebuild the scene tree. If
// streaming keyed on the player's POSITION it would re-render every frame and cost far more than
// it saved. It keys on the player's **chunk**, which changes once per 64 tiles walked — rare
// enough that the memo keeps doing its job.
//
// Pure: no THREE, no React, no clock.

/** Tiles per chunk edge. The render batches at this size; so does streaming. */
export const CHUNK = 64

/**
 * How many chunks out from the player's own chunk stay mounted.
 * 3 → a 7x7 window → **49 chunks max, forever, at any world size**.
 * Also ~192 tiles of sight, which is a long view in a third-person camera.
 */
export const DEFAULT_RADIUS = 3

export interface ChunkCoord { cx: number; cy: number }

/** Which chunk a tile belongs to. Floor division so negatives behave (world coords may go < 0). */
export function chunkOf(tileX: number, tileY: number): ChunkCoord {
  return { cx: Math.floor(tileX / CHUNK), cy: Math.floor(tileY / CHUNK) }
}

export const sameChunk = (a: ChunkCoord | null, b: ChunkCoord | null): boolean =>
  !!a && !!b && a.cx === b.cx && a.cy === b.cy

/**
 * Is this chunk inside the mounted window?
 *
 * Chebyshev distance (a square window), not Euclidean — a circular window would unmount the
 * diagonal corners that are still plainly visible when you look across a corner of the screen.
 */
export function chunkVisible(chunk: ChunkCoord, center: ChunkCoord, radius = DEFAULT_RADIUS): boolean {
  return Math.abs(chunk.cx - center.cx) <= radius && Math.abs(chunk.cy - center.cy) <= radius
}

/** Every chunk in the window, clamped to a map of this size. Ordered near-to-far. */
export function visibleChunks(
  center: ChunkCoord, cols: number, rows: number, radius = DEFAULT_RADIUS,
): ChunkCoord[] {
  const maxCx = Math.max(0, Math.ceil(cols / CHUNK) - 1)
  const maxCy = Math.max(0, Math.ceil(rows / CHUNK) - 1)
  const out: ChunkCoord[] = []
  for (let cy = center.cy - radius; cy <= center.cy + radius; cy++) {
    for (let cx = center.cx - radius; cx <= center.cx + radius; cx++) {
      if (cx < 0 || cy < 0 || cx > maxCx || cy > maxCy) continue
      out.push({ cx, cy })
    }
  }
  // near-to-far: the renderer mounts what the player is standing in first, which matters the
  // frame after a warp when everything arrives at once.
  out.sort((a, b) =>
    (Math.abs(a.cx - center.cx) + Math.abs(a.cy - center.cy)) -
    (Math.abs(b.cx - center.cx) + Math.abs(b.cy - center.cy)))
  return out
}

/**
 * How far the camera may draw, given the radius.
 *
 * The nearest a mounted chunk's far edge can be is `radius * CHUNK` tiles away (a player standing
 * at the very edge of their own chunk). Drawing beyond that shows the cut, so the far plane is
 * pulled just inside it.
 */
export const viewFar = (radius = DEFAULT_RADIUS): number => radius * CHUNK * 0.95

/** Where the haze starts — early enough that geometry fades in rather than popping at the cut. */
export const fogNear = (radius = DEFAULT_RADIUS): number => viewFar(radius) * 0.45

/** How many chunks a window mounts at most — the number that no longer grows with the world. */
export const windowSize = (radius = DEFAULT_RADIUS): number => (2 * radius + 1) ** 2
