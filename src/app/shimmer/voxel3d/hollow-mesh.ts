/**
 * THE MODELLED HOLLOW — an actual body, lofted from cross-sections, skinned to the eleven bones.
 *
 * ★★★ WHY THIS EXISTS, AND IT IS ALEX'S SENTENCE TWICE (2026-09-06, sprites lane).
 * *"the blobs arent the play, try a 3d model version"*, and then, after an evening that rewrote the
 * SURFACE three times — solid, wet clay, a fused marching-cubes field — *"it still looks the same."*
 * He was right and it was the finding. Every one of those passes changed how the eighteen spheres
 * were shaded or welded; **not one of them changed the eighteen spheres.** Fusing a join removes a
 * crease. It cannot invent a neck, a calf, a shoulder line or a foot that points forward, and at the
 * distance a Hollow is actually met, a crease is invisible and a silhouette is the whole read.
 *
 * ⚠ EVERY NUMBER CITED THAT NIGHT MEASURED THE SURFACING AND NONE MEASURED THE SHAPE. Vertex counts,
 * body heights, `0 anchors outside the cube` — all true, all green, all about whether the skin over
 * the spheres was correct. *Is it a good shape* was never asked by anything. So the asserts in this
 * module's guard are deliberately about ANATOMY — is there a waist narrower than the shoulders, does
 * a limb taper, is there a calf, does the foot reach forward — and each is measured on the blob body
 * too, as a positive control, because a guard that cannot tell a figure from a pile is decoration.
 *
 * ── WHAT THIS IS, MECHANICALLY ────────────────────────────────────────────────────────────────
 * Eight lofted chains (trunk, two arms, two legs, two feet) built from tables of cross-sections:
 * a centre, a radius, and an ellipse. Rings are stitched into quad strips, so the geometry is
 * MODELLED — the shoulders are wide because a station says so, the waist is narrow because a
 * station says so — and then bound as a `SkinnedMesh` to the same eleven bones `hollow-body.ts`
 * builds, driven by the same `hollowPose`.
 *
 * ── ⚠ THIS OVERTURNS A CLAIM `hollow-body.ts` MAKES, ON PURPOSE, AND HERE IS THE ARGUMENT ─────
 * That file says a `SkinnedMesh` is the wrong tool because a Hollow *"must never hold a crisp
 * shape"* and skinning is built to hold one. That was a fair reading and it is backwards. **Rigid
 * parts are the thing that cannot sag.** A sphere can move and can shrink; it cannot gutter at its
 * edge, cannot drip, cannot lose its outline on one side and keep it on the other. The brief calls
 * *"sags, sheds, drips and re-gathers"* its single most important animation note, and a skin with
 * a thousand vertices is the only one of the two surfaces that can actually do it — which is what
 * `deform()` below does, per vertex, every frame. Skinning buys the anatomy; the per-vertex
 * displacement takes the crispness back off. The blob body stays as the cheap surface and this is
 * the near one; which distance gets which is the world's call, not this module's.
 *
 * ── THE LOSING-ITSELF IS NOT A SECOND IMPLEMENTATION ──────────────────────────────────────────
 * The sag and shed are read straight out of `hollowField` — the same solved, guarded field the
 * blobs use — by giving every vertex inverse-square weights over the three nearest anchors. So the
 * mesh sags exactly where the blob body sags, and a future tuning of the cohere loop moves both.
 * A second hand-written sag law here would be the hand-kept mirror in its most tempting form
 * (PATTERNS 2026-08-22): a table of drift next to a table of drift, agreeing until somebody edits one.
 *
 * ── AND THE MATERIAL IS UNTOUCHED, FOR THE SAME REASON AS BEFORE ──────────────────────────────
 * Whether a Hollow may carry `emissive` is an OPEN canon conflict. A SHAPE commit that also moved
 * the look would decide it by shipping and would make the bench's comparison unreadable. So the
 * materials here are cloned from `createHollowMat` and nothing about them is varied.
 *
 * Run: `npx tsx src/app/shimmer/voxel3d/hollow-mesh.test.ts`
 */
import * as THREE from 'three'
import {
  hollowPose, hollowField, cohesionAt, REST, FORM_SCALE, DENSITY, REACH, type Anchor,
} from './hollow-pose'
import { BONE, boneName, applyHollowPose, type BoneName } from './hollow-body'
import { createHollowMat, setHollowBorrow, type HollowForm } from './hollow-look'
import { dayProgress, daylight } from '../engine/day-cycle'

/** The skinned mesh's node name, so a host or a guard can find it without walking by type. */
export const SKIN = 'hollowSkin'
/** The pose pivot. Same name `hollow-body` uses, because `applyHollowPose` looks bones up under it. */
const PIVOT = 'hollowPivot'

/**
 * How much of a form TRAILS OFF instead of gathering — one axis, derived from `DENSITY`.
 *
 * ★ THE BRIEF GIVES THIS AS A MODELLING INSTRUCTION, NOT A MOOD. The caster is *"mostly the
 * suggestion of a body, dense only where it is reaching"*, and *"the two that walk have feet
 * because they gathered enough to need them."* So the same number thins a caster's legs, fattens
 * the arm it reaches with, and decides whether feet exist at all. Deriving it from `DENSITY` is
 * what stops three forms becoming three creature designs — the brief's own named failure mode.
 */
const TRAIL: Record<HollowForm, number> = {
  warden: 0.75 * (1 - DENSITY.warden),
  stalker: 0.75 * (1 - DENSITY.stalker),
  caster: 0.75 * (1 - DENSITY.caster),
}

