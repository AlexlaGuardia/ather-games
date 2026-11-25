// THE PASSAGE MARKET: the cavern marketplaces off the road bore (canon: world/rune-hold.md › The Passage in 1672,
// RULED 2026-11-14). "Tunnel network, widening into cavern marketplaces. Lantern-lit. Surprisingly warm." Walk-only:
// coursers stay on the road (the bore's walls still hold a car; only a walker is let through the side door).
//
// CANON (Magii's): that the market is here, on foot, off the bore; the four shelves (merchants' rune-gem tables on
// E'xday, teachers on Coomday, the scroll racks, the vessels); the arcade room (Marks are SPENT here); Lowen's caravan;
// old side-tunnels deeper in ("if you know, you know"); no permanent claims, so no stall carries a name.
// BUILD (Jin's): where the side door is, the layout, the room sizes, the stall count, the props, the light.
// ⚠ Door-opening order is canon too: the Passage trades "when the move economy ships". The rooms are walkable now;
// the counters say so plainly instead of selling anything.
//
// ★ PURE (no three, no react): the page renders it and the test walks it. The cave is CARVED FROM A 2D PLAN: a set of
// ellipses and capsules in a frame anchored on the bore, rasterised to a 0.75 m mask. The floor is flat (the bore's
// floor at the door), the ceiling domes up with distance from the nearest wall, the walls stand on the mask's edge,
// and the light is baked into the stone from the lanterns (the sun never reaches in here).

import { TUNNEL_H, TUNNEL_WALK, boreAt, type Region, type RegionTunnel } from './region'

export const CAVE_CELL = 0.75
export const CAVE_WALL_H = 4.2          // the walls stand a bore's springline tall, then the roof domes
export const CAVE_ROOF_MAX = 12
const DOME = 0.7                         // metres of rise per metre from the nearest wall

type Shape = { kind: 'ellipse'; u: number; v: number; ru: number; rv: number } | { kind: 'capsule'; u0: number; v0: number; u1: number; v1: number; r: number }

export interface CaveRoom { id: string; label: string; detail: string; u: number; v: number; r: number }
export interface CaveProp {
  kind: 'stall' | 'gems' | 'scrolls' | 'vessels' | 'mat' | 'cabinet' | 'wagon' | 'pen' | 'lantern' | 'grate' | 'bollard'
    | 'rack' | 'counter' | 'target' | 'backstop'
  x: number; z: number; yaw: number
  /** a rack's Slate (engine/weapons.ts), a target's index */
  tag?: string
}
/** THE GUN SHOP's working parts, in world space (gun-range.tsx reads these; the props above are only their look). */
export interface GunShop {
  racks: { slate: string; x: number; z: number; yaw: number }[]
  /** the firing line: you shoot from the shop side of it, down the lane */
  line: { x: number; z: number }
  /** unit vector down the lane */
  down: { x: number; z: number }
  laneLen: number
  targets: { id: number; x: number; z: number; yaw: number; range: number }[]
}
export interface Cavern {
  tunnel: RegionTunnel
  y: number                    // the floor
  side: 1 | -1                 // which wall of the bore the door is in (+ = tunnelAt's +off side)
  doorS: [number, number]      // along-bore span of the door
  // the mask
  x0: number; z0: number; nx: number; nz: number; mask: Uint8Array; roof: Float32Array
  rooms: { id: string; label: string; detail: string; x: number; z: number; r: number }[]
  props: CaveProp[]
  gunShop: GunShop
  lanterns: [number, number, number][]
  /** inside the carved floor (the bore itself is not part of the mask) */
  inside: (x: number, z: number) => boolean
  /** within 2 m of the carved floor: the walker's world is flat floor here, and caveContain is the wall. (A walker that
   *  saw the hill behind the wall as a face ran up it: the wall-catch launched it 2.7 m off the floor.) */
  nearFloor: (x: number, z: number) => boolean
  /** roof height over the floor at x, z (0 outside) */
  roofAt: (x: number, z: number) => number
  /** baked light at a point, 0..~1.3 */
  lightAt: (x: number, y: number, z: number) => number
}

