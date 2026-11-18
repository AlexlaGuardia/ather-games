// THE SIGHTS (Alex 11-18: "aiming down sight with a clean red-dot 1x scope on shottys and smgs, a 2x on long barrels and a 3x on
// the snipers as default"). PURE: no three, no react. Every gun carries ONE optic, defaulted by its Slate; a gun may name its own
// (RangeGun.optic, read through opticOf) so a later swap is a data change, not a rework. Customising is NOT built: when it comes it
// belongs at the Enchant Temple's twin counter beside the weapon rune work (Jin's recommendation to Alex, 11-18).
//
// ⚠ What a sight IS in the world (a set crystal? mana light?) is Magii's (dbr 11-18). This file is the mechanic only: zoom, the
// look slow-down that goes with it, and whether the view goes through a scope ring. The red dot is drawn plain until ruled.
//
// ★ Zoom is a FOCAL-LENGTH ratio, not a field-of-view ratio. A 2x makes things look twice as big, which is tan(fov/2) halved,
// NOT fov halved (at a 70° base, fov/2 = 35° but true 2x = 38.6°; the error grows with the base). adsFov does the trig.

export type OpticId = 'reddot' | 'scope2' | 'scope3'
export interface Optic {
  id: OpticId
  /** the magnification a player reads on it */
  mag: number
  /** the zoom actually applied in the sights. A 1x red dot still PUNCHES IN a touch: aiming with no zoom at all reads as broken */
  zoom: number
  /** true = full ADS looks through a scope ring (the model gives way); false = you look over the gun at a dot on its glass */
  scoped: boolean
  name: string
}
export const OPTICS: Record<OpticId, Optic> = {
  reddot: { id: 'reddot', mag: 1, zoom: 1.1, scoped: false, name: 'Red dot (1x)' },
  scope2: { id: 'scope2', mag: 2, zoom: 2, scoped: true, name: 'Scope (2x)' },
  scope3: { id: 'scope3', mag: 3, zoom: 3, scoped: true, name: 'Scope (3x)' },
}
/** Alex's defaults, by Slate: breachers (shotguns), shortbarrels (SMGs) and sidearms get the red dot; longbarrels a 2x; reachers
 *  (the snipers) a 3x. The sidearm is Jin's call (Alex named shotguns + SMGs). An unknown Slate falls back to the red dot. */
export const OPTIC_OF_SLATE: Record<string, OpticId> = { BREACHER: 'reddot', SHORTBARREL: 'reddot', SIDEARM: 'reddot', LONGBARREL: 'scope2', REACHER: 'scope3' }

export const opticOf = (g: { slot: string; optic?: OpticId }): Optic => OPTICS[g.optic ?? OPTIC_OF_SLATE[g.slot] ?? 'reddot']

const RAD = Math.PI / 180
/** The vertical field of view in the sights, from the keeper's own (degrees). t = 0..1 eases between the two in TANGENT space,
 *  so the glide feels even at every zoom. */
export function adsFov(baseFov: number, o: Optic, t = 1): number {
  const k = Math.max(0, Math.min(1, t)), z = 1 + (o.zoom - 1) * k
  return (2 * Math.atan(Math.tan((baseFov * RAD) / 2) / z)) / RAD
}
/** How much to slow the look in the sights so a zoomed view does not whip: the ratio of the two half-angle tangents (the
 *  "same feel at every zoom" rule, which is 1/zoom exactly). */
export const adsLookScale = (baseFov: number, o: Optic, t = 1) => Math.tan((adsFov(baseFov, o, t) * RAD) / 2) / Math.tan((baseFov * RAD) / 2)
/** The scope ring takes the screen only near full ADS; before that you see the gun come up. */
export const SCOPE_IN = 0.85
export const throughScope = (o: Optic, t: number) => o.scoped && t >= SCOPE_IN
