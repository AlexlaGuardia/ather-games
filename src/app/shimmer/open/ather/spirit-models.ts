// M102 (sprites, 2026-11-23): THE SPIRIT MODEL REGISTRY, PER SPECIES. Alex 11-23 OK'd the Manalotl look ("the manalotl
// looks good"), so the "Vulnyx stands in for all" rule ends: a bloomed planter shows ITS OWN species' model when one is
// listed here and the gold orb otherwise. For every keeper since the M107 ship (talk/party/training stay owner + ?spirits=3d).
//
// ★ PURE data (no three, no React). Each entry: the glb, its world height (the glb is 1 unit tall), the look (toon skin
// emissive, the translucent hull, an optional glowing PART with a slow pulse), the shader sway rules (which way the tail
// runs, which way it swings), an optional head tilt (a vertex bend round a pivot, weighted by how far forward a vertex
// sits), and the trot dials (spirit-trot.ts TROT, overridden per species).
// Manner = the temperament column of world/spirits-species.md (canon: "the temperament column ... IS the behaviour spec"):
//  · Vulnyx  "Clever, quick, light on feet ... trickster energy": darting legs, snappy glances, mostly alert look-rounds.
//  · Manalotl "Aquatic, regenerative, feathery gills that pulse with mana light. Eternal smile, wide eyes, head tilt" and
//    heel-high young, "flows along the ground" (grown 0.90 m nose to tail): a slow, curious, low amble, long looks, head tilts, lies down.
import type { Species } from '../../spirits/spirit'
import { TROT, type TrotDials } from './spirit-trot'
import { GROWN } from '../../sprites/creature-size'
import type { RigLook } from './spirit-rig'
import { BASE_PREVIEW, LUMINARA_UNIT } from './spirit-base-preview'   // M202 the Croakling line builds off the owner-preview base (type-only import back, no cycle)

// ── SPIRITS DRAW FULL-GROWN (Alex 2026-11-24 "the manalotl is way too small"; Magii RULED-AFK athernyx 2a8b028) ─────────
// The heights come from creature-size.ts GROWN (canon-diffed by `npm run canon`, gate grown-sizes). The model is scaled
// UNIFORMLY, so its proportions, the sit/sniff pitch, the turntable framing (framed by h) and the bob (x h / 0.55) all keep
// the look Alex OK'd at the old size. What does NOT scale by itself is every trot dial written in metres, so grownTrot()
// rescales those from the size each species was tuned at (TUNED_H): lengths (stride, hop heights, the bound over a piece)
// go with size; speeds go with sqrt(size), the walking-animal rule (Froude: a bigger body takes longer, slower-cadence
// strides). Times, fractions and angles stay. World-fixed spacing (the follow slot, the planter perch) is the keeper's and
// the garden's, not hers, so it is untouched.
/** the size each species' trot dials were tuned at (M102 / M107 / M110) */
const TUNED_H = { fox: 0.55, axolotl: 0.15 } as const
/** The Manalotl glb's nose-to-tail extent in glb units (z -0.643..0.647; it is 1 unit tall). spirit-size.test.ts reads the
 *  glb and pins this. Canon gives her LENGTH (0.90) and the model is stockier than 0.35 tall at 0.90 long, so length wins
 *  (the number Alex gave): she draws ~0.70 tall. */
export const MANALOTL_GLB_LEN = 1.29
const LEN_KEYS = ['stride', 'hopH', 'happyH', 'playH'] as const
const SPEED_KEYS = ['speed', 'dash', 'playV'] as const
/** Rescale a species' trot dials from the height they were tuned at to the height it draws at. `keepSpeed` = the
 *  species' speeds are its MANNER and stay (the Manalotl's slow amble; spirit-trot.test pins it under half the Vulnyx's). */
export function grownTrot(d: Partial<TrotDials>, fromH: number, toH: number, keepSpeed = false): Partial<TrotDials> {
  const k = toH / fromH, out: Partial<TrotDials> = { ...d }
  const r = <T extends keyof TrotDials>(key: T, f: number) => { (out as Record<string, unknown>)[key] = (d[key] as number ?? TROT[key] as number) * f }
  for (const key of LEN_KEYS) r(key, k)
  if (!keepSpeed) for (const key of SPEED_KEYS) r(key, Math.sqrt(k))
  return out
}
const FOX_H = GROWN.fox.height
const AXOLOTL_H = GROWN.axolotl.length! / MANALOTL_GLB_LEN

/** Tail sway in the vertex shader. Weight = smoothstep(from, to, sign * position[along]); the tail swings along `dir`. */
export type SpiritSway = { along: 'x' | 'z'; sign: 1 | -1; from: number; to: number; dir: 'x' | 'z'; amp: number; ampRun: number; hz: number; hzRun: number; lag: number }
/** Head tilt: a roll about the forward (+z) axis round (px, py), weight = smoothstep(from, to, position.z) (glb units). */
export type SpiritTilt = { from: number; to: number; px: number; py: number; max: number }
export type SpiritLook = {
  name: string
  url: string
  /** world height in metres (the glb is 1 unit tall) */
  h: number
  skin: { emissive: string; emissiveI: number }
  hull: { color: string; opacity: number }
  /** a glb node drawn with its own toon + a pulsing emissive (the Manalotl's frills: the element's expression point) */
  glow?: { part: string; emissive: string; lo: number; hi: number; hz: number }
  sway: SpiritSway
  /** the Vulnyx's ear-tip flick (top of the head, off the tail side) */
  ears?: boolean
  tilt?: SpiritTilt
  trot: Partial<TrotDials>
  /** M132 s2: the glb carries bones + clips (spirit-rig.ts); without it the model is the unrigged one */
  rig?: RigLook
  /** M202: this look is a SECOND FORM (the element she evolved by); always rigged */
  form?: SpiritElement
}

const MANALOTL_TROT: Partial<TrotDials> = {
  speed: 0.42, dash: 0.62,            // a slow amble (the Vulnyx runs 1.15 / darts 1.7)
  stride: 0.12, hopH: 0.012, stretch: 0.025, squash: 0.05, squashK: 10,   // she flows, barely a hop
  lean: 0.04, leanMax: 0.12, turnK: 3.5,
  hopArc: 0.62, hopArcH: 0.16, sitY: 0.93, sitPitch: -0.08, sniffPitch: 0.14,   // "sit" = lies along the ground
  chain: 0.97, checkS: [1.0, 2.0], legMax: 2,   // M107 ship: calmer (Alex 11-23 "more pauses"), short slow legs
  playV: 0.5, playH: 0.06,           // M110 s1: she flows across a training piece, a low bound
  toyLean: { grd: 1.4, vig: 1, agi: 1, pwr: 0.8 },   // M110 s2 her manner: a steady, patient wall, she likes to hold the gap
  beat: { look: 0.36, sniff: 0.14, sit: 0.14, tilt: 0.36 },
  lookS: [4.0, 6.5], sniffS: [2.4, 3.8], sitS: [5.5, 8.5], tiltS: [3.2, 5.2],
  glance: 0.6, glanceHold: [0.9, 1.6], glanceMax: 0.6, tiltK: 3, lookTilt: 0.55,
  happyHops: 3, happyHop: 0.45, happyH: 0.035, happyWig: 0.1,   // M109 s2 fed: three soft bobs, not bounces (she flows)
}

// ── M173 (Alex 11-24 approved both looks; 11-25 "spirits first"): ATHOWL + NOCTYX. Manner = the temperament column of world/spirits-species.md.
//  · Athowl "Nocturnal, silent flight, all-seeing ... patient stillness punctuated by sudden precise movement": long still looks,
//    slow turns of the head, few moves, and when she goes she goes straight and quick on the wing. She rarely sniffs.
//  · Noctyx "Echo-based, nocturnal, shadow-dwelling ... wrapped-wing poses": short stops, snappy glances, longer darts, sits wrapped.
const ATHOWL_TROT: Partial<TrotDials> = {
  speed: 1.0, dash: 1.9, turnK: 7, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1,
  chain: 0.97, checkS: [1.2, 2.2], legMax: 4,
  beat: { look: 0.62, sniff: 0.03, sit: 0.2, tilt: 0.15 },
  lookS: [4.5, 7.5], sitS: [5.0, 8.0], tiltS: [2.4, 4.0],
  glance: 0.28, glanceHold: [1.2, 2.2], glanceMax: 0.85, tiltK: 3, lookTilt: 0.2,
  happyHops: 3, happyHop: 0.4, happyH: 0.08, happyWig: 0.08,
}
const NOCTYX_TROT: Partial<TrotDials> = {
  speed: 1.3, dash: 2.2, turnK: 12, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1,
  chain: 0.85, checkS: [0.4, 0.9], legMax: 3.5,
  beat: { look: 0.45, sniff: 0.1, sit: 0.4, tilt: 0.05 },
  lookS: [1.6, 3.0], sitS: [3.0, 5.0],
  glance: 0.11, glanceHold: [0.35, 0.8], glanceMax: 0.85,
  happyHops: 5, happyHop: 0.26, happyH: 0.1, happyWig: 0.16,
}

// ── M173 s2 (Alex 11-24 approved both v2 looks): DEWBEAR + HOVARI. Manner = the temperament column of world/spirits-species.md.
//  · Dewbear "Round, squishy, nearly indestructible ... Zero personal space: will waddle right up to you and stay": a slow,
//    sturdy waddle, short legs out, long sits and looks, sniffs about; she rarely darts and never hurries off far.
//  · Hovari "Fast, jewel-toned, hovering ... Precise, controlled movements. Delicate but fierce. Default pose: hovering": quick
//    darts that stop dead, snap glances, short holds, few rests; she settles IN THE AIR (her sit / sleep clips never land).
const DEWBEAR_TROT: Partial<TrotDials> = {
  speed: 0.7, dash: 1.1, turnK: 4, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1,
  chain: 0.95, checkS: [1.2, 2.4], legMax: 2.2,
  beat: { look: 0.35, sniff: 0.3, sit: 0.35, tilt: 0 },
  lookS: [3.0, 5.0], sniffS: [2.0, 3.4], sitS: [6.0, 10.0],
  glance: 0.45, glanceHold: [1.0, 1.8], glanceMax: 0.5,
  happyHops: 2, happyHop: 0.55, happyH: 0.03, happyWig: 0.12,
}
const HOVARI_TROT: Partial<TrotDials> = {
  speed: 1.4, dash: 2.6, turnK: 16, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1,
  chain: 0.8, checkS: [0.3, 0.7], legMax: 3.5,
  beat: { look: 0.6, sniff: 0.05, sit: 0.2, tilt: 0.15 },
  lookS: [1.2, 2.4], sitS: [2.5, 4.0], tiltS: [0.8, 1.4],
  glance: 0.08, glanceHold: [0.3, 0.7], glanceMax: 0.85,
  happyHops: 4, happyHop: 0.22, happyH: 0.06, happyWig: 0.1,
}
/** the Hovari glb: one unit = 0.219 m (docs/looks/hovari-2026-11-24 v2: beak tip to tail tip 0.300 m = canon's ~0.30 long) */
export const HOVARI_UNIT = 0.219

