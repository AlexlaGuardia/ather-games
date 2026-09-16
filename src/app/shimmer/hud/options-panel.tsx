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

export type OptionsTab = 'game' | 'video' | 'sound' | 'controls' | 'dev'

/** A full-width row: label left, dim tail right. `href` navigates, `onClick` acts. */
export function OptionRow({ href, onClick, label, tail }: { href?: string; onClick?: () => void; label: string; tail: string }) {
  const cls = 'gx-btn flex w-full items-center justify-between px-2.5 py-1.5 text-[10px]'
  const body = <><span>{label}</span><span className="gx-value text-white/50">{tail}</span></>
  return href ? <a href={href} className={cls}>{body}</a> : <button onClick={onClick} className={cls}>{body}</button>
}

/** A labelled range with a tabular readout. `disabled` dims it AND says so via the caller's own note. */
export function OptionSlider({ label, value, min = 0, max = 1, step = 0.05, onChange, format, disabled }: {
  label: string; value: number; min?: number; max?: number; step?: number
  onChange: (v: number) => void; format?: (v: number) => string; disabled?: boolean
}) {
  return (
    <label className={`flex items-center gap-2 text-[11px] font-mono ${disabled ? 'text-white/30' : 'text-white/70'}`}>
      <span className="w-24 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-amber-300 disabled:opacity-40" />
      <span className="w-14 text-right tabular-nums text-white/50">{format ? format(value) : value.toFixed(2)}</span>
    </label>
  )
}

/** A section eyebrow inside a tab. */
export const OptionHead = ({ children, tone = 'text-white/40' }: { children: React.ReactNode; tone?: string }) =>
  <div className={`gx-label pt-1 text-[9px] ${tone}`}>{children}</div>

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
    // Capped to the viewport and scrolling past it: with the Dev rows the panel outgrew a 760px
    // window and sat on the mana gauge.
    <div className="absolute top-3 right-3 w-72 max-h-[calc(100vh-24px)] overflow-y-auto bg-black/80 border border-white/15 rounded p-3 space-y-2.5 z-[40]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-semibold tracking-wider text-white/90 uppercase">Options</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xs font-mono">esc / O</button>
      </div>
      {/* The tab row: the house game-UI signature — near-uniform size, hierarchy by brightness.
          Inactive ~45%, active amber with a rule under it. */}
      <div className="flex gap-0.5 border-b border-white/10">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
                  className={`gx-label px-1.5 pb-1.5 text-[9px] tracking-[.08em] uppercase border-b-2 -mb-px whitespace-nowrap
                    ${tab === id ? 'border-amber-300 text-amber-200' : 'border-transparent text-white/45 hover:text-white/75'}
                    ${id === 'dev' ? 'ml-auto' : ''}`}>{label}</button>
        ))}
      </div>

      {tab === 'game' && (<>
        {/* Where you leave from. Both worlds autosave on every change, so a hard nav out never
            loses progress. */}
        <OptionRow onClick={onClose} label="▶ Resume" tail="esc" />
        {game}
        <OptionRow href="/room?wall=0" label="⌂ The Room" tail="leave" />
        <OptionRow href="/arcade/all" label="▦ All games" tail="arcade" />
        <p className="text-[10px] leading-relaxed text-white/35 font-mono pt-1">
          Your world saves itself as you play. Leaving is never a loss.
        </p>
      </>)}
      {tab === 'video' && video}
      {tab === 'sound' && sound}
      {tab === 'controls' && controls}
      {isOwner && tab === 'dev' && dev}
    </div>
  )
}
