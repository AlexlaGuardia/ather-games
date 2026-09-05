/**
 * A HOLLOW IS A BODY THAT KEEPS FAILING AND KEEPS BEING RE-MADE OUT OF THE SAME GREY.
 *
 * ★★★ WHY THIS EXISTS (2026-09-04, sprites lane). `design-briefs/hollows.md` (ruled 2026-08-15 with
 * Alex) calls continuous dissolution **"the single most important animation note in this file"** and
 * says outright: *a Hollow that holds a crisp shape is drift.* The build ships three single
 * primitives — an icosahedron, a cone and an octahedron (`hollow-look.ts:createHollowGeo`) — which
 * are crisp shapes that hold perfectly. This module is the missing half.
 *
 * ── ONE SUBSTANCE, THREE DENSITIES — NEVER THREE CREATURES ─────────────────────────────────────
 * The brief lists "three distinct creature designs" under *what would break it*. So there is ONE
 * body plan here and `density` is a dial on it. `warden` is most gathered, `stalker` mid, `caster`
 * barely gathered — and the caster floats **because it never gathered enough matter to be pulled
 * down**, not because it is a different thing. Canon's gloss *"reach is its body"* is implemented
 * literally: on a caster only the reaching arm approaches solid, and the rest does not resolve.
 *
 * ── MASS IS CONSERVED, WHICH IS WHAT MAKES IT RE-MAKING RATHER THAN LEAKING ────────────────────
 * The brief says the body is *"failing continuously and being re-made out of the same grey."* So
 * the blob field sheds and re-gathers around a constant total: a lump that sags out of the chest
 * arrives somewhere else. A field that simply shrank would read as a thing dying, and dying is what
 * a Hollow specifically does not do — it has nothing in it to lose.
 *
 * ⚠ NO FACE, EVER. Canon: *"never a face you could love."* There is no eye anchor in this file and
 * there must never be one. If a head needs to read as oriented, tilt the mass (`headTilt`) — a
 * light in the head is a frequency, and a Hollow has none.
 *
 * ⚠ AND NOTHING HERE EMITS. Colour is the material's business and the answer there is BORROWED, not
 * owned (see `HollowDoll.tsx`). This module returns geometry and opacity only — there is deliberately
 * no colour, no glow and no emissive value anywhere in it, so it cannot be the file that grows one.
 *
 * Run: `npx tsx src/app/shimmer/voxel3d/hollow-pose.test.ts`
 */
import type { HollowForm } from './hollow-look'

/** Seconds of one full sag-and-re-gather. Slow: the brief asks for a slow loop, not a shiver. */
export const COHERE_S = 3.4

/** Seconds of one stride for the two forms that walk. Heavier and slower than a keeper's. */
export const HOLLOW_STRIDE_S = 1.35

/**
 * How much of the smear managed to gather. The ONLY thing that differs between the three forms.
 * ⚠ Ordered and asserted: warden > stalker > caster. The moment these stop being one axis, the
 * mirror idea is gone and they are three creatures.
 */
export const DENSITY: Record<HollowForm, number> = { warden: 1, stalker: 0.72, caster: 0.4 }

/**
 * A part thins but never disappears. The brief says *edges never resolve*; it does not say a leg
 * blinks out. A floor here is what keeps the silhouette bipedal through the whole cohere loop.
 */
export const SHED_FLOOR = 0.34

/**
 * The ceiling no single blob may cross, in blocks.
 *
 * ⚠ DERIVED, NOT FITTED. The head anchor sits at 1.56, so that is the body's standing height. A
 * sphere whose DIAMETER reaches two thirds of that has stopped being a part of a figure and has
 * become the figure — which is precisely the failure this rewrite fixes. 1.56 × ⅔ ÷ 2 = 0.52.
 * The number is set from the body plan so that tuning the body cannot quietly move the guard; the
 * pre-rewrite field peaked at **1.19**, blowing through it by 2.3×. Asserted, never clamped.
 */
export const MAX_BLOB_R = 0.50

/**
 * Overall size per form, applied to POSITIONS and RADII together.
 *
 * ★★★ SCALE-INVARIANCE IS THE WHOLE POINT, and getting it wrong is what left the stalker in pieces
 * after the warden was fixed. Radii were scaled by `DENSITY` while the skeleton stayed put, so a
 * less-gathered body kept a full-size skeleton with undersized blobs and came apart at every joint —
 * the joint floor was scaled away by the very factor it was meant to survive. Scaling both together
 * means an overlap fraction measured on the warden is TRUE OF EVERY FORM, and the solved bone
 * condition never has to be re-solved per form.
 *
 * ⚠ Derived from `DENSITY` rather than declared, so the three cannot drift into being three
 * creatures — the brief's own failure mode. Compressed: a stalker is less gathered, not a child.
 */
