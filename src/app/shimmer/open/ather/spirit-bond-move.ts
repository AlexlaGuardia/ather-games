// ★ BETA M238 (play, 2026-11-27): HER FAVOURITE MOVE (the bonded move). Canon game/shimmer-battles.md › THE BONDED MOVE (ruled
// 11-24, amended 11-27, Magii 4204f49 / 933293c / a32928c): at a MAXED bond the keeper ASKS her to make one move she already
// knows theirs: a TALK option (working word 'Pick a bond', @lark), ONCE PER EVOLUTION (per form). In a Clash she throws her
// favourite; with none picked a seeded random known move (clash-fight.ts resolveBonded). On a re-pick the bond's depth (the
// TWIST, 0-3) CARRIES ("its their bond not the move"): it deepens with a twist, never more damage.
//  · KNOWN MOVES, per spirit, on her pot (`moves`): what clash-fight.ts knownMoves derives for her form at KNOWN_LEVEL (born
//    pair + her species' learnset, raw while base, + the element tier once evolved), saved, so the hidden growth milestones
//    (canon: learned as she grows, per-form windows) can ADD to it later. Those milestones are NOT built here.
//  · FAVOURITE on her pot (`fav`): { id, form (the form she picked it in), day (game day of her FIRST pick = the bond's start) }.
//  · TWIST (Jin's rule, flagged for Alex): one twist per TWIST_DAYS game days since her first pick, max 3. Kept on a re-pick.
// Bond lives on the pot (spirit-dishes.ts), so no new storage key. ★ PURE: no React, no storage.
// Run: npx tsx src/app/shimmer/open/ather/spirit-bond-move.test.ts
import type { Species, Element } from '../../spirits/spirit'
import { ALL_MOVES } from '../../engine/moves'
import { knownMoves, TWIST_MAX, KNOWN_ALL_LEVEL, type Bonded } from './clash-fight'
import { bondOf, BOND_MAX } from './spirit-dishes'
import type { Pot } from './spirit-seeds'

/** the level her known list is read at (the spirit panel already shows her whole learnset). Build dial (Alex). */
export const KNOWN_LEVEL = KNOWN_ALL_LEVEL
/** game days (64 min each) of a picked bond per twist level. Build dial (Alex): 7 days -> twist 1, 14 -> 2, 21 -> 3. */
export const TWIST_DAYS = 7
export type FormKey = NonNullable<Pot['element']> | 'base'
export interface Fav { id: string; form: FormKey; day: number }

export const formOf = (p: Pot | undefined): FormKey => p?.element ?? 'base'
/** the move ids she knows: her saved list + what her current form derives (a saved move is never lost) */
export function knownOf(p: Pot | undefined, sp: Species): string[] {
  const out = [...(p?.moves ?? [])]
  for (const m of knownMoves(sp, formOf(p) as Element, KNOWN_LEVEL)) if (!out.includes(m.id)) out.push(m.id)
  return out
}
/** her known moves for a list (name from the canon registry; raw while base, as clash-fight derives them) */
export function knownList(p: Pot | undefined, sp: Species): { id: string; name: string }[] {
  const derived = knownMoves(sp, formOf(p) as Element, KNOWN_LEVEL)
  return knownOf(p, sp).flatMap(id => { const m = derived.find(x => x.id === id) ?? ALL_MOVES[id]; return m ? [{ id, name: m.name }] : [] })
}
/** the ask shows: a bloomed spirit, bond MAXED, and no favourite picked in THIS form yet */
export const canAsk = (p: Pot | undefined): boolean => !!p?.bloomed && bondOf(p) >= BOND_MAX && (!p.fav || p.fav.form !== formOf(p))
/** her twist depth on game day `day`: a twist per TWIST_DAYS since her first pick (it belongs to the bond, not the move) */
export const twistOf = (p: Pot | undefined, day: number): number =>
  p?.fav ? Math.max(0, Math.min(TWIST_MAX, Math.floor((day - p.fav.day) / TWIST_DAYS))) : 0
/** the keeper's pick: refused unless the ask is open and she knows the move. Saves her known list; the first pick's day stays. */
export function pickFavourite(p: Pot, sp: Species, id: string, day: number): Pot | null {
  if (!canAsk(p)) return null
  const moves = knownOf(p, sp)
  if (!moves.includes(id)) return null
  return { ...p, moves, fav: { id, form: formOf(p), day: p.fav?.day ?? day } }
}
/** what a Clash bout reads: her favourite with its twist (null = none picked: the fight draws a seeded random one) */
export const bondedOf = (p: Pot | undefined, day: number): Bonded | null => (p?.fav ? { id: p.fav.id, twist: twistOf(p, day) } : null)

/** parse helpers (grimoire-book.ts parseBook): a junk value drops, never guessed */
export function parseMoves(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const ok = v.filter((x, i): x is string => typeof x === 'string' && !!ALL_MOVES[x] && v.indexOf(x) === i)
  return ok.length ? ok.slice(0, 64) : undefined
}
const FORMS: readonly string[] = ['base', 'mana', 'storm', 'earth', 'water']
export function parseFav(v: unknown): Fav | undefined {
  const o = v as Partial<Fav> | null
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !ALL_MOVES[o.id] || !FORMS.includes(o.form as string)) return undefined
  if (typeof o.day !== 'number' || !Number.isInteger(o.day)) return undefined
  return { id: o.id, form: o.form as FormKey, day: o.day }
}

/** labels (plain UI; @lark for the words). 'Pick a bond' = canon's working word. */
export const BOND_MOVE_UI = {
  ask: 'Pick a bond',
  picked: (move: string) => `${move} is her favourite now.`,
  back: 'Not now',
}
