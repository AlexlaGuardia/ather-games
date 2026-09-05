/**
 * THE HOLLOW GUARD — every assert is a line out of `design-briefs/hollows.md` that the build can break.
 *
 * ★ The brief is unusually specific about what would BREAK a Hollow, which makes it unusually good
 * material for asserts: three creature designs, any colour it owns, a face, a crisp shape, a menace
 * pose. Each of those gets a test here, and each was mutation-checked by putting the fault back in.
 *
 * Run: `npx tsx src/app/shimmer/voxel3d/hollow-pose.test.ts`
 */
import {
  hollowPose, hollowField, cohesionAt, fieldMass, DENSITY, COHERE_S, HOLLOW_STRIDE_S,
  MAX_BLOB_R, SHED_FLOOR, CHAIN,
  type Blob,
} from './hollow-pose'
import type { HollowForm } from './hollow-look'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

const FORMS: HollowForm[] = ['warden', 'stalker', 'caster']
const T = Array.from({ length: 200 }, (_, i) => (i / 200) * COHERE_S * 2)

// ── IT NEVER HOLDS A CRISP SHAPE ──────────────────────────────────────────────────────────────
// "A Hollow that holds a crisp shape is drift" — the brief's most emphatic line.
ok(T.every(t => cohesionAt(t) < 0.98), 'cohesion never reaches 1 — it never becomes a solid statue')
ok(T.every(t => cohesionAt(t) > 0.02), 'cohesion never reaches 0 — a Hollow does not die on its own')
const distinct = new Set(T.map(t => JSON.stringify(hollowField(t, 'warden').map(b => +b.r.toFixed(6)))))
ok(distinct.size > T.length * 0.9,
  `★ the body is different at essentially every instant (${distinct.size}/${T.length} distinct fields)`)

// ── RE-MADE OUT OF THE SAME GREY ──────────────────────────────────────────────────────────────
// ★★ THE SHARPEST ASSERT HERE. If shedding LEAKED, mass would depend on the per-anchor wobble as
// well as on cohesion. Sampling a time and the same time one full cohere-cycle later gives equal
// cohesion but a completely different wobble — so equal mass at those two instants proves the shed
// pieces were handed back rather than lost.
for (const f of FORMS) {
  const a = 0.41, b = 0.41 + COHERE_S
  ok(near(cohesionAt(a), cohesionAt(b), 1e-9), `${f}: the two sample instants really do share a cohesion`)
  ok(near(fieldMass(hollowField(a, f)), fieldMass(hollowField(b, f)), 1e-9),
    `★★ ${f}: mass depends on cohesion ALONE — nothing is lost when a piece is shed`)
}
// ⚠ AND THE ASSERT ABOVE MUST NOT BE VACUOUS. If the fields at those two instants were identical,
// equal mass would prove nothing at all. They must differ blob by blob.
const fa = hollowField(0.41, 'warden'), fb = hollowField(0.41 + COHERE_S, 'warden')
ok(fa.some((bl, i) => !near(bl.r, fb[i].r, 1e-6)),
  '★ and the two fields genuinely differ, so the mass assert above is not satisfied by sameness')

// ── ONE SUBSTANCE, THREE DENSITIES ────────────────────────────────────────────────────────────
// "Three distinct creature designs" is on the what-would-break-it list.
ok(DENSITY.warden > DENSITY.stalker && DENSITY.stalker > DENSITY.caster,
  '★ density is ONE ordered axis: warden > stalker > caster')
const mass = (f: HollowForm) => fieldMass(hollowField(1.1, f))
ok(mass('warden') > mass('stalker') && mass('stalker') > mass('caster'),
  'and that ordering actually reaches the body — the warden is the most gathered thing on the field')
ok(FORMS.every(f => hollowField(1.1, f).length === hollowField(1.1, 'warden').length),
  '★ every form is the SAME body plan — same anchors, different amount of it')

// ── THE CASTER IS AN UNFINISHED ONE, NOT A DIFFERENT ONE ──────────────────────────────────────
ok(hollowPose(1, 'caster', 1).floats && !hollowPose(1, 'warden', 1).floats,
  'only the caster floats — it never gathered enough matter to be pulled down')
