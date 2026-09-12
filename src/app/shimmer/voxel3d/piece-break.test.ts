// ── A PIECE BREAKS LIKE ITS BLOCK, NOT LIKE A BUTTON (2026-09-12) ─────────────────────────────
// Run: npx tsx src/app/shimmer/voxel3d/piece-break.test.ts
//
// Alex: "the pieces just break instantly if left clicked.. can we bring them up to speed with the
// other blocks." A placed piece is now worked through the same `tickBreak` as a block, against the
// block it is paid in. Two things must hold for that to be a feature and not a trap:
//   1. Every shipped piece is TAKEABLE with the basic kit (worn spike/blade = tier 1). A piece whose
//      block asked for tier 2 would be a wall the keeper can place and never remove.
//   2. The target is the PLACEMENT ORIGIN, so one wall is one bar — striking a different cell of the
//      same piece must not restart the swing.
// Plus a source guard: the host must route the piece hit through `tickBreak` and reach `deconstruct`
// only on `broken`, and the block path must step aside for a piece hit.
import { ALL_PIECES, type Placement } from '../voxel/pieces'
import { breakSeconds, blockDef } from '../voxel/registry'
import { pieceBreakTarget } from './piece-mesh'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, msg: string) => { if (c) pass++; else fails.push(msg) }

const BASIC_TIER = 1

// 1. finite seconds, > 0, for every piece (base shapes and every material variant)
for (const def of ALL_PIECES) {
  const placed: Placement = { pieceId: def.id, x: 3, y: 4, z: 5, rot: 0 }
  const t = pieceBreakTarget(placed)
  ok(!!t, `${def.id}: has a break target`)
  if (!t) continue
  const b = blockDef(t.material)
  ok(!!b, `${def.id}: its block has a definition`)
  if (!b) continue
  const skill = b.skill ?? b.fastSkill ?? null
  const secs = breakSeconds(t.material, BASIC_TIER, skill)
  ok(Number.isFinite(secs), `${def.id}: the basic kit is not refused (${b.name})`)
  ok(secs > 0, `${def.id}: does not break on the first frame`)
}

// 2. origin, not struck cell
{
  const placed: Placement = { pieceId: ALL_PIECES[0].id, x: -7, y: 12, z: 9, rot: 1 }
  const t = pieceBreakTarget(placed)!
  ok(t.x === -7 && t.y === 12 && t.z === 9, 'target is the placement origin')
}

// 3. the host
{
  const host = codeOnly(readFileSync(join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx'), 'utf8'))
  ok(host.includes('const target = pieceBreakTarget(found)'), '★ the piece hit is worked through pieceBreakTarget')
  ok(host.includes('tickBreak(breaking.current, target ?? null'), '★ …and through tickBreak, same as a block')
  ok(/if \(r\.broken\) \{[^}]*deconstruct\(found\)/.test(host), '★ deconstruct happens on broken, never on the click')
  ok(!host.includes('{ deconstruct(found); mouse.current.left = false }'), '★ the instant-break line is gone')
  ok(host.includes('if (hit && !pieceLook && mouse.current.left && !weaponDrawn) {'), '★ the block path steps aside for a piece hit')
}

console.log(`\npiece-break: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
process.exit(fails.length ? 1 : 0)
