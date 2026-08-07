// The light field — two channels, one byte, and the reason mobs know where to spawn.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ── ★ WHY TWO CHANNELS AND NOT ONE ───────────────────────────────────────────────────────────
// This is the load-bearing decision, and getting it wrong is invisible until the whole feature is
// built on top. Minecraft stores SKY light and BLOCK light separately, a nibble each:
//
//   • sky light   — how much of the open sky reaches this voxel. Floods down at full strength and
//                   decays sideways. **Stored once and scaled by time of day only when READ.**
//   • block light — torches, lava, anything that emits. BFS from the source, decays 1 per step.
//                   Completely independent of the clock.
//
// Collapse those into one number and you lose the two behaviours the game actually needs: a cave
// stays pitch dark at noon, and the whole surface darkens at dusk — **both with zero
// recomputation**, because only the multiplier changed, not the field. With a single value you must
// re-flood the world every time the sun moves, which is a per-tick cost nobody can pay.
//
// It also gives the torch its meaning for free: block light is not scaled by the clock, so a lit
// room is safe at midnight. That is the whole of "tended light holds grey off".
//
// ── ★ THIS DRIVES SPAWNING, NOT RENDERING (deliberate, 2026-08-07) ───────────────────────────
// Light-for-looks and light-for-spawning are separable and are being kept separate on purpose.
// Feeding per-voxel light into the mesh as a vertex attribute would break greedy meshing exactly
// the way per-block texture variation would have: two adjacent quads with different light can no
// longer merge, and a flat lit floor goes from 1 quad back to 1024. That trap is written up in the
// texture spike (`voxel3d/tex`) and it is the same trap wearing a third hat.
//
// So this module produces DATA. Nothing here touches a mesh. When lighting becomes a look, it will
// be a per-fragment shader concern reading this same field, and the mesher stays untouched.
//
// ── CANON ────────────────────────────────────────────────────────────────────────────────────
// `game/shimmer-geography.md` › *The night tide* (ruled 2026-08-06) puts this squarely on the build
// side: *"Jin owns the build entirely: whether the cycle runs, its length, what spawns/changes at
// night, difficulty, light sources, the unlit-country rules."* The one canon line underneath is
// *tended light holds grey off; when it banks, untended grey has range* — which is, almost exactly,
// `dayFactor` scaling sky light. The mechanic must never climb back up into the cosmology: this file
// decides where things may spawn, and asserts nothing about what grey IS.

export const MAX_LIGHT = 15

/**
 * Sky in the high nibble, block in the low nibble. One `Uint8Array` for both channels.
 *
 * Packing is not a micro-optimisation here — the field is per-voxel over a 256-tall world, so two
 * separate arrays would double a cost that is already the largest thing we store after the voxels
 * themselves. Same reasoning as the palette-packed sections.
 */
export const packLight = (sky: number, block: number): number =>
  ((Math.max(0, Math.min(MAX_LIGHT, sky)) << 4) | Math.max(0, Math.min(MAX_LIGHT, block))) & 0xff
export const skyOf = (v: number): number => (v >> 4) & 0xf
export const blockOf = (v: number): number => v & 0xf

export interface LightBounds {
  x0: number; y0: number; z0: number
  sx: number; sy: number; sz: number
}

export interface LightInputs {
  /** Does light stop here? Solid blocks are opaque; air, water and foliage are not. */
  opaque: (x: number, y: number, z: number) => boolean
  /** Emitted block light at this voxel, 0–15. Nothing emits yet — there are no torches. */
  emit: (x: number, y: number, z: number) => number
  /**
   * Is this voxel open to the sky?
   *
   * Passed in rather than derived by walking up to `y0 + sy`, because the region handed to this
   * function is usually a slice of a much taller column and its top face is NOT the sky. Deriving
   * it locally would light the ceiling of every cave that happens to sit at the top of a slice.
   */
  openToSky: (x: number, z: number, y: number) => boolean
}

/** A computed field over a box. `get` is world-coordinate; out-of-bounds reads as pitch dark. */
export interface LightField {
  bounds: LightBounds
  data: Uint8Array
  get: (x: number, y: number, z: number) => number
  sky: (x: number, y: number, z: number) => number
  block: (x: number, y: number, z: number) => number
}

const idx = (b: LightBounds, x: number, y: number, z: number): number =>
  ((y - b.y0) * b.sz + (z - b.z0)) * b.sx + (x - b.x0)

const inside = (b: LightBounds, x: number, y: number, z: number): boolean =>
  x >= b.x0 && x < b.x0 + b.sx && y >= b.y0 && y < b.y0 + b.sy && z >= b.z0 && z < b.z0 + b.sz

/**
 * Flood both channels over the box.
 *
 * ★ A BFS WITH A FLAT QUEUE, NOT RECURSION. A 16×256×16 column is 65,536 cells and a recursive
 * flood blows the stack on the first deep cave. The queue holds packed indices and the loop reads
 * with a moving head, so nothing is allocated per step.
 *
 * ⚠ OUT-OF-BOX IS TREATED AS DARK AND SOLID, never as open air. Same rule as everywhere else in
 * this core: absence needs a deliberate answer and it is almost never air (08-06 — reading absent
 * neighbours as AIR drew full-height grey walls that looked exactly like holes in the terrain).
 * For light the conservative direction is dark, which errs toward MORE spawn-eligible space at a
 * region edge rather than a bright seam. Recompute with loaded neighbours to settle an edge.
 */
