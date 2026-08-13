'use client'
// THE MAP — the voxel world drawn from its own worldgen, under canon's cloud.
//
// ★ This is the live one. `play3d/WorldMap.tsx` is the parked tile-walker map; see its header.
//
// ── ★ SAMPLED FROM WORLDGEN, NOT FROM WHAT IS LOADED ────────────────────────────────────────────
// The obvious build draws the chunks currently streamed in. It is wrong twice over: the map would
// forget everything the moment you walked away (chunks unload), and it would redraw at whatever
// resolution the stream happens to hold. Instead the terrain layer asks `columnHeight` / `zoneAt` /
// `waterLevelAt` directly — the same pure functions the mesher builds from — on a coarse lattice.
// The map is therefore always correct, never depends on memory, and costs nothing at runtime
// because it is computed ONCE and cached.
//
// Sampling the whole world up front is not "revealing" it: the CLOUD decides what a keeper may see,
// and it is composited over the top. The terrain layer is the cartographer's prepared plate; the
// cloud is how much of it has been inked in.
//
// ── ★ THE CLOUD (Alex, 2026-08-13: "introduce the clouds from canon") ──────────────────────────
// Unwalked ground is CLOUD, and in the Ather that is literal. `glossary.md` › the cloud-ocean: the
// Ather is an ocean of cloud, a garden is "a pocket carved into the calm deep — the cloud-walls are
// the ocean pressed soft around them." `spirit-tales-bible.md:216` gives the read outward, and it
// is exactly a fogged map's: "walls of soft, pale, faintly glowing cloud, piled like heaped wool.
// Beyond the cloud-walls lies a dark, star-flecked void" — and :242 closes it, that void "is the
// deep cloud seen from inside the pocket." Cloud-walls were re-ruled to STAY in 3D the same day.
//
//   walked      → the plate, drawn plainly
//   just beyond → the cloud-WALL: pale, glowing, wool-thick. An invitation, not a lid
//   further out → the deep: dark, star-flecked. Not "no data" — the ocean at depth

import { useEffect, useRef, useState } from 'react'
import { columnHeight } from '../voxel/height'
import { materialAt, MAT } from '../voxel/depth'
import { zoneAt, ZONE_ANCHORS } from '../voxel/zones'
import { CELL, isSeen, type Seen } from './discovery'

/** Blocks per sampled pixel of the terrain plate. One plate pixel per fog cell keeps the two
 *  layers in lockstep, so the cloud can never sit half a pixel off the ground it hides. */
const SAMPLE = CELL

/**
 * The mapped world: every zone's ellipse plus a margin of wild country, snapped out to whole
 * samples. Derived from `ZONE_ANCHORS` rather than hardcoded — add a zone to the garden and the map
 * grows to hold it instead of cropping it off an edge nobody thought to update.
 */
const MARGIN = 420
function worldBounds() {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const a of ZONE_ANCHORS) {
    x0 = Math.min(x0, a.x - a.rx - MARGIN); x1 = Math.max(x1, a.x + a.rx + MARGIN)
    z0 = Math.min(z0, a.z - a.rz - MARGIN); z1 = Math.max(z1, a.z + a.rz + MARGIN)
  }
  const snap = (v: number) => Math.round(v / SAMPLE) * SAMPLE
  return { x0: snap(x0), z0: snap(z0), w: snap(x1 - x0), h: snap(z1 - z0) }
}
export const BOUNDS = worldBounds()
/** Map cells across and down — also the discovery grid's size, so the two share one coordinate space. */
export const MAP_W = Math.ceil(BOUNDS.w / SAMPLE)
export const MAP_H = Math.ceil(BOUNDS.h / SAMPLE)

/** World XZ → map-local blocks. `discovery.ts` is origin-agnostic (0-based), so the offset lives
 *  here, in the one place that knows where the world's corner is. */
export const toLocal = (x: number, z: number) => ({ lx: x - BOUNDS.x0, lz: z - BOUNDS.z0 })

