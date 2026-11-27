// ── LINGSTON = THE GRAND EXCHANGE, the trade hall (BETA M228 s1; canon world/gates.md › LINGSTON IS THE GRAND EXCHANGE,
// Magii fc33140, Alex 11-27). Pure: where the hall stands, its layout in its own frame, the attendants' counter spots and the
// "am I at the counter" test. The hall scene (lingston-hall.tsx), the page's E prompt and the tests all read THIS file.
//
// ★ STAND-IN SPOT. Where Lingston sits on the Wilds map is ALEX's call (World Builder, not placed yet). Until he places it the
// hall stands at LINGSTON_STANDIN: Greg's tile (first-wilds, tile 0,0), ~100 m from his waymark where a fresh keeper lands, on
// the flattest dry ground near it (scripted search, 11-27). TO MOVE IT: change LINGSTON_STANDIN's x / z / yaw below (world
// metres; yaw turns the whole square, the front faces local +z). Everything else (the paving, the hall, the clocktower, the
// kit houses, the counter, the clearing in network.ts, the minimap marker) is laid out relative to it.
// Pure: no React, no three, no localStorage.

/** ★ THE ONE ANCHOR. World metres (Wilds world = tile*1000 + local). yaw: the square's front (local +z) faces Greg's waymark. */
export const LINGSTON_STANDIN = { x: -223, z: 236, yaw: Math.atan2(-77, 64) } as const
export const LINGSTON = LINGSTON_STANDIN
/** the hall's name on the HUD / map (canon: the Grand Exchange is at Lingston) */
export const LINGSTON_NAME = 'Lingston'
export const EXCHANGE_NAME = 'The Grand Exchange'
/** the square's half size (paving), and the tree-clear radius network.ts › clearing() keeps round it */
export const SQUARE_HALF = 17, LINGSTON_CLEAR = 30
/** the hall in the square's frame: an open market hall (columns + roof, no walls) */
export const HALL = { x: 0, z: -5, w: 18, d: 10, h: 4.2 } as const
/** the counter runs along the hall's front, inside it; the attendants stand behind it */
export const COUNTER = { z: -1.6, half: 6.6, h: 1.05, d: 0.9 } as const
/** M228 s1: Jin's count = THREE Moglin attendants (one book, any of them takes an order). Nameless until named (canon). */
export const ATTENDANTS = 3
export const ATTENDANT_X: readonly number[] = [-4, 0, 4]
export const ATTENDANT_Z = -3.1
/** the stopped clocktower (a placeholder: a stone tower with a face whose hands do not move) */
export const CLOCKTOWER = { x: 12, z: -10, w: 3.4, h: 15 } as const
/** the kit houses (the settlement trade-house blueprints) on the square's edges, each turned to face the square's centre */
export const FRONTAGE: readonly { profession: 'carpenter' | 'stonemason' | 'jeweler'; x: number; z: number }[] = [
  { profession: 'carpenter', x: -16, z: 4 }, { profession: 'stonemason', x: 16, z: 4 }, { profession: 'jeweler', x: -11, z: -16 },
]
/** how near the counter a keeper must stand to speak to an attendant */
export const TALK_R = 3.4

/** the square's frame → world (three.js rotation-y by yaw, then the anchor) */
export function toWorld(lx: number, lz: number, a: { x: number; z: number; yaw: number } = LINGSTON) {
  const c = Math.cos(a.yaw), s = Math.sin(a.yaw)
  return { x: a.x + lx * c + lz * s, z: a.z - lx * s + lz * c }
}
/** world → the square's frame */
export function toLocal(wx: number, wz: number, a: { x: number; z: number; yaw: number } = LINGSTON) {
  const dx = wx - a.x, dz = wz - a.z, c = Math.cos(a.yaw), s = Math.sin(a.yaw)
  return { x: dx * c - dz * s, z: dx * s + dz * c }
}
/** the keeper is on Lingston's ground (the HUD names the place as you walk in) */
export const onLingston = (wx: number, wz: number) => Math.hypot(wx - LINGSTON.x, wz - LINGSTON.z) < SQUARE_HALF + 6
/** each attendant's world spot + the yaw that faces the keeper's side of the counter */
export function attendantSpots(): { i: number; x: number; z: number; yaw: number }[] {
  return ATTENDANT_X.map((lx, i) => ({ i, ...toWorld(lx, ATTENDANT_Z), yaw: LINGSTON.yaw }))
}
/** the attendant a keeper at (wx, wz) can speak to: in front of the counter (the keeper's side), within TALK_R. -1 = none */
export function attendantAt(wx: number, wz: number): number {
  const p = toLocal(wx, wz)
  if (p.z < COUNTER.z || p.z > COUNTER.z + TALK_R) return -1
  let best = -1, bd = Infinity
  ATTENDANT_X.forEach((lx, i) => { const d = Math.hypot(p.x - lx, p.z - ATTENDANT_Z); if (d < bd && d < TALK_R + 1.6) { bd = d; best = i } })
  return best
}
/** a kit house's pad in world (yaw per settlement-lots: forward = (-sin yaw, -cos yaw) points at the square's centre) */
export function frontageLots() {
  return FRONTAGE.map((f, k) => {
    const w = toWorld(f.x, f.z)
    return { id: `lingston-${k}`, settlement: 'lingston', profession: f.profession, folkId: '', x: w.x, z: w.z, yaw: Math.atan2(w.x - LINGSTON.x, w.z - LINGSTON.z), w: 13.5, d: 8.5 }
  })
}
