// THE PORTAL MATERIAL — the plot's swirl, as one shared shader.
//
// Moved out of `seam.ts` (2026-09-26) so Rune Hold's landing (`play3d/RuneHoldScene.tsx`) draws the SAME
// portal the Gate Station sockets do, without pulling the voxel world into the play3d bundle. Alex:
// *"a simple plaza with the disc portal we have in the homeplot."* One shader, two worlds.
import * as THREE from 'three'

const PORTAL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

/**
 * ── ★ THE PORTAL — a swirl in the frame (Alex, 2026-09-16: "more like a rick and morty swirly
 *    portal") ────────────────────────────────────────────────────────────────────────────────
 * The seam's parting was a slit, and at twenty blocks it read as nothing. A kept crossing wants a
 * FACE. Canon's grammar (`world/gates.md`): *bare spiral = untuned or temporary; framed = tuned and
 * kept* — so a spiral inside Alex's frames is the tuned gate drawn the way the world draws them.
 * A disc that fills the 3×3 doorway: two counter-wound spiral arms turning about the centre, a
 * dark eye, a bright rim that breathes, all in the socket's tint. `uNear` opens it wider and
 * brighter as the keeper comes in, the same cue the seam gives.
 */
const PORTAL_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uNear;
uniform vec3 uLip;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 q = vUv * 2.0 - 1.0;                 // -1..1 across the doorway
  float r = length(q);
  if (r > 1.0) discard;
  float a = atan(q.y, q.x);
  float t = uTime;

  // Two spiral arms, wound opposite ways, turning at different speeds: the swirl.
  float arm1 = sin(3.0 * a - 9.0 * r + t * 2.6);
  float arm2 = sin(2.0 * a + 7.0 * r - t * 1.7);
  float swirl = 0.5 + 0.5 * (0.6 * arm1 + 0.4 * arm2);
  // Fine grain riding the arms, so it reads as energy, not as paint.
  float grain = 0.85 + 0.3 * hash(floor(vec2(a * 9.0 + t * 3.0, r * 22.0 - t * 5.0)));
  swirl *= grain;

  float eye  = smoothstep(0.02, 0.28, r);                      // the dark centre
  float rim  = smoothstep(0.62, 0.93, r) * (1.0 - smoothstep(0.93, 1.0, r));
  float pulse = 0.85 + 0.15 * sin(t * 2.2);
  float edge = 1.0 - smoothstep(0.93, 1.0, r);                 // soft against the frame

  vec3 deep = uLip * 0.22;
  vec3 col = mix(deep, uLip, swirl * eye);
  col += uLip * rim * pulse * 0.9;
  col += vec3(1.0) * rim * pulse * 0.25;

  float body = (0.55 + 0.45 * swirl) * eye;
  float alpha = (0.55 * body + 0.7 * rim) * edge * (0.75 + 0.25 * uNear);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.96));
}`

/**
 * The portal as a material, tinted. Drive `uTime` (seconds) every frame; `uNear` 0..1 opens it wider
 * and brighter as the keeper comes in. Drawn on a square plane: the shader cuts the disc.
 */
export function portalMaterial(lip: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uNear: { value: 0 }, uLip: { value: lip } },
    vertexShader: PORTAL_VERT,
    fragmentShader: PORTAL_FRAG,
  })
}
