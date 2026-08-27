/**
 * Moonwell Glade's tutorial arch — placement oracle.
 *
 * ★ WHY IT EXISTS: this file had no test, and the arch spent eight days inside the fold's hollow.
 * Its position was derived as 300 blocks from the glade toward the garden — correct on 2026-08-08,
 * and silently wrong from 08-15 when the fold was carved at the origin with radius 500. Nothing
 * noticed, because the derivation was anchored to the glade and had no opinion about the fold.
 *
 * ⚠ AND UNDER ALEX'S RULING OF 2026-08-23 THE ARCH IS THE TUTORIAL'S ONLY EXIT, so "buried" is a
 * soft-lock of the opening rather than a cosmetic drift. These asserts are load-bearing.
 *
 * Run: `npx tsx src/app/shimmer/voxel3d/gate.test.ts`
 */
import { GATE_X, GATE_Z, GATE_SPANS_X, gateCells } from './gate'
import { bubbleMaterialAt, bubbleCaveAt, maxBubbleReach, caveAnchor } from '../voxel/bubble'
import { WILDS_BUBBLE } from '../voxel/column'
import { columnHeight } from '../voxel/height'
import { ZONE_ANCHORS } from '../voxel/zones'

const SEEDS = [1, 7, 42, 555, 2026, 99, 314, 8675]
const GLADE = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

// ── 1. clear of the fold — the bug this file was written for ──────────────────────────────────
// ⚠ BOTH CHECKS, AND `h` IS SUPPLIED. The signature is (x, y, z, seed, h, cfg): skip `h` and the
// config slides into it while `cfg` silently defaults, so the measurement answers about a bubble
// whose door is somewhere else entirely. That mistake produced three confident wrong readings on
// 2026-08-23 and runs clean under tsx. The shell is not the only hazard either — the cave MOUND
// swells outward from it on this very bearing, so an arch clear of the shell can still be inside
// cloud.
for (const seed of SEEDS) {
  const baseY = columnHeight(GATE_X, GATE_Z, seed)
  const cells = gateCells(baseY)
  const inFold = cells.filter(c =>
    bubbleMaterialAt(c.x, c.y, c.z, seed, columnHeight(c.x, c.z, seed), WILDS_BUBBLE) !== null)
  const inMound = cells.filter(c =>
    bubbleCaveAt(c.x, c.y, c.z, seed, columnHeight(c.x, c.z, seed), WILDS_BUBBLE) !== null)
  ok(inFold.length === 0, `s${seed}: no arch cell is inside the fold (${inFold.length}/${cells.length})`)
  ok(inMound.length === 0, `s${seed}: no arch cell is inside the fold's mound (${inMound.length}/${cells.length})`)
}

// ── 2. BETWEEN the fold and the glade — the assert clearance alone cannot make ─────────────────
// ★★ THIS IS HERE BECAUSE "OUTSIDE THE FOLD" IS SATISFIED BY THE WHOLE REST OF THE WORLD. A sign
// slip in the unit vector put the arch at the correct RADIUS on the OPPOSITE side of the planet —
// 1076 blocks from the fold's door — and the clearance check above returned a perfect 0/20, because
// the far side of the world is indeed outside the fold. **A guard that can be satisfied by being
// anywhere is not a placement guard.** Only a distance to something known catches it.
{
  const r = Math.hypot(GATE_X, GATE_Z)
  ok(r > maxBubbleReach(WILDS_BUBBLE),
     `the arch stands beyond everything the fold occupies (r=${r.toFixed(0)} vs reach ${maxBubbleReach(WILDS_BUBBLE)})`)
  const gladeR = Math.hypot(GLADE.x, GLADE.z)
  ok(r < gladeR, `the arch is inland of the glade's heart (r=${r.toFixed(0)} vs glade ${gladeR.toFixed(0)})`)
  // On the glade's side of the world: the arch and the glade share a direction from the origin.
  const dot = (GATE_X * GLADE.x + GATE_Z * GLADE.z) / (r * gladeR)
  ok(dot > 0.99, `the arch lies on the glade's own bearing (cos=${dot.toFixed(4)})`)
  const fromGlade = Math.hypot(GATE_X - GLADE.x, GATE_Z - GLADE.z)
  ok(fromGlade < Math.max(GLADE.rx, GLADE.rz),
     `the arch is inside the glade the keeper wakes in (${fromGlade.toFixed(0)} blocks from its heart)`)
  for (const seed of SEEDS) {
    const d = caveAnchor(seed, WILDS_BUBBLE)
    const toDoor = Math.hypot(GATE_X - d.x, GATE_Z - d.z)
    ok(toDoor < 200, `s${seed}: the arch is a short walk from the fold's door (${toDoor.toFixed(0)} blocks)`)
  }
}

