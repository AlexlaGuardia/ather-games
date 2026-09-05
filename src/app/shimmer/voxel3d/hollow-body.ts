/**
 * A HOLLOW'S BODY IN THE WORLD — the bipedal field, as a scene-graph object the world can own.
 *
 * ★★★ WHY THIS EXISTS (2026-09-05, sprites lane). `hollow-pose.ts` has carried the whole body plan
 * since 09-04 — twelve anchors, a stride, a cohere loop, conserved mass — and **nothing in the game
 * has ever drawn it.** `VoxelWorld.tsx` spawns `new THREE.Mesh(hollowGeo[form], …)`, and
 * `hollow-look.ts:createHollowGeo` is an icosahedron, a cone and an octahedron. So every Hollow a
 * player has ever met was one primitive. Alex, looking at the bench: *"the blob isnt the right
 * look.. lets give them phisical bodies"* — and `design-briefs/hollows.md` has said
 * **upright, bipedal, plantigrade, heavy in the heel** since 08-15, from his own 08-14 concept.
 * This is not a new look. It is the ruled look, finally reaching the world.
 *
 * ── ⚠ THIS MODULE CHANGES THE SHAPE AND DELIBERATELY NOT THE MATERIAL ─────────────────────────
 * Whether a Hollow may carry `emissive` at all is an OPEN canon conflict (the brief lists it under
 * *what would break it*; `createHollowMat` ships it at `selfLight: 0.15` because `spawnDark` refuses
 * block light and at 0 a Hollow was invisible). That question is Alex's and Magii's, and the hollow
 * bench exists to answer it. So every material here is **cloned from the shipped `createHollowMat`**
 * rather than invented, and the only thing varied is per-blob alpha. A body change that also
 * smuggled in a material change would make the bench's comparison unreadable, and would decide an
 * open canon question by shipping it.
 *
 * ── WHY A GROUP OF SPHERES AND NOT A MESH ─────────────────────────────────────────────────────
 * The brief: *"Edges never resolve. Silhouette readable at distance and unreliable up close."*
 * Overlapping spheres give that in geometry rather than in a shader, and they let the body shed a
 * piece and re-gather it, which the brief calls its single most important animation note.
 *
 * ⚠⚠ ONE GEOMETRY AND EIGHTEEN MATERIALS FOR THE WHOLE WORLD, NOT PER BODY. A material per body is
 * a shader program per body — the allocation that got this page blocked from WebGL on 2026-08-06,
 * and twelve blobs per Hollow would be twelve programs each. Three forms × six alpha buckets are
 * built once, lazily, and shared by every Hollow alive.
 *
 * ── THE NESTING IS LOAD-BEARING ───────────────────────────────────────────────────────────────
 * `createHollowBody` returns an OUTER group that this module never touches after construction, so
 * the world keeps owning world position, facing and the spawn scale-up ("rises from nothing — the
 * forming IS the tell"). The pose's own bob and lean go on an INNER pivot. Without that split,
 * `updateHollowBody` and the host would both be writing one transform and the last writer each
 * frame would win — which reads as a Hollow that stutters for no visible reason.
 *
 * Run: `npx tsx src/app/shimmer/voxel3d/hollow-body.test.ts`
 */
import * as THREE from 'three'
import { hollowPose, hollowField, REST, FORM_SCALE, type Anchor } from './hollow-pose'
import { createHollowMat, type HollowForm } from './hollow-look'

/** How many shared alpha buckets stand in for per-blob opacity. Mirrors `HollowDoll`'s bench value. */
export const BUCKETS = 6

/** Unit sphere, scaled per blob. One buffer for every Hollow in the world. */
let SPHERE: THREE.SphereGeometry | null = null
/** form → six materials of rising opacity, cloned from the shipped look. */
let MATS: Record<HollowForm, THREE.MeshLambertMaterial[]> | null = null

const bucketOf = (o: number) => Math.max(0, Math.min(BUCKETS - 1, Math.round(o * (BUCKETS - 1))))