// ── the plate ───────────────────────────────────────────────────────────────────────────────────
// Zone colour, shaded by height, with water on top. Deliberately flat and quiet: the map is read
// for SHAPE — where the hills are, where the water runs, where a zone begins — and a saturated
// terrain painting would fight the cloud, which is the layer carrying the information.
const ZONE_COLOR: Record<string, [number, number, number]> = {
  'garden': [96, 138, 74],
  'moonwell-glade': [88, 132, 96],
  'mycelial-path': [104, 96, 132],
  'spirit-meadow': [126, 152, 78],
  'twilight-thicket': [58, 88, 62],
  'mana-springs': [86, 128, 140],
  'gloview-village': [138, 128, 84],
  'the-outfields': [104, 110, 88],
}
const WILD: [number, number, number] = [82, 92, 76]
const WATER: [number, number, number] = [58, 118, 158]

// ── ★ THE PLATE IS BUILT PROGRESSIVELY, AND THE NUMBERS ARE MEASURED NOT GUESSED ───────────────
// I first wrote "~40k samples, tens of ms" in this file. Measured on the real world: the plate is
// 534×275 = 147,000 cells and a single-sample build takes ~600ms — a visible hitch, and the minimap
// mounts with the world, so every player would eat it on load.
//
// Worse, the cheap version was WRONG as well as slow. A river is a few blocks wide and the lattice
// steps 16, so single-sampling walks straight over most of them: 6.9% of the world came back wet
// against 16.5% when each cell tests a 2×2 grid of sub-points. The map was not just aliasing the
// rivers, it was deleting them — and a map missing its rivers is worse than a map with none, since
// the player trusts it.
//
// So: 2×2 for the water question (the only one at odds with the lattice — zone and height are
// smooth fields and one sample is honest for them), and the whole build spread over idle slices of
// ~16 rows. `rev` ticks per band so an open map fills in as it goes. Total ~1.4s, none of it
// blocking, and the cloud hides nearly all of it anyway — a new keeper can only see one disc.
const WATER_SUB = 2
const BAND_ROWS = 16

let plate: HTMLCanvasElement | null = null
let plateImg: ImageData | null = null
let plateRow = 0
let plateSeed = -1
/** Ticks per completed band — the map's redraw key while the plate is still filling. */
export let plateRev = 0

function plateBand(seed: number) {
  if (!plate || !plateImg) return
  const ctx = plate.getContext('2d')!
  const end = Math.min(MAP_H, plateRow + BAND_ROWS)
  for (let my = plateRow; my < end; my++) {
    for (let mx = 0; mx < MAP_W; mx++) {
      const x = BOUNDS.x0 + mx * SAMPLE, z = BOUNDS.z0 + my * SAMPLE
      const h = columnHeight(x, z, seed)
      // ⚠ ASK THE WORLD, DO NOT INFER. The first cut tested `h < waterLevelAt(...)`, which reads
      // like "is this underwater" and is not: `waterLevelAt` is the smoothed regional water TABLE
      // the terrain generates AROUND, so every column dipping below it — most of a valley — came
      // back as lake. The map showed a bay across Moonwell Glade while the view out the window was
      // dry grass. `materialAt` one block above the surface is the actual question: a river or
      // basin fills to there, ordinary ground does not.
      let wet = false
      for (let sy = 0; sy < WATER_SUB && !wet; sy++) {
        for (let sx = 0; sx < WATER_SUB && !wet; sx++) {
          const px = x + (sx + 0.5) * SAMPLE / WATER_SUB, pz = z + (sy + 0.5) * SAMPLE / WATER_SUB
          const ph = columnHeight(px, pz, seed)
          if (materialAt(px, ph + 1, pz, seed, ph) === MAT.WATER) wet = true
        }
      }
      const za = zoneAt(x, z, seed)
      let c = za.zone ? ZONE_COLOR[za.zone.id] ?? WILD : WILD
      // Blend toward wild country at a zone's edge, so borders read as country becoming something
      // rather than as a painted line — the same membership the terrain itself is blended by.
      if (za.zone && za.t < 1) c = [
        WILD[0] + (c[0] - WILD[0]) * za.t,
        WILD[1] + (c[1] - WILD[1]) * za.t,
        WILD[2] + (c[2] - WILD[2]) * za.t,
      ]
      let [r, g, b] = c
      if (wet) { r = WATER[0]; g = WATER[1]; b = WATER[2] }
      else {
        // Height shading, gentle: ±22% across the world's usable relief. Enough to read a ridge.
        const k = 0.78 + Math.max(0, Math.min(1, (h - 40) / 90)) * 0.44
        r *= k; g *= k; b *= k
      }
      const i = (my * MAP_W + mx) * 4
      plateImg.data[i] = r; plateImg.data[i + 1] = g; plateImg.data[i + 2] = b; plateImg.data[i + 3] = 255
    }
  }
  ctx.putImageData(plateImg, 0, 0)
  plateRow = end
  plateRev++
  if (plateRow < MAP_H) setTimeout(() => plateBand(seed), 0)
}

