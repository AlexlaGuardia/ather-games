// THE KEEPER'S COURSERS (BETA M14 whole coursers): owned models + the one driven. Keeper-scoped like the loadout (keeperKey,
// listed in lib/keeper-key-specs.ts so the roster swap and the cloud save carry it). Rules: business/courser-lot.ts.
import { useSyncExternalStore } from 'react'
import { keeperKey } from '@/lib/keeper-local'
import { newFleet, DARTER_ID, type Fleet } from '../business/courser-lot'

export const FLEET_KEY = 'open.fleet.v1'
const subs = new Set<() => void>()
let cur: Fleet | null = null
const SERVER = newFleet()
function load(): Fleet {
  try {
    const raw = JSON.parse(localStorage.getItem(keeperKey(FLEET_KEY)) ?? 'null') as Fleet | null
    if (raw && raw.v === 1 && Array.isArray(raw.owned)) {
      const owned = raw.owned.includes(DARTER_ID) ? raw.owned : [DARTER_ID, ...raw.owned]   // the Darter is never lost
      return { v: 1, owned, active: owned.includes(raw.active) ? raw.active : DARTER_ID }
    }
  } catch { /* private window */ }
  return newFleet()
}
const get = () => { if (typeof window === 'undefined') return cur ?? SERVER; if (!cur) cur = load(); return cur }
export const getFleet = get
export function setFleet(next: Fleet) {
  cur = next
  try { localStorage.setItem(keeperKey(FLEET_KEY), JSON.stringify(next)) } catch { /* private window */ }
  subs.forEach(f => f())
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useFleet = () => useSyncExternalStore(subscribe, get, () => SERVER)
