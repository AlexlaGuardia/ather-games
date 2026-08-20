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
import { DEFAULT_PLOT, plotHeight, plotMaterialAt, inWall, plotThreshold, type PlotConfig } from '../voxel/plot'
import { caveAnchor } from '../voxel/bubble'
import { WILDS_BUBBLE } from '../voxel/column'
import type { Space } from './save'

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

// ── ★★ THE OTHER WORLD: THE KEEPER'S OWN FOLD (2026-08-18) ─────────────────────────────────────
// Alex, inside his garden: *"fix the map so it shows the plot."* Pressing M in the fold drew the
// WILDS — starfield, two green blobs — with the keeper's plot position plotted in **Wilds
// coordinates**, because plot (0,0) and Wilds (0,0) are different places wearing one name. That is
// the same two-spaces-one-name hazard `save.ts` namespaces its records against and `enterSpace`
// clears eleven caches for; the map was simply never told there were two worlds.
//
// ★ EVERYTHING ABOVE IS THE CONTINENT'S MAP AND STAYS THAT WAY. `BOUNDS` is derived from
// `ZONE_ANCHORS`, the plate samples `columnHeight`/`zoneAt`/`materialAt`, and the fog grid is sized
// to it. None of that means anything inside a bounded island measured from its own centre. So the
// plot gets its own plate, its own bounds and its own sample rate rather than a mode threaded
// through a lattice built for an endless world.
//
// ★★ AND THE PLOT IS **NOT FOGGED**, which is a design call worth stating. The cloud is honest out
// there — canon: *"what you have walked is pressed open, what you have not is still ocean"* — but
// inside your own pocket it inverts the meaning: Greg folded this ground FOR you, it is bounded, it
// is yours, and the whole verb here is planning a build on it. A keeper who cannot see the shape of
// their own garden cannot choose where the bench goes. Hiding the threshold behind fog would also
// re-create, on the map, the exact bug that had Alex sealed in this garden yesterday.

/** Blocks per plate pixel inside the fold. Derived, so a widened fold does not lose resolution. */
const plotSample = (cfg: PlotConfig) => Math.max(1, Math.round(cfg.capRadius / 64))
/** The plate is a square of the whole fold plus a little void, in plate pixels. */
const plotSpan = (cfg: PlotConfig) => Math.ceil(((cfg.capRadius + cfg.wallWidth + 6) * 2) / plotSample(cfg))
/** Fold XZ (centre-origin) → plate pixel. */
const plotToPixel = (x: number, z: number, cfg: PlotConfig) => {
  const n = plotSpan(cfg), s = plotSample(cfg)
  return { px: n / 2 + x / s, py: n / 2 + z / s }
}

const PLOT_TURF: [number, number, number] = [104, 146, 82]
const PLOT_SOIL: [number, number, number] = [122, 104, 78]
const PLOT_ROCK: [number, number, number] = [124, 126, 130]

let pPlate: HTMLCanvasElement | null = null
let pPlateKey = ''

/**
 * The fold, drawn whole.
 *
 * ★ BUILT IN ONE PASS, UNLIKE THE CONTINENT'S. That one is 147,000 cells of noise and had to be
 * spread over idle slices; this is ~130×130 of cheap arithmetic on a bounded disc — a few ms — and
 * a progressive build would add a second cache-invalidation story for nothing.
 *
 * ⚠ KEYED ON `capRadius` AS WELL AS THE SEED. The fold grows (Greg widens it), and a plate cached
 * on seed alone would keep showing the island the keeper had before their upgrade — the map lying
 * about the one thing they just earned.
 */
function foldPlate(seed: number, cfg: PlotConfig): HTMLCanvasElement {
  const key = `${seed}:${cfg.capRadius}`
  if (pPlate && pPlateKey === key) return pPlate
  const n = plotSpan(cfg), s = plotSample(cfg)
  const cv = pPlate ?? document.createElement('canvas')
  cv.width = n; cv.height = n
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(n, n)
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const x = Math.round((px - n / 2) * s), z = Math.round((py - n / 2) * s)
      const h = plotHeight(x, z, seed, cfg)
      let r: number, g: number, b: number
      if (h === null) {
        // The wall reads as the cloud it is; everything past it is the star-flecked deep, and canon
        // is explicit that the void is not to be dressed up.
        if (inWall(x, z, seed, cfg)) { r = 233; g = 237; b = 248 }
        else { r = 8; g = 6; b = 20 }
      } else {
        const m = plotMaterialAt(x, h, z, seed, cfg)
        const c = m === cfg.materials.topsoil ? PLOT_TURF
          : m === cfg.materials.subsoil ? PLOT_SOIL
          : m === cfg.materials.stone ? PLOT_ROCK
          : [214, 222, 236] as [number, number, number]   // the keel's cloud, where the lip thins
        // Gentle relief so a roll reads. The fold is nearly flat by design, so the range is small.
        const k = 0.86 + Math.max(0, Math.min(1, (h - cfg.baseY) / Math.max(1, cfg.roll * 2))) * 0.28
        r = c[0] * k; g = c[1] * k; b = c[2] * k
      }
      const i = (py * n + px) * 4
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  pPlate = cv; pPlateKey = key
  return cv
}

