/**
 * WHAT A HOLLOW LOOKS LIKE — the geometry, the greys, and the one dial that decides visibility.
 *
 * ★★★ EXTRACTED FROM `VoxelWorld.tsx` 2026-08-27 SO IT CAN BE LOOKED AT. Alex reported the Hollows
 * invisible twice; the fix I shipped was sized from ARITHMETIC against the night rig rather than
 * from a picture, and his verdict on it was "looking terrible". That is the predictable end of
 * tuning a look without seeing it, and PATTERNS says exactly this — do not act on a modelled
 * reading. The point of this file is that `dev/grey` and the world now ask the SAME source, so a
 * preview cannot be perfectly correct while the game is wrong.
 *
 * ⚠ THE DIALS ARE DATA, AND THE MATERIALS ARE BUILT FROM THEM RATHER THAN LITERAL. That is what
 * lets a page move a slider and the world ship a constant, with nothing restated in between. A dev
 * page that copied these numbers would agree with the game right up until someone edited one.
 *
 * ── WHY A HOLLOW IS HARD TO LIGHT, WHICH IS NOT THE SAME AS HARD TO SEE ─────────────────────────
 * `spawnDark` (voxel/light.ts) refuses ANY block light — `blockOf(packed) > 0` returns false
 * outright — and requires night skylight. A Hollow therefore exists ONLY in the darkest places the
 * game has. Anything whose brightness comes only from the scene lights is bounded by that, so the
 * look has to carry some of its own value. How MUCH is a feel call and it is Alex's.
 */
import * as THREE from 'three'
import { skyEnvironment, borrowedSky } from './sky-env'

export type HollowForm = 'warden' | 'stalker' | 'caster'

/** Every number that decides how a Hollow reads. One object so a page can vary it whole. */
export interface HollowLook {
  /**
   * Emissive intensity — the body's own light, in its own hue.
   *
   * ⛔ RULED 2026-09-06 (/magii, athernyx `3aef03e`): THE SHIPPED VALUE IS 0, AND EMISSIVE IS BARRED
   * AT EVERY VALUE INCLUDING A NEUTRAL GREY ONE. The build read the bar as being about HUE — *What
   * would break it* says *"any colour it owns"*, and a neutral glow owns no colour, so 0.15 looked
   * survivable. The sentence that kills it sits twenty lines earlier in the derivation: *"a matte
   * Hollow would be the drift, because matte means the surface is GENERATING its own flat tone."*
   * A self-lit term is a diffuse contribution with no light to cause it. **The bar is on
   * generation, not on hue.**
   *
   * ⚠ AND THE OLD WORRY HERE WAS THE RIGHT WORRY POINTED AT THE WRONG ORGAN. This comment used to
   * say 0 is INVISIBLE at night, as an argument for keeping the glow. Canon's answer: being hard to
   * see with nothing to borrow is *the danger read*, not a defect — *"standing in a greyfield there
   * is nothing to borrow, so a Hollow reads nearly matte, grey on grey, hard to see."* Findability
   * is SPECULAR's job. A self-lit floor spends the tell to solve a problem the tell is not causing.
   *
   * ★ It stays a dial because `dev/hollow` slides it, and seeing the barred value is how the bar
   * gets judged. The SHIPPED number is the ruling; the type is not.
   */
  selfLight: number
  /** Per-form base grey. The caster reads colder so the thing draining you from range is findable. */
  colour: Record<HollowForm, number>
  /**
   * Per-form opacity.
   *
   * ★★★ ALL THREE ARE 1 AND THAT IS A RULING, NOT A DEFAULT (Alex, 2026-09-05, on the live bench):
   * *"they all need to be a solid texture.. they need to lose that ghost-like look."* The old values
   * (0.9 / 0.82 / 0.78) were annotated *"lower reads as more smoke, less body"* — and smoke is not
   * what canon asks for. `design-briefs/hollows.md` calls the warden *"nearly opaque"*, gives the
   * stalker *"legible limbs"*, and defines the whole density axis as **how much of the smear managed
   * to gather** — a MASS fact. A barely-gathered caster is thin and sparse, not see-through.
   *
   * ⚠ AND THE OTHER HALF OF THE BUILD ALREADY SAID SO. `hollow-pose.ts` carries a starred note —
   * *"A WALKER IS NEARLY OPAQUE, AND THAT IS THE BRIEF, NOT A PREFERENCE"* — recording that a 62%
   * stalker rendered as *"a bag of marbles"*, and it sets per-blob alpha to 0.86..1 to fix exactly
   * that. This file then multiplied 0.82 on top and the bucket ramp pulled it to 0.72, so the fix
   * was applied in one module and silently undone in another with nothing able to see the pair.
   *
   * ⚠ THE SHED IS CARRIED BY RADIUS, NOT BY ALPHA, and always was: `hollowField` takes a shed piece
   * to r = 0. Fading a part out was a second, redundant mechanism whose only visible effect was to
   * let every sphere's outline show through the ones in front of it.
   */
  opacity: Record<HollowForm, number>
}

