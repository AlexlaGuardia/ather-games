// expedition-run.ts — one expedition run's live state, shared by the scene (FiringRange: elites, drops, pickups) and the
// page (the cache prompt, the HUD, the way home). A module singleton for the same reason `coop` is one: the two sides
// live in different components, and threading a ref through the scene props for one mode costs more than it buys.
import type { ExpLayout } from './expedition'

export interface ExpDrop { id: number; x: number; z: number; n: number }
export const expRun = {
  layout: null as ExpLayout | null,
  opened: new Set<string>(),
  drops: [] as ExpDrop[],
  /** elites whose death has already dropped its wrack (roster index) */
  dead: new Set<number>(),
  /** elites that have noticed the keeper: an elite holds its room until you come near or hurt it */
  aggro: new Set<number>(),
  /** this run's takings (already banked as they land) */
  wrack: 0, marks: 0, kills: 0,
  /** the unopened cache the keeper is standing at, for the E prompt */
  near: null as string | null,
  nextId: 1,
}
export function resetExpRun(layout: ExpLayout | null): void {
  expRun.layout = layout; expRun.opened = new Set(); expRun.drops = []; expRun.dead = new Set(); expRun.aggro = new Set()
  expRun.wrack = 0; expRun.marks = 0; expRun.kills = 0; expRun.near = null; expRun.nextId = 1
}
/** within this many tiles an elite notices you */
export const ELITE_AGGRO = 11
export const PICKUP_REACH = 1.1
export const CACHE_REACH = 1.6