function shared(): { sphere: THREE.SphereGeometry; mats: Record<HollowForm, THREE.MeshLambertMaterial[]> } {
  if (!SPHERE) SPHERE = new THREE.SphereGeometry(1, 10, 8)
  if (!MATS) {
    // ★ CLONED FROM THE SHIPPED MATERIAL, NEVER RETYPED FROM ITS NUMBERS. A hand-kept copy of
    // another module's values agrees with it right up until somebody edits one, and then it is
    // confidently wrong with nothing to catch it (PATTERNS 2026-08-22, the hand-kept mirror).
    const base = createHollowMat()
    const forForm = (f: HollowForm) => {
      const out: THREE.MeshLambertMaterial[] = []
      // ⚠ A `for`, not `Array.from(…, () => new Material)` — `render-audit.test.ts` reads an
      // anonymous callback around a GPU construction as the per-object allocation shape, and it is
      // right to: it cannot tell a bounded six from an unbounded entity list.
      for (let i = 0; i < BUCKETS; i++) {
        const m = base[f].clone()
        m.opacity = base[f].opacity * (0.4 + (i / (BUCKETS - 1)) * 0.6)
        out.push(m)
      }
      base[f].dispose()      // the template itself is never rendered
      return out
    }
    MATS = { warden: forForm('warden'), stalker: forForm('stalker'), caster: forForm('caster') }
  }
  return { sphere: SPHERE, mats: MATS }
}

/**
 * THE SKELETON. Bones are empty groups; the blobs hang on them.
 *
 * ★★★ WHY THIS EXISTS (2026-09-05, sprites lane). `hollowPose` has computed a complete walk since
 * 09-04 — thigh swing, knees that fold one way, arms in opposition, head tilt — and **nothing ever
 * applied any of it.** The first version of this file read exactly two fields off the pose,
 * `bodyY` and `lean`, and left the other seven on the floor. So a Hollow did not walk; it was a
 * fixed cluster of spheres that bobbed. Alex, looking at it: *"this bubble body isnt working"* —
 * and he was right for a reason neither of us had named. It was not a surface problem. It was not
 * animated at all, and two passes of geometry work could not have fixed that.
 *
 * ⚠ THE POSE WAS FULLY TESTED THE WHOLE TIME. `hollow-pose.test.ts` asserts the knees never bend
 * backwards, the legs swing in opposition, a caster does not stride — all true, all green, and all
 * about numbers that reached nothing. A guard on a producer says nothing about whether a consumer
 * exists. `walk-reaches-the-rig` at the bottom of `hollow-body.test.ts` is the assert that was
 * missing, and it is a claim about the SCENE GRAPH, not about the pose.
 *
 * ── RIGID PARTS, NOT SKINNING, AND THAT IS A CANON CHOICE AS MUCH AS A COST ONE ────────────────
 * This is the `MoglinDoll` technique (`play3d/MoglinDoll.tsx`): parts parented to joints, joints
 * rotated from a pose function, no `SkinnedMesh`, no bone weights, no authored model. It needs no
 * art and no external tool. It is also what claymation IS — rigid parts posed, never a skin
 * deformed — and a Hollow must *"never hold a crisp shape"*, which a skinned mesh is built to do.
 */
type BoneName =
  | 'root' | 'chest' | 'head'
  | 'armL' | 'foreL' | 'armR' | 'foreR'
  | 'thighL' | 'shinL' | 'thighR' | 'shinR'

/** Each bone's ORIGIN is an anchor's rest position, and its parent is the bone above it. */
const BONE: Record<BoneName, { at: Anchor; parent: BoneName | null }> = {
  root: { at: 'hip', parent: null },
  chest: { at: 'chest', parent: 'root' },
  head: { at: 'head', parent: 'chest' },
  armL: { at: 'armL', parent: 'chest' },
  foreL: { at: 'elbowL', parent: 'armL' },
  armR: { at: 'armR', parent: 'chest' },
  foreR: { at: 'elbowR', parent: 'armR' },
  thighL: { at: 'thighL', parent: 'root' },
  shinL: { at: 'kneeL', parent: 'thighL' },
  thighR: { at: 'thighR', parent: 'root' },
  shinR: { at: 'kneeR', parent: 'thighR' },
}

/**
 * Which bone each blob hangs on.
 *
 * ★ A blob below a joint rides the bone BELOW it, which is what makes a limb bend instead of
 * stretch: `shinL`, `footL` and the knee itself all ride the shin bone, so rotating that bone
 * swings the whole lower leg as one piece.
 */
const ATTACH: Record<Anchor, BoneName> = {
  hip: 'root', gut: 'root', chest: 'chest', head: 'head',
  armL: 'armL', elbowL: 'foreL', handL: 'foreL',
  armR: 'armR', elbowR: 'foreR', handR: 'foreR',
  thighL: 'thighL', kneeL: 'shinL', shinL: 'shinL', footL: 'shinL',
  thighR: 'thighR', kneeR: 'shinR', shinR: 'shinR', footR: 'shinR',
}

const BONE_ORDER = Object.keys(BONE) as BoneName[]

/** The pivot the pose writes to. Named so the host cannot mistake it for a blob. */
const PIVOT = 'hollowPivot'