// ── THE PLAN, in the door's frame: u = metres away from the bore's centre line (into the hill), v = along the bore ──
const DOOR_HALF = 2.2
// The lane runs out of the shop's back corner on a DIAGONAL, deeper into the hill. ⚠ Not straight down -v: the road
// bore curves back under the shop's frame there (it crossed a straight lane 14-29 m out, and the walker stood inside
// the tunnel lining in a black void). This is the one heading a search found that keeps clear of the bore, the old
// side-tunnel and the hall with rock to spare, in both regions (cavern.test asserts it stays that way).
const GUN_LANE_A: [number, number] = [28.2, -31.4], GUN_LANE_B: [number, number] = [49.5, -52.6], GUN_LANE_HALF = 3.2
const GUN_LINE_AT = 2.5          // the firing line, metres down the lane from its mouth
/** One rack per Slate, round the shop's walls (u, v, facing into the room). */
const GUN_RACKS: [string, number, number][] = [
  ['SIDEARM', 18, -24.5], ['SHORTBARREL', 17, -28.2], ['LONGBARREL', 18, -31.8], ['BREACHER', 30, -24.5], ['REACHER', 31, -28.2],
]
/** Targets down the lane: (u, metres past the line). */
/** Targets down the lane: (metres across the lane, + = right looking down it; metres past the line). */
const GUN_TARGETS: [number, number][] = [[0, 7], [-1.4, 12], [1.5, 18], [-0.6, 25]]
const MARKET: Shape[] = [
  // the side passage from the bore's wall, bending a little so the market is not seen from the road
  { kind: 'capsule', u0: 3, v0: 0, u1: 14, v1: 2, r: DOOR_HALF },
  { kind: 'capsule', u0: 14, v0: 2, u1: 20, v1: 0, r: 2.6 },
  // the market cavern
  { kind: 'ellipse', u: 36, v: 0, ru: 17, rv: 22 },
  // the teachers' alcove (Coomday), off the hall's +v end
  { kind: 'ellipse', u: 30, v: 25, ru: 8, rv: 7 },
  // Lowen's caravan bay
  { kind: 'ellipse', u: 52, v: 17, ru: 10, rv: 8 },
  // the arcade room, through a short doorway
  { kind: 'capsule', u0: 48, v0: -12, u1: 56, v1: -14, r: 2.2 },
  { kind: 'ellipse', u: 62, v: -15, ru: 9, rv: 8 },
  // an old side-tunnel, deeper in: unlit, and it ends at a grate
  { kind: 'capsule', u0: 40, v0: -20, u1: 44, v1: -38, r: 1.5 },
]
// ★ THE GUN SHOP's shapes are carved but NEVER vote on where the door goes: chooseDoor reads MARKET only. A shop shape
// that changed the door's ranking moved the whole market ~26 m down the bore and flipped its side (a lane is long, and
// a long shape drags the minimum-cover score). The test checks the shop's own cover instead.
const SHOP: Shape[] = [
  // ★ THE GUN SHOP (Alex 11-15): off the hall's -v side through a short doorway, racks round its walls, and the test
  // lane straight out the back. CANON: guns sell "from many shops" post-Liberation (manalic-weapons.md); the back-room
  // lane AMENDS rune-hold.md's "the range is at the Station" (Alex 11-15, flagged to Magii in CANON_GAPS).
  { kind: 'capsule', u0: 28, v0: -17, u1: 25, v1: -23, r: 2 },
  { kind: 'ellipse', u: 24, v: -28, ru: 7.5, rv: 6 },
  { kind: 'capsule', u0: GUN_LANE_A[0], v0: GUN_LANE_A[1], u1: GUN_LANE_B[0], v1: GUN_LANE_B[1], r: GUN_LANE_HALF },
]
const PLAN: Shape[] = [...MARKET, ...SHOP]
const ROOMS: CaveRoom[] = [
  { id: 'hall', label: 'The Passage', detail: 'The market under the spine · rotating spots, no permanent claims', u: 36, v: 0, r: 14 },
  { id: 'gems', label: 'The merchants', detail: "Rune-gem tables · E'xday · not trading yet", u: 36, v: -6, r: 4.5 },
  { id: 'scrolls', label: 'The scroll racks', detail: 'Knowledge Scrolls · not trading yet', u: 48, v: 2, r: 4 },
  { id: 'vessels', label: 'Focuses and bracelets', detail: 'Bracelets and gloves · E at the counter to browse', u: 26, v: -10, r: 4 },
  { id: 'teachers', label: 'The teachers', detail: 'A master gives the word in person · Coomday', u: 30, v: 25, r: 6 },
  { id: 'lowen', label: "Lowen's caravan", detail: 'A keeper of strays · the animal chooses · on its own cadence', u: 52, v: 17, r: 7 },
  { id: 'arcade', label: 'The arcade room', detail: 'Marks are spent here · not open yet', u: 62, v: -15, r: 7 },
  { id: 'deep', label: '···', detail: 'If you know, you know.', u: 44, v: -37, r: 3 },
  { id: 'guns', label: 'The gun shop', detail: 'One rack per class · E takes a gun off the rack · the lane is out back', u: 24, v: -28, r: 7 },
  { id: 'lane', label: 'The test lane', detail: 'Hold to fire · right-click aims · E reloads · E at a rack swaps', u: 40, v: -43.5, r: 14 },
]
// lanterns (u, v, height); the side-tunnel gets none on purpose
const LANTERNS: [number, number, number][] = [
  [6, -1.6, 3.2], [12, 3.6, 3.2], [19, -1.8, 3.2],
  [26, 0, 5.5], [36, -12, 6], [36, 12, 6], [46, 0, 6], [36, 0, 8.5], [27, -10, 4],
  [30, 25, 4.5], [52, 17, 5], [58, 13, 3.5], [62, -15, 4.5], [52, -13, 3.2],
  [24, -27, 4.5], [33, -36.2, 3.6], [40, -43.2, 3.6], [47, -50.2, 3.6],
]

