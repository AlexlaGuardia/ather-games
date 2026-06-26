// DEWDROP — a maze chase, canon (CANON/game/dewbear-maze.md). You are a wild DEWBEAR loose in
// the collar-Moglins' burrow-warren, hoovering DEWDROPS while four collar-Moglins hunt you to
// collar you — Burr (latches on → chaser), Bramble (schemer → ambush), Nettle (vain → flank),
// Hemlock (cold baron → overseer). Touch a WILDBLOOM (power pellet) and every collar snaps: the
// Moglins DEFLATE into harmless teddies and flee (the books' deflate payoff = the predator-flip).
// Bump a deflated one and it scurries to the warren-heart for a fresh collar. Clear the dewdrops to win.
//
// Pure sim (no canvas, no React). The page queues a direction each frame and calls tick(); it reads
// events for sound/FX and the grid + mobs to render. Deterministic (mulberry32) for the Daily.

import { mulberry32, type Rng } from '@/lib/arcade/rng'

// ── the maze. '#' wall · '.' mote · 'o' wildbloom · ' ' empty · 'P' player ·
//    'H' shade home · 'T' tunnel (wraps L↔R on its row).
// Built programmatically as a PILLAR LATTICE (walls only at odd,odd interiors) so it is
// connected-with-loops + dead-end-free BY CONSTRUCTION — a correct sim-first board. The
// hand-designed maze ART/layout is a later pass (CANON name + look are a /magii + Alex call).
const MW = 19
const MH = 21
function buildMaze(): string[] {
  const midY = Math.floor(MH / 2)
  const rows: string[] = []
  for (let y = 0; y < MH; y++) {
    let r = ''
    for (let x = 0; x < MW; x++) {
      if (y === 0 || y === MH - 1 || x === 0 || x === MW - 1) {
        r += (x === 0 || x === MW - 1) && y === midY ? 'T' : '#' // tunnels on the middle row
      } else if (x % 2 === 1 && y % 2 === 1) {
        r += '#' // pillar
      } else {
        r += '.' // mote
      }
    }
    rows.push(r)
  }
  const put = (x: number, y: number, ch: string) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1) }
  put(9, MH - 3, 'P') // player spawn (open lattice cell, low-centre)
  put(9, midY, 'H') // shade home (centre)
  for (const [px, py] of [[2, 2], [MW - 3, 2], [2, MH - 3], [MW - 3, MH - 3]]) put(px, py, 'o') // wildblooms
  return rows
}
export const MAZE = buildMaze()
export const COLS = MAZE[0].length
export const ROWS = MAZE.length

export type Dir = 'up' | 'down' | 'left' | 'right'
export const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const REVERSE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DIRS: Dir[] = ['up', 'down', 'left', 'right']

// the four collar-Moglins (canon personalities → ghost archetypes; see dewbear-maze.md)
export type MoglinId = 'burr' | 'bramble' | 'nettle' | 'hemlock'
export type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eaten'
export type GameState = 'ready' | 'playing' | 'dead' | 'won'

// ── tuning ────────────────────────────────────────────────────────────────────────
export const PLAYER_SPEED = 6.2 // tiles/sec
export const GHOST_SPEED = 5.5
export const FRIGHT_SPEED = 3.6
export const EYES_SPEED = 12 // eaten shade rushing home
export const FRIGHT_TIME = 6.5 // seconds a wildbloom keeps the Moglins deflated
export const SCATTER_TIME = 6 // wave timings
export const CHASE_TIME = 18
export const START_LIVES = 3
export const ALIGN = 1e-3

export interface Ghost {
  x: number // tile-unit position (fractional)
  y: number
  dir: Dir
  mode: GhostMode
  moglin: MoglinId
  home: [number, number] // spawn / warren-heart return tile
  scatter: [number, number] // this shade's scatter corner
}

export interface World {
  grid: string[] // mutable copy ('.'/'o' cleared to ' ' as eaten)
  px: number // player position (tile units)
  py: number
  dir: Dir | null // current heading (null = stopped at a wall)
  queued: Dir | null // buffered turn
  ghosts: Ghost[]
  motesLeft: number // '.' + 'o' remaining → 0 = win
  frightT: number // seconds of fright remaining (0 = none)
  combo: number // consecutive shades eaten this bloom (200·2^n)
  waveT: number // time in the current scatter/chase wave
  scatterWave: boolean // true = scatter, false = chase
  lives: number
  score: number
  state: GameState
  spawn: [number, number] // player spawn
  rng: Rng
}

