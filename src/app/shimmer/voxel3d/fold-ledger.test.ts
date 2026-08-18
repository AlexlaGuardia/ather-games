// The fold-ledger oracle. Run: npx tsx src/app/shimmer/voxel3d/fold-ledger.test.ts
//
// This file guards a CANON VECTOR, not a formula. `game/shimmer-geography.md` › *THE GRIMOIRE IS
// WHAT GREG READS* rules that **knowing** widens a fold and that **materials never do** — *"the
// grimoire raises the CAP; the keeper's blocks fill it in"* — and that **both** of the grimoire's
// faces pay: meeting a spirit (the seeker) and keeping one (the liberator). Those three facts are
// the ones a future refactor can quietly break, because the obvious "upgrade" in any voxel game is
// a pile of resources, and it would look completely reasonable in a diff.
//
// The numbers below (TIER_NEED) are mine and are expected to move. The RULES are not.

import { foldLedger, foldOwed, foldTier, foldProgressLine, tierRadius, TIER_NEED } from './fold-ledger'
import { createSpiritIndex, markSeen, LAUNCHED_SPECIES } from '../engine/spirit-index'
import { PLOT_TIERS } from '../voxel/plot'
import type { Spirit } from '../spirits/spirit'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ⚠ SPIRITS CARRY A SPECIES HERE, because the ledger now unions the party's species into the
// index face (a spirit you hold is a species you know). A nameless stub would under-count.
const spirit = (n: number): Spirit => ({ name: `s${n}`, species: LAUNCHED_SPECIES[n % LAUNCHED_SPECIES.length] } as unknown as Spirit)
const party = (n: number): Spirit[] => Array.from({ length: n }, (_, i) => spirit(i))
const indexWith = (n: number) => {
  const ix = createSpiritIndex()
  for (let i = 0; i < n; i++) markSeen(ix, LAUNCHED_SPECIES[i])
  return ix
}

// ── 1. ★★ BOTH FACES PAY, AND THEY PAY ALONE ───────────────────────────────────────────────────
// The half of the ruling most at risk: before 2026-08-18 this world persisted no species index at
// all, so "knowledge" was derived from the spirits you HELD — which silently made the seeker's path
// worth nothing. A keeper who walks the whole garden meeting things and keeps none must be able to
// earn ground on that alone.
{
  const seekerOnly = foldLedger(indexWith(6), [])
  ok(seekerOnly.total === 6, `a keeper who only MET things has a ledger (${seekerOnly.total})`)
  ok(seekerOnly.earned >= 1, '★ and meeting alone can earn a wider fold — the seeker is paid')

  // ⚠ SIX IS ABOVE THIS BUILD'S ROSTER CAP OF FOUR — deliberately, because this asserts the RULE
  // (freeing pays) and not the ceiling. The ceiling is asserted on its own two sections down.
  const liberatorOnly = foldLedger(null, party(6))
  ok(liberatorOnly.total === 12, `a keeper who only FREED things has a ledger (${liberatorOnly.total})`)
  ok(liberatorOnly.earned >= 1, '★ and freeing alone can earn a wider fold — the liberator is paid')

  // ★ ONE ACT, ONE ENTRY, WHICHEVER FACE IT LANDS ON. Stated as a controlled comparison rather than
  // as a slogan: starting from the same book, KEEPING a spirit you had already met and MEETING a new
  // species must move the counter by exactly the same amount. Canon splits the acts; it does not
  // rank them.
  const base = foldLedger(indexWith(2), [])
  const keptOne = foldLedger(indexWith(2), [spirit(0)])       // a species already in the index
  const metOne = foldLedger(indexWith(3), [])
  ok(keptOne.total === base.total + 1, `keeping one adds one (${base.total} → ${keptOne.total})`)
  ok(metOne.total === base.total + 1, `meeting one adds one (${base.total} → ${metOne.total})`)
  ok(keptOne.total === metOne.total, 'the two faces pay at the SAME rate')

  // ★ THE REAL CEILING, STATED. Ten species and a four-spirit roster is everything this build can
  // hold, and the top tier must sit UNDER it or only a perfect keeper can ever be given it — which
  // is what the first cut of TIER_NEED did (tier 2 at exactly 14).
  const maxed = foldLedger(indexWith(LAUNCHED_SPECIES.length), party(4))
  ok(maxed.total === 14, `everything this build allows is 14 entries (${maxed.total})`)
  ok(TIER_NEED[TIER_NEED.length - 1] < maxed.total,
    `★ the top tier (${TIER_NEED[TIER_NEED.length - 1]}) sits below the ceiling (${maxed.total}), with slack`)
}

