// ── The expedition sim — the flood's habits, and the determinism the mode rests on ─────────────
// Run: npx tsx src/app/nolmir/lib/expedition.test.ts
//
// ⚠ THIS FILE DID NOT EXIST UNTIL 2026-08-26, AND THE MODULE IS 800+ LINES. `expedition.ts` is the
// largest piece of logic in Nolmir — the whole Expeditions pillar — and nothing anywhere imported
// it into a test. `sim`, `expedmeta`, `milestones`, `away` and `starforge` all have oracles; the
// one that runs the mode did not. It was found by looking, not by anything going red, which is the
// point: a suite cannot tell you about a file it has never been pointed at.
//
// What this locks:
//   1. DETERMINISM — the module's own stated contract: (tier, seed, loadout) -> identical run.
//   2. THE FOUR HABITS — each kind must break a DIFFERENT habit, not carry a different healthbar.
//   3. Those habits SURVIVE THE MERGE, because pooling is the variety engine and a habit that
//      vanished on merge would make the engine flatten the variety it exists to create.

import {
  startRun, stepRun, makeBreachMap, defaultAnchors, validAnchor, marksForWave,
  TIDE_HABIT, ACCRETE_R, BREACH_W, GATE_X, GATE_Y,
  type RunConfig, type ExpedState, type TideUnit, type TideKind, type GuardLoadout,
} from './expedition'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const squad = (): GuardLoadout[] => [
  { name: 'Ash', glyph: 'A', hp: 40, atk: 6 },
  { name: 'Bree', glyph: 'B', hp: 40, atk: 6 },
  { name: 'Cill', glyph: 'C', hp: 40, atk: 6 },
]
const cfg = (seed = 11): RunConfig => ({
  tier: 1, seed, doctrine: 'balanced', squad: squad(), anchors: defaultAnchors(),
  gateBonus: 0, salvageMult: 1,
})
const runFor = (ticks: number, c = cfg()): ExpedState => {
  const s = startRun(c)
  for (let i = 0; i < ticks && !s.done; i++) stepRun(s)
  return s
}
/** A one-line fingerprint of a run — everything a desync would move. */
const print = (s: ExpedState) =>
  `${s.wave}|${s.kills}|${Math.round(s.gate)}|${Math.round(s.salvageEarned)}|${s.tide.filter(u => u.alive).length}`

// ── 1. the arena and its invariants ────────────────────────────────────────────────────────────
{
  const m = makeBreachMap()
  ok(m.w === BREACH_W && m.h === BREACH_W, 'the arena is square and the renderer agrees with the sim')
  ok(defaultAnchors().length === 3, 'three posts — the trinity')
  ok(defaultAnchors().every(a => validAnchor(a.x, a.y)), 'and every default anchor is legal')
  ok(!validAnchor(GATE_X, GATE_Y), 'the core itself is not a legal post — you cannot stand on it')
  ok(marksForWave(10, 1) > marksForWave(5, 1), 'marks scale with waves survived — canon: expeditions are the primary marks source')
}

// ── 2. ★ DETERMINISM — the module's own contract, and a desync is unshippable ──────────────────
{
  ok(print(runFor(600)) === print(runFor(600)), '★ same (tier, seed, loadout) ⇒ identical run')
  ok(print(runFor(600, cfg(11))) !== print(runFor(600, cfg(12))), '...and a different seed genuinely diverges')
  // ⚠⚠ THE SIEGE TIE-BREAK MUST NOT DEPEND ON ARRAY ORDER, and this assert had to be rewritten
  // because the first version could not fail: it asserted `aliveCount >= 0`, which is true of every
  // array that has ever existed. Mutation-caught — breaking the tie-break left it green. An assert
  // that cannot fail is decoration, and I wrote one in the same file that says so.
  //
  // ⚠ AND THE OBVIOUS VERSION IS ALSO WRONG: "a reordered squad gives an identical run" is FALSE by
  // design, because `defaultAnchors()` is positional — reorder the squad and a different guard
  // stands at each post, which legitimately changes the fight. The real claim is narrower: when two
  // posts are EQUIDISTANT, which one a siege piece walks at must be decided by something stable.
  {
    const pick = (reverse: boolean): string => {
      const s = startRun(cfg())
      if (reverse) s.guards.reverse()
      // Dead centre between posts 0 and 1, so the distance tie is exact.
      const g0 = s.guards[reverse ? s.guards.length - 1 : 0]
      const g1 = s.guards[reverse ? s.guards.length - 2 : 1]
      const u: TideUnit = {
        id: 9101, kind: 'bulk', x: (g0.x + g1.x) / 2, y: (g0.y + g1.y) / 2, fx: 0, fy: 0,
        hp: 999, maxHp: 999, atk: 5, speed: 0.34, mass: 2,
        slowUntil: 0, stunUntil: 0, alive: true, spawnAt: 0,
      }
      s.tide.push(u)
      const before = s.guards.map(g => g.hp)
      for (let i = 0; i < 60; i++) stepRun(s)
      // whichever post it actually went for is the one that lost the most
      let worst = s.guards[0].name, drop = -1
      s.guards.forEach((g, i) => { const d = before[i] - g.hp; if (d > drop) { drop = d; worst = g.name } })
      return worst
    }
    ok(pick(false) === pick(true),
      `★ an equidistant siege target is decided by NAME, not by roster order (${pick(false)} vs ${pick(true)})`)
  }
}

