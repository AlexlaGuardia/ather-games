// The room a Hollow borrows — an image-based light built from the sky's own palette.
//
// ★ PURE-ish: three only. No react, no DOM, no worldgen. Safe to import from a material module.
//
// ══ WHY THIS EXISTS, AND WHY THE BUG IT FIXES WAS INVISIBLE ═════════════════════════════════════
//
// `design-briefs/hollows.md` is unusually specific about the surface: *"Specular: high, and tinted
// entirely by the environment. It borrows. It never carries a hue the scene did not already have."*
// and then, in the line that diagnosed this defect a month before it was found: *"a Hollow that
// reads too dark in daylight is a **specular/environment-response** defect, never a case for
// lifting it off its own light."*
//
// ⚠⚠ THE BUILD HAD NO ENVIRONMENT. Not a dim one, not a wrong one — none. `scene.environment` is
// set nowhere in the app, and the only `envMap` in the tree was the bench's `CubeCamera`, wired to
// `HollowDoll` alone (the blob rig that the modelled mesh replaced). So `hollow-look.ts` carried
// `envMapIntensity: 1.35` — *"where a scene gives it something to borrow, it borrows hard"* — and
// there was nothing to borrow anywhere in the game. **The material's central term was multiplying
// zero, and every source-string guard about it stayed green**, because the number was right there
// in the file. The same shape as the producer with no consumer (2026-09-05) and the icon that
// derived the paint but not the picture (2026-08-23): a value computed correctly and read by
// nothing.
//
// ── ★★ MEASURED, NOT ARGUED (2026-09-08, `dev/hollow` at noon, headless, one frame) ────────────
// Hollow body pixels came back mean **(22, 26, 25)** sRGB against its own base colour `#3f423d`
// = (63, 66, 61) — about 35% of its own value in FULL NOON LIGHT. In the same frame the greyfield
// plane, base `#3a3a3c` = (58,58,60), rendered at **(46, 48, 54)**, about 82% of its value. Same
// scene, same lights, same shot: a controlled comparison, and the body is ~2.4× darker than a flat
// roughness-1 material of the same value standing beside it.
//
// ★ AND MOST OF THAT GAP IS CORRECT LIGHTING DOING ITS JOB, WHICH IS WHY NO GUARD COULD SEE IT.
// A `HemisphereLight` gives a surface `mix(ground, sky, 0.5·dot(N, up) + 0.5)`. The floor's normal
// points straight up, so it collects the full sky colour. A body's flanks are VERTICAL, so they
// collect the midpoint of sky and `hemiGround` (`#3b3a4a`, nearly black) — half the irradiance
// before anything else happens. Then at noon the sun is overhead, so `N·L` on a vertical flank is
// ~0 and the 1.5-intensity key light contributes almost nothing to it. Ambient is all that is left.
// **Nothing here is broken. A hemisphere light is a two-colour approximation of a sky, and the
// term that lights a vertical surface facing a bright sky is the one we did not have.**
//
// That term is this file. An environment map delivers irradiance PER DIRECTION: a flank facing the
// horizon collects horizon light, not a dark average. It fixes the daylight read by adding the
// physics that was missing, not by lifting the creature off its own light — which is exactly the
// remedy canon names and exactly the one it forbids, in that order.
//
// ══ THREE DECISIONS, EACH OF WHICH HAS A CHEAPER WRONG VERSION ══════════════════════════════════
//
// **1. `material.envMap`, NEVER `scene.environment`.** The obvious move is one scene-wide
// environment. ⚠ It restyles the whole game: three applies `scene.environment` to
// `MeshStandardMaterial` **and `MeshLambertMaterial` and `MeshPhongMaterial`**
// (`WebGLRenderer.js:2139`), and this world is Lambert almost everywhere — terrain, pieces, flora,
// NPCs. A one-line "give the scene an env" would have silently re-lit every voxel in Shimmer under
// a change whose ticket was about one creature. Attaching it to the material keeps the blast radius
// at the three Hollow materials.
//
// ⚠ AND IT IS ALSO THE ONLY WAY THE BRIEF'S NUMBER SURVIVES. When a material's `envMap` is null and
// `scene.environment` is not, three **OVERWRITES** `envMapIntensity` with `scene.environmentIntensity`
// (`WebGLRenderer.js:2604`). Under the scene-wide version the brief's 1.35 would have been discarded
// at draw time by a line nobody reads, and the file would still say 1.35.
//
// **2. ONE static texture, and the hour rides `envMapIntensity` instead.** three PMREM-converts an
// equirect environment ONCE and caches it in a `WeakMap` keyed on the texture
// (`WebGLEnvironments.js`), re-running only for render-target textures whose `pmremVersion` moves.
// So a texture rebuilt to follow the clock either costs a PMREM every frame or, worse, silently
// keeps serving the first conversion — a change you can watch not happen. A day-palette sky scaled
// by daylight is one number per frame and no GPU work at all.
// ⚠ THE COST OF THAT CHOICE, STATED RATHER THAN HIDDEN: at dusk the borrowed hue does not shift
// toward the night palette, it only fades. That is the wrong direction by the *night* rule (night
// is a hue shift, not a brightness drop) and the RIGHT direction by the *Hollow* rule (*"in a
// greyfield there is nothing to borrow, so it reads nearly matte"*). The Hollow rule wins here
// because this texture only ever lights Hollows. If it is ever pointed at the scene, revisit this.
//
// **3. NO SUN IN THE MAP.** A baked sun would be a bright spot at a FIXED direction on a texture
// that never rebuilds, so the borrowed highlight would sit in one place while the shadows moved.
// The directional light already carries the direct specular and it tracks the real path. What this
// map contributes is the sky, which is the diffuse-ish half a hemisphere light was standing in for.

