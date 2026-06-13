// Canon element rune-marks for the Mana'nana orbs. Filled silhouettes (legible at
// tile size) drawn in a single 24x24 grid. Six marks: the 4 canon elements
// (Mana/Storm/Earth/Water) plus Ather (the substance) and Love.
import type { ReactNode } from 'react'

export type RuneId = 'mana' | 'storm' | 'earth' | 'water' | 'ather' | 'love'

const PATHS: Record<RuneId, ReactNode> = {
  // four-point magic sparkle
  mana: <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />,
  // lightning bolt
  storm: <path d="M13 2 L4 13.5 L10.5 13.5 L9 22 L20 9 L13 9 Z" />,
  // mountain / stone
  earth: <path d="M12 4 L21.5 20 L2.5 20 Z" />,
  // teardrop
  water: <path d="M12 2.5 C12 2.5 5 11 5 15.5 A7 7 0 1 0 19 15.5 C19 11 12 2.5 12 2.5 Z" />,
  // eight-point radiant burst (the raw substance)
  ather: <path d="M12 2 L13.4 8 L19 5 L16 10.6 L22 12 L16 13.4 L19 19 L13.4 16 L12 22 L10.6 16 L5 19 L8 13.4 L2 12 L8 10.6 L5 5 L10.6 8 Z" />,
  // heart
  love: <path d="M12 21 C12 21 3 14.5 3 8.8 C3 5.6 5.4 3.4 8.2 3.4 C10 3.4 11.4 4.4 12 5.6 C12.6 4.4 14 3.4 15.8 3.4 C18.6 3.4 21 5.6 21 8.8 C21 14.5 12 21 12 21 Z" />,
}

export function RuneMark({ rune, color, size = 18 }: { rune: RuneId; color: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color}
      className="relative pointer-events-none"
      style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))' }}
      aria-hidden
    >
      {PATHS[rune]}
    </svg>
  )
}
