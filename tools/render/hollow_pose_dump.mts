/**
 * Dump a POSED Hollow — the body as the scene graph actually holds it — for the silhouette renderer.
 *
 * ★★★ WHY THIS EXISTS AND WHY IT IS NOT `hollow_field_dump` WITH AN ARGUMENT (2026-09-05, sprites).
 * `hollowField` gives rest positions plus sag. It knows nothing about the WALK: the stride, the lean
 * and every joint angle live in `hollowPose` and reach the body only through the bone hierarchy in
 * `hollow-body.ts`. So a still built from the field alone cannot show a Hollow leaning into a step,
 * and judging "taut, thrown forward" from one would be a reading taken one layer away from where the
 * game takes it — this file's oldest mistake, in an instrument written to avoid it.
 *
 * ⚠ IT DRIVES THE SHIPPED RIG, NOT A COPY OF IT. `createHollowBody` + `updateHollowBody`, then the
 * WORLD matrix of every blob is decomposed. Rotation and per-axis scale come out of three.js, so the
 * picture cannot drift from the body the game poses — the alternative (re-deriving bone transforms
 * in the renderer) is a hand-kept mirror, and a mirror agrees with its source right up until someone
 * edits one of them (PATTERNS 2026-08-22).
 *
 * Run: npx tsx tools/render/hollow_pose_dump.mts <form> <t> <speed> > posed.json
 */
import * as THREE from 'three'
import { createHollowBody, updateHollowBody } from '../../src/app/shimmer/voxel3d/hollow-body'
import type { HollowForm } from '../../src/app/shimmer/voxel3d/hollow-look'

const form = (process.argv[2] ?? 'stalker') as HollowForm
const t = Number(process.argv[3] ?? 0)
const speed = Number(process.argv[4] ?? 0)

const body = createHollowBody(form)
updateHollowBody(body, t, form, speed)
body.updateMatrixWorld(true)

const blobs: unknown[] = []
const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3()
body.traverse(o => {
  if (!(o as THREE.Mesh).isMesh) return
  o.matrixWorld.decompose(p, q, sc)
  // The mesh is a UNIT sphere, so its world scale IS the ellipsoid's three semi-axes.
  blobs.push({ anchor: o.name, x: p.x, y: p.y, z: p.z, q: [q.x, q.y, q.z, q.w], sa: [sc.x, sc.y, sc.z] })
})
process.stdout.write(JSON.stringify({ form, t, speed, posed: true, blobs }))
