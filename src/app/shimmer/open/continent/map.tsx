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
// The other side's tab is a VIEW, not a door: the same land in blocks, opened where you have walked the Wilds
// (the world lane's fog, one grid in world coords). Looking is free; going is still Rune Hold's gate.

import { useEffect, useRef, useState } from 'react'
import type { Region } from '../region'
import { WATER_Y } from '../on-foot'
import { emptySeen, isSeen, see, loadSeen, saveSeen, CELL, type Seen } from '../../voxel3d/discovery'
import { drawCloud, drawDoor, drawDoorPinned, drawKeeper, PARCHMENT, ATHER_CLOUD } from '../../ui/map-kit'
import { loadFog, FOG_CELL, type Fog } from '../ather/explored'
import { waymarksInWorld } from '../ather/waymarks'
import { allPitstops, loadVisited, FIRST_PITSTOP } from './pitstops'
import { screenHeading } from '../../voxel3d/map-heading'
import { HearthFrame, H } from '../../ui/hearth'
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

function buildPlate(R: Region): { plate: HTMLCanvasElement; coast: HTMLCanvasElement } {
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
  // ★ THE COAST IS KNOWN BEFORE YOU DRIVE IT. Athernyx has been charted for centuries (the Atlas is a painting of
  // it), so the unknown is the inland detail, not the shape of the land: a faint sepia coastline sits over the
  // parchment from the first minute, and the drive fills in hills, roads and names.
  const coast = document.createElement('canvas'); coast.width = w; coast.height = hgt
  const cctx = coast.getContext('2d')!, cimg = cctx.createImageData(w, hgt)
  for (let j = 1; j < hgt - 1; j++) for (let i = 1; i < w - 1; i++) {
    const wet = H(i, j) < WATER_Y
    if (wet !== (H(i + 1, j) < WATER_Y) || wet !== (H(i, j + 1) < WATER_Y)) { const k = (j * w + i) * 4; cimg.data[k] = 92; cimg.data[k + 1] = 64; cimg.data[k + 2] = 36; cimg.data[k + 3] = 255 }
  }
  cctx.putImageData(cimg, 0, 0)
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
  return { plate: cv, coast }
}

// ── THE ATHER FACE: the same land in the Ather's matter ─────────────────────────────────────────────────────────
// Same land, two states (world/ather.md); the Ather is QUANTIZED (shimmer-geography.md), so the plate is cut into
// 60 m blocks and banded, in the palette of the Atlas's Ather face (athernyx/assets/maps/atlas/gen_ather_relief.py)
// so the cockpit and the game draw one picture. No roads, no towns: settlements converge, they are never mirrored,
// and the garden pockets (home plot, Moonwell, Gloview) are off the land map by canon.
const ATHER_BANDS: [number, [number, number, number]][] = [
  [0.5, [92, 112, 178]], [30, [126, 196, 132]], [90, [170, 206, 120]], [180, [214, 196, 128]], [280, [176, 150, 196]], [1e9, [236, 228, 250]],
]
const BLOCK = 6   // plate px per block (60 m)
function buildAtherPlate(R: Region, w: number, hgt: number): HTMLCanvasElement {
  const { nx, nz, cell } = R.meta
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt
  const ctx = cv.getContext('2d')!
  const H = (x: number, z: number) => R.h[Math.min(nz - 1, Math.max(0, Math.round(z / cell))) * nx + Math.min(nx - 1, Math.max(0, Math.round(x / cell)))]
  const bm = BLOCK * P
  for (let by = 0; by * BLOCK < hgt; by++) for (let bx = 0; bx * BLOCK < w; bx++) {
    const x = (bx + 0.5) * bm, z = (by + 0.5) * bm
    const h = (H(x, z) + H(x - bm / 3, z) + H(x + bm / 3, z) + H(x, z - bm / 3) + H(x, z + bm / 3)) / 5
    const col = ATHER_BANDS.find(b => h < b[0])![1]
    let k = 1
    if (h >= 0.5) {   // light from the northwest, banded to quarter steps: quantized all the way down
      const d = (H(x + bm, z) - H(x - bm, z) + H(x, z + bm) - H(x, z - bm)) / (2 * bm)
      k = Math.round(Math.max(0.65, Math.min(1.2, 1 - d * 2.2)) * 4) / 4
    }
    ctx.fillStyle = `rgb(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0})`
    ctx.fillRect(bx * BLOCK, by * BLOCK, BLOCK, BLOCK)
  }
  return cv
}
/** The Ather tab's picture: the block plate under the cloud, opened where the keeper has WALKED the Wilds
 *  (open/ather/explored.ts, one 16 m grid in continent world coords, origin at the centre like toPx). */