const inShape = (s: Shape, u: number, v: number) => {
  if (s.kind === 'ellipse') return ((u - s.u) / s.ru) ** 2 + ((v - s.v) / s.rv) ** 2 <= 1
  const du = s.u1 - s.u0, dv = s.v1 - s.v0, L2 = du * du + dv * dv || 1
  const t = Math.max(0, Math.min(1, ((u - s.u0) * du + (v - s.v0) * dv) / L2))
  return Math.hypot(u - (s.u0 + du * t), v - (s.v0 + dv * t)) <= s.r
}

/** Where the door goes: the along-bore point and side with the MOST mountain over the whole plan (the cave must sit
 *  well inside the hill, roof and all). Null when no candidate keeps 14 m of rock over the highest roof. */
function chooseDoor(R: Region, t: RegionTunnel): { s: number; side: 1 | -1; minCover: number } | null {
  const len = t.pts.slice(1).reduce((a, p, k) => a + Math.hypot(p[0] - t.pts[k][0], p[1] - t.pts[k][1]), 0)
  let best: { s: number; side: 1 | -1; minCover: number } | null = null
  for (const f of [0.4, 0.5, 0.6, 0.35, 0.65]) for (const side of [1, -1] as const) {
    const s = len * f, b = boreAt(t, s)
    const pux = b.uz * side, puz = -b.ux * side
    let minCover = Infinity
    for (let u = 4; u <= 72; u += 4) for (let v = -40; v <= 32; v += 4) {
      if (!MARKET.some(sh => inShape(sh, u, v))) continue
      const x = b.x + pux * u + b.ux * v, z = b.z + puz * u + b.uz * v
      minCover = Math.min(minCover, R.heightAt(x, z) - b.y - CAVE_ROOF_MAX)
    }
    if (!best || minCover > best.minCover) best = { s, side, minCover }
  }
  return best && best.minCover >= 14 ? best : null
}

