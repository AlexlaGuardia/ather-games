// Render light — the sky and block levels a SHADER samples, per column, full height.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ── ★★★ WHY THIS IS NOT `light.ts` ─────────────────────────────────────────────────────────────
// `light.ts` produces the same two channels and is the right module for SPAWNING: it floods a small
// box around the surface, lazily, only for columns the spawn sweep nominates, and it answers
// out-of-box reads with "dark" because for a spawn gate the conservative direction is dark.
//
// Rendering wants the opposite of every one of those. It needs every VISIBLE column, at every
// height being drawn, always, and an out-of-box read is a pixel somebody sees rather than a spawn
// quietly refused. Measured before writing this: `computeLight` over a full-height box is **663ms
// per column** — 332 frames at the host's 2ms slice, about sixteen minutes to warm a 170-column
// ring. The algorithm is not wrong; it is flooding a box that is ~95% solid rock.
//
// This pass is 22ms for the same column, and the 30x is three properties of voxel light rather
// than three tricks:
//   1. **SOLID CELLS ARE NEVER LIT**, so there is no reason to visit them. Most of a deep column.
//   2. **SKY LIGHT FALLS FREE.** Straight down through open air it does not decay (MC's rule), so
//      everything above the heightmap is 15 with no propagation at all.
//   3. **LIGHT DIES IN 15 STEPS.** A flood from an opening touches a SHELL, never the volume —
//      the rest of a deep column is 0 and stays 0 without ever being looked at.
//
// ── ★★ THE 08-07 RULING THIS OBEYS, AND THE HALF OF IT THAT WAS ALWAYS THE PLAN ────────────────
// `light.ts` refuses to feed per-voxel light into the MESH: *"two adjacent quads with different
// light can no longer merge, and a flat lit floor goes from 1 quad back to 1024."* That objection
// is exact and it is about a VERTEX ATTRIBUTE. It does not reach a per-fragment sample, and the
// same paragraph says so: *"when lighting becomes a look, it will be a per-fragment shader concern
// reading this same field, and the mesher stays untouched."* This is that field. The mesher is
// untouched. (`greedy.ts` merges on MATERIAL — line ~702 — and samples AO at the merged quad's
// corners afterwards, which is why AO was affordable and why light cannot be done the same way: a
// 16-wide quad has four corners and a cave mouth's falloff needs more than four values.)
//
// ── ★★★ BORDERS ARE THE WHOLE DESIGN PROBLEM, AND THEY ARE SOLVED HERE RATHER THAN LATER ───────
// Light reaches 15 blocks and a column is 16 wide, so light crossing a column border is not an edge
// case — it is most of every column. A first prototype flooded one column in isolation and would
// have seamed visibly everywhere.
//
// ⚠ THE OBVIOUS FIX IS THE ONE THAT DOES NOT SHIP: computing with a one-column apron is correct and
// costs 9x the cells — back to ~200ms per column, which is the problem this module exists to avoid.
//
// So the pass does what Minecraft does: it floods what it can reach inside its own footprint, and
// records what tried to LEAVE. A neighbour re-runs with those levels as extra seeds. Two properties
// make that terminate rather than oscillate, and both are load-bearing:
//   · **light only ever INCREASES** when more of it arrives — a re-run can raise a cell and never
//     lower one, so the field is monotonic;
//   · **levels are capped at 15** and integral, so a cell can be raised at most fifteen times.
// A column therefore settles after a bounded number of passes and the host can drive it with a
// dirty queue. Nothing here decides that cadence; this module is one pass.
import { AIR } from './section'
import { isSolid, MAT } from './depth'
import { emitOf } from './registry'

export const MAX_LIGHT = 15
/** Column footprint. Kept local rather than imported so this file stays independent of column.ts. */
export const SPAN = 16
export const HEIGHT = 256

/** The four lateral faces, in the order `spill` and `incoming` index them. */
export const FACE_XM = 0, FACE_XP = 1, FACE_ZM = 2, FACE_ZP = 3
/** The face a neighbour's spill arrives on, given the face it left by. */
export const OPPOSITE = [FACE_XP, FACE_XM, FACE_ZP, FACE_ZM] as const

