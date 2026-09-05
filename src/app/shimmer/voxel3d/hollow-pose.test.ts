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
const meanY = (t: number) => hollowField(t, 'warden').reduce((n, b) => n + b.y, 0) / 12
ok(meanY(lowT) < meanY(highT) - 0.02,
  '★ the body hangs LOWER when it is least gathered — it sags, and is drawn back up')

// ── KNEES AND POSE SANITY ─────────────────────────────────────────────────────────────────────
const walk = Array.from({ length: 120 }, (_, i) => hollowPose((i / 120) * HOLLOW_STRIDE_S, 'stalker', 1))
ok(walk.every(p => p.shinL >= 0 && p.shinR >= 0), 'a knee never bends backwards')
ok(walk.every(p => p.thighL * p.thighR <= 1e-12), 'the legs swing in opposite directions')
ok(walk.every(p => p.lean >= 0 && p.lean < 0.2),
  'it leans INTO the walk and never strikes a menace pose — it has no intent to perform')
ok(near(hollowPose(0.5, 'warden', 0).thighL, 0), 'standing still is standing still')

// ── PERIODIC ──────────────────────────────────────────────────────────────────────────────────
ok(T.every(t => near(cohesionAt(t), cohesionAt(t + COHERE_S), 1e-9)),
  'the cohere loop closes, so the dissolution does not pop')

console.log(`   ${T.length} samples · cohere ${COHERE_S}s · stride ${HOLLOW_STRIDE_S}s · 3 forms`)
console.log(fails.length ? `❌ ${pass} passed, ${fails.length} FAILED` : `✅ ${pass} passed`)
for (const f of fails) console.log(`   · ${f}`)
process.exit(fails.length ? 1 : 0)
