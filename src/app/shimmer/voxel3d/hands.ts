// The keeper's hands — the rig. Host side (three), one shared geometry, driven by `hands-pose.ts`.
//
// ★ WHAT IS ON SCREEN, AND WHY IT IS THIS AND NOT A GENERIC ARM. The right hand IS THE GLOVE —
// `design-briefs/shimmer-casting-vessels.md` (RULED 2026-09-03): *"the glove is the hand, the thing
// you raise and aim."* Tier-0 is *"a crude cloudy manalic crystal"* in one seat, dark until the
// word is written, so the back of the glove carries one dim seat. ⛔ No metal anywhere — not a
// buckle, not a clasp — the cuff is cord-whipped cloth. The LEFT wrist wears the bracelet (the
// tacticals) and comes into frame only on a cast. The held thing is the GATHERING FOCUS the aimed
// block asks for (`tools.ts`: blade / spike / rinstick / spade — *a grown thing*, wood and horn,
// never metal), and it is in the hand only while the block-picks-the-tool model has picked one:
// aim at rock and the spike comes up, aim at a tree and it is the blade. That is the model made
// visible, which is the point of showing a hand at all.
//
// ★ SLEEVE + GLOVE, NO SKIN. The keeper's skin and species are hero art (Alex's), so nothing here
// shows either: a cuff covers the wrist and the glove covers the hand. What is visible is CRAFT,
// which canon has already ruled on.
//
// ── HOW IT STAYS ON THE LENS ───────────────────────────────────────────────────────────────
// The rig group copies the camera's pose every frame (position + quaternion) and hangs the arm in
// camera space below-right. It is NOT a child of the camera: R3F's default camera is not in the
// scene graph, so a child of it would never render, and `scene.add(camera)` is a trap other files
// avoid on purpose. Copying the pose is two assignments and works for any camera.
//
// ── HOW IT DRAWS OVER THE WORLD ────────────────────────────────────────────────────────────
// Stand against a wall and the hand is INSIDE the wall. Every part here is in the TRANSPARENT list
// (`transparent: true`, opacity 1) with `renderOrder` HANDS_ORDER, and one invisible sentinel at
// HANDS_ORDER − 1 clears the depth buffer in `onBeforeRender`. three draws the transparent list
// last, sorted by renderOrder, so the clear lands AFTER every world object — opaque and transparent
// — and BEFORE the hand, which then depth-tests only against itself. ⚠ Clearing depth from an
// OPAQUE sentinel would let the world's own transparents (water, smoke, the guide trail) draw
// through walls, because they would test against a wiped buffer. The list is the whole trick.
//
// Bench: none yet — shot on the play devwin. Alex judges the look; this is placeholder craft.

import * as THREE from 'three'
import type { SkillId } from '../engine/skills'
import { stepHands, newHandsState, type HandsInput, type HandsState, type HandsPose } from './hands-pose'

export const HANDS_ORDER = 1000

/**
 * Where the arm rests in camera space: the WRIST is the origin, the forearm runs +z (toward the
 * elbow) and the fingers −z. ⚠ THE ARM RUNS ALONG THE SCREEN, NOT INTO IT. The first two cuts
 * pointed the forearm down the view axis and every shot showed the elbow's end face — a square.
 * A hand reads when the elbow is off the bottom-right corner and the forearm climbs the diagonal
 * toward the centre: yaw turns the fingers inward (−x), pitch lifts them (+y), roll turns the back
 * of the glove to the lens. The elbow end is nearest the camera and biggest, as it should be.
 */
// ⚠ YAW SIGN (Alex, 09-16: "the hand is facing the wrong direction"): a NEGATIVE yaw here sent the
// fingers to +x — the right edge — so the arm read as climbing out of the frame instead of into it.
// Positive yaw turns −z (the fingers) toward −x, the crosshair, and +z (the elbow) to the corner.
// Second look (Alex, 09-16): "tilt it a bit more to the right so it looks connected to the body,
// not a floating prop" — more yaw and more roll lean the forearm toward the corner it comes from,
// and the wrist sits further right so the elbow is unambiguously OFF the frame, where a shoulder is.
export const REST = { x: 0.31, y: -0.17, z: -0.56, yaw: 1.0, pitch: 0.50, roll: -0.55 } as const
export const LEFT_REST = { x: -0.34, y: -0.62, z: -0.54, up: 0.42 } as const

