'use client'
// The item icon the craft surfaces draw — split out of craft-grid.tsx so the hearth kit
// (ui/hearth.tsx) and the grid can both import it without importing each other.
import React from 'react'
import { itemIcon } from './tex/item-icon'
import { materialForItem } from '../voxel/registry'
import { MATERIAL_COLOR } from './attrs'

export function CraftIcon({ itemId, size }: { itemId: string; size: number }) {
  const icon = itemIcon(itemId)
  if (icon) return <img src={icon} alt="" width={size} height={size} className="[image-rendering:pixelated]" draggable={false} />
  const mat = materialForItem(itemId)
  const swatch = mat !== undefined ? `#${(MATERIAL_COLOR[mat] ?? 0x888888).toString(16).padStart(6, '0')}` : undefined
  // No art: a chip with the item's initials, so a grid of unknowns is still a grid of DIFFERENT things.
  const initials = itemId.split('_').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  return (
    <span className="rounded-sm border border-black/40 grid place-items-center text-[9px] text-white/60"
          style={{ width: size, height: size, background: swatch ?? 'rgba(255,255,255,0.12)' }}>{initials}</span>
  )
}
