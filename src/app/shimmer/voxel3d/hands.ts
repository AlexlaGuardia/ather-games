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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { SkillId } from '../engine/skills'
import { stepHands, newHandsState, type HandsInput, type HandsState, type HandsPose } from './hands-pose'

export const HANDS_ORDER = 1000
/** The modelled tier-0 glove (picaso, off the locked ref). Absent = the stick stays. */
export const GLOVE_MODEL_URL = '/models/hands/glove-t0.glb'

/**
 * ★★ THE ARM IS TWO POINTS, NOT THREE ANGLES (third look, Alex 09-16, with a photo: "I can't get
 * over this floating arm thing"). Four passes of hand-composed Euler angles each fixed one read
 * and broke another — end-on box, climbing out of frame, lying flat along the bottom with the cut
 * elbow showing at the right edge. The honest construction: say WHERE THE WRIST IS and WHERE THE
 * ELBOW IS, in camera space, and aim the forearm down that line with `lookAt`. The elbow sits
 * BELOW the frame's bottom edge and to the right — where a shoulder puts it — so the forearm
 * rises steeply INTO the frame, foreshortened, and its cut end can never be on screen (the sleeve
 * is long enough to pass the bottom edge with room to spare). `roll` is the one remaining angle:
 * about the forearm's own axis, to turn the back of the glove toward the lens.
 *
 * The frame at fov 75, z = 0.5: half-height 0.38, half-width 0.55 (16:9). Everything below
 * y = −0.38 at that depth is off-screen.
 */
export interface HandsTune { wx: number; wy: number; wz: number; ex: number; ey: number; ez: number; roll: number }
// Alex, 09-16, on the first default: "turn it about 15 degrees to the right and bring it down a
// bit" — the elbow→wrist line rotated 15° clockwise about the elbow, then the whole arm 0.05 lower.
// ★ RAYMAN default (09-17): with no arm to justify a steep angle, the aim point sits behind and a
// little below the wrist, so the fingers point FORWARD into the world with a touch of lift — a
// hand in front of you, not a limb reaching off the frame. (The arm's tune was wrist 0.32,−0.20,
// −0.50 · elbow 0.46,−0.67,−0.34.)
export const DEFAULT_TUNE: HandsTune = { wx: 0.30, wy: -0.24, wz: -0.50, ex: 0.36, ey: -0.42, ez: -0.18, roll: -0.35 }
/** The left wrist rests below the frame and rises `up` on a cast; its elbow mirrors the right's. */
export const LEFT_UP = 0.40
/** The hands' orientation follows the camera on a spring at this rate (1/s). */
export const LAG_RATE = 14
export const LEFT_DROP = 0.38

// ── ★ THE TUNE IS ALEX'S (09-16: "I wish there was a way for me to position it") ─────────────
// A module store the Dev tab's tuner writes and every rig reads: seven numbers, saved in
// localStorage so a reload keeps them, and a readout he can paste back so the default gets baked.
// The rig re-aims when the version moves — no prop plumbing from the HUD down into the World.
// v2: the floating-hand default is a different object from the arm's; a saved arm tune must not
// outrank it, so the key moved and the old one is ignored.
const TUNE_KEY = 'shimmer:hands-tune.v2'
/** A pose forced on the rig for judging it without hunting a block: the tuner's buttons set it.
 *  Never saved — a preview that survived a reload would be a bug nobody could find. */
