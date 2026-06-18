// Pixel-perfect Canvas2D renderer
// Internal: 960x640 (30x20 tiles at 32px), CSS-scaled to viewport
// Manual blit upscale — no CSS scaling, eliminates pixel wobble
// Camera system for maps larger than viewport

export const WIDTH = 960
export const HEIGHT = 640
export const TILE = 32

// 3x5 pixel bitmap font — each glyph is 15 booleans (3 cols × 5 rows, row-major)
const PIXEL_FONT: Record<string, number[]> = {
  A: [0,1,0, 1,0,1, 1,1,1, 1,0,1, 1,0,1],
  B: [1,1,0, 1,0,1, 1,1,0, 1,0,1, 1,1,0],
  C: [0,1,1, 1,0,0, 1,0,0, 1,0,0, 0,1,1],
  D: [1,1,0, 1,0,1, 1,0,1, 1,0,1, 1,1,0],
  E: [1,1,1, 1,0,0, 1,1,0, 1,0,0, 1,1,1],
  F: [1,1,1, 1,0,0, 1,1,0, 1,0,0, 1,0,0],
  G: [0,1,1, 1,0,0, 1,0,1, 1,0,1, 0,1,1],
  H: [1,0,1, 1,0,1, 1,1,1, 1,0,1, 1,0,1],
  I: [1,1,1, 0,1,0, 0,1,0, 0,1,0, 1,1,1],
  J: [0,0,1, 0,0,1, 0,0,1, 1,0,1, 0,1,0],
  K: [1,0,1, 1,0,1, 1,1,0, 1,0,1, 1,0,1],
  L: [1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,1,1],
  M: [1,0,1, 1,1,1, 1,0,1, 1,0,1, 1,0,1],
  N: [1,0,1, 1,1,1, 1,1,1, 1,0,1, 1,0,1],
  O: [0,1,0, 1,0,1, 1,0,1, 1,0,1, 0,1,0],
  P: [1,1,0, 1,0,1, 1,1,0, 1,0,0, 1,0,0],
  Q: [0,1,0, 1,0,1, 1,0,1, 1,1,0, 0,1,1],
  R: [1,1,0, 1,0,1, 1,1,0, 1,0,1, 1,0,1],
  S: [0,1,1, 1,0,0, 0,1,0, 0,0,1, 1,1,0],
  T: [1,1,1, 0,1,0, 0,1,0, 0,1,0, 0,1,0],
  U: [1,0,1, 1,0,1, 1,0,1, 1,0,1, 0,1,0],
  V: [1,0,1, 1,0,1, 1,0,1, 0,1,0, 0,1,0],
  W: [1,0,1, 1,0,1, 1,0,1, 1,1,1, 1,0,1],
  X: [1,0,1, 1,0,1, 0,1,0, 1,0,1, 1,0,1],
  Y: [1,0,1, 1,0,1, 0,1,0, 0,1,0, 0,1,0],
  Z: [1,1,1, 0,0,1, 0,1,0, 1,0,0, 1,1,1],
  '0': [0,1,0, 1,0,1, 1,0,1, 1,0,1, 0,1,0],
  '1': [0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1],
  '2': [1,1,0, 0,0,1, 0,1,0, 1,0,0, 1,1,1],
  '3': [1,1,0, 0,0,1, 0,1,0, 0,0,1, 1,1,0],
  '4': [1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1],
  '5': [1,1,1, 1,0,0, 1,1,0, 0,0,1, 1,1,0],
  '6': [0,1,1, 1,0,0, 1,1,0, 1,0,1, 0,1,0],
  '7': [1,1,1, 0,0,1, 0,1,0, 0,1,0, 0,1,0],
  '8': [0,1,0, 1,0,1, 0,1,0, 1,0,1, 0,1,0],
  '9': [0,1,0, 1,0,1, 0,1,1, 0,0,1, 1,1,0],
  ' ': [0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0],
  '.': [0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,1,0],
  '!': [0,1,0, 0,1,0, 0,1,0, 0,0,0, 0,1,0],
  '?': [0,1,0, 1,0,1, 0,0,1, 0,1,0, 0,1,0],
  '-': [0,0,0, 0,0,0, 1,1,1, 0,0,0, 0,0,0],
  '_': [0,0,0, 0,0,0, 0,0,0, 0,0,0, 1,1,1],
}

export interface TileDef {
  pixels: Uint8Array // TILE*TILE palette indices (1-9, 0=transparent)
  palette: string[]  // 1-9 colors, indexed by digit value
  frames?: Uint8Array[]  // all frames incl frame 0 (undefined = static tile)
  animRate?: number      // ticks per frame at 15 TPS (default: 12)
}