/** The plate as it stands. Returns immediately — blank at first, filling in over ~1.4s of idle. */
function terrainPlate(seed: number): HTMLCanvasElement {
  if (plate && plateSeed === seed) return plate
  plate = document.createElement('canvas')
  plate.width = MAP_W; plate.height = MAP_H
  const ctx = plate.getContext('2d')!
  ctx.fillStyle = '#0b0d10'
  ctx.fillRect(0, 0, MAP_W, MAP_H)
  plateImg = ctx.getImageData(0, 0, MAP_W, MAP_H)
  plateRow = 0; plateSeed = seed
  setTimeout(() => plateBand(seed), 0)
  return plate
}

// ── the cloud ───────────────────────────────────────────────────────────────────────────────────
const CLOUD = '#e9edf8'          // canon: soft, pale, faintly glowing
const DEEP = '#080614'           // the star-flecked void beyond the walls
const WALL_GLOW = 0.5
const BLUR_WALL = 3.4            // × cell px — how far the glow reaches into the deep
const BLUR_EDGE = 1.15           // × cell px — how soft the walked edge is

// Scratch canvases are module-level and reused: the minimap redraws every time the keeper crosses
// a cell or turns, and building three canvases per redraw is a steady allocation drip for a whole
// session. Same rule `render-audit.test.ts` enforces for GPU objects, applied to 2D.
const scratch: Record<string, HTMLCanvasElement> = {}
function buf(name: string, w: number, h: number): CanvasRenderingContext2D {
  let c = scratch[name]
  if (!c) { c = document.createElement('canvas'); scratch[name] = c }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  const ctx = c.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, w, h)
  return ctx
}

/** One pixel per cell, white where walked. Cached on `rev` — `see()` mutates in place, so without a
 *  change counter this rebuilds thousands of cells per redraw to produce an identical image. */
let maskRev = -1, maskFor: Seen | null = null
function seenMask(seen: Seen): HTMLCanvasElement {
  if (maskFor === seen && maskRev === seen.rev) return scratch.mask
  const mc = buf('mask', seen.cw, seen.ch)
  mc.fillStyle = '#fff'
  for (let y = 0; y < seen.ch; y++) for (let x = 0; x < seen.cw; x++) if (isSeen(seen, x, y)) mc.fillRect(x, y, 1, 1)
  maskFor = seen; maskRev = seen.rev
  return scratch.mask
}

/** Deterministic stars over the deep — the same unexplored ocean carries the same stars every time
 *  the map is opened. A field that reshuffled per open would read as static, and the void is a
 *  PLACE the keeper has not been, not an effect. */