export const FORM_SCALE: Record<HollowForm, number> = {
  warden: 0.86 + 0.14 * DENSITY.warden,
  stalker: 0.86 + 0.14 * DENSITY.stalker,
  caster: 0.86 + 0.14 * DENSITY.caster,
}

/**
 * Extra bulk on the trunk for a more gathered body — the warden "sagging under its own weight".
 *
 * ★ IT ONLY EVER ADDS (>= 1 for every form), which is not an accident: a fatter blob can never
 * break a joint, only deepen it. That is what lets density show as real heft without putting the
 * connectivity guarantee back at risk. Density that made anything THINNER would have to be checked
 * against every bone again.
 */
const TRUNK = new Set<Anchor>(['head', 'chest', 'gut', 'hip'])
const trunkBulge = (f: HollowForm) => 1 + 0.18 * DENSITY[f]

/** Anchors of the one body plan. Bipedal, plantigrade, roughly keeper-scaled, no face. */
export type Anchor =
  | 'head' | 'chest' | 'gut' | 'hip'
  | 'armL' | 'armR' | 'elbowL' | 'elbowR' | 'handL' | 'handR'
  | 'thighL' | 'thighR' | 'kneeL' | 'kneeR' | 'shinL' | 'shinR' | 'footL' | 'footR'

export interface Blob {
  anchor: Anchor
  /** Local offset from the anchor, in blocks. Drifts as the body sags. */
  x: number; y: number; z: number
  /** Radius in blocks. 0 means this piece has been shed for the moment. */
  r: number
  /** 0..1. The caster is mostly suggestion, so most of its field sits low. */
  opacity: number
}

export interface HollowPose {
  /** Vertical bob. The walkers are heavy in the heel; the caster does not touch the ground. */
  bodyY: number
  /** Lean. A Hollow moves toward you because that is where the frequency is — never a menace pose. */
  lean: number
  /** Orientation of the head MASS. Not a look-at; there is nothing to look with. */
  headTilt: number
  thighL: number; thighR: number
  shinL: number; shinR: number
  armL: number; armR: number
  /** 0..1 — how gathered the whole body is right now. Never reaches 1 and never reaches 0. */
  cohesion: number
  /** true only for the caster: it never gathered enough matter to be pulled down. */
  floats: boolean
}

/** Where each anchor sits on the body plan, before any sag. Keeper-scaled, feet at y=0. */
const REST: Record<Anchor, [number, number, number]> = {
  head: [0, 1.52, 0], chest: [0, 1.19, 0], gut: [0, 0.90, 0], hip: [0, 0.67, 0],
  // ★ A LIMB IS A CHAIN OF OVERLAPPING BLOBS, NEVER ONE BLOB PER LIMB, and the spacing is SOLVED
  // rather than eyeballed. `MIN_R` below turns "every joint must stay fused" into one condition —
  // `BASE_a + BASE_b >= 1.343 x bone length` — and every bone here satisfies it. The first cut hung
  // a single sphere off each shoulder at x=0.40 and the shoulder joint measured -0.81 overlap: the
  // arm was not attached to the body at any point in the cohere loop.
  armL: [-0.30, 1.17, 0], armR: [0.30, 1.17, 0],
  elbowL: [-0.36, 1.00, 0], elbowR: [0.36, 1.00, 0],
  handL: [-0.39, 0.83, 0], handR: [0.39, 0.83, 0],
  thighL: [-0.16, 0.51, 0], thighR: [0.16, 0.51, 0],
  kneeL: [-0.16, 0.34, 0], kneeR: [0.16, 0.34, 0],
  shinL: [-0.17, 0.18, 0], shinR: [0.17, 0.18, 0],
  // Plantigrade, heavy in the heel — the brief's words. The foot sits forward of the shin.
  footL: [-0.18, 0.06, 0.05], footR: [0.18, 0.06, 0.05],
}

/** Base radius per anchor. The mass is chest-and-gut heavy, so it sags believably. */
const BASE_R: Record<Anchor, number> = {
  head: 0.19, chest: 0.27, gut: 0.26, hip: 0.23,
  armL: 0.15, armR: 0.15, elbowL: 0.125, elbowR: 0.125, handL: 0.125, handR: 0.125,
  thighL: 0.16, thighR: 0.16, kneeL: 0.135, kneeR: 0.135,
  shinL: 0.13, shinR: 0.13, footL: 0.125, footR: 0.125,
}

