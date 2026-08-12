// Mining oracle. Run: npx tsx src/app/shimmer/voxel/mine.test.ts

import { AIR } from './section'
import { MAT } from './depth'
import { ORE } from './ore'
import { raycast, tickBreak, dropsFor, setBreakRate, getBreakRate, type BreakState } from './mine'
import { breakSeconds, canBreak, blockDef, materialForItem, BLOCKS } from './registry'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/** A world with one solid slab at y<=0 and a pillar of stone at (3,*,0). */
const world = (x: number, y: number, z: number): number => {
  if (y <= 0) return MAT.STONE
  if (x === 3 && z === 0 && y <= 3) return MAT.STONE
  if (x === 6 && z === 0 && y === 2) return ORE.RAW_MANA
  return AIR
}

// ── 1. the ray finds what you are looking at ─────────────────────────────────────────────────
{
  const hit = raycast(0.5, 2.5, 0.5, 1, 0, 0, 20, world)
  ok(!!hit, 'a ray down a corridor hits the pillar')
  ok(hit?.x === 3 && hit?.y === 2 && hit?.z === 0, `hit the right voxel (${hit?.x},${hit?.y},${hit?.z})`)
  ok(hit?.material === MAT.STONE, 'and reports its material')
  ok(hit?.px === 2, `the placement voxel is the empty one before it (px=${hit?.px})`)
}

// ── 2. ★ the ray must not tunnel through corners ─────────────────────────────────────────────
// The naive implementation samples at fixed steps and can pass through the corner of a block, so a
// wall you are plainly looking at occasionally refuses to be mined. Grid traversal cannot skip a
// voxel it enters — checked here on a diagonal, which is exactly where stepping fails.
{
  let missed = 0
  for (let i = 0; i < 200; i++) {
    const a = (i / 200) * Math.PI * 2
    const dx = Math.cos(a), dz = Math.sin(a)
    // Fire from inside the slab's airspace, downward-ish: every ray MUST hit the floor at y<=0.
    const hit = raycast(0.5, 3.5, 0.5, dx * 0.15, -1, dz * 0.15, 40, world)
    if (!hit || hit.y > 0) missed++
  }
  ok(missed === 0, `★ no ray tunnels through the floor (${missed}/200 missed)`)
}

// ── 3. nothing there is nothing ──────────────────────────────────────────────────────────────
{
  ok(raycast(0.5, 5.5, 0.5, 0, 1, 0, 20, world) === null, 'a ray into open sky hits nothing')
  ok(raycast(0.5, 2.5, 0.5, 1, 0, 0, 1, world) === null, 'maxDist is respected')
  const inside = raycast(3.5, 2.5, 0.5, 1, 0, 0, 10, world)
  ok(inside?.distance === 0, 'a ray starting inside a block hits it immediately')
}

// ── 4. the registry gates by tool, and refuses rather than slows ─────────────────────────────
{
  ok(breakSeconds(MAT.BEDROCK, 3, 'prospecting') === Infinity, 'bedrock never breaks')
  ok(breakSeconds(MAT.WATER, 3, 'prospecting') === Infinity, 'water never breaks')
  ok(breakSeconds(MAT.STONE, 0, null) === Infinity, 'stone refuses bare hands')
  ok(breakSeconds(MAT.STONE, 1, 'forestry') === Infinity, 'a blade will not cut stone — wrong family')
  ok(breakSeconds(MAT.STONE, 1, 'prospecting') < Infinity, 'a spike breaks stone')
  ok(breakSeconds(MAT.TOPSOIL, 0, null) < Infinity, 'soil yields to bare hands')

  // ★ The tier gate must REFUSE, not slow. A player grinding 40s on a block that was never going
  // to break is the worst version of this mechanic.
  ok(breakSeconds(ORE.PURE_CORE, 1, 'prospecting') === Infinity, '★ a tier-1 spike REFUSES pure core')
  ok(breakSeconds(ORE.PURE_CORE, 2, 'prospecting') < Infinity, 'a tier-2 spike breaks it')
  ok(breakSeconds(ORE.ATHER_CRYSTAL, 2, 'prospecting') === Infinity, 'ather crystal needs tier 3')
  ok(breakSeconds(ORE.ATHER_CRYSTAL, 3, 'prospecting') < Infinity, 'and a tier-3 spike gets it')
  ok(canBreak(MAT.STONE, 1, 'prospecting') && !canBreak(MAT.STONE, 0, null), 'canBreak agrees with breakSeconds')
}

