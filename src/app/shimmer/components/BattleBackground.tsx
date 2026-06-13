'use client'

import { useRef, useEffect } from 'react'

// ============================================
// Battle Backgrounds — GBC-style pixel scenes
// Drawn at 160x96, CSS-scaled with pixelated rendering
// ============================================

const BG_W = 320
const BG_H = 192

type BgTheme = 'garden' | 'mycelial' | 'moonwell' | 'twilight' | 'threshold' | 'manaspring' | 'meadow'

function zoneToTheme(zoneId: string): BgTheme {
  if (zoneId === 'mycelial-path' || zoneId === 'spore-hollow') return 'mycelial'
  if (zoneId === 'moonwell-glade') return 'moonwell'
  if (zoneId === 'twilight-thicket') return 'twilight'
  if (zoneId === 'the-threshold') return 'threshold'
  if (zoneId === 'mana-springs') return 'manaspring'
  if (zoneId === 'spirit-meadow') return 'meadow'
  return 'garden'
}

// Seeded PRNG — deterministic backgrounds
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

// ============================================
// Draw Helpers
// ============================================

function fillBands(ctx: CanvasRenderingContext2D, y: number, h: number, w: number, colors: string[]) {
  const bandH = Math.ceil(h / colors.length)
  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i]
    ctx.fillRect(0, y + i * bandH, w, bandH + 1)
  }
}

function drawHill(ctx: CanvasRenderingContext2D, cx: number, baseY: number, width: number, height: number) {
  const steps = Math.ceil(height)
  for (let i = 0; i < steps; i++) {
    const p = i / steps
    const rowW = width * (1 - p * p)
    ctx.fillRect(Math.floor(cx - rowW / 2), Math.floor(baseY - i), Math.ceil(rowW), 1)
  }
}

function drawMushroom(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  capW: number, capH: number,
  stemColor: string, capColor: string, glowColor: string,
) {
  const stemW = Math.max(2, Math.floor(capW * 0.3))
  const stemH = Math.floor(capH * 0.8)
  // Stem
  ctx.fillStyle = stemColor
  ctx.fillRect(x + Math.floor((capW - stemW) / 2), y, stemW, stemH)
  // Cap
  ctx.fillStyle = capColor
  ctx.fillRect(x, y - Math.floor(capH * 0.4), capW, Math.floor(capH * 0.5))
  ctx.fillRect(x + 1, y - Math.floor(capH * 0.55), capW - 2, Math.floor(capH * 0.2))
  // Glow spots
  ctx.fillStyle = glowColor
  ctx.fillRect(x + 2, y - Math.floor(capH * 0.3), 1, 1)
  if (capW > 8) ctx.fillRect(x + capW - 3, y - Math.floor(capH * 0.35), 1, 1)
}

// ============================================
// Shimmer Garden
// ============================================

function drawGarden(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rng = mulberry32(seedFromStr('garden'))

  // Sky — warm amber bands
  fillBands(ctx, 0, h * 0.52, w, [
    '#1a1008', '#2a1810', '#3a2818', '#5a3828', '#7a5838', '#9a7848',
  ])

  // Distant hills
  ctx.fillStyle = '#1a3018'
  drawHill(ctx, w * 0.25, h * 0.5, w * 0.6, 14)
  ctx.fillStyle = '#162810'
  drawHill(ctx, w * 0.75, h * 0.52, w * 0.5, 10)

  // Tree silhouette — right
  ctx.fillStyle = '#102008'
  const tx = Math.floor(w * 0.87)
  ctx.fillRect(tx, Math.floor(h * 0.32), 2, Math.floor(h * 0.2))
  ctx.fillRect(tx - 3, Math.floor(h * 0.25), 8, 7)
  ctx.fillRect(tx - 2, Math.floor(h * 0.23), 6, 2)

  // Small tree — left
  const tx2 = Math.floor(w * 0.12)
  ctx.fillRect(tx2, Math.floor(h * 0.4), 2, Math.floor(h * 0.12))
  ctx.fillRect(tx2 - 2, Math.floor(h * 0.35), 6, 5)

  // Ground
  ctx.fillStyle = '#1a3818'
  ctx.fillRect(0, Math.floor(h * 0.52), w, h)

  // Grass variation
  ctx.fillStyle = '#2a4820'
  for (let x = 0; x < w; x += 2) {
    if (rng() > 0.5) {
      ctx.fillRect(x, Math.floor(h * 0.52), 2, 1 + Math.floor(rng() * 2))
    }
  }

  // Ground texture
  ctx.fillStyle = '#142810'
  for (let x = 0; x < w; x += 3) {
    for (let y = Math.floor(h * 0.6); y < h; y += 4) {
      if (rng() > 0.7) ctx.fillRect(x, y, 1, 1)
    }
  }

  // Flowers
  const flowerColors = ['#d4a843', '#c06040', '#e0a060', '#50c878']
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = flowerColors[Math.floor(rng() * flowerColors.length)]
    const fx = Math.floor(rng() * w)
    const fy = Math.floor(h * 0.54 + rng() * (h * 0.35))
    ctx.fillRect(fx, fy, 1, 1)
    ctx.fillStyle = '#2a4820'
    ctx.fillRect(fx, fy + 1, 1, 1)
  }
}