export const SPIRIT_MODELS: Partial<Record<Species, SpiritLook>> = {
  // Vulnyx: grown 0.70 m (shipped M102/M107 at 0.55), gold; tail out along +x, swings in z; ear flick; trot = TROT's
  // defaults, grown (grownTrot).
  fox: {
    name: 'vulnyx', url: '/open/spirits/vulnyx.glb', h: FOX_H,
    skin: { emissive: '#ffd24a', emissiveI: 0.18 }, hull: { color: '#fff0b8', opacity: 0.38 },
    sway: { along: 'x', sign: 1, from: 0.25, to: 0.62, dir: 'z', amp: 0.07, ampRun: 0.05, hz: 1.7, hzRun: 6.3, lag: 0.06 },
    ears: true,
    // M110 s1/s2 her MANNER at the training pieces (stands in for temperament until garden spirits carry one): clever, quick,
    //    light on her feet = the hurdle and the ring draw her more, holding a gap still draws her less. Dial table, Jin's.
    trot: grownTrot({ toyLean: { agi: 1.5, vig: 1.3, pwr: 1, grd: 0.7 } }, TUNED_H.fox, FOX_H),
  },
  // Manalotl (look proof 5baffc0c): faces +z (eyes at z 0.58..0.65), head + frills z > 0.1, tail runs back along -z.
  // Tints = the proof render: rose emissive floor, pale-rose hull, frills rose-glow pulsing slowly; the gold rim is shared.
  axolotl: {
    // grown: 0.90 m nose to tail (canon), so ~0.70 m tall at this model's proportions (was 0.15 tall)
    name: 'manalotl', url: '/open/spirits/manalotl.glb', h: AXOLOTL_H,
    skin: { emissive: '#ff9fb2', emissiveI: 0.18 }, hull: { color: '#ffe0e6', opacity: 0.38 },
    glow: { part: 'frills', emissive: '#ff6f9c', lo: 0.55, hi: 1.25, hz: 0.22 },
    sway: { along: 'z', sign: -1, from: 0.15, to: 0.64, dir: 'x', amp: 0.08, ampRun: 0.06, hz: 0.9, hzRun: 2.6, lag: 0.03 },
    // the head (z > ~0.1, frills and eyes with it) rolls round the neck at x 0.1 (the head's own centre), y 0.35
    tilt: { from: -0.05, to: 0.2, px: 0.1, py: 0.35, max: 0.38 },
    trot: grownTrot(MANALOTL_TROT, TUNED_H.axolotl, AXOLOTL_H, true),   // tuned at 0.15; her slow amble speeds are her manner and stay
  },
  // Athowl: faces +z, wings folded, a short fan of tail down the back. 0.50 m (GROWN), lavender-silver floor, pale hull.
  owl: {
    name: 'athowl', url: '/open/spirits/athowl.glb', h: GROWN.owl.height,
    skin: { emissive: '#e7ddff', emissiveI: 0.10 }, hull: { color: '#f3ecff', opacity: 0.38 },
    sway: { along: 'z', sign: -1, from: 0.3, to: 0.5, dir: 'x', amp: 0.02, ampRun: 0.02, hz: 0.6, hzRun: 2, lag: 0 },
    trot: ATHOWL_TROT,
  },
  // Noctyx: the darkest of the four, so the violet floor and hull stay (the look proof's note). 0.45 m; no tail, so no sway.
  bat: {
    name: 'noctyx', url: '/open/spirits/noctyx.glb', h: GROWN.bat.height,
    skin: { emissive: '#9985f0', emissiveI: 0.10 }, hull: { color: '#b8a3ff', opacity: 0.38 },
    sway: { along: 'z', sign: -1, from: 2, to: 3, dir: 'x', amp: 0, ampRun: 0, hz: 1, hzRun: 1, lag: 0 },
    trot: NOCTYX_TROT,
  },
  // Dewbear: 0.50 m (GROWN), the approved v2's own tints (the look proof): dew-blue floor, pale-blue hull. Tail too small to sway.
  'water-bear': {
    name: 'dewbear', url: '/open/spirits/dewbear.glb', h: GROWN['water-bear'].height,
    skin: { emissive: '#cdf3ff', emissiveI: 0.10 }, hull: { color: '#d8f4ff', opacity: 0.38 },
    sway: { along: 'z', sign: -1, from: 2, to: 3, dir: 'x', amp: 0, ampRun: 0, hz: 1, hzRun: 1, lag: 0 },
    trot: DEWBEAR_TROT,
  },
  // Hovari: 0.30 m beak to tail (GROWN length); the v2 proof's tints (emissive 0.14, hull 0.50); the wing blur `shimmer` glows.
  hummingbird: {
    name: 'hovari', url: '/open/spirits/hovari.glb', h: HOVARI_UNIT,
    skin: { emissive: '#6bf2db', emissiveI: 0.14 }, hull: { color: '#adfff0', opacity: 0.50 },
    sway: { along: 'z', sign: -1, from: 2, to: 3, dir: 'x', amp: 0, ampRun: 0, hz: 1, hzRun: 1, lag: 0 },
    trot: HOVARI_TROT,
  },
  // M226 (Alex OK 11-27 "they all look good for now"): the last four bases (M174) leave owner preview. Their data stays in
  // spirit-base-preview.ts BASE_PREVIEW; each is rigged only (no old unrigged body), so the model and the rig are the same look.
  rabbit: BASE_PREVIEW.rabbit, turtle: BASE_PREVIEW.turtle, frog: BASE_PREVIEW.frog, firefly: BASE_PREVIEW.firefly,
}

// ── M132 s2 THE RIGGED MANALOTL (every keeper's since 11-24, spirit-model.tsx useSpiritRig; Alex 11-24 OK'd the v2 look and the size: 0.90 m
// nose to tail, canon's own figure). Her tail is out behind now (it was curled round her side), so 0.90 m long makes her ~0.39 m
// tall standing (0.42 to the frill tops), near canon's 0.35; the unrigged model at 0.90 was 0.70. Same manner, look and tints.
export const MANALOTL_RIG: RigLook = {
  glbLen: 2.145, pivot: { x: 0.07, z: 0 },
  clipV: { walk: 0.42 / (0.9 / MANALOTL_GLB_LEN), run: 0.62 / (0.9 / MANALOTL_GLB_LEN) },   // built at the unrigged height: 0.42 / 0.62 m/s there
  runAt: [0.5, 0.44], hull: 0.026, neck: 'b_neck', head: 'b_head', avatar: { z: -0.42, far: 1.9 },
}
const RIG_H = GROWN.axolotl.length! / MANALOTL_RIG.glbLen
// ── M102 THE NEW VULNYX, RIGGED (the same switch; Alex 11-24 approved the look, docs/looks/vulnyx-2026-11-24 b-v2).
// Grown 0.70 m tall standing (GROWN, ear tips, body without the hull). Same tints as the model she replaces. Manner: darting legs (she runs whenever she goes
// anywhere, a walk is her first and last step), snappy glances, mostly alert; no hop, the gallop carries its own air.
export const VULNYX_RIG: RigLook = {
  glbLen: 1.466, pivot: { x: 0, z: -0.015 },
  clipV: { walk: 0.55 / 0.7, run: 2.8 / 0.7 },
  runAt: [0.9, 0.75], hull: 0.024, neck: 'b_neck', head: 'b_head', lie: true,
  // behind a keeper sprinting at 6.5 m/s she closes the gap in bursts of up to 9 m/s (FOLLOW.vMax) = 7.4 strides/s: at the shared 5.5
  // her feet slid on 416 of 539 of those frames, so her legs may go as fast as she ever does
  cadence: 7.5, avatar: { z: -0.22, far: 1.35 },
}
/** her glb's height standing (the idle clip's mean), glb units */
export const VULNYX_GLB_TALL = 1.003
const VRIG_H = GROWN.fox.height / VULNYX_GLB_TALL
// ── M173 the fliers' rigs: walk = a two-footed hop (planted), run = FLIGHT, so `fly` (spirit-fly.ts) and no stride there.
export const ATHOWL_RIG: RigLook = {
  glbLen: 0.777, pivot: { x: 0, z: 0 }, clipV: { walk: 0.55 / 0.5, run: 2.8 / 0.5 }, runAt: [0.9, 0.75], hull: 0.024,
  neck: 'b_neck', head: 'b_head', lie: true, fly: { alt: 0.3, up: 2.2, down: 4, flap: [0.75, 1.25] }, avatar: { z: -0.04, far: 1.1 },
}
export const NOCTYX_RIG: RigLook = {
  glbLen: 0.434, pivot: { x: 0, z: 0 }, clipV: { walk: 0.55 / 0.45, run: 2.8 / 0.45 }, runAt: [0.9, 0.75], hull: 0.024,
  neck: 'b_neck', head: 'b_head', lie: true, fly: { alt: 0.45, up: 4, down: 5, flap: [1.1, 1.8] }, avatar: { z: 0.02, far: 1.1 },
}
/** their glbs' heights standing (the idle clips' means), glb units */
export const ATHOWL_GLB_TALL = 1.005, NOCTYX_GLB_TALL = 0.999
// ── M173 s2: the Dewbear walks (the README's wiring numbers); her stubby legs go as fast as she ever does behind a sprinting keeper (FOLLOW.vMax 9 m/s = 14.6 strides/s: a
// scuttle), so the cadence cap is hers. The Hovari HOVERS (hover: every clip hangs ~0.9 m up, Alex 11-24 "near eye level").
export const DEWBEAR_RIG: RigLook = {
  glbLen: 1.58, pivot: { x: 0, z: 0 }, clipV: { walk: 1.0 / 0.5, run: 2.8 / 0.5 }, runAt: [1.0, 0.85], hull: 0.024,
  neck: 'b_neck', head: 'b_head', lie: true, cadence: 15, avatar: { z: 0, far: 1.3 },
}
export const HOVARI_RIG: RigLook = {
  glbLen: 1.09, pivot: { x: 0, z: 0 }, clipV: { walk: 0.8 / HOVARI_UNIT, run: 4.0 / HOVARI_UNIT }, runAt: [1.4, 1.1], hull: 0.030,
  neck: 'b_neck', head: 'b_head', lie: true,
  hover: { flap: [1.0, 1.25], low: 0.874 / HOVARI_UNIT, top: 1.16 / HOVARI_UNIT },
  cull: { c: [0, 4.4, 0.07], r: 1.3, min: [-0.95, 3.4, -0.9], max: [0.95, 5.4, 1.05] },
  avatar: { z: 0.07, far: 1.6, y: 4.0 },
}
export const DEWBEAR_GLB_TALL = 1.0
export const SPIRIT_RIGS: Partial<Record<Species, SpiritLook>> = {
  axolotl: {
    ...SPIRIT_MODELS.axolotl!, url: '/open/spirits/manalotl-rigged.glb', h: RIG_H, rig: MANALOTL_RIG, tilt: undefined,
    // her manner unchanged; she ambles on her legs, so the hop, the squash and the turn-lean are 0. The bound over a training
    // piece is the piece's height, not hers, so it stays what it was.
    trot: { ...grownTrot(MANALOTL_TROT, TUNED_H.axolotl, RIG_H, true), playH: SPIRIT_MODELS.axolotl!.trot.playH, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1 },
  },
  fox: {
    ...SPIRIT_MODELS.fox!, url: '/open/spirits/vulnyx-rigged.glb', h: VRIG_H, rig: VULNYX_RIG, ears: undefined,
    trot: { ...SPIRIT_MODELS.fox!.trot, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1 },
  },
  owl: { ...SPIRIT_MODELS.owl!, url: '/open/spirits/athowl-rigged.glb', h: GROWN.owl.height / ATHOWL_GLB_TALL, rig: ATHOWL_RIG },
  bat: { ...SPIRIT_MODELS.bat!, url: '/open/spirits/noctyx-rigged.glb', h: GROWN.bat.height / NOCTYX_GLB_TALL, rig: NOCTYX_RIG },
  // the very glb Blue wears at Greg's bench (he re-tones his own copy, glade-blue.tsx); every other Dewbear keeps its colours
  'water-bear': { ...SPIRIT_MODELS['water-bear']!, url: '/open/spirits/dewbear-rigged.glb', h: GROWN['water-bear'].height / DEWBEAR_GLB_TALL, rig: DEWBEAR_RIG },
  hummingbird: { ...SPIRIT_MODELS.hummingbird!, url: '/open/spirits/hovari-rigged.glb', rig: HOVARI_RIG,
    glow: { part: 'shimmer', emissive: '#b8fff0', lo: 0.35, hi: 0.6, hz: 0.5 } },
  // M226: the four OK'd bases, rigged only (the same look as SPIRIT_MODELS lists)
  rabbit: BASE_PREVIEW.rabbit, turtle: BASE_PREVIEW.turtle, frog: BASE_PREVIEW.frog, firefly: BASE_PREVIEW.firefly,
}
/** the look to draw: the rigged one where there is one and `on`. A second form IS rigged: it stays as it is with `on`, and
 *  with `?rig=0` (the old unrigged bodies, a frame-measure switch) she falls back to her species' old model. */
