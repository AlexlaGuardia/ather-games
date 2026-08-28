// Block-break chips — the GPU half. Shaped after `steam.ts`: ONE geometry, ONE shader program, a
// fixed particle budget, every GPU resource constructed once inside this factory (render-audit's
// rule). The per-frame CPU work is integrating a few Float32Arrays; nothing is allocated in tick.
//
// ★ IT KNOWS NOTHING ABOUT MINING. Callers hand it a point, a face and a material; what a material
// throws is `break-fx-spec.ts`'s business and is pure. That split is why half of this feature has a
// real oracle: the recipes can be argued with in a test, and only the arithmetic below needs a GPU.
//
// ── ★★★ THE BUDGET IS A CEILING THAT DROPS WORK, NOT A QUEUE THAT DEFERS IT ───────────────────
// Felling a tree writes AIR to every log cell in ONE frame (`VoxelWorld.tsx`'s fell loop), so a
// burst per cell is hundreds of bursts in a single tick. Two independent guards, because they
// protect different things:
//   · `EMIT_PER_FRAME` bounds how many chips may be BORN in one frame. Overflow is DISCARDED.
//   · the ring bounds how many may EXIST, by overwriting the oldest.
// ⚠ Deferring the overflow to later frames would be the tempting version and it is worse: it turns
// one heavy frame into a second of them, on the machine this whole design is protecting. Alex's
// UHD 630 profiles 84% GPU-bound at ~298 draws — a felled tree that stutters for a second reads as
// the game breaking, while a felled tree that throws slightly fewer chips than it might have reads
// as nothing at all. **The one you can't see is the right one to lose.**

import * as THREE from 'three'
import { bucketOf, recipeFor, chipColor, type ChipRecipe } from './break-fx-spec'

/** Live chips. 512 × (3+3+1+1+1+1+1) floats is ~28KB — the budget is about draw cost, not memory. */
export const BUDGET = 512
/** Chips that may be born in one frame. A full stone burst is 14, so this is ~14 blocks at once. */
export const EMIT_PER_FRAME = 200

export interface BreakFxPass {
  points: THREE.Points
  /**
   * Chips off a struck face, mid-swing.
   *
   * `nx,ny,nz` is the face normal — from `RayHit` as `(px-x, py-y, pz-z)`, which is a unit vector
   * on exactly one axis (verified against the raycast on all six faces, 2026-08-28). Chips are born
   * ON that face rather than at the cell centre, which is the whole difference between "the block
   * is being hit" and "something happened near the block".
   */
  chip(x: number, y: number, z: number, nx: number, ny: number, nz: number, material: number, n: number): void
  /**
   * The burst when a block finally goes.
   *
   * ★ NO FACE, DELIBERATELY. A break is not directional, and a future caller — an explosion, a
   * console verb, a deconstruct — has no normal to hand over. Asking for one would force every
   * one of them to invent it.
   *
   * ── ⛔ AND IT IS NOT WIRED INTO `setVoxel`, WHICH THIS COMMENT USED TO PROPOSE (2026-08-28) ──
   * The funnel was the obvious home: one call site, every future destruction path covered for
   * free. It was refused after counting what actually goes through it: of the 24 `setVoxel` call
   * sites in `VoxelWorld.tsx` (counted 2026-08-28), TWO are a keeper breaking something — the fell
   * loop and the single block, both in the mine branch. The other 22 are the world
   * assembling itself — the court laying its platform and sockets, the gate carving its doorway,
   * a waymark going down, a pot blooming, a tree GROWING, a placed piece's cells, a piece being
   * picked back up. Firing here means the court bursts into stone chips every time a keeper walks
   * into it, on load, with no keeper and no swing.
   *
   * ⚠ AND THE BUDGET WOULD HAVE HIDDEN IT RATHER THAN CAUGHT IT. `EMIT_PER_FRAME` bounds the
   * damage to a bounded spray, so it would not stutter and nothing would look broken — it would
   * just be wrong, in the one place the game is trying to look composed. **A ceiling that keeps a
   * wrong effect cheap is not a guard against firing it.**
   *
   * The two real call sites are in the mine branch, asserted by `break-fx-wiring.test.ts` — which
   * also asserts this function is NOT reached from `setVoxel`, so the tempting version cannot be
   * quietly restored by someone reading the paragraph this one replaced.
   */
  burst(x: number, y: number, z: number, material: number): void
  tick(dt: number): void
  /**
   * Tell the pass how big the viewport is, so a world-sized chip lands on the right number of
   * pixels. `heightPx / (2 · tan(fov/2))` — call it on mount and on resize, not per frame.
   */
  setPixelScale(scale: number): void
  /** Live chip count. For the judging page and the oracle; costs nothing. */
  live(): number
  /** Chips discarded by the per-frame ceiling since construction. A silent cap is a lying cap. */
  dropped(): number
  dispose(): void
}

