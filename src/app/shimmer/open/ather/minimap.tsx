'use client'
// THE ATHER'S MINIMAP — the same box, frame and keeper as the continent's (Alex 11-15: one UI through the whole game).
// North up, the keeper's dot turns. In the Wilds: a 240 m crop of the tile map under the same fold-mist as the fold
// map, node borders (grey dashed = infected, green = cleared), waymarks. On the plot: the garden grid (held squares
// green, mist over the rest), the gate and Gregory. Click it for the fold map, like M.
//
// The tile picture is composed ONCE per change (fog walked, a waymark planted, a node cleared) into an offscreen
// canvas; a frame only crops it. Per frame cost = one drawImage + a dot.

import { useEffect, useRef } from 'react'
import { HearthMapFrame } from '../../ui/hearth-hud'
import { hudMapBox } from '../../ui/hearth-hud-layer'
import type { HudSize } from '../../ui/hud-flag'
import { ATHER_CLOUD, drawCloud, drawKeeper } from '../../ui/map-kit'
import { screenHeading } from '../../voxel3d/map-heading'
import { FOG_CELL, cellOrigin, type Fog } from './explored'
import { GREG_WAYMARK, type Waymark } from './waymarks'
import { GATE, GREG } from './plot'
import type { Wilds } from './wilds'
import { TILE_M, type WildsWorld } from './wilds-world'
import { atherPlate, plotPlate, PLOT_MPP } from './plate'
import type { CompassPose } from '../shared/game-hud'
import type { Frame } from './cluster'

const REACH = 120          // Wilds: metres from centre to edge
const PLOT_REACH = 92      // plot: the whole island fits
const COMP = 1000          // composed tile picture, px