/** Proportions, camera units. The arm reads at fov 75 from 0.6 away; these were eyeballed there. */
const P = {
  forearm: { w: 0.062, h: 0.056, l: 0.22 },
  cuff:    { w: 0.082, h: 0.076, l: 0.04 },
  glove:   { w: 0.10, h: 0.052, l: 0.12 },
  finger:  { w: 0.021, h: 0.024, l: 0.06, curl: -1.2 },
  thumb:   { w: 0.028, h: 0.028, l: 0.06 },
  seat:    { r: 0.018 },
  band:    { w: 0.10, h: 0.09, l: 0.028 },
} as const

/**
 * The craft palette. Cloth and cord for the sleeve, dun leather-ish grown hide for the glove with a
 * pale palm, the seat a dark cloudy crystal. All warm; none grey (the vessel card: *craft does not
 * grey*). Tool wood + horn per family below.
 */
const COLOUR = {
  sleeve: 0x8a7a5c,   // undyed cloth, warm — the first cut was 0x6f6a56 and read GREY under a roof
  cord:   0xb59a6a,   // whipped cord at the cuff
  glove:  0x8a6a48,   // the vessel's hide, tier 0
  palm:   0xc9b08c,
  seat:   0x4a4638,   // tier-0 crude cloudy crystal, dormant (a dark seat, per the card)
  band:   0x7d6a4a,   // the bracelet: woven cord
  bead:   0x5a6b4a,   // its one seat, dormant
  wood:   0x9a7a4a,
  horn:   0xd8cdb2,
  stone:  0xa89e8a,
} as const

export interface HandsSignal {
  /** The family being SWUNG right now (the host names it only while a block is worked), else null. */
  family: SkillId | null
  /** What is in the fist when no focus is: a block or a piece, as its flat colour; null for nothing.
   *  A focus outranks it — you cannot hold a block and swing a blade with one hand. */
  held: { colour: number; piece: boolean } | null
  /** The body's verbs, copied off `LocoState` each frame by the host. */
  airborne: boolean; sliding: boolean; crouching: boolean; climbing: boolean
  wallCatch: boolean; hanging: boolean; mantle: number; swimming: boolean
  /** Stamped by the host on the airborne→ground edge, with the fall speed. */
  landAt: number; landVy: number
  /** Equipped tier for that family; tints the head. */
  tier: number
  breaking: boolean
  /** `performance.now()` stamps; the host writes them at the place / cast sites. */
  placeAt: number
  castAt: number
  hidden: boolean
  /** The last pose applied — a readout for the harness and the doctor, written every tick. */
  last?: HandsPose
}

export interface Hands {
  group: THREE.Group
  sig: HandsSignal
  /** Once per frame, after the camera has moved. `t` seconds, `dt` seconds. */
  tick: (camera: THREE.Camera, t: number, dt: number) => void
  dispose: () => void
}