/**
 * One Hollow's body: an outer group for the world to place, an inner pivot for the pose, and twelve
 * blobs. Blob order matches `hollowField`'s, and `updateHollowBody` relies on that.
 */
export function createHollowBody(form: HollowForm): THREE.Group {
  const { sphere, mats } = shared()
  const scale = FORM_SCALE[form]
  const outer = new THREE.Group()
  const pivot = new THREE.Group()
  pivot.name = PIVOT
  outer.add(pivot)

  // Bones first, parented, each offset from the bone above it. Empty groups: they carry no geometry
  // and cost nothing to draw — they exist so a rotation can move everything hanging below them.
  const bones = {} as Record<BoneName, THREE.Group>
  for (const name of BONE_ORDER) {
    const g = new THREE.Group()
    g.name = name
    bones[name] = g
  }
  for (const name of BONE_ORDER) {
    const { at, parent } = BONE[name]
    const [x, y, z] = REST[at]
    const [px, py, pz] = parent ? REST[BONE[parent].at] : [0, 0, 0]
    bones[name].position.set((x - px) * scale, (y - py) * scale, (z - pz) * scale)
    ;(parent ? bones[parent] : pivot).add(bones[name])
  }

  // Then the blobs, each on its bone, at its offset from that bone's origin.
  for (const b of hollowField(0, form)) {
    const m = new THREE.Mesh(sphere, mats[form][bucketOf(b.opacity)])
    m.name = b.anchor
    m.scale.setScalar(Math.max(1e-3, b.r))
    bones[ATTACH[b.anchor]].add(m)
  }
  return outer
}

/**
 * Advance one body to time `t`. Writes ONLY the inner pivot and the blobs — never the outer group,
 * which belongs to the host (see the header).
 *
 * ⚠ MATERIALS ARE RE-BUCKETED, NOT MUTATED. Setting `.opacity` on a shared material here would
 * change every Hollow in the world that happens to share the bucket, on the frame one of them
 * dissolved. Swapping which shared material a blob points at is free and affects only that blob.
 */
export function updateHollowBody(body: THREE.Group, t: number, form: HollowForm, speed = 0): void {
  const pivot = body.children.find(c => c.name === PIVOT) as THREE.Group | undefined
  if (!pivot) return
  const { mats } = shared()
  const p = hollowPose(t, form, speed)
  const field = hollowField(t, form)
  const scale = FORM_SCALE[form]

  pivot.position.y = p.bodyY

  // ★★ THE WALK, FINALLY REACHING THE SCENE GRAPH. Every angle the pose computes is applied here;
  // if you add one to `HollowPose`, add it here too, or it joins the seven that were being thrown
  // away. `walk-reaches-the-rig` in the guard fails if any of these stops moving.
  const bone = (n: BoneName) => pivot.getObjectByName(n) as THREE.Group | null
  const set = (n: BoneName, rx: number, rz = 0) => {
    const g = bone(n)
    if (g) { g.rotation.x = rx; g.rotation.z = rz }
  }
  set('root', p.lean)
  // Canon: the head has no face and does not look at you. What moves is the TILT of the mass.
  set('head', 0, p.headTilt)
  set('armL', p.armL); set('armR', p.armR)
  set('foreL', p.elbowL); set('foreR', p.elbowR)
  set('thighL', p.thighL); set('thighR', p.thighR)
  set('shinL', p.shinL); set('shinR', p.shinR)

  // The substance still sheds and re-gathers on top of the walk — the two are independent, which is
  // the point: a Hollow is losing itself WHILE it comes for you, not instead of.
  for (const b of field) {
    const m = pivot.getObjectByName(b.anchor) as THREE.Mesh | null
    if (!m) continue
    const [ox, oy, oz] = REST[BONE[ATTACH[b.anchor]].at]
    m.position.set(b.x - ox * scale, b.y - oy * scale, b.z - oz * scale)
    // ⚠ NEVER 0. A zero scale is a degenerate matrix; three.js warns and a normal can go NaN.
    m.scale.setScalar(Math.max(1e-3, b.r))
    m.material = mats[form][bucketOf(b.opacity)]
  }
}

/**
 * Release the shared geometry and materials. The host calls this on unmount, exactly where it used
 * to dispose `hollowGeo` / `hollowMat`.
 *
 * ⚠ Safe to call with bodies still in the scene, and safe to call twice: the next
 * `createHollowBody` rebuilds the shared set lazily.
 */
export function disposeHollowBodies(): void {
  SPHERE?.dispose()
  SPHERE = null
  if (MATS) for (const f of ['warden', 'stalker', 'caster'] as const) for (const m of MATS[f]) m.dispose()
  MATS = null
}
