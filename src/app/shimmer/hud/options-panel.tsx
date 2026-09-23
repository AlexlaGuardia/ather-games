// hud/options-panel.tsx — the ☰ options surface: one frame, five tabs, for BOTH dimensions.
//
// ★ THE FRAME IS SHARED; THE LEVERS ARE THE ENGINE'S. Game / Video / Sound / Controls / Dev is the
// order Alex ruled (2026-09-13: "organize it better so it opens to game, video, sound, and the
// usual game options with a hidden dev tab for me"), and it holds for the mortal side too — but
// what a Video tab CONTAINS is a fact about the renderer (voxel3d has cartoon levers and radii,
// play3d has its quality toggles), so each tab is a slot the engine fills. The Game tab's exits
// (Resume · The Room · All games) are the keeper's and live here. One panel, one tab row, one
// Row/Slider dialect; the two worlds cannot drift apart on chrome they do not own.
//
// Pulled out of `VoxelWorld.tsx`'s `SettingsPanel` on 2026-09-16 for the HUD port (see clock.tsx).

'use client'

import React, { useState } from 'react'
import { HearthFrame, HearthTabs, hearthDisplay } from '../ui/hearth'

export type OptionsTab = 'game' | 'video' | 'sound' | 'controls' | 'dev'

/** A full-width row: label left, dim tail right. `href` navigates, `onClick` acts. */
export function OptionRow({ href, onClick, label, tail }: { href?: string; onClick?: () => void; label: string; tail: string }) {
  // ★ Carved Hearth (Phase 7): a paper slip you press, the HearthChoice grammar at the sheet's size.
  const cls = 'flex w-full min-h-[40px] items-center justify-between gap-3 rounded-[10px] px-3 text-[13px] font-bold transition-all hover:-translate-y-px active:translate-y-px hk-ink'
  const style = { background: 'rgba(255,250,238,.6)', boxShadow: '0 1px 3px rgba(58,39,22,.18)' }
  const body = <><span>{label}</span><span className="tabular-nums text-[12px] font-semibold hk-faint">{tail}</span></>
  return href ? <a href={href} className={cls} style={style}>{body}</a> : <button onClick={onClick} className={cls} style={style}>{body}</button>
}

/** A labelled range with a tabular readout. `disabled` dims it AND says so via the caller's own note. */
export function OptionSlider({ label, value, min = 0, max = 1, step = 0.05, onChange, format, disabled }: {
  label: string; value: number; min?: number; max?: number; step?: number
  onChange: (v: number) => void; format?: (v: number) => string; disabled?: boolean
}) {
  return (
    <label className={`flex items-center gap-2 text-[13px] font-semibold ${disabled ? 'hk-faint' : 'hk-ink'}`}>
      <span className="w-24 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-[#c8642a] disabled:opacity-40" />
      <span className="w-16 shrink-0 whitespace-nowrap text-right tabular-nums text-[12px] hk-soft">{format ? format(value) : value.toFixed(2)}</span>
    </label>
  )
}

/** A section eyebrow inside a tab. */
export const OptionHead = ({ children, tone = 'hk-soft' }: { children: React.ReactNode; tone?: string }) =>
  <div className={`hk-label pt-2 text-[14px] ${tone}`}>{children}</div>

export function OptionsPanel({ onClose, isOwner, game, video, sound, controls, dev, initial = 'game' }: {
  onClose: () => void
  /**
   * The keeper of the realm (`/api/owner`). Gates the Dev TAB. ⚠ This flag hides the DOOR; the dev
   * routes themselves are owner-gated in `proxy.ts`, so a player who types the URL still gets
   * nothing. Two locks, and only the second one is a lock — this one is so the menu does not
   * advertise a door it will not open.
   */
  isOwner: boolean
  /** Extra Game rows, rendered under Resume and above the exits (New Game, Play together, …). */
  game?: React.ReactNode
  video?: React.ReactNode
  sound?: React.ReactNode
  controls?: React.ReactNode
  dev?: React.ReactNode
  initial?: OptionsTab
}) {
  const [tab, setTab] = useState<OptionsTab>(initial)
  const tabs: [OptionsTab, string][] = [['game', 'Game'], ['video', 'Video'], ['sound', 'Sound'], ['controls', 'Controls']]
  if (isOwner) tabs.push(['dev', 'Dev'])
  return (
    // ★ Carved Hearth (Phase 7): a side SHEET, not a modal — it hangs in the corner over the world
    // the way the dark sheet did, so the world stays visible while you tune its look. Capped to the
    // viewport and scrolling past it: with the Dev rows the panel outgrew a 760px window.
    <div className="absolute top-5 right-5 z-[40] pointer-events-auto">
      <HearthFrame title="Options" maxWidth={360} backdrop={false} onClose={onClose}
                   bodyClass="p-3.5 pt-2 space-y-2.5"
                   head={<HearthTabs tabs={tabs.map(([id, label]) => ({ id, label }))} active={tab} onPick={id => setTab(id as OptionsTab)} />}>
      {tab === 'game' && (<>
        {/* Where you leave from. Both worlds autosave on every change, so a hard nav out never
            loses progress. */}
        <OptionRow onClick={onClose} label="▶ Resume" tail="esc" />
        {game}
        <OptionRow href="/room?wall=0" label="⌂ The Room" tail="leave" />
        <OptionRow href="/arcade/all" label="▦ All games" tail="arcade" />
        <p className="pt-1 text-[13px] italic leading-relaxed hk-faint" style={hearthDisplay}>
          Your world saves itself as you play. Leaving is never a loss.
        </p>
      </>)}
      {tab === 'video' && video}
      {tab === 'sound' && sound}
      {tab === 'controls' && controls}
      {isOwner && tab === 'dev' && dev}
      </HearthFrame>
    </div>
  )
}
