// THE KEEPER'S LOADOUT for the open world: what the Character tab shows and sets (Alex 11-15: "the character panel
// should have the weapons the player carries the primary and secondary.. clicking one opens a dropdown of owned
// weapons ..the vessels should work about the same in respect to tactical and signature slots").
//
// CANON (read-only here): a vessel is a worn thing with a word infused into it; the 1672 keeper standard is the
// BRACELET for the tacticals and the GLOVE for the signature, and a keeper starts with one of each
// (world/mana-tech.md › AMENDED 11-15; game/moves.md; play3d/gems.ts › VESSEL_NOUN). Guns are the five Slates
// (game/weapons.md). BUILD (Jin): "primary / secondary" is UI vocabulary, and so is the rule that the secondary is
// the sidearm slot (canon's sidearm is "backup, finisher": the second gun), the primary any long gun.
//
// ⚠ OWNERSHIP IS A TEST STAND-IN. Guns are not sold yet, so every range gun counts as owned (OWN_ALL_RANGE_GUNS)
// so Alex can try loadouts; flip it off when the gun shop sells. Vessels: the starter pair only, no word written
// (the Passage's vessel shelf is "not trading yet"). Pure store + React hook; localStorage per viewer.

import { useSyncExternalStore } from 'react'
import { RANGE_GUNS, type RangeGun } from './gunplay'
import { keeperKey } from '@/lib/keeper-local'

export const OWN_ALL_RANGE_GUNS = false   // ★ 11-18 (Alex): weapons are acquired; the first two come from Kael's chest at the shipyard
export type VesselKind = 'bracelet' | 'glove'
export interface OwnedVessel { id: string; kind: VesselKind; label: string; word: string | null; tier?: number }
/** canon (play3d/vessels.ts › MAX_PER_KIND): three of a kind is what a keeper can carry */
export const MAX_PER_KIND = 3
export interface Loadout {
  v: 1
  guns: string[]                 // owned gun ids
  primary: string | null
  secondary: string | null
  vessels: OwnedVessel[]
  tactical: string | null        // worn bracelet id
  signature: string | null       // worn glove id
  /** Kael's chest at the shipyard has been opened (the Charred Rifle + the Repeater handed over). Absent on saves from
   *  before 11-18, whose 'owned' guns were the test stand-in: those are taken back on load (see load). */
  kael?: boolean
  /** M81 s2: what each gun is fitted with, by gun id (shared/gun-fit.ts). Absent = the gun's default fitting. Sigils join here (M93). */
  fit?: Record<string, { sight?: string; owned?: string[] }>   // owned = sights BOUGHT for this gun (M81 s3)
}

/** Which slot a Slate goes in: the sidearm is the secondary, every long gun a primary. */
export const slotOfGun = (g: RangeGun): 'primary' | 'secondary' => (g.slot === 'SIDEARM' ? 'secondary' : 'primary')
export const SLOT_OF_VESSEL: Record<VesselKind, 'tactical' | 'signature'> = { bracelet: 'tactical', glove: 'signature' }

export function newLoadout(): Loadout {
  const guns = OWN_ALL_RANGE_GUNS ? RANGE_GUNS.map(g => g.id) : [STARTER_GUN]
  return {
    v: 1, guns, primary: null, secondary: STARTER_GUN, kael: false,
    vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }],
    tactical: 'starter-bracelet', signature: 'starter-glove',
  }
}

export const gunsFor = (l: Loadout, slot: 'primary' | 'secondary') =>
  RANGE_GUNS.filter(g => l.guns.includes(g.id) && slotOfGun(g) === slot)
export const vesselsFor = (l: Loadout, slot: 'tactical' | 'signature') =>
  l.vessels.filter(v => SLOT_OF_VESSEL[v.kind] === slot)

