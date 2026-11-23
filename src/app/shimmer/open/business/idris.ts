// IDRIS, THE ENCHANT TEMPLE'S WEAPONS IMBUER (BETA M93 s3, sprites lane). Canon (athernyx 6a20625, Magii): Idony's twin; he cuts
// runes into a gun's sigil. Lines are @lark's (idris-lines.ts). Pure rules here, no React: the panel and the tests read one answer.
//
// ★ THE RULES (canon: game/weapons.md > SIGIL TUNING; numbers and the flow are Jin's):
//   · A sigil's runes are runesmith LETTERS (letter_<rune> in the bag, letters.ts), the same letters a vessel takes (Alex 11-22,
//     weapons.md:109). Each rune cut CONSUMES one letter. (Not the keeper's identity runes: hub brief said "owned runes", canon
//     says letters, canon wins.)
//   · The keeper picks up to the free slots, IN ORDER (lark: "These, in this order?"), then one cut does them all.
//   · A gun's FIRST cut sets its sigil and consumes one Unattuned sigil (sigil_blank). A sigil with free slots takes more runes
//     later without a new blank.
//   · RE-CUT (hub call 11-23, s4): a NEW blank REPLACES the old sigil. The old runes are gone (their letters do not come back);
//     the picks start an empty sigil. Costs the blank + the fee per rune, like a first cut.
//   · Every rune cut costs SIGIL_CUT_FEE Marks (the Temple cost, a dial). All or nothing.
//   · Same-state, duplicate, cap and socketless refusals are sigil.ts canCut's, applied rune by rune in pick order.
//   · Stored on Loadout.fit[gun].sigil = rune ids in cut order. shared/gun-sigil.ts armedGun tunes the gun in hand from it (s4).
import { canCut, sigilSlots, blankSigil, SIGIL_CAP, RUNES, type Sigil } from '../shared/sigil'
import { sigilOf } from '../shared/gun-sigil'
import { countOf, take, type Inv } from '../shared/inventory'
import { SIGIL_ITEM } from './gun-shop'
import { letterItem } from './letters'
import type { Loadout } from '../shared/loadout'

/** Marks per rune cut at Idris's counter (a dial) */
export const SIGIL_CUT_FEE = 150

export { sigilOf }
/** the owned guns that can take a sigil, in loadout order */
export const sigilGuns = (l: Loadout): string[] => l.guns.filter(g => sigilSlots(g) >= 1)

export type IdrisWhy = 'no-gun' | 'no-letter' | 'no-blank' | 'marks' | 'no-socket' | 'unknown-rune' | 'cap' | 'same-state' | 'duplicate' | 'none-picked'
export type IdrisCheck = { ok: true; blank: boolean; fee: number } | { ok: false; why: IdrisWhy; at?: string }

/** the runes whose letters are in the bag (one row per rune, any count) */
export const lettersHeld = (inv: Inv): string[] => RUNES.map(r => r.id).filter(id => countOf(inv, letterItem(id)) > 0)

/** the sigil a cut starts from: the gun's own, or (re-cut) an empty one that replaces it */
const startOf = (l: Loadout, gunId: string, recut: boolean): Sigil => recut ? blankSigil(gunId) : sigilOf(l, gunId)

/** can Idris cut these runes (in this order) into this gun's sigil now? `blank` = this cut consumes a sigil_blank.
 *  `recut` = a new blank replaces the gun's sigil (only offered on a gun that has one). */
export function idrisCanCut(l: Loadout, inv: Inv, marks: number, gunId: string, picks: readonly string[], recut = false): IdrisCheck {
  if (!l.guns.includes(gunId)) return { ok: false, why: 'no-gun' }
  if (!picks.length) return { ok: false, why: 'none-picked' }
  let s = startOf(l, gunId, recut)
  const need = new Map<string, number>()
  for (const id of picks) {
    const c = canCut(s, id)
    if (!c.ok) return { ok: false, why: c.reason, at: id }
    need.set(id, (need.get(id) ?? 0) + 1)
    if (countOf(inv, letterItem(id)) < need.get(id)!) return { ok: false, why: 'no-letter', at: id }
    s = { ...s, runes: [...s.runes, id] }
  }
  const blank = startOf(l, gunId, recut).runes.length === 0, fee = SIGIL_CUT_FEE * picks.length
  if (blank && countOf(inv, SIGIL_ITEM) < 1) return { ok: false, why: 'no-blank' }
  if (marks < fee) return { ok: false, why: 'marks' }
  return { ok: true, blank, fee }
}
// the picker asks only "does the rune fit and is its letter here"; the blank and the Marks are the cut's, checked at Cut
const withBlank = (inv: Inv): Inv => ({ ...inv, slots: [...inv.slots, { id: SIGIL_ITEM, n: 1 }] })
/** can this ONE rune go next after `picks`? (the picker greys a row with this) */
export const canPickNext = (l: Loadout, inv: Inv, gunId: string, picks: readonly string[], id: string, recut = false): IdrisCheck =>
  idrisCanCut(l, withBlank(inv), Infinity, gunId, [...picks, id], recut)

export type IdrisCut = { ok: true; loadout: Loadout; inv: Inv; marks: number; sigil: Sigil } | { ok: false; why: IdrisWhy; at?: string }
/** cut them: the fee, the letters, the blank (first cut only) and the sigil, all or nothing */
export function idrisCut(l: Loadout, inv: Inv, marks: number, gunId: string, picks: readonly string[], recut = false): IdrisCut {
  const c = idrisCanCut(l, inv, marks, gunId, picks, recut)
  if (!c.ok) return c
  let next: Inv | null = c.blank ? take(inv, SIGIL_ITEM, 1) : inv
  for (const id of picks) next = next && take(next, letterItem(id), 1)
  if (!next) return { ok: false, why: 'no-letter' }
  const runes = [...startOf(l, gunId, recut).runes, ...picks], f = l.fit?.[gunId] ?? {}
  return { ok: true, loadout: { ...l, fit: { ...l.fit, [gunId]: { ...f, sigil: runes } } }, inv: next, marks: marks - c.fee, sigil: { gunId, runes } }
}

/** the counter's plain reason for a refusal (UI copy, not a keeper's line; Idris's own refusals are idris.no_blank / idris.no_runes) */
export function whyText(why: IdrisWhy): string {
  switch (why) {
    case 'no-gun': return 'You do not carry that gun.'
    case 'no-letter': return 'That letter is not in your bag. A runesmith cuts letters.'
    case 'none-picked': return 'Pick a rune first.'
    case 'no-blank': return 'The first cut needs an Unattuned sigil. The gun shop sells them.'
    case 'marks': return `Each rune costs ${SIGIL_CUT_FEE} Marks to cut.`
    case 'no-socket': return 'That gun cannot take a sigil.'
    case 'unknown-rune': return 'No such rune.'
    case 'cap': return `A sigil holds ${SIGIL_CAP} runes.`
    case 'same-state': return 'A sigil takes one rune of each state.'
    case 'duplicate': return 'That rune is already in this sigil.'
  }
}
