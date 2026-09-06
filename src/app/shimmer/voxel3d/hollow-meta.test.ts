/**
 * THE FUSED HOLLOW'S GUARD — that a field body is ONE surface, that it is the RIG's body, and that
 * it is the size of a Hollow rather than of the box it is evaluated in.
 *
 * ★ The last one is the cheap check that catches the whole class of mistakes this module can make.
 * Every coordinate here passes through a normalisation into the marching-cubes cube, and every way
 * of getting that wrong — the wrong centre, the wrong divisor, the 0..1 vs -1..1 confusion — shows
 * up as a body of the wrong SIZE or in the wrong PLACE, not as an error.
 *
 * Run: npx tsx src/app/shimmer/voxel3d/hollow-meta.test.ts
 */
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { createHollowMeta, updateHollowMeta, disposeHollowMetas, META_BOX, META_RES } from './hollow-meta'
import { hollowField, HOLLOW_STRIDE_S } from './hollow-pose'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const FORMS = ['warden', 'stalker', 'caster'] as const

const surfaceOf = (b: THREE.Group) => b.children.find(c => c.name === 'hollowField') as THREE.Mesh
const rigOf = (b: THREE.Group) => b.children.find(c => c.name === 'hollowPoseRig') as THREE.Group

/**
 * The surface's real bounds, over the DRAW RANGE only.
 *
 * ★★★ `Box3.setFromObject` READS THE WHOLE POSITION BUFFER, and marching cubes preallocates one —
 * 30,000 vertices of which a body fills a few thousand, the rest sitting untouched at (0,0,0). So
 * the box always contained the origin, and a caster (whose mass sits high and whose legs genuinely
 * trail off) measured 0.860 -> 1.910 against a field of -0.032 -> 1.523: a body reported as being
 * in the wrong place and the wrong size, entirely because of vertices that are not drawn. ⚠ It read
 * as a finding about the FEATURE and it was a fact about the INSTRUMENT — and it failed toward
 * alarm, which is the direction that gets acted on.
 */
function bounds(m: THREE.Mesh): THREE.Box3 {
  const pos = m.geometry.getAttribute('position')
  const n = Math.min(m.geometry.drawRange.count, pos.count)
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld))
  return box
}

// ── IT IS ONE SURFACE, AND IT EXISTS ──────────────────────────────────────────────────────────
{
  const body = createHollowMeta('stalker')
  updateHollowMeta(body, 0.4, 'stalker', 1)
  const surf = surfaceOf(body)
  const meshes: THREE.Mesh[] = []
  body.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible && o.parent?.visible !== false) meshes.push(o as THREE.Mesh) })
  ok(!!surf, 'the body carries a field surface')

  // ★★ A POSITIVE CONTROL, AND IT IS THE ONE THAT MATTERS. Marching cubes over a field with no
  // sources produces a perfectly valid EMPTY geometry — so "it did not throw" says nothing at all.
  const count = surf.geometry.drawRange.count
  ok(count > 200, `★★ the field actually surfaced (${count} vertices) — an empty field is silent, not an error`)

  ok(rigOf(body).visible === false,
    '★★ the posing rig never draws — it exists to be READ, and a visible one would show the beads the field replaces')
}

