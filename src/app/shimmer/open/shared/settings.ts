// THE OPEN WORLD'S SETTINGS (Alex 11-15: "if they have tool tips turned on (i just realized the settings menu is
// probably still in voxel)"). A small per-viewer store; the Options panel (open/options-panel.tsx) sets it. Starts with
// what the open world reads today: tooltips (hover/tap explanations and the "are you sure" warnings).

import { useSyncExternalStore } from 'react'

export interface OpenSettings { v: 1; tooltips: boolean }
const DEFAULTS: OpenSettings = { v: 1, tooltips: true }
const KEY = 'open.settings.v1'
const subs = new Set<() => void>()
let cur: OpenSettings | null = null
const load = (): OpenSettings => { try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (s && s.v === 1) return { ...DEFAULTS, ...s } } catch { /* private */ } return DEFAULTS }
const get = () => { if (typeof window === 'undefined') return DEFAULTS; if (!cur) cur = load(); return cur }
export const getSettings = get
export function setSettings(next: Partial<OpenSettings>) {
  cur = { ...get(), ...next }
  try { localStorage.setItem(KEY, JSON.stringify(cur)) } catch { /* private */ }
  subs.forEach(f => f())
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const server = () => DEFAULTS
export const useSettings = () => useSyncExternalStore(subscribe, get, server)