export function buildCavern(R: Region): Cavern | null {
  const t = R.meta.network?.tunnels?.[0]
  if (!t) return null
  const door = chooseDoor(R, t)
  if (!door) return null
  const b = boreAt(t, door.s), side = door.side
  const pux = b.uz * side, puz = -b.ux * side                    // u axis in the world
  const W = (u: number, v: number) => [b.x + pux * u + b.ux * v, b.z + puz * u + b.uz * v] as const
  const L = (x: number, z: number) => { const dx = x - b.x, dz = z - b.z; return [dx * pux + dz * puz, dx * b.ux + dz * b.uz] as const }
  // the mask's world box
  let xa = Infinity, xb = -Infinity, za = Infinity, zb = -Infinity
  for (let u = -2; u <= 76; u += 2) for (let v = -68; v <= 36; v += 2) {
    if (!PLAN.some(sh => inShape(sh, u, v))) continue
    const [x, z] = W(u, v); xa = Math.min(xa, x); xb = Math.max(xb, x); za = Math.min(za, z); zb = Math.max(zb, z)
  }
  const x0 = xa - 3, z0 = za - 3, nx = Math.ceil((xb - xa + 6) / CAVE_CELL), nz = Math.ceil((zb - za + 6) / CAVE_CELL)
  const mask = new Uint8Array(nx * nz)
  const hw = t.width / 2 + TUNNEL_WALK
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * CAVE_CELL, z = z0 + (j + 0.5) * CAVE_CELL
    const [u, v] = L(x, z)
    if (!PLAN.some(sh => inShape(sh, u, v))) continue
    // the bore is the bore's, except its walkway in front of the door: the plan overlaps it there, so a walker at the
    // bore's wall line (hw - 0.9) is already standing on the cave's floor (v1 started the cave at the lining and left a
    // 0.9 m strip that belonged to neither: the walker stopped at the door)
    const tb = R.tunnelAt(x, z)
    if (tb && Math.abs(tb.off) < hw - 1.6) continue
    if (u < hw - 1.6) continue
    mask[j * nx + i] = 1
  }
  // distance to the nearest wall (chamfer, in metres) → the dome
  const INF = 1e9, d = new Float32Array(nx * nz)
  for (let k = 0; k < d.length; k++) d[k] = mask[k] ? INF : 0
  const D1 = CAVE_CELL, D2 = CAVE_CELL * 1.4142
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (!mask[k]) continue
    if (i > 0) d[k] = Math.min(d[k], d[k - 1] + D1)
    if (j > 0) d[k] = Math.min(d[k], d[k - nx] + D1)
    if (i > 0 && j > 0) d[k] = Math.min(d[k], d[k - nx - 1] + D2)
    if (i < nx - 1 && j > 0) d[k] = Math.min(d[k], d[k - nx + 1] + D2)
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; if (!mask[k]) continue
    if (i < nx - 1) d[k] = Math.min(d[k], d[k + 1] + D1)
    if (j < nz - 1) d[k] = Math.min(d[k], d[k + nx] + D1)
    if (i < nx - 1 && j < nz - 1) d[k] = Math.min(d[k], d[k + nx + 1] + D2)
    if (i > 0 && j < nz - 1) d[k] = Math.min(d[k], d[k + nx - 1] + D2)
  }
  const roof = new Float32Array(nx * nz)
  for (let k = 0; k < d.length; k++) if (mask[k]) {
    const i = k % nx, j = (k / nx) | 0
    const jitter = (Math.sin(i * 1.7 + j * 0.9) + Math.sin(i * 0.37 - j * 1.3)) * 0.35
    roof[k] = Math.min(CAVE_ROOF_MAX, CAVE_WALL_H + d[k] * DOME + jitter)
  }
  const cellOf = (x: number, z: number) => {
    const i = Math.floor((x - x0) / CAVE_CELL), j = Math.floor((z - z0) / CAVE_CELL)
    return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i
  }
  const inside = (x: number, z: number) => { const k = cellOf(x, z); return k >= 0 && mask[k] === 1 }
  const near = new Uint8Array(nx * nz), GROW = 3
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (mask[j * nx + i])
    for (let dj = -GROW; dj <= GROW; dj++) for (let di = -GROW; di <= GROW; di++) {
      const ii = i + di, jj = j + dj
      if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) near[jj * nx + ii] = 1
    }
  const nearFloor = (x: number, z: number) => { const k = cellOf(x, z); return k >= 0 && near[k] === 1 }
  const roofAt = (x: number, z: number) => { const k = cellOf(x, z); return k >= 0 && mask[k] ? roof[k] : 0 }
  const y = b.y
  const lanterns = LANTERNS.map(([u, v, h]) => { const [x, z] = W(u, v); return [x, y + h, z] as [number, number, number] })
  const lightAt = (x: number, yy: number, z: number) => {
    // a lantern lights a pool, not the room: v1 (0.9 / (1 + q/40), cap 1.35) saturated the side passage to one flat tan
    let l = 0.1
    for (const [lx, ly, lz] of lanterns) { const q = (x - lx) ** 2 + ((yy - ly) * 1.3) ** 2 + (z - lz) ** 2; l += 0.55 / (1 + q / 22) }
    return Math.min(1.05, l)
  }
  // ── props, placed in the plan's frame ──
  const yawV = Math.atan2(-b.ux, -b.uz)                         // facing along +v
  const props: CaveProp[] = []
  const put = (kind: CaveProp['kind'], u: number, v: number, yaw = yawV) => { const [x, z] = W(u, v); props.push({ kind, x, z, yaw }) }
  // the merchants: a ring of gem tables round the hall's middle (rotating spots: the tables are the market's, not anyone's)
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; put('gems', 36 + Math.cos(a) * 7, Math.sin(a) * 9, yawV + a) }
  // stalls along the hall's walls
  for (const [u, v] of [[24, 8], [24, -6], [44, 14], [47, -8], [32, 16], [40, -16]] as const) put('stall', u, v)
  put('scrolls', 48, 2); put('scrolls', 49, 5); put('scrolls', 48.5, -1)
  put('vessels', 26, -10)
  put('mat', 30, 25); put('mat', 28, 27); put('mat', 32, 23)
  put('wagon', 54, 18); put('pen', 49, 20); put('pen', 50, 13)
  for (let k = 0; k < 6; k++) put('cabinet', 58 + (k % 3) * 3.2, -19 + Math.floor(k / 3) * 8, yawV + (k < 3 ? 0 : Math.PI))
  put('grate', 44.2, -38.5)
  // bollards at the door, on the bore's walkway line: a walker steps between them, a courser does not fit
  const bw = hw - 0.3
  for (const v of [-DOOR_HALF - 0.4, 0, DOOR_HALF + 0.4]) put('bollard', bw, v)
  for (const l of LANTERNS) put('lantern', l[0], l[1])
  // the gun shop: racks face the room's middle; the counter is the firing line; targets face back up the lane
  const [sx, sz] = W(24, -28)
  const racks = GUN_RACKS.map(([slate, u, v]) => {
    const [x, z] = W(u, v), yaw = Math.atan2(sx - x, sz - z)
    props.push({ kind: 'rack', x, z, yaw, tag: slate }); return { slate, x, z, yaw }
  })
  // the lane's axis in the plan, then in the world
  const lu = GUN_LANE_B[0] - GUN_LANE_A[0], lv = GUN_LANE_B[1] - GUN_LANE_A[1], ll = Math.hypot(lu, lv)
  const du = lu / ll, dv = lv / ll, ru = -dv, rv = du        // (ru, rv) = across the lane
  const P = (m: number, across = 0) => [GUN_LANE_A[0] + du * m + ru * across, GUN_LANE_A[1] + dv * m + rv * across] as const
  const [lx, lz] = W(...P(GUN_LINE_AT)), [ex, ez] = W(...P(ll))
  const laneLen = Math.hypot(ex - lx, ez - lz), down = { x: (ex - lx) / laneLen, z: (ez - lz) / laneLen }
  const yawUp = Math.atan2(-down.x, -down.z), yawDown = Math.atan2(down.x, down.z)
  put('counter', ...P(GUN_LINE_AT), yawDown)
  // ⚠ the across sign: in the world, "right looking down the lane" depends on the door's side (the plan is mirrored
  // when side = -1), so targets are placed across in the WORLD frame from `down`, not in the plan
  const rx = -down.z, rz = down.x
  const targets = GUN_TARGETS.map(([a, m], id) => {
    const x = lx + down.x * m + rx * a, z = lz + down.z * m + rz * a
    props.push({ kind: 'target', x, z, yaw: yawUp, tag: String(id) }); return { id, x, z, yaw: yawUp, range: m }
  })
  put('backstop', ...P(ll - 0.6), yawUp)
  const gunShop: GunShop = { racks, line: { x: lx, z: lz }, down, laneLen, targets }
  const rooms = ROOMS.map(r => { const [x, z] = W(r.u, r.v); return { id: r.id, label: r.label, detail: r.detail, x, z, r: r.r } })
  return { tunnel: t, y, side, doorS: [door.s - DOOR_HALF, door.s + DOOR_HALF], x0, z0, nx, nz, mask, roof, rooms, props, gunShop, lanterns, inside, nearFloor, roofAt, lightAt }
}

