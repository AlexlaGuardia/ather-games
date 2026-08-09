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
  /**
   * ── ★ THE MOUNTAIN AXIS (2026-08-08, the Springs rework) ──────────────────────────────────────
   * Voxels of elevation ADDED at the zone's heart, falling to 0 at the ellipse edge along a peaked
   * profile (height.ts shapes it; membership then blends the whole thing into wild country, so the
   * massif grows out of the countryside with no seam). This is NOT the pre-1.18 per-biome base
   * height — it rides the SAME membership field every other zone character rides, blended not
   * stepped, and biome still never feeds height. Applied BEFORE benching, which is the whole trick:
   * benching a lifted base turns the mountainside into terraces for free, and the steeper the
   * flank, the tighter the terrace stack — the Pamukkale shape, from two mechanisms already here.
   */
  lift: number
  /** How hard membership suppresses the grey band. 1 = fully tended. */
  tended: number
  /** Target woodland mask at full membership (biome.ts blends toward it). Thicket ≈ 1 = the
   *  closed canopy that IS its character; meadows near 0 = sparse lone trees. */
  forest: number
  /**
   * How readily this zone's mana pools into MIST PATCHES (mist.ts) — a per-cell rarity chance,
   * 0 = never. Zone character again, not a placement table: mist.ts rolls against this, the same
   * way biome reads `forest` and the grey band reads `tended`. A village is 0 because a village is
   * somewhere people live, not somewhere the garden's mana is left to gather.
   *
   * ⚠ THESE ARE SWEEP-TUNED, AND THEY ARE NOT COMPARABLE TO EACH OTHER. `scripts/mist-sweep.mts`
   * measured wildly different filter survival by terrain character — the Thicket's mild floor
   * offers a level dell 57% of the time, the Meadows' rolling hills 8%, the Springs' terraces 11%.
   * So the chance that lands ~3 patches in the Thicket is a fifth of the one that lands ~3 in the
   * Meadows, and reading these as "the Thicket is less misty" is exactly backwards. They are the
   * correction for terrain, not a statement about the zone. Re-sweep after any terrain change.
   */
  mist: number
}

/** The blessed layout, verbatim from zone-sketch v2. Positions/extents are build — dial freely. */
export const ZONE_ANCHORS: ZoneAnchor[] = [
  // ⚠ Home and Moonwell are at chance 1.0 and STILL generate none — measured, not assumed
  // (mist-sweep: 8 and 7 candidate cells, ~6 in the interior each, every one refused by the pad or
  // dell test). They are small zones with calm terrain, and calm terrain has no troughs. Do NOT
  // relax the filters to force one here: that would thin the dell rule everywhere to buy one patch
  // in one place. If a guaranteed patch at home is wanted it belongs AUTHORED, the way the story
  // path and the holds are — the garden is where hand-placed content lives, not rolled content.
  { id: 'garden', x: 0, z: 0, rx: 380, rz: 340, reliefK: 0.25, benchK: 1, swellAmp: 0, tended: 1, forest: 0.15, lift: 0, mist: 1 },
  { id: 'moonwell-glade', x: -150, z: -640, rx: 340, rz: 300, reliefK: 0.2, benchK: 1, swellAmp: 0, tended: 1, forest: 0.35, lift: 0, mist: 1 },
  { id: 'mycelial-path', x: -1250, z: -120, rx: 620, rz: 260, reliefK: 0.35, benchK: 1, swellAmp: 0, tended: 1, forest: 0.5, lift: 0, mist: 0.6 },
  // Rolling hills: ridges and benches OFF, a long-wave swell ON — hills you walk over, not into.
  { id: 'spirit-meadow', x: -2150, z: 700, rx: 950, rz: 780, reliefK: 0.1, benchK: 0, swellAmp: 7, tended: 1, forest: 0.06, lift: 0, mist: 0.25 },
  // Dense forest keeps mild terrain — the CANOPY is the character, not the ground.
  { id: 'twilight-thicket', x: -2000, z: -1150, rx: 800, rz: 650, reliefK: 0.4, benchK: 0.5, swellAmp: 2, tended: 1, forest: 0.97, lift: 0, mist: 0.45 },
  // ★ THE HOT-SPRING MOUNTAIN (reworked 2026-08-08 from "benches HARD ON, modest relief"): lift
  // raises a terraced massif, benchK 2 saturates the bench blend so every flank IS terraces
  // (1.6 left the plains-field's low end only 60% benched — sloped steps no pool could sit on),
  // and reliefK 0 kills ridge noise for the same reason: a pool's rim must be LEVEL, and the
  // zone's drama now comes from the massif itself, not from ridges fighting the terraces.
  { id: 'mana-springs', x: 2100, z: -300, rx: 900, rz: 750, reliefK: 0, benchK: 2, swellAmp: 0, tended: 1, forest: 0.22, lift: 64, mist: 0.6 },
  // ★ Re-dialed 2026-08-08 (Alex's story-spine ruling, see voxel/story-path.ts): the village is
  // the SECOND story POI, ~500 blocks up the road from Moonwell Glade — the three Moglins' test.
  // Was parked at (3450,-1500) from the original sketch; radius shrunk to a village, not a region.
  { id: 'gloview-village', x: -265, z: -1125, rx: 260, rz: 220, reliefK: 0.25, benchK: 1, swellAmp: 0, tended: 1, forest: 0.12, lift: 0, mist: 0 },
  // The Outfields are the frayed edge: still garden, but the grey is allowed to gutter in.
  { id: 'the-outfields', x: 3700, z: 1000, rx: 900, rz: 750, reliefK: 0.5, benchK: 1, swellAmp: 3, tended: 0.45, forest: 0.3, lift: 0, mist: 0.55 },
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
  /** The winning zone's wobbled ellipse distance: 0 at the heart, 1 at the ellipse edge, larger
   *  outside. height.ts shapes the lift profile from it — membership alone saturates at 1 across
   *  the whole interior, which can only build mesas, never peaks. Meaningless when zone is null. */
  d: number
}

/**
 * The strongest zone at (x, z) and how deep inside it this point is. Pure; costs one warp sample
 * plus an ellipse distance per anchor (8) — cheap enough for height to call per column.
 */
export function zoneAt(x: number, z: number, seed: number): ZoneAt {
  const wob = (value2(x / 260, z / 260, seed ^ 0x20e5) - 0.5) * 2 * EDGE_WARP
  let best: ZoneAnchor | null = null
  let bestT = 0
  let bestD = Infinity
  for (const a of ZONE_ANCHORS) {
    const dx = (x - a.x) / a.rx, dz = (z - a.z) / a.rz
    const d = Math.sqrt(dx * dx + dz * dz) + wob
    const t = sm((1 + EDGE_BAND - d) / EDGE_BAND)
    // Interior ties (several zones at t=1 cannot overlap in the blessed layout, but the guard is
    // cheap): the NEARER heart wins, so d is always the winner's own distance.
    if (t > bestT || (t === bestT && t > 0 && d < bestD)) { bestT = t; best = a; bestD = d }
  }
  return { zone: bestT > 0 ? best : null, t: bestT, d: bestD }
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
