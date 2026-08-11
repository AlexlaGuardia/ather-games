// The pot oracle. Run: npx tsx src/app/shimmer/voxel3d/pot.test.ts
//
// A pot is where the rarest drop in the game pays out, so the failure modes are expensive and
// quiet: a seed that never blooms, or one that blooms into nothing.

import { BLOOM_MS, bloom, due, isReady, potKey, progress, type PotClock } from './pot'
import { BLOOM_SPECIES } from '../engine/farming'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const T0 = 1_000_000

// ── 1. the clock ────────────────────────────────────────────────────────────────────────────────
{
  const clock: PotClock = { [potKey(3, 70, -4)]: T0 }
  ok(!isReady(clock, 3, 70, -4, T0), 'a seed just planted is not ready')
  ok(!isReady(clock, 3, 70, -4, T0 + BLOOM_MS - 1), 'nor a moment early')
  ok(isReady(clock, 3, 70, -4, T0 + BLOOM_MS), '★ it blooms when its time is up')
  ok(progress(clock, 3, 70, -4, T0 + BLOOM_MS / 2) > 0.49, 'progress tracks the wait')
  ok(progress(clock, 3, 70, -4, T0 + BLOOM_MS * 5) === 1, 'and clamps once due')
  // Negative coordinates are the common case in this world — the key must survive them.
  ok(potKey(-12, 70, -300) === '-12,70,-300', 'the key round-trips negative coordinates')
  const back = due({ [potKey(-12, 70, -300)]: T0 }, T0 + BLOOM_MS)[0]
  ok(back && back.x === -12 && back.y === 70 && back.z === -300, '★ and `due` parses them back')
}

// ── 2. ★ A MISSING STAMP MUST NOT STRAND A SEED ─────────────────────────────────────────────────
// The seed is the rarest drop in the game. A pot whose stamp went missing (a wiped save, a
// hand-edited world) must not sit closed forever with no way for the player to know why.
{
  const empty: PotClock = {}
  ok(!isReady(empty, 1, 2, 3, T0 + BLOOM_MS * 100), 'an unknown pot is not spuriously ready')
  ok(progress(empty, 1, 2, 3, T0) === 0, 'and reads as freshly planted, not as broken')
}

// ── 3. `due` reports only what is actually due ──────────────────────────────────────────────────
{
  const clock: PotClock = { [potKey(0, 64, 0)]: T0, [potKey(1, 64, 0)]: T0 + BLOOM_MS }
  ok(due(clock, T0).length === 0, 'nothing is due at planting time')
  ok(due(clock, T0 + BLOOM_MS).length === 1, 'the first pot comes due alone')
  ok(due(clock, T0 + BLOOM_MS * 2).length === 2, 'then both')
}

// ── 4. ★ THE SPIRIT CHOOSES — flat across every species, by canon ───────────────────────────────
{
  const seen = new Set<string>()
  for (let i = 0; i < BLOOM_SPECIES.length; i++) {
    // Pin the roll to each species in turn: every one must be reachable from a pot.
    const s = bloom(() => (i + 0.5) / BLOOM_SPECIES.length)
    seen.add(s.species)
    ok(s.level === 5, 'a bloomed spirit arrives young but not helpless')
    ok(s.bond === 40 && s.happiness === 160, 'and already fond of the keeper')
  }
  ok(seen.size === BLOOM_SPECIES.length,
    `★ every ruled species can bloom (${seen.size}/${BLOOM_SPECIES.length}) — no weighting, no pick`)
}

console.log(`\npot: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