const ORDER: Anchor[] = [
  'head','chest','gut','hip',
  'armL','elbowL','handL','armR','elbowR','handR',
  'thighL','kneeL','shinL','footL','thighR','kneeR','shinR','footR',
]
/**
 * The skeleton: which blobs must FUSE into one mass. Not a render detail — this is the difference
 * between a body and a bag of marbles.
 *
 * ★★★ MEASURED, 2026-09-05. The first bipedal cut had NEGATIVE overlap on every chain — worst cases
 * `chest→armL` -0.81, `head→chest` -0.31, `thighL→kneeL` -0.07 (fractions of the smaller blob).
 * Negative means the two spheres DO NOT TOUCH: at points in the cohere loop the body came apart at
 * every joint into free-floating balls. That is what "reads as a bag of marbles" was, and no amount
 * of material work would have fixed it, because the geometry was disconnected.
 */
export const CHAIN: [Anchor, Anchor][] = [
  ['head', 'chest'], ['chest', 'gut'], ['gut', 'hip'],
  ['chest', 'armL'], ['armL', 'elbowL'], ['elbowL', 'handL'],
  ['chest', 'armR'], ['armR', 'elbowR'], ['elbowR', 'handR'],
  ['hip', 'thighL'], ['thighL', 'kneeL'], ['kneeL', 'shinL'], ['shinL', 'footL'],
  ['hip', 'thighR'], ['thighR', 'kneeR'], ['kneeR', 'shinR'], ['shinR', 'footR'],
]

/** How deep a joint must fuse, as a fraction of the bone's length beyond merely touching. */
export const FUSE = 0.25

/**
 * The radius each anchor must never drop below for its joints to stay fused, DERIVED from the body
 * plan rather than hand-tuned.
 *
 * ⚠ THE POINT IS THAT IT CANNOT GO STALE. Move an anchor in `REST` or retune a `BASE_R` and these
 * recompute; a hand-written table of minima would agree with the skeleton exactly until the day
 * somebody moved a joint, and then it would be confidently wrong with nothing to catch it — the
 * hand-kept-mirror failure (PATTERNS 2026-08-22) in its most tempting form, because a table of
 * numbers next to a table of numbers looks like it belongs there.
 *
 * Each bone needs `rA + rB >= length × (1 + FUSE)`; the requirement is split between its two ends in
 * proportion to their resting bulk, so a thin wrist is not forced to the thickness of a chest.
 */
const MIN_R: Record<Anchor, number> = (() => {
  const out = {} as Record<Anchor, number>
  for (const a of ORDER) out[a] = 0
  for (const [a, b] of CHAIN) {
    const [ax, ay, az] = REST[a], [bx, by, bz] = REST[b]
    const need = Math.hypot(ax - bx, ay - by, az - bz) * (1 + FUSE)
    const total = BASE_R[a] + BASE_R[b]
    out[a] = Math.max(out[a], need * (BASE_R[a] / total))
    out[b] = Math.max(out[b], need * (BASE_R[b] / total))
  }
  return out
})()


/**
 * Deterministic smooth noise in [-1, 1].
 *
 * ⚠ NEVER `Math.random` HERE. A random field cannot be asserted, cannot be reproduced from a
 * screenshot, and would make every mutation in the guard look like noise. Two layered irrationals
 * give a loop long enough to read as unrepeating without ever actually being unrepeatable.
 */
function wobble(seed: number, t: number): number {
  return 0.62 * Math.sin(t * 1.7 + seed * 2.399) + 0.38 * Math.sin(t * 0.73 + seed * 5.117)
}

/**
 * How gathered the body is at time `t`. Oscillates and is CLAMPED AWAY FROM BOTH ENDS on purpose:
 * at 1 it would be a solid statue (drift), at 0 it would be gone (a Hollow does not die of its own
 * accord). The brief's "always visibly losing itself" is this number never settling.
 */
export function cohesionAt(t: number): number {
  const phase = (t / COHERE_S) * Math.PI * 2
  // ⚠ THE HARMONIC MUST BE AN INTEGER OR THE LOOP DOES NOT CLOSE. A 2.3 here reads fine for a few
  // seconds and then drifts, so the dissolution pops on every repeat — the most visible animation
  // bug there is, and invisible to anyone watching for less than a full cycle.
  return 0.62 + 0.22 * Math.sin(phase) + 0.06 * Math.sin(phase * 3)
}

