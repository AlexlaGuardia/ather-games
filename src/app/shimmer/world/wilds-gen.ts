// wilds-gen.ts — the seeded generator for THE WILDS (the walkable overland).
//
// ── WHY GENERATED AT ALL ───────────────────────────────────────────────────────
// Canon calls the Wilds *"the persistent, walkable, open-world overland… the layer the GAME
// explores"*. Measured against the existing 400x400 region unit, a RuneScape-ish surface is
// ~30 regions ≈ 4.8M cells. Memory is a non-issue (~9MB as typed arrays, ~34MB as number[][])
// and the RLE codec squashes a region to 8-30KB — so the blocker was never storage. It is
// AUTHORING: nobody hand-paints thirty 400x400 maps.
//
// ── PERSISTENT vs NEVER-THE-SAME-TWICE — canon draws the technical line for us ─
// The Wilds are **persistent**: generated ONCE with a seed, written to disk, then hand-authored
// where it matters. The **Folds** are canon's *"churning wild… never the same twice"* — those
// regenerate per run. Same word canon used for the fiction is exactly the right engineering
// distinction, so this module generates a FILE, never a runtime map.
//
// ── AUTHORED BY SUBTRACTION, like every region before it ───────────────────────
// A region canvas starts as solid cloud and gets carved (`region-codec.ts`). This generator
// keeps that idiom rather than inventing a second one: fill solid, carve the country out. It
// also keeps the codec's compression assumption true — untouched rows stay one RLE pair.
//
// ── THE WALKABILITY CONTRACT (the thing that makes this more than noise) ───────
// Thresholded noise gives you caves and islands, not a country. Two guarantees turn it into
// somewhere you can actually walk:
//   1. **Every edge gate reaches every other edge gate.** Corridors are carved from each gate
//      to the region's heart before pruning, so the region is always crossable end to end.
//   2. **Nothing unreachable survives.** A flood fill from the heart fills isolated pockets
//      back to cloud. A pretty grotto you can never stand in is a bug, not content.
//
// ── SEAMS WITHOUT A GLOBAL PASS ────────────────────────────────────────────────
// An edge gate's position is hashed from the EDGE (the unordered pair of the two regions it
// separates), not from either region. So region (3,7) and region (4,7) independently compute
// the same opening on their shared border and line up without ever being generated together —
// which is what lets the world be built one file at a time, in any order, forever.
//
// Pure and deterministic: no Math.random, no clock, no I/O. Same seed in, same country out —
// which is what "persistent" requires.

/** Solid, carvable — the canvas every region starts as. */
export const WILDS_FILL = 34   // Cloud 1
/** Walkable open country. */
export const WILDS_LAND = 97   // Flat Grass Base
/** Worn ground where the corridors run — reads as a trail without being a different rule. */
export const WILDS_PATH = 98   // Flat Path Base

export interface WildsSpec {
  /** the world seed — one number that fixes the entire Wilds, forever */
  seed: number
  /** region coordinates on the world grid */
  rx: number
  ry: number
  cols?: number
  rows?: number
  /** 0..1 — how much of the canvas is open country. Higher = more open. */
  openness?: number
}

// ── deterministic hashing ──────────────────────────────────────────────────────
// A 32-bit integer hash, used for every random decision in this file. Not Math.random: a
// persistent world cannot be allowed to differ between two runs of the same generator.
function hash3(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth value noise — bilinear between lattice points, smoothstepped so it isn't blocky. */
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash3(xi, yi, seed), b = hash3(xi + 1, yi, seed)
  const c = hash3(xi, yi + 1, seed), d = hash3(xi + 1, yi + 1, seed)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

/**
 * Domain-warped fractal noise.
 *
 * Plain fbm thresholds into smooth round blobs — recognisably generated. Warping the SAMPLE
 * POSITION by more noise before reading it drags the contours sideways, which is what turns a
 * blob into bays, inlets and peninsulas. One extra noise call for most of the organic look.
 */
export function terrainNoise(x: number, y: number, seed: number): number {
  const wx = fbm(x * 0.6, y * 0.6, seed ^ 0x9e37, 2)
  const wy = fbm(x * 0.6 + 5.2, y * 0.6 + 1.3, seed ^ 0x85eb, 2)
  return fbm(x + (wx - 0.5) * 8, y + (wy - 0.5) * 8, seed, 5)
}

/** Fractal noise — a few octaves so the country has both broad shape and small detail. */
function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0, amp = 1, freq = 1, norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq, seed + o * 7919) * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/**
 * Where the opening sits on the border between two regions.
 *
 * ★ Hashed from the EDGE, not from a region — the two regions sharing a border independently
 * compute the same answer. That is what allows the Wilds to be generated one file at a time, in
 * any order, and still line up. A global stitching pass would have to hold the whole world.
 */
export function edgeGate(seed: number, ax: number, ay: number, bx: number, by: number, span: number): number {
  // order-independent: sort the pair so both sides hash the same edge
  const [p, q] = (ax < bx || (ax === bx && ay <= by)) ? [[ax, ay], [bx, by]] : [[bx, by], [ax, ay]]
  const h = hash3(p[0] * 31 + p[1], q[0] * 31 + q[1], seed ^ 0x5eed)
  // keep it off the corners — a gate in a corner is awkward to walk and hard to carve to
  const margin = Math.max(2, Math.floor(span * 0.15))
  return margin + Math.floor(h * (span - margin * 2))
}