export function AtherMiniMap({ size, zone, world, wrev, fog, tileOff, pose, waymarks, regionsByTile, owned, onExpand, cluster }: {
  size: HudSize; zone: 'plot' | 'wilds'
  /** the streamed Wilds (wilds-world.ts): every loaded tile composes its own picture; a frame draws the ones in view */
  world: WildsWorld; wrev: number
  fog: Fog | null; tileOff: { x: number; z: number }
  pose: React.RefObject<CompassPose | null>; waymarks: Waymark[]
  /** each loaded tile's node borders, in that tile's LOCAL coords */
  regionsByTile: Map<string, { id: string; poly: { x: number; z: number }[]; infected: boolean }[]>
  owned: ReadonlySet<string>; onExpand: () => void
  /** linked plots (cluster.ts): sketched round the island, the shared ground and the bridges */
  cluster?: Frame
}) {
  const box = hudMapBox(size)
  const cv = useRef<HTMLCanvasElement>(null)
  const comps = useRef(new Map<string, HTMLCanvasElement>())
  const sigs = useRef(new Map<string, string>())
  const ver = useRef(0)
  const clusterRef = useRef(cluster); clusterRef.current = cluster

  // compose each loaded tile's picture whenever what it shows changes: its plate, its node borders, the fog over it
  // (the fog is one continent grid; `tileOff` is the anchor tile's centre in continent coords), its waymarks
  useEffect(() => {
    if (zone !== 'wilds') return
    const keep = new Set<string>()
    const here = pose.current ? world.tileAtPoint(pose.current.x, pose.current.z)?.W.meta.name : undefined
    for (const [name, W] of world.loaded) {
      keep.add(name)
      // the fog moves only where you walk: only YOUR tile recomposes on a fog change; the rest when their borders,
      // pins or the loaded set change (a full redraw of nine tiles every quarter-second would stutter)
      const sig = `${wrev}|${regionsByTile.get(name)?.map(r => r.infected ? 1 : 0).join('') ?? ''}|${waymarks.length}${name === here ? `|${fog?.rev ?? 0}` : ''}`
      if (sigs.current.get(name) === sig && comps.current.has(name)) continue
      sigs.current.set(name, sig)
      const c = comps.current.get(name) ?? document.createElement('canvas'); comps.current.set(name, c)
      c.width = COMP; c.height = COMP
      const t = world.byName.get(name)!, ox = t.tx * TILE_M, oz = t.ty * TILE_M
      const ctx = c.getContext('2d')!, sx = W.meta.sizeX, sz = W.meta.sizeZ, k = COMP / sx
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(atherPlate(W), 0, 0, COMP, COMP)
      const P = (x: number, z: number): [number, number] => [(x + sx / 2) * k, (z + sz / 2) * (COMP / sz)]
      const regions = regionsByTile.get(name) ?? []
      if (regions.length > 1) for (const r of regions) {
        ctx.beginPath(); r.poly.forEach((p, i) => { const [x, y] = P(p.x, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }); ctx.closePath()
        ctx.fillStyle = r.infected ? 'rgba(70,72,78,0.32)' : 'rgba(159,210,122,0.12)'; ctx.fill()
        ctx.setLineDash(r.infected ? [10, 7] : []); ctx.lineWidth = 3
        ctx.strokeStyle = r.infected ? 'rgba(235,238,242,0.9)' : 'rgba(159,210,122,0.85)'; ctx.stroke()
      }
      ctx.setLineDash([])
      if (fog) {
        const x0 = tileOff.x + ox - sx / 2, z0 = tileOff.z + oz - sz / 2, cellPx = COMP / (sx / FOG_CELL)
        drawCloud(ctx, fog, cellPx, -((x0 - cellOrigin.x) / FOG_CELL) * cellPx, -((z0 - cellOrigin.z) / FOG_CELL) * cellPx, ATHER_CLOUD)
      }
      const pin = (x: number, z: number, col: string, r: number) => {
        const [px, py] = P(x, z); ctx.fillStyle = col; ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      }
      if (name === GREG_WAYMARK.tile) pin(GREG_WAYMARK.x, GREG_WAYMARK.z, '#e7c766', 9)
      for (const w of waymarks) if (w.tile === name) pin(w.x, w.z, '#6fd3c4', 8)
    }
    for (const n of [...comps.current.keys()]) if (!keep.has(n)) { comps.current.delete(n); sigs.current.delete(n) }
    ver.current++
  }, [zone, world, wrev, fog, fog?.rev, tileOff, waymarks, regionsByTile, pose])

  // per frame: crop round the keeper (Wilds) or draw the garden (plot), then the keeper
  useEffect(() => {
    const c = cv.current; if (!c) return
    c.width = box.size * 2; c.height = box.size * 2
    let id = 0, last = ''
    const tick = () => {
      id = requestAnimationFrame(tick)
      const p = pose.current; if (!p) return
      const key = `${zone},${Math.round(p.x * 2)},${Math.round(p.z * 2)},${Math.round(p.yaw * 30)},${ver.current},${owned.size},${clusterRef.current?.mates.length ?? 0}`
      if (key === last) return
      last = key
      const ctx = c.getContext('2d')!, S = c.width
      if (zone === 'wilds') {
        // every tile in view, placed by its centre (tiles meet exactly, so the picture is seamless)
        ctx.fillStyle = '#080614'; ctx.fillRect(0, 0, S, S)
        const kpx = S / (REACH * 2)
        ctx.imageSmoothingEnabled = true
        for (const [name, m] of comps.current) {
          const t = world.byName.get(name)!, left = t.tx * TILE_M - TILE_M / 2, top = t.ty * TILE_M - TILE_M / 2
          const dx = S / 2 + (left - p.x) * kpx, dy = S / 2 + (top - p.z) * kpx, ds = TILE_M * kpx
          if (dx > S || dy > S || dx + ds < 0 || dy + ds < 0) continue
          ctx.drawImage(m, dx, dy, ds, ds)
        }
      } else {
        const k = S / (PLOT_REACH * 2), X = (x: number) => S / 2 + (x - p.x) * k, Z = (z: number) => S / 2 + (z - p.z) * k
        // the home plot's own plate (plate.ts): the island in the void, your squares in colour, the rest under mist
        ctx.fillStyle = '#080614'; ctx.fillRect(0, 0, S, S)
        const { canvas: pl, extent: E } = plotPlate(owned), span = (PLOT_REACH * 2) / PLOT_MPP
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(pl, (p.x + E) / PLOT_MPP - span / 2, (p.z + E) / PLOT_MPP - span / 2, span, span, 0, 0, S, S)
        // linked plots: the shared ground, the bridges, my lane and each mate's island, sketched in the plate's palette
        const f = clusterRef.current
        if (f?.linked && f.middle) {
          ctx.strokeStyle = '#cdbf9f'; ctx.lineCap = 'round'
          for (const b of [...f.bridges, ...(f.lane ? [f.lane] : []), ...f.mates.map(m => m.lane)]) { ctx.lineWidth = Math.max(2, b.w * k); ctx.beginPath(); ctx.moveTo(X(b.ax), Z(b.az)); ctx.lineTo(X(b.bx), Z(b.bz)); ctx.stroke() }
          ctx.fillStyle = '#a9cf86'; ctx.beginPath(); ctx.arc(X(f.middle.x), Z(f.middle.z), f.middle.r * k, 0, Math.PI * 2); ctx.fill()
          for (const m of f.mates) { ctx.fillStyle = 'rgba(170,206,120,0.85)'; ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), 80 * k, 0, Math.PI * 2); ctx.fill() }
        }
        const dot = (x: number, z: number, col: string) => { ctx.fillStyle = col; ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(x), Z(z), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
        dot(GATE.x, GATE.z, '#e7c766'); dot(GREG.x, GREG.z, '#c9a27a')
      }
      drawKeeper(ctx, S / 2, S / 2, screenHeading(-Math.sin(p.yaw), -Math.cos(p.yaw)), 6)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [box.size, zone, world, pose, owned])

  return (
    <>
      <canvas ref={cv} onClick={onExpand} title="Fold map (M)" data-map="mini" style={{ position: 'fixed', top: box.top, right: box.right, width: box.size, height: box.size,
        zIndex: box.z, borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 18px rgba(0,0,0,0.35)' }} />
      <HearthMapFrame face="full" box={box} />
    </>
  )
}
