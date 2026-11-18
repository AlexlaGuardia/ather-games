// THE KEEPER'S SIGHT CUTS, per gun (CANON world/manalic-weapons.md › Sights, RULED 2026-11-18: "the etched mark is cut to the owner's
// choosing. Customising is look, never power"). A keeper-scoped store: { [gunId]: { mark, tint } }. A gun never re-cut reads the plain
// default (sight-marks.defaultLook). Nothing here can touch a number that fires: the only reader that matters is the lens texture
// and the scope ring (fp-gun.tsx). Registered in src/lib/keeper-key-specs.ts so it travels with the keeper (cloud save, roster).
import { useSyncExternalStore } from 'react'
import { keeperKey } from '@/lib/keeper-local'
import { defaultLook, isLook, type SightLook } from './sight-marks'

export const SIGHTS_KEY = 'open.sights.v1'
export type SightLooks = Record<string, SightLook>

/** Pure: read a stored blob, keeping only well-formed looks (a hand-edited or older save never reaches the renderer malformed). */
export function parseLooks(raw: string | null): SightLooks {
  try {
    const v = JSON.parse(raw ?? 'null')
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: SightLooks = {}
    for (const [k, x] of Object.entries(v)) if (typeof k === 'string' && isLook(x)) out[k] = { mark: x.mark, tint: x.tint }
    return out
  } catch { return {} }
}
/** Pure: the look a gun shows (its own cut, else the default for its kind of sight). */
export const lookFor = (all: SightLooks, gunId: string, scoped: boolean): SightLook => all[gunId] ?? defaultLook(scoped)
/** Pure: re-cut one gun, leaving the rest. */
export const withLook = (all: SightLooks, gunId: string, look: SightLook): SightLooks => ({ ...all, [gunId]: { mark: look.mark, tint: look.tint } })

// ── the store ──
let cur: SightLooks | null = null
const subs = new Set<() => void>()
const EMPTY: SightLooks = {}
const load = (): SightLooks => { try { return parseLooks(localStorage.getItem(keeperKey(SIGHTS_KEY))) } catch { return {} } }
const get = () => { if (typeof window === 'undefined') return EMPTY; if (!cur) cur = load(); return cur }
export const getSightLooks = get
export function setSightLook(gunId: string, look: SightLook) {
  cur = withLook(get(), gunId, look)
  try { localStorage.setItem(keeperKey(SIGHTS_KEY), JSON.stringify(cur)) } catch { /* private window */ }
  subs.forEach(f => f())
}
/** Forget the cached copy (a keeper swap changes whose key keeperKey answers). */
export function reloadSightLooks() { cur = null; subs.forEach(f => f()) }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useSightLooks = () => useSyncExternalStore(subscribe, get, () => EMPTY)
