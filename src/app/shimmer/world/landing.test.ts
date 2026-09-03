// THE LANDING'S ORACLE — every number in `landing.ts`, checked against the SHIPPED map.
//
// Run: npx tsx src/app/shimmer/world/landing.test.ts
//
// ── ★★★ WHY THIS FILE IS THE POINT, AND NOT PAPERWORK ────────────────────────────────────────
// `voxel3d/crossing-out.ts` refused to derive the landing for a good reason: *"a derived landing is
// a wall or a rooftop with a green test beside it."* This file is the answer to that objection —
// not "trust me, it is the middle of the square", but **the middle of the square is a measurement,
// and here it is, taken from `RUNE_HOLD` itself.** Re-author the town and these go red naming the
// cell, instead of the door ending up inside a shopfront with nothing to say so.
//
// ⚠ THE PLAZA BOUNDS ARE RE-DERIVED HERE RATHER THAN READ FROM `landing.ts`. Comparing the module's
// constant against itself is the hand-kept mirror this repo has paid for twice — a copy agrees with
// its original forever, including after both go stale. The bbox below is computed from the grid.
import { RUNE_HOLD } from './tilemap'
import { ALL_ZONES } from './all-zones'
import { getZone, gateFootprint, type Gate, type Zone } from './zones'
import {
  PLAZA, PLAZA_FLOOR, PIER_TILE, DOOR_TILE, PIERS, LANDING, LANDING_ARRIVAL, LANDING_LABEL,
  inPlaza, landingCells,
} from './landing'
import { arrivalBlockedBy } from '../voxel3d/crossing-out'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const G = RUNE_HOLD
ok(G.length === 100 && G.every(r => r.length === 100), `the town is 100x100 (${G.length})`)

const town = getZone(ALL_ZONES, 'rune-hold') as (Zone & { gates?: Gate[] }) | undefined
const gates: Gate[] = town?.gates ?? []

// ── 1. THE PLAZA IS WHERE THE MODULE SAYS, MEASURED OFF THE GRID ─────────────────────────────
// The square is the one contiguous slab of Dirt at the town's heart. Its bbox is computed, then
// compared — so the module's constant is a claim under test, never the source of its own proof.
{
  // Grow from the keeper's own start tile: a flood over floor-or-pier cells, which is what the
  // square IS after the frame was stamped into it. Streets leave the slab through 1-3 tile mouths,
  // so the flood is bounded to the block that contains the start rather than the whole road net.
  const start = town?.playerStart
  ok(!!start, 'the town has a playerStart to reason from')
  ok(!!start && inPlaza(start.tileX, start.tileY),
     `the keeper wakes inside the plaza (${start?.tileX},${start?.tileY})`)

  let minx = 99, maxx = 0, miny = 99, maxy = 0, n = 0
  for (let y = PLAZA.y0; y <= PLAZA.y1; y++) for (let x = PLAZA.x0; x <= PLAZA.x1; x++) {
    const v = G[y][x]
    if (v === PLAZA_FLOOR || v === PIER_TILE || v === DOOR_TILE) {
      n++; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y)
    }
  }
  ok(n === 24 * 24, `all 576 plaza cells are floor, the frame's stone, or its doorway (${n})`)
  ok(minx === PLAZA.x0 && maxx === PLAZA.x1 && miny === PLAZA.y0 && maxy === PLAZA.y1,
     `the measured slab fills the declared bounds (x ${minx}..${maxx}, y ${miny}..${maxy})`)
  ok(maxx - minx === 23 && maxy - miny === 23, 'and it is the 24x24 square the re-proportioning built')

  // ⚠ THE NEGATIVE HALF, or "the plaza is 24x24" is satisfied by a plaza of any larger size. The
  // ring one tile outside must NOT be plaza floor, or the bounds are arbitrary rather than tight.
  let outside = 0, outsideFloor = 0
  for (let x = PLAZA.x0 - 1; x <= PLAZA.x1 + 1; x++) for (const y of [PLAZA.y0 - 1, PLAZA.y1 + 1]) {
    outside++; if (G[y]?.[x] === PLAZA_FLOOR) outsideFloor++
  }
  ok(outside > 40, `the ring outside is actually sampled (${outside})`)
  // Streets leave the square, so a few mouths are legitimately floor. Most of the ring must not be.
  ok(outsideFloor < outside / 2, `the bounds are tight — most of the ring is not plaza (${outsideFloor}/${outside})`)
}

