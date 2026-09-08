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

/**
 * One pass over one column.
 *
 * `matAt` is world-coordinate and MAY read neighbours — materials are cheap and already generated;
 * it is the flood that is expensive and that stays inside the footprint. `heightAt` is the
 * generated surface, the same one the carvers and planters read.
 *
 * `incoming` is the light arriving from neighbouring columns (their `spill`, indexed by the face it
 * arrives ON — use `OPPOSITE`). Null on a first pass.
 */
export function computeRenderLight(
  ox: number, oz: number,
  matAt: (x: number, y: number, z: number) => number,
  heightAt: (x: number, z: number) => number,
  incoming: LightBorders | null = null,
): RenderLight {
  const n = SPAN * HEIGHT * SPAN
  const sky = new Uint8Array(n), blk = new Uint8Array(n)
  const solid = new Uint8Array(n)
  const spill = newBorders()
  // The queue holds packed indices; bit 30 marks the block channel so both floods share one loop
  // and therefore one set of border rules. Two loops would be two places to get the decay wrong.
  const q = new Int32Array(n * 2)
  let qn = 0

  // ── seed: free sky above the heightmap, solids marked, emitters queued ───────────────────────
  for (let lz = 0; lz < SPAN; lz++) {
    for (let lx = 0; lx < SPAN; lx++) {
      const h = heightAt(ox + lx, oz + lz)
      for (let y = HEIGHT - 1; y > h; y--) { const i = li(lx, y, lz); sky[i] = MAX_LIGHT; q[qn++] = i }
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
        if (e > 0) { blk[i] = e; q[qn++] = i | 0x40000000 }
      }
    }
  }

  // ── seed: light arriving from neighbours ─────────────────────────────────────────────────────
  if (incoming) {
    for (let face = 0; face < 4; face++) {
      for (let y = 0; y < HEIGHT; y++) {
        for (let s = 0; s < SPAN; s++) {
          const lx = face === FACE_XM ? 0 : face === FACE_XP ? SPAN - 1 : s
          const lz = face === FACE_ZM ? 0 : face === FACE_ZP ? SPAN - 1 : s
          const i = li(lx, y, lz)
          if (solid[i]) continue
          const sv = incoming.sky[bi(face, y, s)]
          if (sv > sky[i]) { sky[i] = sv; q[qn++] = i }
          const bv = incoming.blk[bi(face, y, s)]
          if (bv > blk[i]) { blk[i] = bv; q[qn++] = i | 0x40000000 }
        }
      }
    }
  }

  // ── the flood ────────────────────────────────────────────────────────────────────────────────
  for (let head = 0; head < qn; head++) {
    const raw = q[head]
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
      if (isBlk) { if (blk[j] >= nl) continue; blk[j] = nl; q[qn++] = j | 0x40000000 }
      else       { if (sky[j] >= nl) continue; sky[j] = nl;  q[qn++] = j }
    }
  }
  return { sky, blk, spill, visited: qn }
}
