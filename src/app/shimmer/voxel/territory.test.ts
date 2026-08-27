// ── Hold territory: the three bands, and the one property canon actually fixes ────────────────
// Run: npx tsx src/app/shimmer/voxel/territory.test.ts
//
// ★ THE ASSERT THAT EARNS ITS KEEP is the transfer one. Everything else here is arithmetic I could
// re-derive by reading the file; "a freed hold's ground goes to nobody" is the canon rule, it is
// invisible in the geometry, and the cheapest wrong implementation — assign to the nearest hold,
// then filter the freed ones out afterwards — passes every other check in this file while silently
// handing Thistle's country to Vetch the moment Thistle falls. That would turn liberation into
// rearranging furniture and nothing else here would notice.

import { HOLDS } from './holds'
import { territoryAt, holdReach, holdWeight, canHostBurrow, REACH_PER_HALF } from './territory'
import { STORY_NODES } from './story-path'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 0. the subject exists, and there are three of it ─────────────────────────────────────────
ok(HOLDS.length === 3, `BLIND: expected 3 holds, found ${HOLDS.length} — this oracle is auditing something else`)

// ── 1. a hold owns its own ground, at its own rung ───────────────────────────────────────────
for (const h of HOLDS) {
  const t = territoryAt(h.x, h.z)
  ok(t.hold === h.id, `${h.id} does not own its own centre — got ${t.hold}`)
  ok(Math.abs(t.pressure - holdWeight(h)) < 1e-9,
     `${h.id} presses ${t.pressure.toFixed(3)} at its own wall, expected its rung weight ${holdWeight(h).toFixed(3)}`)
}

// ── 2. reach and weight ESCALATE TOGETHER, because both come off `half` ──────────────────────
// holds.ts escalates half 10/12/14 because "Brack looms". If a later hand-kept table let reach and
// weight disagree with that, the geometry would claim one chain of command and the pressure another.
for (let i = 1; i < HOLDS.length; i++) {
  ok(holdReach(HOLDS[i]) > holdReach(HOLDS[i - 1]),
     `${HOLDS[i].id} reaches ${holdReach(HOLDS[i])}, no further than ${HOLDS[i - 1].id}'s ${holdReach(HOLDS[i - 1])} — the chain stopped escalating`)
  ok(holdWeight(HOLDS[i]) > holdWeight(HOLDS[i - 1]),
     `${HOLDS[i].id} presses no harder than ${HOLDS[i - 1].id} — "Brack looms" is not true of the pressure`)
}

// ── 3. beyond reach is FREE COUNTRY, and free country hosts no burrow ────────────────────────
for (const h of HOLDS) {
  const r = holdReach(h)
  const t = territoryAt(h.x + r + 1, h.z)
  ok(t.hold !== h.id, `${h.id} still owns ground ${r + 1} out, past its own reach of ${r}`)
  ok(!canHostBurrow(h.x + r + 1, h.z), `a burrow could be authored outside every hold's reach — "a burrow with no hold behind it"`)
  ok(canHostBurrow(h.x, h.z), `${h.id}'s own ground refuses a burrow`)
}

// ── 4. ★★ FREEING A HOLD GIVES ITS GROUND TO NOBODY ──────────────────────────────────────────
// Canon: "free the hold and the tunnelling STOPS." Not "moves".
for (const h of HOLDS) {
  const freed = new Set([h.id])
  const t = territoryAt(h.x, h.z, freed)
  ok(t.hold === null,
     `${h.id} freed, yet its own centre now belongs to ${t.hold} — liberation moved the pressure instead of ending it`)
  ok(t.pressure === 0, `${h.id} freed, yet its ground still presses at ${t.pressure}`)
  ok(!canHostBurrow(h.x, h.z, freed), `${h.id} freed, yet its ground still hosts burrows — the tunnelling did not stop`)
}
// and the whole chain freed is a free country
ok(territoryAt(HOLDS[1].x, HOLDS[1].z, new Set(HOLDS.map(h => h.id))).hold === null,
   'with every hold freed some ground still belongs to one')

// ── 5. pressure falls with distance, monotonically, out to the edge ──────────────────────────
for (const h of HOLDS) {
  const r = holdReach(h)
  let prev = Infinity
  for (let d = h.half; d < r; d += Math.max(1, Math.floor(r / 40))) {
    const p = territoryAt(h.x + d, h.z).pressure
    ok(p <= prev + 1e-9, `${h.id}: pressure rose from ${prev.toFixed(4)} to ${p.toFixed(4)} while walking AWAY at d=${d}`)
    prev = p
  }
  ok(prev > 0, `${h.id}: pressure hit zero before the edge of reach`)
}

// ── 6. neighbouring bands leave a corridor of free road, deliberately ────────────────────────
// A front line you can stand outside of is what makes stepping into one mean anything. If the
// reaches ever close the gap this goes red, and that is a design decision to re-take, not a bug.
for (let i = 1; i < HOLDS.length; i++) {
  const a = HOLDS[i - 1], b = HOLDS[i]
  const gap = Math.hypot(a.x - b.x, a.z - b.z) - holdReach(a) - holdReach(b)
  ok(gap > 0, `${a.id} and ${b.id} reaches now overlap by ${(-gap).toFixed(0)} blocks — the free corridor between them is gone`)
  console.log(`  corridor ${a.id} → ${b.id}: ${gap.toFixed(0)} blocks of free road`)
}

// ── 7. the keeper's plot at its largest still stands clear of the chain ──────────────────────
// plot.ts tiers at 300/400/500. This is a MARGIN, printed rather than silently assumed: the day it
// goes negative, the plot edge is inside a band and pressure reaches the garden, which is a design
// conversation and not a failure.
const glade = STORY_NODES.find(n => n.id === 'moonwell-glade')!
const PLOT_MAX = 500
for (const h of HOLDS) {
  const margin = Math.hypot(glade.x - h.x, glade.z - h.z) - PLOT_MAX - holdReach(h)
  console.log(`  plot(r${PLOT_MAX}) → ${h.id}: ${margin.toFixed(0)} blocks of clearance`)
  ok(margin > 0, `a tier-3 plot edge reaches inside ${h.id}'s band (${margin.toFixed(0)}) — pressure would arrive in the garden`)
}

// ── the picture, because three numbers are not a map ─────────────────────────────────────────
{
  const minX = -2900, maxX = -100, minZ = -3300, maxZ = -500
  const W = 64, H = 30
  const glyph = (hold: string | null) => hold === null ? '·' : hold[0].toUpperCase()
  console.log('\n  the three bands (T=thistle V=vetch B=brack · = free country, @ = the plot):')
  for (let r = 0; r < H; r++) {
    let line = '  '
    for (let c = 0; c < W; c++) {
      const x = minX + (c / (W - 1)) * (maxX - minX)
      const z = minZ + (r / (H - 1)) * (maxZ - minZ)
      const inPlot = Math.hypot(x - glade.x, z - glade.z) <= PLOT_MAX
      line += inPlot ? '@' : glyph(territoryAt(x, z).hold)
    }
    console.log(line)
  }
}

console.log(`\nterritory — ${HOLDS.length} holds, reach = half × ${REACH_PER_HALF} (${HOLDS.map(h => holdReach(h)).join(' / ')})`)
if (fails.length) {
  console.log(`\n❌ ${pass} passed, ${fails.length} FAILED\n`)
  fails.slice(0, 10).forEach(f => console.log('  · ' + f))
  process.exit(1)
}
console.log(`✅ ${pass} asserts passed\n`)
