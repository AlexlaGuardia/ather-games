// Eat / drink — what a consumable in the hand DOES, decided here and applied by the host.
//
// ★ PURE. No react/three/DOM. `VoxelWorld` asks `consumeEffect` what an item does, spends one, and
// applies the deltas it gets back; the words come from `consumeLine`. Nothing in this file touches
// a bag, a bar or a timer.
//
// ── ★★ WHY THIS EXISTS (2026-09-15, Alex: "do the eat/drink verb next") ─────────────────────────
// The chain brews 17 potions and the oven bakes a loaf, and until today NOTHING on this surface
// could swallow any of them. `engine/potion-effects.ts` is play3d's — the amounts, the buffs, the
// timers — and it was never given a right-click here. So the effects are the engine's (one table
// for both worlds, the same reason `brew.ts` reads `POTION_DEFS`) and only the verb is new.
//
// ⚠ HONEST ABOUT WHAT IS FELT. A buff is a timer plus a hook that reads it; the timer is cheap and
// the hooks are one per feature. `WIRED_BUFFS` names the hooks this world actually has, and the
// drink line says "not felt here yet" for the rest — a chip on the HUD that changes nothing is a
// promise, and the MoveBook's rule stands: name the gap, never hide it.
import { POTION_DEFS, elementForInfusion } from '../engine/alchemy'
import {
  MANA_POTIONS, HEAL_POTIONS, POTION_BUFFS, BUFF_DEFS, HARVEST_BREW_ADVANCE_MS,
  type BuffId,
} from '../engine/potion-effects'

/** What a loaf does. A first number for the feel: bread mends, it does not buff. */
export const FOOD: Readonly<Record<string, { hp: number }>> = { bread: { hp: 30 } }

export type ConsumeKind = 'drink' | 'eat'

export interface ConsumeEffect {
  kind: ConsumeKind
  /** Mana restored (capped by the host at max). */
  mana?: number
  /** HP mended / shield re-formed. */
  hp?: number
  sh?: number
  /** A timed buff to set or refresh. */
  buff?: BuffId
  /** Every planted crop jumps this far along. */
  advanceCropsMs?: number
}

/**
 * The buffs whose hook exists in voxel3d today. Everything else is a timer with nobody reading it.
 *   fleetfoot   — `LocoState.speedMult` on the walk/run target
 *   ather_flow  — the mana regen tick
 *   starlight   — mining + rinning XP
 *   anglers_eye — a cast's rise time
 *   dawn        — its speed and XP halves (the find half has no gather-bonus to add to here)
 *   dreamwalk   — `mist.setCalm`: no presence steps out of a patch while it runs (09-15)
 * ⚠ Extend this ONLY by wiring a hook; `consume.test.ts` reads the host to check each name.
 */
export const WIRED_BUFFS: ReadonlySet<BuffId> = new Set<BuffId>(['fleetfoot', 'ather_flow', 'starlight', 'anglers_eye', 'dawn', 'dreamwalk'])

/** Is this a thing you can swallow at all? Null for everything else, INCLUDING the four infusions. */
export function consumeEffect(itemId: string): ConsumeEffect | null {
  const food = FOOD[itemId]
  if (food) return { kind: 'eat', hp: food.hp }
  if (!(itemId in POTION_DEFS)) return null
  if (elementForInfusion(itemId)) return null        // goes on a spirit — `consumeRefusal` says so
  const eff: ConsumeEffect = { kind: 'drink' }
  if (itemId in MANA_POTIONS) eff.mana = MANA_POTIONS[itemId]
  const heal = HEAL_POTIONS[itemId]
  if (heal?.hp) eff.hp = heal.hp
  if (heal?.sh) eff.sh = heal.sh
  const buff = POTION_BUFFS[itemId]
  if (buff) eff.buff = buff
  if (itemId === 'harvest_brew') eff.advanceCropsMs = HARVEST_BREW_ADVANCE_MS
  // A potion the engine names but gives no effect: not drinkable, rather than a drink that does
  // nothing and a bottle gone. The test holds this set at zero so a new brew cannot slip in silent.
  if (eff.mana === undefined && eff.hp === undefined && eff.sh === undefined && !eff.buff && !eff.advanceCropsMs) return null
  return eff
}

export const isConsumable = (itemId: string): boolean => consumeEffect(itemId) !== null

/** Why a right-click with this in hand did nothing — or null when it is simply not a consumable. */
export function consumeRefusal(itemId: string): string | null {
  const el = elementForInfusion(itemId)
  if (el) return `a ${el} infusion goes on a spirit, not in you — and nothing applies it yet`
  return null
}

/** The line the keeper hears. Says what happened; says what did NOT, for a buff nobody reads. */
export function consumeLine(itemId: string, eff: ConsumeEffect, name: string): string {
  const parts: string[] = []
  if (eff.mana) parts.push(`+${eff.mana} mana`)
  if (eff.hp) parts.push(`+${eff.hp} hp`)
  if (eff.sh) parts.push(`+${eff.sh} shield`)
  if (eff.advanceCropsMs) parts.push(`your crops jump ${Math.round(eff.advanceCropsMs / 60_000)}m`)
  if (eff.buff) {
    const b = BUFF_DEFS[eff.buff]
    parts.push(WIRED_BUFFS.has(eff.buff) ? `${b.name} — ${b.line}` : `${b.name} (not felt here yet)`)
  }
  const verb = eff.kind === 'eat' ? 'you eat' : 'you drink'
  return `${verb} the ${name.toLowerCase()}: ${parts.join(' · ')}`
}
