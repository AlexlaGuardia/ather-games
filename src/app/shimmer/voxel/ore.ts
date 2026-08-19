// Ore features — the Prospecting ladder, buried at depth.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ── WHY THIS IS A FEATURE STAGE AND NOT PART OF THE DEPTH RULE ───────────────────────────────
//   depth rule (host rock)  →  PRE-CARVE ore  →  CARVERS  →  POST-CARVE ore  →  vegetation
//
// Ore sits on BOTH sides of the carvers deliberately, and that is the whole reason it cannot live
// in `depth.ts`. Tiers 1–3 are placed AFTER carving, so they appear in the walls of a cave you walk
// into. Tier 4 is placed BEFORE, so a carver slices through the pocket and you break into a seam by
// luck. Fold ore into the depth rule and every ore becomes pre-carve, permanently.
//
// ── ★ THE LADDER ALREADY EXISTED; DEPTH IS JUST THE AXIS IT WANTED ───────────────────────────
// `world/resources.ts` gates the four Prospecting nodes at minLevel 1 / 4 / 7 / 10. That is already
// ordinal, already player-legible, already shipped. Depth is the only worldgen axis that is
// monotone, needs no biome, and reads identically on every seed: *deeper is better and more
// dangerous*. So the ladder maps onto depth bands with nothing invented.
//
// ⚠ Reading a material off DEPTH is not the pre-1.18 mistake. Depth is a real geometric quantity.
// The mistake is reading it off a BIOME ID — a categorical label with no geometry behind it, which
// is why per-biome height constants produced stepped cliffs at every biome edge. There is no biome
// input here, same as `height.ts`.
//
// ⚠ CANON: every id below is already RULED and shipping in `resources.ts` — raw_mana_shard, the four
// element crystals, pure_mana_core, ather_crystal. Nothing here invents a material name. Any NEW
// material needs Magii and goes over as part of the one batched naming question.

import { hash2, mixSeed } from './noise'
import { MAT } from './depth'
import { Section, AIR } from './section'

/** Ore palette indices, continuing after the terrain materials in `MAT`. */
export const ORE = {
  RAW_MANA: 16,
  ELEMENT_VIOLET: 17,
  ELEMENT_STORM: 18,
  ELEMENT_EARTH: 19,
  ELEMENT_WATER: 20,
  PURE_CORE: 21,
  ATHER_CRYSTAL: 22,
} as const

/**
 * Is this material an ore? Contiguous range, same idiom as `isPlant`/`isHerb`/`isScatter`.
 *
 * ★ NAMED HERE, AND THE REASON IS THE BOULDER PASS (2026-08-19). Anything that WRITES into finished
 * stone after the ore phases has to be able to ask "am I about to overwrite ore", and the answer
 * has to have exactly one definition. A hand-written list in the caller is how the eighth ore ships
 * one day and something quietly starts eating it.
 *
 * ⚠ KEEP 16-22 CONTIGUOUS, for the same reason the plant ranges say so.
 */
export const isOre = (m: number): boolean => m >= ORE.RAW_MANA && m <= ORE.ATHER_CRYSTAL

/** Which element a crystal is, resolved at PLACEMENT (steal #11) rather than rolled on break. */
const ELEMENTS = [ORE.ELEMENT_VIOLET, ORE.ELEMENT_STORM, ORE.ELEMENT_EARTH, ORE.ELEMENT_WATER]

export interface Band {
  min: number
  max: number
  /** Width of the flat top. 0 = triangle peaked at the band's midpoint; max-min = uniform. */
  plateau: number
}

export interface OreBatch {
  /** Matches the ruled NodeType family in resources.ts. */
  id: string
  /** Palette index, or null when the batch resolves a state at placement (element crystal). */
  material: number | null
  phase: 'pre' | 'post'
  /** Placement attempts per chunk. */
  perChunk: number
  band: Band
  /** Rough voxel count of one vein. */
  size: number
  /** Chance the WHOLE vein is discarded if any of it touches air. Per-blob, not per-block. */
  discardOnAirExposure: number
  /** Host materials this may replace. Anything else is left alone. */
  targets: readonly number[]
}

const ROCK = [MAT.STONE, MAT.DEEP_STONE] as const

/**
 * ★ TWO BATCHES PER TIER, not one clever curve (steal #9).
 *
 * A shallow common band teaches the player the block exists; a deep rarer band rewards committing
 * to the descent. A single distribution cannot express both "findable early" and "much better deep"
 * without becoming a shape nobody can reason about — Minecraft stacks batches for exactly this and
 * so do we.
 *
 * The discard column is the readability knob (steal #10), and it is the highest value-per-line thing
 * in this file: one float decides whether an ore is something you stumble into or something you go
 * and dig for.
 */