/**
 * Light crossing a column border, per face, as `(face * HEIGHT + y) * SPAN + span`.
 *
 * ⚠ THESE ARE ARRIVAL LEVELS, NOT SOURCE LEVELS — the step's decay is already applied. Storing the
 * source level instead would make every consumer re-derive the decay rule, and the rule differs
 * between the channels (sky falls free downward, block never does). One definition, at the edge.
 */
export interface LightBorders {
  sky: Uint8Array
  blk: Uint8Array
}

export const newBorders = (): LightBorders => ({
  sky: new Uint8Array(4 * HEIGHT * SPAN),
  blk: new Uint8Array(4 * HEIGHT * SPAN),
})

export interface RenderLight {
  /** Sky channel, `(y * SPAN + lz) * SPAN + lx`. Scale by the day factor at sample time. */
  sky: Uint8Array
  /** Block channel, same layout. Lanterns, waymarks, caches — see `registry.emitOf`. */
  blk: Uint8Array
  /** What tried to leave this column, for the neighbours' next pass. */
  spill: LightBorders
  /** Cells the flood actually touched — the cost, for a budget to watch. */
  visited: number
}

export const li = (lx: number, y: number, lz: number): number => (y * SPAN + lz) * SPAN + lx
const bi = (face: number, y: number, span: number): number => (face * HEIGHT + y) * SPAN + span

/** Material and surface readers. World-coordinate; may read outside the column's own footprint. */
export type MatAt = (x: number, y: number, z: number) => number
export type HeightAt = (x: number, z: number) => number

/**
 * ── ★★★ THE PASS IS A JOB WITH A CURSOR, FOR THE SAME REASON `light.ts` IS (2026-09-08) ────────
 *
 * 22ms is eleven times the host's 2ms slice, and the 09-01 ruling on `advanceLightBuild` is exact:
 * *"a clock can refuse to START work and nothing on a single thread can stop work already running."*
 * A one-shot `computeRenderLight` called from the frame loop would be a 22ms hitch per column and
 * ~170 of them on a fresh ring — the "spazzing" that entry exists to have already fixed once.
 *
 * ⚠ THE WORKER IS NOT THE ANSWER HERE, THOUGH IT LOOKS LIKE IT. The generation worker holds its own
 * `Column` cache and never sees a mined block: the main thread owns edits and re-meshes them
 * synchronously (`voxel-gen.worker.ts` says so in writing — *"meshing stays on the main thread,
 * deliberately"*). Light computed over there would be light for the world as GENERATED, so digging
 * a shaft would let daylight into the mesh and nothing into the field. One voxel truth, one place.
 *
 * So: `beginRenderLight` + `stepRenderLight(w, budgetMs)`, and `computeRenderLight` is
 * `stepRenderLight(w, Infinity)` — the one-shot path and the sliced path are the same code and
 * cannot drift apart. That last sentence is `light.ts`'s and it is the whole point of the shape.
 */
export interface RenderLightWork {
  ox: number
  oz: number
  matAt: MatAt
  heightAt: HeightAt
  incoming: LightBorders | null
  sky: Uint8Array
  blk: Uint8Array
  solid: Uint8Array
  spill: LightBorders
  /** Packed indices; bit 30 marks the block channel. GROWABLE — see `pushQ`. */
  q: Int32Array
  qn: number
  head: number
  /** 0 seed, 1 incoming, 2 flood, 3 done. */
  phase: number
  cursor: number
  field: RenderLight | null
}

/**
 * How many queue pops pass between wall-clock checks, and one column of seeding likewise.
 *
 * ⚠ NOT A TUNING KNOB — it is the granularity of the budget and it bounds the OVERSHOOT, exactly as
 * `light.ts`'s `STEP_CHECK` does. `performance.now()` in the inner loop of a flood is itself a
 * measurable cost on the machine this exists to protect.
 */
const STEP_CHECK = 512

