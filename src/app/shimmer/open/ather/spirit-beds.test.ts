// npx tsx src/app/shimmer/open/ather/spirit-beds.test.ts
// BETA M124 s1 (RULED athernyx ce34508 + glossary 'Spirit bed'): the Spirit Planter IS the spirit bed. A bed = the RECORD of
// every spirit bloomed there (cap 28) + ONE featured spirit (drawn); the rest live free in the garden out of sight. 8 beds.
// MIGRATION: M122 saves keep their `<planter>#n` keys as they are (party / follow / fed / training key on them).
import { plant, ripen, spiritsAt, featuredAt, withFeatured, shownAt, growingKey, homeOf, BED_RECORD_MAX, BLOOM_MS, type Pots } from './spirit-seeds'
import { parseBook } from './grimoire-book'
import { canPlacePiece, turnPiece, loadWorks, WORKS_KEY, freshWorks } from './rooms'
import { BED_UI } from './planter-lines'
import { setPart, movePart } from '../../dev/editors/zone-build'
import { cleanZones, type Zone } from '../../world/builder-zones'
import { FURNITURE, BEDS_MAX } from './furniture'
import { STARTING_SQUARES } from './plot'
import { newInv, give } from '../shared/inventory'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const P = 'piece-abc-0', Q = 'piece-abd-1', T0 = 1_000_000_000_000
const NONE = new Set<string>()

// (1) an M122-SHAPE SAVE: P holds 3 spirits (P, P#2, P#3), Q holds one + a seed growing at Q#2. Loads as is, every spirit kept.
{
  const pot = (seed: string, at: number, bloomed = true) => ({ seed, at, v: 2, tends: [], ...(bloomed ? { bloomed: true } : {}) })
  const raw = { v: 1, pages: [{ species: 'axolotl', stage: 'seen', at: T0 }], met: [], pots: {
    [P]: pot('mana_seed_axolotl', T0), [`${P}#2`]: pot('mana_seed_fox', T0 + 10), [`${P}#3`]: pot('mana_seed_axolotl', T0 + 20),
    [Q]: pot('mana_seed_fox', T0 + 5), [`${Q}#2`]: pot('mana_seed_fox', T0 + 30, false) } }
  const b = parseBook(JSON.parse(JSON.stringify(raw)))
  ok(JSON.stringify(b.pots) === JSON.stringify(raw.pots), 'M122 save: every pot loads byte-for-byte (no key moved, nobody lost)')
  ok(b.featured === undefined, 'M122 save: no featured field invented on load')
  ok(JSON.stringify(spiritsAt(b.pots, P)) === JSON.stringify([P, `${P}#2`, `${P}#3`]), 'bed P records its 3 spirits, the #2 / #3 ones included')
  ok(JSON.stringify(spiritsAt(b.pots, Q)) === JSON.stringify([Q]) && growingKey(b.pots, Q) === `${Q}#2`, 'bed Q: 1 spirit + its growing seed')
  ok(Object.keys(b.pots).filter(k => b.pots[k].bloomed).every(k => spiritsAt(b.pots, homeOf(k)).includes(k)), 'every bloomed spirit is in its bed\'s record')
  // featured: default = the first bloomed there; only she is drawn, the rest are out of sight
  ok(featuredAt(b.pots, b.featured, P) === P, 'default featured = the first spirit of the bed')
  ok(JSON.stringify(shownAt(b.pots, b.featured, P, NONE)) === JSON.stringify([P]), 'only the featured spirit is drawn at P')
  ok(JSON.stringify(shownAt(b.pots, b.featured, P, new Set([`${P}#3`]))) === JSON.stringify([P, `${P}#3`]), 'a party/following/called one is drawn too')
  // feature #2: persisted through save + load, and the drawn one changes
  const f = withFeatured(b.pots, b.featured, `${P}#2`)!
  ok(!!f && f[P] === `${P}#2`, 'withFeatured sets the bed of her key')
  const b2 = parseBook(JSON.parse(JSON.stringify({ ...b, featured: f })))
  ok(b2.featured?.[P] === `${P}#2` && JSON.stringify(b2.pots) === JSON.stringify(raw.pots), 'featured survives save + load; pots untouched')
  ok(JSON.stringify(shownAt(b2.pots, b2.featured, P, NONE)) === JSON.stringify([`${P}#2`]), 'now #2 is drawn and P is out of sight')
  ok(featuredAt(b2.pots, b2.featured, Q) === Q, 'another bed keeps its own featured')
  ok(withFeatured(b.pots, b.featured, `${Q}#2`) === null && withFeatured(b.pots, b.featured, 'nobody') === null, 'a growing seed or a missing key cannot be featured')
  ok(featuredAt(b.pots, { [P]: `${Q}` }, P) === P, 'a stale featured entry (not of this bed) falls back to the first')
  ok(featuredAt(b.pots, undefined, 'piece-empty') === null && shownAt(b.pots, undefined, 'piece-empty', NONE).length === 0, 'an empty bed features nobody')
  ok(parseBook({ ...raw, featured: { [P]: 7, [Q]: Q } }).featured?.[Q] === Q && parseBook({ ...raw, featured: { [P]: 7 } }).featured === undefined, 'parse drops a non-string featured entry')
}

