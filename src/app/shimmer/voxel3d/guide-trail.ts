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
//
// ★ IT BENDS AND IT BREATHES (Alex, 2026-09-16, watching it on Rune Hold's square: "a bit stiff,
// maybe it can pulse and give it some curves"). The way is an S, not a wire: a lateral bend
// (`sin(πt)·sin(2πt+drift)`, so both ends stay anchored on the feet and the target) whose depth
// scales with the distance and whose phase drifts, so the curve sways rather than sits. And a
// PULSE runs along it toward the target — bands of brightness and size travelling the way the
// motes travel, so the trail reads as a thing moving there, not a line drawn there.

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
  alpha: 0.55,
  /** the S-bend's depth: blocks per block of distance, capped — a 20-block way bows ~1.6 blocks */
  bend: 0.09,
  bendMax: 1.6,
  /** how fast the bend's phase drifts (rad/s) — a sway, not a wobble */
  sway: 0.35,
  /** pulses along the trail: bands per trail-length, and bands per second toward the target */
  pulseBands: 2.0,
  pulseSpeed: 0.9,
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
    uniforms: {
      uTime: { value: 0 }, uColour: { value: new THREE.Vector3(...GUIDE_LOOK.colour) }, uAlpha: { value: GUIDE_LOOK.alpha },
      uBands: { value: GUIDE_LOOK.pulseBands }, uPulse: { value: GUIDE_LOOK.pulseSpeed },
    },
    vertexShader: /* glsl */ `
attribute float aT;
attribute float aSeed;
uniform float uTime;
varying float vT;
varying float vTw;
uniform float uBands;
uniform float uPulse;
varying float vPulse;
void main() {
  vT = aT;
  vTw = 0.75 + 0.25 * sin(uTime * 3.0 + aSeed * 5.0);
  // The pulse: a band travelling toward the target (t rising), cubed so it is a crest with dark
  // water between, not a gentle ripple. Same value drives brightness (fragment) and size (here).
  float wave = 0.5 + 0.5 * sin(6.28318 * (aT * uBands - uTime * uPulse));
  vPulse = wave * wave * wave;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // ~a quarter block across: 0.25 blocks × (viewport height / 2 tan(fov/2)) ≈ 130 px·blocks at
  // 760 px / 75°. Clamped so a mote at the feet is a mote, not a sun. A crest swells to ~1.3×.
  gl_PointSize = clamp(130.0 / max(1.0, -mv.z), 2.0, 34.0) * (0.85 + 0.45 * vPulse);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColour;
uniform float uAlpha;
varying float vT;
varying float vTw;
varying float vPulse;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float soft = (1.0 - d) * (1.0 - d);
  float along = sqrt(sin(3.14159 * vT));
  float pulse = 0.55 + 0.6 * vPulse;
  gl_FragColor = vec4(uColour * (0.5 + 0.5 * soft) * (0.9 + 0.35 * vPulse), soft * along * vTw * uAlpha * pulse);
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
      // Perpendicular, for the bend and the lateral scatter.
      const nx = -dz / len, nz = dx / len
      // The S-bend: anchored at both ends by sin(πt), one full wave along the way, phase drifting
      // so it sways. Depth grows with distance and is capped — a long way bows, a short hop barely.
      const bend = Math.min(GUIDE_LOOK.bendMax, len * GUIDE_LOOK.bend)
      const drift = elapsed * GUIDE_LOOK.sway
      const step = GUIDE_LOOK.speed * dt / len
      for (let i = 0; i < N; i++) {
        u[i] += step
        if (u[i] >= 1) { u[i] -= 1; side[i] = (Math.random() * 2 - 1) * 0.6 }
        const t = t0 + u[i] * (t1 - t0)
        const curve = bend * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * t + drift)
        const lat = side[i] + curve
        const x = px + dx * t + nx * lat
        const z = pz + dz * t + nz * lat
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
