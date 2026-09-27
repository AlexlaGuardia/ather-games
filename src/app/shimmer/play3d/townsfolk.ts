// ★ PURE. Rune Hold's people: who stands where today, and where the unnamed walk.
//
// Canon (`world/rune-hold.md` › ★ THE TOWNSFOLK and ★ THE REGULARS' WEEK, ruled 2026-09-27):
//   · the square and streets hold ORDINARY ALKIN, never named: locals, a smith's apprentice, travelers bound for the
//     Station. *"A town, never a crowd"*, busiest on the way to the Station, quietest by the Spirit Corner.
//   · the fronts are kept by ROLES (the innkeeper, the smith, the Bookstore's keeper, the Notice Board's tender, the
//     Station clerk). *A name is earned by a relationship.*
//   · the regulars have homes and a week; the law is *the table is never empty*. Mabry never leaves it.
//   · the look: coded by TRADE, never by colour (`design-briefs/keepers.md` › Townsfolk).
// Jin's: where they stand and walk, how many, routes, idles. Every word they say goes to @lark.

import { WEEK, type Weekday } from './passage'
import { FRONTS, HOMES, NOTICE_BOARD, hash, type Regular } from './rune-hold-look'

/** Where the week puts a regular. `table` = inside the Mug, which does not open: not drawn. */
export type Whereabouts = 'table' | 'square' | 'passage' | 'home' | 'forge' | 'station' | 'board'

/** Canon's table, verbatim in shape: `world/rune-hold.md` › ★ THE REGULARS' WEEK. */
export const REGULARS_WEEK: Record<Weekday, Record<Regular, Whereabouts>> = {
  Solday:  { renna: 'square',  dorik: 'home',  brenn: 'station', mabry: 'table' },
  Coomday: { renna: 'table',   dorik: 'forge', brenn: 'table',   mabry: 'table' },
  "E'xday": { renna: 'passage', dorik: 'forge', brenn: 'board',   mabry: 'table' },
  Niteday: { renna: 'table',   dorik: 'forge', brenn: 'station', mabry: 'table' },
  Floday:  { renna: 'table',   dorik: 'table', brenn: 'table',   mabry: 'table' },
}
export const REGULAR_NAME: Record<Regular, string> = { renna: 'Renna', dorik: 'Dorik', brenn: 'Brenn', mabry: 'Mabry' }

/** What codes a figure: its trade (the brief), never a colour of its own. */
export type Trade = 'local' | 'traveler' | 'apprentice' | 'innkeeper' | 'smith' | 'bookkeeper' | 'crier' | 'clerk' | 'watcher' | 'talker'

export interface Figure {
  id: string
  /** the nametag: a regular's canon name, or null (roles and passers-by are never named) */
  name: string | null
  trade: Trade
  zone: 'rune-hold' | 'travelers-station' | 'the-passage'
  x: number; z: number
  /** which way they face, radians about Y (0 = +z) */
  yaw: number
}

const front = (id: string) => FRONTS.find(f => f.id === id)!
/** a spot `out` cells in front of a front's street line, `side` cells along it */
function before(id: string, out: number, side = 0): { x: number; z: number; yaw: number } {
  const f = front(id), d = (f.depth ?? 0) + out
  const [fx, fz] = f.face
  // facing OUT, onto the street: a keeper at a door watches who comes up it
  return { x: f.x + fx * d + fz * side, z: f.z + fz * d - fx * side, yaw: Math.atan2(fx, fz) }
}

/** The fronts' keepers: roles, standing at their doors. The Station clerk stands in the Station's terminal. */
export function keepers(): Figure[] {
  const inn = before('forgelight-inn', 1.2, 1.6), smith = before('smithy', 1.4, -1.4), books = before('bookstore', 1.2, 1.6)
  return [
    { id: 'innkeeper', name: null, trade: 'innkeeper', zone: 'rune-hold', ...inn },
    { id: 'smith', name: null, trade: 'smith', zone: 'rune-hold', ...smith },
    { id: 'bookkeeper', name: null, trade: 'bookkeeper', zone: 'rune-hold', ...books },
    { id: 'crier', name: null, trade: 'crier', zone: 'rune-hold', x: NOTICE_BOARD.x + 1.4, z: NOTICE_BOARD.z + 1.6, yaw: Math.PI * 0.75 },
    { id: 'clerk', name: null, trade: 'clerk', zone: 'travelers-station', x: 4, z: 27, yaw: Math.PI / 2 },   // by the departures board, facing the hall
  ]
}

/** The regulars who are out today, where the week puts them. Those at the table are not drawn (the Mug does not open). */
export function regularsOn(day: Weekday): Figure[] {
  const out: Figure[] = []
  for (const who of Object.keys(REGULARS_WEEK[day]) as Regular[]) {
    const w = REGULARS_WEEK[day][who]
    const home = HOMES.find(h => h.who === who)!
    const at: Record<Exclude<Whereabouts, 'table'>, { zone: Figure['zone']; x: number; z: number; yaw: number }> = {
      square:  { zone: 'rune-hold', x: 53, z: 55, yaw: -Math.PI * 0.7 },
      passage: { zone: 'the-passage', x: 30, z: 18, yaw: Math.PI / 2 },
      home:    { zone: 'rune-hold', x: home.x + 1.2, z: home.z + 1.1, yaw: Math.PI },
      forge:   { zone: 'rune-hold', ...before('smithy', 1.1, 1.3) },
      station: { zone: 'rune-hold', x: 51.5, z: 82.5, yaw: 0 },
      board:   { zone: 'rune-hold', x: NOTICE_BOARD.x + 1.8, z: NOTICE_BOARD.z - 0.9, yaw: -Math.PI / 2 },
    }
    if (w === 'table') continue
    const trade: Trade = who === 'dorik' ? 'smith' : who === 'brenn' ? 'watcher' : 'talker'
    out.push({ id: `regular:${who}`, name: REGULAR_NAME[who], trade, ...at[w] })
  }
  return out
}

