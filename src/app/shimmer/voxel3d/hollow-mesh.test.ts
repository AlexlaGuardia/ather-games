/**
 * THE MODELLED-HOLLOW GUARD — that it is a FIGURE and not a pile, that the walk reaches the skin,
 * that the losing-itself is the solved field's and not a second invention, and that shaping a body
 * did not quietly restyle it.
 *
 * ★★★ THE FIRST SECTION IS THE POINT OF THE FILE, AND IT IS THE ASSERT NOTHING HAS EVER MADE.
 * Three surfaces were built over the eighteen spheres and every guard written for them measured
 * whether the SURFACING was correct — vertex counts, body height, anchors inside the evaluation
 * cube, mass conserved. All true. All green. Alex looked at the third one and said *"it still looks
 * the same"*, and he was right, because **nothing in the tree had ever asked whether the shape was
 * a body.** These asserts ask: is the widest part of it the shoulders, is there a waist, is there a
 * neck, does a leg taper, is there a calf behind the knee, does a foot run forward.
 *
 * ⚠⚠ AND EACH ONE IS RUN AGAINST THE BLOB FIELD AS A CONTROL. An assert that a body passes tells
 * you nothing on its own; the question is whether it could ever have failed. The blob field is the
 * shape these were written to distinguish, so it is measured with the SAME yardstick, and the guard
 * fails if the pile passes. A guard that cannot tell a figure from a pile is decoration
 * (PATTERNS 2026-08-31: what is the cheapest wrong answer that still satisfies this?).
 *
 * Run: `npx tsx src/app/shimmer/voxel3d/hollow-mesh.test.ts`
 */
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import {
  createHollowMeshBody, updateHollowMeshBody, disposeHollowMeshBody, disposeHollowMeshes,
  meshParts, meshStats, chainsFor, hasFeet, SKIN,
} from './hollow-mesh'
import { hollowField, REST, FORM_SCALE, DENSITY, type Anchor } from './hollow-pose'
import { BONE, boneName, type BoneName } from './hollow-body'
import { createHollowMat, HOLLOW_LOOK, type HollowForm } from './hollow-look'
import { codeOnly, noComments } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const FORMS: HollowForm[] = ['warden', 'stalker', 'caster']
const src = (f: string) => readFileSync(`src/app/shimmer/voxel3d/${f}`, 'utf8')

/* ── measurement, one yardstick, used on both shapes ──────────────────────────────────────────── */

interface Ring { y: number; cz: number; halfW: number; minZ: number; maxZ: number; halfD: number }

/**
 * Group one chain's rest vertices into rings by height and measure each.
 *
 * ⚠ ONLY THE NAMED CHAIN. Measuring "the torso" over every vertex measures a hand: the arms hang
 * from y 1.24 down past the waist at 0.79, and they are wider from the centre line than the waist
 * is. The first version of the shoulders-vs-waist assert did exactly that and passed on a shape
 * with no waist at all, because it was comparing a shoulder to a wrist.
 */
function ringsOf(body: THREE.Group, chainId: string): Ring[] {
  const parts = meshParts(body)
  if (!parts) return []
  const ci = parts.ids.indexOf(chainId)
  if (ci < 0) return []
  const by = new Map<number, { ys: number[]; xs: number[]; zs: number[] }>()
  for (let i = 0; i < parts.chain.length; i++) {
    // ⚠ BY THE BUILD'S OWN RING INDEX, never by height — a leg's rings are tilted, and grouping
    // those by y gives one group per vertex and a body that measures as having no ankle.
    if (parts.chain[i] !== ci || parts.ring[i] < 0) continue
    const k = parts.ring[i]
    if (!by.has(k)) by.set(k, { ys: [], xs: [], zs: [] })
    const g = by.get(k)!
    g.xs.push(parts.rest[i * 3]); g.ys.push(parts.rest[i * 3 + 1]); g.zs.push(parts.rest[i * 3 + 2])
  }
  return [...by.values()]
    .map(g => ({
      y: g.ys.reduce((a, b) => a + b, 0) / g.ys.length,
      cz: g.zs.reduce((a, b) => a + b, 0) / g.zs.length,
      halfW: Math.max(...g.xs.map(Math.abs)),
      halfD: (Math.max(...g.zs) - Math.min(...g.zs)) / 2,
      minZ: Math.min(...g.zs), maxZ: Math.max(...g.zs),
    }))
    .sort((a, b) => a.y - b.y)
}

