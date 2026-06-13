// Pixel art sprite encoding
// Sprites are strings of hex digits: 0=transparent, 1-f=palette index (up to 15 colors)
// Whitespace is stripped, making them visually editable in code

export interface SpriteAnim {
  frames: Uint8Array[]
  rate: number // default ticks per frame (at 15 TPS), used when durations not set
  durations?: number[] // per-frame hold times in ticks — overrides rate for individual frames
}

export function px(w: number, h: number, data: string): Uint8Array {
  const digits = data.replace(/[^0-9a-fA-F]/g, '')
  const arr = new Uint8Array(w * h)
  for (let i = 0; i < arr.length && i < digits.length; i++) {
    arr[i] = parseInt(digits[i], 16)
  }
  return arr
}