/**
 * How near a Hollow must be before its SKIN is re-deformed each frame, in blocks.
 *
 * ★★ THE POSE IS NOT GATED AND THE DEFORM IS, and the split is the whole LOD. Posing eleven bones
 * is eleven rotations; the per-vertex sag rewrites ~700 vertices and re-uploads the buffer, and the
 * world may hold twelve bodies. Beyond this the body still WALKS — at distance the silhouette is
 * the entire read, and a Hollow that stopped moving on the horizon would break the one tell canon
 * is built on. What it stops doing is re-guttering its skin, which nothing can resolve out there.
 *
 * ⚠ MEASURED IN THE HORIZONTAL PLANE, like every other range in the host. Despawn is
 * `viewRadius * SECTION` (96 blocks at r=6), so this is a small fraction of the live set.
 */
export const DEFORM_NEAR = 32

/** A form gathered enough to need feet. The brief's sentence, as a predicate. */
export const hasFeet = (f: HollowForm) => DENSITY[f] > 0.5

/**
 * One cross-section. `p` is the ring centre in unscaled body coordinates (feet at y=0, the same
 * frame `REST` is written in); `r` its radius; `e` the ellipse as [across, through] relative to the
 * chain's own sweep, so a chest can be wide and shallow and a foot can be flat.
 *
 * `b` is the bone this ring rides. `mb`/`mw` blend a SECOND bone in — that blend is the entire
 * reason a knee bends instead of scissoring, and the rings on either side of a joint carry it.
 */
export interface Station {
  p: [number, number, number]
  r: number
  e?: [number, number]
  b: BoneName
  mb?: BoneName
  mw?: number
}

type ChainKind = 'trunk' | 'arm' | 'leg' | 'foot'
export interface Chain { id: string; kind: ChainKind; radial: number; st: Station[] }

/**
 * ★★ THE ANATOMY LIVES HERE AND NOWHERE ELSE, and every y is answerable to `REST`.
 *
 * The joint stations sit exactly on their anchors (chest 1.19, elbow 0.945, knee 0.34 …) so the
 * skin and the skeleton cannot disagree about where a joint is; the stations BETWEEN them are the
 * modelling — a waist narrower than both the hips and the ribs, a shoulder shelf that is the widest
 * thing on the body, a neck, a calf bulge behind the knee, a foot that runs forward from the ankle.
 * None of those exist in a field of spheres and all of them are what "it still looks the same" was
 * about. The ellipses matter as much as the radii: a trunk that is round in plan reads as a barrel,
 * and every blob body ever built here has been round in plan.
 */
const TRUNK: Chain = {
  id: 'trunk', kind: 'trunk', radial: 16,
  st: [
    { p: [0, 0.560, 0],  r: 0.176, e: [1.10, 0.86], b: 'root' },
    { p: [0, 0.670, 0],  r: 0.200, e: [1.16, 0.86], b: 'root' },                       // hip — REST.hip
    { p: [0, 0.790, 0],  r: 0.184, e: [1.05, 0.88], b: 'root' },                       // waist, the pinch
    { p: [0, 0.900, 0],  r: 0.192, e: [1.02, 0.90], b: 'root', mb: 'chest', mw: 0.25 },// gut — REST.gut
    { p: [0, 1.045, 0],  r: 0.208, e: [1.12, 0.85], b: 'chest', mb: 'root', mw: 0.34 },// lower ribs
    { p: [0, 1.190, 0],  r: 0.224, e: [1.14, 0.80], b: 'chest' },                      // chest — REST.chest
    { p: [0, 1.280, 0],  r: 0.212, e: [1.24, 0.76], b: 'chest' },                      // shoulder shelf
    { p: [0, 1.350, 0],  r: 0.144, e: [1.14, 0.82], b: 'chest', mb: 'head', mw: 0.30 },// trapezius
    { p: [0, 1.402, 0],  r: 0.082, e: [1.00, 0.94], b: 'head', mb: 'chest', mw: 0.34 },// neck
    { p: [0, 1.452, 0],  r: 0.110, e: [0.94, 1.06], b: 'head' },                       // head base / jaw
    { p: [0, 1.516, 0],  r: 0.131, e: [0.92, 1.10], b: 'head' },                       // head — near REST.head
    { p: [0, 1.582, 0],  r: 0.116, e: [0.90, 1.06], b: 'head' },
    { p: [0, 1.646, 0],  r: 0.044, e: [0.88, 1.02], b: 'head' },                       // crown
  ],
}

/**
 * ⚠ A CHAIN'S FIRST STATION MUST SIT INSIDE THE TRUNK, NOT ON ITS SURFACE, AND ONLY A PICTURE SAYS SO.
 *
 * Every chain is capped at both ends so a silhouette cannot see through a limb — and a cap is a FLAT
 * DISC facing along the sweep. Put the first arm station at the shoulder's own width and that disc
 * lands proud of the torso as a flat plate stuck to each shoulder, and the same at the hips. It is
 * invisible to every assert in the guard (the vertices are finite, the weights sum to one, the
 * anatomy bands are all elsewhere) and it is the first thing the eye finds. So the arm and leg chains
 * BEGIN inboard and above, and emerge from inside the mass.
 */