/** The same half-width question asked of the blob field, so the two shapes are comparable. */
function blobHalfWidthAt(form: HollowForm, y: number, only: Anchor[]): number {
  let w = 0
  for (const b of hollowField(0, form)) {
    if (!only.includes(b.anchor)) continue
    const ry = b.r * b.s[1], rx = b.r * b.s[0]
    const dy = Math.abs(y - b.y)
    if (dy >= ry) continue
    w = Math.max(w, Math.abs(b.x) + rx * Math.sqrt(1 - (dy / ry) ** 2))
  }
  return w
}

const TRUNK_ANCHORS: Anchor[] = ['head', 'chest', 'gut', 'hip']

/* ── 1. IT IS A FIGURE, AND THE PILE IS NOT ───────────────────────────────────────────────────── */
{
  const body = createHollowMeshBody('warden')
  const scale = FORM_SCALE.warden
  const trunk = ringsOf(body, 'trunk')
  ok(trunk.length >= 10, `trunk resolves into rings (got ${trunk.length})`)

  const widest = trunk.reduce((a, b) => (b.halfW > a.halfW ? b : a))
  const shoulder = widest.halfW
  ok(widest.y / scale > 1.18 && widest.y / scale < 1.36,
    `★★ THE WIDEST PART OF THE BODY IS THE SHOULDER SHELF — y ${(widest.y / scale).toFixed(2)}, and a barrel or a ball has its widest point at its middle`)

  // ⚠ AGAINST THE RIBCAGE, NOT THE SHOULDER SHELF, and the mutation sweep is what said so. Most of
  // the shelf's width is its ELLIPSE (1.46 across) rather than its radius, so a trunk with the waist
  // widened all the way to the chest radius still measured under 85% of it — a barrel passed a
  // waist assert. A waist is narrower than the ribs above it; that is the sentence, so that is the
  // comparison.
  const chestW = trunk.reduce((a, b) => (Math.abs(b.y / scale - 1.19) < Math.abs(a.y / scale - 1.19) ? b : a)).halfW
  const waist = Math.min(...trunk.filter(r => r.y / scale > 0.72 && r.y / scale < 0.96).map(r => r.halfW))
  ok(waist < chestW * 0.78,
    `★★ THERE IS A WAIST — ${waist.toFixed(3)} against a ${chestW.toFixed(3)} ribcage (${(waist / chestW * 100).toFixed(0)}%, wanted under 78%)`)

  const neck = Math.min(...trunk.filter(r => r.y / scale > 1.33 && r.y / scale < 1.45).map(r => r.halfW))
  const neckRatio = neck / shoulder
  ok(neckRatio < 0.42,
    `★★★ THERE IS A NECK — ${(neckRatio * 100).toFixed(0)}% of the shoulder, wanted under 42%`)

  // ⚠⚠ THE CONTROL. The blob field is the shape this whole module exists to replace; if it passes
  // the same assert, the assert is not measuring anatomy and every green above is worthless.
  const bShoulder = blobHalfWidthAt('warden', 1.19 * scale, TRUNK_ANCHORS)
  const bNeck = blobHalfWidthAt('warden', 1.40 * scale, TRUNK_ANCHORS)
  ok(bShoulder > 0 && bNeck / bShoulder >= 0.42,
    `★★★ CONTROL — the BLOB body FAILS the neck assert (${(bNeck / bShoulder * 100).toFixed(0)}%): the yardstick can tell a figure from a pile. If this line ever passes trivially the anatomy asserts above have stopped discriminating`)

  const leg = ringsOf(body, 'legL')
  const thigh = leg.find(r => Math.abs(r.y / scale - 0.510) < 0.02)!
  const ankle = leg[0]
  ok(!!thigh && ankle.halfD / thigh.halfD < 0.55,
    `★★ THE LEG TAPERS — ankle ${(ankle.halfD / (thigh?.halfD ?? 1) * 100).toFixed(0)}% of the thigh, wanted under 55%`)
  const bThigh = hollowField(0, 'warden').find(b => b.anchor === 'thighL')!
  const bAnkle = hollowField(0, 'warden').find(b => b.anchor === 'footL')!
  ok((bAnkle.r * bAnkle.s[0]) / (bThigh.r * bThigh.s[0]) >= 0.55,
    `★★ CONTROL — the BLOB leg does NOT taper by this measure (${((bAnkle.r * bAnkle.s[0]) / (bThigh.r * bThigh.s[0]) * 100).toFixed(0)}%)`)

  const knee = leg.find(r => Math.abs(r.y / scale - 0.340) < 0.02)!
  const calf = leg.find(r => Math.abs(r.y / scale - 0.272) < 0.02)!
  ok(!!knee && !!calf && calf.minZ < knee.minZ - 0.005 * scale,
    `★ THERE IS A CALF BEHIND THE KNEE — calf reaches z ${calf?.minZ.toFixed(3)} against the knee's ${knee?.minZ.toFixed(3)}`)

  // ⚠ ON RING CENTRES, NOT RING EXTENTS. A ring's z EXTENT depends on the frame the loft chose for
  // it, and pulling the toe back under the ankle makes that frame degenerate — the ring turns to
  // face a new way and its extent grows, hiding the very shortening being tested. The mutation
  // "foot sits under the ankle" survived the extent version of both of these. The centres are the
  // modelled data; the extents are an artifact of how it was swept.
  const foot = ringsOf(body, 'footL')
  const toeZ = Math.max(...foot.map(r => r.cz)), heelZ = Math.min(...foot.map(r => r.cz))
  const footHigh = Math.max(...foot.map(r => r.y)) - Math.min(...foot.map(r => r.y))
  ok(toeZ - heelZ > 0.14 * scale && toeZ - heelZ > footHigh * 4,
    `★ THE FOOT IS A FOOT, NOT A BALL — ${(toeZ - heelZ).toFixed(3)} heel to toe against ${footHigh.toFixed(3)} of rise; plantigrade, heavy in the heel`)
  ok(toeZ > leg[0].cz + 0.09 * scale,
    `★ and it runs FORWARD of the ankle rather than sitting under it — toe centre z ${toeZ.toFixed(3)} against the ankle's ${leg[0].cz.toFixed(3)}`)

  disposeHollowMeshBody(body)
}

