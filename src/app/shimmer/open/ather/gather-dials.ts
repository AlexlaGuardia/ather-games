// EVERY DIAL OF GATHERING (BETA M136, Alex 11-24: mana per second). Pure. The node sets the DRAIN, the focus sets the TIME.
//   A focus has a RUNG (focuses.ts › rungOf): worn = 1, the first crafted tier = 1 too (it only pays more XP), then 2, then 3.
//   Rung >= need: the node's own `mana` (a better focus than needed: ×BETTER per rung over, so quicker, never dearer).
//   One rung low: low[0]. Two low: low[1], more than the pool + all the regen of one cycle, so regen alone never finishes it.
// ★ THE RESET TIMER RUNS FROM THE FIRST TOUCH (channel.ts). Trees carry canon's prune cooldowns (shimmer-skilling.md › Node
//   Respawn: 3 / 8 / 15 / 30 min, the ones M136's numbers were agreed on). world/resources.ts' shorter 2 / 5 / 9 / 15 are the
//   voxel world's. At 9 min a Starwillow one rung low (300) could not be finished on the pool + regen (~296).
// Crystals mirror the trees; canon's respawns 2 / 10 / 20 / 45 min. Ather's two-low is higher because its cycle is longer.
import { ECON } from '../shared/vitals-economy'

export interface GatherDial { need: 1 | 2 | 3; drain: number; mana: number; low: readonly [number, number]; respawnMs: number }
const min = (m: number) => m * 60_000
export const TREE_DIAL = {
  goldwood:   { need: 1, drain: 2,  mana: 5,  low: [300, 900], respawnMs: min(3) },
  shimmeroak: { need: 1, drain: 3,  mana: 10, low: [300, 900], respawnMs: min(8) },
  starwillow: { need: 2, drain: 8,  mana: 20, low: [300, 900], respawnMs: min(15) },
  dawnwood:   { need: 3, drain: 10, mana: 30, low: [300, 900], respawnMs: min(30) },
} as const satisfies Record<string, GatherDial>
/** by crystal tier: [0] unused · raw · the elements (+ the hidden one) · pure · ather */
export const CRYSTAL_DIAL: readonly GatherDial[] = [
  { need: 1, drain: 2,  mana: 7,  low: [300, 900],  respawnMs: 0 },
  { need: 1, drain: 2,  mana: 7,  low: [300, 900],  respawnMs: min(2) },
  { need: 1, drain: 3,  mana: 12, low: [300, 900],  respawnMs: min(10) },
  { need: 2, drain: 8,  mana: 24, low: [300, 900],  respawnMs: min(20) },
  { need: 3, drain: 10, mana: 36, low: [300, 1400], respawnMs: min(45) },
]
export const BETTER = 0.85
/** stay this close (m) to the node or it lets go: a little past the reach that started it */
export const HOLD_RANGE = 13
/** the beat of the light and the knock while a node is worked (ms between pulses, after each lands) */
export const PULSE_GAP_MS = 350

/** the whole mana this node takes with a focus of `rung` */
export const manaNeed = (d: GatherDial, rung: number): number => {
  const short = d.need - rung
  return short <= 0 ? d.mana * Math.pow(BETTER, -short) : d.low[Math.min(short, 2) - 1]
}
/** seconds of channelling for the whole node */
export const gatherSecs = (d: GatherDial, rung: number) => manaNeed(d, rung) / d.drain
/** the most mana a keeper can put in over one cycle on a full bar and regen alone (pauses ignored, so it is an upper bound) */
export const cycleBudget = (d: GatherDial, pool = 100) => pool + ECON.manaRegen * (d.respawnMs / 1000)
