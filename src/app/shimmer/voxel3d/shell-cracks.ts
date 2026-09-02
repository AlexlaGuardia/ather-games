// shell-cracks.ts — how a worn Threshold LOOKS: the tier ladder and the crack lines, headless.
//
// Alex, 2026-09-02, after shield hp and melee shipped: *"make a worn shell look worn and fractured."*
// Until then a shell at 2 hp was pixel-identical to one at 20, and the say-line was the only tell.
//
// ── WHY TIERS, AND WHY THE GEOMETRY IS HERE ──────────────────────────────────────────────────────
// The render-audit rule: a material is a shader program and a geometry is GPU memory, so neither may
// be constructed per object or per frame. A shell's wear is therefore expressed by pointing its mesh
// at one of a FIXED, SHARED set — `SHELL_TIERS` materials (thinner as it wears) and `SHELL_TIERS`
// crack geometries (more cracks as it wears) — built once in a `useMemo` and swapped by reference.
// Everything that decides WHICH tier and WHAT the cracks are is pure and lives here, so it can be
// asserted without a GPU: the host only maps the numbers onto THREE.
//
// ⚠ TIER 1 STARTS AT THE FIRST BLOW, NOT AT A QUARTER. A shell that has been hit must look hit — a
// door that reads pristine after eating a round has told the keeper it did not, which is the
// say-line's failure again in paint. Tier 0 is exactly wear 0.

/** Shared wear tiers. Tier 0 = as cast; tier SHELL_TIERS-1 = about to go. */
export const SHELL_TIERS = 4

/** Which shared tier a wear value (0..1, from `shellWear`) points at. Monotonic; any wear > 0 is ≥ 1. */
export function wearTier(wear: number, tiers = SHELL_TIERS): number {
  if (!(wear > 0)) return 0
  const top = tiers - 1
  return Math.min(top, Math.max(1, Math.ceil(wear * top)))
}

/** Opacity of the shell body at a tier — a worn shell is a THINNER shell. */
export function tierOpacity(tier: number, base: number, tiers = SHELL_TIERS): number {
  return base * (1 - 0.55 * (tier / (tiers - 1)))
}

/** How many cracks a tier shows. Tier 0 shows none. */
export function cracksForTier(tier: number): number {
  return tier <= 0 ? 0 : 1 + tier * tier   // 0, 2, 5, 10
}

/** Segments per crack — a crack is a jagged run from the rim down, with one branch. */
export const CRACK_SEGMENTS = 7

/**
 * Line-segment positions for a tier's cracks on a UNIT open cylinder (radius 1, height 1, centred
 * on the origin like `CylinderGeometry(1, 1, 1)`), so the host scales them exactly as it scales the
 * shell. Returns a flat xyz array, two vertices per segment. Deterministic for a seed: the same shell
 * cracks the same way each frame, and two shells crack differently.
 *
 * Cracks sit a hair OUTSIDE the surface (`CRACK_LIFT`) so they are not z-fought by the body.
 */
export const CRACK_LIFT = 1.02
export function crackSegments(tier: number, seed = 1): Float32Array {
  const cracks = cracksForTier(tier)
  const out: number[] = []
  let s = (seed * 2654435761 + tier * 40503) >>> 0
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  for (let c = 0; c < cracks; c++) {
    // start on the top rim at a spread-out angle, wander down and sideways
    let a = (c / cracks) * Math.PI * 2 + rnd() * 0.5
    let y = 0.5
    const drop = 0.35 + rnd() * 0.5            // how far down this crack reaches (of the height)
    const step = drop / CRACK_SEGMENTS
    let bx = Math.cos(a) * CRACK_LIFT, by = y, bz = Math.sin(a) * CRACK_LIFT
    for (let i = 0; i < CRACK_SEGMENTS; i++) {
      a += (rnd() - 0.5) * 0.35
      y -= step * (0.6 + rnd() * 0.8)
      const nx = Math.cos(a) * CRACK_LIFT, nz = Math.sin(a) * CRACK_LIFT
      out.push(bx, by, bz, nx, y, nz)
      // one short branch off the middle of the crack
      if (i === Math.floor(CRACK_SEGMENTS / 2)) {
        const ba = a + (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.3)
        out.push(nx, y, nz, Math.cos(ba) * CRACK_LIFT, y - step * 0.8, Math.sin(ba) * CRACK_LIFT)
      }
      bx = nx; by = y; bz = nz
    }
  }
  return new Float32Array(out)
}
