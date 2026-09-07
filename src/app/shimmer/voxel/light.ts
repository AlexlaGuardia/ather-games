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
  /**
   * Does this voxel stop the WIND? Distinct from `opaque`, and the distinction is not academic.
   *
   * ⚠⚠ THE FIRST VERSION OF THE WIND CHANNEL REUSED `opaque` AND ITS COMMENT ARGUED THAT THE TWO
   * QUESTIONS HAPPEN TO HAVE THE SAME ANSWER. They do not, and the comment was wrong about this
   * world specifically: only LEAVES are in the host's light-passes set, so every **plant** —
   * grass, herbs, scatter, every crop — is OPAQUE to light while being walked straight through.
   * A Hollow stands IN long grass (that is the `isSolid` rule the placement test uses), so a wind
   * channel built on `opaque` reported *no wind* on the ordinary grassy overworld and refused it,
   * and could not descend a cave mouth with a tuft over it. Caught by a differential against a
   * second, independently written flood — not by reading, and the reading is what wrote the bug.
   *
   * ★ THE HOST PASSES `isSolid` — the collision notion. If a body can occupy a cell, air can be
   * in it, and the Ather's breath can carry a seed through it. That is the whole rule.
   */
  windBlocks: (x: number, y: number, z: number) => boolean
}