// ── 2. the same spirit may count twice, on purpose ─────────────────────────────────────────────
// Freeing a spirit you had never seen is two acts in canon's own split: you learned what one IS,
// and one is now yours. Taxing the overlap would make the most canon-shaped play the least rewarded.
{
  // The party's three species are the same first three the index marked, so the union holds them at
  // 3 — and they still pay twice, once per face. That is the point: met AND kept is two acts.
  const both = foldLedger(indexWith(3), party(3))
  ok(both.total === 6, `met 3 and kept 3 reads as 6 entries (${both.total})`)
  ok(both.seen === 3 && both.held === 3, 'and the two halves are still reported separately')
  // ★ AND A SPIRIT HELD WITHOUT EVER BEING MET STILL FILLS THE INDEX FACE — you plainly know what
  // is standing beside you. Without this the counter would DROP when a spirit is sent home.
  const heldOnly = foldLedger(null, party(2))
  ok(heldOnly.seen === 2, `holding two species knows two (${heldOnly.seen})`)
}

// ── 3. ★ MEETING THE SAME THING TWICE IS NOT PROGRESS ──────────────────────────────────────────
// The anti-farm property canon leans on: *"you cannot mine a species you have never met."* A patch
// a keeper camps must pay exactly once, or the ground CAN be ground out and the ruling's safety
// argument collapses.
{
  const ix = createSpiritIndex()
  for (let i = 0; i < 50; i++) markSeen(ix, 'fox')
  const l = foldLedger(ix, [])
  ok(l.seen === 1, `★ fifty encounters with one species is one entry (${l.seen})`)
  ok(l.total === 1, 'so camping a patch cannot buy ground')
}

// ── 4. the counter is legible, and it counts ENTRIES ───────────────────────────────────────────
// The ruling calls the grimoire *"the legible counter it never had"*. A keeper must always be able
// to tell whether they are two entries short or twenty.
{
  const l = foldLedger(indexWith(2), party(1))
  ok(l.toNext === TIER_NEED[1] - l.total, `says how many are owed (${l.toNext})`)
  const line = foldProgressLine(l)
  ok(/\d+ more/.test(line), `the line names a number — ${JSON.stringify(line)}`)
  ok(!/block|metre|meter|radius/i.test(line),
    '★ and it never prices ground in BLOCKS — the keeper is filling a book, not buying land')
  ok(!/cost|pay|price|coin|gold/i.test(line),
    '★ nor in money: canon says nothing is bought, he is rewarding his own life\'s work')
}

// ── 5. ★★ GROUND IS NEVER TAKEN BACK ───────────────────────────────────────────────────────────
// The additive-growth guarantee, at the decision that could break it. A keeper whose save sits at a
// tier their book no longer justifies (a retuned threshold, a hand-edited file, a party that shrank
// when spirits were sent home) must keep the ground they are standing on.
{
  const thin = foldLedger(null, [])
  ok(thin.earned === 0, 'an empty book earns the first fold and no more')
  ok(foldTier(thin, 2) === 2, '★ a keeper standing at tier 2 with an empty book KEEPS tier 2')
  ok(!foldOwed(thin, 2), 'and Greg has nothing to offer them, rather than something to take')
  ok(foldTier(thin, 0) === 0, 'while a fresh keeper stays where they are')
}

// ── 6. Greg owes a fold exactly when the book has outrun the ground ────────────────────────────
{
  const rich = foldLedger(indexWith(LAUNCHED_SPECIES.length), party(4))
  ok(rich.earned === TIER_NEED.length - 1, `a full book earns the top tier (${rich.earned})`)
  ok(foldOwed(rich, 0), 'and Greg owes a keeper still standing on their first fold')
  ok(!foldOwed(rich, TIER_NEED.length - 1), 'but owes nothing once it has been given')
  ok(rich.atTop && rich.toNext === 0, 'at the top there is nothing left to count toward')
  ok(/nothing left/i.test(foldProgressLine(rich)), 'and the line says so rather than showing 0 more')
}

// ── 7. ★ ONE THRESHOLD PER RADIUS, OR A FOLD EXISTS THAT NOBODY CAN EARN ───────────────────────
// The silent failure: a fourth entry in `PLOT_TIERS` with no threshold beside it is ground the game
// contains and no keeper can ever be given, and it would present as "the upgrade never comes".
{
  ok(TIER_NEED.length === PLOT_TIERS.length,
    `★ every radius has a threshold (${TIER_NEED.length} vs ${PLOT_TIERS.length})`)
  ok(TIER_NEED[0] === 0, 'the first fold is a gift, not an earning — Greg folds it before you can read')
  ok(TIER_NEED.every((n, i, a) => i === 0 || n > a[i - 1]), 'and the ladder only ever climbs')
  ok(PLOT_TIERS.every((r, i, a) => i === 0 || r > a[i - 1]), 'as do the radii')
  ok(tierRadius(0) === PLOT_TIERS[0] && tierRadius(99) === PLOT_TIERS[PLOT_TIERS.length - 1],
    'and naming a radius clamps rather than throwing — the tier comes off disk')
}

// ── 8. a nonsense ledger is a garden, not an exception ─────────────────────────────────────────
{
  ok(foldLedger(null, []).total === 0, 'no index and no party is simply an empty book')
  ok(foldTier(foldLedger(null, []), NaN) >= 0, 'and a nonsense saved tier still yields a number')
}

console.log(`fold ledger: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
