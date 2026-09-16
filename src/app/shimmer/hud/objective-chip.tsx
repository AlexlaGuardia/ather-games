// hud/objective-chip.tsx — "objective · <value>", top-centre. Dim caps label, bright value: the
// house game-UI signature, asked of `.gx-label`/`.gx-value` rather than restated. Shared by both
// dimensions (see clock.tsx); moved out of `VoxelWorld.tsx`'s Hud on 2026-09-16.

'use client'

import React from 'react'

export function ObjectiveChip({ value }: { value: string }) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono bg-black/45 rounded px-2.5 py-1 pointer-events-none">
      <span className="gx-label text-white/40">objective</span>{' '}
      <span className="gx-value text-amber-200/90">{value}</span>
    </div>
  )
}