export const rigLook = (sp: Species, look: SpiritLook, on: boolean): SpiritLook =>
  (look.form ? (on ? look : SPIRIT_MODELS[sp] ?? look) : on ? SPIRIT_RIGS[sp] ?? look : look)

// ── M202 s1 THE SECOND FORMS, Vulnyx line first (Magii + Alex 11-26, athernyx b0f1d0d: model + rig all 40, awakened held).
// Sculpted in code off the live Vulnyx (same body, so the M132 rig plan fits as is) and coloured / marked from the LOCKED art
// /root/athernyx/assets/stage2/ 001 Vulnara, 011 Vulnarc, 012 Vulnore, 013 Vulnix (docs/looks/m202-vulnyx-2026-11-26).
// SIZE: canon (spirits-species.md, Spirit Scale) rules every evolution grows the spirit and leaves the metre figure to the
// build: a second form draws FORM_GROW x her base's grown height (Vulnyx 0.70 -> 0.84 m). Tints = each picture's coat.
export type SpiritElement = 'mana' | 'storm' | 'earth' | 'water'
export const SPIRIT_ELEMENTS: readonly SpiritElement[] = ['mana', 'storm', 'earth', 'water']
export const FORM_GROW = 1.2
// M202 v2 (Alex 11-26: "a little size increase as well since the awakened forms can get bigger than the player"): ONE SIZE DIAL
// PER FORM, x her base's grown height; a form not listed draws FORM_GROW. Vulnore (v2, her own body: carapace, pillar legs,
// docs/looks/m202-vulnore-v2-2026-11-26) 1.4: Vulnyx 0.70 -> ~0.99 m standing (a keeper is ~1.75 m). Her glb keeps the
// Vulnyx's nose-to-tail and standing height in glb units, so the Vulnyx rig numbers (glbLen, clip speeds) still fit her.
// Vulnara (v2, her own body: lean and leggy, tall tufted ears, a raised brow crystal, raised rune rings, a big brush with
// amethyst shards; docs/looks/m202-vulnara-v2-2026-11-26) 1.4 too: her head and body sit at the Vulnyx's glb scale.
// Vulnarc (v2, her own body: crackled storm plates with pale seams, a jagged crest from crown down the spine, a brush kinked like
// a bolt, big paws, the chest carried low; docs/looks/m202-vulnarc-v2-2026-11-26) 1.4 as her sisters.
// Vulnix (v2, her own body: long, slim and level, a wave tail that rises and breaks forward with flame tongues, current ridges
// and bubble domes on the coat, a water curl on the withers, webbed toes; docs/looks/m202-vulnix-v2-2026-11-26) 1.4 as her
// sisters; her floor + hull are deeper than s1's so she keeps the art's teal (Vulnarc read paler than her art).
// Marlotl (Manalotl's Water form, the first of the Manalotl line; her own body: webbed gill fins, a dorsal crest, a tall paddle
// tail fin, a long slim trunk on sprawled legs; docs/looks/m202-marlotl-2026-11-26) 1.4 x the Manalotl's 0.90 m nose to tail.
export const FORM_GROW_BY: Readonly<Record<string, number>> = { vulnore: 1.4, vulnara: 1.4, vulnarc: 1.4, vulnix: 1.4, marlotl: 1.4, cragbear: 1.4, aurlotl: 1.4, arclotl: 1.4, craglotl: 1.4, lumebear: 1.4, voltbear: 1.4, tidebear: 1.4, noctarc: 1.4, noctara: 1.4, noctore: 1.4, noctix: 1.4, mystowl: 1.4, voltowl: 1.4, cragowl: 1.4, tideowl: 1.4, croakrill: 1.4, croakara: 1.4, croakore: 1.5, croakarc: 1.4, mesamere: 1.5, aurmere: 1.4, voltmere: 1.4, tidemere: 1.4, lepaura: 1.4, leparc: 1.4, lepore: 1.5, lepnix: 1.4, voltari: 1.5, lumari: 1.5, obsidari: 1.5, tidari: 1.5, luminel: 1.5, luminarc: 1.5, luminore: 1.5, luminix: 1.5 }
export const formGrow = (name: string): number => FORM_GROW_BY[name] ?? FORM_GROW
const secondForm = (sp: Species, form: SpiritElement, name: string, emissive: string, hull: string): SpiritLook => {
  const b = SPIRIT_RIGS[sp]!, g = formGrow(name)
  return { ...b, name, form, url: `/open/spirits/${name}-rigged.glb`, h: b.h * g, skin: { emissive, emissiveI: 0.14 }, hull: { color: hull, opacity: 0.38 },
    trot: grownTrot(b.trot, b.h, b.h * g) }
}
// M202 Marlotl: her own skeleton (rig_marlotl.py: the M132 quadruped plan, a salamander's sprawl for both gaits, sit + lie), so
// her own RigLook; sized by length like her base (GROWN.axolotl.length x her dial over her glb's nose-to-tail).
export const MARLOTL_RIG: RigLook = {
  glbLen: 1.92, pivot: { x: 0, z: 0 }, clipV: { walk: 0.30 / 0.69, run: 0.95 / 0.69 }, runAt: [0.6, 0.5], hull: 0.026,
  neck: 'b_neck', head: 'b_head', lie: true, cadence: 9, avatar: { z: -0.3, far: 1.9 },
}
const marlotl = (): SpiritLook => {
  const L = secondForm('axolotl', 'water', 'marlotl', '#3fc4c0', '#b4f0ea'), h = GROWN.axolotl.length! * formGrow('marlotl') / MARLOTL_RIG.glbLen
  return { ...L, h, rig: MARLOTL_RIG }
}
/** her glb's height standing (the idle clip's mean), glb units (rig metrics) */
export const MARLOTL_GLB_TALL = 0.735
// M202 the rest of the Manalotl line (docs/looks/m202-manalotl-line-2026-11-26): Aurlotl (Mana: tall pear, chest high, a crown of
// arcing feather plumes, gold glyph-panel infusion markings (no sigil: Magii 0d6d577), a tail stub), Arclotl (Storm: round barrel, saw-tooth gill spikes with forked tendrils, a flat
// paddle tail, crackle veins), Craglotl (Earth: the widest and lowest, head and body one dome, stones in her back, moss, short leaf
// gills). Each her own skeleton (rig_lotl.py, the M132 quadruped plan from her own landmarks). All four forms are sculpted in ONE
// number space (Marlotl's), so they share Marlotl's world scale (her dial 1.4 over the Manalotl's 0.90 m) and read at true relative
// size: a short form is short, not blown up to Marlotl's length.
const LOTL_UNIT = GROWN.axolotl.length! * formGrow('marlotl') / MARLOTL_RIG.glbLen
const lotlRig = (glbLen: number, avatarZ: number): RigLook => ({ ...MARLOTL_RIG, glbLen, avatar: { z: avatarZ, far: 1.7 } })
export const AURLOTL_RIG = lotlRig(1.14, -0.1), ARCLOTL_RIG = lotlRig(1.59, -0.2), CRAGLOTL_RIG = lotlRig(1.48, -0.15)
const lotlForm = (el: SpiritElement, name: string, emissive: string, hull: string, rig: RigLook): SpiritLook =>
  ({ ...secondForm('axolotl', el, name, emissive, hull), h: LOTL_UNIT * formGrow(name) / formGrow('marlotl'), rig })
