// VAULT movements oracle — proves each Story movement (a) completes with competent play (reaches its
// goal → 'won'), (b) isn't a death-grind or a snooze, and (c) respects hazard GATING (no foes/spikes leak
// into a movement that hasn't introduced them). Run: npx tsx src/app/vault/lib/vault.movements.oracle.ts
import { makeWorld, tick, pressJump, releaseJump, speedOf, STEP_UP, FOE_W, MOVEMENTS, type World, type MovementCfg } from './vault'

// competent look-ahead bot (mirror of vault.oracle's, but movement-aware via speedOf + cfg)
function botRun(seed: number, cfg: MovementCfg, maxT = 90): { dist: number; state: string; sawFoe: boolean; sawSpike: boolean } {
  const w = makeWorld(seed, cfg); pressJump(w)
  let holding = false, releaseX = -Infinity
  const dt = 1 / 60
  let t = 0
  let sawFoe = false, sawSpike = false
  while (w.state === 'playing' && t < maxT) {
    if (w.foes.length) sawFoe = true
    if (w.spikes.length) sawSpike = true
    const dist = w.dist
    const speed = speedOf(w, dist)
    const cur = w.segs.find(s => dist >= s.x0 && dist <= s.x1)
    const next = w.segs.filter(s => s.x0 > dist).sort((a, b) => a.x0 - b.x0)[0]
    const targets: { x: number; clearX: number; kind: 'gap' | 'haz'; high: boolean }[] = []
    if (cur && next && next.x0 > cur.x1 + 1) {
      targets.push({ x: cur.x1, clearX: next.x0 + 4, kind: 'gap', high: next.top < cur.top - STEP_UP })
    }
    const haz = [...w.foes.filter(f => !f.dead && f.x > dist), ...w.spikes.filter(s => s.x > dist)]
      .map(o => o.x).sort((a, b) => a - b)[0]
    if (haz != null) targets.push({ x: haz, clearX: haz + FOE_W + 18, kind: 'haz', high: false })
    targets.sort((a, b) => a.x - b.x)
    const tg = targets[0]
    if (w.grounded || w.coyote > 0) {
      const lead = Math.max(8, speed * (tg?.high ? 0.06 : 0.04))
      if (tg && tg.x - dist <= lead) { pressJump(w); holding = true; releaseX = tg.clearX + (tg.high ? 45 : 0) }
    } else if (holding) {
      const tgIsHaz = tg && tg.kind === 'haz'
      if (dist > releaseX || (tgIsHaz && w.vy > 0)) { releaseJump(w); holding = false }
    }
    tick(w, dt); t += dt
  }
  return { dist: Math.round(w.dist), state: w.state, sawFoe, sawSpike }
}

const N = 200
let failures = 0
function assert(name: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${name}`)
  else { failures++; console.error(`  ✗ ${name}`) }
}

console.log(`\nVAULT movements oracle — ${N} seeds/movement, competent HOP-ONLY bot`)
console.log(`(the bot never stomps, so foe-movement rates UNDERSTATE skilled play — treat as a floor)\n`)
const rates: number[] = []
for (const m of MOVEMENTS) {
  let won = 0, anyFoe = false, anySpike = false
  for (let s = 1; s <= N; s++) {
    const r = botRun(s, m)
    if (r.state === 'won') won++
    if (r.sawFoe) anyFoe = true
    if (r.sawSpike) anySpike = true
  }
  const rate = won / N
  rates.push(rate)
  console.log(`${m.id} ${m.name.padEnd(16)} goal=${m.goalDist}  completed ${(rate * 100).toFixed(0)}%  foes=${anyFoe} spikes=${anySpike}`)
  // hazard gating matches the movement's declared toggles (the core guarantee)
  assert(`${m.id} foe gating`, anyFoe === m.foes)
  assert(`${m.id} spike gating (none unless enabled)`, m.spikes || !anySpike)
  // nothing is a wall: even the hop-only bot clears it sometimes → a stomping human definitely can
  assert(`${m.id} is clearable (bot ≥10%)`, rate >= 0.1)
  // a fair start: the no-hazard opening movements should be near-automatic
  if (!m.foes && !m.spikes) assert(`${m.id} fair start (≥90%)`, rate >= 0.9)
}
// the descent is ordered: each movement is at least as hard as the one before (non-increasing bot rate,
// small tolerance for seed noise). This is what makes it a DESCENT, not a random difficulty jumble.
for (let i = 1; i < rates.length; i++) {
  assert(`${MOVEMENTS[i].id} ≤ ${MOVEMENTS[i - 1].id} (monotonic descent)`, rates[i] <= rates[i - 1] + 0.06)
}
console.log(`\n${failures === 0 ? 'ALL MOVEMENT CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
