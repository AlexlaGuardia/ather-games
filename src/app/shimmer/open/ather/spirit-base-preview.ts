// BETA M174 (sprites, 2026-11-27): THE LAST FOUR BASE FORMS, OWNER PREVIEW. Alex 11-25: "id like to get the base ten rigged".
// Each is built in code from its own picked ref (docs/looks/m174-base-four-2026-11-26: sculpt + rig + three-check), and drawn ONLY
// for the owner until Alex OKs the sheet: the /shimmer/dev spirit gallery (owner-gated) and the owner's own garden. Players keep
// today's look (the gold orb) because SPIRIT_MODELS / SPIRIT_RIGS do not list these species yet. On Alex's OK an entry moves into
// spirit-models.ts SPIRIT_MODELS + SPIRIT_RIGS (the M173 wiring) and this file loses it.
// ★ PURE data (no three, no React).
import type { Species } from '../../spirits/spirit'
import type { TrotDials } from './spirit-trot'
import { GROWN } from '../../sprites/creature-size'
import type { RigLook } from './spirit-rig'
import type { SpiritLook } from './spirit-models'

// Lepara (rabbit): base-forms.md section 8, "nose twitches constantly; ears convey all emotion; nesting/grooming poses". Her rig's
// walk is small two-footed hops, run long bounds; idle twitches the nose (its own bone since the 11-27 snout rework: Alex wanted a soft manatee-like snout, no bill), swivels the ears, waves, thumps; sit grooms; lie = a loaf.
const LEPARA_TROT: Partial<TrotDials> = {
  speed: 0.6, dash: 1.8, turnK: 6, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1,
  chain: 0.9, checkS: [0.8, 1.8], legMax: 2.6,
  beat: { look: 0.45, sniff: 0.25, sit: 0.3, tilt: 0 },
  lookS: [1.6, 3.0], sniffS: [1.2, 2.4], sitS: [5.0, 8.0],
  glance: 0.3, glanceHold: [0.6, 1.2], glanceMax: 0.6,
  happyHops: 3, happyHop: 0.35, happyH: 0.05, happyWig: 0.1,
}
/** her glb: 1 unit = 0.48 m standing (ear tips); rig metrics: idle mean top 0.982, nose (snout) to tail 0.765 units */
export const LEPARA_GLB_TALL = 0.982
export const LEPARA_RIG: RigLook = {
  glbLen: 0.765, pivot: { x: 0, z: 0 }, clipV: { walk: 0.6 / 0.48, run: 2.8 / 0.48 }, runAt: [0.9, 0.75], hull: 0.024,
  neck: 'b_neck', head: 'b_head', lie: true, cadence: 12, avatar: { z: 0, far: 1.3 },
}
// Shellmere (turtle): spirits-species.md "Slow, armored, ancient, patient ... Chill energy, steady presence"; base-forms.md section 3. His rig
// (docs/looks/m174-shellmere-2026-11-27): walk = a slow one-foot-at-a-time plod, run = a hurried diagonal trot, idle = long looks + the
// antennae bobbing (Alex's call on the ref), sit = plastron down legs out, lie = head drawn back into the rim. He rarely hurries and sits long.
const SHELLMERE_TROT: Partial<TrotDials> = {
  speed: 0.5, dash: 1.0, turnK: 3, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1,
  chain: 0.97, checkS: [1.6, 3.0], legMax: 2.0,
  beat: { look: 0.4, sniff: 0.15, sit: 0.45, tilt: 0 },
  lookS: [3.5, 6.0], sniffS: [2.0, 3.4], sitS: [8.0, 14.0],
  glance: 0.5, glanceHold: [1.4, 2.4], glanceMax: 0.45,
  happyHops: 1, happyHop: 0.7, happyH: 0.02, happyWig: 0.08,
}
/** his glb: 1 unit = 0.464 m to the antenna bulbs; rig metrics: idle mean top 0.97, nose to tail 1.317 units */
export const SHELLMERE_GLB_TALL = 0.97
export const SHELLMERE_RIG: RigLook = {
  glbLen: 1.317, pivot: { x: 0, z: 0 }, clipV: { walk: 0.55 / 0.464, run: 1.9 / 0.464 }, runAt: [1.0, 0.85], hull: 0.024,
  neck: 'b_neck', head: 'b_head', lie: true, cadence: 15, avatar: { z: 0, far: 1.3 },
}
// Croakling (frog): spirits-species.md "Jumpy, vocal, playful ... throat puffing, eye bulging, mid-hop freeze poses"; base-forms.md section 7, the canon
// LURE kept (its own three bones: lure, lure2, lure3 with the orb). Its rig (docs/looks/m174-croakling-2026-11-27): walk = small hops, run = long
// bounds, idle = throat puffs + the lantern swaying and its orb swinging, sit = squats and croaks, lie = belly flat with the lantern drooped. Restless, hoppy.
const CROAKLING_TROT: Partial<TrotDials> = {
  speed: 0.55, dash: 2.0, turnK: 7, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1,
  chain: 0.85, checkS: [0.6, 1.4], legMax: 2.6,
  beat: { look: 0.35, sniff: 0.25, sit: 0.4, tilt: 0 },
  lookS: [1.2, 2.4], sniffS: [1.0, 2.0], sitS: [3.0, 6.0],
  glance: 0.35, glanceHold: [0.5, 1.0], glanceMax: 0.6,
  happyHops: 4, happyHop: 0.3, happyH: 0.06, happyWig: 0.08,
}
/** its glb: 1 unit = 0.40 m to the top of the lure's arch; rig metrics: idle mean top 0.999, nose to haunch 0.732 units */
export const CROAKLING_GLB_TALL = 0.999
export const CROAKLING_RIG: RigLook = {
  glbLen: 0.732, pivot: { x: 0, z: 0 }, clipV: { walk: 0.55 / 0.4015, run: 2.4 / 0.4015 }, runAt: [0.9, 0.75], hull: 0.024,
  neck: 'b_neck', head: 'b_head', lie: true, cadence: 12, avatar: { z: 0, far: 1.3 },
}
// Luminara (firefly): spirits-species.md "Tiny, bioluminescent, magical. Living light ... The embodiment of wonder"; base-forms.md section 6, the abdomen
// brightest, pulsing like a tiny sun = her glow part `lamp` (the game pulses a glow part's emissive). She HOVERS on the Hovari contract (M173 s2: every
// clip hangs ~0.9 m up in the glb, b_hover unkeyed, wings beat by time): walk = drift, run = dart, sit = settled low in the air, lie = asleep in the air.
// Her rig: docs/looks/m174-luminara-2026-11-27. A drifting, curious hoverer: the Hovari's dials, a touch slower and dreamier.
const LUMINARA_TROT: Partial<TrotDials> = {
  speed: 1.1, dash: 2.2, turnK: 10, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1,
  chain: 0.8, checkS: [0.5, 1.0], legMax: 3.5,
  beat: { look: 0.55, sniff: 0.05, sit: 0.25, tilt: 0.15 },
  lookS: [1.4, 2.8], sitS: [3.0, 5.0], tiltS: [0.8, 1.4],
  glance: 0.12, glanceHold: [0.4, 0.9], glanceMax: 0.8,
  happyHops: 4, happyHop: 0.24, happyH: 0.06, happyWig: 0.1,
}
/** her glb: one unit = 0.3438 m (rig metrics: nose to the abdomen's tip 0.8725 units = canon's ~0.30 m long flier, GROWN.firefly.length) */
export const LUMINARA_GLB_LONG = 0.8725
export const LUMINARA_UNIT = GROWN.firefly.length! / LUMINARA_GLB_LONG
export const LUMINARA_RIG: RigLook = {
  glbLen: LUMINARA_GLB_LONG, pivot: { x: 0, z: 0 }, clipV: { walk: 0.8 / LUMINARA_UNIT, run: 4.0 / LUMINARA_UNIT }, runAt: [1.4, 1.1], hull: 0.030,
  neck: 'b_neck', head: 'b_head', lie: true,
  // lowest / highest point hovering (idle, glb units: 0.899 m and 1.302 m)
  hover: { flap: [1.0, 1.25], low: 0.899 / LUMINARA_UNIT, top: 1.302 / LUMINARA_UNIT },
  // every clip's bounds (glb units) x -0.60..0.60, y 2.32..3.79, z -0.52..0.56, plus the hull and the blends
  cull: { c: [0, 3.06, 0.02], r: 1.2, min: [-0.72, 2.2, -0.66], max: [0.72, 3.92, 0.7] },
  avatar: { z: 0.02, far: 1.6, y: 2.75 },
}
const NO_SWAY = { along: 'z', sign: -1, from: 2, to: 3, dir: 'x', amp: 0, ampRun: 0, hz: 1, hzRun: 1, lag: 0 } as const
export const BASE_PREVIEW: Partial<Record<Species, SpiritLook>> = {
  rabbit: {
    name: 'lepara', url: '/open/spirits/lepara-rigged.glb', h: GROWN.rabbit.height / LEPARA_GLB_TALL,
    skin: { emissive: '#ffb8b2', emissiveI: 0.10 }, hull: { color: '#ffdcd6', opacity: 0.38 },
    sway: NO_SWAY, trot: LEPARA_TROT, rig: LEPARA_RIG,
  },
  turtle: {
    name: 'shellmere', url: '/open/spirits/shellmere-rigged.glb', h: GROWN.turtle.height / SHELLMERE_GLB_TALL,
    skin: { emissive: '#ffd27a', emissiveI: 0.08 }, hull: { color: '#dff5d8', opacity: 0.38 },
    sway: NO_SWAY, trot: SHELLMERE_TROT, rig: SHELLMERE_RIG,
  },
  frog: {
    name: 'croakling', url: '/open/spirits/croakling-rigged.glb', h: GROWN.frog.height / CROAKLING_GLB_TALL,
    skin: { emissive: '#c8f59a', emissiveI: 0.10 }, hull: { color: '#dcfbe0', opacity: 0.38 },
    sway: NO_SWAY, trot: CROAKLING_TROT, rig: CROAKLING_RIG,
  },
  firefly: {
    name: 'luminara', url: '/open/spirits/luminara-rigged.glb', h: LUMINARA_UNIT,
    skin: { emissive: '#ffd27a', emissiveI: 0.12 }, hull: { color: '#fff1c4', opacity: 0.45 },
    sway: NO_SWAY, trot: LUMINARA_TROT, rig: LUMINARA_RIG,
    glow: { part: 'lamp', emissive: '#fff0b8', lo: 0.55, hi: 1.25, hz: 0.5 },
  },
}
/** the owner-preview base model for a species that has none for players yet, or null */
export const basePreviewFor = (s: Species | null | undefined): SpiritLook | null => (s ? BASE_PREVIEW[s] ?? null : null)
