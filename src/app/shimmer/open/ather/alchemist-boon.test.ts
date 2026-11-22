// alchemist-boon.ts: chance = the alchemist's LUCK (M65 s2), one roll per participant, no stacking, out of range = 0, one alchemist per Desk.
import { luckChance, statsOf, LUCK_PCT } from './moglin-stats'
import { BOON_RANGE, STAND_OFF, boonAt, extraBottles, assignSet, standAt, setRoom, boonLine } from './alchemist-boon'
import type { MoglinRecord, Village, Grade } from './moglins'
import type { Works, Piece } from './rooms'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

const skills = (g: Grade) => ({ forestry: 1, woodworking: 1, farming: 1, cooking: 1, masonry: 1, metalwork: 1, mining: 1, potions: g, rinnshop: 1 }) as MoglinRecord['skills']
const mog = (id: string, g: Grade, profession: MoglinRecord['profession'] = 'alchemist', room?: string, luck: Grade = 5): MoglinRecord =>
  ({ id, name: id, home: 's', grades: { craft: g, yield: g, trade: g }, skills: skills(g), luck, dream: '', profession, recruitedAt: 0, room }) as MoglinRecord
const piece = (id: string, item: string, x: number, z: number, q = 0): Piece => ({ id, item, x, z, q, placedAt: 0 })
const W = (...pieces: Piece[]) => ({ v: 1, rooms: [], chests: [], pieces }) as Works
const V = (...moglins: MoglinRecord[]): Village => ({ v: 1, moglins, lastTick: 0 })

const desk = piece('d1', 'alc_desk', 0, 0), still = piece('s1', 'alc_still', 3, 0), far = piece('f1', 'alc_still', 20, 0)
// ★ M65 s2: the chance IS the alchemist's Luck %, exactly: the old potions curve is replaced, never added (a stacked
// rule would read luck + curve and fail every line here)
for (let i = 0; i < 60; i++) for (const L of [1, 2, 3, 4, 5] as Grade[]) {
  const m = mog(`al${i}`, ((i % 5) + 1) as Grade, 'alchemist', setRoom('d1'), L), c = boonAt(V(m), W(desk), 'd1').chance
  ok(c === LUCK_PCT[statsOf(m).luck] / 100 && c === luckChance(m), `al${i} luck ${L}: boon ${c} = its Luck ${statsOf(m).luck}`)
}
{ const lo = mog('same', 1, 'alchemist', setRoom('d1')), hi = mog('same', 5, 'alchemist', setRoom('d1'))
  ok(boonAt(V(lo), W(desk), 'd1').chance === boonAt(V(hi), W(desk), 'd1').chance, 'the potions grade no longer moves the chance (luck only)') }
{ let f = 0; for (let i = 0; i < 200 && !f; i++) { const m = mog(`zf${i}`, 3, 'alchemist', setRoom('d1'), 1); if (statsOf(m).luck === 'F') f = 1, ok(boonAt(V(m), W(desk), 'd1').chance === 0, 'Luck F = no boon at all') }
  ok(f === 1, 'found an F-luck alchemist to test') }
// range: from where it STANDS to the piece the brew finishes at
ok(boonAt(V(mog('a', 3, 'alchemist', setRoom('d1'))), W(desk, still), 's1').chance === luckChance(mog('a', 3)), 'a piece within range counts')
ok(boonAt(V(mog('a', 3, 'alchemist', setRoom('d1'))), W(desk, far), 'f1').chance === 0, 'out of range = 0')
{ const edge = piece('e', 'alc_still', 0, STAND_OFF + BOON_RANGE + 0.01), in1 = piece('i', 'alc_still', 0, STAND_OFF + BOON_RANGE - 0.01)
  ok(boonAt(V(mog('a', 3, 'alchemist', setRoom('d1'))), W(desk, edge, in1), 'e').chance === 0 && boonAt(V(mog('a', 3, 'alchemist', setRoom('d1'))), W(desk, edge, in1), 'i').chance > 0, 'range edge measured from the stand spot') }