export class Renderer {
  private ctx: CanvasRenderingContext2D        // offscreen game canvas (320x208)
  private displayCtx: CanvasRenderingContext2D // visible display canvas (scaled)
  private offscreen: HTMLCanvasElement
  protected bgCache: HTMLCanvasElement | null = null
  protected fgCache: HTMLCanvasElement | null = null
  protected spriteCache = new Map<string, HTMLCanvasElement>()
  private animTilePositions: { tx: number; ty: number; tileIdx: number; rot: number }[] = []

  // Camera offset (pixels) — set before each frame
  camX = 0
  camY = 0

  constructor(canvas: HTMLCanvasElement) {
    // Display canvas — sized to match CSS content area (excludes border)
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
    const displayCtx = canvas.getContext('2d')!
    displayCtx.imageSmoothingEnabled = false
    this.displayCtx = displayCtx

    // Offscreen canvas — game renders here at native resolution
    const offscreen = document.createElement('canvas')
    offscreen.width = WIDTH
    offscreen.height = HEIGHT
    const ctx = offscreen.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    this.offscreen = offscreen
  }

  /** Blit offscreen game canvas to the display canvas — call after all draw calls */
  present() {
    this.displayCtx.drawImage(
      this.offscreen,
      0, 0, WIDTH, HEIGHT,
      0, 0, this.displayCtx.canvas.width, this.displayCtx.canvas.height,
    )
  }

  /** Resize display canvas to match CSS layout (call on window resize) */
  resize(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
    this.displayCtx.imageSmoothingEnabled = false
  }

  // --- Camera ---

  /** Smoothly ease camera toward a pixel position, clamped to map edges */
  centerOn(px: number, py: number, mapCols: number, mapRows: number) {
    const maxCamX = Math.max(0, mapCols * TILE - WIDTH)
    const maxCamY = Math.max(0, mapRows * TILE - HEIGHT)

    // Target position (where camera wants to be)
    const targetX = Math.max(0, Math.min(maxCamX, px + TILE / 2 - WIDTH / 2))
    const targetY = Math.max(0, Math.min(maxCamY, py + TILE / 2 - HEIGHT / 2))

    // Lerp toward target — float precision, floor at draw time only
    // Min speed prevents integer-lock stutter at edge transitions
    // (without it, floor(cam) stays stuck for 4-5 frames before jumping)
    const ease = 0.15
    const MIN_SPEED = 0.4

    const dx = targetX - this.camX
    if (Math.abs(dx) < 0.5) {
      this.camX = targetX
    } else {
      const step = Math.min(Math.abs(dx), Math.max(Math.abs(dx) * ease, MIN_SPEED))
      this.camX += step * Math.sign(dx)
    }

    const dy = targetY - this.camY
    if (Math.abs(dy) < 0.5) {
      this.camY = targetY
    } else {
      const step = Math.min(Math.abs(dy), Math.max(Math.abs(dy) * ease, MIN_SPEED))
      this.camY += step * Math.sign(dy)
    }
  }

  // --- Tilemap ---

