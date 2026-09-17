// ── THE CARTOON STACK, ONCE ──────────────────────────────────────────────────────────────────
//
// Until 2026-09-13 this GLSL lived TWICE — inline in `mesh-bridge.ts` (the untextured fallback) and
// in `tex/atlas.ts` (what the world renders with) — and `cartoon-stack.test.ts` held the two copies
// together by reading both files, because on 09-11 a fix went into one and was measured as "no
// change" on a wall drawn by the other. That test's own header said *"until the stack is extracted
// into one module."* This is that module. The occasion was a THIRD consumer: pieces (`piece-mesh.ts`)
// were plain Lambert under the scene hemisphere light, so a half slab wore a black underside on
// grass that had no shadow at all (Alex, 09-13) — the stack has a floor (0.35) and a per-face law,
// and the light field has the cell's own sky level; Lambert alone has neither.
//
// Four levers (uniforms, so a style change is a value write, never a second program):
//   uFaceShading — fixed brightness per face direction: top 1.0, sides ~0.76, bottom 0.52
//   uToon        — band the irradiance to three steps
//   uShadowLift  — shadows are a cooler, still-saturated version of the base, never black
//   uOutline     — block edges from world position, no post pass
// then `uCartoon` mixes the stack against plain Lambert, and the LIGHT FIELD applies last so a
// lantern's pool and a cave's dark are the same on a wall, a leaf and a beam.
//
// ⚠ NO BACKTICKS INSIDE THE GLSL STRINGS — see light-glsl.ts; a stray one ships a program that
// fails to link and draws nothing with no console error.
import { lightApply, lightApplyHere, LIGHT_DECL_GLSL } from './light-glsl'

/** The five uniform declarations. Insert once per program, before `#include <common>`. */
export const CARTOON_UNIFORMS_GLSL = `uniform float uCartoon;
uniform float uToon;
uniform float uOutline;
uniform float uFaceShading;
uniform float uShadowLift;
`

/** The declarations a program needs to run the stack: the cartoon dials AND the light field. */
export const CARTOON_DECL_GLSL = CARTOON_UNIFORMS_GLSL + LIGHT_DECL_GLSL

/** Fresh uniform objects at the shipped defaults. One set per material — never shared, since
 *  `setCartoon` writes into them and two materials may be dialled apart on a dev page. */
export function cartoonUniforms(): Record<string, { value: number }> {
  return {
    uCartoon: { value: 0 },
    uToon: { value: 0 },
    uOutline: { value: 0 },
    uFaceShading: { value: 0.35 },
    uShadowLift: { value: 0.15 },
  }
}

/**
 * The fragment tail that REPLACES `#include <opaque_fragment>` (and `<output_fragment>`, the older
 * name). Expects three's Lambert `outgoingLight` and `diffuseColor` to exist, plus:
 *   `nrm`      an expression for the WORLD-space face normal (a varying), normalised inside
 *   `wpos`     the world position varying
 *   `emissive` a vec3 expression added after lighting (the ore glow); `vec3(0.0)` for none
 *
 * (0) THE HOUR (2026-09-14): `clum` is the light on the face relative to what THIS HOUR puts on an
 * up face (`uHourLight`, hour-light.ts), not to a fixed 1.0 — so "fully lit" at midnight means "as
 * lit as midnight gets", the shape keeps working, and the whole result is then multiplied by the
 * hour's own colour. Before this the stack had no hour in it at all: the NIGHT rig still put ~0.85
 * on an up face, the clamp read that as 85% lit, and the blocks kept 80% of noon at midnight while
 * the Lambert canopy beside them kept 25%. `uToonHour` 0 reproduces that render exactly.
 * (1) luminance is the LIGHT on the face (irradiance = lit ÷ albedo), not the lit pixel, so a
 * dark material in full sun is not "in shadow"; (2) the shadow lift is scaled by the material's
 * own luminance and the cooling is a TINT of the base, not a flat blue-grey ADD — the add was the
 * same amount whatever the face was made of, and every wall in the world converged on one mauve
 * (bisected on a sunlit goldwood wall at 6 blocks, noon: shadowLift 0 → (88,61,26), the old
 * default → (139,130,135)). Both fixes date 2026-09-11.
 */
/**
 * ★ THE FLORA'S TWO DEPARTURES (2026-09-17), as options so the stack stays ONE text:
 *   `here`      — sample the light field at the fragment's OWN cell (`lightApplyHere`) instead of
 *                 half a block along the normal. A card stands INSIDE its air cell and its normal
 *                 flips halfway through the sheet; stepping along it lands in the ground block
 *                 under a tuft (dark) or the neighbour beside a blade. The leaves learned this on
 *                 09-08; flora is the same shape.
 *   `noOutline` — the block-edge line comes from world position on a FACE; on a card that is a
 *                 dark stripe wherever the card crosses a block boundary. Off for plants.
 */
export interface CartoonStackOpts { here?: boolean; noOutline?: boolean }

export function cartoonStackGlsl(nrm: string, wpos: string, emissive: string, opts: CartoonStackOpts = {}): string {
  return `vec3 cnrm = normalize(${nrm});
       float faceLum = cnrm.y > 0.5 ? 1.0 : (cnrm.y < -0.5 ? 0.52 : 0.76 + 0.05 * abs(cnrm.x));
       float face = mix(1.0, faceLum, uFaceShading);
       const vec3 W = vec3(0.2126, 0.7152, 0.0722);
       float albLum = max(dot(diffuseColor.rgb, W), 0.03);
       vec3 hourCol = mix(vec3(1.0), uHourLight, uToonHour);
       float hourLum = max(dot(hourCol, W), 0.02);
       float clum = clamp(dot(outgoingLight, W) / (albLum * hourLum), 0.0, 1.0);
       float stepped = floor(clum * 3.0 + 0.5) / 3.0;
       float shaped = mix(clum, stepped, uToon);
       vec3 shade = mix(vec3(0.0), vec3(0.22, 0.26, 0.38), uShadowLift);
       vec3 cool = mix(vec3(1.0), vec3(0.80, 0.86, 1.0), uShadowLift);
       vec3 lift = shade * (1.0 - shaped) * clamp(albLum * 2.0, 0.15, 1.0);
       vec3 toonCol = diffuseColor.rgb * face * (0.35 + 0.95 * shaped) * mix(cool, vec3(1.0), shaped) + lift;
       vec3 fr = fract(${wpos} - cnrm * 0.002);
       vec3 dEdge = min(fr, 1.0 - fr);
       vec3 planar = 1.0 - abs(cnrm);
       float edge = min(mix(1.0, dEdge.x, planar.x),
                    min(mix(1.0, dEdge.y, planar.y), mix(1.0, dEdge.z, planar.z)));
       float line = 1.0 - smoothstep(0.0, 0.035, edge);
       toonCol *= hourCol;
       toonCol *= mix(1.0, 0.62, line * ${opts.noOutline ? '0.0' : 'uOutline'});
       vec3 finalCol = mix(outgoingLight, toonCol, uCartoon);
       ${opts.here ? lightApplyHere('finalCol', 'diffuseColor.rgb', wpos) : lightApply('finalCol', 'diffuseColor.rgb', wpos, 'cnrm')}
       gl_FragColor = vec4(finalCol + ${emissive}, diffuseColor.a);`
}
