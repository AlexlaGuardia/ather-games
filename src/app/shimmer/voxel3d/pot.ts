// The pot — where a Mana Seed becomes a spirit.
//
// ★ PURE. No react/three/DOM: the host owns the voxels, the clock and the party; this file owns the
// rules. (It lives in voxel3d rather than voxel/ because it imports the spirits engine.)
//
// ── ★ THE MATERIAL IS THE STATE ────────────────────────────────────────────────────────────────
// POT → POT_SEEDED → POT_BLOOM are three materials, not one block with a growth record. The save is
// a material diff, so a planted pot survives a reload, an evict, and a walk to the Outfields with no
// new persistence layer — the same property that made ground cover and slabs cheap.
//
// The ONE thing a material cannot hold is WHEN it was planted, so that is the only thing stored
// beside the player save. Everything else is derived. A pot whose timestamp is missing (a save
// carried across a wipe, a hand-edited world) is treated as planted NOW rather than never: a
// keeper who loses a few minutes is annoyed, a keeper whose seed never blooms has lost the rarest
// drop in the game with no way to know why.

import { MAT } from '../voxel/depth'
import { rollBloomSpecies } from '../engine/farming'
import { createSpirit, type Spirit } from '../spirits/spirit'

/** How long a seed takes to bloom. Long enough to be a thing you come back to, short enough that a
 *  session can contain it — a seed you plant and never see open is a seed that did not pay out. */
export const BLOOM_MS = 4 * 60_000

/** Planting times by world position, `"x,y,z"` → epoch ms. Persisted beside the player save. */
export type PotClock = Record<string, number>

export const potKey = (x: number, y: number, z: number): string => `${x},${y},${z}`

/** Is this pot ready to open? A missing stamp reads as "just planted" — see the header. */
export function isReady(clock: PotClock, x: number, y: number, z: number, now: number): boolean {
  const at = clock[potKey(x, y, z)]
  return at !== undefined && now - at >= BLOOM_MS
}

/** 0..1 toward blooming. For a HUD hint; never gates the bloom itself. */
export function progress(clock: PotClock, x: number, y: number, z: number, now: number): number {
  const at = clock[potKey(x, y, z)]
  if (at === undefined) return 0
  const t = (now - at) / BLOOM_MS
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/**
 * What a bloomed pot pays out.
 *
 * ★ THE SPIRIT CHOOSES, AND THAT RUNS ALL THE WAY DOWN. `rollBloomSpecies` is flat across all ten
 * species by canon (engine/farming.ts says why), so there is no prompt and no pick here — only an
 * announcement. Weighting it, or letting the player choose, contradicts the world rather than
 * tuning it. `rng` is injectable so a test can pin the species.
 */
export function bloom(rng: () => number = Math.random): Spirit {
  const s = createSpirit(rollBloomSpecies(rng), '', 0, 0)
  // Matches play3d's own bloom: a young spirit, decently rolled, already fond of you. A keeper's
  // first spirit arriving weaker than a wild one would read as a punishment for the rarest drop.
  s.level = 5
  s.bond = 40
  s.happiness = 160
  return s
}

/** Sweep the clock for pots that have come due. Returns the positions to flip to POT_BLOOM. */
export function due(clock: PotClock, now: number): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = []
  for (const k of Object.keys(clock)) {
    if (now - clock[k] < BLOOM_MS) continue
    const [x, y, z] = k.split(',').map(Number)
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) out.push({ x, y, z })
  }
  return out
}

/** The three states, for callers that would otherwise re-derive the set. */
export const POT_STATES = [MAT.POT, MAT.POT_SEEDED, MAT.POT_BLOOM] as const
