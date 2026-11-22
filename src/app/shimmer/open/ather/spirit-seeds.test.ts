// Run: npx tsx src/app/shimmer/open/ather/spirit-seeds.test.ts
// M76 s1: the seed decides the species (never the pot or a roll), one spirit per planter, the Anemonyx's 5-10 day visits
// (there that day only, one seed per visit), the grimoire fills in discovery order and survives a save round-trip.
import { SPECIES, SEED_IDS, seedOf, speciesOf, isSeed, plant, ripen, liftPot, growth, BLOOM_MS, visitDay, visitOn, nextVisit, visitSeed, meetAnemonyx, VISIT_MIN_DAYS, VISIT_MAX_DAYS, SEED_NAME } from './spirit-seeds'
import { freshBook, see, bond, seenCount, seenSet, parseBook } from './grimoire-book'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

ok(SPECIES.length === 10 && SEED_IDS.length === 10, 'ten seeds, one per base form')
ok(SEED_IDS.every(isSeed) && !isSeed('mana_seed') && !isSeed('mana_seed_storm'), 'no generic seed, no element seed')
ok(SEED_NAME === 'Mana Seed', 'every seed is named just Mana Seed')
ok(SPECIES.every(s => speciesOf(seedOf(s)) === s), 'a seed already is its species')

// the planter: the seed decides; one spirit per planter
const t0 = 1_000_000
let pots = plant({}, 'p1', seedOf('owl'), t0)!
ok(pots && plant(pots, 'p1', seedOf('fox'), t0) === null, 'a planter holds one seed')
pots = plant(pots, 'p2', seedOf('fox'), t0 + 10)!
ok(ripen(pots, t0 + BLOOM_MS - 1).bloomed.length === 0, 'nothing blooms early')
ok(Math.abs(growth(pots.p1, t0 + BLOOM_MS / 2) - 0.5) < 1e-9, 'growth is the share of BLOOM_MS')
const r = ripen(pots, t0 + BLOOM_MS + 20)
ok(r.bloomed.map(b => b.species).join() === 'owl,fox', 'each pot blooms ITS seed, in planting order')
ok(ripen(r.pots, t0 + 10 * BLOOM_MS).bloomed.length === 0, 'a bloom happens once')
ok(liftPot(r.pots, 'p1') === null, 'a planter a spirit lives in cannot be picked up')
const grow = plant({}, 'p3', seedOf('bat'), t0)!
const lifted = liftPot(grow, 'p3')!
ok(lifted.seed === seedOf('bat') && !lifted.pots.p3, 'a growing seed comes back to the bag')
ok(liftPot({}, 'pX')!.seed === null, 'an empty planter lifts freely')

// the Anemonyx: gaps 5-10 days, there that day only, one seed per visit, same days on every reload
for (const salt of ['keeper-a', 'keeper-b', 'x']) {
  let prev = 0
  for (let k = 0; k < 40; k++) { const d = visitDay(salt, k); const gap = d - prev; ok(gap >= VISIT_MIN_DAYS && gap <= VISIT_MAX_DAYS, `gap ${gap} in 5-10 (${salt} #${k})`); prev = d }
  const d0 = visitDay(salt, 0)
  ok(visitOn(salt, d0) === 0 && visitOn(salt, d0 + 1) === null && visitOn(salt, d0 - 1) === null, 'there on the day, gone the next')
  ok(nextVisit(salt, d0 + 1).day === visitDay(salt, 1), 'next visit after a missed one')
  const m = meetAnemonyx(salt, d0, [], new Set())
  ok(!!m && m.k === 0 && isSeed(m.seed), 'reaching her on the day gives a seed')
  ok(meetAnemonyx(salt, d0, [0], new Set()) === null, 'one seed per visit')
  ok(meetAnemonyx(salt, d0 + 1, [], new Set()) === null, 'no seed the day after')
  ok(visitSeed(salt, 3, new Set()) === visitSeed(salt, 3, new Set()), 'the seed of a visit is fixed (stable across reloads)')
}
ok(visitDay('keeper-a', 5) !== visitDay('keeper-b', 5) || visitDay('keeper-a', 6) !== visitDay('keeper-b', 6), 'keepers get different days')
// she brings an unseen species while there are any
const seen9 = new Set(SPECIES.filter(s => s !== 'frog'))
ok([0, 1, 2, 3, 4].every(k => visitSeed('z', k, seen9) === seedOf('frog')), 'unseen first: the last unseen species')
ok(isSeed(visitSeed('z', 0, new Set(SPECIES))), 'all seen: any of the ten')

// the grimoire: discovery order, seen once, save round-trip
let b = see(see(see(freshBook(), 'owl', 1), 'fox', 2), 'owl', 3)
ok(b.pages.map(p => p.species).join() === 'owl,fox' && seenCount(b) === 2, 'discovery order, a species takes one page')
b = bond(b, 'fox')
ok(b.pages[1].stage === 'bonded' && seenCount(b) === 2 && seenSet(b).has('fox'), 'bonded still counts as seen')
ok(bond(b, 'bat') === b, 'cannot bond an unseen species')
b = { ...b, pots: r.pots, met: [0, 2] }
const back = parseBook(JSON.parse(JSON.stringify(b)))
ok(JSON.stringify(back) === JSON.stringify(b), 'book round-trips through save')
ok(parseBook({ pages: [{ species: 'owl', stage: 'x' }], pots: { a: { seed: 'mana_seed', at: 1 } }, met: ['q'] }).pages.length === 0, 'garbage drops')
ok(seenCount(parseBook(null)) === 0, 'null = fresh book')

console.log(`spirit-seeds: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
