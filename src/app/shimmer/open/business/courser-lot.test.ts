// business/courser-lot.ts: four ruled makes, a lot each, seven models, each its own feel; bought for Marks, owned, picked
import { MAKES, MODELS, DARTER_MODEL, DARTER_ID, newFleet, buyCourser, pickCourser, modelById, modelsOfMake, makeOfTown } from './courser-lot'
import { NEW_LEDGER } from '../trade'
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
ok(Object.keys(MAKES).join() === 'ashcombe,grimbold,spindle,vantorre', 'the four ruled makes')
ok(new Set(Object.values(MAKES).map(m => m.town)).size === 4 && makeOfTown('rune-hold')?.id === 'ashcombe', 'one lot per make, four towns; Ashcombe where a keeper arrives')
ok(MODELS.map(m => m.id).join() === 'dray,tally,scree,outrider,flick,gyre,sabre', 'the seven ruled models')
ok(modelsOfMake('vantorre').length === 1 && Object.keys(MAKES).every(k => [1, 2].includes(modelsOfMake(k as never).length)), 'each make 1-2 models')
ok(MODELS.every(m => m.look.kind === m.kind), "a model's blockout is its kind's")
ok(modelsOfMake('spindle').every(m => m.kind === 'skitter') && modelsOfMake('grimbold').every(m => m.kind === 'scrambler'), 'kinds per canon (bikes = skitters, off-road = scramblers)')
const sig = (m: typeof DARTER_MODEL) => JSON.stringify([m.spec, m.crates])
ok(new Set([DARTER_MODEL, ...MODELS].map(sig)).size === MODELS.length + 1, 'every model drives differently (spec or crates), and none is the Darter')
ok(MODELS.find(m => m.id === 'dray')!.crates > DARTER_MODEL.crates && MODELS.find(m => m.id === 'sabre')!.spec.topMph === Math.max(...MODELS.map(m => m.spec.topMph)), 'the Dray carries most, the Sabre is fastest')
ok(MODELS.every(m => m.price > 0) && MODELS.find(m => m.id === 'sabre')!.price === Math.max(...MODELS.map(m => m.price)), 'priced, the halo coupe dearest')
const f0 = newFleet()
ok(f0.owned.join() === DARTER_ID && f0.active === DARTER_ID && modelById(null).id === DARTER_ID, 'a keeper starts with the Darter, driving it')
const rich = { ...NEW_LEDGER, marks: 50_000 }
const b = buyCourser(f0, rich, 'dray')
ok(b.ok && b.fleet.owned.includes('dray') && b.ledger.marks === 50_000 - 12_000 && b.fleet.active === DARTER_ID, 'buying the Dray: owned, Marks spent, still driving the Darter until picked')
ok(!buyCourser(b.fleet, b.ledger, 'dray').ok, 'a second Dray is refused')
const poor = buyCourser(f0, { ...NEW_LEDGER, marks: 100 }, 'flick')
ok(!poor.ok && /costs/i.test(poor.why ?? '') && poor.ledger.marks === 100, 'too dear: refused, nothing spent')
ok(!buyCourser(f0, rich, 'nope').ok, 'an unknown model is refused')
ok(pickCourser(b.fleet, 'dray')?.active === 'dray' && pickCourser(b.fleet, 'sabre') === null && pickCourser(b.fleet, DARTER_ID)?.active === DARTER_ID, 'pick only what you own (the Darter always)')
console.log(`courser-lot: ${n - fails} ok, ${fails} fail`); process.exit(fails ? 1 : 0)