/** each form's glb height standing (the idle clip's mean, gill tips), glb units (rig metrics); the prod check sizes her by it */
export const LOTL_GLB_TALL: Readonly<Record<string, number>> = { marlotl: MARLOTL_GLB_TALL, aurlotl: 1.028, arclotl: 0.906, craglotl: 0.641 }
// M202 Cragbear (Dewbear's Earth form, the first of the Dewbear line; her own body: one squat ball-barrel with staves and two
// iron hoops, a moss cap with mushrooms, slate and crystal over the crown and shoulders, stub arms, a frowning brow; docs/looks/
// m202-cragbear-2026-11-26). Her own skeleton (rig_cragbear.py: the M132 quadruped plan, a heavy waddle, sit + lie); sized by
// height like her base: 1.4 x the Dewbear's 0.50 m standing.
export const CRAGBEAR_RIG: RigLook = {
  glbLen: 0.86, pivot: { x: 0, z: 0 }, clipV: { walk: 0.42 / 0.70, run: 1.15 / 0.70 }, runAt: [1.0, 0.85], hull: 0.024,
  neck: 'b_neck', head: 'b_head', lie: true, cadence: 12, avatar: { z: 0, far: 1.6 },
}
/** her glb's height standing (the idle clip's mean, mushroom tips), glb units (rig metrics) */
export const CRAGBEAR_GLB_TALL = 1.10
const cragbear = (): SpiritLook => {
  const L = secondForm('water-bear', 'earth', 'cragbear', '#ffa04a', '#ffd9a8')
  return { ...L, rig: CRAGBEAR_RIG }   // h = her base's x 1.4 (her barrel 1.4 x the Dewbear's; the mushrooms stand over it, as ears do)
}
// M202 the rest of the Dewbear line (docs/looks/m202-dewbear-line-2026-11-26): Lumebear (Mana: an upright rune-vessel egg on four
// peg feet, a lid with ears, flippers, gold runes), Voltbear (Storm: a segmented spined pill under a ridged hood, lightning veins),
// Tidebear (Water: a tall bear-headed column, crystal crown, arms folded, splash feet). Each her own skeleton (rig_bear.py, the M132
// quadruped plan from her own landmarks), sculpted in Cragbear's number space, so all four share her scale (1.4 x the Dewbear's).
const bearRig = (glbLen: number): RigLook => ({ ...CRAGBEAR_RIG, glbLen })
// M215 (Alex 11-26): Voltbear has NO LEGS and hovers like a thundercloud cocoon (every clip, drawn in the glb, 9 cm up standing,
// settling low to sit / lie); Tidebear is a SLUG on one wet sole that slides (a body wave up her column, no steps). Both keep the
// 24-bone skeleton, the leg bones weighted to nothing (docs/looks/m215-2026-11-26/tools/rig_cocoon.py). The game adds nothing for
// it: the rig's ground keep only ever LIFTS (a hoverer is never pulled down) and Tidebear's sole rides the root (never lifts).
export const LUMEBEAR_RIG = bearRig(0.795), VOLTBEAR_RIG = bearRig(0.755), TIDEBEAR_RIG = bearRig(0.819)
const bearForm = (el: SpiritElement, name: string, emissive: string, hull: string, rig: RigLook): SpiritLook =>
  ({ ...secondForm('water-bear', el, name, emissive, hull), rig })
/** each form's glb height standing (the idle clip's mean), glb units (rig metrics); the prod check sizes her by it */
export const BEAR_GLB_TALL: Readonly<Record<string, number>> = { cragbear: CRAGBEAR_GLB_TALL, lumebear: 1.08, voltbear: 1.054, tidebear: 1.211 }   // M215: Voltbear's = her body (legless), her hover over it
// M202 the Noctyx line (docs/looks/m202-noctyx-line-2026-11-26): Noctarc (Storm: pale and fluffy, the biggest ears, a brow crystal,
// small wings low at her hips, lightning veins), Noctara (Mana: a charcoal faceted hood, glowing violet eyes, the widest wings, a violet
// egg belly with a gold flowing pattern, a wisp of a tail), Noctore (Earth: brown and stocky, two small horns + a green gem, a moss
// collar, a glowing amber heart, orange cape wings), Noctix (Water: teal and round, raised bubbles + swirls, a water-drop gem, an open
// smile). Each her own sculpt (tools/noct.py) on the Noctyx base's 32-bone flier plan (tools/rig_noct.py), in the base's number space,
// so each draws the base's glb scale x her dial 1.4 and her own RigLook (the flier numbers; Noctara's tail makes her longer).
const noctRig = (glbLen: number): RigLook => ({ ...NOCTYX_RIG, glbLen })
export const NOCTARC_RIG = noctRig(0.434), NOCTARA_RIG = noctRig(0.53), NOCTORE_RIG = noctRig(0.434), NOCTIX_RIG = noctRig(0.434)
const noctForm = (el: SpiritElement, name: string, emissive: string, hull: string, rig: RigLook): SpiritLook =>
  ({ ...secondForm('bat', el, name, emissive, hull), rig })
/** each form's glb height standing (the idle clip's mean), glb units (three-check); the prod check sizes her by it */
export const NOCT_GLB_TALL: Readonly<Record<string, number>> = { noctarc: 1.051, noctara: 1.042, noctore: 1.0, noctix: 0.978 }
// M202 the Athowl line (docs/looks/m202-athowl-line-2026-11-26): Mystowl (Mana: a tall bottom-heavy egg, huge grey eye discs, ragged
// tufts, a gold third eye, a gold flowing flank pattern), Voltowl (Storm: small and round, pale blue, her wings raised open in a V at
// rest, frowning brows, a brow crystal), Cragowl (Earth: a stocky shaggy barrel, branching antlers, a cheek ruff, moss, an amber gem),
// Tideowl (Water: a sleek forward-leaning teardrop, a long tail, no tufts, a pale heart face, a crown water gem, legs that show). Each
// her own sculpt from her locked art on the base Athowl's 25-bone flier plan (tools/rig_owl.py), in the base's number space, so each
// draws the base's glb scale x her dial 1.4 and reads at true relative size; her own RigLook only for her nose-to-tail.
const owlRig = (glbLen: number): RigLook => ({ ...ATHOWL_RIG, glbLen })
export const MYSTOWL_RIG = owlRig(0.694), VOLTOWL_RIG = owlRig(0.522), CRAGOWL_RIG = owlRig(0.724), TIDEOWL_RIG = owlRig(0.86)
const owlForm = (el: SpiritElement, name: string, emissive: string, hull: string, rig: RigLook): SpiritLook =>
  ({ ...secondForm('owl', el, name, emissive, hull), rig })
/** each form's glb height standing (the idle clip's mean: tufts, raised wings, antlers), glb units (three-check); the prod check sizes her by it */
export const OWL_GLB_TALL: Readonly<Record<string, number>> = { mystowl: 1.02, voltowl: 0.912, cragowl: 1.156, tideowl: 0.916 }
// M202 the Hovari line (docs/looks/m202-hovari-line-2026-11-26, redone in docs/looks/m202-hovari-redo-2026-11-27): Voltari (Storm: slim slate-blue, the longest pale ragged wings, a
// long ragged tail, a crown crystal, lightning veins), Lumari (Mana: the plumpest, the longest beak, broad violet wings, three long tail
// feathers, a gold flowing pattern), Obsidari (Earth: stocky amber stone chips, the biggest head, a green gem collar, flank stones in
// moss, short leaf wings raised high), Tidari (Water: the sleekest, a crown water drop, a short beak, narrow wings swept high, the
// longest narrow tail, ripple rings). Each her own sculpt from her locked art on the base Hovari's 24-bone hover plan (tools/rig_hov.py),
// in the base's number space, so each draws the base's glb scale x her dial, hovers on the base's dial and beats her own shimmer.
// REDO 11-27 (docs/looks/m202-hovari-redo-2026-11-27, Alex: 'still holding onto the hovari baby body ... a bit bigger.. but still
// juvenile'): fledgling proportions (smaller head for the body, longer trunk, wings and tail, thicker legs) and her dial 1.4 -> 1.5.
const hovRig = (glbLen: number): RigLook => ({ ...HOVARI_RIG, glbLen })
export const VOLTARI_RIG = hovRig(1.352), LUMARI_RIG = hovRig(1.344), OBSIDARI_RIG = hovRig(1.126), TIDARI_RIG = hovRig(1.229)     // redo: x her grown beak-to-tail
const hovForm = (el: SpiritElement, name: string, emissive: string, hull: string, shimmer: string, rig: RigLook): SpiritLook => {
  const L = secondForm('hummingbird', el, name, emissive, hull)
  return { ...L, rig, glow: { ...L.glow!, emissive: shimmer } }
}
/** each form's body height hanging in her hover (the idle clip's mean, wing tip to tail tip, the hover not counted; redo tools/idle-tall.mts),
 *  glb units; the prod check sizes her by it once she hangs still, the unit test holds her bind height within 4% of it */