// ============================================
// Mycelial Foothold
// ============================================

function drawMycelial(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rng = mulberry32(seedFromStr('mycelial'))

  // Sky — deep purple
  fillBands(ctx, 0, h * 0.5, w, [
    '#08040c', '#100818', '#180c24', '#201030', '#28143c', '#301848',
  ])

  // Ground
  ctx.fillStyle = '#1a1008'
  ctx.fillRect(0, Math.floor(h * 0.5), w, h)

  // Ground texture — earthy
  ctx.fillStyle = '#120c06'
  for (let x = 0; x < w; x += 2) {
    for (let y = Math.floor(h * 0.55); y < h; y += 3) {
      if (rng() > 0.6) ctx.fillRect(x, y, 1, 1)
    }
  }

  // Root lines
  ctx.fillStyle = '#2a1830'
  for (let i = 0; i < 6; i++) {
    const rx = Math.floor(rng() * w)
    const ry = Math.floor(h * 0.55 + rng() * (h * 0.3))
    ctx.fillRect(rx, ry, 3 + Math.floor(rng() * 5), 1)
  }

  // Mushrooms
  drawMushroom(ctx, Math.floor(w * 0.08), Math.floor(h * 0.42), 14, 10, '#3a1848', '#5a2870', '#8050b0')
  drawMushroom(ctx, Math.floor(w * 0.65), Math.floor(h * 0.38), 10, 7, '#301440', '#4a2060', '#7040a0')
  drawMushroom(ctx, Math.floor(w * 0.88), Math.floor(h * 0.44), 7, 5, '#3a1848', '#5a2870', '#8050b0')
  // Small background shroom
  drawMushroom(ctx, Math.floor(w * 0.4), Math.floor(h * 0.46), 5, 3, '#201030', '#381850', '#5830a0')

  // Spore particles — floating glow dots
  for (let i = 0; i < 18; i++) {
    const bright = rng() > 0.6
    ctx.fillStyle = bright ? '#8050b0' : '#5030a0'
    ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h * 0.75), 1, 1)
  }
}

// ============================================
// Moonwell Castle
// ============================================

function drawMoonwell(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rng = mulberry32(seedFromStr('moonwell'))

  // Sky — dark blue
  fillBands(ctx, 0, h * 0.5, w, [
    '#040810', '#081018', '#0c1820', '#102028', '#142830', '#183038',
  ])

  // Stars
  ctx.fillStyle = '#405060'
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h * 0.4), 1, 1)
  }
  ctx.fillStyle = '#8090a0'
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h * 0.35), 1, 1)
  }

  // Moon
  const mx = Math.floor(w * 0.78)
  const my = Math.floor(h * 0.08)
  ctx.fillStyle = '#a0b0c0'
  ctx.fillRect(mx, my, 6, 6)
  ctx.fillRect(mx - 1, my + 1, 8, 4)
  ctx.fillRect(mx + 1, my - 1, 4, 1)
  ctx.fillStyle = '#c0d0e0'
  ctx.fillRect(mx + 1, my + 1, 4, 3)

  // Moonlight glow — subtle
  ctx.fillStyle = '#182838'
  ctx.fillRect(mx - 4, my + 7, 14, 2)

  // Stone pillar — left
  ctx.fillStyle = '#283848'
  ctx.fillRect(Math.floor(w * 0.08), Math.floor(h * 0.22), 5, Math.floor(h * 0.3))
  ctx.fillStyle = '#304858'
  ctx.fillRect(Math.floor(w * 0.07), Math.floor(h * 0.2), 7, 3)

  // Stone pillar — right
  ctx.fillStyle = '#283848'
  ctx.fillRect(Math.floor(w * 0.58), Math.floor(h * 0.28), 4, Math.floor(h * 0.24))
  ctx.fillStyle = '#304858'
  ctx.fillRect(Math.floor(w * 0.57), Math.floor(h * 0.26), 6, 3)

  // Broken arch/wall between pillars
  ctx.fillStyle = '#203040'
  ctx.fillRect(Math.floor(w * 0.3), Math.floor(h * 0.42), 14, 4)
  ctx.fillRect(Math.floor(w * 0.32), Math.floor(h * 0.38), 5, 4)
  ctx.fillRect(Math.floor(w * 0.42), Math.floor(h * 0.4), 3, 2)

  // Ground
  ctx.fillStyle = '#101820'
  ctx.fillRect(0, Math.floor(h * 0.5), w, h)

  // Stone ground texture
  ctx.fillStyle = '#182430'
  for (let x = 0; x < w; x += 3) {
    for (let y = Math.floor(h * 0.55); y < h; y += 4) {
      if (rng() > 0.5) ctx.fillRect(x, y, 2, 1)
    }
  }

  // Moonwell pool — center ground
  ctx.fillStyle = '#183040'
  ctx.fillRect(Math.floor(w * 0.38), Math.floor(h * 0.62), 12, 4)
  ctx.fillStyle = '#204050'
  ctx.fillRect(Math.floor(w * 0.39), Math.floor(h * 0.63), 10, 2)
  // Shimmer
  ctx.fillStyle = '#305868'
  ctx.fillRect(Math.floor(w * 0.41), Math.floor(h * 0.63), 3, 1)
}

