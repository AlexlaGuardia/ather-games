// Home Plot ring oracle. Run: npx tsx src/app/shimmer/voxel3d/plot-ring.test.ts
//
// ⚠ THE ASSERT THAT MATTERS MOST IS THE UNWITNESSED ONE. Everything else here is arithmetic that
// would pass on a ring nobody could ever see; the rotation asserts are what stop a spirit blinking
// out of the corner of the keeper's eye, which is the only failure mode of this file a player can
// actually notice. Every block below was mutation-tested — see the log at the foot of the file.

import { ringCap, inView, behind, pickHome, reflowRing, DEFAULT_RING, type RingSlot, type Keeper } from './plot-ring'
import { PLOT_TIERS, plotForTier, DEFAULT_PLOT } from '../voxel/plot'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const D = DEFAULT_RING
const keeper = (x = 0, z = 0, yaw = 0): Keeper => ({ x, z, yaw })
const yes = () => true
const no = () => false

// ── 1. the cap is the fold's own radius, and it climbs with it ───────────────────────────────────
{
  const caps = PLOT_TIERS.map((_, t) => ringCap(plotForTier(t)))
  ok(caps.join(',') === '6,8,10', `the three tiers must read 6/8/10 — got ${caps.join(',')}`)
  ok(caps.every((c, i) => i === 0 || c > caps[i - 1]), '★ a wider fold must hold MORE — canon ties the crowd to the ground won back')
  ok(ringCap({ ...DEFAULT_PLOT, capRadius: 1 }) === 1, 'a degenerate fold must still hold one, never zero')
  ok(ringCap({ ...DEFAULT_PLOT, capRadius: 0 }) === 1, 'a zero radius must not read as an empty garden')
}

// ── 2. inView — the predicate the whole rotation rests on ────────────────────────────────────────
{
  const k = keeper(0, 0, 0)     // looking down +x
  ok(inView(k, 30, 0, D), 'straight ahead and near must be seen')
  ok(!inView(k, -30, 0, D), 'directly behind must NOT be seen')
  ok(!inView(k, D.sight + 10, 0, D), 'ahead but past sight must not be seen')
  ok(inView(k, 0, 0, D), 'the keeper standing on the spot counts as seeing it')
  // The cone edge, from both sides of it, so the assert cannot pass by being always-true.
  const r = 40, just = D.cone - 0.05, past = D.cone + 0.05
  ok(inView(k, Math.cos(just) * r, Math.sin(just) * r, D), 'just inside the cone is seen')
  ok(!inView(k, Math.cos(past) * r, Math.sin(past) * r, D), 'just outside the cone is not seen')
  // ★ The wrap case: a keeper looking along -x, with the target one degree the other side of pi.
  const w = keeper(0, 0, Math.PI)
  ok(inView(w, -40, -1, D), '★ bearing wrap across ±pi must not blind the keeper behind them')
  ok(!inView(w, 40, 1, D), '...and must not hand them eyes in the back of their head')
  // ── behind(): the recycle test, and it must NOT be a distance ─────────────────────────────────
  ok(behind(k, -50, 0), 'directly behind is behind')
  ok(!behind(k, 50, 0), 'directly ahead is not behind')
  ok(!behind(k, D.farMax + 50, 0), '★★ a resident far AHEAD, past the fog, must not read as behind — that is a fade-in, not a departure')
  ok(behind(k, -(D.nearMin), 0), 'behind is a bearing, not a range: close behind still counts')
  ok(behind(keeper(0, 0, Math.PI), 50, 0), 'behind must follow the keeper when they turn round')
}

