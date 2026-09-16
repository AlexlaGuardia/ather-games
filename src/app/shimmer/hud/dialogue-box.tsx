// hud/dialogue-box.tsx — the frame a conversation is read in: a dimmed world, one plate, the
// speaker's name in the header, esc in the corner. Shared by both dimensions (see clock.tsx);
// lifted out of `VoxelWorld.tsx`'s ScriptDialogue / GregDialogue on 2026-09-16 (HUD port, stage 3).
//
// The frame is the shared part; what fills it is the engine's. The Ather reads a whole `Talk`
// (scene lines, beats, a choice) at once; the mortal side reads one line per tap. Both are this
// box. `onPlate` is for the tap-to-advance reader; `onBackdrop` is the click-outside close.

'use client'

import React from 'react'

export function DialogueBox({ name, panelId, width = 'w-[440px] max-w-[92vw]', onBackdrop, onPlate, footer, children }: {
  name: string
  /** `data-panel` — the harness's handle for picking this box out of the DOM. */
  panelId?: string
  width?: string
  onBackdrop?: () => void
  onPlate?: () => void
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/50 pointer-events-auto z-[45]" onClick={onBackdrop}>
      <div data-panel={panelId}
           className={`${width} bg-[#0e1018]/95 border border-white/12 rounded-lg p-4 font-mono text-[11px] ${onPlate ? 'cursor-pointer' : ''}`}
           onClick={(e) => { e.stopPropagation(); onPlate?.() }}>
        <div className="flex items-baseline justify-between mb-3">
          <span className="gx-label text-white/95">{name}</span>
          {onBackdrop && <button onClick={(e) => { e.stopPropagation(); onBackdrop() }} className="text-white/40 hover:text-white/80">esc</button>}
        </div>
        {children}
        {footer}
      </div>
    </div>
  )
}
