'use client'
// THE VOID LOOK (Alex 11-23 05:5x: "the voids look like stone pits ingame.. can we make the base texture like a mat black with
// glimmers of purple and then a layer of thinning black fog to give it a deep look").
// CANON (read-only): a cloud void is deep, uncooled cloud, star-flecked, empty and uncrossable; wall and void one substance
// (game/shimmer-geography.md). What it looks like on screen is Jin's build: this file. Nothing here is walkable or scenery.
//   the floor: wilds-scene paints voided cells VOID_FLOOR (matte near-black) on GROUND.void, which the ground shader leaves
//              untextured (no stone tile, Lambert so no specular)
//   the haze:  HAZE_LAYERS stacked planes over the void's cells only, black and thinning upward, so the floor and the lower
//              wall are lost; sparse purple flecks ride the planes (deepest the most), so the glimmers sit at different
//              depths and parallax as you move. ONE mesh per tile, one draw. All layers are black-over (premultiplied: src
//              ONE, dst ONE_MINUS_SRC_ALPHA), and black-over commutes, so the unsorted layers inside one mesh are order-free.
//              The lowest plane floats above the floor (no coplanar layer at ground level, M58).
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Wilds } from './wilds'
import { VOID_FLOOR_ABOVE_WATER } from './wilds-voids'

/** the void floor's matte near-black, a breath of violet in it */
export const VOID_FLOOR = new THREE.Color('#0a0910')
export const VOID_LOOK = 'matte-glimmer-fog-1'
/** height above the void floor, the haze's black, the share of its cells that carry a glimmer */
export const HAZE_LAYERS: readonly { y: number; a: number; fleck: number }[] = [
  { y: 0.45, a: 0.42, fleck: 0.09 },
  { y: 1.4, a: 0.3, fleck: 0.05 },
  { y: 2.6, a: 0.18, fleck: 0.03 },
  { y: 4.0, a: 0.09, fleck: 0.015 },
]
/** A land cell's nearness to the void: the share of void among the 5x5 cells round it (0 far off, ~0.4 on the rim). wilds-scene
 *  darkens the lip by it, so land rolls into the dark instead of stopping at a cell edge. */
export function voidShare(v: Uint8Array, cx: number, cz: number, i: number, j: number): number {
  let n = 0
  for (let b = j - 2; b <= j + 2; b++) for (let a = i - 2; a <= i + 2; a++) if (a >= 0 && b >= 0 && a < cx && b < cz && v[b * cx + a]) n++
  return n / 25
}
/** how far the rim goes toward the void floor, at most (and past which share the rim drops its ground tile) */
export const RIM_DARK = 0.85, RIM_UNTILED = 0.3
/** the haze is laid on a grid of HAZE_STEP ground cells (8 m on a 4 m tile): few vertices, the alpha still feathers out */
const HAZE_STEP = 2