  cacheTilemap(grid: number[][], tiles: TileDef[]) {
    const cols = grid[0]?.length ?? 0
    const rows = grid.length
    const c = document.createElement('canvas')
    c.width = cols * TILE
    c.height = rows * TILE
    const ctx = c.getContext('2d')!

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < grid[ty].length; tx++) {
        const val = grid[ty][tx]
        const tileIdx = val & 0xFF
        const rot = (val >> 8) & 3
        const tile = tiles[tileIdx]
        const pixels = rot > 0 ? Renderer.rotateTilePixels(tile.pixels, rot) : tile.pixels
        this.drawPixelsTo(ctx, pixels, tile.palette, tx * TILE, ty * TILE, TILE, TILE)
      }
    }

    this.bgCache = c
  }

  static rotateTilePixels(pixels: Uint8Array, rot: number): Uint8Array {
    if (rot === 0) return pixels
    const result = new Uint8Array(TILE * TILE)
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const src = pixels[y * TILE + x]
        let nx: number, ny: number
        if (rot === 1) { nx = TILE - 1 - y; ny = x }
        else if (rot === 2) { nx = TILE - 1 - x; ny = TILE - 1 - y }
        else { nx = y; ny = TILE - 1 - x }
        result[ny * TILE + nx] = src
      }
    }
    return result
  }

  /** Cache the foreground/overlay layer (above-player tiles only) */
  cacheOverlay(grid: number[][], tiles: TileDef[], above: boolean[]) {
    const cols = grid[0]?.length ?? 0
    const rows = grid.length
    // Check if any tiles are marked above
    let hasAbove = false
    for (let ty = 0; ty < rows && !hasAbove; ty++) {
      for (let tx = 0; tx < grid[ty].length && !hasAbove; tx++) {
        if (above[grid[ty][tx] & 0xFF]) hasAbove = true
      }
    }
    if (!hasAbove) { this.fgCache = null; return }

    const c = document.createElement('canvas')
    c.width = cols * TILE
    c.height = rows * TILE
    const ctx = c.getContext('2d')!

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < grid[ty].length; tx++) {
        const val = grid[ty][tx]
        const tileIdx = val & 0xFF
        if (!above[tileIdx]) continue
        const rot = (val >> 8) & 3
        const tile = tiles[tileIdx]
        const pixels = rot > 0 ? Renderer.rotateTilePixels(tile.pixels, rot) : tile.pixels
        this.drawPixelsTo(ctx, pixels, tile.palette, tx * TILE, ty * TILE, TILE, TILE)
      }
    }

    this.fgCache = c
  }

  drawBackground() {
    // Clear offscreen canvas to prevent previous frame bleed-through at transparent pixels
    this.ctx.clearRect(0, 0, WIDTH, HEIGHT)
    if (this.bgCache) {
      // Draw the visible portion of the tilemap based on camera (floor for pixel-crisp tiles)
      const cx = Math.floor(this.camX)
      const cy = Math.floor(this.camY)
      this.ctx.drawImage(
        this.bgCache,
        cx, cy, WIDTH, HEIGHT,
        0, 0, WIDTH, HEIGHT,
      )
    }
  }

  /** Draw the foreground/overlay layer (renders on top of entities) */
  drawOverlay() {
    if (this.fgCache) {
      const cx = Math.floor(this.camX)
      const cy = Math.floor(this.camY)
      this.ctx.drawImage(
        this.fgCache,
        cx, cy, WIDTH, HEIGHT,
        0, 0, WIDTH, HEIGHT,
      )
    }
  }

  // --- Sprites ---

  /** Get or create a cached canvas for a sprite frame + palette combo */
  getSprite(key: string, pixels: Uint8Array, palette: string[], w: number, h: number, selout: boolean = true): HTMLCanvasElement {
    // Palette is part of the cache identity — without it, the first palette to
    // render a key sticks forever (stale colors after palette edits/look swaps)
    const cacheKey = `${key}|${palette.join(',')}`
    let cached = this.spriteCache.get(cacheKey)
    if (cached) return cached

    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    this.drawPixelsTo(ctx, pixels, palette, 0, 0, w, h, selout)

    this.spriteCache.set(cacheKey, c)
    return c
  }

  /** Draw a sprite at world coordinates (camera-adjusted) */
  drawSprite(
    sprite: HTMLCanvasElement, x: number, y: number,
    flipX: boolean = false, dw?: number, dh?: number,
  ) {
    const w = dw ?? sprite.width
    const h = dh ?? sprite.height
    // Floor camera first so sprites align with the bgCache pixel grid
    const cx = Math.floor(this.camX)
    const cy = Math.floor(this.camY)
    const sx = Math.floor(x - cx - (w - sprite.width) / 2)
    const sy = Math.floor(y - cy - (h - sprite.height))

    // Skip if entirely off-screen
    if (sx + w < 0 || sx > WIDTH || sy + h < 0 || sy > HEIGHT) return

    if (flipX) {
      this.ctx.save()
      this.ctx.translate(sx + w, sy)
      this.ctx.scale(-1, 1)
      this.ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, 0, 0, w, h)
      this.ctx.restore()
    } else {
      this.ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, sx, sy, w, h)
    }
  }

  /** Set global alpha for subsequent draw calls */
  setAlpha(alpha: number) { this.ctx.globalAlpha = alpha }
  /** Reset alpha to 1 */
  resetAlpha() { this.ctx.globalAlpha = 1 }

  // --- Particles (drawn directly, no caching) ---

  /** Draw a pixel at world coordinates (camera-adjusted) */
  drawPixel(x: number, y: number, color: string, alpha: number = 1) {
    const sx = Math.floor(x - Math.floor(this.camX))
    const sy = Math.floor(y - Math.floor(this.camY))
    if (sx < 0 || sx >= WIDTH || sy < 0 || sy >= HEIGHT) return

    this.ctx.globalAlpha = alpha
    this.ctx.fillStyle = color
    this.ctx.fillRect(sx, sy, 1, 1)
    this.ctx.globalAlpha = 1
  }

  /** Draw a pixel-art label at world coordinates using 3x5 bitmap font */
  drawLabel(text: string, x: number, y: number, color: string = '#ffffff') {
    const sx = Math.floor(x - Math.floor(this.camX))
    const sy = Math.floor(y - Math.floor(this.camY))
    const charW = 4  // 3px char + 1px gap
    const textW = text.length * charW - 1
    const pad = 1
    // Background pill
    this.ctx.globalAlpha = 0.45
    this.ctx.fillStyle = '#000000'
    this.ctx.fillRect(sx - pad, sy - pad, textW + pad * 2, 5 + pad * 2)
    this.ctx.globalAlpha = 1
    // Render each character as 3x5 pixel bitmap
    this.ctx.fillStyle = color
    for (let i = 0; i < text.length; i++) {
      const glyph = PIXEL_FONT[text[i].toUpperCase()] ?? PIXEL_FONT['?']
      if (!glyph) continue
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row * 3 + col]) {
            this.ctx.fillRect(sx + i * charW + col, sy + row, 1, 1)
          }
        }
      }
    }
  }

  /** Draw a full-screen ambient color overlay (for day/night cycle) */
  drawAmbient(color: string, alpha: number) {
    if (alpha <= 0) return
    this.ctx.globalAlpha = alpha
    this.ctx.fillStyle = color
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT)
    this.ctx.globalAlpha = 1
  }

  // --- Animated Tiles ---

  /** Scan grid for animated tiles — call once at zone load */
  buildAnimMap(grid: number[][], tiles: TileDef[]) {
    this.animTilePositions = []
    for (let ty = 0; ty < grid.length; ty++) {
      for (let tx = 0; tx < grid[ty].length; tx++) {
        const val = grid[ty][tx]
        const tileIdx = val & 0xFF
        const rot = (val >> 8) & 3
        const tile = tiles[tileIdx]
        if (tile?.frames && tile.frames.length > 1) {
          this.animTilePositions.push({ tx, ty, tileIdx, rot })
        }
      }
    }
  }

  /** Overdraw animated tiles at current frame. Call twice per render:
   *  aboveOnly=false before entities, aboveOnly=true after overlay */
  drawAnimatedTiles(tiles: TileDef[], above: boolean[], globalTick: number, aboveOnly: boolean) {
    if (this.animTilePositions.length === 0) return
    const cx = Math.floor(this.camX)
    const cy = Math.floor(this.camY)

    for (const pos of this.animTilePositions) {
      // Filter by layer
      const isAbove = above[pos.tileIdx] ?? false
      if (aboveOnly !== isAbove) continue

      // Viewport culling
      const px = pos.tx * TILE - cx
      const py = pos.ty * TILE - cy
      if (px + TILE < 0 || px > WIDTH || py + TILE < 0 || py > HEIGHT) continue

      const tile = tiles[pos.tileIdx]
      if (!tile?.frames || tile.frames.length <= 1) continue

      const rate = tile.animRate ?? 12
      const offset = (pos.tx * 7 + pos.ty * 13) % 60
      const frameIdx = Math.floor((globalTick + offset) / rate) % tile.frames.length

      // Frame 0 is already in the static cache — skip overdraw
      if (frameIdx === 0) continue

      const framePixels = tile.frames[frameIdx]
      const pixels = pos.rot > 0 ? Renderer.rotateTilePixels(framePixels, pos.rot) : framePixels
      const key = `atile-${pos.tileIdx}-f${frameIdx}-r${pos.rot}`
      const sprite = this.getSprite(key, pixels, tile.palette, TILE, TILE, false)
      this.ctx.drawImage(sprite, px, py)
    }
  }

  // --- Utils ---

  private drawPixelsTo(
    ctx: CanvasRenderingContext2D,
    pixels: Uint8Array,
    palette: string[],
    ox: number, oy: number,
    w: number, h: number,
    selout: boolean = false,
  ) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let idx = pixels[y * w + x]
        if (idx === 0) continue // transparent

        // Selective outlining: soften dark (3) pixels on light-facing edges
        // Light from top-left: top edges and left edges get body color
        if (selout && idx === 3) {
          const above = y > 0 ? pixels[(y - 1) * w + x] : 0
          const left = x > 0 ? pixels[y * w + (x - 1)] : 0
          if (above === 0 || left === 0) {
            idx = 1
          }
        }

        const color = palette[idx - 1]
        if (!color) continue // out-of-range digit — skip rather than inherit the previous fillStyle
        ctx.fillStyle = color
        ctx.fillRect(ox + x, oy + y, 1, 1)
      }
    }
  }
}