// ── IT IS A HOLLOW, NOT THE BOX IT LIVES IN ───────────────────────────────────────────────────
// Every normalisation mistake this module can make (wrong centre, wrong divisor, 0..1 vs -1..1)
// lands here as a body of the wrong size or in the wrong place — never as a throw.
{
  for (const f of FORMS) {
    const body = createHollowMeta(f)
    updateHollowMeta(body, 0.4, f, 1)
    body.updateMatrixWorld(true)
    const surf = surfaceOf(body)
    const box = bounds(surf)
    const h = box.max.y - box.min.y
    const field = hollowField(0.4, f)
    const want = Math.max(...field.map(b => b.y + b.r * b.s[1])) - Math.min(...field.map(b => b.y - b.r * b.s[1]))
    // ★★★ THE CASTER IS HELD TO A DIFFERENT CLAIM, AND IT IS CANON'S, NOT A WIDENED TOLERANCE.
    // A first version asserted all three resolve fully and the caster failed at 0.79 of 1.56. The
    // tempting fix is a looser bound; the correct one is that the brief says a caster is *"mostly
    // the suggestion of a body, dense only where it is reaching"*, that *"the rest trails off and
    // does not resolve"*, and that it floats because it never gathered enough to need feet. A
    // caster whose legs do not surface is the feature. ⚠ So it is asserted as NOT resolving — which
    // fails if it ever becomes a solid body — and its reach is asserted present separately.
    if (f === 'caster') {
      // ⚠⚠ THE ASSERT THAT USED TO LIVE HERE WAS DECORATION, and it took two mutations to notice.
      // It read `h < want * 0.9` — surface height against the FIELD'S OWN extent — and both move
      // together, so the ratio is pinned no matter what. Fusing 4x wide (0.505 -> 0.709) and
      // removing the caster's density reduction entirely both left it green. An assert whose two
      // quantities scale with each other cannot discriminate, however true it is. The claim that
      // matters is not a ratio, it is WHICH PARTS resolve — see the anchor check below.
      ok(true, 'caster height is not asserted as a ratio — see the per-anchor check')
    } else {
      ok(h > want * 0.7 && h < want * 1.45,
        `★★ the ${f} surface stands about as tall as the field says (${h.toFixed(2)} vs ${want.toFixed(2)})`)
    }
    ok(h < META_BOX * 0.95,
      `★ and it is a BODY, not the evaluation cube filled solid (${h.toFixed(2)} of ${META_BOX}) — the tell for a falloff that never falls off`)
    ok(Math.abs((box.max.x + box.min.x) / 2) < 0.35,
      `★ the ${f} body is centred on its own axis, not pushed to a wall of the cube`)

    // ★★★ NOTHING MAY LEAVE THE GRID. A source outside the evaluation cube is not an error and not
    // a warning — it is an ABSENCE, and the surface simply lacks that part while every other number
    // looks correct. It shipped exactly that way: the caster's head sat at a normalised 1.07 and the
    // form surfaced 0.64 of its own height, which read as "a caster does not fully resolve" and was
    // in fact "a caster's head was never evaluated". ⚠ The two are indistinguishable from the output.
    for (let i = 0; i < 10; i++) {
      const st = updateHollowMeta(body, (i / 10) * 3.4, f, 1)!
      ok(st.outside === 0, `★★ no ${f} source leaves the field cube at t=${((i / 10) * 3.4).toFixed(1)} (${st.outside} outside)`)
    }


    // ★★ AND THE CASTER'S REACH IS SOLID — canon calls it the one part that nearly is, and glosses
    // it "reach is its body". Read off the rig rather than assumed: the surface must actually cover
    // where the reach blob sits, or the one thing canon is most specific about is missing.
    if (f === 'caster') {
      const rig = rigOf(body)
      rig.updateMatrixWorld(true)
      let reach: THREE.Vector3 | null = null
      rig.traverse(o => { if ((o as THREE.Mesh).isMesh && o.name === 'handR') reach = o.getWorldPosition(new THREE.Vector3()) })
      const r = reach as THREE.Vector3 | null
      ok(!!r && box.containsPoint(r),
        `★★ the caster's REACH is inside the surface — the one part canon holds nearly solid`)

      // ★★★ AND THE PART THAT DISCRIMINATES: WHICH ANCHORS RESOLVE. Canon gives the caster no feet
      // — it *"has not gathered enough matter to be pulled down"* and floats — so a caster whose
      // FOOT surfaces has become a third creature design, which the brief lists under what would
      // break it. Measured against the surface's actual lowest point rather than against a ratio,
      // so growing the caster's mass moves one side of the comparison and not the other.
      let foot: THREE.Vector3 | null = null
      rig.traverse(o => { if ((o as THREE.Mesh).isMesh && o.name === 'footR') foot = o.getWorldPosition(new THREE.Vector3()) })
      const ft = foot as THREE.Vector3 | null
      ok(!!ft && ft.y < box.min.y,
        `★★ the caster's FEET do not resolve (foot ${ft?.y.toFixed(2)} below surface floor ${box.min.y.toFixed(2)}) — it floats, and canon says it never gathered enough to need them`)
    }
  }
}