/** Equip a gun or vessel (or null to empty the slot). Refuses what you do not own or what does not fit the slot. */
export function equip(l: Loadout, slot: 'primary' | 'secondary' | 'tactical' | 'signature', id: string | null): Loadout {
  if (id === null) return { ...l, [slot]: null }
  if (slot === 'primary' || slot === 'secondary') {
    const g = RANGE_GUNS.find(x => x.id === id)
    if (!g || !l.guns.includes(id) || slotOfGun(g) !== slot) return l
    return { ...l, [slot]: id }
  }
  const v = l.vessels.find(x => x.id === id)
  if (!v || SLOT_OF_VESSEL[v.kind] !== slot) return l
  return { ...l, [slot]: id }
}

/** THE STARTER GUN (Alex 11-18, later: "the handgun should be the default starting weapon and the charred rifle a bonus they
 *  can find in the shipyard easily"): every keeper is born owning the Repeater, worn as the sidearm (secondary); with no
 *  primary, R draws it. KAEL'S CHEST (canon 11-15: Kael leaves the rifle at the shipyard) adds the Charred Rifle as the
 *  primary, once per keeper. Guns are bought at the Passage gun shop and the other Nyx gun shops (next). */
export const STARTER_GUN = 'repeater'
export const KAEL_PRIMARY = 'charred-rifle', KAEL_SECONDARY = STARTER_GUN
export function claimKaelsArms(l: Loadout): { ok: boolean; loadout: Loadout } {
  if (l.kael) return { ok: false, loadout: l }
  const guns = [...new Set([...l.guns, KAEL_PRIMARY, KAEL_SECONDARY])]
  return { ok: true, loadout: { ...l, guns, primary: l.primary ?? KAEL_PRIMARY, secondary: l.secondary ?? KAEL_SECONDARY, kael: true } }
}

/** Add a bought vessel. Refuses past the carry cap; the new one is not worn until the keeper wears it. */
export function addVessel(l: Loadout, v: Omit<OwnedVessel, 'id'>): { ok: boolean; loadout: Loadout } {
  if (l.vessels.filter(x => x.kind === v.kind).length >= MAX_PER_KIND) return { ok: false, loadout: l }
  const id = `${v.kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`
  return { ok: true, loadout: { ...l, vessels: [...l.vessels, { ...v, id }] } }
}

// ── the store ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const LOADOUT_KEY = 'open.loadout.v1'
const subs = new Set<() => void>()
let cur: Loadout | null = null
const SERVER = newLoadout()
function load(): Loadout {
  try {
    const raw = JSON.parse(localStorage.getItem(keeperKey(LOADOUT_KEY)) ?? 'null') as Loadout | null
    if (raw && raw.v === 1 && Array.isArray(raw.guns)) {
      // a test-period save keeps up with new range guns
      if (OWN_ALL_RANGE_GUNS) for (const g of RANGE_GUNS) if (!raw.guns.includes(g.id)) raw.guns.push(g.id)
      // ★ 11-18: before Kael's chest existed every gun was owned as a TEST STAND-IN; that ownership is taken back once
      if (raw.kael === undefined) return { ...raw, guns: [STARTER_GUN], primary: null, secondary: STARTER_GUN, kael: false }
      // ★ 11-18 later: the Repeater is every keeper's starting gun; a keeper born between the two rulings is handed theirs
      if (!raw.guns.includes(STARTER_GUN)) return { ...raw, guns: [...raw.guns, STARTER_GUN], secondary: raw.secondary ?? STARTER_GUN }
      return raw
    }
  } catch { /* private window */ }
  return newLoadout()
}
// node (tests): whatever setLoadout last set, else the empty default; the browser loads its save on first read
const get = () => { if (typeof window === 'undefined') return cur ?? SERVER; if (!cur) cur = load(); return cur }
export const getLoadout = get
export function setLoadout(next: Loadout) {
  cur = next
  try { localStorage.setItem(keeperKey(LOADOUT_KEY), JSON.stringify(next)) } catch { /* private window */ }
  subs.forEach(f => f())
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const server = () => SERVER
export const useLoadout = () => useSyncExternalStore(subscribe, get, server)
