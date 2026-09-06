/**
 * A HOLLOW AS ONE FUSED SURFACE — the body the blob substrate was standing in for.
 *
 * ★★★ WHY (2026-09-05, sprites lane). Alex, on the bone rig live: *"its still too bulky i dont think
 * the blobs are the play."* Two proportion passes moved it barely at all, and the still-renderer
 * said why in one frame: drawing each blob as its own ellipsoid means every one carries its own
 * OUTLINE, so a limb reads as beads and a joint reads as a crease. No tuning removes that — it is
 * what separate surfaces look like. It is also where the bulk came from: eighteen overlapping
 * silhouettes each adding width nothing asked for.
 *
 * An implicit field has no separate surfaces. The same anchors become sources in one scalar field,
 * and the isosurface through it is a single continuous skin. ⚠ Which is the brief rather than a
 * preference: *"Edges never resolve. Silhouette readable at distance and unreliable up close"* is
 * TRUE BY CONSTRUCTION of a fused field, and *"it sags, sheds, drips and re-gathers"* is simply what
 * a field does when its sources move — where spheres could only ever fake it by fading, which is the
 * ghost Alex had already thrown out.
 *
 * ── THE POSE COMES FROM THE RIG, NOT FROM A SECOND DERIVATION ─────────────────────────────────
 * ⚠⚠ This module does NOT re-derive where a blob is. It drives the real `hollow-body` rig — hidden,
 * never rendered — and reads each blob's WORLD matrix. So the walk, the lean, the head tilt, the
 * shed and the eleven bones are the ones the guarded code produces, and a fused Hollow cannot drift
 * from a boned one. Re-deriving the anchor positions here would be a hand-kept mirror of another
 * module's geometry, which agrees with its source right up until somebody edits one of them
 * (PATTERNS 2026-08-22).
 *
 * ── ELLIPSOIDS BECOME SHORT CHAINS OF BALLS, AND THAT IS A REAL APPROXIMATION ─────────────────
 * `MarchingCubes.addBall` is isotropic; `Blob.s` is not. A stretched mass is emitted as a few balls
 * spaced along its own long axis, which is the union the stretch describes. It is an approximation
 * and it is stated here rather than hidden: the guard asserts the emitted chain spans the blob's
 * real extent, so the approximation cannot silently become a different body.
 */
import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { createHollowBody, updateHollowBody } from './hollow-body'
import { createHollowMat, type HollowForm } from './hollow-look'

/**
 * Grid resolution of the field. ⚠ THE COST IS CUBIC: 32 is 32,768 cells re-evaluated per update, 48
 * would be 110,592. This is the dial to reach for when a crowd of Hollows costs frames, and it is
 * the honest trade against a sphere body being nearly free.
 */
export const META_RES = 32

/**
 * The cube the field is evaluated in, in body units.
 *
 * ⚠⚠ IT HAS TO COVER A FLOATING CASTER, WHICH THE FIRST CUT DID NOT (2026-09-05). At centre 0.86 /
 * box 2.4 the cube topped out at y 2.06, and a caster's head sits near 2.23 — it mapped to a
 * normalised 1.07 and was simply never evaluated. That is why the caster surfaced 0.64 of its own
 * height while every other number looked right: a source outside the grid is not an error, it is an
 * absence. Found by the `outside` counter, which exists for exactly this and nothing else could see.
 */
export const META_BOX = 2.7
const META_CENTRE = new THREE.Vector3(0, 1.05, 0)

/**
 * Field falloff. `addBall` solves radius^2 = strength / subtract, so a ball of normalised radius r
 * needs strength = SUBTRACT * r^2. Raising SUBTRACT tightens every source and lets limbs separate;
 * lowering it fuses them into one heavy mass — which IS the density axis canon rules, as one number.
 */
const SUBTRACT = 12

/** Extra reach on each source, so neighbours actually merge instead of merely touching. */
const FUSE: Record<HollowForm, number> = { warden: 1.55, stalker: 1.55, caster: 1.28 }

