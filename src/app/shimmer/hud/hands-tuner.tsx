// The hands tuner — Alex positions the keeper's arm himself (09-16: "I wish there was a way for me
// to position it"). Seven sliders over `handsTune` (voxel3d/hands.ts), live in the rig on the next
// frame, saved across reloads, and a readout he pastes back so the numbers get baked into
// DEFAULT_TUNE. Owner-only: opened from the options panel's Dev tab.
//
// ⚠ Not a cursor surface in the `uiOpen` sense on purpose: the hands LEAVE THE FRAME when the UI
// owns the screen, and a tuner that hides its subject is a tuner for nothing. The host frees the
// pointer when it opens this and takes it back on close; the world keeps running underneath.

'use client'

import React, { useState } from 'react'
import { OptionSlider, OptionHead } from './options-panel'
import { handsTune, setHandsTune, resetHandsTune, tuneReadout, type HandsTune } from '../voxel3d/hands'

export function HandsTuner({ onClose }: { onClose: () => void }) {
  const [t, setT] = useState<HandsTune>(() => ({ ...handsTune.tune }))
  const [copied, setCopied] = useState(false)
  const set = (k: keyof HandsTune) => (v: number) => setT(setHandsTune({ [k]: v }))
  const line = tuneReadout(t)
  const copy = () => { try { void navigator.clipboard?.writeText(line); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch { /* the readout is selectable */ } }
  return (
    <div className="absolute left-3 bottom-24 z-30 w-[300px] gx-panel rounded-md border border-white/15 bg-black/80 p-3 space-y-1.5 pointer-events-auto">
      <div className="flex items-center justify-between">
        <span className="gx-label text-[10px] text-amber-300/80">🧤 Hands tuner</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xs font-mono">✕</button>
      </div>
      <OptionHead>wrist — where the hand sits (camera units; +x right, +y up, −z away)</OptionHead>
      <OptionSlider label="wrist x" value={t.wx} min={-0.6} max={0.8} step={0.01} onChange={set('wx')} />
      <OptionSlider label="wrist y" value={t.wy} min={-0.7} max={0.3} step={0.01} onChange={set('wy')} />
      <OptionSlider label="wrist z" value={t.wz} min={-1.0} max={-0.2} step={0.01} onChange={set('wz')} />
      <OptionHead>aim — the point the wrist faces away from (where an elbow would be; the hands float, Rayman-style)</OptionHead>
      <OptionSlider label="elbow x" value={t.ex} min={-0.6} max={1.2} step={0.01} onChange={set('ex')} />
      <OptionSlider label="elbow y" value={t.ey} min={-1.4} max={0.3} step={0.01} onChange={set('ey')} />
      <OptionSlider label="elbow z" value={t.ez} min={-1.0} max={0.2} step={0.01} onChange={set('ez')} />
      <OptionHead>roll — turn the back of the glove to the lens</OptionHead>
      <OptionSlider label="roll" value={t.roll} min={-3.14} max={3.14} step={0.01} onChange={set('roll')} format={v => `${(v * 180 / Math.PI).toFixed(0)}°`} />
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => setT({ ...resetHandsTune() })} className="gx-btn px-2 py-1 text-[10px]">reset</button>
        <button onClick={copy} className="gx-btn px-2 py-1 text-[10px]">{copied ? 'copied' : 'copy readout'}</button>
      </div>
      <div className="select-all text-[10px] font-mono text-white/55 leading-snug break-words">{line}</div>
      <p className="text-[10px] font-mono text-white/35 leading-snug">Saved on this browser. Paste the readout to Jin to make it the default.</p>
    </div>
  )
}