// ── 5. the ladder is monotone in effort ──────────────────────────────────────────────────────
{
  const t = (m: number) => breakSeconds(m, 3, 'prospecting')
  ok(t(MAT.STONE) < t(ORE.RAW_MANA), 'ore is harder than its host rock')
  ok(t(ORE.RAW_MANA) < t(ORE.ELEMENT_VIOLET), 'tier 2 is harder than tier 1')
  ok(t(ORE.ELEMENT_VIOLET) < t(ORE.PURE_CORE), 'tier 3 is harder than tier 2')
  ok(t(ORE.PURE_CORE) < t(ORE.ATHER_CRYSTAL), 'tier 4 is hardest')
  ok(breakSeconds(MAT.STONE, 3, 'prospecting') < breakSeconds(MAT.STONE, 1, 'prospecting'),
     'a better spike is faster on the same block')
}

// ── 6. ★ break progress accumulates; it is not a timer ───────────────────────────────────────
{
  const target = { x: 3, y: 2, z: 0, material: MAT.STONE }
  const req = breakSeconds(MAT.STONE, 1, 'prospecting')
  let st: BreakState | null = null
  let broken = false, ticks = 0
  while (!broken && ticks < 1000) {
    const r = tickBreak(st, target, 0.05, 1, 'prospecting')
    st = r.state; broken = r.broken; ticks++
  }
  ok(broken, 'a held swing eventually breaks the block')
  ok(Math.abs(ticks * 0.05 - req) < 0.12, `it takes about the required time (${(ticks * 0.05).toFixed(2)}s vs ${req.toFixed(2)}s)`)

  // Interrupting and resuming the SAME block keeps progress — the property a timer cannot express.
  let a = tickBreak(null, target, 0.4, 1, 'prospecting').state
  ok(a!.progress > 0, 'progress accrues')
  const resumed = tickBreak(a, target, 0.1, 1, 'prospecting').state
  ok(resumed!.progress > a!.progress, '★ resuming the same block continues, it does not restart')

  // Looking at a different block discards it, or a player nibbles two hard blocks alternately.
  const other = { x: 3, y: 3, z: 0, material: MAT.STONE }
  const moved = tickBreak(a, other, 0.1, 1, 'prospecting').state
  ok(moved!.progress <= 0.1 + 1e-9, '★ switching target discards progress')

  // ★ Swapping to a better tool mid-break must shorten what remains.
  const midway = tickBreak(null, target, 0.5, 1, 'prospecting').state!
  const withBetter = tickBreak(midway, target, 0.01, 3, 'prospecting').state!
  ok(withBetter.required < midway.required, '★ a better tool lowers the requirement mid-break')
}

// ── 7. a refused block never accumulates ─────────────────────────────────────────────────────
{
  const r = tickBreak(null, { x: 0, y: 0, z: 0, material: MAT.BEDROCK }, 5, 3, 'prospecting')
  ok(r.state === null && !r.broken, 'bedrock accrues no progress and never breaks')
  const r2 = tickBreak(null, { x: 0, y: 0, z: 0, material: ORE.PURE_CORE }, 5, 1, 'prospecting')
  ok(r2.state === null && !r2.broken, 'an under-tier tool accrues nothing')
}

