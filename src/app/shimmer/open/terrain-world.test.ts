// Terrain world oracle. Run: npx tsx src/app/shimmer/open/terrain-world.test.ts
//
// The voxel feel oracle already runs against these queries (`LOCO_WORLD=terrain` on
// voxel3d/locomotion.test.ts) — but its worlds are cells, so they never touch the LAND. This file
// is the land: slopes you walk, slopes that stop you, a rock you vault, a cliff you climb, a pond.

import { createLoco, tickLocomotion, RUN_SPEED, type LocoInput } from '../voxel3d/locomotion'
import { terrainWorld, MAX_WALK_GRADIENT, type Box, type Shape } from './terrain-world'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const DT = 1 / 60
const input = (o: Partial<LocoInput> = {}): LocoInput => ({
  mvX: 0, mvZ: 0, fwdX: 1, fwdZ: 0, rightX: 0, rightZ: 1,
  jumpKey: false, crouchKey: false, dt: DT, ...o,
})
const shape = (ground: (x: number, z: number) => number, solids: Box[] = [], water: Box[] = []): Shape =>
  ({ ground, solids: () => solids, water: () => water })
const run = (w: ReturnType<typeof terrainWorld>, s: ReturnType<typeof createLoco>, frames: number, o: Partial<LocoInput> = {}) => {
  let air = 0
  for (let i = 0; i < frames; i++) { tickLocomotion(s, input(o), w); if (s.airborne) air++ }
  return air
}

// ── flat land: you stand on it and the sprint ramp still earns its top ───────────────────────────
{
  const w = terrainWorld(shape(() => 5))
  const s = createLoco(0, 7, 0)
  run(w, s, 90)
  ok(Math.abs(s.py - 5) < 1e-6 && !s.airborne, `falls onto flat land and stands (feet ${s.py.toFixed(3)})`)
  run(w, s, 150, { mvX: 1 })
  ok(Math.abs(s.hvx - RUN_SPEED) < 0.05, `the ramp tops out at RUN_SPEED on land (${s.hvx.toFixed(2)})`)
}

// ── a gentle hill (20°): up and down it without leaving the ground ──────────────────────────────
{
  const k = Math.tan(20 * Math.PI / 180)
  const w = terrainWorld(shape((x) => 5 + Math.max(0, x) * k))
  const s = createLoco(-3, 5, 0)
  run(w, s, 10)
  const air = run(w, s, 180, { mvX: 1 })
  ok(s.px > 8 && s.py > 5 + (s.px - 0.5) * k - 0.05, `walks up a 20° hill (x ${s.px.toFixed(1)}, feet ${s.py.toFixed(2)})`)
  ok(air <= 2, `uphill stays grounded (${air} airborne frames)`)
  const air2 = run(w, s, 120, { mvX: -1, fwdX: -1 })
  ok(air2 <= 3, `★ downhill stays grounded — no stair-step hopping (${air2} airborne frames)`)
}

// ── a steep bank (60°): it is a wall, not a hill ────────────────────────────────────────────────
{
  const k = Math.tan(60 * Math.PI / 180)
  ok(k > MAX_WALK_GRADIENT, 'the test bank really is past the walk limit')
  const w = terrainWorld(shape((x) => 5 + Math.max(0, x) * k))
  const s = createLoco(-3, 5, 0)
  run(w, s, 10)
  run(w, s, 180, { mvX: 1 })
  ok(s.py < 5.6, `★ running at a 60° bank does not walk up it (feet ${s.py.toFixed(2)})`)
  ok(s.px < 0.1, `the bank stops the body at its foot (x ${s.px.toFixed(2)})`)
}

// ── a waist-high rock on land: jump into it = vault, not a ballistic hop ─────────────────────────
{
  const rock: Box = { x0: 2, y0: 4, z0: -2, x1: 4, y1: 6, z1: 2 }   // top 1.0 above the land at 5
  const w = terrainWorld(shape(() => 5, [rock]))
  const s = createLoco(0, 5, 0)
  run(w, s, 10)
  let vaulted = false
  for (let i = 0; i < 60; i++) {
    tickLocomotion(s, input({ mvX: 1, jumpKey: s.px > 1.3 }), w)
    if (s.vaulting) vaulted = true
  }
  ok(vaulted, '★ jumping at a 1m rock vaults it')
  ok(Math.abs(s.py - 6) < 0.05 || s.px > 4, `and the keeper ends up on (or over) it (x ${s.px.toFixed(2)}, feet ${s.py.toFixed(2)})`)
}

// ── a 3m cliff: hold into it + jump = climb, and the climb tops out onto the land above ─────────
{
  const w = terrainWorld(shape((x) => (x >= 3 ? 8 : 5)))
  const s = createLoco(2.0, 5, 0)
  run(w, s, 10)
  run(w, s, 40, { mvX: 1 })
  let climbed = 0
  for (let i = 0; i < 150; i++) { tickLocomotion(s, input({ mvX: 1, jumpKey: true }), w); if (s.climbing || s.hanging) climbed++ }
  ok(climbed > 0, '★ a 3m land cliff is climb country')
  ok(s.py >= 7.95, `★ the climb tops out onto the plateau (feet ${s.py.toFixed(2)})`)
}

// ── a pond: a water box over a dip in the land ──────────────────────────────────────────────────
{
  const pond: Box = { x0: -10, y0: 0, z0: -10, x1: 10, y1: 5, z1: 10 }
  const w = terrainWorld(shape(() => 1, [], [pond]))
  const s = createLoco(0, 6, 0)
  run(w, s, 120)
  ok(s.swimming, 'deep water swims')
  run(w, s, 120, { jumpKey: true })
  ok(s.py > 3.4, `Space swims up toward the surface (feet ${s.py.toFixed(2)})`)
}

console.log(`\nterrain-world: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the walker stands on land')
