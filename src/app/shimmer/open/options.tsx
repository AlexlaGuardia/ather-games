'use client'

// THE OPEN WORLD'S OPTIONS (Alex 11-15: "the settings menu is probably still in voxel" → "the full settings move").
// The frame and its tab row are the voxel world's own (hud/options-panel.tsx: Game · Video · Sound · Controls, Dev for
// the owner); this composes the OPEN WORLD's levers into it, read live by every page from shared/settings.ts.
// Opens with O, with Esc once the mouse is already free, from the pack's gear, and from a phone tap.
//
// Keys are listed, not rebindable yet: the open world's keys are written per page, and rebinding means one keymap for
// all of them first (the voxel BindingsPanel is the model for that step).

import { useEffect, useState, useSyncExternalStore } from 'react'
import { OptionsPanel, OptionRow, OptionSlider, OptionHead } from '../hud/options-panel'
import { hearthDisplay } from '../ui/hearth'
import { useSettings, setSettings, resetSettings, FOV_RANGE, RENDER_RANGE, SENS_RANGE } from './shared/settings'
import { keeperKey } from '@/lib/keeper-local'
import { BIRTH_KEY } from '../play3d/rune-inventory'
import { refreshBirth } from './birth-gate'
import { ACTIONS, RESERVED, useKeymap, keyFor, keyName, setBinding, resetKeymap, setCapturing, installKeymap } from './shared/keymap'