const ARM_L: Chain = {
  id: 'armL', kind: 'arm', radial: 10,
  st: [
    { p: [-0.118, 1.316, 0],   r: 0.088, b: 'chest' },                                   // deltoid root — BURIED, see below
    { p: [-0.255, 1.145, 0],   r: 0.104, b: 'armL', mb: 'chest', mw: 0.42 },
    { p: [-0.265, 1.110, 0],   r: 0.098, b: 'armL' },                                    // REST.armL
    { p: [-0.288, 1.030, 0],   r: 0.086, b: 'armL' },
    { p: [-0.315, 0.945, 0],   r: 0.074, b: 'foreL', mb: 'armL', mw: 0.44 },             // REST.elbowL
    { p: [-0.326, 0.868, 0],   r: 0.070, b: 'foreL' },
    { p: [-0.334, 0.802, 0],   r: 0.048, b: 'foreL' },                                   // wrist
    { p: [-0.336, 0.762, 0.012], r: 0.062, e: [0.80, 0.56], b: 'foreL' },                // hand — near REST.handL
    { p: [-0.338, 0.716, 0.020], r: 0.030, e: [0.86, 0.46], b: 'foreL' },
  ],
}

const LEG_L: Chain = {
  id: 'legL', kind: 'leg', radial: 12,
  st: [
    { p: [-0.098, 0.664, 0],      r: 0.128, b: 'root' },                                  // hip socket — BURIED, see below
    { p: [-0.152, 0.556, 0],      r: 0.138, b: 'thighL', mb: 'root', mw: 0.42 },
    { p: [-0.160, 0.510, 0],      r: 0.128, b: 'thighL' },                                // REST.thighL
    { p: [-0.160, 0.428, 0],      r: 0.108, b: 'thighL' },
    { p: [-0.160, 0.340, 0],      r: 0.092, e: [1.00, 1.06], b: 'shinL', mb: 'thighL', mw: 0.44 }, // REST.kneeL
    { p: [-0.168, 0.272, -0.018], r: 0.098, e: [0.94, 1.14], b: 'shinL' },                // calf
    { p: [-0.172, 0.180, 0],      r: 0.076, b: 'shinL' },                                 // REST.shinL
    { p: [-0.178, 0.104, 0.008],  r: 0.052, b: 'shinL' },                                 // ankle
  ],
}

const FOOT_L: Chain = {
  id: 'footL', kind: 'foot', radial: 8,
  st: [
    { p: [-0.178, 0.054, -0.052], r: 0.058, e: [0.88, 0.74], b: 'shinL' },   // heel
    { p: [-0.180, 0.051, 0.012],  r: 0.070, e: [0.94, 0.62], b: 'shinL' },   // near REST.footL
    { p: [-0.181, 0.050, 0.082],  r: 0.060, e: [0.90, 0.56], b: 'shinL' },
    { p: [-0.182, 0.051, 0.134],  r: 0.034, e: [0.82, 0.44], b: 'shinL' },   // toe
  ],
}

/** L → R, by negating x and swapping the side of every bone it rides. Winding flips; the builder knows. */
const MIRROR: Partial<Record<BoneName, BoneName>> = {
  armL: 'armR', foreL: 'foreR', thighL: 'thighR', shinL: 'shinR',
}
const mirrored = (c: Chain): Chain => ({
  ...c,
  id: c.id.replace(/L$/, 'R'),
  st: c.st.map(s => ({
    ...s,
    p: [-s.p[0], s.p[1], s.p[2]] as [number, number, number],
    b: MIRROR[s.b] ?? s.b,
    mb: s.mb ? (MIRROR[s.mb] ?? s.mb) : undefined,
  })),
})

/** Which chains a form is made of. The caster has no feet because it never gathered enough for them. */
export function chainsFor(form: HollowForm): Chain[] {
  const out = [TRUNK, ARM_L, mirrored(ARM_L), LEG_L, mirrored(LEG_L)]
  if (hasFeet(form)) out.push(FOOT_L, mirrored(FOOT_L))
  return out
}

/**
 * A station's radius for a form. One number, `TRAIL`, drives the whole density axis.
 *
 * ⚠ IT ONLY EVER THINS THE PARTS THE BRIEF NAMES AND THICKENS THE ONE IT NAMES. A caster's legs
 * trail off toward the ankle, its lower trunk thins below the gut, and the arm it reaches with gets
 * denser — *"the reaching limb is the only part of a caster that is nearly solid."*
 */
