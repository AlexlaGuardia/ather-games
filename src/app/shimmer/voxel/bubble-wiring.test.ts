// The fold as the WORLD actually generates it. Run: npx tsx src/app/shimmer/voxel/bubble-wiring.test.ts
//
// ★ WHY THIS IS A SECOND FILE AND NOT MORE OF `bubble.test.ts`. That one proves the GEOMETRY: given
// a config, the shell is closed, the flood cannot escape, the door is where the bearing says. Every
// assert in it passed on 2026-08-15 while the bubble did not exist in the world at all — nothing
// imported `bubbleMaterialAt`, so the shell was a function nobody called and the crossing trigger
// fired in open countryside with no wall in sight.
//
// So the geometry oracle could not have caught it, and neither could a bigger version of itself:
// the bug was in the WIRING, which is the one thing a pure-core test is defined not to see. This
// file asserts against `generateColumn` — the real generator, all seven stages — and against
// `generatedVoxel`, the save's baseline. Both of those are what a player meets.

import { generateColumn, generatedVoxel, WILDS_BUBBLE, SECTION, Column, DEFAULT_COLUMN } from './column'
import { inShell, insideShell, inPassage, inPassageVolume, distFromAxis, shellRadiusAt } from './bubble'
import { columnHeight } from './height'
import { MAT } from './depth'
import { AIR } from './section'
import { ZONE_ANCHORS } from './zones'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const cfg = WILDS_BUBBLE
const GLADE = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!

/** One generated column, all stages, exactly as the worker builds it. */
const gen = (wx: number, wz: number) => generateColumn(new Column(wx, wz, DEFAULT_COLUMN), SEED)
const at = (col: Column, wx: number, y: number, wz: number) => {
  const lx = wx - col.wx, lz = wz - col.wz
  const s = (y / SECTION) | 0
  return col.sections[s].get(lx, y - s * SECTION, lz)
}
/** Snap a world coord down to its column origin. */
const colOrigin = (v: number) => Math.floor(v / SECTION) * SECTION
/** A point on the shell at a given bearing. */
const onShell = (bearing: number) => {
  const r = cfg.radius
  return { x: Math.round(cfg.cx + Math.cos(bearing) * r), z: Math.round(cfg.cz + Math.sin(bearing) * r) }
}

// ── 1. THE DOOR IS WHERE THE PLAYER IS ──────────────────────────────────────────────────────────
{
  // ★ THE BUG THIS FILE EXISTS FOR, HALF ONE. `bubble.ts` ships `passageBearing: 0` and says in its
  // own header that the build must aim it — "a single opening in a 6.3km circumference is
  // undiscoverable by exploration". Nothing aimed it, so the fold's only entrance sat on the far
  // side of the shell from every place a player has ever stood.
  const want = Math.atan2(GLADE.z - cfg.cz, GLADE.x - cfg.cx)
  ok(Math.abs(cfg.passageBearing - want) < 1e-9, '★ the passage is aimed at the glade, not at bearing 0')

  // The walk, in blocks, from where the keeper wakes up to the door.
  const door = onShell(cfg.passageBearing)
  const walk = Math.hypot(door.x - GLADE.x, door.z - GLADE.z)
  ok(walk < 250, `★ the door is a short walk from spawn (${Math.round(walk)} blocks)`)
  ok(inPassage(door.x, door.z, cfg), 'and the point at that bearing really is the doorway')

  // ⚠ The far side must NOT be a door — a shell with two openings is a shell with a hole in it.
  const far = onShell(cfg.passageBearing + Math.PI)
  ok(!inPassage(far.x, far.z, cfg), '★ and the opposite bearing is plain wall')
  ok(!inPassage(cfg.cx + cfg.radius, cfg.cz, cfg), 'bearing 0 — the old default — is now plain wall too')
}

// ── 2. THE SHELL PHYSICALLY EXISTS IN A GENERATED COLUMN ────────────────────────────────────────
{
  // ★ THE BUG THIS FILE EXISTS FOR, HALF TWO. Before the wiring this column generated ordinary
  // hills: `bubbleMaterialAt` was imported by nobody.
  const p = onShell(cfg.passageBearing + 0.35)          // on the wall, well away from the door
  const col = gen(colOrigin(p.x), colOrigin(p.z))
  const h = columnHeight(p.x, p.z, SEED)

  let wall = 0
  for (let y = cfg.bottomY; y <= cfg.topY; y++) if (at(col, p.x, y, p.z) === MAT.CLOUD_WALL) wall++
  ok(wall > 100, `★ the wall is really there in the generated world (${wall} cloud-wall voxels in the column)`)
  ok(at(col, p.x, h + 5, p.z) === MAT.CLOUD_WALL, 'and it stands above the ground, not just under it')

  // ★ IT IS CLOUD, NOT THE PLACEHOLDER. `DEFAULT_BUBBLE.materials.wall` is 1 — reading the default
  // instead of the live config would build the fold out of whatever material 1 happens to be, which
  // would look like a stone ring and read as terrain.
  ok(cfg.materials.wall === MAT.CLOUD_WALL, '★ built of cloud-wall, not the placeholder material')
}