/**
 * The door, marked.
 *
 * ★ THE ONE THING A KEEPER OPENS THIS MAP FOR. The fold's only way out is a seam in a wall that is
 * ~1,900 blocks around at the top tier; the whole reason the map is worth fixing is so nobody has to
 * walk the perimeter looking for it again.
 */
/**
 * ── ★★ THE DOOR, ON THE COUNTRY'S MAP TOO (2026-08-19) ─────────────────────────────────────────
 * Alex: *"maybe with a marker on the map as well."* The Wilds map had exactly one mark on it — the
 * keeper — so the fold's passage was findable only by walking a 6.3km wall until the shimmer
 * appeared. This is the same ring the fold's own map wears for its threshold, on purpose: **one
 * symbol for one thing.** A keeper who learns the ring inside their garden reads it instantly out in
 * the country, and both rings mean the same sentence — *this is the way through*.
 *
 * ⚠ IT IS NOT GATED ON HAVING FOUND IT. Canon puts the build's job plainly (`bubble.ts` ›
 * `passageBearing`): *"a single opening in a 6.3km circumference is undiscoverable by exploration,
 * so the build must put the player's arrival AT it rather than hoping they find it."* A fog-of-war
 * rule that hid your own front door until you stumbled on it would be that sentence inverted.
 */
function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const r = Math.max(4, scale * 1.6)
  ctx.save()
  ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = Math.max(1.5, scale * 0.35)
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = 'rgba(255,233,176,0.35)'
  ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/**
 * ── ★★ THE MINIMAP HAD THE RING AND STILL COULD NOT POINT HOME (2026-08-19) ─────────────────────
 * Alex, asking for the door to be marked a second time: *"add a marker on the map to help find
 * it."* It already was — the ring shipped that morning and draws on all four surfaces. **The bug is
 * that the minimap is a WINDOW, not a map.** `MINI_REACH` is 240 blocks and the fold is 600 across,
 * so from most of the garden the door is simply outside the crop and the ring is drawn into the
 * void beyond the canvas edge, where it is not merely small — it does not exist. The one surface a
 * keeper actually navigates by is the one that goes blank exactly when they are lost.
 *
 * ★ SO AN OFF-WINDOW MARK IS PINNED TO THE RIM AND POINTS. **Same ring, never a second symbol** —
 * this file's own rule, *"one symbol for one thing"* — with a chevron added outside it to say *it
 * is this way, further*. A different glyph for "off-map door" would make the keeper learn two marks
 * for one door, and the whole reason the ring reads instantly out in the Wilds is that it is the
 * mark they already know from home.
 *
 * ⚠ THE CHEVRON CARRIES "FURTHER", NOT A DIMMER RING — and the first cut got that backwards. A rim
 * mark states a DIRECTION and cannot state a distance, so it must read differently from an on-window
 * one; I did that by drawing it at 70%, which is correct reasoning applied to the wrong channel. On
 * a **148px** minimap a 5px ring at 70% is not "a softer statement", it is a smudge you do not
 * notice — so the mark that exists for the keeper who is lost was the one that disappeared. The
 * ring now draws at full strength and the CHEVRON is the whole difference: a ring alone means
 * *there it is*, a ring with a barb pointing off-map means *that way, keep going*. Shape carries
 * meaning at any size; opacity does not.
 */
