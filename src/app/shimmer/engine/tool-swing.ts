// Tool swing animation system
// Drives rotation + position of tool sprite during harvesting channels
// Each skill type has a distinct motion arc

export type SwingProfile = 'chop' | 'strike' | 'poke'

const SKILL_SWING: Record<string, SwingProfile> = {
  forestry: 'chop',
  prospecting: 'strike',
  rinning: 'poke',
  farming: 'chop',
  alchemy: 'poke',
}

/** Get the swing profile for a skill */
export function getSwingProfile(skillId: string): SwingProfile {
  return SKILL_SWING[skillId] ?? 'chop'
}

/**
 * Get tool rotation angle (degrees) based on channel progress.
 * Progress: 0 = start, 1 = complete.
 * Returns angle in degrees (0 = pointing right, CCW positive).
 */
export function getToolAngle(profile: SwingProfile, progress: number, facingLeft: boolean): number {
  const t = Math.min(1, Math.max(0, progress))

  let angle: number
  switch (profile) {
    case 'chop': {
      // Overhead chop: raised high → swings down in an arc
      // Eased with sine for snappy feel (fast start, decelerate at impact)
      const eased = Math.sin(t * Math.PI * 0.5) // fast start, ease into end
      angle = 135 - eased * 120 // 135° (raised) → 15° (chopped down)
      break
    }
    case 'strike': {
      // Downward strike: raised → straight down stab
      const eased = t < 0.6
        ? (t / 0.6) * (t / 0.6) // wind up slow
        : 1 // snap down
      angle = 90 - eased * 90 // 90° (up) → 0° (forward)
      break
    }
    case 'poke': {
      // Forward thrust: pull back → jab forward
      // Small rotation, mostly positional
      const eased = t < 0.4
        ? 0 // hold back
        : Math.min(1, (t - 0.4) / 0.4) // thrust
      angle = 30 - eased * 30 // 30° (angled back) → 0° (straight)
      break
    }
  }

  return facingLeft ? -angle : angle
}

/**
 * Get tool position offset from player center during swing.
 * Returns pixel offsets (dx, dy) relative to player position.
 */
export function getToolOffset(profile: SwingProfile, progress: number, facingLeft: boolean): { dx: number; dy: number } {
  const t = Math.min(1, Math.max(0, progress))

  let dx: number
  let dy: number

  switch (profile) {
    case 'chop': {
      const eased = Math.sin(t * Math.PI * 0.5)
      // Arc from above-shoulder to impact point
      dx = 4 + eased * 8  // moves forward during swing
      dy = -14 + eased * 12 // starts high, comes down
      break
    }
    case 'strike': {
      const eased = t < 0.6 ? (t / 0.6) ** 2 : 1
      dx = 6 + eased * 4
      dy = -12 + eased * 14 // starts high, strikes down
      break
    }
    case 'poke': {
      const eased = t < 0.4 ? 0 : Math.min(1, (t - 0.4) / 0.4)
      dx = -2 + eased * 14 // pulls back then thrusts forward
      dy = -4 + eased * 2
      break
    }
  }

  return { dx: facingLeft ? -dx : dx, dy }
}

/**
 * Rotate pixel data by arbitrary angle (degrees).
 * Nearest-neighbor sampling, rotates around center of sprite.
 * Returns new Uint8Array with rotated pixels.
 */
export function rotatePixels(pixels: Uint8Array, size: number, angleDeg: number): Uint8Array {
  if (angleDeg === 0) return pixels

  const result = new Uint8Array(size * size)
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const rad = -angleDeg * Math.PI / 180 // negative because screen Y is inverted
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Map destination back to source
      const rx = x - cx
      const ry = y - cy
      const srcX = Math.round(cos * rx - sin * ry + cx)
      const srcY = Math.round(sin * rx + cos * ry + cy)

      if (srcX >= 0 && srcX < size && srcY >= 0 && srcY < size) {
        result[y * size + x] = pixels[srcY * size + srcX]
      }
    }
  }

  return result
}
