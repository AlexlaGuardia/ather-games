// The tutorial's guide trail — gold motes drifting along the ground toward the objective.
//
// ★ HOST SIDE (three). `guide-target.ts` decides WHERE; this only draws the way there. Same
// `Points` shape as steam.ts / mist: one geometry, one shader, one draw call, positions rewritten
// on the CPU each frame — a few dozen motes is nothing.
//
// ── THE LOOK ──────────────────────────────────────────────────────────────────────────────────
// Motes, not a painted line. They FLOW toward the target so the motion says "this way" before the
// eye has traced the shape; they sit a hand above the ground, following it (the caller hands in a
// surface reader, so a mote on a slope is on the slope); they are the mana lantern's gold, so the
// trail and the light the keeper is about to make rhyme. Additive, so over grass or path they read
// as light, not paint. The trail starts a step and a half ahead of the feet (never under the
// camera) and ends short of the target; inside `hideBelow` it is gone — found is found.

import * as THREE from 'three'
import type { GuideTarget } from './guide-target'

export const GUIDE_LOOK = {
  count: 56,
  /** blocks per second the motes travel */
  speed: 4.5,
  /** lead-in from the feet, and the gap left before the target, in blocks */
  lead: 1.5,
  /** the lantern's gold */
  colour: [1.0, 0.84, 0.48] as const,
  alpha: 0.7,
} as const

export interface GuidePass {
  points: THREE.Points
  /** Per frame. `surfaceY` reads the live ground (top solid + 1) at a column, or null if unloaded. */
  tick(px: number, pz: number, target: GuideTarget | null, dt: number, elapsed: number,
       surfaceY: (x: number, z: number) => number | null): void
  dispose(): void
}

export function createGuideTrail(): GuidePass {
  const N = GUIDE_LOOK.count
  const pos = new Float32Array(N * 3)
  const aT = new Float32Array(N)      // 0..1 along the trail — fade in/out in-shader
  const aSeed = new Float32Array(N)
  const u = new Float32Array(N)       // where along the way each mote is
  const side = new Float32Array(N)    // lateral offset, blocks (a trail, not a wire)
  for (let i = 0; i < N; i++) {
    u[i] = i / N
    aSeed[i] = Math.random() * Math.PI * 2
    side[i] = (Math.random() * 2 - 1) * 0.6
    pos[i * 3 + 1] = -1000
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColour: { value: new THREE.Vector3(...GUIDE_LOOK.colour) }, uAlpha: { value: GUIDE_LOOK.alpha } },
    vertexShader: /* glsl */ `
attribute float aT;
attribute float aSeed;
uniform float uTime;
varying float vT;
varying float vTw;
void main() {
  vT = aT;
  vTw = 0.75 + 0.25 * sin(uTime * 3.0 + aSeed * 5.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 9.0 * (120.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColour;
uniform float uAlpha;
varying float vT;
varying float vTw;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float soft = (1.0 - d) * (1.0 - d);
  float along = sqrt(sin(3.14159 * vT));
  gl_FragColor = vec4(uColour * (0.6 + 0.6 * soft), soft * along * vTw * uAlpha);
}`,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 2
  points.visible = false
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
  const tAttr = geo.getAttribute('aT') as THREE.BufferAttribute

  return {
    points,
    tick(px, pz, target, dt, elapsed, surfaceY) {
      ;(mat.uniforms.uTime as { value: number }).value = elapsed
      if (!target) { points.visible = false; return }
      const dx = target.x - px, dz = target.z - pz
      const len = Math.hypot(dx, dz)
      if (len <= target.hideBelow) { points.visible = false; return }
      points.visible = true
      // Lead-in and lead-out as fractions of the way; on a short hop they meet in the middle.
      const lead = Math.min(GUIDE_LOOK.lead / len, 0.4)
      const t0 = lead, t1 = 1 - Math.max(lead, target.hideBelow / len)
      // Perpendicular, for the lateral scatter.
      const nx = -dz / len, nz = dx / len
      const step = GUIDE_LOOK.speed * dt / len
      for (let i = 0; i < N; i++) {
        u[i] += step
        if (u[i] >= 1) { u[i] -= 1; side[i] = (Math.random() * 2 - 1) * 0.6 }
        const t = t0 + u[i] * (t1 - t0)
        const x = px + dx * t + nx * side[i]
        const z = pz + dz * t + nz * side[i]
        const g = surfaceY(Math.floor(x), Math.floor(z))
        pos[i * 3] = x
        pos[i * 3 + 1] = g === null ? -1000 : g + 0.18 + 0.08 * Math.sin(elapsed * 2.2 + aSeed[i])
        pos[i * 3 + 2] = z
        aT[i] = u[i]
      }
      posAttr.needsUpdate = true
      tAttr.needsUpdate = true
    },
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
