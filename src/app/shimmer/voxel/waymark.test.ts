// Waymark oracle. Run: npx tsx src/app/shimmer/voxel/waymark.test.ts
//
// ★ THE ASSERT THIS FILE EXISTS FOR IS "EVERY PASSAGE ALWAYS LEADS SOMEWHERE".
//
// ⚠ THIS FILE'S OLD HEADLINE WAS "pulling the hub does not strand the keeper", and it is GONE ON
// PURPOSE (2026-08-15, slice 2). The hub used to be a planted waymark, so breaking it left every
// other passage pointing at nothing — a network that never throws, never looks broken, and quietly
// stops working. The hub is the PLOT now: generated, derived, impossible to break. The failure is
// designed out rather than handled, so the promotion machinery that handled it is deleted rather
// than left standing over a state that cannot occur. What remains asserted is the property that
// mattered underneath it: **a keeper holding a waymark can always get home.**

import {
  emptyNet, plant, pull, rename, destination, spokesOf,
  markAt, arrivalOf, MAX_MARKS, type WaymarkNet,
} from './waymark'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ⚠ Report on `process.on('exit')`, not at the bottom of the file — the hollows oracle shipped a
// mid-file report TWICE under a comment telling everyone not to, and ~30 asserts announced a green
// run they had never checked. A convention that relies on the next editor reading a comment is not
// a fix. This has no position to be stranded above.
process.on('exit', () => {
  if (fails.length) {
    console.error(`❌ ${fails.length} failed (${pass} passed)`)
    for (const f of fails) console.error('  - ' + f)
    process.exitCode = 1
  } else {
    console.log(`✅ the keeper's passages hold — ${pass} passed`)
  }
})

/** Plant n marks in a line and hand back the net. Throws on refusal so a test cannot silently drift. */
const netOf = (n: number): WaymarkNet => {
  let net = emptyNet()
  for (let i = 0; i < n; i++) {
    const r = plant(net, i * 10, 64, 0, `m${i}`)
    if ('refused' in r) throw new Error(`fixture refused at ${i}: ${r.refused}`)
    net = r.net
  }
  return net
}

// ── planting ──────────────────────────────────────────────────────────────────
{
  const empty = emptyNet()
  ok(spokesOf(empty).length === 0, 'an empty network holds no passages')

  const three = netOf(3)
  ok(spokesOf(three).length === 3, 'every planted waymark is a passage — none is spent on a hub')
  ok(three.marks.map((m) => m.id).join(',') === 'w1,w2,w3', 'ids are minted in order')
  ok(new Set(three.marks.map((m) => m.id)).size === 3, 'ids are unique')
}

// ── the cap, and refusing rather than replacing ───────────────────────────────
{
  const full = netOf(MAX_MARKS)
  const r = plant(full, 999, 64, 999)
  ok('refused' in r && r.refused === 'full', 'the cap refuses')
  ok(full.marks.length === MAX_MARKS, '★ ...and does NOT silently drop the oldest passage')
  // ⚠ The cap is 3 and not 4: one used to be spent on the hub, and the plot costs no waymark.
  // Holding it at 4 would have handed the keeper a free extra passage as a plumbing side effect.
  ok(MAX_MARKS === 3, 'three passages — the hub is the plot and costs none of them')

  const dup = plant(netOf(2), 0, 64, 0)
  ok('refused' in dup && dup.refused === 'occupied', 'two waymarks cannot share a cell')

  ok(markAt(netOf(3), 10, 64, 0)?.name === 'm1', 'lookup by cell works')
  ok(markAt(netOf(3), 11, 64, 0) === null, '...and misses cleanly')
}

