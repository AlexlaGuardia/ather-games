// The garden's ZONES — the blessed layout as pure fields. (Worldgen v2, 2026-08-08.)
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ★ ANCHORED, NOT NOISE-PLACED, and that is the whole point of this file. The generic biomes
// (woodland/meadow/greyfield) are noise — places that could be anywhere. These are the RULED
// places of the garden loop (CANON/game/shimmer-geography.md, zone IDs stable), and canon cares
// which neighbours which: noise would scatter three Mana Springs and put the Thicket against the
// Outfields. So each zone is an ANCHOR (position + extent, from the layout Alex blessed
// 2026-08-07 — scripts/zone-sketch.mts renders it) with a membership field around it: 1 at the
// heart, easing to 0 through a warped edge band, so borders wander like everything else here.
//
// ★ ZONE CHARACTER OBEYS THE SIBLING LAW. A zone does not "set the height" (the pre-1.18 seam
// mistake); it exposes a membership value, and height/biome/trees each read that SAME value to
// blend their own behaviour. Alex's characters: Spirit Meadows = rolling hills + sparse lone
// trees · Twilight Thicket = dense closed forest · Mana Springs = hot-spring terraces. The
// settlement zones (Home, Moonwell, Mycelial, Gloview, Outfields) just calm the terrain.
//
// ★ THE ZONES ARE TENDED. Canon: colour is the tended state; the greying takes the FRAYED EDGES.
// So zone membership SUPPRESSES the grey band, and a rim ramp (distance from the heart) boosts
// it — greyfields, ruins and the night's Hollows thicken toward the world's edge and starve near
// home. Difficulty becomes geography, which is the campaign's own shape.

import { value2 } from './noise'

export interface ZoneAnchor {
  /** Canon zone id — matches shimmer-geography.md. */
  id: 'garden' | 'moonwell-glade' | 'mycelial-path' | 'spirit-meadow' | 'twilight-thicket'
    | 'mana-springs' | 'gloview-village' | 'the-outfields'
  x: number; z: number
  rx: number; rz: number
  /** Terrain character, blended by membership: relief multiplier, bench multiplier, and a gentle
   *  long-wave swell of this amplitude (the rolling in "rolling hills"). */
  reliefK: number
  benchK: number
  swellAmp: number
  /** How hard membership suppresses the grey band. 1 = fully tended. */
  tended: number
  /** Target woodland mask at full membership (biome.ts blends toward it). Thicket ≈ 1 = the
   *  closed canopy that IS its character; meadows near 0 = sparse lone trees. */
  forest: number
}

/** The blessed layout, verbatim from zone-sketch v2. Positions/extents are build — dial freely. */
export const ZONE_ANCHORS: ZoneAnchor[] = [
  { id: 'garden', x: 0, z: 0, rx: 380, rz: 340, reliefK: 0.25, benchK: 1, swellAmp: 0, tended: 1, forest: 0.15 },
  { id: 'moonwell-glade', x: -150, z: -640, rx: 340, rz: 300, reliefK: 0.2, benchK: 1, swellAmp: 0, tended: 1, forest: 0.35 },
  { id: 'mycelial-path', x: -1250, z: -120, rx: 620, rz: 260, reliefK: 0.35, benchK: 1, swellAmp: 0, tended: 1, forest: 0.5 },
  // Rolling hills: ridges and benches OFF, a long-wave swell ON — hills you walk over, not into.
  { id: 'spirit-meadow', x: -2150, z: 700, rx: 950, rz: 780, reliefK: 0.1, benchK: 0, swellAmp: 7, tended: 1, forest: 0.06 },
  // Dense forest keeps mild terrain — the CANOPY is the character, not the ground.
  { id: 'twilight-thicket', x: -2000, z: -1150, rx: 800, rz: 650, reliefK: 0.4, benchK: 0.5, swellAmp: 2, tended: 1, forest: 0.97 },
  // Hot springs: benches HARD ON (the terraces the pools will sit in), modest relief.
  { id: 'mana-springs', x: 2100, z: -300, rx: 900, rz: 750, reliefK: 0.3, benchK: 1.6, swellAmp: 0, tended: 1, forest: 0.22 },
  { id: 'gloview-village', x: 3450, z: -1500, rx: 520, rz: 430, reliefK: 0.25, benchK: 1, swellAmp: 0, tended: 1, forest: 0.12 },
  // The Outfields are the frayed edge: still garden, but the grey is allowed to gutter in.
  { id: 'the-outfields', x: 3700, z: 1000, rx: 900, rz: 750, reliefK: 0.5, benchK: 1, swellAmp: 3, tended: 0.45, forest: 0.3 },
]

/** Membership fades from 1 inside to 0 outside across this band of normalised distance. */
const EDGE_BAND = 0.35
/** Border wander, in normalised-distance units — zone edges are coastlines, not compass circles. */
const EDGE_WARP = 0.16

const sm = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c) }

export interface ZoneAt {
  zone: ZoneAnchor | null
  /** Membership 0..1 of the strongest zone. 0 = wild country. */
  t: number
}

/**
 * The strongest zone at (x, z) and how deep inside it this point is. Pure; costs one warp sample
 * plus an ellipse distance per anchor (8) — cheap enough for height to call per column.
 */
export function zoneAt(x: number, z: number, seed: number): ZoneAt {
  const wob = (value2(x / 260, z / 260, seed ^ 0x20e5) - 0.5) * 2 * EDGE_WARP
  let best: ZoneAnchor | null = null
  let bestT = 0
  for (const a of ZONE_ANCHORS) {
    const dx = (x - a.x) / a.rx, dz = (z - a.z) / a.rz
    const d = Math.sqrt(dx * dx + dz * dz) + wob
    const t = sm((1 + EDGE_BAND - d) / EDGE_BAND)
    if (t > bestT) { bestT = t; best = a }
  }
  return { zone: bestT > 0 ? best : null, t: bestT }
}

/**
 * ── The greying rim ────────────────────────────────────────────────────────────────────────────
 * A multiplier on the grey band's strength: ~0.15 at the tended heart, 1 in ordinary wild
 * country, rising past 1 toward the world's frayed edge — and inside a zone, suppressed by its
 * tendedness. biome.ts multiplies its richness-band greyness by this, so ruins and Hollows (which
 * read greyness) follow for free: distance from home IS the difficulty axis.
 */
export const RIM_CENTER_X = 800
export const RIM_START = 2600     // where wild-country grey begins strengthening
export const RIM_FULL = 5200      // the deep rim

export function greyAllowance(x: number, z: number, seed: number): number {
  const d = Math.hypot(x - RIM_CENTER_X, z)
  const rim = 0.55 + 0.95 * sm((d - RIM_START) / (RIM_FULL - RIM_START))   // 0.55 inland → 1.5 at rim
  const { zone, t } = zoneAt(x, z, seed)
  const tended = zone ? zone.tended : 0
  return rim * (1 - t * tended)
}