function drawDoorPinned(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number,
                        w: number, h: number) {
  // ⚠ ROOM FOR THE BARB, not just the ring — pinned at `r` the chevron hangs off the canvas and the
  // one element that says "further" is the one that gets clipped away.
  const pad = Math.max(12, scale * 3.4)
  const cx = Math.min(Math.max(x, pad), w - pad)
  const cy = Math.min(Math.max(y, pad), h - pad)
  if (cx === x && cy === y) { drawDoor(ctx, x, y, scale); return }
  const dx = x - w / 2, dy = y - h / 2
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  const r = Math.max(4, scale * 1.6)
  ctx.save()
  // ⚠ A DARK SEAT UNDER THE MARK. The fold's plate is pale green and its wall is near-white cloud;
  // a thin gold ring laid straight on either is a ring you have to already know is there. Same rule
  // the game-UI note states for text over canvas — nothing sits raw on a scene.
  ctx.fillStyle = 'rgba(8,6,20,0.55)'
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.fill()
  drawDoor(ctx, cx, cy, scale)
  // The chevron sits OUTSIDE the ring, on the line to the real thing.
  const t = Math.max(4, scale * 1.3)
  ctx.fillStyle = '#ffe9b0'
  ctx.beginPath()
  ctx.moveTo(cx + ux * (r + 2 + t), cy + uy * (r + 2 + t))
  ctx.lineTo(cx + ux * (r + 2) - uy * t * 0.75, cy + uy * (r + 2) + ux * t * 0.75)
  ctx.lineTo(cx + ux * (r + 2) + uy * t * 0.75, cy + uy * (r + 2) - ux * t * 0.75)
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

function drawThreshold(ctx: CanvasRenderingContext2D, seed: number, cfg: PlotConfig,
                       scale: number, ox = 0, oy = 0, w = 0, h = 0) {
  const t = plotThreshold(seed, cfg)
  const { px, py } = plotToPixel(t.x, t.z, cfg)
  // ⚠ THE OFFSET IS NOT OPTIONAL ON THE MINIMAP. That surface draws the plate translated so the
  // keeper sits at the centre; a marker placed in plate space without the same translation lands
  // somewhere in the corner and confidently points at nothing.
  // ⚠ `w`/`h` DEFAULT TO 0, WHICH MEANS "THIS SURFACE HAS NO RIM TO PIN TO". The expanded map draws
  // the WHOLE fold, so a mark can never be off it and clamping there would drag a perfectly visible
  // ring onto the border. Only the windowed minimap passes its canvas.
  if (w > 0 && h > 0) drawDoorPinned(ctx, ox + px * scale, oy + py * scale, scale, w, h)
  else drawDoor(ctx, ox + px * scale, oy + py * scale, scale)
}

/** The fold's passage, in WILDS coordinates — the same ring, on the country's map. */
function drawWildsDoor(ctx: CanvasRenderingContext2D, seed: number, cellPx: number,
                      ox = 0, oy = 0, w = 0, h = 0) {
  // ── ★ THE MARK IS ON THE DOOR, NOT ON WHERE YOU STAND TO LOOK AT IT (2026-08-20) ─────────────
  // This read `passageApproach`, which is the ARRIVAL — and the arrival is derived from the cave's
  // depth, so the day the mound grew, the mark quietly slid 22 blocks out into open country while
  // still calling itself the door. The plot's own mark uses `plotThreshold`, the threshold itself.
  // Same ring, same meaning, both sides: the mark is the mouth.
  //
  // ⚠ AND IT MUST STAY DERIVED FROM THE CAVE, NOT PINNED. `caveAnchor` is the point on the shell's
  // outer face at the passage bearing — the one place the mouth can be. A stored coordinate here
  // would survive a generator change and point at a wall, which is the failure `/goto garden` already
  // shipped once.
  const a = caveAnchor(seed, WILDS_BUBBLE)
  const { lx, lz } = toLocal(a.x, a.z)
  const px = ox + (lx / SAMPLE) * cellPx, py = oy + (lz / SAMPLE) * cellPx
  // ★ THE COUNTRY NEEDS THIS MORE THAN THE GARDEN DOES, not less. Out here the door is one point in
  // a 6.3km-round wall and the minimap reaches 240 blocks; the odds of it falling inside the window
  // by chance are about nil, so without a rim mark the Wilds minimap has never once pointed home.
  if (w > 0 && h > 0) drawDoorPinned(ctx, px, py, cellPx, w, h)
  else drawDoor(ctx, px, py, cellPx)
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

/**
 * The keeper: a dot with a view-cone.
 *
 * ★ `heading` is a CANVAS ROTATION from `screenHeading`, not a world yaw — and the cone is drawn
 * along +x so that rotation is the whole transform. The first cut drew the cone pointing UP and
 * rotated by `-yaw`, which is two conventions fighting: it came out exactly 180° backwards, and
 * every single-axis spot check you would think to write still passed. See `map-heading.test.ts`.
 */
function drawKeeper(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, r: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(heading)
  ctx.fillStyle = 'rgba(232,88,74,0.30)'
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 5, -0.5, 0.5); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#ff6b5a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.restore()
}

// ── the full map (M) ────────────────────────────────────────────────────────────────────────────

export function VoxelMap({ seed, seenRef, seenTick, posRef, headingRef, space, plotCfg, onClose }: {
  seed: number
  seenRef: React.RefObject<Seen | null>
  /** Bumped when ground opens, so an open map peels back as you walk rather than on next open. */
  seenTick: number
  posRef: React.RefObject<{ x: number; z: number } | null>
  /** Canvas rotation from `screenHeading` — NOT a world yaw. */
  headingRef: React.RefObject<number>
  /**
   * ⚠ WHICH WORLD THE POSITION IS IN. Without it this drew the Wilds while the keeper stood in
   * their fold, with their plot coordinates plotted against continent bounds — a starfield and a
   * dot in the wrong country. Same field, same reason, as `PlayerSave.space`.
   */
  space: Space
  /** The keeper's own fold size — it grows, and the plate is cached against it. */
  plotCfg: React.RefObject<PlotConfig>
  onClose: () => void
}) {
  const inFold = space === 'plot'
  const cfg = plotCfg.current ?? DEFAULT_PLOT
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
    const ctx = cv.getContext('2d')!
    if (inFold) {
      // The fold: its own plate, no fog (see the fold-plate header), and the door marked.
      const n = plotSpan(cfg)
      const px = Math.max(1, Math.floor(Math.min(1100 / n, 820 / n)))
      cv.width = n * px; cv.height = n * px
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(foldPlate(seed, cfg), 0, 0, cv.width, cv.height)
      drawThreshold(ctx, seed, cfg, px)
      setPct(-1)
      return
    }
    const px = Math.max(1, Math.floor(Math.min(1500 / MAP_W, 900 / MAP_H)))
    cv.width = MAP_W * px; cv.height = MAP_H * px
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(terrainPlate(seed), 0, 0, cv.width, cv.height)
    // ⚠ AFTER the cloud, never before: the fog is painted over the plate, so a mark drawn first is
    // a mark the weather rubs out — and the one thing this map exists to point at would be the first
    // thing hidden.
    drawWildsDoor(ctx, seed, px)
    if (seen) {
      drawCloud(ctx, seen, px)
      drawWildsDoor(ctx, seed, px)
      let on = 0
      for (let y = 0; y < seen.ch; y++) for (let x = 0; x < seen.cw; x++) if (isSeen(seen, x, y)) on++
      setPct((on / (seen.cw * seen.ch)) * 100)
    }
  }, [seed, seenRef, seenTick, tick, inFold, cfg])

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
        // ⚠ THE KEEPER DOT IS THE HALF THAT WAS ACTIVELY LYING. Plot coordinates run through the
        // continent's `toLocal` put the dot hundreds of blocks from where the keeper stood, on a map
        // of a different world — and it looked like a plausible position, which is worse than none.
        if (inFold) {
          const px = cv.width / plotSpan(cfg)
          const { px: mx, py: my } = plotToPixel(p.x, p.z, cfg)
          drawKeeper(ctx, mx * px, my * px, headingRef.current, Math.max(3, px * 0.9))
        } else {
          const { lx, lz } = toLocal(p.x, p.z)
          const px = cv.width / MAP_W
          drawKeeper(ctx, (lx / SAMPLE) * px, (lz / SAMPLE) * px, headingRef.current, Math.max(3, px * 0.9))
        }
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [posRef, headingRef])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(6,5,14,0.88)',
      display: 'grid', placeItems: 'center', cursor: 'pointer',
    }}>
      <div style={{ position: 'relative', maxWidth: '94vw', maxHeight: '86vh' }}>
        {/* `data-map` is the harness's handle. Picking "the biggest canvas" finds the WORLD's WebGL
            surface, whose 2D context is null — so a pixel assert against it reads as -1 and looks
            like a drawing failure rather than a selector failure. */}
        <canvas ref={base} data-map="base" style={{ maxWidth: '94vw', maxHeight: '82vh', width: 'auto', height: 'auto', imageRendering: 'pixelated', borderRadius: 10, border: '1px solid #ffe9b033', display: 'block' }} />
        <canvas ref={marks} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: '#cfc7ae', font: '700 12px ui-monospace, monospace', textAlign: 'center' }}>
        {inFold
          ? '✦ your fold · the ring is your threshold · M or click to close'
          : `✦ ${pct.toFixed(1)}% walked · the ring is the passage to your fold · M or click to close`}
      </div>
    </div>
  )
}

