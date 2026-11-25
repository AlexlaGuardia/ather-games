// BETA M153 s1b: THE KEEPER'S OWN NODES. A tutorial node the owner placed in the Glade is one copy PER KEEPER (the Wilds' nodes are the
// plot's: one record per garden), so its records live in keeper keys: how far it is worked (channel.ts), when it grows back (here), and
// what it dropped (ground-loot.ts). Which is which is read off the id alone: `glade:<piece id>:<kind>` (glade-nodes.ts). A record whose
// node was moved, deleted or rolled back away is only a time that runs out: nothing ever looks a node up from its record.
import { keeperKey } from '@/lib/keeper-local'
import { ownerSlot } from '../shared/owner-store'

export const KEEPER_NODE = 'glade:'
export const isKeeperNode = (id: string) => id.startsWith(KEEPER_NODE)

const KEY = 'open.gladespent.v1'
let spent: Record<string, number> = {}   // node id -> when it has grown back (ms)
const subs = new Set<() => void>()
const bump = () => subs.forEach(f => f())
export const onKeeperNodes = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const slot = ownerSlot(() => keeperKey(KEY), () => { spent = {}; bump() })
function load(): void {
  if (!slot.due()) return
  spent = {}
  try {
    const s = JSON.parse(localStorage.getItem(keeperKey(KEY)) ?? 'null')
    if (s && typeof s === 'object' && !Array.isArray(s)) for (const [k, t] of Object.entries(s)) if (typeof t === 'number' && Number.isFinite(t)) spent[k] = t
  } catch { /* fresh */ }
}
function save(now: number): void {
  for (const k of Object.keys(spent)) if (spent[k] <= now) delete spent[k]
  if (slot.writable()) try { localStorage.setItem(keeperKey(KEY), JSON.stringify(spent)) } catch { /* private window */ }
}
export const spentUntil = (id: string) => { load(); return spent[id] ?? 0 }
export function setSpent(id: string, until: number, now = Date.now()): void { load(); spent[id] = until; save(now); bump() }
if (typeof window !== 'undefined') setInterval(() => { load(); const now = Date.now(); if (Object.values(spent).some(t => t <= now)) { save(now); bump() } }, 10_000)
/** Test hook. */
export const _resetKeeperNodes = () => { load(); spent = {}; bump() }
/** a wait as it is shown: m:ss, or h:mm:ss from an hour up (only these nodes wait that long) */
export const waitClock = (sec: number) => { const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = `:${String(sec % 60).padStart(2, '0')}`; return h ? `${h}:${String(m).padStart(2, '0')}${s}` : `${m}${s}` }
