// BETA M204 s2 (sprites, 2026-11-26): THE SECOND FORMS' EFFECTS, the pieces the M202 v2 form agents parked as "effect, not
// geometry" (docs/looks/m202-*-v2-2026-11-26/README.md):
//   Vulnarc (storm): the lightning arcs and sparks round her in the art
//   Vulnix (water):  the air bubbles rising off her, droplets / a splash at her paws while she moves, a shimmer along the tongues
//   Vulnara (mana):  the gold afterimage the page gives her: smears of gold light hanging a breath behind her as she moves
// Kept subtle and CHEAP: one THREE.Points per spirit (one draw call), every particle placed by the vertex shader from time + a
// seed; the only per-frame CPU work is reading a handful of bone positions (last frame's matrices, no matrix updates) into
// uniforms, and for Vulnara's trail writing one point into a fixed ring. No allocations per frame.
// Art-medium law: living things stay LIVE GLOW; these are additive glow points over her live model.
import * as THREE from 'three'

/** the forms that have an effect (by look name) */
export const FX_FORMS = ['vulnarc', 'vulnix', 'vulnara'] as const
export type FxForm = typeof FX_FORMS[number]
export const isFxForm = (n: string): n is FxForm => (FX_FORMS as readonly string[]).includes(n)
/** the anchors read off her rig each frame, in this order (uA[0..8] in the shader) */
export const FX_BONES = ['b_fl_paw', 'b_fr_paw', 'b_hl_paw', 'b_hr_paw', 'b_tail2', 'b_tail4', 'b_chest', 'b_head', 'b_pelvis'] as const
/** points per form: Vulnarc 3 arcs x 12 beads + 8 sparks; Vulnix 14 bubbles + 12 droplets + 8 shimmer; Vulnara 24 trail + 6 motes */
export const FX_COUNT: Readonly<Record<FxForm, number>> = { vulnarc: 44, vulnix: 34, vulnara: 30 }
/** effect colours: pale lights of the forms' own hulls (spirit-models.ts SECOND_FORMS); Vulnara's is the page's gold */
const FX_COLOR: Readonly<Record<FxForm, string>> = { vulnarc: '#d6ecff', vulnix: '#c4f2f6', vulnara: '#ffd46a' }
const TRAIL = 24, TRAIL_LIFE = 0.9