export function radiusFor(c: Chain, i: number, form: HollowForm): number {
  const base = c.st[i].r
  const trail = TRAIL[form]
  if (trail <= 0) return base
  if (c.kind === 'leg') return base * (1 - trail * (i / (c.st.length - 1)))
  if (c.kind === 'foot') return base * (1 - trail)
  // ★★★ ONE ARM GATHERS AND THE OTHER TRAILS OFF, AND UNTIL 2026-09-08 BOTH DID THE SAME THING.
  // Canon is more specific here than anywhere else in the brief — *"dense only at the reaching
  // hand"*, *"reach is its body"*, *"the reaching limb is the only part of a caster that is nearly
  // solid"* — and the mesh answered it by thickening BOTH arms 25%, which says the opposite: a
  // symmetric body is a body, and the whole point is that a caster is not one. `hollowField` had
  // this right for the blob rig the entire time (`bulk` 2.0 on the reach, 0.62 everywhere else),
  // so the sentence was true of the surface nobody looks at and false of the shipped skin.
  // ⚠ THE SIDE COMES FROM `REACH`, not from a literal here. Two hand-kept copies of which arm it
  // is would agree until somebody moved the reach.
  if (c.kind === 'arm') {
    // ⚠ THE ASYMMETRY IS THE CASTER'S ALONE, AND THE FIRST CUT GAVE IT TO THE STALKER TOO. Gating
    // it on `trail > 0` handed a one-armed body to the form whose brief line is *"legible limbs"* —
    // canon says *"dense only at the reaching hand"* about the caster and nothing of the sort about
    // the other two. Caught by reading the numbers, not the picture: armR/armL came out 0.116/0.101
    // on a stalker, which is a visible difference nobody asked for.
    // ★ `hasFeet` IS THE PREDICATE, not `form === 'caster'`. It is the same fact — it never gathered
    // enough to get a stem down — and it is already the sentence this file uses to decide whether
    // feet exist at all, so the two cannot drift apart into two ideas of what a caster is.
    if (!hasFeet(form) && c.id === REACH.chain) return base * (1 + 0.55 * trail)
    if (hasFeet(form)) return base * (1 + 0.25 * trail)
    // The off arm is not a limb any more, it is one of the parts that *"trails off and does not
    // resolve"* — so it takes the LEG law, tapering to nothing toward the hand. Same expression,
    // not a similar-looking one: a second falloff curve beside the first is the drift this file
    // keeps paying for.
    return base * (1 - trail * (i / (c.st.length - 1)))
  }
  // ★★ TRUNK: TRAILS OFF OVER ITS WHOLE HEIGHT, AND HARDER BELOW THE GUT.
  // ⚠ THIS USED TO THIN BELOW THE GUT *ONLY*, which left a caster's chest, shoulders and neck at
  // FULL radius — byte-identical to a warden's, measured, and the trunk is the largest mass in the
  // silhouette. Rendered side by side the caster read as a warden without feet: the three-density
  // axis was being carried by feet and a little limb taper while the thing that dominates the
  // read did not move. The brief asks for *"mostly the suggestion of a body, dense only where it
  // is reaching"* — so the whole trunk has to answer the axis, not just the part under the gut.
  // ★ `trail * 0.5` is in-family rather than to taste: a leg already reaches `1 - trail` at its
  // tip, so half that over the trunk is the same axis, not a second dial. A warden is trail 0 and
  // is therefore untouched, which is the control.
  const y = c.st[i].p[1]
  const belowGut = trail * 0.55 * Math.max(0, Math.min(1, (0.90 - y) / 0.34))
  return base * (1 - trail * TRUNK_TRAIL - belowGut)
}

/* ─── shared GPU state: one material per form for the whole world, never one per body ─────────── */

let MATS: Record<HollowForm, THREE.MeshStandardMaterial> | null = null
function mats(): Record<HollowForm, THREE.MeshStandardMaterial> {
  // ★ CLONED FROM THE SHIPPED MATERIAL, NEVER RETYPED FROM ITS NUMBERS — the same rule, and the
  // same reason, as `hollow-body.ts`. A skinned draw compiles its own program from these, which is
  // why they are not simply borrowed from that module's bucket array.
  if (!MATS) {
    const base = createHollowMat()
    MATS = { warden: base.warden, stalker: base.stalker, caster: base.caster }
  }
  return MATS
}

/* ─── the loft ────────────────────────────────────────────────────────────────────────────────── */

const V = (a: [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2])

/**
 * Deterministic guttering noise in about [-1, 1], sampled at a POINT IN SPACE and a time.
 *
 * ★★★ SPATIAL, AND THE FIRST VERSION KEYED IT ON THE VERTEX INDEX, WHICH IS NOT THE SAME THING AT
 * ALL. Index-keyed noise is uncorrelated between neighbours, so two vertices a centimetre apart on
 * one ring pushed opposite ways and the body grew SPIKES — read in a render as flat shards hanging
 * off the shoulders. The brief asks for *"guttering at its edges like the frayed edges of a greyed
 * plot"*, which is a low-frequency sag, not high-frequency hash. Keyed on position, the wavelength
 * is about a body-width and the surface sags in patches, the way wet clay does.
 *
 * ⚠ It is INDEPENDENT of `hollow-pose`'s `wobble`, which is a temporal signal for a whole anchor.
 * That one moves where a mass IS; this one moves the skin over it.
 *
 * ⚠ NEVER `Math.random`. A random field cannot be asserted, cannot be reproduced from a screenshot,
 * and makes every mutation in the guard look like noise.
 */
const gutterNoise = (x: number, y: number, z: number, t: number): number =>
  0.55 * Math.sin(4.1 * y + 1.9 * x + t * 1.31) +
  0.45 * Math.sin(3.3 * z - 2.7 * y + 1.6 * x + t * 0.77 + 1.7)

interface Built {
  geo: THREE.BufferGeometry
  /** chain id per vertex, and the id list it indexes — the guard measures the TRUNK alone. */
  ids: string[]
  chain: Uint8Array
  /**
   * Station (ring) index per vertex within its chain; -1 for a cap centre.
   *
   * ⚠ THE GUARD CANNOT RECOVER THIS FROM THE GEOMETRY, AND ASSUMING IT COULD COST A GREEN RUN.
   * Grouping a chain's vertices by their y to rediscover its rings works on the trunk, whose
   * stations are all on the centre line so every ring is exactly horizontal — and silently gives
   * one group per VERTEX on a leg, whose tangent is tilted. Three anatomy asserts read `0.000` and
   * looked like a body with no ankle at all. The build knows which ring a vertex came from; it says so.
   */
  ring: Int32Array
  /** rest positions, in scaled model space — the base every frame's deform starts from. */
  rest: Float32Array
  /** outward unit normal at rest, per vertex. Displacement runs along it. */
  nrm: Float32Array
  /** the vertex's ring radius, so a thin part gutters less in absolute terms than a thick one. */
  rad: Float32Array
  /** three nearest anchors and their inverse-square weights. */
  regI: Int32Array
  regW: Float32Array
}

