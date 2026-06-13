// Facing math shared across Nolmir's top-down modes. Sprites are authored
// up-facing; we rotate a single source to point it along a heading vector.
// (Crucible's Terrarium has done this inline — this is the shared home for it;
// Crucible adopts this in its own session.)

// canvas rotation for an up-facing sprite given a heading (fx, fy).
// negate fy because the canvas Y axis points down while up art points to -Y.
export function vecToAngle(fx: number, fy: number): number {
  if (fx === 0 && fy === 0) return 0 // no heading yet — face up
  return Math.atan2(fx, -fy)
}

// snap a radian angle to the nearest 45deg — 8 crisp facings. pixel art reads
// cleaner snapped to 8 than free-rotated to arbitrary angles.
const Q = Math.PI / 4
export function snap8(angle: number): number {
  return Math.round(angle / Q) * Q
}

// nearest of the 8 compass directions as a unit vector (for any future
// named-direction needs — movement/pathing can stay continuous).
export function dir8(dx: number, dy: number): { x: number; y: number } {
  if (dx === 0 && dy === 0) return { x: 0, y: 0 }
  const a = snap8(Math.atan2(dy, dx))
  const x = Math.round(Math.cos(a))
  const y = Math.round(Math.sin(a))
  return { x, y }
}