/**
 * A floor under a source's reach, in body units.
 *
 * ★★★ WHY IT IS NOT JUST A BIGGER `FUSE` (2026-09-05). At FUSE 1.28 the body reached full height and
 * the LEGS still surfaced as separate lumps — the bead problem returning through the thinnest parts,
 * because fusion depends on a source's own girth and a shin is half a chest. Raising FUSE alone fixes
 * the legs by fattening EVERYTHING, which is the bulk Alex threw out in the first place. A floor
 * couples only the thin parts: a shin merges with its knee while the trunk keeps the girth the field
 * gives it. ⚠ The limb still reads thinner than the trunk — this sets the minimum REACH of a source,
 * not its size, so the surface stays where the geometry puts it.
 *
 * ⚠⚠ AND NEITHER IT NOR THE WIDER FUSE APPLIES TO A CASTER, which the guard caught within a minute
 * of each landing: with the floor on, and again with FUSE raised for everyone, the caster grew FEET
 * (foot 0.95 against a surface floor of 0.87) and canon is explicit that it has none — it *"has not gathered enough matter to be pulled down"* and floats.
 * The floor exists to fuse a body that gathered enough to HAVE limbs. A caster is the form that did
 * not, so exempting it is the density axis rather than a special case.
 */
const MIN_REACH = 0.135

const NAME = 'hollowField'
let MATS: Record<HollowForm, THREE.MeshStandardMaterial> | null = null

/**
 * ⚠ ONE MATERIAL PER FORM FOR THE WHOLE GAME, not one per body — the allocation that got this page
 * blocked from WebGL on 2026-08-06. Cloned from the shipped factory so a fused Hollow and a boned
 * one cannot disagree about the look.
 */
function mats(): Record<HollowForm, THREE.MeshStandardMaterial> {
  if (!MATS) MATS = createHollowMat()
  return MATS
}

export function disposeHollowMetas(): void {
  if (MATS) for (const f of ['warden', 'stalker', 'caster'] as const) MATS[f].dispose()
  MATS = null
}

/**
 * One fused Hollow: an outer group the world places, a hidden rig that does the posing, and the
 * surface. The outer group is never written by `updateHollowMeta`, so the host keeps owning world
 * position, facing and the spawn scale-up — the same split `hollow-body` documents.
 */
export function createHollowMeta(form: HollowForm): THREE.Group {
  const outer = new THREE.Group()

  // The rig poses; it never draws. `visible = false` on the parent is enough — three.js skips the
  // whole subtree at render, and `updateMatrixWorld(true)` still runs it, which is what we need.
  const rig = createHollowBody(form)
  rig.name = 'hollowPoseRig'
  rig.visible = false
  outer.add(rig)

  const mc = new MarchingCubes(META_RES, mats()[form], true, false, 30000)
  mc.name = NAME
  mc.position.copy(META_CENTRE)
  mc.scale.setScalar(META_BOX / 2)      // the generated geometry spans -1..1 in its own space
  mc.isolation = 80
  outer.add(mc)
  return outer
}

/**
 * What one update actually fed the field. Returned rather than logged, because the page and the
 * guard have to be able to compare the SAME numbers — the fused body surfaces ~936 vertices in the
 * browser against 2,016-3,060 headless at identical settings, and no page-side probe can reach an
 * R3F scene to find out why. This splits the question in one reading: if the page emits the same
 * balls as the guard, the fault is the field or the mapping; if it emits fewer, the RIG is posing
 * differently and the surface is innocent.
 */
export interface MetaStats {
  /** Blob meshes the rig offered. 18 unless a part has been shed to nothing. */
  blobs: number
  /** Balls actually added to the field — more than `blobs`, since a stretched mass emits a chain. */
  balls: number
  /** Y extent of the ball centres, in the BODY's frame. A body stands 0..~1.75 at form scale 1. */
  loY: number
  hiY: number
  /** Balls that mapped outside the unit cube. Any at all means the body is partly off its own grid. */
  outside: number
}