/** Build one form's geometry, in scaled model space, with skin weights. */
function buildGeometry(form: HollowForm, anchors: Anchor[], boneIndex: Record<string, number>): Built {
  const scale = FORM_SCALE[form]
  const pos: number[] = [], nor: number[] = [], uv: number[] = []
  const si: number[] = [], sw: number[] = [], rad: number[] = []
  const idx: number[] = []
  const chains = chainsFor(form)
  const ids = chains.map(c => c.id)
  const chain: number[] = []
  const ring: number[] = []

  for (const c of chains) {
    const cid = ids.indexOf(c.id)
    const n = c.st.length
    const R = c.radial
    const centres = c.st.map(s => V(s.p).multiplyScalar(scale))
    const radii = c.st.map((_, i) => radiusFor(c, i, form) * scale)

    // tangent per station: central difference, so a bend is smooth rather than kinked at one ring.
    const tan = centres.map((_, i) => {
      const a = centres[Math.max(0, i - 1)], b = centres[Math.min(n - 1, i + 1)]
      const t = new THREE.Vector3().subVectors(b, a)
      return t.lengthSq() < 1e-12 ? new THREE.Vector3(0, 1, 0) : t.normalize()
    })

    // cumulative arc length, for a v coordinate the noise texture can ride
    let arc = 0
    const arcs = centres.map((p, i) => (i === 0 ? 0 : (arc += p.distanceTo(centres[i - 1]))))
    const total = arc || 1

    // ★★★ A PARALLEL-TRANSPORTED FRAME, AND THE FIRST VERSION'S BUG IS WORTH THE PARAGRAPH.
    // It picked a reference axis PER STATION — world Y unless the tangent was within 26° of it,
    // then world Z. A leg's tangent crosses that threshold BETWEEN two adjacent rings, so ring 0 and
    // ring 1 were built in frames 90° apart and the quad strip between them TWISTED, surfacing as a
    // flat shard stuck to one shoulder and one hip. ⚠ It was invisible to all 51 asserts — the
    // vertices are finite, the weights sum to one, the anatomy bands are all elsewhere — and it is
    // the first thing the eye finds in a render. Carrying one frame along the chain by the minimal
    // rotation between consecutive tangents cannot twist by construction.
    //
    // ⚠ AND THE SEED IS WORLD X, NOT "whichever axis is least aligned". That is what makes a
    // station's `e` mean the SAME THING on every chain — [across the body, front to back] — so the
    // chest can be written wide-and-shallow and the calf deep-and-narrow and both come out as
    // written. The old rule silently swapped those two on the limbs.
    const frame: { u: THREE.Vector3; w: THREE.Vector3 }[] = []
    for (let i = 0; i < n; i++) {
      const t = tan[i]
      let u: THREE.Vector3
      if (i === 0) {
        const seed = Math.abs(t.x) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
        u = seed.addScaledVector(t, -seed.dot(t)).normalize()
      } else {
        u = frame[i - 1].u.clone().applyQuaternion(
          new THREE.Quaternion().setFromUnitVectors(tan[i - 1], t))
        u.addScaledVector(t, -u.dot(t)).normalize()      // re-orthogonalise against drift
      }
      frame.push({ u, w: new THREE.Vector3().crossVectors(t, u).normalize() })
    }

    const base = pos.length / 3
    for (let i = 0; i < n; i++) {
      const t = tan[i]
      const { u, w } = frame[i]
      const [e0, e1] = c.st[i].e ?? [1, 1]
      const r = radii[i]
      // taper along the sweep, for the analytic normal: dr/ds
      const dr = (radii[Math.min(n - 1, i + 1)] - radii[Math.max(0, i - 1)]) /
                 Math.max(1e-6, arcs[Math.min(n - 1, i + 1)] - arcs[Math.max(0, i - 1)])
      const bi = boneIndex[c.st[i].b]
      const mi = c.st[i].mb ? boneIndex[c.st[i].mb!] : bi
      const mw = c.st[i].mb ? (c.st[i].mw ?? 0.5) : 0

      for (let k = 0; k <= R; k++) {                       // seam duplicated: the uv must not wrap
        const th = (k / R) * Math.PI * 2
        const ca = Math.cos(th), sa = Math.sin(th)
        const off = new THREE.Vector3()
          .addScaledVector(u, e0 * ca * r).addScaledVector(w, e1 * sa * r)
        pos.push(centres[i].x + off.x, centres[i].y + off.y, centres[i].z + off.z)
        // ⚠ ANALYTIC, NOT `computeVertexNormals`. The seam column is duplicated for the uv, so an
        // averaged normal would differ across it and draw a visible stripe down every limb; and the
        // deform below moves positions every frame, which would make a re-averaged normal a
        // per-frame cost on top. An ellipse's outward normal divides by the axis it scaled.
        const nv = new THREE.Vector3()
          .addScaledVector(u, ca / e0).addScaledVector(w, sa / e1)
          .addScaledVector(t, -dr).normalize()
        nor.push(nv.x, nv.y, nv.z)
        uv.push(k / R, arcs[i] / total)
        rad.push(r); chain.push(cid); ring.push(i)
        si.push(bi, mi, 0, 0); sw.push(1 - mw, mw, 0, 0)
      }
    }
    // stitch. Mirrored chains have negated x, which reverses orientation, so their winding flips.
    const flip = c.id.endsWith('R')
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < R; k++) {
        const a = base + i * (R + 1) + k, b = a + 1, d = a + (R + 1), e = d + 1
        if (flip) idx.push(a, d, b, b, d, e)
        else idx.push(a, b, d, b, e, d)
      }
    }
    // caps, so the body is closed and a silhouette read cannot see through a limb
    for (const end of [0, n - 1]) {
      const t = tan[end].clone().multiplyScalar(end === 0 ? -1 : 1)
      const c0 = pos.length / 3
      pos.push(centres[end].x, centres[end].y, centres[end].z)
      nor.push(t.x, t.y, t.z); uv.push(0.5, arcs[end] / total); rad.push(radii[end]); chain.push(cid); ring.push(-1)
      si.push(boneIndex[c.st[end].b], boneIndex[c.st[end].b], 0, 0); sw.push(1, 0, 0, 0)
      const ringStart = base + end * (R + 1)
      for (let k = 0; k < R; k++) {
        const a = ringStart + k, b = ringStart + k + 1
        const front = (end === 0) !== flip
        if (front) idx.push(c0, b, a)
        else idx.push(c0, a, b)
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  const rest = new Float32Array(pos)
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2))
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(si), 4))
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(sw), 4))
  geo.setIndex(idx)
  ;(geo.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)

  // ── region weights: every vertex leans on the three nearest anchors, inverse-square ───────────
  // ★ THIS IS THE JOIN TO THE SOLVED FIELD. The sag, the shed and the re-gather are `hollowField`'s
  // and are already guarded there; this is the only line that decides HOW MUCH of each anchor's
  // motion a given piece of skin feels. Deriving it from distance means moving an anchor in `REST`
  // re-weights the skin automatically — a hand-written vertex-to-anchor table would not.
  const nv = rest.length / 3
  const regI = new Int32Array(nv * 3), regW = new Float32Array(nv * 3)
  const ap = anchors.map(a => V(REST[a]).multiplyScalar(scale))
  for (let i = 0; i < nv; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2]
    const d = ap.map((p, j) => ({ j, d: (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2 }))
    d.sort((a, b) => a.d - b.d)
    let sum = 0
    for (let s = 0; s < 3; s++) { const w = 1 / (d[s].d + 1e-4); regI[i * 3 + s] = d[s].j; regW[i * 3 + s] = w; sum += w }
    for (let s = 0; s < 3; s++) regW[i * 3 + s] /= sum
  }

  return { geo, ids, chain: new Uint8Array(chain), ring: new Int32Array(ring), rest, nrm: new Float32Array(nor), rad: new Float32Array(rad), regI, regW }
}

