// THE SEAM — what a keeper's own front door looks like, on both sides of it.
//
// ★ PURE MATH + ONE PASS. The anchors are exported plain functions with no THREE in them, because
// what this file must not get wrong is WHERE the shimmer stands, and that is testable; the shader is
// the part only Alex's eye can judge.
//
// ── ★ WHAT CANON GIVES, AND IT GIVES A LOT MORE THAN "MAKE IT GLOW" ─────────────────────────────
// `game/shimmer-geography.md` (ruled 2026-07-31): a threshold is *"a soft seam in the cloud, a
// shimmer in the air, ground that simply continues. No gates, no locks, no keep-out… A build or a
// book that puts a locked gate on a plot has misread the world."* Three of those clauses are
// instructions to a renderer and each one kills an obvious first draft:
//
//   1. **"ground that simply continues"** ⇒ NOTHING IS DRAWN ON THE GROUND. No pad, no ring, no
//      glowing doorstep. The alpha envelope goes to zero at the quad's bottom edge, so the terrain
//      under the seam is untouched terrain. The tell lives entirely in the air.
//   2. **"no gates"** ⇒ NO FRAME, NO ARCH, NO LINTEL, and — less obviously — no visible rectangle.
//      The quad is 10 blocks wide because the trigger is, but a 10x7 lit slab IS the doorway
//      silhouette canon names as the misreading. So the quad is a CANVAS, not the shape: the alpha
//      falls to zero at all four edges and what remains is a crease down the middle.
//   3. **"a soft seam"** ⇒ IT IS A PARTING, NOT A LAMP. The Wilds wall behind it is pale pressed
//      cloud, and a bright additive glow on a pale wall washes out into a smear. So the seam reads
//      the way a parting in something soft and thick actually reads: a narrow COOL DARK slit (you
//      are seeing into the fold) with bright breathing rims either side of it. That also gives the
//      one thing a glow cannot — depth, which is the whole claim the mechanic makes.
//
// ── ★ THE PARTING WIDENS AS THE KEEPER COMES TO IT, AND THAT IS THE FEATURE ─────────────────────
// Canon's other half: *"To any other hand, the fold lies flat… The world's answer to trespass is
// that there is no door there for you."* So the seam is not lit scenery that happens to sit where a
// trigger is — it ANSWERS the keeper. Far away it is a hairline you could mistake for a crack in the
// cloud; walking up to it, it parts. `uNear` is that, and it is also the honest signal that the
// crossing is about to fire. When visiting ships, a guest gets `uNear` pinned at 0 and sees a flat
// wall, with no other change to this file.
//
// ── ⚠⚠ THE HONESTY RULE, WHICH IS THE ONLY THING HERE THAT CAN SHIP A BUG ───────────────────────
// **The drawn seam must sit strictly inside the volume that actually fires the crossing.** A
// shimmer drawn one block wider than `inPassageVolume` accepts is a keeper walking into their own
// front door and having nothing happen — a dead door, with no error, no log, and no way to tell it
// from a broken save. `seam.test.ts` asserts the footprint against the real trigger predicate rather
// than against a copy of its numbers, so a retune of `passageWidth` cannot silently break the pact.
// The margins below are what makes that assert have teeth; do not close them to "fill the doorway".

import * as THREE from 'three'
import { shellRadiusAt, type BubbleConfig } from '../voxel/bubble'
import { DEFAULT_PLOT, plotThreshold, type PlotConfig } from '../voxel/plot'
import { columnHeight } from '../voxel/height'
import type { Space } from './save'

/** Where a seam stands, how big it is drawn, and which way it faces. Blocks and radians. */
export interface SeamAnchor {
  x: number
  z: number
  /** Ground level at the anchor — the quad's BOTTOM edge, never its centre. */
  y: number
  /** Outward normal of the crease, in radians. Unused by the plot's seam; see `plotSeamAnchor`. */
  bearing: number
  halfWidth: number
  height: number
}

