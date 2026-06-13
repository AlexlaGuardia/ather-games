// Aseprite PNG → palette-indexed pixel import pipeline
// Pure functions, no React dependencies

export interface ColorMapping {
  rgba: [number, number, number, number]
  paletteIndex: number   // 0=transparent, 1-N=palette
  distance: number       // 0=exact match
  hex: string            // display color
}

export interface PngImportResult {
  width: number
  height: number
  frameCount: number
  frames: number[][]       // each frame is gridSize*gridSize palette indices
  colorMap: ColorMapping[]
  unmappedCount: number    // colors with distance > 0
}

/** Load a PNG File into ImageData via offscreen canvas */
export function pngToImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(ctx.getImageData(0, 0, img.width, img.height))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

/** Extract unique non-transparent RGBA colors from ImageData */
export function extractColors(imageData: ImageData): [number, number, number, number][] {
  const seen = new Set<string>()
  const colors: [number, number, number, number][] = []
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue  // transparent
    const key = `${d[i]},${d[i + 1]},${d[i + 2]}`
    if (!seen.has(key)) {
      seen.add(key)
      colors.push([d[i], d[i + 1], d[i + 2], d[i + 3]])
    }
  }
  return colors
}

/** Euclidean RGB distance between two colors */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

/** Parse hex color to RGB tuple */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Find nearest palette color index for an RGB color. Index 0 = transparent (skipped). */
export function nearestPaletteColor(r: number, g: number, b: number, palette: readonly string[]): { index: number; distance: number } {
  let bestIdx = 1
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = hexToRgb(palette[i])
    const dist = colorDistance(r, g, b, pr, pg, pb)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i + 1  // palette index 1-based (0 = transparent)
    }
  }
  return { index: bestIdx, distance: bestDist }
}

/** Build color mapping: each unique source color → nearest palette index */
export function buildColorMap(uniqueColors: [number, number, number, number][], palette: readonly string[]): ColorMapping[] {
  return uniqueColors.map(([r, g, b, a]) => {
    const { index, distance } = nearestPaletteColor(r, g, b, palette)
    const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
    return { rgba: [r, g, b, a], paletteIndex: index, distance: Math.round(distance * 100) / 100, hex }
  })
}

/** Apply color map to ImageData → flat array of palette indices */
export function applyColorMap(imageData: ImageData, colorMap: ColorMapping[]): number[] {
  const lookup = new Map<string, number>()
  for (const cm of colorMap) {
    const key = `${cm.rgba[0]},${cm.rgba[1]},${cm.rgba[2]}`
    lookup.set(key, cm.paletteIndex)
  }
  const d = imageData.data
  const pixels: number[] = []
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) {
      pixels.push(0)  // transparent
    } else {
      const key = `${d[i]},${d[i + 1]},${d[i + 2]}`
      pixels.push(lookup.get(key) ?? 0)
    }
  }
  return pixels
}

/** Slice a horizontal spritesheet into individual frame arrays */
export function sliceFrames(pixels: number[], imgWidth: number, imgHeight: number, frameSize: number): number[][] {
  const frameCount = Math.floor(imgWidth / frameSize)
  const frames: number[][] = []
  for (let f = 0; f < frameCount; f++) {
    const frame: number[] = []
    for (let y = 0; y < frameSize; y++) {
      for (let x = 0; x < frameSize; x++) {
        frame.push(pixels[y * imgWidth + f * frameSize + x])
      }
    }
    frames.push(frame)
  }
  return frames
}

/** Full import pipeline: PNG file → palette-indexed frames */
export async function importPng(file: File, palette: readonly string[], gridSize: number): Promise<PngImportResult> {
  const imageData = await pngToImageData(file)
  const { width, height } = imageData

  // Validate dimensions
  if (height !== gridSize) {
    throw new Error(`Height must be ${gridSize}px, got ${height}px`)
  }
  if (width % gridSize !== 0) {
    throw new Error(`Width must be a multiple of ${gridSize}px, got ${width}px`)
  }

  const uniqueColors = extractColors(imageData)
  const colorMap = buildColorMap(uniqueColors, palette)
  const allPixels = applyColorMap(imageData, colorMap)
  const frames = sliceFrames(allPixels, width, height, gridSize)
  const unmappedCount = colorMap.filter(c => c.distance > 0).length

  return { width, height, frameCount: frames.length, frames, colorMap, unmappedCount }
}
