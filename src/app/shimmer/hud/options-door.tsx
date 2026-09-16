// hud/options-door.tsx — the ☰ handle under the minimap (Alex, 2026-09-13: "an ingame options
// menu, maybe a hamburger under the map"). It opens the SAME panel `O` does — one options surface,
// two doors — so a keyboard player and a mouse player land on the same thing. Sized and placed off
// the minimap (148 wide at top 12 / right 12, VoxelMap.tsx) — a small square hanging under its
// right edge, not a bar, so it reads as a handle. Shared by both dimensions (see clock.tsx).

'use client'

import React from 'react'

export const MINIMAP_H = 148

export function OptionsDoor({ onOpen, top = 12 + MINIMAP_H + 6 }: { onOpen: () => void; top?: number }) {
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