function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const n = Math.round((w * h) / (2600 * scale))
  for (let i = 0; i < n; i++) {
    const a = Math.sin(i * 12.9898) * 43758.5453
    const b = Math.sin(i * 78.233) * 43758.5453
    const c = Math.sin(i * 39.425) * 43758.5453
    ctx.fillStyle = `rgba(226,232,255,${(0.25 + (c - Math.floor(c)) * 0.55).toFixed(3)})`
    ctx.fillRect((a - Math.floor(a)) * w, (b - Math.floor(b)) * h, scale, scale)
  }
}

/** Lay the cloud over everything unwalked. Call LAST — it paints over the finished map, so markers
 *  and labels never have to know what is hidden. `ox/oy` shift the stencil for a cropped view. */
function drawCloud(ctx: CanvasRenderingContext2D, seen: Seen, cellPx: number, ox = 0, oy = 0) {
  const w = ctx.canvas.width, h = ctx.canvas.height
  const mask = seenMask(seen)
  const mw = seen.cw * cellPx, mh = seen.ch * cellPx

  const lc = buf('cloud', w, h)
  lc.fillStyle = DEEP
  lc.fillRect(0, 0, w, h)
  drawStars(lc, w, h, Math.max(1, cellPx * 0.12))

  // the wall: the stencil tinted cloud-pale, blurred wide and ADDED, so neighbouring frontiers pile
  // up like heaped wool instead of flat-topping at one alpha
  const tc = buf('tint', w, h)
  tc.imageSmoothingEnabled = true
  tc.drawImage(mask, ox, oy, mw, mh)
  tc.globalCompositeOperation = 'source-in'
  tc.fillStyle = CLOUD
  tc.fillRect(0, 0, w, h)
  lc.save()
  lc.globalCompositeOperation = 'lighter'
  lc.globalAlpha = WALL_GLOW
  lc.filter = `blur(${(cellPx * BLUR_WALL).toFixed(1)}px)`
  lc.drawImage(scratch.tint, 0, 0)
  lc.restore()

  // punch the walked ground clear, tightly — this edge is what reads as "here is what I know"
  lc.save()
  lc.globalCompositeOperation = 'destination-out'
  lc.filter = `blur(${(cellPx * BLUR_EDGE).toFixed(1)}px)`
  lc.imageSmoothingEnabled = true
  lc.drawImage(mask, ox, oy, mw, mh)
  lc.restore()

  ctx.drawImage(scratch.cloud, 0, 0)
}

function drawKeeper(ctx: CanvasRenderingContext2D, x: number, y: number, yaw: number, r: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-yaw)
  ctx.fillStyle = 'rgba(232,88,74,0.30)'
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 5, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#ff6b5a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.restore()
}

// ── the full map (M) ────────────────────────────────────────────────────────────────────────────

