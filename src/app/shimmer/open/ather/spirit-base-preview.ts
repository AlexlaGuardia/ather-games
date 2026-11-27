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
// walk is small two-footed hops, run long bounds; idle twitches the bill, swivels the ears, waves, thumps; sit grooms; lie = a loaf.
const LEPARA_TROT: Partial<TrotDials> = {
  speed: 0.6, dash: 1.8, turnK: 6, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1,
  chain: 0.9, checkS: [0.8, 1.8], legMax: 2.6,
  beat: { look: 0.45, sniff: 0.25, sit: 0.3, tilt: 0 },
  lookS: [1.6, 3.0], sniffS: [1.2, 2.4], sitS: [5.0, 8.0],
  glance: 0.3, glanceHold: [0.6, 1.2], glanceMax: 0.6,
  happyHops: 3, happyHop: 0.35, happyH: 0.05, happyWig: 0.1,
}
/** her glb: 1 unit = 0.48 m standing (ear tips); rig metrics: idle mean top 0.982, nose (bill) to tail 0.777 units */
export const LEPARA_GLB_TALL = 0.982
export const LEPARA_RIG: RigLook = {
  glbLen: 0.777, pivot: { x: 0, z: 0 }, clipV: { walk: 0.6 / 0.48, run: 2.8 / 0.48 }, runAt: [0.9, 0.75], hull: 0.024,
  neck: 'b_neck', head: 'b_head', lie: true, cadence: 12, avatar: { z: 0, far: 1.3 },
}
const NO_SWAY = { along: 'z', sign: -1, from: 2, to: 3, dir: 'x', amp: 0, ampRun: 0, hz: 1, hzRun: 1, lag: 0 } as const
export const BASE_PREVIEW: Partial<Record<Species, SpiritLook>> = {
  rabbit: {
    name: 'lepara', url: '/open/spirits/lepara-rigged.glb', h: GROWN.rabbit.height / LEPARA_GLB_TALL,
    skin: { emissive: '#ffb8b2', emissiveI: 0.10 }, hull: { color: '#ffdcd6', opacity: 0.38 },
    sway: NO_SWAY, trot: LEPARA_TROT, rig: LEPARA_RIG,
  },
}
/** the owner-preview base model for a species that has none for players yet, or null */
export const basePreviewFor = (s: Species | null | undefined): SpiritLook | null => (s ? BASE_PREVIEW[s] ?? null : null)