export type HandsPreview = 'none' | 'present' | 'reach' | 'cast'
export const handsTune: { tune: HandsTune; version: number; preview: HandsPreview } = { tune: { ...DEFAULT_TUNE }, version: 0, preview: 'none' }
export function loadHandsTune(): HandsTune {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TUNE_KEY) : null
    if (raw) { const t = JSON.parse(raw) as Partial<HandsTune>; handsTune.tune = { ...DEFAULT_TUNE, ...t }; handsTune.version++ }
  } catch { /* a blocked store is the default tune */ }
  return handsTune.tune
}
export function setHandsTune(patch: Partial<HandsTune>): HandsTune {
  handsTune.tune = { ...handsTune.tune, ...patch }; handsTune.version++
  try { localStorage.setItem(TUNE_KEY, JSON.stringify(handsTune.tune)) } catch { /* fine */ }
  return handsTune.tune
}
export function resetHandsTune(): HandsTune {
  handsTune.tune = { ...DEFAULT_TUNE }; handsTune.version++
  try { localStorage.removeItem(TUNE_KEY) } catch { /* fine */ }
  return handsTune.tune
}
/** One line Alex can paste: the seven numbers as they would sit in DEFAULT_TUNE. */
export const tuneReadout = (t: HandsTune) =>
  `wrist ${t.wx.toFixed(2)}, ${t.wy.toFixed(2)}, ${t.wz.toFixed(2)} · elbow ${t.ex.toFixed(2)}, ${t.ey.toFixed(2)}, ${t.ez.toFixed(2)} · roll ${t.roll.toFixed(2)}`

/** Proportions, camera units. The arm reads at fov 75 from 0.6 away; these were eyeballed there. */
const P = {
  forearm: { w: 0.062, h: 0.056, l: 0.60 },   // long: the cut end lives below the frame, always
  cuff:    { w: 0.082, h: 0.076, l: 0.04 },
  glove:   { w: 0.10, h: 0.052, l: 0.14 },   // a plain STICK end (Alex, 09-16: "remove the fingers and thumb")
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
  /**
   * Swap the stick for a modelled glove: a GLB with two meshes, `glove_fist` and `glove_open`,
   * built to the rig's frame (origin at the wrist, fingers −z, back of the hand +y, thumb −x —
   * `public/models/hands/README.md`). The stick stays until the file lands, and stays for good if
   * it does not — a missing model is a placeholder, never a missing hand. Resolves to whether it
   * swapped. Called by the host, never at build, so a node test never fetches.
   */
  loadGlove: (url: string) => Promise<boolean>
  dispose: () => void
}

