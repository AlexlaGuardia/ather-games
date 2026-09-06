// The Crucible arena, generated. Run: npx tsx src/app/shimmer/world/crucible-arena.test.ts
//
// ⚠⚠ THE POINT OF THIS FILE IS THE SIZES NOBODY HAS SHIPPED YET. The hand-typed 40×30 literal was
// correct by inspection — someone had looked at it. Every position that depended on it was a typed
// number that was ALSO correct at 40×30 and silently wrong at every other size, which is exactly
// the class of bug you cannot find by reading the shipped configuration. So these walk a spread of
// sizes and assert the invariants hold at each.

import { CRUCIBLE, CRUCIBLE_COLS, CRUCIBLE_ROWS, CRUCIBLE_MIN, createCrucibleArena, crucibleArrival, crucibleExit } from './tilemap'
import { ZONES } from './zones'
import { SOLID } from './tiles'
import { startingPositions } from '../play3d/crucible-entrances'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const FLOOR = 98, WALL = 103, WARP = 14
/**
 * From `CRUCIBLE_MIN` (11) to the editor's resize clamp (160). ⚠ 8×8 is deliberately absent and the
 * reason is derived, not a dodge: the gate's centre column and the east entrance inset are the SAME
 * column at cols 8, so challengers there spawn on the exit warp. `CRUCIBLE_MIN` names that bound.
 * §5 asserts the bound itself, so this list not containing 8 is a consequence rather than a choice.
 */
const SIZES: [number, number][] = [[CRUCIBLE_MIN, CRUCIBLE_MIN], [16, 12], [40, 30], [60, 60], [100, 80], [140, 140], [160, 160], [160, 40]]

// ── 1. THE SHIPPED GRID IS THE GENERATED ONE ────────────────────────────────────────────────
// Mutation: change CRUCIBLE_COLS without regenerating → fires.
{
  ok(CRUCIBLE.length === CRUCIBLE_ROWS && CRUCIBLE[0]!.length === CRUCIBLE_COLS,
     `the shipped grid is ${CRUCIBLE_COLS}×${CRUCIBLE_ROWS} (got ${CRUCIBLE[0]!.length}×${CRUCIBLE.length})`)
  const fresh = createCrucibleArena(CRUCIBLE_COLS, CRUCIBLE_ROWS)
  ok(JSON.stringify(fresh) === JSON.stringify(CRUCIBLE), 'and it IS the generator\'s output, not a copy that drifted')
}

// ── 2. AT EVERY SIZE: a sealed border, a floor inside, a real gate ──────────────────────────
// Mutation: drop the WARP paint → the gate assert fires. Drop the border → the seal assert fires.
{
  for (const [cols, rows] of SIZES) {
    const g = createCrucibleArena(cols, rows)
    ok(g.length === rows && g.every(r => r.length === cols), `${cols}×${rows}: the grid is the size asked for`)

    let leaks = 0
    for (let x = 0; x < cols; x++) { if (!SOLID[g[0]![x]! & 0xFF] && g[0]![x] !== WARP) leaks++
                                     if (!SOLID[g[rows-1]![x]! & 0xFF] && g[rows-1]![x] !== WARP) leaks++ }
    for (let y = 0; y < rows; y++) { if (!SOLID[g[y]![0]! & 0xFF] && g[y]![0] !== WARP) leaks++
                                     if (!SOLID[g[y]![cols-1]! & 0xFF] && g[y]![cols-1] !== WARP) leaks++ }
    ok(leaks === 0, `${cols}×${rows}: the border is sealed (${leaks} cells a keeper could walk out of)`)

    const gate = crucibleExit(cols, rows)
    const painted = [[gate.x, gate.y], [gate.x + 1, gate.y], [gate.x, gate.y + 1], [gate.x + 1, gate.y + 1]]
      .filter(([x, y]) => g[y!]?.[x!] === WARP).length
    ok(painted === 4, `${cols}×${rows}: the exit warp is painted across the full 2×2 gate footprint (${painted}/4)`)

    const arr = crucibleArrival(cols, rows)
    ok(g[arr.y]?.[arr.x] === FLOOR, `${cols}×${rows}: a keeper arrives on open floor, not in a wall or on the gate`)
  }
}