/* ── 2. IT STANDS WHERE THE OTHER BODY STANDS ─────────────────────────────────────────────────── */
for (const f of FORMS) {
  const body = createHollowMeshBody(f)
  const parts = meshParts(body)!
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < parts.rest.length; i += 3) { const y = parts.rest[i + 1]; if (y < lo) lo = y; if (y > hi) hi = y }

  const field = hollowField(0, f)
  const bHi = Math.max(...field.map(b => b.y + b.r * b.s[1]))
  ok(Math.abs(hi - bHi) / bHi < 0.10,
    `★ ${f} is the SAME CREATURE as the blob body — ${hi.toFixed(2)} tall against its ${bHi.toFixed(2)} (within 10%)`)

  if (hasFeet(f)) ok(lo >= -0.01 * FORM_SCALE[f] && lo <= 0.05 * FORM_SCALE[f],
    `★ ${f} stands ON the ground — lowest vertex ${lo.toFixed(3)}, and REST puts feet at y=0`)
  else ok(lo > 0.05 * FORM_SCALE[f],
    `★ the caster does not stand — its lowest vertex is ${lo.toFixed(3)}, off the floor, and it has no feet`)

  ok(Number.isFinite(lo) && Number.isFinite(hi), `${f} has no NaN in its rest positions`)
  disposeHollowMeshBody(body)
}

