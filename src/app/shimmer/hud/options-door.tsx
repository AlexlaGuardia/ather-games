// hud/options-door.tsx — the ☰ handle under the minimap (Alex, 2026-09-13: "an ingame options
// menu, maybe a hamburger under the map"). It opens the SAME panel `O` does — one options surface,
// two doors — so a keyboard player and a mouse player land on the same thing. Sized and placed off
// the minimap (148 wide at top 12 / right 12, VoxelMap.tsx) — a small square hanging under its
// right edge, not a bar, so it reads as a handle. Shared by both dimensions (see clock.tsx).

'use client'

import React from 'react'
import { HUD_FACES, type HudFace } from '../ui/hud-face'

export const MINIMAP_H = 148

/**
 * `face` (2026-09-23, Carved Hearth Phase 9): the Ather's HUD wears the hearth, and a dark square
 * beside the carved clock pill read as a leftover. With a face it is a carved KNOB — round, wood,
 * cream glyph — the same object as the panels' close knob (`HearthX`), so "a round wood thing is a
 * handle" is one rule across the game. Omitted = the old square, which the mortal side still wears
 * until its HUD moves too.
 */
export function OptionsDoor({ onOpen, top = 12 + MINIMAP_H + 6, face }: { onOpen: () => void; top?: number; face?: HudFace }) {
  if (face) {
    const t = HUD_FACES[face]
    return (
      <button
        onClick={onOpen}
        title="Options (O)"
        aria-label="Options"
        className="fixed z-[33] grid place-items-center rounded-full transition-transform hover:scale-105 active:scale-95"
        style={{ top, right: 12, width: 34, height: 34, background: t.rim,
                 boxShadow: '0 3px 6px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,220,170,.35), inset 0 -2px 3px rgba(0,0,0,.4)' }}
      >
        <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
          <path d="M1.5 2 H12.5 M1.5 6 H12.5 M1.5 10 H12.5" stroke="#f1dfbf" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      </button>
    )
  }
  return (
    <button
      onClick={onOpen}
      title="Options (O)"
      aria-label="Options"
      className="gx-btn fixed z-[33] flex items-center justify-center text-[15px] leading-none text-white/75 hover:text-white"
      style={{ top, right: 12, width: 34, height: 30 }}
    >☰</button>
  )
}