/**
 * ★ ITS OWN PRNG, SEEDED, RATHER THAN `Math.random`. Not for determinism in the world — chips are
 * cosmetic and nobody replays them — but so the judging page and any future oracle see the same
 * spray twice. `steam.ts` uses `Math.random` and is right to: it respawns forever and no one ever
 * needs to compare two runs. A burst is a discrete event you WILL want to look at twice.
 */
function rng(seed: number): () => number {
  let s = seed | 0 || 0x9e3779b9
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

export function createBreakFx(seed = 0x5eed, budget = BUDGET): BreakFxPass {
  const pos = new Float32Array(budget * 3)
  const col = new Float32Array(budget * 3)
  const aT = new Float32Array(budget)        // life fraction 0..1, drives the fade in-shader
  const aSize = new Float32Array(budget)
  const vel = new Float32Array(budget * 3)   // CPU only
  const age = new Float32Array(budget)
  const life = new Float32Array(budget)      // 0 = the slot is free
  const grav = new Float32Array(budget)
  const drag = new Float32Array(budget)
  for (let i = 0; i < budget; i++) pos[i * 3 + 1] = -1000   // parked out of sight

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    // uPixelScale = viewportHeightPx / (2 · tan(fov/2)) — the factor that turns a world size into
    // pixels at one unit of depth. The host owns it because only the host knows the viewport; the
    // default below is a 720p/50° guess so a caller that forgets still renders something sane
    // rather than nothing (a chip of size 0 is invisible, which reads as the feature being broken).
    uniforms: { uPixelScale: { value: 772 } },
    vertexShader: /* glsl */ `
attribute vec3 aColor;
attribute float aT;
attribute float aSize;
uniform float uPixelScale;
varying vec3 vC;
varying float vT;
void main() {
  vC = aColor;
  vT = aT;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // Perspective-correct: aSize is a size in BLOCKS, so a chip shrinks with distance exactly as the
  // block it came off does. ⚠ The first draft multiplied a pixel size by an invented constant and
  // every test stayed green — the chips came out as big as the blocks, which only the judging page
  // could say. A fragment has a real size in the world; this is the conversion, not a fudge factor.
  gl_PointSize = max(1.0, aSize * uPixelScale / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
varying vec3 vC;
varying float vT;
void main() {
  // SQUARE, not a soft disc. A chip is a fragment of a voxel and should read as one — steam's
  // circular falloff is right for vapour and wrong for rubble. No texture is sampled at all, which
  // is deliberate: a texture upload stalls the main thread on the target GPU.
  // Full opacity until the last third, then out. Debris appears instantly and dims as it settles;
  // fading IN would make the first frame of a swing look soft, which is the opposite of a strike.
  float a = 1.0 - smoothstep(0.65, 1.0, vT);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vC, a);
}`,
  })

  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false     // chips roam anywhere the keeper mines; the bounds would lie
  points.renderOrder = 1
  points.visible = false

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
  const colAttr = geo.getAttribute('aColor') as THREE.BufferAttribute
  const tAttr = geo.getAttribute('aT') as THREE.BufferAttribute
  const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute

  const rand = rng(seed)
  let cursor = 0            // ring write head
  let liveCount = 0
  let bornThisFrame = 0
  let droppedTotal = 0

  /** Spawn one chip. Returns false when the frame's ceiling is spent. */
  function spawn(
    x: number, y: number, z: number,
    dx: number, dy: number, dz: number,
    r: ChipRecipe, hex: number,
  ): boolean {
    if (bornThisFrame >= EMIT_PER_FRAME) { droppedTotal++; return false }
    bornThisFrame++
    const i = cursor
    cursor = (cursor + 1) % budget
    if (life[i] === 0) liveCount++      // stealing a live slot keeps the count flat, correctly

    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
    vel[i * 3] = dx; vel[i * 3 + 1] = dy; vel[i * 3 + 2] = dz
    // ±25% so a burst is not a uniform puff of clones — the cheapest thing that stops it reading
    // as a particle system rather than as debris.
    life[i] = r.life * (0.75 + rand() * 0.5)
    age[i] = 0
    grav[i] = r.gravity
    drag[i] = r.drag
    aSize[i] = r.size * (0.7 + rand() * 0.6)
    aT[i] = 0
    // Shade each chip a little off its material so a face of them has depth. `>> 16 & 255` etc:
    // MATERIAL_COLOR is packed hex, and unpacking here keeps the spec module free of colour maths.
    const shade = 0.75 + rand() * 0.45
    col[i * 3]     = Math.min(1, ((hex >> 16) & 255) / 255 * shade)
    col[i * 3 + 1] = Math.min(1, ((hex >> 8) & 255) / 255 * shade)
    col[i * 3 + 2] = Math.min(1, (hex & 255) / 255 * shade)
    return true
  }

  /** A velocity `spread` off the given axis, scaled to `speed`. */
  function scatter(nx: number, ny: number, nz: number, r: ChipRecipe): [number, number, number] {
    const s = r.speed * (0.6 + rand() * 0.8)
    const w = r.spread
    return [
      (nx + (rand() * 2 - 1) * w) * s,
      (ny + (rand() * 2 - 1) * w) * s + r.speed * 0.35,   // a little lift, so chips arc rather than skid
      (nz + (rand() * 2 - 1) * w) * s,
    ]
  }

  return {
    points,

    chip(x, y, z, nx, ny, nz, material, n) {
      const b = bucketOf(material)
      if (!b || n <= 0) return
      const r = recipeFor(b)
      const hex = chipColor(material)
      for (let k = 0; k < n; k++) {
        // Born ON the struck face, jittered across it — the cell centre plus half a block along the
        // normal, then scattered in the face's own plane.
        const j1 = (rand() - 0.5) * 0.8, j2 = (rand() - 0.5) * 0.8
        const px = x + 0.5 + nx * 0.52 + (nx !== 0 ? 0 : j1)
        const py = y + 0.5 + ny * 0.52 + (ny !== 0 ? 0 : j2)
        const pz = z + 0.5 + nz * 0.52 + (nz !== 0 ? 0 : (nx !== 0 ? j2 : j1))
        const [vx, vy, vz] = scatter(nx, ny, nz, r)
        if (!spawn(px, py, pz, vx, vy, vz, r, hex)) return
      }
    },

    burst(x, y, z, material) {
      const b = bucketOf(material)
      if (!b) return
      const r = recipeFor(b)
      const hex = chipColor(material)
      for (let k = 0; k < r.burst; k++) {
        // Omnidirectional from the cell, biased upward — the block is coming apart, not being hit.
        const ux = rand() * 2 - 1, uy = rand() * 2 - 1, uz = rand() * 2 - 1
        const len = Math.hypot(ux, uy, uz) || 1
        const [vx, vy, vz] = scatter(ux / len, uy / len, uz / len, r)
        if (!spawn(
          x + 0.15 + rand() * 0.7, y + 0.15 + rand() * 0.7, z + 0.15 + rand() * 0.7,
          vx, vy, vz, r, hex,
        )) return
      }
    },

    tick(dt) {
      bornThisFrame = 0
      if (liveCount === 0) { points.visible = false; return }
      points.visible = true
      let alive = 0
      for (let i = 0; i < budget; i++) {
        if (life[i] === 0) continue
        age[i] += dt
        if (age[i] >= life[i]) {
          life[i] = 0
          pos[i * 3 + 1] = -1000
          aT[i] = 1
          continue
        }
        alive++
        aT[i] = age[i] / life[i]
        // Exponential drag, then gravity. `drag` is the fraction of speed KEPT per second, so the
        // per-frame factor is dt-correct rather than framerate-dependent — the bug you only see on
        // a machine with a different frame time from the one you tuned on.
        const keep = Math.pow(drag[i], dt)
        vel[i * 3] *= keep
        vel[i * 3 + 1] = vel[i * 3 + 1] * keep - grav[i] * dt
        vel[i * 3 + 2] *= keep
        pos[i * 3] += vel[i * 3] * dt
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt
      }
      liveCount = alive
      posAttr.needsUpdate = true
      colAttr.needsUpdate = true
      tAttr.needsUpdate = true
      sizeAttr.needsUpdate = true
    },

    setPixelScale(scale) { (mat.uniforms.uPixelScale as { value: number }).value = scale },

    live: () => liveCount,
    dropped: () => droppedTotal,

    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