/** The room a walker is standing in (the smallest one whose circle holds them), for the HUD sign. */
export function caveRoomAt(c: Cavern, x: number, z: number) {
  let best: Cavern['rooms'][0] | null = null
  for (const r of c.rooms) if (Math.hypot(x - r.x, z - r.z) < r.r && (!best || r.r < best.r)) best = r
  return best
}

/** Keeps a walker inside bore ∪ cave: an invalid move slides along whichever axis is still valid, else is undone. */
export function caveContain(c: Cavern, R: Region, s: { px: number; pz: number; hvx: number; hvz: number }, ox: number, oz: number) {
  const hw = c.tunnel.width / 2 + TUNNEL_WALK - 0.9
  const ok = (x: number, z: number) => {
    const r = 0.3
    const pts: [number, number][] = [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r]]
    return pts.every(([px, pz]) => {
      if (c.inside(px, pz)) return true
      const t = R.tunnelAt(px, pz)
      return !!t && t.tunnel === c.tunnel && Math.abs(t.off) <= hw + 0.3 && t.cover > 2
    })
  }
  if (ok(s.px, s.pz)) return false
  if (ok(s.px, oz)) { s.pz = oz; s.hvz = 0; return true }
  if (ok(ox, s.pz)) { s.px = ox; s.hvx = 0; return true }
  s.px = ox; s.pz = oz; s.hvx = 0; s.hvz = 0
  return true
}

/** True when the walker is in or at the cave's door (so the bore's wall must let them through). */
export function nearCave(c: Cavern, x: number, z: number) {
  if (c.inside(x, z)) return true
  for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) if (c.inside(x + dx, z + dz)) return true
  return false
}
export { TUNNEL_H }