// ── the minimap ─────────────────────────────────────────────────────────────────────────────────
/** Half-width of the crop, in BLOCKS. Roughly the daylight fog distance, so the corner of the
 *  screen agrees with what the keeper can actually see out there. */
const MINI_REACH = 240

export function VoxelMiniMap({ seed, seenRef, posRef, headingRef, spaceRef, plotCfg, onExpand }: {
  seed: number
  seenRef: React.RefObject<Seen | null>
  posRef: React.RefObject<{ x: number; z: number } | null>
  /** Canvas rotation from `screenHeading` — NOT a world yaw. */
  headingRef: React.RefObject<number>
  /**
   * ⚠ A REF, NOT A PROP VALUE, UNLIKE THE FULL MAP'S. The minimap redraws from a rAF loop that is
   * set up once; a prop would be captured in that closure and the corner of the screen would keep
   * drawing the Wilds after the keeper crossed into their garden — the same staleness the crossing
   * bugs kept producing, in the one surface that is on screen the whole time.
   */
  spaceRef: React.RefObject<Space>
  plotCfg: React.RefObject<PlotConfig>
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
      const inFold = spaceRef.current === 'plot'
      const cfg = plotCfg.current ?? DEFAULT_PLOT
      // `rev` is in the key so opening ground repaints the crop. Without it the cloud would only
      // peel back when the keeper happened to turn, which reads as the map lagging behind the walk.
      // ⚠ THE SPACE AND THE FOLD SIZE ARE IN THE KEY TOO: both change without the keeper moving —
      // crossing the seam, and Greg widening the fold — and a crop keyed on position alone would sit
      // there showing the other world until they happened to take a step.
      const key = `${Math.round(p.x / 4)},${Math.round(p.z / 4)},${Math.round(headingRef.current * 10)},${seen?.rev ?? -1},${plateRev},${inFold ? cfg.capRadius : 'w'}`
      if (key === last) return
      last = key
      const ctx = cv.getContext('2d')!
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.fillStyle = DEEP
      ctx.fillRect(0, 0, cv.width, cv.height)
      if (inFold) {
        // Same crop reach in BLOCKS as out in the country, so the corner of the screen means one
        // thing in both worlds — and at r300 that is a window on the fold rather than the whole of
        // it, which is the honest read: a garden that size is not glanceable.
        const cellPx = cv.width / ((MINI_REACH * 2) / plotSample(cfg))
        const { px: mx, py: my } = plotToPixel(p.x, p.z, cfg)
        const n = plotSpan(cfg)
        const ox = cv.width / 2 - mx * cellPx, oy = cv.height / 2 - my * cellPx
        ctx.drawImage(foldPlate(seed, cfg), ox, oy, n * cellPx, n * cellPx)
        drawThreshold(ctx, seed, cfg, cellPx, ox, oy, cv.width, cv.height)
        drawKeeper(ctx, cv.width / 2, cv.height / 2, headingRef.current, 5)
        return
      }
      const cellPx = cv.width / ((MINI_REACH * 2) / SAMPLE)
      const { lx, lz } = toLocal(p.x, p.z)
      const ox = -((lx - MINI_REACH) / SAMPLE) * cellPx
      const oy = -((lz - MINI_REACH) / SAMPLE) * cellPx
      ctx.drawImage(terrainPlate(seed), ox, oy, MAP_W * cellPx, MAP_H * cellPx)
      if (seen) drawCloud(ctx, seen, cellPx, ox, oy)
      drawWildsDoor(ctx, seed, cellPx, ox, oy, cv.width, cv.height)
      drawKeeper(ctx, cv.width / 2, cv.height / 2, headingRef.current, 5)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [seed, seenRef, posRef, headingRef, spaceRef, plotCfg])
  return (
    <canvas ref={cvRef} onClick={onExpand} title="Map (M)" style={{
      position: 'fixed', top: 12, right: 12, zIndex: 33, width: 148, height: 148,
      borderRadius: 10, border: '1px solid #ffffff3a', background: DEEP,
      boxShadow: '0 3px 14px #0008', cursor: 'pointer', imageRendering: 'pixelated',
    }} />
  )
}