import * as THREE from 'three'
import { SKY, DAY } from './sky-palette'

/** Equirect resolution. Tiny on purpose — the content is a vertical gradient with no detail in it,
 *  and three's PMREM blurs it into roughness mips anyway. 64×32 RGBA is 8KB. */
const ENV_W = 64
const ENV_H = 32

let ENV: THREE.DataTexture | null = null

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

/** `#rrggbb` → three 0..1 channels, still in sRGB. */
function hex(h: string): [number, number, number] {
  const v = parseInt(h.slice(1), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

/**
 * ★ MIXED IN LINEAR, WRITTEN BACK AS sRGB. The texture is tagged `SRGBColorSpace`, so the GPU
 * un-does the encode on sample and the PMREM integrates linear energy — which is the only space a
 * gradient between two lights means anything in. Mixing the sRGB bytes directly would darken the
 * middle of every band, and the middle of the band is the horizon, which is the part a standing
 * body actually faces. Same encode/decode trap the dome's `domeColor` note records from the other
 * side; here we are the ones writing texels, so we do the conversion rather than dodge it.
 */
function mixSrgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    const l = srgbToLinear(a[i]) * (1 - t) + srgbToLinear(b[i]) * t
    out[i] = linearToSrgb(l)
  }
  return out
}

/**
 * The sky as an environment: an equirectangular day sky over a ground half.
 *
 * Built once for the app's lifetime and deliberately never disposed, for the same reason
 * `goopSurface()` is not: it is shared by every Hollow material, so disposing it with any one of
 * them would blank the others. One 8KB texture plus its PMREM is the cheap, correct trade.
 *
 * ⚠ THE UPPER HALF USES THE DOME'S OWN CURVE — `mix(horizon, zenith, pow(up, 0.6))`, the same
 * expression as `SKY_FRAG`. Not "a similar gradient": if the two drift, a Hollow starts reflecting
 * a sky that is not overhead, and canon's *"never carries a hue the scene did not already have"*
 * quietly stops being true with nothing to catch it.
 *
 * ⚠ THE LOWER HALF IS `DAY.hemiGround`, which is what the rig already decided the ground bounce
 * looks like. It is not a guess at the terrain's colour and must not become one — the terrain is
 * a different colour in every region, and a Hollow that borrowed the Glade's green in the Thicket
 * would be worse than one that borrows a neutral bounce everywhere.
 */
export function skyEnvironment(): THREE.DataTexture {
  if (ENV) return ENV
  const zen = hex(SKY.day.zenith)
  const hor = hex(SKY.day.horizon)
  const gnd = hex(DAY.hemiGround)
  const data = new Uint8Array(ENV_W * ENV_H * 4)
  for (let y = 0; y < ENV_H; y++) {
    // Equirect rows run from +Y (row 0) to -Y. `up` is the vertical component of the direction
    // this row looks along, which is what the dome's `pow(up, 0.6)` wants.
    const theta = ((y + 0.5) / ENV_H) * Math.PI
    const up = Math.cos(theta)
    const c = up >= 0
      ? mixSrgb(hor, zen, Math.pow(up, 0.6))
      // Below the horizon, fade the ground bounce toward the horizon band rather than banding hard
      // at the equator: a hard seam there is the one edge a curved body sweeps its highlight across.
      : mixSrgb(hor, gnd, Math.min(1, -up * 2.2))
    for (let x = 0; x < ENV_W; x++) {
      const i = (y * ENV_W + x) * 4
      data[i] = Math.round(c[0] * 255)
      data[i + 1] = Math.round(c[1] * 255)
      data[i + 2] = Math.round(c[2] * 255)
      data[i + 3] = 255
    }
  }
  ENV = new THREE.DataTexture(data, ENV_W, ENV_H, THREE.RGBAFormat)
  ENV.mapping = THREE.EquirectangularReflectionMapping
  ENV.colorSpace = THREE.SRGBColorSpace
  ENV.needsUpdate = true
  return ENV
}

/**
 * How much room there is to borrow, given the hour. `dl` is `daylight(dayProgress())`, 1 at noon
 * and 0 at midnight.
 *
 * ★ THE FLOOR IS NOT ZERO AND THE REASON IS THE SAME ONE THE RIG GIVES FOR ITS AMBIENT TERM: an
 * unlit renderer is a fail state. A midnight Hollow keeps a trace of borrow so its wet surface
 * still breaks up along the goop rather than going to a flat cutout — *near*-matte, which is the
 * brief's word, not matte.
 *
 * ★ AND IT IS NOT LINEAR. `dl` spends a lot of its range in the twilight band; squaring it keeps
 * the borrow high across the working day and drops it away quickly once the sun is actually going,
 * which is the shape *"glossy on tended ground, near-matte in the grey"* asks for on a clock that
 * only knows the hour.
 */
export const NIGHT_BORROW = 0.12
export function borrowedSky(dl: number): number {
  const d = Math.max(0, Math.min(1, dl))
  return NIGHT_BORROW + (1 - NIGHT_BORROW) * d * d
}
