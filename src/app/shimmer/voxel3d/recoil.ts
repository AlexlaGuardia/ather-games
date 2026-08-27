/**
 * RECOIL — the camera climb, and the one property that makes it legal.
 *
 * ★★★ THE BUG THIS FILE EXISTS FOR (Alex, playing, 2026-08-27): *"the moglin enemies chased me
 * down ... as they damaged my player it tilted the screen view."* The tilt is real. His attribution
 * is not: nothing on the damage path touches camera orientation, and anyone sent to the pressure
 * code finds nothing. **It is his own firing.** `camera.rotation` is written in exactly one place
 * in the whole world — the drain below — and the kick is stamped by `fire()`.
 *
 * ⚠ THE MECHANISM IS A PROPERTY NOBODY SET. `look()` authors orientation on the QUATERNION as a
 * YXZ euler (pitch about the camera's own right axis, yaw about world up — the FPS convention, and
 * the only one that cannot roll). But `camera.rotation` is a separate euler that three keeps in
 * sync, and it decomposes using ITS OWN `.order`, which VoxelWorld never set — so it was three's
 * default `'XYZ'`. Adding to `.x` on an XYZ euler pitches about the WORLD x axis, not the camera's
 * right axis. After a yaw those are different axes, and the difference IS roll.
 *
 * ★★ SO THE BUG IS INVISIBLE FROM SPAWN, WHICH IS WHY IT TOOK PLAYING TO FIND. Roll scales with
 * the player's yaw and vanishes where the camera happens to be world-axis-aligned. Measured over
 * four seconds of held trigger (`recoil.test.ts` re-measures it):
 *
 *     yaw:        0°     45°     90°    135°    180°    225°    270°
 *     spitter   -0.05  +10.56  +14.81  +10.56  -0.05  -10.62  -14.81   (pitch 0)
 *     spitter   +0.09  +12.01  +19.09  +16.00  -0.26  -16.29  -19.00   (pitch -40°)
 *
 * Face north, empty a clip, see nothing. Turn 90° and the horizon leans 15–19°. A test that fires
 * from the default facing reports the feature working.
 *
 * ★ PLAY3D DOES NOT HAVE THIS BUG, CHECKED RATHER THAN ASSUMED. `Shimmer3D`'s `CameraRig` drains
 * the same kick into `lookPitch` / `yaw` SCALARS and rebuilds the orientation with `cam.lookAt`,
 * which is always up-aligned — there is no euler to decompose and nothing to reinterpret. The two
 * worlds differ here on purpose and it is not drift. Do not "unify" them by pointing play3d at
 * this drain without giving it the order first.
 */

/** How fast the stamped kick bleeds into the camera, per second. Higher = snappier, less smear. */
export const RECOIL_DRAIN_RATE = 18

/** The kick still owed to the camera. `p` is pitch (climb), `y` is yaw (horizontal wander). */
export interface RecoilState { p: number; y: number }

/**
 * The two euler components the drain writes. Deliberately NOT `THREE.Euler` — this module stays
 * host-agnostic, and the caller passes the real `camera.rotation` so its change callback fires.
 *
 * ⚠ A structural type this narrow is exactly what silently ate `open?` off a `Placement` last
 * night. It is safe HERE only because the drain has no third field to lose: it writes x and y and
 * must never write z. Widening it is how roll comes back.
 */
export interface DrainTarget { x: number; y: number }

/**
 * Bleed the owed kick into the camera for one frame.
 *
 * Drained per-frame rather than written at fire time so a burst CLIMBS smoothly instead of snapping
 * once per round — that smear is the whole feel of the gun, and it is why this cannot just be a
 * `quaternion.setFromEuler` at the fire site.
 *
 * ⚠ THE CALLER MUST HAVE PUT THE CAMERA IN YXZ FIRST (`prepareLookCamera`). This function has no
 * way to check that — it never sees the camera, only two numbers — so the guarantee lives in
 * `recoil.test.ts`, which drives a real camera and measures the horizon.
 */
export function drainRecoil(look: DrainTarget, recoil: RecoilState, dt: number): void {
  if (recoil.p === 0 && recoil.y === 0) return
  const step = Math.min(1, dt * RECOIL_DRAIN_RATE)
  look.x += recoil.p * step
  look.y += recoil.y * step
  const k = 1 - step
  recoil.p *= k
  recoil.y *= k
}

/** The euler order an FPS camera must be in for pitch and yaw to be independent of each other. */
export const LOOK_EULER_ORDER = 'YXZ' as const

/** The minimum of a THREE.Camera this needs. Keeps the module free of a three import. */
interface OrderableCamera {
  rotation: { order: string }
  quaternion: { clone(): unknown; copy(q: never): unknown }
}

/**
 * Put a camera into the look convention, ONCE, at mount.
 *
 * ⚠⚠ SETTING `.order` IS NOT A READ-ONLY DECLARATION — IT MOVES THE CAMERA. three's `Euler.order`
 * setter fires the change callback, which recomputes the QUATERNION from the euler's existing
 * (x, y, z) reinterpreted under the new order. On a camera already pointing somewhere that is a
 * silent teleport of the view. So the orientation is saved and put back: copying the quaternion
 * fires the other direction of the sync and re-decomposes the euler correctly under YXZ.
 *
 * At mount the rotation is (0,0,0) and the save/restore is a no-op — it is here for the day this
 * is called on a camera that has already been aimed, which is the day it would otherwise be a bug
 * nobody could reproduce.
 */
export function prepareLookCamera(camera: OrderableCamera): void {
  const facing = camera.quaternion.clone()
  camera.rotation.order = LOOK_EULER_ORDER
  camera.quaternion.copy(facing as never)
}
