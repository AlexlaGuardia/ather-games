// ── BETA M181: A NEWBORN'S FOLD MAP SHOWS A DOOR ONLY ONCE IT IS UNLOCKED ──────────────────────────────────────────────────
// Alex 11-25: 'a newborn map is missing the garden and the runehold gates until the progress and unlock each in the begining
// of the game'. The garden stop already waits for Greg's fold (M156: FoldMap hasPlot = gardenOpen; old saves read folded).
// Rune Hold's door waits for the first moment the game itself sends the keeper there. No new rule: these are today's moments.
//   · the first errand (BETA M32 trail): Greg has handed the gems, so the runesmith / temple step runs through Rune Hold
//     (stage 'smith' | 'temple'), or the errand is done ('done': the bracelet has its word, or an old save without one).
//   · the opening chain (BETA M73): The Dig has started (step past 'invite'), or the keeper is `past` every beat (old save,
//     Kael's chest already open).
//   · the keeper already holds a city door (visited a city on the continent): they crossed at Rune Hold to get there.
// While First Steps is on (M146) the page's errand stage reads 'none' and the chain cannot leave 'invite', so a newborn's map
// is the Glade + the Wilds (+ Greg's waymark) until then. PURE: the page passes what it already holds.

import type { Stage } from '../business/errand'
import type { Chain } from '../shared/opening-chain'
import type { Pitstop } from '../continent/pitstops'

export function runeHoldOpen(o: { errand: Stage; chain: Pick<Chain, 'step' | 'past'>; cityDoors: number }): boolean {
  if (o.errand === 'smith' || o.errand === 'temple' || o.errand === 'done') return true
  if (o.chain.past || o.chain.step !== 'invite') return true
  return o.cityDoors > 0
}

/** The doors the fold map's Athernyx side lists: every unlocked pitstop once Rune Hold is open, none before. */
export const mapDoors = (pitstops: readonly Pitstop[], open: boolean): Pitstop[] => open ? [...pitstops] : []
