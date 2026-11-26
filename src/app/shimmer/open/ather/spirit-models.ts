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
export const FORM_GROW_BY: Readonly<Record<string, number>> = { vulnore: 1.4, vulnara: 1.4, vulnarc: 1.4, vulnix: 1.4, marlotl: 1.4, cragbear: 1.4, aurlotl: 1.4, arclotl: 1.4, craglotl: 1.4 }
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
// arcing feather plumes, gold runes, a tail stub), Arclotl (Storm: round barrel, saw-tooth gill spikes with forked tendrils, a flat
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
export const SECOND_FORMS: Partial<Record<Species, Partial<Record<SpiritElement, SpiritLook>>>> = {
  axolotl: {
    water: marlotl(),
    mana: lotlForm('mana', 'aurlotl', '#b49cff', '#e8dcff', AURLOTL_RIG),
    storm: lotlForm('storm', 'arclotl', '#a8d2ff', '#dcecff', ARCLOTL_RIG),
    earth: lotlForm('earth', 'craglotl', '#ffae4a', '#ffe2b4', CRAGLOTL_RIG),
  },
  'water-bear': { earth: cragbear() },
  fox: {
    mana: secondForm('fox', 'mana', 'vulnara', '#b49cff', '#e8dcff'),
    storm: secondForm('fox', 'storm', 'vulnarc', '#a8d2ff', '#dcecff'),
    earth: secondForm('fox', 'earth', 'vulnore', '#ffae4a', '#ffe2b4'),
    water: secondForm('fox', 'water', 'vulnix', '#2fb4c4', '#9fe4ec'),
  },
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
