// smoke-sources — the pure half of chimney smoke, argued with directly.
//
// Three things are worth an oracle here, and each has a mutation that would pass a weaker one:
//   1. `flueTop` climbs THROUGH the stack and stops at the first open cell — not the block's top
//      (smoke into stone), not the summit above the limit (smoke from nowhere).
//   2. `columnSmokeSources` unpacks section.ts's (y, z, x) layout correctly — a transposed axis
//      still finds a hearth, at the wrong cell, and the smoke rises beside the chimney.
//   3. The uniform-table skip is REAL: a section the table calls all-air is never walked, so the
//      feature's honesty rests on the host refreshing that table (which smoke-wiring.test holds).

import { Column, SECTION, refreshUniform } from '../voxel/column'
import { AIR } from '../voxel/section'
import { MAT } from '../voxel/depth'
import { flueTop, columnSmokeSources, SMOKE_MATS, FLUE_MAX, type SmokeSource } from './smoke-sources'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. the flue ───────────────────────────────────────────────────────────────────────────────
{
  ok(flueTop(() => false, 10) === 11, 'open above → born on the block top (y0 + 1)')
  const stack = new Set([11, 12, 13, 14, 15])        // lintel, mantel, chimney ×3
  ok(flueTop(y => stack.has(y), 10) === 16, 'a five-high stack → born above its cap')
  const gapped = new Set([11, 12, 14])               // a hole at 13: the flue opens there
  ok(flueTop(y => gapped.has(y), 10) === 13, 'the first OPEN cell wins, not the highest solid')
  ok(flueTop(() => true, 10) === 11, `a stack past FLUE_MAX (${FLUE_MAX}) falls back to the block top, not the summit`)
  ok(flueTop(() => true, 10, 3) === 11, 'and the limit is the parameter, not a constant baked into the loop')
  const exact = new Set(Array.from({ length: FLUE_MAX - 1 }, (_, i) => 11 + i))
  ok(flueTop(y => exact.has(y), 10) === 10 + FLUE_MAX, 'a stack one under the limit still opens above its cap')
}

// ── 2. the column scan, on a real Column ──────────────────────────────────────────────────────
{
  const col = new Column(64, -128)                    // world corner, as makeColumn hands it
  // A hearth at local (3, 21, 9) under a lintel + chimney to y=27, a cut-stone floor under it.
  col.sections[1].set(3, 5, 9, MAT.HEARTH)            // y = 16 + 5 = 21
  for (let y = 22; y <= 27; y++) col.sections[(y / SECTION) | 0].set(3, y % SECTION, 9, MAT.STONE_BRICK)
  // An oven in the open at local (12, 40, 2) — section 2.
  col.sections[2].set(12, 8, 2, MAT.OVEN)             // y = 32 + 8 = 40
  // A decoy: cobble everywhere in section 0 (uniform, not a smoke mat → skipped).
  col.sections[0].data.fill(MAT.COBBLESTONE)
  refreshUniform(col)
  const voxelAt = (x: number, y: number, z: number) => {
    const lx = x - col.wx, lz = z - col.wz
    if (lx < 0 || lx >= SECTION || lz < 0 || lz >= SECTION || y < 0 || y >= col.sections.length * SECTION) return AIR
    return col.get(lx, y, lz)
  }
  const out: SmokeSource[] = []
  columnSmokeSources(col, voxelAt, out)
  ok(out.length === 2, `two sources found (${out.length})`)
  const hearth = out.find(s => s.y === 21), oven = out.find(s => s.y === 40)
  ok(!!hearth && hearth.x === 64 + 3 && hearth.z === -128 + 9, `the hearth is at its WORLD cell (${hearth?.x},${hearth?.y},${hearth?.z})`)
  ok(!!hearth && hearth.top === 28, `the hearth's smoke is born above the chimney cap (top ${hearth?.top}, want 28)`)
  ok(!!oven && oven.x === 64 + 12 && oven.z === -128 + 2, `the oven is at its world cell (${oven?.x},${oven?.y},${oven?.z})`)
  ok(!!oven && oven.top === 41, `the oven smokes from its own top (top ${oven?.top}, want 41)`)
  ok(out.every(s => SMOKE_MATS.has(col.get(s.x - col.wx, s.y, s.z - col.wz))), 'every reported cell really holds a smoke mat')

  // ── 3. the uniform skip is real ──────────────────────────────────────────────────────────
  // Stale table: the section still says "all air" while the data holds a hearth. The scan must
  // NOT find it — that is the skip doing its job, and the reason the host refreshes the table.
  col.sections[3].set(1, 1, 1, MAT.HEARTH)
  const stale: SmokeSource[] = []
  columnSmokeSources(col, voxelAt, stale)
  ok(stale.length === 2, `a hearth under a stale uniform entry is NOT found (${stale.length}) — the skip reads the table`)
  refreshUniform(col)
  const fresh: SmokeSource[] = []
  columnSmokeSources(col, voxelAt, fresh)
  ok(fresh.length === 3, `…and IS found once the table is refreshed (${fresh.length})`)

  // A uniform section that is ITSELF a smoke mat (absurd, but the table says so) is walked, not skipped.
  const solid = new Column(0, 0)
  solid.sections[0].data.fill(MAT.OVEN)
  refreshUniform(solid)
  const all: SmokeSource[] = []
  columnSmokeSources(solid, () => AIR, all)
  ok(all.length === SECTION * SECTION * SECTION, `a uniform smoke-mat section is walked, every cell (${all.length})`)
}

console.log(`smoke-sources: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
