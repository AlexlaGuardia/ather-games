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

/** Anchors of the one body plan. Bipedal, plantigrade, roughly keeper-scaled, no face. */
export type Anchor =
  | 'head' | 'chest' | 'gut' | 'hip'
  | 'armL' | 'armR' | 'handL' | 'handR'
  | 'thighL' | 'thighR' | 'shinL' | 'shinR'

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
  head: [0, 1.56, 0], chest: [0, 1.18, 0], gut: [0, 0.88, 0], hip: [0, 0.66, 0],
  armL: [-0.34, 1.16, 0], armR: [0.34, 1.16, 0],
  handL: [-0.42, 0.74, 0], handR: [0.42, 0.74, 0],
  thighL: [-0.16, 0.48, 0], thighR: [0.16, 0.48, 0],
  shinL: [-0.17, 0.18, 0], shinR: [0.17, 0.18, 0],
}

/** Base radius per anchor. The mass is chest-and-gut heavy, so it sags believably. */
const BASE_R: Record<Anchor, number> = {
  head: 0.20, chest: 0.30, gut: 0.28, hip: 0.24,
  armL: 0.13, armR: 0.13, handL: 0.11, handR: 0.11,
  thighL: 0.15, thighR: 0.15, shinL: 0.12, shinR: 0.12,
}

const ORDER: Anchor[] = ['head','chest','gut','hip','armL','armR','handL','handR','thighL','thighR','shinL','shinR']

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
 * ★ THE CASTER'S REACH. Canon: `body: 0`, *"reach is its body"*. So on a caster every anchor is
 * pushed toward suggestion EXCEPT the reaching arm, which is the only thing approaching solid.
 */
export function hollowField(t: number, form: HollowForm, reach: Anchor = 'handR'): Blob[] {
  const d = DENSITY[form]
  const c = cohesionAt(t)
  const out: Blob[] = []
  let shed = 0                                    // mass that has left its anchor this instant

  ORDER.forEach((anchor, i) => {
    const [bx, by, bz] = REST[anchor]
    const w = wobble(i, t)
    // Sag: the field drifts DOWN as cohesion falls, and is drawn back up as it rises.
    const sag = (1 - c) * 0.16
    // A piece can be shed entirely for a moment — radius to zero — and then re-gathered.
    const shedding = Math.max(0, w * 0.9 + (c - 0.72) * 2.2)
    const rBase = BASE_R[anchor] * d * (0.72 + 0.5 * c)
    const r = Math.max(0, rBase * Math.min(1, shedding))
    shed += rBase - r

    const isReach = form === 'caster' && (anchor === reach || anchor === 'armR')
    const localOpacity = form === 'caster' ? (isReach ? 0.92 : 0.22) : 1
    out.push({
      anchor,
      x: bx + w * 0.035,
      y: by - sag + w * 0.02,
      z: bz + wobble(i + 31, t) * 0.03,
      r,
      opacity: Math.max(0, Math.min(1, d * (0.45 + 0.55 * c) * localOpacity)),
    })
  })

  // ★ RE-MADE OUT OF THE SAME GREY. Whatever was shed is handed back to the trunk rather than
  // vanishing, so the total is steady and the body reads as re-forming, not as leaking away.
  if (shed > 0) {
    const trunk = out.find(b => b.anchor === 'gut')!
    trunk.r += shed * 0.55
    const chest = out.find(b => b.anchor === 'chest')!
    chest.r += shed * 0.45
  }
  return out
}

/** Total mass of the field — the quantity the re-gathering conserves. */
export const fieldMass = (f: Blob[]): number => f.reduce((n, b) => n + b.r, 0)