export const ORE_BATCHES: OreBatch[] = [
  // ── tier 1 · raw mana (minLevel 1) — the ore you see in every cave wall ────────────────────
  { id: 'raw_mana', material: ORE.RAW_MANA, phase: 'post', perChunk: 18,   // scaled with the band: the rebalance shrank the rock, and unshrunk counts doubled the density
    band: { min: 16, max: 112, plateau: 96 },       // effectively uniform: it is everywhere
    // (bands rode the datum down 40 in the vertical rebalance — mass above the surface is discarded)
    size: 9, discardOnAirExposure: 0, targets: ROCK },

  // ── tier 2 · element crystal (minLevel 4) — four states, resolved at placement ─────────────
  { id: 'element_crystal', material: null, phase: 'post', perChunk: 6,
    band: { min: 10, max: 80, plateau: 30 },
    size: 6, discardOnAirExposure: 0.25, targets: ROCK },
  { id: 'element_crystal_deep', material: null, phase: 'post', perChunk: 4,
    band: { min: 8, max: 62, plateau: 54 },         // uniform deep bonus
    size: 7, discardOnAirExposure: 0.25, targets: ROCK },

  // ── tier 3 · pure core (minLevel 7) — buried by design, rewards tunnelling ─────────────────
  { id: 'pure_core', material: ORE.PURE_CORE, phase: 'post', perChunk: 5,
    band: { min: 6, max: 76, plateau: 0 },          // triangle peaked at y=41
    size: 5, discardOnAirExposure: 0.7, targets: ROCK },
  { id: 'pure_core_deep', material: ORE.PURE_CORE, phase: 'post', perChunk: 3,
    band: { min: 5, max: 40, plateau: 35 },
    size: 5, discardOnAirExposure: 0.7, targets: ROCK },

  // ── tier 4 · ather crystal (minLevel 10) — PRE-carve, so carvers slice it open ─────────────
  // A rare large pocket rather than a trickle. Placed before the carvers precisely so that finding
  // one is sometimes luck (a cavern cut through it) and sometimes work (you dug to the right depth).
  { id: 'ather_crystal', material: ORE.ATHER_CRYSTAL, phase: 'pre', perChunk: 1.4,
    band: { min: 5, max: 44, plateau: 0 },          // triangle peaked at y=24
    size: 22, discardOnAirExposure: 0, targets: ROCK },
]

/** Deterministic per-attempt stream. xorshift32 — identical sequence in TS and Rust. */
function rng(seed: number) {
  let s = seed | 0
  if (s === 0) s = 0x9e3779b9
  return () => { s ^= s << 13; s |= 0; s ^= s >>> 17; s ^= s << 5; s |= 0; return (s >>> 0) / 4294967296 }
}

/**
 * Trapezoid height provider — ONE primitive covering every band shape we need.
 *
 * `plateau = 0` collapses to a triangle peaked at the band's midpoint; `plateau = max-min` flattens
 * to uniform; anything between is a trapezoid. **You place the peak by choosing where the RANGE
 * sits, not by naming the peak** — which is why the bands above are written as spans.
 *
 * ⚠ THE CONSTRUCTION IS OURS. Research confirmed the parametrization but explicitly could NOT
 * establish Minecraft's sampling formula (whether it is two averaged uniform draws). This is a
 * uniform over the flat top plus a symmetric triangular over the two ramps, which provably degrades
 * to a triangle at plateau=0 and to uniform at plateau=range. Do not "correct" it toward an
 * unverified Mojang formula.
 */
export function sampleBand(b: Band, g: () => number): number {
  const range = b.max - b.min
  if (range <= 0) return b.min
  const p = Math.max(0, Math.min(range, b.plateau))
  const ramp = (range - p) / 2
  return b.min + g() * p + ramp * (g() + g())
}

/** Scratch for one vein — gathered first so air-exposure can reject the WHOLE blob. */
const MAX_VEIN = 512
const veinIdx = new Int32Array(MAX_VEIN)
const veinSec = new Array<Section | null>(MAX_VEIN)

/**
 * Place every ore batch of `phase` that can reach this stack.
 *
 * Same stack-not-section shape the carvers had to learn: attempts are walked once per column and
 * each voxel is dispatched to the section that owns it. Doing it per-section re-rolls every nearby
 * attempt once per section, which measured at a 12x penalty for carvers and would be worse here.
 */
