'use client'
// World map (M / expand) + persistent MiniMap — the continent drawn from the live grid.
// Interiors (caverns/holds/houses) don't exist on the surface, so their DOORS are drawn as
// gold diamonds, and doors that lead through the same interior to another part of the world
// (the Voranyx Caverns run) get a dashed gold route line — underground connections stay
// legible instead of reading as "lost". Full map renders once per open; the minimap crops
// around the player and redraws only when the player moves/turns.
import React, { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import { getGardenWorld, WORLD_ZONE_ID } from '../world/garden-world'
import { ZONES, getZone } from '../world/zones'

const VOID = -1, WATER_ID = 8, WARP_ID = 14, MIST_ID = 31, WALL_ID = 34

const TILE_COLORS: { match: (v: number) => boolean; color: string }[] = [
  { match: v => (v & 0xFF) === WARP_ID, color: '#e8c45a' },
  { match: v => (v & 0xFF) === MIST_ID, color: '#cfd9f2' },
  { match: v => (v & 0xFF) === WATER_ID, color: '#3aa0d6' },
  { match: v => (v & 0xFF) === WALL_ID, color: '#e8edf6' },
]
const tileColor = (v: number) => TILE_COLORS.find(t => t.match(v))?.color ?? '#5da24e'

// Doors grouped by their interior, clustered by proximity (a 2-wide door = one cluster;
// the caverns' two far-apart mouths = two clusters = an underground ROUTE).
function doorClusters(): { toZone: string; clusters: { x: number; y: number }[] }[] {
  const byZone = new Map<string, { x: number; y: number }[][]>()
  for (const d of getGardenWorld().doorWarps) {
    const clusters = byZone.get(d.toZone) ?? []
    const hit = clusters.find(c => Math.abs(c[0].x - d.worldX) + Math.abs(c[0].y - d.worldY) < 8)
    if (hit) hit.push({ x: d.worldX, y: d.worldY })
    else clusters.push([{ x: d.worldX, y: d.worldY }])
    byZone.set(d.toZone, clusters)
  }
  return [...byZone.entries()].map(([toZone, clusters]) => ({
    toZone,
    clusters: clusters.map(c => ({ x: c.reduce((s, p) => s + p.x, 0) / c.length, y: c.reduce((s, p) => s + p.y, 0) / c.length })),
  }))
}

function drawDoors(ctx: CanvasRenderingContext2D, px: number, withLabels: boolean) {
  ctx.save()
  for (const { toZone, clusters } of doorClusters()) {
    // underground route: doors on both ends of the same interior
    if (clusters.length >= 2) {
      ctx.strokeStyle = '#e8c45a'
      ctx.setLineDash([px * 2.4, px * 2.2])
      ctx.lineWidth = Math.max(1.5, px * 0.7)
      for (let i = 1; i < clusters.length; i++) {
        ctx.beginPath()
        ctx.moveTo(clusters[0].x * px, clusters[0].y * px)
        ctx.lineTo(clusters[i].x * px, clusters[i].y * px)
        ctx.stroke()
      }
      ctx.setLineDash([])
    }
    for (const c of clusters) {
      const x = c.x * px, y = c.y * px, r = Math.max(3.5, px * 1.8)
      ctx.fillStyle = '#ffd76a'
      ctx.strokeStyle = '#6b4e00'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y)
      ctx.closePath(); ctx.fill(); ctx.stroke()
    }
    if (withLabels) {
      const name = getZone(ZONES, toZone)?.name ?? toZone
      const at = clusters.length >= 2
        ? { x: (clusters[0].x + clusters[1].x) / 2, y: (clusters[0].y + clusters[1].y) / 2 }
        : { x: clusters[0].x, y: clusters[0].y - 4 }
      ctx.font = `700 ${Math.max(10, px * 4.6)}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      const w = ctx.measureText(name).width + 8
      ctx.fillStyle = 'rgba(58,44,6,0.82)'
      ctx.fillRect(at.x * px - w / 2, at.y * px - px * 3.6, w, px * 5)
      ctx.fillStyle = '#ffe9b0'
      ctx.fillText(name, at.x * px, at.y * px)
    }
  }
  ctx.restore()
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, yaw: number, px: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-yaw)
  ctx.fillStyle = 'rgba(232,88,74,0.35)'
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, px * 7, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#ff6b5a'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(0, 0, Math.max(3, px * 1.4), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.restore()
}

export function WorldMap({ zoneId, gridRef, posRef, yawRef, onClose }: {
  zoneId: string
  gridRef: React.RefObject<number[][]>
  posRef: React.RefObject<THREE.Vector3 | null>
  yawRef: React.RefObject<number>
  onClose: () => void
}) {
  const mapCanvas = useRef<HTMLCanvasElement>(null)
  const markCanvas = useRef<HTMLCanvasElement>(null)

  // static layer: tiles + district labels + doors/routes
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
      ctx.fillStyle = tileColor(v)
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
      drawDoors(ctx, px, true)
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
        drawPlayer(ctx, p.x * px, p.z * px, yawRef.current, px)
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
        ✦ The Shimmer Garden · ◆ = doors (dashes = underground routes) · M or click to close
      </div>
    </div>
  )
}

// Persistent minimap — a north-up crop centered on the player. Redraws only when the
// player crosses a tile or turns; click (or M) expands to the full map.
const MINI_TILES = 30 // half-width of the crop, in tiles
export function MiniMap({ zoneId, gridRef, posRef, yawRef, onExpand }: {
  zoneId: string
  gridRef: React.RefObject<number[][]>
  posRef: React.RefObject<THREE.Vector3 | null>
  yawRef: React.RefObject<number>
  onExpand: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const SIZE = 148
    cv.width = SIZE * 2; cv.height = SIZE * 2 // 2x for crisp text-free pixels
    let id = 0
    let last = ''
    const tick = () => {
      id = requestAnimationFrame(tick)
      const grid = gridRef.current
      const p = posRef.current
      if (!grid?.length || !p) return
      const key = `${zoneId}:${Math.round(p.x * 2)},${Math.round(p.z * 2)},${Math.round(yawRef.current * 10)}`
      if (key === last) return
      last = key
      const ctx = cv.getContext('2d')!
      const px = cv.width / (MINI_TILES * 2)
      ctx.fillStyle = '#0b0918'
      ctx.fillRect(0, 0, cv.width, cv.height)
      const c0 = Math.round(p.x) - MINI_TILES, r0 = Math.round(p.z) - MINI_TILES
      for (let r = 0; r < MINI_TILES * 2; r++) for (let c = 0; c < MINI_TILES * 2; c++) {
        const v = grid[r0 + r]?.[c0 + c]
        if (v === undefined || v === VOID) continue
        ctx.fillStyle = tileColor(v)
        ctx.fillRect(c * px, r * px, px + 0.5, px + 0.5)
      }
      // doors in view (world mode)
      if (zoneId === WORLD_ZONE_ID) {
        ctx.save()
        ctx.translate(-c0 * px, -r0 * px)
        drawDoors(ctx, px, false)
        ctx.restore()
      }
      drawPlayer(ctx, (p.x - c0) * px, (p.z - r0) * px, yawRef.current, px)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [zoneId, gridRef, posRef, yawRef])
  return (
    <canvas ref={canvas} onClick={onExpand} title="World map (M)" style={{
      position: 'fixed', top: 12, right: 130, zIndex: 33, width: 148, height: 148,
      borderRadius: 10, border: '1px solid #ffffff3a', background: '#0b0918',
      boxShadow: '0 3px 14px #0008', cursor: 'pointer', imageRendering: 'pixelated',
    }} />
  )
}
