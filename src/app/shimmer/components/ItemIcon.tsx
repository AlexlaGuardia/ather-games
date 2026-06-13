'use client'

import { useRef, useEffect } from 'react'
import { ITEM_ICONS, ITEM_PALETTE, SEED_PALETTES } from '../sprites/items'
import { FURNITURE_ICONS } from '../sprites/furniture'
import { drawSprite } from './SpriteRenderers'

const defaultPalette = ITEM_PALETTE as unknown as readonly string[]

export default function ItemIcon({ itemId, scale = 2 }: { itemId: string; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const icon = ITEM_ICONS[itemId] ?? FURNITURE_ICONS[itemId]
    if (!icon) return
    const pal = (SEED_PALETTES[itemId] ?? defaultPalette) as readonly string[]
    ctx.canvas.width = 32
    ctx.canvas.height = 32
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 32, 32)
    drawSprite(ctx, icon.frames[0], pal, 0, 0)
  }, [itemId])

  return (
    <canvas
      ref={ref}
      style={{ imageRendering: 'pixelated', width: 32 * scale, height: 32 * scale }}
    />
  )
}
