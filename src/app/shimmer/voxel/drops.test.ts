// Dropped-item oracle. Run: npx tsx src/app/shimmer/voxel/drops.test.ts
//
// Item entities fail in ways that look like nothing: a drop that sinks a fraction into the floor on
// every landing eventually vanishes inside it; a drop vacuumed on its spawn frame never visibly
// falls at all, which is the entire point of the feature; an entity list compacted mid-loop
// silently skips entries. All three are cheap to assert and unpleasant to find by playing.

import { spawnDrop, tickDrops, resetDropIds, DEFAULT_DROPS, type Drop } from './drops'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/** Flat world: solid at y < 10. */
const floor = (_x: number, y: number, _z: number) => y < 10
const nothing = () => false
const FAR: [number, number, number] = [9999, 9999, 9999]

const run = (drops: Drop[], seconds: number, player: [number, number, number] = FAR, solid = floor) => {
  const picked: { itemId: string; count: number }[] = []
  const expired: number[] = []
  for (let t = 0; t < seconds; t += 1 / 60) {
    const r = tickDrops(drops, 1 / 60, player[0], player[1], player[2], solid)
    picked.push(...r.picked); expired.push(...r.expired)
  }
  return { picked, expired }
}

// ── 1. a drop falls and comes to rest ON the floor, not in it ────────────────────────────────
{
  resetDropIds()
  const d = [spawnDrop('block_stone', 1, 5, 20, 5)]
  run(d, 4)
  ok(d.length === 1, 'the drop still exists')
  ok(d[0].resting, 'it comes to rest')
  ok(d[0].y >= 10 && d[0].y < 11.5, `it rests on top of the floor, not inside it (y=${d[0].y.toFixed(2)})`)
}

// ── 2. ★ resting must be STABLE — no slow sink ───────────────────────────────────────────────
// Landing at the sample point instead of on top of the block sinks the drop a fraction on every
// landing. Over a minute it ends up inside the floor and invisible.
{
  resetDropIds()
  const d = [spawnDrop('block_stone', 1, 5, 20, 5)]
  run(d, 4)
  const settled = d[0].y
  run(d, 30)
  ok(Math.abs(d[0].y - settled) < 1e-6, `★ a resting drop does not sink over time (${settled.toFixed(3)} → ${d[0].y.toFixed(3)})`)
}

// ── 3. ★ the pickup delay is what makes the drop VISIBLE ─────────────────────────────────────
// With no delay the drop is collected on its spawn frame and the player never sees it leave the
// block — which would make this whole feature a no-op with extra steps.
{
  resetDropIds()
  const d = [spawnDrop('raw_mana_shard', 1, 5, 12, 5)]
  const r = tickDrops(d, 1 / 60, 5.5, 12, 5.5, floor)   // player standing right on it
  ok(r.picked.length === 0, '★ a fresh drop is NOT collected on its spawn frame')
  ok(d.length === 1, 'and it still exists')
  const later = run(d, 1, [5.5, 11, 5.5])
  ok(later.picked.length === 1, 'once the delay expires it is collected')
  ok(d.length === 0, 'and it is removed from the world')
}

// ── 4. pickup is by proximity, and only in range ─────────────────────────────────────────────
{
  resetDropIds()
  const d = [spawnDrop('raw_mana_shard', 3, 5, 12, 5)]
  const away = run(d, 3, [40, 12, 40])
  ok(away.picked.length === 0, 'a distant player collects nothing')
  ok(d.length === 1, 'the drop survives')
  const near = run(d, 1, [5.5, 10.8, 5.5])
  ok(near.picked.length === 1 && near.picked[0].count === 3, 'walking over it collects the whole stack')
}

// ── 5. same-item drops merge; different items do not ─────────────────────────────────────────
{
  resetDropIds()
  const d = [
    spawnDrop('block_stone', 1, 5, 12, 5),
    spawnDrop('block_stone', 1, 5, 12, 5),
    spawnDrop('block_stone', 1, 5, 12, 5),
  ]
  run(d, 2)
  ok(d.length === 1, `three identical drops in one place merge to one (${d.length})`)
  ok(d[0].count === 3, `and the counts add up (${d[0].count})`)

  resetDropIds()
  const mixed = [spawnDrop('block_stone', 1, 5, 12, 5), spawnDrop('raw_mana_shard', 1, 5, 12, 5)]
  run(mixed, 2)
  ok(mixed.length === 2, 'different items never merge')
}

// ── 6. a merge must not skip the survivor's fall ─────────────────────────────────────────────
// If the merged entity inherits the SHORTER delay, a fresh drop fusing into an older one becomes
// instantly collectable and never falls.
{
  resetDropIds()
  const old = spawnDrop('block_stone', 1, 5, 12, 5)
  old.pickupDelay = 0
  const fresh = spawnDrop('block_stone', 1, 5, 12, 5)
  const d = [old, fresh]
  tickDrops(d, 1 / 60, 5.5, 12, 5.5, floor)
  ok(d.length === 1, 'they merged')
  ok(d[0].pickupDelay > 0, '★ the survivor keeps the LONGER delay, so the fresh drop still falls')
}

