// Shared pixel manipulation utilities for Shimmer editors

export type ViewMode = 'normal' | 'silhouette' | 'grayscale'
export type EditorTool = 'paint' | 'select' | 'fill' | 'eraser' | 'line'

/** Flood fill from (startX, startY) with brush value. Returns new pixel array. */
export function floodFill(pixels: number[], ss: number, startX: number, startY: number, fillValue: number, mirror: boolean = false): number[] {
  const result = [...pixels]
  const target = result[startY * ss + startX]
  if (target === fillValue) return result

  const stack: [number, number][] = [[startX, startY]]
  const visited = new Set<number>()

  while (stack.length > 0) {
    const [x, y] = stack.pop()!
    const idx = y * ss + x
    if (x < 0 || x >= ss || y < 0 || y >= ss) continue
    if (visited.has(idx)) continue
    if (result[idx] !== target) continue

    visited.add(idx)
    result[idx] = fillValue
    if (mirror) {
      result[y * ss + (ss - 1 - x)] = fillValue
    }

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  return result
}

export interface FloatingSelection {
  data: number[]
  w: number; h: number
  x: number; y: number
  srcX: number; srcY: number
}

/** Parse hex digit string to Uint8Array (same as px() in sprite-data.ts) */
export function parseDigits(data: string, totalPixels = 256): Uint8Array {
  const digits = data.replace(/[^0-9a-fA-F]/g, '')
  const arr = new Uint8Array(totalPixels)
  for (let i = 0; i < arr.length && i < digits.length; i++) {
    arr[i] = parseInt(digits[i], 16)
  }
  return arr
}

export function flipH(data: number[], w: number, h: number): number[] {
  const out = [...data]
  for (let y = 0; y < h; y++)
    for (let x = 0; x < Math.floor(w / 2); x++) {
      const a = y * w + x, b = y * w + (w - 1 - x)
      ;[out[a], out[b]] = [out[b], out[a]]
    }
  return out
}

export function flipV(data: number[], w: number, h: number): number[] {
  const out = [...data]
  for (let y = 0; y < Math.floor(h / 2); y++)
    for (let x = 0; x < w; x++) {
      const a = y * w + x, b = (h - 1 - y) * w + x
      ;[out[a], out[b]] = [out[b], out[a]]
    }
  return out
}

/** Convert pixel array back to hex digit string format (for save endpoint) */
export function pixelsToDigits(pixels: number[], size = 16): string {
  let out = ''
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out += pixels[y * size + x].toString(16)
    }
    out += '\n'
  }
  return out.trimEnd()
}

export function shiftAllPixels(data: number[], dx: number, dy: number, size = 16): number[] {
  const out = new Array(data.length).fill(0)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < size && ny >= 0 && ny < size)
        out[ny * size + nx] = data[y * size + x]
    }
  return out
}
