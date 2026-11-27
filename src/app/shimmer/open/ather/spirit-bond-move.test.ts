// BETA M238: her favourite (bonded) move. Run: npx tsx src/app/shimmer/open/ather/spirit-bond-move.test.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { knownOf, knownList, canAsk, twistOf, pickFavourite, bondedOf, parseMoves, parseFav, formOf, TWIST_DAYS, KNOWN_LEVEL } from './spirit-bond-move'
import { knownMoves, resolveBonded, randomBonded, createFight, tentEntrant, bondSeed, TWIST_MAX, stanceOf, STANCE } from './clash-fight'
import { MOVE_MANA_PULSE, MOVE_SPIRIT_WARD } from '../../engine/moves'
import { BOND_MAX } from './spirit-dishes'
import { parseBook } from './grimoire-book'
import type { Pot } from './spirit-seeds'

let pass = 0; const fails: string[] = []
const ok = (c: unknown, m: string) => { if (c) pass++; else fails.push(m) }
const dir = __dirname
const base: Pot = { seed: 'mana_seed_fox', at: 1, bloomed: true, bond: BOND_MAX }

// ── known moves ──
{
  const k = knownOf(base, 'fox')
  ok(k.length >= 4 && k.includes('mana_pulse') && k.includes('spirit_ward'), 'she knows the born pair + her species moves')
  ok(k.join() === knownMoves('fox', 'base', KNOWN_LEVEL).map(m => m.id).join(), 'unsaved = what knownMoves derives for her form')
  ok(knownMoves('fox', 'base', KNOWN_LEVEL).every(m => m.element === 'neutral'), 'canon: a base form knows no element move')
  const saved: Pot = { ...base, moves: ['aqua_stream'] }
  ok(knownOf(saved, 'fox')[0] === 'aqua_stream' && knownOf(saved, 'fox').includes('mana_shard'), 'a saved move (a later milestone) is kept beside the derived ones')
  const evo: Pot = { ...base, element: 'storm' }
  ok(knownOf(evo, 'fox').length > k.length, 'evolving adds her element tier')
  ok(knownList(base, 'fox').every(m => !!m.name), 'every listed move has its canon name')
}
// ── the ask ──
{
  ok(!canAsk({ ...base, bond: BOND_MAX - 1 }), 'bond below max: no ask')
  ok(!canAsk({ ...base, bloomed: undefined }), 'not bloomed: no ask')
  ok(canAsk(base), 'bond maxed, none picked: the ask shows')
  const p1 = pickFavourite(base, 'fox', 'mana_shard', 100)!
  ok(p1 && p1.fav?.id === 'mana_shard' && p1.fav.form === 'base' && p1.fav.day === 100, 'pick saves her favourite + form + day')
  ok(Array.isArray(p1.moves) && p1.moves.includes('mana_shard'), 'pick saves her known moves')
  ok(!canAsk(p1), 'after the pick the ask is gone (this form)')
  ok(pickFavourite(p1, 'fox', 'vapor_drain', 101) === null, 'no second pick in the same form')
  ok(pickFavourite(base, 'fox', 'hydro_press', 100) === null, 'a move she does not know is refused')
  ok(pickFavourite({ ...base, bond: 200 }, 'fox', 'mana_shard', 100) === null, 'a weak bond cannot pick')
  // evolution: the ask returns, twist carries
  const evo: Pot = { ...p1, element: 'storm' }
  ok(formOf(evo) === 'storm' && canAsk(evo), 'after an evolution the ask shows again')
  const day = 100 + 2 * TWIST_DAYS
  ok(twistOf(evo, day) === 2, 'twist grows with the bond: 2 after 2 x TWIST_DAYS')
  const p2 = pickFavourite(evo, 'fox', 'vapor_drain', day)!
  ok(p2.fav?.id === 'vapor_drain' && p2.fav.form === 'storm' && p2.fav.day === 100, 're-pick keeps the bond\'s first day')
  ok(twistOf(p2, day) === 2, 'the twist CARRIES to the new favourite')
  ok(twistOf(p2, 100 + 99 * TWIST_DAYS) === TWIST_MAX, 'twist caps at 3')
  ok(twistOf(p1, 100 + TWIST_DAYS - 1) === 0 && twistOf(p1, 100 + TWIST_DAYS) === 1, 'twist steps at TWIST_DAYS')
  ok(bondedOf(p2, day)?.id === 'vapor_drain' && bondedOf(p2, day)?.twist === 2 && bondedOf(base, day) === null, 'bondedOf = favourite + twist, null when none')
}
// ── save ──
{
  const p = pickFavourite(base, 'fox', 'mana_shard', 100)!
  const b = parseBook(JSON.parse(JSON.stringify({ v: 1, pages: [], met: [], pots: { a: p, j: { ...base, moves: ['nope', 7], fav: { id: 'x', form: 'base', day: 1 } } } })))
  ok(b.pots.a.fav?.id === 'mana_shard' && b.pots.a.fav.day === 100 && b.pots.a.moves?.includes('mana_shard'), 'parseBook keeps moves + favourite (survives reload)')
  ok(b.pots.j.fav === undefined && b.pots.j.moves === undefined, 'junk moves / favourite drop')
  ok(parseFav({ id: 'mana_shard', form: 'fire', day: 1 }) === undefined && parseMoves(['mana_shard', 'mana_shard'])?.length === 1, 'parse guards')
}
// ── the Clash reads it ──
{
  const k = knownMoves('fox', 'base', 12)
  const seen = new Set<string>()
  for (let s = 1; s <= 200; s++) seen.add(randomBonded(k, s).id)
  ok(seen.size >= 2, `no favourite: a RANDOM known move (${seen.size} different over 200 seeds)`)
  ok([...seen].every(id => k.some(m => m.id === id && m.power > 0)), 'the random pick is a known damaging move')
  const fx = tentEntrant('fox', 'base', 'easy'), viaFight = new Set<string>()
  for (let s = 1; s <= 200; s++) viaFight.add(resolveBonded(fx, s).id)
  ok(viaFight.size >= 2 && resolveBonded(fx, 3).twist === 0, `a fighter with none picked: random known move, not the first (${viaFight.size})`)
  ok(randomBonded(k, 42).id === randomBonded(k, 42).id, 'seeded: the same seed, the same move')
  // play-clash-fix: the born pair is never her drawn favourite while she knows a move of her own (a drawn Mana Pulse lost
  // far kinds their bouts and stalled guard pairs to the cap), only when she knows nothing else
  const drawn = new Set<string>(); for (const sp of ['fox', 'owl', 'turtle', 'axolotl'] as const) for (let s = 1; s <= 200; s++) drawn.add(randomBonded(knownMoves(sp, 'base', 12), s).id)
  ok(!drawn.has(MOVE_MANA_PULSE.id) && !drawn.has(MOVE_SPIRIT_WARD.id), `random favourite: never the born pair (${[...drawn].join(',')})`)
  ok(randomBonded([MOVE_MANA_PULSE, MOVE_SPIRIT_WARD], 7).id === MOVE_MANA_PULSE.id, 'random favourite: born Mana Pulse when she knows nothing else')
  ok(stanceOf(4.0, { range: 2.4, power: 55 }) === STANCE.near && stanceOf(4.0, { range: 4.5, power: 43 }) === 4.0 && stanceOf(1.4, { range: 4.5, power: 47 }) === 1.4 && stanceOf(4.0, { range: Infinity, power: 0 }) === 4.0, 'stance: a far kind with a near move stands in; else her kind\'s range')
  const e = tentEntrant('fox', 'base', 'easy')
  const f1 = createFight(e, tentEntrant('owl', 'base', 'easy'), 77), f2 = createFight(e, tentEntrant('owl', 'base', 'easy'), 77)
  ok(f1.f[0]._.bonded.id === f2.f[0]._.bonded.id && f1.f[0]._.bonded.id === resolveBonded(e, bondSeed(77, 0)).id, 'a fight\'s random favourite replays from its seed')
  // her own known list reaches the tent: a Lv12-evened fox still throws her Lv29 favourite
  const known = knownOf(base, 'fox')
  const mine = { ...tentEntrant('fox', 'base', 'easy', { id: 'storm_scatter', twist: 2 }), known }
  const fm = createFight(mine, tentEntrant('owl', 'base', 'easy'), 5)
  ok(fm.f[0]._.bonded.id === 'storm_scatter', 'her saved favourite is thrown even above the tent level')
  ok(resolveBonded(mine, 1).twist === 2, '...at her twist')
  ok(resolveBonded({ ...mine, bonded: { id: 'hydro_press', twist: 3 } }, 1).twist === 0, 'an unknown favourite falls back to random, no twist')
}
// ── wiring (source) ──
{
  const talk = readFileSync(join(dir, 'spirit-talk.tsx'), 'utf8')
  ok(/canAsk\(/.test(talk) && /BOND_MOVE_UI\.ask/.test(talk), 'the talk shows Pick a bond behind canAsk')
  const panel = readFileSync(join(dir, 'clash-panel.tsx'), 'utf8')
  ok(/bondedOf\(/.test(panel) && /knownOf\(/.test(panel), 'the Clash sign-up hands her favourite + known moves to the ring')
  const bout = readFileSync(join(dir, 'clash-bout.ts'), 'utf8')
  ok(/o\.tier, x\.bonded\)/.test(bout) && /known: x\.known/.test(bout), 'the live runner passes them to the fight')
}

console.log(`spirit-bond-move.test: ${pass} passed, ${fails.length} failed`)
if (fails.length) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1) }