/* ── 3. THE DENSITY AXIS IS ONE AXIS, NOT THREE CREATURES ─────────────────────────────────────── */
{
  ok(hasFeet('warden') && hasFeet('stalker') && !hasFeet('caster'),
    "★ only the two that gathered enough have feet — the brief's sentence, as a predicate")
  ok(chainsFor('caster').length === chainsFor('warden').length - 2,
    '★ a caster is built from the same chains minus its feet, never from a different body plan')

  const ankleOf = (f: HollowForm) => {
    const b = createHollowMeshBody(f)
    const r = ringsOf(b, 'legL')[0].halfD / FORM_SCALE[f]
    disposeHollowMeshBody(b)
    return r
  }
  const [w, s, c] = [ankleOf('warden'), ankleOf('stalker'), ankleOf('caster')]
  // ⚠⚠ A MARGIN, NOT A BARE `>`, AND THE SWEEP IS WHY. Flattening `TRAIL` to zero makes all three
  // ankles the same modelled radius — and the three still came out ordered, by float noise in a
  // divide by three different `FORM_SCALE`s. A strict inequality between two quantities that are
  // EQUAL under the mutation is decided by dice, not by the code (PATTERNS 2026-08-22, the guard
  // too tight to resolve its own threshold). The real gaps are 26% and 44%.
  ok(w > s * 1.05 && s > c * 1.05,
    `★★ the legs TRAIL OFF by density and in the ruled order, by a margin — warden ${w.toFixed(4)} > stalker ${s.toFixed(4)} > caster ${c.toFixed(4)}`)
  ok(DENSITY.warden > DENSITY.stalker && DENSITY.stalker > DENSITY.caster,
    '★ and that order is `DENSITY`, derived, so the three cannot drift into three creature designs')
}

