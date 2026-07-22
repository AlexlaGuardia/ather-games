'use client'
// World map overlay (M key / HUD button) — the continent drawn from the live grid, with
// district labels and a you-are-here marker that tracks the player + camera yaw. Renders
// once per open (the grid barely changes mid-play); the marker animates via rAF on a second
// canvas layer so the map itself never redraws per frame.
import React, { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import { getGardenWorld, WORLD_ZONE_ID } from '../world/garden-world'

const VOID = -1, WATER_ID = 8, WARP_ID = 14, MIST_ID = 31, WALL_ID = 34

const TILE_COLORS: { match: (v: number) => boolean; color: string }[] = [
  { match: v => (v & 0xFF) === WARP_ID, color: '#e8c45a' },
  { match: v => (v & 0xFF) === MIST_ID, color: '#cfd9f2' },
  { match: v => (v & 0xFF) === WATER_ID, color: '#3aa0d6' },
  { match: v => (v & 0xFF) === WALL_ID, color: '#e8edf6' },
]

export function WorldMap({ zoneId, gridRef, posRef, yawRef, onClose }: {
  zoneId: string
  gridRef: React.RefObject<number[][]>
  posRef: React.RefObject<THREE.Vector3 | null>
  yawRef: React.RefObject<number>
  onClose: () => void
}) {
  const mapCanvas = useRef<HTMLCanvasElement>(null)
  const markCanvas = useRef<HTMLCanvasElement>(null)

  // static layer: tiles + district labels
  useEffect(() => {
    const cv = mapCanvas.current
    const grid = gridRef.current
    if (!cv || !grid?.length) return
    const rows = grid.length, cols = grid[0].length
    const px = Math.max(1, Math.floor(Math.min(1600 / cols, 1000 / rows)))
    cv.width = cols * px; cv.height = rows * px
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = '#0b0918'
    ctx.fillRect(0, 0, cv.width, cv.height)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = grid[r][c]
      if (v === VOID) continue
      ctx.fillStyle = TILE_COLORS.find(t => t.match(v))?.color ?? '#5da24e'
      ctx.fillRect(c * px, r * px, px, px)
    }
    if (zoneId === WORLD_ZONE_ID) {
      ctx.font = `700 ${Math.max(11, px * 6)}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      for (const p of getGardenWorld().placements.values()) {
        const x = (p.ox + p.cols / 2) * px, y = (p.oy + p.rows / 2) * px
        ctx.fillStyle = 'rgba(6,5,14,0.72)'
        const label = p.zone.name
        const w = ctx.measureText(label).width + 10
        ctx.fillRect(x - w / 2, y - px * 4.4, w, px * 6.2)
        ctx.fillStyle = '#ffe9b0'
        ctx.fillText(label, x, y)
      }
    }
  }, [zoneId, gridRef])

  // marker layer: player dot + facing wedge, rAF-driven
  useEffect(() => {
    const cv = markCanvas.current, base = mapCanvas.current
    if (!cv || !base) return
    let id = 0
    const tick = () => {
      if (cv.width !== base.width || cv.height !== base.height) { cv.width = base.width; cv.height = base.height }
      const grid = gridRef.current
      const p = posRef.current
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, cv.width, cv.height)
      if (grid?.length && p) {
        const px = cv.width / grid[0].length
        const x = p.x * px, y = p.z * px
        const yaw = yawRef.current
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(-yaw) // camera yaw → map heading (north = -z = up)
        ctx.fillStyle = 'rgba(232,88,74,0.35)'
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, px * 7, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#ff6b5a'
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(0, 0, Math.max(3, px * 1.4), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.restore()
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [gridRef, posRef, yawRef])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(6,5,14,0.86)',
      display: 'grid', placeItems: 'center', cursor: 'pointer',
    }}>
      <div style={{ position: 'relative', maxWidth: '94vw', maxHeight: '88vh' }}>
        <canvas ref={mapCanvas} style={{ maxWidth: '94vw', maxHeight: '84vh', width: 'auto', height: 'auto', imageRendering: 'pixelated', borderRadius: 10, border: '1px solid #ffe9b033', display: 'block' }} />
        <canvas ref={markCanvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>
      <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', color: '#cfc7ae', font: '700 13px ui-monospace, monospace' }}>
        ✦ The Shimmer Garden · M or click to close
      </div>
    </div>
  )
}
