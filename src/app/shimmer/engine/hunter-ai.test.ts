// Hunter-AI oracle — the range's brain, once it has to serve 60 bots instead of one.
// Run: npx tsx src/app/shimmer/engine/hunter-ai.test.ts
//
// This behaviour was tuned by feel in a private range where nothing it did had to agree with
// anything else. The moment it drives Crucible bots, two new classes of failure appear and neither
// is visible in play:
//   - DIVERGENCE. Sixty bots rebuilt from a seed must fight identically on every client. A single
//     un-seeded draw and two players watch different matches while both look correct.
//   - SILENT STATUS. System 3 removes an OPTION, never HP. A rooted hunter that still drifts, or a
//     disarmed one that still fires, makes the cast that applied it look like it did nothing —
//     which reads to a player as "the move is broken", the exact failure `cast.ts`'s honesty rule
//     was written to prevent.
// So determinism and the status gates are asserted first and hardest.

import {
  createHunter, stepHunter, hunterRng, RANGE_HUNTER,
  type HunterState, type HunterCtx,
} from './hunter-ai'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const OPEN = () => false                       // nothing is solid
const SOLID = () => true                       // everything is solid
const ctx = (over: Partial<HunterCtx> = {}): HunterCtx => ({
  targetX: 0, targetZ: 0, blocked: OPEN, rng: hunterRng(1, 0),
  fallbackX: 99, fallbackZ: 99, ...over,
})
/** a hunter already alive and standing `d` tiles out on +x */
const alive = (d: number): HunterState => ({
  x: d, z: 0, hp: RANGE_HUNTER.hp, alive: true, respawn: 0, fireCd: 99, strafe: 0,
})
const DT = 1 / 60

// ── ★ DETERMINISM — the one that would have broken the Crucible ───────────────────────────────
{
  const run = () => {
    const h = createHunter(); h.alive = false; h.respawn = 0
    const c = ctx({ rng: hunterRng(42, 7) })
    const trace: number[] = []
    for (let i = 0; i < 200; i++) {
      const it = stepHunter(h, c, DT)
      trace.push(h.x, h.z, h.strafe, it.fire ? 1 : 0)
    }
    return trace
  }
  const a = run(), b = run()
  ok(a.length === b.length && a.every((v, i) => v === b[i]),
     '★ same seed ⇒ byte-identical 200-tick trace (60 bots must fight the same fight on every client)')

  const other = (() => {
    const h = createHunter(); h.alive = false; h.respawn = 0
    const c = ctx({ rng: hunterRng(42, 8) })   // same seed, different roster index
    const t: number[] = []
    for (let i = 0; i < 200; i++) { stepHunter(h, c, DT); t.push(h.x, h.z) }
    return t
  })()
  ok(other.some((v, i) => v !== a[Math.floor(i / 2) * 4 + (i % 2)]),
     'two bots off the same seed do NOT share a walk — index is part of the stream')
}

// ── the spawn ────────────────────────────────────────────────────────────────────────────────
{
  const h = createHunter(); h.alive = false; h.respawn = 0.5
  const c = ctx()
  ok(stepHunter(h, c, 0.2).spawnedAt === null, 'it stays down while the respawn clock runs')
  ok(!h.alive, 'and is still not alive')
  const it = stepHunter(h, c, 0.5)
  ok(it.spawnedAt !== null && h.alive, 'it comes back when the clock expires')
  const d = Math.hypot(h.x, h.z)
  ok(d >= RANGE_HUNTER.spawnMin - 1e-6 && d <= RANGE_HUNTER.spawnMin + RANGE_HUNTER.spawnSpan + 1e-6,
     'it spawns on the ring, never on top of you')
  ok(h.fireCd === RANGE_HUNTER.firstShotCd, 'the first shot is slower than the cadence')
  ok(RANGE_HUNTER.firstShotCd < RANGE_HUNTER.fireCd, 'fixture: and that IS slower, not a coincidence')
}
{
  // ★ A bot spawned inside geometry is invisible and unkillable — that reads as the match being
  // broken, not as one bad spawn.
  const h = createHunter(); h.alive = false; h.respawn = 0
  const it = stepHunter(h, ctx({ blocked: SOLID, fallbackX: 5, fallbackZ: -5 }), DT)
  ok(it.spawnedAt?.x === 5 && it.spawnedAt?.z === -5, '★ a spawn landing in something solid tucks at the fallback')
  ok(h.x === 5 && h.z === -5, 'and the state agrees with the intent it reported')
}

