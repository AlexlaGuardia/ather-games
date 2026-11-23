// Run: npx tsx src/app/shimmer/open/ather/spirit-seeds.test.ts
// M76 s1: the seed decides the species (never the pot or a roll), one spirit per planter, the Anemonyx's 5-10 day visits
// (there that day only, one seed per visit), the grimoire fills in discovery order and survives a save round-trip.
import { SPECIES, SEED_IDS, seedOf, speciesOf, isSeed, plant, ripen, liftPot, growth, BLOOM_MS, visitDay, visitOn, nextVisit, visitSeed, meetAnemonyx, VISIT_MIN_DAYS, VISIT_MAX_DAYS, SEED_NAME } from './spirit-seeds'
import { tend, canTend, tendedToday, bloomAt, growDay, gameDay, seedsOnPlot, takeSeed, BLOOM_DAYS, TEND_MS, LEGACY_BLOOM_MS } from './spirit-seeds'
import { GAME_DAY_MS } from './nodes'
import { freshBank, putIn, bankCount, bankCap } from './garden-bank'
import { give, countOf, SLOTS, type Inv } from '../shared/inventory'
const freshInv = (): Inv => ({ v: 1, slots: Array(SLOTS).fill(null) }) as Inv
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

// M106: growth in game days + TEND (Alex 11-23)
{
  const D = GAME_DAY_MS, at = 500 * D + D / 4   // planted a quarter into game day 500
  const p0 = plant({}, 'q', seedOf('owl'), at)!
  ok(BLOOM_DAYS === 3 && bloomAt(p0.q) === at + 3 * D, 'untended = plant + 3 game days')
  ok(ripen(p0, at + 3 * D - 1).bloomed.length === 0 && ripen(p0, at + 3 * D).bloomed.length === 1, 'untended blooms exactly at plant + 3 days')
  ok(growDay(p0.q, at) === 1 && growDay(p0.q, at + D) === 2 && growDay(p0.q, at + 2 * D + 1) === 3, 'day N of 3')
  const t1 = tend(p0, 'q', at + 1000)!
  ok(!!t1 && tendedToday(t1.q, at + 1000) && t1.q.tends!.join() === String(gameDay(at)), 'a tend on day 1 is recorded on that game day')
  ok(tend(t1, 'q', at + 2000) === null, 'a 2nd tend the same game day is refused')
  ok(tend(t1, 'q', 501 * D - 1) === null, '...right up to the last ms of that day')
  const t2 = tend(t1, 'q', at + D)!
  ok(!!t2 && bloomAt(t2.q) === at + 2 * D, 'tend day 1 + day 2 = blooms at plant + 2 days (the START of day 3)')
  ok(ripen(t2, at + 2 * D - 1).bloomed.length === 0 && ripen(t2, at + 2 * D).bloomed.length === 1, 'and ripens then, not before')
  ok(TEND_MS === D / 2 && bloomAt(t1.q) === at + 2.5 * D, 'one tend = half a game day earlier')
  // a late tend that puts the bloom in the past = blooms now
  const late = plant({}, 'L', seedOf('fox'), at)!, l1 = tend(late, 'L', at + 2.6 * D)!
  const lt = tend(late, 'L', at + 3 * D)   // untended and already due
  ok(bloomAt(l1.L) < at + 2.6 * D && ripen(l1, at + 2.6 * D).bloomed.length === 1, 'a tend that makes the bloom already past = it blooms now')
  ok(lt === null, 'a due pot takes no tend')
  ok(tend({}, 'none', at) === null && !canTend(undefined, at), 'an empty planter cannot be tended')
  const bl = ripen(t2, at + 2 * D).pots
  ok(tend(bl, 'q', at + 2 * D + 1) === null, 'a bloomed planter cannot be tended')
  // old saves: an M76 pot (no v) keeps its 16-min promise, round-trips, and is never stranded
  const old = parseBook({ v: 1, pages: [], met: [], pots: { o: { seed: 'mana_seed_owl', at: 1000 } } })
  ok(old.pots.o && old.pots.o.v === undefined && bloomAt(old.pots.o) === 1000 + LEGACY_BLOOM_MS, 'an old pot keeps the old wait')
  ok(ripen(old.pots, 1000 + 10 * D).bloomed.map(x => x.species).join() === 'owl', 'an old pot that was due still blooms')
  ok(tend(old.pots, 'o', 1000) === null, 'an old pot takes no tend (it blooms within 16 min anyway)')
  const nb = parseBook(JSON.parse(JSON.stringify({ v: 1, pages: [], met: [], pots: t2 })))
  ok(JSON.stringify(nb.pots) === JSON.stringify(t2), 'tends survive a save round-trip')
  ok(parseBook({ pots: { z: { seed: 'mana_seed_owl', at: 1, v: 2, tends: ['x', 3.5, 7] } } }).pots.z.tends!.join() === '7', 'garbage tends drop')
}
// M106: the seeds on the plot (bag + the garden bank every chest opens onto); planting takes from the bag first, else the bank
{
  let inv = give(freshInv(), seedOf('owl'), 1).inv
  let bank = putIn(putIn(freshBank(), bankCap(1), seedOf('owl'), 2).bank, bankCap(1), seedOf('bat'), 1).bank
  const on = seedsOnPlot(inv, bank)
  ok(on.length === 2 && on.some(s => s.id === seedOf('bat') && s.bag === 0 && s.bank === 1), 'a seed held only in a chest is listed')
  ok(on.some(s => s.id === seedOf('owl') && s.bag === 1 && s.bank === 2), 'grouped by seed with counts from both')
  const a = takeSeed(inv, bank, seedOf('owl'))!
  ok(a.from === 'bag' && countOf(a.inv, seedOf('owl')) === 0 && bankCount(a.bank, seedOf('owl')) === 2, 'the bag gives first')
  const b = takeSeed(inv, bank, seedOf('bat'))!
  ok(b.from === 'bank' && bankCount(b.bank, seedOf('bat')) === 0 && b.inv === inv && bankCount(bank, seedOf('bat')) === 1, 'a seed from the chest plants and leaves the chest one fewer (input untouched)')
  ok(takeSeed(inv, bank, seedOf('frog')) === null, 'a seed held nowhere: refused')
  inv = freshInv(); bank = freshBank()
  ok(seedsOnPlot(inv, bank).length === 0, 'nothing held: empty list')
}

console.log(`spirit-seeds: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