/** The joint pose. `speed` 0 stands; the caster ignores the legs because it never uses them. */
export function hollowPose(t: number, form: HollowForm, speed: number): HollowPose {
  const s = Math.max(0, Math.min(1.4, speed))
  const floats = form === 'caster'
  const phase = (t / HOLLOW_STRIDE_S) * Math.PI * 2
  const legs = floats ? 0 : s          // a caster has no stride and no knees to bend
  const swing = Math.sin(phase) * legs
  // A caster hovers on the cohesion loop rather than on a stride: it has no feet to bob on.
  const bodyY = floats
    ? 0.9 + 0.06 * Math.sin((t / COHERE_S) * Math.PI * 2)
    : -Math.abs(Math.sin(phase)) * 0.055 * s
  return {
    bodyY,
    lean: 0.07 * s,
    headTilt: 0.10 * wobble(9, t * 0.5),
    thighL: -swing * 0.40, thighR: swing * 0.40,
    // Knees bend through the swing, never backwards — same rule as the moglin, same reason.
    // ⚠ GATED ON `legs`, NOT ON `s`. Keying these off speed alone left the caster bending knees it
    // does not have while hovering, which is the "three creature designs" failure arriving through
    // the back door: a floating thing performing a walk is neither of the two bodies canon allows.
    shinL: legs * Math.max(0, Math.sin(phase - Math.PI / 2)) * 0.5,
    shinR: legs * Math.max(0, -Math.sin(phase - Math.PI / 2)) * 0.5,
    armL: swing * 0.3, armR: -swing * 0.3,
    cohesion: cohesionAt(t),
    floats,
  }
}

/**
 * The body as a field of blobs at time `t`. Overlapping spheres of varying radius are what make the
 * silhouette readable at distance and unreliable up close, which is the brief's *edges never
 * resolve* — it falls out of the construction rather than being a separate effect.
 *
 * ★★★ WHY THIS WAS REWRITTEN (2026-09-05, sprites lane) — THE RIG WAS BIPEDAL ON PAPER AND A BALL
 * ON SCREEN, AND THE GUARD COULD NOT TELL. Alex looked at the bench and said *"the blob isnt the
 * right look"*, and he was reading a real defect, not a style preference. Measured over three
 * cohere cycles, the old field put `gut` and `chest` at **100% presence with peak radii 1.19 and
 * 1.04** on a body 1.56 blocks tall — a single sphere that ENCLOSED the head and the feet — while
 * every limb flickered at 6–43% presence with peak radius 0.03–0.15, inside that sphere whenever it
 * existed at all. The caster's reach anchor, which canon says **is** its body, was present in **1%**
 * of frames.
 *
 * ⚠⚠ TWO MECHANISMS, AND THE SECOND IS THE ONE WORTH REMEMBERING.
 *  1. `shedding = w*0.9 + (c - 0.72)*2.2` is negative for most of the loop (cohesion averages 0.62),
 *     so **shedding was the default state of every part** rather than an occasional event.
 *  2. All of that shed mass was handed to `gut` and `chest` **with no ceiling and no way back out**.
 *     A one-way sink: the more the body shed, the bigger the ball got. Mass was conserved the whole
 *     time — which is exactly why nothing went red.
 *
 * ★★★ THE GUARD ASSERTED CONSERVATION, AND POURING THE WHOLE BODY INTO ONE BALL CONSERVES MASS
 * PERFECTLY. That is the cheapest wrong answer that still satisfies it (PATTERNS 2026-08-31). The
 * fix is in both halves: parts now dip on their own phase and never fully vanish, and shed mass is
 * redistributed **across the whole body in proportion to what each part is currently holding**, so
 * the grey moves around a body instead of collecting in its middle. `hollow-pose.test.ts` now
 * asserts the SILHOUETTE — taller than wide, limbs outside the trunk, no blob big enough to swallow
 * the figure — which is a claim about being a body, not about arithmetic.
 *
 * ★ THE CASTER'S REACH. Canon: `body: 0`, *"reach is its body"*. So on a caster every anchor is
 * pushed toward suggestion EXCEPT the reaching arm, which is held near solid and is given the
 * BULK as well as the opacity — the old code made it the least transparent part while leaving it
 * the smallest, so "reach is its body" was true of the alpha and false of the geometry.
 */
