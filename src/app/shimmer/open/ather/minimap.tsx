'use client'
// THE ATHER'S MINIMAP — the same box, frame and keeper as the continent's (Alex 11-15: one UI through the whole game).
// North up, the keeper's dot turns. In the Wilds: a 240 m crop of the tile map under the same fold-mist as the fold
// map, node borders (grey dashed = infected, green = cleared), waymarks. On the plot: the garden grid (held squares
// green, mist over the rest), the gate and Gregory. Click it for the fold map, like M.
//
// The tile picture is composed ONCE per change (fog walked, a waymark planted, a node cleared) into an offscreen
// canvas; a frame only crops it. Per frame cost = one drawImage + a dot.

import { useEffect, useRef, useState } from 'react'
import { HearthMapFrame } from '../../ui/hearth-hud'
import { hudMapBox } from '../../ui/hearth-hud-layer'
import type { HudSize } from '../../ui/hud-flag'
import { ATHER_CLOUD, drawCloud, drawKeeper } from '../../ui/map-kit'
import { screenHeading } from '../../voxel3d/map-heading'
import { FOG_CELL, cellOrigin, type Fog } from './explored'
import { GREG_WAYMARK, type Waymark } from './waymarks'
import { GRID, SQ, GRID_HALF, GATE, GREG, sqId, PLOT_R } from './plot'
import type { Wilds } from './wilds'
import type { CompassPose } from '../shared/game-hud'

const REACH = 120          // Wilds: metres from centre to edge
const PLOT_REACH = 92      // plot: the whole island fits
const COMP = 1000          // composed tile picture, px