/** One column of the Wilds seam: where it stands, and the strip of air it occupies there. */
export interface SeamRib {
  x: number
  z: number
  /** Ground at THIS column — the bottom of the ribbon, which is not level across the door. */
  yb: number
  yt: number
}

/**
 * ★ MARGINS, NOT FILL. Each is a fraction of what the trigger accepts, and the gap between the
 * drawn edge and the trigger's edge is deliberate slack: the visual promises less than the mechanic
 * delivers, so the keeper never finds an edge of shimmer that does nothing.
 */
const WILDS_WIDTH_FRAC = 0.85
const WILDS_HEIGHT_FRAC = 0.9

/**
 * How far the ribbon stands off the wall's outer face, in blocks.
 *
 * ⚠ IT LIVES IN A ONE-BLOCK CORRIDOR AND BOTH WALLS OF IT ARE REAL: below `thickness` the shimmer is
 * inside solid cloud (invisible — reads as "the feature never shipped"), at or past `thickness + 1`
 * it is outside the crossing volume (visible, and it does nothing — a dead door). Anything that
 * widens the wall or narrows the trigger's outer margin has to revisit this number, and `seam.test`
 * asserts both edges so it cannot drift quietly.
 */
const SEAM_STANDOFF = 0.5

/** Columns across the doorway. Enough that the ribbon reads as curved, not as a folded plank. */
const SEAM_RIBS = 12

/**
 * ── ★★ THE KEEPER'S ONLY WAY OUT MUST BE VISIBLE FROM ACROSS THEIR OWN GARDEN (2026-08-18) ──────
 * Alex: *"my player is still trapped in the home plot with no way out."* Everything worked — the
 * threshold was where it should be, the two-way rule was live, the panel opened when you stood in
 * the right spot. **The spot was a 1.6-block circle on a wall 190 blocks around, marked by a crease
 * that only began to draw within 7 blocks of it.** Standing anywhere else in your garden, the wall
 * was featureless in every direction. That is not a door with a bug; it is a door nobody can find,
 * and the fault was mine for sizing the LOOK against the trigger instead of against the job.
 *
 * ★ THE OLD NOTE HERE ARGUED THE OPPOSITE AND WAS WRONG IN ITS PREMISE. It said the plot's seam
 * should be narrow *because* its trigger was narrow — *"drawing the two at the same size would make
 * one of them lie."* True, and it fixed the wrong half: the honest move is to widen the TRIGGER to
 * something a walking keeper can hit, then draw a seam that says so. A door you can see and cannot
 * enter is a bug; a door you can enter and cannot see is a sealed garden.
 *
 * ⚠ AND IT HAS TO SCALE WITH THE FOLD. At the r30 starting plot a 7-block draw was merely bad; at
 * the r300 plot (2026-08-18) the wall is ~1,900 blocks around and a keeper could walk the perimeter
 * for ten minutes without passing the door. So the seam is a LANDMARK now — tall, and drawn from far
 * enough that turning on the spot anywhere inside a young fold will show it.
 */
const PLOT_NEAR_RADIUS = 3
const PLOT_WIDTH_FRAC = 0.85
/** Tall enough to clear the cloud-wall's own height and read as a beacon, not as a doorway. */
const PLOT_HEIGHT = 14

