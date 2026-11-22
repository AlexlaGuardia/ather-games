// shared/gun-fit.ts (BETA M81 s2): a kit gun wears the sight it aims through today until the keeper fits another; only an owned
// sight on an owned kit gun fits; the fitting survives a save/load round trip; fp-gun draws the fitted model and aims through its
// optic; a gun without a rail is untouched.
//   npx tsx src/app/shimmer/open/shared/gun-fit.test.ts
import { defaultSight, fittedSight, fitSight, ownedSights, fittedModel, isKitGun } from './gun-fit'
import { KIT_SIGHTS, kitModel } from './gun-kit'
import { newLoadout, setLoadout, type Loadout } from './loadout'
import { modelOf } from './fp-gun'
import { RANGE_GUNS } from './gunplay'
import { opticOf } from './optics'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('✗', m) } }
const gun = (id: string) => RANGE_GUNS.find(g => g.id === id)!
const owning = (...ids: string[]): Loadout => ({ ...newLoadout(), guns: ids, kael: true })

// ── the default: the sight whose optic each gun aims through today (nothing changes for an old keeper) ──
for (const id of ['backbone', 'charred-rifle'] as const) {
  const d = defaultSight(id)
  ok(KIT_SIGHTS[d].optic === opticOf(gun(id)).id, `${id}: default sight ${d} aims through today's optic (${opticOf(gun(id)).id})`)
  ok(fittedSight(owning(id), id) === d, `${id}: nothing fitted -> the default`)
}
ok(fittedSight(owning('repeater'), 'repeater') === null && fittedModel(owning('repeater'), 'repeater') === null, 'a gun without a rail has no fitting')
ok(!isKitGun('repeater') && isKitGun('backbone'), 'isKitGun')

// ── fitting ──
const L = owning('backbone', 'repeater')
ok(ownedSights(L, 'backbone').includes('hood') && ownedSights(L, 'backbone').includes('lens'), 'the Backbone owns its hood + the lens')
const f = fitSight(L, 'backbone', 'hood')
ok(f.ok && fittedSight(f.loadout, 'backbone') === 'hood', 'fit the hood')
ok(f.ok && L.fit === undefined, 'fitting never mutates the loadout it was given')
ok(!fitSight(L, 'backbone', 'ring').ok, "another gun's own sight is not owned for this rail (the ring)")
ok(!fitSight(L, 'backbone', 'nonsense').ok, 'an unknown sight is refused')
ok(!fitSight(L, 'charred-rifle', 'ring').ok, 'a gun you do not own is refused')
ok(!fitSight(L, 'repeater', 'lens').ok, 'a gun without a rail is refused')
if (f.ok) {
  const g2 = fitSight(f.loadout, 'backbone', 'lens')
  ok(g2.ok && fittedSight(g2.loadout, 'backbone') === 'lens', 'refit to the lens')
  // ── survives a save/load: the loadout is stored as JSON ──
  if (g2.ok) {
    const back = JSON.parse(JSON.stringify(g2.loadout)) as Loadout
    ok(fittedSight(back, 'backbone') === 'lens', 'the fitting survives a JSON round trip')
  }
  // a stored fitting that is no longer owned / valid falls back to the default
  ok(fittedSight({ ...L, fit: { backbone: { sight: 'ring' } } }, 'backbone') === defaultSight('backbone'), 'a stale fitting falls back to the default')
}

// ── the drawn model: fp-gun draws the fitted kit model and aims through its optic ──
const lensL = fitSight(L, 'backbone', 'lens')
if (lensL.ok) {
  setLoadout(lensL.loadout)
  const m = modelOf(gun('backbone'))
  ok(m.optic === 'reddot' && m.eye === kitModel('backbone', 'lens').eye, `fp-gun draws the Backbone with the lens (optic ${m.optic})`)
  ok(modelOf(gun('backbone')) === m, 'the same model object every frame (geometry is not rebuilt per frame)')
  const hood = fitSight(lensL.loadout, 'backbone', 'hood')
  if (hood.ok) { setLoadout(hood.loadout); ok(modelOf(gun('backbone')) !== m && modelOf(gun('backbone')).eye === kitModel('backbone', 'hood').eye, 'refitting changes the model in hand') }
  setLoadout(owning('backbone'))
  ok(modelOf(gun('backbone')).optic === opticOf(gun('backbone')).id, 'no fitting: the Backbone aims as it did before M81')
  ok(modelOf(gun('repeater')).optic === undefined, 'the Repeater keeps its own model')
}

console.log(`gun-fit: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