// ── closing vs orbiting ──────────────────────────────────────────────────────────────────────
{
  const h = alive(30)
  const before = Math.hypot(h.x, h.z)
  for (let i = 0; i < 60; i++) stepHunter(h, ctx(), DT)
  ok(Math.hypot(h.x, h.z) < before, 'far away, it closes')
}
{
  const h = alive(4)                     // already well inside closeRange
  const before = Math.hypot(h.x, h.z)
  for (let i = 0; i < 60; i++) stepHunter(h, ctx(), DT)
  const after = Math.hypot(h.x, h.z)
  ok(Math.abs(after - before) < 1.0, 'inside close range it holds its distance rather than walking into you')
}
{
  // ★ The orbit is the whole reason it does not read as a turret. Assert it MOVES while holding
  // range — a mutation that deletes the strafe leaves distance perfect and the fight lifeless.
  const h = alive(4)
  const x0 = h.x, z0 = h.z
  let moved = 0
  for (let i = 0; i < 120; i++) { stepHunter(h, ctx(), DT); moved = Math.max(moved, Math.hypot(h.x - x0, h.z - z0)) }
  ok(moved > 0.3, '★ it orbits while holding range — a static hunter is a turret')
}

// ── ★ System 3: a status removes an OPTION, never HP ─────────────────────────────────────────
{
  const h = alive(30)
  const x0 = h.x, z0 = h.z, hp0 = h.hp
  for (let i = 0; i < 60; i++) stepHunter(h, ctx({ rooted: true }), DT)
  ok(h.x === x0 && h.z === z0, '★ rooted: it cannot step')
  ok(h.hp === hp0, 'and rooted costs it no HP — a status is never damage')
}
{
  const h = alive(6); h.fireCd = 0
  let fired = false
  for (let i = 0; i < 60; i++) if (stepHunter(h, ctx({ disarmed: true }), DT).fire) fired = true
  ok(!fired, '★ disarmed: it cannot fire')
  const h2 = alive(6); h2.fireCd = 0
  let fired2 = false
  for (let i = 0; i < 60; i++) if (stepHunter(h2, ctx(), DT).fire) fired2 = true
  ok(fired2, 'and undisarmed it does — so the gate above is the status, not a dead path')
}

// ── walls ────────────────────────────────────────────────────────────────────────────────────
{
  const h = alive(30)
  const x0 = h.x, z0 = h.z
  let reportedAMove = false
  for (let i = 0; i < 60; i++) {
    if (stepHunter(h, ctx({ blocked: SOLID }), DT).moveTo !== null) reportedAMove = true
  }
  ok(h.x === x0 && h.z === z0, 'it cannot walk into something solid')
  // The intent and the state have to agree. A step that is refused but still REPORTED would have
  // the host draw it one place while it stands in another — the desync in miniature.
  ok(!reportedAMove, '★ and a refused step is never reported as a move')
}

// ── the fire cadence ─────────────────────────────────────────────────────────────────────────
{
  const h = alive(6); h.fireCd = 0
  let shots = 0
  const secs = 11
  for (let i = 0; i < secs * 60; i++) if (stepHunter(h, ctx(), DT).fire) shots++
  const expected = Math.floor(secs / RANGE_HUNTER.fireCd)
  ok(Math.abs(shots - expected) <= 1, `it fires on cadence (${shots} shots in ${secs}s, expected ~${expected})`)
}

// ── the tuning is the range's, unchanged — this extraction must not move the feel ────────────
{
  ok(RANGE_HUNTER.speed === 3.2 && RANGE_HUNTER.fireCd === 2.2 && RANGE_HUNTER.closeRange === 9.5,
     '★ the extracted tuning still matches the numbers Alex tuned in the range')
  ok(RANGE_HUNTER.hp === 35 && RANGE_HUNTER.orbitMult === 0.6 && RANGE_HUNTER.orbitRate === 0.9,
     'and so do the rest')
}

console.log(`\nhunter-ai: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