/**
 * ── ⚠⚠ WHY `cfg` IS REQUIRED HERE AND HAS NO DEFAULT ────────────────────────────────────────────
 * There are two bubble configs in this build and only one of them is the world. `DEFAULT_BUBBLE`
 * puts the door at bearing 0; the live `WILDS_BUBBLE` (`voxel/column.ts`) aims it at the glade,
 * ≈ -1.80 rad, because bubble.ts's own header says the build must aim the door at the player and
 * nothing in that module picks the spot. A defaulted parameter would let any call site draw the
 * keeper's front door **on the opposite side of a 3km wall from the actual doorway** by saying
 * nothing at all — visible only by walking a shell that is mostly featureless in both directions.
 *
 * So the config is a required argument, exactly as `milledYield` requires its station and
 * `hollowStep` requires its `Impair`: the third time this repo has ruled that an omitted parameter
 * must not be able to mean the wrong world. Fail-closed here is a type error at the call site.
 *
 * The Wilds-side seam: standing in front of the bubble's unbroken wall, on the passage bearing.
 *
 * ⚠ IT IS DERIVED FROM THE SHELL, NEVER STORED — the same rule `plotThreshold` states for the same
 * reason. `shellRadiusAt` wobbles per seed, so a hardcoded radius would put the shimmer inside the
 * wall on one world and floating in front of it on the next, and both look like a rendering bug
 * rather than the stale constant they are.
 */
export function wildsSeamAnchor(seed: number, cfg: BubbleConfig): SeamAnchor {
  const b = cfg.passageBearing
  // ★ ONE EVALUATION, NOT AN ITERATION: `shellRadiusAt` normalises its input, so it depends on the
  // BEARING alone and any point along the bearing gives the same answer.
  const r = shellRadiusAt(cfg.cx + Math.cos(b) * cfg.radius, cfg.cz + Math.sin(b) * cfg.radius, seed, cfg)
  const d = r + cfg.thickness + SEAM_STANDOFF
  const x = cfg.cx + Math.cos(b) * d
  const z = cfg.cz + Math.sin(b) * d
  return {
    x, z,
    y: columnHeight(Math.floor(x), Math.floor(z), seed),
    bearing: b,
    halfWidth: cfg.passageWidth * WILDS_WIDTH_FRAC,
    height: cfg.passageHeight * WILDS_HEIGHT_FRAC,
  }
}

/**
 * The Wilds seam as it is actually drawn: a CURVED ribbon that follows the wall and the ground.
 *
 * ── ⚠⚠ THIS IS NOT A REFINEMENT OF A FLAT QUAD. THE FLAT QUAD WAS WRONG, AND THE ORACLE FOUND IT ──
 * The first version stood a single flat 10-block plane in front of the wall and it failed the
 * honesty rule on **2 of 6 seeds** — not by a rounding error, by more than a block. Two independent
 * reasons, and the second is the one that would have been blamed on something else:
 *
 *   1. **THE WALL WOBBLES ACROSS THE DOORWAY.** `shellRadiusAt` is a function of bearing, and the
 *      passage spans a real arc of it. The trigger band is only `[r-1, r+thickness+1)` — one block
 *      of slack outside the wall — while the shell's radius moves further than that from one end of
 *      the door to the other. There is no flat placement that is inside the band at both ends on
 *      every seed. A margin cannot fix a shape error; it only picks which seeds it fails on.
 *   2. **THE GROUND UNDER THE DOOR IS NOT LEVEL.** A flat-bottomed quad on sloping terrain buries
 *      one end and floats the other — and a floating seam reads exactly like the "hole in the wall"
 *      canon forbids, arrived at by accident.
 *
 * So each rib is placed against ITS OWN column: its own shell radius, its own ground. That makes the
 * honesty rule hold **by construction on every seed** rather than by a margin that happens to clear.
 * The standoff is per-rib and constant, which is the whole point — the ribbon hugs the wall.
 */
