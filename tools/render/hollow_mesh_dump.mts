/**
 * Dump the MODELLED Hollow as world-space triangles, posed, skinned — the input to a silhouette.
 *
 * ★ WHY (2026-09-06, sprites lane). Alex looked at an evening of surfacing work and said *"it still
 * looks the same."* Every instrument in the tree measured whether the surfacing was correct and none
 * of them could answer *is it a good shape*, which is the only question that was being asked. A
 * picture answers it in one frame, and it answers it BEFORE a deploy rather than after.
 *
 * ⚠ SKINNED THROUGH `applyBoneTransform`, never by reading the bind-pose buffer. The bind buffer is
 * the body standing at attention; what a player meets is the body mid-stride, and those differ by
 * exactly the thing this session built. Reading the buffer would be a picture of the wrong pose,
 * taken with total confidence.
 *
 * Run: npx tsx tools/render/hollow_mesh_dump.mts <form> <t> out.json
 */
import * as THREE from 'three'
import { writeFileSync } from 'node:fs'
import { createHollowMeshBody, updateHollowMeshBody, SKIN } from '../../src/app/shimmer/voxel3d/hollow-mesh'
import type { HollowForm } from '../../src/app/shimmer/voxel3d/hollow-look'

const form = (process.argv[2] ?? 'warden') as HollowForm
const t = Number(process.argv[3] ?? 0)
const out = process.argv[4] ?? 'mesh.json'

const body = createHollowMeshBody(form)
updateHollowMeshBody(body, t, form, 1)
body.updateMatrixWorld(true)

const skin = body.getObjectByName(SKIN) as THREE.SkinnedMesh
const pos = skin.geometry.getAttribute('position') as THREE.BufferAttribute
const idx = skin.geometry.getIndex()!
const v = new THREE.Vector3()
const verts: number[] = []
for (let i = 0; i < pos.count; i++) {
  skin.applyBoneTransform(i, v.fromBufferAttribute(pos, i))
  verts.push(v.x, v.y, v.z)
}
writeFileSync(out, JSON.stringify({ form, t, verts, index: Array.from(idx.array) }))
console.log(`${form} t=${t} → ${pos.count} verts, ${idx.count / 3} tris → ${out}`)
