// DEWDROP sim sanity — run with: npx tsx src/app/dewdrop/lib/dewdrop.test.ts
import {
  makeWorld,
  setDir,
  setHeading, // ensure exports resolve
  tick,
  loadBest,
  saveBest,
  MAZE,
  COLS,
  ROWS,
  DELTA, // ensure exports resolve
  type World,
} from './dewdrop'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}`) }
}
const ti = (v: number) => Math.round(v)
function run(w: World, frames: number, dt = 1 / 60) { for (let i = 0; i < frames; i++) tick(w, dt) }

// 0. maze sanity: rectangular, and every mote is reachable from the player spawn
{
  ok('maze is rectangular', MAZE.every((r) => r.length === COLS) && ROWS === MAZE.length)
  // flood-fill walkable tiles from spawn; assert no '.'/'o' is stranded
  const w = makeWorld(1)
  const sx = w.spawn[0], sy = w.spawn[1]
  const seen = new Set<string>()
  const stack = [[sx, sy]]
  const wrap = (x: number) => (x < 0 ? COLS - 1 : x > COLS - 1 ? 0 : x)
  while (stack.length) {
    const [x, y] = stack.pop()!
    const k = `${x},${y}`
    if (seen.has(k)) continue
    if (y < 0 || y >= ROWS) continue
    if (MAZE[y][wrap(x)] === '#') continue
    seen.add(k)
    stack.push([wrap(x - 1), y], [wrap(x + 1), y], [x, y - 1], [x, y + 1])
  }
  let stranded = 0
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = MAZE[y][x]
    if ((c === '.' || c === 'o') && !seen.has(`${x},${y}`)) stranded++
  }
  ok('every mote is reachable from spawn', stranded === 0)
  ok('seeded with motes to clear', w.motesLeft > 50)
}

// 1. ready → playing on first input
{
  const w = makeWorld(1)
  ok('starts ready', w.state === 'ready')
  ok('tick no-op while ready', tick(w, 0.1).mote === false && w.state === 'ready')
  setDir(w, 'left')
  ok('input launches', w.state === 'playing')
}

// 2. moves down a corridor; a wall stops it
{
  const w = makeWorld(1); w.ghosts = [] // solo the player
  const x0 = w.px
  setDir(w, 'left'); run(w, 40)
  ok('moves left along the corridor', w.px < x0)

  const w2 = makeWorld(1); w2.ghosts = []
  const sy = w2.py
  setDir(w2, 'up'); run(w2, 30) // spawn has a wall directly above
  ok('a wall stops it (no move up)', ti(w2.py) === ti(sy))
}

// 3. a queued turn is taken at the next intersection
{
  const w = makeWorld(1); w.ghosts = []
  setDir(w, 'left'); run(w, 12) // slide left toward (8,15)
  setDir(w, 'down') // queue a turn; (8,16) is open
  run(w, 40)
  ok('queued turn changes lane', w.py > 15)
}

// 4. eating motes scores; clearing the last mote wins
{
  const w = makeWorld(1); w.ghosts = []
  setDir(w, 'left'); run(w, 30)
  ok('eating a mote scores', w.score > 0)

  const w2 = makeWorld(1); w2.ghosts = []
  w2.motesLeft = 1 // pretend only the (8,15) mote remains
  setDir(w2, 'left'); run(w2, 40)
  ok('clearing the last mote wins', w2.state === 'won')
}

// 5. a rune-bloom frightens the void; eating a shade scores + sends its eyes home; a normal shade kills
{
  // drive onto a rune-bloom (top-left 'o' at (2,2)); place player just below it
  const w = makeWorld(1)
  w.px = 2; w.py = 3; w.dir = null; w.queued = null; w.state = 'playing' // (2,2) is the bloom, up from here
  setDir(w, 'up'); run(w, 30)
  ok('a rune-bloom triggers fright', w.frightT > 0 && w.ghosts.every((g) => g.mode === 'frightened' || g.mode === 'eaten'))

  // eat a frightened shade: drop one onto the player
  const before = w.score
  const g = w.ghosts[0]; g.mode = 'frightened'; g.x = ti(w.px); g.y = ti(w.py)
  tick(w, 1 / 60)
  ok('eating a frightened shade scores', w.score > before && (g.mode as string) === 'eaten')

  // a normal shade kills (life lost)
  const w2 = makeWorld(2); w2.state = 'playing'; w2.frightT = 0
  const lives0 = w2.lives
  const k = w2.ghosts[1]; k.mode = 'chase'; k.x = ti(w2.px); k.y = ti(w2.py)
  const ev = tick(w2, 1 / 60)
  ok('a hunting shade costs a life', ev.death && w2.lives === lives0 - 1)
}

// 6. a chasing Burr closes distance on a stationary player over time
{
  const w = makeWorld(3); w.state = 'playing'
  const burr = w.ghosts.find((g) => g.moglin === 'burr')!
  burr.mode = 'chase'
  w.frightT = 0; w.scatterWave = false; w.waveT = 0
  // freeze the player by jamming it against a wall; measure Burr's distance
  const d0 = Math.hypot(burr.x - w.px, burr.y - w.py)
  for (let i = 0; i < 60 * 5; i++) { setDir(w, 'up'); if (w.state !== 'playing') break; tick(w, 1 / 60) }
  const wsh = w.ghosts.find((g) => g.moglin === 'burr')!
  const d1 = Math.hypot(wsh.x - w.px, wsh.y - w.py)
  ok('Burr hunts closer (or catches you)', d1 < d0 || w.lives < 3)
}

// 7. heading → cardinal mapping
{
  const w = makeWorld(1)
  setHeading(w, -0.9, 0.1)
  ok('heading maps to a cardinal', w.queued === 'left')
  ok('DELTA is wired', DELTA.left[0] === -1)
}

// 8. determinism — same seed, same run
{
  const a = makeWorld(2024), b = makeWorld(2024)
  a.state = b.state = 'playing'
  for (let i = 0; i < 60 * 6; i++) { setDir(a, 'left'); setDir(b, 'left'); tick(a, 1 / 60); tick(b, 1 / 60) }
  ok('same seed → same score', a.score === b.score)
  ok('same seed → same shade positions', a.ghosts[0].x === b.ghosts[0].x && a.ghosts[2].y === b.ghosts[2].y)
}

// 9. best-score helpers survive a no-storage env (headless / SSR)
{
  let threw = false, bb = -1
  try { bb = saveBest(150); loadBest() } catch { threw = true }
  ok('best-score helpers survive no-storage', !threw && bb >= 0)
}

console.log(`\nDEWDROP sim: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
