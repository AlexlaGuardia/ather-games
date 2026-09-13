// Chimney smoke — the GPU half. Shaped after `steam.ts`: ONE geometry, ONE shader program, a fixed
// particle budget, every GPU resource constructed once inside this factory (render-audit's rule).
// The per-frame CPU work is aging a Float32Array and respawning the particles whose life ran out;
// the sway, growth and fade live in the shader, so the tick allocates nothing.
//
// ★ IT KNOWS NOTHING ABOUT HEARTHS. It is handed a list of `SmokeSource`s (cell + the open cell
// above the stack) and rises from them. Who smokes, and where a flue opens, is
// `smoke-sources.ts`'s business and is pure — the same split as break-fx / break-fx-spec, and for
// the same reason: the half that can be argued with in a test is kept out of the half that needs
// a GL context.
//
// ★ WHY IT IS NOT STEAM WITH A GREY TINT. Steam is born from nothing over open water and thins
// as it climbs, so it fades symmetrically (sin πt) and stays pale. Chimney smoke is DENSE at the
// mouth — the cap is where the column is narrowest and darkest — then loosens, drifts off the
// vertical, and thins to nothing high up. So: alpha peaks EARLY (t≈0.2) and tails long; the puff
// starts small and grows ~3×; a per-puff drift carries it sideways as it rises, so a column leans
// the way real smoke does instead of standing like a pillar. And it is grey-brown, not white:
// wood smoke against a day sky reads darker than the sky, not lighter.
//
// ★ THE GATE. `tick` is handed the sources already filtered to the camera's neighbourhood by the
// host (a rescan every 2s over the nearby columns); with an empty list the pass hides itself and
// the loop below never runs. That is the whole idle cost of the feature in a world with no hearth.

import * as THREE from 'three'
import type { SmokeSource } from './smoke-sources'

/** Puffs aloft, the ceiling. `PER_STACK` of them per source; the rest stay parked. */
export const COUNT = 192
/**
 * Puffs a single stack may hold. ★ THE FIRST SHOT HAD ALL 192 ON ONE CHIMNEY and it read as a
 * blob, not a column: density is a per-stack property, and a village of sixteen stacks should be
 * sixteen thin columns, not one thick one over whichever hearth was scanned first.
 */
export const PER_STACK = 20
/** A puff's size in BLOCKS at birth and at death. Perspective-correct, like the chips. */
export const SIZE_BORN = 0.45
export const SIZE_DIED = 2.4
/** Blocks climbed over a puff's life. */
export const RISE = 4.5
/** A puff lives this long, ± the jitter. Long enough that a column is continuous at RISE. */
export const LIFE = 4.0
export const LIFE_JITTER = 2.0

export interface SmokePass {
  points: THREE.Points
  /** Advance the pass. `sources` is the host's current nearby list; empty = the pass sleeps. */
  tick(dt: number, elapsed: number, sources: readonly SmokeSource[]): void
  /** viewportHeightPx / (2·tan(fov/2)) — the host owns it; same contract as break-fx. */
  setPixelScale(scale: number): void
  dispose(): void
}

function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return (s >>> 0) / 4294967296
  }
}