// ── 3. it stands on ground, and the frame is the shape the host expects ───────────────────────
for (const seed of SEEDS) {
  const baseY = columnHeight(GATE_X, GATE_Z, seed)
  ok(Number.isFinite(baseY) && baseY > 0, `s${seed}: the arch's column has a real ground height (${baseY})`)
  const cells = gateCells(baseY)
  ok(cells.length === 20, `s${seed}: 5 wide x 4 high = 20 cells (${cells.length})`)
  ok(cells.filter(c => c.doorway).length === 9, `s${seed}: a 3x3 doorway (${cells.filter(c => c.doorway).length})`)
  // ── ⚠⚠ THIS ASSERT WAS THE BURIAL, WRITTEN DOWN (corrected 2026-08-27) ──────────────────────
  // Its own section is headed *"it stands on ground"* and it read `c.y >= baseY` — where `baseY` is
  // `columnHeight`, the topmost SOLID block. So it required the first course to be IN the ground and
  // called that standing on it. It passed for as long as the bug existed, and it would have gone red
  // if anyone had fixed the bug without touching the test: **a guard that enforces the defect.**
  //
  // The keeper stands at `columnHeight + 1` (`plotStandY`, `plotThreshold`, and every spawn in the
  // sweep). So that is the floor, and it is asserted as the property rather than as an offset.
  const stand = baseY + 1
  ok(cells.every(c => c.y >= stand && c.y < stand + 4),
     `s${seed}: every cell sits in the 4-high band ABOVE the ground (${Math.min(...cells.map(c => c.y))}..${Math.max(...cells.map(c => c.y))}, ground ${baseY})`)
  ok(Math.min(...cells.map(c => c.y)) === stand,
     `s${seed}: the arch's first course rests ON the ground rather than one block inside it`)
  ok(cells.filter(c => c.doorway).every(c => c.y >= stand),
     `s${seed}: the whole opening is walkable — none of it is below standing height`)
  // the frame is one block thick on the axis it does not span
  const thin = GATE_SPANS_X ? new Set(cells.map(c => c.z)) : new Set(cells.map(c => c.x))
  ok(thin.size === 1, `s${seed}: the frame is one block thick across its facing`)
}

// ── 4. the derivation follows the fold, which is the whole repair ─────────────────────────────
// The old number could not notice the fold arriving. This one is measured FROM it, so a fold that
// grows or deepens its mound pushes the arch out rather than swallowing it.
{
  const wider = { ...WILDS_BUBBLE, radius: WILDS_BUBBLE.radius + 200 }
  ok(maxBubbleReach(wider) > maxBubbleReach(WILDS_BUBBLE),
     'a bigger fold reaches further, so the arch floor rises with it')
  const deeper = { ...WILDS_BUBBLE, cave: { ...WILDS_BUBBLE.cave!, depth: WILDS_BUBBLE.cave!.depth + 40 } }
  ok(maxBubbleReach(deeper) > maxBubbleReach(WILDS_BUBBLE),
     'a deeper mound reaches further too — the floor counts the mound, not just the shell')
}

console.log(`gate: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