// ── 2. THE FRAME IS BUILT, IN THE GRID, WHERE COLLISION LIVES ────────────────────────────────
// Alex's ruling of 2026-09-03: voxel-built, not a mesh, because a mesh writes nothing into the grid
// and a keeper walks through it. So the assert is about the GRID, never about a render call.
{
  for (const [x, y] of PIERS) {
    ok(G[y][x] === PIER_TILE, `pier (${x},${y}) is the town's masonry, id ${PIER_TILE} (found ${G[y][x]})`)
    ok(inPlaza(x, y), `pier (${x},${y}) stands on the square`)
  }
  ok(PIERS.length === 8, `both jambs are 2x2 (${PIERS.length} cells)`)

  // ★★ AND THE DOORWAY CARRIES THE WARP TILE — the check that ties CODE to MAP.
  // `rune-hold-fold.test.ts`: *"a gate must sit ON the warp tiles Alex painted"*, because the gate's
  // anchor is read off them; a footprint on bare ground is a door in two places, neither right.
  // This also covers the stone-stamp's own worst failure — one index off and the opening fills in.
  for (const [x, y] of landingCells()) {
    ok(G[y][x] === DOOR_TILE, `the doorway (${x},${y}) is a painted warp tile (found ${G[y][x]})`)
    ok(G[y][x] !== PIER_TILE, `and it is not the frame's own stone (${x},${y})`)
  }

  // ★ SYMMETRY, WHICH IS ONE ASSERT THAT CATCHES A WHOLE CLASS. A jamb wider on one side reads as a
  // mistake from across the square and no cell-by-cell check would notice.
  const xs = PIERS.map(([x]) => x)
  const left = xs.filter(x => x < LANDING.x).length, right = xs.filter(x => x > LANDING.x).length
  ok(left === right && left === 4, `the jambs are even about the door (${left} | ${right})`)
  ok(Math.min(...xs) === LANDING.x - 2 && Math.max(...xs) === LANDING.x + 2,
     'and the frame reaches exactly two blocks each way — a trilithon, not a sheet')
  const ys = new Set(PIERS.map(([, y]) => y))
  ok(ys.size === LANDING.h && [...ys].every(y => y >= LANDING.y && y < LANDING.y + LANDING.h),
     'the stone is exactly as deep as the door it frames')
}

// ── 3. THE ANCHOR — the number the crossing was blocked on for a week ────────────────────────
{
  const { x, y } = LANDING_ARRIVAL
  ok(inPlaza(x, y), `the keeper stands up on the square (${x},${y})`)
  ok(G[y][x] === PLAZA_FLOOR, `and on open floor, not on the frame (found ${G[y][x]})`)

  // ⚠⚠ NEVER ON A GATE. A gate tile is what a warp fires on: an arrival placed on one is an instant
  // re-warp, which reads as the crossing being broken rather than as the arrival being a tile off.
  ok(arrivalBlockedBy(x, y) === null, 'and on no door in the square — no instant re-warp')

  // ★ THE POSITIVE CONTROL. Without it `arrivalBlockedBy` could be `() => null` and this suite
  // would not notice — the shape that has burned this repo more than any other.
  ok(arrivalBlockedBy(LANDING.x, LANDING.y) !== null,
     'positive control: the door itself IS refused as an anchor')

  // Adjacent to the door, not merely somewhere on the square — a keeper must arrive AT the landing.
  const cells = landingCells()
  const near = cells.some(([cx, cy]) => Math.abs(cx - x) + Math.abs(cy - y) === 1)
  ok(near, 'the anchor touches the doorway')

  // South, because the town approaches from the south — `playerStart` is twelve rows that way.
  ok(y > LANDING.y + LANDING.h - 1, 'and it is on the square side of the door, not behind it')
  const start = town?.playerStart
  ok(!!start && start.tileY > y, `which is the side the keeper wakes on (start y ${start?.tileY} > ${y})`)
}

// ── 4. THE DOOR EXISTS IN THE SHIPPED DATA, AND IT IS THE SHAPE ALEX RULED ───────────────────
{
  const g = gates.find(gg => gg.label.toUpperCase() === LANDING_LABEL)
  ok(!!g, 'THE LANDING is painted in the shipped town')
  if (g) {
    const { w, h } = gateFootprint(g)
    ok(w === 1 && h === 2, `1x2 — Alex's ruling of 2026-08-24, the map's first non-square gate (${w}x${h})`)
    ok(g.x === LANDING.x && g.y === LANDING.y, `and it stands where the module places it (${g.x},${g.y})`)

    // ⚠ THE GATE DATA AND THE STONE MUST NOT DRIFT APART. They are two halves of one door and they
    // live in two files; nothing but this compares them.
    for (const [cx, cy] of landingCells())
      ok(!PIERS.some(([px, py]) => px === cx && py === cy), `no pier sits in the doorway (${cx},${cy})`)

    // The fallback destination is the anchor, deliberately — see the gate's comment in zones.ts.
    ok(g.toZone === 'rune-hold' && g.toX === LANDING_ARRIVAL.x && g.toY === LANDING_ARRIVAL.y,
       'the degraded return steps you back out beside the door, never somewhere meaningless')
    ok(arrivalBlockedBy(g.toX, g.toY) === null,
       'and that fallback tile is itself not a gate — the degraded case cannot bounce')
  }
}

console.log(fails.length
  ? `❌ landing: ${fails.length} failed (${pass} passed)\n  - ${fails.join('\n  - ')}`
  : `✅ the landing is where the map says it is — ${pass} passed`)
if (fails.length) process.exit(1)