// ============================================
// Twilight Thicket — "not so Scary place"
// Dark forest that's actually cozy, bioluminescent
// ============================================

function drawTwilight(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rng = mulberry32(seedFromStr('twilight'))

  // Sky — deep purple-teal
  fillBands(ctx, 0, h * 0.5, w, [
    '#0a0414', '#10081c', '#180c28', '#1c1030', '#201838', '#282040',
  ])

  // Twisted tree silhouettes
  ctx.fillStyle = '#0c0818'
  const t1 = Math.floor(w * 0.15)
  ctx.fillRect(t1, Math.floor(h * 0.2), 3, Math.floor(h * 0.32))
  ctx.fillRect(t1 - 4, Math.floor(h * 0.15), 10, 6)
  ctx.fillRect(t1 - 2, Math.floor(h * 0.12), 7, 3)
  ctx.fillRect(t1 + 3, Math.floor(h * 0.22), 4, 3)

  const t2 = Math.floor(w * 0.82)
  ctx.fillRect(t2, Math.floor(h * 0.18), 3, Math.floor(h * 0.34))
  ctx.fillRect(t2 - 5, Math.floor(h * 0.12), 12, 7)
  ctx.fillRect(t2 - 3, Math.floor(h * 0.09), 8, 3)

  // Canopy leaves
  ctx.fillStyle = '#1a1030'
  ctx.fillRect(t1 - 8, Math.floor(h * 0.08), 18, 8)
  ctx.fillRect(t2 - 7, Math.floor(h * 0.05), 16, 8)

  // Ground — dark earth
  ctx.fillStyle = '#121020'
  ctx.fillRect(0, Math.floor(h * 0.52), w, h)

  // Ground texture
  ctx.fillStyle = '#0e0c18'
  for (let x = 0; x < w; x += 3) {
    for (let y = Math.floor(h * 0.56); y < h; y += 4) {
      if (rng() > 0.6) ctx.fillRect(x, y, 1, 1)
    }
  }

  // Bioluminescent flowers — teal/pink dots
  const glowColors = ['#30b0a0', '#40c0b0', '#a050a0', '#80d0c0']
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = glowColors[Math.floor(rng() * glowColors.length)]
    ctx.fillRect(Math.floor(rng() * w), Math.floor(h * 0.54 + rng() * (h * 0.35)), 1, 1)
  }

  // Floating biolum spores — upper area
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = rng() > 0.5 ? '#40a090' : '#306080'
    ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h * 0.5), 1, 1)
  }
}

// ============================================
// The Threshold — "Don't"
// Edge of known territory, warning stones, fog
// ============================================

