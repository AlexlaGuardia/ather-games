// Pixel-perfect Canvas2D renderer
// Internal: 960x640 (30x20 tiles at 32px), CSS-scaled to viewport
// Manual blit upscale — no CSS scaling, eliminates pixel wobble
// Camera system for maps larger than viewport

export const WIDTH = 960
export const HEIGHT = 640
export const TILE = 32

/** Chunk size in tiles. Each chunk canvas is CHUNK*TILE × CHUNK*TILE px. Tunable. */
export const CHUNK = 16

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

/** Visible chunk range (chunk coords, inclusive). Pure function — unit-testable. */
export function visibleChunkRange(
  camX: number,
  camY: number,
  mapCols: number,
  mapRows: number,
  chunkPx: number = CHUNK * TILE,
  viewportW: number = WIDTH,
  viewportH: number = HEIGHT,
): { minCCX: number; maxCCX: number; minCCY: number; maxCCY: number } {
  const cx = Math.floor(camX)
  const cy = Math.floor(camY)

  // Pixel range of the visible window in world space
  const worldLeft  = cx
  const worldRight = cx + viewportW - 1
  const worldTop   = cy
  const worldBot   = cy + viewportH - 1

  // Chunk coords that overlap the visible window (expand by 1-chunk margin ring)
  const mapChunkCols = Math.ceil(mapCols * TILE / chunkPx)
  const mapChunkRows = Math.ceil(mapRows * TILE / chunkPx)

  const minCCX = Math.max(0, Math.floor(worldLeft  / chunkPx) - 1)
  const maxCCX = Math.min(mapChunkCols - 1, Math.floor(worldRight / chunkPx) + 1)
  const minCCY = Math.max(0, Math.floor(worldTop   / chunkPx) - 1)
  const maxCCY = Math.min(mapChunkRows - 1, Math.floor(worldBot   / chunkPx) + 1)

  return { minCCX, maxCCX, minCCY, maxCCY }
}

export class Renderer {
  private ctx: CanvasRenderingContext2D        // offscreen game canvas (320x208)
  private displayCtx: CanvasRenderingContext2D // visible display canvas (scaled)
  private offscreen: HTMLCanvasElement
  // Chunk maps replace the old single-canvas bgCache / fgCache
  protected bgChunks = new Map<string, HTMLCanvasElement>()
  // null in fgChunks = chunk baked but contains no above-tiles (never redraw)
  protected fgChunks = new Map<string, HTMLCanvasElement | null>()
  // Stored grid/tiles/above refs for on-demand chunk baking
  protected _grid: number[][] = []
  protected _tiles: TileDef[] = []
  protected _above: boolean[] = []
  protected _mapCols = 0
  protected _mapRows = 0
  protected spriteCache = new Map<string, HTMLCanvasElement>()
  private animTilePositions: { tx: number; ty: number; tileIdx: number; rot: number }[] = []

  // Camera offset (pixels) — set before each frame
  camX = 0
  camY = 0

  /** Camera zoom factor. >1 = zoom in (fewer tiles visible, bigger), <1 = zoom out (more tiles visible).
   *  Supported levels: 0.75 (out) / 1.0 (normal) / 1.5 (in). Set each frame before drawBackground(). */
  zoom = 1

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

