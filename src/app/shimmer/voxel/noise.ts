// Deterministic noise for the voxel core.
//
// ★ PURE CORE (see section.ts). No react/three/DOM, and no imports from outside this folder —
// purity.test.ts fails the build on either. That is why this duplicates the *idea* of
// `world/wilds-gen.ts`'s `terrainNoise` rather than importing it: the 2D generator lives on the host
// side of the boundary, and the core may not depend upward.
//
// ★ NO `Math.random`, NO clock. Canon calls the Wilds *persistent*, so a generator that drifts
// between runs would move the world under saved positions — determinism is a correctness property
// here, not tidiness. It is also port-boundary rule 2: a pure `fn(seed, coords)` is what lets a TS
// and a Rust generator be diffed against each other on one seed, which turns "portable" into a test.

/** Integer hash → [0,1). Deterministic across engines: all ops stay in int32 via Math.imul. */
export function hash2(x: number, y: number, seed: number): number {
  let h = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/**
 * ★ DERIVE A PER-ITEM SEED. Use this instead of `base ^ i` or `base ^ imul(i, K)`.
 *
 * Those look fine and are not. Measured 2026-08-07: with `base ^ imul(i+1, K)`, the FIRST draw of
 * the resulting stream is uniform for i=0 and badly skewed for i=1 — tree species came out
 * 39% / 36% / 18% / 6% against intended weights of 58 / 26 / 12 / 4, and the second tree in every
 * column was the one that was wrong. An average across indices HIDES it, which is how it survived a
 * first look. XOR changes bits without mixing them, so two seeds that differ in a few bits produce
 * first outputs that still differ in only a few bits.
 *
 * This runs the pair through a real avalanche step so every input bit affects every output bit.
 * Cheap, and it is the difference between a weight table meaning what it says and not.
 */
export function mixSeed(base: number, i: number): number {
  let h = (base ^ Math.imul(i + 0x9e3779b9, 0x85ebca6b)) | 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return (h ^ (h >>> 16)) | 0
}

/** Smoothstep — the interpolant, kept separate so the spline can reuse it. */
const smooth = (t: number): number => t * t * (3 - 2 * t)

/** Bilinear value noise on the integer lattice → [0,1). */
export function value2(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const tx = smooth(x - x0), ty = smooth(y - y0)
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed)
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty
}

/**
 * Fractal brownian motion → [0,1). Allocation-free: no arrays, no closures per call.
 * `octaves` is the only real cost knob — each one doubles the lattice reads.
 */
export function fbm2(x: number, y: number, seed: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let amp = 1, freq = 1, sum = 0, norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * value2(x * freq, y * freq, seed + o * 7919)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

/**
 * Domain-warped fBm — the thing that stops noise looking like noise. Sampling the field at a
 * position that has itself been displaced by another noise field turns smooth blobs into bays,
 * peninsulas and meanders. The 2D generator learned this the hard way (its first carver drew
 * ruler-straight highways and all 27 asserts still passed); the warp is why the coastlines read.
 */
export function warped2(x: number, y: number, seed: number, warp = 0.35, octaves = 4): number {
  const wx = x + (fbm2(x * 0.5, y * 0.5, seed ^ 0x5bf03635, 2) - 0.5) * warp * 8
  const wy = y + (fbm2(x * 0.5, y * 0.5, seed ^ 0x1b873593, 2) - 0.5) * warp * 8
  return fbm2(wx, wy, seed, octaves)
}

/** Signed variant, [-1,1] — for axes like weirdness where the sign carries meaning. */
export function signed2(x: number, y: number, seed: number, octaves = 4): number {
  return warped2(x, y, seed, 0.35, octaves) * 2 - 1
}

// ── piecewise-linear spline ───────────────────────────────────────────────────────────────────
// Mojang uses cubic splines over continentalness/erosion/weirdness. We copy the DECISION (height
// is a spline over continuous fields, never a per-biome constant) and not the implementation:
// piecewise-linear is trivially inspectable, has no overshoot, and a control point means exactly
// what it says. Overshoot matters here — a cubic that undershoots below the seabed or overshoots
// past the world ceiling turns into a clamp artefact you then have to explain.

export type SplinePoint = { at: number; val: number }

/** Evaluate a spline at `t`. Points must be sorted by `at`. Clamps outside the domain. */
export function spline(points: SplinePoint[], t: number): number {
  if (t <= points[0].at) return points[0].val
  const last = points[points.length - 1]
  if (t >= last.at) return last.val
  for (let i = 1; i < points.length; i++) {
    const b = points[i]
    if (t > b.at) continue
    const a = points[i - 1]
    const f = (t - a.at) / (b.at - a.at)
    return a.val + (b.val - a.val) * smooth(f)
  }
  return last.val
}