// no alchemist / not at a Desk / not an alchemist = 0
ok(boonAt(V(), W(desk), 'd1').chance === 0, 'no alchemist = 0')
ok(boonAt(V(mog('a', 5)), W(desk), 'd1').chance === 0, 'an alchemist resting (not at a Desk) = 0')
ok(boonAt(V(mog('c', 5, 'cook', setRoom('d1'))), W(desk), 'd1').chance === 0, 'a cook with a potions grade is not an alchemist')
ok(boonAt(V(mog('a', 5, 'alchemist', setRoom('gone'))), W(desk), 'd1').chance === 0, 'a Desk that was picked up: nothing counts')
// no stacking: two alchemists at two Desks in range -> the best one only
{ const d2 = piece('d2', 'alc_desk', 2, 0)
  const a = mog('a', 2, 'alchemist', setRoom('d1'), 2), bb = mog('b', 4, 'alchemist', setRoom('d2'), 5)
  const b = boonAt(V(a, bb), W(desk, d2), 'd1'), best = Math.max(luckChance(a), luckChance(bb))
  ok(luckChance(a) !== luckChance(bb) && b.chance === best && b.who?.id === (best === luckChance(bb) ? 'b' : 'a'), `no stacking: best one counts (${b.chance})`) }
// one roll per participant
{ const seq = (xs: number[]) => { let k = 0; return () => xs[k++ % xs.length] }
  let calls = 0; const counting = () => { calls++; return 0.99 }
  extraBottles(0.25, 3, counting); ok(calls === 3, `one roll per participant (${calls} for 3)`)
  ok(extraBottles(0.25, 1, seq([0.1])) === 1 && extraBottles(0.25, 1, seq([0.3])) === 0, 'solo: a roll under the chance = one extra, over = none')
  ok(extraBottles(0.25, 3, seq([0.1, 0.5, 0.2])) === 2, 'a party: each hand rolls its own')
  ok(extraBottles(0, 4, seq([0])) === 0, 'chance 0 never gives a bottle') }
// stand spot: in FRONT of the Desk (local +z), for every turn
for (const q of [0, 1, 2, 3]) { const d = piece('d1', 'alc_desk', 5, 5, q), s = standAt(W(d), mog('a', 3, 'alchemist', setRoom('d1')))!
  const yaw = -q * Math.PI / 2
  ok(Math.abs(s.x - (5 + Math.sin(yaw) * STAND_OFF)) < 1e-9 && Math.abs(s.z - (5 + Math.cos(yaw) * STAND_OFF)) < 1e-9, `stand spot in front at q=${q}`) }
// assign: alchemist only, a Desk only, one per Desk, rest clears
{ const v = V(mog('a', 3), mog('b', 4), mog('c', 3, 'cook'))
  const v1 = assignSet(v, W(desk, still), 'a', 'd1')!
  ok(v1.moglins.find(m => m.id === 'a')!.room === setRoom('d1'), 'assign: an alchemist to a Desk')
  ok(assignSet(v1, W(desk, still), 'b', 'd1') === null, 'assign: one alchemist per Desk')
  ok(assignSet(v, W(desk, still), 'c', 'd1') === null, 'assign: a cook refused')
  ok(assignSet(v, W(desk, still), 'a', 's1') === null, 'assign: a Still is not a Desk')
  ok(assignSet(v1, W(desk), 'a', null)!.moglins.find(m => m.id === 'a')!.room === undefined, 'rest clears the place') }
ok(boonLine(mog('a', 5)) === `+${Math.round(luckChance(mog('a', 5)) * 100)}% chance of an extra bottle at your alchemy set.`, `the line says what it does (${boonLine(mog('a', 5))})`)

console.log(`alchemist-boon: ${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0)