/** Advance one fused body to time `t`. Writes the hidden rig and the surface, never the outer group. */
export function updateHollowMeta(body: THREE.Group, t: number, form: HollowForm, speed = 0): MetaStats | null {
  const rig = body.children.find(c => c.name === 'hollowPoseRig') as THREE.Group | undefined
  const mc = body.children.find(c => c.name === NAME) as InstanceType<typeof MarchingCubes> | undefined
  if (!rig || !mc) return null

  updateHollowBody(rig, t, form, speed)
  body.updateMatrixWorld(true)
  mc.reset()

  // ★★★ IN THE BODY'S OWN FRAME, NOT IN THE WORLD'S — and this cost a deploy that drew NOTHING.
  // `META_CENTRE` and `META_BOX` describe the cube in the OUTER GROUP's coordinates, so ball
  // positions have to be expressed there too. Reading `matrixWorld` gave world coordinates, which
  // are identical to local ones only when the body has no parent — exactly the case the guard
  // built. The bench mounts it under a group at x = -4, so every ball mapped to -8/2.4 + 0.5 and
  // landed outside the cube: zero sources, zero surface, no error, and a clean console.
  // ⚠ THE GUARD MEASURED A BODY AT THE ORIGIN AND THE GAME NEVER PUTS ONE THERE. The world-frame
  // reading was not wrong about anything; it was a reading of the wrong frame (PATTERNS 08-30), and
  // the only thing that distinguishes the two is a parent — which a test has to be made to have.
  const toLocal = new THREE.Matrix4().copy(body.matrixWorld).invert()
  const local = new THREE.Matrix4()
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3()
  const axis = new THREE.Vector3()
  let blobs = 0, balls = 0, outside = 0, loY = Infinity, hiY = -Infinity
  rig.traverse(o => {
    if (!(o as THREE.Mesh).isMesh) return
    local.multiplyMatrices(toLocal, o.matrixWorld)
    local.decompose(p, q, sc)
    // A shed piece has ~zero radius. Emitting it would put a bead back exactly where the field is
    // supposed to have let go of one.
    const maxA = Math.max(sc.x, sc.y, sc.z)
    if (maxA <= 2e-3) return
    blobs++
    if (p.y < loY) loY = p.y
    if (p.y > hiY) hiY = p.y

    // The long axis in the blob's OWN frame, and the girth across the other two.
    const longest = sc.x >= sc.y && sc.x >= sc.z ? 0 : sc.y >= sc.z ? 1 : 2
    const girth = (sc.x + sc.y + sc.z - maxA) / 2
    axis.set(longest === 0 ? 1 : 0, longest === 1 ? 1 : 0, longest === 2 ? 1 : 0).applyQuaternion(q)

    const reach = Math.max(0, maxA - girth)            // how far the stretch pushes past a sphere
    const n = reach < girth * 0.35 ? 1 : reach < girth ? 2 : 3
    const fuse = girth * FUSE[form]
    const rn = (form === 'caster' ? fuse : Math.max(fuse, MIN_REACH)) / META_BOX
    const strength = SUBTRACT * rn * rn
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0 : (i / (n - 1)) * 2 - 1     // -1 .. +1 along the long axis
      const x = p.x + axis.x * reach * f - META_CENTRE.x
      const y = p.y + axis.y * reach * f - META_CENTRE.y
      const z = p.z + axis.z * reach * f - META_CENTRE.z
      // Normalised 0..1 across the box: the generated geometry spans -1..1, so 0.5 is the centre.
      const nx = x / META_BOX + 0.5, ny = y / META_BOX + 0.5, nz = z / META_BOX + 0.5
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1 || nz < 0 || nz > 1) outside++
      mc.addBall(nx, ny, nz, strength, SUBTRACT)
      balls++
    }
  })
  mc.update()
  return { blobs, balls, outside, loY: blobs ? loY : 0, hiY: blobs ? hiY : 0 }
}