/** A computed field over a box. `get` is world-coordinate; out-of-bounds reads as pitch dark. */
export interface LightField {
  bounds: LightBounds
  data: Uint8Array
  get: (x: number, y: number, z: number) => number
  sky: (x: number, y: number, z: number) => number
  block: (x: number, y: number, z: number) => number
  /**
   * ── ★★★ THE THIRD CHANNEL: CAN THE ATHER'S BREATH GET HERE? (2026-09-07) ────────────────────
   * Canon (`game/shimmer-geography.md` › THE HOLLOWS › THE THIRD PRECONDITION, ruled 2026-09-07):
   * a Hollow needs a SEED to have been drained, Mana Seeds are **wind-borne**, and *"the test is
   * not depth and not light — it is whether the wind could have put a seed there."* Sealed rock
   * gets no seed, so nothing may body there however dark and however drained.
   *
   * ★ IT IS A SEPARATE CHANNEL BECAUSE IT IS A SEPARATE PHYSICS, and the same argument that
   * justifies splitting sky from block applies again: **wind does not decay.** A cave twenty
   * blocks from its mouth is still ventilated; sky light twenty blocks in is 0. Deriving wind from
   * either light channel would make "deep enough" mean "sealed", which is exactly the reading
   * canon rules out — *"do not read this as 'no seeds in dark places'."*
   *
   * ⚠⚠ OUT-OF-BOUNDS IS `false` HERE, WHICH IS THE OPPOSITE DEFAULT FROM `get`, AND THE INVERSION
   * IS THE WHOLE POINT. `get` answers absent cells with 0 = pitch dark, because for LIGHTING the
   * conservative direction is dark. For this channel the conservative direction is *no wind*, and
   * both defaults point the same way once you ask what they do to a SPAWN: dark admits, windless
   * refuses. A channel that answered `true` outside its box would hand every unexamined cell a
   * free pass, which is the silent-permissive failure this file already documents for `get`.
   */
  windAt: (x: number, y: number, z: number) => boolean
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
/**
 * ── ★★★ THE FIELD IS BUILT IN SLICES, BECAUSE A 53ms UNIT CANNOT BE BUDGETED (2026-09-01) ───────
 *
 * `spawn-budget.ts` spent two rounds bounding when a cold field may START and could never bound
 * what it COSTS, because nothing on a single thread preempts a synchronous call once begun. The
 * ceiling it could honestly state was `SPAWN_BUDGET_MS + COLD_FIELD_MS`, and `COLD_FIELD_MS` was
 * measured on a server CPU. From Alex's capture on the UHD 630 (home plot, 465 columns, view
 * radius 12): `world:spawn/light` was **55.80ms of a 58.9ms frame — 95% — with the GPU at 5.3ms
 * and the heap flat.** One field. The stated ceiling was 23ms, so the bound was out by 2.4x, in
 * exactly the way `COLD_FIELD_MS`'s own docstring predicted it would go stale.
 *
 * ★★ SO THE UNIT IS THE BUG, NOT THE BUDGET. `beginLight` + `stepLight` run the same four phases
 * against the same queue in the same order, stopping whenever a wall-clock slice is spent and
 * resuming exactly where they left off. The caller pays a few ms a frame instead of one 53ms
 * hitch, and no per-machine constant has to be right for the frame to hold.
 *
 * ⚠ THE OUTPUT IS BYTE-IDENTICAL AND THAT IS ASSERTED, NOT ASSUMED. `light.test.ts` compares a
 * fully-stepped field against a one-shot one cell by cell, at several slice sizes including 0.
 *
 * ⚠ THE SEED ORDER IS PRESERVED AS BELT-AND-BRACES, NOT BECAUSE THE FIELD DEPENDS ON IT — and the
 * distinction is measured, not reasoned. Swapping the sky seed to x-major changes **0 of 2800
 * cells**: the flood is a monotone max-fixpoint, so a FIFO order cannot change where it converges.
 * Keeping the original order makes the equivalence trivially true rather than argued; do not read
 * it as a constraint a refactor must respect.
 *
 * ⚠⚠ AND KNOW WHAT THE EQUIVALENCE TEST CANNOT SEE. `computeLight` now DELEGATES to `stepLight`,
 * so the reference and the subject are the same code: any mutation that affects both sides cancels
 * out and the comparison stays green. It guards RESUMPTION — that pausing and continuing lands in
 * the same place as not pausing — and nothing else. What guards the algorithm is the behavioural
 * block above it. A comparison between a thing and itself is not evidence about either.
 *
 * ⚠ A PARTIAL FIELD IS NEVER PUBLISHED. `field` stays null until the last phase completes, so a
 * consumer either has a finished field or has nothing — which is the host's existing rule ("a cold
 * column is SKIPPED, never guessed at") reaching one layer down. Half a flood is darker than the
 * truth, and darker means MORE spawn-eligible space: the one direction this must never fail in.
 */
export type LightWork = {
  readonly bounds: LightBounds
  readonly inputs: LightInputs
  readonly data: Uint8Array
  /**
   * The wind channel, one BIT per cell rather than one byte.
   *
   * ★ A BITSET BECAUSE THIS IS CACHED PER COLUMN AND NEVER FREED WHILE THE COLUMN IS LOADED. A
   * byte array would be a second `data` — ~69KB a column, ~32MB across a full load on a box whose
   * memory guard already kills builds. At one bit it is 8.6KB. The channel carries one boolean, so
   * spending eight bits on it would be paying 8x for nothing.
   */
  readonly wind: Uint8Array
  readonly queue: Int32Array
  /** 0 sky-seed · 1 sky-flood · 2 block-seed · 3 block-flood · 4 wind-seed · 5 wind-flood · 6 done. */
  phase: 0 | 1 | 2 | 3 | 4 | 5 | 6
  head: number
  tail: number
  /** Progress within the current SEED phase; floods carry their own head/tail. */
  cursor: number
  /** Non-null only once `phase === 4`. */
  field: LightField | null
}

/**
 * How many units pass between wall-clock checks.
 *
 * ⚠ NOT A TUNING KNOB — it is the granularity of the budget, and it bounds the overshoot. A slice
 * can run one check-interval past its deadline, so this must stay small enough that 256 units of
 * the most expensive phase is a rounding error against the slice. It is NOT free to raise: at 4096
 * the overshoot would be most of a frame on the machine this exists to protect.
 */
const STEP_CHECK = 256

export function beginLight(bounds: LightBounds, inputs: LightInputs): LightWork {
  const n = bounds.sx * bounds.sy * bounds.sz
  return {
    bounds, inputs,
    data: new Uint8Array(n),
    wind: new Uint8Array((n + 7) >> 3),
    // Reused across all three channels — one allocation for the whole flood.
    queue: new Int32Array(n),
    phase: 0, head: 0, tail: 0, cursor: 0, field: null,
  }
}

/**
 * Advance the build by at most `budgetMs` of wall clock. Returns true when the field is finished.
 *
 * Pass `Infinity` to run it to completion in one call — that is exactly what `computeLight` does,
 * so the one-shot path and the stepped path are the same code and cannot drift apart.
 */
export function stepLight(w: LightWork, budgetMs: number): boolean {
  if (w.phase === 6) return true
  const b = w.bounds
  const { x0, y0, z0, sx, sy, sz } = b
  const { opaque, emit, openToSky, windBlocks } = w.inputs
  const t0 = performance.now()
  let since = 0
  // ⚠ Checked on a counter, not every unit: `performance.now()` in the inner loop of a flood is
  // itself a measurable cost, and this function exists to make frames cheaper.
  const outOfTime = (): boolean => {
    if (++since < STEP_CHECK) return false
    since = 0
    return performance.now() - t0 >= budgetMs
  }

  // ── sky: seed ───────────────────────────────────────────────────────────────────────────────
  // ★ STRAIGHT DOWN DOES NOT DECAY. That single rule is what makes a shaft of daylight reach the
  // bottom of a ravine instead of petering out after fifteen blocks, and it is why sky light is
  // worth having as its own channel at all. Sideways decays normally.
  if (w.phase === 0) {
    const columns = sz * sx
    while (w.cursor < columns) {
      if (outOfTime()) return false
      const c = w.cursor++
      const z = z0 + ((c / sx) | 0)
      const x = x0 + (c % sx)
      for (let y = y0 + sy - 1; y >= y0; y--) {
        if (opaque(x, y, z)) break            // the column is closed from here down
        if (!openToSky(x, z, y)) break        // something above this slice already closed it
        const i = idx(b, x, y, z)
        w.data[i] = packLight(MAX_LIGHT, 0)
        w.queue[w.tail++] = i
      }
    }
    w.phase = 1
  }

  // ── sky: spread ─────────────────────────────────────────────────────────────────────────────
  if (w.phase === 1) {
    if (!floodSlice(w, opaque, true, outOfTime)) return false
    w.phase = 2; w.head = 0; w.tail = 0; w.cursor = 0
  }

  // ── block: seed from emitters ───────────────────────────────────────────────────────────────
  if (w.phase === 2) {
    const cells = sx * sy * sz
    while (w.cursor < cells) {
      if (outOfTime()) return false
      // The linear index IS the original loop order (y outer, then z, then x), so the queue is
      // seeded in exactly the sequence the one-shot version produced.
      const i = w.cursor++
      const y = y0 + ((i / (sx * sz)) | 0)
      const rem = i % (sx * sz)
      const z = z0 + ((rem / sx) | 0)
      const x = x0 + (rem % sx)
      const e = emit(x, y, z)
      if (e <= 0) continue
      w.data[i] = packLight(skyOf(w.data[i]), e)
      w.queue[w.tail++] = i
    }
    w.phase = 3
  }

  // ── block: spread ───────────────────────────────────────────────────────────────────────────
  if (w.phase === 3) {
    if (!floodSlice(w, opaque, false, outOfTime)) return false
    w.phase = 4; w.head = 0; w.tail = 0; w.cursor = 0
  }

  // ── wind: seed from open sky, AND from every open cell on the box's own faces ────────────────
  //
  // ★★★ WHAT THIS CHANNEL CAN HONESTLY DECIDE, AND WHAT IT CANNOT — read this before "tightening"
  // it. Ventilation is a GLOBAL property: a cavern's mouth may be four columns away, far outside
  // the 3x3 apron this box covers. So a flood seeded only from open sky answers
  // *"is this void connected to the sky WITHIN THIS BOX"*, and it reported **every** cell of every
  // large cave system as sealed — measured: underground spawn candidates went to **zero** in
  // cave-bearing columns, which does not enforce canon, it deletes the feature canon explicitly
  // preserved (*a cave with a mouth, a deep overhang, a warren*).
  //
  // ★★ AND THE ANSWER CAME FROM MEASURING THE WORLD RATHER THAN FROM CHOOSING A POLICY. The
  // obvious fix — also seed from the box's faces, so a void that LEAVES the region counts as
  // ventilated — was written, and then checked against a 144x144 full-height flood seeded only
  // from open sky. In the cave-bearing column that motivated it: **0 of 255 sub-surface standable
  // cells are reachable from the sky at ANY scale.** Those voids are genuinely sealed, not merely
  // unseen, so face-seeding would have admitted exactly the vaults canon forbids. Reverted.
  //
  // ★ SO THE SEED STAYS OPEN-SKY ONLY, and its two failure directions are worth naming:
  //   · a deep sealed void  -> refused. CORRECT, and it is most of this world's sub-surface space.
  //   · a cave mouth, an overhang, a warren opening -> admitted. CORRECT, and it is the *"cave with
  //     a mouth"* canon explicitly preserves.
  //   · a genuinely ventilated cavern whose mouth lies outside the 3x3 apron -> refused. A false
  //     negative, conservative, and the only direction a spawn gate may fail in.
  if (w.phase === 4) {
    const columns = sz * sx
    while (w.cursor < columns) {
      if (outOfTime()) return false
      const c = w.cursor++
      const z = z0 + ((c / sx) | 0)
      const x = x0 + (c % sx)
      for (let y = y0 + sy - 1; y >= y0; y--) {
        if (windBlocks(x, y, z)) break
        if (!openToSky(x, z, y)) break
        const i = idx(b, x, y, z)
        if (w.wind[i >> 3] & (1 << (i & 7))) continue
        w.wind[i >> 3] |= 1 << (i & 7)
        w.queue[w.tail++] = i
      }
    }
    w.phase = 5
  }

  // ── wind: spread ────────────────────────────────────────────────────────────────────────────
  if (w.phase === 5) {
    if (!windSlice(w, windBlocks, outOfTime)) return false
    w.phase = 6
  }

  const data = w.data
  const wind = w.wind
  const get = (x: number, y: number, z: number): number =>
    inside(b, x, y, z) ? data[idx(b, x, y, z)] : 0
  const windAt = (x: number, y: number, z: number): boolean => {
    if (!inside(b, x, y, z)) return false        // ⚠ absent means NO WIND — see the interface note
    const i = idx(b, x, y, z)
    return (wind[i >> 3] & (1 << (i & 7))) !== 0
  }
  w.field = { bounds: b, data, get, windAt,
              sky: (x, y, z) => skyOf(get(x, y, z)), block: (x, y, z) => blockOf(get(x, y, z)) }
  return true
}

/**
 * The wind BFS, resumable. Six-connected over everything light can pass, and **no decay** — that
 * one difference from `floodSlice` is the entire reason this is not a third call to it.
 *
 * ⚠ IT TAKES `windBlocks`, NOT `opaque`, AND THE FIRST VERSION TOOK `opaque`. See the note on
 * `LightInputs.windBlocks`: in this world every plant is opaque to light and passable to a body,
 * so the borrowed predicate reported no wind across the ordinary grassy overworld. The two
 * questions are *what stops light* and *what stops a body*, and only the second one is about air.
 */
function windSlice(
  w: LightWork,
  windBlocks: (x: number, y: number, z: number) => boolean,
  outOfTime: () => boolean,
): boolean {
  const b = w.bounds
  const { x0, y0, z0, sx, sy, sz } = b
  while (w.head < w.tail) {
    if (outOfTime()) return false
    const i = w.queue[w.head++]
    const y = y0 + ((i / (sx * sz)) | 0)
    const rem = i % (sx * sz)
    const z = z0 + ((rem / sx) | 0)
    const x = x0 + (rem % sx)
    for (let k = 0; k < 6; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0)
      const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0)
      const nz = z + (k === 4 ? 1 : k === 5 ? -1 : 0)
      if (nx < x0 || nx >= x0 + sx || ny < y0 || ny >= y0 + sy || nz < z0 || nz >= z0 + sz) continue
      const j = idx(b, nx, ny, nz)
      if (w.wind[j >> 3] & (1 << (j & 7))) continue
      if (windBlocks(nx, ny, nz)) continue
      w.wind[j >> 3] |= 1 << (j & 7)
      w.queue[w.tail++] = j
    }
  }
  return true
}

export function computeLight(bounds: LightBounds, inputs: LightInputs): LightField {
  const w = beginLight(bounds, inputs)
  // Infinity means `outOfTime` can never be true, so this runs the identical code path to
  // completion in one call. There is no separate one-shot implementation to drift.
  stepLight(w, Infinity)
  return w.field!
}

/**
 * One channel's BFS, resumable. Shared so the two floods cannot drift apart in their decay rules.
 *
 * Returns true when the queue is drained, false when the slice ran out of time — in which case
 * `w.head` / `w.tail` are left exactly where the next slice must resume.
 */
function floodSlice(
  w: LightWork,
  opaque: (x: number, y: number, z: number) => boolean,
  isSky: boolean,
  outOfTime: () => boolean,
): boolean {
  const b = w.bounds
  const data = w.data, queue = w.queue
  const read = (i: number) => (isSky ? skyOf(data[i]) : blockOf(data[i]))
  const write = (i: number, v: number) => {
    data[i] = isSky ? packLight(v, blockOf(data[i])) : packLight(skyOf(data[i]), v)
  }
  while (w.head < w.tail) {
    if (outOfTime()) return false
    const i = queue[w.head++]
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
      queue[w.tail++] = ni
    }
  }
  return true
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
