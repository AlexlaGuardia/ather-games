// smoke — the GPU half's CPU logic, run headless (BufferGeometry/ShaderMaterial need no context).
// What can be held without a GPU: the per-stack budget, the priming of parked slots, the sleep
// with no sources, and that every live puff is born at a source's TOP, never at the block.

import { createSmoke, COUNT, PER_STACK, RISE } from './smoke'
import type { SmokeSource } from './smoke-sources'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const yOf = (sm: ReturnType<typeof createSmoke>, i: number) =>
  (sm.points.geometry.getAttribute('position') as { array: ArrayLike<number> }).array[i * 3 + 1]
const tOf = (sm: ReturnType<typeof createSmoke>, i: number) =>
  (sm.points.geometry.getAttribute('aT') as { array: ArrayLike<number> }).array[i]
const live = (sm: ReturnType<typeof createSmoke>) => { let n = 0; for (let i = 0; i < COUNT; i++) if (yOf(sm, i) !== -1000) n++; return n }

// ── sleeps with no sources ────────────────────────────────────────────────────────────────────
{
  const sm = createSmoke(7)
  sm.tick(1 / 60, 0, [])
  ok(!sm.points.visible, 'no sources → the pass is hidden')
  ok(live(sm) === 0, 'and nothing was spawned')
  sm.dispose()
}

// ── the per-stack budget, and priming ────────────────────────────────────────────────────────
{
  const sm = createSmoke(7)
  const one: SmokeSource[] = [{ x: 10, y: 5, z: 20, top: 12 }]
  sm.tick(1 / 60, 0, one)
  ok(sm.points.visible, 'one source → visible')
  ok(live(sm) === PER_STACK, `one stack holds PER_STACK puffs (${live(sm)}, want ${PER_STACK})`)
  // Primed: the first tick spreads the puffs along the column, not all at the cap.
  let atCap = 0, aloft = 0, above = 0, tmin = 1, tmax = 0
  for (let i = 0; i < PER_STACK; i++) {
    const y = yOf(sm, i), t = tOf(sm, i)
    if (y < 12.1 - 1e-6) above++              // below the flue top = born on the block: wrong
    if (y < 12.1 + 0.05) atCap++; else aloft++
    tmin = Math.min(tmin, t); tmax = Math.max(tmax, t)
  }
  ok(above === 0, 'every puff is at or above the source TOP — never on the block')
  ok(aloft >= PER_STACK / 2, `the first tick PRIMES the column — most puffs are already aloft (${aloft}/${PER_STACK})`)
  ok(tmax - tmin > 0.5, `…at spread-out life fractions (${tmin.toFixed(2)}–${tmax.toFixed(2)})`)
  ok(yOf(sm, 0) <= 12.1 + RISE + 1e-6 && yOf(sm, PER_STACK - 1) <= 12.1 + RISE + 1e-6, 'and no higher than a full life would carry it')

  // Two stacks → twice the puffs; sixteen → the ceiling.
  const two = [...one, { x: 30, y: 5, z: 40, top: 9 }]
  sm.tick(1 / 60, 0.1, two)
  ok(live(sm) === PER_STACK * 2, `two stacks → ${PER_STACK * 2} puffs (${live(sm)})`)
  const many: SmokeSource[] = Array.from({ length: 40 }, (_, i) => ({ x: i, y: 1, z: 0, top: 2 }))
  sm.tick(1 / 60, 0.2, many)
  ok(live(sm) === COUNT, `forty stacks → the ceiling, ${COUNT} (${live(sm)})`)
  // Back to one: the surplus is parked again, not left drifting from stacks no longer in range.
  sm.tick(1 / 60, 0.3, one)
  ok(live(sm) === PER_STACK, `back to one stack → surplus parked (${live(sm)})`)

  // A puff that dies is reborn at the cap (t = 0), not primed — steady state.
  let reborn = 0
  for (let k = 0; k < 60 * 8; k++) sm.tick(1 / 60, 1 + k / 60, one)
  for (let i = 0; i < PER_STACK; i++) if (tOf(sm, i) < 0.05 && yOf(sm, i) < 12.1 + 0.3) reborn++
  ok(reborn >= 1, `after 8s some puff has just been reborn at the cap (${reborn})`)
  sm.dispose()
}

console.log(`smoke: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
