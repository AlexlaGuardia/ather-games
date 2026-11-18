// THE STANCE — what the keeper has in hand (Alex 11-15: "first we have the weapon stowed state.. this should be the
// default.. with increased movement speed. then the R key pulls out the primary, tap again to swap, hold to stow
// again.. while stowed the scroll wheel or num pad selects a hot bar item to hold, holding the R key stows it again..
// as long as the weapon is stowed simply interacting with a node should just automatically use the right tool").
//
//   stowed  — the default: hands free, a little faster on foot, and a node you look at is worked with the right tool
//             from the tool sockets round the mana orb (engine/tools.ts: Greg's worn set, later the tiered ones)
//   weapon  — R drew it: the primary (first gun in the bag) or, after another tap, the secondary (the second gun)
//   item    — a hotbar slot picked with the wheel or 1-8 while not holding a weapon
//
//   R tap   : stowed / item → the primary · weapon → the other weapon, or a RELOAD when there is no second gun
//   R hold  : anything → stowed
//   1-8         : stowed / item → that slot (a gun in it draws as the weapon; an empty slot stows) · weapon → ignored
//   wheel roll  : lights a CURSOR on the bar, equips nothing (Alex 11-16: "with a roll of the scrollwheel the hotbar
//                 lights up and the player can select an item and click the scroll wheel to equip it")
//   wheel click : equips the lit slot from ANY stance, a drawn gun included (equipSlot)
//
// ★ PURE. The page owns the state; this decides every transition so the rules have one home and a test.

import { getLoadout } from './loadout'
import type { Inv } from './inventory'
import { itemDef } from './inventory'

export type Stance = { kind: 'stowed' } | { kind: 'weapon'; which: 0 | 1 } | { kind: 'item'; slot: number }
export const STOWED: Stance = { kind: 'stowed' }
/** On foot, hands free: a little quicker (build; tune with play). */
export const STOWED_SPEED = 1.2
/** How long R must be held before it stows (a shorter press is a tap). */
export const HOLD_MS = 350

/** The keeper's weapons: the equipped PRIMARY then SECONDARY (the Character tab, loadout.ts), never bag items (Alex 11-18).
 *  `inv` stays in the signature so every caller keeps working; guns no longer live in it. */
export function weapons(_inv?: Inv): string[] {
  const l = getLoadout()
  return [l.primary, l.secondary].filter((x): x is string => !!x)
}

export type RTap = { stance: Stance; reload: boolean }
export function tapR(st: Stance, inv: Inv): RTap {
  const w = weapons(inv)
  if (!w.length) return { stance: st, reload: false }
  if (st.kind !== 'weapon') return { stance: { kind: 'weapon', which: 0 }, reload: false }
  if (w.length > 1) return { stance: { kind: 'weapon', which: st.which === 0 ? 1 : 0 }, reload: false }
  return { stance: st, reload: true }
}
export const holdR = (_st: Stance): Stance => STOWED

export function selectSlot(st: Stance, slot: number, inv: Inv): Stance {
  if (st.kind === 'weapon') return st
  const s = inv.slots[slot]
  if (!s) return STOWED
  if (itemDef(s.id).kind === 'gun') { const i = weapons(inv).indexOf(s.id); return { kind: 'weapon', which: (i === 1 ? 1 : 0) } }
  return { kind: 'item', slot }
}

/** The wheel click: put the lit slot in hand whatever is held now (a drawn gun goes away for it). */
export function equipSlot(st: Stance, slot: number, inv: Inv): Stance {
  return selectSlot(st.kind === 'weapon' ? STOWED : st, slot, inv)
}

/** What is in hand (an item id), or null when stowed. */
export function heldOf(st: Stance, inv: Inv): string | null {
  if (st.kind === 'weapon') return weapons(inv)[st.which] ?? null
  if (st.kind === 'item') return inv.slots[st.slot]?.id ?? null
  return null
}
/** The hotbar slot to light up (-1 = none): the held item's, or the drawn gun's if it sits on the bar. */
export function litSlot(st: Stance, inv: Inv, hotbar = 8): number {
  if (st.kind === 'item') return st.slot
  if (st.kind === 'weapon') { const id = heldOf(st, inv); const i = inv.slots.findIndex(s => s?.id === id); return i >= 0 && i < hotbar ? i : -1 }
  return -1
}
/** A held item that is spent or moved away falls back to stowed (planting your last waymark empties the hand). */
export function settle(st: Stance, inv: Inv): Stance {
  if (st.kind === 'item' && !inv.slots[st.slot]) return STOWED
  if (st.kind === 'weapon' && !weapons(inv)[st.which]) return weapons(inv).length ? { kind: 'weapon', which: 0 } : STOWED
  return st
}
