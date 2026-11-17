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

export const OWN_ALL_RANGE_GUNS = true
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
}

/** Which slot a Slate goes in: the sidearm is the secondary, every long gun a primary. */
export const slotOfGun = (g: RangeGun): 'primary' | 'secondary' => (g.slot === 'SIDEARM' ? 'secondary' : 'primary')
export const SLOT_OF_VESSEL: Record<VesselKind, 'tactical' | 'signature'> = { bracelet: 'tactical', glove: 'signature' }

export function newLoadout(): Loadout {
  const guns = OWN_ALL_RANGE_GUNS ? RANGE_GUNS.map(g => g.id) : ['repeater']
  return {
    v: 1, guns, primary: guns.includes('backbone') ? 'backbone' : null, secondary: 'repeater',
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
      return raw
    }
  } catch { /* private window */ }
  return newLoadout()
}
const get = () => { if (typeof window === 'undefined') return SERVER; if (!cur) cur = load(); return cur }
export const getLoadout = get
export function setLoadout(next: Loadout) {
  cur = next
  try { localStorage.setItem(keeperKey(LOADOUT_KEY), JSON.stringify(next)) } catch { /* private window */ }
  subs.forEach(f => f())
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const server = () => SERVER
export const useLoadout = () => useSyncExternalStore(subscribe, get, server)
