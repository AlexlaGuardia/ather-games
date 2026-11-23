// M102 (sprites, 2026-11-23): THE SPIRIT MODEL REGISTRY, PER SPECIES. Alex 11-23 OK'd the Manalotl look ("the manalotl
// looks good"), so the "Vulnyx stands in for all" rule ends: a bloomed planter shows ITS OWN species' model when one is
// listed here and the gold orb otherwise. Still owner-only behind ?spirits=3d (spirit-model.tsx owns the gate).
//
// ★ PURE data (no three, no React). Each entry: the glb, its world height (the glb is 1 unit tall), the look (toon skin
// emissive, the translucent hull, an optional glowing PART with a slow pulse), the shader sway rules (which way the tail
// runs, which way it swings), an optional head tilt (a vertex bend round a pivot, weighted by how far forward a vertex
// sits), and the trot dials (spirit-trot.ts TROT, overridden per species).
// Manner = the temperament column of world/spirits-species.md (canon: "the temperament column ... IS the behaviour spec"):
//  · Vulnyx  "Clever, quick, light on feet ... trickster energy": darting legs, snappy glances, mostly alert look-rounds.
//  · Manalotl "Aquatic, regenerative, feathery gills that pulse with mana light. Eternal smile, wide eyes, head tilt" and
//    heel-high, "flows along the ground" (~0.15 m): a slow, curious, low amble, long looks, head tilts, lies down.
import type { Species } from '../../spirits/spirit'
import type { TrotDials } from './spirit-trot'

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
}

export const SPIRIT_MODELS: Partial<Record<Species, SpiritLook>> = {
  // Vulnyx as shipped in M102/M107: 0.55 m, gold; tail out along +x, swings in z; ear flick; trot = TROT's defaults.
  fox: {
    name: 'vulnyx', url: '/open/spirits/vulnyx.glb', h: 0.55,
    skin: { emissive: '#ffd24a', emissiveI: 0.18 }, hull: { color: '#fff0b8', opacity: 0.38 },
    sway: { along: 'x', sign: 1, from: 0.25, to: 0.62, dir: 'z', amp: 0.07, ampRun: 0.05, hz: 1.7, hzRun: 6.3, lag: 0.06 },
    ears: true,
    trot: { toyLean: { agi: 1.5 } },   // M110 s1: clever, quick, light on her feet: the AGI pieces draw her a little more
  },
  // Manalotl (look proof 5baffc0c): faces +z (eyes at z 0.58..0.65), head + frills z > 0.1, tail runs back along -z.
  // Tints = the proof render: rose emissive floor, pale-rose hull, frills rose-glow pulsing slowly; the gold rim is shared.
  axolotl: {
    name: 'manalotl', url: '/open/spirits/manalotl.glb', h: 0.15,
    skin: { emissive: '#ff9fb2', emissiveI: 0.18 }, hull: { color: '#ffe0e6', opacity: 0.38 },
    glow: { part: 'frills', emissive: '#ff6f9c', lo: 0.55, hi: 1.25, hz: 0.22 },
    sway: { along: 'z', sign: -1, from: 0.15, to: 0.64, dir: 'x', amp: 0.08, ampRun: 0.06, hz: 0.9, hzRun: 2.6, lag: 0.03 },
    // the head (z > ~0.1, frills and eyes with it) rolls round the neck at x 0.1 (the head's own centre), y 0.35
    tilt: { from: -0.05, to: 0.2, px: 0.1, py: 0.35, max: 0.38 },
    trot: {
      speed: 0.42, dash: 0.62,            // a slow amble (the Vulnyx runs 1.15 / darts 1.7)
      stride: 0.12, hopH: 0.012, stretch: 0.025, squash: 0.05, squashK: 10,   // she flows, barely a hop
      lean: 0.04, leanMax: 0.12, turnK: 3.5,
      hopArc: 0.62, hopArcH: 0.16, sitY: 0.93, sitPitch: -0.08, sniffPitch: 0.14,   // "sit" = lies along the ground
      chain: 0.85, checkS: [0.8, 1.6],
      playV: 0.5, playH: 0.06,           // M110 s1: she flows across a training piece, a low bound
      beat: { look: 0.36, sniff: 0.14, sit: 0.14, tilt: 0.36 },
      lookS: [2.2, 3.6], sniffS: [1.4, 2.4], sitS: [2.6, 4.2], tiltS: [1.8, 3.0],
      glance: 0.6, glanceHold: [0.9, 1.6], glanceMax: 0.6, tiltK: 3, lookTilt: 0.55,
      happyHops: 3, happyHop: 0.45, happyH: 0.035, happyWig: 0.1,   // M109 s2 fed: three soft bobs, not bounces (she flows)
    },
  },
}

/** The species' model, or null = the gold orb. */
export const spiritModelFor = (s: Species | null | undefined): SpiritLook | null => (s ? SPIRIT_MODELS[s] ?? null : null)