export function placeOre(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, chunk: number, seed: number,
  phase: 'pre' | 'post', batches: OreBatch[] = ORE_BATCHES,
): number {
  const first = sections.find(Boolean)
  if (!first) return 0
  const S = first.size
  const yTop = oy0 + sections.length * S
  let placed = 0

  const c0x = Math.floor(ox / chunk), c0z = Math.floor(oz / chunk)
  const c1x = Math.floor((ox + S - 1) / chunk), c1z = Math.floor((oz + S - 1) / chunk)

  for (let cz = c0z - 1; cz <= c1z + 1; cz++) {
    for (let cx = c0x - 1; cx <= c1x + 1; cx++) {
      for (let bi = 0; bi < batches.length; bi++) {
        const b = batches[bi]
        if (b.phase !== phase) continue
        const base = (hash2(cx, cz, seed ^ (0x0e5e + bi * 7919)) * 4294967296) | 0
        const g0 = rng(base)
        const whole = Math.floor(b.perChunk)
        const n = whole + (g0() < b.perChunk - whole ? 1 : 0)

        for (let a = 0; a < n; a++) {
          const g = rng(mixSeed(base, a))
          const vx = cx * chunk + g() * chunk
          const vz = cz * chunk + g() * chunk
          const vy = sampleBand(b.band, g)

          // Cheap reject: a vein of `size` voxels never reaches beyond this radius.
          const reach = Math.cbrt(b.size) + 2
          if (vx + reach < ox || vx - reach > ox + S || vz + reach < oz || vz - reach > oz + S
              || vy + reach < oy0 || vy - reach > yTop) continue

          // ── gather the vein, then decide ────────────────────────────────────────────────
          // Elongated rather than spherical: a random axis with spheres along it. A pure sphere
          // reads as a bubble; real veins have a direction.
          const yaw = g() * Math.PI * 2, pitch = (g() - 0.5) * 1.4
          const len = Math.max(1, Math.cbrt(b.size) * 1.2)
          const r = Math.max(0.9, Math.cbrt(b.size) * 0.62)
          const r2 = r * r
          let count = 0, exposed = false

          const steps = Math.max(2, Math.round(len))
          for (let s = 0; s <= steps && count < MAX_VEIN; s++) {
            const t = (s / steps - 0.5) * len
            const px = vx + Math.cos(yaw) * Math.cos(pitch) * t
            const py = vy + Math.sin(pitch) * t
            const pz = vz + Math.sin(yaw) * Math.cos(pitch) * t
            const x0 = Math.max(ox, Math.floor(px - r)), x1 = Math.min(ox + S - 1, Math.ceil(px + r))
            const y0 = Math.max(oy0, Math.floor(py - r)), y1 = Math.min(yTop - 1, Math.ceil(py + r))
            const z0 = Math.max(oz, Math.floor(pz - r)), z1 = Math.min(oz + S - 1, Math.ceil(pz + r))
            for (let wy = y0; wy <= y1; wy++) {
              const sec = sections[(wy - oy0) / S | 0]
              if (!sec) continue
              const ly = wy - oy0 - ((wy - oy0) / S | 0) * S
              const dy = wy - py
              for (let wz = z0; wz <= z1; wz++) {
                const dz = wz - pz
                for (let wx = x0; wx <= x1; wx++) {
                  const dx = wx - px
                  if (dx * dx + dy * dy + dz * dz > r2) continue
                  const li = sec.idx(wx - ox, ly, wz - oz)
                  const host = sec.data[li]
                  if (!b.targets.includes(host)) continue
                  if (count >= MAX_VEIN) break
                  // Air exposure is checked on the 6-neighbourhood WITHIN this stack. A vein at the
                  // stack edge can miss an exposure just outside it; that is an accepted, bounded
                  // imprecision — the alternative is reading a neighbouring stack, which is exactly
                  // the synchronous-neighbour dependency the whole pipeline refuses.
                  if (!exposed) {
                    if (wx > ox && sec.data[sec.idx(wx - ox - 1, ly, wz - oz)] === AIR) exposed = true
                    else if (wx < ox + S - 1 && sec.data[sec.idx(wx - ox + 1, ly, wz - oz)] === AIR) exposed = true
                    else if (wz > oz && sec.data[sec.idx(wx - ox, ly, wz - oz - 1)] === AIR) exposed = true
                    else if (wz < oz + S - 1 && sec.data[sec.idx(wx - ox, ly, wz - oz + 1)] === AIR) exposed = true
                    else if (ly > 0 && sec.data[sec.idx(wx - ox, ly - 1, wz - oz)] === AIR) exposed = true
                    else if (ly < S - 1 && sec.data[sec.idx(wx - ox, ly + 1, wz - oz)] === AIR) exposed = true
                  }
                  veinIdx[count] = li
                  veinSec[count] = sec
                  count++
                }
              }
            }
          }

          if (count === 0) continue
          // ★ The whole vein is discarded, not thinned. That is what makes a buried tier feel buried
          // rather than sparse — a half-vein in a cave wall still tells the player it is there.
          if (exposed && b.discardOnAirExposure > 0 && g() < b.discardOnAirExposure) continue

          // Material: fixed, or a state resolved here so the player reads the element BEFORE mining
          // rather than pulling a 4x25% slot machine on break.
          const mat = b.material ?? ELEMENTS[Math.floor(g() * ELEMENTS.length) % ELEMENTS.length]
          for (let i = 0; i < count; i++) { veinSec[i]!.data[veinIdx[i]] = mat; placed++ }
        }
      }
    }
  }
  return placed
}
