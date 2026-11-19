// THE OPEN WORLD'S HOLLOW SURFACE (BETA M34 shared parts, sprites 11-19). Built against CANON design-briefs/hollows.md:
//   • NO LIGHT OF ITS OWN. The Hollow materials here carry no emissive at all (the shipped body had a constant grey emissive,
//     which the brief bars: "Any colour it owns. Emissive…"). The white HIT FLASH is the one exception and it is HELD, not
//     settled: Alex is asked (M34 board). It rides a separate overlay in combat-layer, never this material.
//   • THE SHEEN IS BORROWED. Diffuse dead dark, specular high, and the environment it reflects is the SKY over THE GROUND
//     UNDER IT, greyed toward the drain by how close it stands to an infected node. So a Hollow at the edge of good ground
//     goes wet with that ground's colour and one at its sump reads dry, grey on grey: the brief's "★ FREE" tell
//     ("the wetter a Hollow looks, the closer it is to something worth protecting"), which the sky-only env in
//     voxel3d/sky-env.ts cannot show (it has no positional input; the brief records that as the open HOLD).
//   • THE HOUR rides envMapIntensity (voxel3d/sky-env.ts borrowedSky): a midnight Hollow keeps only a trace.
// Why per-material envMap and never scene.environment: voxel3d/sky-env.ts's header (it would re-light every Lambert in the game).
// Cost: envs are cached by (biome colour, grey step): a few 64x32 textures + their PMREM, shared by every Hollow standing on
// the same kind of ground. Each Hollow keeps ONE material (its env can differ from its neighbour's); draw calls unchanged.
import * as THREE from 'three'
import { SKY } from '../shared/sky-palette'
import { BIOME, type BiomeId } from './wilds'
import { P } from './palette'

/** how dark the goop's own (diffuse) colour is: dead, never lit-looking (sRGB; three converts) */
export const GOOP = '#0d0d0f'
/** the borrow at full daylight (brief: "specular high") */
export const BORROW = 1.5
/** the drain: within GREY_NEAR m of an infected node the ground it borrows is fully grey; past GREY_FAR none of it is */
export const GREY_NEAR = 10, GREY_FAR = 60
export const DRAIN = '#77797c'
/** steps the grey is quantized to (each step + ground colour = one cached env) */
export const GREY_STEPS = 4

/** how drained the ground at (x, z) reads, 0 (good ground) .. 1 (the sump), from the nearest infected node. Pure. */
export function greyAt(x: number, z: number, nodes: readonly { x: number; z: number }[]): number {
  let d = Infinity
  for (const n of nodes) { const k = Math.hypot(n.x - x, n.z - z); if (k < d) d = k }
  if (d <= GREY_NEAR) return 1
  if (d >= GREY_FAR) return 0
  return 1 - (d - GREY_NEAR) / (GREY_FAR - GREY_NEAR)
}
/** the grey quantized to its env step (0..GREY_STEPS) */
export const greyStep = (g: number) => Math.round(Math.max(0, Math.min(1, g)) * GREY_STEPS)

/** the ground colour a Hollow borrows: the biome's colour pulled toward the drain by `step` (sRGB hex). Pure. */
export function borrowedGround(biomeHex: string, step: number): string {
  const c = new THREE.Color(biomeHex).lerp(new THREE.Color(DRAIN), Math.max(0, Math.min(1, step / GREY_STEPS)))
  return '#' + c.getHexString()
}

const ENV_W = 64, ENV_H = 32
const envs = new Map<string, THREE.DataTexture>()
/** the sky (day palette: the HOUR rides intensity, not the texture) over `groundHex`. Cached per ground colour (shared by
 *  every Hollow on that ground) until the Wilds are left: releaseGroundEnvs() (M34 heap, 11-19). Same curve as voxel3d/sky-env.ts: mix(horizon, zenith, up^0.6) above,
 *  the ground fading in below the horizon so the highlight sweeps no seam. */
export function groundEnv(groundHex: string): THREE.DataTexture {
  const hit = envs.get(groundHex); if (hit) return hit
  const zen = new THREE.Color(SKY.day.zenith), hor = new THREE.Color(SKY.day.horizon), gnd = new THREE.Color(groundHex), c = new THREE.Color()
  const data = new Uint8Array(ENV_W * ENV_H * 4)
  for (let y = 0; y < ENV_H; y++) {
    const up = Math.cos(((y + 0.5) / ENV_H) * Math.PI)
    if (up >= 0) c.copy(hor).lerp(zen, Math.pow(up, 0.6)); else c.copy(hor).lerp(gnd, Math.min(1, -up * 2.2))   // linear-space lerp (THREE.Color is linear)
    c.convertLinearToSRGB()
    for (let x = 0; x < ENV_W; x++) { const i = (y * ENV_W + x) * 4; data[i] = Math.round(c.r * 255); data[i + 1] = Math.round(c.g * 255); data[i + 2] = Math.round(c.b * 255); data[i + 3] = 255 }
  }
  const t = new THREE.DataTexture(data, ENV_W, ENV_H, THREE.RGBAFormat)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  envs.set(groundHex, t)
  return t
}

/** Leaving the Wilds (combat-layer.tsx, once the layer has been inactive a moment): every Hollow has unmounted, so no
 *  material still holds these. dispose() frees the GPU texture AND three's PMREM copy (WebGLCubeUVMaps listens for it);
 *  clearing the map lets the JS side go. Returns how many were freed. M34 heap, 11-19: ~0.7 MB back at home. */
export function releaseGroundEnvs(): number { const n = envs.size; for (const t of envs.values()) t.dispose(); envs.clear(); return n }
/** probe for checks: how many ground envs are cached right now (0 at home) */
export const groundEnvCount = () => envs.size
if (typeof window !== 'undefined') (window as unknown as { __goop?: object }).__goop = { envs: groundEnvCount }

/** one Hollow's goop: dark, wet, borrowing. No emissive, ever (the hit flash is an overlay elsewhere). */
export function goopMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: GOOP, roughness: 0.18, metalness: 0, envMapIntensity: BORROW, flatShading: false })
}

/** the colour of a Wilds biome's ground (the same palette wilds-scene.tsx paints it with), sRGB hex */
export function biomeGround(b: BiomeId): string {
  const c = b === BIOME.water ? P.bed : b === BIOME.shore ? P.shore : b === BIOME.rock ? P.rock : b === BIOME.woods ? P.woods : P.grass
  return '#' + c.getHexString()
}