/* ── 4. THE SKIN IS BOUND, AND THE WALK REACHES IT ────────────────────────────────────────────── */
{
  const body = createHollowMeshBody('warden')
  const skin = body.getObjectByName(SKIN) as THREE.SkinnedMesh
  ok(!!skin && skin.isSkinnedMesh, 'the body carries a SkinnedMesh')
  const nBones = skin.skeleton.bones.length
  ok(nBones === Object.keys(BONE).length,
    `★ the skin is bound to the SAME eleven bones the blob rig builds (${nBones})`)

  const swAttr = skin.geometry.getAttribute('skinWeight')
  const siAttr = skin.geometry.getAttribute('skinIndex')
  let badW = 0, badI = 0
  const driven = new Set<number>()
  for (let i = 0; i < swAttr.count; i++) {
    const sum = swAttr.getX(i) + swAttr.getY(i) + swAttr.getZ(i) + swAttr.getW(i)
    if (Math.abs(sum - 1) > 1e-4) badW++
    for (const g of [[siAttr.getX(i), swAttr.getX(i)], [siAttr.getY(i), swAttr.getY(i)]]) {
      if (g[0] < 0 || g[0] >= nBones) badI++
      if (g[1] > 0.05) driven.add(g[0])
    }
  }
  ok(badW === 0, `every vertex's skin weights sum to 1 (${badW} did not)`)
  ok(badI === 0, `every skin index names a real bone (${badI} did not)`)
  // ★★ THE PRODUCER/CONSUMER ASSERT, AT THE SKIN LEVEL. Eleven bones that drive nothing is the
  // 09-05 failure exactly — nine pose fields computed, two read — one layer further out.
  ok(driven.size === nBones,
    `★★★ EVERY BONE ACTUALLY DRIVES SKIN — ${driven.size} of ${nBones}. A bone no vertex leans on is an angle computed and dropped on the floor`)

  // Rotate one bone and read the SKINNED position, not the bone's own transform.
  const bone = (n: BoneName) => body.getObjectByName(boneName(n)) as THREE.Bone
  const parts = meshParts(body)!
  const pick = (test: (x: number, y: number, z: number) => boolean) => {
    for (let i = 0; i < parts.chain.length; i++) {
      const x = parts.rest[i * 3], y = parts.rest[i * 3 + 1], z = parts.rest[i * 3 + 2]
      if (test(x, y, z)) return i
    }
    return -1
  }
  const shinV = pick((x, y) => x < -0.10 && y < 0.20 * FORM_SCALE.warden)
  const headV = pick((_x, y) => y > 1.55 * FORM_SCALE.warden)
  ok(shinV >= 0 && headV >= 0, 'a shin vertex and a head vertex exist to sample')

  const before = new THREE.Vector3(), after = new THREE.Vector3()
  const hBefore = new THREE.Vector3(), hAfter = new THREE.Vector3()
  body.updateMatrixWorld(true)
  skin.applyBoneTransform(shinV, before.fromBufferAttribute(skin.geometry.getAttribute('position') as THREE.BufferAttribute, shinV))
  skin.applyBoneTransform(headV, hBefore.fromBufferAttribute(skin.geometry.getAttribute('position') as THREE.BufferAttribute, headV))
  bone('thighL').rotation.x = 0.6
  body.updateMatrixWorld(true)
  skin.applyBoneTransform(shinV, after.fromBufferAttribute(skin.geometry.getAttribute('position') as THREE.BufferAttribute, shinV))
  skin.applyBoneTransform(headV, hAfter.fromBufferAttribute(skin.geometry.getAttribute('position') as THREE.BufferAttribute, headV))
  ok(before.distanceTo(after) > 0.02,
    `★★★ THE RIG REACHES THE SKIN — swinging the thigh moved a shin vertex ${before.distanceTo(after).toFixed(3)}`)
  ok(hBefore.distanceTo(hAfter) < 1e-6,
    '★★ and it moved ONLY what it should — the head did not follow the thigh, so the weights are not smeared over the whole body')
  bone('thighL').rotation.x = 0

  // The walk itself, through the shipped pose, at two times.
  updateHollowMeshBody(body, 0, 'warden', 1)
  const a = (Object.keys(BONE) as BoneName[]).map(n => bone(n).rotation.x)
  updateHollowMeshBody(body, 0.9, 'warden', 1)
  const b = (Object.keys(BONE) as BoneName[]).map(n => bone(n).rotation.x)
  ok(a.some((v, i) => Math.abs(v - b[i]) > 1e-4),
    '★★ walk-reaches-the-rig: the bones actually move between two times')
  disposeHollowMeshBody(body)
}