function drawThreshold(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rng = mulberry32(seedFromStr('threshold'))

  // Sky — grey/amber fog
  fillBands(ctx, 0, h * 0.55, w, [
    '#181410', '#201c14', '#30281c', '#403420', '#504028', '#604830',
  ])

  // Fog layer
  ctx.fillStyle = '#38302418'
  ctx.fillRect(0, Math.floor(h * 0.35), w, 8)
  ctx.fillStyle = '#48403018'
  ctx.fillRect(0, Math.floor(h * 0.42), w, 6)

  // Standing stones — warning pillars
  ctx.fillStyle = '#383028'
  ctx.fillRect(Math.floor(w * 0.2), Math.floor(h * 0.28), 4, Math.floor(h * 0.25))
  ctx.fillStyle = '#484038'
  ctx.fillRect(Math.floor(w * 0.19), Math.floor(h * 0.26), 6, 3)

  ctx.fillStyle = '#383028'
  ctx.fillRect(Math.floor(w * 0.7), Math.floor(h * 0.32), 3, Math.floor(h * 0.2))
  ctx.fillStyle = '#484038'
  ctx.fillRect(Math.floor(w * 0.69), Math.floor(h * 0.30), 5, 3)

  // Small broken stone
  ctx.fillStyle = '#302820'
  ctx.fillRect(Math.floor(w * 0.48), Math.floor(h * 0.42), 5, 4)
  ctx.fillRect(Math.floor(w * 0.49), Math.floor(h * 0.39), 3, 3)

  // Ground — cracked earth
  ctx.fillStyle = '#1a1810'
  ctx.fillRect(0, Math.floor(h * 0.52), w, h)

  // Cracks
  ctx.fillStyle = '#120e08'
  for (let i = 0; i < 8; i++) {
    const rx = Math.floor(rng() * w)
    const ry = Math.floor(h * 0.56 + rng() * (h * 0.35))
    ctx.fillRect(rx, ry, 2 + Math.floor(rng() * 6), 1)
  }

  // Sparse dead grass
  ctx.fillStyle = '#302818'
  for (let x = 0; x < w; x += 4) {
    if (rng() > 0.7) ctx.fillRect(x, Math.floor(h * 0.52), 1, 1 + Math.floor(rng() * 2))
  }

  // Amber warning glyphs on stones
  ctx.fillStyle = '#d4a843'
  ctx.fillRect(Math.floor(w * 0.21), Math.floor(h * 0.33), 1, 2)
  ctx.fillRect(Math.floor(w * 0.71), Math.floor(h * 0.36), 1, 2)
}

// ============================================
// Mana Springs — "Mana drunk"
// Saturated mana pools, psychedelic, crystals
// ============================================

function drawManaSpring(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rng = mulberry32(seedFromStr('manaspring'))

  // Sky — deep indigo
  fillBands(ctx, 0, h * 0.5, w, [
    '#060418', '#0c0824', '#140c30', '#1c103c', '#241448', '#2c1850',
  ])

  // Crystal formations — angular shapes
  ctx.fillStyle = '#4030a0'
  ctx.fillRect(Math.floor(w * 0.1), Math.floor(h * 0.34), 3, 10)
  ctx.fillRect(Math.floor(w * 0.11), Math.floor(h * 0.30), 2, 4)
  ctx.fillStyle = '#5040b0'
  ctx.fillRect(Math.floor(w * 0.12), Math.floor(h * 0.32), 1, 6)

  ctx.fillStyle = '#4030a0'
  ctx.fillRect(Math.floor(w * 0.85), Math.floor(h * 0.36), 3, 8)
  ctx.fillRect(Math.floor(w * 0.86), Math.floor(h * 0.33), 2, 3)

  // Ground — dark indigo
  ctx.fillStyle = '#100c20'
  ctx.fillRect(0, Math.floor(h * 0.5), w, h)

  // Ground texture — crystal shards
  ctx.fillStyle = '#180c30'
  for (let x = 0; x < w; x += 3) {
    for (let y = Math.floor(h * 0.55); y < h; y += 4) {
      if (rng() > 0.65) ctx.fillRect(x, y, 1, 1)
    }
  }

  // Mana pools — glowing blue/pink
  ctx.fillStyle = '#2040a0'
  ctx.fillRect(Math.floor(w * 0.3), Math.floor(h * 0.62), 14, 5)
  ctx.fillStyle = '#3050b0'
  ctx.fillRect(Math.floor(w * 0.31), Math.floor(h * 0.63), 12, 3)
  ctx.fillStyle = '#4060c0'
  ctx.fillRect(Math.floor(w * 0.33), Math.floor(h * 0.63), 4, 2)

  // Smaller pool
  ctx.fillStyle = '#3020a0'
  ctx.fillRect(Math.floor(w * 0.68), Math.floor(h * 0.70), 8, 3)
  ctx.fillStyle = '#4030b0'
  ctx.fillRect(Math.floor(w * 0.69), Math.floor(h * 0.71), 6, 1)

  // Mana particles — floating glow
  for (let i = 0; i < 20; i++) {
    const bright = rng() > 0.5
    ctx.fillStyle = bright ? '#6050d0' : rng() > 0.5 ? '#a050a0' : '#3040b0'
    ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h * 0.8), 1, 1)
  }
}