/** The haze planes over a tile's voided cells (local tile coords, like the ground). null when the tile has no void. */
export function hazeGeometry(W: Wilds): { geo: THREE.BufferGeometry; cells: number; deep: [number, number][] } | null {
  const v = W.voided; if (!v) return null
  const { nx, nz, cell, sizeX, sizeZ, waterY } = W.meta
  const cx = nx - 1, cz = nz - 1, hx = sizeX / 2, hz = sizeZ / 2
  const vox = (i: number, j: number) => (i >= 0 && j >= 0 && i < cx && j < cz && v[j * cx + i] ? 1 : 0)
  // a ground vertex's voidness: the share of void in the 4x4 cells (16 m) round it, so the haze ramps in across the rim
  // (from 8 m out on the land's lip to 8 m into the void) instead of stopping at a cell edge: the rim fades into the dark
  const vAt = (i: number, j: number) => { let n = 0; for (let b = j - 2; b < j + 2; b++) for (let a = i - 2; a < i + 2; a++) n += vox(a, b); return n / 16 }
  const NI = Math.ceil(cx / HAZE_STEP), NJ = Math.ceil(cz / HAZE_STEP)
  const vc = (I: number, J: number) => vAt(Math.min(cx, I * HAZE_STEP), Math.min(cz, J * HAZE_STEP))
  const keep: number[] = []
  for (let J = 0; J < NJ; J++) for (let I = 0; I < NI; I++) if (vc(I, J) + vc(I + 1, J) + vc(I, J + 1) + vc(I + 1, J + 1) > 0) keep.push(J * NI + I)
  if (!keep.length) return null
  // a few deep spots (local coords): cells whose 5x5 neighbourhood is all void, for checks to stand and look at
  const deep: [number, number][] = []
  for (let j = 2; j < cz - 2 && deep.length < 12; j += 3) for (let i = 2; i < cx - 2 && deep.length < 12; i += 3) {
    let all = true
    for (let dj = -2; dj <= 2 && all; dj++) for (let di = -2; di <= 2 && all; di++) all = !!vox(i + di, j + dj)
    if (all && deep.every(([x, z]) => Math.hypot(x - ((i + 0.5) * cell - hx), z - ((j + 0.5) * cell - hz)) > 150)) deep.push([(i + 0.5) * cell - hx, (j + 0.5) * cell - hz])
  }
  const vid = new Map<number, number>(), corners: number[] = []
  const idOf = (I: number, J: number) => { const k = J * (NI + 1) + I; let n = vid.get(k); if (n === undefined) { n = corners.length; vid.set(k, n); corners.push(k) } return n }
  const quads: number[] = []
  for (const q of keep) { const I = q % NI, J = (q / NI) | 0; quads.push(idOf(I, J), idOf(I + 1, J), idOf(I, J + 1), idOf(I + 1, J + 1)) }
  const L = HAZE_LAYERS.length, nv = corners.length
  const pos = new Float32Array(nv * L * 3), aV = new Float32Array(nv * L), aK = new Float32Array(nv * L)
  const floor = waterY + VOID_FLOOR_ABOVE_WATER
  for (let k = 0; k < L; k++) corners.forEach((c, n) => {
    const I = c % (NI + 1), J = (c / (NI + 1)) | 0, i = Math.min(cx, I * HAZE_STEP), j = Math.min(cz, J * HAZE_STEP), o = k * nv + n
    pos[o * 3] = i * cell - hx; pos[o * 3 + 1] = floor + HAZE_LAYERS[k].y; pos[o * 3 + 2] = j * cell - hz
    aV[o] = vAt(i, j); aK[o] = k
  })
  const idx = new Uint32Array(quads.length / 4 * 6 * L)
  let w = 0
  for (let k = 0; k < L; k++) for (let q = 0; q < quads.length; q += 4) {
    const b = k * nv, a00 = b + quads[q], a10 = b + quads[q + 1], a01 = b + quads[q + 2], a11 = b + quads[q + 3]
    idx[w++] = a00; idx[w++] = a01; idx[w++] = a11; idx[w++] = a00; idx[w++] = a11; idx[w++] = a10
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aV', new THREE.BufferAttribute(aV, 1))
  geo.setAttribute('aK', new THREE.BufferAttribute(aK, 1))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.computeBoundingSphere()
  return { geo, cells: keep.length, deep }
}

// ⚠ No backticks inside the GLSL.
const HAZE_VS = [
  'attribute float aV;', 'attribute float aK;', 'varying float vV;', 'varying float vK;', 'varying vec2 vP;',
  '#include <fog_pars_vertex>',
  'void main() {',
  '  vV = aV; vK = aK;',
  '  vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xz;',
  '  vec4 mvPosition = viewMatrix * wp;',
  '  gl_Position = projectionMatrix * mvPosition;',
  '#include <fog_vertex>',
  '}',
].join('\n')
const HAZE_FS = [
  'uniform float uTime;', 'uniform float uA[4];', 'uniform float uF[4];', 'uniform vec3 uGlim;',
  'varying float vV;', 'varying float vK;', 'varying vec2 vP;',
  '#include <fog_pars_fragment>',
  'float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }',
  'void main() {',
  '  int k = int(vK + 0.5);',
  '  float feather = smoothstep(0.0, 1.0, vV);',
  // thinning, slowly drifting wisps: each layer its own drift, so the planes never read as flat sheets
  '  vec2 q = vP * 0.06 + vec2(uTime * 0.011 * (vK + 1.0), uTime * 0.007) + vK * 7.3;',
  '  float wisp = 0.55 + 0.75 * vn(q) * vn(q * 2.3 + 3.1);',
  '  float a = clamp(uA[k] * wisp, 0.0, 0.9) * feather;',
  // sparse purple flecks on a 2.5 m grid: a few cells carry one, each twinkling on its own slow clock
  '  vec2 g = vP / 2.5 + vK * 17.31;',
  '  vec2 c = floor(g); float h = h21(c);',
  '  vec3 col = vec3(0.0);',
  '  if (h < uF[k]) {',
  '    vec2 ctr = c + 0.5 + (vec2(h21(c + 3.7), h21(c + 9.1)) - 0.5) * 0.6;',
  '    float d = length(g - ctr) * 2.5;',
  '    float r = clamp(fwidth(d) * 1.1, 0.09, 0.22);   // capped: a plane seen edge-on must not smear a fleck into a streak',
  '    float dot1 = 1.0 - smoothstep(r * 0.5, r * 1.6, d);',
  '    float tw = 0.5 + 0.5 * sin(uTime * (0.5 + h21(c + 1.3) * 0.9) + h21(c + 5.9) * 6.2832);',
  '    col = uGlim * dot1 * (0.35 + 1.4 * tw * tw * tw) * feather;',
  '  }',
  '  float fade = 1.0;',
  '#ifdef USE_FOG',
  '  #ifdef FOG_EXP2',
  '  fade = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);',
  '  #else',
  '  fade = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);',
  '  #endif',
  '#endif',
  '  gl_FragColor = vec4(col * fade, a * fade);',
  '}',
].join('\n')

const TIME = { value: 0 }
let hazeMat: THREE.ShaderMaterial | null = null
function hazeMaterial(): THREE.ShaderMaterial {
  if (hazeMat) return hazeMat
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uA: { value: HAZE_LAYERS.map(l => l.a) }, uF: { value: HAZE_LAYERS.map(l => l.fleck) }, uGlim: { value: new THREE.Color('#a874ff') },
  }])
  u.uTime = TIME   // shared by reference, after the merge (merge clones)
  hazeMat = new THREE.ShaderMaterial({
    vertexShader: HAZE_VS, fragmentShader: HAZE_FS, uniforms: u, fog: true, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  })
  return hazeMat
}

type Probe = { v: string; tiles: Record<string, number>; deep: Record<string, [number, number][]> }
const probe = () => {
  const g = window as unknown as { __voidLook?: Probe }
  return (g.__voidLook ??= { v: VOID_LOOK, tiles: {}, deep: {} })
}

/** One tile's void haze: one draw, no per-frame JS but the shared clock. */
export function VoidHaze({ W, off }: { W: Wilds; off: { x: number; z: number } }) {
  const built = useMemo(() => hazeGeometry(W), [W])
  const mat = hazeMaterial()
  useEffect(() => {
    if (!built) return
    const P = probe(); P.tiles[W.meta.name] = built.cells; P.deep[W.meta.name] = built.deep.map(([x, z]) => [x + off.x, z + off.z])
    return () => { delete P.tiles[W.meta.name]; delete P.deep[W.meta.name]; built.geo.dispose() }
  }, [built, W, off.x, off.z])
  useFrame(({ clock }) => { TIME.value = clock.elapsedTime })
  if (!built) return null
  return <mesh geometry={built.geo} material={mat} renderOrder={1} />
}