export function computeLight(bounds: LightBounds, inputs: LightInputs): LightField {
  const { x0, y0, z0, sx, sy, sz } = bounds
  const data = new Uint8Array(sx * sy * sz)
  const { opaque, emit, openToSky } = inputs

  // Reused across both channels — one allocation for the whole flood.
  const queue = new Int32Array(sx * sy * sz)

  // ── sky: seed, then spread ──────────────────────────────────────────────────────────────────
  // ★ STRAIGHT DOWN DOES NOT DECAY. That single rule is what makes a shaft of daylight reach the
  // bottom of a ravine instead of petering out after fifteen blocks, and it is why sky light is
  // worth having as its own channel at all. Sideways decays normally.
  let head = 0, tail = 0
  for (let z = z0; z < z0 + sz; z++) {
    for (let x = x0; x < x0 + sx; x++) {
      for (let y = y0 + sy - 1; y >= y0; y--) {
        if (opaque(x, y, z)) break            // the column is closed from here down
        if (!openToSky(x, z, y)) break        // something above this slice already closed it
        data[idx(bounds, x, y, z)] = packLight(MAX_LIGHT, 0)
        queue[tail++] = idx(bounds, x, y, z)
      }
    }
  }
  head = floodChannel(bounds, data, queue, head, tail, opaque, true)

  // ── block: seed from emitters, then spread ──────────────────────────────────────────────────
  head = 0; tail = 0
  for (let y = y0; y < y0 + sy; y++) {
    for (let z = z0; z < z0 + sz; z++) {
      for (let x = x0; x < x0 + sx; x++) {
        const e = emit(x, y, z)
        if (e <= 0) continue
        const i = idx(bounds, x, y, z)
        data[i] = packLight(skyOf(data[i]), e)
        queue[tail++] = i
      }
    }
  }
  floodChannel(bounds, data, queue, head, tail, opaque, false)

  const get = (x: number, y: number, z: number): number =>
    inside(bounds, x, y, z) ? data[idx(bounds, x, y, z)] : 0
  return { bounds, data, get, sky: (x, y, z) => skyOf(get(x, y, z)), block: (x, y, z) => blockOf(get(x, y, z)) }
}

/** One channel's BFS. Shared so the two floods cannot drift apart in their decay rules. */
function floodChannel(
  b: LightBounds, data: Uint8Array, queue: Int32Array,
  head: number, tail: number,
  opaque: (x: number, y: number, z: number) => boolean,
  isSky: boolean,
): number {
  const read = (i: number) => (isSky ? skyOf(data[i]) : blockOf(data[i]))
  const write = (i: number, v: number) => {
    data[i] = isSky ? packLight(v, blockOf(data[i])) : packLight(skyOf(data[i]), v)
  }
  while (head < tail) {
    const i = queue[head++]
    const level = read(i)
    if (level <= 1) continue
    const y = b.y0 + Math.floor(i / (b.sx * b.sz))
    const rem = i % (b.sx * b.sz)
    const z = b.z0 + Math.floor(rem / b.sx)
    const x = b.x0 + (rem % b.sx)
    for (const [dx, dy, dz] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy, nz = z + dz
      if (!inside(b, nx, ny, nz) || opaque(nx, ny, nz)) continue
      // Sky light falling straight down keeps its full value; everything else loses one.
      const next = isSky && dy === -1 && level === MAX_LIGHT ? MAX_LIGHT : level - 1
      const ni = idx(b, nx, ny, nz)
      if (read(ni) >= next) continue
      write(ni, next)
      queue[tail++] = ni
    }
  }
  return head
}

const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
]

/**
 * How much the sky is worth right now. 1 at noon, 0 at midnight.
 *
 * ★ THIS IS THE ONLY THING THE CLOCK TOUCHES. The field itself never changes with time — that is
 * the entire payoff of storing the two channels apart. It is also, almost word for word, the canon
 * line this feature sits on: *tended light holds grey off; when it banks, untended grey has range.*
 * `dayFactor` IS the banking. Nothing else about grey is asserted here.
 */
export function dayFactor(tOfDay: number): number {
  const t = ((tOfDay % 1) + 1) % 1            // tolerate negatives and >1 without a caller guard
  // Full dark for the middle of the night, full light for the middle of the day, and a real dusk
  // between the two — a hard switch at midnight would pop a whole world of spawns into existence
  // on one frame.
  if (t < 0.20 || t > 0.80) return 0          // night
  if (t > 0.30 && t < 0.70) return 1          // day
  return t < 0.5 ? (t - 0.20) / 0.10 : (0.80 - t) / 0.10
}

/**
 * Effective light for a spawn test.
 *
 * Minecraft's modern rule (1.18+) is **block light must be 0** — not "≤ 7", which was the old rule
 * and the reason torch-spacing used to be a puzzle. Block-light-0 is both simpler and exactly what
 * Alex asked for ("areas of complete darkness"), so it is taken verbatim.
 *
 * Sky light still matters, scaled by the clock: that is what stops the whole surface spawning at
 * noon while leaving every cave eligible around the clock.
 */
export const effectiveLight = (packed: number, day: number): number =>
  Math.max(blockOf(packed), skyOf(packed) * day)

/**
 * Is this voxel dark enough to spawn in?
 *
 * ★ BLOCK LIGHT IS AN ABSOLUTE VETO, not a contribution. A single torch makes a spot safe forever,
 * at any hour, which is the property that makes lighting your base a real strategy rather than an
 * arithmetic exercise. Folding it into a sum would mean a bright enough day could mask an unlit
 * corner, and a dark enough night could overwhelm a torch — both wrong.
 */
export function spawnDark(packed: number, day: number, threshold = 0): boolean {
  if (blockOf(packed) > 0) return false
  return skyOf(packed) * day <= threshold
}
