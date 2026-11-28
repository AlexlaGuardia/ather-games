// BETA M202 (world lane, 2026-11-28): TIDEMERE CARRIES HER OWN WATER. Canon world/spirits-species.md (Alex, Magii bcc8bb5): "Tidemere
// and its four awakenings keep their flippers; on land each glides on a thin sheet of water that travels under it, leaving a wet trail
// that dries behind. In water they swim." Her rig (docs/looks/m202-tidemere-glide-2026-11-28/tools/rig_tidemere.py) has no legs: her
// plastron rides CLEAR (0.03 glb units) over her ground in every clip and her flippers stroke over it. This module draws what she rides:
//   SHEET  a thin flowing translucent disc under her body, a child of her group (turns + moves with her), in her own aqua; its flow
//          lines run back under her as fast as she goes (the phase is fed her travel, so a stop stills the flow, the ripples go on)
//   TRAIL  wet patches laid on the ground behind her every `gap` metres she travels, in her parent's space (they stay where laid),
//          drying out over TRAIL_LIFE seconds (darker wet sheen, then shrinking from the edges and gone). A fixed ring of TRAIL_N
//          quads in ONE geometry: laying one writes 4 vertices, nothing is allocated per frame.
// Cheap on purpose: two draw calls, a few uniforms a frame. Art-medium law: a living thing's water stays live (shader), not a sprite.
import * as THREE from 'three'

/** the forms that glide on their own water (by look name) */
export const WATER_FORMS = ['tidemere', 'tidemok', 'tidessa', 'tidemerk', 'tidemyr'] as const   // M244 sheet 11: her four awakenings ride theirs too (canon: the line carries its own water)
export type WaterForm = typeof WATER_FORMS[number]
export const isWaterForm = (n: string): n is WaterForm => (WATER_FORMS as readonly string[]).includes(n)
/** wet patches alive at most at once, and how long one takes to dry (s) */
export const TRAIL_N = 20, TRAIL_LIFE = 3.5
/** her plastron's height over her ground in the rig (glb units, rig_tidemere.py CLEAR): the sheet lies under it */
export const SHEET_CLEAR = 0.03
/** the sheet in glb units of her look (x her h = metres): half-width, half-length, how far it sits ahead of her pivot */
const SHEET = { rx: 0.56, rz: 0.70, z: -0.10 }
const COL = { water: '#7fe3da', deep: '#2aa59f', foam: '#e6fffb' }

const SHEET_V = `uniform float uT; uniform float uWave; varying vec2 vP;
void main() { vP = position.xy; vec3 p = position;
  float r = length(p.xy); p.z += sin(r * 9.0 - uT * 3.2) * uWave * (1.0 - r);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`
// vP = the disc's own coords (unit circle; +y = her front after the flat turn). Ripple rings out from her middle, flow streaks
// running back under her by the travel phase, a soft bright rim, alpha fading to nothing at the edge.
const SHEET_F = `uniform float uT; uniform float uFlow; uniform vec3 uWater; uniform vec3 uDeep; uniform vec3 uFoam; varying vec2 vP;
void main() { float r = length(vP); if (r > 1.0) discard;
  float ring = 0.5 + 0.5 * sin(r * 22.0 - uT * 4.0);
  float streak = smoothstep(0.75, 1.0, sin(vP.x * 26.0 + sin(vP.y * 5.0 + uT) * 1.2)) * smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(vP.y * 9.0 + uFlow * 6.0));
  float rim = smoothstep(0.78, 0.93, r) * (1.0 - smoothstep(0.93, 1.0, r));
  vec3 c = mix(uDeep, uWater, 0.55 + 0.25 * ring) + uFoam * (streak * 0.35 + rim * 0.55);
  float a = (0.42 + 0.12 * ring + 0.25 * streak + 0.35 * rim) * (1.0 - smoothstep(0.86, 1.0, r));
  gl_FragColor = vec4(c, a); }`