/**
 * The shipped look.
 *
 * ⚠ THESE ARE THE VALUES THE WORLD USES. `dev/grey` starts here and varies from it, so "what the
 * page shows on load" and "what the game draws" are the same thing by construction.
 */
export const HOLLOW_LOOK: HollowLook = {
  // ⛔ 0 by canon ruling 2026-09-06 — see `selfLight` on HollowLook. Not a taste value.
  selfLight: 0,
  // A smear of grey that holds a silhouette: darker than any ground grey, never a face.
  colour: { warden: 0x3f423d, stalker: 0x4a4d47, caster: 0x474f58 },
  opacity: { warden: 1, stalker: 1, caster: 1 },
}

/**
 * ── THE SURFACE ────────────────────────────────────────────────────────────────────────────────
 *
 * ★★★ WHY A HOLLOW NEEDED ONE (Alex, 2026-09-05, after the ghost came out): *"they all need to be a
 * solid texture... wet clay, like goop monsters."* Solid was the first half and it landed; this is
 * the second. A `MeshLambertMaterial` has one colour and nothing else — no roughness, no normal, no
 * specular — so however solid it is it can only ever read as a SHADOW PUPPET. It cannot look wet,
 * cannot catch a highlight, and cannot show that it is made of anything.
 *
 * ⚠ AND CANON ASKED FOR EXACTLY THIS FIRST. `design-briefs/hollows.md`: *"Diffuse: dead flat,
 * unlit, zero saturation"* and *"Specular: high, and tinted entirely by the environment... A matte
 * Hollow would be the drift, because matte means the surface is GENERATING its own flat tone. A wet
 * one generates nothing and shows you the room."* Lambert has no specular term at all, so the
 * shipped material could not express the brief's central claim even in principle. Standard can.
 *
 * ⚠⚠ ONE TEXTURE FOR THE WHOLE GAME, BUILT LAZILY, AND DELIBERATELY NEVER DISPOSED WITH A MATERIAL.
 * A texture per body is the same allocation class as a material per body — the one that got this
 * page blocked from WebGL on 2026-08-06. It is also shared by every live material, so disposing it
 * alongside any one of them would blank the surface on all the others; a single 256^2 map for the
 * app's lifetime is the cheap, correct trade and this comment is the reason it looks like a leak.
 */
const SURF = 256
let GOOP: THREE.DataTexture | null = null
let GOOP_R: THREE.DataTexture | null = null

/** Value noise, 4 octaves, tiling — the lumps and runs a clay body has. */
function goopHeight(): Float32Array {
  const h = new Float32Array(SURF * SURF)
  // Deterministic: the surface must be the same on every machine and in every screenshot, or a
  // look call made from one picture is a call about that picture only.
  let seed = 0x9e3779b9
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }
  let amp = 1, total = 0
  for (let oct = 0, cells = 4; oct < 4; oct++, cells *= 2) {
    const g = new Float32Array(cells * cells)
    for (let i = 0; i < g.length; i++) g[i] = rnd()
    for (let y = 0; y < SURF; y++) {
      for (let x = 0; x < SURF; x++) {
        const fx = (x / SURF) * cells, fy = (y / SURF) * cells
        const x0 = Math.floor(fx) % cells, y0 = Math.floor(fy) % cells
        const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells
        const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy)
        // Smoothstep, so the lumps have no grid tell along the cell edges.
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
        const a = g[y0 * cells + x0] * (1 - sx) + g[y0 * cells + x1] * sx
        const b = g[y1 * cells + x0] * (1 - sx) + g[y1 * cells + x1] * sx
        h[y * SURF + x] += (a * (1 - sy) + b * sy) * amp
      }
    }
    total += amp; amp *= 0.55
  }
  for (let i = 0; i < h.length; i++) h[i] /= total
  return h
}

