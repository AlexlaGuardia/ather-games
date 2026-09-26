// caravans.test.ts — the caravan clock turns where it says, and no caravan sells what canon forbids it.
// Run: npx tsx src/app/shimmer/play3d/caravans.test.ts
import { caravanFor, dayIndex, weekIndex, monthIndex, leavesIn, CARAVAN_SLOTS, RESET_HOUR_UTC } from './caravans'
import { rackFor } from './scroll-market'
import { vesselRackFor } from './passage'
import { PASSAGE, passageAscii, T } from './passage-hall'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }

const at = (iso: string) => Date.parse(iso)

// ── the day turns at the reset hour, not at midnight ──
ok(dayIndex(at(`2026-09-26T0${RESET_HOUR_UTC - 1}:59:00Z`)) + 1 === dayIndex(at(`2026-09-26T0${RESET_HOUR_UTC}:00:00Z`)), 'the day turns at the reset hour')
ok(dayIndex(at('2026-09-26T10:00:00Z')) === dayIndex(at('2026-09-27T08:59:00Z')), 'one caravan day spans the reset to the reset')
// ── the week turns on Monday (2026-09-28 is a Monday) ──
ok(weekIndex(at('2026-09-27T20:00:00Z')) + 1 === weekIndex(at('2026-09-28T10:00:00Z')), 'the week turns Monday at the reset hour')
ok(weekIndex(at('2026-09-28T10:00:00Z')) === weekIndex(at('2026-10-04T20:00:00Z')), 'Monday through Sunday is one week')
// ── the month turns on the 1st ──
ok(monthIndex(at('2026-09-30T20:00:00Z')) + 1 === monthIndex(at('2026-10-01T10:00:00Z')), 'the month turns on the 1st at the reset hour')

// ── leaves-in lands exactly on the next turn, for every slot, across a year of samples ──
const DAY = 86_400_000
for (let t = at('2026-01-01T00:00:00Z'), n = 0; n < 400; t += DAY * 0.93, n++) {
  for (const slot of CARAVAN_SLOTS) {
    const c = caravanFor(slot, t)
    const next = caravanFor(slot, t + c.leavesInMs)
    const idx = slot === 'daily' ? dayIndex : slot === 'weekly' ? weekIndex : monthIndex
    if (idx(t + c.leavesInMs) !== idx(t) + 1 || idx(t + c.leavesInMs - 1) !== idx(t) || c.leavesInMs <= 0) {
      fails.push(`${slot}: leavesIn at ${new Date(t).toISOString()} does not land on the turn`); break
    }
    void next
  }
}
pass++

// ── canon: no caravan sells gems (E'xday merchants'), a teacher (Coomday), or runestones (the counter) ──
for (let t = at('2026-09-01T12:00:00Z'), n = 0; n < 60; t += DAY, n++) {
  for (const slot of CARAVAN_SLOTS) {
    const c = caravanFor(slot, t)
    if (c.shelves.some(k => k === 'gems' || k === 'teacher' || k === 'counter' || k === 'cutter')) fails.push(`${slot} on ${new Date(t).toISOString()} carries a shelf canon keeps off the caravans: ${c.shelves}`)
  }
}
pass++

// ── the stray-keeper stays shut until canon rules (CANON_GAPS [OPEN] 09-25) ──
ok(!caravanFor('monthly', Date.now()).open, "the stray-keeper's wagon is shuttered")
// ── the merchant of the day alternates, and is the same for everyone on the same day ──
const d0 = caravanFor('daily', at('2026-09-26T12:00:00Z')), d1 = caravanFor('daily', at('2026-09-27T12:00:00Z'))
ok(d0.kind !== d1.kind, 'consecutive days bring different merchants')
ok(caravanFor('daily', at('2026-09-26T12:00:00Z')).kind === caravanFor('daily', at('2026-09-27T08:00:00Z')).kind, 'same caravan day, same merchant')
// ── an open caravan actually has stock ──
for (const slot of ['daily', 'weekly'] as const) {
  const c = caravanFor(slot, at('2026-09-26T12:00:00Z'))
  if (c.shelves.includes('rack')) ok(rackFor(c.stock.rackSeed, c.stock.rackCycle, c.stock.rackSize).length === c.stock.rackSize, `${slot}: the scroll rack is full`)
  if (c.shelves.includes('secondhand')) ok(vesselRackFor(c.stock.vesselCycle, c.stock.vesselSeed, c.stock.vesselSize).length === c.stock.vesselSize, `${slot}: the vessel rack is full`)
}
// ── the stock turns with the period ──
const w0 = caravanFor('weekly', at('2026-09-26T12:00:00Z')), w1 = caravanFor('weekly', at('2026-10-03T12:00:00Z'))
ok(rackFor(w0.stock.rackSeed, w0.stock.rackCycle, 7).map(m => m.id).join() !== rackFor(w1.stock.rackSeed, w1.stock.rackCycle, 7).map(m => m.id).join(), "next week's long-hauler carries a different rack")

ok(leavesIn(3 * 3_600_000) === 'leaves in 3h' && leavesIn(5 * DAY) === 'leaves in 5 days' && leavesIn(10_000) === 'leaves in 1m', 'leavesIn reads')

// ── the wagons: each anchor is solid and reachable from an open road cell in front of it ──
for (const w of PASSAGE.wagons) {
  ok(PASSAGE.grid[w.z][w.x] === T.ROCK, `${w.slot} wagon anchor is solid`)
  ok(PASSAGE.grid[w.z + w.face[1]][w.x + w.face[0]] !== T.ROCK, `${w.slot} wagon has road in front of it`)
}
// every stall, cabinet and wagon is reachable by walking from the arrival
{
  const g = PASSAGE.grid, seen = new Set<string>(), q = [[PASSAGE.arrival.x, PASSAGE.arrival.z]]
  seen.add(q[0].join())
  while (q.length) {
    const [x, z] = q.pop()!
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = `${nx},${nz}`
      if (seen.has(k) || g[nz]?.[nx] === undefined || g[nz][nx] === T.ROCK) continue
      if (Math.abs(PASSAGE.heights[nz][nx] - PASSAGE.heights[z][x]) > 1) continue
      seen.add(k); q.push([nx, nz])
    }
  }
  for (const f of [...PASSAGE.stalls, ...PASSAGE.cabinets, ...PASSAGE.wagons])
    ok(seen.has(`${f.x + f.face[0]},${f.z + f.face[1]}`), `${'id' in f ? f.id : f.slot}: the floor in front of it is walkable from the arrival`)
}

if (fails.length) { console.log(passageAscii()); console.log(`❌ ${pass} passed, ${fails.length} FAILED\n`); fails.forEach(f => console.log('  · ' + f)); process.exit(1) }
console.log(`caravans: ${pass} passed, 0 failed`)
