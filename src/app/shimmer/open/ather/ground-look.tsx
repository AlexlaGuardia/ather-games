'use client'
// THE GROUND LOOK A/B (Alex 11-15: "id like to talk about texturing the game a bit" → "yea lets check it out").
// Three looks for the open world's ground, flipped with K on the SAME ground so the comparison is honest:
//   flat  — what shipped: flat-shaded Lambert, colour per vertex
//   toon  — the voxel world's cartoon idea on that same colour: the sun's light banded to three steps, shadows a
//           cooler lift instead of a darker grey
//   tiles — toon + the VOXEL WORLD'S OWN PIXEL TILES (voxel3d/tex/tiles.ts › paintFor, painted in code, not files):
//           grass, forest loam, path, stone, sand, subsoil, projected from above at 2 m a tile, crisp up close
//           (NEAREST) and mipmapped far off, every tile cell turned one of eight ways off a hash so 2 m does not
//           repeat, and TINTED toward the ground's own vertex colour so the Ather keeps its soft palette and the
//           tile carries texture, not hue.
// One material per look, shared by every ground mesh (plot, valley, Wilds): a look change is a material swap,
// never a geometry rebuild. Each ground geometry carries `aLayer` (which tile) per triangle; the flat look ignores it.

import { useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { paintFor, TOP } from '../../voxel3d/tex/tiles'
import { MAT } from '../../voxel/depth'

export type Look = 'flat' | 'toon' | 'tiles'
export const LOOKS: Look[] = ['flat', 'toon', 'tiles']
/** Which tile a ground triangle wears (the `aLayer` attribute). */
export const GROUND = { grass: 0, loam: 1, path: 2, stone: 3, sand: 4, soil: 5 } as const
const LAYER_MATS = [MAT.TOPSOIL, MAT.FOREST_LOAM, MAT.PATH, MAT.STONE, MAT.SAND, MAT.SUBSOIL]
const TILE_PX = 32
export const TILE_M = 2

// ── the look, as a tiny store (URL ?look= wins, then the last pick on this browser, then flat) ─────────────────
const KEY = 'ather.look'
let look: Look = 'flat', shownAt = 0
const subs = new Set<() => void>()
if (typeof window !== 'undefined') {
  try {
    const q = new URLSearchParams(location.search).get('look') as Look | null
    const saved = localStorage.getItem(KEY) as Look | null
    look = q && LOOKS.includes(q) ? q : saved && LOOKS.includes(saved) ? saved : 'flat'
  } catch { /* private window */ }
}
export function cycleLook(): Look {
  look = LOOKS[(LOOKS.indexOf(look) + 1) % LOOKS.length]; shownAt = Date.now()
  try { localStorage.setItem(KEY, look) } catch { /* private window */ }
  subs.forEach(f => f())
  setTimeout(() => subs.forEach(f => f()), 2600)   // let the chip fade
  return look
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useLook = () => useSyncExternalStore(subscribe, () => look, () => 'flat' as Look)
const useShownAt = () => useSyncExternalStore(subscribe, () => shownAt, () => 0)

// ── the tiles ────────────────────────────────────────────────────────────────────────────────────────────────
const toLin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
let tiles: { tex: THREE.DataArrayTexture; mean: THREE.Vector3[] } | null = null
function groundTiles() {
  if (tiles) return tiles
  const n = LAYER_MATS.length, px = TILE_PX * TILE_PX, data = new Uint8Array(px * 4 * n), mean: THREE.Vector3[] = []
  LAYER_MATS.forEach((m, k) => {
    const t = paintFor(m, TOP, TILE_PX); data.set(t, k * px * 4)
    let r = 0, g = 0, b = 0
    for (let i = 0; i < px; i++) { r += toLin(t[i * 4]); g += toLin(t[i * 4 + 1]); b += toLin(t[i * 4 + 2]) }
    mean.push(new THREE.Vector3(r / px, g / px, b / px))
  })
  const tex = new THREE.DataArrayTexture(data, TILE_PX, TILE_PX, n)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.generateMipmaps = true; tex.needsUpdate = true
  tiles = { tex, mean }
  return tiles
}

// ── the material ─────────────────────────────────────────────────────────────────────────────────────────────
// ⚠ No backticks inside the GLSL (a stray one ships a program that fails to link and draws nothing, light-glsl.ts).
const V_DECL = '#include <common>\nattribute float aLayer;\nvarying float vLayer;\nvarying vec3 vWPos;\n'
const V_BODY = '#include <project_vertex>\nvLayer = aLayer;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n'
const F_DECL = '#include <common>\nuniform highp sampler2DArray uTiles;\nuniform float uUseTiles;\nuniform float uToon;\nuniform float uTileM;\nuniform float uTint;\nuniform vec3 uMean[6];\nvarying float vLayer;\nvarying vec3 vWPos;\n'
const F_TILE = [
  '#include <color_fragment>',
  'if (uUseTiles > 0.5) {',
  '  vec3 dx = dFdx(vWPos), dy = dFdy(vWPos);',
  '  vec3 gn = normalize(cross(dx, dy));',
  // tops project from above; a cliff skirt (a wall) projects from the side, so it is not a smear
  '  vec2 p = abs(gn.y) > 0.5 ? vWPos.xz / uTileM : vec2(vWPos.x + vWPos.z, vWPos.y) / uTileM;',
  '  vec2 cell = floor(p), f = fract(p);',
  '  float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);',
  '  float o = floor(h * 8.0);',
  '  if (mod(o, 2.0) > 0.5) f = f.yx;',
  '  if (mod(floor(o / 2.0), 2.0) > 0.5) f.y = 1.0 - f.y;',
  '  if (o >= 4.0) f.x = 1.0 - f.x;',
  '  int L = int(floor(vLayer + 0.5));',
  // gradients from the un-wrapped coordinate, so the mip level does not jump at every cell edge
  '  vec4 t = textureGrad(uTiles, vec3(f, float(L)), dFdx(p), dFdy(p));',
  '  vec3 W = vec3(0.2126, 0.7152, 0.0722);',
  '  vec3 tinted = diffuseColor.rgb * (dot(t.rgb, W) / max(dot(uMean[L], W), 1e-3));',
  '  diffuseColor.rgb = mix(t.rgb, tinted, uTint);',
  '}',
].join('\n')
const F_LIGHT = [
  'vec3 directIrr = reflectedLight.directDiffuse;',
  '#if NUM_DIR_LIGHTS > 0',
  'if (uToon > 0.5) {',
  // the sun's term banded to three steps (the voxel world's toon), computed from the light itself
  '  float ndl = max(dot(normal, directionalLights[0].direction), 0.0);',
  '  float band = ndl < 0.12 ? 0.22 : ndl < 0.5 ? 0.6 : 1.0;',
  // swap ONLY the sun's share for its banded one (the night's silver lights keep theirs); Lambert's 1/π kept
  '  directIrr += diffuseColor.rgb * directionalLights[0].color * (band - ndl) * RECIPROCAL_PI;',
  '}',
  '#endif',
  'vec3 outgoingLight = directIrr + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
  // shadows lift cool, not grey (the voxel stack's shadow lift)
  'if (uToon > 0.5) { float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)) / max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 1e-3); outgoingLight *= mix(vec3(0.9, 0.97, 1.12), vec3(1.0), clamp(lum * 1.4, 0.0, 1.0)); }',
].join('\n')

const mats = new Map<Look, THREE.MeshLambertMaterial>()
export function groundMaterial(l: Look): THREE.MeshLambertMaterial {
  const hit = mats.get(l); if (hit) return hit
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  if (l !== 'flat') {
    const T = groundTiles()
    m.onBeforeCompile = (s) => {
      s.uniforms.uTiles = { value: T.tex }
      s.uniforms.uUseTiles = { value: l === 'tiles' ? 1 : 0 }
      s.uniforms.uToon = { value: 1 }
      s.uniforms.uTileM = { value: TILE_M }
      s.uniforms.uTint = { value: 0.7 }
      s.uniforms.uMean = { value: T.mean }
      s.vertexShader = s.vertexShader.replace('#include <common>', V_DECL).replace('#include <project_vertex>', V_BODY)
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', F_DECL)
        .replace('#include <color_fragment>', F_TILE)
        .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', F_LIGHT)
    }
    m.customProgramCacheKey = () => `ground-${l}`
  }
  mats.set(l, m)
  return m
}
export const useGroundMaterial = () => groundMaterial(useLook())

/** Push one `aLayer` value per vertex, for a triangle list built alongside `pos`. */
export const pushLayer = (out: number[], layer: number, verts: number) => { for (let k = 0; k < verts; k++) out.push(layer) }

/** The look's name on screen for a moment after K flips it (top centre, over the HUD). */
export function LookChip() {
  const l = useLook(), at = useShownAt()
  if (!at || Date.now() - at > 2400) return null
  const name = l === 'flat' ? 'flat colour (now)' : l === 'toon' ? 'toon light' : 'tiles + toon light'
  return (
    <div style={{ position: 'fixed', top: 110, left: '50%', transform: 'translateX(-50%)', zIndex: 70, padding: '8px 16px', borderRadius: 8, background: 'rgba(12,16,20,0.78)', color: '#f4ecd2', font: '600 14px system-ui, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', pointerEvents: 'none' }}>
      ground · {name} <span style={{ opacity: 0.6, fontWeight: 400 }}>(K)</span>
    </div>
  )
}