/**
 * The shared goop surface: a tangent-space NORMAL map in RGB, from the height field above.
 *
 * ⚠⚠ THIS DOCSTRING USED TO CLAIM THE ALPHA CHANNEL DOUBLED AS THE ROUGHNESS MAP, AND IT WAS A
 * STANDING CLAIM ABOUT A FILE THIS FILE DOES NOT OWN (found 2026-09-08). **three reads roughness
 * from channel `G`** — `roughnessmap_fragment.glsl.js`: `roughnessFactor *= texelRoughness.g`, with
 * a comment saying it is the G of a packed ORM map. The height sat in `A`, which nothing samples.
 * So the shipped roughness was `0.34 × (the normal map's Y slope)` — a value centred on ~0.5 by
 * construction, i.e. **an effective roughness near 0.17, half the briefed number**, varying along
 * the wrong field entirely. It made the surface sharper and glassier than the brief asks for, and
 * because it never went out of range it could not look like an error from anywhere.
 * ★ AND NO GUARD COULD HAVE CAUGHT IT FROM THE SOURCE: the file asserted `roughnessMap: surface`,
 * which is exactly what a correct version says too. What separates them is a fact about three's
 * shader — the file that was believed here is one nobody in this repo wrote. Same family as the
 * regex readers of 2026-08-22: a hand-written claim about somebody else's file, failing silently.
 *
 * The roughness field now has its own texture (`goopRoughness`), height written to R, G AND B so it
 * cannot be defeated by a channel convention again.
 */
