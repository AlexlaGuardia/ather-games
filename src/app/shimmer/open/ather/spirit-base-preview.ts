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
}
/** the owner-preview base model for a species that has none for players yet, or null */
export const basePreviewFor = (s: Species | null | undefined): SpiritLook | null => (s ? BASE_PREVIEW[s] ?? null : null)
