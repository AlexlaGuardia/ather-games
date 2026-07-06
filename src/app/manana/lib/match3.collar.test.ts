// MANA'NANA collar mechanic — run: npx tsx src/app/manana/lib/match3.collar.test.ts
import {
  W, H, idx, gem, collarCell, isCollared, seedCollars, countCollars, findRuns, resolve, type Cell,
} from './match3'

let seed = 246810
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

const filler = (): Cell[] => Array.from({ length: W * H }, (_, i) => gem((((i % W) + 2 * Math.floor(i / W)) % 6)))

// ── seedCollars places exactly n collars on plain gems ──────────────────────
{
  const b = seedCollars(filler(), rng, 6)
  chk('seedCollars places 6', countCollars(b) === 6, `got ${countCollars(b)}`)
  chk('collared cells keep a real colour', b.filter(isCollared).every((c) => c.color >= 0))
}

// ── a collared orb breaks a run (does not match) ────────────────────────────
{
  const b = filler()
  b[idx(0, 3)] = gem(4); b[idx(1, 3)] = collarCell(4); b[idx(2, 3)] = gem(4) // 4 · [collar 4] · 4
  const runs = findRuns(b)
  const throughCollar = runs.some((r) => r.cells.includes(idx(0, 3)) && r.cells.includes(idx(2, 3)))
  chk('collared orb breaks the run', !throughCollar)
}

// ── a clear beside a collar snaps it (freed, not cleared) ───────────────────
{
  const b = filler()
  b[idx(0, 3)] = gem(4); b[idx(1, 3)] = gem(4); b[idx(2, 3)] = gem(4) // a real H3 match
  b[idx(3, 3)] = collarCell(2) // orthogonally adjacent to (2,3)
  const before = countCollars(b)
  const res = resolve(b, rng)
  chk('one collar present before', before === 1)
  chk('resolve reports freed >= 1', res.freed >= 1, `freed ${res.freed}`)
  chk('the collar is gone after (freed to a normal orb)', countCollars(res.board) === 0, `left ${countCollars(res.board)}`)
}

// ── a collar with no clear nearby stays collared ────────────────────────────
{
  const b = filler()
  b[idx(0, 0)] = gem(4); b[idx(1, 0)] = gem(4); b[idx(2, 0)] = gem(4) // match at the top row
  b[idx(7, 7)] = collarCell(3) // far corner, untouched
  const res = resolve(b, rng)
  // it may or may not be reached by cascades; assert it wasn't freed by THIS match's first step
  const firstFreed = res.steps[0]?.freed ?? 0
  chk('a distant collar is not freed by the first clear', firstFreed === 0, `firstFreed ${firstFreed}`)
}

console.log(`\ncollar: ${ok} passed, ${bad} failed`)
if (bad) process.exit(1)
