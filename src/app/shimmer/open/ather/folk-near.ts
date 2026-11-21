// WHEN 'E · talk to the folk' SHOWS (Alex playtest 11-21, hub #15623). It used to show for standing ANYWHERE inside a settlement's
// radius (settlementAt, 45 m), so the prompt sat on the screen across the whole of Moonwell Glade. Now it shows only within
// FOLK_REACH of a folk figure the keeper is roughly facing; a settlement with no figure home talks from its own anchor (the
// spot the talk camera falls back to, use-folk-talk.ts). Standing on top of one (FOLK_TOUCH) needs no facing. Pure.

export const FOLK_REACH = 3
export const FOLK_TOUCH = 1.2
/** Half-angle of "roughly facing", radians (60°). */
export const FOLK_FACE = Math.PI / 3

type XZ = { readonly x: number; readonly z: number }

/** Is the keeper at (px, pz), looking along `yaw` (the walker's: forward = (-sin yaw, -cos yaw)), close enough to `at` and facing it? */
export function facingWithin(at: XZ, px: number, pz: number, yaw: number, reach = FOLK_REACH): boolean {
  const dx = at.x - px, dz = at.z - pz, d = Math.hypot(dx, dz)
  if (d > reach) return false
  if (d < FOLK_TOUCH) return true
  const cos = (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / d
  return cos >= Math.cos(FOLK_FACE)
}

/** The talk prompt's rule: any drawn figure in reach and faced; with no figures, the settlement's anchor instead. */
export function folkInReach(figures: readonly XZ[] | undefined, anchor: XZ, px: number, pz: number, yaw: number): boolean {
  if (figures && figures.length) return figures.some(f => facingWithin(f, px, pz, yaw))
  return facingWithin(anchor, px, pz, yaw)
}