const HEAD = `uniform float uT; uniform float uH; uniform float uVH; uniform float uMove; uniform vec3 uA[9];
attribute float aSeed; attribute float aKind; attribute float aIdx; attribute float aBirth;
varying float vA; varying float vKind;
float h1(float n) { return fract(sin(n) * 43758.5453); }
vec3 paw(float i) { return i < 0.5 ? uA[0] : i < 1.5 ? uA[1] : i < 2.5 ? uA[2] : uA[3]; }
vec3 anc(float i) { return i < 3.5 ? paw(i) : i < 4.5 ? uA[4] : i < 5.5 ? uA[5] : i < 6.5 ? uA[6] : i < 7.5 ? uA[7] : uA[8]; }
`
const TAIL = `
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, sz * projectionMatrix[1][1] * uVH * 0.5 / max(0.05, -mv.z));
  vA = a; vKind = aKind;
}`
const BODY: Readonly<Record<FxForm, string>> = {
  // three arcs that flash between two of her anchors (a jagged bead chain bowed off her body) + sparks that blink on her coat
  vulnarc: `void main() {
  vec3 p; float sz; float a;
  if (aKind < 0.5) {
    float arc = floor(aIdx / 12.0), k = mod(aIdx, 12.0) / 11.0;
    float ep = floor(uT * 2.2 + arc * 0.37), lt = fract(uT * 2.2 + arc * 0.37);
    float on = step(lt, 0.2) + step(0.28, lt) * step(lt, 0.36);
    vec3 s0 = anc(floor(h1(ep * 3.1 + arc * 17.0) * 8.99)), s1 = anc(floor(h1(ep * 5.7 + arc * 11.0) * 8.99));
    vec3 bow = normalize(vec3(h1(ep + arc) - 0.5, 0.6, h1(ep * 2.0 + arc) - 0.5)) * uH * 0.22 * sin(3.1416 * k);
    float fl = floor(uT * 24.0);
    vec3 jag = (vec3(h1(aIdx * 1.3 + fl), h1(aIdx * 2.7 + fl), h1(aIdx * 4.1 + fl)) - 0.5) * uH * 0.09 * sin(3.1416 * k);
    p = mix(s0, s1, k) + bow + jag;
    sz = uH * 0.045; a = on * step(0.01, distance(s0, s1)) * 0.95;
  } else {
    float ep = floor(uT * 3.0 + aSeed * 7.0), lt = fract(uT * 3.0 + aSeed * 7.0);
    vec3 s0 = anc(floor(h1(ep * 1.9 + aIdx) * 8.99));
    p = s0 + (vec3(h1(ep + aIdx * 3.0), h1(ep + aIdx * 5.0), h1(ep + aIdx * 7.0)) - 0.5) * uH * 0.4 + vec3(0.0, lt * uH * 0.08, 0.0);
    sz = uH * 0.035 * (1.0 - lt); a = (1.0 - lt) * step(h1(ep * 9.0 + aIdx), 0.5) * 0.9;
  }` + TAIL,
  // bubbles rising off her tail and back, droplets kicked up at her paws while she moves, a shimmer twinkling along the tongues
  vulnix: `void main() {
  vec3 p; float sz; float a;
  if (aKind < 0.5) {
    float life = 2.4, ph = fract(uT / life + aSeed), cy = floor(uT / life + aSeed);
    float r1 = h1(aSeed * 91.0 + cy * 7.1), r2 = h1(aSeed * 37.0 + cy * 3.3), r3 = h1(aSeed * 13.0 + cy * 5.7);
    vec3 src = r1 < 0.6 ? mix(uA[4], uA[5], r2) : mix(uA[8], uA[6], r2);
    p = src + vec3(r2 - 0.5, 0.0, r3 - 0.5) * uH * 0.3 + vec3(sin(uT * 3.0 + aSeed * 40.0) * 0.025 * uH, ph * uH * 0.6, 0.0);
    sz = uH * (0.03 + 0.03 * r3) * (1.0 - 0.3 * ph);
    a = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.82, 1.0, ph)) * 0.85;
  } else if (aKind < 1.5) {
    float life = 0.5, ph = fract(uT / life + aSeed), cy = floor(uT / life + aSeed);
    float r1 = h1(aSeed * 19.0 + cy), r2 = h1(aSeed * 53.0 + cy * 1.7), ang = r1 * 6.2832;
    p = paw(mod(aIdx, 4.0)) + vec3(cos(ang), 0.0, sin(ang)) * ph * uH * 0.16 + vec3(0.0, (ph - ph * ph) * uH * 0.4, 0.0);
    sz = uH * 0.028; a = uMove * (1.0 - ph) * step(r2, 0.8);
  } else {
    float k = aSeed; vec3 src = mix(uA[4], uA[5], k);
    p = src + (vec3(h1(aIdx * 3.1), h1(aIdx * 7.3) + 0.2, h1(aIdx * 1.9)) - 0.5) * uH * 0.14;
    float tw = 0.5 + 0.5 * sin(uT * 5.0 + aIdx * 2.3);
    sz = uH * 0.035 * tw; a = tw * tw * 0.75;
  }` + TAIL,
  // the gold trail (CPU-fed ring: position + birth) fading a breath behind her, and a few slow motes round her
  vulnara: `void main() {
  vec3 p; float sz; float a;
  if (aKind < 0.5) {
    float age = uT - aBirth, f = clamp(age / ${TRAIL_LIFE.toFixed(2)}, 0.0, 1.0);
    p = position + vec3(0.0, age * uH * 0.05, 0.0);
    sz = uH * 0.075 * (1.0 - 0.5 * f); a = (1.0 - f) * (1.0 - f) * 0.8 * step(0.0, age);
  } else {
    float ang = uT * 0.6 + aSeed * 6.2832, r = uH * (0.35 + 0.1 * sin(uT * 0.9 + aIdx));
    p = mix(uA[8], uA[6], 0.5) + vec3(cos(ang) * r, sin(uT * 0.8 + aIdx * 1.7) * uH * 0.15 + uH * 0.1, sin(ang) * r);
    float tw = 0.55 + 0.45 * sin(uT * 2.1 + aIdx * 1.3);
    sz = uH * 0.04 * tw; a = 0.55 * tw;
  }` + TAIL,
}
const FRAG = `uniform vec3 uCol; varying float vA; varying float vKind; uniform float uRing;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0 || vA < 0.003) discard;
  float soft = (1.0 - d) * (1.0 - d), ring = smoothstep(0.5, 0.8, d) * (1.0 - smoothstep(0.86, 1.0, d));
  float m = vKind < 0.5 && uRing > 0.5 ? ring * 1.3 + soft * 0.2 : soft * 1.4 + step(d, 0.25) * 0.6;
  gl_FragColor = vec4(uCol * m * vA, 1.0);
}`