/**
 * ── ⚠⚠ THE QUEUE GROWS, AND THE FIXED ONE WAS A SILENT CORRUPTION (2026-09-08) ─────────────────
 * It was `new Int32Array(n * 2)` written with a bare `q[qn++] = i`, on the reasoning that a cell is
 * pushed once per channel. That holds for a flood seeded only from the sky, where the FIFO drains in
 * strictly decreasing level order — and it stops holding the moment a column has more than one class
 * of seed. An emitter, or a neighbour's `incoming`, can RAISE a cell the sky flood already settled,
 * and the raise-and-repush is the mechanism the whole border design rests on ("light only ever
 * INCREASES"). A cell can legally be pushed up to fifteen times per channel.
 *
 * ★ AND THE OVERFLOW WOULD NOT HAVE THROWN. A write past the end of a typed array is SILENTLY
 * DROPPED — no exception, no NaN, no log. The lost entry is a cell whose light never propagates, so
 * the failure is a dark patch in a lit cave, appearing only in the busiest columns (many lanterns,
 * or a heavily-seeded border), and it would have been read as a bug in the shader or the upload.
 * ⚠ It is the direction this tree keeps paying for: the instrument fails toward "nothing to see".
 */
const pushQ = (w: RenderLightWork, v: number): void => {
  if (w.qn === w.q.length) {
    const bigger = new Int32Array(w.q.length * 2)
    bigger.set(w.q)
    w.q = bigger
  }
  w.q[w.qn++] = v
}

/**
 * Start one pass over one column. Nothing is computed here.
 *
 * `matAt` is world-coordinate and MAY read neighbours — materials are cheap and already generated;
 * it is the flood that is expensive and that stays inside the footprint. `heightAt` is the
 * generated surface, the same one the carvers and planters read.
 *
 * `incoming` is the light arriving from neighbouring columns (their `spill`, indexed by the face it
 * arrives ON — use `OPPOSITE`). Null on a first pass.
 */
export function beginRenderLight(
  ox: number, oz: number,
  matAt: MatAt,
  heightAt: HeightAt,
  incoming: LightBorders | null = null,
): RenderLightWork {
  const n = SPAN * HEIGHT * SPAN
  return {
    ox, oz, matAt, heightAt, incoming,
    sky: new Uint8Array(n), blk: new Uint8Array(n), solid: new Uint8Array(n),
    spill: newBorders(),
    // The queue holds packed indices; bit 30 marks the block channel so both floods share one loop
    // and therefore one set of border rules. Two loops would be two places to get the decay wrong.
    q: new Int32Array(n),
    qn: 0, head: 0, phase: 0, cursor: 0, field: null,
  }
}

/**
 * Advance the pass by at most `budgetMs` of wall clock. Returns true when the field is finished,
 * at which point `w.field` holds it.
 *
 * Pass `Infinity` to run to completion in one call — that is exactly what `computeRenderLight`
 * does, so the one-shot path and the stepped path are the same code.
 */
