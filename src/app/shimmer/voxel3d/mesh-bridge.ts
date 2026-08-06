// Host side of the port boundary — finished attributes → Three.js.
//
// ★ THIS FILE IS ALLOWED TO IMPORT THREE. `src/app/shimmer/voxel/` is not, and `purity.test.ts`
// enforces that by walking its import graph. The whole portability strategy lives on this line.
//
// The per-voxel work — colour lookup, per-vertex expansion — lives in `attrs.ts` so it can run
// inside the generation Worker, which cannot import three. What is left here is buffer wrapping and
// the one shared material.

import * as THREE from 'three'
import type { MeshAttrs } from './attrs'
import type { VoxelSettings } from './settings'

export { MATERIAL_COLOR, EMISSIVE } from './attrs'

/** Wrap worker-built buffers in a geometry. No copies — these arrays were transferred. */
export function toGeometry(a: MeshAttrs): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3))
  g.setAttribute('color', new THREE.BufferAttribute(a.colors, 3))
  g.setAttribute('aEmissive', new THREE.BufferAttribute(a.emissive, 1))
  // One float per vertex is the entire cost of texturing — UVs are derived in-shader.
  g.setAttribute('aLayer', new THREE.BufferAttribute(a.layers, 1))
  g.setIndex(new THREE.BufferAttribute(a.indices, 1))
  g.computeBoundingSphere()
  return g
}

/** The uniforms the settings panel drives. Held so a style change is a value write, not a rebuild. */
export interface VoxelMaterial extends THREE.Material {
  uniforms?: Record<string, { value: number }>
}

/**
 * One shared material for the whole world, not one per chunk.
 *
 * ★ A material per chunk is a shader program per chunk, and hundreds of programs is how a voxel
 * renderer dies — this page was BLOCKED from creating a WebGL context today for exactly that, from
 * a material per dropped item. `render-audit.test.ts` now fails the build on it.
 *
 * ★ AND THE CARTOON PATH IS A UNIFORM, NOT A SECOND MATERIAL. Both shading models are compiled into
 * this one program and selected by `uCartoon`, so switching styles in settings is instant and
 * allocates nothing. A second material would be the same bug wearing a different hat.
 */
export function createVoxelMaterial(): VoxelMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }) as VoxelMaterial
  const u = {
    uCartoon: { value: 0 },
    uToon: { value: 0 },
    uOutline: { value: 0 },
    uFaceShading: { value: 0.35 },
    uShadowLift: { value: 0.15 },
  }
  mat.uniforms = u

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nattribute float aEmissive;\nvarying float vEmissive;\n'
        + 'varying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvEmissive = aEmissive;\n'
        + 'vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n'
        + 'vWNorm = normalize(mat3(modelMatrix) * objectNormal);')

    // ── the cartoon stack ────────────────────────────────────────────────────────────────────
    // Four levers, each independently dialled from settings so the look can be judged by moving
    // one at a time on the real world rather than argued about in the abstract.
    const emit = `
      vec3 nrm = normalize(vWNorm);

      // 1. FIXED BRIGHTNESS PER FACE DIRECTION. Top bright, sides mid, bottom dark — the single
      //    biggest "stylised block game" signal, and free because axis-aligned quads have exact
      //    normals. This is most of why Minecraft and Trove read the way they do.
      float faceLum = nrm.y > 0.5 ? 1.0 : (nrm.y < -0.5 ? 0.52 : 0.76 + 0.05 * abs(nrm.x));
      float face = mix(1.0, faceLum, uFaceShading);

      // 2. BAND THE LIGHTING. A smooth ramp reads as lit; hard steps read as drawn.
      float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
      float bands = 3.0;
      float stepped = floor(lum * bands + 0.5) / bands;
      float shaped = mix(lum, stepped, uToon);

      // 3. LIFT AND TINT THE SHADOWS. Cartoon shadows are never black — they are a cooler, still
      //    saturated version of the base. Without this, caves read as murk rather than as shade.
      vec3 shade = mix(vec3(0.0), vec3(0.22, 0.26, 0.38), uShadowLift);
      vec3 toonCol = diffuseColor.rgb * face * (0.35 + 0.95 * shaped) + shade * (1.0 - shaped);

      // 4. BLOCK OUTLINES, IN-SHADER. UVs are derived from world position, so the distance to a
      //    block boundary is already available — no post-process pass, no extra geometry. The axis
      //    along the normal is masked out so a face is not outlined against its own depth.
      vec3 fr = fract(vWPos - nrm * 0.002);
      vec3 dEdge = min(fr, 1.0 - fr);
      vec3 planar = 1.0 - abs(nrm);
      float edge = min(mix(1.0, dEdge.x, planar.x),
                   min(mix(1.0, dEdge.y, planar.y), mix(1.0, dEdge.z, planar.z)));
      float line = 1.0 - smoothstep(0.0, 0.035, edge);
      toonCol *= mix(1.0, 0.62, line * uOutline);

      vec3 finalCol = mix(outgoingLight, toonCol, uCartoon);
      gl_FragColor = vec4(finalCol + diffuseColor.rgb * vEmissive, diffuseColor.a);
    `
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying float vEmissive;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;\n'
        + 'uniform float uCartoon;\nuniform float uToon;\nuniform float uOutline;\n'
        + 'uniform float uFaceShading;\nuniform float uShadowLift;')
      // Three renamed this chunk around 0.16x; handle both, or a version bump silently unlights
      // every ore in the world with no error anywhere.
      .replace('#include <output_fragment>', emit)
      .replace('#include <opaque_fragment>', emit)
  }
  return mat
}

/** Push settings into the shared material. A value write — no recompile, no new program. */
export function applySettings(mat: VoxelMaterial, s: VoxelSettings): void {
  if (!mat.uniforms) return
  mat.uniforms.uCartoon.value = s.style === 'cartoon' ? 1 : 0
  mat.uniforms.uToon.value = s.toon
  mat.uniforms.uOutline.value = s.outline
  mat.uniforms.uFaceShading.value = s.faceShading
  mat.uniforms.uShadowLift.value = s.shadowLift
}