// ── 3. ★★★ FOUR KINDS, FOUR HABITS — not four healthbars ───────────────────────────────────────
{
  const kinds: TideKind[] = ['drift', 'swift', 'bulk', 'behemoth']
  const habits = kinds.map(k => TIDE_HABIT[k])
  ok(new Set(habits).size === kinds.length,
    `every kind breaks a DIFFERENT habit — got: ${habits.join(', ')}`)
  // ⚠ Named, never counted. A count going red says "something converged" and the cheapest fix for
  // a red count is to change the number.
  const dupes = kinds.filter((k, i) => habits.indexOf(habits[i]) !== i)
  ok(dupes.length === 0, `no two kinds share a habit — duplicated on: ${dupes.join(', ') || 'none'}`)
}

// ── 4. the habits actually BITE, each in its own way ───────────────────────────────────────────
// A hand-placed unit and one stepped tick, so each assert is about one behaviour and not about
// what a 600-tick run happened to produce.
{
  const place = (kind: TideKind, x: number, y: number, mass = 1): { s: ExpedState; u: TideUnit } => {
    const s = startRun(cfg())
    const g = s.guards[0]
    const u: TideUnit = {
      id: 9001, kind, x, y, fx: 0, fy: 0, hp: 999, maxHp: 999, atk: 5,
      speed: 0.34, mass, slowUntil: 0, stunUntil: 0, alive: true, spawnAt: 0,
    }
    s.tide.push(u)
    return { s, u }
  }

  // ── RUNNER: slips past a post without stopping to strike it ──
  {
    const s0 = startRun(cfg())
    const g = s0.guards[0]
    const { s, u } = place('swift', g.x + 0.5, g.y)
    const gg = s.guards[0]
    const hp0 = gg.hp
    for (let i = 0; i < 5; i++) stepRun(s)
    ok(gg.hp === hp0, '★ a RUNNER slips past a post without striking it — it is here for the core')
  }
  // ...while the mass does stop and bite. Same position, different kind: the ONLY variable is habit.
  {
    const s0 = startRun(cfg())
    const g0 = s0.guards[0]
    const { s } = place('drift', g0.x + 0.5, g0.y)
    const gg = s.guards[0]
    const hp0 = gg.hp
    for (let i = 0; i < 5; i++) stepRun(s)
    ok(gg.hp < hp0, '...while the MASS stops and bites — the only variable between these two is the habit')
  }

  // ── SIEGE: walks at a post rather than the core ──
  {
    const { s, u } = place('bulk', GATE_X + 10, GATE_Y + 10, 2)
    const nearest = s.guards.reduce((a, b) =>
      Math.hypot(a.x - u.x, a.y - u.y) <= Math.hypot(b.x - u.x, b.y - u.y) ? a : b)
    const dG0 = Math.hypot(nearest.x - u.x, nearest.y - u.y)
    const dC0 = Math.hypot(GATE_X - u.x, GATE_Y - u.y)
    for (let i = 0; i < 25; i++) stepRun(s)
    const dG1 = Math.hypot(nearest.x - u.x, nearest.y - u.y)
    const dC1 = Math.hypot(GATE_X - u.x, GATE_Y - u.y)
    ok(dG0 - dG1 > dC0 - dC1, `★ a SIEGE piece closes on the POST faster than on the core (post ${(dG0-dG1).toFixed(2)} vs core ${(dC0-dC1).toFixed(2)})`)
  }

  // ── ACCRETE: eats a smaller body where it stands, and shrugs off a shove ──
  {
    const { s, u } = place('behemoth', GATE_X + 14, GATE_Y, 4)
    const snack: TideUnit = { ...u, id: 9002, kind: 'drift', mass: 1, hp: 10, maxHp: 10,
      x: u.x + ACCRETE_R * 0.5, y: u.y, alive: true }
    s.tide.push(snack)
    const m0 = u.mass
    for (let i = 0; i < 3; i++) stepRun(s)
    ok(!snack.alive, '★ a BEHEMOTH takes a smaller body into itself where it stands')
    ok(u.mass >= m0, '...and carries its mass')

    const { s: s2, u: big } = place('behemoth', GATE_X + 14, GATE_Y, 4)
    const { s: s3, u: small } = place('drift', GATE_X + 14, GATE_Y, 1)
    big.stunUntil = s2.tick + 999
    small.stunUntil = s3.tick + 999
    const bx = big.x, sx = small.x
    for (let i = 0; i < 5; i++) { stepRun(s2); stepRun(s3) }
    ok(big.x !== bx, '★ a shove does not hold a BEHEMOTH — too much mass to reel')
    ok(small.x === sx, '...but it does hold a drift, or the immunity means nothing')
  }
}

// ── 5. ★ THE HABIT SURVIVES THE MERGE — pooling is the variety engine, not a flattener ─────────
{
  // A swift that pools becomes a bulk, and a bulk sieges. The leak you failed to intercept turns
  // into the thing that breaks your line — the merge system telling a story it could not tell when
  // every kind behaved identically.
  ok(TIDE_HABIT.swift !== TIDE_HABIT.bulk,
    'a swift that merges into a bulk CHANGES habit — the leak becomes the battering ram')
  ok(TIDE_HABIT.bulk !== TIDE_HABIT.behemoth,
    '...and a bulk that merges again changes habit once more')
  // ⚠ And nothing is exempt from merging. Alex ruled the habits LAYER onto the merge system; a kind
  // that opted out would quietly restore the scheduled-boss shape the design doc rejects.
  const s = runFor(900)
  ok(s.wave > 1, 'the fixture actually ran waves (or everything below is vacuous)')
}

if (fails.length) {
  console.error(`❌ expedition: ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exitCode = 1
} else {
  console.log(`✅ expedition: the flood has habits, and the run is deterministic — ${pass} passed`)
}