// ── pulling ───────────────────────────────────────────────────────────────────
{
  const net = netOf(3)
  const { net: after, removed } = pull(net, 'w2')
  ok(removed?.id === 'w2' && after.marks.length === 2, 'a passage comes up')
  // ★★ THE PROPERTY THE OLD PROMOTION ASSERT WAS REALLY DEFENDING, now true by construction: there
  // is no removal that can leave a surviving passage pointing at nothing, because the far end is
  // not in this network at all.
  let allResolve = true
  for (const m of spokesOf(after)) if (!('toPlot' in destination(after, { fromPlot: false, fromId: m.id }))) allResolve = false
  ok(allResolve, '★★ every surviving passage still leads home — the hub cannot be removed')
  ok(pull(net, 'nope').removed === null, 'pulling an unknown id is a no-op, not a throw')
  const reused = plant(pull(netOf(3), 'w2').net, 500, 64, 0)
  ok('net' in reused && reused.mark.id === 'w4', '★ an id is never reused after a pull')
  const emptied = pull(netOf(1), 'w1')
  ok(emptied.net.marks.length === 0, 'pulling the only passage empties cleanly')
}

// ── ★ HUB AND SPOKE — the routing rule, in one place ──────────────────────────
{
  const net = netOf(3)

  const home = destination(net, { fromPlot: false, fromId: 'w1' })
  ok('toPlot' in home, '★ a waymark in the Wilds goes to THE PLOT, never to another waymark')

  const out = destination(net, { fromPlot: true, toId: 'w2' })
  ok('to' in out && out.to.id === 'w2', '★ the plot steps out to a NAMED passage')

  const unnamed = destination(net, { fromPlot: true })
  ok('refused' in unnamed && unnamed.refused === 'at-plot-pick-one',
    '★ standing at the plot with nowhere named is "choose where to go"')

  // ★★ NO SPOKE-TO-SPOKE — and this assert was VACUOUS as first written, caught by mutation.
  //
  // The discriminated union makes `toId` unrepresentable on the `fromPlot: false` arm, so the first
  // version simply called it without one and asserted `toPlot` — which a mutation that honoured a
  // passed `toId` still satisfied, because nothing ever passed one. **A type that forbids the call
  // is stronger than an assert, but it is not the same claim**: the type protects TypeScript
  // callers, and this module also ships to a JS host, a saved-state replay and anything that casts.
  // So the cast is deliberate: it asks the exact question the type will not let a caller ask.
  const across = destination(net, { fromPlot: false, fromId: 'w1', toId: 'w2' } as never)
  ok('toPlot' in across, '★★ a waymark IGNORES a named destination and still goes home')

  ok('refused' in destination(net, { fromPlot: false, fromId: 'nope' }), 'an unknown origin refuses')
  ok('refused' in destination(net, { fromPlot: true, toId: 'nope' }), 'an unknown destination refuses')
  const none = destination(emptyNet(), { fromPlot: true })
  ok('refused' in none && none.refused === 'no-passages', 'the plot with no passages says so')
}

// ── naming + arrival ──────────────────────────────────────────────────────────
{
  const named = rename(netOf(2), 'w2', 'the quarry')
  ok(markAt(named, 10, 64, 0)?.name === 'the quarry', 'a mark can be renamed')
  ok(rename(netOf(2), 'nope', 'x').marks.length === 2, 'renaming an unknown id is a no-op')
  ok(rename(netOf(2), 'w2', '').marks[1].name === '', 'an empty name is legal — the panel falls back')

  // ★ Arrival is the cell ABOVE the block, centred. A corner arrival puts the body half inside the
  // neighbouring cell, which the host's fit check then rejects for a spot that was actually fine.
  const a = arrivalOf({ id: 'w1', x: 10, y: 64, z: -4, name: '' })
  ok(a.x === 10.5 && a.z === -3.5, '★ arrival is CENTRED in the cell, not on its corner')
  ok(a.y === 65, '★ ...and one above the block, standing on it rather than inside it')
}

// ── immutability — the host holds refs and re-renders off identity ────────────
{
  const before = netOf(2)
  const snapshot = JSON.stringify(before)
  plant(before, 77, 64, 77); pull(before, 'w1'); rename(before, 'w1', 'x')
  ok(JSON.stringify(before) === snapshot, '★ every operation returns a new net and mutates nothing')
}
