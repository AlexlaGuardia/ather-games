/**
 * wilds-gen oracle. Run: `npx tsx src/app/shimmer/world/wilds-gen.test.ts`
 *
 * The two that matter most:
 *   · DETERMINISM — the Wilds are canon-"persistent". A generator that drifts between runs
 *     means the world changes under saved positions, so this is a correctness property, not tidiness.
 *   · CROSSABILITY — thresholded noise gives caves and islands. These assert you can actually
 *     walk from any border opening to any other, which is what makes it a country.
 */
import {
  generateWildsRegion, edgeGate, WILDS_FILL, WILDS_LAND, WILDS_PATH,
} from './wilds-gen'
import { encodeRows, decodeRows } from './region-codec'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, label: string) => { c ? pass++ : fails.push(label) }

// Small regions keep the oracle fast; the rules are size-independent.
const S = 120
const gen = (over = {}) => generateWildsRegion({ seed: 1337, rx: 3, ry: 7, cols: S, rows: S, ...over })

// ── 1. determinism — the whole reason a "persistent" world can be generated at all ────────
const a = gen(), b = gen()
ok(JSON.stringify(a.grid) === JSON.stringify(b.grid), 'same spec generates a byte-identical region')
ok(JSON.stringify(a.gates) === JSON.stringify(b.gates), '...and identical gates')
const other = gen({ rx: 4 })
ok(JSON.stringify(other.grid) !== JSON.stringify(a.grid), 'a different region is different country, not a tiled repeat')
const otherSeed = gen({ seed: 99 })
ok(JSON.stringify(otherSeed.grid) !== JSON.stringify(a.grid), 'a different world seed is a different world')

// ── 2. ★ seams agree WITHOUT the two regions ever being generated together ────────────────
// This is what lets the world be built one file at a time, in any order, forever.
ok(edgeGate(1337, 3, 7, 4, 7, S) === edgeGate(1337, 4, 7, 3, 7, S),
  '★ an edge hashes the same from both sides (order-independent)')
const left = generateWildsRegion({ seed: 1337, rx: 3, ry: 7, cols: S, rows: S })
const right = generateWildsRegion({ seed: 1337, rx: 4, ry: 7, cols: S, rows: S })
ok(left.gates.east === right.gates.west, '★ neighbours independently place the SAME opening on their shared border')
const below = generateWildsRegion({ seed: 1337, rx: 3, ry: 8, cols: S, rows: S })
ok(left.gates.south === below.gates.north, '...and the same vertically')
ok(left.gates.east !== left.gates.west, 'different borders get different gates (the hash is not degenerate)')

// ── 3. the walkability contract ───────────────────────────────────────────────────────────
const walkableAt = (g: number[][], x: number, y: number) => g[y]?.[x] !== undefined && g[y][x] !== WILDS_FILL
ok(walkableAt(a.grid, a.heart.x, a.heart.y), 'the heart is walkable')
ok(walkableAt(a.grid, a.gates.north, 0), 'the north gate is open on the border')
ok(walkableAt(a.grid, a.gates.south, S - 1), 'the south gate is open')
ok(walkableAt(a.grid, 0, a.gates.west), 'the west gate is open')
ok(walkableAt(a.grid, S - 1, a.gates.east), 'the east gate is open')

// ★ every gate reaches every other gate — flood from one and require the rest
const reachable = (g: number[][], sx: number, sy: number) => {
  const seen = new Uint8Array(S * S)
  const st = [sy * S + sx]; seen[sy * S + sx] = 1
  while (st.length) {
    const i = st.pop()!, x = i % S, y = (i / S) | 0
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
      if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue
      const j = ny * S + nx
      if (seen[j] || g[ny][nx] === WILDS_FILL) continue
      seen[j] = 1; st.push(j)
    }
  }
  return seen
}
const fromNorth = reachable(a.grid, a.gates.north, 0)
ok(fromNorth[(S - 1) * S + a.gates.south] === 1, '★ you can walk from the north gate to the south gate')
ok(fromNorth[a.gates.west * S + 0] === 1, '★ ...and to the west gate')
ok(fromNorth[a.gates.east * S + (S - 1)] === 1, '★ ...and to the east gate')
ok(fromNorth[a.heart.y * S + a.heart.x] === 1, '★ ...and to the heart')

// ── 4. nothing unreachable survives — a pocket you can never stand in is a bug ────────────
let orphans = 0
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  if (a.grid[y][x] !== WILDS_FILL && fromNorth[y * S + x] !== 1) orphans++
}
ok(orphans === 0, 'no walkable cell is unreachable from the rest of the region')

// ── 5. it is a COUNTRY, not a corridor and not a field ───────────────────────────────────
const frac = a.walkable / (S * S)
ok(a.walkable > 0, 'something is walkable at all')
ok(frac > 0.05, `enough open country to be worth visiting (got ${(frac * 100).toFixed(1)}%)`)
ok(frac < 0.95, `enough cloud left to have shape (got ${(frac * 100).toFixed(1)}%)`)
let land = 0, path = 0
for (const row of a.grid) for (const c of row) { if (c === WILDS_LAND) land++; else if (c === WILDS_PATH) path++ }
ok(land > 0 && path > 0, 'both open country and worn trail exist')
ok(path < land, 'the trails are trails, not the whole map')

// openness dial actually does something
ok(gen({ openness: 0.75 }).walkable > gen({ openness: 0.3 }).walkable, 'the openness dial opens the country up')

// ── 6. it round-trips through the SHIPPING codec, unchanged ──────────────────────────────
const rle = encodeRows(a.grid)
const back = decodeRows(rle, S)
ok(JSON.stringify(back) === JSON.stringify(a.grid), 'the region survives the region-codec round trip')
const bytes = JSON.stringify(rle).length
ok(bytes < S * S * 2, `RLE actually compresses (${(bytes / 1024).toFixed(1)}KB for ${S}x${S})`)

// ── 7. no clock, no Math.random — asserted by behaviour, since a persistent world depends on it
const t1 = generateWildsRegion({ seed: 7, rx: 0, ry: 0, cols: 40, rows: 40 })
const t2 = generateWildsRegion({ seed: 7, rx: 0, ry: 0, cols: 40, rows: 40 })
ok(JSON.stringify(t1) === JSON.stringify(t2), 'generation depends on nothing outside its spec')

console.log(`\nwilds-gen: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
console.log(`✅ a country you can cross — ${(frac * 100).toFixed(1)}% walkable\n`)
