// The submerged pick — the WIRING. Run: npx tsx src/app/shimmer/voxel3d/dive-pick.test.ts
//
// 2026-09-15: the still needs glass, glass needs sand, and every grain of sand within 200 blocks
// of the glade is a lake bed under water (measured: 2083 wet samples, 0 dry). The mining ray
// returns the first non-air voxel, which from an eye inside the lake is the water at distance 0,
// so a diver could aim at the bed forever and hit nothing. The fix is one rule at the pick site in
// `VoxelWorld.tsx`: when the EYE voxel is water, the ray reads water as air.
//
// Two things this file guards, and the pure `raycast` cannot see either:
//   · the rule keys off the EYE voxel, not `lc.swimming` — a surface swimmer's eye is in air and
//     must still aim AT the water, because that is the rinstick's cast (`aimed === MAT.WATER`);
//   · the wrapped lookup is what the pick call actually receives. A `pickVoxel` defined beside a
//     `raycast(..., voxel)` is a fix that compiles and does nothing.
// Plus the pure half: the ray really does pass through water once the lookup says so.
import { readFileSync } from 'node:fs'
import { codeOnly } from '../testing/guard'
import { raycast } from '../voxel/mine'
import { AIR } from '../voxel/section'
import { MAT } from '../voxel/depth'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const raw = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
const src = codeOnly(raw)
const once = (needle: string, what: string) => {
  const got = src.split(needle).length - 1
  ok(got === 1, `${what}: expected 1x "${needle}", found ${got}`)
}

// ── 0. the reader can see its subject ────────────────────────────────────────────────────────
ok(raw.length > 10_000, `VoxelWorld.tsx read (${raw.length} bytes)`)

// ── 1. the wiring ────────────────────────────────────────────────────────────────────────────
once('const eyeInWater = voxel(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) === MAT.WATER', 'the rule reads the EYE voxel')
// ⚠ THE BINDING IS `rawHit`, NOT `hit`, SINCE 2026-09-23 — and the rename is load-bearing rather
// than cosmetic. A tall station's rack redirects `hit` one cell DOWN so a swing at the mill's upper
// half breaks the mill (`station-tall.test.ts` §7), so `hit` is no longer the cell the ray entered.
// This assert is about the PICK — that the ray is cast through the water-aware lookup — so it must
// follow the raw binding. Asserting on `hit` here would have gone quietly green against a value
// that is no longer the raycast's own answer.
// (09-23: the result is named `aimed` now — cluster mode gates it into `rawHit`; the CALL is what this guards.)
once('= raycast(p.x, p.y, p.z, aim.x, aim.y, aim.z, REACH, pickVoxel)', 'the pick receives the wrapped lookup')
ok(!src.includes('raycast(p.x, p.y, p.z, aim.x, aim.y, aim.z, REACH, voxel)'), 'and no unwrapped pick call stands beside it')
ok(!/eyeInWater\s*=\s*lc\.swimming/.test(src), 'the rule is not lc.swimming (chest-in): a surface swimmer still aims at water')
ok(src.includes("aimed === MAT.WATER") || readFileSync(new URL('./interact.ts', import.meta.url), 'utf8').includes('aimed === MAT.WATER'), 'the rinstick cast still keys off an aimed WATER voxel')

// ── 2. the pure half: water reads as air → the ray reaches the bed ──────────────────────────
{
  // A column: air above y=10, water 5..9, sand at 4, subsoil below.
  const world = (_x: number, y: number, _z: number) => y >= 10 ? AIR : y >= 5 ? MAT.WATER : y === 4 ? MAT.SAND : MAT.SUBSOIL
  const through = (x: number, y: number, z: number) => { const m = world(x, y, z); return m === MAT.WATER ? AIR : m }
  // Eye inside the water at y=7, aiming straight down.
  const shore = raycast(0.5, 7.5, 0.5, 0, -1, 0, 6, world)
  ok(shore?.material === MAT.WATER && shore.distance === 0, 'unwrapped: an eye in water aims at the water itself, at distance 0')
  const dive = raycast(0.5, 7.5, 0.5, 0, -1, 0, 6, through)
  ok(dive?.material === MAT.SAND && dive.y === 4, `wrapped: the same ray reaches the sand at y=4 (got ${dive?.material} at y=${dive?.y})`)
  ok(dive?.py === 5, 'and the "empty" voxel before it is the lowest water cell, where a placed block would go')
  // From the shore (eye in air at y=12) the unwrapped ray meets the surface, as the rinstick needs.
  const cast = raycast(0.5, 12.5, 0.5, 0, -1, 0, 6, world)
  ok(cast?.material === MAT.WATER && cast.y === 9, 'from the air the ray still stops at the water surface')
}

console.log(`dive-pick: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