export function stepRenderLight(w: RenderLightWork, budgetMs: number): boolean {
  if (w.phase === 3) return true
  const { ox, oz, matAt, heightAt, sky, blk, solid, spill } = w
  const t0 = performance.now()
  let since = 0
  const outOfTime = (): boolean => {
    if (++since < STEP_CHECK) return false
    since = 0
    return performance.now() - t0 >= budgetMs
  }

  // ── seed: free sky above the heightmap, solids marked, emitters queued ───────────────────────
  if (w.phase === 0) {
    const columns = SPAN * SPAN
    let did = 0
    while (w.cursor < columns) {
      // One footprint column between clock reads: at most 256 cells plus one `heightAt`, the same
      // reasoning as `light.ts`'s per-column check.
      //
      // ⚠⚠ `did > 0` IS LOAD-BEARING AND ITS ABSENCE WAS AN INFINITE LOOP, caught by §7 running at
      // `budgetMs = 0`. Elapsed time is `>= 0` on the very first iteration, so a bare deadline test
      // returns before advancing the cursor — every call does nothing, forever, and the host's frame
      // loop simply stops rendering with no error anywhere. Every slice must complete at least one
      // unit; `drainRemeshQueue` states the same rule for the same reason ("always does at least
      // one so the queue cannot starve on a slow machine whose every mesh overruns the budget").
      // The other two phases are safe by construction — their `outOfTime` counter does STEP_CHECK
      // units before it ever reads a clock.
      if (did > 0 && performance.now() - t0 >= budgetMs) return false
      did++
      const c = w.cursor++
      const lx = c % SPAN, lz = (c / SPAN) | 0
      const h = heightAt(ox + lx, oz + lz)
      for (let y = HEIGHT - 1; y > h; y--) { const i = li(lx, y, lz); sky[i] = MAX_LIGHT; pushQ(w, i) }
      for (let y = h; y >= 0; y--) {
        const m = matAt(ox + lx, y, oz + lz)
        // ⚠ WATER IS NOT SOLID AND MUST NOT BLOCK LIGHT — the same split `light.ts` draws. A lake
        // that went black underneath would be the most visible possible version of this bug.
        const i = li(lx, y, lz)
        // ⚠⚠ NO EXPLICIT WATER CLAUSE, AND THE FIRST VERSION HAD ONE. It read
        // `m !== AIR && (m & 0xFF) !== MAT.WATER && isSolid(m)`, carrying a comment about lakes
        // going black — and a mutation deleting the water half passed the whole suite clean,
        // because `isSolid` ALREADY excludes water (it is in `SOLID_EXCEPT`, along with every
        // plant). The clause could not fire. A guard that cannot fire is decoration, and worse: it
        // makes a mutation sweep report a SURVIVOR, which reads as a blind test rather than as an
        // unreachable line. `isSolid` is the one definition of "can a body occupy this cell", the
        // same notion collision and the wind channel use, and it is the right question here too.
        // The lake case is real and is asserted in `render-light.test.ts` §4 against `isSolid`.
        if (m !== AIR && isSolid(m)) solid[i] = 1
        // ⚠⚠ THE EMITTER CHECK IS NOT INSIDE THE `else`, AND THE FIRST VERSION HAD IT THERE.
        // A Mana Lantern is a SOLID PLACEABLE BLOCK. Marking it solid and `continue`ing before
        // reading `emitOf` meant every light source in the world emitted nothing — the lantern, the
        // waymark, the glow on a cache — and nothing would have thrown, gone red, or looked broken
        // except a cave staying dark with a lit lantern in it. A source cell may be solid; what
        // solidity forbids is light ENTERING a cell, which the flood's neighbour test handles.
        const e = emitOf(m)
        if (e > 0) { blk[i] = e; pushQ(w, i | 0x40000000) }
      }
    }
    w.phase = 1; w.cursor = 0
  }

  // ── seed: light arriving from neighbours ─────────────────────────────────────────────────────
  if (w.phase === 1) {
    const inc = w.incoming
    if (inc) {
      const total = 4 * HEIGHT
      while (w.cursor < total) {
        if (outOfTime()) return false
        const face = (w.cursor / HEIGHT) | 0
        const y = w.cursor % HEIGHT
        w.cursor++
        for (let s = 0; s < SPAN; s++) {
          const lx = face === FACE_XM ? 0 : face === FACE_XP ? SPAN - 1 : s
          const lz = face === FACE_ZM ? 0 : face === FACE_ZP ? SPAN - 1 : s
          const i = li(lx, y, lz)
          if (solid[i]) continue
          const sv = inc.sky[bi(face, y, s)]
          if (sv > sky[i]) { sky[i] = sv; pushQ(w, i) }
          const bv = inc.blk[bi(face, y, s)]
          if (bv > blk[i]) { blk[i] = bv; pushQ(w, i | 0x40000000) }
        }
      }
    }
    w.phase = 2; w.cursor = 0
  }

  // ── the flood ────────────────────────────────────────────────────────────────────────────────
  for (; w.head < w.qn; w.head++) {
    if (outOfTime()) return false
    const raw = w.q[w.head]
    const isBlk = (raw & 0x40000000) !== 0
    const i = raw & 0x3FFFFFFF
    const lx = i % SPAN, lz = ((i / SPAN) | 0) % SPAN, y = (i / (SPAN * SPAN)) | 0
    const lvl = isBlk ? blk[i] : sky[i]
    if (lvl <= 0) continue
    for (let d = 0; d < 6; d++) {
      const nx = lx + (d === 0 ? 1 : d === 1 ? -1 : 0)
      const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0)
      const nz = lz + (d === 4 ? 1 : d === 5 ? -1 : 0)
      if (ny < 0 || ny >= HEIGHT) continue
      // ★ SKY FALLS FREE, AND ONLY AT FULL STRENGTH. MC's rule exactly: a column open to the sky is
      // 15 all the way down, but light that has already been dimmed by a corner decays like any
      // other. Dropping the `lvl === MAX_LIGHT` half would light the floor of every cave that has a
      // crack over it as brightly as open ground.
      const nl = (!isBlk && d === 3 && lvl === MAX_LIGHT) ? MAX_LIGHT : lvl - 1
      if (nl <= 0) continue

      if (nx < 0 || nx >= SPAN || nz < 0 || nz >= SPAN) {
        // Leaving the footprint: record the ARRIVAL level for the neighbour and stop.
        const face = nx < 0 ? FACE_XM : nx >= SPAN ? FACE_XP : nz < 0 ? FACE_ZM : FACE_ZP
        const s = (face === FACE_XM || face === FACE_XP) ? lz : lx
        const b = spill[isBlk ? 'blk' : 'sky']
        const k = bi(face, ny, s)
        if (nl > b[k]) b[k] = nl
        continue
      }
      const j = li(nx, ny, nz)
      if (solid[j]) continue
      if (isBlk) { if (blk[j] >= nl) continue; blk[j] = nl; pushQ(w, j | 0x40000000) }
      else       { if (sky[j] >= nl) continue; sky[j] = nl;  pushQ(w, j) }
    }
  }

  w.phase = 3
  w.field = { sky, blk, spill, visited: w.qn }
  return true
}

