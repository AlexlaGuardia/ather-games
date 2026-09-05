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
import { hollowPose, hollowField } from './hollow-pose'
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

/** The pivot the pose writes to. Named so the host cannot mistake it for a blob. */
const PIVOT = 'hollowPivot'

/**
 * One Hollow's body: an outer group for the world to place, an inner pivot for the pose, and twelve
 * blobs. Blob order matches `hollowField`'s, and `updateHollowBody` relies on that.
 */
export function createHollowBody(form: HollowForm): THREE.Group {
  const { sphere, mats } = shared()
  const outer = new THREE.Group()
  const pivot = new THREE.Group()
  pivot.name = PIVOT
  for (const b of hollowField(0, form)) {
    const m = new THREE.Mesh(sphere, mats[form][bucketOf(b.opacity)])
    m.position.set(b.x, b.y, b.z)
    m.scale.setScalar(Math.max(1e-3, b.r))
    pivot.add(m)
  }
  outer.add(pivot)
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
  pivot.position.y = p.bodyY
  pivot.rotation.x = p.lean
  for (let i = 0; i < field.length && i < pivot.children.length; i++) {
    const b = field[i]
    const m = pivot.children[i] as THREE.Mesh
    m.position.set(b.x, b.y, b.z)
    // ⚠ NEVER 0. A zero scale is a degenerate matrix, and three.js will warn and can NaN a normal.
    // `hollow-pose`'s SHED_FLOOR means this should not arise, but a renderer must not depend on
    // another module's floor holding — that is the hand-kept-mirror trap wearing a numeric costume.
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
