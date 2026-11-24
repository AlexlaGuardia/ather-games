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
}

// ── M132 s2 THE RIGGED MANALOTL (OWNER-ONLY, spirit-model.tsx useSpiritRig; Alex 11-24 OK'd the v2 look and the size: 0.90 m
// nose to tail, canon's own figure). Her tail is out behind now (it was curled round her side), so 0.90 m long makes her ~0.39 m
// tall standing (0.42 to the frill tops), near canon's 0.35; the unrigged model at 0.90 was 0.70. Same manner, look and tints.
export const MANALOTL_RIG: RigLook = {
  glbLen: 2.145, pivot: { x: 0.07, z: 0 },
  clipV: { walk: 0.42 / (0.9 / MANALOTL_GLB_LEN), run: 0.62 / (0.9 / MANALOTL_GLB_LEN) },   // built at the unrigged height: 0.42 / 0.62 m/s there
  runAt: [0.5, 0.44], hull: 0.026, neck: 'b_neck', head: 'b_head',
}
const RIG_H = GROWN.axolotl.length! / MANALOTL_RIG.glbLen
export const SPIRIT_RIGS: Partial<Record<Species, SpiritLook>> = {
  axolotl: {
    ...SPIRIT_MODELS.axolotl!, url: '/open/spirits/manalotl-rigged.glb', h: RIG_H, rig: MANALOTL_RIG, tilt: undefined,
    // her manner unchanged; she ambles on her legs, so the hop, the squash and the turn-lean are 0. The bound over a training
    // piece is the piece's height, not hers, so it stays what it was.
    trot: { ...grownTrot(MANALOTL_TROT, TUNED_H.axolotl, RIG_H, true), playH: SPIRIT_MODELS.axolotl!.trot.playH, hopH: 0, stretch: 0, squash: 0, lean: 0, planted: 1 },
  },
}
/** the look to draw: the rigged one where there is one and `on` */
export const rigLook = (sp: Species, look: SpiritLook, on: boolean): SpiritLook => (on ? SPIRIT_RIGS[sp] ?? look : look)

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