/** One pass over one column, run to completion. See `stepRenderLight` for the sliced form. */
export function computeRenderLight(
  ox: number, oz: number,
  matAt: MatAt,
  heightAt: HeightAt,
  incoming: LightBorders | null = null,
): RenderLight {
  const w = beginRenderLight(ox, oz, matAt, heightAt, incoming)
  stepRenderLight(w, Infinity)
  return w.field!
}

/**
 * ── ★★ TEXTURE ORDER IS NOT `li` ORDER, AND THE TWO LOOK IDENTICAL FROM A DISTANCE ─────────────
 * `li` is `(y * SPAN + lz) * SPAN + lx`. A `Data3DTexture` of width SPAN, height HEIGHT, depth SPAN
 * is indexed `(lz * HEIGHT + y) * SPAN + lx`. Both are "x fastest", both are the same length, and
 * uploading one as the other produces a field that is *plausibly wrong*: light smeared along z in
 * bands, which reads as a shader bug or a worldgen artefact rather than as a transpose. This
 * function is the one place the two orders meet.
 *
 * ★ AND BOTH CHANNELS RIDE IN ONE BYTE — sky in the high nibble, block in the low. Levels are 0..15
 * by construction (`MAX_LIGHT`), so a nibble is not a compression choice, it is the natural width.
 * One byte per cell makes the ring texture R8 and halves the upload against any two-channel format.
 */
export function packForTexture(f: RenderLight, out?: Uint8Array): Uint8Array {
  const dst = out ?? new Uint8Array(SPAN * HEIGHT * SPAN)
  for (let lz = 0; lz < SPAN; lz++) {
    for (let y = 0; y < HEIGHT; y++) {
      const src = (y * SPAN + lz) * SPAN
      const to = (lz * HEIGHT + y) * SPAN
      for (let lx = 0; lx < SPAN; lx++) {
        dst[to + lx] = (f.sky[src + lx] << 4) | f.blk[src + lx]
      }
    }
  }
  return dst
}

/** The inverse, for tests and for anything that has to read a packed field back. */
export const unpackSky = (b: number): number => b >> 4
export const unpackBlk = (b: number): number => b & 0x0F