const TRAIL_V = `uniform float uT; attribute float aBirth; attribute vec2 aC; varying vec2 vC; varying float vF;
void main() { float age = uT - aBirth; vF = clamp(age / ${TRAIL_LIFE.toFixed(2)}, 0.0, 1.0); vC = aC; if (age < 0.0) vF = 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
// a wet patch: an ellipse, its edge drying in first (the radius shrinks as it dries), a darker sheen fading out
const TRAIL_F = `uniform vec3 uDeep; uniform vec3 uWater; varying vec2 vC; varying float vF;
void main() { float r = length(vC), edge = 1.0 - 0.45 * vF; if (vF >= 1.0 || r > edge) discard;
  float wet = (1.0 - vF) * (1.0 - vF), soft = 1.0 - smoothstep(edge * 0.6, edge, r);
  gl_FragColor = vec4(mix(uDeep, uWater, 0.3 + 0.3 * (1.0 - r)), 0.38 * wet * soft); }`

/** pure: where the next wet patch goes. Lays one when she has travelled `gap` since the last (a stop lays none). Returns true when laid. */
export function trailStep(st: { x: number; z: number; init: boolean }, x: number, z: number, gap: number): boolean {
  if (!st.init) { st.x = x; st.z = z; st.init = true; return false }
  if (Math.hypot(x - st.x, z - st.z) < gap) return false
  st.x = x; st.z = z; return true
}
/** pure: how many patches are still wet at time t */
export const wetCount = (births: ArrayLike<number>, t: number) => { let n = 0; for (let i = 0; i < births.length; i++) if (t - births[i] >= 0 && t - births[i] < TRAIL_LIFE) n++; return n }

export type TideGlide = ReturnType<typeof makeTideGlide>
/** Her water: `sheet` goes INTO her group (child), `trail` BESIDE it (same parent); update() once a frame. h = her look h (m per glb unit). */
export function makeTideGlide(h: number) {
  const water = new THREE.Color(COL.water), deep = new THREE.Color(COL.deep), foam = new THREE.Color(COL.foam)
  // the sheet: a unit disc in xy, turned flat (its +y to her front, +z), scaled to her body
  const sGeo = new THREE.CircleGeometry(1, 40, 0, Math.PI * 2)
  const su = { uT: { value: 0 }, uFlow: { value: 0 }, uWave: { value: 0.012 }, uWater: { value: water }, uDeep: { value: deep }, uFoam: { value: foam } }
  const sMat = new THREE.ShaderMaterial({ uniforms: su, vertexShader: SHEET_V, fragmentShader: SHEET_F, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  const sheet = new THREE.Mesh(sGeo, sMat); sheet.name = 'tide-sheet'; sheet.renderOrder = 1; sheet.frustumCulled = false
  sheet.rotation.x = -Math.PI / 2; sheet.scale.set(SHEET.rx * h, SHEET.rz * h, h * 0.5)   // after the turn: x = her width, y(local) = her length
  sheet.position.set(0, SHEET_CLEAR * 0.45 * h, SHEET.z * h); sheet.userData.tide = 'sheet'
  // the trail: TRAIL_N quads, each four corners (aC = the corner's ellipse coords), births far in the past until laid
  const pos = new Float32Array(TRAIL_N * 4 * 3), birth = new Float32Array(TRAIL_N * 4).fill(-99), cor = new Float32Array(TRAIL_N * 4 * 2), idx: number[] = []
  for (let i = 0; i < TRAIL_N; i++) { cor.set([-1, -1, 1, -1, 1, 1, -1, 1], i * 8); const o = i * 4; idx.push(o, o + 2, o + 1, o, o + 3, o + 2) }
  const tGeo = new THREE.BufferGeometry(), posA = new THREE.BufferAttribute(pos, 3), birthA = new THREE.BufferAttribute(birth, 1)
  posA.setUsage(THREE.DynamicDrawUsage); birthA.setUsage(THREE.DynamicDrawUsage)
  tGeo.setAttribute('position', posA); tGeo.setAttribute('aBirth', birthA); tGeo.setAttribute('aC', new THREE.BufferAttribute(cor, 2)); tGeo.setIndex(idx)
  const tu = { uT: { value: 0 }, uWater: { value: water }, uDeep: { value: deep } }
  const tMat = new THREE.ShaderMaterial({ uniforms: tu, vertexShader: TRAIL_V, fragmentShader: TRAIL_F, transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const trail = new THREE.Mesh(tGeo, tMat); trail.name = 'tide-trail'; trail.frustumCulled = false; trail.renderOrder = 1; trail.userData.tide = 'trail'
  const st = { x: 0, z: 0, init: false }, gap = 0.55 * h, halfW = SHEET.rx * h * 0.8, halfL = gap * 0.9
  const v = new THREE.Vector3(), inv = new THREE.Matrix4()
  let ring = 0, lastT = 0, flow = 0, lastX = NaN, lastZ = 0
  const lay = (x: number, y: number, z: number, yaw: number, t: number) => {
    const j = ring++ % TRAIL_N, s = Math.sin(yaw), c = Math.cos(yaw)
    // her front = (sin yaw, cos yaw) in the parent's xz; the patch's long axis runs along it
    const C: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    C.forEach(([a, b], k) => { const lx = a * halfW, lz = b * halfL; pos.set([x + lx * c + lz * s, y, z - lx * s + lz * c], (j * 4 + k) * 3); birth[j * 4 + k] = t })
    posA.needsUpdate = birthA.needsUpdate = true
  }
  return {
    sheet, trail, gap,
    /** t = clock s; grp = her group (the sheet's parent, the trail's sibling); anchor = her shell bone (the sheet + patches follow her body) */
    update(t: number, grp: THREE.Object3D, anchor: THREE.Object3D | null) {
      su.uT.value = tu.uT.value = lastT = t
      const par = grp.parent; if (!par) return
      if (anchor) { anchor.getWorldPosition(v); grp.worldToLocal(v); sheet.position.x = v.x; sheet.position.z = v.z + SHEET.z * h * 0.3 }
      // her body's point in her parent's space, on her ground (her group's origin = her feet plane)
      if (anchor) { anchor.getWorldPosition(v); inv.copy(par.matrixWorld).invert(); v.applyMatrix4(inv) } else v.copy(grp.position)
      if (!Number.isNaN(lastX)) flow += Math.hypot(v.x - lastX, v.z - lastZ) / Math.max(0.05, h)
      lastX = v.x; lastZ = v.z; su.uFlow.value = flow
      if (trailStep(st, v.x, v.z, gap)) lay(v.x, grp.position.y + 0.004, v.z, grp.rotation.y, t)
    },
    /** the probe: the sheet mounted (in her group, on her ground), patches wet now + laid so far */
    stats: () => ({ sheet: !!sheet.parent && sheet.visible, sheetY: sheet.position.y, sheetW: SHEET.rx * h * 2, wet: wetCount(birth.filter((_, i) => i % 4 === 0), lastT), laid: ring, life: TRAIL_LIFE, cap: TRAIL_N }),
    dispose() { sheet.removeFromParent(); trail.removeFromParent(); sGeo.dispose(); sMat.dispose(); tGeo.dispose(); tMat.dispose() },
  }
}