export function createHands(): Hands {
  const cube = new THREE.BoxGeometry(1, 1, 1)
  const sphere = new THREE.SphereGeometry(1, 10, 8)
  const mats = new Map<number, THREE.MeshLambertMaterial>()
  const mat = (colour: number) => {
    let m = mats.get(colour)
    if (!m) { m = new THREE.MeshLambertMaterial({ color: colour, transparent: true }); mats.set(colour, m) }
    return m
  }
  const part = (parent: THREE.Object3D, geo: THREE.BufferGeometry, colour: number, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat(colour))
    m.scale.set(sx, sy, sz); m.position.set(x, y, z)
    m.renderOrder = HANDS_ORDER
    m.frustumCulled = false
    parent.add(m)
    return m
  }

  const group = new THREE.Group()
  group.matrixAutoUpdate = true

  // The depth sentinel: a point-sized transparent mesh that clears depth just before the hand.
  const sentinel = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
  sentinel.scale.setScalar(0.001)
  sentinel.renderOrder = HANDS_ORDER - 1
  sentinel.frustumCulled = false
  sentinel.onBeforeRender = (renderer) => { renderer.clearDepth() }
  group.add(sentinel)

  // ── the right arm: pivot at the shoulder-ish end, the forearm hangs toward the lens ──
  const arm = new THREE.Group()
  arm.position.set(REST.x, REST.y, REST.z)
  arm.rotation.set(REST.pitch, REST.yaw, REST.roll)
  group.add(arm)
  // Local frame: +z is toward the lens (the elbow), −z is away (the fingers).
  part(arm, cube, COLOUR.sleeve, P.forearm.w, P.forearm.h, P.forearm.l, 0, 0, P.forearm.l / 2 - 0.02)
  part(arm, cube, COLOUR.cord, P.cuff.w, P.cuff.h, P.cuff.l, 0, 0, 0)
  const glove = part(arm, cube, COLOUR.glove, P.glove.w, P.glove.h, P.glove.l, 0, -0.005, -P.glove.l / 2 - P.cuff.l / 2)
  // pale palm (a thin plate under the glove), four fingers curled into a grip off the far edge,
  // and the thumb tucked to the inside — a fist, which is what a hand holding a focus is
  part(arm, cube, COLOUR.palm, P.glove.w * 0.92, 0.006, P.glove.l * 0.9, 0, -P.glove.h / 2 - 0.002, glove.position.z)
  for (let i = 0; i < 4; i++) {
    const knuckle = new THREE.Group()
    knuckle.position.set(-P.glove.w / 2 + P.finger.w * 0.6 + i * (P.glove.w - P.finger.w * 1.2) / 3, 0, glove.position.z - P.glove.l / 2)
    knuckle.rotation.x = P.finger.curl
    arm.add(knuckle)
    part(knuckle, cube, COLOUR.glove, P.finger.w, P.finger.h, P.finger.l, 0, 0, -P.finger.l / 2)
  }
  part(arm, cube, COLOUR.glove, P.thumb.w, P.thumb.h, P.thumb.l, -P.glove.w / 2 - P.thumb.w / 2 + 0.008, 0.006, glove.position.z + 0.01)
  // the seat on the back of the hand: one, dark — the tier-0 word is one seat, unwritten
  part(arm, sphere, COLOUR.seat, P.seat.r, P.seat.r * 0.6, P.seat.r, 0.012, P.glove.h / 2, glove.position.z + 0.01)

  // ── the held focus: one group per family, only one visible ──
  const tools = new Map<SkillId, THREE.Group>()
  const toolAt = (fam: SkillId) => {
    const g = new THREE.Group()
    g.position.set(0, 0.01, glove.position.z)     // in the fist
    g.visible = false
    tools.set(fam, g)
    arm.add(g)
    return g
  }
  {
    // blade (forestry): a shaft in the fist and a flat wedge running forward-up
    const g = toolAt('forestry')
    part(g, cube, COLOUR.wood, 0.03, 0.03, 0.16, 0, 0, 0.02)
    const wedge = part(g, cube, COLOUR.horn, 0.012, 0.06, 0.26, 0, 0.03, -0.18)
    wedge.rotation.x = 0.12
  }
  {
    // spike (prospecting): shaft, and a narrow head across the top
    const g = toolAt('prospecting')
    part(g, cube, COLOUR.wood, 0.03, 0.03, 0.30, 0, 0, -0.06)
    part(g, cube, COLOUR.stone, 0.025, 0.05, 0.10, 0, 0.03, -0.20)
    part(g, cube, COLOUR.stone, 0.02, 0.02, 0.06, 0, 0.06, -0.24)
  }
  {
    // rinstick (rinning): a long rod, tip bent up
    const g = toolAt('rinning')
    part(g, cube, COLOUR.wood, 0.022, 0.022, 0.42, 0, 0, -0.12)
    const tip = part(g, cube, COLOUR.wood, 0.016, 0.016, 0.10, 0, 0.03, -0.36)
    tip.rotation.x = -0.5
  }
  {
    // spade (farming): shaft and a flat blade
    const g = toolAt('farming')
    part(g, cube, COLOUR.wood, 0.03, 0.03, 0.30, 0, 0, -0.06)
    part(g, cube, COLOUR.horn, 0.07, 0.012, 0.11, 0, 0.0, -0.26)
  }

  // ── the left wrist: the bracelet, below the frame until a cast ──
  const left = new THREE.Group()
  left.position.set(LEFT_REST.x, LEFT_REST.y, LEFT_REST.z)
  left.rotation.set(REST.pitch, -REST.yaw, -REST.roll)   // the mirror of the right arm
  group.add(left)
  part(left, cube, COLOUR.sleeve, P.forearm.w, P.forearm.h, P.forearm.l, 0, 0, P.forearm.l / 2 + 0.03)
  part(left, cube, COLOUR.band, P.band.w, P.band.h, P.band.l, 0, 0, 0.01)
  part(left, sphere, COLOUR.bead, 0.014, 0.014, 0.014, 0, P.band.h / 2, 0.01)
  part(left, cube, COLOUR.glove, P.glove.w * 0.9, P.glove.h * 1.2, P.glove.l * 0.6, 0, 0, -P.glove.l * 0.3 - 0.01)  // a closed fist

  // ── the held thing: one cube in the fist, tinted per frame from the signal (a block reads as a
  //    small block; a piece as a flatter slab of its material). One mesh, one material of its own.
  const heldMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true })
  const held = new THREE.Mesh(cube, heldMat)
  held.renderOrder = HANDS_ORDER; held.frustumCulled = false; held.visible = false
  held.position.set(0, 0.035, glove.position.z - 0.02)
  arm.add(held)

  const sig: HandsSignal = {
    family: null, tier: 0, breaking: false, placeAt: -Infinity, castAt: -Infinity, hidden: false,
    held: null, airborne: false, sliding: false, crouching: false, climbing: false,
    wallCatch: false, hanging: false, mantle: -1, swimming: false, landAt: -Infinity, landVy: 0,
  }
  const state: HandsState = newHandsState()
  const last = new THREE.Vector3(NaN, NaN, NaN)
  const tierTint = [0xd8cdb2, 0xe2d6b8, 0xe9dcc0, 0xf0e4c8]   // horn, a step clearer per tier
  let lastTier = -1

  const tick = (camera: THREE.Camera, t: number, dt: number) => {
    // pose from the camera
    group.position.copy(camera.position)
    group.quaternion.copy(camera.quaternion)
    // speed from the camera's own travel — no coupling to the walker. Horizontal AND vertical: the
    // clock needs to know when the feet have left the ground (a jump is not a run).
    let speed = 0, vy = 0
    if (Number.isFinite(last.x) && dt > 0) {
      speed = Math.hypot(camera.position.x - last.x, camera.position.z - last.z) / dt
      vy = (camera.position.y - last.y) / dt
    }
    if (speed > 40 || Math.abs(vy) > 40) { speed = 0; vy = 0 }   // a teleport is not a sprint
    last.copy(camera.position)
    const showHeld = !sig.family && !!sig.held
    const input: HandsInput = {
      t, now: performance.now(), speed, vy, breaking: sig.breaking, placeAt: sig.placeAt, castAt: sig.castAt, hidden: sig.hidden,
      airborne: sig.airborne, sliding: sig.sliding, crouching: sig.crouching, climbing: sig.climbing,
      wallCatch: sig.wallCatch, hanging: sig.hanging, mantle: sig.mantle, swimming: sig.swimming,
      landAt: sig.landAt, landVy: sig.landVy, holding: showHeld,
    }
    const pose = stepHands(state, input, dt)
    sig.last = pose
    arm.position.set(REST.x + pose.dx, REST.y + pose.dy, REST.z + pose.dz)
    arm.rotation.x = REST.pitch + pose.pitch
    left.position.y = LEFT_REST.y + pose.left * LEFT_REST.up + pose.leftDy
    left.rotation.x = REST.pitch + pose.leftPitch
    left.visible = pose.left > 0.01
    // the focus in the fist, or the thing being carried
    for (const [fam, g] of tools) g.visible = fam === sig.family
    held.visible = showHeld
    if (showHeld) {
      heldMat.color.setHex(sig.held!.colour)
      if (sig.held!.piece) held.scale.set(0.11, 0.035, 0.11); else held.scale.set(0.085, 0.085, 0.085)
    }
    // the head's material is SHARED by every horn part, so the tier tint is one write, on change
    if (sig.tier !== lastTier) { lastTier = sig.tier; mat(COLOUR.horn).color.setHex(tierTint[Math.max(0, Math.min(3, sig.tier))]) }
  }

  return {
    group, sig, tick,
    dispose: () => {
      cube.dispose(); sphere.dispose()
      for (const m of mats.values()) m.dispose()
      mats.clear()
      heldMat.dispose()
      ;(sentinel.material as THREE.Material).dispose()
    },
  }
}