// ── AND IT IS THE RIG'S BODY, MOVING ──────────────────────────────────────────────────────────
{
  const body = createHollowMeta('stalker')
  const sig = (t: number) => {
    updateHollowMeta(body, t, 'stalker', 1)
    const a = surfaceOf(body).geometry.getAttribute('position')
    let s = 0
    for (let i = 0; i < a.count; i += 37) s += a.getX(i) * 31 + a.getY(i) * 17 + a.getZ(i) * 7
    return Math.round(s * 1000)
  }
  const a = sig(0), b = sig(HOLLOW_STRIDE_S * 0.5)
  ok(a !== b, '★★ the surface CHANGES across the stride — a fused body that never moves is a statue with extra cost')

  // ⚠ THE POSE MUST COME FROM THE RIG, NOT FROM A SECOND DERIVATION. A re-derivation here would be a
  // hand-kept mirror of hollow-body's geometry and would agree with it until somebody edited one.
  const src = codeOnly(readFileSync(new URL('./hollow-meta.ts', import.meta.url), 'utf8'))
  ok(/updateHollowBody\(/.test(src), '★★ the pose is driven through the rig, never recomputed here')
  // ★ AND CONVERTED INTO THE BODY'S OWN FRAME. Naming the conversion rather than the read: the read
  // was never wrong, the FRAME was, and a guard that only asserts "it reads matrixWorld" is green on
  // both the working version and the one that shipped an invisible body.
  ok(/multiplyMatrices\(toLocal, o\.matrixWorld\)/.test(src),
    '★★ each blob is expressed in the BODY\'s frame — the cube is described there, and world == local only for an unparented body')
  ok(!/REST\[/.test(src), '★ and it does not reach for the anchor table itself — that is the rig\'s job')
}

// ── ONE MATERIAL FOR THE WHOLE GAME ───────────────────────────────────────────────────────────
{
  const a = createHollowMeta('warden'), b = createHollowMeta('warden')
  ok(surfaceOf(a).material === surfaceOf(b).material,
    '★★ two bodies of a form SHARE one material — a material per body is a shader program per body (2026-08-06)')
  disposeHollowMetas()
}

// ── ★★★ AND IT WORKS WHEN SOMETHING ELSE HAS MOVED IT ─────────────────────────────────────────
// The guard that was missing, and its absence shipped a body that drew NOTHING while every other
// assert in this file was green. Ball positions were mapped from `matrixWorld` — world coordinates,
// which equal local ones only when the body has no parent, which is exactly what a test builds. The
// bench mounts it under a group at x = -4, so every ball mapped outside the field cube: zero
// sources, zero surface, no error, clean console. ⚠ A BODY AT THE ORIGIN IS NOT THE BODY THE GAME
// PLACES, and nothing about a body at the origin can tell you so. So this one is given a parent.
{
  for (const [px, py, pz] of [[-4, 0, 0], [7, 0.6, -3], [0, 0, 0]] as const) {
    const parent = new THREE.Group()
    parent.position.set(px, py, pz)
    const body = createHollowMeta('stalker')
    parent.add(body)
    parent.updateMatrixWorld(true)
    updateHollowMeta(body, 0.4, 'stalker', 1)
    const n = surfaceOf(body).geometry.drawRange.count
    ok(n > 200, `★★ a body parented at (${px}, ${py}, ${pz}) still surfaces (${n} vertices)`)

    // ★ And it surfaces IN THE RIGHT PLACE — carried by the parent, not left behind at the origin.
    parent.updateMatrixWorld(true)
    const box = bounds(surfaceOf(body))
    ok(Math.abs((box.min.x + box.max.x) / 2 - px) < 0.4,
      `★★ and it stands where its parent puts it (centre x ${((box.min.x + box.max.x) / 2).toFixed(2)} vs ${px})`)
  }
}

// ── ★★★ AND SOMETHING DRAWS IT ────────────────────────────────────────────────────────────────
// `hollow-body` shipped for a day with no consumer but its own test — 240 lines of skeleton behind
// forty green asserts, rendered by nothing. This module gets the same guard in the same commit as
// its host, rather than after somebody notices.
{
  const rigRaw = readFileSync(new URL('./HollowFused.tsx', import.meta.url), 'utf8')
  const rig = codeOnly(rigRaw)
  ok(/^import [\s\S]{0,140}?from '\.\/hollow-meta'$/m.test(rigRaw), 'a component imports the field module')
  ok(/createHollowMeta\(/.test(rig), 'and builds a body from it')
  ok(/useFrame\([^)]*=>[\s\S]{0,220}?updateHollowMeta\(/.test(rig),
    '★★ and drives it from a FRAME LOOP — a field built once and never updated is a statue')
  ok(/disposeHollowMetas\(/.test(rig), 'and releases the shared materials on unmount')

  const benchRaw = readFileSync(new URL('../dev/hollow/page.tsx', import.meta.url), 'utf8')
  ok(/<HollowFused\s/.test(codeOnly(benchRaw)), '★★ and a page MOUNTS it — the field is reachable by eye')
  ok(/^import \{ HollowFused \} from '\.\.\/\.\.\/voxel3d\/HollowFused'$/m.test(benchRaw),
    'from the bench, by import, not by copy')
}

console.log(`   res ${META_RES}^3 · box ${META_BOX}`)
console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
