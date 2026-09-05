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
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { createHollowBody, updateHollowBody, disposeHollowBodies, BUCKETS } from './hollow-body'
import { hollowField, hollowPose, MAX_BLOB_R, HOLLOW_STRIDE_S } from './hollow-pose'
import { createHollowMat, HOLLOW_LOOK, type HollowForm } from './hollow-look'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const FORMS: HollowForm[] = ['warden', 'stalker', 'caster']
const pivotOf = (b: THREE.Group) => b.children[0] as THREE.Group
/** Blobs hang on BONES now, at varying depth, so collect them by type rather than by position. */
const blobsOf = (b: THREE.Group): THREE.Mesh[] => {
  const out: THREE.Mesh[] = []
  b.traverse(o => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh) })
  return out
}
const boneOf = (b: THREE.Group, n: string) => b.getObjectByName(n) as THREE.Group | null

// ── IT IS A BODY, WITH THE PARTS THE BODY PLAN NAMES ──────────────────────────────────────────
disposeHollowBodies()
const bodies = FORMS.map(createHollowBody)
ok(bodies.every((b, i) => blobsOf(b).length === hollowField(0, FORMS[i]).length),
  `★ every form draws one blob per anchor (${hollowField(0, 'warden').length} of them), not a single primitive`)
ok(bodies.every(b => b.children.length === 1 && pivotOf(b).name === 'hollowPivot'),
  'the pose pivot is the outer group\'s only child, so the host owns the outer transform alone')

// ── THE SKELETON IS PARENTED, WHICH IS WHAT MAKES A LIMB BEND INSTEAD OF STRETCH ───────────────
const rig = createHollowBody('warden')
ok(['root', 'chest', 'head', 'armL', 'foreL', 'thighL', 'shinL'].every(n => boneOf(rig, n)),
  'every bone in the skeleton exists on the body')
ok(boneOf(rig, 'shinL')!.parent === boneOf(rig, 'thighL'),
  '★ the shin hangs off the THIGH, so swinging the thigh carries the whole lower leg with it')
ok(boneOf(rig, 'foreL')!.parent === boneOf(rig, 'armL'),
  '★ the forearm hangs off the upper arm — a chain, not two parts that happen to sit near each other')
ok(['kneeL', 'shinL', 'footL'].every(a =>
    blobsOf(rig).find(m => m.name === a)!.parent === boneOf(rig, 'shinL')),
  '★★ the knee, shin and foot all ride ONE bone, so the lower leg moves as a piece')

// ── ⚠⚠ ONE GEOMETRY FOR THE WHOLE WORLD ───────────────────────────────────────────────────────
// A material per body is a shader program per body — the allocation that got this page blocked from
// WebGL on 2026-08-06, and twelve blobs each would be twelve programs per Hollow. Identity, not count.
const many = Array.from({ length: 24 }, (_, i) => createHollowBody(FORMS[i % 3]))
const geos = new Set<unknown>(); const mats = new Set<unknown>()
for (const b of [...bodies, ...many]) for (const m of blobsOf(b)) {
  geos.add(m.geometry); mats.add(m.material)
}
ok(geos.size === 1, `★★ 27 bodies × 12 blobs share exactly ONE geometry (saw ${geos.size})`)
ok(mats.size <= FORMS.length * BUCKETS,
  `★★ materials are pooled to at most ${FORMS.length * BUCKETS} (3 forms × ${BUCKETS} buckets), saw ${mats.size} — never one per body`)

