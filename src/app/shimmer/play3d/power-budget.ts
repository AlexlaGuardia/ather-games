// power-budget.ts — the rule that a default loadout keeps pace, as arithmetic.
//
// ★ PURE. Alex, 2026-09-24: *"a new player with a default loadout could run with veterans without
// being overshadowed damage wise"* — a veteran earns loadout CHOICE, never a damage lead, and no
// tactical or signature may solo a boss. 20% is the band he picked.
//
// What this measures: over one fight window on the hold's mana budget (a fixed pool + the drip),
// how much MORE damage a keeper deals with a move in their slot than the same keeper with only the
// default gun. Two fights, because they break different moves:
//   • BOSS  — one big target. Infusions (a multiplier on the gun) are what break here.
//   • HORDE — a clump of flooded bodies. Area damage scales with how many stand in it, so fields and
//             chains are what break here. Measured with the field cap the hold enforces.
// A move is IN BUDGET when its uplift is at most `band` in both. Negative uplift is fine: most casts
// trade damage for burst, control or utility, which is what a sidegrade is.
//
// ⚠ It is a MODEL, deliberately generous to the move: casting costs no gun time, every cast lands,
// every field tick finds a target. A move that passes a generous model passes the real fight. Tune
// the moves, never this model, to make a move pass.

import { WEAPONS, type WeaponDef } from '../engine/weapons'
import { castForMove, type CastSpec } from './cast'
import { HOLD_TUNING } from './hold'

export const BUDGET = {
  band: 0.2,
  windowSec: 60,
  manaStart: HOLD_TUNING.manaPool,
  drip: HOLD_TUNING.manaDrip,
  hordeN: 12,
  /** bodies a field damages at FULL rate; more bodies inside share that total (hold.ts enforces it) */
  fieldFullTargets: HOLD_TUNING.fieldFullTargets,
  /** clumped flood: bodies per square tile when they pile at a window */
  hordeDensity: 0.6,
  /** a chain jump's share of the bolt's damage (FiringRange: `dmg * 0.5`) */
  chainShare: 0.5,
  dt: 0.05,
  /** full-pool refills in the rich fights — the Glimmer cap for one round */
  richRefills: HOLD_TUNING.dropCap,
} as const

/**
 * Four fights. BOSS/HORDE on the hold's plain economy (a pool + a drip), and the same two RICH — the
 * most mana a run can actually hold in one window: the drip plus every Glimmer of Hope the round's
 * cap allows, each a full pool. Scarce mana hides a multiplier's strength (a cast spends ammo); rich
 * mana shows it. A move must fit the band in all four.
 * ⚠ Not infinite mana: nothing in the hold reaches it, and a band judged against a fight nobody can
 * have is a band every move fails for no reason. If a mana source is added, raise `richRefills`.
 */
export type Fight = 'boss' | 'horde' | 'boss-rich' | 'horde-rich'
export const FIGHTS: readonly Fight[] = ['boss', 'horde', 'boss-rich', 'horde-rich']
const isHorde = (f: Fight) => f === 'horde' || f === 'horde-rich'

/** A gun's damage per second while it has mana to fire, clip and recharge included. */
export function gunSustainedDps(w: WeaponDef): number {
  const clipTime = (w.clip - 1) * w.fireCd + w.reloadTime
  return (w.clip * w.damage) / clipTime
}
/** Damage per point of mana — the gun's real currency in the hold, where mana is the clip. */
export const gunDmgPerMana = (w: WeaponDef): number => (w.clip * w.damage) / w.reloadMana

/** How many bodies a cast reaches in this fight. */
function bodiesHit(spec: CastSpec, fight: Fight): number {
  if (!isHorde(fight)) return 1
  if (spec.archetype === 'field') {
    const r = spec.areaSize ?? 1
    const inside = Math.min(BUDGET.hordeN, Math.max(1, Math.round(Math.PI * r * r * BUDGET.hordeDensity)))
    return Math.min(inside, BUDGET.fieldFullTargets)
  }
  if (spec.archetype === 'projectile') return 1 + Math.min(spec.chain ?? 0, BUDGET.hordeN - 1) * BUDGET.chainShare
  return 1
}

/**
 * Total damage over the window: the gun always, plus every move in `specs` cast on its own cooldown
 * whenever mana allows. A stance in the loadout multiplies cast damage (Flame Manipulation), the way
 * `castMultRef` does in the range. One move is a loadout of one.
 */
export function loadoutDamage(gun: WeaponDef, specs: readonly CastSpec[], fight: Fight): number {
  const dps = gunSustainedDps(gun), perMana = gunDmgPerMana(gun)
  const castMult = specs.filter(c => c.archetype === 'stance').reduce((m, c) => m * (c.castMult ?? 1), 1)
  const casts = specs.filter(c => c.archetype !== 'stance').map(c => ({ c, hit: bodiesHit(c, fight), cd: 0, field: 0, fieldUntil: -1 }))
  let mana: number = BUDGET.manaStart * (fight.endsWith('rich') ? 1 + BUDGET.richRefills : 1)
  let mult = 1, multUntil = -1, dmg = 0
  for (let t = 0; t < BUDGET.windowSec; t += BUDGET.dt) {
    mana += BUDGET.drip * BUDGET.dt
    for (const k of casts) {
      k.cd -= BUDGET.dt
      if (k.cd > 0 || mana < k.c.manaCost) continue
      mana -= k.c.manaCost
      k.cd = k.c.cooldownMs / 1000
      if (k.c.archetype === 'projectile') dmg += k.c.damage * k.hit * castMult
      if (k.c.archetype === 'field' && (k.c.fieldDps ?? 0) > 0) { k.field = (k.c.fieldDps ?? 0) * k.hit * castMult; k.fieldUntil = t + (k.c.areaSecs ?? 0) }
      if (k.c.archetype === 'infusion' && (k.c.surgeMult ?? 1) >= mult) { mult = k.c.surgeMult ?? 1; multUntil = t + (k.c.surgeSecs ?? 0) }
    }
    for (const k of casts) if (t < k.fieldUntil) dmg += k.field * BUDGET.dt
    // the gun fires whenever it has mana; its damage is mana-bound or time-bound, whichever bites
    const shot = Math.min(dps * BUDGET.dt, mana * perMana)
    mana -= shot / perMana
    dmg += shot * (t < multUntil ? mult : 1)
    if (t >= multUntil) mult = 1
  }
  return dmg
}
export const fightDamage = (gun: WeaponDef, spec: CastSpec | null, fight: Fight): number => loadoutDamage(gun, spec ? [spec] : [], fight)

export const DEFAULT_GUN = (): WeaponDef => WEAPONS.find(w => w.id === 'repeater')!

/** The move's damage uplift over the default loadout in a fight, as a fraction (0.2 = +20%). */
export function uplift(moveId: string, fight: Fight, gun: WeaponDef = DEFAULT_GUN()): number {
  return loadoutUplift([moveId], fight, gun)
}
/** A whole loadout's uplift — what a veteran actually wears, against the gun-only newcomer. */
export function loadoutUplift(moveIds: readonly string[], fight: Fight, gun: WeaponDef = DEFAULT_GUN()): number {
  return loadoutDamage(gun, moveIds.map(id => castForMove(id)), fight) / loadoutDamage(gun, [], fight) - 1
}
/** The worst of the four fights. */
export const worstUplift = (moveIds: readonly string[], gun: WeaponDef = DEFAULT_GUN()): number =>
  Math.max(...FIGHTS.map(f => loadoutUplift(moveIds, f, gun)))
