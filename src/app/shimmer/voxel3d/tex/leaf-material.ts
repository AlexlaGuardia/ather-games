// The canopy's material — the crossed cutout quads every leaf block is meshed as.
//
// Lifted out of VoxelWorld 2026-09-17 when the leaves went per-wood: the material now owns a
// texture STRIP (one tile per species, `flora-tex.ts` › `leafStripPixels`) and a vertex-shader pick
// that reads the quad's `aLayer` — the atlas layer the mesher writes for every quad, leaves
// included — and slides the map UV to that species' tile. The species id was already on the
// vertex; nothing in the mesher or the attrs changed.
//
// ★ `aLayer` IS THE SPECIES BECAUSE `layerOf` IS: a leaf cross-quad's normal is horizontal, so
// its layer is `layerOf(LEAVES, SIDE)`, one value per wood. Those four values are uniforms here,
// built from the same `layerOf` the attrs use — a table nobody hand-keeps. A fifth wood lands in
// `LEAF_SPECIES` + `LEAF_MATS` and nowhere else on this side.
//
// ★ THE GLOW BIT: `flora-tex.ts` marks a starwillow strand's tip with alpha `LEAF_GLOW_ALPHA`
// (200). It survives `alphaTest` (0.5) and the fragment reads "alpha under 0.9" as lit — the tip
// adds its own colour on top of the field-lit result, so it shows at night the way canon says
// (*"glows faintly at the tips"*), without a second texture or a second program.
import * as THREE from 'three'
import { LIGHT_DECL_GLSL, lightApplyHere, type LightUniforms } from '../light-glsl'
import { leafStripPixels, LEAF_TILE, LEAF_SPECIES, LEAF_MATS } from './flora-tex'
import { layerOf, SIDE } from './tiles'

/** How strongly a glow-marked texel adds its own colour. A tip, not a lantern. */
export const LEAF_TIP_GLOW = 0.55

export function createLeafMaterial(lightUniforms: LightUniforms): THREE.MeshLambertMaterial {
  const W = LEAF_TILE * LEAF_SPECIES.length
  const tex = new THREE.DataTexture(leafStripPixels(LEAF_TILE), W, LEAF_TILE)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    vertexColors: true,        // species tint x canopy-depth shade, straight from the mesher
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  })
  const layers = LEAF_MATS.map(m => layerOf(m, SIDE))
  // ── ★★ THE CANOPY SAMPLES THE FIELD TOO (2026-09-08) ──────────────────────────────────────
  // It was left out of the first render-light pass because leaves are their own program, and the
  // Thicket is what made that visible: at 96% canopy the UNDERSIDE of a closed canopy rendered
  // as bright as its top, hanging over the darkest ground in the world. One quad, DoubleSide, so
  // there is no separate underside to shade — the light field is the only thing that can tell
  // the two faces apart, and it does it by cell rather than by facing.
  //
  // ⚠ `lightApplyHere`, NOT `lightApply`. A leaf is a CROSS-QUAD: its fragments sit inside their
  // own block and the normal flips halfway through the surface, so stepping half a block along it
  // would land in a different cell depending on which side you look from and the same leaf would
  // light differently front and back. `render-light.ts` gives leaves a real level (they pass
  // light and only end the sky's free fall), so the cell they stand in has something to read.
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lightUniforms)
    shader.uniforms.uLeafLayers = { value: new THREE.Vector4(layers[0], layers[1], layers[2], layers[3]) }
    shader.uniforms.uLeafTiles = { value: LEAF_SPECIES.length }
    shader.uniforms.uLeafTipGlow = { value: LEAF_TIP_GLOW }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeafWPos;\nattribute float aLayer;\nuniform vec4 uLeafLayers;\nuniform float uLeafTiles;')
      // ★ AFTER uv_vertex, which is where three writes vMapUv. The tile index is the position of
      // this quad's layer in uLeafLayers; an unknown layer (a fifth wood nobody added here) takes
      // tile 0 rather than sampling off the strip's end.
      .replace('#include <uv_vertex>', `#include <uv_vertex>
{
  float t = 0.0;
  if (abs(aLayer - uLeafLayers.y) < 0.5) t = 1.0;
  else if (abs(aLayer - uLeafLayers.z) < 0.5) t = 2.0;
  else if (abs(aLayer - uLeafLayers.w) < 0.5) t = 3.0;
  vMapUv = vec2((vMapUv.x + t) / uLeafTiles, vMapUv.y);
}`)
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvLeafWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    const emit = `
      vec3 leafCol = outgoingLight;
      ${lightApplyHere('leafCol', 'diffuseColor.rgb', 'vLeafWPos')}
      // The glow bit: a texel the painter marked (alpha between the cutout and opaque) is lit by
      // its own colour, so a strand's tip reads at night. Output alpha is 1 — the bit was a flag.
      leafCol += diffuseColor.rgb * uLeafTipGlow * step(diffuseColor.a, 0.9);
      gl_FragColor = vec4(leafCol, 1.0);
    `
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeafWPos;\nuniform float uLeafTipGlow;' + LIGHT_DECL_GLSL)
      // Three renamed this chunk around 0.16x; handle both, exactly as mesh-bridge.ts does, or a
      // version bump silently unlights the whole canopy with no error anywhere.
      .replace('#include <output_fragment>', emit)
      .replace('#include <opaque_fragment>', emit)
  }
  return mat
}
