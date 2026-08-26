// Loadout migration oracle — what happens to a bar a keeper already built when the slots collapse.
// Run: npx tsx src/app/shimmer/play3d/loadout-migrate.test.ts
//
// ── WHY THIS FILE IS SEPARATE FROM loadout.test.ts ────────────────────────────────────────────
// That file asserts the rules of a stored choice against the CURRENT `CAST_SLOTS`. This one is
// about the moment `CAST_SLOTS` CHANGES, so it must be able to talk about a shape the constant
// does not have yet. It passes the target slot list explicitly for exactly that reason: the whole
// point is to prove the two-slot behaviour BEFORE two slots ship, because a migration first
// exercised on the day of the collapse is a migration nobody has tested.
//
// ⚠ The failure this prevents is silent and total. Not a wrong move in a slot — an EMPTY BAR, on
// load, for every keeper who ever picked a loadout, with nothing on screen that looks like an
// error.

import {
  LEGACY_CAST_SLOTS, migrateLegacyLoadout, isLegacyLoadout,
} from './loadout'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/** The shape the ruling collapses to: one tactical, one signature (canon's Ultimate band). */
const TWO = ['tactical', 'ultimate'] as const

/** A bar a keeper actually built, in the four-slot era. */
const LEGACY = ['iron-skin', 'stonewall', 'shackle', 'cordon']

// ── the fixture itself, asserted rather than assumed ──────────────────────────────────────────
// loadout.test.ts learned this the hard way: a block that derives its own subject can quietly
// select a case where the rule under test does not apply, and then pass. So state the premise.
{
  ok(LEGACY.length === LEGACY_CAST_SLOTS.length,
     'fixture: the legacy bar has exactly one entry per legacy slot')
  ok(LEGACY_CAST_SLOTS.join() === 'passive,tactical,tactical,ultimate',
     'fixture: the legacy slot list is the one the ruling names — if this moves, every case below is about a different game')
  ok(TWO.length === 2 && TWO[0] === 'tactical' && TWO[1] === 'ultimate',
     'fixture: the target is the ruled two-slot bar')
}

// ── ★★★ THE BUG, REPRODUCED — this is what shipping without the migration looks like ──────────
// Positional read of a 4-entry save through a 2-entry slot list. Slot 0 (now tactical) receives
// the old PASSIVE id; slot 1 (now ultimate) receives the first TACTICAL id. Both are tier
// mismatches, so `canSlot` nulls both and the keeper loads in with an empty bar.
{
  const naive = TWO.map((_, i) => LEGACY[i])          // what the un-migrated code path does
  ok(naive[0] === 'iron-skin' && naive[1] === 'stonewall',
     '★ un-migrated, slot 0 gets the PASSIVE and slot 1 gets a TACTICAL — both wrong tiers')
  ok(naive[0] !== 'stonewall' && naive[1] !== 'cordon',
     '★★★ and neither slot receives the move that belongs there — this is the empty bar, before canSlot even runs')
}

// ── the migration ─────────────────────────────────────────────────────────────────────────────
{
  const out = migrateLegacyLoadout(LEGACY, TWO)
  ok(out.length === 2, 'a migrated bar has exactly one entry per target slot')
  ok(out[0] === 'stonewall', '★ the tactical slot keeps the keeper\'s FIRST tactical')
  ok(out[1] === 'cordon', '★ the signature slot keeps the keeper\'s ultimate')
  ok(!out.includes('iron-skin'), 'the passive is dropped — it is DERIVED and always-on now (cast.ts › derivePassive), so the stored id was redundant, not lost')
  ok(!out.includes('shackle'), 'the second tactical has nowhere to go and is not smuggled into the signature slot')
}

// ── ★ IDENTITY WHILE THE CONSTANT IS STILL FOUR ───────────────────────────────────────────────
// This is what makes it safe to land the net before the fall: today `CAST_SLOTS` is still the
// legacy list, and re-seating four kinds into the same four kinds must change nothing at all.
{
  const out = migrateLegacyLoadout(LEGACY, LEGACY_CAST_SLOTS)
  ok(JSON.stringify(out) === JSON.stringify(LEGACY),
     '★★ migrating into the legacy shape is the identity — the net is inert until the collapse ships')
}

// ── idempotence ───────────────────────────────────────────────────────────────────────────────
// A migrated 2-array is not length 4, so it is not legacy, so it is never re-seated. Asserted
// rather than reasoned about: a migration that runs twice is how the second run eats the first.
{
  const once = migrateLegacyLoadout(LEGACY, TWO)
  ok(!isLegacyLoadout(once), '★ a migrated bar no longer reads as legacy, so it cannot be migrated again')
  ok(isLegacyLoadout(LEGACY), 'and the legacy bar does read as legacy')
  ok(!isLegacyLoadout(['a']), 'a short save is not mistaken for a legacy one')
  ok(!isLegacyLoadout([]), 'nor is an empty one')
}

// ── holes, which are choices ──────────────────────────────────────────────────────────────────
// `loadout.ts` is explicit that a saved null is a deliberate empty, not a hole to fill. The
// migration must carry that intent across rather than helpfully promoting the next move into it.
{
  const noUlt = ['iron-skin', 'stonewall', 'shackle', null]
  const out = migrateLegacyLoadout(noUlt, TWO)
  ok(out[0] === 'stonewall', 'a keeper who ran without an ultimate keeps their tactical')
  ok(out[1] === null, '★ and their empty signature slot stays empty — it was a decision, not a gap')

  const noTac = ['iron-skin', null, null, 'cordon']
  const out2 = migrateLegacyLoadout(noTac, TWO)
  ok(out2[0] === null, 'an empty tactical stays empty')
  ok(out2[1] === 'cordon', 'and the ultimate still lands')
}

// ── second tactical promoted when the first is empty ──────────────────────────────────────────
// Deliberate: the two legacy tacticals were interchangeable slots of one kind, so "the tactical
// this keeper had" is whichever one held a move. This is the case a hardcoded `new[0] = old[1]`
// index map gets wrong, which is why the mapping is derived from the kind lists instead.
{
  const out = migrateLegacyLoadout(['iron-skin', null, 'shackle', 'cordon'], TWO)
  ok(out[0] === 'shackle',
     '★★ with the first tactical empty, the SECOND one takes the tactical slot — a hand-written index map would have returned null here')
}

// ── a short/garbage legacy save ───────────────────────────────────────────────────────────────
{
  const out = migrateLegacyLoadout([], TWO)
  ok(out.length === 2 && out.every((s) => s === null), 'an empty input yields empty slots, not a throw')
}

console.log(`${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  FAIL: ' + f)
process.exit(fails.length ? 1 : 0)
