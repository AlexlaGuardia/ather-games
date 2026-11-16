// LETTERS, RUNESMITHS AND THE IMBUE (play lane, 2026-11-16). PURE, node-safe.
//
// ★ CANON (Magii + Alex 11-16; design-briefs/shimmer-casting-vessels.md › THE LETTER IS MADE AT A RUNESMITH, and
//   world/schools.md › THE EIGHT RUNESMITH SEATS):
//   · a LETTER is cut from one common base stone (Jin's name: BLANKSTONE) inscribed with gems; dug graded stones are the ink
//   · every word has a RECIPE: the letters it needs
//   · ONE RUNESMITH PER SCHOOL, at its seat, cuts THAT school's letters if you bring the material; a rune two schools
//     teach can be cut at EITHER seat (Magma, Tempest, Star); Illuminate at Galecrest, Manalic at the Citadel's Enchant
//     Temple; the Scatter letters (Static, Dust, Vapor) need a BLUEPRINT earned on a quest line (none exists yet)
//   · the ENCHANT TEMPLE (the Citadel) imbues the letters into a vessel's seats and Idony teaches the word
//   · Greg's glove stays EARNED (the Breach road): never on Idony's counter here
// ★ JIN'S (balance): the recipe of one letter, the fees, which towns a seat's door stands in. Fees are emergency-fund
//   sized on purpose (Alex 11-16: the starting Marks are an emergency fund), so a new keeper can afford their birth
//   word: one letter cut + one imbue = 1,000 of the 1,500 they start with. TODO(world): move fees onto prices.ts LADDER.
import { BLANKSTONE, CRYSTAL_ITEM } from '../ather/prospecting'
import { OPEN_ITEMS, countOf, take, give, type Inv } from '../shared/inventory'
import { RUNES } from '../../play3d/birth/runes.data'
import { TRADE_POOL } from '../../play3d/scroll-market'
import { lettersOf } from '../../play3d/gems'
import { laneRunes } from '../../play3d/cast'
import type { Loadout, OwnedVessel } from '../shared/loadout'

export type Seat = 'fire' | 'wind' | 'water' | 'earth' | 'barrier' | 'life' | 'enchant' | 'star'
/** where each runesmith works: the Atlas place id (null = no place on the continent yet) */
export const SEATS: Record<Seat, { name: string; place: string | null; where: string; short: string }> = {
  fire: { name: 'Fire School', place: 'unnamed-school-30', where: 'Redstair', short: 'Redstair' },
  wind: { name: 'Wind School', place: 'unnamed-school-10', where: 'Galecrest', short: 'Galecrest' },
  water: { name: 'Water School', place: 'rincrest', where: 'Rincrest', short: 'Rincrest' },
  earth: { name: 'Earth School', place: 'the-moldy-boulder', where: 'the Cairn, behind the Moldy Boulder', short: 'Cairn' },
  barrier: { name: 'Barrier Temple', place: 'veradyn', where: 'Veradyn', short: 'Veradyn' },
  life: { name: 'Life Temple', place: 'verdant-ruins', where: 'the Verdant Ruins', short: 'Verdant Ruins' },
  enchant: { name: 'Enchant Temple', place: 'citadel', where: 'the Citadel', short: 'Citadel' },
  star: { name: 'Star Temple', place: null, where: "the Spine's highest peak", short: 'Star Temple' },
}
/** which seats cut each rune's letter (world/schools.md › THE EIGHT RUNESMITH SEATS) */
export const RUNE_SEATS: Record<string, Seat[]> = {
  star: ['fire', 'star'], magma: ['fire', 'earth'], tempest: ['fire', 'wind'],
  stone: ['earth'], gem: ['earth'], dust: ['earth'], metalergy: ['earth'],
  breeze: ['wind'], static: ['wind'], lightning: ['wind'], illuminate: ['wind'],
  fluid: ['water'], freeze: ['water'], hydro: ['water'], mist: ['water'], vapor: ['water'],
  barrier: ['barrier'], life: ['life'], enchant: ['enchant'], manalic: ['enchant'],
}
/** the lost Scatter state: no letter without its blueprint (game/runes.md › THE ONE ROAD BACK TO SCATTER) */
export const SCATTER = new Set(['static', 'dust', 'vapor'])
export const BLUEPRINT_KEY = 'open.blueprints.v1'
export function hasBlueprint(rune: string): boolean {
  if (!SCATTER.has(rune)) return true
  try { return (JSON.parse(localStorage.getItem(BLUEPRINT_KEY) ?? '[]') as string[]).includes(rune) } catch { return false }
}

export const CUT_FEE = 400
export const IMBUE_FEE = 600
export const letterItem = (rune: string) => `letter_${rune}`
const runeName = (rune: string) => RUNES.find(r => r.id === rune)?.name ?? rune
const ELEMENT_INK: Record<string, string> = { mana: CRYSTAL_ITEM.violet, storm: CRYSTAL_ITEM.storm, earth: CRYSTAL_ITEM.earth, water: CRYSTAL_ITEM.water }

