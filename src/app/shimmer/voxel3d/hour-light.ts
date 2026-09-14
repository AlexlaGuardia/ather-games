// The hour, as one number the CARTOON STACK can read.
//
// ★ PURE: three + the palette + the day cycle. No react, no DOM, no worldgen. Testable under node.
//
// ── ★★ WHY THIS EXISTS: THE BLOCKS DID NOT BELIEVE IT WAS NIGHT (measured 2026-09-14) ───────────
// Same pixels, Glade, prod, noon → midnight: grass top (139,203,88) → (109,169,105), ~80% kept.
// The canopy beside it: (95,145,91) → (18,43,24), ~25%. The sky: 4%. Two materials, two nights.
// The canopy is plain Lambert and shows what `sky-palette.ts` NIGHT intends; the blocks run the
// cartoon stack, and the stack reads "how lit" as `clamp(irradiance / albedo, 0, 1)` — a SHAPE
// with no absolute brightness. The DAY rig puts ~3.0 on an up face, so noon saturates the clamp
// three times over; the NIGHT rig still puts ~0.85 there (hemi 0.55 + silver 0.4 × 0.92 + amb
// 0.15), which the clamp reads as 85% lit. The stack never had an hour in it.
//
// The fix is ONE vec3: the rig's irradiance on an up face THIS hour, divided per channel by the
// same thing at noon under the DAY palette. (1,1,1) at a clear noon — so noon does not move, which
// `day-night.tsx` states as its own law — and silver-blue at ~0.28 at midnight. The stack divides
// its shape by this vector's luminance (so "fully lit" means "as lit as this hour allows", and the
// per-face law + toon bands keep shaping relative to that) and multiplies its result by the vector
// (the absolute, tinted). One hour term on the toon path, which had none; the sky channel of the
// light field still darkens once, after, exactly as `light-glsl.ts` rules.
//
// ★ READ FROM THE LIVE LIGHT OBJECTS, NOT FROM THE PALETTE. Gloom cuts the sun, mist lifts the
// hemisphere, water recolours both — `day-night.tsx` writes all of that into the three lights per
// frame, and a second derivation from the palette would drift from it exactly the way a hand-kept
// mirror does. The rig is the authority; this module only asks it what an up face receives.
import * as THREE from 'three'
import { DAY } from './sky-palette'
import { sunAzimuth, sunElevation } from '../engine/day-cycle'

/** Rec.709 luminance — the same W the cartoon stack uses, so "hour luminance" means one thing. */
const W = new THREE.Vector3(0.2126, 0.7152, 0.0722)
export const luminance = (c: { r: number; g: number; b: number }) => c.r * W.x + c.g * W.y + c.b * W.z

/**
 * Where the sun light sits for a day-cycle progress — `day-night.tsx` places the DirectionalLight
 * with exactly this, so the reference below is computed from the same geometry the rig uses.
 */
export function sunPosition(out: THREE.Vector3, progress: number): THREE.Vector3 {
  const e = sunElevation(progress)
  return out.set(sunAzimuth(progress) * 220, 30 + Math.max(0, e) * 240, 90)
}

/** The night silver's fixed position (a light, not a moon — see NIGHT in sky-palette.ts). */
export const SILVER_POSITION = new THREE.Vector3(-70, 200, -50)

const tmp = new THREE.Vector3()
/**
 * Irradiance a horizontal UP face receives from the rig, per channel, in the units three feeds
 * Lambert (colour × intensity; the common 1/π is on every term so a RATIO of two of these is exact).
 *   hemisphere on an up normal = sky colour × intensity (the ground colour never reaches it)
 *   directional             = colour × intensity × max(0, dir.y)
 *   ambient                 = colour × intensity
 */
export function irradianceUp(
  out: THREE.Color,
  hemiSky: THREE.Color, hemiI: number,
  sunColor: THREE.Color, sunI: number, sunPos: THREE.Vector3,
  silverColor: THREE.Color, silverI: number, silverPos: THREE.Vector3,
  ambColor: THREE.Color, ambI: number,
): THREE.Color {
  out.copy(hemiSky).multiplyScalar(hemiI)
  const sy = Math.max(0, tmp.copy(sunPos).normalize().y)
  out.r += sunColor.r * sunI * sy; out.g += sunColor.g * sunI * sy; out.b += sunColor.b * sunI * sy
  const ny = Math.max(0, tmp.copy(silverPos).normalize().y)
  out.r += silverColor.r * silverI * ny; out.g += silverColor.g * silverI * ny; out.b += silverColor.b * silverI * ny
  out.r += ambColor.r * ambI; out.g += ambColor.g * ambI; out.b += ambColor.b * ambI
  return out
}

/**
 * The reference: a clear DAY noon (no gloom, no mist, dry), the exact rig `day-night.tsx` builds
 * from the DAY palette at progress 0.5. Computed once from the palette, never typed.
 */
export const HOUR_REF: THREE.Color = irradianceUp(
  new THREE.Color(),
  new THREE.Color(DAY.hemiSky), DAY.hemiIntensity,
  new THREE.Color(DAY.sun), DAY.sunIntensity, sunPosition(new THREE.Vector3(), 0.5),
  new THREE.Color(0xffffff), 0, SILVER_POSITION,
  new THREE.Color(0xffffff), DAY.ambient,
)

/**
 * The uniform value: `irr / HOUR_REF` per channel, its luminance capped at 1 so mist's hemisphere
 * lift and a brighter future palette can never push the toon path ABOVE today's noon (the stack's
 * clamp did that job before; this keeps it). Anything at or under a clear noon passes through
 * untouched, so a clear noon is (1,1,1) to the last digit.
 */
export function hourLight(out: THREE.Vector3, irr: THREE.Color): THREE.Vector3 {
  out.set(irr.r / HOUR_REF.r, irr.g / HOUR_REF.g, irr.b / HOUR_REF.b)
  const l = out.dot(W)
  if (l > 1) out.multiplyScalar(1 / l)
  return out
}