// (2) the bed's record: cap 28. A bloomed bed takes the next seed until it holds 28.
{
  let pots: Pots = {}
  for (let i = 0; i < BED_RECORD_MAX; i++) {
    const n = plant(pots, P, 'mana_seed_fox' as never, T0 + i * BLOOM_MS * 2)
    if (!n) { ok(false, `seed ${i + 1} refused before the bed was full`); break }
    pots = ripen(n, T0 + i * BLOOM_MS * 2 + BLOOM_MS + 1).pots
  }
  ok(BED_RECORD_MAX === 28 && spiritsAt(pots, P).length === 28, `28 spirits recorded at one bed (${spiritsAt(pots, P).length})`)
  ok(spiritsAt(pots, P)[27] === `${P}#28`, 'the 28th took slot #28')
  ok(plant(pots, P, 'mana_seed_fox' as never, T0 + BLOOM_MS * 99) === null, 'a full bed (28) refuses the 29th seed')
  ok(!!plant(pots, Q, 'mana_seed_fox' as never, T0), 'another bed still takes one')
}

// (3) 8 beds per garden: the 9th is refused; other furniture is not counted against it
{
  ok(BEDS_MAX === 8 && FURNITURE.spirit_planter.spirit === 'planter', 'the bed is the spirit planter item')
  ok(FURNITURE.spirit_planter.name === 'Spirit Bed', 'player-facing name: Spirit Bed')
  const owned = new Set<string>(STARTING_SQUARES), inv = give(newInv(12), 'spirit_planter', 1).inv
  const bed = (i: number) => ({ id: `piece-b-${i}`, item: 'spirit_planter', x: -140 + i * 2.5, z: 140, q: 0, placedAt: i })
  const w7 = { ...freshWorks(), pieces: Array.from({ length: 7 }, (_, i) => bed(i)) }
  const w8 = { ...freshWorks(), pieces: Array.from({ length: 8 }, (_, i) => bed(i)) }
  ok(canPlacePiece(w7, owned, 'spirit_planter', -100, 100, 0, inv).ok, 'the 8th bed sets')
  const v = canPlacePiece(w8, owned, 'spirit_planter', -100, 100, 0, inv)
  ok(!v.ok && /8 spirit beds/.test((v as { why?: string }).why ?? ''), `the 9th bed is refused (${(v as { why?: string }).why})`)
  ok(canPlacePiece(w8, owned, 'goldwood_stool', -100, 100, 0, give(newInv(12), 'goldwood_stool', 1).inv).ok, 'other furniture still sets beside 8 beds')
}

// (4) s2: a SITE (a Creative building zone) is bed-capped too, with the same line; a garden already over the cap loads whole
{
  const bed = (i: number) => ({ id: `b${i}`, item: 'spirit_planter', x: 2 + (i % 5) * 3, z: 2 + Math.floor(i / 5) * 3, q: 0 })
  const Z = (n: number): Zone => ({ id: 'z1', x0: 0, z0: 0, x1: 24, z1: 24, h: 0, tag: null, prev: {}, build: Array.from({ length: n }, (_, i) => bed(i)) })
  ok(setPart(Z(7), 'spirit_planter', 20, 20, 0).ok, 'site: the 8th bed sets')
  const v = setPart(Z(8), 'spirit_planter', 20, 20, 0)
  ok(!v.ok && v.why === BED_UI.capped, `site: the 9th bed is refused with the signed line (${v.ok ? 'set' : v.why})`)
  ok(setPart(Z(8), 'goldwood_bench', 20, 20, 0).ok, 'site: other furniture still sets beside 8 beds')
  ok(movePart(Z(10), 'b9', 20, 20, 0).ok, 'site: a build over the cap may still move a bed it has')
  ok(cleanZones({ zones: [Z(10)] })[0]?.build?.length === 10, 'site: a saved build with 10 beds loads all 10')
  const store: Record<string, string> = {}, pieces = Array.from({ length: 11 }, (_, i) => ({ id: `piece-o-${i}`, item: 'spirit_planter', x: -146 + i * 2.5, z: 106, q: 0, placedAt: i }))
  const g = globalThis as unknown as { localStorage?: unknown; window?: unknown }, had = g.localStorage
  g.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, x: string) => { store[k] = x }, removeItem: (k: string) => { delete store[k] } }
  store[WORKS_KEY] = JSON.stringify({ v: 1, rooms: [], chests: [], pieces })
  const w = loadWorks(); g.localStorage = had
  ok(w.pieces.length === 11 && JSON.stringify(w.pieces.map(p => p.id)) === JSON.stringify(pieces.map(p => p.id)), `an old save with 11 beds loads all 11 (${w.pieces.length})`)
  const owned = new Set<string>(STARTING_SQUARES), over = { ...freshWorks(), pieces: pieces.map((p, i) => ({ ...p, x: -140 + (i % 6) * 2.5, z: 106 + Math.floor(i / 6) * 3 })) }
  ok(!canPlacePiece(over, owned, 'spirit_planter', -138, 116, 0).ok, 'over the cap: no new bed')
  ok(!!turnPiece(over, owned, 'piece-o-0'), 'over the cap: a standing bed still turns')
}

console.log(`spirit-beds: ${pass}/${fail}`)
if (fail) process.exit(1)
