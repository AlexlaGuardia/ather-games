// Waymark oracle. Run: npx tsx src/app/shimmer/voxel/waymark.test.ts
//
// ★ THE ASSERT THIS FILE EXISTS FOR IS "PULLING THE HUB DOES NOT STRAND THE KEEPER".
//
// Everything else here is ordinary bookkeeping. The one that earns its place is the promotion pair:
// a network whose threshold is removed has NO route at all — every remaining spoke points at a place
// that no longer exists, and the keeper is left holding three dead passages with no way to rebuild
// the hub except by walking home across the world. It never throws and it never looks broken; it
// just quietly stops working, which is the failure mode this whole file is shaped around avoiding.

import {
  emptyNet, plant, pull, rename, designate, destination, thresholdOf, spokesOf,
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
  ok(thresholdOf(empty) === null, 'an empty network has no hub')
  ok(spokesOf(empty).length === 0, '...and no spokes')

  const one = netOf(1)
  ok(thresholdOf(one)?.name === 'm0', '★ the FIRST one planted is the threshold')
  ok(spokesOf(one).length === 0, 'and it is not also a spoke')

  const three = netOf(3)
  ok(thresholdOf(three)?.name === 'm0', 'later plants do not steal the hub')
  ok(spokesOf(three).length === 2, 'the rest are spokes')
  ok(three.marks.filter((m) => m.threshold).length === 1, '★ there is EXACTLY one hub, always')

  // ⚠ Ids come off the saved counter, never off the length — see WaymarkNet.next.
  ok(three.marks.map((m) => m.id).join(',') === 'w1,w2,w3', 'ids are minted in order')
  ok(new Set(three.marks.map((m) => m.id)).size === 3, 'ids are unique')
}

// ── the cap, and refusing rather than replacing ───────────────────────────────
{
  const full = netOf(MAX_MARKS)
  const r = plant(full, 999, 64, 999)
  ok('refused' in r && r.refused === 'full', 'the cap refuses')
  ok(full.marks.length === MAX_MARKS, '★ ...and does NOT silently drop the oldest passage')

  const dup = plant(netOf(2), 0, 64, 0)
  ok('refused' in dup && dup.refused === 'occupied', 'two waymarks cannot share a cell')

  ok(markAt(netOf(3), 10, 64, 0)?.name === 'm1', 'lookup by cell works')
  ok(markAt(netOf(3), 11, 64, 0) === null, '...and misses cleanly')
}

// ── ★★ PULLING THE HUB — the assert this file exists for ──────────────────────
{
  const net = netOf(3)
  const hub = thresholdOf(net)!
  const { net: after, removed, promoted } = pull(net, hub.id)

  ok(removed?.id === hub.id, 'the hub comes out')
  ok(after.marks.length === 2, 'and the spokes survive')
  ok(promoted?.name === 'm1', '★★ the OLDEST surviving spoke is promoted — the network is never hubless')
  ok(thresholdOf(after)?.name === 'm1', '...and it really is the hub now')
  ok(after.marks.filter((m) => m.threshold).length === 1, '...still exactly one')

  // Every spoke must still resolve. This is the stranding case stated as the thing a player feels.
  let allResolve = true
  for (const s of spokesOf(after)) if (!('to' in destination(after, s.id))) allResolve = false
  ok(allResolve, '★★ every surviving spoke still leads somewhere — nobody is stranded')

  // Pulling a spoke leaves the hub alone.
  const spoke = spokesOf(net)[0]
  const p2 = pull(net, spoke.id)
  ok(p2.promoted === null, 'pulling a spoke promotes nothing')
  ok(thresholdOf(p2.net)?.id === hub.id, '...and the hub is untouched')

  // The last one out leaves an empty, still-valid network.
  const lone = pull(netOf(1), thresholdOf(netOf(1))!.id)
  ok(lone.net.marks.length === 0 && lone.promoted === null, 'pulling the only mark empties cleanly')

  ok(pull(net, 'nope').removed === null, 'pulling an unknown id is a no-op, not a throw')
  // ⚠ Ids must not be recycled by a removal, or a stale panel row resolves to the wrong place.
  const reused = plant(pull(netOf(3), 'w2').net, 500, 64, 0)
  ok('net' in reused && reused.mark.id === 'w4', '★ an id is never reused after a pull')
}

