'use client'
// The keeper's look, as a store every surface shares (BETA M29; rules in keeper-look.ts). Per keeper: keeperKey(LOOK_KEY).
// A keeper born before M29 has no saved look and draws as DEFAULT_LOOK until they change it (Character tab › Change look).
import { useSyncExternalStore } from 'react'
import { keeperKey } from '@/lib/keeper-local'
import { DEFAULT_LOOK, LOOK_KEY, parseLook, type Look } from './keeper-look'

let look: Look | null = null
const subs = new Set<() => void>()
const read = (): Look => {
  if (!look) { try { look = parseLook(JSON.parse(localStorage.getItem(keeperKey(LOOK_KEY)) ?? 'null')) ?? DEFAULT_LOOK } catch { look = DEFAULT_LOOK } }
  return look
}
/** has this keeper chosen a look (vs drawing as the default)? */
export function lookChosen(): boolean { try { return !!parseLook(JSON.parse(localStorage.getItem(keeperKey(LOOK_KEY)) ?? 'null')) } catch { return false } }
export function saveLook(l: Look) { look = l; try { localStorage.setItem(keeperKey(LOOK_KEY), JSON.stringify(l)) } catch { /* private window */ } subs.forEach(f => f()) }
/** re-read after a keeper swap / sign-in (the key moved) */
export function refreshLook() { look = null; subs.forEach(f => f()) }
export const getLook = () => (typeof window === 'undefined' ? DEFAULT_LOOK : read())
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useLook = () => useSyncExternalStore(subscribe, getLook, () => DEFAULT_LOOK)
