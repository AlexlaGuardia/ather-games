// THE KEEPER'S TWO CAST KEYS in the open world (Alex 11-16: "the tactical and signature keys" · "q and x works").
//
//   Q — the TACTICAL: the word on the worn bracelet; a blank bracelet casts the keeper's BIRTH tactical, which is
//       body-held and needs no paper (canon: moves.md › Doubled focus, "every keeper is born holding theirs";
//       play3d/gems.ts › isBodyHeld)
//   X — the SIGNATURE: the word on the worn glove. A blank glove casts nothing, and says so.
//
// The spec (mana, cooldown, charges, what it does) is play3d's castForMove: one source for every host.
// ★ PURE. The page owns the clocks; this decides every verdict so the rules have one home and a test.

import { castForMove, eligibleMoves, NO_CAST, type CastSpec } from '../../play3d/cast'
import { KEEPER_MOVES } from '../../play3d/keeper-moves'
import { keeperBook } from '../../play3d/book'
import { isBodyHeld } from '../../play3d/gems'
import type { Loadout } from './loadout'

export type CastSlot = 'tactical' | 'signature'
export const CAST_KEY: Record<CastSlot, string> = { tactical: 'KeyQ', signature: 'KeyX' }

/** Archetypes the open world carries out, and where: the page moves the keeper, the fight (combat-casts) the rest. */
export const KEEPER_SIDE = new Set(['surge', 'impulse', 'gate'])
export const FIGHT_SIDE = new Set(['projectile', 'status', 'restore', 'infusion', 'field', 'terrain', 'veil', 'channel'])
export const castsHere = (s: CastSpec) => KEEPER_SIDE.has(s.archetype) || FIGHT_SIDE.has(s.archetype)

/** A worn vessel's word is stored by NAME (the vessel shop writes `wordName`), or by id: either resolves. */
export function moveOfWord(word: string | null): string | null {
  if (!word) return null
  const m = KEEPER_MOVES.find(x => x.id === word || x.name.toLowerCase() === word.toLowerCase())
  return m?.id ?? null
}

export function birthTactical(birth: string | null): string | null {
  if (!birth) return null
  return eligibleMoves([birth], birth, 'tactical', keeperBook([birth])).find(m => isBodyHeld(m, birth))?.id ?? null
}

/** The move each key holds now. */
export function castMoves(l: Loadout, birth: string | null): Record<CastSlot, string | null> {
  const worn = (id: string | null) => l.vessels.find(v => v.id === id) ?? null
  const bracelet = worn(l.tactical), glove = worn(l.signature)
  return {
    tactical: moveOfWord(bracelet?.word ?? null) ?? (bracelet ? birthTactical(birth) : null),
    signature: moveOfWord(glove?.word ?? null),
  }
}

/** One key's clock: when it is next ready, and the charges a two-charge cast (Quickform, Shackle) has in hand. */
export interface CastClock { readyAt: number; charges: number; chargeAt: number }
export const freshClock = (s: CastSpec): CastClock => ({ readyAt: 0, charges: Math.max(1, s.charges), chargeAt: 0 })

export type CastVerdict =
  | { ok: true; spec: CastSpec; clock: CastClock; mana: number }
  | { ok: false; why: string }

/** Press a key. `now` in ms. Spends nothing on a refusal. NO refusal by place: a cast fires in every mode (M15), and hits what the mode holds. */
export function press(slot: CastSlot, moveId: string | null, clock: CastClock, now: number, mana: number): CastVerdict {
  if (!moveId) return { ok: false, why: slot === 'signature' ? 'Your glove has no word on it yet.' : 'You are wearing no bracelet.' }
  const s = castForMove(moveId)
  if (s === NO_CAST || s.archetype === 'unbuilt') return { ok: false, why: `${s.label || moveId} has no shape in the world yet.` }
  if (!castsHere(s)) return { ok: false, why: `${s.label} is not out here yet.` }
  const c = recharge(s, clock, now)
  const multi = Math.max(1, s.charges) > 1
  if (multi ? c.charges <= 0 : now < c.readyAt) return { ok: false, why: `${s.label} is not ready.` }
  if (mana < s.manaCost) return { ok: false, why: `Not enough mana (${s.manaCost} for ${s.label}).` }
  const next: CastClock = multi
    ? { readyAt: 0, charges: c.charges - 1, chargeAt: c.charges === Math.max(1, s.charges) ? now + s.cooldownMs : c.chargeAt }
    : { readyAt: now + s.cooldownMs, charges: 1, chargeAt: 0 }
  return { ok: true, spec: s, clock: next, mana: mana - s.manaCost }
}

/** Charges come back one cooldown apiece. */
export function recharge(s: CastSpec, c: CastClock, now: number): CastClock {
  const max = Math.max(1, s.charges)
  if (max === 1 || c.charges >= max) return c
  let { charges, chargeAt } = c
  while (charges < max && chargeAt > 0 && now >= chargeAt) { charges++; chargeAt = charges < max ? chargeAt + s.cooldownMs : 0 }
  return { readyAt: 0, charges, chargeAt }
}

/** For the HUD: 0 = ready, 1 = just cast. */
export function cooling(s: CastSpec, c: CastClock, now: number): number {
  if (!s.cooldownMs) return 0
  const max = Math.max(1, s.charges)
  if (max > 1) { const r = recharge(s, c, now); return r.charges > 0 ? 0 : Math.max(0, (r.chargeAt - now) / s.cooldownMs) }
  return Math.max(0, (c.readyAt - now) / s.cooldownMs)
}