  /** Blit offscreen game canvas to the display canvas — call after all draw calls.
   * Bilinear-smooth the final upscale: the 960x640 buffer rarely maps to a whole-number
   * multiple of the device's pixels, and nearest-neighbor at a fractional scale makes the
   * scene crawl/shimmer while scrolling. Smoothing the final blit only (the offscreen ctx
   * stays nearest) trades a touch of softness for stable motion. (Chosen 2026-06-23.) */
  present() {
    const dctx = this.displayCtx
    dctx.imageSmoothingEnabled = true
    dctx.imageSmoothingQuality = 'high'
    dctx.drawImage(
      this.offscreen,
      0, 0, WIDTH, HEIGHT,
      0, 0, dctx.canvas.width, dctx.canvas.height,
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

  /** Smoothly ease camera toward a pixel position, clamped to map edges.
   *  At zoom != 1 the visible world window is (WIDTH/zoom) × (HEIGHT/zoom), so
   *  clamp bounds and target center are adjusted accordingly. */
  centerOn(px: number, py: number, mapCols: number, mapRows: number) {
    const visW = WIDTH / this.zoom
    const visH = HEIGHT / this.zoom
    const maxCamX = Math.max(0, mapCols * TILE - visW)
    const maxCamY = Math.max(0, mapRows * TILE - visH)

    // Target position (where camera wants to be)
    const targetX = Math.max(0, Math.min(maxCamX, px + TILE / 2 - visW / 2))
    const targetY = Math.max(0, Math.min(maxCamY, py + TILE / 2 - visH / 2))

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
    // Store refs for on-demand chunk baking; clear existing chunks
    this._grid = grid
    this._tiles = tiles
    this._mapCols = grid[0]?.length ?? 0
    this._mapRows = grid.length
    this.bgChunks.clear()
    this.fgChunks.clear()
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

  /** Store the above[] array; chunk fg baking is deferred to ensureChunks. */
  cacheOverlay(grid: number[][], tiles: TileDef[], above: boolean[]) {
    // above[] is stored on _above — the fg chunks are baked lazily alongside bg chunks
    this._above = above
    // Invalidate any already-baked fg chunks (covers the case where cacheOverlay is
    // called after cacheTilemap on the same zone load — fgChunks was already cleared
    // by cacheTilemap, so this is a no-op in normal flow; kept as a safety net)
    this.fgChunks.clear()
  }

  /** Bake one bg chunk (ccx, ccy) into bgChunks. */
  protected bakeBgChunk(ccx: number, ccy: number): void {
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
        const val = this._grid[ty][tx]
        const tileIdx = val & 0xFF
        const rot = (val >> 8) & 3
        const tile = this._tiles[tileIdx]
        if (!tile) continue
        const pixels = rot > 0 ? Renderer.rotateTilePixels(tile.pixels, rot) : tile.pixels
        this.drawPixelsTo(ctx, pixels, tile.palette, dx * TILE, dy * TILE, TILE, TILE)
      }
    }

    this.bgChunks.set(`${ccx},${ccy}`, c)
  }

  /** Bake one fg chunk (ccx, ccy) into fgChunks (null if no above-tiles). */
  protected bakeFgChunk(ccx: number, ccy: number): void {
    const CS = CHUNK * TILE
    const txStart = ccx * CHUNK
    const tyStart = ccy * CHUNK

    let c: HTMLCanvasElement | null = null
    let ctx: CanvasRenderingContext2D | null = null

    for (let dy = 0; dy < CHUNK; dy++) {
      const ty = tyStart + dy
      if (ty >= this._mapRows) break
      for (let dx = 0; dx < CHUNK; dx++) {
        const tx = txStart + dx
        if (tx >= this._mapCols) break
        const val = this._grid[ty][tx]
        const tileIdx = val & 0xFF
        if (!this._above[tileIdx]) continue
        const rot = (val >> 8) & 3
        const tile = this._tiles[tileIdx]
        if (!tile) continue
        // Lazy-create canvas on first above-tile found in chunk
        if (!c) {
          c = document.createElement('canvas')
          c.width = CS
          c.height = CS
          ctx = c.getContext('2d')!
        }
        const pixels = rot > 0 ? Renderer.rotateTilePixels(tile.pixels, rot) : tile.pixels
        this.drawPixelsTo(ctx!, pixels, tile.palette, dx * TILE, dy * TILE, TILE, TILE)
      }
    }

    this.fgChunks.set(`${ccx},${ccy}`, c) // null if no above-tiles found
  }

  /** Ensure all chunks in the visible+margin range are baked; evict outside chunks.
   *  At zoom < 1 the visible world window is larger (WIDTH/zoom), so more chunks are needed. */
  private ensureChunks(camX: number, camY: number): void {
    const { minCCX, maxCCX, minCCY, maxCCY } = visibleChunkRange(
      camX, camY, this._mapCols, this._mapRows,
      CHUNK * TILE, WIDTH / this.zoom, HEIGHT / this.zoom,
    )

    // Build a set of keys we want to keep
    const keep = new Set<string>()
    for (let cy = minCCY; cy <= maxCCY; cy++) {
      for (let cx = minCCX; cx <= maxCCX; cx++) {
        const key = `${cx},${cy}`
        keep.add(key)
        if (!this.bgChunks.has(key)) this.bakeBgChunk(cx, cy)
        if (!this.fgChunks.has(key)) this.bakeFgChunk(cx, cy)
      }
    }

    // Evict chunks outside the visible+margin ring
    for (const key of this.bgChunks.keys()) {
      if (!keep.has(key)) this.bgChunks.delete(key)
    }
    for (const key of this.fgChunks.keys()) {
      if (!keep.has(key)) this.fgChunks.delete(key)
    }
  }

  drawBackground() {
    // Clear offscreen canvas to prevent previous frame bleed-through at transparent pixels
    this.ctx.clearRect(0, 0, WIDTH, HEIGHT)

    if (this._mapCols === 0) return

    const CS = CHUNK * TILE
    const z = this.zoom
    const cx = Math.floor(this.camX)
    const cy = Math.floor(this.camY)

    this.ensureChunks(this.camX, this.camY)

    const destCS = CS * z
    for (const [key, chunk] of this.bgChunks) {
      const [ccxStr, ccyStr] = key.split(',')
      const ccx = parseInt(ccxStr, 10)
      const ccy = parseInt(ccyStr, 10)
      // World offset from camera × zoom → screen position
      const dx = (ccx * CS - cx) * z
      const dy = (ccy * CS - cy) * z
      // Skip if entirely outside the viewport
      if (dx + destCS < 0 || dx > WIDTH || dy + destCS < 0 || dy > HEIGHT) continue
      this.ctx.drawImage(chunk, 0, 0, CS, CS, dx, dy, destCS, destCS)
    }
  }

  /** Draw the foreground/overlay layer (renders on top of entities) */
  drawOverlay() {
    if (this._mapCols === 0) return

    const CS = CHUNK * TILE
    const z = this.zoom
    const cx = Math.floor(this.camX)
    const cy = Math.floor(this.camY)
    const destCS = CS * z

    for (const [key, chunk] of this.fgChunks) {
      if (!chunk) continue // null = no above-tiles in this chunk
      const [ccxStr, ccyStr] = key.split(',')
      const ccx = parseInt(ccxStr, 10)
      const ccy = parseInt(ccyStr, 10)
      const dx = (ccx * CS - cx) * z
      const dy = (ccy * CS - cy) * z
      if (dx + destCS < 0 || dx > WIDTH || dy + destCS < 0 || dy > HEIGHT) continue
      this.ctx.drawImage(chunk, 0, 0, CS, CS, dx, dy, destCS, destCS)
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

  /** Draw a sprite at world coordinates (camera-adjusted, zoom-scaled) */
  drawSprite(
    sprite: HTMLCanvasElement, x: number, y: number,
    flipX: boolean = false, dw?: number, dh?: number,
  ) {
    const w = dw ?? sprite.width
    const h = dh ?? sprite.height
    const z = this.zoom
    // Floor camera first so sprites align with the bgCache pixel grid
    const cx = Math.floor(this.camX)
    const cy = Math.floor(this.camY)
    // World offset from camera, centered, scaled by zoom
    const sx = Math.floor((x - cx - (w - sprite.width) / 2) * z)
    const sy = Math.floor((y - cy - (h - sprite.height)) * z)
    const dw2 = Math.ceil(w * z)
    const dh2 = Math.ceil(h * z)

    // Skip if entirely off-screen
    if (sx + dw2 < 0 || sx > WIDTH || sy + dh2 < 0 || sy > HEIGHT) return

    if (flipX) {
      this.ctx.save()
      this.ctx.translate(sx + dw2, sy)
      this.ctx.scale(-1, 1)
      this.ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, 0, 0, dw2, dh2)
      this.ctx.restore()
    } else {
      this.ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, sx, sy, dw2, dh2)
    }
  }

  /** Set global alpha for subsequent draw calls */
  setAlpha(alpha: number) { this.ctx.globalAlpha = alpha }
  /** Reset alpha to 1 */
  resetAlpha() { this.ctx.globalAlpha = 1 }

  // --- Particles (drawn directly, no caching) ---

  /** Draw a pixel at world coordinates (camera-adjusted, zoom-scaled) */
  drawPixel(x: number, y: number, color: string, alpha: number = 1) {
    const z = this.zoom
    const sx = Math.floor((x - Math.floor(this.camX)) * z)
    const sy = Math.floor((y - Math.floor(this.camY)) * z)
    const ps = Math.ceil(z) // pixel size — ceil avoids sub-pixel gaps at non-integer zoom
    if (sx + ps < 0 || sx >= WIDTH || sy + ps < 0 || sy >= HEIGHT) return

    this.ctx.globalAlpha = alpha
    this.ctx.fillStyle = color
    this.ctx.fillRect(sx, sy, ps, ps)
    this.ctx.globalAlpha = 1
  }

  /** Draw a pixel-art label at world coordinates using 3x5 bitmap font (zoom-scaled) */
  drawLabel(text: string, x: number, y: number, color: string = '#ffffff') {
    const z = this.zoom
    const sx = Math.floor((x - Math.floor(this.camX)) * z)
    const sy = Math.floor((y - Math.floor(this.camY)) * z)
    const ps = Math.ceil(z)
    const charW = 4 * ps  // 3px char + 1px gap, scaled
    const textW = text.length * charW - ps
    const pad = ps
    // Background pill
    this.ctx.globalAlpha = 0.45
    this.ctx.fillStyle = '#000000'
    this.ctx.fillRect(sx - pad, sy - pad, textW + pad * 2, 5 * ps + pad * 2)
    this.ctx.globalAlpha = 1
    // Render each character as 3x5 pixel bitmap
    this.ctx.fillStyle = color
    for (let i = 0; i < text.length; i++) {
      const glyph = PIXEL_FONT[text[i].toUpperCase()] ?? PIXEL_FONT['?']
      if (!glyph) continue
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row * 3 + col]) {
            this.ctx.fillRect(sx + i * charW + col * ps, sy + row * ps, ps, ps)
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
    const z = this.zoom
    const cx = Math.floor(this.camX)
    const cy = Math.floor(this.camY)
    const destSize = TILE * z

    for (const pos of this.animTilePositions) {
      // Filter by layer
      const isAbove = above[pos.tileIdx] ?? false
      if (aboveOnly !== isAbove) continue

      // Viewport culling (zoom-aware)
      const px = (pos.tx * TILE - cx) * z
      const py = (pos.ty * TILE - cy) * z
      if (px + destSize < 0 || px > WIDTH || py + destSize < 0 || py > HEIGHT) continue

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
      this.ctx.drawImage(sprite, 0, 0, TILE, TILE, px, py, destSize, destSize)
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