ok(hollowPose(1, 'caster', 1).thighL === 0 && hollowPose(1, 'caster', 1).shinL === 0,
  'a caster does not walk: it has no stride to take')
ok(Math.abs(hollowPose(HOLLOW_STRIDE_S * 0.25, 'warden', 1).thighL) > 0.05,
  'but the walkers DO stride (so the assert above is about the caster, not about a dead pose fn)')
// Canon: `body: 0`, "reach is its body".
const cast = hollowField(1.1, 'caster')
const reach = cast.find(b => b.anchor === 'handR')!
const trunk = cast.find(b => b.anchor === 'gut')!
ok(reach.opacity > trunk.opacity * 2,
  '★ on a caster only the REACH approaches solid — the rest does not resolve')

// ── NO FACE, AND NO WAY TO GROW ONE BY ACCIDENT ───────────────────────────────────────────────
// "Never a face you could love." A missing feature is easy to add back by accident, so assert the
// absence structurally rather than trusting that nobody will.
const anchors = new Set(hollowField(1, 'warden').map(b => b.anchor))
ok(!['eye', 'eyeL', 'eyeR', 'face', 'mouth', 'jaw'].some(a => anchors.has(a as never)),
  '★ there is no eye, face or mouth anchor anywhere in the body plan')
ok(hollowField(1, 'warden').every(b => !('color' in b) && !('emissive' in b) && !('glow' in b)),
  '★★ a blob carries NO colour of its own — the brief: it borrows, or it is grey')

// ── IT SAGS, THEN IS DRAWN BACK UP ────────────────────────────────────────────────────────────
let lowT = 0, highT = 0
for (const t of T) { if (cohesionAt(t) < cohesionAt(lowT)) lowT = t; if (cohesionAt(t) > cohesionAt(highT)) highT = t }
const meanY = (t: number) => hollowField(t, 'warden').reduce((n, b) => n + b.y, 0) / hollowField(t, 'warden').length
ok(meanY(lowT) < meanY(highT) - 0.02,
  '★ the body hangs LOWER when it is least gathered — it sags, and is drawn back up')

// ── KNEES AND POSE SANITY ─────────────────────────────────────────────────────────────────────
const walk = Array.from({ length: 120 }, (_, i) => hollowPose((i / 120) * HOLLOW_STRIDE_S, 'stalker', 1))
ok(walk.every(p => p.shinL >= 0 && p.shinR >= 0), 'a knee never bends backwards')
ok(walk.every(p => p.thighL * p.thighR <= 1e-12), 'the legs swing in opposite directions')
ok(walk.every(p => p.lean >= 0 && p.lean < 0.2),
  'it leans INTO the walk and never strikes a menace pose — it has no intent to perform')
ok(near(hollowPose(0.5, 'warden', 0).thighL, 0), 'standing still is standing still')

// ── ★★★ IT IS A BODY, NOT A BALL ──────────────────────────────────────────────────────────────
// Added 2026-09-05 after Alex looked at the bench and said "the blob isnt the right look". He was
// reading a real defect: `gut` and `chest` were reaching r=1.19 and r=1.04 on a body 1.56 tall — one
// sphere enclosing the head AND the feet — while the limbs flickered at 6-43% presence inside it.
//
// ⚠⚠ EVERY ASSERT ABOVE STAYED GREEN THROUGH ALL OF IT, AND THE MASS ASSERT IS THE REASON: POURING
// THE WHOLE BODY INTO ONE BALL CONSERVES MASS PERFECTLY. Conservation is a claim about arithmetic;
// none of it was a claim about a figure. These asserts are about the SILHOUETTE, which is the thing
// the brief actually rules and the thing a player actually sees.
const field = (t: number, f: HollowForm) => hollowField(t, f)
const span = (bs: Blob[], k: 'x' | 'y') =>
  Math.max(...bs.map(b => b[k] + b.r)) - Math.min(...bs.map(b => b[k] - b.r))