// the letters are bag items (one row per rune). Icons: the rune's glyph (design-briefs/letter-glyphs.md: element frame +
// state mark, circuitry in gem ink on Blankstone), drawn by tools/art/letter_glyphs.py
for (const r of RUNES) if (!OPEN_ITEMS[letterItem(r.id)]) OPEN_ITEMS[letterItem(r.id)] = { name: `${r.name} letter`, blurb: `A ${r.name} letter, cut and inked. The Enchant Temple sets it in a vessel.`, icon: `/open/icons/letter-${r.id}.svg`, stack: 99, kind: 'material' }

/** what one letter costs in material: one Blankstone, two raw shards, and its element's crystal as the ink */
export function recipeOf(rune: string): { id: string; n: number }[] {
  const el = RUNES.find(r => r.id === rune)?.element ?? 'mana'
  return [{ id: BLANKSTONE, n: 1 }, { id: CRYSTAL_ITEM.raw, n: 2 }, { id: ELEMENT_INK[el], n: 1 }]
}
/** the letters a seat cuts, in rune order */
export const lettersAt = (seat: Seat) => RUNES.map(r => r.id).filter(id => (RUNE_SEATS[id] ?? []).includes(seat))

export type CutVerdict = { ok: true } | { ok: false; why: string }
export function canCut(inv: Inv, marks: number, seat: Seat, rune: string, blueprint = hasBlueprint(rune)): CutVerdict {
  if (!(RUNE_SEATS[rune] ?? []).includes(seat)) return { ok: false, why: `The ${SEATS[seat].name} does not cut ${runeName(rune)}.` }
  if (!blueprint) return { ok: false, why: `${runeName(rune)} is a lost letter. It needs a blueprint.` }
  const short = recipeOf(rune).find(x => countOf(inv, x.id) < x.n)
  if (short) return { ok: false, why: `Bring ${short.n} ${OPEN_ITEMS[short.id]?.name ?? short.id}.` }
  if (marks < CUT_FEE) return { ok: false, why: `The cut is ${CUT_FEE} Marks. You have ${Math.floor(marks)}.` }
  return { ok: true }
}
export function cut(inv: Inv, marks: number, seat: Seat, rune: string, blueprint = hasBlueprint(rune)): { ok: true; inv: Inv; marks: number } | { ok: false; why: string } {
  const v = canCut(inv, marks, seat, rune, blueprint); if (!v.ok) return v
  let out = inv
  for (const x of recipeOf(rune)) out = take(out, x.id, x.n)!
  const g = give(out, letterItem(rune), 1)
  if (g.left) return { ok: false, why: 'Your bag is full.' }
  return { ok: true, inv: g.inv, marks: marks - CUT_FEE }
}

// ── Idony's counter: a word into a vessel ──────────────────────────────────────────────────────────────────────────
/** vessels Idony will inscribe from cut letters: blank BRACELETS. A glove carries a SIGNATURE word, and signature words
 *  are earned, never sold or cut (vessel-shop.tsx: no ultimate words sold; Greg's glove: the Breach road). */
export const imbuable = (l: Loadout) => l.vessels.filter(v => v.word === null && v.kind === 'bracelet')
/** the words a vessel can take from letters: a bracelet's tactical words (TRADE_POOL). A glove takes none here. */
export function wordsFor(kind: OwnedVessel['kind']) {
  if (kind !== 'bracelet') return []
  return TRADE_POOL.filter(m => m.tier === 'tactical').map(m => ({ id: m.id, name: m.name, letters: lettersOf(m, null) })).filter(w => w.letters.length > 0)
}
/** the letters a word still needs from the bag */
export function missingLetters(inv: Inv, letters: string[]): string[] {
  const need = new Map<string, number>()
  for (const r of letters) need.set(r, (need.get(r) ?? 0) + 1)
  return [...need].filter(([r, n]) => countOf(inv, letterItem(r)) < n).map(([r]) => r)
}
/** will the word light for this keeper (every letter on their element lane, or the birth rune itself) */
export function lightsFor(letters: string[], birth: string | null): boolean {
  if (!birth) return false
  const lane = laneRunes(birth, 'element')
  return letters.every(r => r === birth || lane.has(r))
}
export function imbue(l: Loadout, inv: Inv, marks: number, vesselId: string, wordId: string): { ok: true; loadout: Loadout; inv: Inv; marks: number; name: string } | { ok: false; why: string } {
  const v = imbuable(l).find(x => x.id === vesselId)
  if (!v) return { ok: false, why: 'Idony will not inscribe that vessel.' }
  const w = wordsFor(v.kind).find(x => x.id === wordId)
  if (!w) return { ok: false, why: 'That word does not sit in that vessel.' }
  const miss = missingLetters(inv, w.letters)
  if (miss.length) return { ok: false, why: `Bring the ${miss.map(runeName).join(', ')} letter${miss.length > 1 ? 's' : ''}.` }
  if (marks < IMBUE_FEE) return { ok: false, why: `The imbue is ${IMBUE_FEE} Marks. You have ${Math.floor(marks)}.` }
  let out = inv
  for (const r of w.letters) out = take(out, letterItem(r), 1)!
  const loadout: Loadout = { ...l, vessels: l.vessels.map(x => (x.id === vesselId ? { ...x, word: w.id, label: `${w.name} ${x.kind}` } : x)) }
  return { ok: true, loadout, inv: out, marks: marks - IMBUE_FEE, name: w.name }
}