function Toggle({ label, on, onFlip, sub, id }: { label: string; on: boolean; onFlip: () => void; sub?: string; id: string }) {
  return (
    <button type="button" data-setting={id} onClick={onFlip}
      className="flex w-full min-h-[40px] items-center justify-between gap-3 rounded-[10px] px-3 py-1.5 text-left text-[13px] font-bold hk-ink transition-all hover:-translate-y-px"
      style={{ background: 'rgba(255,250,238,.6)', boxShadow: '0 1px 3px rgba(58,39,22,.18)' }}>
      <span>{label}{sub && <span className="block text-[11.5px] font-medium hk-faint">{sub}</span>}</span>
      <span className="relative w-10 h-[22px] rounded-full shrink-0 transition-colors" style={{ background: on ? '#c8642a' : 'rgba(58,39,22,.25)' }}>
        <span className="absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all" style={{ left: on ? 20 : 2, background: '#fbf4e4', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
      </span>
    </button>
  )
}

/** ★ REBINDING: click an action, press a key. A key already driving another action swaps with it. Esc cancels. */
function Bindings() {
  const k = useKeymap()
  const [listen, setListen] = useState<string | null>(null)
  useEffect(() => {
    if (!listen) return
    setCapturing(true)
    const grab = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopImmediatePropagation()
      if (e.code === 'Escape') { setListen(null); return }
      if (RESERVED.has(e.code)) return
      setBinding(listen, e.code); setListen(null)
    }
    window.addEventListener('keydown', grab, true)
    return () => { window.removeEventListener('keydown', grab, true); setCapturing(false) }
  }, [listen])
  return (
    <div className="grid gap-1" data-bindings>
      {ACTIONS.map(a => {
        const on = listen === a.code, moved = keyFor(k, a.code) !== a.code
        return (
          <button key={a.code} type="button" data-bind={a.code} onClick={() => setListen(on ? null : a.code)}
            className="flex items-center justify-between gap-3 rounded-[9px] px-2.5 py-1.5 text-left text-[12.5px] transition-all"
            style={{ background: on ? 'rgba(200,100,42,.16)' : 'rgba(255,250,238,.55)', boxShadow: on ? 'inset 0 0 0 1.5px #c8642a' : '0 1px 2px rgba(58,39,22,.14)' }}>
            <span className="hk-soft">{a.label}</span>
            <span className="min-w-[64px] text-center rounded-[6px] px-2 py-0.5 font-bold tabular-nums"
              style={{ background: on ? '#c8642a' : 'rgba(58,39,22,.10)', color: on ? '#fbf4e4' : moved ? '#8d4119' : '#3a2716' }}>
              {on ? 'press a key' : keyName(keyFor(k, a.code))}
            </span>
          </button>
        )
      })}
      <p className="text-[11.5px] italic leading-snug hk-faint" style={hearthDisplay}>A key already in use swaps over. Esc cancels. Esc, Tab, the arrows and the mouse stay where they are.</p>
      <OptionRow onClick={resetKeymap} label="Reset keys" tail="defaults" />
    </div>
  )
}

/** Owner test lever (Alex 11-15: "clear my save for now to test that"): forget ONLY the birth rune, so the first-entry
 *  ritual shows again. Two taps, and nothing else in the save is touched (bag, Marks, loadout, garden stay). */
function ForgetBirth({ onDone }: { onDone: () => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <OptionRow onClick={() => {
      if (!armed) { setArmed(true); return }
      try { const birthKey = keeperKey(BIRTH_KEY); localStorage.removeItem(birthKey) } catch { /* private */ }
      refreshBirth(); setArmed(false); onDone()
    }} label={armed ? '⚠ Tap again: forget my birth rune' : '↺ Forget my birth rune'} tail={armed ? 'sure?' : 'see the ritual'} />
  )
}

/** The keys this page answers, for the Controls tab. Each page passes its own. */
export type KeyRow = [keys: string, what: string]
/** What stays fixed (the rebindable keys are listed by Bindings). */
export const WALK_KEYS: KeyRow[] = [
  ['Mouse', 'look'], ['Esc', 'free the mouse · options · close'], ['Tab · ← →', 'switch tabs in the pack'], ['1–8 · wheel', 'hotbar'],
]

export function OpenOptions({ onClose, keys = WALK_KEYS, extraGame }: { onClose: () => void; keys?: KeyRow[]; extraGame?: React.ReactNode }) {
  const s = useSettings()
  const [isOwner, setOwner] = useState(false)
  useEffect(() => { fetch('/api/owner', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => setOwner(!!j?.owner)).catch(() => {}) }, [])
  return (
    <div data-panel="options" className="fixed inset-0 z-[40] pointer-events-none">
      <OptionsPanel onClose={onClose} isOwner={isOwner}
        game={<>
          <Toggle id="tooltips" label="Tooltips" sub="explanations on hover, and a warning before a buy that is not written for you" on={s.tooltips} onFlip={() => setSettings({ tooltips: !s.tooltips })} />
          {extraGame}
        </>}
        video={<>
          <OptionHead>View</OptionHead>
          <OptionSlider label="field of view" min={FOV_RANGE[0]} max={FOV_RANGE[1]} step={1} value={s.fov} onChange={v => setSettings({ fov: v })} format={v => `${Math.round(v)}°`} />
          <Toggle id="speedFov" label="Speed widens the view" sub="the kick when you run, slide and chain" on={s.speedFov} onFlip={() => setSettings({ speedFov: !s.speedFov })} />
          <OptionHead>Render</OptionHead>
          <OptionSlider label="sharpness" min={RENDER_RANGE[0]} max={RENDER_RANGE[1]} step={0.05} value={s.renderScale} onChange={v => setSettings({ renderScale: v })} format={v => `${v.toFixed(2)}×`} />
          <p className="text-[12px] italic leading-snug hk-faint" style={hearthDisplay}>Lower runs faster on a slow graphics chip; higher is crisper on a big screen. Capped at your screen&apos;s own density.</p>
        </>}
        sound={<>
          <OptionSlider label="volume" value={s.volume} onChange={v => setSettings({ volume: v })} format={v => `${Math.round(v * 100)}%`} />
          <p className="text-[12px] italic leading-snug hk-faint" style={hearthDisplay}>The open world is quiet for now. This is kept for when its sound arrives.</p>
        </>}
        controls={<>
          <OptionHead>Look</OptionHead>
          <OptionSlider label="mouse" min={SENS_RANGE[0]} max={SENS_RANGE[1]} step={0.05} value={s.mouseSens} onChange={v => setSettings({ mouseSens: v })} format={v => `${v.toFixed(2)}×`} />
          <OptionSlider label="touch" min={SENS_RANGE[0]} max={SENS_RANGE[1]} step={0.05} value={s.touchSens} onChange={v => setSettings({ touchSens: v })} format={v => `${v.toFixed(2)}×`} />
          <Toggle id="invertY" label="Invert look up / down" on={s.invertY} onFlip={() => setSettings({ invertY: !s.invertY })} />
          <OptionRow onClick={resetSettings} label="Reset look settings" tail="defaults" />
          <OptionHead>Keys</OptionHead>
          <Bindings />
          <OptionHead>Fixed</OptionHead>
          <div className="grid gap-1" data-keys>
            {keys.map(([k, what]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="font-bold tabular-nums hk-ink whitespace-nowrap">{k}</span><span className="text-right hk-soft">{what}</span>
              </div>
            ))}
          </div>
        </>}
        dev={<>
          <OptionHead tone="hk-ember">Keeper of the realm</OptionHead>
          <OptionRow href="/shimmer/open/ather?tune=1" label="⚑ Ather tune mode" tail="] skips days" />
          <OptionRow href="/shimmer/open/continent" label="⛰ The continent" tail="drive" />
          <OptionRow href="/shimmer/dev" label="✧ Dev hub" tail="editors" />
          <OptionRow href="/shimmer/play3d/birth" label="✺ Choose a birth rune" tail="voxel" />
          <ForgetBirth onDone={onClose} />
        </>}
      />
    </div>
  )
}

/**
 * O toggles Options; Esc OPENS it, but only when the mouse was already free. ⚠ The Esc that exits pointer lock
 * reaches this listener too, and by then `pointerLockElement` can already be null, so "unlocked now" is not
 * "was unlocked": an Esc within UNLOCK_GRACE ms of the unlock is the one that freed the mouse and is ignored
 * (hub's caution, 11-15; headless-checked: lock → Esc does not open, Esc again does). `busy` = another panel is up
 * (its own Esc closes it; this stays out of the way).
 */
const UNLOCK_GRACE = 400
// one open/closed flag for the whole open world, so the pack's gear, O, Esc and a phone tap all drive the same panel
let optionsOpen = false
const osubs = new Set<() => void>()
export function setOptionsOpen(v: boolean) { if (v === optionsOpen) return; optionsOpen = v; osubs.forEach(f => f()) }
const osub = (f: () => void) => { osubs.add(f); return () => { osubs.delete(f) } }
const oget = () => optionsOpen, oserver = () => false
export const useOptionsOpen = () => useSyncExternalStore(osub, oget, oserver)

export function useOptionsKeys(busy: boolean) {
  useEffect(() => {
    // ⚠ The Esc that FREES the mouse must not open Options, and the browser does not promise an order: the unlock event
    // can land after the keydown (measured on the continent), and a sampling timer starves at low frame rates (it did
    // in headless at 2 fps). So the decision waits a beat and asks one order-proof question: did an UNLOCK happen within
    // UNLOCK_GRACE of this keypress, before it or after it? Then this Esc was the one that freed the mouse.
    let unlockedAt = -1e9
    const change = () => { if (!document.pointerLockElement) unlockedAt = performance.now() }
    let pending: ReturnType<typeof setTimeout> | null = null
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'KeyO' && (!busy || optionsOpen)) { setOptionsOpen(!optionsOpen); return }
      if (e.code !== 'Escape') return
      if (optionsOpen) { setOptionsOpen(false); return }
      if (busy || document.pointerLockElement) return
      const t = performance.now()
      if (pending) clearTimeout(pending)
      pending = setTimeout(() => {
        pending = null
        if (document.pointerLockElement || Math.abs(unlockedAt - t) < UNLOCK_GRACE) return
        setOptionsOpen(true)
      }, 120)
    }
    document.addEventListener('pointerlockchange', change)
    window.addEventListener('keydown', key)
    return () => { if (pending) clearTimeout(pending); document.removeEventListener('pointerlockchange', change); window.removeEventListener('keydown', key) }
  }, [busy])
  useEffect(() => () => setOptionsOpen(false), [])
  // the key rebinding layer (shared/keymap.ts) rides this hook, so every page that has Options has rebinding
  useEffect(() => installKeymap(), [])
}
