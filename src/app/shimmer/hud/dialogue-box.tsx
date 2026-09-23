// hud/dialogue-box.tsx — the frame a conversation is read in: a dimmed world, one plate, the
// speaker's name in the header, an X in the corner (`CloseX`). Shared by both dimensions (see clock.tsx);
// lifted out of `VoxelWorld.tsx`'s ScriptDialogue / GregDialogue on 2026-09-16 (HUD port, stage 3).
//
// The frame is the shared part; what fills it is the engine's. The Ather reads a whole `Talk`
// (scene lines, beats, a choice) at once; the mortal side reads one line per tap. Both are this
// box. `onPlate` is for the tap-to-advance reader; `onBackdrop` is the click-outside close.

'use client'

import React from 'react'
import { HearthFrame } from '../ui/hearth'

export function DialogueBox({ name, panelId, width = 'w-[440px] max-w-[92vw]', onBackdrop, onPlate, footer, children }: {
  name: string
  /** `data-panel` — the harness's handle for picking this box out of the DOM. */
  panelId?: string
  /** Tailwind width class, read as the card's max width (px) — the frame never exceeds the screen. */
  width?: string
  onBackdrop?: () => void
  onPlate?: () => void
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  // ★ Carved Hearth (Phase 8, 2026-09-22): the speaker's name is the carved plaque — who is talking
  // is what the frame says first — and the words sit on parchment in ink. A tap-to-advance reader
  // makes the whole paper the button; a closable one keeps the knob in the corner.
  const px = Number(/\[(\d+)px\]/.exec(width)?.[1] ?? 440)
  return (
    <HearthFrame title={name} maxWidth={Math.round(px * 1.1)} dataPanel={panelId} backdropClass="z-[45]"
                 onClose={onBackdrop ?? (() => {})} closable={!!onBackdrop}
                 bodyClass="p-0">
      <div className={`p-4 pt-6 text-[14px] leading-relaxed hk-ink ${onPlate ? 'cursor-pointer' : ''}`} onClick={onPlate}>
        {children}
        {footer}
      </div>
    </HearthFrame>
  )
}