export function AtherMiniMap({ size, zone, W, fog, tileOff, pose, waymarks, regions, owned, onExpand }: {
  size: HudSize; zone: 'plot' | 'wilds'; W: Wilds; fog: Fog | null; tileOff: { x: number; z: number }
  pose: React.RefObject<CompassPose | null>; waymarks: Waymark[]
  regions: { id: string; poly: { x: number; z: number }[]; infected: boolean }[]
  owned: ReadonlySet<string>; onExpand: () => void
}) {
  const box = hudMapBox(size)
  const cv = useRef<HTMLCanvasElement>(null)
  const comp = useRef<HTMLCanvasElement | null>(null)
  const img = useRef<HTMLImageElement | null>(null)
  const ver = useRef(0)
  // ★ THE IMAGE LOAD IS STATE, not a callback into one effect run: a re-run before the load (the fog's rev ticks as you
  // walk) marked the waiting callback dead, and a keeper standing still then never saw the map (prod 11-15: all black).
  const [imgReady, setImgReady] = useState(false)
  useEffect(() => {
    const im = new Image(); im.onload = () => { img.current = im; setImgReady(true) }; im.src = `/open/wilds/${W.meta.name}-map.png`
    return () => { im.onload = null }
  }, [W])

  // compose the tile picture (Wilds) whenever what it shows changes
  useEffect(() => {
    if (zone !== 'wilds') return
    let dead = false
    const draw = () => {
      if (dead || !img.current?.complete) return
      const c = comp.current ?? (comp.current = document.createElement('canvas'))
      c.width = COMP; c.height = COMP
      const ctx = c.getContext('2d')!, sx = W.meta.sizeX, sz = W.meta.sizeZ, k = COMP / sx
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(img.current, 0, 0, COMP, COMP)
      const P = (x: number, z: number): [number, number] => [(x + sx / 2) * k, (z + sz / 2) * (COMP / sz)]
      // node borders, the same look as the fold map
      if (regions.length > 1) for (const r of regions) {
        ctx.beginPath(); r.poly.forEach((p, i) => { const [x, y] = P(p.x, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }); ctx.closePath()
        ctx.fillStyle = r.infected ? 'rgba(70,72,78,0.32)' : 'rgba(159,210,122,0.12)'; ctx.fill()
        ctx.setLineDash(r.infected ? [10, 7] : []); ctx.lineWidth = 3
        ctx.strokeStyle = r.infected ? 'rgba(235,238,242,0.9)' : 'rgba(159,210,122,0.85)'; ctx.stroke()
      }
      ctx.setLineDash([])
      if (fog) {
        const x0 = tileOff.x - sx / 2, z0 = tileOff.z - sz / 2, cellPx = COMP / (sx / FOG_CELL)
        drawCloud(ctx, fog, cellPx, -((x0 - cellOrigin.x) / FOG_CELL) * cellPx, -((z0 - cellOrigin.z) / FOG_CELL) * cellPx, ATHER_CLOUD)
      }
      const pin = (x: number, z: number, col: string, r: number) => {
        const [px, py] = P(x, z); ctx.fillStyle = col; ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      }
      pin(GREG_WAYMARK.x, GREG_WAYMARK.z, '#e7c766', 9)
      for (const w of waymarks) if (w.tile === GREG_WAYMARK.tile) pin(w.x, w.z, '#6fd3c4', 8)
      ver.current++
    }
    draw()
    return () => { dead = true }
  }, [zone, W, fog, fog?.rev, tileOff, waymarks, regions, imgReady])

  // per frame: crop round the keeper (Wilds) or draw the garden (plot), then the keeper
  useEffect(() => {
    const c = cv.current; if (!c) return
    c.width = box.size * 2; c.height = box.size * 2
    let id = 0, last = ''
    const tick = () => {
      id = requestAnimationFrame(tick)
      const p = pose.current; if (!p) return
      const key = `${zone},${Math.round(p.x * 2)},${Math.round(p.z * 2)},${Math.round(p.yaw * 30)},${ver.current},${owned.size}`
      if (key === last) return
      last = key
      const ctx = c.getContext('2d')!, S = c.width
      if (zone === 'wilds') {
        const m = comp.current
        ctx.fillStyle = '#080614'; ctx.fillRect(0, 0, S, S)
        if (m) {
          const k = COMP / W.meta.sizeX, span = REACH * 2 * k
          const cx = (p.x + W.meta.sizeX / 2) * k, cy = (p.z + W.meta.sizeZ / 2) * k
          ctx.drawImage(m, cx - span / 2, cy - span / 2, span, span, 0, 0, S, S)
        }
      } else {
        const k = S / (PLOT_REACH * 2), X = (x: number) => S / 2 + (x - p.x) * k, Z = (z: number) => S / 2 + (z - p.z) * k
        ctx.fillStyle = '#080614'; ctx.fillRect(0, 0, S, S)
        ctx.fillStyle = '#b9d3a0'; ctx.beginPath(); ctx.arc(X(0), Z(0), PLOT_R * k, 0, Math.PI * 2); ctx.fill()
        for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
          const held = owned.has(sqId(i, j)), x = i * SQ - GRID_HALF, z = j * SQ - GRID_HALF
          ctx.fillStyle = held ? '#8fbf6a' : 'rgba(233,237,248,0.72)'
          ctx.fillRect(X(x) + 0.5, Z(z) + 0.5, SQ * k - 1, SQ * k - 1)
        }
        const dot = (x: number, z: number, col: string) => { ctx.fillStyle = col; ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(x), Z(z), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
        dot(GATE.x, GATE.z, '#e7c766'); dot(GREG.x, GREG.z, '#c9a27a')
      }
      drawKeeper(ctx, S / 2, S / 2, screenHeading(-Math.sin(p.yaw), -Math.cos(p.yaw)), 6)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [box.size, zone, W, pose, owned])

  return (
    <>
      <canvas ref={cv} onClick={onExpand} title="Fold map (M)" data-map="mini" style={{ position: 'fixed', top: box.top, right: box.right, width: box.size, height: box.size,
        zIndex: box.z, borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 18px rgba(0,0,0,0.35)' }} />
      <HearthMapFrame face="full" box={box} />
    </>
  )
}