export interface TickEvents {
  mote: boolean // ate an ather-mote
  bloom: boolean // grabbed a wildbloom (flip on)
  eatGhost: number // points scored eating a shade this tick (0 = none)
  death: boolean // a shade caught you (life lost)
  won: boolean // cleared the maze
}
const noEvents = (): TickEvents => ({ mote: false, bloom: false, eatGhost: 0, death: false, won: false })

function cell(grid: string[], x: number, y: number): string {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return '#'
  return grid[y][x]
}
function isWall(grid: string[], x: number, y: number): boolean {
  return cell(grid, x, y) === '#'
}
const ti = (v: number) => Math.round(v)
const centered = (m: { x: number; y: number }) => Math.abs(m.x - ti(m.x)) < ALIGN && Math.abs(m.y - ti(m.y)) < ALIGN

function setCell(w: World, x: number, y: number, ch: string) {
  const row = w.grid[y]
  w.grid[y] = row.slice(0, x) + ch + row.slice(x + 1)
}

function findChar(grid: string[], ch: string): [number, number] {
  for (let y = 0; y < ROWS; y++) {
    const x = grid[y].indexOf(ch)
    if (x >= 0) return [x, y]
  }
  return [1, 1]
}

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed >>> 0)
  const grid = MAZE.slice()
  const spawn = findChar(grid, 'P')
  const home = findChar(grid, 'H')
  // clear the markers to walkable floor (P/H aren't motes)
  let motes = 0
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = grid[y][x]
      if (c === '.' || c === 'o') motes++
      if (c === 'P' || c === 'H') grid[y] = grid[y].slice(0, x) + ' ' + grid[y].slice(x + 1)
    }
  }
  // four collar-Moglins, spawned along the warren-heart corridor, each with a scatter corner
  const moglins: MoglinId[] = ['burr', 'bramble', 'nettle', 'hemlock']
  const corners: [number, number][] = [[COLS - 2, 0], [0, 0], [COLS - 2, ROWS - 1], [0, ROWS - 1]]
  const offs = [0, -1, 1, -2]
  const ghosts: Ghost[] = moglins.map((moglin, i) => ({
    x: home[0] + offs[i],
    y: home[1],
    dir: i % 2 ? 'left' : 'right',
    mode: 'scatter' as GhostMode,
    moglin,
    home: [home[0], home[1]] as [number, number],
    scatter: corners[i],
  }))
  const w: World = {
    grid, px: spawn[0], py: spawn[1], dir: null, queued: null, ghosts,
    motesLeft: motes, frightT: 0, combo: 0, waveT: 0, scatterWave: true,
    lives: START_LIVES, score: 0, state: 'ready', spawn: [spawn[0], spawn[1]], rng,
  }
  return w
}

// queue a turn (player). first input launches the run.
export function setDir(w: World, dir: Dir) {
  w.queued = dir
  if (w.state === 'ready') {
    w.state = 'playing'
    if (w.dir === null) w.dir = dir // kick off immediately if a clear path
  }
}
// joystick/cursor → nearest cardinal (so the maze shares the other cabinets' input)
export function setHeading(w: World, dx: number, dy: number) {
  if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return
  setDir(w, Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
}

function wrapTunnel(m: { x: number; y: number }) {
  if (m.x < 0) m.x = COLS - 1
  else if (m.x > COLS - 1) m.x = 0
}

// move a mob along its dir, snapping to centers where decisions happen. decide() runs at
// each tile center and may change m.dir (turn / stop). Returns the tiles it centered on.
function advance(w: World, m: { x: number; y: number; dir: Dir | null }, speed: number, dt: number, decide: () => void) {
  let remaining = speed * dt
  let guard = 0
  while (remaining > 0 && m.dir && guard++ < 64) {
    const [dx, dy] = DELTA[m.dir]
    const along = dx !== 0 ? m.x : m.y
    const sign = dx + dy // ±1 (one axis is 0)
    const nextCenter = sign > 0 ? Math.floor(along + 1e-6) + 1 : Math.ceil(along - 1e-6) - 1
    const dist = Math.abs(nextCenter - along)
    if (remaining >= dist) {
      if (dx !== 0) m.x = nextCenter; else m.y = nextCenter
      remaining -= dist
      wrapTunnel(m)
      decide() // at a center → choose next dir (or stop)
      if (!m.dir) break
    } else {
      if (dx !== 0) m.x += sign * remaining; else m.y += sign * remaining
      remaining = 0
    }
  }
}

// can a mob at tile (x,y) move in dir without hitting a wall?
function open(w: World, x: number, y: number, dir: Dir): boolean {
  const [dx, dy] = DELTA[dir]
  let nx = x + dx, ny = y + dy
  if (nx < 0) nx = COLS - 1; else if (nx > COLS - 1) nx = 0 // tunnel
  return !isWall(w.grid, nx, ny)
}

function tileDist(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) ** 2 + (ay - by) ** 2
}

