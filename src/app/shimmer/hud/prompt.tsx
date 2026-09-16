// hud/prompt.tsx — the interact prompt under the reticle: "E — talk", "E — craft". One slot, one
// line, centred a little below the crosshair so it reads as belonging to the thing you are looking
// at. Shared by both dimensions (see clock.tsx); moved out of `VoxelWorld.tsx` on 2026-09-16.

'use client'

import React from 'react'

export function Prompt({ text, children }: { text?: string; children?: React.ReactNode }) {
  return (
    <div className="absolute left-1/2 top-[63%] -translate-x-1/2 text-center pointer-events-none">
      {children ?? <div className="text-[11px] font-mono tracking-wide text-white/85">{text}</div>}
    </div>
  )
}