// ============================================
// Spirit Meadow — "Spirit tango"
// Open fields, wildflowers, spirit motes
// ============================================

function drawMeadow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rng = mulberry32(seedFromStr('meadow'))

  // Sky — warm sunset
  fillBands(ctx, 0, h * 0.48, w, [
    '#1a1018', '#2a1820', '#3a2028', '#5a3030', '#7a4830', '#9a6838',
  ])

  // Distant rolling hills
  ctx.fillStyle = '#2a4020'
  drawHill(ctx, w * 0.3, h * 0.48, w * 0.7, 12)
  ctx.fillStyle = '#223818'
  drawHill(ctx, w * 0.7, h * 0.5, w * 0.5, 8)

  // Ground — rich grass
  ctx.fillStyle = '#1c3818'
  ctx.fillRect(0, Math.floor(h * 0.5), w, h)

  // Grass variation
  ctx.fillStyle = '#2a4820'
  for (let x = 0; x < w; x += 2) {
    if (rng() > 0.4) {
      ctx.fillRect(x, Math.floor(h * 0.5), 1, 1 + Math.floor(rng() * 2))
    }
  }

  // Ground texture
  ctx.fillStyle = '#183010'
  for (let x = 0; x < w; x += 3) {
    for (let y = Math.floor(h * 0.58); y < h; y += 4) {
      if (rng() > 0.7) ctx.fillRect(x, y, 1, 1)
    }
  }

  // Wildflowers — abundant, colorful
  const flowerColors = ['#d4a843', '#c06040', '#e0a060', '#d080a0', '#80c0e0', '#50c878']
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = flowerColors[Math.floor(rng() * flowerColors.length)]
    const fx = Math.floor(rng() * w)
    const fy = Math.floor(h * 0.52 + rng() * (h * 0.38))
    ctx.fillRect(fx, fy, 1, 1)
  }

  // Spirit motes — floating white/gold dots
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = rng() > 0.5 ? '#d0c890' : '#ffffff'
    ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h * 0.55), 1, 1)
  }
}

// ============================================
// Component
// ============================================

const DRAW_FNS: Record<BgTheme, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  garden: drawGarden,
  mycelial: drawMycelial,
  moonwell: drawMoonwell,
  twilight: drawTwilight,
  threshold: drawThreshold,
  manaspring: drawManaSpring,
  meadow: drawMeadow,
}

/** Draw a battle background procedurally for a given zone */
export function drawBattleBg(ctx: CanvasRenderingContext2D, w: number, h: number, zoneId: string) {
  const theme = zoneToTheme(zoneId)
  DRAW_FNS[theme](ctx, w, h)
}

export { BG_W, BG_H, zoneToTheme }

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/** localStorage key for saved background overrides */
export function bgStorageKey(zoneId: string): string {
  return `shimmer-bg-${zoneToTheme(zoneId)}`
}

function renderPixelData(ctx: CanvasRenderingContext2D, palette: string[], pixels: string) {
  const imgData = ctx.createImageData(BG_W, BG_H)
  for (let i = 0; i < pixels.length && i < BG_W * BG_H; i++) {
    const [r, g, b] = hexToRgb(palette[parseInt(pixels[i], 36)] ?? '#000000')
    imgData.data[i * 4] = r
    imgData.data[i * 4 + 1] = g
    imgData.data[i * 4 + 2] = b
    imgData.data[i * 4 + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
}

export default function BattleBackground({ zoneId }: { zoneId: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = BG_W
    canvas.height = BG_H
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, BG_W, BG_H)

    // 1. Check localStorage for edited override (immediate, no flash)
    const saved = localStorage.getItem(bgStorageKey(zoneId))
    if (saved) {
      try {
        const { palette, pixels } = JSON.parse(saved) as { palette: string[], pixels: string }
        renderPixelData(ctx, palette, pixels)
        return
      } catch { /* fall through */ }
    }

    // 2. Draw procedural as immediate fallback
    drawBattleBg(ctx, BG_W, BG_H, zoneId)

    // 3. Try loading from disk file (will replace procedural if exists)
    let cancelled = false
    fetch(`/shimmer/save-battle-bg?zone=${encodeURIComponent(zoneId)}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.exists) {
          renderPixelData(ctx, data.palette, data.pixels)
          // Cache to localStorage for instant load next time
          localStorage.setItem(bgStorageKey(zoneId), JSON.stringify({ palette: data.palette, pixels: data.pixels }))
        }
      })
      .catch(() => {}) // disk unavailable, procedural is fine

    return () => { cancelled = true }
  }, [zoneId])

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'pixelated' as const }}
    />
  )
}