// the Moglin's chase target tile, by canon personality (see dewbear-maze.md)
function chaseTarget(w: World, g: Ghost): [number, number] {
  const px = ti(w.px), py = ti(w.py)
  const pdir = w.dir ?? 'left'
  const [pdx, pdy] = DELTA[pdir]
  if (g.moglin === 'burr') return [px, py] // latches on, won't let go → straight for you
  if (g.moglin === 'bramble') return [px + pdx * 4, py + pdy * 4] // the schemer → ambush 4 ahead
  if (g.moglin === 'nettle') {
    // vain/tricky flank — vector from Burr through 2-ahead of you, doubled
    const burr = w.ghosts.find((q) => q.moglin === 'burr') ?? g
    const pivx = px + pdx * 2, pivy = py + pdy * 2
    return [pivx + (pivx - ti(burr.x)), pivy + (pivy - ti(burr.y))]
  }
  // hemlock — the cold baron: closes in when far, peels off to oversee when near
  return tileDist(g.x, g.y, px, py) > 64 ? [px, py] : g.scatter
}

function ghostTarget(w: World, g: Ghost): [number, number] {
  if (g.mode === 'eaten') return g.home
  if (g.mode === 'scatter') return g.scatter
  return chaseTarget(w, g)
}

// decide a shade's next dir at a center: greedy toward target, no 180s (unless dead-end);
// frightened = a deterministic random valid turn.
function decideGhost(w: World, g: Ghost) {
  const x = ti(g.x), y = ti(g.y)
  const back = g.dir ? REVERSE[g.dir] : null
  const opts = DIRS.filter((d) => d !== back && open(w, x, y, d))
  const choices = opts.length ? opts : DIRS.filter((d) => open(w, x, y, d)) // dead-end → allow reverse
  if (!choices.length) { return } // boxed (shouldn't happen)
  if (g.mode === 'frightened') {
    g.dir = choices[Math.floor(w.rng() * choices.length)]
    return
  }
  const [tx, ty] = ghostTarget(w, g)
  let best = choices[0], bestD = Infinity
  for (const d of choices) {
    const [dx, dy] = DELTA[d]
    const dd = tileDist(x + dx, y + dy, tx, ty)
    if (dd < bestD) { bestD = dd; best = d }
  }
  g.dir = best
  // eyes reached home → revive
  if (g.mode === 'eaten' && x === g.home[0] && y === g.home[1]) {
    g.mode = w.scatterWave ? 'scatter' : 'chase'
  }
}

function decidePlayer(w: World) {
  const x = ti(w.px), y = ti(w.py)
  if (w.queued && open(w, x, y, w.queued)) { w.dir = w.queued; w.queued = null } // take the buffered turn
  if (w.dir && !open(w, x, y, w.dir)) w.dir = null // wall ahead → stop (queue stays armed)
}

function speedOf(g: Ghost): number {
  if (g.mode === 'eaten') return EYES_SPEED
  if (g.mode === 'frightened') return FRIGHT_SPEED
  return GHOST_SPEED
}

function resetPositions(w: World) {
  w.px = w.spawn[0]; w.py = w.spawn[1]; w.dir = null; w.queued = null
  const offs = [0, -1, 1, -2]
  w.ghosts.forEach((g, i) => {
    g.x = g.home[0] + offs[i]; g.y = g.home[1]
    g.dir = i % 2 ? 'left' : 'right'
    g.mode = w.scatterWave ? 'scatter' : 'chase'
  })
  w.frightT = 0; w.combo = 0
}