// ── 8. drops, and the item→block round trip ──────────────────────────────────────────────────
{
  ok(dropsFor(MAT.BEDROCK).length === 0, 'bedrock drops nothing')
  ok(dropsFor(MAT.WATER).length === 0, 'water drops nothing')
  ok(dropsFor(ORE.RAW_MANA)[0]?.itemId === 'raw_mana_shard', 'raw mana drops the RULED shard id')
  ok(dropsFor(ORE.PURE_CORE)[0]?.itemId === 'pure_mana_core', 'pure core drops the ruled core id')
  ok(dropsFor(ORE.ATHER_CRYSTAL)[0]?.itemId === 'ather_crystal', 'ather crystal drops the ruled id')
  // Placeable blocks must round-trip: break it, hold it, put it back as the same material.
  let bad = 0
  for (const b of BLOCKS) {
    if (!b.placeable) continue
    const item = b.drops[0]?.itemId
    if (!item || materialForItem(item) !== b.material) bad++
  }
  ok(bad === 0, `every placeable block round-trips item → material (${bad} broken)`)
  ok(materialForItem('raw_mana_shard') === undefined, 'an ore shard is not placeable as a block')
}

// ── 9. every material the world generates has a definition ───────────────────────────────────
// A material with no BlockDef is unmineable and unnamed — it would read as an invisible wall.
{
  const generated = [MAT.BEDROCK, MAT.DEEP_STONE, MAT.STONE, MAT.SUBSOIL, MAT.TOPSOIL, MAT.SAND, MAT.WATER,
    ORE.RAW_MANA, ORE.ELEMENT_VIOLET, ORE.ELEMENT_STORM, ORE.ELEMENT_EARTH, ORE.ELEMENT_WATER,
    ORE.PURE_CORE, ORE.ATHER_CRYSTAL]
  const missing = generated.filter(m => !blockDef(m))
  ok(missing.length === 0, `every generated material has a BlockDef (missing: ${missing.join(',')})`)
}

// ── THE fastSkill DISCOUNT BELONGS TO THE TOOL, NOT TO THE HAND (2026-08-12) ──────────────────
// `breakSeconds` was always right about this; the CALLER was wrong, passing the block's wanted
// skill even with nothing equipped, so bare hands dug at the full spade rate and the spade itself
// became worth 10% instead of ~50%. The registry contract is asserted here so the arithmetic that
// makes the tool worth owning is pinned somewhere a component cannot quietly undo it.
{
  const hand = breakSeconds(MAT.TOPSOIL, 0, null)
  const spade = breakSeconds(MAT.TOPSOIL, 1, 'farming', 0.9)
  const wrongTool = breakSeconds(MAT.TOPSOIL, 1, 'prospecting')
  ok(spade < hand, 'a spade digs soil faster than a bare hand')
  // The gap has to be worth reaching for. Half is the registry's own 0.55 factor; anything near 1
  // means the upgrade is invisible, which is the bug this pins.
  ok(spade < hand * 0.6, 'and the gap is a real tier, not a rounding error')
  ok(wrongTool < hand, 'any tool beats a fist on soft ground')
  ok(wrongTool > spade, 'but the RIGHT family is meaningfully better than a spike on dirt')
  // Hands must never be refused on ungated ground, or a fresh keeper with no tools is stranded.
  ok(hand < Infinity, 'bare hands can always dig ungated ground')
}

// ── the break-rate dial actually moves the break (2026-08-12) ─────────────────────────────────
// A tuning dial that quietly does nothing is worse than no dial: Alex would turn it, feel no
// difference, and conclude the FEEL is unfixable rather than that the knob is unwired.
{
  const target = { x: 0, y: 0, z: 0, material: MAT.STONE }
  const swing = (rate: number): number => {
    setBreakRate(rate)
    let s = null as ReturnType<typeof tickBreak>['state']
    for (let i = 0; i < 10_000; i++) {
      const r = tickBreak(s, target, 0.01, 1, 'prospecting')
      if (r.broken) return i + 1
      s = r.state
    }
    return -1
  }
  const normal = swing(1)
  const slow = swing(2)
  setBreakRate(1)                                   // ⚠ restore, or every later test inherits it
  ok(normal > 0, 'stone breaks at the normal rate')
  ok(slow > normal * 1.8 && slow < normal * 2.2, 'rate 2 makes stone take about twice as many ticks')
  setBreakRate(1000); ok(getBreakRate() <= 20, 'the dial clamps rather than making a block unbreakable')
  setBreakRate(0);    ok(getBreakRate() > 0, 'and clamps at the fast end rather than dividing by zero')
  setBreakRate(1)
}

console.log(`\nmining: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ you can dig')