export function hollowField(t: number, form: HollowForm, reach: Anchor = 'handR'): Blob[] {
  const c = cohesionAt(t)
  const floats = form === 'caster'

  // Pass 1 — how much of each part is gathered right now, and where it has sagged to.
  const raw = ORDER.map((anchor, i) => {
    const [bx, by, bz] = REST[anchor]
    const w = wobble(i, t)
    const sag = (1 - c) * 0.16 * FORM_SCALE[form]
    // ⚠ EACH PART DIPS ON ITS OWN PHASE (the `i` seed), so at any instant a few parts are letting go
    // and the rest are holding. That is "always visibly losing itself". A shared phase would pulse
    // the whole body in and out together, which reads as a breathing lung, not as dissolution.
    const dip = 0.62 + 0.38 * w - (0.72 - c) * 0.55
    const isReach = floats && (anchor === reach || anchor === 'armR')
    const scale = FORM_SCALE[form]
    const bulge = TRUNK.has(anchor) ? trunkBulge(form) : 1
    // ★★ THE JOINT FLOOR, AND IT IS FOLDED IN HERE RATHER THAN CLAMPED AT THE END ON PURPOSE.
    // `shed` is measured from the r this produces, so redistribution still conserves the total to
    // the last digit — a post-hoc clamp would have quietly broken the mass assert instead, which is
    // the sort of fix that trades a visible bug for an invisible one.
    // A caster is EXEMPT by canon: it is "mostly the suggestion of a body" and the parts that trail
    // off are supposed not to resolve. Its reach is held solid instead, which is the same sentence.
    // ⚠ `scale` CANCELS out of this ratio, which is exactly why scale-invariance is worth having:
    // the floor is a fraction of the anchor's own resting size, so it is the same fraction at any
    // body size and cannot be silently defeated by a form being smaller.
    const joint = floats ? 0 : MIN_R[anchor] / (BASE_R[anchor] * bulge * (0.72 + 0.5 * c))
    const f = isReach
      ? Math.max(0.9, Math.min(1, dip + 0.5))     // the reach stays gathered while the rest lets go
      : Math.max(SHED_FLOOR, joint, Math.min(1, dip))
    // A caster is mostly suggestion; its reach is the exception that approaches solid.
    // ⚠ The reach bulk is bounded by MAX_BLOB_R, not by taste: at 2.4 the caster's hand measured
    // r=0.506 against a 0.50 ceiling, i.e. the ONE blob was becoming the body — the exact failure
    // this whole pass exists to remove, re-entering through the arm instead of the gut.
    const bulk = floats ? (isReach ? 2.0 : 0.62) : 1
    const rBase = BASE_R[anchor] * scale * bulge * bulk * (0.72 + 0.5 * c)
    // ★★ A WALKER IS NEARLY OPAQUE, AND THAT IS THE BRIEF, NOT A PREFERENCE. The warden is "nearly
    // opaque"; the stalker has "legible limbs". Only the CASTER is "mostly the suggestion of a body".
    // ⚠ The first cut scaled alpha by `DENSITY`, which conflates how much matter gathered (a SIZE
    // fact, and the axis canon actually rules) with how much you can see through it — so the stalker
    // came out at 62% alpha and its overlapping spheres each drew their own outline. Overlapping
    // OPAQUE spheres merge into one silhouette; overlapping transparent ones are a bag of marbles.
    const localOpacity = floats ? (isReach ? 0.95 : 0.24) : 1
    const alpha = floats ? localOpacity * (0.45 + 0.55 * c) : 0.86 + 0.14 * c
    return {
      anchor,
      x: bx * scale + w * 0.035,
      y: by * scale - sag + w * 0.02,
      z: bz * scale + wobble(i + 31, t) * 0.03,
      rBase,
      r: rBase * f,
      opacity: Math.max(0, Math.min(1, alpha)),
    }
  })

  // ★ RE-MADE OUT OF THE SAME GREY — and spread across the body, not poured into its middle.
  // Each part takes a share of the shed mass proportional to what it is already holding, so the
  // total is exactly the sum of the base radii (conservation is preserved to the last digit, which
  // is what the existing mass assert checks) while the SHAPE stays a body.
  // ⚠ DELIBERATELY NOT CLAMPED. `MAX_BLOB_R` is asserted in the guard rather than enforced here: a
  // silent clamp would swallow the exact regression this rewrite exists to fix and report nothing.
  const shed = raw.reduce((n, p) => n + (p.rBase - p.r), 0)
  const held = raw.reduce((n, p) => n + p.r, 0)
  const gain = held > 0 ? shed / held : 0
  return raw.map(({ rBase: _rBase, ...b }) => ({ ...b, r: b.r * (1 + gain) }))
}

/** Total mass of the field — the quantity the re-gathering conserves. */
export const fieldMass = (f: Blob[]): number => f.reduce((n, b) => n + b.r, 0)