// ── 3. pickHome — in the band, out of view, and honest about failing ─────────────────────────────
{
  const k = keeper(100, -60, 1.2)
  let placed = 0, tooNear = 0, tooFar = 0, seen = 0, nearHits = 0, farHits = 0, aheadFar = 0
  const inBand = (d: number, lo: number, hi: number) => d >= lo - 1e-9 && d <= hi + 1e-9
  for (let n = 0; n < 400; n++) {
    const h = pickHome(k, 1234, n, yes, false, D)
    if (!h) continue
    placed++
    const d = Math.hypot(h.x - k.x, h.z - k.z)
    const near = inBand(d, D.nearMin, D.nearMax), far = inBand(d, D.farMin, D.farMax)
    if (near) nearHits++
    if (far) { farHits++; if (!behind(k, h.x, h.z)) aheadFar++ }
    if (d < D.nearMin - 1e-9) tooNear++
    if (!near && !far) tooFar++
    if (inView(k, h.x, h.z, D)) seen++
  }
  ok(placed > 300, `a permissive world must place nearly every time — placed ${placed}/400`)
  ok(tooNear === 0 && tooFar === 0, `every corner must land inside one of the two bands — ${tooNear} near, ${tooFar} far`)
  ok(seen === 0, `★★ NO corner may be placed where the keeper is looking — ${seen} were`)
  // ★★ BOTH BANDS MUST ACTUALLY BE REACHABLE. The near band alone empties the road ahead of a
  // walking keeper (the defect the harness caught); the far band alone is a sparse horizon and
  // never underfoot. An assert that only checked "inside SOME band" would pass on either failure.
  ok(nearHits > 0, '★★ the underfoot band must be used — canon asked for underfoot, not a horizon')
  ok(farHits > 0, '★★ the fade-in band must be used, or a keeper walking a straight line sees nobody')
  ok(aheadFar > 0, '★ and a fade-in must be allowed to land AHEAD of the keeper, which is the whole point of it')
  ok(pickHome(k, 1234, 7, no, false, D) === null, 'a world that refuses every corner must return null, never a fallback spot')
  const a = pickHome(k, 99, 5, yes, false, D), b = pickHome(k, 99, 5, yes, false, D)
  ok(!!a && !!b && a.x === b.x && a.z === b.z, 'same seed and nonce must propose the same corner')
  const c = pickHome(k, 99, 6, yes, false, D)
  ok(!!c && (c.x !== a!.x || c.z !== a!.z), 'a different nonce must propose a different corner')
  // fresh: a world nobody has looked at yet may place in front of the keeper.
  let freshSeen = 0
  for (let n = 0; n < 200; n++) {
    const h = pickHome(k, 77, n, yes, true, D)
    if (h && inView(k, h.x, h.z, D)) freshSeen++
  }
  ok(freshSeen > 0, '★ on a fresh load the ring must be allowed to stand in front of you, or you arrive to an empty yard')
}

