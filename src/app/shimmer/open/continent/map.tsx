'use client'
// THE CONTINENT'S MAP — Athernyx, the waking world, on the same kit as the voxel world's (Alex 11-14: one map home
// for both sides, "with a toggle just like the game would have to fast travel").
//
// ★ ONE MAP, TWO MATTERS. The Ather's map is blocks under the cloud-ocean (`voxel3d/VoxelMap.tsx`); this is the
// other state of the same land (world/ather.md, same land two states), so it is drawn the way the waking world is:
// continuous — a cartographer's plate, washed hills, contour lines, inked roads — and the unknown is PARCHMENT, not
// cloud. Same stencil, same edge, same ring for the way through, same "you" marker (`ui/map-kit.ts`), so a player who
// learned one map reads the other at once.
//
// ★ WHAT YOU HAVE DRIVEN IS INKED IN. A walked/driven disc opens around you (`voxel3d/discovery.ts`, the same bitmap
// the voxel world keeps), remembered per region in localStorage. Names show only for places you have uncovered.
//
// ★ THE CROSSING IS MARKED, AND NOT HIDDEN BY THE FOG. Rune Hold's square is the gate-landing to the Ather
// (world/gates.md). It wears the door ring and, when it is off the minimap, the ring sits on the rim and points —
// the same rule as the keeper's fold door: the way to the other side is never something you must stumble on.
// The other side's tab is shown and closed: you SEE that the Ather is there, you cross at Rune Hold.

import { useEffect, useRef, useState } from 'react'
import type { Region } from '../region'
import { WATER_Y } from '../on-foot'
import { emptySeen, isSeen, see, loadSeen, saveSeen, CELL, type Seen } from '../../voxel3d/discovery'
import { drawCloud, drawDoor, drawDoorPinned, drawKeeper, PARCHMENT } from '../../ui/map-kit'
import { screenHeading } from '../../voxel3d/map-heading'
import { HearthMapFrame, MINIMAP_BOX, MINIMAP_BOX_PHONE, type MapBox } from '../../ui/hearth-hud'

/** Metres per plate pixel. The source painting's own scale, so the plate is the Atlas's size (1168 × 784). */
const P = 10
/** Revealed around you, metres. A road you drive is seen for a fair way either side; the hills further than that
 *  are what the next drive is for. */
export const SEE_M = 420
const GATE_ID = 'rune-hold'

export interface Track { x: number; z: number; yaw: number }

// ── the plate: heights washed in, light from the north-west, a contour every 50 m ─────────────────────────────
const STOPS: [number, [number, number, number]][] = [
  [0, [205, 204, 160]], [25, [190, 190, 138]], [80, [196, 176, 120]], [160, [176, 146, 108]], [260, [158, 146, 132]], [400, [214, 210, 202]],
]
function landColor(h: number): [number, number, number] {
  if (h <= STOPS[0][0]) return STOPS[0][1]
  for (let i = 1; i < STOPS.length; i++) if (h < STOPS[i][0]) {
    const [h0, a] = STOPS[i - 1], [h1, b] = STOPS[i], t = (h - h0) / (h1 - h0)
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  }
  return STOPS[STOPS.length - 1][1]
}