export function wildsSeamRibbon(seed: number, cfg: BubbleConfig): SeamRib[] {
  // ★ SPANNED IN ANGLE, NOT IN BLOCKS. `inPassage` tests an ANGLE, so a ribbon measured in blocks
  // would drift out of the doorway the moment `radius` is retuned — the exact coupling `inPassage`'s
  // own comment explains it computes an angle to avoid.
  const half = (cfg.passageWidth / Math.max(1, cfg.radius)) * WILDS_WIDTH_FRAC
  const height = cfg.passageHeight * WILDS_HEIGHT_FRAC
  const ribs: SeamRib[] = []
  for (let i = 0; i <= SEAM_RIBS; i++) {
    const b = cfg.passageBearing + (i / SEAM_RIBS * 2 - 1) * half
    const r = shellRadiusAt(cfg.cx + Math.cos(b) * cfg.radius, cfg.cz + Math.sin(b) * cfg.radius, seed, cfg)
    const d = r + cfg.thickness + SEAM_STANDOFF
    const x = cfg.cx + Math.cos(b) * d, z = cfg.cz + Math.sin(b) * d
    const yb = columnHeight(Math.floor(x), Math.floor(z), seed)
    ribs.push({ x, z, yb, yt: yb + height })
  }
  return ribs
}

/**
 * The plot-side seam: the crease the keeper arrives through and leaves by.
 *
 * ★ NO INTRINSIC FACING, AND THAT IS WHY THIS ONE BILLBOARDS. The Wilds seam is a parting in a wall
 * and the wall has a face, so it is fixed. The plot's threshold is a POINT in open ground where a
 * fold opens — canon gives it no surface to be parallel to, and a fixed quad would vanish edge-on,
 * which for the keeper's only way out is a bug wearing an art decision. The tick yaws it about Y
 * only, so it always stands upright; a full billboard would flatten it into a sprite.
 */
/**
 * How close the keeper must be to their threshold for it to open — the TRIGGER, and the same number
 * the seam is drawn against.
 *
 * ★ EXPORTED SO THE HOST CANNOT DISAGREE WITH THE PICTURE. It was a bare `1.6` typed into
 * `VoxelWorld.tsx`'s `near` test and a separate `PLOT_NEAR_RADIUS` here; two copies of one fact,
 * and the sort of pair that drifts the first time either is tuned. Same reasoning as `CAST_KEYS`
 * driving both the handler and the label.
 */
export const PLOT_TRIGGER_RADIUS = PLOT_NEAR_RADIUS

export function plotSeamAnchor(seed: number, cfg: PlotConfig = DEFAULT_PLOT): SeamAnchor {
  const t = plotThreshold(seed, cfg)
  return {
    // +0.5 to stand in the middle of the block, matching where the host puts the keeper.
    x: t.x + 0.5,
    z: t.z + 0.5,
    y: t.y,
    bearing: cfg.thresholdBearing,
    halfWidth: PLOT_NEAR_RADIUS * PLOT_WIDTH_FRAC,
    height: PLOT_HEIGHT,
  }
}

/**
 * How open the parting is, 0..1, from the keeper's distance to it.
 *
 * Pulled out as a plain function because it is the one bit of the look with a right answer: at
 * `open` the crossing is imminent, at `shut` the seam must still be legible as SOMETHING or the
 * front door is invisible from across the field.
 */
export function seamNearness(dist: number, shut: number, open: number): number {
  if (dist <= open) return 1
  if (dist >= shut) return 0
  return (shut - dist) / (shut - open)
}

// ⚠ 22 → 150 (2026-08-19, Alex: *"it blends too well"*). The old number carried a deliberate
// subtlety — *"you can just about see something at 20m"* — which is a lovely idea for a secret and
// the wrong one for the ONE door home on a 6.3km wall. The keeper is not meant to discover it; the
// build is supposed to put them at it (`passageBearing`'s own header says so). It stays a shimmer,
// it is simply a shimmer you can see coming.
const WILDS_SHUT = 150, WILDS_OPEN = 2.5
// ⚠ 7 → 120. `shut` is the distance at which the parting is fully closed and therefore invisible,
// so it WAS the number that sealed the garden: past seven blocks the only exit rendered as nothing.
// The Wilds keeps its 22 on purpose — out there the seam is a secret you approach, and the fold's
// wall is a landmark of its own. Inside, the seam IS the landmark.
const PLOT_SHUT = 120, PLOT_OPEN = 3
/** Beyond this the mesh is hidden outright — a crease 80 blocks off is sub-pixel anyway. */
// ⚠ PLOT_DRAW must stay >= PLOT_SHUT or the mesh is culled while the shader still says it is open —
// the door would fade in and then vanish as you walked toward it.
const WILDS_DRAW = 90, PLOT_DRAW = 420

