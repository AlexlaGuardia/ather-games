// A FITTED SIGIL TUNES THE GUN IN HAND (BETA M93 s4, sprites lane). The sigil lives on Loadout.fit[gun].sigil (Idris cuts it,
// business/idris.ts); this is the one place the game turns it into the gun it fires: sigil.ts tuneGun over the gun's row, with
// the keeper's birth rune (a matching FIRST rune halves the reload's mana, canon). An untuned gun is returned as-is (same
// object), so every gun without a sigil plays exactly as before.
// ⚠ Applied: velocity, range, recoil, spread, handling (ADS move), reload time, fire rate, reload mana. NOT applied yet:
//   mobility (moveMult: the walker does not read a held gun's weight) and heat (heatMult: no gun heats). The Armory says so.
// ★ RELOAD MANA: the open world charges the flat M78 dial (vitals-economy ECON.reloadMana) for every gun; a range gun row's own
//   `reloadMana` is play3d's number and is NOT what a reload here costs (vitals-economy says so). So the sigil tunes the DIAL,
//   and the result rides a separate field, `reloadPay`, which payReload's callers read. The row's reloadMana is left alone.
import { sigilSlots, tuneGun, type Sigil, type TunableGun } from './sigil'
import { ECON } from './vitals-economy'
import type { Loadout } from './loadout'

/** a gun with its sigil's reload cost (open-world mana); absent = the M78 dial */
export type Armed = { reloadPay?: number }

/** the sigil on a gun, as sigil.ts reads it (empty when none has been set) */
export function sigilOf(l: Loadout, gunId: string): Sigil {
  const r = l.fit?.[gunId]?.sigil
  return { gunId, runes: Array.isArray(r) ? r.filter(x => typeof x === 'string') : [] }
}

const tunable = (g: object): g is TunableGun =>
  ['projSpeed', 'projLife', 'kickPitch', 'kickYaw', 'hipSpread', 'adsSpread', 'bloomPerShot', 'bloomMax', 'adsMove', 'reloadTime', 'fireCd']
    .every(k => typeof (g as Record<string, unknown>)[k] === 'number')

/** the gun as it fires with its fitted sigil. `g` untouched (same object) when the gun has no socket or no runes cut. */
export function armedGun<G extends { id: string }>(g: G, l: Loadout, birthRune?: string | null): G & Armed {
  const s = sigilOf(l, g.id)
  if (sigilSlots(g.id) < 1 || !s.runes.length || !tunable(g)) return g
  const own = (g as { reloadMana?: number }).reloadMana
  const t = tuneGun({ ...(g as G & TunableGun), reloadMana: ECON.reloadMana }, s, birthRune)
  return { ...t, reloadMana: own, reloadPay: t.reloadMana } as G & Armed
}
/** what one reload of this (armed) gun costs in open-world mana */
export const reloadPayOf = (g: object): number => (g as Armed).reloadPay ?? ECON.reloadMana
/** a short key that changes when the gun's sigil or the birth rune changes (for effect deps) */
export const sigilKey = (l: Loadout, gunId: string, birthRune?: string | null) => `${gunId}:${sigilOf(l, gunId).runes.join('.')}:${birthRune ?? ''}`