/** Per-body state the frame loop needs, hung off the group so the host holds nothing. */
interface Bodies { built: Built; form: HollowForm; ref: { x: number; y: number; z: number; r: number }[] }
const STATE = new WeakMap<THREE.Object3D, Bodies>()

/**
 * One modelled Hollow: an outer group for the world to place, a pivot for the pose, eleven bones,
 * and one skinned mesh.
 *
 * ⚠ THE NESTING IS THE SAME AS `hollow-body`'S AND FOR THE SAME REASON — the host owns the outer
 * group (world position, facing, the spawn scale-up), the pose owns the pivot. Two writers on one
 * transform is a Hollow that stutters for no visible reason.
 */
export function createHollowMeshBody(form: HollowForm): THREE.Group {
  const scale = FORM_SCALE[form]
  const outer = new THREE.Group()
  const pivot = new THREE.Group()
  pivot.name = PIVOT
  outer.add(pivot)

  // Bones, from `hollow-body`'s table — the SAME table the blob rig builds from, so the two
  // surfaces cannot disagree about where a joint is.
  const order = Object.keys(BONE) as BoneName[]
  const bones = {} as Record<BoneName, THREE.Bone>
  for (const n of order) { const b = new THREE.Bone(); b.name = boneName(n); bones[n] = b }
  for (const n of order) {
    const { at, parent } = BONE[n]
    const [x, y, z] = REST[at]
    const [px, py, pz] = parent ? REST[BONE[parent].at] : [0, 0, 0]
    bones[n].position.set((x - px) * scale, (y - py) * scale, (z - pz) * scale)
    ;(parent ? bones[parent] : pivot).add(bones[n])
  }
  const boneList = order.map(n => bones[n])
  const boneIndex: Record<string, number> = {}
  order.forEach((n, i) => { boneIndex[n] = i })

  const field0 = hollowField(0, form)
  const anchors = field0.map(b => b.anchor)
  const built = buildGeometry(form, anchors, boneIndex)

  const mesh = new THREE.SkinnedMesh(built.geo, mats()[form])
  mesh.name = SKIN
  // ⚠ A skinned bounding sphere is computed from the BIND pose and this body walks well outside it.
  // A Hollow that vanishes when it strides is the invisible-body bug this bench has already paid
  // for twice; the saving from culling one small mesh is not worth being able to lose it.
  mesh.frustumCulled = false
  pivot.add(mesh)
  pivot.updateMatrixWorld(true)
  mesh.bind(new THREE.Skeleton(boneList))

  STATE.set(outer, {
    built, form,
    ref: field0.map(b => ({ x: b.x, y: b.y, z: b.z, r: b.r })),
  })
  return outer
}

/**
 * Advance one modelled body to time `t`: the walk onto the bones, the losing-itself onto the skin.
 *
 * ⚠ THE POSE IS APPLIED BY `hollow-body.applyHollowPose`, NOT BY A COPY OF IT HERE. Eleven bone
 * names beside eleven angles is exactly the shape that drops seven of them on the floor the day
 * somebody adds a twelfth — which is what happened to the blob rig on 09-05 and stayed green.
 */