// ── 7. drops rest on a cave floor, not on the surface far above ──────────────────────────────
// The reason physics resolves against the voxel grid rather than a heightfield: a heightfield check
// puts a drop mined underground on the terrain surface, hundreds of blocks up.
{
  resetDropIds()
  // Solid everywhere except a pocket from y 20..25 — the "cave".
  const cave = (_x: number, y: number, _z: number) => !(y >= 20 && y <= 25)
  const d = [spawnDrop('raw_mana_shard', 1, 5, 24, 5)]
  run(d, 4, FAR, cave)
  ok(d.length === 1 && d[0].resting, 'the drop settles')
  ok(d[0].y > 20 && d[0].y < 22.5, `★ it rests on the CAVE floor, not the surface (y=${d[0].y.toFixed(2)})`)
}

// ── 8. terminal velocity stops tunnelling ────────────────────────────────────────────────────
{
  resetDropIds()
  const d = [spawnDrop('block_stone', 1, 5, 250, 5)]
  run(d, 12)
  ok(d.length === 1, 'a long fall does not lose the drop')
  ok(d[0].y >= 10, `★ it did not tunnel through the floor (y=${d[0].y.toFixed(2)})`)
  ok(Math.abs(d[0].vy) <= DEFAULT_DROPS.terminal + 1e-6, 'speed stays capped')
}

// ── 9. despawn ───────────────────────────────────────────────────────────────────────────────
{
  resetDropIds()
  const d = [spawnDrop('block_stone', 1, 5, 12, 5)]
  d[0].age = DEFAULT_DROPS.despawnSeconds - 0.01
  const r = tickDrops(d, 1 / 30, ...FAR, floor)
  ok(r.expired.length === 1, 'an old drop despawns')
  ok(d.length === 0, 'and leaves the list')
}

// ── 10. ★ compaction must not skip entries ───────────────────────────────────────────────────
// Splicing mid-loop is the classic entity-list bug: remove index i and index i+1 is never visited.
{
  resetDropIds()
  const d: Drop[] = []
  for (let i = 0; i < 24; i++) d.push(spawnDrop('block_stone', 1, i * 4, 12, 0))   // far apart, no merging
  for (const x of d) x.pickupDelay = 0
  // Player sits on top of every other drop, so alternating entries are collected in one tick.
  let collected = 0
  for (let i = 0; i < 24; i += 2) {
    const r = tickDrops(d, 1 / 60, i * 4 + 0.5, 12, 0.5, floor)
    collected += r.picked.length
  }
  ok(collected === 12, `every targeted drop was collected, none skipped (${collected}/12)`)
  ok(d.length === 12, `and exactly the untouched ones remain (${d.length})`)
  ok(d.every(x => x.count > 0), 'no zero-count entity survives compaction')
}

// ── 11. determinism ──────────────────────────────────────────────────────────────────────────
{
  resetDropIds()
  const a = spawnDrop('block_stone', 1, 7, 30, 11)
  resetDropIds()
  const b = spawnDrop('block_stone', 1, 7, 30, 11)
  ok(a.vx === b.vx && a.vz === b.vz, 'the same block throws its drop the same way every time')
  resetDropIds()
  const c = spawnDrop('block_stone', 1, 8, 30, 11)
  ok(a.vx !== c.vx || a.vz !== c.vz, 'different blocks throw differently')
}

// ── ★ A FULL BAG REFUSES THE PICKUP (2026-08-11) ────────────────────────────────────────────────
// The drop used to be consumed here and the leftover discarded upstream, so walking over a stack
// you had no room for destroyed it. The item must stay on the ground, and a PARTIAL accept must
// leave its remainder behind rather than rounding to all-or-nothing.
{
  const mk = () => [spawnDrop('block_stone', 10, 0, 10, 0)].map(d => { d.pickupDelay = 0; d.y = 10; return d })
  const ground = (x: number, y: number, z: number) => y < 10

  const full = mk()
  const r0 = tickDrops(full, 0.016, 0.5, 10, 0.5, ground, undefined, () => 0)
  ok(r0.picked.length === 0, '★ a full bag picks up nothing')
  ok(full.length === 1 && full[0].count === 10, '★ and the drop is still lying there, intact')

  const part = mk()
  const r1 = tickDrops(part, 0.016, 0.5, 10, 0.5, ground, undefined, () => 4)
  ok(r1.picked[0]?.count === 4, 'a partial accept takes what fits')
  ok(part.length === 1 && part[0].count === 6, '★ and leaves the remainder on the ground')

  const room = mk()
  const r2 = tickDrops(room, 0.016, 0.5, 10, 0.5, ground, undefined, () => 999)
  ok(r2.picked[0]?.count === 10, 'room to spare takes the whole stack')
  ok(room.length === 0, 'and the drop is gone')

  const legacy = mk()
  const r3 = tickDrops(legacy, 0.016, 0.5, 10, 0.5, ground)
  ok(r3.picked[0]?.count === 10, 'no capacity fn = take everything (the old behaviour)')
}

console.log(`\ndropped items: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ blocks land on the floor')
