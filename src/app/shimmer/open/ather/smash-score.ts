// ★ BETA M246 (assets, 2026-11-27, Alex 11-27 17:58 "smash needs to get deleted"): SMASH REDO, THE BELL'S SCORE. PURE (no
// React, no three, no storage); the client computes it (it reads her stat record), the server keeps s1's rules (tries a day,
// the season board, cleanHit's sanity cap).
// WHICH MOVE: the strongest she can muster, from the CLASH ENGINE's move data (clash-fight.ts knownMoves / clashMoveOf):
//   her FAVOURITE (the bonded move, spirit-bond-move.ts) when she has one and it hits (power > 0); else her strongest known
//   damaging move (highest Clash power; Mana Pulse when she knows nothing else). The twist never adds damage (canon), so it
//   is not in the score.
// WHICH STAT: the move's own category (Clash cat): phys -> her PWR, spirit -> her FOC, as spirit-stats.ts statValue reads
//   them (species base x her growth x (1 + training points %)). The bell is neutral: no element in the score.
// THE FORMULA:   score = round( SCALE x (atk / REF_ATK)^EXP x (power / REF_POW) x roll ),   roll in [1 - ROLL, 1 + ROLL]
//   REF_ATK 22 / REF_POW 50 = a fresh spirit's typical attack stat and move power; SCALE 210, EXP 1.3, so a fresh spirit
//   lands in the HUNDREDS (11-27 table: firefly ~180 .. frog ~390), a few dozen growths in the high hundreds / low thousands.
//   Growth (spirit-growth.ts) is logarithmic with a hidden ceiling of 9998 growths (x9 at the very top), so 9000 asks for a
//   ~x8.5 grown spirit (several THOUSAND growths = years) of a high-PWR species on a top-power move (Clash power 70 today),
//   a PWR-trained build (training: up to +20% in one stat; FOC cannot be trained) AND a top roll. theoreticalMax() is the
//   ceiling today: frog, Iron Crush, ceiling growth, +20% PWR, top roll = 9,307 (smash-score.test prints it and holds it in
//   9000..10000): OVER 9000 is possible, and all but never.
// OVER 9000 (score > CRACK_AT): the bell CRACKS and the Moglin judge yells (the line is a placeholder for @lark).
import type { Species, Element } from '../../spirits/spirit'
import { ALL_MOVES, MOVE_MANA_PULSE } from '../../engine/moves'
import { knownMoves, clashMoveOf, KNOWN_ALL_LEVEL, KIND, type Bonded, type ClashMove } from './clash-fight'
import { statValue, TRAIN, type StatRec } from './spirit-stats'
import { MAX_GROWN } from './spirit-growth'

/** the formula's dials (Jin's; documented above) */
export const SMASH_SCALE = { SCALE: 210, EXP: 1.3, REF_ATK: 22, REF_POW: 50, ROLL: 0.1 } as const
/** over this the bell cracks */
export const CRACK_AT = 9000
export const cracks = (score: number) => score > CRACK_AT

/** the moves she knows, as the Clash engine reads them (her saved ids when given, else her form's list at the known level) */
function knownOfShape(species: Species, element: Element, known?: readonly string[]) {
  const all = knownMoves(species, element, KNOWN_ALL_LEVEL)
  if (!known?.length) return all
  const out = known.flatMap(id => { const m = all.find(x => x.id === id) ?? ALL_MOVES[id]; return m ? [m] : [] })
  return out.length ? out : all
}
/** the move she swings: her favourite if it hits, else her strongest known damaging move (Clash power) */
export function smashMoveOf(species: Species, element: Element, bonded?: Bonded | null, known?: readonly string[]): ClashMove {
  const k = knownOfShape(species, element, known)
  if (bonded) { const f = k.find(m => m.id === bonded.id); if (f) { const c = clashMoveOf(f); if (c.power > 0) return c } }
  let best: ClashMove | null = null
  for (const m of k) { const c = clashMoveOf(m); if (c.power > 0 && (!best || c.power > best.power)) best = c }
  return best ?? clashMoveOf(MOVE_MANA_PULSE)
}
/** her attack stat for a move category (real) */
export const attackOf = (sp: Species, rec: StatRec | undefined, cat: ClashMove['cat']) => statValue(sp, rec, cat === 'phys' ? 'pwr' : 'foc')

/** the bare formula (roll 1 = the middle of the spread) */
export const scoreOf = (atk: number, power: number, roll = 1) =>
  Math.max(1, Math.round(SMASH_SCALE.SCALE * Math.pow(Math.max(0, atk) / SMASH_SCALE.REF_ATK, SMASH_SCALE.EXP) * (Math.max(0, power) / SMASH_SCALE.REF_POW) * roll))
/** a roll from rand() in [0,1): 1 - ROLL .. 1 + ROLL */
export const rollOf = (r: number) => 1 - SMASH_SCALE.ROLL + 2 * SMASH_SCALE.ROLL * Math.max(0, Math.min(1, r))

export interface SmashSwing { score: number; move: string; moveId: string; cat: ClashMove['cat']; atk: number; power: number; roll: number }
/** her one swing at the bell */
export function smashSwing(sp: Species, rec: StatRec | undefined, element: Element | undefined, opts: { bonded?: Bonded | null; known?: readonly string[] } = {}, rand: () => number = Math.random): SmashSwing {
  const mv = smashMoveOf(sp, element ?? 'base', opts.bonded, opts.known)
  const atk = attackOf(sp, rec, mv.cat), roll = rollOf(rand())
  return { score: scoreOf(atk, mv.power, roll), move: mv.name, moveId: mv.id, cat: mv.cat, atk, power: mv.power, roll }
}

/** THE CEILING TODAY: every species x form, her strongest move, at the growth ceiling, the full per-stat training cap in the
 *  move's stat (PWR only: FOC is not trainable), the top roll. */
export function theoreticalMax(): { score: number; species: Species; element: Element; move: string; atk: number; power: number } {
  const els: Element[] = ['base', 'mana', 'storm', 'earth', 'water'] as Element[]
  let top = { score: 0, species: 'fox' as Species, element: 'base' as Element, move: '', atk: 0, power: 0 }
  for (const sp of Object.keys(KIND) as Species[]) for (const el of els) {
    for (const m of knownMoves(sp, el, KNOWN_ALL_LEVEL)) {
      const c = clashMoveOf(m); if (c.power <= 0) continue
      const rec: StatRec = { form: 'base', g: { pwr: TRAIN.cap }, plays: 0, xp: 0, grown: MAX_GROWN }
      const atk = attackOf(sp, rec, c.cat), score = scoreOf(atk, c.power, 1 + SMASH_SCALE.ROLL)
      if (score > top.score) top = { score, species: sp, element: el, move: c.name, atk, power: c.power }
    }
  }
  return top
}

/** the bell's gauge: how far the needle climbs (0..1). A log scale so the hundreds read as a fair climb and 9000 is the top
 *  notch (the crack); past it the needle pins. */
export const GAUGE_TOP = CRACK_AT
export const gaugeOf = (score: number) => Math.max(0, Math.min(1, Math.log10(1 + Math.max(0, score)) / Math.log10(1 + GAUGE_TOP)))

/** the TEST HOOK's crafted score (the owner-only Fair bench, ?smashscore=N): a whole number 1..99999, else off (null). Never
 *  reaches the board: the bench refuses every write. */
export function cleanCraftedScore(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 99_999 ? n : null
}
