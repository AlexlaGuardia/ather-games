// ── FITTING A GUN (BETA M81 s2): which sight sits on each kit gun's rail, saved per keeper in the loadout ─────────────────────
// Alex 11-22: "customizing the gun with a sight and runeword in the character tab, the armory can showcase it, but the gunshops
// are where they upgrade them". The Character tab fits any OWNED sight per gun; fp-gun draws kitModel(gun, fitted sight) and aims
// through that sight's optic. Pure (no React), so the tests and the rig read the same answer.
//
// ★ The DEFAULT fitting is the sight whose optic each gun aims through TODAY (both rails: the 2x scope), so loading a keeper from
// before M81 changes nothing about how their gun aims; the gun's own stamped sight is one tap away.
// Owned (M81 s3, hub 11-22): FREE = the gun's own sight + the one it aims through today (the 2x); everything else is BOUGHT at a gun
// shop for that gun (Loadout.fit[gun].owned). GRANDFATHERED: a sight fitted before s3 (any of the old free set, e.g. the open lens)
// stays owned, so nobody loses what they had on.
import { KIT_GUNS, KIT_SIGHTS, kitModel, sightsFor, type KitGunId, type KitSightId, type Model } from './gun-kit'
import { opticOf, type OpticId } from './optics'
import { RANGE_GUNS } from './gunplay'
import type { Loadout } from './loadout'

export const isKitGun = (id: string): id is KitGunId => id in KIT_GUNS
const isSight = (id: unknown): id is KitSightId => typeof id === 'string' && id in KIT_SIGHTS

/** the sight a kit gun wears when nothing was fitted: the one matching the optic it aims through today */
export function defaultSight(gunId: KitGunId): KitSightId {
  const row = RANGE_GUNS.find(g => g.id === gunId), today: OpticId = opticOf(row ?? { slot: 'LONGBARREL' }).id
  return sightsFor(KIT_GUNS[gunId]).find(s => KIT_SIGHTS[s].optic === today) ?? KIT_GUNS[gunId].own
}
/** the sights this keeper may fit to this gun (s3's shop purchases add to it) */
export function freeSights(gunId: KitGunId): KitSightId[] {
  const own = KIT_GUNS[gunId].own, d = defaultSight(gunId)
  return own === d ? [own] : [own, d]
}
export function ownedSights(l: Loadout, gunId: string): KitSightId[] {
  if (!isKitGun(gunId)) return []
  const f = l.fit?.[gunId], out = freeSights(gunId)
  const add = (s: unknown) => { if (isSight(s) && !out.includes(s)) out.push(s) }
  if (sightsFor(KIT_GUNS[gunId]).includes(f?.sight as KitSightId)) add(f?.sight)   // grandfathered: fitted from the old free set
  for (const s of f?.owned ?? []) add(s)
  return sightsFor(KIT_GUNS[gunId]).concat(Object.keys(KIT_SIGHTS) as KitSightId[]).filter((s, i, a) => a.indexOf(s) === i && out.includes(s))   // a stable order
}
/** a bought sight joins this gun's owned set */
export function addOwnedSight(l: Loadout, gunId: KitGunId, sightId: KitSightId): Loadout {
  const f = l.fit?.[gunId] ?? {}, owned = f.owned ?? []
  return owned.includes(sightId) ? l : { ...l, fit: { ...l.fit, [gunId]: { ...f, owned: [...owned, sightId] } } }
}
/** the fitted sight, or null for a gun without a rail */
export function fittedSight(l: Loadout, gunId: string): KitSightId | null {
  if (!isKitGun(gunId)) return null
  const s = l.fit?.[gunId]?.sight
  return isSight(s) && ownedSights(l, gunId).includes(s) ? s : defaultSight(gunId)
}
export type FitResult = { ok: true; loadout: Loadout } | { ok: false; why: 'no-rail' | 'not-owned' | 'not-yours' }
/** fit an owned sight to an owned kit gun */
export function fitSight(l: Loadout, gunId: string, sightId: string): FitResult {
  if (!isKitGun(gunId)) return { ok: false, why: 'no-rail' }
  if (!l.guns.includes(gunId)) return { ok: false, why: 'not-yours' }
  if (!isSight(sightId) || !ownedSights(l, gunId).includes(sightId)) return { ok: false, why: 'not-owned' }
  // a grandfathered sight (fitted before s3, never bought) is written into owned as it comes off, so swapping never loses it
  const cur = l.fit?.[gunId]?.sight, base = isSight(cur) && cur !== sightId && !freeSights(gunId).includes(cur) && ownedSights(l, gunId).includes(cur) ? addOwnedSight(l, gunId, cur) : l
  return { ok: true, loadout: { ...base, fit: { ...base.fit, [gunId]: { ...base.fit?.[gunId], sight: sightId } } } }
}
// the drawn model, one object per (gun, sight): fp-gun keys its geometry on the model, so a fresh object each frame would rebuild it
const cache = new Map<string, Model>()
/** the model a kit gun draws with its fitted sight, or null for a gun the kit does not cover (fp-gun keeps its own) */
export function fittedModel(l: Loadout, gunId: string): Model | null {
  const s = fittedSight(l, gunId); if (!s || !isKitGun(gunId)) return null
  const k = `${gunId}:${s}`
  let m = cache.get(k); if (!m) { m = kitModel(gunId, s); cache.set(k, m) }
  return m
}
export const sightName = (id: KitSightId) => KIT_SIGHTS[id].name