// ── ★★ THE SHAPE CHANGED; THE LOOK DID NOT ────────────────────────────────────────────────────
// The emissive question is Alex's and Magii's. This commit must not answer it.
const shipped = createHollowMat()
for (const f of FORMS) {
  const body = createHollowBody(f)
  const used = blobsOf(body).map(m => m.material as THREE.MeshLambertMaterial)
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
ok(pivotOf(host).position.y !== 0 || boneOf(host, 'root')!.rotation.x !== 0,
  'but the pose DID write the rig, so the assert above is not passing because nothing ran')

// ── NO DEGENERATE TRANSFORM, EVER ─────────────────────────────────────────────────────────────
// A zero scale is a singular matrix: three.js warns, and a normal can go NaN.
let minScale = Infinity, maxScale = 0
for (const f of FORMS) {
  const b = createHollowBody(f)
  for (let i = 0; i < 90; i++) {
    updateHollowBody(b, i * 0.11, f, 1)
    for (const m of blobsOf(b)) { minScale = Math.min(minScale, m.scale.x); maxScale = Math.max(maxScale, m.scale.x) }
  }
}
ok(minScale > 0, `no blob is ever scaled to zero (min ${minScale.toFixed(4)})`)
ok(maxScale <= MAX_BLOB_R, `★ and none grows past the body-plan ceiling ${MAX_BLOB_R} (max ${maxScale.toFixed(3)})`)

// ── DISPOSAL IS IDEMPOTENT AND REBUILDS ───────────────────────────────────────────────────────
disposeHollowBodies(); disposeHollowBodies()
ok(blobsOf(createHollowBody('warden')).length > 0,
  'the shared set rebuilds lazily after disposal, so unmount/remount does not draw an empty Hollow')

// ── ★★★ THE WALK REACHES THE RIG ──────────────────────────────────────────────────────────────
// THE ASSERT THAT DID NOT EXIST, AND ITS ABSENCE COST A DAY. `hollowPose` has computed a full walk
// cycle since 09-04 — thigh swing, knees folding one way, arms in opposition, head tilt — and
// `updateHollowBody` read exactly TWO of its nine fields. Seven angles were computed every frame
// and dropped on the floor, so a Hollow never walked: it was a fixed cluster of spheres that
// bobbed. Alex called it from the picture ("this bubble body isnt working") before anyone had
// measured it, and two passes of geometry work went past it without noticing.
//
// ⚠⚠ `hollow-pose.test.ts` WAS GREEN THROUGHOUT — 34 asserts, every one true. Knees never bend
// backwards, legs swing in opposition, a caster does not stride. All correct, all about numbers
// that reached nothing. A GUARD ON A PRODUCER SAYS NOTHING ABOUT WHETHER A CONSUMER EXISTS, and no
// assert inside the pose module could ever have caught this — it is a claim about the SCENE GRAPH.
const walker = createHollowBody('stalker')
const seen = new Map<string, Set<number>>()
for (let i = 0; i < 48; i++) {
  updateHollowBody(walker, (i / 48) * HOLLOW_STRIDE_S * 2, 'stalker', 1)
  // ⚠ `root` IS DELIBERATELY NOT IN THIS LIST, and the guard is what taught me why. It carries
  // `lean`, which is a function of SPEED and not of time — a body leans into a walk and holds the
  // lean for the whole stride. It came back "frozen" on the first run and that reading was correct
  // about the number and wrong about the meaning. It gets its own assert below, on the axis it
  // actually moves along. A bone that cannot vary over the sampled window is not evidence of a
  // disconnected rig; it is evidence the window was the wrong one.
  for (const n of ['head', 'armL', 'armR', 'foreL', 'foreR', 'thighL', 'thighR', 'shinL', 'shinR']) {
    const g = boneOf(walker, n)!
    if (!seen.has(n)) seen.set(n, new Set())
    seen.get(n)!.add(+(g.rotation.x + g.rotation.z).toFixed(6))
  }
}
const still = [...seen.entries()].filter(([, v]) => v.size < 2).map(([k]) => k)
ok(still.length === 0,
  `★★★ every bone MOVES across a stride — the pose reaches the scene graph (frozen: ${still.join(', ') || 'none'})`)

// ★ `root` on its own axis: it leans INTO a walk and stands upright when still.
const standing = createHollowBody('stalker')
updateHollowBody(standing, 1.0, 'stalker', 0)
const leanStill = boneOf(standing, 'root')!.rotation.x
updateHollowBody(standing, 1.0, 'stalker', 1)
const leanWalk = boneOf(standing, 'root')!.rotation.x
ok(leanStill === 0 && leanWalk > 0,
  '★★ the body leans into the walk and stands straight when still — root moves with SPEED, not time')

// ★ And it moves by the RIGHT amounts, not merely by some amount — a rig wired to the wrong field
// would still wiggle. Compared against the pose the host would have read at the same instant.
const at = HOLLOW_STRIDE_S * 0.3
updateHollowBody(walker, at, 'stalker', 1)
const want = hollowPose(at, 'stalker', 1)
ok(Math.abs(boneOf(walker, 'thighL')!.rotation.x - want.thighL) < 1e-9
   && Math.abs(boneOf(walker, 'armR')!.rotation.x - want.armR) < 1e-9
   && Math.abs(boneOf(walker, 'shinR')!.rotation.x - want.shinR) < 1e-9
   && Math.abs(boneOf(walker, 'head')!.rotation.z - want.headTilt) < 1e-9,
  '★★ each bone carries ITS OWN angle from the pose — not another joint\'s, and not an approximation')

// ★ A caster never gathered legs, so its leg bones must stay still even at speed. The same rule the
// pose module asserts, checked one layer out where the drawing actually happens.
const ghost = createHollowBody('caster')
const legAngles = new Set<number>()
for (let i = 0; i < 24; i++) {
  updateHollowBody(ghost, (i / 24) * HOLLOW_STRIDE_S, 'caster', 1)
  legAngles.add(+boneOf(ghost, 'thighL')!.rotation.x.toFixed(9))
}
ok(legAngles.size === 1 && [...legAngles][0] === 0,
  '★★ a caster\'s legs never swing in the RIG either — it floats, it does not perform a walk')

// ── ★★★ AND SOMETHING DRAWS IT ────────────────────────────────────────────────────────────────
// The reason this section exists, and it is the sharpest thing this file learned (2026-09-05):
// every assert above passed at 40-odd green while `hollow-body.ts` was imported by NOTHING BUT THIS
// FILE. The bench drew `HollowDoll`, `VoxelWorld` drew an icosahedron, and a deploy would have
// shipped 240 lines of skeleton and rendered none of it. A GUARD ON A PRODUCER SAYS NOTHING ABOUT
// WHETHER A CONSUMER EXISTS — so the producer's own guard is where that has to be asserted.
//
// ⚠ READ THROUGH `codeOnly`. Both files below NAME these symbols in their prose, and a check that
// counted a comment would go green the day the code was deleted and the explanation left behind
// (PATTERNS 2026-08-22, documenting a marker created a marker).
{
  // ⚠ TWO READINGS OF EACH FILE, AND THE SPLIT IS LOAD-BEARING. `codeOnly` blanks STRING LITERALS
  // as well as comments, so an import PATH is invisible to it — a behaviour assert read through it,
  // an import assert read raw and anchored at line start, where no prose can reach (a comment cannot
  // begin with `import`). Reading the path through `codeOnly` fails green-side: the string is empty
  // whether or not the import is there.
  const rigRaw = readFileSync(new URL('./HollowRig.tsx', import.meta.url), 'utf8')
  const rig = codeOnly(rigRaw)
  ok(/^import [\s\S]{0,120}?from '\.\/hollow-body'$/m.test(rigRaw), 'a component imports the body module')
  ok(/createHollowBody\(/.test(rig), 'and builds a body from it')
  ok(/useFrame\([^)]*=>[\s\S]{0,220}?updateHollowBody\(/.test(rig),
    '★★ and drives it from a FRAME LOOP — a body built once and never updated does not walk')
  ok(/disposeHollowBodies\(/.test(rig), 'and releases the shared geometry + materials on unmount')

  // ★ And the component is MOUNTED. A consumer nothing renders is the same dead end one file out,
  // which is exactly how the rig sat unseen: `hollow-body` had a test, and the test was the consumer.
  const benchRaw = readFileSync(new URL('../dev/hollow/page.tsx', import.meta.url), 'utf8')
  const bench = codeOnly(benchRaw)
  ok(/<HollowRig\s/.test(bench), '★★ and a page MOUNTS that component — the rig is reachable by eye')
  ok(/^import \{ HollowRig \} from '\.\.\/\.\.\/voxel3d\/HollowRig'$/m.test(benchRaw),
    'from the bench, by import, not by copy')
}

console.log(`   ${FORMS.length} forms · ${BUCKETS} alpha buckets`)
console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
