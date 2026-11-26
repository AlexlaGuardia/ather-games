// ── THE TUTORIAL '!' (BETA M212, Alex 11-26: 'a 3d "!" over the quest targets head to kind of guide the player during the
// tutorial') ─ PURE. The First Steps line (ather/first-steps.ts) points at the CURRENT step's target in each zone (Greg, the tour
// stop, the gate; in the Wilds the stone / the settlement / the big one). The '!' stands over the one in THIS zone: one at a time,
// it moves when the step does (the entry is re-posted), and it is gone with the line once First Steps is done.
// It sits WITH M63's compass glare + trail (quest-guide.tsx draws both), never instead of them.
import { FIRST_STEPS_ID } from '../ather/first-steps'
import type { JournalEntry, Zone } from './journal'

/** metres over the target's ground: clears Greg's head (~1.8 m) and a friend's */
export const BANG_Y = 2.75
/** the '!' grows with distance so it still reads across the Glade: scale 1 within ~14 m, up to BANG_MAX_SCALE */
export const BANG_NEAR = 14, BANG_MAX_SCALE = 3
export const bangScale = (dist: number) => Math.min(BANG_MAX_SCALE, Math.max(1, dist / BANG_NEAR))

export function bangSpot(entries: readonly JournalEntry[], zone: Zone): { x: number; z: number } | null {
  const e = entries.find(x => x.id === FIRST_STEPS_ID && !x.struck)
  if (!e) return null
  const at = [...(e.where ? [e.where] : []), ...(e.also ?? [])].find(w => w.zone === zone)
  return at ? { x: at.x, z: at.z } : null
}