// ── 3. ★★★ THE COUPLING THAT LIVES IN ANOTHER ZONE'S BLOCK ──────────────────────────────────
// Travelers Station's gate aims at the Crucible's arrival tile from its own block, twenty lines and
// one zone away. It was a typed (19,25). Resizing the arena with that left alone lands a keeper at
// whatever (19,25) happens to be on the new grid — and NOTHING in the crucible's own block, or in
// this arena file, would show it. That is the whole reason this assert exists.
// Mutation: hardcode either side back to 19/25 → fires.
{
  const cru = ZONES.find(z => z.id === 'crucible')!
  const sta = ZONES.find(z => z.id === 'travelers-station')!
  // ⚠ `gates` and `playerStart` are optional on the Zone type — asserted rather than `!`-ed, because
  // a `!` on a missing zone throws, and a throw is neither a pass nor a fail (PATTERNS, 08-22).
  ok(!!cru.playerStart && !!cru.gates && !!sta.gates, 'fixture: both zones carry a start and gates')
  const start = cru.playerStart!, cruGates = cru.gates ?? [], staGates = sta.gates ?? []
  const door = staGates.find(g => g.toZone === 'crucible')!
  ok(door.toX === start.tileX && door.toY === start.tileY,
     `★ the station's door and the arena's own start are the SAME tile (${door.toX},${door.toY} vs ${start.tileX},${start.tileY})`)
  ok(CRUCIBLE[door.toY]?.[door.toX] === FLOOR, 'and that tile is open floor on the shipped grid')

  const out = cruGates.find(g => g.toZone === 'travelers-station')!
  ok(CRUCIBLE[out.y]?.[out.x] === WARP, 'the way out stands on painted warp')
  ok(out.x !== start.tileX || out.y !== start.tileY,
     'and you do not arrive standing on the exit — which would bounce you straight back out')
}

// ── 4. THE SIXTY FIT, AT EVERY SIZE ─────────────────────────────────────────────────────────
// Phase 0 places challengers from the map's dimensions; this is the other half of that contract —
// that the map it derives from actually has floor under every one of them.
// Mutation: WALL_INSET 0 in crucible-entrances → fires here too, from the other side.
{
  for (const [cols, rows] of SIZES) {
    const g = createCrucibleArena(cols, rows)
    const bad = startingPositions(cols, rows).filter(p => g[p.z]?.[p.x] !== FLOOR)
    ok(bad.length === 0, `${cols}×${rows}: all sixty challengers stand on open floor (${bad.length} did not)`)
  }
}

// ── 5. THE MINIMUM IS REAL, AND IT IS WHERE IT SAYS IT IS ───────────────────────────────────
// ★ Asserted from BOTH sides, which is what stops `CRUCIBLE_MIN` becoming a number somebody fitted
// to a passing test: at the minimum every challenger is on floor, and one below it at least one is
// not. A constant that only has to be big enough is a constant that can drift upward forever.
// Mutation: CRUCIBLE_MIN 11 -> 12 → the "one below fails" assert goes green-by-luck and this fires
// on the tightness check instead.
{
  const clean = (n: number) => {
    const g = createCrucibleArena(n, n)
    return startingPositions(n, n).every(p => g[p.z]?.[p.x] === FLOOR)
  }
  ok(clean(CRUCIBLE_MIN), `at CRUCIBLE_MIN (${CRUCIBLE_MIN}) every challenger is on floor`)
  ok(!clean(CRUCIBLE_MIN - 3), `and below it they are not — the bound is real, not decorative (${CRUCIBLE_MIN - 3} fails)`)
  ok(CRUCIBLE_COLS >= CRUCIBLE_MIN && CRUCIBLE_ROWS >= CRUCIBLE_MIN, 'and the shipped arena clears its own minimum')
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 10)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ the arena builds at any size — ${pass} passed`)