function buildPlate(R: Region): HTMLCanvasElement {
  const { nx, nz, cell } = R.meta
  const step = Math.max(1, Math.round(P / cell))
  const w = Math.floor((nx - 1) / step), hgt = Math.floor((nz - 1) / step)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(w, hgt)
  const H = (i: number, j: number) => R.h[Math.min(nz - 1, j * step) * nx + Math.min(nx - 1, i * step)]
  for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
    const h = H(i, j)
    let r: number, g: number, b: number
    if (h < WATER_Y) {
      // ink-blue wash, paler in the shallows so a coast reads as a coast
      const t = Math.min(1, -h / 18)
      r = 150 - 60 * t; g = 182 - 52 * t; b = 196 - 34 * t
    } else {
      ;[r, g, b] = landColor(h)
      const dx = H(i + 1, j) - H(Math.max(0, i - 1), j), dz = H(i, j + 1) - H(i, Math.max(0, j - 1))
      const shade = Math.max(0.72, Math.min(1.16, 1 - (dx + dz) * 0.012))
      r *= shade; g *= shade; b *= shade
      // contour: a faint sepia line where the 50 m band changes
      const band = Math.floor(h / 50)
      if (h > 10 && (Math.floor(H(i + 1, j) / 50) !== band || Math.floor(H(i, j + 1) / 50) !== band)) { r *= 0.84; g *= 0.8; b *= 0.74 }
    }
    // paper grain, deterministic
    const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453, grain = 0.97 + (n - Math.floor(n)) * 0.05
    const k = (j * w + i) * 4
    img.data[k] = r * grain; img.data[k + 1] = g * grain; img.data[k + 2] = b * grain; img.data[k + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  // roads, inked: the network if there is one, else the routes
  const roads = R.meta.network?.edges ?? R.meta.roads
  const toPx = (x: number, z: number): [number, number] => [(x + R.meta.sizeX / 2) / P, (z + R.meta.sizeZ / 2) / P]
  const INK: Record<string, { c: string; w: number; dash?: number[] }> = {
    paved: { c: '#6e3418', w: 2 }, road: { c: '#7e4424', w: 1.5 }, trail: { c: '#7e6040', w: 1.1, dash: [3, 2] }, pass: { c: '#a3402a', w: 1.2, dash: [2, 2] },
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  for (const r of roads) {
    const s = INK[r.kind] ?? INK.road
    ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.setLineDash(s.dash ?? [])
    ctx.beginPath()
    r.pts.forEach((p, i) => { const [x, y] = toPx(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) })
    ctx.stroke()
  }
  ctx.setLineDash([])
  for (const p of R.meta.places) if (p.name) {
    const [x, y] = toPx(p.x, p.z), rr = p.kind === 'city' ? 3.4 : p.kind === 'settlement' ? 2.6 : 1.9
    ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill()
  }
  return cv
}

// ── the region's map state: plate, fog, and the composed (plate + unknown) image both views draw from ──────────
export interface ContinentMapState {
  R: Region
  plate: HTMLCanvasElement
  comp: HTMLCanvasElement
  seen: Seen
  compRev: number
  toPx: (x: number, z: number) => [number, number]
  /** plate px per fog cell */
  cellPx: number
}

export function makeMapState(R: Region): ContinentMapState {
  const plate = buildPlate(R)
  const comp = document.createElement('canvas'); comp.width = plate.width; comp.height = plate.height
  let seen: Seen
  try { seen = loadSeen(`open-${R.meta.name}`, R.meta.nx, R.meta.nz) } catch { seen = emptySeen(R.meta.nx, R.meta.nz) }
  const cellPx = (CELL * R.meta.cell) / P
  return { R, plate, comp, seen, compRev: -1, cellPx, toPx: (x, z) => [(x + R.meta.sizeX / 2) / P, (z + R.meta.sizeZ / 2) / P] }
}

/** Open ground around a position (metres). Returns true when anything new was inked. */
export function reveal(m: ContinentMapState, x: number, z: number) {
  const { cell, sizeX, sizeZ } = m.R.meta
  return see(m.seen, (x + sizeX / 2) / cell, (z + sizeZ / 2) / cell, SEE_M / cell) > 0
}
export const persist = (m: ContinentMapState) => saveSeen(`open-${m.R.meta.name}`, m.seen)

function compose(m: ContinentMapState) {
  if (m.compRev === m.seen.rev) return
  const ctx = m.comp.getContext('2d')!
  ctx.clearRect(0, 0, m.comp.width, m.comp.height)
  ctx.drawImage(m.plate, 0, 0)
  drawCloud(ctx, m.seen, m.cellPx, 0, 0, PARCHMENT)
  m.compRev = m.seen.rev
}

const placeSeen = (m: ContinentMapState, x: number, z: number) => {
  const { cell, sizeX, sizeZ } = m.R.meta
  return isSeen(m.seen, Math.floor((x + sizeX / 2) / cell / CELL), Math.floor((z + sizeZ / 2) / cell / CELL))
}
const gateOf = (m: ContinentMapState) => m.R.meta.places.find(p => p.id === GATE_ID)
/** The door ring, with a dark halo so the pale ring reads on parchment. */
function gateRing(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save(); ctx.strokeStyle = 'rgba(40,24,10,0.7)'; ctx.lineWidth = Math.max(3, scale * 0.8)
  ctx.beginPath(); ctx.arc(x, y, Math.max(4, scale * 1.6), 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  drawDoor(ctx, x, y, scale)
}
export const trackHeading = (t: Track) => screenHeading(-Math.sin(t.yaw), -Math.cos(t.yaw))

// ── the minimap: a crop around you, north up, the gate pinned to the rim when it is off the crop ──────────────
const MINI_REACH = 700     // metres from centre to edge

export function ContinentMiniMap({ map, track, onExpand }: { map: ContinentMapState; track: React.RefObject<Track>; onExpand: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState<MapBox>(MINIMAP_BOX)
  useEffect(() => {
    const fit = () => setBox(window.innerWidth < 640 ? MINIMAP_BOX_PHONE : MINIMAP_BOX)
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [])
  useEffect(() => {
    const c = cv.current; if (!c) return
    c.width = box.size * 2; c.height = box.size * 2
    let id = 0, last = ''
    const tick = () => {
      id = requestAnimationFrame(tick)
      const t = track.current; if (!t) return
      const key = `${Math.round(t.x / 3)},${Math.round(t.z / 3)},${Math.round(t.yaw * 20)},${map.seen.rev}`
      if (key === last) return
      last = key
      compose(map)
      const ctx = c.getContext('2d')!, W = c.width, span = (MINI_REACH * 2) / P, k = W / span
      const [cx, cy] = map.toPx(t.x, t.z)
      ctx.fillStyle = PARCHMENT.deep; ctx.fillRect(0, 0, W, W)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(map.comp, cx - span / 2, cy - span / 2, span, span, 0, 0, W, W)
      const g = gateOf(map)
      if (g) { const [gx, gy] = map.toPx(g.x, g.z); const x = (gx - cx) * k + W / 2, y = (gy - cy) * k + W / 2
        if (x > 12 && y > 12 && x < W - 12 && y < W - 12) gateRing(ctx, x, y, 3.2); else drawDoorPinned(ctx, x, y, 3.2, W, W) }
      drawKeeper(ctx, W / 2, W / 2, trackHeading(t), 6)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [map, track, box.size])
  return (
    <>
      <canvas ref={cv} onClick={onExpand} title="Map (M)" data-map="mini" style={{ position: 'fixed', top: box.top, right: box.right, width: box.size, height: box.size,
        zIndex: box.z, borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 18px rgba(0,0,0,0.35)' }} />
      <HearthMapFrame face="full" box={box} />
    </>
  )
}

// ── the map, opened (M) ─────────────────────────────────────────────────────────────────────────────────────
export function ContinentMap({ map, track, onClose }: { map: ContinentMapState; track: React.RefObject<Track>; onClose: () => void }) {
  const base = useRef<HTMLCanvasElement>(null), marks = useRef<HTMLCanvasElement>(null)
  const [pct, setPct] = useState(0)
  const S = 2   // drawn at twice the plate so labels and the ring stay crisp
  useEffect(() => {
    const c = base.current; if (!c) return
    compose(map)
    c.width = map.plate.width * S; c.height = map.plate.height * S
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(map.comp, 0, 0, c.width, c.height)
    // names only where you have been: a label over parchment would tell you what the fog is for not telling
    ctx.textBaseline = 'middle'
    for (const p of map.R.meta.places) {
      if (!p.name || !placeSeen(map, p.x, p.z)) continue
      const [x, y] = map.toPx(p.x, p.z)
      ctx.font = `${p.kind === 'city' ? 700 : 600} ${p.kind === 'city' ? 17 : 13}px Georgia, serif`
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(236,226,198,0.9)'; ctx.strokeText(p.name, x * S + 7, y * S)
      ctx.fillStyle = '#2c1a0c'; ctx.fillText(p.name, x * S + 7, y * S)
    }
    const g = gateOf(map)
    if (g) {
      const [x, y] = map.toPx(g.x, g.z); gateRing(ctx, x * S, y * S, 4.4)
      ctx.font = 'italic 600 12px Georgia, serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(236,226,198,0.9)'
      ctx.strokeText('gate to the Ather', x * S + 10, y * S + 16); ctx.fillStyle = '#5b3d8a'; ctx.fillText('gate to the Ather', x * S + 10, y * S + 16)
    }
    let on = 0
    for (let y = 0; y < map.seen.ch; y++) for (let x = 0; x < map.seen.cw; x++) if (isSeen(map.seen, x, y)) on++
    setPct((on / (map.seen.cw * map.seen.ch)) * 100)
  }, [map])
  useEffect(() => {
    const c = marks.current, b = base.current; if (!c || !b) return
    let id = 0
    const tick = () => {
      id = requestAnimationFrame(tick)
      if (c.width !== b.width || c.height !== b.height) { c.width = b.width; c.height = b.height }
      const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height)
      const t = track.current; if (!t) return
      const [x, y] = map.toPx(t.x, t.z)
      drawKeeper(ctx, x * S, y * S, trackHeading(t), 6)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [map, track])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'KeyM') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true)
  }, [onClose])
  const tab = (on: boolean): React.CSSProperties => ({ padding: '6px 14px', font: '600 11px var(--font-game), system-ui', letterSpacing: '0.2em', textTransform: 'uppercase',
    borderRadius: 6, border: on ? '1px solid rgba(212,168,67,0.7)' : '1px solid rgba(255,255,255,0.12)', background: on ? 'rgba(212,168,67,0.18)' : 'transparent', color: on ? '#f0d58a' : 'rgba(228,220,255,0.4)' })
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(14,10,6,0.86)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, maxWidth: '96vw' }}>
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <span style={tab(true)}>Athernyx</span>
          <span style={tab(false)} title="The other state of this same land. You cross at Rune Hold's gate.">The Ather · cross at Rune Hold</span>
        </div>
        <div style={{ position: 'relative' }}>
          <canvas ref={base} data-map="base" style={{ maxWidth: '94vw', maxHeight: '78vh', width: 'auto', height: 'auto', display: 'block', borderRadius: 8,
            border: '3px solid #5a3d22', boxShadow: '0 0 0 1px #c9a86a55, 0 18px 50px rgba(0,0,0,0.6)' }} />
          <canvas ref={marks} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 8 }} />
        </div>
        <div style={{ color: 'rgba(240,228,200,0.6)', font: '12px system-ui', textAlign: 'center' }}>
          <span style={{ color: '#f4e6c0', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{pct.toFixed(1)}%</span> of the continent inked ·
          ink where you have driven · <span style={{ letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: 10 }}>M / Esc close</span>
        </div>
      </div>
    </div>
  )
}
