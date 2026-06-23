// Token renderer — the no-pixel stand-in skin for Shimmer.
//
// Pixels are retired as the art direction (2026-06-18, Alex's call); the real
// look is a later 3D pass once hardware lands. Until then this renderer keeps
// the WHOLE game playable with zero art files, in the ather.games vector-glow
// house style: terrain = flat colour fields, every entity = a glowing token.
//
// It is a drop-in subclass of Renderer and overrides ONLY the visual
// primitives. The page.tsx render loop (getSprite -> drawSprite per entity) is
// untouched: each sprite is baked into a glowing-disc canvas, so the inherited
// drawSprite blits it with the same camera / flip / anchor maths. When 3D
// lands, swap the renderer; engine/ and all the design data carry over 1:1.

import { Renderer, TileDef, WIDTH, HEIGHT, TILE, CHUNK } from './renderer'

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  if (Number.isNaN(n) || h.length < 6) return [140, 140, 160]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Most frequent non-transparent palette colour in a pixel field — the body hue. */
function dominantColor(pixels: Uint8Array, palette: string[]): string {
  const counts = new Map<number, number>()
  for (let i = 0; i < pixels.length; i++) {
    const idx = pixels[i]
    if (idx === 0) continue
    counts.set(idx, (counts.get(idx) ?? 0) + 1)
  }
  let bestIdx = 0
  let bestN = 0
  for (const [idx, n] of counts) {
    if (n > bestN) { bestN = n; bestIdx = idx }
  }
  return palette[bestIdx - 1] ?? '#9aa0c8'
}

const SHADE = (r: number, g: number, b: number, f: number) =>
  `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`

export class TokenRenderer extends Renderer {
  // --- Terrain: flat colour fields instead of pixel tilesets ---

  override cacheTilemap(grid: number[][], tiles: TileDef[]) {
    // Store refs + clear chunk maps via base; chunks baked lazily via bakeBgChunk
    super.cacheTilemap(grid, tiles)
  }

  // Above-player canopy occlusion is a pixel-era nicety; skip it for the
  // stand-in (terrain is already fully drawn flat in the bg layer).
  override cacheOverlay(grid: number[][], tiles: TileDef[], above: boolean[]) {
    // Store above ref (clears fgChunks); bakeFgChunk will produce all-null chunks
    super.cacheOverlay(grid, tiles, above)
  }

  /** Override bg chunk baking: draw flat colour fields instead of pixel tilesets. */
  protected override bakeBgChunk(ccx: number, ccy: number): void {
    const CS = CHUNK * TILE
    const c = document.createElement('canvas')
    c.width = CS
    c.height = CS
    const ctx = c.getContext('2d')!

    const txStart = ccx * CHUNK
    const tyStart = ccy * CHUNK

    for (let dy = 0; dy < CHUNK; dy++) {
      const ty = tyStart + dy
      if (ty >= this._mapRows) break
      for (let dx = 0; dx < CHUNK; dx++) {
        const tx = txStart + dx
        if (tx >= this._mapCols) break
        const tileIdx = this._grid[ty][tx] & 0xFF
        const tile = this._tiles[tileIdx]
        const base = tile ? dominantColor(tile.pixels, tile.palette) : '#1b2030'
        ctx.fillStyle = base
        ctx.fillRect(dx * TILE, dy * TILE, TILE, TILE)
        // Faint grid seam so large same-colour zones still read as a world.
        ctx.fillStyle = 'rgba(0,0,0,0.10)'
        ctx.fillRect(dx * TILE, dy * TILE + TILE - 1, TILE, 1)
        ctx.fillRect(dx * TILE + TILE - 1, dy * TILE, 1, TILE)
      }
    }

    this.bgChunks.set(`${ccx},${ccy}`, c)
  }

  // No per-tile animation in token mode — keep the animTilePositions list empty
  // so the inherited drawAnimatedTiles is a cheap no-op.
  override buildAnimMap(_grid: number[][], _tiles: TileDef[]) {}

  // --- Entities: glowing token discs baked into the sprite canvas ---

  override getSprite(
    key: string, pixels: Uint8Array, palette: string[],
    w: number, h: number, _selout: boolean = true,
  ): HTMLCanvasElement {
    const cacheKey = `tok|${key}|${palette.join(',')}`
    const cached = this.spriteCache.get(cacheKey)
    if (cached) return cached

    const color = dominantColor(pixels, palette)
    const [r, g, b] = hexToRgb(color)

    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!

    const cx = w / 2
    const cy = h * 0.56            // sit the orb slightly low — feet near the cell floor
    const core = Math.max(3, Math.min(w, h) * 0.26)

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, core * 0.4, cx, cy, core * 2.1)
    glow.addColorStop(0, `rgba(${r},${g},${b},0.55)`)
    glow.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, core * 2.1, 0, Math.PI * 2)
    ctx.fill()

    // Core disc + thin darker rim for definition
    ctx.fillStyle = SHADE(r, g, b, 0.85)
    ctx.beginPath()
    ctx.arc(cx, cy, core, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = SHADE(r, g, b, 0.45)
    ctx.stroke()

    // Top-left highlight — reads as a lit, rounded body
    ctx.fillStyle = `rgba(255,255,255,0.55)`
    ctx.beginPath()
    ctx.arc(cx - core * 0.3, cy - core * 0.35, core * 0.28, 0, Math.PI * 2)
    ctx.fill()

    this.spriteCache.set(cacheKey, c)
    return c
  }
}

// re-export the shared constants so callers can import from one place if wanted
export { WIDTH, HEIGHT, TILE }