export const HOV_GLB_TALL: Readonly<Record<string, number>> = { voltari: 1.328, lumari: 1.323, obsidari: 1.273, tidari: 1.42 }
// M202 the Croakling line (docs/looks/m202-croakling-line-2026-11-27): Croakrill (Water: taller and upright, gill fronds, long webbed toes,
// dark spots, a cyan orb), Croakara (Mana: wide and squat on splayed legs, huge lilac-ringed eyes, gold flowing infusion markings, a violet
// bud orb), Croakore (Earth: a warty toad, the heaviest, moss on crown and shoulders, slit-pupilled orange eyes, an amber orb; dial 1.5),
// Croakarc (Storm: a SKINK, no lure (grimoire-ledger divergence note), a long curling tail, a pointed crest, dorsal spines, lightning veins,
// a violet brow gem). Each is the BASE Croakling's sculpt + rig modules re-shaped by name (tools/croak_common.py, rig_croak.py), so the
// base (M174, public since M226; its data lives in spirit-base-preview.ts) flows into all four on a rebuild. The line builds off
// BASE_PREVIEW.frog (= SPIRIT_RIGS.frog); the forms are PUBLIC since Alex's OK 11-27 (spirit-public.ts PUBLIC_FORMS). Croakarc
// left the frog's sculpt + rig in pass 2 (CROAKARC_RIG below). CROAK_GLB_TALL = each body's idle mean height (lure not counted).
export const CROAK_GLB_TALL: Readonly<Record<string, number>> = { croakrill: 0.854, croakara: 0.794, croakore: 0.776, croakarc: 0.512 }
// glbLen = her nose to haunch (tail tip) and hRig = the metres per glb unit her clips were timed at (rig metrics height_m), so her clips
// play 1:1 at the base's 0.55 / 2.4 m/s in her own glb units
const croakForm = (el: SpiritElement, name: string, emissive: string, hull: string, glbLen: number, hRig: number): SpiritLook => {
  const b = BASE_PREVIEW.frog!, g = formGrow(name)
  return { ...b, name, form: el, url: `/open/spirits/${name}-rigged.glb`, h: b.h * g, skin: { emissive, emissiveI: 0.14 }, hull: { color: hull, opacity: 0.38 },
    trot: grownTrot(b.trot, b.h, b.h * g), rig: { ...b.rig!, glbLen, clipV: { walk: 0.55 / hRig, run: 2.4 / hRig } } }
}
// M202 pass 2 (Alex 11-27): Croakarc LOW and lizard-like, walking like one. She leaves the frog's sculpt + rig: her own skink body and
// her own skeleton (docs/looks/m202-croakling-pass2-2026-11-27/tools/rig_croakarc.py: the M132 quadruped plan, 24 bones, a sprawl walk
// + scurry, sit, lie), still in the croak unit space (h = the base's x her dial, so she stands at true size by her sisters). Her
// lightning veins are unlit tubes on her eyes part (they glow), skinned to the body. glbLen = her nose to tail tip, glb units.
export const CROAKARC_RIG: RigLook = {
  glbLen: 2.067, pivot: { x: 0, z: 0 }, clipV: { walk: 0.40 / 0.5606, run: 1.30 / 0.5606 }, runAt: [0.9, 0.75], hull: 0.024,
  neck: 'b_neck', head: 'b_head', lie: true, cadence: 12, avatar: { z: -0.35, far: 1.8 },
}
function croakarc(): SpiritLook { return { ...croakForm('storm', 'croakarc', '#a8d2ff', '#dcecff', CROAKARC_RIG.glbLen, 0.5606), rig: CROAKARC_RIG } }
// M244 sheet 9 (world, 11-28): CROAKARC's four AWAKENED forms (Storm), OWNER PREVIEW (docs/looks/m244-croakarc-2026-11-28): the live
// Croakarc's sculpt re-shaped by name (sculpt_croakaw.py), in the croak unit space (h = the base Croakling's x her dial). Croakarkor,
// Croakarielle and Croakarcun stand UP on a ground biped rig (rig_croakup.py: legs, arms, a four-bone tail, the pelvis carries her height,
// baked tail springs); Arcvik stays a skink on the live Croakarc rig (rig_arcvik.py). 'aura' = her motif: Croakarkor's bulb lure (head) +
// crackle (chest), Croakarielle's ring of orbs (chest), Arcvik's bolt striking the ground ahead of her (root), Croakarcun's free-floating
// lure on one thread ('float', a root child that bobs). CROAK_AW_DIAL = her dial; clipV = the metrics' v_glb (glb units a second).
export const CROAK_AW_DIAL: Readonly<Record<string, number>> = { croakarkor: 1.85, croakarielle: 1.75, arcvik: 1.8, croakarcun: 1.75 }
const croakUpRig = (glbLen: number, walk: number, run: number): RigLook => ({
  glbLen, pivot: { x: 0, z: 0 }, clipV: { walk, run }, runAt: [0.9, 0.75], hull: 0.024, neck: 'b_neck', head: 'b_head', lie: true, cadence: 12, avatar: { z: 0, far: 2.0 },
})
const croakAw = (name: string, aura: string, rig: RigLook): SpiritLook => {
  const b = croakarc(), base = BASE_PREVIEW.frog!, h = base.h * CROAK_AW_DIAL[name]
  return { ...b, name, url: `/open/spirits/${name}-rigged.glb`, h, trot: grownTrot(base.trot, base.h, h), rig, glow: { part: 'aura', emissive: aura, lo: 0.35, hi: 0.7, hz: 0.35 } }
}
export const CROAK_AWAKENED: Readonly<Record<string, SpiritLook>> = {
  croakarkor: croakAw('croakarkor', '#dff4ff', croakUpRig(1.467, 0.5319, 1.2082)),
  croakarielle: croakAw('croakarielle', '#fff0b4', croakUpRig(1.309, 0.6799, 1.5918)),
  arcvik: croakAw('arcvik', '#f0faff', { ...CROAKARC_RIG, glbLen: 2.067 }),
  croakarcun: croakAw('croakarcun', '#c8f4ff', croakUpRig(1.219, 0.1395, 0.3055)),
}
// M244 sheet 11 (world, 11-28): CROAKARA's four AWAKENED forms (Mana), OWNER PREVIEW (docs/looks/m244-croakara-2026-11-28): the live
// Croakara's sculpt re-shaped by name (sculpt_croakaraw.py / sculpt_croakalys.py), in the croak unit space (h = the base Croakling's x her
// dial). Croakgulp (the heavy 99-meals form), Croakavis and Araeth stay sitting frogs on the live Croakara rig (the base Croakling's 19
// bones + clips, rig_croakaraw.py: + baked lure springs); Croakalys stands UP on sheet 9's ground biped (rig_croakalys.py). 'aura' = her
// motif: Croakgulp's gold belly swirl, Croakalys's streaks of song (chest), Croakavis's ghost copy behind her (root), Araeth's copper pot +
// potion bottles hanging from her globe (lure tip). glbLen + the clip timing (hRig = rig metrics height_m) are her metrics'.
export const CROAKARA_AW_DIAL: Readonly<Record<string, number>> = { croakgulp: 2.0, croakalys: 1.85, croakavis: 1.8, araeth: 1.75 }
const croakaraAw = (name: string, aura: string, glbLen: number, hRig: number, rig?: RigLook): SpiritLook => {
  const b = croakForm('mana', 'croakara', '#b49cff', '#e8dcff', glbLen, hRig), base = BASE_PREVIEW.frog!, h = base.h * CROAKARA_AW_DIAL[name]
  return { ...b, name, url: `/open/spirits/${name}-rigged.glb`, h, trot: grownTrot(base.trot, base.h, h), rig: rig ?? b.rig, glow: { part: 'aura', emissive: aura, lo: 0.35, hi: 0.7, hz: 0.35 } }
}
export const CROAKARA_AWAKENED: Readonly<Record<string, SpiritLook>> = {
  croakgulp: croakaraAw('croakgulp', '#ffd060', 0.954, 0.3653),
  croakalys: croakaraAw('croakalys', '#fff0b4', 1.09, 0.3864, croakUpRig(1.09, 0.7813, 1.8294)),
  croakavis: croakaraAw('croakavis', '#e8dcff', 0.868, 0.3864),
  araeth: croakaraAw('araeth', '#ffb070', 0.778, 0.3864),
}
// M244 sheet 12 (world, 11-28): CROAKORE's four AWAKENED forms (Earth), OWNER PREVIEW (docs/looks/m244-croakore-2026-11-28): the live
// Croakore's sculpt re-shaped by name (sculpt_croakorew.py), all four sitting toads on the live Croakore rig (the base Croakling's 19 bones +
// clips, rig_croakorew.py: + baked lure springs + a 'ground' bone that undoes the root's lean + hop, so what lies on the ground stays flat on it).
// 'aura' = her motif: Oregrak's glowing cracks in the ground (her stone shoulder plates + cuffs are in her body), Croakorelle's amber crystal
// ball on her throat + ground crystals, Croakoris's burrow + earth spray, Croakormyr's amber crystal crust on her back. glbLen + hRig = her metrics'.
export const CROAKORE_AW_DIAL: Readonly<Record<string, number>> = { oregrak: 2.1, croakorelle: 1.95, croakoris: 1.9, croakormyr: 1.85 }
const croakoreAw = (name: string, aura: string, glbLen: number, hRig: number): SpiritLook => {
  const b = croakForm('earth', 'croakore', '#ffae4a', '#ffe2b4', glbLen, hRig), base = BASE_PREVIEW.frog!, h = base.h * CROAKORE_AW_DIAL[name]
  return { ...b, name, url: `/open/spirits/${name}-rigged.glb`, h, trot: grownTrot(base.trot, base.h, h), glow: { part: 'aura', emissive: aura, lo: 0.35, hi: 0.7, hz: 0.35 } }
}
export const CROAKORE_AWAKENED: Readonly<Record<string, SpiritLook>> = {
  oregrak: croakoreAw('oregrak', '#ffa838', 0.841, 0.3916),
  croakorelle: croakoreAw('croakorelle', '#ffc050', 0.855, 0.3994),
  croakoris: croakoreAw('croakoris', '#e0a050', 0.919, 0.3994),
  croakormyr: croakoreAw('croakormyr', '#ffb850', 0.847, 0.4034),
}
// M202 the Shellmere line (docs/looks/m202-shellmere-line-2026-11-27): Mesamere (Earth, his natural form: a great stone tortoise, a tall
// dome of heavy plates, moss along the lip, an amber crown crystal, pillar legs; dial 1.5), Aurmere (Mana: a high round violet dome with
// the canon rune-light rings grown over every scute, longer antennae), Voltmere (Storm: a wide low blocky pale-blue shell with lightning
// forks, knobbly legs, long claws), Tidemere (Water: a SEA TURTLE, a long low teardrop shell, flippers, swirl carvings). Each is the BASE
// Shellmere's sculpt + rig modules re-shaped by name (tools/shell_common.py, rig_mere.py), the base's 18 bones and five clips timed at the
// base's 0.464 m per glb unit, so the clips play 1:1 at the base's speeds; h = the base's x her dial. SHELL_GLB_TALL = each body's idle mean
// height (rig metrics body_mean_top: antennae + crystal not counted; what the prod check measures). PUBLIC since Alex's OK 11-27 (spirit-public PUBLIC_FORMS).
// M202 11-28 TIDEMERE CARRIES HER OWN WATER (canon spirits-species.md): her own legless rig (docs/looks/m202-tidemere-glide-2026-11-28,
// flipper + blade bones, the plastron riding 0.03 units over her ground on the sheet spirit-water.ts draws, the flippers stroking over it);
// her 0.51 = that rig's idle body (lower than her sculpt's 0.581: the flippers lift off the ground).
export const SHELL_GLB_TALL: Readonly<Record<string, number>> = { mesamere: 0.869, aurmere: 0.799, voltmere: 0.716, tidemere: 0.51 }
/** M202 11-28: a Shellmere form's glb file (Tidemere's glide rig ships under a new name, so the old page never draws it without her water) */
export const shellGlb = (name: string) => `/open/spirits/${name === 'tidemere' ? 'tidemere-v2' : name}-rigged.glb`
const shellForm = (el: SpiritElement, name: string, emissive: string, hull: string, glbLen: number): SpiritLook => {
  const b = BASE_PREVIEW.turtle!, g = formGrow(name)
  return { ...b, name, form: el, url: shellGlb(name), h: b.h * g, skin: { emissive, emissiveI: 0.12 }, hull: { color: hull, opacity: 0.38 },
    trot: grownTrot(b.trot, b.h, b.h * g), rig: { ...b.rig!, glbLen } }
}
// M202 the Lepara line (docs/looks/m202-lepara-line-2026-11-27): Lepaura (Mana, the ledger's MOON-HARE: taller, a plume tail, a gold
// crescent on her brow, a gold necklace + diamond, gold infusion ribbons = pattern only), Leparc (Storm: silver-blue, cheek + ear-tip tufts,
// a violet brow crystal, pale lightning veins, a puff tail), Lepore (Earth, her natural form, the heaviest: barrel belly, leaf-stone
// pauldrons + bracers, amber brow + chest crystals; dial 1.5), Lepnix (Water, the ledger's UNICORN divergence: an aqua foal standing on four
// legs, a horn, a water-mane, a plume tail; the base head kept). Each is the BASE Lepara's sculpt + rig re-shaped by name (tools/lep_common.py,
// rig_lep.py: the base's 20 bones + five clips at the base's 0.48 m per glb unit; Lepnix's joints moved onto her foal body).
// LEP_GLB_TALL = each body's idle mean height (rig metrics body_mean_top, ears counted as the base's LEPARA_GLB_TALL). PUBLIC since
// Alex's YAY 11-28 (spirit-public PUBLIC_FORMS).
export const LEP_GLB_TALL: Readonly<Record<string, number>> = { lepaura: 1.042, leparc: 1.096, lepore: 0.976, lepnix: 0.885 }
const lepForm = (el: SpiritElement, name: string, emissive: string, hull: string, glbLen: number): SpiritLook => {
  const b = BASE_PREVIEW.rabbit!, g = formGrow(name)
  return { ...b, name, form: el, url: `/open/spirits/${name}-rigged.glb`, h: b.h * g, skin: { emissive, emissiveI: 0.12 }, hull: { color: hull, opacity: 0.38 },
    trot: grownTrot(b.trot, b.h, b.h * g), rig: { ...b.rig!, glbLen } }
}
// M202 the Luminara line (docs/looks/m202-luminara-line-2026-11-27): Luminel (Mana: an upright violet GEM of a body drawn to a point and cut
// in diamond facets, a brow crystal, broad aqua wings with gold veins, gold flowing infusion markings on her flanks, a bigger lamp), Luminarc
// (Storm: icy pale blue, an angular crowned head, branched lightning antennae, an ice-crystal collar, white lightning forks, long dangling
// legs, long narrow wings, an open happy mouth), Luminore (Earth: a round brown STONE pear, no waist, a crown of amber crystals packed in
// moss, short brown wing-case paddles, stubby feet, an amber lamp), Luminix (Water: a round teal water drop, a wave fin on the crown, fins
// for wings, pointed fin-feet, water swirls and bubbles, bubbles in her pale lamp). Each is the BASE Luminara's sculpt + rig modules
// re-shaped by name (tools/lum_common.py, rig_lum.py): the base's 19-bone hover plan and five clips, in the base's unit (0.3438 m per glb
// unit), so each draws the base's h x her dial and hangs at the base's hover x her dial. Living light: her crystals / markings / bolts /
// moss / bubbles ride the unlit part (they glow). LUM_GLB_TALL = each body's idle mean height (rig metrics body_mean_top). OWNER PREVIEW
// (not in spirit-public PUBLIC_FORMS) until Alex OKs the line.
export const LUM_GLB_TALL: Readonly<Record<string, number>> = { luminel: 0.98, luminarc: 1.011, luminore: 0.936, luminix: 1.048 }
type Cull = NonNullable<RigLook['cull']>
// glbLen = her nose to tail (rig metrics glb_long); low / top = her idle hover's lowest + highest point and cull = her bounds over every clip (glb units)
const lumForm = (el: SpiritElement, name: string, emissive: string, hull: string, lamp: string, glbLen: number, low: number, top: number, cull: Cull): SpiritLook => {
  const b = BASE_PREVIEW.firefly!, g = formGrow(name)
  return { ...b, name, form: el, url: `/open/spirits/${name}-rigged.glb`, h: b.h * g, skin: { emissive, emissiveI: 0.12 }, hull: { color: hull, opacity: 0.45 },
    trot: grownTrot(b.trot, b.h, b.h * g), rig: { ...b.rig!, glbLen, hover: { ...b.rig!.hover!, low, top }, cull }, glow: { ...b.glow!, emissive: lamp } }
}
// M202 v2 (Alex 11-28: "luminore and luminix both lose their flight in these two evos.. let's get rid of the wings kind of like it turned
// into an egg form before awakening"): Luminore + Luminix are GROUNDED, wingless EGG forms (a rounded plated shell-body on two stubby feet,
// a glowing hatch line round her). The hover contract is OFF for these two: no `hover`, no own culling (she stands where the shared one
// looks), the panel copy is not set down. Her own ground rig (tools/rig_lum_ground.py, 10 bones, feet on y = 0 in every clip): walk = a
// waddle, run = a quick scoot; clipV = each clip's speed at 1:1 in the base unit (metrics plays_1to1_at_mps); a cadence a little over the
// shared cap (short legs patter), past it her feet slide = she glides.
const LUM_EGG_V = { walk: 0.2088, run: 0.3782 }
const lumEgg = (el: SpiritElement, name: string, emissive: string, hull: string, lamp: string, glbLen: number): SpiritLook => {
  const b = BASE_PREVIEW.firefly!, g = formGrow(name), { hover: _h, cull: _c, avatar, ...rig } = b.rig!
  return { ...b, name, form: el, url: `/open/spirits/${name}-rigged.glb`, h: b.h * g, skin: { emissive, emissiveI: 0.12 }, hull: { color: hull, opacity: 0.45 },
    trot: grownTrot(b.trot, b.h, b.h * g),
    rig: { ...rig, glbLen, clipV: { walk: LUM_EGG_V.walk / LUMINARA_UNIT, run: LUM_EGG_V.run / LUMINARA_UNIT }, runAt: [0.9, 0.7], cadence: 6.5, avatar: { z: avatar.z, far: avatar.far } },
    glow: { ...b.glow!, emissive: lamp } }
}
export const SECOND_FORMS: Partial<Record<Species, Partial<Record<SpiritElement, SpiritLook>>>> = {
  rabbit: {
    mana: lepForm('mana', 'lepaura', '#b49cff', '#e8dcff', 0.832),
    storm: lepForm('storm', 'leparc', '#a8d2ff', '#dcecff', 0.759),
    earth: lepForm('earth', 'lepore', '#ffae4a', '#ffe2b4', 0.762),
    water: lepForm('water', 'lepnix', '#3fc4c0', '#b4f0ea', 0.95),   // 11-28 her own four-legged walk / trot / sit / lie (trot_lepnix.py)
  },
  turtle: {
    earth: shellForm('earth', 'mesamere', '#ffc25a', '#f4e6c4', 1.42),
    mana: shellForm('mana', 'aurmere', '#b49cff', '#e8dcff', 1.317),
    storm: shellForm('storm', 'voltmere', '#a8d2ff', '#dcecff', 1.353),
    water: shellForm('water', 'tidemere', '#3fc4c0', '#b4f0ea', 1.612),
  },
  frog: {
    water: croakForm('water', 'croakrill', '#3fc4c0', '#b4f0ea', 0.896, 0.3793),
    mana: croakForm('mana', 'croakara', '#b49cff', '#e8dcff', 0.769, 0.4020),
    earth: croakForm('earth', 'croakore', '#ffae4a', '#ffe2b4', 0.846, 0.4160),
    storm: croakarc(),
  },
  axolotl: {
    water: marlotl(),
    mana: lotlForm('mana', 'aurlotl', '#b49cff', '#e8dcff', AURLOTL_RIG),
    storm: lotlForm('storm', 'arclotl', '#a8d2ff', '#dcecff', ARCLOTL_RIG),
    earth: lotlForm('earth', 'craglotl', '#ffae4a', '#ffe2b4', CRAGLOTL_RIG),
  },
  'water-bear': {
    earth: cragbear(),
    mana: bearForm('mana', 'lumebear', '#b49cff', '#e8dcff', LUMEBEAR_RIG),
    storm: bearForm('storm', 'voltbear', '#a8d2ff', '#dcecff', VOLTBEAR_RIG),
    water: bearForm('water', 'tidebear', '#3fc4c0', '#b4f0ea', TIDEBEAR_RIG),
  },
  bat: {
    storm: noctForm('storm', 'noctarc', '#a8d2ff', '#dcecff', NOCTARC_RIG),
    mana: noctForm('mana', 'noctara', '#b49cff', '#e8dcff', NOCTARA_RIG),
    earth: noctForm('earth', 'noctore', '#ffae4a', '#ffe2b4', NOCTORE_RIG),
    water: noctForm('water', 'noctix', '#3fc4c0', '#b4f0ea', NOCTIX_RIG),
  },
  owl: {
    mana: owlForm('mana', 'mystowl', '#b49cff', '#e8dcff', MYSTOWL_RIG),
    storm: owlForm('storm', 'voltowl', '#a8d2ff', '#dcecff', VOLTOWL_RIG),
    earth: owlForm('earth', 'cragowl', '#ffae4a', '#ffe2b4', CRAGOWL_RIG),
    water: owlForm('water', 'tideowl', '#3fc4c0', '#b4f0ea', TIDEOWL_RIG),
  },
  hummingbird: {
    storm: hovForm('storm', 'voltari', '#a8d2ff', '#dcecff', '#d6ecff', VOLTARI_RIG),
    mana: hovForm('mana', 'lumari', '#b49cff', '#e8dcff', '#e2d0ff', LUMARI_RIG),
    earth: hovForm('earth', 'obsidari', '#ffae4a', '#ffe2b4', '#ffdc9a', OBSIDARI_RIG),
    water: hovForm('water', 'tidari', '#3fc4c0', '#b4f0ea', '#b8f6f2', TIDARI_RIG),
  },
  firefly: {
    mana: lumForm('mana', 'luminel', '#b49cff', '#e8dcff', '#fff4d6', 0.717, 2.444, 3.787, { c: [0, 2.98, 0.04], r: 1.26, min: [-0.74, 2.05, -0.61], max: [0.74, 3.91, 0.68] }),
    storm: lumForm('storm', 'luminarc', '#a8d2ff', '#dcecff', '#e0f4ff', 0.7709, 2.501, 3.907, { c: [0, 3.08, 0.02], r: 1.35, min: [-0.82, 2.13, -0.67], max: [0.82, 4.03, 0.72] }),
    earth: lumEgg('earth', 'luminore', '#ffae4a', '#ffe2b4', '#ffc870', 0.7803),   // 11-28 v2: a grounded egg (no wings, no hover)
    water: lumEgg('water', 'luminix', '#3fc4c0', '#b4f0ea', '#d4fbf6', 0.7608),   // 11-28 v2: a grounded egg (no wings, no hover)
  },
  fox: {
    mana: secondForm('fox', 'mana', 'vulnara', '#b49cff', '#e8dcff'),
    storm: secondForm('fox', 'storm', 'vulnarc', '#a8d2ff', '#dcecff'),
    earth: secondForm('fox', 'earth', 'vulnore', '#ffae4a', '#ffe2b4'),
    water: secondForm('fox', 'water', 'vulnix', '#2fb4c4', '#9fe4ec'),
  },
}
// BETA M244 sheet 1 (sprites, 2026-11-27): the four AWAKENED forms of Vulnara, OWNER PREVIEW ONLY (the /dev gallery; no evolution
// rule, nothing a player draws). Each her own sculpt + skeleton (docs/looks/m244-vulnara-2026-11-27/tools: sculpt_awaken.py,
// rig_awaken.py) in Vulnara's number space, so each draws the Vulnyx's glb scale x her dial; every dial is past Vulnara's 1.4
// (canon: each evolution grows her). Her 'aura' part is the look's glow part: Vulnarok's four gold self-echoes and Vulnavex's
// two gold copies where she just ran (whole copies, not smoke), Vulnalys's violet spirals and Vulnamyr's crown-halo (head-borne).
/** each one's nose to tail standing (rig metrics idle length_m / 0.70), glb units: the rig's glbLen */
// M244 s1b: Vulnarok stands on the FIRST BIPED RIG (rig-2026-11-24/tools/plans/biped.py; same clip names), her four echoes and
// Vulnavex's two copies are rigged copies that play her clip a beat behind (echoes.py; Vex's run only, drifting back + shrinking away).
// M244 s1c (Alex 11-27): Vulnamyr's EIGHT crystal tails, each its own lofted piece on its own three-bone chain (b_tail_<k>_1..3), swaying
// on its own beat, every clip's lift solved off the mesh (clear of the ground; in the sit below her head, behind her rump). Vulnalys keeps
// Vulnara's fox build, heavier like a dire wolf (deeper chest, thick legs, big paws, a broader head): 1.5x her body length, 1.4x her height.
// M244 sheet 2 (sprites, 11-27): VULNARC's four (Storm), owner preview, same tools (sculpt_awaken.py kor / celle / arcvex / ceth;
// Vulnarkor on the biped rig, rig_biped.py), Vulnarc's own look as the base: Vulnarkor a crystal-shard mantle + bolts round her,
// Vulnarcelle a big crackling mane, Arcvex a jagged crest + two ice-white copies that run, Vulnarceth her storm cloud + two discs.
export const AWAKEN_LEN: Readonly<Record<string, number>> = { vulnarok: 1.463, vulnalys: 1.487, vulnavex: 1.87, vulnamyr: 1.283, vulnarkor: 1.393, vulnarcelle: 1.366, arcvex: 1.817, vulnarceth: 1.377, orethar: 1.239, vulnoraya: 1.726, vulnoris: 1.457, vulnorun: 1.581, vulnitar: 1.509, marelle: 1.42, vulnisk: 1.83, vulnixeth: 1.393, luminok: 0.7608, lumilys: 0.6819, lumivex: 1.2647, elhae: 0.714, luminthar: 0.758, lumicelle: 0.9167, arcet: 0.9748, lumiceth: 0.8779, orebrak: 0.7853, lumoraya: 0.7803, lumorvex: 0.785, lumorun: 0.7898, lumixok: 0.7538, marisse: 0.7761, lumixis: 1.1673, lumixeth: 0.7659, mystowk: 0.7049, mystowelle: 0.7487, mystowis: 0.9564, mysteth: 0.7899 }
export const AWAKEN_GROW: Readonly<Record<string, number>> = { vulnarok: 1.8, vulnalys: 1.7, vulnavex: 1.65, vulnamyr: 1.75, vulnarkor: 1.8, vulnarcelle: 1.75, arcvex: 1.8, vulnarceth: 1.75, orethar: 1.8, vulnoraya: 1.75, vulnoris: 1.8, vulnorun: 1.75, vulnitar: 1.95, marelle: 1.8, vulnisk: 1.8, vulnixeth: 1.75, luminok: 2.0, lumilys: 1.9, lumivex: 1.8, elhae: 2.0, luminthar: 2.0, lumicelle: 1.9, arcet: 1.8, lumiceth: 2.0, orebrak: 1.8, lumoraya: 1.75, lumorvex: 1.75, lumorun: 1.75, lumixok: 2.1, marisse: 1.95, lumixis: 2.0, lumixeth: 1.95, mystowk: 1.85, mystowelle: 1.75, mystowis: 1.8, mysteth: 1.85 }
const awakened = (name: string, glbLen: number, aura: string, far: number, el: 'mana' | 'storm' | 'earth' | 'water' = 'mana'): SpiritLook => {
  const b = SECOND_FORMS.fox![el]!, h = VRIG_H * AWAKEN_GROW[name]
  return { ...b, name, url: `/open/spirits/${name}-rigged.glb`, h, trot: grownTrot(b.trot, b.h, h), rig: { ...b.rig!, glbLen, avatar: { z: b.rig!.avatar.z, far } },
    glow: { part: 'aura', emissive: aura, lo: 0.35, hi: 0.7, hz: 0.35 } }
}
// M244 sheet 5 (sprites, 11-28): LUMINEL's four (Mana), owner preview, HOVERERS like her parent (docs/looks/m244-luminel-2026-11-28): each the
// live Luminel's sculpt re-shaped by name to a new silhouette (sculpt_lumaw.py) on the base Luminara's hover rig (rig_lumaw.py: 19 bones, the
// base unit, b_hover unkeyed). Her rig hangs at 1.35 m / her dial, so grown she still hangs at Luminel's height; low / top + culling from her
// metrics (glb units, body + eyes + lamp + aura over every clip). Her 'aura' = her lamp + her motif (Luminok's gold sunburst round her belly
// lamp, Lumilys's nimbus ring + two constellations, Lumivex's light trail off her tail, Elhae's roots of light out of her blazing core).
// M244 sheet 6 (sprites, 11-28): LUMINARC's four (Storm), same tools off the live Luminarc (docs/looks/m244-luminarc-2026-11-28): Luminthar's
// lightning forks under her, Lumicelle's ring of orbs, Arcet's two copies streaming behind (on b_hover), Lumiceth's belly + cloak-edge bolts
// (her cloak is body, on the hips). `el` picks the parent look (Luminel / Luminarc).
const lumAwakened = (name: string, aura: string, low: number, top: number, cull: Cull, el: 'mana' | 'storm' = 'mana'): SpiritLook => {
  const b = SECOND_FORMS.firefly![el]!, base = BASE_PREVIEW.firefly!, h = base.h * AWAKEN_GROW[name]
  return { ...b, name, url: `/open/spirits/${name}-rigged.glb`, h, trot: grownTrot(base.trot, base.h, h), rig: { ...b.rig!, glbLen: AWAKEN_LEN[name], hover: { ...b.rig!.hover!, low, top }, cull },
    glow: { part: 'aura', emissive: aura, lo: 0.35, hi: 0.7, hz: 0.35 } }
}
// M244 sheet 7 (sprites, 11-28): LUMINORE's four (Earth). Canon: the egg waits to BREAK OUT at the awakening, so each is what broke out:
// grounded like the egg (no hover, no culling of her own), but up on two legs with two arms (docs/looks/m244-luminore-2026-11-28: the
// live egg's sculpt re-shaped by name, sculpt_lumore.py, on the ground biped rig rig_lumore.py: 21 bones in the base unit, legs + arms, the
// hips carry her height, the root stays on the ground). Her 'aura' = her lamp + the broken shell lying at her feet (root) + her motif
// (Orebrak's shards + prism light, Lumoraya's rays, Lumorvex's mouth beam + flying shards, Lumorun's chest crack). clipV = metrics mps.
// M244 sheet 9 (sprites, 11-28): LUMINIX's four (Water), the same break-out off the live Luminix egg (docs/looks/m244-luminix-2026-11-28,
// sculpt_lumix.py + rig_lumix.py: + a 'ground' bone that folds the shell / wave away while she walks or runs, so it stays where she hatched).
const lumBroke = (name: string, aura: string, walk: number, run: number, el: 'earth' | 'water' = 'earth'): SpiritLook => {
  const b = SECOND_FORMS.firefly![el]!, base = BASE_PREVIEW.firefly!, h = base.h * AWAKEN_GROW[name]
  return { ...b, name, url: `/open/spirits/${name}-rigged.glb`, h, trot: grownTrot(base.trot, base.h, h), rig: { ...b.rig!, glbLen: AWAKEN_LEN[name], clipV: { walk: walk / LUMINARA_UNIT, run: run / LUMINARA_UNIT } },
    glow: { part: 'aura', emissive: aura, lo: 0.35, hi: 0.7, hz: 0.35 } }
}
// M244 sheet 8 (assets, 11-28): MYSTOWL's four (Mana), owl preview, OWLS like her (docs/looks/m244-mystowl-2026-11-28): the live Mystowl's
// sculpt re-shaped by name (sculpt_mystaw.py) on the live owl rig (rig_owl.py via rig_mystaw.py: 25 bones, six clips, the run is flight), in her
// number space, so each draws the base Athowl's glb scale x her dial. Her 'aura' = her motif: Mystowk's halo of gold rings, Mystowelle's ring of
// blank scrolls, Mystowis's gold mask, Mysteth's wing eyes + third eye + rays.
const owlAwakened = (name: string, aura: string): SpiritLook => {
  const b = SECOND_FORMS.owl!.mana!, base = SPIRIT_RIGS.owl!, h = base.h * AWAKEN_GROW[name]
  return { ...b, name, url: `/open/spirits/${name}-rigged.glb`, h, trot: grownTrot(base.trot, base.h, h), rig: { ...b.rig!, glbLen: AWAKEN_LEN[name] },
    glow: { part: 'aura', emissive: aura, lo: 0.35, hi: 0.7, hz: 0.35 } }
}
/** by look name (spirit.ts AWAKENED_NAMES, lower-cased) */
export const AWAKENED_FORMS: Readonly<Record<string, SpiritLook>> = {
  ...CROAK_AWAKENED,   // M244 sheet 9: Croakarc's four (above, by croakarc())
  ...CROAKARA_AWAKENED,   // M244 sheet 11: Croakara's four (above)
  ...CROAKORE_AWAKENED,   // M244 sheet 12: Croakore's four (above)
  vulnarok: awakened('vulnarok', AWAKEN_LEN.vulnarok, '#ffcf5a', 2.4),
  vulnalys: awakened('vulnalys', AWAKEN_LEN.vulnalys, '#b48cff', 1.7),
  vulnavex: awakened('vulnavex', AWAKEN_LEN.vulnavex, '#ffcf5a', 2.6),
  vulnamyr: awakened('vulnamyr', AWAKEN_LEN.vulnamyr, '#ffcf5a', 1.9),
  vulnarkor: awakened('vulnarkor', AWAKEN_LEN.vulnarkor, '#9fe6ff', 2.0, 'storm'),
  vulnarcelle: awakened('vulnarcelle', AWAKEN_LEN.vulnarcelle, '#9fe6ff', 1.8, 'storm'),
  arcvex: awakened('arcvex', AWAKEN_LEN.arcvex, '#cdeeff', 2.6, 'storm'),
  vulnarceth: awakened('vulnarceth', AWAKEN_LEN.vulnarceth, '#a8e4ff', 1.9, 'storm'),
  // M244 sheet 3 (assets, 11-28): VULNORE's four (Earth), owner preview, same tools + the 11-28 quality standard (art palette, Orethar's
  // projected gold blaze, baked ear / tail springs; docs/looks/m244-vulnore-2026-11-28). Orethar on the biped rig with her gold heart-gem
  // (aura), Vulnoraya's crystal-flower crown (aura, head), Vulnoris's two pale-gold copies that run, Vulnorun's tree crown (aura, back).
  orethar: awakened('orethar', AWAKEN_LEN.orethar, '#ffd24a', 2.0, 'earth'),
  vulnoraya: awakened('vulnoraya', AWAKEN_LEN.vulnoraya, '#c8f0b0', 1.8, 'earth'),
  vulnoris: awakened('vulnoris', AWAKEN_LEN.vulnoris, '#f6dc8c', 2.6, 'earth'),
  vulnorun: awakened('vulnorun', AWAKEN_LEN.vulnorun, '#7fcf5a', 1.9, 'earth'),
  // M244 sheet 4 (sprites, 11-28): VULNIX's four (Water), owner preview, the 11-28 quality standard (art palette, baked ear / tail springs;
  // docs/looks/m244-vulnix-2026-11-28): Vulnitar's splash ring + Vulnixeth's still pool on the ground ('cloud' bone), Marelle's hanging jester
  // ears + mist-trail tail, Vulnisk's two water copies that run (as Arcvex / Vulnoris)
  vulnitar: awakened('vulnitar', AWAKEN_LEN.vulnitar, '#9fe8ec', 2.0, 'water'),
  marelle: awakened('marelle', AWAKEN_LEN.marelle, '#c8f2f2', 1.8, 'water'),
  vulnisk: awakened('vulnisk', AWAKEN_LEN.vulnisk, '#bdf0f2', 2.6, 'water'),
  vulnixeth: awakened('vulnixeth', AWAKEN_LEN.vulnixeth, '#bff0f4', 1.9, 'water'),
  luminok: lumAwakened('luminok', '#ffc848', 1.791, 3.133, { c: [0, 2.27, -0.03], r: 1.35, min: [-0.77, 1.3, -0.75], max: [0.77, 3.25, 0.68] }),
  lumilys: lumAwakened('lumilys', '#ffd870', 1.781, 3.546, { c: [0, 2.53, 0.06], r: 1.51, min: [-0.84, 1.39, -0.67], max: [0.85, 3.67, 0.78] }),
  lumivex: lumAwakened('lumivex', '#ffd060', 2.096, 3.351, { c: [0, 2.69, -0.79], r: 1.76, min: [-0.76, 1.9, -2.26], max: [0.76, 3.48, 0.68] }),
  elhae: lumAwakened('elhae', '#fff0b0', 1.613, 3.139, { c: [-0.01, 2.15, 0.05], r: 1.5, min: [-0.89, 1.04, -0.66], max: [0.87, 3.26, 0.76] }),
  luminthar: lumAwakened('luminthar', '#cdeeff', 1.47, 3.286, { c: [0, 2.17, -0.15], r: 1.78, min: [-1.1, 0.94, -1.02], max: [1.1, 3.41, 0.72] }, 'storm'),
  lumicelle: lumAwakened('lumicelle', '#d4f0ff', 1.588, 3.356, { c: [0, 2.27, -0.04], r: 1.63, min: [-0.95, 1.06, -0.81], max: [0.95, 3.48, 0.72] }, 'storm'),
  arcet: lumAwakened('arcet', '#dcf2ff', 2.067, 3.471, { c: [-0.14, 2.64, -0.8], r: 1.94, min: [-1.06, 1.68, -2.32], max: [0.79, 3.59, 0.72] }, 'storm'),
  lumiceth: lumAwakened('lumiceth', '#c8ecff', 1.626, 3.253, { c: [0, 2.23, -0.11], r: 1.46, min: [-0.63, 1.09, -0.94], max: [0.63, 3.37, 0.72] }, 'storm'),
  orebrak: lumBroke('orebrak', '#ffc040', 0.301, 0.7195),
  lumoraya: lumBroke('lumoraya', '#ffe09a', 0.301, 0.7195),
  lumorvex: lumBroke('lumorvex', '#fff0a0', 0.3225, 0.7709),
  lumorun: lumBroke('lumorun', '#fff0c8', 0.301, 0.7195),
  lumixok: lumBroke('lumixok', '#9ef0f4', 0.3225, 0.7709, 'water'),
  marisse: lumBroke('marisse', '#d8fbff', 0.2795, 0.6681, 'water'),
  lumixis: lumBroke('lumixis', '#a8eef4', 0.3942, 0.9422, 'water'),
  lumixeth: lumBroke('lumixeth', '#c4c8f4', 0.2938, 0.7023, 'water'),
  mystowk: owlAwakened('mystowk', '#ffd870'),
  mystowelle: owlAwakened('mystowelle', '#f6e2a8'),
  mystowis: owlAwakened('mystowis', '#ffcc50'),
  mysteth: owlAwakened('mysteth', '#ffe08a'),
}
/** M202: her second form's look when she has evolved (`element` set) and her species has its forms modelled, else null */
export const formLook = (s: Species | null | undefined, el: SpiritElement | null | undefined): SpiritLook | null =>
  (s && el ? SECOND_FORMS[s]?.[el] ?? null : null)