function collide(w: World, ev: TickEvents) {
  const px = ti(w.px), py = ti(w.py)
  for (const g of w.ghosts) {
    if (ti(g.x) !== px || ti(g.y) !== py) continue
    if (g.mode === 'frightened') {
      w.combo++
      const pts = 200 * 2 ** (w.combo - 1)
      w.score += pts
      ev.eatGhost = pts
      g.mode = 'eaten'
    } else if (g.mode !== 'eaten') {
      w.lives--
      ev.death = true
      if (w.lives <= 0) { w.state = 'dead'; w.score += 0 }
      else resetPositions(w)
      return // one death per tick
    }
  }
}

// eat the mote / wildbloom on tile (x,y) if any
function eatTileAt(w: World, x: number, y: number, ev: TickEvents) {
  const c = cell(w.grid, x, y)
  if (c === '.') {
    setCell(w, x, y, ' '); w.motesLeft--; w.score += 10; ev.mote = true
  } else if (c === 'o') {
    setCell(w, x, y, ' '); w.motesLeft--; w.score += 50; ev.bloom = true
    w.frightT = FRIGHT_TIME; w.combo = 0
    for (const g of w.ghosts) if (g.mode === 'scatter' || g.mode === 'chase') {
      g.mode = 'frightened'
      if (g.dir) g.dir = REVERSE[g.dir] // the Moglins recoil (collars snap) — turn and flee
    }
  }
}

// player uses px/py; advance() works on an {x,y,dir} view, kept in sync each center
function movePlayer(w: World, dt: number, ev: TickEvents) {
  const m = { x: w.px, y: w.py, dir: w.dir }
  if (centered(m)) { // apply a queued turn / unstick before moving
    m.x = ti(m.x); m.y = ti(m.y); w.px = m.x; w.py = m.y; decidePlayer(w); m.dir = w.dir
  }
  advance(w, m, PLAYER_SPEED, dt, () => {
    w.px = m.x; w.py = m.y
    eatTileAt(w, ti(m.x), ti(m.y), ev)
    decidePlayer(w)
    m.dir = w.dir
  })
  w.px = m.x; w.py = m.y; w.dir = m.dir
}

// Advance dt seconds. Returns events for sound/FX. No-op unless playing.
export function tick(w: World, dt: number): TickEvents {
  const ev = noEvents()
  if (w.state !== 'playing') return ev

  // ── wave timer (scatter ↔ chase); pauses during fright ────────────────────────
  if (w.frightT <= 0) {
    w.waveT += dt
    const limit = w.scatterWave ? SCATTER_TIME : CHASE_TIME
    if (w.waveT >= limit) {
      w.waveT = 0
      w.scatterWave = !w.scatterWave
      for (const g of w.ghosts) if (g.mode === 'scatter' || g.mode === 'chase') {
        g.mode = w.scatterWave ? 'scatter' : 'chase'
        if (g.dir) g.dir = REVERSE[g.dir] // classic reverse on wave flip
      }
    }
  } else {
    w.frightT -= dt
    if (w.frightT <= 0) {
      w.frightT = 0; w.combo = 0
      for (const g of w.ghosts) if (g.mode === 'frightened') g.mode = w.scatterWave ? 'scatter' : 'chase'
    }
  }

  // ── player → eat → first collision check ──────────────────────────────────────
  movePlayer(w, dt, ev)
  collide(w, ev)
  if (w.state !== 'playing') return ev

  // ── shades ────────────────────────────────────────────────────────────────────
  for (const g of w.ghosts) {
    if (centered(g)) decideGhost(w, g)
    advance(w, g, speedOf(g), dt, () => decideGhost(w, g))
  }
  collide(w, ev)

  if (w.motesLeft <= 0 && w.state === 'playing') { w.state = 'won'; ev.won = true }
  return ev
}

// ── best-score persistence (localStorage) ────────────────────────────────────────
const BEST_KEY = 'dewdrop.best'
export function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0
  } catch {
    return 0 // storage unavailable
  }
}
export function saveBest(score: number): number {
  const best = Math.max(loadBest(), Math.max(0, Math.floor(score)))
  try {
    localStorage.setItem(BEST_KEY, String(best))
  } catch {
    /* storage unavailable */
  }
  return best
}

// the four Moglins' colours (canon render refs) + the dew-blue Dewbear
export const MOGLIN_COLOR: Record<MoglinId, string> = {
  burr: '#f0e6c8', // cream
  bramble: '#c0623a', // russet
  nettle: '#8c93a6', // slate-dun
  hemlock: '#6b5642', // dark coffee
}
export const DEWBEAR_COLOR = '#8fd6e6' // soft dew-blue (the shade "Blue" is named for)
