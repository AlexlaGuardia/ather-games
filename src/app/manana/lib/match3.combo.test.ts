// MANA'NANA special+special combo verification — run: npx tsx src/app/manana/lib/match3.combo.test.ts
import { W, H, idx, gem, swapDetonation, type Cell, type Kind } from './match3'

const rng = () => 0.5
let pass = 0
let fail = 0
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++ } else { fail++; console.error('  FAIL:', name, extra) }
}

const blank = (): Cell[] => Array.from({ length: W * H }, () => gem(0))

// place two specials adjacent (horizontally at row 3, cols 3|4) and swap them
function fire(
  kindA: Kind, colorA: number, kindB: Kind, colorB: number,
  paint: { i: number; color: number }[] = [],
) {
  const ax = 3, ay = 3
  const a = idx(ax, ay), c = idx(ax + 1, ay)
  const b = blank()
  for (const p of paint) b[p.i] = gem(p.color)
  b[a] = { color: colorA, kind: kindA }
  b[c] = { color: colorB, kind: kindB }
  const det = swapDetonation(b, a, c, rng)!
  return { det, a, c, cx: ax + 1, cy: ay }
}

// surge + surge → full row + full column through the swap = 15 cells (8+8-1 overlap)
{
  const { det } = fire('surgeH', 1, 'surgeV', 2)
  ok('surge+surge = row+col (15)', det.forced.size === 15, `got ${det.forced.size}`)
}

// star + surge → 3 rows + 3 cols (24+24-9 overlap = 39), all in-bounds at (4,3)
{
  const { det } = fire('star', 1, 'surgeH', 2)
  ok('star+surge = thick cross (39)', det.forced.size === 39, `got ${det.forced.size}`)
}

// star + star → 5×5 block = 25 cells (in-bounds at (4,3): x2..6, y1..5)
{
  const { det } = fire('star', 1, 'star', 2)
  ok('star+star = 5x5 (25)', det.forced.size === 25, `got ${det.forced.size}`)
}

// prism + surge → every gem of the surge's colour re-forged to a surge + fired.
// paint 6 gems colour 7; target colour = partner (surge) colour = 7.
{
  const paint = [10, 11, 12, 20, 21, 40].map((i) => ({ i, color: 7 }))
  const { det } = fire('prism', 0, 'surgeH', 7, paint)
  // forced = the 2 swapped cells + the 6 painted colour-7 gems
  ok('prism+surge = colour sweep (2+6)', det.forced.size === 8, `got ${det.forced.size}`)
  ok('prism+surge re-forges painted gems to surge', paint.every((p) => det.board[p.i].kind === 'surgeH' || det.board[p.i].kind === 'surgeV'))
}

// prism + prism → clear the whole board (64 non-puff cells)
{
  const { det } = fire('prism', 3, 'prism', 5)
  ok('prism+prism = board clear (64)', det.forced.size === W * H, `got ${det.forced.size}`)
}

// sanity: a special + plain gem is still a single detonation (2 cells), prism recolours
{
  const b = blank()
  const a = idx(3, 3), c = idx(4, 3)
  b[a] = { color: 0, kind: 'prism' }
  b[c] = gem(4)
  const det = swapDetonation(b, a, c, rng)!
  ok('prism+plain = single detonation (2)', det.forced.size === 2, `got ${det.forced.size}`)
  ok('prism+plain takes the plain gem colour', det.board[c].kind === 'prism' && det.board[c].color === 4)
}

console.log(`\nmatch3 combo: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
