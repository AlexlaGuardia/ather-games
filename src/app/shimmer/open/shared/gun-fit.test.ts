// shared/gun-fit.ts (BETA M81 s2): a kit gun wears the sight it aims through today until the keeper fits another; only an owned
// sight on an owned kit gun fits; the fitting survives a save/load round trip; fp-gun draws the fitted model and aims through its
// optic; a gun without a rail is untouched.
//   npx tsx src/app/shimmer/open/shared/gun-fit.test.ts
import { defaultSight, fittedSight, fitSight, ownedSights, fittedModel, isKitGun, freeSights, addOwnedSight } from './gun-fit'
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
// M81 s3: FREE = the gun's own + the 2x it aims through today; the open lens is a shop buy
ok(JSON.stringify(ownedSights(L, 'backbone')) === JSON.stringify(['hood', 'scope2']), `free: the Backbone owns its hood + its 2x only (${ownedSights(L, 'backbone')})`)
ok(JSON.stringify(freeSights('charred-rifle')) === JSON.stringify(['ring', 'scope2']), 'free: the Charred Rifle owns its ring + its 2x')
ok(!fitSight(L, 'backbone', 'lens').ok, 'the open lens is not free any more')
const bought = addOwnedSight(L, 'backbone', 'lens')
ok(ownedSights(bought, 'backbone').includes('lens') && fitSight(bought, 'backbone', 'lens').ok, 'bought: the lens joins the Backbone and fits')
ok(addOwnedSight(bought, 'backbone', 'lens') === bought, 'buying an owned sight twice changes nothing')
ok(!ownedSights(bought, 'charred-rifle').includes('lens'), 'a sight bought for one gun is not owned for another')
const ringOnBackbone = addOwnedSight(L, 'backbone', 'ring')
ok(fitSight(ringOnBackbone, 'backbone', 'ring').ok, "a shop can sell another rail's sight (the ring) for the Backbone")
// GRANDFATHERED (hub 11-22): a keeper who had the lens fitted before s3 keeps it
const old: Loadout = { ...L, fit: { backbone: { sight: 'lens' } } }
ok(fittedSight(old, 'backbone') === 'lens' && ownedSights(old, 'backbone').includes('lens'), 'grandfathered: a lens fitted before s3 stays fitted and owned')
const swapped = fitSight(old, 'backbone', 'hood')
ok(swapped.ok && ownedSights(swapped.loadout, 'backbone').includes('lens'), 'grandfathered: swapping the lens off keeps it owned (written into owned)')
if (swapped.ok) { const back = fitSight(swapped.loadout, 'backbone', 'lens'); ok(back.ok && fittedSight(back.loadout, 'backbone') === 'lens', 'and it fits back on') }
const f = fitSight(L, 'backbone', 'hood'), Lb = addOwnedSight(L, 'backbone', 'lens')
ok(f.ok && fittedSight(f.loadout, 'backbone') === 'hood', 'fit the hood')
ok(f.ok && L.fit === undefined, 'fitting never mutates the loadout it was given')
ok(!fitSight(L, 'backbone', 'ring').ok, "another gun's own sight is not owned for this rail (the ring)")
ok(!fitSight(L, 'backbone', 'nonsense').ok, 'an unknown sight is refused')
ok(!fitSight(L, 'charred-rifle', 'ring').ok, 'a gun you do not own is refused')
ok(!fitSight(L, 'repeater', 'lens').ok, 'a gun without a rail is refused')
if (f.ok) {
  const g2 = fitSight(addOwnedSight(f.loadout, 'backbone', 'lens'), 'backbone', 'lens')
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
const lensL = fitSight(Lb, 'backbone', 'lens')
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
