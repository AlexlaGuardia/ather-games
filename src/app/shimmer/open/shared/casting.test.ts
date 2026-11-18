// npx tsx src/app/shimmer/open/shared/casting.test.ts
import { castMoves, birthTactical, moveOfWord, press, freshClock, cooling, recharge } from './casting'
import { newLoadout } from './loadout'
import { castForMove } from '../../play3d/cast'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  ✗', m) } }

const l = newLoadout()
ok(birthTactical('star') === 'firewall' && birthTactical('manalic') === 'quickform', `birth tacticals: star ${birthTactical('star')}, manalic ${birthTactical('manalic')}`)
ok(castMoves(l, 'star').tactical === 'firewall', 'Q: a blank bracelet does not cast the birth tactical')
ok(castMoves(l, 'star').signature === null, 'X: a blank glove cast something')
ok(castMoves({ ...l, tactical: null }, 'star').tactical === null, 'Q: no bracelet worn still cast')
ok(moveOfWord('Gale Cutter') === 'gale-cutter' && moveOfWord('gale-cutter') === 'gale-cutter' && moveOfWord('nope') === null, 'word: name and id do not both resolve')
const written = { ...l, vessels: l.vessels.map(v => v.kind === 'bracelet' ? { ...v, word: 'Ice Dart' } : v) }
ok(castMoves(written, 'star').tactical === 'ice-dart', 'Q: a written bracelet does not cast its word')

// press: mana, cooldown, refusal spends nothing
const ice = castForMove('ice-dart')
let v = press('tactical', 'ice-dart', freshClock(ice), 1000, 100)
ok(v.ok && v.mana === 100 - ice.manaCost, 'press: did not spend the cast mana')
if (v.ok) {
  const again = press('tactical', 'ice-dart', v.clock, 1000 + ice.cooldownMs - 1, 100)
  ok(!again.ok, 'press: cast again inside the cooldown')
  ok(press('tactical', 'ice-dart', v.clock, 1000 + ice.cooldownMs, 100).ok, 'press: not ready once the cooldown ran out')
  ok(cooling(ice, v.clock, 1000) > 0.99 && cooling(ice, v.clock, 1000 + ice.cooldownMs) === 0, 'cooling: the sweep is wrong')
}
ok(!press('tactical', 'ice-dart', freshClock(ice), 0, ice.manaCost - 1).ok, 'press: cast without the mana')
ok(press('tactical', 'ice-dart', freshClock(ice), 0, 100).ok, 'press: a fight cast fires with nothing to touch (no refusal by place)')
ok(press('tactical', 'mend', freshClock(castForMove('mend')), 0, 100).ok, 'press: a heal away from a fight')
ok(press('tactical', 'quickform', freshClock(castForMove('quickform')), 0, 100).ok, 'press: a launch on the plot')
ok(!press('tactical', 'stonewall', freshClock(castForMove('stonewall')), 0, 100).ok, 'press: a terrain cast went off out here')
ok(!press('signature', null, freshClock(castForMove(null)), 0, 100).ok, 'press: an empty glove cast')

// charges: Quickform holds two, each back one cooldown apart
const qf = castForMove('quickform')
let c = freshClock(qf)
const a = press('tactical', 'quickform', c, 0, 100); ok(a.ok, 'charges: first refused')
if (a.ok) {
  const b = press('tactical', 'quickform', a.clock, 10, 100); ok(b.ok, 'charges: second refused')
  if (b.ok) {
    ok(!press('tactical', 'quickform', b.clock, 20, 100).ok, 'charges: a third with none left')
    ok(recharge(qf, b.clock, qf.cooldownMs).charges === 1 && recharge(qf, b.clock, qf.cooldownMs * 2).charges === 2, 'charges: do not come back one cooldown apiece')
  }
}
console.log(`casting: ${pass}/${fail}`); process.exit(fail ? 1 : 0)
