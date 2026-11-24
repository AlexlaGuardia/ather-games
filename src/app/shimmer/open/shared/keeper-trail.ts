// BETA M126 (play, 2026-11-24): WHERE THE KEEPER WALKED, THEIR COMPANY CAN WALK. Alex: "the trio cant leave the plot", "issues in
// the garden with doors". A follower's own ground test knows only the open garden at one level, so a raised house, its door
// steps, the stairs, the path to the gate were all refused: they stopped there. Now the keeper's own trail (feet, so steps and
// stairs too) is ground a follower may use, and a way round a wall is found along it (else by a small grid search).
// PURE but for the one live trail: no three, no react. Tested in keeper-trail.test.ts.
import { lineClear, type Blocked, type Vec } from './follow-formation'

export const TRAIL = {
  crumb: 0.25,    // m between crumbs
  max: 480,       // crumbs kept (~120 m)
  cor: 0.3,       // m either side of the keeper's own line a follower may stand (the keeper's body is wider: never in a wall)
  rise: 0.7,      // m: a crumb this far above / below her feet is another floor
  jump: 4,        // m in one frame = a travel / set-down: the trail starts over
  look: 0.15,     // s a waypoint is kept before it is looked for again
  search: 0.8,    // s between grid searches
  cell: 0.45, cells: 6000,   // the grid search: cell size, most cells it opens
  lost: 4, far: 6,           // s without getting anywhere + m from the keeper = lost (set down beside them, out of their sight)
} as const

export type Crumb = { x: number; y: number; z: number }
export type Trail = { note: (x: number, y: number, z: number, grounded: boolean) => void; clear: () => void
  /** the keeper's floor (the last crumb they stood on), or null */ level: () => number | null
  /** the crumb line within TRAIL.cor of (x, z) and within TRAIL.rise of y (no y = any), its height there; else null */
  at: (x: number, z: number, y?: number) => number | null
  crumbs: () => readonly Crumb[] }

export function makeTrail(): Trail {
  let cs: Crumb[] = [], air: Crumb[] = [], base = 0, last: Crumb | null = null   // base = the absolute index of cs[0]
  const cellsOf = new Map<string, number[]>(), G = 1
  const key = (i: number, j: number) => `${i},${j}`
  const add = (c: Crumb) => {
    const a = cs[cs.length - 1] ?? c, n = base + cs.length; cs.push(c)
    for (let i = Math.floor((Math.min(a.x, c.x) - TRAIL.cor) / G); i <= Math.floor((Math.max(a.x, c.x) + TRAIL.cor) / G); i++)
      for (let j = Math.floor((Math.min(a.z, c.z) - TRAIL.cor) / G); j <= Math.floor((Math.max(a.z, c.z) + TRAIL.cor) / G); j++) {
        const k = key(i, j), l = cellsOf.get(k); if (l) { while (l.length && l[0] <= base) l.shift(); l.push(n) } else cellsOf.set(k, [n]) }
    if (cs.length > TRAIL.max + 60) { const cut = cs.length - TRAIL.max; cs.splice(0, cut); base += cut }
  }
  const clear = () => { cs = []; air = []; base = 0; last = null; cellsOf.clear() }
  return {
    note(x, y, z, grounded) {
      if (last && Math.hypot(x - last.x, z - last.z) > TRAIL.jump) clear()
      last = { x, y, z }
      const e = (air.length ? air[air.length - 1] : cs[cs.length - 1])
      if (!grounded) { if (!e || Math.hypot(x - e.x, z - e.z) >= TRAIL.crumb || Math.abs(y - e.y) > 0.4) air.push({ x, y, z }); if (air.length > 200) air.shift(); return }
      // landed: the jump was part of the way (over a low fence). A fall into a void never lands, so it is never a way
      for (const c of air) add(c); air = []
      const p = cs[cs.length - 1]
      if (!p || Math.hypot(x - p.x, z - p.z) >= TRAIL.crumb || Math.abs(y - p.y) > 0.25) add({ x, y, z })
    },
    clear,
    level: () => (cs.length ? cs[cs.length - 1].y : null),
    at(x, z, y) {
      const l = cellsOf.get(key(Math.floor(x / G), Math.floor(z / G))); if (!l) return null
      let best: number | null = null, bd = Infinity
      for (let q = l.length - 1; q >= 0; q--) {
        const n = l[q] - base; if (n < 0) break
        const c = cs[n]; if (!c) continue
        const a = cs[n - 1] ?? c, dx = c.x - a.x, dz = c.z - a.z, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L)) : 1
        if (Math.hypot(x - a.x - dx * t, z - a.z - dz * t) > TRAIL.cor) continue
        const h = a.y + (c.y - a.y) * t, d = y === undefined ? 0 : Math.abs(h - y); if (y !== undefined && d > TRAIL.rise) continue
        if (d < bd) { bd = d; best = h; if (!d) break }
      }
      return best
    },
    crumbs: () => cs,
  }
}

