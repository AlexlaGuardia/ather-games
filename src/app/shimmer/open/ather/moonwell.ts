// THE MOONWELL water in the Wilds (BETA M22; the place). Canon (11-18 amend, rework §3): Moonwell Glade is the Wilds' FRONT
// DOOR, where the keeper arrives at Greg's waymark; the Glade is a glowing pool among grown structures (glossary › Moonwell Glade).
// ★ ONE CONSTANT: whoever moves the Glade moves MOONWELL and everything that reads it (the pond, the wait, the scale on the bank,
//   the journal beacon, Greg's tour) follows. World coords (first-wilds is tile 0,0).
// ★ M40 (Alex 11-19 picked LAYOUT B 'the green', docs/looks/moonwell-glade.html): the arrival waymark stays put (saves key on
//   it) at the SOUTH end of a round green; the five stand in a horseshoe round the green; the Moonwell is Greg's POND on the
//   green's west side, ~41 x 49 m (an ellipse: rx across x, rz across z). Mock scale 0.25 m a pixel. `r` = the short radius,
//   kept for callers that only need "about how big".
// ★ M67 s1b-2 (hub 11-22): the Glade LEFT the Wilds. The whole layout now stands in GREG'S GARDEN in the closed Glade (zone
//   'glade', glade-cluster.ts), in that zone's coords: GLADE_ANCHOR is where the Wilds waymark stood relative to the layout (the
//   open south end of the green), set in Greg's owned block (glade-cluster.ts GLADE_OWNED) with the pond on the island's west
//   edge and a clear walk south of it to the corner path. The Wilds keeps its own ground and Greg's waymark stone.

/** the layout's anchor in the Glade zone: the open south end of the green (once the Wilds waymark) */
export const GLADE_ANCHOR = { x: -75, z: 140 }
/** the green: the Glade's heart, 13 m round, its south edge on the path to the anchor */
export const GLADE_GREEN = { x: GLADE_ANCHOR.x, z: GLADE_ANCHOR.z - 30.75, r: 13 }
export const MOONWELL = { x: GLADE_GREEN.x - 47.5, z: GLADE_GREEN.z + 1.25, rx: 20.5, rz: 24.5, r: 20.5 }
/** the pond's radius toward (x, z): where the shore is along that bearing */
export function shoreRadius(x: number, z: number): number {
  const dx = x - MOONWELL.x, dz = z - MOONWELL.z, d = Math.hypot(dx, dz) || 1
  return 1 / Math.hypot(dx / d / MOONWELL.rx, dz / d / MOONWELL.rz)
}
/** metres from the shore: negative = in the water */
export const fromShore = (x: number, z: number) => Math.hypot(x - MOONWELL.x, z - MOONWELL.z) - shoreRadius(x, z)
/** how close to the shore counts as 'at the water' for the dusk wait (either side of it) */
export const AT_WATER = 2.6
export const atWater = (x: number, z: number) => fromShore(x, z) < AT_WATER
/** a point on the shore toward (x, z), `out` metres onto the bank */
export function shoreToward(x: number, z: number, out = 0): { x: number; z: number } {
  const dx = x - MOONWELL.x, dz = z - MOONWELL.z, d = Math.hypot(dx, dz) || 1, r = shoreRadius(x, z) + out
  return { x: MOONWELL.x + (dx / d) * r, z: MOONWELL.z + (dz / d) * r }
}
/** where the rinn leaves the scale: on the bank, on the green's side (where a keeper waits) */
export const SCALE_AT = shoreToward(GLADE_GREEN.x, GLADE_GREEN.z, 0.7)
export const SCALE_REACH = 1.6
