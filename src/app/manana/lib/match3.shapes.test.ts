// MANA'NANA shape-special verification (T→star, L→burst, burst=3x3).
// run: npx tsx src/app/manana/lib/match3.shapes.test.ts
import { W, H, idx, gem, resolve, type Cell, type Kind } from './match3'

let seed = 13579
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

// filler that never forms its own 3-run: horizontals are c,c+1,c+2; verticals c,c+2,c+4
const filler = (): Cell[] => Array.from({ length: W * H }, (_, i) => gem((((i % W) + 2 * Math.floor(i / W)) % 6)))
const paint = (b: Cell[], cells: number[], color: number) => { for (const i of cells) b[i] = gem(color) }
const spawnedKinds = (steps: { spawned: { i: number; kind: Kind }[] }[]) =>
  steps.flatMap((s) => s.spawned.map((sp) => sp.kind))

// ── L-shape (arms meet at a corner) → burst ─────────────────────────────────
{
  const b = filler()
  // H arm (2,3)(3,3)(4,3) + V arm (2,3)(2,4)(2,5) share the corner (2,3); colour 3
  // (caps around the arms are colours 1/5/0/2 in the filler, so the arms stay len 3)
  paint(b, [idx(2, 3), idx(3, 3), idx(4, 3), idx(2, 4), idx(2, 5)], 3)
  const kinds = spawnedKinds(resolve(b, rng).steps)
  chk('L-shape blooms a burst', kinds.includes('burst'), JSON.stringify(kinds))
  chk('L-shape does NOT bloom a straight prism', !kinds.includes('prism'), JSON.stringify(kinds))
}

// ── T-shape (arm meets at a junction) → star ────────────────────────────────
{
  const b = filler()
  // H arm (2,3)(3,3)(4,3) + V arm (3,2)(3,3)(3,4) cross at the middle (3,3); colour 3
  paint(b, [idx(2, 3), idx(3, 3), idx(4, 3), idx(3, 2), idx(3, 4)], 3)
  const kinds = spawnedKinds(resolve(b, rng).steps)
  chk('T-shape blooms a star', kinds.includes('star'), JSON.stringify(kinds))
}

// ── burst detonates a 3×3 box ───────────────────────────────────────────────
{
  const b = filler()
  b[idx(3, 3)] = { color: 2, kind: 'burst' }
  const res = resolve(b, rng, { forced: new Set([idx(3, 3)]) })
  const cleared = new Set<number>(); res.steps.forEach((s) => s.matched.forEach((m) => cleared.add(m)))
  const box = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => idx(3 + dx, 3 + dy)))
  chk('burst clears the full 3x3 around it', box.every((i) => cleared.has(i)), `cleared ${cleared.size}`)
}

// ── a plain straight 5-run still makes a prism (shape logic didn't break it) ──
{
  const b = filler()
  paint(b, [idx(1, 6), idx(2, 6), idx(3, 6), idx(4, 6), idx(5, 6)], 4) // caps (0,6)=2 (6,6)=2
  const kinds = spawnedKinds(resolve(b, rng).steps)
  chk('straight 5 still blooms prism', kinds.includes('prism'), JSON.stringify(kinds))
}

console.log(`\nshapes: ${ok} passed, ${bad} failed`)
if (bad) process.exit(1)