// ── 3. THE SAVE BASELINE AGREES WITH THE WORLD ──────────────────────────────────────────────────
{
  // ★★ THE TRAP THE PLOT LANE CAUGHT AT 79.3% OF A COLUMN, ONE SPACE OVER. `recordEdit` stores an
  // edit only when the new material differs from what `generatedVoxel` says was generated. Wire the
  // shell into the terrain stage alone and every wall voxel disagrees with the baseline, so the
  // first touch anywhere near the fold writes thousands of phantom edits — and the shell's shape
  // freezes behind a save asserting the old shape was deliberate.
  const p = onShell(cfg.passageBearing + 0.9)
  const col = gen(colOrigin(p.x), colOrigin(p.z))
  let checked = 0, disagreed = 0
  for (let lz = 0; lz < SECTION; lz++) {
    for (let lx = 0; lx < SECTION; lx++) {
      for (let y = 0; y < DEFAULT_COLUMN.worldHeight; y += 3) {
        checked++
        if (generatedVoxel(col, lx, y, lz, SEED) !== at(col, col.wx + lx, y, col.wz + lz)) disagreed++
      }
    }
  }
  ok(disagreed === 0, `★★ the save's baseline matches the generated world on the shell (${disagreed}/${checked} disagreed)`)
}

// ── 4. NO STAGE PUNCHES THROUGH — the carver is the one that matters ────────────────────────────
{
  // ★ A CAVE THROUGH THE CLOUD-WALL IS A HOLE, AND A HOLE IS A GATE. Canon names that silhouette as
  // the misreading, and behind it is 500 blocks of ungenerated nothing — the interior is never
  // built, so a breach is a keeper walking into the void. `bubble.test.ts` proves the GEOMETRY has
  // no gap; it runs before carvers, ore, trees and ruins exist and cannot speak for them.
  //
  // Walk a ring of columns around the shell and assert every cell the bubble claims still holds
  // what the bubble said, in the FINISHED column.
  let cells = 0, breached = 0, littered = 0
  for (let k = 0; k < 24; k++) {
    const b = cfg.passageBearing + (k / 24) * Math.PI * 2
    const p = onShell(b)
    const col = gen(colOrigin(p.x), colOrigin(p.z))
    for (let lz = 0; lz < SECTION; lz++) {
      for (let lx = 0; lx < SECTION; lx++) {
        const wx = col.wx + lx, wz = col.wz + lz
        const shell = inShell(wx, wz, SEED, cfg)
        const inside = insideShell(wx, wz, SEED, cfg)
        if (!shell && !inside) continue
        for (let y = cfg.bottomY; y <= cfg.topY; y += 2) {
          cells++
          const m = at(col, wx, y, wz)
          if (shell && m !== MAT.CLOUD_WALL) breached++
          if (inside && m !== AIR) littered++
        }
      }
    }
  }
  ok(cells > 5000, `enough of the ring was sampled to mean something (${cells} cells)`)
  ok(breached === 0, `★★ no stage breaches the shell — no cave, no ruin, no ore (${breached} holes)`)
  ok(littered === 0, `★ and nothing is left standing inside the fold (${littered} strays)`)
}

// ── 5. THE CROSSING FIRES AT THE DOOR, AND ONLY THERE ───────────────────────────────────────────
{
  // The trigger and the doorway must be the same place. They are computed from one config now; this
  // asserts that they agree in world coordinates, which is the thing a player actually experiences.
  const door = onShell(cfg.passageBearing)
  const h = columnHeight(door.x, door.z, SEED)
  const d = distFromAxis(door.x, door.z, cfg)
  const r = shellRadiusAt(door.x, door.z, SEED, cfg)
  ok(Math.abs(d - r) <= cfg.thickness + 1, 'the sampled door point really sits at the wall')
  ok(inPassageVolume(door.x, h + 1, door.z, SEED, h, cfg), '★ standing in the doorway fires the crossing')
  ok(!inPassageVolume(door.x, h + cfg.passageHeight + 2, door.z, SEED, h, cfg),
     'but not from above its head — the seam is a volume, not a column of sky')

  const far = onShell(cfg.passageBearing + Math.PI)
  const fh = columnHeight(far.x, far.z, SEED)
  ok(!inPassageVolume(far.x, fh + 1, far.z, SEED, fh, cfg), '★ and never at the far side of the shell')

  // ⚠ A keeper walking past on their own business must not be grabbed.
  const out = onShell(cfg.passageBearing)
  const ox = Math.round(out.x + Math.cos(cfg.passageBearing) * 12)
  const oz = Math.round(out.z + Math.sin(cfg.passageBearing) * 12)
  const oh = columnHeight(ox, oz, SEED)
  ok(!inPassageVolume(ox, oh + 1, oz, SEED, oh, cfg), 'nor twelve blocks outside the wall')
}

// ── 6. THE REST OF THE WORLD IS UNTOUCHED ───────────────────────────────────────────────────────
{
  // ★ The bubble must be invisible everywhere it is not. `bubbleMaterialAt` returns null outside its
  // own footprint precisely so the Wilds' generator keeps answering — a module that returned AIR
  // "helpfully" would punch its own shape into terrain a thousand blocks away.
  for (const z of ZONE_ANCHORS.filter(a => a.id !== 'garden')) {
    const col = gen(colOrigin(z.x), colOrigin(z.z))
    const h = columnHeight(z.x, z.z, SEED)
    let cloud = 0
    for (let y = 0; y < DEFAULT_COLUMN.worldHeight; y++) if (at(col, z.x, y, z.z) === MAT.CLOUD_WALL) cloud++
    ok(cloud === 0, `${z.id} has no cloud-wall in it`)
    ok(at(col, z.x, h, z.z) !== AIR, `${z.id} still has ground under the keeper`)
  }
}

console.log(`\nbubble wiring: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