/**
 * Carve a trail between two points as a MEANDER, not a march.
 *
 * ★ The first cut walked step-by-step, always choosing a move that reduced the distance to the
 * target — so every path it could possibly draw was a monotone staircase, and the map came out
 * with ruler-straight highways through it. Tests passed (it connected!) and it looked wrong,
 * which is the whole argument for looking at generated output rather than trusting green.
 *
 * This walks the straight line parametrically and pushes each point sideways by noise. It cannot
 * fail to arrive, it needs no step cap, and the offset is smooth so the trail curves instead of
 * jittering. Width breathes along the length so it reads as a worn track rather than a road.
 */
function carveCorridor(
  grid: number[][], cols: number, rows: number,
  fromX: number, fromY: number, toX: number, toY: number,
  seed: number, width = 1.4,
): void {
  const paint = (cx: number, cy: number, w: number) => {
    const r = Math.max(1, Math.round(w))
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        if (dx * dx + dy * dy > r * r) continue
        grid[ny][nx] = WILDS_PATH
      }
    }
  }
  const dx = toX - fromX, dy = toY - fromY
  const len = Math.max(1, Math.hypot(dx, dy))
  // unit perpendicular — the direction the trail is allowed to wander
  const px = -dy / len, py = dx / len
  const steps = Math.ceil(len * 2)          // 2 samples per tile: no gaps in the brush
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // taper the wander to zero at both ends so the trail still meets the gate and the heart
    const taper = Math.sin(t * Math.PI)
    const swing = (fbm(t * 3.5, seed * 0.013, seed, 3) - 0.5) * len * 0.45 * taper
    const w = width * (0.7 + fbm(t * 7, seed * 0.021 + 11, seed + 3, 2) * 0.9)
    paint(Math.round(fromX + dx * t + px * swing), Math.round(fromY + dy * t + py * swing), w)
  }
}

/**
 * Fill every cell not reachable from the heart back to cloud.
 * A pocket you can see and never stand in is a bug wearing content's clothes.
 */
function pruneUnreachable(grid: number[][], cols: number, rows: number, startX: number, startY: number): number {
  const seen = new Uint8Array(cols * rows)
  const stack: number[] = [startY * cols + startX]
  seen[startY * cols + startX] = 1
  let reached = 0
  while (stack.length) {
    const i = stack.pop()!
    const x = i % cols, y = (i / cols) | 0
    reached++
    const push = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return
      const j = ny * cols + nx
      if (seen[j] || grid[ny][nx] === WILDS_FILL) return
      seen[j] = 1
      stack.push(j)
    }
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== WILDS_FILL && !seen[y * cols + x]) grid[y][x] = WILDS_FILL
    }
  }
  return reached
}

export interface WildsRegion {
  grid: number[][]
  cols: number
  rows: number
  /** the heart — guaranteed walkable, and the region's playerStart */
  heart: { x: number; y: number }
  /** where each border opening sits, so a neighbour (and the warp wiring) can find it */
  gates: { north: number; south: number; west: number; east: number }
  /** how many cells ended up walkable — the honest measure of whether a region is worth visiting */
  walkable: number
}

/**
 * Generate one region of the Wilds. Pure: same spec in, same country out, forever.
 */
export function generateWildsRegion(spec: WildsSpec): WildsRegion {
  const cols = spec.cols ?? 400
  const rows = spec.rows ?? 400
  const openness = spec.openness ?? 0.5
  const { seed, rx, ry } = spec

  // Region-local noise offset so neighbouring regions are different country, not a tiled repeat.
  const ox = rx * cols, oy = ry * rows

  // ── 1. carve open country out of solid cloud ──
  const grid: number[][] = []
  for (let y = 0; y < rows; y++) {
    const row = new Array<number>(cols)
    for (let x = 0; x < cols; x++) {
      // 0.012 ≈ features every ~80 tiles: hills and meadows rather than speckle
      const n = terrainNoise((ox + x) * 0.012, (oy + y) * 0.012, seed)
      row[x] = n < openness ? WILDS_LAND : WILDS_FILL
    }
    grid.push(row)
  }

  // ── 2. the heart — the one cell guaranteed open, and the anchor everything connects to ──
  const heart = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) }

  // ── 3. edge gates, hashed from the shared border so neighbours agree ──
  const gates = {
    north: edgeGate(seed, rx, ry, rx, ry - 1, cols),
    south: edgeGate(seed, rx, ry, rx, ry + 1, cols),
    west: edgeGate(seed, rx, ry, rx - 1, ry, rows),
    east: edgeGate(seed, rx, ry, rx + 1, ry, rows),
  }

  // ── 4. corridors: every gate reaches the heart, so every gate reaches every other gate ──
  carveCorridor(grid, cols, rows, gates.north, 0, heart.x, heart.y, seed + 1)
  carveCorridor(grid, cols, rows, gates.south, rows - 1, heart.x, heart.y, seed + 2)
  carveCorridor(grid, cols, rows, 0, gates.west, heart.x, heart.y, seed + 3)
  carveCorridor(grid, cols, rows, cols - 1, gates.east, heart.x, heart.y, seed + 4)

  // ── 5. prune anything the corridors and country did not actually connect ──
  const walkable = pruneUnreachable(grid, cols, rows, heart.x, heart.y)

  return { grid, cols, rows, heart, gates, walkable }
}
