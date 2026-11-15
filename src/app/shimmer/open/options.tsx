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

/** The keys this page answers, for the Controls tab. Each page passes its own. */
export type KeyRow = [keys: string, what: string]
export const WALK_KEYS: KeyRow[] = [
  ['W A S D', 'move'], ['Mouse', 'look'], ['Space', 'jump · again in the air · hold to climb'], ['Shift', 'slide (hold out of it to skid)'],
  ['E', 'use · talk · take'], ['I · J · P', 'bag · journal · character'], ['M', 'map'], ['O · Esc', 'options'],
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
          <OptionHead>Keys</OptionHead>
          <div className="grid gap-1" data-keys>
            {keys.map(([k, what]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span className="font-bold tabular-nums hk-ink whitespace-nowrap">{k}</span><span className="text-right hk-soft">{what}</span>
              </div>
            ))}
          </div>
          <OptionRow onClick={resetSettings} label="Reset view and controls" tail="defaults" />
        </>}
        dev={<>
          <OptionHead tone="hk-ember">Keeper of the realm</OptionHead>
          <OptionRow href="/shimmer/open/ather?tune=1" label="⚑ Ather tune mode" tail="] skips days" />
          <OptionRow href="/shimmer/open/continent" label="⛰ The continent" tail="drive" />
          <OptionRow href="/shimmer/dev" label="✧ Dev hub" tail="editors" />
          <OptionRow href="/shimmer/play3d/birth" label="✺ Choose a birth rune" tail="voxel" />
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
const UNLOCK_GRACE = 200
// one open/closed flag for the whole open world, so the pack's gear, O, Esc and a phone tap all drive the same panel
let optionsOpen = false
const osubs = new Set<() => void>()
export function setOptionsOpen(v: boolean) { if (v === optionsOpen) return; optionsOpen = v; osubs.forEach(f => f()) }
const osub = (f: () => void) => { osubs.add(f); return () => { osubs.delete(f) } }
const oget = () => optionsOpen, oserver = () => false
export const useOptionsOpen = () => useSyncExternalStore(osub, oget, oserver)

export function useOptionsKeys(busy: boolean) {
  useEffect(() => {
    let unlockedAt = 0
    const change = () => { if (!document.pointerLockElement) unlockedAt = performance.now() }
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'KeyO' && (!busy || optionsOpen)) { setOptionsOpen(!optionsOpen); return }
      if (e.code !== 'Escape') return
      if (optionsOpen) { setOptionsOpen(false); return }
      if (busy || document.pointerLockElement || performance.now() - unlockedAt < UNLOCK_GRACE) return
      setOptionsOpen(true)
    }
    document.addEventListener('pointerlockchange', change)
    window.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerlockchange', change); window.removeEventListener('keydown', key) }
  }, [busy])
  useEffect(() => () => setOptionsOpen(false), [])
}
