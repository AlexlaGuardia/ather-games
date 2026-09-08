// The ring of render light, as one 3D texture the shader can sample.
//
// ★ A TORUS, AND THAT IS WHAT MAKES IT ONE SHARED UNIFORM. A column's field could ride as a
// per-chunk texture, but a per-chunk texture is a per-chunk uniform, which three can only deliver
// through a per-chunk material — a shader program per chunk, which `mesh-bridge.ts` refuses in
// writing and which got this page blocked from creating a WebGL context on 08-06. Wrapping the
// world onto a fixed 9x9-column texture means every chunk reads the SAME sampler at a position it
// derives from its own world coordinates, and nothing per-chunk exists at all.
//
// 144 x 256 x 144 texels at one byte each is 5.3MB, uploaded 64KB at a time as columns finish.
import * as THREE from 'three'
import { SPAN, HEIGHT } from '../voxel/render-light'
import { RING_N, slotOf } from '../voxel/render-light-ring'
import { LIGHT_TEX_W } from './light-glsl'

/**
 * What an un-built slot holds: sky 15, block 0 — i.e. **fully lit**.
 *
 * ⚠ THE SENTINEL IS "BRIGHT", NOT A SENTINEL. A distinguishable no-data value would need a branch
 * in the shader and a rule about what to do with it; filling with daylight means a column whose
 * field has not arrived renders exactly as the game does today and the arrival of the real field is
 * a DARKENING. The safe direction is the one that looks like the status quo.
 */
const UNBUILT = 0xF0

export interface LightTexture {
  texture: THREE.Data3DTexture
  /**
   * Write one column's PACKED field into its slot.
   *
   * ⚠ Packed by the caller, not here. The ring holds a column's bytes so that a field can be
   * uploaded later than it was computed — a column becomes fit for the texture when its NEIGHBOURS
   * finish — and packing twice for that would be 64KB of pointless work per late upload.
   */
  upload: (renderer: THREE.WebGLRenderer, cx: number, cz: number, packed: Uint8Array) => void
  /** Reset a slot to daylight — ⚠ MANDATORY when a column leaves the ring; see `clearSlot`. */
  clearSlot: (renderer: THREE.WebGLRenderer, cx: number, cz: number) => void
  dispose: () => void
}

export function createLightTexture(): LightTexture {
  const data = new Uint8Array(LIGHT_TEX_W * HEIGHT * LIGHT_TEX_W)
  data.fill(UNBUILT)
  const texture = new THREE.Data3DTexture(data, LIGHT_TEX_W, HEIGHT, LIGHT_TEX_W)
  texture.format = THREE.RedFormat
  texture.type = THREE.UnsignedByteType
  // ⚠ NEAREST, ALWAYS. Linear across a 3D light field bleeds a lit cell through the solid block
  // beside it, which is a glow leaking out of a sealed cave and through the rock — and it would be
  // read as a flood-fill bug in a module that is not the one at fault.
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  // The wrap IS the torus. Without RepeatWrapping a column at a negative coordinate clamps to the
  // texture edge and wears its neighbour's darkness.
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.wrapR = THREE.RepeatWrapping
  // ⚠ 1, not the default 4. An R8 upload of a 16-texel row is 16 bytes; at alignment 4 that happens
  // to be legal, so this is insurance against the day SPAN or the format changes and rows start
  // arriving shifted by a few texels — a corruption that looks like a worldgen seam.
  texture.unpackAlignment = 1
  texture.generateMipmaps = false
  texture.needsUpdate = true

  // One 16x256x16 staging texture and one scratch buffer for the whole session. Allocating per
  // upload would be 64KB of garbage per column pass, which at a column a frame is a GC every second.
  const scratch = new Uint8Array(SPAN * HEIGHT * SPAN)
  const stage = new THREE.Data3DTexture(scratch, SPAN, HEIGHT, SPAN)
  stage.format = THREE.RedFormat
  stage.type = THREE.UnsignedByteType
  stage.unpackAlignment = 1
  const dstPos = new THREE.Vector3()

  // ⚠ `copyTextureToTexture` picks its CPU-data path on `!properties.has(srcTexture)` — true only
  // while the staging texture has never been bound as a material's sampler. It never is; do not
  // "reuse" it as one.
  const blit = (renderer: THREE.WebGLRenderer, cx: number, cz: number): void => {
    dstPos.set(slotOf(cx) * SPAN, 0, slotOf(cz) * SPAN)
    stage.needsUpdate = false
    renderer.copyTextureToTexture(stage, texture, null, dstPos)
  }

  return {
    texture,
    upload: (renderer, cx, cz, packed) => { scratch.set(packed); blit(renderer, cx, cz) },
    clearSlot: (renderer, cx, cz) => { scratch.fill(UNBUILT); blit(renderer, cx, cz) },
    dispose: () => { texture.dispose(); stage.dispose() },
  }
}

export { RING_N }