ok(FORMS.every(f => T.every(t => field(t, f).every(b => b.r <= MAX_BLOB_R))),
  `★★ no single blob reaches ${MAX_BLOB_R} blocks — none is big enough to BE the body (pre-fix peak: 1.19)`)

ok(FORMS.every(f => T.every(t => span(field(t, f), 'y') / span(field(t, f), 'x') > 1.25)),
  '★★ the silhouette stays taller than it is wide — upright and bipedal, never a boulder')

// The walkers keep every part through the whole loop. "Edges never resolve" is not "a leg blinks out".
//
// ⚠ THE FIRST VERSION OF THIS ASSERT COULD NOT FAIL, AND A MUTATION SWEEP IS THE ONLY REASON I KNOW.
// It read `b.r > 0.02`, and setting SHED_FLOOR to 0 sailed straight through it — because the `dip`
// expression bottoms out near 0.075 on its own, so no part was ever going to approach 0.02 whatever
// SHED_FLOOR said. It was green for a reason that had nothing to do with the constant it existed to
// guard. Restated against what SHED_FLOOR actually PROMISES — a part keeps a real fraction of itself
// — it fails the moment that floor is lowered. (PATTERNS 2026-08-22: ask of any assert whether there
// is an input that makes it fire.)
const swing = (f: HollowForm, a: Blob['anchor']) => {
  const rs = T.map(t => field(t, f).find(b => b.anchor === a)!.r)
  return Math.min(...rs) / Math.max(...rs)
}
ok((['warden', 'stalker'] as HollowForm[]).every(f =>
    (['head', 'armL', 'handR', 'thighL', 'shinR'] as const).every(a => swing(f, a) > 0.25)),
  '★★ a walker\'s parts thin but never amputate — each keeps >25% of its fullest size')

// ★★★ AND SHED_FLOOR IS ASSERTED ON THE CASTER, BECAUSE THAT IS THE ONLY FORM IT STILL BINDS ON.
// ⚠ THIS ASSERT WAS DISARMED BY A TUNING CHANGE AND ONLY A RE-RUN CAUGHT IT. Setting SHED_FLOOR to
// 0 used to turn the walker assert above red. After the joint-floor pass it did not: measured over
// 7200 samples, `Math.max(SHED_FLOOR, joint, dip)` is won by the JOINT floor 74.9% of the time on
// the warden and 75.5% on the stalker, and by SHED_FLOOR **0.0%** — the joint floor is strictly
// higher everywhere, so SHED_FLOOR became dead code for walkers and the assert went green by asking
// about a body the constant no longer touches. Nothing edited the assert. The geometry moved out
// from under it. (Hub hit the identical shape the same hour on a sealed-room check, from a corridor
// widening: a mutation that fired at w3 passed 60/60 at w5 because the sample stopped containing
// the phenomenon. RE-RUN MUTATIONS AFTER A TUNING CHANGE — a sweep from before it is a statement
// about the old geometry.)
// The caster has no joint floor by canon, so SHED_FLOOR is the only thing holding its trailing
// parts above nothing, and there the constant is live.
ok((['head', 'thighL', 'shinR'] as const).every(a => swing('caster', a) > 0.25),
  `★★ the caster's unresolved parts thin but never vanish — SHED_FLOOR ${SHED_FLOOR} is live HERE, and only here`)

// A leg you cannot see is not a leg. The shins must stand clear of the trunk blob, not inside it.
ok(['warden', 'stalker'].every(f => T.every(t => {
    const bs = field(t, f as HollowForm)
    const gut = bs.find(b => b.anchor === 'gut')!
    return (['shinL', 'shinR'] as const).every(a => {
      const sh = bs.find(b => b.anchor === a)!
      return Math.hypot(sh.x - gut.x, sh.y - gut.y, sh.z - gut.z) + sh.r > gut.r + 0.05
    })
  })),
  '★★ the shins stand OUTSIDE the trunk — legs that are swallowed by the gut are not legs')