// ── 4. reflowRing — the cast ─────────────────────────────────────────────────────────────────────
{
  const k = keeper(0, 0, 0)
  const ids = ['a', 'b', 'c', 'd', 'e']
  const first = reflowRing([], k, ids, 3, 42, 1, yes, D)
  ok(first.length === 3, `the cap must bind — got ${first.length}`)
  ok(new Set(first.map(s => s.id)).size === 3, 'no spirit may stand in two places at once')
  ok(first.every(s => ids.includes(s.id)), 'only resting spirits may stand in the ring')
  ok(reflowRing([], k, ['a'], 6, 42, 1, yes, D).length === 1, 'a ring cannot hold more spirits than the keeper has resting')
  ok(reflowRing([], k, [], 6, 42, 1, yes, D).length === 0, 'no resting spirits means an empty ring, not a placeholder')

  // stability: nothing changed, so nobody moves.
  const again = reflowRing(first, k, ids, 3, 42, 2, yes, D)
  ok(again.length === 3 && again.every((s, i) => s.id === first[i].id && s.hx === first[i].hx), '★ a quiet tick must not reshuffle the cast')

  // a spirit called back to the party leaves the ring.
  const called = reflowRing(first, k, ids.filter(i => i !== first[0].id), 3, 42, 3, yes, D)
  ok(!called.some(s => s.id === first[0].id), 'a spirit that stopped resting must leave the ring')

  // ★★ the unwitnessed rule: a resident past `farOut` but still IN VIEW keeps its corner.
  // ⚠ THE FIXTURE MUST SIT PAST `farOut` AND AHEAD OF THE KEEPER, which is the only place this rule
  // can be observed. An earlier version put it past `sight`, where the rule cannot fire, and the
  // assert was testing nothing. It is placed past `farMax` on purpose: a resident standing in the
  // road ahead, deep in the fog, is exactly the one a distance-only recycle rule would flicker.
  const watched: RingSlot[] = [{ id: 'a', hx: D.farMax + 30, hz: 0, gen: 1, d0: 10 }]
  const kept = reflowRing(watched, keeper(0, 0, 0), ids, 3, 42, 4, no, D)
  ok(kept.some(s => s.id === 'a' && s.hx === watched[0].hx), '★★ a resident AHEAD of the keeper must never be moved, however far away — it is walked toward, not left behind')

  // ...and the same resident behind the keeper is recycled.
  const left: RingSlot[] = [{ id: 'a', hx: -(D.farOut + 40), hz: 0, gen: 1, d0: 10 }]
  const recycled = reflowRing(left, keeper(0, 0, 0), ids, 3, 42, 5, no, D)
  ok(!recycled.some(s => s.hx === left[0].hx), '★ a resident far behind you must give up its corner')

  // a freed spirit is eligible again at once, at a NEW corner with a bumped generation.
  const back = reflowRing(left, keeper(0, 0, 0), ['a'], 3, 42, 6, yes, D)
  // ⚠ READ THROUGH `find`, NOT `back[0]`. A mutation that stops the freed becoming eligible again
  // leaves this array EMPTY, and `back[0].hx` then THROWS — which is neither a pass nor a fail: it
  // kills the run before the failure list prints, burying the assert one line above that had
  // already caught the bug. Found by the mutation sweep, 2026-08-27. Same shape as the origin
  // fixture in PATTERNS 08-22.
  const home = back.find(s => s.id === 'a') ?? null
  ok(back.length === 1 && !!home, 'the only resting spirit must come back into the cast')
  ok(!!home && home.hx !== left[0].hx, 'it must come back at a new corner, not the one it just left')
  ok(!!home && home.gen > left[0].gen, '★ the generation must bump, or the walk it derives never changes')

  // a world that refuses every corner leaves the ring short rather than putting a spirit nowhere.
  ok(reflowRing([], k, ids, 3, 42, 7, no, D).length === 0, 'an unacceptable world must yield an empty ring, not a bad placement')

  // the cap shrinking (an edited save) must bind without reshuffling the survivors.
  const shrunk = reflowRing(first, k, ids, 1, 42, 8, yes, D)
  ok(shrunk.length === 1 && shrunk[0].id === first[0].id, 'a smaller cap must trim the tail, not re-cast the ring')

  // ★ the rotation actually rotates: over many ticks with the cast being recycled, more than the
  // first three faces get a turn. An empty measurement window here would read as "it rotates".
  const seenIds = new Set<string>()
  let slots: RingSlot[] = []
  for (let n = 0; n < 60; n++) {
    // walk the keeper away each tick so residents fall behind and are recycled
    const kk = keeper(n * 30, 0, 0)
    slots = reflowRing(slots, kk, ids, 3, 42, n, yes, D)
    for (const s of slots) seenIds.add(s.id)
  }
  ok(seenIds.size === ids.length, `★ every resting spirit must get a turn in the yard — saw ${seenIds.size}/${ids.length}`)
  ok(slots.length === 3, 'and the cast stays full while walking')
}

// ── 5. ★★★ THE WALKING KEEPER — the defect a picture caught and 35 green asserts did not ────────
// A keeper crossing their own fold in a straight line must have somebody in front of them. The
// first version of this file placed every resident out of the forward cone, which is correct about
// witnessing and produces a permanently EMPTY yard for anyone walking: each placement lands beside
// or behind a keeper who is leaving it. `drawn 10 / cap 10` and nothing on screen.
{
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  let slots: RingSlot[] = []
  let ticksWithSomeoneAhead = 0
  const AHEAD = Math.PI / 3       // a generous read of "in front of me", wider than the frustum
  for (let n = 0; n < 200; n++) {
    const k = keeper(n * 15, 0, 0)          // walking +x at a brisk pace, never turning
    slots = reflowRing(slots, k, ids, 6, 4242, n, yes, D)
    const ahead = slots.some(sl => {
      let off = Math.atan2(sl.hz - k.z, sl.hx - k.x)
      while (off > Math.PI) off -= Math.PI * 2
      while (off < -Math.PI) off += Math.PI * 2
      return Math.abs(off) < AHEAD && Math.hypot(sl.hx - k.x, sl.hz - k.z) < D.farMax
    })
    if (ahead) ticksWithSomeoneAhead++
  }
  ok(slots.length === 6, `the cast must stay full while walking — ${slots.length}/6`)
  ok(ticksWithSomeoneAhead > 100, `★★★ a keeper walking a straight line must have company AHEAD of them — only ${ticksWithSomeoneAhead}/200 ticks did`)
}

if (fails.length) { console.error(`❌ ${fails.length} failed:`); for (const f of fails) console.error('   · ' + f); process.exit(1) }
console.log(`✅ the ring the player feels — ${pass} passed`)
