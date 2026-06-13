'use client'

import { useRef, useEffect } from 'react'
import { TILES } from '../world/tiles'
import { GARDEN } from '../world/tilemap'
import { SpriteAnim } from '../sprites/sprite-data'
import { ViewMode } from './PixelUtils'

/** Render a single sprite frame to a canvas context */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8Array,
  palette: readonly string[],
  x: number, y: number,
  mode: ViewMode = 'normal',
  flipX = false,
) {
  const ss = Math.round(Math.sqrt(pixels.length)) || 16
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i]
    if (v === 0) continue
    let px = x + (i % ss)
    const py = y + Math.floor(i / ss)
    if (flipX) px = x + (ss - 1) - (i % ss)

    let color = palette[v - 1] ?? palette[0]
    if (mode === 'silhouette') {
      color = '#000000'
    } else if (mode === 'grayscale') {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
      color = `rgb(${l},${l},${l})`
    }
    ctx.fillStyle = color
    ctx.fillRect(px, py, 1, 1)
  }
}

/** Render tilemap background */
export function drawTilemap(
  ctx: CanvasRenderingContext2D,
  grid: number[][],
  mode: ViewMode = 'normal',
) {
  for (let ty = 0; ty < grid.length; ty++) {
    for (let tx = 0; tx < grid[ty].length; tx++) {
      const val = grid[ty][tx]
      const tile = TILES[val & 0xFF]
      if (!tile) continue
      for (let i = 0; i < tile.pixels.length; i++) {
        const v = tile.pixels[i]
        if (v === 0) continue
        let color = tile.palette[v - 1]
        if (mode === 'silhouette') {
          const r = parseInt(color.slice(1, 3), 16)
          const g = parseInt(color.slice(3, 5), 16)
          const b = parseInt(color.slice(5, 7), 16)
          const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
          color = `rgb(${Math.round(l * 0.3)},${Math.round(l * 0.3)},${Math.round(l * 0.3)})`
        } else if (mode === 'grayscale') {
          const r = parseInt(color.slice(1, 3), 16)
          const g = parseInt(color.slice(3, 5), 16)
          const b = parseInt(color.slice(5, 7), 16)
          const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
          color = `rgb(${l},${l},${l})`
        }
        ctx.fillStyle = color
        const ts = Math.round(Math.sqrt(tile.pixels.length)) || 16
        ctx.fillRect(tx * ts + (i % ts), ty * ts + Math.floor(i / ts), 1, 1)
      }
    }
  }
}

/** Scene Preview: sprite on tilemap at game scale */
export function ScenePreview({
  anim, palette, mode,
  spriteX = 224, spriteY = 144,
  mirrorX = 160, mirrorY = 144,
  displayWidth = 960, displayHeight = 640,
}: {
  anim: SpriteAnim
  palette: readonly string[]
  mode: ViewMode
  spriteX?: number
  spriteY?: number
  mirrorX?: number
  mirrorY?: number
  displayWidth?: number
  displayHeight?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const tickRef = useRef(0)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = 480
    canvas.height = 320
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    drawTilemap(ctx, GARDEN.slice(4, 14).map(r => r.slice(4, 19)), mode)

    frameRef.current = 0
    tickRef.current = 0

    const interval = setInterval(() => {
      tickRef.current++
      const holdTime = anim.durations?.[frameRef.current] ?? anim.rate
      if (tickRef.current >= holdTime) {
        tickRef.current = 0
        frameRef.current = (frameRef.current + 1) % anim.frames.length
      }
      ctx.clearRect(0, 0, 480, 320)
      drawTilemap(ctx, GARDEN.slice(4, 14).map(r => r.slice(4, 19)), mode)

      const frame = anim.frames[frameRef.current]
      drawSprite(ctx, frame, palette, spriteX, spriteY, mode)
      drawSprite(ctx, frame, palette, mirrorX, mirrorY, mode, true)
    }, 1000 / 15)  // match game logic tick rate (15 TPS)

    return () => clearInterval(interval)
  }, [anim, palette, mode, spriteX, spriteY, mirrorX, mirrorY])

  return (
    <canvas
      ref={ref}
      className="border border-white/10 rounded-lg"
      style={{ imageRendering: 'pixelated', width: displayWidth, height: displayHeight }}
    />
  )
}

/** Animated sprite at given scale — uses rAF accumulator to match real game tick rate */
export function AnimPlayer({
  anim, palette, scale, mode = 'normal', speedMultiplier = 1,
}: {
  anim: SpriteAnim
  palette: readonly string[]
  scale: number
  mode?: ViewMode
  speedMultiplier?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  const ss = Math.round(Math.sqrt(anim.frames[0]?.length ?? 256)) || 16

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = ss
    canvas.height = ss
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    let frame = 0
    let tick = 0
    let lastTime = performance.now()
    let accum = 0
    let rafId = 0
    const TICK_MS = 1000 / (15 * speedMultiplier)

    function loop(now: number) {
      const elapsed = Math.min(now - lastTime, 200)
      lastTime = now
      accum += elapsed

      let dirty = false
      while (accum >= TICK_MS) {
        accum -= TICK_MS
        tick++
        const holdTime = anim.durations?.[frame] ?? anim.rate
        if (tick >= holdTime) {
          tick = 0
          frame = (frame + 1) % anim.frames.length
          dirty = true
        }
      }

      if (dirty || tick <= 1) {
        ctx.clearRect(0, 0, ss, ss)
        drawSprite(ctx, anim.frames[frame], palette, 0, 0, mode)
      }

      rafId = requestAnimationFrame(loop)
    }

    // Draw first frame immediately
    drawSprite(ctx, anim.frames[0], palette, 0, 0, mode)
    rafId = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafId)
  }, [anim, palette, mode, speedMultiplier, ss])

  return (
    <canvas
      ref={ref}
      className="border border-white/10 rounded"
      style={{ imageRendering: 'pixelated', width: ss * scale, height: ss * scale }}
    />
  )
}

/** Static frame preview */
export function FramePreview({
  pixels, palette, scale, mode = 'normal',
}: {
  pixels: Uint8Array
  palette: readonly string[]
  scale: number
  mode?: ViewMode
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  const ss = Math.round(Math.sqrt(pixels.length)) || 16

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = ss
    canvas.height = ss
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, ss, ss)
    drawSprite(ctx, pixels, palette, 0, 0, mode)
  }, [pixels, palette, mode, ss])

  return (
    <canvas
      ref={ref}
      className="border border-white/10 rounded"
      style={{ imageRendering: 'pixelated', width: ss * scale, height: ss * scale }}
    />
  )
}