function composeAther(m: ContinentMapState, fog: Fog): HTMLCanvasElement {
  m.atherPlate ??= buildAtherPlate(m.R, m.plate.width, m.plate.height)
  const cv = document.createElement('canvas'); cv.width = m.plate.width; cv.height = m.plate.height
  const ctx = cv.getContext('2d')!
  ctx.drawImage(m.atherPlate, 0, 0)
  drawCloud(ctx, fog, FOG_CELL / P, 0, 0, ATHER_CLOUD)
  // the land's outline, faint, over the cloud: it IS the same land, and a blank night tells a new keeper nothing
  const ln = document.createElement('canvas'); ln.width = cv.width; ln.height = cv.height
  const lctx = ln.getContext('2d')!
  lctx.drawImage(m.coast, 0, 0); lctx.globalCompositeOperation = 'source-in'; lctx.fillStyle = '#b9a8ff'; lctx.fillRect(0, 0, ln.width, ln.height)
  ctx.globalAlpha = 0.35; ctx.drawImage(ln, 0, 0); ctx.globalAlpha = 1
  return cv
}

// ── the region's map state: plate, fog, and the composed (plate + unknown) image both views draw from ──────────
export interface ContinentMapState {
  R: Region
  plate: HTMLCanvasElement
  coast: HTMLCanvasElement
  comp: HTMLCanvasElement
  seen: Seen
  compRev: number
  toPx: (x: number, z: number) => [number, number]
  /** plate px per fog cell */
  cellPx: number
  /** the Ather face, built the first time its tab opens */
  atherPlate?: HTMLCanvasElement
}

