// ── DEEDS ARE TOLD (BETA M6d, Alex 11-17) ──────────────────────────────────────────────────────────────────────────────
// Prices stay; the first deed is a 2nd/3rd-session goal. What a stranger lacked was any word that deeds EXIST: the For Sale
// boards were only found by walking into one. One journal line (lark's, 11-17), posted the first time the keeper comes within
// reach of a continent town, and struck once the garden owns a place. The "told" fact is a garden flag (the tycoon is
// garden-level too), so it survives a reload and leaving the continent. PURE except the one guarded flag.
import type { JournalEntry } from '../shared/journal'
import { gardenKey } from '@/lib/keeper-local'

export const DEEDS_TOLD_KEY = 'open.deeds-told.v1'
export const DEED_LINE = {
  title: 'A place of your own',
  note: 'A business with a For Sale board at its door can be yours. Press E there to see the deed, then save your Marks hauling runs off the Co. contract board in town.',
}
/** within this many metres of a town's centre, on foot or riding, the town counts as reached (atTown also needs a stop) */
export const TOLD_RADIUS = 60

export function deedsTold(): boolean { try { return localStorage.getItem(gardenKey(DEEDS_TOLD_KEY)) === '1' } catch { return false } }
export function markDeedsTold() { try { localStorage.setItem(gardenKey(DEEDS_TOLD_KEY), '1') } catch { /* private window */ } }

/** nothing until a town is reached; then the line, struck once anything is owned (a record, like the errand) */
export function deedPointerEntries(told: boolean, ownsAny: boolean): JournalEntry[] {
  return told ? [{ id: 'deeds', hand: 'keeper', ...DEED_LINE, where: null, struck: ownsAny }] : []
}
