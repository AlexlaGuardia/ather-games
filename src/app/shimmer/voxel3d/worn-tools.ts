// ★ M167 (Alex locked 11-25, athernyx a8b1db5): the WORN PRUNER and WORN SPIKE as drawn in the locked pictures. Plain
// steel working parts (M134 ruling 4d65536: the worn tools are plain steel; Lambert colour only, never a metal material).
// Hand-local metres, the tool runs forward along -z from the fist. Heft first (Alex: "not dainty or simple").
// M230: one builder, two hosts. The voxel rig (hands.ts) holds them in the fist; the LIVE open game hangs them at the node
// being worked (open/ather/channel-fx.tsx). The host passes its own `part` (its material + render order); the shapes here.
import * as THREE from 'three'

/** M167: the worn pruner + worn spike, colours read off the locked pictures (athernyx concept-1672 tools-rooms). */
export const M167 = {
  steel:      0x7d97aa,   // the pruner leaf, lit half
  steelDark:  0x4d6475,   // its shadow half + midrib
  bark:       0xe3c98c,   // golden bark-strip wrap
  barkDark:   0x9a7a48,
  cord:       0xd9c08a,
  wood:       0x7a4f2c,   // dark wood (pruner butt, spike grip core)
  spike:      0x4f6274,   // the spike's faceted steel
  spikeLight: 0x8fb0c4,   // its chip + scratches
  cordDeep:   0xa8742e,   // the spike's cross wrap
  knob:       0x9a6232,
} as const

export type WornKind = 'pruner' | 'spike'
/** The group names a check reads (m167-tools-check). */
export const WORN_NAME: Record<WornKind, string> = { pruner: 'm167-worn-pruner', spike: 'm167-worn-spike' }
/** The worn tools' ids (engine/tools.ts TOOL_DEFS); every other tool id keeps its own look. */
export const WORN_TOOL_ID: Record<WornKind, string> = { pruner: 'worn_blade', spike: 'worn_spike' }

/** M230: which focus hangs at a node for the socket's tool: the locked worn model, or the crafted tier's own look. */
export const focusLook = (node: 'tree' | 'crystal', toolId: string | undefined): 'worn' | 'tier' =>
  toolId === WORN_TOOL_ID[node === 'tree' ? 'pruner' : 'spike'] ? 'worn' : 'tier'

export type PartFn = (parent: THREE.Object3D, geo: THREE.BufferGeometry, colour: number, sx: number, sy: number, sz: number, x: number, y: number, z: number) => THREE.Mesh

/** Builds the locked worn tool's parts into `g` (named WORN_NAME[kind]) with the host's `part`. */
export function buildWornTool(kind: WornKind, g: THREE.Object3D, part: PartFn, cube: THREE.BufferGeometry, sphere: THREE.BufferGeometry): THREE.Object3D {
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 12)          // a round rod along y; turned onto z by rotation.x
  const hex = new THREE.CylinderGeometry(1, 1, 1, 6)           // the spike's faceted shaft
  const hexTip = new THREE.CylinderGeometry(0.34, 1, 1, 6)     // the spike's blunt, chipped end (a cut, never a point)
  const rod = (geo: THREE.BufferGeometry, colour: number, r: number, len: number, z: number, y = 0) => {
    const m = part(g, geo, colour, r, len, r, 0, y, z); m.rotation.x = Math.PI / 2; return m
  }
  g.name = WORN_NAME[kind]
  if (kind === 'pruner') {
    // a flat leaf-shaped steel head, light on one side of the midrib and dark on the other, on a bark-wrapped haft with a
    // crossed lashing at the collar, two cord bands, and a dark wooden butt
    rod(cyl, M167.wood, 0.026, 0.06, 0.105)                 // the dark butt
    rod(cyl, M167.bark, 0.021, 0.22, -0.01)                 // the bark-wrapped haft
    rod(cyl, M167.cord, 0.0245, 0.014, 0.065)               // cord band (low)
    rod(cyl, M167.cord, 0.0245, 0.014, -0.035)              // cord band (high)
    for (const z of [0.03, -0.07]) part(g, cube, M167.barkDark, 0.008, 0.004, 0.03, 0.006, 0.02, z)   // bark streaks
    rod(cyl, M167.cord, 0.0275, 0.034, -0.118)              // the collar lashing
    for (const a of [0.55, -0.55]) { const x = part(g, cube, M167.cord, 0.06, 0.008, 0.008, 0, 0.026, -0.118); x.rotation.y = a }
    const half = (shade: number, side: 1 | -1) => part(g, sphere, shade, 0.036, 0.016, 0.135, side * 0.018, 0, -0.255)   // one half of the leaf
    half(M167.steel, -1); half(M167.steelDark, 1)
    part(g, cube, M167.steelDark, 0.007, 0.022, 0.22, 0, 0, -0.245)  // the midrib, standing proud of both faces
  } else {
    // one faceted plain-steel spike, thick, with a BLUNT CHIPPED end, set straight into a short cross-wrapped grip on dark
    // wood with a wooden knob; no head
    part(g, sphere, M167.knob, 0.036, 0.032, 0.03, 0, 0, 0.11)  // the knob
    rod(cyl, M167.knob, 0.03, 0.03, 0.09)                   // its flared neck
    rod(cyl, M167.wood, 0.024, 0.17, 0.0)                   // the grip core
    for (let i = 0; i < 6; i++) {                           // the cross wrap: tilted cord turns, alternating
      const r = rod(cyl, M167.cordDeep, 0.0275, 0.012, 0.07 - i * 0.027); r.rotation.y = (i % 2 ? -1 : 1) * 0.42
    }
    rod(cyl, M167.cordDeep, 0.031, 0.03, -0.092)            // the collar wrap
    const shaft = rod(hex, M167.spike, 0.03, 0.2, -0.205); shaft.rotation.y = Math.PI / 6
    const tip = rod(hexTip, M167.spike, 0.03, 0.05, -0.33); tip.rotation.y = Math.PI / 6
    part(g, cube, M167.spikeLight, 0.012, 0.006, 0.012, 0.008, 0.012, -0.355)        // the chip off the end, catching light
    for (const [x, z, l] of [[0.012, -0.16, 0.05], [-0.01, -0.24, 0.035]] as const) part(g, cube, M167.spikeLight, 0.003, 0.0035, l, x, 0.027, z)   // scratches
  }
  return g
}

/** Along -z, the model runs from +BUTT (the butt / knob) to -TIP (the leaf's end / the chipped end), in hand metres. */
export const WORN_SPAN: Record<WornKind, { butt: number; tip: number }> = { pruner: { butt: 0.135, tip: 0.39 }, spike: { butt: 0.146, tip: 0.36 } }