/** The species' model, or null = the gold orb. */
export const spiritModelFor = (s: Species | null | undefined): SpiritLook | null => (s ? SPIRIT_MODELS[s] ?? null : null)

// ── GROUND KEEP (the grown-size slice): the trot tips her (pitch to sit / sniff, roll into a turn) round a pivot at her
// feet, so a far-out paw, tail or chin dips below the ground. At 0.15 m that dip was millimetres; grown it is centimetres
// (the Manalotl's turn-lean put a leg 7.6 cm into the ground). lowPoints() keeps the model's low vertices once (glb units,
// centred like the drawn group), and groundLift() returns how far to raise her this frame so the lowest stays on the
// ground. Pure maths (Euler YXZ, yaw does not move y): y' = (x sx sin r + y sy cos r) cos p - z sx sin p.
/** The vertices that can touch the ground under a tip (y below `below` glb units), centred on cx / cz, flat [x,y,z,...],

 *  thinned to at most `max` points (default: none; thinning drops the extreme tips the guard needs, a few thousand
 *  points a frame is cheap). */
export function lowPoints(pos: ArrayLike<number>, cx: number, cz: number, below = 0.5, max = Infinity): Float32Array {
  const keep: number[] = []
  for (let i = 0; i + 2 < pos.length; i += 3) if (pos[i + 1] < below) keep.push(pos[i] - cx, pos[i + 1], pos[i + 2] - cz)
  const n = keep.length / 3, step = Math.max(1, Math.ceil(n / max)), out: number[] = []
  for (let i = 0; i < n; i += step) out.push(keep[i * 3], keep[i * 3 + 1], keep[i * 3 + 2])
  return new Float32Array(out)
}
/** Metres to raise a model of height h (glb 1 unit tall) tipped by pitch / roll and scaled sx / sy, so no low point sinks. */
export function groundLift(pts: ArrayLike<number>, h: number, pitch: number, roll: number, sx = 1, sy = 1): number {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll)
  let lo = 0
  for (let i = 0; i + 2 < pts.length; i += 3) {
    const y = (pts[i] * sx * sr + pts[i + 1] * sy * cr) * cp - pts[i + 2] * sx * sp
    if (y < lo) lo = y
  }
  return -lo * h
}