// ── designation — "first one you plant is home" must not be a trap ────────────
{
  const net = netOf(3)
  const moved = designate(net, 'w3')
  ok(thresholdOf(moved)?.id === 'w3', '★ the hub can be moved — a keeper moves house')
  ok(moved.marks.filter((m) => m.threshold).length === 1, '...and there is still exactly one')
  ok(moved.marks.length === 3, '...and nothing is lost')
  ok(thresholdOf(designate(net, 'nope'))?.id === 'w1', 'designating an unknown id changes nothing')
}

// ── ★ HUB AND SPOKE — the routing rule, in one place ──────────────────────────
{
  const net = netOf(3)
  const hub = thresholdOf(net)!
  const [s1, s2] = spokesOf(net)

  const home = destination(net, s1.id)
  ok('to' in home && home.to.id === hub.id, '★ a spoke goes home, with no destination named')

  const out = destination(net, hub.id, s2.id)
  ok('to' in out && out.to.id === s2.id, '★ the hub goes out to a NAMED spoke')

  const unnamed = destination(net, hub.id)
  ok('refused' in unnamed && unnamed.refused === 'is-threshold',
    '★ standing at the hub with nowhere named is "choose where to go", not "you are already there"')

  // ★★ NO SPOKE-TO-SPOKE. This is the whole hub-and-spoke claim; if it ever passes, the feature has
  // quietly become the arbitrary-destination mesh canon names as its failure case.
  const across = destination(net, s1.id, s2.id)
  ok('to' in across && across.to.id === hub.id,
    '★★ a spoke ignores a named destination and still goes home — there is no spoke-to-spoke hop')

  ok('refused' in destination(net, 'nope'), 'an unknown origin refuses')
  ok('refused' in destination(net, hub.id, 'nope'), 'an unknown destination refuses')
  const self = destination(net, hub.id, hub.id)
  ok('refused' in self && self.refused === 'same-mark', 'the hub cannot travel to itself')

  // A single lone hub has nowhere to go, and says so rather than resolving to itself.
  ok('refused' in destination(netOf(1), 'w1'), 'a lone hub has no passage yet')
}

// ── naming + arrival ──────────────────────────────────────────────────────────
{
  const named = rename(netOf(2), 'w2', 'the quarry')
  ok(markAt(named, 10, 64, 0)?.name === 'the quarry', 'a mark can be renamed')
  ok(rename(netOf(2), 'nope', 'x').marks.length === 2, 'renaming an unknown id is a no-op')
  ok(rename(netOf(2), 'w2', '').marks[1].name === '', 'an empty name is legal — the panel falls back')

  // ★ Arrival is the cell ABOVE the block, centred. A corner arrival puts the body half inside the
  // neighbouring cell, which the host's fit check then rejects for a spot that was actually fine.
  const a = arrivalOf({ id: 'w1', x: 10, y: 64, z: -4, name: '', threshold: true })
  ok(a.x === 10.5 && a.z === -3.5, '★ arrival is CENTRED in the cell, not on its corner')
  ok(a.y === 65, '★ ...and one above the block, standing on it rather than inside it')
}

// ── immutability — the host holds refs and re-renders off identity ────────────
{
  const before = netOf(2)
  const snapshot = JSON.stringify(before)
  plant(before, 77, 64, 77); pull(before, 'w1'); rename(before, 'w1', 'x'); designate(before, 'w2')
  ok(JSON.stringify(before) === snapshot, '★ every operation returns a new net and mutates nothing')
}
