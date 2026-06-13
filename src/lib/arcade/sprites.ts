// ARCADE TOOLKIT — a lazy <canvas> sprite cache. Hand a draw loop a path and it
// kicks off the image load on first sight, returning null (draw your fallback)
// until it's ready. A 404 just stays null forever — harmless. Pixel-art games
// want imageSmoothingEnabled = false on the context.

export type SpriteCache = Record<string, HTMLImageElement | null>

export function makeSpriteCache(): SpriteCache {
  return {}
}

export function resolveSprite(cache: SpriteCache, src?: string): HTMLImageElement | null {
  if (!src) return null
  if (src in cache) return cache[src]
  cache[src] = null
  const img = new Image()
  img.onload = () => (cache[src] = img)
  img.onerror = () => (cache[src] = null)
  img.src = src
  return null
}

// draw a sprite centered on a tile, or run the fallback until it loads
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  cache: SpriteCache,
  src: string | undefined,
  cx: number,
  cy: number,
  size: number,
  fallback?: () => void,
): void {
  const img = resolveSprite(cache, src)
  if (img) ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  else fallback?.()
}
