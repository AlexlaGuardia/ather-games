// hud/say-line.tsx — THE SAY LINE: what the world says to the keeper, one plate, centre-low.
//
// Sits above the hotbar — where the eye already is during play, not in a debug corner. Plated,
// because the HUD's own law says text never sits raw on a scene, and a refusal read over bright
// canopy is the case that matters. `pointer-events-none` throughout: it must never eat a click
// meant for the world. Shared by both dimensions (see clock.tsx); moved out of `VoxelWorld.tsx`'s
// Hud on 2026-09-16 (HUD port, stage 3). `at` re-keys the plate so a new line replays the slide.

'use client'

import React from 'react'

export function SayLine({ text, at }: { text: string; at: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[19%] z-30 flex justify-center px-4">
      <div key={at}
           className="max-w-[34rem] rounded border border-white/15 bg-black/70 px-3.5 py-2 text-center
                      text-[13px] leading-snug text-amber-100/90 shadow-lg backdrop-blur-[2px]
                      motion-safe:animate-[fadeSlideIn_140ms_ease-out]">
        {text}
      </div>
    </div>
  )
}