export type SpiritFx = ReturnType<typeof makeSpiritFx>
/** One form's effect: a Points to mount BESIDE her group (in the same parent), and update() once a frame. */
export function makeSpiritFx(form: FxForm, bones: readonly THREE.Bone[], h: number) {
  const n = FX_COUNT[form], geo = new THREE.BufferGeometry()
  const pos = new Float32Array(n * 3), seed = new Float32Array(n), kind = new Float32Array(n), idx = new Float32Array(n), birth = new Float32Array(n).fill(-99)
  // kinds: Vulnarc 0 = arc bead (36), 1 = spark; Vulnix 0 bubble (14), 1 droplet (12), 2 shimmer (8); Vulnara 0 trail (24), 1 mote
  const cut = form === 'vulnarc' ? [36, n] : form === 'vulnix' ? [14, 26, n] : [TRAIL, n]
  for (let i = 0; i < n; i++) { const k = cut.findIndex(c => i < c), first = k ? cut[k - 1] : 0; kind[i] = k; idx[i] = i - first; seed[i] = ((i * 0.6180339) % 1) }
  if (form === 'vulnix') for (let i = 26; i < n; i++) seed[i] = (i - 26 + 0.5) / (n - 26)   // the shimmer spreads tail2 -> tail4
  const posA = new THREE.BufferAttribute(pos, 3), birthA = new THREE.BufferAttribute(birth, 1)
  posA.setUsage(THREE.DynamicDrawUsage); birthA.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', posA); geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1))
  geo.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1)); geo.setAttribute('aBirth', birthA)
  const anchors = FX_BONES.map(() => new THREE.Vector3())
  const u = { uT: { value: 0 }, uH: { value: h }, uVH: { value: 800 }, uMove: { value: 0 }, uA: { value: anchors }, uCol: { value: new THREE.Color(FX_COLOR[form]) }, uRing: { value: form === 'vulnix' ? 1 : 0 } }
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: HEAD + BODY[form], fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; points.name = `spirit-fx-${form}`; points.renderOrder = 2
  const byName = FX_BONES.map(b => bones.find(x => x.name === b) ?? null)
  const inv = new THREE.Matrix4(), last = new THREE.Vector3(NaN, 0, 0)
  let ring = 0, emitAt = -1, frames = 0, lastT = 0
  return {
    points, form, count: n,
    /** t = clock seconds, move = 0..1 how fast she goes, vh = drawing-buffer height in px. Reads last frame's bone matrices. */
    update(t: number, move: number, vh: number) {
      const par = points.parent; if (!par) return
      inv.copy(par.matrixWorld).invert()
      for (let i = 0; i < byName.length; i++) { const b = byName[i]; if (b) anchors[i].setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv) }
      u.uT.value = lastT = t; u.uVH.value = vh; u.uMove.value += (move - u.uMove.value) * 0.15; frames++
      if (form === 'vulnara' && frames > 2) {
        // a smear every ~4 cm she travels (never faster than 30 a second), at her middle + a little scatter
        const src = anchors[8], gap = h * 0.06
        if (Number.isNaN(last.x)) last.copy(src)
        if (last.distanceTo(src) > gap && t - emitAt > 1 / 30) {
          const j = ring++ % TRAIL; emitAt = t; last.copy(src)
          pos[j * 3] = src.x + (Math.sin(t * 37.1) * 0.5) * h * 0.08; pos[j * 3 + 1] = src.y + h * (0.1 + 0.08 * Math.sin(t * 13.3)); pos[j * 3 + 2] = src.z + Math.cos(t * 29.7) * 0.5 * h * 0.08
          birth[j] = t; posA.needsUpdate = birthA.needsUpdate = true
        }
      }
    },
    /** the probe: smears alive now + laid so far (Vulnara), the anchors found on her rig */
    stats: () => ({ form, count: n, bones: byName.filter(Boolean).length, trail: form === 'vulnara' ? Array.from(birth).filter(b => lastT - b < TRAIL_LIFE).length : 0, laid: ring }),
    dispose() { points.removeFromParent(); geo.dispose(); mat.dispose() },
  }
}