export function VoxelMap({ seed, seenRef, seenTick, posRef, yawRef, onClose }: {
  seed: number
  seenRef: React.RefObject<Seen | null>
  /** Bumped when ground opens, so an open map peels back as you walk rather than on next open. */
  seenTick: number
  posRef: React.RefObject<{ x: number; z: number } | null>
  yawRef: React.RefObject<number>
  onClose: () => void
}) {
  const base = useRef<HTMLCanvasElement>(null)
  const marks = useRef<HTMLCanvasElement>(null)
  const [pct, setPct] = useState(0)
  // The plate fills in over ~1.4s of idle slices, so an open map repaints as bands land rather than
  // showing a half-drawn world until the next open.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (plateRow >= MAP_H) return
    const id = setInterval(() => { setTick(plateRev); if (plateRow >= MAP_H) clearInterval(id) }, 120)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const cv = base.current, seen = seenRef.current
    if (!cv) return
    const px = Math.max(1, Math.floor(Math.min(1500 / MAP_W, 900 / MAP_H)))
    cv.width = MAP_W * px; cv.height = MAP_H * px
    const ctx = cv.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(terrainPlate(seed), 0, 0, cv.width, cv.height)
    if (seen) {
      drawCloud(ctx, seen, px)
      let on = 0
      for (let y = 0; y < seen.ch; y++) for (let x = 0; x < seen.cw; x++) if (isSeen(seen, x, y)) on++
      setPct((on / (seen.cw * seen.ch)) * 100)
    }
  }, [seed, seenRef, seenTick, tick])

  useEffect(() => {
    const cv = marks.current, b = base.current
    if (!cv || !b) return
    let id = 0
    const tick = () => {
      if (cv.width !== b.width || cv.height !== b.height) { cv.width = b.width; cv.height = b.height }
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, cv.width, cv.height)
      const p = posRef.current
      if (p) {
        const { lx, lz } = toLocal(p.x, p.z)
        const px = cv.width / MAP_W
        drawKeeper(ctx, (lx / SAMPLE) * px, (lz / SAMPLE) * px, yawRef.current, Math.max(3, px * 0.9))
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [posRef, yawRef])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(6,5,14,0.88)',
      display: 'grid', placeItems: 'center', cursor: 'pointer',
    }}>
      <div style={{ position: 'relative', maxWidth: '94vw', maxHeight: '86vh' }}>
        <canvas ref={base} style={{ maxWidth: '94vw', maxHeight: '82vh', width: 'auto', height: 'auto', imageRendering: 'pixelated', borderRadius: 10, border: '1px solid #ffe9b033', display: 'block' }} />
        <canvas ref={marks} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: '#cfc7ae', font: '700 12px ui-monospace, monospace', textAlign: 'center' }}>
        ✦ {pct.toFixed(1)}% walked · the cloud is what you have not · M or click to close
      </div>
    </div>
  )
}

// ── the minimap ─────────────────────────────────────────────────────────────────────────────────
/** Half-width of the crop, in BLOCKS. Roughly the daylight fog distance, so the corner of the
 *  screen agrees with what the keeper can actually see out there. */
const MINI_REACH = 240

export function VoxelMiniMap({ seed, seenRef, posRef, yawRef, onExpand }: {
  seed: number
  seenRef: React.RefObject<Seen | null>
  posRef: React.RefObject<{ x: number; z: number } | null>
  yawRef: React.RefObject<number>
  onExpand: () => void
}) {
  const cvRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const SIZE = 148
    cv.width = SIZE * 2; cv.height = SIZE * 2
    let id = 0, last = ''
    const tick = () => {
      id = requestAnimationFrame(tick)
      const p = posRef.current, seen = seenRef.current
      if (!p) return
      // `rev` is in the key so opening ground repaints the crop. Without it the cloud would only
      // peel back when the keeper happened to turn, which reads as the map lagging behind the walk.
      const key = `${Math.round(p.x / 4)},${Math.round(p.z / 4)},${Math.round(yawRef.current * 10)},${seen?.rev ?? -1},${plateRev}`
      if (key === last) return
      last = key
      const ctx = cv.getContext('2d')!
      const cellPx = cv.width / ((MINI_REACH * 2) / SAMPLE)
      const { lx, lz } = toLocal(p.x, p.z)
      const ox = -((lx - MINI_REACH) / SAMPLE) * cellPx
      const oy = -((lz - MINI_REACH) / SAMPLE) * cellPx
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.fillStyle = DEEP
      ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.drawImage(terrainPlate(seed), ox, oy, MAP_W * cellPx, MAP_H * cellPx)
      if (seen) drawCloud(ctx, seen, cellPx, ox, oy)
      drawKeeper(ctx, cv.width / 2, cv.height / 2, yawRef.current, 5)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [seed, seenRef, posRef, yawRef])
  return (
    <canvas ref={cvRef} onClick={onExpand} title="Map (M)" style={{
      position: 'fixed', top: 12, right: 12, zIndex: 33, width: 148, height: 148,
      borderRadius: 10, border: '1px solid #ffffff3a', background: DEEP,
      boxShadow: '0 3px 14px #0008', cursor: 'pointer', imageRendering: 'pixelated',
    }} />
  )
}