// ── ★★★ EVERY JOINT STAYS FUSED ─ a limb is one mass, not beads on a string ──────────────
// Added 2026-09-05 after the first bipedal render came back a BAG OF MARBLES. Measured, the cause
// was not the material and not the lighting: every chain had NEGATIVE overlap ─ worst cases
// chest->armL -0.81, head->chest -0.31 ─ meaning the spheres did not touch. At points in the cohere
// loop the body came apart at every joint into free-floating balls.
//
// ⚠ THE SILHOUETTE ASSERTS ABOVE ALL PASSED THROUGH THAT. "Taller than wide", "no blob too big"
// and "shins outside the trunk" are every one of them true of a disconnected pile ─ a scatter of
// balls in roughly the right places satisfies them all. Connectivity is a different claim.
const overlap = (bs: Blob[], a: Blob['anchor'], b: Blob['anchor']) => {
  const p = bs.find(x => x.anchor === a)!, q = bs.find(x => x.anchor === b)!
  return (p.r + q.r - Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)) / (2 * Math.min(p.r, q.r))
}
const WALKERS: HollowForm[] = ['warden', 'stalker']
let worstJoint = Infinity, worstName = ''
for (const f of WALKERS) for (const t of T) for (const [a, b] of CHAIN) {
  const o = overlap(hollowField(t, f), a, b)
  if (o < worstJoint) { worstJoint = o; worstName = `${f} ${a}->${b}` }
}
ok(worstJoint > 0.10,
  `★★★ every joint on both walkers stays FUSED at every instant (worst ${worstJoint.toFixed(2)} at ${worstName})`)
// ⚠ WHAT THIS ASSERT DOES NOT COVER, written down rather than left to be discovered: setting FUSE to
// 0 does NOT turn it red. `MIN_R` takes each anchor's max over its bones, so most bones inherit a
// floor set by a longer neighbour and carry slack; the measured worst never drops to the margin.
// FUSE is a design margin in the DERIVATION, not a quantity this output can witness. It fires on
// what matters — both real disconnection bugs (the one-way trunk sink, and radii scaled by DENSITY
// while the skeleton stayed put) turn it red — but do not read a green here as "FUSE is verified".

// ★ The caster is EXEMPT and the exemption is DERIVED, not a hand-waved skip. Canon calls it
// "mostly the suggestion of a body" and the parts that trail off are supposed not to resolve. Its
// REACH is the exception canon names outright, so the thing it DOES hold is asserted instead.
// ⚠ Written this way so the exemption cannot rot into "we stopped checking the caster".
ok(T.every(t => overlap(hollowField(t, 'caster'), 'chest', 'armR') > 0
             && overlap(hollowField(t, 'caster'), 'armR', 'handR') > 0),
  '★★ the caster REACH stays fused to it though the rest of the caster does not ─ "reach is its body"')

// ★ Scale-invariance: the overlap fraction is a property of the BODY PLAN, so the two walkers must
// agree on it closely. They differ in size, never in how they are put together.
const worstOf = (f: HollowForm) =>
  Math.min(...T.flatMap(t => CHAIN.map(([a, b]) => overlap(hollowField(t, f), a, b))))
ok(Math.abs(worstOf('warden') - worstOf('stalker')) < 0.08,
  '★★ warden and stalker share ONE body plan ─ same joint geometry at different sizes, not two rigs')

// ★ Canon: `body: 0`, "reach is its body". True of the geometry, not merely of the alpha.
ok(T.every(t => {
    const bs = field(t, 'caster')
    const reach = bs.find(b => b.anchor === 'handR')!.r + bs.find(b => b.anchor === 'armR')!.r
    const trunk = bs.find(b => b.anchor === 'chest')!.r + bs.find(b => b.anchor === 'gut')!.r
    return reach > trunk
  }),
  '★★ a caster carries more mass in its REACH than in its trunk — "reach is its body"')

// ── PERIODIC ──────────────────────────────────────────────────────────────────────────────────
ok(T.every(t => near(cohesionAt(t), cohesionAt(t + COHERE_S), 1e-9)),
  'the cohere loop closes, so the dissolution does not pop')

console.log(`   ${T.length} samples · cohere ${COHERE_S}s · stride ${HOLLOW_STRIDE_S}s · 3 forms`)
console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
