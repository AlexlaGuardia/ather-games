// M58 (1) THE GROUND LAYER TABLE (2026-11-21, play / Jin play b7763e94). Alex 11-21: "overlapping ground shapes flicker",
// both sides. Every flat thing drawn ON the ground (paths, lanes, roads, junction pads, kerbs, rings, blob shadows) used to
// pick its own lift and its own polygonOffset (-2 here, -3 there, units or not), so where two overlapped, which one won was
// a per-pixel depth coin-flip that changed every frame the camera moved: the flicker.
//
// The fix, in one rule: overlays NEVER decide among themselves by depth. Each one depth-TESTS against the real ground (so a
// hill or a house still hides it) but does not WRITE depth, and draws in a fixed order (renderOrder, from this table): where
// two overlap, the higher layer simply paints over the lower one, the same way every frame. One offset for all of them
// keeps them off the ground itself.
//
// Why a table and not painting overlays into the terrain (a splat mask): three different terrains draw the ground here (the
// continent region mesh, the Ather wild tiles, the cluster/plot meadows), each with its own material; a splat needs a mask
// texture per zone at road resolution over a ~2 km region and a shader change in all three. The table fixes every overlap
// with no terrain change and no texture memory. A raised mesh (a kerb, a pad) that must stay raised joins the table too.
//
// ⚖ OPT-IN until Alex signs off the look (BETA M58: "Alex looks first"): `?ground=layers` turns it on; without it every
// overlay keeps its old offset (passed as `legacy`). Flip DEFAULT_ON once approved, then drop the legacy arguments.

/** Bottom to top. Nyx: a town lane under a road, a road under its junction pad, the kerb and island over the pad.
 *  Ather: a worn path under the green it leads to. Marks (rings, rims) and blob shadows over everything. */
export const GROUND_LAYER = {
  lane: 1, path: 1,
  road: 2, green: 2,
  junction: 3,
  kerb: 4,
  island: 5,
  mark: 6,
  shadow: 7,
} as const
export type GroundLayer = keyof typeof GROUND_LAYER

/** The one offset every overlay uses against the ground (the strongest of the old per-file guesses). */
export const GROUND_OFFSET = { factor: -4, units: -4 } as const

const DEFAULT_ON = false
export function groundLayersOn(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const q = new URLSearchParams(search).get('ground')
  return q === 'layers' ? true : q === 'legacy' ? false : DEFAULT_ON
}
const ON = groundLayersOn()

/** renderOrder for an overlay's mesh (0 = the old default draw order when the table is off). */
export const groundOrder = (layer: GroundLayer, on = ON): number => (on ? GROUND_LAYER[layer] : 0)

/** Material props for an overlay. `legacy` = the offset it had before the table (kept while the table is off). */
export function groundMat(layer: GroundLayer, legacy?: { factor: number; units: number }, on = ON) {
  void layer
  if (on) return { polygonOffset: true, polygonOffsetFactor: GROUND_OFFSET.factor, polygonOffsetUnits: GROUND_OFFSET.units, depthWrite: false }
  return legacy ? { polygonOffset: true, polygonOffsetFactor: legacy.factor, polygonOffsetUnits: legacy.units } : {}
}
