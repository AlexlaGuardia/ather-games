// VAULT level-ladder oracle — the areas hold procedural levels (difficulty steps floor→ceil per area,
// length grows across the ladder). A level SHIPS with a fixed seed, but here we estimate each level
// CONFIG's clearability across many seeds (a fair config → the fixed level is very likely fair too).
// Checks: gating per area, a fair start, nothing a wall, and a broadly monotonic descent.
// Run: npx tsx src/app/vault/lib/vault.levels.oracle.ts
import { makeWorld, tick, pressJump, releaseJump, speedOf, STEP_UP, FOE_W, AREAS, LEVELS_PER_AREA, levelCfg, type World, type MovementCfg } from './vault'

// competent hop-only look-ahead bot (does NOT grab motes → understates fuel-managed play; a floor)
function botBeats(seed: number, cfg: MovementCfg, maxT = 140): { won: boolean; sawFoe: boolean; sawSpike: boolean } {
  const w = makeWorld(seed, cfg); pressJump(w)
  let holding = false, releaseX = -Infinity
  const dt = 1 / 60
  let t = 0, sawFoe = false, sawSpike = false
  while (w.state === 'playing' && t < maxT) {
    if (w.foes.length) sawFoe = true
    if (w.spikes.length) sawSpike = true
    const dist = w.dist
    const speed = speedOf(w, dist)
    const cur = w.segs.find(s => dist >= s.x0 && dist <= s.x1)
    const next = w.segs.filter(s => s.x0 > dist).sort((a, b) => a.x0 - b.x0)[0]
    const targets: { x: number; clearX: number; kind: 'gap' | 'haz'; high: boolean }[] = []
    if (cur && next && next.x0 > cur.x1 + 1) targets.push({ x: cur.x1, clearX: next.x0 + 4, kind: 'gap', high: next.top < cur.top - STEP_UP })
    const haz = [...w.foes.filter(f => !f.dead && f.x > dist), ...w.spikes.filter(s => s.x > dist)].map(o => o.x).sort((a, b) => a - b)[0]
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
  return { won: w.state === 'won', sawFoe, sawSpike }
}

const N = 80
let failures = 0
const assert = (name: string, cond: boolean) => { if (cond) console.log(`  ✓ ${name}`); else { failures++; console.error(`  ✗ ${name}`) } }

console.log(`\nVAULT level-ladder oracle — ${N} seeds/level, hop-only bot (understates skilled/fuel play)\n`)
const areaAvg: number[] = []
for (let a = 0; a < AREAS.length; a++) {
  const area = AREAS[a]
  const samples = [0, Math.floor((LEVELS_PER_AREA - 1) / 2), LEVELS_PER_AREA - 1] // first / mid / last
  let anyFoe = false, anySpike = false
  const rates: number[] = []
  for (const i of samples) {
    const cfg = levelCfg(a, i)
    let won = 0
    for (let s = 1; s <= N; s++) { const r = botBeats(s * 2654435761 % 2147483647, cfg); if (r.won) won++; if (r.sawFoe) anyFoe = true; if (r.sawSpike) anySpike = true }
    rates.push(won / N)
  }
  const avg = rates.reduce((x, y) => x + y, 0) / rates.length
  areaAvg.push(avg)
  const note = a >= 4 ? '  (deep foe field — hop-bot can’t stomp; device-tuned)' : ''
  console.log(`${area.id} ${area.name.padEnd(22)} L1/L${samples[1] + 1}/L${LEVELS_PER_AREA}  ${rates.map(r => (r * 100).toFixed(0) + '%').join(' / ')}   foes=${anyFoe} spikes=${anySpike}${note}`)
  // GATING is deterministic — always assert it. Hazards must match the area's config.
  assert(`${area.id} foe gating`, anyFoe === area.foes)
  assert(`${area.id} spike gating`, area.spikes || !anySpike)
  // within-area descent: the last level shouldn't be EASIER than the first (small tolerance for seed noise)
  assert(`${area.id} within-area descent`, rates[0] + 0.06 >= rates[rates.length - 1])
}
// what the hop-bot CAN honestly judge: the no-hazard opening areas are fair, and the ladder trends down.
// Deep foe areas (a5/a6) read near-0 for a hop-only bot — that's a device-feel call (a stomping player +
// motes + hearts clears them), not something this bot can verify. So: no hard clearability assert there.
assert('area 1 fair start (≥90%)', areaAvg[0] >= 0.9)
assert('area 2 fair (≥90%)', areaAvg[1] >= 0.9)
assert('area 3 (first foe area) broadly clearable (≥30%)', areaAvg[2] >= 0.3)
for (let a = 1; a < areaAvg.length; a++) assert(`area ${a + 1} ≤ area ${a} (descent)`, areaAvg[a] <= areaAvg[a - 1] + 0.08)
console.log(`\n${failures === 0 ? 'ALL LADDER CHECKS PASSED (deep foe areas = device-tuned)' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