export function makeMapState(R: Region): ContinentMapState {
  const { plate, coast } = buildPlate(R)
  const comp = document.createElement('canvas'); comp.width = plate.width; comp.height = plate.height
  let seen: Seen
  try { seen = loadSeen(`open-${R.meta.name}`, R.meta.nx, R.meta.nz) } catch { seen = emptySeen(R.meta.nx, R.meta.nz) }
  const cellPx = (CELL * R.meta.cell) / P
  return { R, plate, coast, comp, seen, compRev: -1, cellPx, toPx: (x, z) => [(x + R.meta.sizeX / 2) / P, (z + R.meta.sizeZ / 2) / P] }
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
  ctx.globalAlpha = 0.45; ctx.drawImage(m.coast, 0, 0); ctx.globalAlpha = 1
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

export function ContinentMiniMap({ map, track, onExpand, box: boxIn }: { map: ContinentMapState; track: React.RefObject<Track>; onExpand: () => void
  /** The open HUD's box for this size (shared/game-hud.tsx), so the frame, the clock under it and this canvas agree. */
  box?: MapBox }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const [fitBox, setBox] = useState<MapBox>(MINIMAP_BOX)
  useEffect(() => {
    const fit = () => setBox(window.innerWidth < 640 ? MINIMAP_BOX_PHONE : MINIMAP_BOX)
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [])
  const box = boxIn ?? fitBox
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
  const [side, setSide] = useState<'nyx' | 'ather'>('nyx')
  // ★ DRAWN AT THE SIZE IT IS SHOWN. A fixed 2× plate was scaled down to fit the screen and its 12px labels came
  // out at 4px; so the canvas takes the displayed size × devicePixelRatio and every label is sized in real px.
  const [S, setS] = useState(1), [dpr, setDpr] = useState(1)
  useEffect(() => {
    const fit = () => {
      const d = window.devicePixelRatio || 1, pw = map.plate.width, ph = map.plate.height
      const shown = Math.min(window.innerWidth * 0.86, (window.innerHeight * 0.68) * pw / ph)   // inside the hearth frame's wood + margin
      setDpr(d); setS((shown * d) / pw)
    }
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [map])
  useEffect(() => {
    const c = base.current; if (!c) return
    compose(map)
    c.width = Math.round(map.plate.width * S); c.height = Math.round(map.plate.height * S)
    const ctx = c.getContext('2d')!
    if (side === 'ather') {
      // the other state of this land: you are not there, so no marker; only what you have walked, opened
      const fog = loadFog()
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(composeAther(map, fog), 0, 0, c.width, c.height)
      let on = 0
      for (let i = 0; i < fog.bits.length; i++) { let b = fog.bits[i]; while (b) { on += b & 1; b >>= 1 } }
      setPct((on / (fog.cw * fog.ch)) * 100)
      // waymarks: passages the keeper planted (and Gregory's, given), a lit waystone each. Where fast travel will start.
      ctx.textBaseline = 'middle'
      for (const w of waymarksInWorld()) {
        const [px, py] = map.toPx(w.x, w.z), x = px * S, y = py * S, r = (w.greg ? 6 : 5) * dpr
        ctx.save(); ctx.shadowColor = '#cdbcff'; ctx.shadowBlur = 10 * dpr
        ctx.fillStyle = w.greg ? '#f0d58a' : '#e4dcff'; ctx.strokeStyle = 'rgba(20,14,40,0.85)'; ctx.lineWidth = 1.5 * dpr
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.7, y); ctx.closePath()
        ctx.fill(); ctx.restore(); ctx.stroke()
        if (w.greg) {
          ctx.font = `italic 600 ${12 * dpr}px Georgia, serif`; ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(14,10,30,0.9)'
          ctx.strokeText("Gregory's waymark", x + 9 * dpr, y); ctx.fillStyle = '#f0d58a'; ctx.fillText("Gregory's waymark", x + 9 * dpr, y)
        }
      }
      return
    }
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(map.comp, 0, 0, c.width, c.height)
    // names only where you have been: a label over parchment would tell you what the fog is for not telling
    ctx.textBaseline = 'middle'
    for (const p of map.R.meta.places) {
      if (!p.name || !placeSeen(map, p.x, p.z)) continue
      const [x, y] = map.toPx(p.x, p.z)
      ctx.font = `${p.kind === 'city' ? 700 : 600} ${(p.kind === 'city' ? 16 : 13) * dpr}px Georgia, serif`
      ctx.lineWidth = 3.5 * dpr; ctx.strokeStyle = 'rgba(236,226,198,0.9)'; ctx.strokeText(p.name, x * S + 7 * dpr, y * S)
      ctx.fillStyle = '#2c1a0c'; ctx.fillText(p.name, x * S + 7 * dpr, y * S)
    }
    const g = gateOf(map)
    if (g) {
      const [x, y] = map.toPx(g.x, g.z), gx = x * S + 12 * dpr, gy = y * S + 17 * dpr; gateRing(ctx, x * S, y * S, 4 * dpr)
      ctx.font = `italic 600 ${12 * dpr}px Georgia, serif`; ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(236,226,198,0.9)'
      ctx.strokeText('gate to the Ather', gx, gy); ctx.fillStyle = '#5b3d8a'; ctx.fillText('gate to the Ather', gx, gy)
    }
    // PITSTOPS: each city's public door off the Hallway (gates.md 11-14). Visited = a lit ring you can tap; not yet =
    // a faint ring, so you can see there is a door to earn. Rune Hold is already ringed above.
    const visited = loadVisited()
    for (const d of allPitstops(map.R.meta.places)) {
      if (d.id === FIRST_PITSTOP) continue
      const [x, y] = map.toPx(d.x, d.z), open = visited.has(d.id)
      if (open) gateRing(ctx, x * S, y * S, 3.4 * dpr)
      else {   // a door to earn: an inked dashed ring, readable on parchment (the pale door ring vanished there)
        ctx.save(); ctx.strokeStyle = 'rgba(91,61,138,0.75)'; ctx.lineWidth = 1.6 * dpr; ctx.setLineDash([3 * dpr, 2.5 * dpr])
        ctx.beginPath(); ctx.arc(x * S, y * S, 6 * dpr, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      }
      if (open) {
        const gx = x * S + 10 * dpr, gy = y * S + 15 * dpr
        ctx.font = `italic 600 ${11 * dpr}px Georgia, serif`; ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(236,226,198,0.9)'
        ctx.strokeText('pitstop', gx, gy); ctx.fillStyle = '#5b3d8a'; ctx.fillText('pitstop', gx, gy)
      }
    }
    let on = 0
    for (let y = 0; y < map.seen.ch; y++) for (let x = 0; x < map.seen.cw; x++) if (isSeen(map.seen, x, y)) on++
    setPct((on / (map.seen.cw * map.seen.ch)) * 100)
  }, [map, S, dpr, side])
  useEffect(() => {
    const c = marks.current, b = base.current; if (!c || !b) return
    let id = 0
    const tick = () => {
      id = requestAnimationFrame(tick)
      if (c.width !== b.width || c.height !== b.height) { c.width = b.width; c.height = b.height }
      const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height)
      const t = track.current; if (!t || side === 'ather') return
      const [x, y] = map.toPx(t.x, t.z)
      drawKeeper(ctx, x * S, y * S, trackHeading(t), 5 * dpr)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [map, track, S, dpr, side])
  // ★ TAP A DOOR, STEP THROUGH (gates.md › THE HALLWAY: any door to any door, one act). Athernyx tab: an unlocked
  // pitstop (or Rune Hold) sets you down there. Ather tab: a waymark you bound sets you down at it in the Wilds
  // (world lane's ?waymark=, which refuses an unbound id).
  const tap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = base.current; if (!c) return
    const r = c.getBoundingClientRect(), px = (e.clientX - r.left) * (c.width / r.width), py = (e.clientY - r.top) * (c.height / r.height)
    const near = (x: number, z: number) => { const [mx, my] = map.toPx(x, z); return Math.hypot(mx * S - px, my * S - py) < 16 * dpr }
    let go: string | null = null
    if (side === 'ather') { const w = waymarksInWorld().find(w => near(w.x, w.z)); if (w) go = `/shimmer/open/ather?waymark=${encodeURIComponent(w.id)}` }
    else {
      const visited = loadVisited()
      const d = allPitstops(map.R.meta.places).find(d => (d.id === FIRST_PITSTOP || visited.has(d.id)) && near(d.x, d.z))
      if (d) go = `/shimmer/open/continent?at=${encodeURIComponent(d.id)}`
    }
    if (go) { e.stopPropagation(); window.location.href = go }
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'KeyM') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true)
  }, [onClose])
  const tab = (on: boolean): React.CSSProperties => ({ padding: '6px 14px', font: '600 11px var(--font-game), system-ui', letterSpacing: '0.2em', textTransform: 'uppercase',
    borderRadius: 999, border: `1px solid ${on ? H.ember : H.rule}`, background: on ? 'rgba(200,100,42,0.16)' : 'rgba(255,250,235,0.5)', color: on ? H.emberLo : H.inkSoft })
  return (
    // ★ The Carved Hearth frame with the red close (Alex 11-15: every menu), around the same parchment map
    <HearthFrame title="The map" maxWidth={1400} onClose={onClose} fixed dataPanel="continent-map" backdropClass="z-[120]">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 12px 12px' }}>
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <button type="button" style={{ ...tab(side === 'nyx'), cursor: 'pointer' }} onClick={() => setSide('nyx')}>Athernyx</button>
          <button type="button" style={{ ...tab(side === 'ather'), cursor: 'pointer' }} onClick={() => setSide('ather')}
            title="The other state of this same land: what you have walked in the Wilds. You cross at Rune Hold's gate.">The Ather</button>
          {side === 'ather' && (
            // the gate-rune's one return from anywhere: the near end is you, the far end is your own plot's threshold
            // (gates.md 08-12 + 08-15). Waymarks stay display: a waymark as the far end is a keeper-chosen destination, unruled.
            <button type="button" style={{ ...tab(true), cursor: 'pointer', marginLeft: 10, borderColor: H.sky, background: 'rgba(79,118,144,0.14)', color: H.sky }}
              onClick={() => { window.location.href = '/shimmer/open/ather' }} title="Drop a gate-rune where you stand and step through to your plot's threshold.">Step home · your plot</button>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <canvas ref={base} data-map="base" onClick={tap} style={{ maxWidth: '86vw', maxHeight: '68vh', width: 'auto', height: 'auto', display: 'block', borderRadius: 8,
            border: '3px solid #5a3d22', boxShadow: '0 0 0 1px #c9a86a55, 0 18px 50px rgba(0,0,0,0.6)' }} />
          <canvas ref={marks} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 8 }} />
        </div>
        <div style={{ color: H.inkSoft, fontSize: 12, textAlign: 'center' }}>
          <span style={{ color: H.ink, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{pct.toFixed(side === 'ather' ? 2 : 1)}%</span>{' '}
          {side === 'ather' ? <>of the Ather walked · tap a waystone to step through · </> : <>of the continent inked · tap a lit door to step through · </>}<span style={{ letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: 10 }}>M / Esc close</span>
        </div>
      </div>
    </HearthFrame>
  )
}
