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

export type HollowForm = 'warden' | 'stalker' | 'caster'

/** Every number that decides how a Hollow reads. One object so a page can vary it whole. */
export interface HollowLook {
  /**
   * Emissive intensity — the body's own light, in its own hue.
   *
   * ⚠ 0 is the pre-2026-08-27 behaviour and it is INVISIBLE at night. This is the dial Alex rules.
   */
  selfLight: number
  /** Per-form base grey. The caster reads colder so the thing draining you from range is findable. */
  colour: Record<HollowForm, number>
  /** Per-form opacity. Lower reads as more smoke, less body. */
  opacity: Record<HollowForm, number>
}

/**
 * The shipped look.
 *
 * ⚠ THESE ARE THE VALUES THE WORLD USES. `dev/grey` starts here and varies from it, so "what the
 * page shows on load" and "what the game draws" are the same thing by construction.
 */
export const HOLLOW_LOOK: HollowLook = {
  selfLight: 0.15,
  // A smear of grey that holds a silhouette: darker than any ground grey, never a face.
  colour: { warden: 0x3f423d, stalker: 0x4a4d47, caster: 0x474f58 },
  opacity: { warden: 0.9, stalker: 0.82, caster: 0.78 },
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

/** Three materials, one per form, built from the dials. */
export function createHollowMat(look: HollowLook = HOLLOW_LOOK): Record<HollowForm, THREE.MeshLambertMaterial> {
  const one = (f: HollowForm) => new THREE.MeshLambertMaterial({
    color: look.colour[f],
    // ★ THE SELF-LIGHT IS THE BODY'S OWN HUE, NEVER A TINT. A white emissive shifts the grey as the
    // scene light drops, so a Hollow would change colour with the time of day — and the grey is the
    // whole read of the thing.
    emissive: look.colour[f],
    emissiveIntensity: look.selfLight,
    transparent: true,
    opacity: look.opacity[f],
  })
  return { warden: one('warden'), stalker: one('stalker'), caster: one('caster') }
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
  mats: Record<HollowForm, THREE.MeshLambertMaterial>, look: HollowLook,
): void {
  for (const f of ['warden', 'stalker', 'caster'] as const) {
    mats[f].color.setHex(look.colour[f])
    mats[f].emissive.setHex(look.colour[f])
    mats[f].emissiveIntensity = look.selfLight
    mats[f].opacity = look.opacity[f]
    mats[f].needsUpdate = true
  }
}
