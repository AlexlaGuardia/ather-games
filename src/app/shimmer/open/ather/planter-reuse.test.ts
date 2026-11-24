// npx tsx src/app/shimmer/open/ather/planter-reuse.test.ts
// BETA M122 (Magii RULED athernyx 756fdbb): a planter only helps a seed bloom; once its spirit blooms it is FREE for the
// next Mana Seed. The bloomed spirit keeps her key (party / follow / fed / training key on it) and her home planter.
import { plant, ripen, tend, hasten, carryPot, settlePot, growingKey, growingIn, spiritsAt, homeOf, slotOf, BLOOM_MS, type Pots } from './spirit-seeds'
import { GAME_DAY_MS as GAME_DAY_MS_FOR_TEST } from './nodes'
import { parseBook } from './grimoire-book'
import { liftPiece } from './piece-lift'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const P = 'piece-abc-0', T0 = 1_000_000_000_000
const s1 = 'mana_seed_axolotl' as never, s2 = 'mana_seed_fox' as never

// (1) a bloomed planter accepts a seed; the spirit stays exactly where (and what) she was
{
  let pots: Pots = plant({}, P, s1, T0)!
  pots = ripen(pots, T0 + BLOOM_MS + 1).pots
  ok(pots[P]?.bloomed === true, 'first seed bloomed at the planter key')
  const spirit = pots[P]
  const next = plant(pots, P, s2, T0 + BLOOM_MS + 5)
  ok(!!next, 'a BLOOMED planter takes a new Mana Seed')
  ok(!!next && next[P] === spirit, 'the bloomed spirit is untouched (same key, same object)')
  ok(!!next && growingKey(next, P) === `${P}#2` && growingIn(next, P)?.seed === s2, `the new seed grows in slot #2 (${next && growingKey(next, P)})`)
  ok(!!next && plant(next, P, s1, T0 + BLOOM_MS + 6) === null, 'a GROWING planter still refuses a second seed')
  ok(!!next && JSON.stringify(spiritsAt(next, P)) === JSON.stringify([P]), 'spiritsAt: one spirit at home here')
  // tend + hasten act on the growing slot, never on the spirit
  const day = Math.floor((T0 + BLOOM_MS + 5) / GAME_DAY_MS_FOR_TEST) * GAME_DAY_MS_FOR_TEST + 10
  const t = tend(next!, P, day)
  ok(!!t && t[P] === spirit && (t[`${P}#2`].tends?.length ?? 0) === 1, 'tend reaches the growing slot')
  const h = hasten(next!, P, T0 + BLOOM_MS + 5, 'now')!
  const r = ripen(h, T0 + BLOOM_MS + 5)
  ok(r.bloomed.length === 1 && r.bloomed[0].pieceId === `${P}#2` && r.pots[P] === spirit, 'the second seed blooms as her OWN spirit (#2); the first untouched')
  ok(JSON.stringify(spiritsAt(r.pots, P)) === JSON.stringify([P, `${P}#2`]) && !growingKey(r.pots, P), 'two spirits at home; the planter is free again')
  ok(growingKey(plant(r.pots, P, s1, T0 + BLOOM_MS * 3)!, P) === `${P}#3`, 'and a third seed takes slot #3')
  // lifting: a spirit's home planter stays put (BLOOMED_SPIRIT_LINE), even with a seed growing in it
  ok(carryPot(next!, P) === null, 'lift with a spirit at home + a seed growing = refused (nothing changes)')
  ok(homeOf(`${P}#2`) === P && homeOf(`carried:${P}`) === P && homeOf(P) === P && slotOf(`${P}#3`) === 3 && slotOf(P) === 0, 'homeOf / slotOf')
}

// (2) an OLD SAVE (pre-M122 grimoire, bloomed pot at the planter key) loads unchanged and is plantable
{
  const raw = { v: 1, pages: [{ species: 'axolotl', stage: 'seen', at: T0 }], met: [1], pots: { [P]: { seed: 'mana_seed_axolotl', at: T0, v: 2, tends: [5], bloomed: true }, other: { seed: 'mana_seed_fox', at: T0, v: 2, tends: [] } } }
  const b = parseBook(JSON.parse(JSON.stringify(raw)))
  ok(JSON.stringify(b.pots) === JSON.stringify(raw.pots), 'old save: every pot loads as it was (no data loss, no rewrite)')
  const n = plant(b.pots, P, s2, T0 + 5)
  ok(!!n && n[P] === b.pots[P] && n.other === b.pots.other && growingIn(n, P)?.seed === s2, 'old save: the bloomed planter takes a seed; the old spirit + the other planter untouched')
  ok(plant(b.pots, 'other', s1, T0 + 5) === null, 'old save: a planter with a growing seed still refuses')
  // round trip: the new slot survives a save + load
  const b2 = parseBook(JSON.parse(JSON.stringify({ ...b, pots: n })))
  ok(growingKey(b2.pots, P) === `${P}#2` && b2.pots[P].bloomed === true, 'save + load keeps the slot and the spirit')
}

// (3) empty + carry paths unchanged (M106)
{
  const pots = plant({}, P, s1, T0)!
  ok(Object.keys(pots).join() === P, 'an empty planter plants at its own key (unchanged)')
  const c = carryPot(pots, P)!
  ok(!!c && c[`carried:${P}`]?.seed === s1 && !c[P], 'a growing pot rides along on lift (unchanged)')
  const s = settlePot(c, 'piece-new-1')
  ok(s['piece-new-1']?.seed === s1 && !s[`carried:${P}`], 'and settles into the next planter (unchanged)')
  const works = { rooms: [], pieces: [{ id: P, item: 'spirit_planter', x: 0, z: 0, q: 0, placedAt: 0 }] } as never
  const bloomed = ripen(plant({}, P, s1, T0)!, T0 + BLOOM_MS + 1).pots
  ok(liftPiece(works, P, { slots: [] } as never, bloomed) === 'spirit', 'liftPiece on a bloomed planter: still refused (her home)')
}

console.log(`planter-reuse: ${pass}/${fail}`)
if (fail) process.exit(1)