/* ── 5. IT IS VISIBLY LOSING ITSELF, AND FROM THE SOLVED FIELD ────────────────────────────────── */
{
  const body = createHollowMeshBody('stalker')
  const skin = body.getObjectByName(SKIN) as THREE.SkinnedMesh
  const attr = skin.geometry.getAttribute('position') as THREE.BufferAttribute
  updateHollowMeshBody(body, 0, 'stalker', 0.8)
  const t0 = Float32Array.from(attr.array as Float32Array)
  updateHollowMeshBody(body, 3.7, 'stalker', 0.8)
  const t1 = attr.array as Float32Array

  let moved = 0
  for (let i = 0; i < t0.length; i += 3) {
    if (Math.hypot(t1[i] - t0[i], t1[i + 1] - t0[i + 1], t1[i + 2] - t0[i + 2]) > 1e-4) moved++
  }
  ok(moved / (t0.length / 3) > 0.9,
    `★★★ THE SKIN GUTTERS — ${(moved / (t0.length / 3) * 100).toFixed(0)}% of vertices moved between two times. This is the half a rigid body cannot do, and the brief's single most important animation note`)
  ok(t1.every(v => Number.isFinite(v)), 'and every deformed vertex is finite')

  // ★★ AND IT IS THE SOLVED FIELD'S SAG, NOT A SECOND ONE. Each anchor's own drift between the two
  // times must agree in DIRECTION with the mean motion of the skin that leans on it. Averaging over
  // many vertices cancels the gutter noise and leaves the field's contribution.
  const f0 = hollowField(0, 'stalker'), f1 = hollowField(3.7, 'stalker')
  const parts = meshParts(body)!
  const sum = f0.map(() => ({ x: 0, y: 0, z: 0, n: 0 }))
  const prim = new Int32Array(parts.rest.length / 3)
  {
    // primary region = the nearest anchor, recomputed here rather than read from the module, so the
    // assert is not simply agreeing with the thing it is checking.
    const scale = FORM_SCALE.stalker
    for (let i = 0; i < prim.length; i++) {
      let best = 0, bd = Infinity
      for (let a = 0; a < f0.length; a++) {
        const [rx, ry, rz] = REST[f0[a].anchor]
        const d = (rx * scale - parts.rest[i * 3]) ** 2 + (ry * scale - parts.rest[i * 3 + 1]) ** 2 + (rz * scale - parts.rest[i * 3 + 2]) ** 2
        if (d < bd) { bd = d; best = a }
      }
      prim[i] = best
    }
  }
  for (let i = 0; i < prim.length; i++) {
    const g = sum[prim[i]]
    g.x += t1[i * 3] - t0[i * 3]; g.y += t1[i * 3 + 1] - t0[i * 3 + 1]; g.z += t1[i * 3 + 2] - t0[i * 3 + 2]; g.n++
  }
  let agree = 0, tested = 0
  for (let a = 0; a < f0.length; a++) {
    if (sum[a].n < 6) continue
    const dx = f1[a].x - f0[a].x, dy = f1[a].y - f0[a].y, dz = f1[a].z - f0[a].z
    if (Math.hypot(dx, dy, dz) < 1e-3) continue
    tested++
    if ((sum[a].x / sum[a].n) * dx + (sum[a].y / sum[a].n) * dy + (sum[a].z / sum[a].n) * dz > 0) agree++
  }
  ok(tested >= 8 && agree / tested >= 0.7,
    `★★★ THE SAG IS THE FIELD'S — ${agree}/${tested} anchors moved their own skin the way they moved themselves. A second hand-written sag law here would be the hand-kept mirror, and would drift the day the cohere loop is retuned`)

  // the field's ORDER is what `deform` indexes by, and nothing else states that
  ok(hollowField(2.3, 'stalker').map(b => b.anchor).join() === f0.map(b => b.anchor).join(),
    '⚠ `hollowField` returns its blobs in a stable anchor order — `deform` indexes the two by position')
  disposeHollowMeshBody(body)
}

/* ── 6. SHAPING A BODY DID NOT RESTYLE IT ─────────────────────────────────────────────────────── */
{
  const a = createHollowMeshBody('warden'), b = createHollowMeshBody('warden')
  const ma = (a.getObjectByName(SKIN) as THREE.SkinnedMesh).material as THREE.MeshStandardMaterial
  const mb = (b.getObjectByName(SKIN) as THREE.SkinnedMesh).material as THREE.MeshStandardMaterial
  ok(ma === mb,
    '⚠⚠ TWO BODIES SHARE ONE MATERIAL — a material per body is a shader program per body, which is the allocation that got this page blocked from WebGL on 2026-08-06')
  ok((a.getObjectByName(SKIN) as THREE.SkinnedMesh).geometry !==
     (b.getObjectByName(SKIN) as THREE.SkinnedMesh).geometry,
    '⚠ and two bodies do NOT share a geometry — this surface writes its own vertices every frame, so a shared buffer would make every Hollow wear one body\'s sag')

  const shipped = createHollowMat()
  for (const f of FORMS) {
    const body = createHollowMeshBody(f)
    const m = (body.getObjectByName(SKIN) as THREE.SkinnedMesh).material as THREE.MeshStandardMaterial
    ok(m.color.getHex() === shipped[f].color.getHex()
      && m.emissive.getHex() === shipped[f].emissive.getHex()
      && m.emissiveIntensity === shipped[f].emissiveIntensity
      && m.roughness === shipped[f].roughness && m.metalness === shipped[f].metalness
      && m.opacity === shipped[f].opacity && m.transparent === shipped[f].transparent,
      `★★★ ${f} wears the SHIPPED material, element by element. Whether a Hollow may carry emissive at all is an OPEN canon conflict; a SHAPE commit that also moved the look would decide it by shipping`)
    disposeHollowMeshBody(body)
  }
  for (const f of FORMS) shipped[f].dispose()
  ok(HOLLOW_LOOK.opacity.warden === 1, 'and the ruling of 09-05 still holds: the forms are solid')
  disposeHollowMeshBody(a); disposeHollowMeshBody(b)
  disposeHollowMeshes()
}

