// THE MOONWELL WATER in the Wilds (BETA M22). Canon (11-18 amend, rework §3): Moonwell Glade is the Wilds' FRONT DOOR,
// where the keeper arrives at Greg's waymark; the Glade is a glowing pool among grown structures (glossary › Moonwell Glade).
// The Glade itself isn't built yet: this is its FIRST PIECE, the pool, placed beside the arrival waymark so the first
// rinstick quest (rinquest.ts) has its water. ★ ONE CONSTANT: whoever builds the Glade moves MOONWELL and everything that
// reads it (the pool, the wait, the scale on the bank, the journal beacon) follows. World coords (first-wilds is tile 0,0).
import { GREG_WAYMARK } from './waymarks'

export const MOONWELL = { x: GREG_WAYMARK.x - 10, z: GREG_WAYMARK.z - 7, r: 3.2 }
/** how close counts as 'at the water' for the dusk wait (from the pool's centre) */
export const AT_WATER = MOONWELL.r + 2.6
/** where the rinn leaves the scale: on the bank, on the side toward the waymark (where the keeper sits) */
export const SCALE_AT = (() => {
  const dx = GREG_WAYMARK.x - MOONWELL.x, dz = GREG_WAYMARK.z - MOONWELL.z, d = Math.hypot(dx, dz) || 1
  return { x: MOONWELL.x + (dx / d) * (MOONWELL.r + 0.7), z: MOONWELL.z + (dz / d) * (MOONWELL.r + 0.7) }
})()
export const SCALE_REACH = 1.6
