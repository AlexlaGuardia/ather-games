// M78 MANA + HEALTH ECONOMY (Alex 11-22, Jin play 59870cb7): "make mana felt". Every dial for the keeper's mana refill,
// health regen, potions and reload cost lives HERE, both worlds (ather/page.tsx + continent/page.tsx via shared/use-casts.ts,
// ather/combat.ts, ather/alchemy.ts). Build numbers, tuned "with testing": Alex feels them after.
//   Before M78: mana refilled 1.5/s always on, HP 8/s after 5 s unhurt, Health Draught healed 40 x potency, reloads were free,
//   potions had no cooldown.
// Healer vessels (Healing Grove etc.) are untouched on purpose: they are the in-fight healing lane.
import type { Grade } from '../ather/farming'

export const ECON = {
  /** mana refill per second, once the pause after a spend has run out (100 in ~250 s) */
  manaRegen: 0.4,
  /** seconds the refill holds still after ANY spend (cast, channel, gate, gathering, reload) */
  manaPause: 3,
  /** Ather Infusion (Ather Flow) multiplies the refill by this (ather/alchemy.ts › OPEN_FLOW_MULT reads it) */
  flowMult: 2,
  /** how long one Ather Infusion lasts in the open world. The row allows 60-300 s by grade; the infusion is a plain (ungraded)
   *  bottle, so one span: 3 min, the middle. The engine's 10 min (BUFF_DEFS) was paired with a 1-a-minute trickle. */
  flowMs: 3 * 60_000,
  /** health regen per second, after `hpDelay` seconds unhurt */
  hpRegen: 0.3,
  hpDelay: 5,
  /** Health Draught: an instant chunk of max HP by its grade (replaces heal 40 x potency) */
  draughtPct: { D: 0.25, C: 0.35, B: 0.45, A: 0.6, S: 0.75 } as Readonly<Record<Grade, number>>,
  /** one cooldown shared by every drinkable potion, seconds */
  potionCd: 15,
  /** mana one reload costs, any gun (gunplay.ts › reloadMana 11/14/12 stays play3d's number; it would be ~30 s of refill here) */
  reloadMana: 3,
  /** M80 hold F: the keeper's own Mana Skin. Most skin a charge holds */
  skinCap: 50,
  /** skin bought per mana (Alex: 2 mana per 10 skin) */
  skinPerMana: 5,
  /** seconds F must be held before the skin starts filling */
  skinStall: 1,
  /** skin per second while filling (the row names none: 20/s fills the cap in 2.5 s for 10 mana; Alex tunes) */
  skinRate: 20,
} as const

/** The refill clock rides on the mana object itself: `seen` = the bar after the last tick, `spentAt` = when it last went DOWN. */
export type ManaPool = { cur: number; max: number; regen: number; seen?: number; spentAt?: number }

/** One refill tick (`now` in seconds). A spend anywhere since the last tick shows as `cur < seen` and restarts the pause,
 *  so no spender has to remember to tell the clock. Refills only once `manaPause` has passed since that spend. */
export function manaTick(m: ManaPool, now: number, dt: number, flow = 1): void {
  if (m.seen !== undefined && m.cur < m.seen - 1e-6) m.spentAt = now
  const resting = m.spentAt === undefined || now - m.spentAt >= ECON.manaPause
  if (resting && m.cur < m.max) m.cur = Math.min(m.max, m.cur + m.regen * flow * dt)
  m.seen = m.cur
}

/** What a Health Draught of `grade` heals a keeper with `hpMax` (whole HP). */
export const draughtHeal = (grade: Grade, hpMax: number) => Math.round(ECON.draughtPct[grade] * hpMax)

/** Seconds left on the shared potion cooldown (0 = ready). `lastAt`/`now` in seconds; null = never drunk. */
export const potionCdLeft = (lastAt: number | null, now: number) => (lastAt === null ? 0 : Math.max(0, ECON.potionCd - (now - lastAt)))
export const potionWaitLine = (left: number) => `Too soon for another. Wait ${Math.ceil(left)} s.`

/** Can a reload be paid for? Spends on yes. `pool` absent = a host that has no mana (the range): free. */
export function payReload(pool: { cur: number } | undefined, cost: number = ECON.reloadMana): boolean {
  // M93 s4: `cost` = the gun's sigil-tuned reload mana (gun-sigil.ts armedGun › reloadPay); absent = the M78 dial
  if (!pool) return true
  if (pool.cur < cost) return false
  pool.cur -= cost
  return true
}
export const RELOAD_DRY_LINE = 'Not enough mana to reload. Rest, or head home.'

/** M80: one charge in progress. `heldFor` = seconds F has been down (0 = up). */
export type SkinCharge = { heldFor: number }
/** One tick of hold-F: nothing for `skinStall` s, then the skin climbs at `skinRate`, paid at `skinPerMana`, to the cap.
 *  Letting go resets the stall; an empty bar stops it (the spend shows as a spend, so the M78 refill pauses). */
export function skinStep(ch: SkinCharge, held: boolean, dt: number, mana: { cur: number }, skin: { cur: number }, cap: number = ECON.skinCap): void {
  if (!held) { ch.heldFor = 0; return }
  ch.heldFor += dt
  const filling = Math.min(dt, ch.heldFor - ECON.skinStall)
  if (filling <= 0) return
  const add = Math.min(ECON.skinRate * filling, cap - skin.cur, mana.cur * ECON.skinPerMana)
  if (add <= 0) return
  skin.cur += add; mana.cur = Math.max(0, mana.cur - add / ECON.skinPerMana)
}
