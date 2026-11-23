// P1 (Alex 11-23: 'i asked a few moglins to join my garden but im not seeing them here'): a recruit was DRAWN only while it
// works a raised room (workshop.tsx › MoglinsAtWork) or, an alchemist, stands at its Desk; one with no room was drawn nowhere.
// The rest of the village now waits in the garden: a loose arc in front of the planning table, facing it (where the keeper
// will give them a room). Pure: who is idle, and where each idle one stands.
import { TABLE, raised, type Works } from './rooms'
import { standAt } from './alchemist-boon'
import type { MoglinRecord } from './moglins'

/** Drawn at work (the same test MoglinsAtWork draws by): an alchemist at its Desk, or anyone keeping a raised room. */
export function atWork(m: MoglinRecord, w: Works, now = Date.now()): boolean {
  if (m.profession === 'alchemist' && standAt(w, m)) return true
  const r = m.room ? w.rooms.find(x => x.id === m.room) : undefined
  return !!r && raised(r, now)
}
export const idleOf = (ms: readonly MoglinRecord[], w: Works, now = Date.now()) => ms.filter(m => !atWork(m, w, now))

/** How far out the arc stands from the table, and the spread between two Moglins along it (radians). */
export const IDLE_R = 3.4, IDLE_STEP = 0.55
/** The k-th of n idle Moglins: on an arc round the table's front (+z), centred, each turned to face the table. */
export function idleSpot(k: number, n: number): { x: number; z: number; yaw: number } {
  const a = (k - (n - 1) / 2) * IDLE_STEP
  const x = TABLE.x + Math.sin(a) * IDLE_R, z = TABLE.z + Math.cos(a) * IDLE_R
  return { x, z, yaw: Math.atan2(TABLE.x - x, TABLE.z - z) }
}
