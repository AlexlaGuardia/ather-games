/**
 * THE HOLLOW BODY GUARD — that a Hollow in the world is a BODY, that it costs the GPU one geometry
 * no matter how many are alive, and that putting a body on it did not quietly restyle it.
 *
 * ★ The third one is the reason this file is worth its length. The material question (may a Hollow
 * carry `emissive` at all?) is an OPEN canon conflict, and a shape commit that also moved the look
 * would decide it by shipping. So the look is asserted to still be the shipped one, element by
 * element, and the assert fails if a future edit here starts inventing colour.
 *
 * Run: `npx tsx src/app/shimmer/voxel3d/hollow-body.test.ts`
 */
import * as THREE from 'three'
import { createHollowBody, updateHollowBody, disposeHollowBodies, BUCKETS } from './hollow-body'
import { hollowField, MAX_BLOB_R } from './hollow-pose'
import { createHollowMat, HOLLOW_LOOK, type HollowForm } from './hollow-look'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const FORMS: HollowForm[] = ['warden', 'stalker', 'caster']
const pivotOf = (b: THREE.Group) => b.children[0] as THREE.Group

// ── IT IS A BODY, WITH THE PARTS THE BODY PLAN NAMES ──────────────────────────────────────────
disposeHollowBodies()
const bodies = FORMS.map(createHollowBody)
ok(bodies.every((b, i) => pivotOf(b).children.length === hollowField(0, FORMS[i]).length),
  `★ every form draws one blob per anchor (${hollowField(0, 'warden').length} of them), not a single primitive`)
ok(bodies.every(b => b.children.length === 1 && pivotOf(b).name === 'hollowPivot'),
  'the pose pivot is the outer group\'s only child, so the host owns the outer transform alone')

// ── ⚠⚠ ONE GEOMETRY FOR THE WHOLE WORLD ───────────────────────────────────────────────────────
// A material per body is a shader program per body — the allocation that got this page blocked from
// WebGL on 2026-08-06, and twelve blobs each would be twelve programs per Hollow. Identity, not count.
const many = Array.from({ length: 24 }, (_, i) => createHollowBody(FORMS[i % 3]))
const geos = new Set<unknown>(); const mats = new Set<unknown>()
for (const b of [...bodies, ...many]) for (const m of pivotOf(b).children) {
  geos.add((m as THREE.Mesh).geometry); mats.add((m as THREE.Mesh).material)
}
ok(geos.size === 1, `★★ 27 bodies × 12 blobs share exactly ONE geometry (saw ${geos.size})`)
ok(mats.size <= FORMS.length * BUCKETS,
  `★★ materials are pooled to at most ${FORMS.length * BUCKETS} (3 forms × ${BUCKETS} buckets), saw ${mats.size} — never one per body`)

// ── ★★ THE SHAPE CHANGED; THE LOOK DID NOT ────────────────────────────────────────────────────
// The emissive question is Alex's and Magii's. This commit must not answer it.
const shipped = createHollowMat()
for (const f of FORMS) {
  const body = createHollowBody(f)
  const used = pivotOf(body).children.map(m => (m as THREE.Mesh).material as THREE.MeshLambertMaterial)
  ok(used.every(m => m.color.getHex() === HOLLOW_LOOK.colour[f]),
    `★★ a ${f}'s blobs wear the SHIPPED colour, not one this module chose`)
  ok(used.every(m => m.emissiveIntensity === shipped[f].emissiveIntensity),
    `★★ a ${f} carries the shipped selfLight unchanged — the body commit does not rule the emissive gap`)
  ok(used.every(m => m.opacity <= shipped[f].opacity + 1e-9),
    `a ${f}'s blobs never exceed the shipped opacity; alpha only ever varies DOWN from it`)
}

// ── THE HOST OWNS THE OUTER TRANSFORM ─────────────────────────────────────────────────────────
// The world sets world position, facing, and the spawn scale-up ("rises from nothing"). If this
// module wrote the outer group too, both would write one transform and the Hollow would stutter.
const host = createHollowBody('stalker')
host.position.set(12, 34, 56); host.rotation.y = 1.1; host.scale.setScalar(0.01)
updateHollowBody(host, 2.7, 'stalker', 1)
ok(host.position.x === 12 && host.position.y === 34 && host.position.z === 56,
  '★★ updating the pose does NOT move the body in the world — the host keeps its position')
ok(host.rotation.y === 1.1 && host.scale.x === 0.01,
  '★★ nor its facing, nor the spawn scale-up it is in the middle of')
ok(pivotOf(host).rotation.x !== 0 || pivotOf(host).position.y !== 0,
  'but the pose DID write the pivot, so the assert above is not passing because nothing ran')

// ── NO DEGENERATE TRANSFORM, EVER ─────────────────────────────────────────────────────────────
// A zero scale is a singular matrix: three.js warns, and a normal can go NaN.
let minScale = Infinity, maxScale = 0
for (const f of FORMS) {
  const b = createHollowBody(f)
  for (let i = 0; i < 90; i++) {
    updateHollowBody(b, i * 0.11, f, 1)
    for (const m of pivotOf(b).children) { minScale = Math.min(minScale, m.scale.x); maxScale = Math.max(maxScale, m.scale.x) }
  }
}
ok(minScale > 0, `no blob is ever scaled to zero (min ${minScale.toFixed(4)})`)
ok(maxScale <= MAX_BLOB_R, `★ and none grows past the body-plan ceiling ${MAX_BLOB_R} (max ${maxScale.toFixed(3)})`)

// ── DISPOSAL IS IDEMPOTENT AND REBUILDS ───────────────────────────────────────────────────────
disposeHollowBodies(); disposeHollowBodies()
ok(pivotOf(createHollowBody('warden')).children.length > 0,
  'the shared set rebuilds lazily after disposal, so unmount/remount does not draw an empty Hollow')

console.log(`   ${FORMS.length} forms · ${BUCKETS} alpha buckets`)
console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
