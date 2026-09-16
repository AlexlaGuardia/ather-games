// hud/hotbar.tsx — the bar: 8 fixed slots, items only, the name of what you hold over it.
//
// ★ ONE BAR FOR BOTH DIMENSIONS (see clock.tsx). Moved out of `VoxelWorld.tsx`'s Hud on 2026-09-16
// (HUD port, stage 2); play3d's `HotBar.tsx` (6 slots, its own emoji tiles, tool gauges, a mana
// vial) is retired for this. Item art is DERIVED from each block's own texture (`tex/item-icon.ts`)
// through `ItemChip` — an icon can never show something the block is not.
//
// ★ 8 FIXED slots, ITEMS ONLY (2026-08-07) — always all 8, occupied or not, so number keys 1-8
// always mean the same physical position. Tools live in the round arc off its right end
// (`hud-corner.tsx`), never in this row. `dimmed` (weapon drawn) fades the whole row rather than
// hiding it: you keep seeing what you will be holding again when you stow.
//
// `onSelect` is the one addition: the Ather selects by key only (the bar is pointer-through), the
// mortal side has touch play and needs a tap to mean "this slot". Passing it makes the slots
// clickable; leaving it out keeps the bar inert, as before.

'use client'

import React from 'react'
import { ItemChip } from './satchel'

export type HotbarEntry = { itemId: string; count: number }

export const HOTBAR_SLOTS = 8

export function Hotbar({ entries, sel, held, dimmed, onSelect }: {
  entries: readonly (HotbarEntry | null)[]
  sel: number
  /** The name of what is held, shown over the bar; `out` = fading. Always rendered so the row never shifts. */
  held: { text: string; out: boolean } | null
  dimmed: boolean
  onSelect?: (i: number) => void
}) {
  return (
    <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${onSelect ? '' : 'pointer-events-none'} transition-opacity ${dimmed ? 'opacity-35' : 'opacity-100'}`}>
      {/* A baked shadow because HUD text must never sit raw on the scene. */}
      <div className={`mb-1.5 h-5 text-center text-[13px] font-medium tracking-[0.08em] text-amber-100
        [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] transition-opacity duration-500
        ${held && !held.out ? 'opacity-100' : 'opacity-0'}`}>
        {held?.text ?? ''}
      </div>
      {/* `relative` so a tool arc can anchor to this bar's right edge with `left-full`. */}
      <div className="relative inline-flex items-end gap-1.5">
        {Array.from({ length: HOTBAR_SLOTS }, (_, i) => {
          const e = entries[i] ?? null
          const selected = i === sel && !dimmed
          const cls = `w-12 h-12 rounded border-2 flex flex-col items-center justify-center text-[9px] font-mono
            ${selected ? 'border-amber-300 bg-black/60' : 'border-white/20 bg-black/40'}`
          const body = e ? (
            <>
              <ItemChip itemId={e.itemId} size={24} />
              <div className="text-white/80 mt-0.5 tabular-nums">{e.count}</div>
            </>
          ) : <span className="text-white/25">{i + 1}</span>
          return onSelect
            ? <button key={i} type="button" onClick={() => onSelect(i)} className={cls} aria-label={`slot ${i + 1}`}>{body}</button>
            : <div key={i} className={cls}>{body}</div>
        })}
      </div>
    </div>
  )
}