/* ── 7. IT HAS A CONSUMER, AND ONE WRITER FOR THE POSE ────────────────────────────────────────── */
{
  const host = codeOnly(src('HollowMesh.tsx'))
  ok(/createHollowMeshBody/.test(host) && /updateHollowMeshBody/.test(host),
    '★★★ the module HAS A HOST — a guard on a producer says nothing about whether a consumer exists (PATTERNS 2026-09-05), and this module shipped its host in its own commit')
  ok(/disposeHollowMeshBody/.test(host),
    '⚠ and the host releases the PER-BODY geometry, which the blob rig never had to')

  const page = codeOnly(readFileSync('src/app/shimmer/dev/hollow/page.tsx', 'utf8'))
  ok(/import \{ HollowMesh \}/.test(page) && /<HollowMesh/.test(page),
    "★★ and the BENCH mounts it — the chain module → host → page, all three links, because two of them were green while the third was missing on 09-05")
  // ⚠ `codeOnly` strips string contents, and a TS string-literal type is a string to it — so the
  // default-surface claim has to be read with comments stripped instead, which hands a comment the
  // power to satisfy it (PATTERNS 2026-08-22, documenting a marker created a marker). Asserted to
  // appear EXACTLY ONCE, so prose about it cannot stand in for it.
  const pageNC = noComments(readFileSync('src/app/shimmer/dev/hollow/page.tsx', 'utf8'))
  ok((pageNC.match(/useState<'mesh'/g) ?? []).length === 1,
    "★ the modelled mesh is the bench's DEFAULT surface, declared exactly once; the other three are the comparison")

  const mod = codeOnly(src('hollow-mesh.ts'))
  ok(/applyHollowPose\(pivot/.test(mod),
    '★★★ the pose is applied by `hollow-body.applyHollowPose`, the ONE writer')
  // ⚠ THE STRUCTURAL FORM, NOT A LIST OF THE NAMES A COPY MIGHT USE. The first version banned
  // `set('thighL'` and `rotation.x = p.` — and a mutation that wrote the same angle through a
  // differently-named local walked straight past it. A copy of the pose block cannot exist without
  // writing a rotation SOMEWHERE, so that is the thing to forbid: this module never writes one.
  ok(!/\brotation\.[xyz]\s*=/.test(mod),
    '⚠⚠ NOTHING IN THIS MODULE WRITES A BONE ROTATION — `applyHollowPose` is the one writer. Two tables of bone names beside two tables of angles agree perfectly until somebody adds a twelfth, which is how seven angles ended up on the floor on 09-05')
  ok(!/Math\.random/.test(mod),
    '⚠ no `Math.random` — a random field cannot be asserted or reproduced from a screenshot')
}

/* ── 8. COST ──────────────────────────────────────────────────────────────────────────────────── */
{
  const body = createHollowMeshBody('warden')
  const st = meshStats(body)
  ok(st.verts > 300 && st.verts < 2500,
    `★ the body is ${st.verts} verts · ${st.tris} tris — enough to hold a silhouette, few enough that the per-frame deform is cheaper than the fused field's 32,768-cell grid`)
  ok(st.bones === 11, `${st.bones} bones`)
  disposeHollowMeshBody(body)
  disposeHollowMeshes()
}

console.log(`   ${FORMS.length} forms · ${chainsFor('warden').length} chains`)
console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