export function goopSurface(): THREE.DataTexture {
  if (GOOP) return GOOP
  const h = goopHeight()
  const data = new Uint8Array(SURF * SURF * 4)
  const at = (x: number, y: number) => h[((y + SURF) % SURF) * SURF + ((x + SURF) % SURF)]
  const STRENGTH = 2.6
  for (let y = 0; y < SURF; y++) {
    for (let x = 0; x < SURF; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * STRENGTH
      const dy = (at(x, y + 1) - at(x, y - 1)) * STRENGTH
      const len = Math.hypot(dx, dy, 1)
      const i = (y * SURF + x) * 4
      data[i] = Math.round((-dx / len * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255)
      data[i + 3] = Math.round(h[y * SURF + x] * 255)
    }
  }
  GOOP = new THREE.DataTexture(data, SURF, SURF, THREE.RGBAFormat)
  GOOP.wrapS = GOOP.wrapT = THREE.RepeatWrapping
  GOOP.repeat.set(2, 2)
  GOOP.needsUpdate = true
  return GOOP
}

/**
 * The shared goop ROUGHNESS map: the same height field, in R, G and B.
 *
 * Wet clay is not uniformly wet — a run catches the light and the pit beside it does not — and
 * driving roughness from the same lumps the normal map describes is what makes a highlight break up
 * along the body instead of sliding over it like plastic. That was always the intent; until
 * 2026-09-08 it was written into a channel nothing reads (see `goopSurface`).
 *
 * ⚠ THE HEIGHT IS REMAPPED, NOT COPIED. Raw height runs the full 0..1, and `roughnessFactor` is a
 * MULTIPLIER — so a raw copy would take the shiniest pits to roughness 0 (a mirror) and rough the
 * peaks to the full 0.34. `ROUGH_LO..ROUGH_HI` keeps the variation to a band around 1.0, which
 * varies the wetness without ever leaving the material a mirror or a chalk.
 *
 * Same never-disposed contract as `goopSurface`, for the same reason: shared by every live material.
 */
const ROUGH_LO = 0.72
const ROUGH_HI = 1.28
export function goopRoughness(): THREE.DataTexture {
  if (GOOP_R) return GOOP_R
  const h = goopHeight()
  const data = new Uint8Array(SURF * SURF * 4)
  for (let i = 0; i < SURF * SURF; i++) {
    const v = Math.round(Math.max(0, Math.min(1, ROUGH_LO + (ROUGH_HI - ROUGH_LO) * h[i])) * 255)
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255
  }
  GOOP_R = new THREE.DataTexture(data, SURF, SURF, THREE.RGBAFormat)
  GOOP_R.wrapS = GOOP_R.wrapT = THREE.RepeatWrapping
  GOOP_R.repeat.set(2, 2)
  GOOP_R.needsUpdate = true
  return GOOP_R
}

/**
 * Three geometries, built once and shared by every body of that form.
 *
 * ⚠ ⚠ NOT PER BODY. A geometry per Hollow is a GPU buffer per Hollow; a MATERIAL per Hollow is a
 * shader program per Hollow, which is the allocation that got this page blocked from WebGL on
 * 2026-08-06. The caller memoises and disposes; this only builds.
 */
export const createHollowGeo = (): Record<HollowForm, THREE.BufferGeometry> => ({
  // Squat and wide, thin and tall, small and hovering — readable as silhouettes at distance.
  warden: new THREE.IcosahedronGeometry(0.95, 1),
  stalker: new THREE.ConeGeometry(0.38, 1.5, 6),
  caster: new THREE.OctahedronGeometry(0.62, 0),
})

/**
 * How hard a Hollow borrows at full daylight — the brief's *"tinted entirely by the environment"*
 * half, as a number.
 *
 * ⚠ IT IS ONLY MEANINGFUL BECAUSE `envMap` IS SET ON THE MATERIAL. three DISCARDS a material's
 * `envMapIntensity` and substitutes `scene.environmentIntensity` whenever the material's own
 * `envMap` is null and the scene has one (`WebGLRenderer.js:2604`). Until 2026-09-08 there was no
 * environment at all, anywhere, so this number multiplied nothing — see `sky-env.ts` for the
 * measurement and for why a scene-wide environment is the wrong fix here.
 *
 * ── ★★ IT WAS 1.35 UNTIL 2026-09-08, AND THAT NUMBER WAS NEVER A MEASUREMENT ─────────────────
 * 1.35 was chosen against the bench's `CubeCamera`, which photographs a small dim room at night;
 * against a full noon sky it is a completely different quantity of light. Wired at 1.35 the body
 * measured **(66, 81, 89)** against a greyfield plane at **(46, 48, 54)** — a Hollow BRIGHTER and
 * bluer than the ground it stands on, which breaks two rules at once: this file's own *"darker
 * than any ground grey"* and canon's *"the body's own tone must look like it is not being lit at
 * all, even in full light."*
 * ⚠⚠ AND IT IS THE FAILURE MODE THIS REPO KEEPS WRITING DOWN: the fix for *"too dark"* went past
 * the target and produced *"too lit"*, which is a defect in the opposite direction and would have
 * shipped as a success, because the thing it was measured against — the complaint — was gone.
 * **Ask what else moved, not only whether the red went green.**
 * Measured at four settings from the same headless frame (body mean vs a ground at 46,48,54):
 *   borrow 0    → (26, 31, 31)  the black cutout Alex reported
 *   borrow 1.35 → (66, 81, 89)  brighter than the ground; a lit figure, not an absence
 *   borrow 0.60 → (47, 58, 63)  reads as an absence, anatomy legible, sheen along the limbs  ← shipped
 *   metal 0.45  → (57, 71, 78)  keeps the borrow high by killing diffuse instead; reads WETSUIT,
 *                               and it tints the specular with the BODY, which canon forbids
 *                               (*"never carries a hue the scene did not already have"*).
 * ⚠ The diffuse VALUE is explicitly Jin's to tune (`design-briefs/hollows.md`); its RESPONSE is
 * canon's. This moves the value and leaves the response alone, which is the permitted direction.
 */
export const BORROW = 0.60

/** Every material this module has built, so the hour can be applied to all of them at once. */
const LIVE = new Set<THREE.MeshStandardMaterial>()

/**
 * Point every live Hollow material's borrow at the hour.
 *
 * ★ CALLED FROM THE PER-FRAME BODY UPDATERS (`updateHollowMeshBody`, `updateHollowBody`) rather
 * than from a rig component, because those two are the only functions BOTH the world and the bench
 * run every frame. A tick wired into `VoxelWorld` alone would leave `dev/hollow` — the one surface
 * every Hollow look call is made on — showing a body lit by a different rule than the world's,
 * which is the exact trap that manufactured the "reads too dark" finding on 2026-09-06.
 *
 * ⚠ NOT IN `applyHollowPose`. That function is the single writer for the WALK and knows nothing
 * about time; putting a clock read in it would couple the pose to the hour for no reason.
 *
 * Idempotent and cheap: three materials, one float each, and it early-outs when the hour has not
 * moved enough to see. Safe to call once per body per frame.
 */
let LAST_BORROW = -1
export function setHollowBorrow(daylight: number): void {
  const v = BORROW * borrowedSky(daylight)
  if (Math.abs(v - LAST_BORROW) < 0.002) return
  LAST_BORROW = v
  for (const m of LIVE) m.envMapIntensity = v
}

/** Three materials, one per form, built from the dials. */
export function createHollowMat(look: HollowLook = HOLLOW_LOOK): Record<HollowForm, THREE.MeshStandardMaterial> {
  const surface = goopSurface()
  const rough = goopRoughness()
  const one = (f: HollowForm) => new THREE.MeshStandardMaterial({
    color: look.colour[f],
    // ★ WET, AND THE NUMBERS COME FROM THE BRIEF RATHER THAN FROM TASTE. Low roughness is the
    // "specular: high" half; low metalness keeps it a dielectric, because a metal reads as a
    // POLISHED thing and a Hollow owns nothing. `envMapIntensity` above 1 is the "tinted entirely
    // by the environment" half: where a scene gives it something to borrow, it borrows hard.
    roughness: 0.34,
    metalness: 0.10,
    // ★ THE ROOM IT BORROWS, AND THE REASON IT IS ON THE MATERIAL AND NOT ON THE SCENE: three
    // applies `scene.environment` to Lambert and Phong too, and this world is Lambert nearly
    // everywhere, so a scene-wide environment would re-light every voxel in Shimmer. `sky-env.ts`
    // carries the full argument and the measurement that prompted it.
    envMap: skyEnvironment(),
    envMapIntensity: BORROW,
    normalMap: surface,
    normalScale: new THREE.Vector2(0.85, 0.85),
    // ⚠ ROUGHNESS FROM THE SAME HEIGHT FIELD, IN ITS OWN TEXTURE. Uniform roughness slides a
    // highlight across the body like plastic; varying it along the same lumps the normal map
    // describes is what makes the thing read as WET rather than as shiny. It was packed into the
    // normal map's ALPHA until 2026-09-08 and three reads roughness from G — so for three days the
    // roughness rode the normal's Y slope at about half the briefed value. See `goopSurface`.
    roughnessMap: rough,
    // ★ THE SELF-LIGHT IS THE BODY'S OWN HUE, NEVER A TINT. A white emissive shifts the grey as the
    // scene light drops, so a Hollow would change colour with the time of day — and the grey is the
    // whole read of the thing.
    emissive: look.colour[f],
    emissiveIntensity: look.selfLight,
    // ⚠ TRANSPARENCY IS DERIVED, NEVER ASSERTED. `transparent: true` at opacity 1 still costs the
    // sorted-blend path, and overlapping blended spheres are drawn in an order depth-writing does
    // not fix — which is the layered, glassy read even when the alpha is nearly gone.
    transparent: look.opacity[f] < 1,
    opacity: look.opacity[f],
  })
  const built = { warden: one('warden'), stalker: one('stalker'), caster: one('caster') }
  // ⚠ REGISTERED, NOT TRACKED BY A CALLER. `hollow-body` and `hollow-mesh` each hold their own set
  // built from this factory, and `dev/grey` builds more from varied dials; a tick that only knew
  // about one of them would light half the Hollows on the bench by a different clock than the other
  // half. The producer is the only place that can see all of them.
  for (const f of ['warden', 'stalker', 'caster'] as const) {
    LIVE.add(built[f])
    // ⚠⚠ AND IT INHERITS THE CURRENT HOUR, WHICH IS NOT A DETAIL. `setHollowBorrow` early-outs when
    // the hour has not moved, so a material built AFTER the last tick would never be visited — and
    // the case where that happens is the only case that matters: a Hollow SPAWNS AT NIGHT, its
    // material is constructed at the noon default, the tick sees no change and returns, and that
    // body borrows a full daylight sky in the dark for the rest of its life. The early-out is what
    // makes the tick free; this line is what stops it from being a leak.
    if (LAST_BORROW >= 0) built[f].envMapIntensity = LAST_BORROW
  }
  return built
}

/**
 * Re-point live materials at a new set of dials, in place.
 *
 * ★ THIS IS WHAT MAKES A SLIDER HONEST. Rebuilding the materials on every drag would leak a shader
 * program per frame — the exact allocation the note above is about — and disposing/recreating them
 * mid-drag makes the preview flicker for reasons that have nothing to do with the look. Mutating
 * the three that already exist is both cheaper and a truer picture of what the world does.
 */
export function applyHollowLook(
  mats: Record<HollowForm, THREE.MeshStandardMaterial>, look: HollowLook,
): void {
  for (const f of ['warden', 'stalker', 'caster'] as const) {
    mats[f].color.setHex(look.colour[f])
    mats[f].emissive.setHex(look.colour[f])
    mats[f].emissiveIntensity = look.selfLight
    mats[f].opacity = look.opacity[f]
    mats[f].transparent = look.opacity[f] < 1
    mats[f].needsUpdate = true
  }
}