export function createHands(): Hands {
  // the tune store on the window for a harness / the console: it is one module object, so the
  // StrictMode double-factory that orphaned `__hands` cannot orphan this (same handle either run)
  if (typeof window !== 'undefined') (window as unknown as { __handsTune: typeof handsTune }).__handsTune = handsTune
  const cube = new THREE.BoxGeometry(1, 1, 1)
  const sphere = new THREE.SphereGeometry(1, 10, 8)
  const mats = new Map<number, THREE.MeshLambertMaterial>()
  const mat = (colour: number) => {
    let m = mats.get(colour)
    // ★ An ambient FLOOR (the night photo: the sleeve went black). A hand a foot from your face is
    // the one thing the world's light does not get to erase — a sixth of its own colour, always.
    if (!m) { m = new THREE.MeshLambertMaterial({ color: colour, transparent: true, emissive: colour, emissiveIntensity: 0.16 }); mats.set(colour, m) }
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

  // ── the right arm: the WRIST is the pivot; `aim` below points its +z at the elbow. The pose's
  //    pitch (chop / raise) is applied on an inner group so it rotates about the wrist's own x. ──
  const armPivot = new THREE.Group()
  const arm = new THREE.Group()
  armPivot.add(arm)
  group.add(armPivot)
  /** Point a pivot's +z from `wrist` at `elbow` (both in the rig's own camera space), then roll
   *  about that axis. ⚠ `lookAt` takes a WORLD point, and after the first tick the rig wears the
   *  camera's pose — so the elbow is pushed through the rig's transform first. The first cut
   *  passed the camera-space elbow raw: right at build time (the rig still at the origin), wrong on
   *  every re-aim after it — the tuner's sliders, and play3d's fov scale on its first tick — which
   *  aimed the forearm at a point out in the WORLD and drew it reversed. */
  //  ⚠ AND `lookAt` TWISTS ABOUT WORLD UP, so even a world-converted target rolls the arm with the
  //  camera's pose. The orientation is therefore built entirely in the rig's local space:
  //  `Matrix4.lookAt(elbow, wrist, +y)` (object semantics: +z toward the first argument), which
  //  the parent's pose can never touch.
  const M = new THREE.Matrix4(), A = new THREE.Vector3(), B = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0)
  const aim = (pivot: THREE.Group, wrist: { x: number; y: number; z: number }, elbow: { x: number; y: number; z: number }, roll: number) => {
    pivot.position.set(wrist.x, wrist.y, wrist.z)
    M.lookAt(A.set(elbow.x, elbow.y, elbow.z), B.set(wrist.x, wrist.y, wrist.z), UP)
    pivot.quaternion.setFromRotationMatrix(M)
    pivot.rotateZ(roll)
  }
  // ★ THE TUNE IS IN FRAME UNITS, NOT CAMERA UNITS. The numbers were tuned at fov 75 (the Ather);
  // play3d looks through fov 45, where the same camera-space rig sat at the right edge, 1.7×
  // magnified, with the bracelet never entering frame. The projection: screen_x = (x/−z)/tan(f/2)
  // and apparent size ∝ s/(−z·tan(f/2)). Keeping BOTH across lenses solves to x' = x, y' = y,
  // z' = z · tan(75°/2)/tan(f/2) — only DEPTH moves: a narrower lens holds the rig further out.
  // ⚠ Two wrong answers first: scaling x,y alone changes the arm's direction and leaves the
  // magnification; scaling all three uniformly preserves x/z, which is exactly the thing that has
  // to change. `k` is read off the camera each tick; a change re-aims.
  const TUNED_FOV = 75
  const tuneSeen = { v: -1, k: 1 }
  const fovScale = (camera: THREE.Camera) => {
    const fov = (camera as THREE.PerspectiveCamera).fov
    return typeof fov === 'number' && fov > 0 ? Math.tan(TUNED_FOV * Math.PI / 360) / Math.tan(fov * Math.PI / 360) : 1
  }
  const reaim = (k = tuneSeen.k) => {
    const t = handsTune.tune
    aim(armPivot, { x: t.wx, y: t.wy, z: t.wz * k }, { x: t.ex, y: t.ey, z: t.ez * k }, t.roll)
    aim(leftPivot, { x: -t.wx, y: t.wy - LEFT_DROP, z: t.wz * k }, { x: -t.ex, y: t.ey - LEFT_DROP, z: t.ez * k }, -t.roll)
    tuneSeen.v = handsTune.version; tuneSeen.k = k
  }
  // Local frame: +z is toward the lens (the elbow), −z is away (the fingers).
  const forearm = part(arm, cube, COLOUR.sleeve, P.forearm.w, P.forearm.h, P.forearm.l, 0, 0, P.forearm.l / 2 - 0.02)
  const cuff = part(arm, cube, COLOUR.cord, P.cuff.w, P.cuff.h, P.cuff.l, 0, 0, 0)
  const glove = part(arm, cube, COLOUR.glove, P.glove.w, P.glove.h, P.glove.l, 0, -0.005, -P.glove.l / 2 - P.cuff.l / 2)
  // the pale palm: a thin plate on the glove's −y face — the INSIDE, where the held thing sits
  const palm = part(arm, cube, COLOUR.palm, P.glove.w * 0.92, 0.006, P.glove.l * 0.9, 0, -P.glove.h / 2 - 0.002, glove.position.z)
  // the seat on the back of the hand: one, dark — the tier-0 word is one seat, unwritten
  const seat = part(arm, sphere, COLOUR.seat, P.seat.r, P.seat.r * 0.6, P.seat.r, 0.012, P.glove.h / 2, glove.position.z + 0.01)

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

  // ── the left wrist: the bracelet, below the frame until a cast. Same construction, mirrored. ──
  const leftPivot = new THREE.Group()
  const left = new THREE.Group()
  leftPivot.add(left)
  group.add(leftPivot)
  loadHandsTune()
  reaim()
  const leftSleeve = part(left, cube, COLOUR.sleeve, P.forearm.w, P.forearm.h, P.forearm.l, 0, 0, P.forearm.l / 2 + 0.03)
  part(left, cube, COLOUR.band, P.band.w, P.band.h, P.band.l, 0, 0, 0.01)
  part(left, sphere, COLOUR.bead, 0.014, 0.014, 0.014, 0, P.band.h / 2, 0.01)
  const leftFist = part(left, cube, COLOUR.glove, P.glove.w * 0.9, P.glove.h * 1.2, P.glove.l * 0.6, 0, 0, -P.glove.l * 0.3 - 0.01)  // a closed fist

  // ── the held thing: one cube in the fist, tinted per frame from the signal (a block reads as a
  //    small block; a piece as a flatter slab of its material). One mesh, one material of its own.
  const heldMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true })
  const held = new THREE.Mesh(cube, heldMat)
  held.renderOrder = HANDS_ORDER; held.frustumCulled = false; held.visible = false
  // on the PALM side (−y), which the present pose turns skyward; hovering, mid-palm
  const HELD_Y = -0.054                       // palm surface −0.016, a 5 cm block, a finger's hover
  held.position.set(0.003, HELD_Y, -0.055)
  arm.add(held)

  // ── the modelled glove, when one is loaded: the stick parts hide, these show ──
  // ★ The box forearm hides too (09-16): the file's sleeve runs from the glove's hem past the frame
  // edge. Left showing, the box was the HANDLE of the hammer Alex saw — the glove hung 90° off its
  // end (the file's frame was wrong; fixed in the producer) and the box read as the arm's shaft.
  // ★ RAYMAN (Alex, 09-17): "what if we went for a rayman type feel and just did the hands?" The
  // file is now a floating glove — hem, closed stump, no sleeve — so BOTH sleeves hide, and the
  // left wrist wears the same glove mirrored (three flips the winding for a negative scale).
  const stickParts: THREE.Object3D[] = [glove, palm, cuff, seat, forearm, leftSleeve, leftFist]
  let gloveFist: THREE.Object3D | null = null, gloveOpen: THREE.Object3D | null = null
  /** The depth trick and the ambient floor, applied to any mesh that joins the rig later. */
  const adopt = (o: THREE.Object3D) => {
    o.traverse(m => {
      if (!(m instanceof THREE.Mesh)) return
      m.renderOrder = HANDS_ORDER; m.frustumCulled = false
      // ★ LAMBERT, LIKE EVERYTHING ELSE THAT READS RIGHT HERE. The file's material is physical
      // (Standard/Physical + KHR_materials_specular), and under the voxel sun — lights tuned for
      // this world's Lambert shaders — it blew out to paper through two tint passes. So the file's
      // material is replaced, not tuned: Lambert, vertex colours, the same dim emissive floor the
      // stick parts carry, a tint toward the ref's shadow tone. Metalness cannot exist on it — the
      // vessel card's law by construction, not by a slider set to zero.
      const old = Array.isArray(m.material) ? m.material : [m.material]
      m.material = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0xb8ab90, emissive: 0x1c1610, transparent: true })
      for (const mm of old) mm.dispose()
    })
  }
  const loadGlove = (url: string) => new Promise<boolean>(resolve => {
    new GLTFLoader().load(url, gltf => {
      const fist = gltf.scene.getObjectByName('glove_fist'), open = gltf.scene.getObjectByName('glove_open')
      if (!fist || !open) { resolve(false); return }
      adopt(fist); adopt(open)
      fist.position.set(0, 0, 0); open.position.set(0, 0, 0)
      arm.add(fist); arm.add(open)
      gloveFist = fist; gloveOpen = open
      const mirror = fist.clone(); mirror.scale.x = -1; mirror.name = 'glove_left'
      left.add(mirror)
      for (const p of stickParts) p.visible = false
      resolve(true)
    }, undefined, () => resolve(false))
  })

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
    // pose from the camera — the position exactly, the ORIENTATION on a spring. A floating hand
    // that snaps with the eye is a HUD element; one that swings a beat behind a head-turn and
    // settles is a thing in the world (the Rayman feel). Rate 14/s: a fast turn lags the hands a
    // few degrees and they catch up in ~0.2 s; standing still they sit exactly.
    group.position.copy(camera.position)
    if (Number.isNaN(last.x)) group.quaternion.copy(camera.quaternion)
    else group.quaternion.slerp(camera.quaternion, 1 - Math.exp(-LAG_RATE * dt))
    // speed from the camera's own travel — no coupling to the walker. Horizontal AND vertical: the
    // clock needs to know when the feet have left the ground (a jump is not a run).
    let speed = 0, vy = 0
    if (Number.isFinite(last.x) && dt > 0) {
      speed = Math.hypot(camera.position.x - last.x, camera.position.z - last.z) / dt
      vy = (camera.position.y - last.y) / dt
    }
    if (speed > 40 || Math.abs(vy) > 40) { speed = 0; vy = 0 }   // a teleport is not a sprint
    last.copy(camera.position)
    const pv = handsTune.preview
    const showHeld = (!sig.family && !!sig.held) || pv === 'present'
    if (pv === 'cast' && performance.now() - sig.castAt > 900) sig.castAt = performance.now()   // a cast every 0.9 s
    const input: HandsInput = {
      t, now: performance.now(), speed, vy, breaking: sig.breaking || pv === 'reach', placeAt: sig.placeAt, castAt: sig.castAt, hidden: sig.hidden,
      airborne: sig.airborne, sliding: sig.sliding, crouching: sig.crouching, climbing: sig.climbing,
      wallCatch: sig.wallCatch, hanging: sig.hanging, mantle: sig.mantle, swimming: sig.swimming,
      landAt: sig.landAt, landVy: sig.landVy, holding: showHeld, tool: !!sig.family && pv !== 'reach',
    }
    const pose = stepHands(state, input, dt)
    sig.last = pose
    const k = fovScale(camera)
    if (tuneSeen.v !== handsTune.version || Math.abs(k - tuneSeen.k) > 1e-4) reaim(k)
    const tn = handsTune.tune
    // Offsets move the whole arm in CAMERA space (the pivot); the pitch bends at the wrist.
    armPivot.position.set(tn.wx + pose.dx, tn.wy + pose.dy, (tn.wz + pose.dz) * k)
    arm.rotation.x = pose.pitch
    arm.rotation.z = pose.roll   // π = palm up, presenting the held thing
    leftPivot.position.y = tn.wy - LEFT_DROP + pose.left * LEFT_UP + pose.leftDy
    left.rotation.x = pose.leftPitch
    leftPivot.visible = pose.left > 0.01
    // the modelled glove: OPEN for a reach, a presented palm, a cast's aim, a hand on a wall;
    // a fist for everything else. The pose clock says how open; the rig picks the mesh.
    if (gloveFist && gloveOpen) {
      const open = pose.open > 0.5
      gloveFist.visible = !open; gloveOpen.visible = open
    }
    // the focus in the fist — never in a reaching hand (a bare reach is the whole point of it)
    for (const [fam, g] of tools) g.visible = fam === sig.family && pose.open <= 0.5
    // ★ the held thing FLOATS over the open palm (Alex, 09-17: "an open palm with the hotbar item
    // floating above it"): the palm is up (roll π puts local −y skyward), the thing hovers a
    // finger's width over it, bobbing slowly and turning, and it fades in with the present pose.
    held.visible = showHeld && pose.open > 0.5
    if (held.visible) {
      const h = sig.held ?? { colour: 0x8b5a2b, piece: false }   // the preview presents a dirt-coloured block
      heldMat.color.setHex(h.colour)
      if (h.piece) held.scale.set(0.07, 0.022, 0.07); else held.scale.set(0.05, 0.05, 0.05)
      held.position.y = HELD_Y - Math.sin(t * 2.4) * 0.006
      held.rotation.y = t * 0.9
    }
    // the head's material is SHARED by every horn part, so the tier tint is one write, on change
    if (sig.tier !== lastTier) { lastTier = sig.tier; mat(COLOUR.horn).color.setHex(tierTint[Math.max(0, Math.min(3, sig.tier))]) }
  }

  return {
    group, sig, tick, loadGlove,
    dispose: () => {
      for (const g of [gloveFist, gloveOpen]) g?.traverse(m => { if (m instanceof THREE.Mesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()) } })
      cube.dispose(); sphere.dispose()
      for (const m of mats.values()) m.dispose()
      mats.clear()
      heldMat.dispose()
      ;(sentinel.material as THREE.Material).dispose()
    },
  }
}