/** Is this regular home today? (their lamp is lit and their door stands open) */
export const isHome = (who: Regular, day: Weekday) => REGULARS_WEEK[day][who] === 'home'

// ── THE UNNAMED, WALKING ──────────────────────────────────────────────────────────────────────────────────────
// Each walker paces a route between two places on the town's streets, pausing at each end. Routes are grid paths
// (never through a building), found once. The weights make the south road the busy one and keep the Spirit
// Corner quiet — canon's feel, as a number.

export interface Walker { id: string; trade: Trade; path: { x: number; z: number }[]; speed: number; pause: number; phase: number }

/** Named spots walkers go between. */
function spots(): Record<string, { x: number; z: number }> {
  const p = (id: string, out: number) => { const b = before(id, out); return { x: Math.round(b.x), z: Math.round(b.z) } }
  return {
    square: { x: 52, z: 56 }, squareW: { x: 42, z: 52 }, squareE: { x: 58, z: 46 },
    station: p('station', 3), passage: p('passage', 3), inn: p('forgelight-inn', 3), mug: p('kindled-mug', 3),
    smithy: p('smithy', 3), books: p('bookstore', 3), corner: p('spirit-corner', 3),
    lane: { x: 49, z: 18 }, southRoad: { x: 50, z: 76 },
  }
}

/** The route list: [from, to, trade]. Travelers ride the south road; the Spirit Corner gets one passer, no more. */
const ROUTES: [string, string, Trade][] = [
  ['square', 'station', 'traveler'], ['lane', 'station', 'traveler'], ['passage', 'station', 'traveler'],
  ['southRoad', 'station', 'traveler'], ['squareE', 'station', 'traveler'],
  ['square', 'mug', 'local'], ['squareW', 'inn', 'local'], ['books', 'squareE', 'local'], ['square', 'passage', 'local'],
  ['lane', 'square', 'local'], ['squareW', 'corner', 'local'],
  ['smithy', 'square', 'apprentice'],
]

/** Breadth-first path on open cells (4-neighbour). Returns cell centres from a to b, or [] if none. */
export function gridPath(g: number[][], a: { x: number; z: number }, b: { x: number; z: number }): { x: number; z: number }[] {
  const R = g.length, C = g[0].length, key = (x: number, z: number) => z * C + x
  const open = (x: number, z: number) => x >= 0 && z >= 0 && x < C && z < R && g[z][x] >= 0 && (g[z][x] & 0xff) !== 103 && (g[z][x] & 0xff) !== 14
  if (!open(a.x, a.z) || !open(b.x, b.z)) return []
  const prev = new Map<number, number>(), q = [key(a.x, a.z)]
  prev.set(q[0], -1)
  for (let i = 0; i < q.length; i++) {
    const k = q[i], x = k % C, z = Math.floor(k / C)
    if (x === b.x && z === b.z) break
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, nk = key(nx, nz)
      if (!open(nx, nz) || prev.has(nk)) continue
      prev.set(nk, k); q.push(nk)
    }
  }
  if (!prev.has(key(b.x, b.z))) return []
  const out: { x: number; z: number }[] = []
  for (let k = key(b.x, b.z); k !== -1; k = prev.get(k)!) out.push({ x: k % C, z: Math.floor(k / C) })
  return out.reverse()
}

export function walkers(g: number[][]): Walker[] {
  const S = spots()
  return ROUTES.map(([a, b, trade], i) => ({
    id: `walker:${i}`, trade,
    path: gridPath(g, S[a], S[b]),
    speed: 1.1 + hash(i, 7, 1) * 0.5,
    pause: 2 + hash(i, 7, 2) * 5,
    phase: hash(i, 7, 3),
  })).filter(w => w.path.length > 1)
}

/** Where a walker is at time t (seconds): out along its path, a pause, back, a pause. Pure. */
export function walkerAt(w: Walker, t: number): { x: number; z: number; yaw: number; moving: boolean } {
  const n = w.path.length - 1, leg = n / w.speed, loop = 2 * (leg + w.pause)
  let u = ((t / loop + w.phase) % 1) * loop
  let s: number, dir: 1 | -1 = 1, moving = true
  if (u < leg) s = u * w.speed
  else if ((u -= leg) < w.pause) { s = n; moving = false }
  else if ((u -= w.pause) < leg) { s = n - u * w.speed; dir = -1 }
  else { s = 0; moving = false; dir = -1 }
  const i = Math.min(n - 1, Math.floor(s)), f = s - i
  const p = w.path[i], q = w.path[i + 1]
  const x = p.x + (q.x - p.x) * f, z = p.z + (q.z - p.z) * f
  const yaw = Math.atan2((q.x - p.x) * dir, (q.z - p.z) * dir)
  return { x, z, yaw, moving }
}

export { WEEK }
