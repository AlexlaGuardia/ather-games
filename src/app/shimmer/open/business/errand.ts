// THE FIRST ERRAND, re-ruled (Magii + Alex 11-16; CANON_GAPS › "The Enchant Temple's counter": "The first errand becomes
// the first journey to the Citadel"). Play lane, 2026-11-16. PURE except the one guarded localStorage flag.
//
// ★ THE CHAIN (canon's order, Jin's placement): Gregory GIVES the gems for the keeper's birth letter (he gives, he never
//   teaches, 08-15/09-28) → the runesmith of the birth rune's school cuts the letter (one runesmith per school, 11-16)
//   → in the Citadel, Idony sets it in Greg's bracelet and teaches the word (09-28 unchanged; the Temple moved 11-16).
// ★ THE STAGE IS READ OFF FACTS, never stored as a counter that can drift: the gems-given flag, the letter in the bag,
//   the bracelet's word. A keeper who already has a word on Greg's bracelet is done, however they got there.
// ★ LINES: every spoken line is @lark's, SIGNED by Alex 11-16 (business/errand-lines.ts, verbatim from
//   CANON/game/first-errand-citadel-script.md).
import { give, countOf, type Inv } from '../shared/inventory'
import type { Loadout } from '../shared/loadout'
import type { JournalEntry, Zone } from '../shared/journal'
import { RUNE_SEATS, SEATS, recipeOf, letterItem, type Seat } from './letters'
import { journalSmith, JOURNAL_TEMPLE, journalDone } from './errand-lines'
import { gardenKey } from '@/lib/keeper-local'

export const ERRAND_KEY = 'open.errand.v1'
export function gemsGiven(): boolean { try { return !!JSON.parse(localStorage.getItem(gardenKey(ERRAND_KEY)) ?? '{}').given } catch { return false } }
export function markGemsGiven() { try { localStorage.setItem(gardenKey(ERRAND_KEY), JSON.stringify({ given: true })) } catch { /* private window */ } }

/** the seat that cuts a birth rune's letter on today's map (the first that has a place; Enchant cuts inside the Temple) */
export function birthSeat(birth: string | null): Seat | null {
  if (!birth) return null
  return (RUNE_SEATS[birth] ?? []).find(s => SEATS[s].place !== null) ?? null
}

export type Stage = 'none' | 'greg' | 'smith' | 'temple' | 'done'
export function stageOf(birth: string | null, inv: Inv, loadout: Loadout, given: boolean): Stage {
  if (!birth) return 'none'
  const bracelet = loadout.vessels.find(v => v.id === 'starter-bracelet')
  if (!bracelet || bracelet.word !== null) return 'done'
  if (!given) return 'greg'
  return countOf(inv, letterItem(birth)) > 0 ? 'temple' : 'smith'
}

/** what Greg hands over: one birth letter's material (a Blankstone, two raw shards, the element's crystal) */
export function gregsGems(inv: Inv, birth: string): { inv: Inv; left: number } {
  let out = inv, left = 0
  for (const x of recipeOf(birth)) { const g = give(out, x.id, x.n); out = g.inv; left += g.left }
  return { inv: out, left }
}

type At = { x: number; z: number } | null
/** the errand's journal line for this stage (lark's, signed 11-16; the 'greg' line before it is a neutral system line).
 *  `greg` is Ather ground; `smith` / `temple` are continent doors (null where the posting page cannot see the continent:
 *  the line still shows, the waymark waits for the continent page). `word` = the bracelet's word name once done. */
// `gate` (BETA M5 friction, 11-17): on the Ather the continent doors are out of sight, so the smith/temple line points at the
// gate (the fold map's way to Rune Hold) instead of 'Nowhere to point yet'.
// ★ BETA M32 trail (hub 11-19): `gate` may name its zone. In the Wilds the way to the continent is the Glade's waymark stone
// (its fold map), not the plot's gate, so the page passes the stone with zone 'wilds' there (default 'ather' = the gate).
export function errandEntries(stage: Stage, birth: string | null, at: { greg?: At; smith?: At; temple?: At; gate?: (At & { zone?: Zone }) | null }, word?: string | null): JournalEntry[] {
  const seat = birthSeat(birth), S = SEATS[seat ?? 'enchant']
  if (stage === 'greg') return [{ id: 'errand', hand: 'keeper', title: 'See Gregory about your first letter', note: 'Gregory sits on the bench by the pool at Moonwell Glade.', where: at.greg ? { zone: 'glade', ...at.greg } : null }]
  if (stage === 'smith') return [{ id: 'errand', hand: 'keeper', ...journalSmith(S.short, S.name, S.where), where: at.smith ? { zone: 'continent', ...at.smith } : at.gate ? { zone: at.gate.zone ?? 'ather', x: at.gate.x, z: at.gate.z } : null }]
  if (stage === 'temple') return [{ id: 'errand', hand: 'keeper', ...JOURNAL_TEMPLE, where: at.temple ? { zone: 'continent', ...at.temple } : at.gate ? { zone: at.gate.zone ?? 'ather', x: at.gate.x, z: at.gate.z } : null }]
  if (stage === 'done' && word) return [{ id: 'errand', hand: 'keeper', ...journalDone(word), where: null, struck: true }]
  return []
}