/**
 * What a hit does to the LOOK, handed in by the host (2026-09-11):
 *   `fray`   0..1, how much of the body is gone (`hollowFray`) — the skin gutters harder, the
 *            extremities first, so a nearly dispersed Hollow is visibly failing to hold. This IS
 *            the health read; canon has nothing in a Hollow to hang a bar on.
 *   `flinch` 0..1 with a direction — the body buckles (drops) and its top tilts AWAY along the
 *            round, spending itself over `FLINCH_S`. Applied on the pivot, which nothing else
 *            rotates, so the pose's own lean is untouched.
 */
export interface HollowHitLook { fray?: number; flinch?: number; fx?: number; fz?: number }
const FRAY_GAIN = 2.2       // at fray 1 the gutter term is 3.2× — measured to still read bipedal
const FLINCH_TILT = 0.5     // radians at flinch 1
const FLINCH_DROP = 0.16    // blocks of buckle at flinch 1
const _axis = new THREE.Vector3()

export function updateHollowMeshBody(
  body: THREE.Group, t: number, form: HollowForm, speed = 0, deformSkin = true, look?: HollowHitLook,
): void {
  // ★ THE HOUR DECIDES HOW MUCH ROOM THERE IS TO BORROW. Canon: *"in a greyfield there is nothing
  // to borrow, so a Hollow reads nearly matte; at the edge of a tended plot it goes glossy."* We
  // have no per-body sample of the ground yet, so the CLOCK stands in for it: full borrow at noon,
  // a trace at midnight. Here rather than in a rig component because this function is one of the
  // only two the world AND the bench both run every frame — see `setHollowBorrow`.
  setHollowBorrow(daylight(dayProgress()))
  const st = STATE.get(body)
  const pivot = body.children.find(c => c.name === PIVOT) as THREE.Group | undefined
  if (!st || !pivot) return
  applyHollowPose(pivot, hollowPose(t, form, speed))
  // The flinch: a buckle and a tilt away from the round. Zero flinch = identity, so a host that
  // passes nothing gets exactly the pose it always did (asserted byte-for-byte in the guard).
  const fl = look?.flinch ?? 0
  if (fl > 0) {
    const fx = look?.fx ?? 0, fz = look?.fz ?? 0
    pivot.position.y -= FLINCH_DROP * fl
    // Rotating `up` about (fz, 0, −fx) tips the top toward (fx, fz) — the way the round was going.
    _axis.set(fz, 0, -fx)
    if (_axis.lengthSq() > 1e-9) pivot.quaternion.setFromAxisAngle(_axis.normalize(), FLINCH_TILT * fl)
    else pivot.quaternion.identity()
  } else {
    pivot.quaternion.identity()
  }
  // ⚠ THE WALK IS UNCONDITIONAL AND THE SKIN IS NOT — see `DEFORM_NEAR`. A caller that gates the
  // whole update instead would freeze a distant Hollow mid-stride, which is the opposite of what
  // costs nothing to keep.
  if (deformSkin) deform(st, t, form, look?.fray ?? 0)
}

/**
 * Move every vertex: the anchors' own sag, their swell and shrink, and a per-vertex gutter.
 *
 * ★★ THIS IS THE HALF A RIGID BODY CANNOT DO, and it is the brief's most important animation note.
 * A sphere can shrink; only a skin can lose its edge on one side while holding it on the other.
 */
/**
 * How hard the skin gutters, per chain, for a form — *"always visibly losing itself"* as a number.
 *
 * ★★★ THE BUILD-TIME RADII WERE CARRYING THE WHOLE DENSITY AXIS, AND THE ANIMATION WAS FORM-BLIND.
 * `deform`'s swell term is a RATIO, `field[a].r / ref[a].r`, and `ref` is the same form's own field
 * at build time — so `hollowField`'s per-form `bulk` (2.0 on a caster's reach, 0.62 elsewhere)
 * cancels exactly out of the numerator and denominator and reaches the skin not at all. The gutter
 * term then scaled with the vertex's own ring radius, so **the form that should dissolve most
 * dissolved least**: a caster is thinner, so it moved less. Both halves said "solid".
 *
 * ⚠ THAT IS WHY THINNING THE TRUNK IN `radiusFor` DID NOT FIX THE READ. A thinner solid body is a
 * thinner SOLID BODY. *"The rest trails off and does not resolve"* is a claim about the surface
 * failing to hold still, not about how wide it is, and nothing in the pipe was making that claim.
 *
 * ★ THE REACH GOES THE OTHER WAY, and that asymmetry is the whole read: *"the reaching limb is the
 * only part of a caster that is nearly solid."* It gutters LESS than a warden does, so a crisp arm
 * hangs off a body that cannot keep its own edge.
 *
 * ⚠ A WARDEN IS `trail === 0` AND THEREFORE BYTE-IDENTICAL TO BEFORE — it is the control, and the
 * guard asserts it rather than trusting the arithmetic.
 */
