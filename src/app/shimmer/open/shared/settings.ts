// THE OPEN WORLD'S SETTINGS (Alex 11-15: "lets go with the full settings move"). A per-viewer store the Options panel
// (open/options.tsx, on the shared hud/options-panel.tsx frame) writes and every open-world page reads LIVE, by
// `getSettings()` inside its frame loop or input handler (no remount needed when a slider moves).
//
// Every lever here changes something in the open world today; the one exception says so (volume: the open world is
// silent for now, the value waits for sound). Multipliers, not raw values, so the tuned constants in each page stay the
// one source of the base feel (SENS 0.0022, TOUCH_LOOK_SENS 0.0055, the 75 deg walk view).

import { useSyncExternalStore } from 'react'

export interface OpenSettings {
  v: 1
  /** hover/tap explanations, and the "are you sure" warnings (the vessel counter) */
  tooltips: boolean
  /** walking field of view, degrees (the continent's driving camera keeps its own) */
  fov: number
  /** the view widening with speed (the run/slide kick); off for anyone it makes queasy */
  speedFov: boolean
  /** render resolution cap as a multiple of CSS pixels (1.25 was the fixed cap): lower = faster on a weak GPU */
  renderScale: number
  /** look sensitivity multipliers */
  mouseSens: number
  touchSens: number
  invertY: boolean
  /** master volume, 0..1 (stored; the open world has no sound yet) */
  volume: number
}
export const SETTINGS_DEFAULTS: OpenSettings = { v: 1, tooltips: true, fov: 75, speedFov: true, renderScale: 1.25, mouseSens: 1, touchSens: 1, invertY: false, volume: 0.8 }
export const FOV_RANGE = [60, 100] as const, RENDER_RANGE = [0.6, 2] as const, SENS_RANGE = [0.3, 2.5] as const

const KEY = 'open.settings.v1'
const subs = new Set<() => void>()
let cur: OpenSettings | null = null
const clamp = (v: number, [a, b]: readonly [number, number]) => Math.max(a, Math.min(b, v))
function sane(s: OpenSettings): OpenSettings {
  return { ...s, fov: clamp(s.fov, FOV_RANGE), renderScale: clamp(s.renderScale, RENDER_RANGE), mouseSens: clamp(s.mouseSens, SENS_RANGE), touchSens: clamp(s.touchSens, SENS_RANGE), volume: clamp(s.volume, [0, 1]) }
}
const load = (): OpenSettings => {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (s && s.v === 1) return sane({ ...SETTINGS_DEFAULTS, ...s }) } catch { /* private */ }
  return SETTINGS_DEFAULTS
}
const get = () => { if (typeof window === 'undefined') return SETTINGS_DEFAULTS; if (!cur) cur = load(); return cur }
export const getSettings = get
export function setSettings(next: Partial<OpenSettings>) {
  cur = sane({ ...get(), ...next })
  try { localStorage.setItem(KEY, JSON.stringify(cur)) } catch { /* private */ }
  subs.forEach(f => f())
}
export const resetSettings = () => setSettings({ ...SETTINGS_DEFAULTS, tooltips: get().tooltips })
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
const server = () => SETTINGS_DEFAULTS
export const useSettings = () => useSyncExternalStore(subscribe, get, server)

/** The pixel-ratio cap a renderer should use now. */
export const pixelRatioCap = () => (typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, get().renderScale))
/** Look deltas, sensitivity applied: pass the page's base constant; returns [yaw, pitch] multipliers' product. */
export const lookScale = (kind: 'mouse' | 'touch') => (kind === 'mouse' ? get().mouseSens : get().touchSens)
export const pitchSign = () => (get().invertY ? -1 : 1)