export interface SeamPass {
  group: THREE.Group
  /** Advance the pass. Allocates nothing; only one of the two seams is ever visible. */
  tick(px: number, py: number, pz: number, dt: number, elapsed: number, space: Space): void
  dispose(): void
}

/**
 * ★ ONE geometry, ONE material, two meshes (render-audit's rule). The two seams never draw at the
 * same time — they are in different coordinate spaces — so they can share a material and the uniform
 * write in `tick` is unambiguous. If a third seam ever appears in the SAME space as another, this
 * becomes wrong and each needs its own material instance.
 */
export function createSeamShimmer(seed: number, cfg: BubbleConfig): SeamPass {
  // The Wilds ribbon: a curved terrain-following strip, built once from the pure ribbon math so the
  // thing that ships is the thing the oracle asserted. World coordinates, so the mesh sits at origin.
  const ribs = wildsSeamRibbon(seed, cfg)
  const wildsGeo = new THREE.BufferGeometry()
  {
    const n = ribs.length
    const pos = new Float32Array(n * 2 * 3)
    const uv = new Float32Array(n * 2 * 2)
    const idx: number[] = []
    for (let i = 0; i < n; i++) {
      const r = ribs[i]
      pos[i * 6 + 0] = r.x; pos[i * 6 + 1] = r.yb; pos[i * 6 + 2] = r.z
      pos[i * 6 + 3] = r.x; pos[i * 6 + 4] = r.yt; pos[i * 6 + 5] = r.z
      const u = i / (n - 1)
      uv[i * 4 + 0] = u; uv[i * 4 + 1] = 0
      uv[i * 4 + 2] = u; uv[i * 4 + 3] = 1
      if (i < n - 1) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    wildsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    wildsGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    wildsGeo.setIndex(idx)
    wildsGeo.computeBoundingSphere()
  }

  const geo = new THREE.PlaneGeometry(1, 1)

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,          // one soft layer; it must not punch a hole in what is behind it
    depthTest: true,
    side: THREE.DoubleSide,     // the keeper walks THROUGH it — a back face that vanishes reads as a hole
    uniforms: { uTime: { value: 0 }, uNear: { value: 0 } },
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uNear;

void main() {
  float u = vUv.x * 2.0 - 1.0;   // -1..1 across the ribbon
  float y = vUv.y;               // 0 at the ground

  // ★ THE TAPER IS THE SILHOUETTE, AND IT REPLACED A SEPARATE ENVELOPE. The parting is widest at
  // chest height and closes to nothing at both ends, so what is drawn is a lens-shaped crease — not
  // a stripe with its ends faded, which still reads as a rectangle someone dimmed. It also enforces
  // "ground that simply continues" and "no lintel" by construction: width IS zero at y=0 and y=1.
  float taper = pow(sin(3.14159 * clamp(y, 0.0, 1.0)), 0.75);

  // The crease WANDERS. A ruled vertical line is a laser or a UI element; cloud parts unevenly, and
  // two slow incommensurate waves never repeat visibly.
  float wob = sin(y * 4.1 + uTime * 0.35) * 0.05 + sin(y * 9.3 - uTime * 0.23) * 0.025;
  float d = abs(u - wob);

  // Shut it is a hairline; open it is a hand's width. This is the fold answering the keeper.
  // Widened with the same pass: at 150 blocks the ribbon is a few pixels across, and a hairline
  // parting inside it rounds away to nothing on screen.
  float w = mix(0.020, 0.055, uNear) * taper + 1e-4;

  // ⚠⚠ THE LIPS ARE OFFSET AND NARROW, AND THE FIRST VERSION GOT THIS WRONG IN THE ONE WAY THAT
  // COSTS THE WHOLE LOOK. Their Gaussian was wide enough to still be at 0.67 in the middle of the
  // seam, so the bright flanks painted over the dark parting they were supposed to flank and the
  // whole thing rendered as a pale fog smear — no crease, no depth, no door. Rendered and looked at,
  // which is the only reason it was caught: it reads fine in the source. Offset 2.2w, width 1.0w
  // puts the lips at ~0.007 in the centre, so the slit survives.
  float slit  = exp(-pow(d / w, 2.0));                     // the parting: dark, narrow, sees INTO the fold
  float lip   = exp(-pow((d - w * 2.2) / w, 2.0));         // two bright lips either side of it
  float bloom = exp(-pow(d / (w * 9.0), 2.0));             // the wall disturbed for a hand's width around

  // Cloud grain drifting up the crease, so it is stuff rather than light.
  float g = 0.85 + 0.15 * sin(y * 18.0 - uTime * 0.8 + sin(u * 5.0 + uTime * 0.3) * 1.3);

  vec3 col = mix(vec3(0.13, 0.20, 0.28), vec3(0.90, 0.98, 1.0), clamp(lip + bloom * 0.25, 0.0, 1.0));
  // ⚠ THE FLOOR WAS THE OTHER HALF OF "IT BLENDS TOO WELL": 0.35 meant that at any real distance the
  // seam drew at a third of an already-quiet alpha, against a wall that is itself pale cloud. 0.60
  // keeps the near/far difference (the fold still answers you as you approach) without making the
  // far state a rumour.
  float a = g * (slit * 0.85 + lip * 0.80 + bloom * 0.10) * (0.60 + 0.40 * uNear);
  if (a < 0.004) discard;        // cheaper than blending a thousand invisible fragments
  gl_FragColor = vec4(col, a);
}`,
  })

  const wildsA = wildsSeamAnchor(seed, cfg)
  const plotA = plotSeamAnchor(seed)

  // ★ NO TRANSFORM. The ribbon's vertices are already world coordinates, because they had to be:
  // each one was placed against its own column's shell radius and its own ground. Scaling or
  // rotating this mesh would break exactly the property the oracle asserts.
  const wilds = new THREE.Mesh(wildsGeo, mat)
  wilds.visible = false
  wilds.renderOrder = 2

  const plot = new THREE.Mesh(geo, mat)
  plot.scale.set(plotA.halfWidth * 2, plotA.height, 1)
  plot.position.set(plotA.x, plotA.y + plotA.height / 2, plotA.z)
  plot.visible = false
  plot.renderOrder = 2

  const group = new THREE.Group()
  group.add(wilds, plot)

  return {
    group,
    tick(px, py, pz, dt, elapsed, space) {
      mat.uniforms.uTime.value = elapsed
      if (space === 'plot') {
        wilds.visible = false
        const dist = Math.hypot(px - plotA.x, pz - plotA.z)
        plot.visible = dist < PLOT_DRAW
        if (plot.visible) {
          // Yaw-only billboard: face the keeper, stay upright. See `plotSeamAnchor`.
          plot.rotation.y = Math.atan2(px - plotA.x, pz - plotA.z)
          mat.uniforms.uNear.value = seamNearness(dist, PLOT_SHUT, PLOT_OPEN)
        }
      } else {
        plot.visible = false
        const dist = Math.hypot(px - wildsA.x, pz - wildsA.z)
        wilds.visible = dist < WILDS_DRAW
        if (wilds.visible) mat.uniforms.uNear.value = seamNearness(dist, WILDS_SHUT, WILDS_OPEN)
      }
    },
    dispose() {
      geo.dispose()
      wildsGeo.dispose()
      mat.dispose()
    },
  }
}