const GUTTER = 0.30
const UNRESOLVED = 1.0
/**
 * How much of the trail axis the TRUNK takes. Raised from 0.5 to 1.0 on 2026-09-08.
 *
 * ★ 0.5 was argued as *"in-family — a leg reaches 1 - trail at its tip, so half that over the trunk
 * is the same axis"*, and the arithmetic was fine. Measured against the brief it was still not
 * enough: a caster's chest sat at 78% of a warden's and the trunk is the largest mass in the
 * silhouette, so *"mostly the suggestion of a body"* was being carried by feet, limb taper and 22%.
 * At 1.0 the trunk answers the axis as hard as a limb tip does, which is what makes the reaching
 * arm the widest thing on a caster — canon's *"reach is its body"* as a silhouette rather than as
 * a radius table.
 * ⚠ A WARDEN IS `trail === 0` AND IS THEREFORE UNTOUCHED AT ANY VALUE OF THIS. That is what makes
 * it safe to move: the constant can only ever act on the forms canon says are less gathered.
 */
const TRUNK_TRAIL = 1.0
export function gutterFor(chainId: string, form: HollowForm): number {
  const trail = TRAIL[form]
  if (trail <= 0) return GUTTER
  // Same gate as the radius, same reason: only the form that never gathered a stem has a part that
  // is exempt from losing itself. A stalker trails all over — that is its whole line.
  if (!hasFeet(form) && chainId === REACH.chain) return GUTTER * (1 - trail)
  return GUTTER + UNRESOLVED * trail
}

function deform(st: Bodies, t: number, form: HollowForm, fray = 0): void {
  const { built, ref } = st
  const field = hollowField(t, form)
  // ★ FRAY RIDES THE GUTTER TERM, not the swell: a hurt Hollow does not shrink, it stops holding
  // its edge — the brief's "always visibly losing itself", turned up by what it has lost.
  const loose = (1 - cohesionAt(t)) * (1 + FRAY_GAIN * Math.max(0, Math.min(1, fray)))
  // Per-chain, resolved once per frame rather than per vertex — `built.chain[i]` indexes `built.ids`.
  const gut = built.ids.map(id => gutterFor(id, form))
  const n = built.rest.length / 3
  const attr = built.geo.getAttribute('position') as THREE.BufferAttribute
  const P = attr.array as Float32Array

  // per-anchor drift from its own rest, and how swollen it is right now
  const dx = new Float32Array(field.length), dy = new Float32Array(field.length)
  const dz = new Float32Array(field.length), kk = new Float32Array(field.length)
  for (let a = 0; a < field.length; a++) {
    dx[a] = field[a].x - ref[a].x; dy[a] = field[a].y - ref[a].y; dz[a] = field[a].z - ref[a].z
    // ⚠ CLAMPED. A shed anchor's radius can approach the floor and a ratio near zero would collapse
    // the skin through itself; the silhouette must stay bipedal through the whole cohere loop.
    kk[a] = Math.max(0.55, Math.min(1.5, field[a].r / Math.max(1e-6, ref[a].r)))
  }

  for (let i = 0; i < n; i++) {
    const i3 = i * 3
    let ox = 0, oy = 0, oz = 0, swell = 0
    for (let s = 0; s < 3; s++) {
      const a = built.regI[i3 + s], w = built.regW[i3 + s]
      ox += w * dx[a]; oy += w * dy[a]; oz += w * dz[a]; swell += w * kk[a]
    }
    const push = built.rad[i] * (swell - 1) +
      built.rad[i] * gut[built.chain[i]] * loose *
        gutterNoise(built.rest[i3], built.rest[i3 + 1], built.rest[i3 + 2], t)
    P[i3]     = built.rest[i3]     + ox + built.nrm[i3]     * push
    P[i3 + 1] = built.rest[i3 + 1] + oy + built.nrm[i3 + 1] * push
    P[i3 + 2] = built.rest[i3 + 2] + oz + built.nrm[i3 + 2] * push
  }
  attr.needsUpdate = true
}

/**
 * The built body's rest vertices, tagged by which chain each came from.
 *
 * ★ THIS EXISTS FOR THE GUARD, AND THE TAG IS WHAT MAKES THE ANATOMY ASSERTS POSSIBLE AT ALL. The
 * arms hang past the waist, so *"the shoulders are wider than the waist"* measured over every vertex
 * is measuring a hand. A silhouette claim about a torso has to be able to say which vertices are the
 * torso, and that has to come out of the BUILD rather than out of a y-band guess in the test — a
 * guess would keep agreeing with itself after somebody moved a station.
 */
export function meshParts(body: THREE.Group):
  { ids: string[]; chain: Uint8Array; ring: Int32Array; rest: Float32Array } | null {
  const st = STATE.get(body)
  return st ? { ids: st.built.ids, chain: st.built.chain, ring: st.built.ring, rest: st.built.rest } : null
}

/** Vertices, triangles and bones of a mounted body — the bench's cost readout. */
export function meshStats(body: THREE.Group): { verts: number; tris: number; bones: number } {
  const skin = body.getObjectByName(SKIN) as THREE.SkinnedMesh | null
  if (!skin) return { verts: 0, tris: 0, bones: 0 }
  const idx = skin.geometry.getIndex()
  return {
    verts: skin.geometry.getAttribute('position').count,
    tris: idx ? idx.count / 3 : 0,
    bones: skin.skeleton ? skin.skeleton.bones.length : 0,
  }
}

/** Release one body's geometry. The geometry is PER BODY — the deform writes to it every frame. */
export function disposeHollowMeshBody(body: THREE.Group): void {
  const skin = body.getObjectByName(SKIN) as THREE.SkinnedMesh | null
  skin?.geometry.dispose()
  skin?.skeleton?.dispose()
  STATE.delete(body)
}

/** Release the shared materials. Safe with bodies still in the scene, and safe to call twice. */
export function disposeHollowMeshes(): void {
  if (MATS) for (const f of ['warden', 'stalker', 'caster'] as const) MATS[f].dispose()
  MATS = null
}