/** a follower's way to her place: the place itself when the line there is clear, else the NEWEST crumb of the trail she can
 *  reach straight (which pulls the trail's corners tight), else a grid search round whatever is between. null = no way. */
export function makeGuide(trail: Trail, blocked: Blocked) {
  let way: Vec | null = null, direct = false, left = 0, wait = 0, path: Vec[] = [], found = true
  const search = (pos: Vec, goal: Vec): Vec[] => {
    const c = TRAIL.cell, K = (i: number, j: number) => `${i},${j}`, from = new Map<string, string | null>(), q: [number, number][] = [[0, 0]]; from.set('0,0', null)
    const P = (i: number, j: number) => ({ x: pos.x + i * c, z: pos.z + j * c }), ok = new Map<string, boolean>()
    const fr = (i: number, j: number) => { const k = K(i, j); let v = ok.get(k); if (v === undefined) { const p = P(i, j); v = !blocked(p.x, p.z); ok.set(k, v) } return v }
    const cs = trail.crumbs(), near = cs.slice(-40)
    for (let h = 0; h < q.length && from.size < TRAIL.cells; h++) {
      const [i, j] = q[h], p = P(i, j)
      if (h && ((Math.hypot(p.x - goal.x, p.z - goal.z) < 0.7 && lineClear(p, goal, blocked)) || (from.size > 400 && near.some(o => Math.hypot(o.x - p.x, o.z - p.z) < 0.3)))) {
        const out: Vec[] = []; for (let k: string | null = K(i, j); k; k = from.get(k) ?? null) { const [a, b] = k.split(',').map(Number); out.unshift(P(a, b)) }
        return out.slice(1) }
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const k = K(i + a, j + b); if (from.has(k) || !fr(i + a, j + b) || (a && b && !(fr(i + a, j) && fr(i, j + b)))) continue
        from.set(k, K(i, j)); q.push([i + a, j + b]) }
    }
    return []
  }
  return {
    found: () => found,
    toward(pos: Vec, goal: Vec, dt: number): Vec | null {
      left -= dt; wait -= dt
      if (direct && left > 0) return goal
      if (way && left > 0 && Math.hypot(way.x - pos.x, way.z - pos.z) > 0.12) return way
      left = TRAIL.look; direct = lineClear(pos, goal, blocked)
      if (direct) { path = []; found = true; way = null; return goal }
      const cs = trail.crumbs()
      for (let n = cs.length - 1, k = 0; n >= 0 && k < 200; n--, k++) { const c = cs[n]
        if (Math.hypot(c.x - pos.x, c.z - pos.z) < 0.12) break   // she is on it and nothing newer is in reach: the search
        if (lineClear(pos, c, blocked)) { path = []; found = true; return way = { x: c.x, z: c.z } } }
      while (path.length && Math.hypot(path[0].x - pos.x, path[0].z - pos.z) < 0.2) path.shift()
      if (!path.length && wait <= 0) { wait = TRAIL.search; path = search(pos, goal) }
      if (path.length) { let n = 0; for (let i = path.length - 1; i > 0; i--) if (lineClear(pos, path[i], blocked)) { n = i; break }
        path = path.slice(n); found = true; return way = path[0] }
      found = false; return way = null
    },
  }
}
export type Guide = ReturnType<typeof makeGuide>

/** the one keeper's trail (the page notes it each frame through spirit-follow.ts setKeeperAt) */
export const keeperTrail = makeTrail()