export function createSmoke(seed = 0x5a0ce): SmokePass {
  const rand = rng(seed)
  const pos = new Float32Array(COUNT * 3)
  const aT = new Float32Array(COUNT)       // life fraction 0..1 — fade + growth in-shader
  const aSeed = new Float32Array(COUNT)    // per-puff phase for the sway
  const aDrift = new Float32Array(COUNT * 2) // per-puff jitter on the shared wind, blocks over a life
  const age = new Float32Array(COUNT)
  const life = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3 + 1] = -1000                 // parked out of sight until a stack claims it
    life[i] = LIFE + rand() * LIFE_JITTER
    age[i] = life[i]                       // expired: the first tick with a source primes it (below)
    aSeed[i] = rand() * Math.PI * 2
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))
  geo.setAttribute('aDrift', new THREE.BufferAttribute(aDrift, 2))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,       // one soft transparent layer, same reasoning as steam and the water
    depthTest: true,
    uniforms: { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.9, 0.3) }, uPixelScale: { value: 772 }, uSize: { value: new THREE.Vector2(SIZE_BORN, SIZE_DIED) } },
    vertexShader: /* glsl */ `
attribute float aT;
attribute float aSeed;
attribute vec2 aDrift;
uniform float uTime;
uniform vec2 uWind;
uniform float uPixelScale;
uniform vec2 uSize;
varying float vT;
void main() {
  vT = aT;
  vec3 p = position;
  // The lean: ONE wind for the whole pass (the host wanders it slowly) plus a small per-puff
  // jitter, carried more the higher a puff climbs, so the column BENDS as a column — a random
  // per-puff lean would spread it into a cloud. Plus a sway so no two puffs track one line up.
  p.xz += (uWind + aDrift) * aT * aT;
  float w = 0.06 + 0.22 * aT;
  p.x += sin(uTime * 0.8 + aSeed) * w;
  p.z += cos(uTime * 0.6 + aSeed * 1.7) * w;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Grow through life: tight at the cap, loose and large as it thins. Sized in BLOCKS and
  // converted with the host's pixel scale, so a puff shrinks with distance exactly as the chimney
  // it left does. ⚠ steam's 160/z guess was the first draft and it drew a 400px ball over the
  // roof from fifteen blocks away.
  float sz = mix(uSize.x, uSize.y, aT);
  gl_PointSize = max(1.0, sz * uPixelScale / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
varying float vT;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float soft = (1.0 - d) * (1.0 - d);
  // Dense at the cap, long thin tail: up fast to t≈0.2, then a slow fall to nothing at 1.
  float rise = smoothstep(0.0, 0.2, vT);
  float fall = 1.0 - smoothstep(0.2, 1.0, vT);
  float alpha = soft * rise * fall * 0.45;
  // Grey-brown, lightening as it thins — wood smoke, not steam.
  vec3 col = mix(vec3(0.30, 0.28, 0.27), vec3(0.62, 0.61, 0.60), vT);
  gl_FragColor = vec4(col, alpha);
}`,
  })

  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false             // stacks are wherever hearths are; the bounds lie
  points.renderOrder = 1
  points.visible = false

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
  const tAttr = geo.getAttribute('aT') as THREE.BufferAttribute
  const driftAttr = geo.getAttribute('aDrift') as THREE.BufferAttribute

  return {
    points,
    tick(dt, elapsed, sources) {
      ;(mat.uniforms.uTime as { value: number }).value = elapsed
      // The wind wanders: a slow figure over ~80s so a column leans, drifts, and leans again.
      const wind = (mat.uniforms.uWind as { value: THREE.Vector2 }).value
      wind.set(1.1 * Math.sin(elapsed * 0.08) + 0.4 * Math.cos(elapsed * 0.031), 0.9 * Math.cos(elapsed * 0.05))
      const active = sources.length > 0
      points.visible = active
      if (!active) return
      // The per-stack budget: only the first `want` slots live; the rest are parked and never aged.
      const want = Math.min(COUNT, sources.length * PER_STACK)
      for (let i = 0; i < COUNT; i++) {
        if (i >= want) { if (pos[i * 3 + 1] !== -1000) { pos[i * 3 + 1] = -1000; age[i] = life[i] } continue }
        age[i] += dt
        if (age[i] < life[i]) {
          const t = age[i] / life[i]
          aT[i] = t
          pos[i * 3 + 1] += RISE * (dt / life[i])
          continue
        }
        // Respawn at a stack. Even spread across sources; a puff is born in the open cell above
        // the stack, jittered inside the cell so the column has a width.
        //
        // ★ A PARKED SLOT IS PRIMED, NOT BORN. A slot that was parked (y = -1000: never used, or
        // budgeted out) joins at a RANDOM point of its life, placed as high as it would have
        // climbed — so the first frame a stack is in range shows a full column, not a column
        // starting. The chimney was smoking before the keeper walked up. (Steam pre-ages at
        // construction for the same reason; this pass cannot, because its sources arrive later.)
        // A slot whose puff simply DIED starts at t = 0 at the cap, which is the steady state.
        const s = sources[(rand() * sources.length) | 0]
        const primed = pos[i * 3 + 1] === -1000
        life[i] = LIFE + rand() * LIFE_JITTER
        const t = primed ? rand() : 0
        age[i] = t * life[i]
        pos[i * 3] = s.x + 0.3 + rand() * 0.4
        pos[i * 3 + 1] = s.top + 0.1 + RISE * t
        pos[i * 3 + 2] = s.z + 0.3 + rand() * 0.4
        aDrift[i * 2] = (rand() - 0.5) * 0.7
        aDrift[i * 2 + 1] = (rand() - 0.5) * 0.7
        aT[i] = t
      }
      posAttr.needsUpdate = true
      tAttr.needsUpdate = true
      driftAttr.needsUpdate = true
    },
    setPixelScale(scale) { (mat.uniforms.uPixelScale as { value: number }).value = scale },
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
